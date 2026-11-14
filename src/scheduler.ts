import { CardState, Grade, Settings } from "./types";

export const MIN = 60_000;
export const DAY = 86_400_000;

export function startOfDay(t: number): number {
	const d = new Date(t);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}
export function endOfDay(t: number): number {
	const d = new Date(t);
	d.setHours(23, 59, 59, 999);
	return d.getTime();
}
export function dayKey(t: number): string {
	const d = new Date(t);
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(t: number, n: number): number {
	const d = new Date(t);
	d.setDate(d.getDate() + n);
	return d.getTime();
}

export function newState(s: Settings): CardState {
	return { due: 0, interval: 0, ease: s.startingEase, reps: 0, lapses: 0, history: [] };
}

export const isNewState = (st?: CardState) => !st || st.history.length === 0;

function nextEase(ease: number, g: Grade): number {
	return Math.max(1.3, ease + [-0.2, -0.15, 0, 0.15][g]);
}

// ================================================================ FSRS-4.5
/**
 * Free Spaced Repetition Scheduler (FSRS-4.5), bobot bawaan dari open-spaced-repetition.
 * Kurva lupa: R(t) = (1 + F·t/S)^(-0.5) dengan F = 19/81, sehingga R(S) = 90%.
 */
const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const clampD = (d: number) => Math.min(10, Math.max(1, d));
/** Peluang ingat setelah t hari dengan stabilitas S. */
export const forgetting = (tDays: number, S: number) => Math.pow(1 + (FACTOR * Math.max(0, tDays)) / Math.max(0.01, S), DECAY);
const d0 = (r: number) => clampD(W[4] - (r - 3) * W[5]);
const nextD = (d: number, r: number) => clampD(W[7] * W[4] + (1 - W[7]) * (d - W[6] * (r - 3)));
const sRecall = (d: number, s: number, R: number, r: number) =>
	s * (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * (r === 2 ? W[15] : 1) * (r === 4 ? W[16] : 1) + 1);
const sForget = (d: number, s: number, R: number) =>
	Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R)));

/** Hitung S & D baru untuk satu ulasan (g: 0=Lagi … 3=Mudah). */
function fsrsStep(prev: { s?: number; d?: number; t?: number } | null, g: Grade, now: number): { s: number; d: number } {
	const r = g + 1;
	if (!prev || prev.s === undefined || prev.d === undefined || prev.t === undefined) return { s: W[r - 1], d: d0(r) };
	const elapsed = (now - prev.t) / DAY;
	const R = forgetting(elapsed, prev.s);
	const d = nextD(prev.d, r);
	if (g === 0) return { s: Math.max(0.1, sForget(prev.d, prev.s, R)), d };
	// ulasan di hari yang sama tidak banyak menambah stabilitas
	if (elapsed < 0.5) return { s: Math.max(prev.s, r >= 3 ? prev.s * (1 + 0.1 * (r - 2)) : prev.s), d };
	return { s: sRecall(prev.d, prev.s, R, r), d };
}

/** Isi S & D dari riwayat lama (dipakai saat beralih dari SM-2). */
export function ensureFsrs(st: CardState): CardState {
	if (st.s !== undefined || !st.history.length) return st;
	let cur: { s?: number; d?: number; t?: number } | null = null;
	for (const h of st.history) {
		const n = fsrsStep(cur, h.g, h.t);
		cur = { ...n, t: h.t };
	}
	st.s = cur!.s;
	st.d = cur!.d;
	return st;
}

const ivlFromS = (S: number, s: Settings) =>
	Math.min(s.maxInterval, Math.max(1, Math.round((S / FACTOR) * (Math.pow(s.desiredRetention, 1 / DECAY) - 1))));

