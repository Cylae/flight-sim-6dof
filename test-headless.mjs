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
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Fichier introuvable');
    } else {
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, async () => {
  console.log(`\x1b[36m[SRV]\x1b[0m Serveur actif sur http://localhost:${PORT}`);

  const errors = [];
  const warnings = [];

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--no-sandbox',
      '--disable-web-security'
    ]
  });

  const page = await browser.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      errors.push(text);
      console.log(`\x1b[31m[CONSOLE ERROR]\x1b[0m ${text}`);
    } else if (msg.type() === 'warn') {
      warnings.push(text);
    }
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
    console.log(`\x1b[31m[PAGE EXCEPTION]\x1b[0m ${err.message}`);
  });

  try {
    console.log('\x1b[34m[RUN]\x1b[0m Chargement WebGL...');
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });

    await page.waitForFunction(() => window.__simReady === true, { timeout: 8000 });
    console.log('\x1b[32m[OK]\x1b[0m Three.js initialisé.');

    let state = await page.evaluate(() => window.__simState);
    if (!state || isNaN(state.altitude_m) || isNaN(state.airspeed_ms)) {
      throw new Error("L'état de télémétrie initial est invalide (NaN).");
    }

    // Accélération plein gaz
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(3500);
    await page.keyboard.up('ShiftLeft');

    // Décollage (stick cabré)
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(3000);
    await page.keyboard.up('KeyS');

    state = await page.evaluate(() => window.__simState);
    console.log(`[VOL] Alt = ${state.altitude_ft.toFixed(0)} ft | Vitesse = ${state.airspeed_kts.toFixed(1)} kts`);

    if (state.altitude_ft <= 10.0) {
      throw new Error("L'appareil n'a pas décollé.");
    }

    if (errors.length > 0) {
      console.log('\x1b[31m[ÉCHEC]\x1b[0m Erreurs console interceptées.');
      process.exit(1);
    } else {
      console.log('\x1b[32m[SUCCÈS]\x1b[0m Modèle 6-DOF validé sans erreur.');
    }
  } catch (err) {
    console.error(`\x1b[31m[CRASH]\x1b[0m ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
  }
});
