import {
  YouTubeInvalidVideoIdError,
  YouTubeTooManyRequestsError,
  YouTubeTranscriptDisabledError,
  YouTubeTranscriptLanguageNotAvailableError,
  YouTubeTranscriptNotAvailableError,
  YouTubeVideoUnavailableError,
} from "./errors.ts";
import type { CaptionTrack, TranscriptResult, TranscriptSegment, VideoDetails } from "./types.ts";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// ── Video ID extraction ───────────────────────────────────────────────

/**
 * Extract a 11-character video ID from various YouTube URL formats.
 * Also passes through bare 11-char IDs unchanged.
 */
export function extractVideoId(input: string): string {
  // Already a bare 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  // Pattern match common URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  throw new YouTubeInvalidVideoIdError(input);
}

// ── XML parsing ───────────────────────────────────────────────────────

/**
 * Extract text from a <p> element's children, handling both formats:
 *   1. <p t="..." d="..."><s>word</s><s t="400">word2</s></p>  (format 3)
 *   2. <p t="..." d="...">plain text</p>                     (older format)
 *
 * Returns an array of { offset, text } pairs.
 * Note: YouTube format 3 uses <s> child elements where the t attribute
 * is an offset in milliseconds relative to the parent <p> element.
 */
function extractPhrases(pText: string): { offset: number; text: string }[] {
  // Format 3: text inside <s> child elements
  const sRegex = /<s(?:\s+t="([\d.]+)")?>([^<]*)/g;
  const results: { offset: number; text: string }[] = [];

  while (true) {
    const match = sRegex.exec(pText);
    if (match === null) break;

    const text = (match[2] as string).trim();
    if (text.length > 0) {
      // If there's an t attribute on <s>, it's an offset from the <p> start (in milliseconds)
      const sOffset = match[1] !== undefined ? parseFloat(match[1]) : 0;
      results.push({ offset: sOffset, text });
    }
  }

  // If we found <s> children, return them
  if (results.length > 0) {
    return results;
  }

  // Fallback: plain text content inside <p>
  const text = pText.trim();
  if (text.length > 0) {
    return [{ offset: 0, text }];
  }

  return [];
}

/**
 * Parse YouTube's transcript XML into timestamped segments.
 *
 * YouTube format 3 returns XML like:
 *   <p t="1234" d="5678" w="1">...</p>
 * where t and d are in milliseconds, and text may be inside <s> children:
 *   <s t="100">word</s><s t="500">next word</s>
 *
 * Older formats may have plain text directly inside <p> with centisecond values.
 */
function parseTranscriptXml(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];

  // Match <p> tags — d may or may not be the last attribute before >
  // YouTube format 3 uses millisecond timestamps
  const tagRegex = /<p\s+t="([\d.]+)"(?:\s+d="([\d.]+)")?[^>]*>([\s\S]*?)<\/p>/g;

  while (true) {
    const match = tagRegex.exec(xml);
    if (match === null) {
      break;
    }

    // t is the start of the <p> block in milliseconds
    const pStart = parseFloat(match[1] as string) / 1000;
    const dur = typeof match[2] === "string" ? parseFloat(match[2]) / 1000 : 10 / 1000;
    const innerText = match[3] as string;

    // Extract phrases, handling <s> child tags
    const phrases = extractPhrases(innerText);
    for (const phrase of phrases) {
      const text = decodeXmlEntities(phrase.text).replace(/\s+/g, " ").trim();
      if (text.length > 0) {
        segments.push({
          offset: pStart + phrase.offset / 1000,
          duration: dur / phrases.length,
          text,
        });
      }
    }
  }

  return segments;
}

/** Decode common XML entities. */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// ── Fetch helpers ─────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
        ...options.headers,
      },
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Core logic ────────────────────────────────────────────────────────

/**
 * Extract the Innertube API key from a YouTube watch page.
 */
async function extractApiKey(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetchWithTimeout(url);

  if (!res.ok) {
    throw new YouTubeVideoUnavailableError(videoId);
  }

  const html = await res.text();

  // Bot/captcha detection
  if (html.includes('class="g-recaptcha"')) {
    throw new YouTubeTooManyRequestsError();
  }

  // Try to find INNERTUBE_API_KEY in various forms (minified JS)
  const patterns = [/"INNERTUBE_API_KEY":"([^"]+)"/, /INNERTUBE_API_KEY\\":\\"([^\\"]+)\\"/];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  throw new YouTubeTranscriptNotAvailableError(videoId);
}

/**
 * Call the Innertube player API to get caption tracks.
 */
async function getCaptionTracks(
  apiKey: string,
  videoId: string,
): Promise<{ tracks: CaptionTrack[]; playerJson: Record<string, unknown> }> {
  const playerUrl = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;
  const body = JSON.stringify({
    context: {
      client: {
        clientName: "ANDROID",
        clientVersion: "20.10.38",
        androidSdkVersion: 30,
      },
    },
    videoId,
  });

  const res = await fetchWithTimeout(playerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) {
    throw new YouTubeVideoUnavailableError(videoId);
  }

  const playerJson = (await res.json()) as Record<string, unknown>;

  // Check playability
  const playability = playerJson.playabilityStatus as Record<string, unknown> | undefined;
  if (playability?.status !== "OK") {
    throw new YouTubeVideoUnavailableError(videoId);
  }

  const captions = playerJson.captions as Record<string, unknown> | undefined;
  const tracklist =
    (captions?.playerCaptionsTracklistRenderer as Record<string, unknown> | undefined) ??
    (playerJson.playerCaptionsTracklistRenderer as Record<string, unknown> | undefined);

  const tracklistObj = tracklist ?? {};
  const captionTracks = (tracklistObj.captionTracks as CaptionTrack[] | undefined) ?? [];
  const tracks = captionTracks;

  if (tracks.length === 0) {
    throw new YouTubeTranscriptDisabledError(videoId);
  }

  return { tracks, playerJson };
}

