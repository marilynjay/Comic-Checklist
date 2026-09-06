# Comic Checklist

A small, phone-first tracker for drawing comics. Every page of every comic has
the same five steps — **pencils, word bubbles, lineart, colors, backgrounds** —
and this ticks them off, rolls the progress up to the comic and then to the
whole story, and makes a fuss when you finish something.

## How it works

- **+** adds a comic. Tell it how many pages you're planning; you can add more
  any time from the comic's ⋮ menu.
- Tap the five boxes on a page row as you finish each step.
- Tap the page number to attach an optional photo of the page, or to delete it.
- The bar at the top of the home screen is the whole story: how many comics are
  finished out of your goal, and how many steps are done overall.

### The celebrations

They escalate with the effort, so the loud ones stay special:

| What you finished | What happens |
| --- | --- |
| Pencils / word bubbles | a quiet puff of graphite dust |
| Lineart | flicked ink and a halftone ring |
| Colors / backgrounds | a burst of paint |
| A whole page | halftone POP, confetti and a comic-book shout |
| A whole comic | full-screen starburst and confetti rain |
| The final comic of the story | all of that, twice |

Turn them off in **⋮ → Celebrations**. They're also automatically muted if your
device is set to reduce motion.

## Your data

Everything is stored **in the browser on the device you're using** — there is no
account and no server:

- progress → `localStorage`
- page photos → IndexedDB, downscaled to 640px on the long edge so a long story
  stays well inside the browser's storage quota

That means clearing your browser's site data will erase it, and progress does
not sync between your phone and your laptop. Use **⋮ → Export backup** now and
then; it downloads one JSON file containing all progress *and* photos, and
**Restore from backup** reads it back on any device.

## Running it

It's plain HTML, CSS and JavaScript with no build step and no dependencies.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

(It needs to be served over `http://`, not opened as a `file://` path, because
the JavaScript uses ES modules.)

Pushing to `main` publishes it to GitHub Pages via
`.github/workflows/deploy.yml`.
