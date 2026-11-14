import { CardState, DailyStat } from "./types";
import { DAY, addDays, dayKey, recall, startOfDay } from "./scheduler";

const NS = "http://www.w3.org/2000/svg";
type Attrs = Record<string, string | number>;

function s(tag: string, attrs: Attrs, parent?: Element, text?: string): SVGElement {
	const el = document.createElementNS(NS, tag);
	for (const k in attrs) el.setAttribute(k, String(attrs[k]));
	if (text !== undefined) el.textContent = text;
	parent?.appendChild(el);
	return el;
}

const GRADE_NAME = ["Lagi", "Sulit", "Baik", "Mudah"];
const fmtDate = (t: number) =>
	new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

/**
 * Kurva memori satu kartu: grafik "gigi gergaji" Ebbinghaus.
 * Tiap ulasan mengembalikan ingatan ke 100%, lalu meluruh makin lambat.
 * Sumbu waktu memakai skala akar agar ulasan awal tetap terlihat.
 */
export function memoryCurve(parent: HTMLElement, st: CardState): void {
	const h = st.history;
	if (!h.length) return;
	const W = 520, H = 170, L = 36, R = 12, T = 12, B = 26;
	const now = Date.now();
	const t0 = h[0].t;
	const span = Math.max(st.interval, 0.5) * DAY;
	const tEnd = Math.max(now + span * 0.6, st.due + span * 0.35, t0 + DAY);
	const x = (t: number) => L + Math.sqrt(Math.max(0, (t - t0) / (tEnd - t0))) * (W - L - R);
	const y = (r: number) => T + (1 - r) * (H - T - B);

	const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "fc-chart fc-curve", role: "img" }, parent);
	s("title", {}, svg, "Kurva memori kartu");
	for (const r of [0, 0.5, 1]) {
		s("line", { x1: L, x2: W - R, y1: y(r), y2: y(r), class: "fc-grid" }, svg);
		s("text", { x: L - 6, y: y(r) + 4, class: "fc-axis", "text-anchor": "end" }, svg, `${r * 100}%`);
	}
	s("line", { x1: L, x2: W - R, y1: y(0.9), y2: y(0.9), class: "fc-target" }, svg);
	s("text", { x: W - R, y: y(0.9) - 4, class: "fc-axis", "text-anchor": "end" }, svg, "target 90%");

	const sample = (from: number, to: number, start: number, ivl: number) => {
		const pts: [number, number][] = [];
		const n = 36;
		for (let k = 0; k <= n; k++) {
			const t = from + ((to - from) * k) / n;
			pts.push([x(t), y(recall(t - start, ivl))]);
		}
		return pts;
	};
	const line = (pts: [number, number][]) => "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L");

	for (let k = 0; k < h.length; k++) {
		const start = h[k].t;
		const end = k + 1 < h.length ? h[k + 1].t : tEnd;
		const solidEnd = Math.min(end, now);
		if (solidEnd > start) {
			const pts = sample(start, solidEnd, start, h[k].i);
			const area = line(pts) + `L${pts[pts.length - 1][0]},${y(0)}L${pts[0][0]},${y(0)}Z`;
			s("path", { d: area, class: "fc-curve-area" }, svg);
			s("path", { d: line(pts), class: "fc-curve-line" }, svg);
		}
		if (end > now) {
			const pts = sample(Math.max(start, now), end, start, h[k].i);
			s("path", { d: line(pts), class: "fc-curve-future" }, svg);
		}
		if (k + 1 < h.length) {
			const xr = x(end);
			s("line", { x1: xr, x2: xr, y1: y(recall(end - start, h[k].i)), y2: y(1), class: "fc-curve-jump" }, svg);
		}
	}
	h.forEach((rv, k) => {
		const r = k === 0 ? 1 : recall(rv.t - h[k - 1].t, h[k - 1].i);
		const c = s("circle", { cx: x(rv.t), cy: y(r), r: 4, class: `fc-dot fc-g${rv.g}` }, svg);
		s("title", {}, c, `${fmtDate(rv.t)} · ${GRADE_NAME[rv.g]} · ingatan ±${Math.round(r * 100)}%`);
	});

	const xn = x(now);
	s("line", { x1: xn, x2: xn, y1: T, y2: H - B, class: "fc-now" }, svg);
	s("text", { x: xn, y: H - 8, class: "fc-axis fc-axis-now", "text-anchor": "middle" }, svg, "sekarang");
	s("text", { x: L, y: H - 8, class: "fc-axis", "text-anchor": "start" }, svg, fmtDate(t0));
	if (st.due > now + DAY / 2) {
		const xd = x(st.due);
		s("path", { d: `M${xd},${y(0.9) - 6}l5,6l-5,6l-5,-6z`, class: "fc-due-mark" }, svg);
		if (xd - xn > 60) s("text", { x: xd, y: H - 8, class: "fc-axis", "text-anchor": "middle" }, svg, fmtDate(st.due));
	}
}

