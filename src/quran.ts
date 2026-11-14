import { Component, Notice } from "obsidian";
import { gunzipSync, strFromU8 } from "fflate";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import type { Game } from "./match";
import { Grade, QuranState } from "./types";
import { JUZ, PAGE, SAJDA, SURAH, TEXT_GZ } from "./quran-data";
import { DAY, addDays, dayKey, endOfDay, formatInterval, previewInterval, schedule, startOfDay } from "./scheduler";
import { btn, confetti, ring } from "./util";
import { play } from "./sound";

// ================================================================ data
let ROWS: [string, string][] | null = null;
/** [teks Arab, terjemahan] untuk ayat global 1–6236 (indeks g-1). Didekompresi sekali saat pertama dipakai. */
export function rows(): [string, string][] {
	if (!ROWS) {
		const bin = atob(TEXT_GZ);
		const u8 = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
		ROWS = JSON.parse(strFromU8(gunzipSync(u8)));
	}
	return ROWS!;
}
export const TOTAL = 6236;
const START: number[] = [0];
{ let acc = 1; for (let i = 0; i < 114; i++) { START.push(acc); acc += SURAH[i][4]; } }
export const gid = (s: number, a: number) => START[s] + a - 1;
export function fromGid(g: number): [number, number] {
	let lo = 1, hi = 114;
	while (lo < hi) { const m = (lo + hi + 1) >> 1; if (START[m] <= g) lo = m; else hi = m - 1; }
	return [lo, g - START[lo] + 1];
}
const idxIn = (arr: number[], g: number) => { let lo = 0, hi = arr.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= g) lo = m; else hi = m - 1; } return lo; };
export const juzOf = (g: number) => idxIn(JUZ, g) + 1;
export const pageOf = (g: number) => idxIn(PAGE, g) + 1;
const ayatInPage = (pg: number) => PAGE[pg] - PAGE[pg - 1];
const SAJDA_SET = new Set(SAJDA);
const AR = "٠١٢٣٤٥٦٧٨٩";
export const arNum = (n: number) => String(n).replace(/\d/g, (d) => AR[+d]);
export const sName = (s: number) => SURAH[s - 1][1];
export const ref = (g: number) => { const [s, a] = fromGid(g); return `${sName(s)} ${s}:${a}`; };
const BASMALAH = "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ";
const normAr = (t: string) => t.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "").replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();

export const QARI: { id: string; name: string }[] = [
	{ id: "Alafasy_128kbps", name: "Mishary Rasyid Alafasy" },
	{ id: "Husary_Muallim_128kbps", name: "Al-Husary (Mu'allim, untuk belajar)" },
	{ id: "Husary_128kbps", name: "Mahmoud Khalil Al-Husary" },
	{ id: "Abdul_Basit_Murattal_192kbps", name: "Abdul Basit (Murattal)" },
	{ id: "Minshawy_Murattal_128kbps", name: "Al-Minshawi (Murattal)" },
	{ id: "Abdurrahmaan_As-Sudais_192kbps", name: "Abdurrahman As-Sudais" },
];

// ================================================================ pelacakan
const Q = (p: FlashcardPlugin): QuranState => p.data.quran;
export const todayRead = (p: FlashcardPlugin) => Q(p).read[dayKey(Date.now())] ?? { ayat: 0, pages: 0 };

export function tilawahStreak(p: FlashcardPlugin): number {
	let n = 0, t = startOfDay(Date.now());
	if (!(Q(p).read[dayKey(t)]?.ayat)) t = addDays(t, -1);
	while (Q(p).read[dayKey(t)]?.ayat) { n++; t = addDays(t, -1); }
	return n;
}
export function avgPages(p: FlashcardPlugin, days = 7) {
	let s = 0;
	for (let i = 0; i < days; i++) s += Q(p).read[dayKey(addDays(startOfDay(Date.now()), -i))]?.pages ?? 0;
	return s / days;
}
/** Perkiraan tanggal khatam berdasarkan target (atau kecepatan 7 hari terakhir bila lebih cepat). */
export function khatamEta(p: FlashcardPlugin): { days: number; date: number } {
	const q = Q(p);
	const leftPages = 604 - (q.pos ? pageOf(q.pos) - (q.pos === PAGE[pageOf(q.pos)] - 1 ? 0 : 1) : 0);
	const speed = Math.max(q.target, avgPages(p)) || 1;
	const days = Math.ceil(Math.max(0, leftPages) / speed);
	return { days, date: addDays(startOfDay(Date.now()), days) };
}

/** Catat bacaan dari ayat `from` sampai `to` (inklusif). */
export function logRead(p: FlashcardPlugin, from: number, to: number, host?: HTMLElement) {
	const q = Q(p);
	if (to < from) return;
	let pages = 0;
	for (let g = from; g <= to; g++) pages += 1 / ayatInPage(pageOf(g));
	const k = dayKey(Date.now());
	const r = q.read[k] ?? { ayat: 0, pages: 0 };
	q.read[k] = { ayat: r.ayat + (to - from + 1), pages: Math.round((r.pages + pages) * 100) / 100 };
	const before = r.pages;
	q.last = { g: to, t: Date.now() };
	if (from <= q.pos + 1 && to > q.pos) q.pos = to;
	p.track("quranPages", Math.round(pages * 10) / 10);
	if (before < q.target && q.read[k].pages >= q.target) { new Notice(`📖 Target tilawah hari ini tercapai (${q.target} halaman)! Barakallahu fiik.`); play("achievement"); p.addCoins(10); }
	if (q.pos >= TOTAL) {
		q.khatam++;
		q.khatamDates.push(k);
		q.pos = 0;
		new Notice("🎉 Alhamdulillah, khatam Al-Qur'an! Semoga berkah.", 12_000);
		play("victory");
		p.addCoins(200);
		if (host && p.data.settings.confetti) confetti(host);
	}
	p.checkAchievements();
	p.requestSave();
}

export const hafalCount = (p: FlashcardPlugin) => Object.values(Q(p).hafal).filter((v) => v === 2).length;
export function hafalIn(p: FlashcardPlugin, a: number, b: number) { let n = 0; for (let g = a; g <= b; g++) if (Q(p).hafal[g] === 2) n++; return n; }
export const juzRange = (j: number): [number, number] => [JUZ[j - 1], JUZ[j] - 1];
export const surahRange = (s: number): [number, number] => [START[s], START[s] + SURAH[s - 1][4] - 1];

/** Ubah status hafalan sekumpulan ayat, lalu sinkronkan unit murajaah. */
export function setHafal(p: FlashcardPlugin, gs: number[], v: 0 | 1 | 2) {
	const q = Q(p);
	let added = 0;
	for (const g of gs) {
		if (v === 2 && q.hafal[g] !== 2) added++;
		if (v) q.hafal[g] = v; else delete q.hafal[g];
	}
	if (added) {
		const k = dayKey(Date.now());
		q.hafalLog[k] = (q.hafalLog[k] ?? 0) + added;
		p.track("hafalAyat", added);
		p.addCoins(added);
		play("correct");
	}
	syncUnits(p);
	p.checkAchievements();
	p.requestSave();
}

