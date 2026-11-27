import type { State } from './types';
import { inTransit } from './transit';
import { visibleEvent } from './simulation';
/** Original synthesized soundscape. No downloaded samples or external services. */
export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private effects?: GainNode;
  private ambience?: GainNode;
  private rumble?: BiquadFilterNode;
  private state?: State;
  private events = 0;
  private nextStep = 0;
  private nextNote = 0;
  private note = 0;
  private previous = { x: 0, y: 0, station: -1 };
  private noise?: AudioBuffer;
  unlock() {
    if (!this.context) {
      const c = (this.context = new AudioContext());
      this.master = c.createGain();
      this.master.gain.value = 0;
      this.master.connect(c.destination);
      const compressor = c.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 4;
      compressor.connect(this.master);
      this.music = c.createGain();
      this.effects = c.createGain();
      this.ambience = c.createGain();
      for (const g of [this.music, this.effects, this.ambience]) g.connect(compressor);
      const buffer = (this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)),
        data = buffer.getChannelData(0);
      let rng = 4187;
      for (let i = 0; i < data.length; i++) {
        rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
        data[i] = (rng / 4294967296) * 2 - 1;
      }
      const source = c.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const low = (this.rumble = c.createBiquadFilter());
      low.type = 'lowpass';
      low.frequency.value = 180;
      source.connect(low);
      low.connect(this.ambience);
      source.start();
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }
  private tone(
    frequency: number,
    duration: number,
    volume = 0.12,
    delay = 0,
    type: OscillatorType = 'sine',
    bus = this.effects,
  ) {
    const c = this.context;
    if (!c || !bus) return;
    const osc = c.createOscillator(),
      gain = c.createGain(),
      at = c.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(at);
    osc.stop(at + duration + 0.03);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  private rustle(duration = 0.1, frequency = 900, volume = 0.08) {
    const c = this.context;
    if (!c || !this.noise || !this.effects) return;
    const source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    source.buffer = this.noise;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.effects);
    source.start();
    source.stop(c.currentTime + duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  cue(kind: string) {
    if (kind === 'capture') {
      this.rustle(0.12, 900, 0.16);
      [523, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 0.1, i * 0.065, 'triangle'));
      return;
    }
    if (kind === 'spotted') {
      this.tone(392, 0.12, 0.075, 0, 'triangle');
      this.tone(587, 0.2, 0.07, 0.1, 'triangle');
      return;
    }
    if (kind === 'ui') {
      this.tone(660, 0.045, 0.035);
      return;
    }
    if (kind === 'cover') {
      this.rustle(0.25, 1500, 0.12);
      this.tone(220, 0.15, 0.05);
      return;
    }
    if (kind === 'board') {
      this.tone(440, 0.55, 0.07);
      this.tone(554, 0.6, 0.055, 0.1);
      this.rustle(0.4, 450, 0.08);
      return;
    }
    if (kind === 'arrival') {
      [523, 659, 784].forEach((f, i) => this.tone(f, 0.45, 0.08, i * 0.13));
      return;
    }
    if (kind === 'card') {
      this.rustle(0.14, 2300, 0.16);
      this.tone(330, 0.18, 0.08, 0.07, 'triangle');
      this.tone(660, 0.28, 0.06, 0.12);
      return;
    }
    if (kind === 'question') {
      this.tone(698, 0.15, 0.08);
      this.tone(880, 0.3, 0.08, 0.15);
      return;
    }
    if (kind === 'answer' || kind === 'curse') {
      this.tone(523, 0.18, 0.08);
      this.tone(784, 0.26, 0.06, 0.1);
      return;
    }
    if (kind === 'result') {
      [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.8, 0.09, i * 0.16, 'triangle'));
      return;
    }
    if (kind === 'warning') {
      this.tone(294, 0.23, 0.08);
      this.tone(262, 0.32, 0.06, 0.25);
    }
  }
  update(s: State, active: boolean) {
    const c = this.context;
    if (!c || !this.master || !this.music || !this.effects || !this.ambience) return;
    const settings = s.settings,
      a = s.actors[0],
      traveling = inTransit(a, s.time),
      quiet = !active || s.paused || document.hidden;
    const target = settings.sound && !document.hidden ? (settings.masterVolume ?? 0.7) : 0;
    this.master.gain.setTargetAtTime(target, c.currentTime, 0.08);
    this.effects.gain.setTargetAtTime(settings.effectsVolume ?? 0.7, c.currentTime, 0.1);
    this.music.gain.setTargetAtTime((settings.musicVolume ?? 0.22) * (quiet ? 0.5 : 1), c.currentTime, 0.2);
    this.ambience.gain.setTargetAtTime(
      quiet ? 0 : (settings.ambienceVolume ?? 0.4) * (traveling ? 0.2 : 0.025),
      c.currentTime,
      0.3,
    );
    if (this.rumble)
      this.rumble.frequency.setTargetAtTime(
        traveling
          ? a.journey[0].kind === 'bus'
            ? 260
            : 150
          : s.world.stations[a.station].kind === 'coast'
            ? 650
            : 350,
        c.currentTime,
        0.4,
      );
    if (this.state !== s) {
      this.state = s;
      this.events = s.events.length;
      this.previous = { x: a.x, y: a.y, station: a.station };
    }
    if (s.events.length < this.events) this.events = 0;
    const fresh = s.events.slice(this.events),
      captured = fresh.some((e) => e.type === 'capture');
    for (const e of fresh)
      if (visibleEvent(s, e) && s.time - e.time < 1 && !quiet && !(captured && e.type === 'result'))
        this.cue(e.type);
    this.events = s.events.length;
    const moved =
      this.previous.station === a.station && Math.hypot(a.x - this.previous.x, a.y - this.previous.y) > 0.025;
    if (moved && !traveling && !quiet && c.currentTime > this.nextStep) {
      this.nextStep = c.currentTime + (a.sprinting ? 0.19 : 0.31);
      const t = s.world.stations[a.station].local,
        tile = t.tiles[Math.floor(a.y) * t.width + Math.floor(a.x)];
      this.rustle(0.065, tile === 0 ? 1300 : 500, 0.08);
      this.tone(tile === 4 ? 130 : 95, 0.055, 0.06, 0, 'triangle');
    }
    this.previous = { x: a.x, y: a.y, station: a.station };
    if (c.currentTime > this.nextNote && !document.hidden) {
      this.nextNote = c.currentTime + 0.6 * 2;
      const melody = [
        64, 67, 71, 74, 71, 67, 62, 66, 69, 74, 69, 66, 60, 64, 67, 72, 67, 64, 62, 66, 69, 71, 69, 66,
      ];
      const n = melody[this.note++ % melody.length];
      this.tone(440 * 2 ** ((n - 69) / 12), 1.8, 0.1, 0, 'sine', this.music);
      if (this.note % 3 === 1) this.tone(440 * 2 ** ((n - 24 - 69) / 12), 3, 0.08, 0, 'triangle', this.music);
    }
  }
}
