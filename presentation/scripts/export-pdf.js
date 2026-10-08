// Build → preview → open in Chromium → print to dist/ExpenSense-Presentation.pdf
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4173;
const URL = `http://localhost:${PORT}/`;
const OUT = join(root, 'dist', 'ExpenSense-Presentation.pdf');

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: root, shell: true, stdio: 'inherit' });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))));
  });

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Preview server did not start at ${url}`);
}

async function main() {
  console.log('Building…');
  await run('npm', ['run', 'build']);

  console.log('Starting preview server…');
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, shell: true, stdio: 'ignore' });

  let browser;
  try {
    await waitForServer(URL);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);

    await page.pdf({
      path: OUT,
      width: '1920px',
      height: '1080px',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    console.log(`PDF saved: ${OUT}`);
  } finally {
    await browser?.close();
    // Kill the preview server (and its child process tree on Windows).
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    else server.kill();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