// ---- murajaah: satu unit = ayat hafal dari satu surah di satu halaman mushaf
export const unitKey = (g: number) => { const [s] = fromGid(g); return `${s}:${pageOf(g)}`; };
export function unitAyat(p: FlashcardPlugin, key: string): number[] {
	const [s, pg] = key.split(":").map(Number);
	const out: number[] = [];
	for (let g = Math.max(PAGE[pg - 1], START[s]); g < Math.min(PAGE[pg], START[s] + SURAH[s - 1][4]); g++) if (Q(p).hafal[g] === 2) out.push(g);
	return out;
}
export function unitLabel(p: FlashcardPlugin, key: string) {
	const [s, pg] = key.split(":").map(Number);
	const a = unitAyat(p, key).map((g) => fromGid(g)[1]);
	return `${sName(s)} ${a.length ? (a[0] === a[a.length - 1] ? a[0] : `${a[0]}–${a[a.length - 1]}`) : ""} · hal. ${pg}`;
}
export function syncUnits(p: FlashcardPlugin) {
	const q = Q(p);
	const keys = new Set(Object.entries(q.hafal).filter(([, v]) => v === 2).map(([g]) => unitKey(+g)));
	for (const k of keys) if (!q.mur[k]) q.mur[k] = schedule(undefined, 1, Date.now(), p.data.settings); // murajaah pertama besok
	for (const k of Object.keys(q.mur)) if (!keys.has(k)) delete q.mur[k];
}
export const murDue = (p: FlashcardPlugin) => Object.entries(Q(p).mur).filter(([, st]) => st.due <= endOfDay(Date.now())).sort((a, b) => a[1].due - b[1].due).map(([k]) => k);

export function ayatOfDay(): number {
	const d = Math.floor(startOfDay(Date.now()) / DAY);
	let h = (d * 2654435761) >>> 0;
	h = (h ^ (h >>> 13)) >>> 0; // >>> 0 menjaga hasil tetap positif (XOR bisa menghasilkan angka negatif)
	return (h % TOTAL) + 1;
}

// ================================================================ murattal (butuh internet)
class Player {
	private el: HTMLAudioElement | null = null;
	private list: number[] = [];
	private i = 0;
	private rep = 0;
	private times = 1;
	qari = "Alafasy_128kbps";
	current = 0;
	onChange: (() => void) | null = null;
	play(list: number[], times = 1) {
		this.stop();
		this.list = list;
		this.i = 0;
		this.rep = 0;
		this.times = Math.max(1, times);
		this.next();
	}
	private next() {
		if (this.i >= this.list.length) return this.stop();
		const g = this.list[this.i];
		const [s, a] = fromGid(g);
		this.current = g;
		this.onChange?.();
		this.el ??= new Audio();
		this.el.src = `https://everyayah.com/data/${this.qari}/${String(s).padStart(3, "0")}${String(a).padStart(3, "0")}.mp3`;
		this.el.onended = () => { this.rep++; if (this.rep >= this.times) { this.rep = 0; this.i++; } this.next(); };
		this.el.onerror = () => { new Notice("Murattal tidak dapat diputar. Fitur ini butuh koneksi internet (everyayah.com)."); this.stop(); };
		void this.el.play().catch(() => { /* ditangani onerror */ });
	}
	stop() {
		if (this.el) { this.el.onended = null; this.el.onerror = null; this.el.pause(); this.el.removeAttribute("src"); }
		this.current = 0;
		this.onChange?.();
	}
}
export const player = new Player();

// ================================================================ halaman
type Tab = "home" | "read" | "hafalan" | "murajaah" | "marks";
let tab: Tab = "home";
let readS = 0;
let jumpTo = 0;
let sessFrom = 0;
let query = "";
let hideText = false;
let peek = new Set<number>();
let hafalJuz = 0;
let openSurah = 0;

export function openReader(s: number, g = 0) { tab = "read"; readS = s; jumpTo = g; }

export function renderQuran(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const q = Q(p);
	player.qari = q.qari;
	player.onChange = () => {
		hub.mainEl.querySelectorAll(".fch-q-ayah.is-playing").forEach((x) => x.removeClass("is-playing"));
		if (player.current) {
			const a = hub.mainEl.querySelector(`.fch-q-ayah[data-g="${player.current}"]`) as HTMLElement | null;
			if (a) { a.addClass("is-playing"); a.scrollIntoView({ block: "center", behavior: "smooth" }); }
		}
		hub.mainEl.querySelector(".fch-q-stop")?.toggleClass("is-hidden", !player.current);
	};
	const head = el.createDiv("fch-pagehead fch-pagehead-row");
	const ht = head.createDiv();
	ht.createEl("h1", { text: "📖 Al-Qur'an" });
	ht.createDiv({ cls: "fch-muted", text: "Tilawah, khatam, hafalan, dan murajaah dalam satu tempat." });
	const stop = btn(head, { text: "Hentikan murattal", icon: "square", cls: "fch-btn-sm fch-q-stop" + (player.current ? "" : " is-hidden"), onClick: () => player.stop() });
	void stop;
	const tabs = el.createDiv("fch-tabs");
	const due = murDue(p).length;
	const T: [Tab, string, number?][] = [["home", "Ringkasan"], ["read", "Baca"], ["hafalan", "Hafalan"], ["murajaah", "Murajaah", due], ["marks", "Penanda"]];
	for (const [id, label, n] of T) {
		const b = tabs.createEl("button", { cls: "fch-tab" + (tab === id ? " is-active" : "") });
		b.createSpan({ text: label });
		if (n) b.createSpan({ cls: "fch-tab-n", text: String(n) });
		b.onclick = () => { tab = id; if (id === "read") readS = 0; hub.renderPage(); };
	}
	if (tab === "home") renderSummary(hub, el);
	else if (tab === "read") readS ? renderReader(hub, el) : renderIndex(hub, el);
	else if (tab === "hafalan") renderHafalan(hub, el);
	else if (tab === "murajaah") renderMurajaah(hub, el);
	else renderMarks(hub, el);
}

