/**
 * Head-Up Display (HUD) Canvas Renderer
 */

export class HUD {
  constructor(canvas, aircraftNode, physicsEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.aircraftNode = aircraftNode;
    this.physics = physicsEngine;
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  draw() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    const s = window.__simState;
    if (!s) return;

    const euler = new THREE.Euler().setFromQuaternion(this.aircraftNode.quaternion, 'YXZ');
    const pitch = euler.x;
    const roll = euler.z;
    const heading = ((-euler.y * 180 / Math.PI) % 360 + 360) % 360;
    const cx = w / 2;
    const cy = h / 2;

    this.ctx.save();
    this.ctx.strokeStyle = '#00ff88';
    this.ctx.fillStyle = '#00ff88';
    this.ctx.lineWidth = 1.5;
    this.ctx.font = '12px Courier New';

    // Boresight reticle
    this.ctx.beginPath();
    this.ctx.moveTo(cx - 16, cy); this.ctx.lineTo(cx - 6, cy);
    this.ctx.moveTo(cx + 6, cy);  this.ctx.lineTo(cx + 16, cy);
    this.ctx.moveTo(cx, cy - 6);  this.ctx.lineTo(cx, cy + 6);
    this.ctx.stroke();

    // Flight Path Vector (FPV)
    if (s.airspeed_ms > 5.0) {
      const localV = this.physics.vel.clone().applyQuaternion(this.aircraftNode.quaternion.clone().invert());
      const fpvX = cx + (localV.x / Math.max(localV.length(), 1.0)) * 600;
      const fpvY = cy - (localV.y / Math.max(localV.length(), 1.0)) * 600;
      this.ctx.beginPath();
      this.ctx.arc(fpvX, fpvY, 6, 0, Math.PI * 2);
      this.ctx.moveTo(fpvX - 12, fpvY); this.ctx.lineTo(fpvX - 6, fpvY);
      this.ctx.moveTo(fpvX + 6, fpvY);  this.ctx.lineTo(fpvX + 12, fpvY);
      this.ctx.stroke();
    }

    // Pitch ladder
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(-roll);
    this.ctx.translate(0, pitch * 500);

    for (let deg = -40; deg <= 40; deg += 10) {
      if (deg === 0) {
        this.ctx.beginPath();
        this.ctx.moveTo(-90, 0);
        this.ctx.lineTo(90, 0);
        this.ctx.stroke();
        continue;
      }
      const y = -deg * (Math.PI / 180) * 500;
      this.ctx.beginPath();
      this.ctx.moveTo(-40, y); this.ctx.lineTo(-15, y);
      this.ctx.moveTo(15, y);  this.ctx.lineTo(40, y);
      this.ctx.stroke();
      this.ctx.fillText(deg.toString(), 46, y + 4);
    }
    this.ctx.restore();

    // Airspeed tape box
    this.ctx.strokeRect(cx - 250, cy - 110, 65, 220);
    this.ctx.fillText('KIAS', cx - 238, cy - 118);
    this.ctx.fillText(s.airspeed_kts.toFixed(0), cx - 232, cy + 5);

    // Altitude tape box
    this.ctx.strokeRect(cx + 185, cy - 110, 75, 220);
    this.ctx.fillText('ALT FT', cx + 196, cy - 118);
    this.ctx.fillText(s.altitude_ft.toFixed(0), cx + 200, cy + 5);

    // Heading box
    this.ctx.strokeRect(cx - 75, 25, 150, 26);
    this.ctx.fillText(`HDG: ${heading.toFixed(0).padStart(3, '0')}°`, cx - 35, 42);

    // Bottom info tape
    this.ctx.fillText(`G: ${s.g_force.toFixed(1)}`, cx - 240, h - 55);
    this.ctx.fillText(`VSI: ${s.vertical_speed_fpm.toFixed(0)} ft/m`, cx - 240, h - 35);
    this.ctx.fillText(`THR: ${s.thrust_pct}%`, cx - 50, h - 35);
    this.ctx.fillText(`AoA: ${s.alpha_deg.toFixed(1)}°`, cx + 80, h - 35);
    this.ctx.fillText(`GPS: ${s.lat.toFixed(4)}N, ${s.lon.toFixed(4)}E`, cx + 80, h - 55);

    // Stall Warning
    if (s.isStalled && Math.floor(performance.now() / 200) % 2 === 0) {
      this.ctx.fillStyle = '#ff2535';
      this.ctx.font = 'bold 24px Courier New';
      this.ctx.fillText('STALL', cx - 40, cy - 65);
    }

    this.ctx.restore();
  }
}
