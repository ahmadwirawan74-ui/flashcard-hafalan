import { Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { StudyBlock } from "./types";
import { DAY, dayKey, retention } from "./scheduler";
import { basename, btn } from "./util";
import { play } from "./sound";

const WINDOW = 2; // jam emas = rentang 2 jam
const MIN_TOTAL = 40;
const hh = (h: number) => `${String(((h % 24) + 24) % 24).padStart(2, "0")}:00`;
const range = (h: number) => `${hh(h)}–${hh(h + WINDOW)}`;

export interface Golden {
	total: number;
	n: number[];
	ok: number[];
	acc: (number | null)[];
	mean: number;
	best: { h: number; acc: number; n: number } | null;
	worst: { h: number; acc: number; n: number } | null;
	parts: { label: string; icon: string; from: number; to: number; n: number; acc: number | null }[];
}

/** Akurasi per jam dari riwayat ulasan (90 hari terakhir), dengan pemulusan agar jam yang datanya sedikit tidak menipu. */
export function analyze(p: FlashcardPlugin, days = 90): Golden {
	const since = Date.now() - days * DAY;
	const n = new Array(24).fill(0), ok = new Array(24).fill(0);
	for (const st of Object.values(p.data.cards)) {
		for (const h of st.history ?? []) {
			if (h.t < since) continue;
			const hr = new Date(h.t).getHours();
			n[hr]++;
			if (h.g > 0) ok[hr]++;
		}
	}
	const total = n.reduce((a, x) => a + x, 0);
	const mean = total ? ok.reduce((a, x) => a + x, 0) / total : 0;
	const K = 8; // kekuatan pemulusan
	const acc = n.map((x, i) => (x ? (ok[i] + mean * K) / (x + K) : null));
	const minN = Math.max(8, Math.round(total * 0.04));
	let best: { h: number; acc: number; n: number; lo: number } | null = null, worst: { h: number; acc: number; n: number; hi: number } | null = null;
	// lintasan pertama: kedua jam di jendela harus punya data; bila tidak ada, longgarkan
	for (const strict of [true, false]) {
		for (let h = 0; h < 24; h++) {
			let wn = 0, wok = 0, empty = false;
			for (let k = 0; k < WINDOW; k++) { const x = (h + k) % 24; wn += n[x]; wok += ok[x]; if (!n[x]) empty = true; }
			if (wn < minN || (strict && empty)) continue;
			const a = (wok + mean * K) / (wn + K);
			// utamakan jendela yang buktinya lebih banyak: batas bawah (terbaik) / batas atas (terlemah) keyakinan
			const se = Math.sqrt(Math.max(0.0025, a * (1 - a)) / wn);
			if (!best || a - se > best.lo) best = { h, acc: a, n: wn, lo: a - se };
			if (!worst || a + se < worst.hi) worst = { h, acc: a, n: wn, hi: a + se };
		}
		if (best) break;
	}
	const PARTS: [string, string, number, number][] = [["Dini hari", "🌌", 0, 4], ["Ba'da Subuh", "🌅", 4, 7], ["Pagi", "☀️", 7, 11], ["Siang", "🌤️", 11, 15], ["Sore", "🌇", 15, 18], ["Malam", "🌙", 18, 21], ["Larut malam", "🦉", 21, 24]];
	const parts = PARTS.map(([label, icon, from, to]) => {
		let pn = 0, pok = 0;
		for (let h = from; h < to; h++) { pn += n[h]; pok += ok[h]; }
		return { label, icon, from, to, n: pn, acc: pn ? (pok + mean * K) / (pn + K) : null };
	});
	return { total, n, ok, acc, mean, best: total >= MIN_TOTAL ? best : null, worst: total >= MIN_TOTAL && worst && best && worst.h !== best.h ? worst : null, parts };
}

/** Sekarang termasuk jam emas? */
export function inGolden(p: FlashcardPlugin): boolean {
	const g = analyze(p);
	if (!g.best) return false;
	const h = new Date().getHours();
	return ((h - g.best.h + 24) % 24) < WINDOW;
}

/** Materi tersulit: ingatan rata-rata rendah & sering lupa. */
export function hardest(p: FlashcardPlugin, k = 5) {
	const now = Date.now();
	const out: { path: string; ret: number; lapses: number; score: number; n: number }[] = [];
	for (const path of p.sortedPaths()) {
		let s = 0, c = 0, lap = 0;
		for (const card of p.index.get(path) ?? []) {
			const st = p.data.cards[card.id];
			const r = retention(st, now);
			if (r === null) continue;
			s += r; c++; lap += st?.lapses ?? 0;
		}
		if (c < 3) continue;
		const ret = s / c;
		out.push({ path, ret, lapses: lap / c, n: c, score: (1 - ret) + Math.min(1, lap / c) * 0.3 });
	}
	return out.sort((a, b) => b.score - a.score).slice(0, k);
}

const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);
const fromMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
/** Jam mulai di dalam jam emas yang tidak bertabrakan dengan jadwal lain pada hari yang sama. */
function freeSlot(p: FlashcardPlugin, start: number, dur: number, days: number[], skipId?: string): string {
	for (let m = start * 60; m <= (start + WINDOW) * 60 - Math.min(dur, 30); m += 15) {
		const clash = p.data.blocks.some((b) => b.id !== skipId && (b.days.some((d) => days.includes(d)) || (!b.days.length && !days.length)) && m < toMin(b.time) + b.duration && toMin(b.time) < m + dur);
		if (!clash) return fromMin(m);
	}
	return fromMin(start * 60);
}

