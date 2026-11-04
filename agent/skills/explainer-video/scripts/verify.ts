/**
 * The gate. Run it on the finished file and believe the output, not your eyes.
 *
 *   node scripts/verify.ts build/walkthrough.mp4 [--plan plan.json]
 *       [--scene-frames frames/deck] [--clip-root frames] [--fps 30]
 *       [--sheet 12] [--silence-floor -34]
 *
 * Why each check exists — every one of these fired on a real build:
 *   audio    stretches under about -34 dB read as a broken file, not as quiet
 *   flat     a picture-in-picture that scrolled into blank gutter encoded fine
 *            and was unreadable; only a bulk check catches that
 *   frozen   a stuck overlay looks intentional in any single still
 *   overlap  narration longer than its scene spills into the next one, so two
 *            voices talk at once — invisible in both the video and the audio
 *   plan/file duration drift means a scene was truncated somewhere downstream
 *
 * Exits non-zero on failure so it can be the last step of a build script.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FF = process.env.FFMPEG ?? "ffmpeg";

type Scene = { id: string; start: number; dur: number; vo?: unknown; [k: string]: unknown };

function arg(name: string): string | undefined;
function arg(name: string, fallback: string): string;
function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

/**
 * ffmpeg writes filter summaries (volumedetect, silencedetect, blackdetect,
 * freezedetect) to **stderr**, and only at info level or above. Reading stdout
 * alone returns an empty string and every check below silently passes, so both
 * streams are captured and the log level is left alone. Do not quiet this call.
 */
const ff = (args: string[]) => {
  const r = spawnSync(FF, ["-hide_banner", ...args], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.error) throw r.error;
  return `${r.stdout ?? ""}${r.stderr ?? ""}`;
};

/** Rendering calls: nothing to parse, so keep them quiet and overwrite freely. */
const ffq = (args: string[]) => {
  const r = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    encoding: "utf8",
    maxBuffer: 1 << 28,
  });
  if (r.status !== 0) throw new Error((r.stderr ?? "render failed").slice(-300));
  return r.stdout ?? "";
};

const probe = (args: string[]) => {
  const r = spawnSync("ffprobe", ["-v", "error", ...args], { encoding: "utf8" });
  return (r.stdout ?? "").trim();
};

const wordSeconds = (text: string) => text.split(/\s+/).filter(Boolean).length * 0.42;

const fails: string[] = [];
const notes: string[] = [];

const video = process.argv[2];
if (!video || !existsSync(video)) {
  console.error("usage: node scripts/verify.ts <file.mp4> [--plan plan.json] [--sheet 12]");
  process.exit(2);
}

const duration = Number(probe(["-show_entries", "format=duration", "-of", "csv=p=0", video]));
if (!duration) {
  console.error(`ffprobe read no duration from ${video} — is it a valid file?`);
  process.exit(2);
}

/* ------------------------------------------------------------------ audio -- */

const floor = Number(arg("silence-floor", "-34"));
const levels = ff(["-i", video, "-af", "volumedetect", "-f", "null", "-"]);
const mean = Number(/mean_volume: (-?[\d.]+) dB/.exec(levels)?.[1] ?? NaN);
const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(levels)?.[1] ?? NaN);

if (Number.isNaN(mean)) {
  fails.push("no volumedetect output — the audio check never ran, so trust nothing here");
} else {
  if (mean < floor)
    fails.push(`whole file averages ${mean} dB — under ${floor} dB reads as silence`);
  if (!Number.isNaN(peak) && peak > -1) fails.push(`peak ${peak} dB — too close to clipping`);

  const silence = ff(["-i", video, "-af", `silencedetect=n=${floor}dB:d=3`, "-f", "null", "-"]);
  const dead = [...silence.matchAll(/silence_duration: ([\d.]+)/g)].reduce(
    (a, m) => a + Number(m[1]),
    0,
  );
  const share = (dead / duration) * 100;
  notes.push(
    `audio mean ${mean} dB / peak ${peak} dB; under ${floor} dB for ${dead.toFixed(0)}s (${share.toFixed(0)}%)`,
  );
  if (share > 20) {
    fails.push(
      `${share.toFixed(0)}% of the runtime is under ${floor} dB — add a bed or cut the stretches; ` +
        "past 20% it reads as a broken file",
    );
  }
}

/* ------------------------------------------------------------------ video -- */

const flat = ff(["-i", video, "-vf", "blackdetect=d=1.2:pix_th=0.12", "-an", "-f", "null", "-"]);
const flats = [...flat.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)];
if (flats.length) {
  fails.push(
    `${flats.length} flat/black stretch(es): ${flats
      .slice(0, 6)
      .map((m) => `${Number(m[1]).toFixed(0)}-${Number(m[2]).toFixed(0)}s`)
      .join(", ")}${flats.length > 6 ? " …" : ""}`,
  );
}

const frozen = ff(["-i", video, "-vf", "freezedetect=n=-45dB:d=8", "-an", "-f", "null", "-"]);
const freezes = [...frozen.matchAll(/freeze_duration: ([\d.]+)/g)]
  .map((m) => Number(m[1]))
  .filter((d) => d > 9);
