// Usage:
//   node render.js scenes 5            -> out/scenes/scene05.mp4
//   node render.js scenes all          -> every scene
//   node render.js still 5 10.8 out.png
//   node render.js concat              -> part1.mp4, part2.mp4, full.mp4
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FPS = 30;
const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');
const SC_DIR = path.join(OUT, 'scenes');
fs.mkdirSync(SC_DIR, { recursive: true });
const PAGE = 'file://' + path.join(ROOT, 'src', 'index.html');

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(PAGE);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function renderScene(page, id) {
  const dur = await page.evaluate(i => sceneById(i).dur, id);
  const n = Math.round(dur * FPS);
  const file = path.join(SC_DIR, `scene${String(id).padStart(2, '0')}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < n; f++) {
    await page.evaluate(([i, t]) => render(i, t), [id, f / FPS]);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  console.log(`scene ${id}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${file}`);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'concat') return concat();
  const browser = await chromium.launch();
  if (cmd === 'still') {
    const page = await newPage(browser);
    await page.evaluate(([i, t]) => render(i, t), [Number(args[0]), Number(args[1])]);
    await page.screenshot({ path: args[2], type: 'png' });
    console.log('wrote', args[2]);
  } else if (cmd === 'scenes') {
    let ids = args[0] === 'all' ? Array.from({ length: 14 }, (_, i) => i + 1) : args.map(Number);
    const workers = Math.min(3, ids.length);
    const queue = [...ids];
    await Promise.all(Array.from({ length: workers }, async () => {
      const page = await newPage(browser);
      while (queue.length) await renderScene(page, queue.shift());
    }));
  }
  await browser.close();
}

function concat() {
  const sc = i => path.join(SC_DIR, `scene${String(i).padStart(2, '0')}.mp4`);
  const make = (name, ids) => {
    const list = path.join(OUT, name + '.txt');
    fs.writeFileSync(list, ids.map(i => `file '${sc(i)}'`).join('\n') + '\n');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', path.join(OUT, name + '.mp4')]);
    fs.unlinkSync(list);
    console.log('wrote', name + '.mp4');
  };
  make('mongodb_part1_replica_sets', [1, 2, 3, 4, 5, 6, 7]);
  make('mongodb_part2_sharding', [8, 9, 10, 11, 12, 13, 14]);
  make('mongodb_architecture_full', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
}
main().catch(e => { console.error(e); process.exit(1); });
