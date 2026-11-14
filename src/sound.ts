/**
 * Suara 8-bit tanpa file audio: semua dibuat langsung dengan Web Audio API.
 * - SFX: benar, salah, prestasi, naik level, koin, pukulan, bel Pomodoro.
 * - Musik: chiptune, lo-fi, hujan, derau putih/coklat — untuk Pomodoro & sesi belajar.
 */
type Wave = OscillatorType;
export type Sfx = "correct" | "wrong" | "achievement" | "levelup" | "coin" | "hit" | "hurt" | "click" | "chime" | "victory" | "defeat" | "flip";
export type MusicKind = "off" | "chiptune" | "lofi" | "rain" | "white" | "brown" | "ambient" | "piano" | "waves";

export const MUSIC: { id: MusicKind; label: string; icon: string; desc: string }[] = [
	{ id: "lofi", label: "Lo-fi 8-bit", icon: "🎧", desc: "Ketukan santai" },
	{ id: "piano", label: "Piano lembut", icon: "🎹", desc: "Melodi tenang bergema" },
	{ id: "ambient", label: "Ambient tenang", icon: "🌌", desc: "Akor mengalun pelan" },
	{ id: "chiptune", label: "Chiptune ceria", icon: "🎮", desc: "Semangat ala game" },
	{ id: "rain", label: "Hujan", icon: "🌧️", desc: "Rintik hujan" },
	{ id: "waves", label: "Ombak", icon: "🌊", desc: "Debur ombak pelan" },
	{ id: "brown", label: "Derau coklat", icon: "🟤", desc: "Dengung lembut peredam bising" },
	{ id: "white", label: "Derau putih", icon: "📻", desc: "Desis merata" },
];

class Engine {
	ctx: AudioContext | null = null;
	sfxGain: GainNode | null = null;
	musicGain: GainNode | null = null;
	sfxVol = 0.5;
	musicVol = 0.35;
	enabled = true;

	ensure(): AudioContext | null {
		if (this.ctx) {
			if (this.ctx.state === "suspended") void this.ctx.resume();
			return this.ctx;
		}
		const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AC) return null;
		this.ctx = new AC();
		this.sfxGain = this.ctx.createGain();
		this.sfxGain.gain.value = this.sfxVol;
		this.sfxGain.connect(this.ctx.destination);
		this.musicGain = this.ctx.createGain();
		this.musicGain.gain.value = this.musicVol;
		this.musicGain.connect(this.ctx.destination);
		return this.ctx;
	}

	tone(freq: number, start: number, dur: number, wave: Wave = "square", vol = 0.25, out?: AudioNode, slide?: number) {
		const c = this.ctx!;
		const o = c.createOscillator();
		const g = c.createGain();
		o.type = wave;
		o.frequency.setValueAtTime(freq, start);
		if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), start + dur);
		g.gain.setValueAtTime(0.0001, start);
		g.gain.exponentialRampToValueAtTime(vol, start + 0.008);
		g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
		o.connect(g).connect(out ?? this.sfxGain!);
		o.start(start);
		o.stop(start + dur + 0.02);
	}

	noise(start: number, dur: number, vol = 0.2, out?: AudioNode, filterHz = 0) {
		const c = this.ctx!;
		const len = Math.max(1, Math.floor(c.sampleRate * dur));
		const buf = c.createBuffer(1, len, c.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
		const src = c.createBufferSource();
		src.buffer = buf;
		const g = c.createGain();
		g.gain.setValueAtTime(vol, start);
		g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
		let node: AudioNode = src;
		if (filterHz) {
			const f = c.createBiquadFilter();
			f.type = "highpass";
			f.frequency.value = filterHz;
			src.connect(f);
			node = f;
		}
		node.connect(g).connect(out ?? this.sfxGain!);
		src.start(start);
	}
}

const E = new Engine();
const N = (semi: number) => 440 * Math.pow(2, (semi - 9) / 12); // 0 = C4

export function configureSound(o: { enabled: boolean; sfxVol: number; musicVol: number }) {
	E.enabled = o.enabled;
	E.sfxVol = o.sfxVol;
	E.musicVol = o.musicVol;
	if (E.sfxGain) E.sfxGain.gain.value = o.sfxVol;
	if (E.musicGain) E.musicGain.gain.value = o.musicVol;
}

