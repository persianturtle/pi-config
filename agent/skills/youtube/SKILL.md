---
name: youtube
description: Fetch timestamped transcripts from YouTube videos. Use when the user asks for a YouTube video transcript, summary of video content, or wants to extract what was said in a video.
---

# YouTube Transcript

Prints a video's captions with timestamps. No API key and no install step — plain
`node`, no dependencies.

```bash
T=~/.pi/agent/skills/youtube/transcript.ts

node $T https://youtube.com/watch?v=<video-id>   # a URL (watch, shorts, embed, youtu.be)…
node $T <video-id>                               # …or the bare 11-character ID
node $T <video-id> --lang nl                     # a specific language
node $T <video-id> --details                     # with title, channel, length, views
node $T <video-id> --details --json              # raw JSON
```

Output:

```
[0:00] All right. So, I got this UniFi Theta
[0:15] I took the camera out, painted it
[1:23] And here's the final result
```

`--json` prints the segments as `[{ offset, duration, text }]` (seconds); with
`--details` it prints `{ videoDetails, segments }`.

## When it fails

Failures exit non-zero with one `Error:` line that says which case it is:

| Message | Meaning |
| --- | --- |
| `Could not extract a valid video ID` | The input is not a YouTube URL or ID. |
| `unavailable or not playable` | Private, removed, or region/age-restricted. |
| `Transcript is disabled` | The video has no captions at all. |
| `No "<lang>" transcript … Available: …` | Retry with one of the listed language codes. |
| `rate-limited (captcha)` | YouTube is blocking this IP for now; wait rather than retry. |

Transient network failures are retried twice by default; `--retries <n>` changes that.
