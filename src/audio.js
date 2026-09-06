/**
 * Web Audio Sound Synthesizer for Engine & Environmental Audio
 */

export class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.oscPiston = null;
    this.filterPiston = null;
    this.gainPiston = null;

    this.whiteNoise = null;
    this.jetFilter = null;
    this.gainJet = null;
  }

  init() {
    if (this.audioCtx) return;
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) return;

    this.audioCtx = new AudioCtxClass();

    // Piston engine sound synthesis
    this.oscPiston = this.audioCtx.createOscillator();
    this.oscPiston.type = 'sawtooth';
    this.oscPiston.frequency.setValueAtTime(50, this.audioCtx.currentTime);

    this.filterPiston = this.audioCtx.createBiquadFilter();
    this.filterPiston.type = 'lowpass';
    this.filterPiston.frequency.setValueAtTime(420, this.audioCtx.currentTime);

    this.gainPiston = this.audioCtx.createGain();
    this.gainPiston.gain.setValueAtTime(0.0, this.audioCtx.currentTime);

    this.oscPiston.connect(this.filterPiston).connect(this.gainPiston).connect(this.audioCtx.destination);
    this.oscPiston.start();

    // Jet engine / noise synthesis
    const bufferSize = this.audioCtx.sampleRate * 2;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.whiteNoise = this.audioCtx.createBufferSource();
    this.whiteNoise.buffer = noiseBuffer;
    this.whiteNoise.loop = true;

    this.jetFilter = this.audioCtx.createBiquadFilter();
    this.jetFilter.type = 'bandpass';
    this.jetFilter.frequency.setValueAtTime(800, this.audioCtx.currentTime);
    this.jetFilter.Q.setValueAtTime(1.8, this.audioCtx.currentTime);

    this.gainJet = this.audioCtx.createGain();
    this.gainJet.gain.setValueAtTime(0.0, this.audioCtx.currentTime);

    this.whiteNoise.connect(this.jetFilter).connect(this.gainJet).connect(this.audioCtx.destination);
    this.whiteNoise.start();
  }

  update(spec, actualThrustRatio, airspeed) {
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    if (spec.engineType === 'piston') {
      this.gainPiston.gain.setTargetAtTime(0.09, now, 0.05);
      this.gainJet.gain.setTargetAtTime(Math.min(0.2, (airspeed / 90.0) * 0.18), now, 0.05);
      this.oscPiston.frequency.setTargetAtTime(45 + actualThrustRatio * 135, now, 0.05);
    } else {
      this.gainPiston.gain.setTargetAtTime(0.0, now, 0.05);
      this.gainJet.gain.setTargetAtTime(0.04 + actualThrustRatio * 0.25 + (airspeed / 250.0) * 0.15, now, 0.05);
      this.jetFilter.frequency.setTargetAtTime(600 + actualThrustRatio * 2200, now, 0.05);
    }
  }
}
