# Integrating Golfer and Golf Club Detection Models

A static GitHub Pages showcase using the layout and interaction patterns from `../improving-golf-swing-pose-estimation`. Results contain a single-view snapshot carousel and video viewer with body and club overlays.

## Local preview

Requires Node.js and FFmpeg (including ffprobe). No npm installation is required.

```sh
node scripts/serve.mjs
```

Open http://127.0.0.1:8002. A different port can be passed as an argument. Restart an older running server after updating the server script. The server regenerates the catalog on the first catalog request and after source data or content changes, and supports byte ranges for video seeking.

## Content and data

- `materials/content.json`: all page text, viewer labels, and banner settings. `page.banner.video` selects a unique clip ID or a view-specific key, e.g. `face-on-0026-2`.
- `materials/data/vidoes/<view>/<id>.MP4`: original videos. The existing `vidoes` spelling is preserved.
- `materials/data/predictions/<view>/<id>.json`: predictions with `joints` and frame-indexed `pred` arrays. Only clips with matching predictions appear.
- `materials/data/predictions/snapshot.json`: selected frames, highlighted joints, and message boxes.
- `materials/data/credits.json`: source links shared by snapshots and video.
- `materials/data/catalog.json`, `materials/data/.generated/`, and `dist/`: disposable generated files ignored by Git. Original data is never changed by preparation or deployment.

Prediction files explicitly name all 21 points, including `golf_club_shaft`. The club order is **grip → shaft → heel → head**. `prediction-data.js` validates that each frame matches the declared joint count, without inserting names or shifting coordinates.

The displayed frame range is the shared video/prediction range. Frame timestamps are probed from the original video; source-frame indices remain unchanged. Frame controls display one-based numbers; snapshot configuration uses zero-based indices.

### Snapshot selection

The compact form currently in your data is supported:

```json
{
  "0027": {
    "130": { "golf_club_heel": "Hard example" }
  }
}
```

For a title, multiple joints, and shared message, use:

```json
{
  "down-the-line-0027": {
    "130": {
      "title": "Club detection under motion blur",
      "joints": ["golf_club_heel", "golf_club_head"],
      "message_box": "Hard example"
    }
  }
}
```

A `joints` object mapping each joint to its own message is also supported. Repeated messages become one box pointing to all related joints. Use view-specific keys if IDs occur in multiple views. Invalid or removed samples are skipped.

Snapshots use the template spotlight shading, selected-joint rings, automatic framing that centers the human and fits the full body-and-club skeleton with padding, carousel transitions, and bounded zoom/pan. Snapshot cards are capped at 560px wide. Interaction uses the template’s unchanged `linked-view.js`: pointer-anchored zoom from 1× to 6×, bounded panning on both axes while zoomed, and centered framing at 1×. Automatic human-and-club fitting supplies the initial view. `SNAPSHOT_ZOOM_MULTIPLIER` in `snapshot-framing.js` scales the calculated fit (currently `0.8`, or 20% less zoom); the template’s 1× minimum still applies. Message placement includes body and club geometry when scoring clear positions, prefers upper space, avoids other boxes, and falls back to notes below the image on narrow views. Arrows retain their actual joint endpoints and clip at the viewport. Only your configured snapshot is shown; add entries to populate the carousel.

### Loading order

The lightweight banner and first-frame skeleton get initial priority. Once the hero scrolls offscreen, snapshots and low-priority selected-video metadata load concurrently. Full buffering is promoted after snapshot preparation settles. Only the selected video and predictions are loaded, with thumbnails lazy-loaded. The banner pauses offscreen and respects reduced motion.

## Tests and deployment

```sh
node --test tests/*.test.mjs
node scripts/build-site.mjs
node scripts/serve.mjs --dist 8003
```

The build generates previews and a fresh catalog from committed source data, packages only referenced files, and creates smaller H.264 delivery videos when frame count, resolution, and every frame timestamp are preserved. Otherwise it uses a lossless fast-start copy. Source videos and predictions are unchanged. `scripts/media-options.json` controls image quality and video compression. Validated delivery encodings are cached locally.

The included `.github/workflows/pages.yml` tests, builds, and deploys `dist/` on pushes to `master` or `main`. In **Settings → Pages**, change **Source to GitHub Actions** for this data-driven build. Commit the original videos, predictions, snapshot configuration, and credits; ignored generated files are rebuilt by the workflow. Branch-root publication by itself does not generate the required catalog and previews.

## Mobile verification

Browser checks cover 320×568, 390×844, 430×932, 768×1024, 844×390 landscape, and 1024×768. Navigation, banner priority, six snapshots, camera filtering, playback, frame stepping, and zoom controls were checked without horizontal page overflow. Shared typography, breakpoints, carousel behavior, and zoom/pan implementation were compared with the reference project. These checks use desktop browser viewport emulation; physical iOS/Android touch gestures, mobile autoplay policies, and Safari decoding still require device verification.

The banner poster and skeleton fade in independently when ready. As soon as the first video frame is decoded and its pose data is available, the video is revealed and the poster is removed in one paint, then playback starts. There is no video fade-in, poster fade-out, or delay waiting for the poster fade to finish. The poster returns if playback fails. Reduced-motion users see the static preview without fades.

Banner skeleton synchronization uses presented-video-frame timestamps (`requestVideoFrameCallback`) during playback and across pauses/looping. The visible placeholder always uses frame-zero joints. The skeleton is updated in the same operation that reveals the decoded video, and pending final-frame callbacks are allowed to settle when playback pauses. Older browsers use animation-frame/current-time fallback.
