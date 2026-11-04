/**
 * A scene list in the shape scripts/timeline.ts and scripts/verify.ts read.
 * Copy it, replace the content, keep the shape.
 *
 *   node ../scripts/timeline.ts --scenes templates/scenes.sample.mjs --target 2
 *
 * Per scene:
 *   id     stable key — frame dir, audio file, segment name. Renaming one
 *          orphans its frames and audio silently.
 *   kind   which layout the renderer uses (its own vocabulary; nothing here does)
 *   dur    optional; omit it and length comes from the content instead of taste
 *   vo     narration. Long text is fine — the scene grows to fit, and
 *          timeline.ts will tell you when it cannot.
 *   clip   footage to overlay, resolved against --clip-root
 *   clipMode "play" uses the clip's own length, "hold" treats it as a still
 *
 * Everything else is free-form and only has to mean something to your renderer.
 */
export const CHAPTERS = [
  { n: 1, title: "What it is" },
  { n: 2, title: "How it works" },
];

export const scenes = [
  {
    id: "cover",
    ch: 1,
    kind: "cover",
    title: "Renaming the widget",
    sub: "three files, one invariant, no database migration",
    dur: 12,
    vo: "This is about the one change that touches everything in the widget pipeline, and why it does not need a migration.",
  },
  {
    id: "shape",
    ch: 1,
    kind: "cols",
    title: "Where a name lives",
    kicker: "three places, and only one of them is authoritative",
    cols: [
      { title: "Registry", lines: ["declares the canonical name", "fail-fast on typos"] },
      {
        title: "Wire format",
        lines: ["keeps the old key for a year", "the only place with a compat branch"],
      },
      { title: "UI", lines: ["reads from the registry", "nothing hardcodes a name"] },
    ],
    notes: ["if a name appears in two of these, that is the bug"],
  },
  {
    id: "run-demo",
    ch: 2,
    kind: "demo",
    title: "The whole thing, in one run",
    lead: "A real registry, a real wire, real rejects. Watch the right column.",
    clip: "demo-run", // must exist under --clip-root
    clipMode: "play",
    captions: [
      "the second name is rejected by the registry, not by a validator",
      "the wire still carries the old key — that is the compat window",
    ],
    vo: "Nothing here is mocked. The second name is rejected by the registry, which is the point: there is no validator to forget to call.",
  },
  {
    id: "faq",
    ch: 2,
    kind: "faq",
    title: "Questions you will get",
    items: [
      "Why not just rename it everywhere?",
      "What breaks during the compat window?",
      "How do I add a name?",
    ],
  },
];

export default scenes;
