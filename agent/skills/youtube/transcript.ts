#!/usr/bin/env node

/**
 * CLI: Fetch and display a timestamped YouTube transcript.
 *
 * Usage:
 *   node transcript.ts <video-url-or-id> [options]
 *
 * Options:
 *   --lang <code>     Preferred language (e.g. en, fr, nl)
 *   --details         Include video metadata
 *   --retries <n>     Max retries (default: 2)
 *   --json            Output raw JSON instead of formatted text
 *
 * Examples:
 *   node transcript.ts https://youtube.com/watch?v=dQw4w9WgXcQ
 *   node transcript.ts dQw4w9WgXcQ --lang nl
 *   node transcript.ts https://youtu.be/abc123 --details --json
 */

import { fetchTranscript, formatTimestamp, formatTranscript } from "./fetch.ts";
import type { TranscriptSegment } from "./types.ts";

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const args: Record<string, string | undefined> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (!arg) {
      i++;
      continue;
    }
    if (arg === "--json") {
      args.json = "true";
    } else if (arg === "--details") {
      args.details = "true";
    } else if (arg === "--lang" && i + 1 < argv.length) {
      args.lang = argv[++i];
    } else if (arg === "--retries" && i + 1 < argv.length) {
      args.retries = argv[++i];
    } else if (!arg.startsWith("-")) {
      args._input = arg;
    }
    i++;
  }
  return args;
}

async function main() {
  const raw = parseArgs(process.argv.slice(2));
  const input = raw._input;

  if (!input) {
    console.error(
      "Usage: node transcript.ts <video-url-or-id> [--lang <code>] [--details] [--json]",
    );
    process.exit(1);
  }

  const opts: { lang?: string; videoDetails?: boolean; retries?: number } = {};
  if (raw.lang) opts.lang = raw.lang;
  if (raw.details) opts.videoDetails = true;
  if (raw.retries !== undefined) {
    const retries = Number.parseInt(raw.retries, 10);
    if (!Number.isInteger(retries) || retries < 0) {
      console.error(`Error: --retries expects a non-negative integer, got "${raw.retries}"`);
      process.exit(1);
    }
    opts.retries = retries;
  }

  try {
    const result = await fetchTranscript(input, opts);

    if (raw.json === "true") {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if ("videoDetails" in result) {
      const vd = result.videoDetails;
      console.log(`\n📺 ${vd.title}`);
      console.log(`👤 ${vd.author}`);
      console.log(`⏱  ${formatTimestamp(vd.lengthSeconds)}`);
      console.log(`👁  ${vd.viewCount.toLocaleString()} views`);
      console.log(`\n--- Transcript ---\n`);
      if (result.segments.length === 0) {
        console.warn(
          "⚠️ No transcript segments found. The video may not have captions or the format may have changed.",
        );
      } else {
        console.log(formatTranscript(result.segments));
      }
    } else {
      if ((result as TranscriptSegment[]).length === 0) {
        console.warn(
          "⚠️ No transcript segments found. The video may not have captions or the format may have changed.",
        );
      } else {
        console.log(formatTranscript(result as TranscriptSegment[]));
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