export function play(s: Sfx) {
	if (!E.enabled) return;
	const c = E.ensure();
	if (!c) return;
	const t = c.currentTime + 0.01;
	switch (s) {
		case "correct": E.tone(N(12 + 7), t, 0.09, "square", 0.18); E.tone(N(24), t + 0.08, 0.16, "square", 0.18); break;
		case "wrong": E.tone(N(-5), t, 0.28, "sawtooth", 0.16, undefined, N(-17)); E.tone(N(-6), t, 0.28, "square", 0.08, undefined, N(-18)); break;
		case "coin": E.tone(N(23), t, 0.06, "square", 0.15); E.tone(N(28), t + 0.06, 0.22, "square", 0.15); break;
		case "click": E.tone(N(19), t, 0.03, "square", 0.08); break;
		case "flip": E.noise(t, 0.07, 0.08, undefined, 2500); E.tone(N(14), t, 0.05, "triangle", 0.08, undefined, N(21)); break;
		case "hit": E.noise(t, 0.12, 0.3, undefined, 800); E.tone(N(-8), t, 0.12, "square", 0.15, undefined, N(-20)); break;
		case "hurt": E.tone(N(2), t, 0.08, "square", 0.18); E.tone(N(-4), t + 0.08, 0.2, "square", 0.18, undefined, N(-14)); break;
		case "chime": [0, 4, 7, 12].forEach((k, i) => E.tone(N(12 + k), t + i * 0.13, 0.5, "triangle", 0.2)); break;
		case "achievement": [0, 4, 7, 12, 16].forEach((k, i) => E.tone(N(12 + k), t + i * 0.07, 0.18, "square", 0.14)); E.tone(N(31), t + 0.38, 0.5, "triangle", 0.18); break;
		case "levelup": [0, 4, 7, 12, 7, 12, 16, 19].forEach((k, i) => E.tone(N(7 + k), t + i * 0.08, 0.14, "square", 0.14)); E.tone(N(31), t + 0.66, 0.6, "square", 0.12); break;
		case "victory": [0, 0, 0, 4, 7, 4, 7, 12].forEach((k, i) => E.tone(N(12 + k), t + i * 0.11, i === 7 ? 0.7 : 0.1, "square", 0.15)); break;
		case "defeat": [7, 6, 5, 4].forEach((k, i) => E.tone(N(k), t + i * 0.2, 0.22, "triangle", 0.18)); E.tone(N(-12), t + 0.8, 0.6, "triangle", 0.2); break;
	}
}

// ---------------------------------------------------------------- musik
let current: MusicKind = "off";
let timer: number | null = null;
let nodes: AudioNode[] = [];
let nextTime = 0;
let step = 0;

const PROG = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]]; // C – Am – F – G
const MELODY = [12, 16, 19, 16, 14, 12, 11, 7, 9, 12, 16, 14, 12, 11, 12, -1];

function loopNoise(kind: "white" | "brown" | "rain") {
	const c = E.ctx!;
	const len = c.sampleRate * 4;
	const buf = c.createBuffer(1, len, c.sampleRate);
	const d = buf.getChannelData(0);
	let last = 0;
	for (let i = 0; i < len; i++) {
		const w = Math.random() * 2 - 1;
		if (kind === "white") d[i] = w * 0.35;
		else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
	}
	const src = c.createBufferSource();
	src.buffer = buf;
	src.loop = true;
	const f = c.createBiquadFilter();
	f.type = kind === "rain" ? "bandpass" : "lowpass";
	f.frequency.value = kind === "rain" ? 1400 : kind === "brown" ? 500 : 9000;
	if (kind === "rain") f.Q.value = 0.6;
	const g = c.createGain();
	g.gain.value = kind === "rain" ? 0.9 : 0.6;
	src.connect(f).connect(g).connect(E.musicGain!);
	src.start();
	nodes.push(src, f, g);
	if (kind === "rain") {
		// tetes hujan acak
		timer = window.setInterval(() => {
			const t = c.currentTime;
			for (let k = 0; k < 3; k++) if (Math.random() < 0.6) E.tone(1800 + Math.random() * 2400, t + Math.random() * 0.25, 0.03, "sine", 0.03, E.musicGain!);
		}, 250);
	}
}

/** Jalur gema sederhana (delay + umpan balik) untuk musik yang lembut. */
function echoBus(): GainNode {
	const c = E.ctx!;
	const input = c.createGain();
	const dl = c.createDelay(1.5);
	dl.delayTime.value = 0.38;
	const fb = c.createGain();
	fb.gain.value = 0.38;
	const wet = c.createGain();
	wet.gain.value = 0.35;
	const lp = c.createBiquadFilter();
	lp.type = "lowpass";
	lp.frequency.value = 2400;
	input.connect(lp).connect(E.musicGain!);
	lp.connect(dl);
	dl.connect(fb).connect(dl);
	dl.connect(wet).connect(E.musicGain!);
	nodes.push(input, dl, fb, wet, lp);
	return input;
}

function waves() {
	const c = E.ctx!;
	const len = c.sampleRate * 6;
	const buf = c.createBuffer(1, len, c.sampleRate);
	const d = buf.getChannelData(0);
	let last = 0;
	for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
	const src = c.createBufferSource();
	src.buffer = buf;
	src.loop = true;
	const lp = c.createBiquadFilter();
	lp.type = "lowpass";
	lp.frequency.value = 900;
	const g = c.createGain();
	g.gain.value = 0.45;
	const lfo = c.createOscillator();
	lfo.frequency.value = 0.09; // satu debur ±11 detik
	const lg = c.createGain();
	lg.gain.value = 0.4;
	lfo.connect(lg).connect(g.gain);
	src.connect(lp).connect(g).connect(E.musicGain!);
	src.start();
	lfo.start();
	nodes.push(src, lp, g, lfo, lg);
}