// ---------------------------------------------------------------- ringkasan
function renderSummary(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const q = Q(p);
	const tr = todayRead(p);
	const hero = el.createDiv("fch-hero fch-q-hero");
	const hl = hero.createDiv("fch-hero-l");
	if (q.last) {
		const [s, a] = fromGid(q.last.g);
		const nx = Math.min(TOTAL, q.last.g + 1);
		const [ns, na] = fromGid(nx);
		hl.createDiv({ cls: "fch-hero-num", text: `Lanjutkan: ${sName(ns)} ayat ${na}` });
		hl.createDiv({ cls: "fch-hero-sub", text: `Terakhir dibaca ${sName(s)} ${s}:${a} · Juz ${juzOf(nx)} · Halaman ${pageOf(nx)}` });
		const r = hl.createDiv("fch-row");
		btn(r, { text: "Lanjutkan membaca", icon: "book-open", cls: "fch-btn-primary fch-btn-lg", onClick: () => { openReader(ns, nx); hub.renderPage(); } });
		btn(r, { text: "Pilih surah", cls: "fch-btn-lg", onClick: () => { tab = "read"; readS = 0; hub.renderPage(); } });
	} else {
		hl.createDiv({ cls: "fch-hero-num", text: "Bismillah, mulai tilawah" });
		hl.createDiv({ cls: "fch-hero-sub", text: "Tandai ayat terakhir yang kamu baca (✓) agar progres, target harian, dan khatam tercatat otomatis." });
		btn(hl.createDiv("fch-row"), { text: "Mulai dari Al-Fatihah", icon: "book-open", cls: "fch-btn-primary fch-btn-lg", onClick: () => { openReader(1); hub.renderPage(); } });
	}
	const hr = hero.createDiv("fch-hero-r");
	const inner = ring(hr, tr.pages / Math.max(1, q.target), 120, undefined, "fch-ring-big").createDiv("fch-ring-inner");
	inner.createDiv({ cls: "fch-ring-num", text: tr.pages ? tr.pages.toFixed(tr.pages < 10 ? 1 : 0) : "0" });
	inner.createDiv({ cls: "fch-muted fch-small", text: `dari ${q.target} hal.` });

	const tri = el.createDiv("fch-tri");
	const k1 = tri.createDiv("fch-panel fch-mini");
	const pct = q.pos / TOTAL;
	k1.createDiv({ cls: "fch-mini-v", text: `${Math.round(pct * 1000) / 10}%` });
	k1.createDiv({ cls: "fch-mini-l", text: `menuju khatam ke-${q.khatam + 1}` });
	k1.createDiv("fch-bar").createDiv("fch-bar-fill").style.width = `${pct * 100}%`;
	const eta = khatamEta(p);
	k1.createDiv({ cls: "fch-muted fch-small", text: `Perkiraan khatam ${new Date(eta.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} (±${eta.days} hari)` });
	const k2 = tri.createDiv("fch-panel fch-mini");
	k2.createDiv({ cls: "fch-mini-v", text: `🔥 ${tilawahStreak(p)}` });
	k2.createDiv({ cls: "fch-mini-l", text: `hari tilawah beruntun · rata-rata ${avgPages(p).toFixed(1)} hal./hari` });
	const tg = k2.createDiv("fch-row");
	tg.createSpan({ cls: "fch-small", text: "Target harian" });
	const sel = tg.createEl("select", { cls: "dropdown fch-select" });
	[[1, "1 halaman"], [2, "2 halaman"], [4, "4 halaman (±5 bln)"], [5, "5 halaman (±4 bln)"], [10, "10 halaman (±2 bln)"], [20, "1 juz (30 hari)"], [40, "2 juz (15 hari)"]].forEach(([v, l]) => sel.createEl("option", { text: String(l), attr: { value: String(v) } }));
	sel.value = String(q.target);
	sel.onchange = () => { q.target = parseInt(sel.value, 10); p.requestSave(); hub.renderPage(); };
	k2.createDiv({ cls: "fch-muted fch-small", text: `${q.khatam}× khatam${q.khatamDates.length ? ` · terakhir ${q.khatamDates[q.khatamDates.length - 1]}` : ""}` });
	const k3 = tri.createDiv("fch-panel fch-mini");
	const hc = hafalCount(p);
	k3.createDiv({ cls: "fch-mini-v", text: `🧠 ${hc}` });
	k3.createDiv({ cls: "fch-mini-l", text: `ayat hafal · ±${(hc / TOTAL * 30).toFixed(1)} juz` });
	const md = murDue(p).length;
	btn(k3, { text: md ? `Murajaah (${md})` : "Hafalan", icon: md ? "rotate-ccw" : "brain", cls: "fch-btn-sm" + (md ? " fch-btn-primary" : ""), onClick: () => { tab = md ? "murajaah" : "hafalan"; hub.renderPage(); } });

	// ayat hari ini
	const g = ayatOfDay();
	const [s, a] = fromGid(g);
	const card = el.createDiv("fch-panel fch-q-daily");
	const h = card.createDiv("fch-section-head");
	h.createEl("h3", { text: "✨ Ayat hari ini" });
	btn(h, { text: `${sName(s)} ${s}:${a}`, cls: "fch-btn-link", onClick: () => { openReader(s, g); hub.renderPage(); } });
	const r = rows()[g - 1];
	card.createDiv({ cls: "fch-q-ar", text: r[0], attr: { dir: "rtl", lang: "ar" } });
	card.createDiv({ cls: "fch-q-tr", text: r[1] });

	const act = el.createDiv("fch-panel");
	act.createEl("h3", { text: "Riwayat tilawah (halaman per hari)" });
	const grid = act.createDiv("fch-q-heat");
	const today = startOfDay(Date.now());
	for (let i = 83; i >= 0; i--) {
		const t = addDays(today, -i), k = dayKey(t);
		const v = q.read[k]?.pages ?? 0;
		const lv = v <= 0 ? 0 : v < q.target / 2 ? 1 : v < q.target ? 2 : v < q.target * 2 ? 3 : 4;
		grid.createDiv({ cls: `fch-q-cell l${lv}` + (i === 0 ? " is-today" : ""), attr: { "aria-label": `${new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}: ${v.toFixed(1)} halaman` } });
	}
	el.createDiv({ cls: "fch-muted fch-small fch-mt fch-q-credit", text: "Sumber: teks Rasm Utsmani dari The Noble Qur'an Encyclopedia (quranenc.com); terjemahan Kementerian Agama RI via quranenc.com; data dikemas oleh proyek quran-json (CC BY 4.0) dan quran-meta (MIT). Murattal dari everyayah.com (butuh internet). Selalu rujuk mushaf cetak resmi bila ragu." });
}

// ---------------------------------------------------------------- daftar surah & pencarian
function renderIndex(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const bar = el.createDiv("fch-browse-bar");
	const s = bar.createEl("input", { type: "search", cls: "fch-input fch-grow", attr: { placeholder: "Cari surah, kata dalam terjemahan, atau teks Arab…" } });
	s.value = query;
	const jsel = bar.createEl("select", { cls: "dropdown fch-select" });
	jsel.createEl("option", { text: "Lompat ke juz…", attr: { value: "" } });
	for (let j = 1; j <= 30; j++) jsel.createEl("option", { text: `Juz ${j} · ${ref(JUZ[j - 1])}`, attr: { value: String(j) } });
	jsel.onchange = () => { const g = JUZ[parseInt(jsel.value, 10) - 1]; if (g) { openReader(fromGid(g)[0], g); hub.renderPage(); } };
	const out = el.createDiv();
	const draw = () => {
		out.empty();
		const qq = query.trim().toLowerCase();
		const list = out.createDiv("fch-q-surahs");
		for (let i = 1; i <= 114; i++) {
			const [ar, lat, arti, mad, n] = SURAH[i - 1];
			if (qq && !(`${i} ${lat} ${arti}`.toLowerCase().includes(qq))) continue;
			const [a, b] = surahRange(i);
			const hf = hafalIn(p, a, b);
			const c = list.createEl("button", { cls: "fch-q-surah" });
			c.createDiv({ cls: "fch-q-num", text: String(i) });
			const t = c.createDiv("fch-grow");
			t.createDiv({ cls: "fch-strong", text: lat });
			t.createDiv({ cls: "fch-muted fch-small", text: `${arti} · ${n} ayat · ${mad ? "Madaniyah" : "Makkiyah"}` });
			if (hf) { const bb = t.createDiv("fch-bar fch-bar-thin"); bb.createDiv("fch-bar-fill").style.width = `${(hf / n) * 100}%`; }
			c.createDiv({ cls: "fch-q-sname", text: ar, attr: { dir: "rtl", lang: "ar" } });
			c.onclick = () => { openReader(i); hub.renderPage(); };
		}
		if (qq.length >= 3) {
			const nq = normAr(qq);
			const hits: number[] = [];
			const R = rows();
			for (let g = 1; g <= TOTAL && hits.length < 60; g++) if (R[g - 1][1].toLowerCase().includes(qq) || (/[\u0600-\u06FF]/.test(qq) && normAr(R[g - 1][0]).includes(nq))) hits.push(g);
			const box = out.createDiv("fch-panel fch-mt");
			box.createEl("h3", { text: `Ayat yang memuat “${query.trim()}” (${hits.length >= 60 ? "60+" : hits.length})` });
			for (const g of hits) {
				const r = box.createEl("button", { cls: "fch-q-hit" });
				r.createDiv({ cls: "fch-strong fch-small", text: ref(g) });
				const txt = R[g - 1][1];
				const i0 = txt.toLowerCase().indexOf(qq);
				r.createDiv({ cls: "fch-small", text: i0 >= 0 ? (i0 > 60 ? "…" : "") + txt.slice(Math.max(0, i0 - 60), i0 + qq.length + 80) + "…" : R[g - 1][0] });
				r.onclick = () => { openReader(fromGid(g)[0], g); hub.renderPage(); };
			}
			if (!hits.length) box.createDiv({ cls: "fch-muted fch-small", text: "Tidak ditemukan." });
		}
	};
	let tm: number | undefined;
	s.oninput = () => { window.clearTimeout(tm); tm = window.setTimeout(() => { query = s.value; draw(); }, 200); };
	draw();
}