/** Prediksi retensi rata-rata semua kartu bila tidak belajar lagi. */
export function retentionForecast(parent: HTMLElement, states: CardState[], days = 30): void {
	const W = 520, H = 170, L = 36, R = 12, T = 12, B = 26;
	const now = Date.now();
	const reviewed = states.filter((st) => st.history.length);
	const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "fc-chart", role: "img" }, parent);
	const x = (d: number) => L + (d / days) * (W - L - R);
	const y = (r: number) => T + (1 - r) * (H - T - B);
	for (const r of [0, 0.5, 1]) {
		s("line", { x1: L, x2: W - R, y1: y(r), y2: y(r), class: "fc-grid" }, svg);
		s("text", { x: L - 6, y: y(r) + 4, class: "fc-axis", "text-anchor": "end" }, svg, `${r * 100}%`);
	}
	if (!reviewed.length) {
		s("text", { x: W / 2, y: H / 2, class: "fc-axis", "text-anchor": "middle" }, svg, "Belum ada kartu yang diulas");
		return;
	}
	const pts: [number, number][] = [];
	for (let d = 0; d <= days; d += 0.5) {
		const at = now + d * DAY;
		let sum = 0;
		for (const st of reviewed) sum += recall(at - st.history[st.history.length - 1].t, st.interval);
		pts.push([x(d), y(sum / reviewed.length)]);
	}
	const d = "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L");
	s("path", { d: d + `L${x(days)},${y(0)}L${x(0)},${y(0)}Z`, class: "fc-curve-area" }, svg);
	s("path", { d, class: "fc-curve-line" }, svg);
	for (const dd of [0, 7, 14, 21, 30].filter((v) => v <= days)) {
		s("text", { x: x(dd), y: H - 8, class: "fc-axis", "text-anchor": "middle" }, svg, dd === 0 ? "hari ini" : `+${dd} hr`);
	}
	const endR = 1 - (pts[pts.length - 1][1] - T) / (H - T - B);
	s("text", { x: W - R, y: pts[pts.length - 1][1] - 8, class: "fc-axis fc-axis-strong", "text-anchor": "end" }, svg, `${Math.round(endR * 100)}%`);
}

/** Heatmap aktivitas ulasan (gaya kalender kontribusi). */
export function heatmap(parent: HTMLElement, daily: Record<string, DailyStat>, weeks = 22): void {
	const C = 12, G = 3, L = 28, T = 16;
	const today = startOfDay(Date.now());
	const dow = new Date(today).getDay();
	const start = addDays(today, -((weeks - 1) * 7 + dow));
	const W = L + weeks * (C + G), H = T + 7 * (C + G);
	const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "fc-chart fc-heatmap", role: "img" }, parent);
	let max = 1;
	for (const v of Object.values(daily)) max = Math.max(max, v.reviews);
	["", "Sen", "", "Rab", "", "Jum", ""].forEach((d, i) => {
		if (d) s("text", { x: L - 6, y: T + i * (C + G) + C - 2, class: "fc-axis", "text-anchor": "end" }, svg, d);
	});
	let lastMonth = -1;
	for (let w = 0; w < weeks; w++) {
		for (let d = 0; d < 7; d++) {
			const t = addDays(start, w * 7 + d);
			if (t > today) continue;
			const dt = new Date(t);
			if (d === 0 && dt.getMonth() !== lastMonth) {
				lastMonth = dt.getMonth();
				s("text", { x: L + w * (C + G), y: T - 5, class: "fc-axis" }, svg, dt.toLocaleDateString("id-ID", { month: "short" }));
			}
			const n = daily[dayKey(t)]?.reviews ?? 0;
			const lvl = n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
			const r = s("rect", { x: L + w * (C + G), y: T + d * (C + G), width: C, height: C, rx: 3, class: `fc-heat fc-heat-${lvl}` }, svg);
			s("title", {}, r, `${fmtDate(t)}: ${n} ulasan`);
		}
	}
}

/** Diagram batang jumlah kartu jatuh tempo per hari. */
export function forecastBars(parent: HTMLElement, counts: number[]): void {
	const W = 520, H = 160, L = 8, R = 8, T = 18, B = 24;
	const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "fc-chart", role: "img" }, parent);
	const max = Math.max(1, ...counts);
	const bw = (W - L - R) / counts.length;
	counts.forEach((c, i) => {
		const h = (c / max) * (H - T - B);
		const xx = L + i * bw + 3;
		s("rect", { x: xx, y: H - B - h, width: bw - 6, height: Math.max(h, 1), rx: 3, class: i === 0 ? "fc-bar fc-bar-today" : "fc-bar" }, svg);
		if (c) s("text", { x: xx + (bw - 6) / 2, y: H - B - h - 4, class: "fc-axis", "text-anchor": "middle" }, svg, String(c));
		const lbl = i === 0 ? "Hari ini" : i % 2 === 0 ? `+${i}` : "";
		if (lbl) s("text", { x: xx + (bw - 6) / 2, y: H - 7, class: "fc-axis", "text-anchor": "middle" }, svg, lbl);
	});
}

