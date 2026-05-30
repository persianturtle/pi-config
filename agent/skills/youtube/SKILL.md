---
name: youtube
description: Fetch timestamped transcripts from YouTube videos. Use when the user asks for a YouTube video transcript, summary of video content, or wants to extract what was said in a video.
---

# YouTube Transcript

Fetch timestamped transcripts from YouTube videos using the Innertube API. No API key required — uses the Android client endpoint.

## Setup

Run once before first use:

```bash
cd ~/.pi/agent/skills/youtube
npm install
```

## Usage

```bash
# Basic — formatted timestamped output
node transcript.ts https://youtube.com/watch?v=<video-id>

# Just the video ID works too
node transcript.ts <video-id>

# Specific language
node transcript.ts https://youtu.be/<video-id> --lang nl

# With video metadata
node transcript.ts <video-id> --details

# Raw JSON output (for programmatic use)
node transcript.ts <video-id> --details --json
```

## Output Format

```
[0:00] All right. So, I got this UniFi Theta
[0:15] I took the camera out, painted it
[1:23] And here's the final result
```

With `--details`, the output includes a header:

```
📺 Video Title Here
👤 Channel Name
⏱ 3:45
👁 123,456 views

--- Transcript ---

[0:00] First line of transcript
[0:15] Second line
```

## TypeScript API

Import from `fetch.ts` for programmatic use:

```typescript
import {
  fetchTranscript,
  listLanguages,
  formatTranscript,
  formatTimestamp,
  extractVideoId,
} from "./fetch.js";

// Fetch segments only
const segments = await fetchTranscript("dQw4w9WgXcQ");
// => [{ offset: 0, duration: 3.2, text: "..." }, ...]

// Fetch with metadata
const result = await fetchTranscript("dQw4w9WgXcQ", {
  lang: "nl",
  videoDetails: true,
});
// => { videoDetails: { title, author, lengthSeconds, ... }, segments }

// List available languages
const langs = await listLanguages("dQw4w9WgXcQ");
// => [{ code: "en", name: "English" }, { code: "nl", name: "Nederlands (auto-gegenereerd)", autoCaptions: true }, ...]

// Format segments as timestamped text
const text = formatTranscript(segments);
// => "[0:00] First line\n[0:15] Second line"

// Extract video ID from any URL format
const id = extractVideoId("https://youtube.com/watch?v=abc123"); // "abc123"
```

## Error Handling

The module throws specific error types:

| Error                        | Meaning                                            |
| ---------------------------- | -------------------------------------------------- |
| `YouTubeInvalidVideoIdError` | Could not extract video ID from input              |
| `YouTubeVideoUnavailableError` | Video is private, removed, or not playable       |
| `YouTubeTooManyRequestsError` | Rate-limited (captcha detected)                    |
| `YouTubeTranscriptDisabledError` | Transcript/captions disabled for this video      |
| `YouTubeTranscriptNotAvailableError` | No transcript found                      |
| `YouTubeTranscriptLanguageNotAvailableError` | Requested language not available       |

## When to Use

- User asks to summarize a YouTube video
- User wants to know "what was said" in a video
- User provides a YouTube URL and wants the transcript
- User wants to search/analyze video content by transcript text
