import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8089;
const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404); res.end('404'); }
    else { res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' }); res.end(content, 'utf-8'); }
  });
});

server.listen(PORT, async () => {
  console.log(`[SRV] Port ${PORT}`);
  const errors = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--disable-web-security']
  });

  const page = await browser.newPage();
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  try {
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__simReady === true, { timeout: 15000 });

    await page.keyboard.down('ShiftLeft');
    await page.waitForFunction(() => window.__simState && window.__simState.airspeed_kts >= 55, { timeout: 35000 });

    await page.keyboard.down('KeyS');
    await page.waitForFunction(() => window.__simState && window.__simState.altitude_ft >= 15, { timeout: 25000 });
    await page.keyboard.up('KeyS');
    await page.keyboard.up('ShiftLeft');

    const s = await page.evaluate(() => window.__simState);
    console.log(`[PASS] ${s.name} : Alt = ${s.altitude_ft.toFixed(0)} ft, Vitesse = ${s.airspeed_kts.toFixed(1)} kts`);

    if (errors.length > 0) throw new Error(errors.join(', '));
  } catch (err) {
    console.error(`[FAIL] ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
  }
});