// ---------------------------------------------------------------- pembaca mushaf
function renderReader(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const q = Q(p);
	const s = readS;
	const [ar, lat, arti, mad, n] = SURAH[s - 1];
	const [first, last] = surahRange(s);
	if (!sessFrom || sessFrom < first || sessFrom > last + 1) sessFrom = q.last && q.last.g >= first - 1 && q.last.g < last ? q.last.g + 1 : first;

	const bar = el.createDiv("fch-q-bar");
	btn(bar, { icon: "arrow-left", cls: "fch-btn-ghost fch-btn-sm", label: "Daftar surah", onClick: () => { readS = 0; hub.renderPage(); } });
	btn(bar, { icon: "chevron-left", cls: "fch-btn-ghost fch-btn-sm", label: "Surah sebelumnya", disabled: s <= 1, onClick: () => { openReader(s - 1); sessFrom = 0; hub.renderPage(); } });
	btn(bar, { icon: "chevron-right", cls: "fch-btn-ghost fch-btn-sm", label: "Surah berikutnya", disabled: s >= 114, onClick: () => { openReader(s + 1); sessFrom = 0; hub.renderPage(); } });
	bar.createDiv("fch-grow");
	btn(bar, { text: "A−", cls: "fch-btn-sm", label: "Perkecil teks Arab", onClick: () => { q.font = Math.max(20, q.font - 2); p.requestSave(); hub.renderPage(); } });
	btn(bar, { text: "A+", cls: "fch-btn-sm", label: "Perbesar teks Arab", onClick: () => { q.font = Math.min(56, q.font + 2); p.requestSave(); hub.renderPage(); } });
	btn(bar, { text: q.trans ? "Terjemahan ✓" : "Terjemahan", cls: "fch-btn-sm" + (q.trans ? " fch-btn-primary" : ""), onClick: () => { q.trans = !q.trans; p.requestSave(); hub.renderPage(); } });
	btn(bar, { text: hideText ? "Mode hafalan ✓" : "Mode hafalan", icon: "eye-off", cls: "fch-btn-sm" + (hideText ? " fch-btn-primary" : ""), label: "Samarkan teks Arab; klik ayat untuk mengintip", onClick: () => { hideText = !hideText; peek = new Set(); hub.renderPage(); } });
	const qs = bar.createEl("select", { cls: "dropdown fch-select", attr: { "aria-label": "Qari" } });
	QARI.forEach((x) => qs.createEl("option", { text: "🎙 " + x.name, attr: { value: x.id } }));
	qs.value = q.qari;
	qs.onchange = () => { q.qari = qs.value; player.qari = qs.value; p.requestSave(); };
	const rp = bar.createEl("select", { cls: "dropdown fch-select", attr: { "aria-label": "Ulangi tiap ayat" } });
	[1, 3, 5, 10, 20].forEach((x) => rp.createEl("option", { text: x === 1 ? "1× per ayat" : `${x}× per ayat`, attr: { value: String(x) } }));
	rp.value = String(q.repeat);
	rp.onchange = () => { q.repeat = parseInt(rp.value, 10); p.requestSave(); };

	const head = el.createDiv("fch-q-head");
	head.createDiv({ cls: "fch-q-title-ar", text: ar, attr: { dir: "rtl", lang: "ar" } });
	head.createDiv({ cls: "fch-q-title", text: `${s}. ${lat}` });
	head.createDiv({ cls: "fch-muted fch-small", text: `${arti} · ${n} ayat · ${mad ? "Madaniyah" : "Makkiyah"} · Juz ${juzOf(first)}${juzOf(last) !== juzOf(first) ? "–" + juzOf(last) : ""} · hal. ${pageOf(first)}–${pageOf(last)}` });
	const hr = head.createDiv("fch-row fch-center");
	btn(hr, { text: "Putar surah", icon: "play", cls: "fch-btn-sm", onClick: () => player.play(Array.from({ length: n }, (_, i) => first + i), q.repeat) });
	btn(hr, { text: "Tandai surah selesai dibaca", icon: "check", cls: "fch-btn-sm", onClick: () => { logRead(p, Math.max(sessFrom, first), last, hub.mainEl); sessFrom = last + 1; hub.renderPage(); } });
	if (s !== 1 && s !== 9) el.createDiv({ cls: "fch-q-basmalah", text: BASMALAH, attr: { dir: "rtl", lang: "ar" } });

	const list = el.createDiv("fch-q-list" + (hideText ? " is-hide" : ""));
	list.style.setProperty("--qf", `${q.font}px`);
	const R = rows();
	const bm = new Set(q.bookmarks.map((b) => b.g));
	for (let g = first; g <= last; g++) {
		const a = g - first + 1;
		if (g === JUZ[juzOf(g) - 1] && g !== 1) list.createDiv({ cls: "fch-q-divider", text: `Juz ${juzOf(g)}` });
		else if (g === PAGE[pageOf(g) - 1] && g !== first) list.createDiv({ cls: "fch-q-page", text: `— hal. ${pageOf(g)} —` });
		const st = q.hafal[g];
		const row = list.createDiv("fch-q-ayah" + (q.last?.g === g ? " is-last" : "") + (g < sessFrom && g >= first && q.last && g <= q.last.g ? " is-read" : "") + (peek.has(g) ? " is-peek" : ""));
		row.dataset.g = String(g);
		const tools = row.createDiv("fch-q-tools");
		tools.createSpan({ cls: "fch-q-badge", text: `${s}:${a}` });
		if (SAJDA_SET.has(g)) tools.createSpan({ cls: "fch-pill", text: "۩ sajdah" });
		tools.createDiv("fch-grow");
		const b = (icon: string, label: string, on: boolean, fn: () => void) => { const x = btn(tools, { icon, cls: "fch-btn-ghost fch-btn-sm" + (on ? " is-on" : ""), label, onClick: (e) => { e.stopPropagation(); fn(); } }); return x; };
		b("play", "Putar mulai ayat ini", false, () => player.play(Array.from({ length: last - g + 1 }, (_, i) => g + i), q.repeat));
		b("bookmark", bm.has(g) ? "Hapus penanda" : "Tandai (bookmark)", bm.has(g), () => { if (bm.has(g)) q.bookmarks = q.bookmarks.filter((x) => x.g !== g); else q.bookmarks.unshift({ g, note: "", t: Date.now() }); p.requestSave(); hub.renderPage(); });
		const hs = tools.createEl("button", { cls: "fch-q-hafal s" + (st ?? 0), text: st === 2 ? "● hafal" : st === 1 ? "◐ sedang" : "○ hafalan", attr: { "aria-label": "Ubah status hafalan" } });
		hs.onclick = (e) => { e.stopPropagation(); setHafal(p, [g], st === 2 ? 0 : st === 1 ? 2 : 1); hub.renderPage(); };
		const mk = tools.createEl("button", { cls: "fch-q-mark", text: "✓ sampai sini", attr: { "aria-label": "Catat bacaan sampai ayat ini" } });
		mk.onclick = (e) => {
			e.stopPropagation();
			if (g >= sessFrom) logRead(p, sessFrom, g, hub.mainEl);
			else { q.last = { g, t: Date.now() }; p.requestSave(); }
			sessFrom = g + 1;
			play("click");
			hub.renderPage();
		};
		const txt = row.createDiv({ cls: "fch-q-ar", attr: { dir: "rtl", lang: "ar" } });
		txt.createSpan({ text: R[g - 1][0] + " " });
		txt.createSpan({ cls: "fch-q-end", text: `\u06DD${arNum(a)}` });
		if (q.trans) row.createDiv({ cls: "fch-q-tr", text: `${a}. ${R[g - 1][1]}` });
		row.onclick = () => { if (!hideText) return; if (peek.has(g)) peek.delete(g); else peek.add(g); row.toggleClass("is-peek", peek.has(g)); };
	}
	const foot = el.createDiv("fch-row fch-center fch-mt");
	if (s < 114) btn(foot, { text: `Lanjut ke ${sName(s + 1)}`, icon: "chevron-right", cls: "fch-btn-primary", onClick: () => { openReader(s + 1); hub.renderPage(); } });
	const target = jumpTo || (q.last && q.last.g >= first && q.last.g < last ? q.last.g + 1 : 0);
	jumpTo = 0;
	if (target) window.setTimeout(() => (el.querySelector(`.fch-q-ayah[data-g="${target}"]`) as HTMLElement | null)?.scrollIntoView({ block: "center" }), 60);
	else hub.mainEl.scrollTop = 0;
	if (player.current) player.onChange?.();
}

