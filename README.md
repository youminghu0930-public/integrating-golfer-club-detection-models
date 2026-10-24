# Integrating Golfer and Golf Club Detection Models

A static technical case study centered on revising the data and training pipeline for incomplete annotations. The six sections are Abstract, Introduction, Methods, Results, Discussion, and Conclusion. All page copy and viewer labels live in `materials/content.json`; section titles also drive the navigation. The reported primary outcome is approximately 50% improved club recall on heavily blurred cases.

## Local preview

Requires Node.js and FFmpeg (including ffprobe). No npm installation is needed.

```sh
node scripts/serve.mjs
```

Open http://127.0.0.1:8002. Pass another port if needed. Stop with Control+C. Restart an old server process after updating the scripts.

On startup, preparation creates missing or stale snapshot images and metadata. On each page reload, the next catalog request rechecks source files and regenerates missing/stale images. Unchanged images and video metadata are reused. Changes to snapshot configuration, predictions, videos, or content also invalidate the local catalog. JPEG and PNG MIME types and MP4 byte ranges are supported.

## Editable data

- `materials/content.json`: narrative, metrics, banner selection, and shared `demo` labels. Set `page.banner.video` to a unique clip key, e.g. `face-on-0018`.
- `materials/data/snapshot.json`: canonical snapshot selections, highlights, and messages.
- `materials/data/snapshots/<view>/<video>/<frame>.jpg`: extracted, full-resolution snapshot images. Existing `.jpeg`, `.png`, and `.webp` alternatives are supported. Missing images default to `.jpg`. Keep images you want to retain; the build never deletes this folder.
- `materials/data/predictions/<view>/<video>.json`: original frame-indexed keypoint predictions.
- `materials/data/vidoes/<view>/<video>.MP4`: original videos; the existing `vidoes` spelling is retained.
- `materials/data/credits.json`: source links.

Snapshot indices are **zero-based**; displayed frame numbers are one-based. For example:

```json
{
  "0022-1": {
    "24": {
      "golf_club_head": "The driver head and vertical shaft blend into the trees."
    }
  }
}
```

This uses `snapshots/face-on/0022-1/24.jpg`. A view-specific key such as `face-on-0022-1` resolves ambiguous video IDs. An annotated form with `title`, `joints`, and `message_box` is also supported. Frames must exist in both the video and predictions; invalid selections are skipped with a warning.

The 21-point prediction format explicitly includes `golf_club_shaft`. Names are authoritative; coordinates are not shifted or supplemented. The club is connected as grip → shaft → heel → head.

## Static snapshots and loading order

Snapshot preparation happens locally or during the deployment build. The browser loads a small `materials/data/snapshot-catalog.json` containing selected-frame joints, messages, and image paths; it never creates a video decoder, seeks a video, or fetches full prediction sequences for snapshots. Image URLs carry content hashes so updated images do not reuse stale browser caches.

The banner and the Abstract’s first snapshot start on landing. Remaining snapshots wait until the hero leaves the viewport. The Results player then warms its selected-video metadata concurrently and promotes full buffering after snapshot readiness. Only the selected video is loaded. Direct section links are restored after snapshot layout settles, provided the reader has not interacted.

Snapshots retain spotlight shading, selected-joint rings, message-box placement, carousel navigation, and the template’s zoom/pan interaction. Cards are capped at 560px. `SNAPSHOT_ZOOM_MULTIPLIER` in `snapshot-framing.js` scales the initial human-and-club fit (currently `0.8`), respecting a 1× minimum. The template interaction uses pointer-centered zoom from 1× to 6× and bounded panning.

The banner uses regular centered cover alignment. Its first-frame placeholder and skeleton fade in independently; decoded video replaces the placeholder in one paint without a crossfade. Skeletons track presented-frame timestamps during playback and use frame-zero joints whenever the placeholder is shown.

## Generated files and deployment

`catalog.json`, `snapshot-catalog.json`, `materials/data/.generated/`, and `dist/` are ignored generated output. Original videos and predictions are unchanged. The snapshot images folder is not ignored; it can be committed, and missing images are rebuilt from committed videos.

```sh
node --test tests/*.test.mjs
node scripts/build-site.mjs
node scripts/serve.mjs --dist 8003
```

The build includes only referenced images, prediction files, catalog data, and delivery videos. H.264 compression is used only when it preserves resolution, frame count, and every frame timestamp and produces a smaller file; otherwise delivery uses a lossless fast-start copy. Cached encodings are reused.

The included workflow tests, builds, and deploys `dist/` after pushes to `master` or `main`. Set **Settings → Pages → Source: GitHub Actions**. Branch-root publication does not generate the catalogs or images. Commit the source data required for deployment; local ignored caches are not uploaded.
