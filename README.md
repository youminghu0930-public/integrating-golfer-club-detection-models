# Integrating Golfer and Golf Club Detection Models

A local, buildless GitHub Pages project scaffold based on `../improving-golf-swing-pose-estimation`.
The template typography, colors, responsive section layout, and collapsible left navigation are preserved. The five section bodies are intentionally empty; no demo data or project claims have been copied.

## Project structure

- `index.html`: page shell.
- `styles.css`: template stylesheet, including styles for future results components.
- `scripts/serve.mjs`: dependency-free Node preview server with byte-range support.
- `main.js`: renders centralized content and handles desktop/mobile navigation.
- `materials/content.json`: all editable page text, metadata, and ordered section definitions. Navigation uses the same section titles.
- `materials/data/`: original project media and detection data. Your existing directory is preserved.
- `.nojekyll`: serves the static files directly on GitHub Pages.

The five sections retain the template IDs: `goal`, `difficulty`, `accomplishment`, `influence`, and `result`. Add copy with `paragraphs`, ordered `items`, `subsections`, or `metricGroups`. Empty text fields are reserved for later content. Set `page.mainPage.url` to the main portfolio URL to enable the return link.

Keep editable copy and original media under `materials/`, matching the reference repository. Generated catalogs and media caches belong in `materials/data/catalog.json` and `materials/data/.generated/`; deployment output belongs in `dist/`. These generated paths are ignored. Media preparation and viewer scripts can be added when the Results requirements are defined.

## Local preview

From this project directory:

```sh
node scripts/serve.mjs
```

Open http://127.0.0.1:8002. Requires Node.js; no dependency installation is needed. Use `node scripts/serve.mjs 8003` to choose another port. Press Control+C to stop. The server resolves files relative to the project, supports video byte-range requests, and does not generate or modify media.