// ---------------------------------------------------------------- hafalan
function renderHafalan(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const q = Q(p);
	const hc = hafalCount(p);
	const k = dayKey(Date.now());
	const hero = el.createDiv("fch-panel fch-q-hstats");
	const left = hero.createDiv("fch-grow");
	left.createDiv({ cls: "fch-mini-v", text: `${hc} / ${TOTAL} ayat` });
	left.createDiv({ cls: "fch-muted fch-small", text: `${(hc / TOTAL * 100).toFixed(1)}% Al-Qur'an · setara ±${(hc / TOTAL * 30).toFixed(1)} juz` });
	left.createDiv("fch-bar fch-mt").createDiv("fch-bar-fill").style.width = `${(hc / TOTAL) * 100}%`;
	const z = hero.createDiv();
	z.createDiv({ cls: "fch-strong", text: `Ziyadah hari ini: ${q.hafalLog[k] ?? 0} / ${q.ziyadah} ayat` });
	const zs = z.createEl("select", { cls: "dropdown fch-select" });
	[1, 3, 5, 7, 10, 15, 20].forEach((v) => zs.createEl("option", { text: `Target ${v} ayat/hari`, attr: { value: String(v) } }));
	zs.value = String(q.ziyadah);
	zs.onchange = () => { q.ziyadah = parseInt(zs.value, 10); p.requestSave(); hub.renderPage(); };
	const md = murDue(p).length;
	if (md) btn(z, { text: `Murajaah hari ini (${md})`, icon: "rotate-ccw", cls: "fch-btn-primary fch-btn-sm", onClick: () => { tab = "murajaah"; hub.renderPage(); } });

	// hafalan berikutnya
	const fs = q.focusSurah ?? 114;
	const nx = el.createDiv("fch-panel fch-mt");
	const nh = nx.createDiv("fch-section-head");
	nh.createEl("h3", { text: "🎯 Sedang dihafal" });
	const ss = nh.createEl("select", { cls: "dropdown fch-select" });
	for (let i = 1; i <= 114; i++) ss.createEl("option", { text: `${i}. ${sName(i)}`, attr: { value: String(i) } });
	ss.value = String(fs);
	ss.onchange = () => { q.focusSurah = parseInt(ss.value, 10); p.requestSave(); hub.renderPage(); };
	const [a0, b0] = surahRange(fs);
	let g0 = a0;
	while (g0 <= b0 && q.hafal[g0] === 2) g0++;
	if (g0 > b0) nx.createDiv({ cls: "fch-small", text: `✅ ${sName(fs)} sudah hafal seluruhnya. MasyaAllah! Pilih surah berikutnya.` });
	else {
		const g1 = Math.min(b0, g0 + Math.max(1, q.ziyadah) - 1);
		const R = rows();
		nx.createDiv({ cls: "fch-small fch-muted", text: `Berikutnya: ${sName(fs)} ayat ${fromGid(g0)[1]}${g1 > g0 ? "–" + fromGid(g1)[1] : ""} (${hafalIn(p, a0, b0)}/${b0 - a0 + 1} ayat surah ini sudah hafal)` });
		nx.createDiv({ cls: "fch-q-ar fch-q-preview", text: R[g0 - 1][0], attr: { dir: "rtl", lang: "ar" } });
		const r = nx.createDiv("fch-row");
		btn(r, { text: "Mulai menghafal", icon: "brain", cls: "fch-btn-primary", onClick: () => hub.startGame(new HafalanPractice(hub, g0, g1)) });
		btn(r, { text: "Dengarkan", icon: "headphones", cls: "fch-btn-sm", onClick: () => player.play(Array.from({ length: g1 - g0 + 1 }, (_, i) => g0 + i), Math.max(3, q.repeat)) });
		btn(r, { text: "Buka di mushaf", icon: "book-open", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { openReader(fs, g0); hub.renderPage(); } });
	}

	// peta 30 juz
	const jp = el.createDiv("fch-panel fch-mt");
	jp.createEl("h3", { text: "Peta hafalan 30 juz" });
	const grid = jp.createDiv("fch-q-juz");
	for (let j = 1; j <= 30; j++) {
		const [a, b] = juzRange(j);
		const h = hafalIn(p, a, b) / (b - a + 1);
		const c = grid.createEl("button", { cls: "fch-q-juzcell" + (hafalJuz === j ? " is-sel" : "") });
		c.style.setProperty("--h", String(h));
		c.createDiv({ cls: "fch-strong", text: String(j) });
		c.createDiv({ cls: "fch-small", text: h ? `${Math.round(h * 100)}%` : "" });
		c.onclick = () => { hafalJuz = hafalJuz === j ? 0 : j; hub.renderPage(); };
	}
	// daftar surah (dalam juz terpilih)
	const sl = el.createDiv("fch-panel fch-mt");
	sl.createEl("h3", { text: hafalJuz ? `Surah di juz ${hafalJuz}` : "Semua surah" });
	const surahs = hafalJuz ? [...new Set(Array.from({ length: juzRange(hafalJuz)[1] - juzRange(hafalJuz)[0] + 1 }, (_, i) => fromGid(juzRange(hafalJuz)[0] + i)[0]))] : (hafalJuz === 0 ? [...Array(114).keys()].map((i) => 114 - i) : []);
	for (const s of surahs) {
		const [a, b] = surahRange(s);
		const n = b - a + 1, h = hafalIn(p, a, b);
		const row = sl.createDiv("fch-q-hrow");
		const top = row.createDiv("fch-row");
		top.createSpan({ cls: "fch-q-num", text: String(s) });
		const t = top.createDiv("fch-grow");
		t.createDiv({ cls: "fch-strong", text: `${sName(s)} ` }).createSpan({ cls: "fch-muted fch-small", text: `${h}/${n} ayat` });
		t.createDiv("fch-bar fch-bar-thin").createDiv("fch-bar-fill").style.width = `${(h / n) * 100}%`;
		btn(top, { text: openSurah === s ? "Tutup" : "Ayat", cls: "fch-btn-sm fch-btn-ghost", onClick: () => { openSurah = openSurah === s ? 0 : s; hub.renderPage(); } });
		btn(top, { text: "Latih", icon: "brain", cls: "fch-btn-sm", onClick: () => hub.startGame(new HafalanPractice(hub, a, Math.min(b, a + 9))) });
		if (h < n) btn(top, { text: "Hafal semua", cls: "fch-btn-sm fch-btn-ghost", onClick: () => { setHafal(p, Array.from({ length: n }, (_, i) => a + i), 2); hub.renderPage(); } });
		if (openSurah === s) {
			const ag = row.createDiv("fch-q-agrid");
			for (let g = a; g <= b; g++) {
				const v = Q(p).hafal[g] ?? 0;
				const c = ag.createEl("button", { cls: "fch-q-acell s" + v, text: String(g - a + 1), attr: { "aria-label": `${sName(s)} ${g - a + 1}: ${v === 2 ? "hafal" : v === 1 ? "sedang" : "belum"}` } });
				c.onclick = () => { setHafal(p, [g], v === 2 ? 0 : v === 1 ? 2 : 1); hub.renderPage(); };
			}
			row.createDiv({ cls: "fch-muted fch-small", text: "Klik nomor ayat: belum → sedang dihafal → hafal. Ayat yang hafal otomatis masuk jadwal murajaah." });
		}
		if (!hafalJuz && s < 78 && surahs.indexOf(s) > 40) break; // daftar penuh: tampilkan juz 30 & sekitarnya dulu
	}
	if (!hafalJuz) sl.createDiv({ cls: "fch-muted fch-small fch-mt", text: "Pilih juz di peta untuk melihat surah lainnya." });
}

