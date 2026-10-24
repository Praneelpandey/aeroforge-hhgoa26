/* ============================================================================
 * AEROFORGE — 100% procedural Web Audio sound engine + Web Speech narrator.
 * No external audio files: every click, klaxon, rocket roar, V8 rumble and
 * drone hum is synthesised live from oscillators, noise buffers and biquad
 * filters. The AI Mission-Control voice uses window.speechSynthesis.
 * ==========================================================================*/

type LoopHandle = {
  stop: () => void;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBufs: Map<string, AudioBuffer> = new Map();

  private engineNodes: {
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    oscSub: OscillatorNode;
    noiseSrc: AudioBufferSourceNode;
    noiseFilter: BiquadFilterNode;
    gain: GainNode;
  } | null = null;

  private droneNodes: {
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    noise: AudioBufferSourceNode;
    noiseFilter: BiquadFilterNode;
    gain: GainNode;
  } | null = null;

  muted = false;
  voiceOn = true;

  /* ── Lifecycle ─────────────────────────────────────────────────────── */

  /** Must be called from a user gesture at least once to unlock audio. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    }
    if (m) this.cancelSpeech();
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private get ok(): boolean {
    return this.ctx !== null && this.master !== null;
  }

  /* ── Noise buffers ─────────────────────────────────────────────────── */

  private noise(kind: 'white' | 'brown' | 'pink'): AudioBuffer {
    const key = kind;
    const cached = this.noiseBufs.get(key);
    if (cached) return cached;
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    if (kind === 'white') {
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } else if (kind === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    } else {
      // pink via Paul Kellet's approximation
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    this.noiseBufs.set(key, buf);
    return buf;
  }

  private makeNoiseSource(kind: 'white' | 'brown' | 'pink'): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise(kind);
    src.loop = true;
    return src;
  }

  /* ── Generic one-shot builder ──────────────────────────────────────── */

  private tone(opts: {
    type: OscillatorType;
    freq: number;
    endFreq?: number;
    dur: number;
    gain: number;
    attack?: number;
    filter?: { type: BiquadFilterType; freq: number; endFreq?: number; q?: number };
    delay?: number;
  }): void {
    if (!this.ok) return;
    const ctx = this.ctx!;
    const t0 = this.now() + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.endFreq), t0 + opts.dur);
    const g = ctx.createGain();
    const atk = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    let node: AudioNode = osc;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filter.type;
      f.frequency.setValueAtTime(opts.filter.freq, t0);
      if (opts.filter.endFreq !== undefined)
        f.frequency.exponentialRampToValueAtTime(Math.max(10, opts.filter.endFreq), t0 + opts.dur);
      f.Q.value = opts.filter.q ?? 1;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.05);
  }

  private noiseBurst(opts: {
    kind: 'white' | 'brown' | 'pink';
    dur: number;
    gain: number;
    filter?: { type: BiquadFilterType; freq: number; endFreq?: number; q?: number };
    delay?: number;
    attack?: number;
  }): void {
    if (!this.ok) return;
    const ctx = this.ctx!;
    const t0 = this.now() + (opts.delay ?? 0);
    const src = this.makeNoiseSource(opts.kind);
    const g = ctx.createGain();
    const atk = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    let node: AudioNode = src;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filter.type;
      f.frequency.setValueAtTime(opts.filter.freq, t0);
      if (opts.filter.endFreq !== undefined)
        f.frequency.exponentialRampToValueAtTime(Math.max(10, opts.filter.endFreq), t0 + opts.dur);
      f.Q.value = opts.filter.q ?? 1;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.master!);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.05);
  }

  /* ── UI / game one-shots ───────────────────────────────────────────── */

  uiHover(): void {
    this.tone({ type: 'sine', freq: 1180, endFreq: 1480, dur: 0.07, gain: 0.05 });
  }

  uiClick(): void {
    this.tone({ type: 'triangle', freq: 660, endFreq: 880, dur: 0.09, gain: 0.12 });
    this.tone({ type: 'sine', freq: 1320, dur: 0.05, gain: 0.05, delay: 0.03 });
  }

  /** Magnetic snap when a part locks onto the stack. */
  snap(): void {
    this.tone({ type: 'square', freq: 220, endFreq: 90, dur: 0.08, gain: 0.14, filter: { type: 'lowpass', freq: 900 } });
    this.tone({ type: 'sine', freq: 1720, endFreq: 2400, dur: 0.1, gain: 0.1, delay: 0.015 });
    this.noiseBurst({ kind: 'white', dur: 0.05, gain: 0.1, filter: { type: 'highpass', freq: 3000 } });
  }

  unsnap(): void {
    this.tone({ type: 'square', freq: 140, endFreq: 320, dur: 0.09, gain: 0.1 });
  }

  /** Pneumatic wrench rattle. */
  wrench(): void {
    for (let i = 0; i < 9; i++) {
      this.noiseBurst({
        kind: 'white',
        dur: 0.03,
        gain: 0.12,
        filter: { type: 'bandpass', freq: 1400 + i * 90, q: 6 },
        delay: i * 0.045,
      });
    }
    this.tone({ type: 'sawtooth', freq: 90, endFreq: 55, dur: 0.5, gain: 0.06, filter: { type: 'lowpass', freq: 300 } });
  }

  collect(): void {
    this.tone({ type: 'sine', freq: 523, dur: 0.12, gain: 0.1 });
    this.tone({ type: 'sine', freq: 784, dur: 0.14, gain: 0.1, delay: 0.09 });
    this.tone({ type: 'sine', freq: 1046, dur: 0.2, gain: 0.08, delay: 0.18 });
  }

  beep(freq = 880, dur = 0.09, gain = 0.12): void {
    this.tone({ type: 'square', freq, dur, gain, filter: { type: 'lowpass', freq: 2400 } });
  }

  successChime(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this.tone({ type: 'sine', freq: f, dur: 0.5, gain: 0.11, delay: i * 0.11 });
      this.tone({ type: 'triangle', freq: f * 2, dur: 0.4, gain: 0.04, delay: i * 0.11 });
    });
  }

  /** Facility klaxon — two-tone alternating alarm, `cycles` sweeps. */
  klaxon(cycles = 3): void {
    if (!this.ok) return;
    for (let i = 0; i < cycles; i++) {
      const t = i * 0.62;
      this.tone({ type: 'sawtooth', freq: 620, endFreq: 470, dur: 0.3, gain: 0.09, delay: t, filter: { type: 'lowpass', freq: 1800, q: 2 } });
      this.tone({ type: 'sawtooth', freq: 470, endFreq: 620, dur: 0.3, gain: 0.09, delay: t + 0.3, filter: { type: 'lowpass', freq: 1800, q: 2 } });
    }
  }

  /** Metallic clank — mechanical seizure. */
  clank(): void {
    this.tone({ type: 'square', freq: 310, endFreq: 60, dur: 0.16, gain: 0.2, filter: { type: 'lowpass', freq: 700, q: 4 } });
    this.noiseBurst({ kind: 'white', dur: 0.22, gain: 0.16, filter: { type: 'bandpass', freq: 2400, q: 3 } });
    this.tone({ type: 'sawtooth', freq: 145, endFreq: 40, dur: 0.5, gain: 0.14, delay: 0.08, filter: { type: 'lowpass', freq: 400 } });
  }

  /** Structural collapse crunch. */
  crunch(): void {
    this.noiseBurst({ kind: 'brown', dur: 0.9, gain: 0.5, filter: { type: 'lowpass', freq: 900, endFreq: 120 } });
    for (let i = 0; i < 7; i++) {
      this.noiseBurst({
        kind: 'white',
        dur: 0.12,
        gain: 0.16,
        filter: { type: 'bandpass', freq: 700 + Math.random() * 2200, q: 4 },
        delay: 0.06 + i * 0.075,
      });
    }
    this.tone({ type: 'sine', freq: 55, endFreq: 28, dur: 1.1, gain: 0.3 });
  }

  /** Engine knock — hammering detonation. */
  knock(): void {
    for (let i = 0; i < 10; i++) {
      this.tone({
        type: 'square',
        freq: 120 + Math.random() * 60,
        endFreq: 50,
        dur: 0.06,
        gain: 0.2,
        delay: i * 0.13,
        filter: { type: 'lowpass', freq: 500, q: 5 },
      });
      this.noiseBurst({
        kind: 'pink',
        dur: 0.5,
        gain: 0.12,
        filter: { type: 'lowpass', freq: 500 },
        delay: i * 0.13,
      });
    }
  }

  /** Drone crash — whoosh + clatter. */
  crash(): void {
    this.noiseBurst({ kind: 'pink', dur: 0.6, gain: 0.3, filter: { type: 'bandpass', freq: 900, endFreq: 250, q: 1.2 } });
    this.tone({ type: 'sine', freq: 220, endFreq: 60, dur: 0.5, gain: 0.25 });
    this.clank();
  }

  /** Thermal meltdown / explosion. */
  explosion(): void {
    this.noiseBurst({ kind: 'brown', dur: 2.4, gain: 0.75, filter: { type: 'lowpass', freq: 2600, endFreq: 90 } });
    this.noiseBurst({ kind: 'white', dur: 0.35, gain: 0.3, filter: { type: 'highpass', freq: 1800 } });
    this.tone({ type: 'sine', freq: 70, endFreq: 24, dur: 2.2, gain: 0.5 });
    // debris crackle
    for (let i = 0; i < 14; i++) {
      this.noiseBurst({
        kind: 'white',
        dur: 0.05,
        gain: 0.09,
        filter: { type: 'bandpass', freq: 1200 + Math.random() * 3600, q: 7 },
        delay: 0.15 + Math.random() * 1.6,
      });
    }
  }

  /* ── Rocket ignition roar (multi-layer, swept filter) ──────────────── */

  launchRoar(duration = 14): LoopHandle {
    if (!this.ok) return { stop: () => {} };
    const ctx = this.ctx!;
    const t0 = this.now();
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.85, t0 + 0.6);
    out.gain.setValueAtTime(0.85, t0 + duration * 0.55);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    out.connect(this.master!);

    // Layer 1: brown noise through swept lowpass
    const n1 = this.makeNoiseSource('brown');
    const f1 = ctx.createBiquadFilter();
    f1.type = 'lowpass';
    f1.frequency.setValueAtTime(140, t0);
    f1.frequency.exponentialRampToValueAtTime(2400, t0 + 1.1);
    f1.frequency.exponentialRampToValueAtTime(680, t0 + 4);
    f1.Q.value = 0.7;
    const g1 = ctx.createGain();
    g1.gain.value = 1.6;
    n1.connect(f1).connect(g1).connect(out);

    // Layer 2: pink noise crackle band
    const n2 = this.makeNoiseSource('pink');
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.setValueAtTime(400, t0);
    f2.frequency.exponentialRampToValueAtTime(1500, t0 + 1.4);
    f2.Q.value = 0.9;
    const g2 = ctx.createGain();
    g2.gain.value = 0.55;
    n2.connect(f2).connect(g2).connect(out);

    // Layer 3: sub-bass rumble
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(30, t0);
    sub.frequency.exponentialRampToValueAtTime(46, t0 + 1.2);
    sub.frequency.exponentialRampToValueAtTime(33, t0 + 6);
    const g3 = ctx.createGain();
    g3.gain.value = 0.7;
    sub.connect(g3).connect(out);

    // Layer 4: slow amplitude wobble for that "rolling thunder" texture
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 7.3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.25;
    lfo.connect(lfoGain).connect(g1.gain);

    n1.start(t0);
    n2.start(t0);
    sub.start(t0);
    lfo.start(t0);
    const stop = () => {
      const t = this.now();
      try {
        out.gain.cancelScheduledValues(t);
        out.gain.setTargetAtTime(0.0001, t, 0.25);
        n1.stop(t + 1.2);
        n2.stop(t + 1.2);
        sub.stop(t + 1.2);
        lfo.stop(t + 1.2);
      } catch {
        /* already stopped */
      }
    };
    return { stop };
  }

  /* ── V8 engine loop (RPM-mapped sawtooth pulse train) ──────────────── */

  startEngine(): void {
    if (!this.ok || this.engineNodes) return;
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.master!);

    const osc1 = ctx.createOscillator(); // firing pulse train
    osc1.type = 'sawtooth';
    osc1.frequency.value = 53;
    const o1g = ctx.createGain();
    o1g.gain.value = 0.5;
    const dist = ctx.createBiquadFilter();
    dist.type = 'lowpass';
    dist.frequency.value = 950;
    dist.Q.value = 2.2;
    osc1.connect(o1g).connect(dist).connect(gain);

    const osc2 = ctx.createOscillator(); // half-order rumble
    osc2.type = 'square';
    osc2.frequency.value = 26.5;
    const o2g = ctx.createGain();
    o2g.gain.value = 0.22;
    const o2f = ctx.createBiquadFilter();
    o2f.type = 'lowpass';
    o2f.frequency.value = 240;
    osc2.connect(o2g).connect(o2f).connect(gain);

    const oscSub = ctx.createOscillator(); // block-shake sub
    oscSub.type = 'sine';
    oscSub.frequency.value = 53;
    const o3g = ctx.createGain();
    o3g.gain.value = 0.3;
    oscSub.connect(o3g).connect(gain);

    const noiseSrc = this.makeNoiseSource('pink'); // exhaust rasp
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 320;
    noiseFilter.Q.value = 0.6;
    const ng = ctx.createGain();
    ng.gain.value = 0.4;
    noiseSrc.connect(noiseFilter).connect(ng).connect(gain);

    osc1.start();
    osc2.start();
    oscSub.start();
    noiseSrc.start();
    this.engineNodes = { osc1, osc2, oscSub, noiseSrc, noiseFilter, gain };
  }

  /** firing freq = rpm/60 × n_cyl/2 → 800 rpm ≈ 53 Hz purr, 8000 rpm ≈ 533 Hz scream */
  setEngineRpm(rpm: number, throttle01: number): void {
    const n = this.engineNodes;
    if (!n || !this.ctx) return;
    const f = clamp((rpm / 60) * 4, 20, 800);
    const t = this.now();
    n.osc1.frequency.setTargetAtTime(f, t, 0.08);
    n.osc2.frequency.setTargetAtTime(f / 2, t, 0.08);
    n.oscSub.frequency.setTargetAtTime(f, t, 0.08);
    n.noiseFilter.frequency.setTargetAtTime(220 + f * 1.6, t, 0.1);
    n.gain.gain.setTargetAtTime(0.12 + throttle01 * 0.16, t, 0.12);
  }

  stopEngine(): void {
    const n = this.engineNodes;
    if (!n || !this.ctx) return;
    const t = this.now();
    n.gain.gain.setTargetAtTime(0.0001, t, 0.15);
    const kill = n;
    this.engineNodes = null;
    setTimeout(() => {
      try {
        kill.osc1.stop();
        kill.osc2.stop();
        kill.oscSub.stop();
        kill.noiseSrc.stop();
      } catch {
        /* already stopped */
      }
    }, 600);
  }

  /* ── Drone rotor hum loop ──────────────────────────────────────────── */

  startDrone(): void {
    if (!this.ok || this.droneNodes) return;
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.master!);

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.value = 110;
    const g1 = ctx.createGain();
    g1.gain.value = 0.5;
    osc1.connect(g1).connect(gain);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 111.5;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.value = 900;
    const g2 = ctx.createGain();
    g2.gain.value = 0.14;
    osc2.connect(f2).connect(g2).connect(gain);

    const noise = this.makeNoiseSource('white'); // blade wash
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 420;
    const g3 = ctx.createGain();
    g3.gain.value = 0.22;
    noise.connect(noiseFilter).connect(g3).connect(gain);

    osc1.start();
    osc2.start();
    noise.start();
    this.droneNodes = { osc1, osc2, noise, noiseFilter, gain };
  }

  setDroneThrottle(throttle01: number): void {
    const n = this.droneNodes;
    if (!n || !this.ctx) return;
    const f = 85 + throttle01 * 170;
    const t = this.now();
    n.osc1.frequency.setTargetAtTime(f, t, 0.1);
    n.osc2.frequency.setTargetAtTime(f * 1.013, t, 0.1);
    n.noiseFilter.frequency.setTargetAtTime(260 + throttle01 * 700, t, 0.12);
    n.gain.gain.setTargetAtTime(0.05 + throttle01 * 0.14, t, 0.15);
  }

  stopDrone(): void {
    const n = this.droneNodes;
    if (!n || !this.ctx) return;
    const t = this.now();
    n.gain.gain.setTargetAtTime(0.0001, t, 0.12);
    const kill = n;
    this.droneNodes = null;
    setTimeout(() => {
      try {
        kill.osc1.stop();
        kill.osc2.stop();
        kill.noise.stop();
      } catch {
        /* already stopped */
      }
    }, 500);
  }

  /* ── AI Mission-Control voice (Web Speech API) ─────────────────────── */

  speak(text: string, opts?: { rate?: number; pitch?: number; interrupt?: boolean }): void {
    if (!this.voiceOn || this.muted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      if (opts?.interrupt !== false) window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opts?.rate ?? 1.04;
      u.pitch = opts?.pitch ?? 0.92;
      u.volume = 0.95;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => /en[-_](US|GB)/i.test(v.lang) && /google|neural|natural|samantha|daniel/i.test(v.name)) ??
        voices.find((v) => /^en/i.test(v.lang));
      if (preferred) u.voice = preferred;
      window.speechSynthesis.speak(u);
    } catch {
      /* speech unavailable — silent degrade */
    }
  }

  cancelSpeech(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    }
  }
}

export const sound = new SoundEngine();
