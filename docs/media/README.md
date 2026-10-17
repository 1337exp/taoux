# Media

Screenshots and short clips of the library, generated from the live sandbox.
Nothing here is drawn by hand: when a component changes, run the pipeline and commit the result.

```bash
npm run media                   # everything
npm run media -- --only curveeditor   # one shot or clip by name
```

Needs Chrome or Edge installed (driven by `playwright-core`, no browser is downloaded) and `ffmpeg` on `PATH`. The sandbox is started by the script itself.
What gets captured, and how, is described in [`scripts/media.manifest.mjs`](../../scripts/media.manifest.mjs).

## Layout

| Folder | What | Used by |
| --- | --- | --- |
| `screenshots/<name>-dark.webp`, `-light.webp` | cropped shots of the sandbox pages, 2x | READMEs, website |
| `clips/<name>.mp4` | short loops, H.264, no audio | the website (`<video autoplay muted loop playsinline>`) |
| `clips/<name>.webp` | the same loops as animated WebP | READMEs (GitHub and npm do not autoplay repository video) |
| `posters/<name>.webp` | first frame of each clip | `<video poster>` on the website |
| `social-preview.png` | 1280x640 | GitHub → Settings → Social preview |
| `.raw/` | uncompressed captures, **git-ignored** | encoding only |

## Rules

- **Short.** A clip is a taste of one feature, 8 seconds at most. Long walkthroughs belong on the website.
- **Small.** Binary files live in git forever. Keep the whole folder under ~10 MB; if a clip grows, shorten it instead of raising quality.
- **Stable names.** READMEs and the website link to these files. Rename a target in the manifest only together with its links.
- **Both themes** for screenshots, dark for clips.
- **One language per set.** The set is captured in the language set by `LANG` in the manifest (English).

## On the website

```html
<video src="https://raw.githubusercontent.com/1337exp/taoux/main/docs/media/clips/curveeditor.mp4"
       poster="https://raw.githubusercontent.com/1337exp/taoux/main/docs/media/posters/curveeditor.webp"
       autoplay muted loop playsinline></video>
```

For the sandbox page, copy `docs/media/` next to the built sandbox (`npm run sandbox:build`) and use relative paths instead.
