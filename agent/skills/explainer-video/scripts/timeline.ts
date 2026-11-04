/**
 * Timeline: turn a scene list into timings, and complain before anything is rendered.
 *
 *   node scripts/timeline.ts --scenes scenes.mjs [--vo vo.json] [--frames frames]
 *                            [--target 15] [--json]
 *
 * Scene fields read here: id, kind, dur (explicit override), vo (string),
 * clip / footage.clip (captured footage to overlay), clipMode ("play" | "hold").
 *
 * A scene is as long as its LONGEST obligation — reading time, spoken time, or
 * footage time — never the average of them, and never shorter than the footage
 * it shows. Truncating footage mid-action is the usual way these videos lose
 * the plot.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** ~21 chars/sec for dense technical text at slide sizes. */
const READ_CPS = 21;
/** ~145 wpm, slow side of conversational, plus a beat between sentences. */
const WORD_SEC = 0.42;
const MIN_SCENE = 6;
const MAX_SCENE = 24;

type Scene = {
  id: string;
  kind?: string;
  dur?: number;
  vo?: string;
  clip?: string;
  footage?: { clip?: string };
  clipMode?: string;
  [k: string]: unknown;
};

/** With a fallback the result is always a string, so callers do not need guards. */
function arg(name: string): string | undefined;
function arg(name: string, fallback: string): string;
function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const flat = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flat).join(" ");
  if (value && typeof value === "object") {
    const keep = [
      "title",
      "kicker",
      "lead",
      "bullets",
      "cols",
      "rows",
      "lines",
      "notes",
      "steps",
      "items",
      "captions",
    ];
    return keep.flatMap((k) => flat((value as Record<string, unknown>)[k])).join(" ");
  }
  return "";
};

async function loadScenes(path: string): Promise<Scene[]> {
  const full = resolve(path);
  if (full.endsWith(".json")) return JSON.parse(readFileSync(full, "utf8"));
  const mod = await import(full);
  // accept `export default [...]`, `export const scenes`, or any named array export,
  // so an existing scene file does not have to be rewritten to be measured
  const looksLikeScenes = (v: unknown) =>
    Array.isArray(v) && v.length > 0 && v.every((s) => s && typeof s === "object" && "id" in s);
  const arr = [mod.default, mod.scenes, ...Object.values(mod)].find(looksLikeScenes) as unknown;
  if (!Array.isArray(arr)) {
    throw new Error(
      `${path} must export an array of scenes (default, .scenes, or any array export)`,
    );
  }
  return arr as Scene[];
}

function clipSeconds(dir: string, fps: number, mode: string) {
  if (!existsSync(dir)) return null;
  const n = readdirSync(dir).length;
  // A held clip is a still: it does not need its full duration on screen.
  return mode === "hold" ? 0 : n / fps;
}

const scenes = await loadScenes(arg("scenes", "scenes.mjs") as string);
const fps = Number(arg("fps", "30"));
const framesRoot = arg("frames", "frames");
const target = Number(arg("target", "0"));
const voFile = arg("vo");
const voDurations: Record<string, number> = voFile ? JSON.parse(readFileSync(voFile, "utf8")) : {};

const problems: string[] = [];
let t = 0;
const plan = scenes.map((s) => {
  const clip = s.footage?.clip ?? s.clip;
  const mode = (s.clipMode ?? "play") as string;
  let footage = 0;
  if (clip) {
    const dir = resolve(framesRoot, clip);
    const seconds = clipSeconds(dir, fps, mode);
    if (seconds === null) problems.push(`${s.id}: clip "${clip}" does not exist at ${dir}`);
    else footage = seconds + 5; // + tail so the result is still on screen while it is discussed
  }
  const text = flat(s);
  const words = (s.vo ?? "").split(/\s+/).filter(Boolean).length;
  // Real audio length when it exists, word estimate only before synthesis.
  const measured = voDurations[s.id] as number | undefined;
  const spoken = measured ?? words * WORD_SEC;
  const read = text.length / READ_CPS;
  const dur = s.dur ?? Math.min(MAX_SCENE, Math.max(MIN_SCENE, Math.max(read, spoken, footage)));
  if (s.dur && spoken > s.dur - 1.6) {
    problems.push(
      `${s.id}: ${spoken.toFixed(1)}s of VO${measured ? "" : " (estimated)"} in a ${s.dur}s scene — ` +
        "it will be truncated or speed up",
    );
  }
  const scene = { ...s, start: Number(t.toFixed(2)), dur: Number(dur.toFixed(2)) };
  t += dur;
  return scene;
});

const total = Number(t.toFixed(1));
const byKind = plan.reduce<Record<string, number>>((acc, s) => {
  acc[s.kind ?? "?"] = (acc[s.kind ?? "?"] ?? 0) + 1;
  return acc;
}, {});

if (target > 0) {
  const drift = ((total - target * 60) / (target * 60)) * 100;
  if (Math.abs(drift) > 12) {
    problems.push(
      `total ${total}s is ${drift > 0 ? "over" : "under"} the ${target * 60}s target by ${Math.abs(drift).toFixed(0)}%` +
        " — cut scenes, do not shrink scenes",
    );
  }
}

if (arg("json")) {
  console.log(JSON.stringify({ total, fps, problems, scenes: plan }, null, 2));
} else {
  for (const s of plan) {
    const clip = s.footage?.clip ?? s.clip;
    console.log(
      `  ${s.id.padEnd(20)} ${String(s.start).padStart(7)}s  ${s.dur.toFixed(1).padStart(5)}s  ${(
        s.kind ?? "?"
      ).padEnd(9)} ${s.vo ? "vo" : "  "}`,
    );
    if (clip) console.log(`  ${"".padEnd(20)}          footage: ${clip}`);
  }
  console.log(`\ntotal ${total}s (${(total / 60).toFixed(1)} min), ${plan.length} scenes`);
  console.log("kinds:", JSON.stringify(byKind));
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ! ${p}`);
  process.exit(1);
}
