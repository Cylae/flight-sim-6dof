/**
 * Simulator Main Controller
 */

import { FLEET } from './fleet.js';
import { SoundEngine } from './audio.js';
import { TileManager } from './tiles.js';
import { createC172Model, createM2000Model, createA320Model, createRunway } from './models.js';
import { PhysicsEngine } from './physics.js';
import { HUD } from './hud.js';

class SimulatorApp {
  constructor() {
    this.activeKey = 'c172';
    this.currentSpec = FLEET[this.activeKey];

    this.cockpitView = false;
    this.inputs = { pitch: 0, roll: 0, yaw: 0, brakes: false };
    this.keys = {};

    this.initDOM();
    this.initThree();
    this.initAudio();
    this.initPhysics();
    this.initInputListeners();

    window.addEventListener('resize', () => this.onResize());
    this.onResize();

    this.lastTime = performance.now();
    requestAnimationFrame((now) => this.animate(now));
  }

  initDOM() {
    this.viewport = document.getElementById('viewport');
    this.hudCanvas = document.getElementById('hud-canvas');
    this.audioGate = document.getElementById('audio-gate');
    this.planeNameLabel = document.getElementById('plane-name');
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x6a8fae);
    this.scene.fog = new THREE.FogExp2(0x6a8fae, 0.00008);

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.2, 80000);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.viewport, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445533, 0.95));
    const sun = new THREE.DirectionalLight(0xfffaed, 1.25);
    sun.position.set(1200, 3000, 1500);
    this.scene.add(sun);

    this.tileManager = new TileManager(this.scene);
    this.scene.add(createRunway());

    this.aircraftNode = new THREE.Group();
    this.scene.add(this.aircraftNode);

    this.models = {
      c172: createC172Model(),
      m2000: createM2000Model(),
      a320: createA320Model()
    };

    Object.values(this.models).forEach((m) => this.aircraftNode.add(m));
    this.setAircraft('c172');
  }

  initAudio() {
    this.soundEngine = new SoundEngine();
    if (this.audioGate) {
      this.audioGate.addEventListener('click', () => {
        this.soundEngine.init();
        this.audioGate.style.display = 'none';
      });
    }
  }

  initPhysics() {
    this.physics = new PhysicsEngine(this.aircraftNode, this.models);
    this.physics.setInitialGroundPosition(this.currentSpec.groundAlt);
    this.hud = new HUD(this.hudCanvas, this.aircraftNode, this.physics);
  }

  setAircraft(key) {
    if (!FLEET[key]) return;
    this.activeKey = key;
    this.currentSpec = FLEET[key];
    Object.keys(this.models).forEach((k) => {
      this.models[k].visible = (k === key);
    });
    if (this.planeNameLabel) {
      this.planeNameLabel.textContent = this.currentSpec.name;
    }
  }

  initInputListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Digit1') this.setAircraft('c172');
      if (e.code === 'Digit2') this.setAircraft('m2000');
      if (e.code === 'Digit3') this.setAircraft('a320');
      if (e.code === 'KeyF') this.physics.flaps = (this.physics.flaps + 1) % 3;
      if (e.code === 'KeyC') this.cockpitView = !this.cockpitView;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  updateInputs(dt) {
    this.inputs.pitch = 0;
    this.inputs.roll = 0;
    this.inputs.yaw = 0;
    this.inputs.brakes = !!this.keys['KeyB'];

    if (this.keys['KeyS'] || this.keys['ArrowDown']) this.inputs.pitch += 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp'])   this.inputs.pitch -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.inputs.roll  -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight'])this.inputs.roll  += 1;
    if (this.keys['KeyQ']) this.inputs.yaw -= 1;
    if (this.keys['KeyE']) this.inputs.yaw += 1;

    if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
      this.physics.throttle = Math.min(1.0, this.physics.throttle + 0.65 * dt);
    }
    if (this.keys['ControlLeft'] || this.keys['ControlRight']) {
      this.physics.throttle = Math.max(0.0, this.physics.throttle - 0.65 * dt);
    }
  }

  onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.hud.resize();
  }

  updateCamera() {
    const pos = this.physics.pos;
    const gAlt = this.currentSpec.groundAlt;
    const chord = this.currentSpec.chord;
    const wingSpan = this.currentSpec.wingSpan;

    if (this.cockpitView) {
      const offset = new THREE.Vector3(0, gAlt * 0.45, -chord * 0.35).applyQuaternion(this.aircraftNode.quaternion);
      this.camera.position.copy(pos).add(offset);
      const look = new THREE.Vector3(0, gAlt * 0.35, -30).applyQuaternion(this.aircraftNode.quaternion);
      this.camera.lookAt(this.camera.position.clone().add(look));
    } else {
      const dist = wingSpan * 1.35;
      const camOffset = new THREE.Vector3(0, gAlt * 1.8 + 2.0, dist).applyQuaternion(this.aircraftNode.quaternion);
      this.camera.position.lerp(pos.clone().add(camOffset), 0.14);
      this.camera.lookAt(pos.clone().add(new THREE.Vector3(0, 0.8, -4).applyQuaternion(this.aircraftNode.quaternion)));
    }
  }

  animate(now) {
    requestAnimationFrame((t) => this.animate(t));
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.updateInputs(dt);
    this.physics.step(dt, this.currentSpec, this.inputs, this.tileManager, this.soundEngine);
    this.updateCamera();

    this.renderer.render(this.scene, this.camera);
    this.hud.draw();

    window.__simReady = true;
  }
}

window.__simReady = false;
window.__simState = null;

window.addEventListener('DOMContentLoaded', () => {
  new SimulatorApp();
});
