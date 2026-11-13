/**
 * Fetch a YouTube transcript through the Innertube player API (Android client),
 * which needs no API key of our own.
 */

export type TranscriptSegment = {
  /** Seconds from the start of the video. */
  offset: number;
  /** Segment length in seconds. */
  duration: number;
  text: string;
};

export type VideoDetails = {
  videoId: string;
  title: string;
  author: string;
  channelId: string;
  lengthSeconds: number;
  viewCount: number;
  description: string;
  keywords: string[];
  isLiveContent: boolean;
};

export type Transcript = { videoDetails: VideoDetails; segments: TranscriptSegment[] };

export type FetchOptions = {
  /** Preferred language code ("en", "nl"). Default: the video's first track. */
  lang?: string;
  /** Extra attempts after a transient failure. Default: 2. */
  retries?: number;
};

type CaptionTrack = { languageCode: string; baseUrl: string };
type Json = Record<string, unknown>;

/** A failure that another attempt will not fix (no captions, rate limit, bad input). */
class PermanentError extends Error {}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/** Accepts a bare 11-character ID or a watch / shorts / embed / youtu.be URL. */
export function extractVideoId(input: string): string {
  if (/^[\w-]{11}$/.test(input)) return input;
  const match = input.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})/,
  );
  if (match?.[1]) return match[1];
  throw new PermanentError(`Could not extract a valid video ID from "${input}".`);
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9", ...init.headers },
  });
}

/** The Innertube key is embedded in the watch page. */
async function fetchApiKey(videoId: string): Promise<string> {
  const res = await request(`https://www.youtube.com/watch?v=${videoId}`);
  if (!res.ok) throw new Error(`Video "${videoId}" is unavailable (HTTP ${res.status}).`);

  const html = await res.text();
  if (html.includes('class="g-recaptcha"')) {
    throw new PermanentError("YouTube rate-limited the request (captcha). Try again later.");
  }
  const key = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  if (!key) throw new PermanentError(`No transcript found for video "${videoId}".`);
  return key;
}

async function fetchPlayer(videoId: string): Promise<{ tracks: CaptionTrack[]; player: Json }> {
  const apiKey = await fetchApiKey(videoId);
  const res = await request(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: {
        client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 30 },
      },
      videoId,
    }),
  });
  const player = res.ok ? ((await res.json()) as Json) : {};
  if ((player.playabilityStatus as Json | undefined)?.status !== "OK") {
    throw new Error(`Video "${videoId}" is unavailable or not playable.`);
  }

  const tracklist = (player.captions as Json | undefined)?.playerCaptionsTracklistRenderer;
  const tracks =
    ((tracklist as Json | undefined)?.captionTracks as CaptionTrack[] | undefined) ?? [];
  if (tracks.length === 0) {
    throw new PermanentError(`Transcript is disabled for video "${videoId}".`);
  }
  return { tracks, player };
}

async function withRetries<T>(retries: number, action: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (error instanceof PermanentError || attempt >= retries) throw error;
    }
  }
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Transcript XML is a list of `<p t="ms" d="ms">` blocks. The text is either
 * directly inside the block, or split into `<s t="ms">word</s>` children whose
 * `t` is relative to the block's start.
 */
function parseTranscriptXml(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];

  for (const block of xml.matchAll(/<p\s+t="([\d.]+)"(?:\s+d="([\d.]+)")?[^>]*>([\s\S]*?)<\/p>/g)) {
    const start = Number(block[1]) / 1000;
    const duration = Number(block[2] ?? 10) / 1000;
    const inner = block[3] ?? "";

    const words = [...inner.matchAll(/<s(?:\s+t="([\d.]+)")?>([^<]*)/g)]
      .map((word) => ({ offset: Number(word[1] ?? 0), text: (word[2] ?? "").trim() }))
      .filter((word) => word.text.length > 0);
    const phrases = words.length > 0 ? words : [{ offset: 0, text: inner }];

    for (const phrase of phrases) {
      const text = decodeXmlEntities(phrase.text).replace(/\s+/g, " ").trim();
      if (text.length === 0) continue;
      segments.push({
        offset: start + phrase.offset / 1000,
        duration: duration / phrases.length,
        text,
      });
    }
  }

  return segments;
}

function toVideoDetails(player: Json, videoId: string): VideoDetails {
  const raw = (player.videoDetails as Json | undefined) ?? {};
  return {
    videoId: (raw.videoId as string) ?? videoId,
    title: (raw.title as string) ?? "",
    author: (raw.author as string) ?? "",
    channelId: (raw.channelId as string) ?? "",
    lengthSeconds: Number.parseInt((raw.lengthSeconds as string) ?? "0", 10),
    viewCount: Number.parseInt((raw.viewCount as string) ?? "0", 10),
    description: (raw.shortDescription as string) ?? "",
    keywords: (raw.keywords as string[]) ?? [],
    isLiveContent: (raw.isLiveContent as boolean) ?? false,
  };
}

/** Fetch the transcript and video metadata for a YouTube URL or video ID. */
export async function fetchTranscript(
  input: string,
  options: FetchOptions = {},
): Promise<Transcript> {
  const videoId = extractVideoId(input);
  const { lang, retries = 2 } = options;
  const { tracks, player } = await withRetries(retries, () => fetchPlayer(videoId));

  // Exact match first, then language family ("en" matches "en-US").
  const track = lang
    ? (tracks.find((t) => t.languageCode === lang) ??
      tracks.find((t) => t.languageCode.startsWith(lang)))
    : tracks[0];
  if (!track) {
    const available = tracks.map((t) => t.languageCode).join(", ");
    throw new Error(`No "${lang}" transcript for video "${videoId}". Available: ${available}`);
  }

  const res = await request(`${track.baseUrl}&fmt=vtt`);
  if (!res.ok) throw new Error(`Failed to fetch the transcript (HTTP ${res.status}).`);

  return {
    videoDetails: toVideoDetails(player, videoId),
    segments: parseTranscriptXml(await res.text()),
  };
}

/** Seconds → `m:ss`, or `h:mm:ss` from one hour up. */
export function formatTimestamp(seconds: number): string {
  const total = Math.floor(seconds);
  const pad = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(total % 60)}`
    : `${minutes}:${pad(total % 60)}`;
}

/** One `[m:ss] text` line per segment. */
export function formatTranscript(segments: TranscriptSegment[]): string {
  return segments.map((s) => `[${formatTimestamp(s.offset)}] ${s.text}`).join("\n");
}
