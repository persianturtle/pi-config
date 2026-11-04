---
name: explainer-video
description: Build narrated explainer and walkthrough videos (code demos, architecture explainers, product walkthroughs) as scriptable, deterministic builds — brief, scene script, rendered frames, narration, then an encoded mp4. Use when asked to make or create a video, screencast, demo video, tutorial or walkthrough, or to turn a project into something watchable. Starts with audience questions before anything is built.
---

# Explainer Video

A video is a build, not a recording. Scenes are data, frames are rendered
deterministically, narration drives timing, and the whole thing is checked before
it is called done. That is what makes it cheap to redo — which matters, because the
first cut of any section is usually wrong.

```bash
V=~/.pi/agent/skills/explainer-video
```

The four scripts need nothing installed — they are plain `node` and `ffmpeg`. The
`devDependencies` (biome, typescript) are only for `npm run tsc` / `npm run
biome`, and `node_modules` is not shipped; run `npm install` here first if you
want those checks. `frameprobe.ts` reuses browser-tools' playwright when it is
installed, and says so plainly when it is not.

## Step 0 — ask before building (do not skip this)

The most expensive mistake is building the wrong video for the audience. A
walkthrough for third-party developers, one for end users, and one for an internal
review need different content at different lengths, from the same material.

```bash
node $V/scripts/brief.ts                      # prints the questions + why each matters
node $V/scripts/brief.ts --set audience=... --set runtime=... --write build/brief.json
```

Ask the human. Quote the defaults back as assumptions. Two answers are **blocking**
and need confirmation *before* any capture:

- **Credentials / live accounts** — if recording creates real side effects
  (charges, orders, deletions), confirm the account and the caps first.
- **Sensitive data on screen** — anything readable in a frame is published: keys,
  tokens, real account names, customer addresses. Fake or rotate before recording.

Skip the brief only when the request already states audience, length and what the
viewer must be able to do afterwards.

## The build

Four stages, each with its own output and its own chance to fail cheaply:

| Stage | Output | Checked by |
| --- | --- | --- |
| brief | `build/brief.json` | the questions above |
| script | scene list (data, one entry per screen) | `timeline.ts` |
| render | PNG/JPG per frame | `verify.ts --sheet` |
| sound | narration + bed → `track.wav` | `verify.ts` |
| compose | `walkthrough.mp4` | `verify.ts` |

```bash
node $V/scripts/timeline.ts --scenes scenes.mjs --vo vo.json --target 17
node $V/scripts/verify.ts build/walkthrough.mp4 --plan plan.json --sheet 12
```

`timeline.ts` turns a scene list into timings and refuses to proceed when a scene
cannot hold what it has to say. Read `references/pipeline.md` before writing the
renderer — the determinism rule below is the one thing that is hard to retrofit.

## Rules that pay for themselves

**Deterministic frames.** Author each scene as a document whose animations are
*paused*, then set `Animation.currentTime` per frame. Never animate against
wall-clock time. Wall-clock capture gives you a different video on every run, and
"render faster" becomes a timing gamble instead of a viewport setting.

**A scene is as long as its longest obligation** — reading time, spoken time, or
footage time. Not the average. Never shorter than the footage it shows: cutting a
donation run or a build mid-action to hit a beat is how these videos lose the plot.

**Footage must fit in one frame.** Probe the framing before recording:

```bash
node $V/scripts/frameprobe.ts --url http://localhost:3000 \
    --ready '[data-testid="pay"]' --clip 1680x1000 --zoom 1.45,1.2,1
```

Pass `--ready` with a selector that only exists once the app is *interactive*, and
make it a real one for your app — a loading skeleton is short, so it "fits" at any
zoom and tells you nothing. Without `--ready` the probe measures whatever happens
to be on screen and says so; with it, an app that never reached that state exits
non-zero instead of reporting a comfortable answer.

Zooming a page up to make text bigger makes it taller than the capture window, so
you record a *scrolling window onto it* — most mid-action frames are blank gutter
with one stray field. Shrink the source instead of zooming it. A PiP that is too
tall for its window still encodes perfectly.

**Silence needs a bed.** Voice-only-on-the-important-parts is a good choice, but a
long stretch under about −34 dB reads as a broken file, not as deliberate quiet.
Put low room tone under the gaps and duck it ~15–18 dB under speech. `verify.ts`
fails the build past 20% near-silence.

**Verify the file, not the intent.** Numeric checks catch the failures you cannot
see by scrolling your own output; the contact sheet catches the ones no number
catches. Run both:

```bash
node $V/scripts/verify.ts build/walkthrough.mp4 --plan plan.json --sheet 12
# then actually open the sheets it prints
```

## Time budget (measured, 1080p30, Apple Silicon)

| Task | Time |
| --- | --- |
| probe framing | ~1 min |
| record 2 real app runs (~900 frames) | ~4 min |
| render 32k frames (19 fps) | ~28 min |
| encode 31k frames to H.264 + mux | ~1 min |
| synth 22 narration lines | ~2 min |

So a 17-minute video costs roughly 45 minutes of compute and about the same again
in re-does. Spend the re-does on the scene list, where a change costs a second, not
on rendered frames, where it costs half an hour.

## Anti-patterns

- Narrating everything. Voice is for the two or three things nobody may miss.
- 40px code on a 1080 frame because *you* can read it on a 27" display.
- Timing scenes by feel. Timing them by read/VO/footage length is checkable.
- Trusting a clip's framing until you have looked at a frame in the middle of it.
- Shipping commands or file paths on screen without checking them against the repo.
- Treating "it encoded" as "it works" — 30% of one finished build was inaudible.

## Contents

- `references/pipeline.md` — the renderer, timing model, audio mix, and the three
  real defects this skill's checks exist to catch
- `scripts/brief.ts` — questions and derived production parameters
- `scripts/timeline.ts` — scene list → timings, with pre-render complaints
- `scripts/verify.ts` — the gate: loudness, silence, flat/frozen frames, plan drift,
  narration overlap, contact sheets
- `scripts/frameprobe.ts` — does the thing fit in one frame (needs playwright)
- `templates/scenes.sample.mjs` — a scene list in the shape the scripts read