// ---------------------------------------------------------------- murajaah
function renderMurajaah(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const q = Q(p);
	const due = murDue(p);
	const k = dayKey(Date.now());
	const box = el.createDiv("fch-panel");
	box.createEl("h3", { text: "🔁 Murajaah terjadwal" });
	box.createDiv({ cls: "fch-muted fch-small fch-desc", text: "Setiap halaman hafalan dijadwalkan ulang dengan algoritma yang sama seperti flashcard (FSRS): yang lancar muncul makin jarang, yang ragu lebih sering." });
	const r = box.createDiv("fch-row");
	r.createDiv({ cls: "fch-mini-v", text: String(due.length) });
	r.createDiv({ cls: "fch-grow", text: `halaman perlu dimurajaah hari ini · ${q.murLog[k] ?? 0} sudah selesai hari ini · ${Object.keys(q.mur).length} halaman hafalan` });
	if (due.length) btn(r, { text: "Mulai murajaah", icon: "play", cls: "fch-btn-primary fch-btn-lg", onClick: () => hub.startGame(new MurajaahGame(hub, due)) });
	if (!Object.keys(q.mur).length) { box.createDiv({ cls: "fch-empty fch-mt", text: "Belum ada hafalan. Tandai ayat sebagai “hafal” di tab Hafalan atau di mushaf, maka jadwal murajaah muncul otomatis." }); return; }
	const up = el.createDiv("fch-panel fch-mt");
	up.createEl("h3", { text: "Jadwal berikutnya" });
	const list = Object.entries(q.mur).sort((a, b) => a[1].due - b[1].due).slice(0, 40);
	for (const [key, st] of list) {
		const rr = up.createDiv("fch-cal-row");
		rr.createSpan({ text: unitLabel(p, key) });
		const d = Math.round((startOfDay(st.due) - startOfDay(Date.now())) / DAY);
		rr.createSpan({ cls: d <= 0 ? "fch-strong" : "fch-muted", text: d <= 0 ? "hari ini" : d === 1 ? "besok" : `${d} hari lagi` });
	}
}

// ---------------------------------------------------------------- penanda
function renderMarks(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const q = Q(p);
	const box = el.createDiv("fch-panel");
	box.createEl("h3", { text: "🔖 Penanda ayat" });
	if (q.last) {
		const r = box.createDiv("fch-q-mark-row is-last");
		r.createDiv({ cls: "fch-grow", text: `📍 Terakhir dibaca: ${ref(q.last.g)}` });
		btn(r, { text: "Buka", cls: "fch-btn-sm", onClick: () => { openReader(fromGid(q.last!.g)[0], q.last!.g); hub.renderPage(); } });
	}
	if (!q.bookmarks.length) box.createDiv({ cls: "fch-muted fch-small fch-mt", text: "Belum ada penanda. Klik ikon 🔖 pada ayat di mushaf." });
	const R = rows();
	for (const b of q.bookmarks) {
		const r = box.createDiv("fch-q-mark-row");
		const t = r.createDiv("fch-grow");
		t.createDiv({ cls: "fch-strong", text: ref(b.g) });
		t.createDiv({ cls: "fch-small fch-muted", text: R[b.g - 1][1].slice(0, 140) + (R[b.g - 1][1].length > 140 ? "…" : "") });
		const note = t.createEl("input", { type: "text", cls: "fch-input fch-mt", attr: { placeholder: "Catatan/tadabbur (opsional)" } });
		note.value = b.note;
		note.onchange = () => { b.note = note.value; p.requestSave(); };
		btn(r, { text: "Buka", cls: "fch-btn-sm", onClick: () => { openReader(fromGid(b.g)[0], b.g); hub.renderPage(); } });
		btn(r, { icon: "trash-2", cls: "fch-btn-ghost fch-btn-sm", label: "Hapus", onClick: () => { q.bookmarks = q.bookmarks.filter((x) => x !== b); p.requestSave(); hub.renderPage(); } });
	}
}

// ================================================================ latihan hafalan
type PMode = "ulang" | "tutup" | "awal" | "sambung";
const PMODES: [PMode, string, string][] = [
	["ulang", "🔁 Ulangi", "Baca & dengarkan berulang dengan penghitung"],
	["tutup", "🙈 Tutup bertahap", "Kata disembunyikan sedikit demi sedikit"],
	["awal", "🔤 Huruf awal", "Hanya huruf pertama tiap kata"],
	["sambung", "🔗 Sambung ayat", "Lanjutkan ayat berikutnya dari ingatan"],
];