function fsrsIntervals(st: CardState | undefined, now: number, s: Settings): number[] {
	const last = st?.history[st.history.length - 1];
	const prev = st && last ? { s: st.s, d: st.d, t: last.t } : null;
	const ivl = ([0, 1, 2, 3] as Grade[]).map((g) => (g === 0 ? 0 : ivlFromS(fsrsStep(prev, g, now).s, s)));
	ivl[2] = Math.max(ivl[2], ivl[1] + (ivl[1] >= 1 && st?.history.length ? 1 : 0));
	ivl[3] = Math.max(ivl[3], ivl[2] + 1);
	return ivl.map((x) => Math.min(x, s.maxInterval));
}

// ================================================================ SM-2 (opsi lama)
function sm2Interval(st: CardState | undefined, g: Grade, s: Settings): number {
	if (g === 0) return 0;
	const prev = st?.interval ?? 0;
	if (!st || prev <= 0) return g === 3 ? 4 : 1;
	const good = Math.round(Math.max(prev * st.ease, prev + 1));
	let ivl: number;
	if (g === 1) ivl = Math.min(Math.round(Math.max(prev * 1.2, prev + 1)), good);
	else if (g === 2) ivl = good;
	else ivl = Math.max(Math.round(prev * st.ease * s.easyBonus), good + 1);
	return Math.min(ivl, s.maxInterval);
}

/** Interval berikutnya dalam hari (0 = ulang lagi ±10 menit). */
export function previewInterval(st: CardState | undefined, g: Grade, s: Settings): number {
	if (s.algorithm === "sm2") return sm2Interval(st, g, s);
	if (st) ensureFsrs(st);
	return fsrsIntervals(st, Date.now(), s)[g];
}

export function schedule(st: CardState | undefined, g: Grade, now: number, s: Settings): CardState {
	const base: CardState = st ? { ...st, history: [...st.history] } : newState(s);
	let ivl: number;
	if (s.algorithm === "sm2") ivl = sm2Interval(base, g, s);
	else {
		ensureFsrs(base);
		ivl = fsrsIntervals(base, now, s)[g];
		const last = base.history[base.history.length - 1];
		const n = fsrsStep(last ? { s: base.s, d: base.d, t: last.t } : null, g, now);
		base.s = n.s;
		base.d = n.d;
	}
	if (g === 0) {
		if (base.history.length > 0) base.lapses++;
		base.reps = 0;
	} else base.reps++;
	base.ease = nextEase(base.ease, g);
	base.interval = ivl;
	base.due = g === 0 ? now + 10 * MIN : addDays(startOfDay(now), ivl);
	base.history.push({ t: now, g, i: ivl });
	if (base.history.length > 200) base.history = base.history.slice(-200);
	return base;
}

/** Peluang ingat setelah sekian waktu, dengan stabilitas ≈ interval (kurva FSRS). */
export const stability = (intervalDays: number) => (intervalDays > 0 ? intervalDays : 0.1);
export const recall = (elapsedMs: number, intervalDays: number) => forgetting(Math.max(0, elapsedMs) / DAY, stability(intervalDays));

export function retention(st: CardState | undefined, at: number): number | null {
	if (!st || !st.history.length) return null;
	const last = st.history[st.history.length - 1];
	if (st.s !== undefined && st.history[st.history.length - 1].g > 0) return forgetting((at - last.t) / DAY, st.s);
	return recall(at - last.t, st.interval);
}

export function formatInterval(days: number): string {
	if (days <= 0) return "10 mnt";
	if (days < 30) return `${days} hari`;
	if (days < 365) return `${(days / 30).toFixed(1).replace(".0", "")} bln`;
	return `${(days / 365).toFixed(1).replace(".0", "")} thn`;
}

export function formatDuration(ms: number): string {
	const sec = Math.round(ms / 1000);
	const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
	if (h) return `${h} j ${m} m`;
	return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDue(due: number): string {
	const d = Math.round((startOfDay(due) - startOfDay(Date.now())) / DAY);
	if (d < 0) return `telat ${-d} hari`;
	if (d === 0) return "hari ini";
	if (d === 1) return "besok";
	if (d < 30) return `${d} hari lagi`;
	if (d < 365) return `${Math.round(d / 30)} bln lagi`;
	return `${(d / 365).toFixed(1).replace(".0", "")} thn lagi`;
}
