# Pipeline

The shape a video build takes, and why. Nothing here is mandatory; it is the
arrangement that survived contact with real builds, plus the failures that shaped it.

## Directory shape

```
project/
├── scenes.a.mjs scenes.b.mjs   scene data: one entry per screen
├── src/
│   ├── deck.mjs                scene data → one HTML document per scene
│   ├── render.mjs              document → PNG/JPG per frame, scrubbed
│   ├── capture.mjs             recorded footage of the real app
│   ├── audio.mjs               narration + bed → build/track.wav
│   └── compose.mjs             frames + footage + sound → mp4
├── frames/deck/<id>/           rendered frames, one dir per scene
├── frames/<clip>/              captured footage, one dir per clip
├── audio/<id>.wav              narration, one file per narrated scene
└── build/                      track.wav, segments/, the mp4
```

Scene *data* and scene *rendering* stay separate so timing can be checked before a
single frame is rendered. That separation is the whole point: a scene list change
costs a second, a rendered-frames change costs half an hour.

## Scene data contract

The scripts read these fields; everything else is for the renderer.

| Field | Meaning |
| --- | --- |
| `id` | stable key: frame dir, audio file name, segment name |
| `kind` | which layout the renderer uses |
| `dur` | optional override; otherwise derived |
| `vo` | narration text, or `{text, dur, at}` once synthesised |
| `clip` / `footage.clip` | footage to overlay: a directory of frames under `--clip-root` (default `frames`) |
| `clipMode` | `play` (its own duration) or `hold` (a still) |

Give every scene an `id` that is stable across edits. Renaming one silently orphans
its frames, its audio and its segment, and the checks cannot tell you which.

## Determinism

The single rule worth retrofitting early. Author animations, then scrub them:

```js
// every animation in the document starts paused
await page.setContent(buildDocument(scene));
const animations = await page.evaluate(() =>
  document.getAnimations().map((a) => ({ id: a.animationName, t: 0 })));
for (let f = 0; f < frames; f++) {
  const t = (f / fps) * 1000;
  await page.evaluate((ms) => {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; }
  }, t);
  await page.screenshot({ path: `${dir}/${pad(f)}.png` });
}
```

Why not just let it play and record in real time:

- Re-rendering gives byte-identical frames, so a slow machine or a re-run is not a
  gamble on wall-clock time.
- Changing the look of a scene does not change its length.
- Slow motion, speed-up and re-timing become free — you are choosing *which instant*
  to draw, not *when to draw it*.

Cost: `document.getAnimations()` only sees CSS/WAAPI animations. Things driven by
`requestAnimationFrame` timers or CSS transitions with a shared clock need to be
rewritten against the same scrub. Check it on one scene before building sixty.

## Timing model

```
scene length = clamp(6s, 24s, max(readTime, spokenTime, footageTime + tail))
readTime     = visibleChars / 21          // dense technical text, slide sizes
spokenTime   = words * 0.42               // ~145 wpm, plus a beat between sentences
```

Measured against real TTS the word estimate runs ~10% long, which is the right
direction to be wrong in — a scene that is slightly too long still reads. Once real
audio exists, `timeline.ts` uses its measured duration instead of the estimate.

A scene whose length came from its *content* is a claim you can test. A scene whose
length came from taste is a scene you cannot defend when it gets cut.

## Footage overlays

- Match the overlay box to the clip's aspect ratio. A 1836×1188 capture in a
  1010×654 box is a 1.5% squash; in a 900×620 box it is exact. Mismatch reads as
  a bug even when nobody can say why.
- `hold` clips (a still, a diagram) do not need their full duration.
- `play` clips should keep their last frame to the end of the scene: the *result*
  of a flow is the evidence, and it should still be on screen while the captions
  talk about it. Cutting to black at the interesting moment is the common failure.
- Overlay timing comes from the *scene*, never from the clip file's own length. If
  they disagree you get a clip that ends mid-sentence with a hard cut.

## Audio

Three layers, one decision:

- **Bed** — low-passed noise plus a very low drone, around −30 dB, present wherever
  nobody is speaking. Below about −34 dB it is not "quiet", it is "the file is
  broken", especially on laptop speakers.
- **Transitions** — a short filtered-noise whoosh at scene changes marks them
  without a title card.
- **Ducking** — drop the bed ~15–18 dB under speech. Do it as an envelope over the
  bed rather than per-layer gains, and ramp it over ~80 ms or you hear the pump.

Narration sits at about 0.9 s into a scene with a 0.7 s tail. If a line does not
fit, speed it up (`atempo`, pitch-neutral) rather than truncating — nothing should
end mid-word. Log how many lines were sped up; if it is more than a couple, the
scenes are too short, not the voice too slow.

## Three defects this all exists to catch

Each one looked fine until it was measured.

1. **A PiP that scrolled into blank gutter.** The capture window was zoomed 1.45×
   to make text bigger, which made the page 1456px tall against an 880px viewport.
   The recorder faithfully captured a scrolling window onto the page: mostly blank
   background, one stray field, huge. It encoded perfectly and was unreadable.
   → `frameprobe.ts`, and "look at a mid-action frame before you record 900 of them".
2. **A quarter of the runtime inaudible.** The bed was set to a level 25 dB under
   the voice, so speech-free stretches measured −50 dB: 319s of the 1046s file.
   The module's own comment said it was preventing this. Nothing checked it.
   → `verify.ts` silence check, and the 20% ceiling.
3. **A scene that referenced a clip that did not exist.** A field was doing double
   duty as "footage to overlay" and "a code callout", so the composer was told to
   overlay a directory that was never captured. Immediate crash, but only at the
   last stage, after everything else had been rendered.
   → `timeline.ts` and `verify.ts` both resolve clip references up front.

The lesson is not "check harder". It is that video has *aggregate* properties —
loudness over time, flatness over time, whether the audio and the picture agree —
that no per-frame inspection can see, so they need measuring over the whole file.

## Encoding

- Encode per scene, then concat. A failed scene then costs one scene, not the file,
  and each filter graph stays tiny (a scene has at most one overlay).
- `libx264 -preset veryfast -crf 20` on near-static text frames compresses
  enormously (17 minutes at 1080p30 landed around 50 MB). Raise quality before you
  raise the bitrate.
- Use `fps_mode cfr` and an explicit `-r`. Variable frame rate from captured
  footage desynchronises the audio you placed by timestamp.
- Verify the *concatenated* file. Segment-level checks miss boundary errors, and
  concat is where duration drift shows up.