// ---------------------------------------------------------------- tampilan
function clock(parent: HTMLElement, g: Golden) {
	const NS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("viewBox", "-110 -110 220 220");
	svg.setAttribute("class", "fch-gold-clock");
	const maxN = Math.max(1, ...g.n);
	const col = (a: number | null) => {
		if (a === null) return "var(--fch-line)";
		const d = a - g.mean;
		return d > 0.06 ? "#f59e0b" : d > 0.02 ? "#84cc16" : d > -0.02 ? "#22c55e" : d > -0.06 ? "#fb923c" : "#ef4444";
	};
	for (let h = 0; h < 24; h++) {
		const a0 = ((h / 24) * 360 - 90) * (Math.PI / 180), a1 = (((h + 1) / 24) * 360 - 90) * (Math.PI / 180);
		const r0 = 38, r1 = 38 + 8 + Math.sqrt(g.n[h] / maxN) * 54;
		const path = document.createElementNS(NS, "path");
		const pt = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
		path.setAttribute("d", `M ${pt(r0, a0 + 0.02)} L ${pt(r1, a0 + 0.02)} A ${r1} ${r1} 0 0 1 ${pt(r1, a1 - 0.02)} L ${pt(r0, a1 - 0.02)} A ${r0} ${r0} 0 0 0 ${pt(r0, a0 + 0.02)} Z`);
		const best = g.best && ((h - g.best.h + 24) % 24) < WINDOW;
		path.setAttribute("fill", col(g.acc[h]));
		path.setAttribute("class", "fch-gold-wedge" + (best ? " is-best" : ""));
		path.style.animationDelay = `${h * 12}ms`;
		const t = document.createElementNS(NS, "title");
		t.textContent = `${hh(h)}–${hh(h + 1)} · ${g.n[h]} ulasan${g.acc[h] !== null ? ` · akurasi ${Math.round(g.acc[h]! * 100)}%` : ""}`;
		path.appendChild(t);
		svg.appendChild(path);
		if (h % 3 === 0) {
			const lab = document.createElementNS(NS, "text");
			const am = ((h / 24) * 360 - 90) * (Math.PI / 180);
			lab.setAttribute("x", String(28 * Math.cos(am)));
			lab.setAttribute("y", String(28 * Math.sin(am) + 3));
			lab.setAttribute("class", "fch-gold-lab");
			lab.textContent = String(h);
			svg.appendChild(lab);
		}
	}
	// jarum jam sekarang
	const now = new Date();
	const an = (((now.getHours() + now.getMinutes() / 60) / 24) * 360 - 90) * (Math.PI / 180);
	const hand = document.createElementNS(NS, "line");
	hand.setAttribute("x1", "0"); hand.setAttribute("y1", "0");
	hand.setAttribute("x2", String(104 * Math.cos(an))); hand.setAttribute("y2", String(104 * Math.sin(an)));
	hand.setAttribute("class", "fch-gold-hand");
	svg.appendChild(hand);
	const dot = document.createElementNS(NS, "circle");
	dot.setAttribute("r", "4"); dot.setAttribute("class", "fch-gold-dot");
	svg.appendChild(dot);
	parent.appendChild(svg);
}

