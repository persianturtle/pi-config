#!/usr/bin/env node

/**
 * Print a timestamped YouTube transcript.
 *
 *   node transcript.ts <video-url-or-id> [--lang <code>] [--details] [--json] [--retries <n>]
 *
 *   --lang <code>   preferred language (en, fr, nl); default is the video's first track
 *   --details       include video metadata (title, channel, length, views)
 *   --json          raw JSON instead of formatted text
 *   --retries <n>   extra attempts after a transient failure (default 2)
 */
import { parseArgs } from "node:util";
import { fetchTranscript, formatTimestamp, formatTranscript } from "./fetch.ts";

const USAGE =
  "Usage: node transcript.ts <video-url-or-id> [--lang <code>] [--details] [--json] [--retries <n>]";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readArgs() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        lang: { type: "string" },
        retries: { type: "string", default: "2" },
        details: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
      },
    });
  } catch (error) {
    return fail(`Error: ${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
  }
}

const { values, positionals } = readArgs();
const input = positionals[0];
if (!input) fail(USAGE);

const retries = Number(values.retries);
if (!Number.isInteger(retries) || retries < 0) {
  fail(`Error: --retries expects a non-negative integer, got "${values.retries}"`);
}

try {
  const { videoDetails, segments } = await fetchTranscript(input, { lang: values.lang, retries });

  if (values.json) {
    console.log(JSON.stringify(values.details ? { videoDetails, segments } : segments, null, 2));
  } else {
    if (values.details) {
      console.log(`\n📺 ${videoDetails.title}`);
      console.log(`👤 ${videoDetails.author}`);
      console.log(`⏱  ${formatTimestamp(videoDetails.lengthSeconds)}`);
      console.log(`👁  ${videoDetails.viewCount.toLocaleString()} views`);
      console.log("\n--- Transcript ---\n");
    }
    if (segments.length === 0) {
      console.warn("⚠️ No transcript segments found — the caption format may have changed.");
    } else {
      console.log(formatTranscript(segments));
    }
  }
} catch (error) {
  fail(`Error: ${error instanceof Error ? error.message : String(error)}`);
}