export class HafalanPractice implements Game {
	ok = true;
	private mode: PMode = "ulang";
	private i = 0;
	private count = 0;
	private goal = 10;
	private level = 1;
	private shown = new Set<string>();
	private revealed = false;
	private results: boolean[] = [];
	private el: HTMLElement | null = null;
	private keyH = (e: KeyboardEvent) => this.onKey(e);
	constructor(private hub: HubView, private a: number, private b: number) {}
	mount(el: HTMLElement) { this.el = el; document.addEventListener("keydown", this.keyH, true); this.draw(); }
	unmount() { document.removeEventListener("keydown", this.keyH, true); player.stop(); this.el = null; }
	private get n() { return this.b - this.a + 1; }
	private onKey(e: KeyboardEvent) {
		if (!this.el || e.ctrlKey || e.metaKey || (e.target as HTMLElement).tagName === "INPUT") return;
		if (e.key === " " && this.mode === "ulang") { e.preventDefault(); this.tick(); }
		if (e.key === " " && this.mode === "sambung" && !this.revealed) { e.preventDefault(); this.revealed = true; this.draw(); }
	}
	private tick() {
		this.count++;
		play("click");
		if (this.count >= this.goal) { play("correct"); this.count = 0; if (this.i < this.n - 1) this.i++; else new Notice("✅ Semua ayat sudah diulang. Coba mode Tutup bertahap untuk menguji."); }
		this.draw();
	}
	private words(g: number) { return rows()[g - 1][0].split(" ").filter(Boolean); }
	private draw() {
		const root = this.el;
		if (!root) return;
		const p = this.hub.plugin;
		root.empty();
		const wrap = root.createDiv("fch-q-practice");
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Keluar", onClick: () => this.hub.endGame() });
		const tt = top.createDiv("fch-study-title");
		const [s, a1] = fromGid(this.a);
		tt.createDiv({ cls: "fch-study-name", text: `🧠 Hafalan · ${sName(s)} ${a1}${this.n > 1 ? "–" + fromGid(this.b)[1] : ""}` });
		tt.createDiv({ cls: "fch-muted fch-small", text: `${this.n} ayat · Juz ${juzOf(this.a)} · hal. ${pageOf(this.a)}` });
		const seg = wrap.createDiv("fch-seg fch-q-modes");
		for (const [m, l, d] of PMODES) {
			const b = seg.createEl("button", { cls: "fch-seg-btn" + (this.mode === m ? " is-active" : ""), text: l, attr: { "aria-label": d } });
			b.onclick = () => { this.mode = m; this.i = 0; this.count = 0; this.revealed = false; this.results = []; this.shown = new Set(); this.draw(); };
		}
		const R = rows();
		const card = wrap.createDiv("fch-card fch-q-pcard");
		const q = Q(p);
		card.style.setProperty("--qf", `${q.font + 2}px`);
		if (this.mode === "ulang") {
			const g = this.a + this.i;
			card.createDiv({ cls: "fch-muted fch-small fch-center", text: `Ayat ${fromGid(g)[1]} · ${this.i + 1} dari ${this.n}` });
			card.createDiv({ cls: "fch-q-ar fch-q-big", text: R[g - 1][0], attr: { dir: "rtl", lang: "ar" } });
			if (q.trans) card.createDiv({ cls: "fch-q-tr fch-center", text: R[g - 1][1] });
			const c = card.createDiv("fch-row fch-center fch-mt");
			const tb = btn(c, { text: `Ulangi ${this.count}/${this.goal}`, cls: "fch-btn-primary fch-btn-xl", onClick: () => this.tick() });
			tb.createSpan({ cls: "fch-kbd", text: "Spasi" });
			const gs = c.createEl("select", { cls: "dropdown fch-select" });
			[3, 5, 10, 20, 40].forEach((v) => gs.createEl("option", { text: `target ${v}×`, attr: { value: String(v) } }));
			gs.value = String(this.goal);
			gs.onchange = () => { this.goal = parseInt(gs.value, 10); this.draw(); };
			const r2 = card.createDiv("fch-row fch-center");
			btn(r2, { icon: "chevron-right", text: "Sebelumnya", cls: "fch-btn-sm", disabled: this.i === 0, onClick: () => { this.i--; this.count = 0; this.draw(); } });
			btn(r2, { icon: "volume-2", text: "Dengarkan", cls: "fch-btn-sm", onClick: () => player.play([g], Math.max(3, q.repeat)) });
			btn(r2, { icon: "chevron-left", text: "Berikutnya", cls: "fch-btn-sm", disabled: this.i >= this.n - 1, onClick: () => { this.i++; this.count = 0; this.draw(); } });
		} else if (this.mode === "tutup" || this.mode === "awal") {
			if (this.mode === "tutup") {
				const lv = card.createDiv("fch-row fch-center");
				lv.createSpan({ cls: "fch-small fch-muted", text: "Tingkat:" });
				["25%", "50%", "75%", "100%"].forEach((t, k) => btn(lv, { text: t, cls: "fch-btn-sm" + (this.level === k + 1 ? " fch-btn-primary" : ""), onClick: () => { this.level = k + 1; this.shown = new Set(); this.draw(); } }));
			}
			for (let g = this.a; g <= this.b; g++) {
				const line = card.createDiv({ cls: "fch-q-ar fch-q-mask", attr: { dir: "rtl", lang: "ar" } });
				this.words(g).forEach((w, k) => {
					const id = `${g}:${k}`;
					const hide = this.mode === "awal" || ((g * 31 + k * 17) % 4) < this.level;
					if (!hide || this.shown.has(id)) { line.createSpan({ cls: "fch-q-w", text: w + " " }); return; }
					const letter = w.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "").charAt(0);
					const x = line.createSpan({ cls: "fch-q-w is-masked", text: this.mode === "awal" ? letter + "ـ " : "ــــ " });
					x.onclick = () => { this.shown.add(id); this.draw(); };
				});
				line.createSpan({ cls: "fch-q-end", text: `\u06DD${arNum(fromGid(g)[1])}` });
			}
			card.createDiv({ cls: "fch-muted fch-small fch-center fch-mt", text: "Baca dari ingatan. Klik kata yang tersembunyi untuk mengintip." });
			const r = card.createDiv("fch-row fch-center");
			btn(r, { text: "Tampilkan semua", cls: "fch-btn-sm", onClick: () => { for (let g = this.a; g <= this.b; g++) this.words(g).forEach((_, k) => this.shown.add(`${g}:${k}`)); this.draw(); } });
			btn(r, { text: "Sembunyikan lagi", cls: "fch-btn-sm", onClick: () => { this.shown = new Set(); this.draw(); } });
			if (this.mode === "tutup" && this.level < 4) btn(r, { text: "Lancar → tingkat berikutnya", cls: "fch-btn-primary fch-btn-sm", onClick: () => { this.level++; this.shown = new Set(); play("correct"); this.draw(); } });
		} else {
			// sambung ayat: tampilkan ayat i, tebak ayat i+1
			if (this.n < 2 && this.a > 1) { this.a--; }
			const total = this.n - 1;
			if (this.i >= total) {
				const ok = this.results.filter(Boolean).length;
				card.createEl("h2", { cls: "fch-center", text: `${ok}/${total} sambungan lancar` });
				const r = card.createDiv("fch-row fch-center");
				btn(r, { text: "Ulangi", icon: "rotate-ccw", onClick: () => { this.i = 0; this.results = []; this.revealed = false; this.draw(); } });
			} else {
				const g = this.a + this.i;
				card.createDiv({ cls: "fch-muted fch-small fch-center", text: `Ayat ${fromGid(g)[1]} → lanjutkan ayat ${fromGid(g + 1)[1]}` });
				card.createDiv({ cls: "fch-q-ar", text: R[g - 1][0], attr: { dir: "rtl", lang: "ar" } });
				if (!this.revealed) {
					const b = btn(card.createDiv("fch-row fch-center fch-mt"), { text: "Tampilkan ayat berikutnya", icon: "eye", cls: "fch-btn-primary fch-btn-lg", onClick: () => { this.revealed = true; this.draw(); } });
					b.createSpan({ cls: "fch-kbd", text: "Spasi" });
				} else {
					card.createDiv({ cls: "fch-q-ar fch-q-answer", text: R[g][0], attr: { dir: "rtl", lang: "ar" } });
					const r = card.createDiv("fch-row fch-center fch-mt");
					btn(r, { text: "Belum lancar", cls: "fch-btn-lg", onClick: () => { this.results.push(false); play("wrong"); this.i++; this.revealed = false; this.draw(); } });
					btn(r, { text: "Lancar", cls: "fch-btn-primary fch-btn-lg", onClick: () => { this.results.push(true); play("correct"); this.i++; this.revealed = false; this.draw(); } });
				}
			}
		}
		const foot = wrap.createDiv("fch-row fch-center fch-mt");
		const allHafal = hafalIn(p, this.a, this.b) === this.n;
		btn(foot, { text: allHafal ? "✓ Sudah ditandai hafal" : "Tandai ayat-ayat ini hafal", icon: "check", cls: allHafal ? "" : "fch-btn-primary", disabled: allHafal, onClick: () => { setHafal(p, Array.from({ length: this.n }, (_, i) => this.a + i), 2); new Notice(`🧠 ${this.n} ayat ditandai hafal & masuk jadwal murajaah`); this.draw(); } });
		btn(foot, { text: "Dengarkan semua", icon: "headphones", cls: "fch-btn-sm", onClick: () => player.play(Array.from({ length: this.n }, (_, i) => this.a + i), Math.max(1, Q(p).repeat)) });
	}
}