export function renderGolden(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const g = analyze(p);
	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "☀️ Jam Emas Belajar" });
	head.createDiv({ cls: "fch-muted", text: "Kapan otakmu paling tajam? Dihitung dari jawaban benar-salah semua ulasan kartu 90 hari terakhir, lalu dipakai untuk menempatkan materi tersulit di jam terbaikmu." });

	const hero = el.createDiv("fch-gold-hero" + (g.best ? "" : " is-empty"));
	const l = hero.createDiv("fch-gold-hero-l");
	if (g.best) {
		const now = new Date().getHours();
		const live = ((now - g.best.h + 24) % 24) < WINDOW;
		l.createDiv({ cls: "fch-gold-k", text: live ? "✨ SEKARANG JAM EMASMU!" : "Jam emasmu" });
		l.createDiv({ cls: "fch-gold-t", text: range(g.best.h) });
		l.createDiv({ cls: "fch-gold-s", text: `Akurasi ${Math.round(g.best.acc * 100)}% · ${Math.round((g.best.acc - g.mean) * 100) >= 0 ? "+" : ""}${Math.round((g.best.acc - g.mean) * 100)} poin dari rata-ratamu (${Math.round(g.mean * 100)}%) · ${g.best.n} ulasan` });
		if (g.worst) l.createDiv({ cls: "fch-gold-s fch-gold-worst", text: `⚠️ Jam terlemah: ${range(g.worst.h)} (akurasi ${Math.round(g.worst.acc * 100)}%). Pakai untuk ulasan ringan saja.` });
		const r = l.createDiv("fch-row fch-mt");
		if (live) btn(r, { text: "Pelajari materi tersulit sekarang", icon: "play", cls: "fch-btn-primary fch-btn-lg", onClick: () => { const hd = hardest(p, 3).flatMap((x) => p.index.get(x.path) ?? []); if (hd.length) hub.startSession(hd, { title: "Jam Emas · materi tersulit", cram: !p.buildQueue(hd, false).length, mode: p.data.settings.defaultMode }); else new Notice("Belum ada materi yang cukup dipelajari."); } });
	} else {
		l.createDiv({ cls: "fch-gold-k", text: "Mengumpulkan data…" });
		l.createDiv({ cls: "fch-gold-t", text: `${g.total}/${MIN_TOTAL} ulasan` });
		l.createDiv({ cls: "fch-gold-s", text: "Jam emas muncul setelah minimal 40 ulasan yang tersebar di beberapa jam. Coba belajar di waktu yang berbeda-beda (pagi, siang, malam) supaya hasilnya akurat." });
		const bar = l.createDiv("fch-bar fch-mt");
		bar.createDiv("fch-bar-fill").style.width = `${Math.min(100, (g.total / MIN_TOTAL) * 100)}%`;
	}
	const cl = hero.createDiv("fch-gold-hero-r");
	clock(cl, g);
	const leg = cl.createDiv("fch-gold-legend");
	for (const [c, t] of [["#f59e0b", "jauh di atas rata-rata"], ["#22c55e", "rata-rata"], ["#ef4444", "di bawah rata-rata"]]) { const x = leg.createSpan(); x.createSpan({ cls: "fch-gold-sw", attr: { style: `background:${c}` } }); x.appendChild(document.createTextNode(t)); }
	cl.createDiv({ cls: "fch-small fch-muted fch-center", text: "Panjang irisan = banyaknya ulasan pada jam itu" });

	// ---- bagian hari
	const pp = el.createDiv("fch-panel fch-mt");
	pp.createEl("h3", { text: "🕰️ Akurasi per bagian hari" });
	const bars = pp.createDiv("fch-gold-parts");
	const maxA = Math.max(0.01, ...g.parts.map((x) => x.acc ?? 0));
	for (const x of g.parts) {
		const c = bars.createDiv("fch-gold-part" + (x.acc !== null && g.best && x.from <= g.best.h && g.best.h < x.to ? " is-best" : ""));
		c.createDiv({ cls: "fch-gold-pv", text: x.acc === null ? "—" : `${Math.round(x.acc * 100)}%` });
		const col = c.createDiv("fch-gold-pbar");
		col.createDiv().style.height = `${x.acc === null ? 0 : Math.max(6, (x.acc / maxA) * 100)}%`;
		c.createDiv({ cls: "fch-gold-pi", text: x.icon });
		c.createDiv({ cls: "fch-small fch-strong", text: x.label });
		c.createDiv({ cls: "fch-small fch-muted", text: `${hh(x.from)}–${hh(x.to)} · ${x.n}×` });
	}

	if (!g.best) return;
	const best = g.best;
	// ---- materi tersulit
	const hd = hardest(p);
	const hp = el.createDiv("fch-panel fch-mt");
	const hh2 = hp.createDiv("fch-section-head");
	hh2.createEl("h3", { text: "🧗 Materi tersulit → jam emas" });
	if (hd.length) btn(hh2, { text: `Jadwalkan ${Math.min(3, hd.length)} teratas di jam emas`, icon: "calendar-plus", cls: "fch-btn-primary fch-btn-sm", onClick: () => {
		const today = dayKey(Date.now());
		let made = 0;
		for (const x of hd.slice(0, 3)) {
			if (p.data.blocks.some((b) => b.target === "file:" + x.path)) continue;
			const days = [0, 1, 2, 3, 4, 5, 6];
			const b: StudyBlock = { id: "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: "cards", target: "file:" + x.path, title: "", days, time: freeSlot(p, best.h, 20, days), duration: 20, remind: true, created: today, log: {} };
			p.data.blocks.push(b);
			made++;
		}
		p.requestSave();
		play("coin");
		new Notice(made ? `☀️ ${made} jadwal belajar dibuat di jam emas (${range(best.h)}).` : "Materi-materi ini sudah punya jadwal. Geser jadwalnya lewat daftar di bawah.");
		hub.renderPage();
	} });
	if (!hd.length) hp.createDiv({ cls: "fch-muted fch-small", text: "Belum ada materi dengan minimal 3 kartu yang sudah dipelajari." });
	for (const x of hd) {
		const r = hp.createDiv("fch-gold-hard");
		r.createDiv({ cls: "fch-gold-hard-ic", text: x.ret < 0.7 ? "🔥" : "📘" });
		const t = r.createDiv("fch-grow");
		t.createDiv({ cls: "fch-strong", text: basename(x.path) });
		t.createDiv({ cls: "fch-small fch-muted", text: `ingatan ${Math.round(x.ret * 100)}% · rata-rata ${x.lapses.toFixed(1)}× lupa per kartu · ${x.n} kartu` });
		const bar = r.createDiv("fch-gold-hbar");
		bar.createDiv().style.width = `${Math.round(x.ret * 100)}%`;
	}

	// ---- geser jadwal
	const bp = el.createDiv("fch-panel fch-mt");
	bp.createEl("h3", { text: "📅 Jadwal belajarmu vs jam emas" });
	const blocks = p.data.blocks.filter((b) => ["cards", "ziyadah", "murajaah", "hadits"].includes(b.kind));
	if (!blocks.length) bp.createDiv({ cls: "fch-muted fch-small", text: "Belum ada jadwal belajar. Buat lewat Rencana → Jadwal belajar, atau tombol di atas." });
	const hardSet = new Set(hd.map((x) => "file:" + x.path));
	for (const b of blocks.sort((a, c) => a.time.localeCompare(c.time))) {
		const h = parseInt(b.time.slice(0, 2), 10);
		const a = g.acc[h];
		const inG = ((h - best.h + 24) % 24) < WINDOW;
		const r = bp.createDiv("fch-gold-block" + (inG ? " is-in" : ""));
		r.createSpan({ cls: "fch-block-time", text: b.time });
		const t = r.createDiv("fch-grow");
		const name = b.title || (b.target.startsWith("file:") ? basename(b.target.slice(5)) : b.target === "all" ? "Semua kartu jatuh tempo" : b.kind);
		t.createDiv({ cls: "fch-strong", text: name + (hardSet.has(b.target) ? " 🔥" : "") });
		t.createDiv({ cls: "fch-small fch-muted", text: inG ? "✨ Sudah di jam emas" : a === null ? "Belum ada data untuk jam ini" : `Akurasi jam ini ${Math.round(a * 100)}% (jam emas ${Math.round(best.acc * 100)}%)` });
		if (!inG) btn(r, { text: "Geser ke jam emas", icon: "sun", cls: "fch-btn-sm" + (hardSet.has(b.target) ? " fch-btn-primary" : ""), onClick: () => {
			const old = b.time;
			b.time = freeSlot(p, best.h, b.duration, b.days, b.id);
			b.reminded = undefined;
			p.requestSave();
			play("click");
			new Notice(`☀️ ${name}: ${old} → ${b.time}`);
			hub.renderPage();
		} });
	}
	el.createDiv({ cls: "fch-muted fch-small fch-mt", text: "Tips: materi baru dan tersulit cocok di jam emas; ulasan ringan dan kuis cocok di jam yang lebih lemah. Hasil akan berubah mengikuti kebiasaan belajarmu." });
}
