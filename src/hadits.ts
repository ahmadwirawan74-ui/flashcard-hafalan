import { Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import type { Game } from "./match";
import { Grade } from "./types";
import { ARBAIN, ASMAUL_HUSNA, DOA_GROUPS, MUSLIM100 } from "./ibadah-data";
import { HADEETH_INFO, SOURCE_LINE, arText, arabicBlock, decorateHero, hadeeth } from "./ibadah";
import { dayKey, endOfDay, formatInterval, previewInterval, schedule } from "./scheduler";
import { btn, confetti, shuffle } from "./util";
import { play } from "./sound";

const I = (p: FlashcardPlugin) => p.data.ibadah;

/** Kunci hafalan & id HadeethEnc. */
interface Entry { key: string; id: number; no: string }
const arbain = (): Entry[] => Object.entries(ARBAIN).map(([n, id]) => ({ key: `a:${n}`, id, no: n }));
const muslim = (): Entry[] => MUSLIM100.map((id, i) => ({ key: `m:${id}`, id, no: String(i + 1) }));
const doaGroup = (g: number): Entry[] => DOA_GROUPS[g][2].map((id, i) => ({ key: `d:${id}`, id, no: String(i + 1) }));

export function setHafal(p: FlashcardPlugin, key: string, v: 0 | 1 | 2) {
	const i = I(p);
	const was = i.hafal[key];
	if (v) i.hafal[key] = v; else delete i.hafal[key];
	if (v === 2 && was !== 2) {
		i.mur[key] = schedule(undefined, 1, Date.now(), p.data.settings);
		p.addCoins(key.startsWith("n:") ? 1 : 5);
		p.track("hafalHadits");
		play("correct");
	}
	if (v !== 2) delete i.mur[key];
	p.requestSave();
	p.checkAchievements();
}
export const hafalCountOf = (p: FlashcardPlugin, prefix: string) => Object.entries(I(p).hafal).filter(([k, v]) => k.startsWith(prefix) && v === 2).length;
export const hMurDue = (p: FlashcardPlugin) => Object.entries(I(p).mur).filter(([, st]) => st.due <= endOfDay(Date.now())).sort((a, b) => a[1].due - b[1].due).map(([k]) => k);

const STATUS = ["○ Belum", "◐ Sedang", "● Hafal"];

// ================================================================ halaman Hadits & Doa
type Tab = "arbain" | "muslim" | "doa" | "murajaah" | "sumber";
let tab: Tab = "arbain";
export const openHaditsTab = (t: Tab) => { tab = t; };
let open = "";
let filter: "all" | "todo" | "done" = "all";
let doaG = 0;
let showExp = false;

function entriesFor(): Entry[] { return tab === "arbain" ? arbain() : tab === "muslim" ? muslim() : doaGroup(doaG); }

export function renderHadits(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const head = el.createDiv("fch-pagehead");
	decorateHero(p, head, "#b45309");
	head.createEl("h1", { text: "📜 Hadits & Doa" });
	head.createDiv({ cls: "fch-muted", text: "Hafalan Hadits Arbain An-Nawawi, 100 hadits riwayat Muslim, serta doa dan zikir harian, lengkap dengan terjemahan, penjelasan, dan derajat hadits." });
	const tabs = el.createDiv("fch-tabs");
	const due = hMurDue(p).filter((k) => !k.startsWith("n:")).length;
	const T: [Tab, string, string?][] = [["arbain", "Arbain", `${hafalCountOf(p, "a:")}/42`], ["muslim", "100 Hadits Muslim", `${hafalCountOf(p, "m:")}/100`], ["doa", "Doa harian"], ["murajaah", "Murajaah", due ? String(due) : undefined], ["sumber", "Tentang sumber"]];
	for (const [id, l, n] of T) {
		const b = tabs.createEl("button", { cls: "fch-tab" + (tab === id ? " is-active" : "") });
		b.createSpan({ text: l });
		if (n) b.createSpan({ cls: "fch-tab-n", text: n });
		b.onclick = () => { tab = id; open = ""; hub.renderPage(); };
	}
	if (tab === "sumber") {
		const box = el.createDiv("fch-panel");
		box.createEl("h3", { text: "Tentang sumber" });
		box.createDiv({ cls: "fch-small", text: "Teks hadits, terjemahan, penjelasan, faedah, derajat, dan takhrij diambil dari HadeethEnc.com (Ensiklopedia Hadits Terjemahan) dan ditampilkan apa adanya tanpa perubahan, sesuai syarat penerbitan ulang dari sumber. Masukan atas terjemahan dapat disampaikan langsung ke HadeethEnc.com." });
		box.createEl("pre", { cls: "fch-h-info", text: HADEETH_INFO });
		box.createDiv({ cls: "fch-small fch-mt", text: "Pemilihan koleksi: Arbain An-Nawawi dipetakan nomor 1–42 ke entri HadeethEnc yang sesuai (diperiksa satu per satu). “100 Hadits Muslim” adalah 100 hadits HadeethEnc yang takhrijnya khusus riwayat Muslim, dipilih yang matannya paling ringkas agar mudah dihafal. Doa & zikir dikelompokkan menurut kategori HadeethEnc." });
		return;
	}
	if (tab === "murajaah") return renderMur(hub, el);
	if (tab === "doa") {
		const seg = el.createDiv("fch-chips");
		DOA_GROUPS.forEach((g, n) => { const c = seg.createEl("button", { cls: "fch-chip" + (doaG === n ? " is-active" : ""), text: `${g[1]} (${g[2].length})` }); c.onclick = () => { doaG = n; open = ""; hub.renderPage(); }; });
	}
	const ents = entriesFor();
	const done = ents.filter((e) => I(p).hafal[e.key] === 2).length;
	const top = el.createDiv("fch-panel fch-row");
	const t = top.createDiv("fch-grow");
	t.createDiv({ cls: "fch-strong", text: `${done} / ${ents.length} hafal` });
	t.createDiv("fch-bar fch-mt").createDiv("fch-bar-fill").style.width = `${(done / ents.length) * 100}%`;
	const fs = top.createDiv("fch-seg");
	(["all", "todo", "done"] as const).forEach((f) => { const b = fs.createEl("button", { cls: "fch-seg-btn" + (filter === f ? " is-active" : ""), text: f === "all" ? "Semua" : f === "todo" ? "Belum hafal" : "Hafal" }); b.onclick = () => { filter = f; hub.renderPage(); }; });
	const next = ents.find((e) => I(p).hafal[e.key] !== 2);
	if (next) btn(top, { text: "Hafalkan berikutnya", icon: "brain", cls: "fch-btn-primary", onClick: () => hub.startGame(new TextPractice(hub, next)) });

	const list = el.createDiv("fch-h-list");
	for (const e of ents) {
		const v = I(p).hafal[e.key] ?? 0;
		if (filter === "todo" && v === 2) continue;
		if (filter === "done" && v !== 2) continue;
		const h = hadeeth(e.id);
		if (!h) continue;
		const row = list.createDiv("fch-h-row" + (open === e.key ? " is-open" : "") + (v === 2 ? " is-done" : ""));
		const r = row.createDiv("fch-h-head");
		r.createSpan({ cls: "fch-q-num", text: e.no });
		const tt = r.createDiv("fch-grow");
		tt.createDiv({ cls: "fch-strong", text: h.title });
		const gm = tt.createDiv("fch-h-meta");
		const g = h.grade.replace(/[[\]]/g, "");
		gm.createSpan({ cls: "fch-grade-badge " + (/sahih|sahīh|ṣaḥīḥ/i.test(g) ? "is-sahih" : /hasan/i.test(g) ? "is-hasan" : "is-other"), text: g });
		gm.createSpan({ cls: "fch-muted fch-small", text: h.takhrij.replace(/[[\]]/g, "") });
		const st = r.createEl("button", { cls: "fch-q-hafal s" + v, text: STATUS[v] });
		st.onclick = (ev) => { ev.stopPropagation(); setHafal(p, e.key, ((v + 1) % 3) as 0 | 1 | 2); hub.renderPage(); };
		r.onclick = () => { open = open === e.key ? "" : e.key; showExp = false; hub.renderPage(); };
		if (open === e.key) {
			const b = row.createDiv("fch-h-body");
			arabicBlock(b, h);
			b.createDiv({ cls: "fch-h-tr", text: h.hadith_text });
			const a = b.createDiv("fch-row");
			btn(a, { text: "Latih hafalan", icon: "brain", cls: "fch-btn-primary fch-btn-sm", onClick: () => hub.startGame(new TextPractice(hub, e)) });
			btn(a, { text: showExp ? "Tutup penjelasan" : "Penjelasan & faedah", icon: "book-open", cls: "fch-btn-sm", onClick: () => { showExp = !showExp; hub.renderPage(); } });
			const link = a.createEl("a", { text: "HadeethEnc.com ↗", href: h.link, cls: "fch-small" });
			link.setAttr("target", "_blank");
			if (showExp) {
				b.createDiv({ cls: "fch-agenda-title fch-mt", text: "Penjelasan" });
				b.createDiv({ cls: "fch-h-exp", text: h.explanation });
				b.createDiv({ cls: "fch-agenda-title fch-mt", text: "Faedah" });
				b.createDiv({ cls: "fch-h-exp", text: h.benefits });
			}
			b.createDiv({ cls: "fch-muted fch-small fch-mt", text: SOURCE_LINE });
		}
	}
}

function renderMur(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const due = hMurDue(p).filter((k) => !k.startsWith("n:"));
	const box = el.createDiv("fch-panel");
	box.createEl("h3", { text: "🔁 Murajaah hadits & doa" });
	box.createDiv({ cls: "fch-muted fch-small fch-desc", text: "Hadits dan doa yang ditandai hafal dijadwalkan ulang dengan algoritma FSRS: yang lancar muncul makin jarang, yang lupa muncul lebih cepat." });
	const r = box.createDiv("fch-row");
	r.createDiv({ cls: "fch-mini-v", text: String(due.length) });
	r.createDiv({ cls: "fch-grow", text: `perlu dimurajaah hari ini · ${I(p).murLog[dayKey(Date.now())] ?? 0} selesai hari ini` });
	if (due.length) btn(r, { text: "Mulai murajaah", icon: "play", cls: "fch-btn-primary fch-btn-lg", onClick: () => hub.startGame(new HMurajaah(hub, due)) });
	else box.createDiv({ cls: "fch-empty fch-mt", text: Object.keys(I(p).mur).length ? "Tidak ada murajaah hari ini. 👍" : "Belum ada hafalan. Tandai hadits atau doa sebagai “Hafal” untuk mulai dijadwalkan." });
}

const entryOf = (key: string): Entry | null => {
	const [t, v] = key.split(":");
	if (t === "a") return { key, id: ARBAIN[+v], no: v };
	if (t === "m" || t === "d") return { key, id: +v, no: "" };
	return null;
};

// ================================================================ latihan hafalan teks
type PMode = "baca" | "tutup" | "awal";
export class TextPractice implements Game {
	ok = true;
	private mode: PMode = "baca";
	private count = 0;
	private goal = 10;
	private level = 1;
	private shown = new Set<number>();
	private el: HTMLElement | null = null;
	private keyH = (e: KeyboardEvent) => { if (this.el && e.key === " " && this.mode === "baca" && !(e.target as HTMLElement).closest("input,select")) { e.preventDefault(); this.tick(); } };
	constructor(private hub: HubView, private e: Entry) {}
	mount(el: HTMLElement) { this.el = el; document.addEventListener("keydown", this.keyH, true); this.draw(); }
	unmount() { document.removeEventListener("keydown", this.keyH, true); this.el = null; }
	private tick() { this.count++; play(this.count >= this.goal ? "correct" : "click"); if (this.count >= this.goal) new Notice("✅ Target pengulangan tercapai. Coba mode Tutup bertahap untuk menguji."); this.draw(); }
	private draw() {
		const root = this.el;
		if (!root) return;
		const p = this.hub.plugin;
		const h = hadeeth(this.e.id);
		root.empty();
		const wrap = root.createDiv("fch-q-practice");
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Keluar", onClick: () => this.hub.endGame() });
		const tt = top.createDiv("fch-study-title");
		tt.createDiv({ cls: "fch-study-name", text: `🧠 ${this.e.key.startsWith("a:") ? `Arbain no. ${this.e.no}` : "Hafalan"} · ${h.title.slice(0, 60)}` });
		tt.createDiv({ cls: "fch-muted fch-small", text: `${h.grade} ${h.takhrij}` });
		const seg = wrap.createDiv("fch-seg fch-q-modes");
		([["baca", "🔁 Baca & ulangi"], ["tutup", "🙈 Tutup bertahap"], ["awal", "🔤 Huruf awal"]] as [PMode, string][]).forEach(([m, l]) => {
			const b = seg.createEl("button", { cls: "fch-seg-btn" + (this.mode === m ? " is-active" : ""), text: l });
			b.onclick = () => { this.mode = m; this.shown = new Set(); this.count = 0; this.draw(); };
		});
		const card = wrap.createDiv("fch-card fch-q-pcard");
		const words = arText(h).text.split(/\s+/).filter(Boolean);
		if (this.mode === "baca") {
			arabicBlock(card, h);
			card.createDiv({ cls: "fch-h-tr", text: h.hadith_text });
			const c = card.createDiv("fch-row fch-center fch-mt");
			const b = btn(c, { text: `Sudah dibaca ${this.count}/${this.goal}`, cls: "fch-btn-primary fch-btn-xl", onClick: () => this.tick() });
			b.createSpan({ cls: "fch-kbd", text: "Spasi" });
			const gs = c.createEl("select", { cls: "dropdown fch-select" });
			[3, 5, 10, 20].forEach((v) => gs.createEl("option", { text: `target ${v}×`, attr: { value: String(v) } }));
			gs.value = String(this.goal);
			gs.onchange = () => { this.goal = parseInt(gs.value, 10); this.draw(); };
		} else {
			if (this.mode === "tutup") {
				const lv = card.createDiv("fch-row fch-center");
				lv.createSpan({ cls: "fch-small fch-muted", text: "Tingkat:" });
				["25%", "50%", "75%", "100%"].forEach((t, k) => btn(lv, { text: t, cls: "fch-btn-sm" + (this.level === k + 1 ? " fch-btn-primary" : ""), onClick: () => { this.level = k + 1; this.shown = new Set(); this.draw(); } }));
			}
			const line = card.createDiv({ cls: "fch-q-ar fch-h-ar fch-q-mask", attr: { dir: "rtl", lang: "ar" } });
			words.forEach((w, k) => {
				const hide = this.mode === "awal" || ((k * 17 + this.e.id) % 4) < this.level;
				if (!hide || this.shown.has(k)) { line.createSpan({ cls: "fch-q-w", text: w + " " }); return; }
				const letter = w.replace(/[\u064B-\u065F\u0670«»"'(),.:؛،]/g, "").charAt(0);
				const x = line.createSpan({ cls: "fch-q-w is-masked", text: this.mode === "awal" ? (letter || "•") + "ـ " : "ــــ " });
				x.onclick = () => { this.shown.add(k); this.draw(); };
			});
			card.createDiv({ cls: "fch-muted fch-small fch-center", text: "Baca dari ingatan. Klik kata yang tersembunyi untuk mengintip." });
			const r = card.createDiv("fch-row fch-center");
			btn(r, { text: "Tampilkan semua", cls: "fch-btn-sm", onClick: () => { words.forEach((_, k) => this.shown.add(k)); this.draw(); } });
			btn(r, { text: "Sembunyikan lagi", cls: "fch-btn-sm", onClick: () => { this.shown = new Set(); this.draw(); } });
			if (this.mode === "tutup" && this.level < 4) btn(r, { text: "Lancar → tingkat berikutnya", cls: "fch-btn-primary fch-btn-sm", onClick: () => { this.level++; this.shown = new Set(); play("correct"); this.draw(); } });
		}
		const v = I(p).hafal[this.e.key];
		const foot = wrap.createDiv("fch-row fch-center fch-mt");
		btn(foot, { text: v === 2 ? "✓ Sudah ditandai hafal" : "Tandai hafal", icon: "check", cls: v === 2 ? "" : "fch-btn-primary", disabled: v === 2, onClick: () => { setHafal(p, this.e.key, 2); new Notice("🧠 Ditandai hafal & masuk jadwal murajaah"); this.draw(); } });
		wrap.createDiv({ cls: "fch-muted fch-small fch-center fch-mt", text: SOURCE_LINE });
	}
}

// ================================================================ murajaah hadits & doa
class HMurajaah implements Game {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	ok: boolean;
	private i = 0;
	private revealed = false;
	private res: Grade[] = [];
	private el: HTMLElement | null = null;
	private keyH = (e: KeyboardEvent) => this.onKey(e);
	constructor(private hub: HubView, private keys: string[]) { this.ok = keys.length > 0; }
	mount(el: HTMLElement) { this.el = el; document.addEventListener("keydown", this.keyH, true); this.draw(); }
	unmount() { document.removeEventListener("keydown", this.keyH, true); this.el = null; }
	private onKey(e: KeyboardEvent) {
		if (!this.el || this.i >= this.keys.length) return;
		if (e.key === " " && !this.revealed) { e.preventDefault(); this.revealed = true; this.draw(); }
		else if (this.revealed && ["1", "2", "3", "4"].includes(e.key)) { e.preventDefault(); this.rate((parseInt(e.key, 10) - 1) as Grade); }
	}
	private rate(g: Grade) {
		const p = this.hub.plugin;
		const i = I(p);
		const key = this.keys[this.i];
		i.mur[key] = schedule(i.mur[key], g, Date.now(), p.data.settings);
		const k = dayKey(Date.now());
		i.murLog[k] = (i.murLog[k] ?? 0) + 1;
		p.addCoins(1);
		play(g >= 2 ? "correct" : "wrong");
		this.res.push(g);
		this.i++;
		this.revealed = false;
		p.requestSave();
		if (this.i >= this.keys.length) { play("victory"); p.checkAchievements(); }
		this.draw();
	}
	private draw(): void {
		const root = this.el;
		if (!root) return;
		const p = this.hub.plugin;
		root.empty();
		const wrap = root.createDiv("fch-q-practice");
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Keluar", onClick: () => this.hub.endGame() });
		top.createDiv("fch-study-title").createDiv({ cls: "fch-study-name", text: `🔁 Murajaah · ${Math.min(this.i + 1, this.keys.length)}/${this.keys.length}` });
		if (this.i >= this.keys.length) {
			const box = wrap.createDiv("fch-summary");
			box.createEl("h2", { text: "Murajaah selesai 🤲" });
			box.createEl("p", { cls: "fch-muted", text: `${this.res.filter((g) => g >= 2).length}/${this.res.length} lancar.` });
			btn(box, { text: "Kembali", cls: "fch-btn-primary", onClick: () => this.hub.endGame() });
			return;
		}
		const key = this.keys[this.i];
		const e = entryOf(key);
		if (!e) { this.i++; return this.draw(); }
		const h = hadeeth(e.id);
		const card = wrap.createDiv("fch-card fch-q-pcard");
		card.createDiv({ cls: "fch-q-title fch-center", text: (key.startsWith("a:") ? `Arbain no. ${e.no} · ` : "") + h.title });
		card.createDiv({ cls: "fch-muted fch-small fch-center", text: "Ucapkan dari ingatan, lalu buka untuk mengecek." });
		if (!this.revealed) {
			const b = btn(card.createDiv("fch-row fch-center fch-mt"), { text: "Tampilkan teks", icon: "eye", cls: "fch-btn-primary fch-btn-lg", onClick: () => { this.revealed = true; this.draw(); } });
			b.createSpan({ cls: "fch-kbd", text: "Spasi" });
			return;
		}
		arabicBlock(card, h);
		card.createDiv({ cls: "fch-h-tr", text: h.hadith_text });
		const st = I(p).mur[key];
		const grades = card.createDiv("fch-grades");
		([[0, "Lupa", "var(--fch-g0)"], [1, "Ragu", "var(--fch-g1)"], [2, "Lancar", "var(--fch-g2)"], [3, "Sangat lancar", "var(--fch-g3)"]] as [Grade, string, string][]).forEach(([g, l, c]) => {
			const b = grades.createEl("button", { cls: "fch-grade" });
			b.style.setProperty("--c", c);
			b.createDiv({ cls: "fch-grade-label", text: l });
			b.createDiv({ cls: "fch-grade-sub", text: `${formatInterval(previewInterval(st, g, p.data.settings))} · ${g + 1}` });
			b.onclick = () => this.rate(g);
		});
	}
}

// ================================================================ Asmaul Husna
let aFilter: "all" | "todo" | "done" = "all";
let aSel = 0;

export function renderAsmaul(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const i = I(p);
	const head = el.createDiv("fch-pagehead");
	decorateHero(p, head, "#7c3aed");
	head.createEl("h1", { text: "✨ Asmaul Husna" });
	head.createDiv({ cls: "fch-muted", text: "99 nama Allah yang indah. Tandai yang sudah hafal, lalu uji dengan kuis." });
	const done = hafalCountOf(p, "n:");
	const top = el.createDiv("fch-panel fch-row");
	const t = top.createDiv("fch-grow");
	t.createDiv({ cls: "fch-strong", text: `${done} / 99 hafal` });
	t.createDiv("fch-bar fch-mt").createDiv("fch-bar-fill").style.width = `${(done / 99) * 100}%`;
	const fs = top.createDiv("fch-seg");
	(["all", "todo", "done"] as const).forEach((f) => { const b = fs.createEl("button", { cls: "fch-seg-btn" + (aFilter === f ? " is-active" : ""), text: f === "all" ? "Semua" : f === "todo" ? "Belum" : "Hafal" }); b.onclick = () => { aFilter = f; hub.renderPage(); }; });
	const qz = el.createDiv("fch-row fch-mt");
	qz.createSpan({ cls: "fch-small fch-strong", text: "Kuis:" });
	const gs = qz.createEl("select", { cls: "dropdown fch-select" });
	gs.createEl("option", { text: "Semua (1–99)", attr: { value: "0" } });
	for (let g = 1; g <= 10; g++) gs.createEl("option", { text: `Kelompok ${(g - 1) * 10 + 1}–${Math.min(99, g * 10)}`, attr: { value: String(g) } });
	gs.value = String(aSel);
	gs.onchange = () => { aSel = parseInt(gs.value, 10); };
	btn(qz, { text: "Nama → arti", icon: "play", cls: "fch-btn-primary fch-btn-sm", onClick: () => hub.startGame(new AsmaQuiz(hub, aSel, "arti")) });
	btn(qz, { text: "Arti → nama", icon: "play", cls: "fch-btn-sm", onClick: () => hub.startGame(new AsmaQuiz(hub, aSel, "nama")) });
	const grid = el.createDiv("fch-asma-grid");
	for (const [n, ar, lat, arti] of ASMAUL_HUSNA) {
		const v = i.hafal[`n:${n}`] ?? 0;
		if (aFilter === "todo" && v === 2) continue;
		if (aFilter === "done" && v !== 2) continue;
		const c = grid.createEl("button", { cls: "fch-asma s" + v });
		c.createDiv({ cls: "fch-asma-no", text: String(n) });
		c.createDiv({ cls: "fch-asma-ar", text: ar, attr: { dir: "rtl", lang: "ar" } });
		c.createDiv({ cls: "fch-asma-lat", text: lat });
		c.createDiv({ cls: "fch-asma-arti", text: arti });
		c.createDiv({ cls: "fch-asma-st", text: STATUS[v] });
		c.onclick = () => { setHafal(p, `n:${n}`, ((v + 1) % 3) as 0 | 1 | 2); hub.renderPage(); };
	}
	el.createDiv({ cls: "fch-muted fch-small fch-mt fch-q-credit", text: "Daftar dan urutan mengikuti riwayat Tirmidzi yang masyhur; sebagian ulama berbeda pendapat tentang rincian daftar ini. Nama Arab dicocokkan dari dua sumber independen, dan arti adalah terjemahan ringkas yang umum dipakai." });
}

class AsmaQuiz implements Game {
	ok = true;
	private qs: number[];
	private i = 0;
	private score = 0;
	private picked: number | null = null;
	private opts: number[] = [];
	private wrong: number[] = [];
	private el: HTMLElement | null = null;
	private keyH = (e: KeyboardEvent) => { const n = parseInt(e.key, 10); if (!this.el) return; if (this.picked === null && n >= 1 && n <= 4) { e.preventDefault(); this.pick(n - 1); } else if (this.picked !== null && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); this.next(); } };
	constructor(private hub: HubView, group: number, private dir: "arti" | "nama") {
		const pool = ASMAUL_HUSNA.map((x) => x[0]).filter((n) => !group || (n > (group - 1) * 10 && n <= group * 10));
		this.qs = shuffle(pool).slice(0, Math.min(10, pool.length));
		this.makeOpts();
	}
	mount(el: HTMLElement) { this.el = el; document.addEventListener("keydown", this.keyH, true); this.draw(); }
	unmount() { document.removeEventListener("keydown", this.keyH, true); this.el = null; }
	private makeOpts() {
		const n = this.qs[this.i];
		if (!n) return;
		const meaning = (x: number) => ASMAUL_HUSNA[x - 1][3];
		const others = shuffle(ASMAUL_HUSNA.map((x) => x[0]).filter((x) => x !== n && meaning(x) !== meaning(n))).slice(0, 3);
		this.opts = shuffle([n, ...others]);
	}
	private pick(k: number) {
		this.picked = k;
		const ok = this.opts[k] === this.qs[this.i];
		if (ok) this.score++; else this.wrong.push(this.qs[this.i]);
		play(ok ? "correct" : "wrong");
		this.draw();
	}
	private next() {
		this.i++;
		this.picked = null;
		this.makeOpts();
		if (this.i >= this.qs.length) {
			this.hub.plugin.addCoins(this.score);
			play(this.score === this.qs.length ? "victory" : "chime");
		}
		this.draw();
	}
	private draw() {
		const root = this.el;
		if (!root) return;
		root.empty();
		const wrap = root.createDiv("fch-q-practice");
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Keluar", onClick: () => this.hub.endGame() });
		top.createDiv("fch-study-title").createDiv({ cls: "fch-study-name", text: `✨ Kuis Asmaul Husna · ${Math.min(this.i + 1, this.qs.length)}/${this.qs.length} · skor ${this.score}` });
		if (this.i >= this.qs.length) {
			const box = wrap.createDiv("fch-summary");
			box.createEl("h2", { text: `${this.score}/${this.qs.length} benar` });
			if (this.wrong.length) box.createEl("p", { cls: "fch-muted", text: "Perlu diulang: " + this.wrong.map((n) => ASMAUL_HUSNA[n - 1][2]).join(", ") });
			const r = box.createDiv("fch-row fch-center");
			const perfect = this.wrong.length === 0;
			if (perfect) btn(r, { text: "Tandai semua hafal", icon: "check", cls: "fch-btn-primary", onClick: () => { for (const n of this.qs) setHafal(this.hub.plugin, `n:${n}`, 2); this.hub.endGame(); } });
			btn(r, { text: "Kembali", onClick: () => this.hub.endGame() });
			if (perfect && this.hub.plugin.data.settings.confetti) confetti(root);
			return;
		}
		const n = this.qs[this.i];
		const [, ar, lat, arti] = ASMAUL_HUSNA[n - 1];
		const card = wrap.createDiv("fch-card fch-q-pcard");
		if (this.dir === "arti") {
			card.createDiv({ cls: "fch-asma-ar fch-asma-big", text: ar, attr: { dir: "rtl", lang: "ar" } });
			card.createDiv({ cls: "fch-q-title fch-center", text: lat });
		} else card.createDiv({ cls: "fch-q-title fch-center", text: arti });
		const list = card.createDiv("fch-choices");
		this.opts.forEach((x, k) => {
			let cls = "fch-choice";
			if (this.picked !== null && x === n) cls += " is-correct";
			if (this.picked === k && x !== n) cls += " is-wrong";
			const b = list.createEl("button", { cls });
			b.createSpan({ cls: "fch-choice-key", text: String(k + 1) });
			const it = ASMAUL_HUSNA[x - 1];
			b.createDiv({ cls: "fch-choice-text", text: this.dir === "arti" ? it[3] : `${it[1]}  ·  ${it[2]}` });
			b.disabled = this.picked !== null;
			b.onclick = () => this.pick(k);
		});
		if (this.picked !== null) { const b = btn(wrap.createDiv("fch-actions"), { text: "Lanjut", cls: "fch-btn-primary fch-btn-xl", onClick: () => this.next() }); b.createSpan({ cls: "fch-kbd", text: "Enter" }); }
	}
}
