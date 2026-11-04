/**
 * Pre-build brief. Prints the questions that change what gets built, then turns
 * the answers into production parameters (frame rate, voice policy, silence
 * policy, gates, time budget).
 *
 *   node scripts/brief.ts                       # print the questions
 *   node scripts/brief.ts --set audience=... --set runtime=17 ...
 *   node scripts/brief.ts --from brief.answers.json --write build/brief.json
 *
 * Answering is optional. Unanswered questions fall back to DEFAULTS and are
 * reported as `assumed:` so a wrong guess is visible instead of silent.
 */
import { readFileSync, writeFileSync } from "node:fs";

type Question = {
  key: string;
  ask: string;
  why: string;
  options?: string;
};

const GROUPS: { title: string; questions: Question[] }[] = [
  {
    title: "Audience and purpose",
    questions: [
      {
        key: "audience",
        ask: "Who watches this, and what do they already know?",
        why: "Third-party developers, end users, an internal team and an exec review need four different videos from the same material. This answer decides vocabulary, depth and what counts as evidence.",
        options: "developer | end-user | internal | exec | mixed",
      },
      {
        key: "can_do_after",
        ask: "After watching, what must the viewer be able to DO?",
        why: "'Run the demo themselves' needs readable terminal/code frames and a file map. 'Make an architecture decision' needs diagrams and trade-offs. 'Just know it exists' needs 90 seconds.",
      },
      {
        key: "cannot_miss",
        ask: "Name the two or three things nobody may miss.",
        why: "This is the whole voice budget. Everything else is silent reading time.",
      },
      {
        key: "prior_work",
        ask: "What will the viewer have tried before pressing play?",
        why: "A video for people who have read the code can skip motivation; a video for people who have not must spend 2-3 minutes on why before how.",
      },
    ],
  },
  {
    title: "Shape and length",
    questions: [
      {
        key: "runtime",
        ask: "Target runtime in minutes?",
        why: "Length is not a style choice, it is a budget: it sets how many scenes exist and therefore how much each one can say.",
        options: "1-2 pitch | 3-5 feature overview | 12-18 deep technical walkthrough",
      },
      {
        key: "narration",
        ask: "Narrated throughout, or voice only on the critical points?",
        why: "Narrated-throughout costs a full voice pass and forces a bed under everything. Points-only is cheaper and reads as more serious, but needs a sound bed in the gaps or it feels broken (see quality.md).",
        options: "critical-only | continuous | silent-with-captions",
      },
      {
        key: "resolution",
        ask: "Resolution and frame rate?",
        why: "1920x1080@30 is the default and is enough for text. 60fps only matters for captured pointer motion; it doubles render time for no gain on slides.",
      },
      {
        key: "viewing_context",
        ask: "Where is it actually watched - phone, muted, big screen, bandwidth-capped?",
        why: "Phone-and-muted means larger type, burned-in captions and no 40px code on a 1080 frame. It also sets the bitrate budget.",
      },
    ],
  },
  {
    title: "Content sources",
    questions: [
      {
        key: "live_app",
        ask: "Is there a running app to record, or is everything authored?",
        why: "Recorded footage needs a viewport, seed data and a way to reach the interesting state. Authored slides do not.",
      },
      {
        key: "credentials",
        ask: "Does recording need credentials, a live account, or a third-party service?",
        why: "BLOCKING: if capturing footage creates real side effects (charges, orders, messages, deletes), confirm the account and the caps before recording anything.",
      },
      {
        key: "sensitive",
        ask: "Will any real account name, key, token, customer name or address be on screen?",
        why: "Anything readable in a frame is published. Rotate or fake it before the capture pass, not after.",
      },
      {
        key: "sources_of_truth",
        ask: "Which files/specs must the narration be checked against?",
        why: "Commands and file paths quoted on screen get copied by viewers. Verify them against the repo before the final encode.",
      },
    ],
  },
  {
    title: "Proof it is right",
    questions: [
      {
        key: "done_means",
        ask: "What would make you say this video is wrong?",
        why: "Turns 'looks fine' into checks: claims that are not visible on screen, text that overflows, stretches with no audio, footage that scrolls into blank gutter.",
      },
      {
        key: "review_points",
        ask: "Do you want to review a storyboard/scene list before frames are rendered?",
        why: "Rendering 30k frames takes ~30 min. Reviewing the scene list first is the cheapest place to change your mind.",
      },
    ],
  },
];

