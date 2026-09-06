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
    if (err) { res.writeHead(404); res.end('Fichier introuvable'); }
    else { res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' }); res.end(content, 'utf-8'); }
  });
});

server.listen(PORT, async () => {
  console.log(`[SRV] Serveur actif sur http://localhost:${PORT}`);
  const errors = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--disable-web-security']
  });

  const page = await browser.newPage();
  page.on('console', msg => { if (msg.type() === 'error') { errors.push(msg.text()); console.log(`[CONSOLE ERROR] ${msg.text()}`); } });
  page.on('pageerror', err => { errors.push(err.message); console.log(`[PAGE EXCEPTION] ${err.message}`); });

  try {
    console.log('[RUN] Initialisation WebGL Three.js...');
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__simReady === true, { timeout: 15000 });
    console.log('[OK] Moteur de rendu opérationnel.');

    console.log('[RUN] Accélération : Poussée 100 %...');
    await page.keyboard.down('ShiftLeft');
    await page.waitForFunction(() => window.__simState && window.__simState.airspeed_kts >= 55, { timeout: 35000 });

    let state = await page.evaluate(() => window.__simState);
    console.log(`[ROULAGE] Vitesse de rotation atteinte : ${state.airspeed_kts.toFixed(1)} kts`);

    console.log('[RUN] Rotation : Manche arrière (S)...');
    await page.keyboard.down('KeyS');
    await page.waitForFunction(() => window.__simState && window.__simState.altitude_ft >= 20, { timeout: 25000 });
    await page.keyboard.up('KeyS');
    await page.keyboard.up('ShiftLeft');

    state = await page.evaluate(() => window.__simState);
    console.log(`[ENVOL CONFIRMÉ] Altitude: ${state.altitude_ft.toFixed(0)} ft AGL | Vitesse: ${state.airspeed_kts.toFixed(1)} kts | Incidence: ${state.alpha_deg.toFixed(1)}°`);

    if (errors.length > 0) throw new Error(`Erreurs console : ${errors.join(' ; ')}`);
    console.log('[SUCCÈS] Décollage et vol validés avec succès.');
  } catch (err) {
    console.error(`[CRASH] ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
  }
});