/**
 * Fetch the transcript XML from a caption track URL.
 */
async function fetchTranscriptXml(baseUrl: string): Promise<string> {
  const url = `${baseUrl}&fmt=vtt`;
  const res = await fetchWithTimeout(url);

  if (!res.ok) {
    throw new YouTubeTranscriptNotAvailableError("Failed to fetch transcript");
  }

  return res.text();
}

/**
 * Fetch video details from the player response JSON.
 */
function extractVideoDetails(playerJson: Record<string, unknown>, videoId: string): VideoDetails {
  const raw = (playerJson.videoDetails as Record<string, unknown>) ?? {};

  return {
    videoId: (raw.videoId as string) ?? videoId,
    title: (raw.title as string) ?? "",
    author: (raw.author as string) ?? "",
    channelId: (raw.channelId as string) ?? "",
    lengthSeconds: parseInt((raw.lengthSeconds as string) ?? "0", 10),
    viewCount: parseInt((raw.viewCount as string) ?? "0", 10),
    description: (raw.shortDescription as string) ?? "",
    keywords: (raw.keywords as string[]) ?? [],
    isLiveContent: (raw.isLiveContent as boolean) ?? false,
  };
}

// ── Retry wrapper ────────────────────────────────────────────────────

interface CaptionFetchResult {
  tracks: CaptionTrack[];
  playerJson: Record<string, unknown>;
}

async function fetchWithRetry(videoId: string, retries: number): Promise<CaptionFetchResult> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const apiKey = await extractApiKey(videoId);
      return await getCaptionTracks(apiKey, videoId);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Don't retry rate-limit or not-available errors
      if (
        lastError instanceof YouTubeTooManyRequestsError ||
        lastError instanceof YouTubeTranscriptDisabledError ||
        lastError instanceof YouTubeTranscriptNotAvailableError
      ) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Unknown error after retries");
}

// ── Public API ────────────────────────────────────────────────────────

interface FetchOptions {
  /** Preferred language code (e.g. "en", "fr", "nl"). Falls back to auto. */
  lang?: string;
  /** Whether to include video metadata. Default: false. */
  videoDetails?: boolean;
  /** Max retries on transient errors. Default: 2. */
  retries?: number;
}

/**
 * Fetch a timestamped transcript for a YouTube video.
 *
 * @example
 * ```ts
 * const segments = await fetchTranscript("dQw4w9WgXcQ");
 * // [{ offset: 0, duration: 3.2, text: "All right." }, ...]
 *
 * const result = await fetchTranscript("dQw4w9WgXcQ", {
 *   lang: "en",
 *   videoDetails: true,
 * });
 * // { videoDetails: { ... }, segments: [...] }
 * ```
 */
export async function fetchTranscript(
  input: string,
  opts: FetchOptions = {},
): Promise<TranscriptSegment[] | TranscriptResult> {
  const videoId = extractVideoId(input);
  const lang = opts.lang;
  const retries = opts.retries ?? 2;

  const { tracks, playerJson: safePlayerJson } = await fetchWithRetry(videoId, retries);

  // Select caption track
  const track = selectTrack(tracks, lang);
  if (!track) {
    const code = lang ?? "auto";
    throw new YouTubeTranscriptLanguageNotAvailableError(videoId, code);
  }

  // Fetch transcript XML
  const xml = await fetchTranscriptXml(track.baseUrl);

  // Parse segments
  const segments = parseTranscriptXml(xml);

  // Return with or without metadata
  if (opts.videoDetails) {
    return {
      videoDetails: extractVideoDetails(safePlayerJson, videoId),
      segments,
    };
  }

  return segments;
}

/**
 * List available caption track languages for a video.
 */
export async function listLanguages(input: string): Promise<
  {
    code: string;
    name: string;
    autoCaptions?: boolean;
  }[]
> {
  const videoId = extractVideoId(input);
  const apiKey = await extractApiKey(videoId);
  const { tracks } = await getCaptionTracks(apiKey, videoId);

  return tracks.map((t) => ({
    code: t.languageCode,
    name:
      typeof t.name === "object" && t.name !== null && "originalString" in t.name
        ? ((t.name as Record<string, unknown>).originalString as string)
        : (t.name as string),
    autoCaptions: t.vssId.startsWith("a."),
  }));
}

/**
 * Format segments into the timestamped transcript format:
 *   [0:00] Text here
 *   [0:15] More text
 */
export function formatTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => {
      const time = formatTimestamp(s.offset);
      return `[${time}] ${s.text}`;
    })
    .join("\n");
}

/**
 * Format a time in seconds to [m:ss] or [H:MM:SS].
 */
export function formatTimestamp(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

// ── Internal helpers ──────────────────────────────────────────────────

function selectTrack(tracks: CaptionTrack[], lang: string | undefined): CaptionTrack | undefined {
  if (!lang) {
    // Return the first track (usually English or auto-generated)
    return tracks[0];
  }

  // Exact match first
  const exact = tracks.find((t) => t.languageCode === lang);
  if (exact) return exact;

  // Language family match (e.g. "en" matches "en-US")
  const family = tracks.find((t) => t.languageCode.startsWith(lang));
  if (family) return family;

  return undefined;
}