const DEFAULTS: Record<string, string> = {
  audience: "developer",
  runtime: "15",
  narration: "critical-only",
  resolution: "1920x1080@30",
  viewing_context: "desktop",
  live_app: "unknown",
  credentials: "unknown",
};

/** Length/voice choices that follow from the answers rather than being picked twice. */
function derive(answers: Record<string, string>) {
  const minutes = Number(answers.runtime ?? "15") || 15;
  const fps = (answers.resolution ?? "1920x1080@30").includes("@60") ? 60 : 30;
  return {
    fps,
    sceneCountApprox: Math.round(minutes * 3.6),
    voicePolicy:
      (answers.narration ?? DEFAULTS.narration) === "continuous"
        ? "every scene narrated"
        : "narration only on cannot_miss items",
    silencePolicy:
      (answers.narration ?? DEFAULTS.narration) === "critical-only"
        ? "speech-free stretches need a bed at about -34 dB, else it reads as a broken file"
        : "continuous bed under everything",
    sideEffectGate:
      (answers.credentials ?? "").toLowerCase().includes("real") ||
      (answers.credentials ?? "").toLowerCase().includes("live")
        ? "CONFIRM before recording: footage creates real, billable or undoable side effects"
        : "no known side effects",
    renderMinutesApprox: Math.round((minutes * 60 * 30) / 700),
  };
}

function printQuestions() {
  console.log("# Brief — answer before building\n");
  console.log(
    "Anything unanswered is assumed, and the assumption is printed. Quote answers back to\n" +
      "the requester; a wrong audience guess is the most expensive mistake in this workflow.\n",
  );
  for (const group of GROUPS) {
    console.log(`## ${group.title}`);
    for (const q of group.questions) {
      console.log(`- ${q.ask}`);
      if (q.options) console.log(`    options: ${q.options}`);
      console.log(`    why: ${q.why}`);
    }
    console.log("");
  }
  console.log("## Defaults if nothing is answered");
  for (const [k, v] of Object.entries(DEFAULTS)) console.log(`- ${k}: ${v}`);
}

const args = process.argv.slice(2);
const answers: Record<string, string> = { ...DEFAULTS };
const assumed = new Set(Object.keys(DEFAULTS));
let outFile: string | null = null;

const known = new Set(GROUPS.flatMap((g) => g.questions.map((q) => q.key)));

const pairs: string[] = [];
for (let i = 0; i < args.length; i += 1) {
  const a = args[i] as string;
  if (a === "--write") {
    outFile = args[i + 1] ?? null;
    i += 1;
    continue;
  }
  if (a === "--from") {
    const loaded = JSON.parse(readFileSync(args[i + 1] as string, "utf8"));
    for (const [k, v] of Object.entries(loaded)) {
      answers[k] = String(v);
      assumed.delete(k);
    }
    i += 1;
    continue;
  }
  // accept `--set k=v`, `--set=k=v`, and a bare `k=v`
  if (a === "--set" && args[i + 1]) {
    pairs.push(args[i + 1] as string);
    i += 1;
    continue;
  }
  if (a.startsWith("--set=")) pairs.push(a.slice(6));
  else if (/^[a-z][a-z_]*=/.test(a)) pairs.push(a);
}

const bad = pairs.filter((p) => !p.includes("="));
if (bad.length) {
  console.error(`unreadable answer(s): ${bad.join(", ")} — write them as key=value`);
  process.exit(2);
}
for (const p of pairs) {
  const eq = p.indexOf("=");
  const key = p.slice(0, eq);
  if (!known.has(key)) {
    // a typo'd key would otherwise be reported as an answered question
    console.error(`unknown key "${key}". known: ${[...known].join(", ")}`);
    process.exit(2);
  }
  answers[key] = p.slice(eq + 1);
  assumed.delete(key);
}

const answered = pairs.length > 0 || args.includes("--from");
if (!answered) {
  printQuestions();
  process.exit(0);
}

const brief = { answers, assumed: [...assumed], derived: derive(answers) };
console.log("# Brief\n");
for (const [k, v] of Object.entries(answers)) {
  console.log(`- ${k}: ${v}${assumed.has(k) ? "   (assumed — confirm)" : ""}`);
}
console.log("\n# Derived");
for (const [k, v] of Object.entries(brief.derived)) console.log(`- ${k}: ${v}`);
if (brief.derived.sideEffectGate.startsWith("CONFIRM")) {
  console.log("\n!! Blocking: confirm the account/caps with the requester before capturing.");
}
if (outFile) {
  writeFileSync(outFile, `${JSON.stringify(brief, null, 2)}\n`);
  console.log(`\nwrote ${outFile}`);
}