// ================================================================ sesi murajaah
export class MurajaahGame implements Game {
	ok: boolean;
	private i = 0;
	private shown = 0;
	private done: { key: string; g: Grade }[] = [];
	private el: HTMLElement | null = null;
	private keyH = (e: KeyboardEvent) => this.onKey(e);
	constructor(private hub: HubView, private keys: string[]) { this.ok = keys.length > 0; }
	mount(el: HTMLElement) { this.el = el; document.addEventListener("keydown", this.keyH, true); this.draw(); }
	unmount() { document.removeEventListener("keydown", this.keyH, true); player.stop(); this.el = null; }
	private onKey(e: KeyboardEvent) {
		if (!this.el || this.i >= this.keys.length || e.ctrlKey || e.metaKey) return;
		const ay = unitAyat(this.hub.plugin, this.keys[this.i]);
		if (e.key === " ") { e.preventDefault(); if (this.shown < ay.length) { this.shown++; this.draw(); } }
		else if (this.shown >= ay.length && ["1", "2", "3", "4"].includes(e.key)) { e.preventDefault(); this.rate((parseInt(e.key, 10) - 1) as Grade); }
	}
	private rate(g: Grade) {
		const p = this.hub.plugin;
		const q = Q(p);
		const key = this.keys[this.i];
		q.mur[key] = schedule(q.mur[key], g, Date.now(), p.data.settings);
		const k = dayKey(Date.now());
		q.murLog[k] = (q.murLog[k] ?? 0) + 1;
		p.track("murajaah");
		p.addCoins(1);
		play(g >= 2 ? "correct" : "wrong");
		this.done.push({ key, g });
		this.i++;
		this.shown = 0;
		p.requestSave();
		if (this.i >= this.keys.length) { play("victory"); p.checkAchievements(); }
		this.draw();
	}
	private draw() {
		const root = this.el;
		if (!root) return;
		const p = this.hub.plugin;
		const q = Q(p);
		root.empty();
		const wrap = root.createDiv("fch-q-practice");
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Keluar", onClick: () => this.hub.endGame() });
		const tt = top.createDiv("fch-study-title");
		tt.createDiv({ cls: "fch-study-name", text: "🔁 Murajaah" });
		tt.createDiv({ cls: "fch-muted fch-small", text: `${Math.min(this.i + 1, this.keys.length)} dari ${this.keys.length} halaman` });
		const pr = wrap.createDiv("fch-prog");
		pr.createDiv("fch-bar fch-grow").createDiv("fch-bar-fill").style.width = `${(this.i / this.keys.length) * 100}%`;
		if (this.i >= this.keys.length) {
			const box = wrap.createDiv("fch-summary");
			box.createDiv({ cls: "fch-sum-emoji", text: "🤲" });
			box.createEl("h2", { text: "Murajaah hari ini selesai" });
			const lancar = this.done.filter((d) => d.g >= 2).length;
			box.createEl("p", { cls: "fch-muted", text: `${lancar}/${this.done.length} halaman lancar. Halaman yang masih ragu akan muncul lagi lebih cepat.` });
			btn(box.createDiv("fch-row fch-center"), { text: "Kembali", cls: "fch-btn-primary", onClick: () => this.hub.endGame() });
			if (this.hub.plugin.data.settings.confetti && lancar === this.done.length) confetti(root);
			return;
		}
		const key = this.keys[this.i];
		const ay = unitAyat(p, key);
		const R = rows();
		const card = wrap.createDiv("fch-card fch-q-pcard");
		card.style.setProperty("--qf", `${q.font}px`);
		card.createDiv({ cls: "fch-q-title fch-center", text: unitLabel(p, key) });
		card.createDiv({ cls: "fch-muted fch-small fch-center", text: `Juz ${juzOf(ay[0])} · ${ay.length} ayat · bacalah dari ingatan, lalu buka ayat satu per satu untuk mengecek` });
		const first = R[ay[0] - 1][0].split(" ").slice(0, 3).join(" ");
		if (!this.shown) card.createDiv({ cls: "fch-q-ar fch-q-cue", text: first + " …", attr: { dir: "rtl", lang: "ar" } });
		for (let k = 0; k < this.shown; k++) {
			const g = ay[k];
			const line = card.createDiv({ cls: "fch-q-ar", attr: { dir: "rtl", lang: "ar" } });
			line.createSpan({ text: R[g - 1][0] + " " });
			line.createSpan({ cls: "fch-q-end", text: `\u06DD${arNum(fromGid(g)[1])}` });
		}
		const act = card.createDiv("fch-actions");
		if (this.shown < ay.length) {
			const r = act.createDiv("fch-row fch-center");
			const b = btn(r, { text: this.shown ? "Ayat berikutnya" : "Cek ayat pertama", icon: "eye", cls: "fch-btn-primary fch-btn-lg", onClick: () => { this.shown++; this.draw(); } });
			b.createSpan({ cls: "fch-kbd", text: "Spasi" });
			btn(r, { text: "Tampilkan semua", cls: "fch-btn-sm", onClick: () => { this.shown = ay.length; this.draw(); } });
			btn(r, { icon: "headphones", cls: "fch-btn-ghost fch-btn-sm", label: "Dengarkan bacaan yang benar", onClick: () => player.play(ay, 1) });
		} else {
			const st = q.mur[key];
			const grades = act.createDiv("fch-grades");
			([[0, "Lupa", "var(--fch-g0)"], [1, "Ragu", "var(--fch-g1)"], [2, "Lancar", "var(--fch-g2)"], [3, "Sangat lancar", "var(--fch-g3)"]] as [Grade, string, string][]).forEach(([g, l, c]) => {
				const b = grades.createEl("button", { cls: "fch-grade" });
				b.style.setProperty("--c", c);
				b.createDiv({ cls: "fch-grade-label", text: l });
				b.createDiv({ cls: "fch-grade-sub", text: `${formatInterval(previewInterval(st, g, p.data.settings))} · ${g + 1}` });
				b.onclick = () => this.rate(g);
			});
		}
	}
}

/** Panel ringkas untuk Beranda. */
export function renderQuranPanel(hub: HubView, parent: HTMLElement) {
	const p = hub.plugin;
	const q = Q(p);
	const box = parent.createDiv("fch-panel fch-mt fch-q-home");
	const h = box.createDiv("fch-section-head");
	h.createEl("h3", { text: "📖 Al-Qur'an" });
	btn(h, { text: "Buka", cls: "fch-btn-link", onClick: () => { tab = "home"; hub.navigate("quran"); } });
	const tr = todayRead(p);
	const row = box.createDiv("fch-row");
	const t = row.createDiv("fch-grow");
	t.createDiv({ cls: "fch-small fch-strong", text: `Tilawah hari ini: ${tr.pages.toFixed(1)} / ${q.target} halaman · 🔥 ${tilawahStreak(p)} hari` });
	t.createDiv("fch-bar fch-bar-thin").createDiv("fch-bar-fill").style.width = `${Math.min(100, (tr.pages / Math.max(1, q.target)) * 100)}%`;
	const nx = q.last ? Math.min(TOTAL, q.last.g + 1) : 1;
	btn(row, { text: q.last ? `Lanjut ${ref(nx)}` : "Mulai tilawah", icon: "book-open", cls: "fch-btn-primary fch-btn-sm", onClick: () => { openReader(fromGid(nx)[0], nx); hub.navigate("quran"); } });
	const md = murDue(p).length;
	if (md) btn(row, { text: `Murajaah (${md})`, icon: "rotate-ccw", cls: "fch-btn-sm", onClick: () => hub.startGame(new MurajaahGame(hub, murDue(p))) });
	const g = ayatOfDay();
	const card = box.createDiv("fch-q-mini");
	card.createDiv({ cls: "fch-q-ar", text: rows()[g - 1][0], attr: { dir: "rtl", lang: "ar" } });
	card.createDiv({ cls: "fch-q-tr", text: `${rows()[g - 1][1]} (${ref(g)})` });
}
void Component;
