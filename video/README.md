# MongoDB architecture explainer (video)

Deliverables in `out/`:
- `mongodb_architecture_full.mp4`: all 14 scenes, 2:25, 1920×1080, 30 fps
- `mongodb_part1_replica_sets.mp4`: scenes 1–7 (75 s)
- `mongodb_part2_sharding.mp4`: scenes 8–14, including the ending (70 s)
- `previews/scene05_preview.png`, `previews/scene10_preview.png`

Rebuild: `node render.js scenes all && node render.js concat` (needs Playwright + Chromium + ffmpeg).
Scenes are defined in `src/scenes.js`. Each is a pure `draw(t)` function that returns SVG.
Single frame: `node render.js still <scene> <seconds> out.png`.