if (freezes.length) {
  notes.push(
    `${freezes.length} frozen stretch(es) >9s — fine if that is a designed hold, a bug if an ` +
      "overlay or animation stopped",
  );
}

/* ------------------------------------------------------------------- plan -- */

const planPath = arg("plan");
if (planPath && existsSync(planPath)) {
  const parsed = JSON.parse(readFileSync(planPath, "utf8"));
  const scenes: Scene[] = parsed.scenes ?? parsed;
  const fps = Number(arg("fps", "30"));

  const planned = scenes.reduce((a, s) => a + s.dur, 0);
  if (Math.abs(planned - duration) > 2) {
    fails.push(
      `plan totals ${planned.toFixed(1)}s but the file is ${duration.toFixed(1)}s — scenes were cut`,
    );
  }

  const sceneFrames = arg("scene-frames") ?? arg("frames");
  const clipRoot = arg("clip-root") ?? arg("frames");

  if (sceneFrames && existsSync(sceneFrames)) {
    for (const s of scenes) {
      const dir = join(sceneFrames, s.id);
      if (!existsSync(dir)) continue;
      const got = readdirSync(dir).length;
      const want = Math.round(s.dur * fps);
      if (got < want - 2) fails.push(`${s.id}: ${got} frames rendered, ${want} expected`);
    }
  }

  if (clipRoot && existsSync(clipRoot)) {
    const clips = new Set(readdirSync(clipRoot));
    for (const s of scenes) {
      const clip =
        (s.clip as string | undefined) ?? (s.footage as { clip?: string } | undefined)?.clip;
      if (clip && !clips.has(clip)) fails.push(`${s.id}: overlay points at missing clip "${clip}"`);
    }
  }

  // Narration that outstays its scene is not trimmed — it spills into the next
  // scene. Video and audio are built separately, so nothing else notices.
  for (let i = 0; i < scenes.length - 1; i += 1) {
    const s = scenes[i] as Scene;
    const next = scenes[i + 1] as Scene;
    if (!s.vo) continue;
    const vo = s.vo as { dur?: number; at?: number };
    const dur =
      typeof s.vo === "object"
        ? Number(vo.dur ?? wordSeconds(String(s.vo)))
        : wordSeconds(String(s.vo));
    const at = typeof s.vo === "object" ? Number(vo.at ?? 0.9) : 0.9;
    const spill = s.start + at + dur - next.start;
    if (spill > 0.2) fails.push(`${s.id}: narration runs ${spill.toFixed(1)}s into "${next.id}"`);
  }

  const per = Number(arg("sheet", "0"));
  if (per > 0) sheet(scenes, per);
}

// Sheets without a plan: sample on a fixed step so the eyeball check is still
// available for a file you did not build with this toolkit.
const perAlone = Number(arg("sheet", "0"));
if (perAlone > 0 && !(planPath && existsSync(planPath))) {
  const step = Number(arg("step", "10"));
  const slots: Scene[] = [];
  for (let t = 0; t < duration; t += step) {
    slots.push({ id: `t${t.toFixed(0)}`, start: t, dur: Math.min(step, duration - t) });
  }
  sheet(slots, perAlone);
}

console.log("checks:");
for (const n of notes) console.log(`  · ${n}`);
if (!fails.length) {
  console.log("\nPASS");
  process.exit(0);
}
console.error(`\n${fails.length} FAILURE(S):`);
for (const f of fails) console.error(`  ✗ ${f}`);
process.exit(1);

/**
 * One contact sheet per `per` scenes, sampled late in each scene so reveals have
 * finished. This is the only check for "technically valid, actually illegible",
 * which no numeric filter will ever catch — a human has to look.
 */
function sheet(scenes: Scene[], per: number) {
  const tmp = join(tmpdir(), `sheet-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  const taken: string[] = [];
  for (const [i, s] of scenes.entries()) {
    const at = (s.start + s.dur * 0.8).toFixed(2);
    const file = join(tmp, `${String(i).padStart(4, "0")}.png`);
    try {
      ffq(["-ss", at, "-i", video as string, "-frames:v", "1", "-vf", "scale=460:-1", file]);
      taken.push(file);
    } catch {
      /* frame not present; skip */
    }
  }
  const sheets: string[] = [];
  for (let i = 0; i < taken.length; i += per) {
    const chunk = taken.slice(i, i + per);
    if (chunk.length < 2) continue;
    const list = join(tmp, `chunk-${Math.floor(i / per)}.txt`);
    writeFileSync(list, `${chunk.map((f) => `file '${f}'`).join("\n")}\n`);
    const cols = chunk.length > 6 ? 3 : 2;
    const rows = Math.ceil(chunk.length / cols);
    const out = join(tmp, `sheet-${String(Math.floor(i / per) + 1).padStart(2, "0")}.png`);
    try {
      ffq([
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list,
        "-vf",
        `tile=${cols}x${rows}`,
        "-frames:v",
        "1",
        out,
      ]);
      sheets.push(out);
    } catch {
      /* tiling failed; the individual PNGs are still there to look at */
    }
  }
  console.log(`\ncontact sheets in ${tmp}`);
  for (const s of sheets) console.log(`  ${s}`);
  console.log("Look at them. A frame can pass every numeric check and still be unreadable.");
}