/** Batang volume + garis akurasi (30 hari). */
export function trendChart(parent: HTMLElement, days: { label: string; n: number; acc: number | null }[]): void {
	const W = 640, H = 190, L = 30, R = 30, T = 14, B = 24;
	const svgEl = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "fc-chart", role: "img" }, parent);
	const max = Math.max(1, ...days.map((d) => d.n));
	const bw = (W - L - R) / days.length;
	const y = (v: number) => T + (1 - v) * (H - T - B);
	for (const r of [0, 0.5, 1]) s("line", { x1: L, x2: W - R, y1: y(r), y2: y(r), class: "fc-grid" }, svgEl);
	s("text", { x: L - 6, y: y(1) + 4, class: "fc-axis", "text-anchor": "end" }, svgEl, String(max));
	s("text", { x: W - R + 6, y: y(1) + 4, class: "fc-axis" }, svgEl, "100%");
	s("text", { x: W - R + 6, y: y(0.5) + 4, class: "fc-axis" }, svgEl, "50%");
	days.forEach((d, i) => {
		const h = (d.n / max) * (H - T - B);
		const r = s("rect", { x: L + i * bw + 1.5, y: H - B - h, width: Math.max(1, bw - 3), height: Math.max(h, d.n ? 1 : 0), rx: 2, class: "fc-bar" }, svgEl);
		s("title", {}, r, `${d.label}: ${d.n} ulasan${d.acc !== null ? `, akurasi ${Math.round(d.acc * 100)}%` : ""}`);
		if (i % 5 === 0 || i === days.length - 1) s("text", { x: L + i * bw + bw / 2, y: H - 7, class: "fc-axis", "text-anchor": "middle" }, svgEl, d.label);
	});
	const pts = days.map((d, i) => (d.acc === null ? null : [L + i * bw + bw / 2, y(d.acc)])).filter((p): p is number[] => !!p);
	if (pts.length > 1) s("path", { d: "M" + pts.map((p) => p.join(",")).join("L"), class: "fc-acc-line" }, svgEl);
	pts.forEach((p) => s("circle", { cx: p[0], cy: p[1], r: 2.5, class: "fc-acc-dot" }, svgEl));
}

/** Dua garis: prediksi model vs kenyataan per kelompok. */
export function compareChart(parent: HTMLElement, buckets: { label: string; predicted: number; actual: number; n: number }[]): void {
	const W = 640, H = 200, L = 36, R = 14, T = 14, B = 26;
	const svgEl = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "fc-chart", role: "img" }, parent);
	const y = (v: number) => T + (1 - v) * (H - T - B);
	for (const r of [0, 0.5, 0.9, 1]) {
		s("line", { x1: L, x2: W - R, y1: y(r), y2: y(r), class: r === 0.9 ? "fc-target" : "fc-grid" }, svgEl);
		s("text", { x: L - 6, y: y(r) + 4, class: "fc-axis", "text-anchor": "end" }, svgEl, `${r * 100}%`);
	}
	const step = (W - L - R) / Math.max(1, buckets.length - 1);
	const x = (i: number) => L + i * step;
	const line = (key: "predicted" | "actual", cls: string) => {
		const pts = buckets.map((b, i) => (b.n ? [x(i), y(b[key])] : null)).filter((p): p is number[] => !!p);
		if (pts.length > 1) s("path", { d: "M" + pts.map((p) => p.join(",")).join("L"), class: cls }, svgEl);
		pts.forEach((p) => s("circle", { cx: p[0], cy: p[1], r: 4, class: cls + "-dot" }, svgEl));
	};
	line("predicted", "fc-pred");
	line("actual", "fc-act");
	buckets.forEach((b, i) => {
		s("text", { x: x(i), y: H - 9, class: "fc-axis", "text-anchor": "middle" }, svgEl, b.label);
		if (b.n) s("text", { x: x(i), y: y(b.actual) - 9, class: "fc-axis fc-axis-strong", "text-anchor": "middle" }, svgEl, `${Math.round(b.actual * 100)}%`);
	});
}

/** 24 batang jam, warna menurut akurasi. */
export function hourChart(parent: HTMLElement, hours: { n: number; ok: number }[]): void {
	const W = 640, H = 150, L = 10, R = 10, T = 10, B = 22;
	const svgEl = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "fc-chart", role: "img" }, parent);
	const max = Math.max(1, ...hours.map((h) => h.n));
	const bw = (W - L - R) / 24;
	hours.forEach((h, i) => {
		const hh = (h.n / max) * (H - T - B);
		const acc = h.n ? h.ok / h.n : 0;
		const r = s("rect", { x: L + i * bw + 2, y: H - B - hh, width: bw - 4, height: Math.max(hh, h.n ? 2 : 0), rx: 3, fill: !h.n ? "transparent" : acc >= 0.9 ? "#2f9e66" : acc >= 0.75 ? "#84b62f" : acc >= 0.6 ? "#e8902a" : "#e5484d" }, svgEl);
		s("title", {}, r, `${String(i).padStart(2, "0")}.00: ${h.n} ulasan${h.n ? `, akurasi ${Math.round(acc * 100)}%` : ""}`);
		if (i % 3 === 0) s("text", { x: L + i * bw + bw / 2, y: H - 6, class: "fc-axis", "text-anchor": "middle" }, svgEl, String(i).padStart(2, "0"));
	});
}