const AMB = [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]];
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
let bus: GainNode | null = null;
let walk = 4;
function soft(freq: number, start: number, attack: number, dur: number, vol: number, wave: OscillatorType = "sine") {
	const c = E.ctx!;
	const o = c.createOscillator(), g = c.createGain();
	o.type = wave;
	o.frequency.value = freq;
	g.gain.setValueAtTime(0.0001, start);
	g.gain.linearRampToValueAtTime(vol, start + attack);
	g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
	o.connect(g).connect(bus!);
	o.start(start);
	o.stop(start + dur + 0.05);
}
function scheduleSoft() {
	const c = E.ctx!;
	const piano = current === "piano";
	const beat = piano ? 60 / 72 / 2 : 4;
	while (nextTime < c.currentTime + 0.6) {
		const bar = Math.floor(step / (piano ? 8 : 1)) % 4;
		const chord = AMB[bar];
		if (piano) {
			const pos = step % 8;
			if (pos === 0) chord.slice(0, 3).forEach((k) => soft(N(k - 12), nextTime, 0.02, 3.2, 0.05, "triangle"));
			walk = Math.max(0, Math.min(PENTA.length - 1, walk + [-1, 0, 1, 1, -1, 2, -2][(step * 7 + bar) % 7]));
			if (pos % 2 === 0 || (step * 13) % 5 === 0) soft(N(PENTA[walk] + 12), nextTime, 0.01, 1.8, 0.07, "triangle");
		} else {
			chord.forEach((k, i) => soft(N(k), nextTime + i * 0.12, 1.6, beat * 1.9, 0.045, i % 2 ? "triangle" : "sine"));
			soft(N(chord[0] - 24), nextTime, 1.2, beat * 1.9, 0.06, "sine");
			if (step % 2 === 1) soft(N(chord[2] + 24), nextTime + beat / 2, 0.4, 2.5, 0.02, "sine");
		}
		nextTime += beat;
		step++;
	}
}

function schedule() {
	const c = E.ctx!;
	const lofi = current === "lofi";
	const bpm = lofi ? 78 : 132;
	const s16 = 60 / bpm / 4;
	while (nextTime < c.currentTime + 0.25) {
		const bar = Math.floor(step / 16) % 4, pos = step % 16;
		const chord = PROG[bar];
		const out = E.musicGain!;
		if (pos % 8 === 0) E.tone(N(chord[0] - 24), nextTime, s16 * (lofi ? 7 : 3.5), lofi ? "triangle" : "square", lofi ? 0.16 : 0.09, out);
		if (lofi) {
			if (pos % 4 === 2) E.tone(N(chord[(pos / 4) % 3 | 0] + 12), nextTime, s16 * 3, "triangle", 0.07, out);
			if (pos === 0 || pos === 10) E.tone(55, nextTime, 0.15, "sine", 0.22, out, 40);
			if (pos === 4 || pos === 12) E.noise(nextTime, 0.08, 0.06, out, 1500);
			if (pos % 2 === 0) E.noise(nextTime, 0.03, 0.02, out, 7000);
		} else {
			E.tone(N(chord[pos % 3] + 12), nextTime, s16 * 0.9, "square", 0.04, out);
			const m = MELODY[(step / 2 | 0) % MELODY.length];
			if (pos % 2 === 0 && m >= 0 && bar % 2 === 1) E.tone(N(m + 12), nextTime, s16 * 1.8, "square", 0.05, out);
			if (pos % 4 === 0) E.noise(nextTime, 0.04, 0.05, out, 6000);
			if (pos === 0 || pos === 8) E.tone(110, nextTime, 0.1, "sine", 0.2, out, 45);
		}
		nextTime += s16 * (lofi && pos % 2 === 1 ? 1.12 : lofi ? 0.88 : 1); // ayunan (swing) untuk lo-fi
		step++;
	}
}

export function playMusic(kind: MusicKind) {
	stopMusic();
	current = kind;
	if (kind === "off") return;
	const c = E.ensure();
	if (!c) return;
	if (kind === "white" || kind === "brown" || kind === "rain") return loopNoise(kind);
	if (kind === "waves") return waves();
	if (kind === "ambient" || kind === "piano") {
		bus = echoBus();
		nextTime = c.currentTime + 0.15;
		step = 0;
		walk = 4;
		timer = window.setInterval(scheduleSoft, 120);
		return;
	}
	nextTime = c.currentTime + 0.1;
	step = 0;
	timer = window.setInterval(schedule, 80);
}

export function stopMusic() {
	if (timer) window.clearInterval(timer);
	timer = null;
	for (const n of nodes) {
		try { (n as AudioBufferSourceNode).stop?.(); } catch { /* sudah berhenti */ }
		try { n.disconnect(); } catch { /* abaikan */ }
	}
	nodes = [];
	current = "off";
}

export const musicPlaying = () => current;
