import { App, Modal, Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { Card, Exam } from "./types";
import { DAY, addDays, dayKey, retention, startOfDay } from "./scheduler";
import { examCards, examPlan } from "./analytics";
import { materialPicker } from "./picker";
import { planExam } from "./projects";
import { openSim } from "./pages/launch";
import { basename, btn, confetti } from "./util";
import { play } from "./sound";

const uid = (s: string) => s + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const D = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const keyT = (k: string) => new Date(k + "T00:00:00").getTime();
export const daysTo = (e: Exam) => Math.round((keyT(e.date) - startOfDay(Date.now())) / DAY);
const fmtDate = (k: string) => new Date(keyT(k)).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Kesiapan: porsi kartu dipelajari × rata-rata prediksi ingatan pada hari ujian. */
export function readiness(p: FlashcardPlugin, e: Exam) {
	const cards = examCards(p, e);
	const at = keyT(e.date) + 8 * 3600_000;
	let learned = 0, rs = 0, rn = 0;
	for (const c of cards) {
		const st = p.data.cards[c.id];
		const r = retention(st, at);
		if (r === null) continue;
		learned++;
		rs += r;
		rn++;
	}
	const pred = rn ? rs / rn : 0;
	const share = cards.length ? learned / cards.length : 0;
	return { cards, total: cards.length, learned, pred, score: share * pred };
}

// ---------------------------------------------------------------- peta jalan
type SKind = "learn" | "review" | "quiz" | "read" | "sim" | "weak" | "exam";
interface Step { kind: SKind; icon: string; text: string; sub?: string; path?: string; n?: number }
interface RDay { k: string; idx: number; phase: string; color: string; steps: Step[] }
export const PHASES = [
	{ id: "learn", label: "Pelajari materi", icon: "📘", color: "#6366f1" },
	{ id: "review", label: "Ulas & perkuat", icon: "🔁", color: "#0ea5e9" },
	{ id: "sim", label: "Simulasi", icon: "📝", color: "#f59e0b" },
	{ id: "weak", label: "Latih tersulit", icon: "🎯", color: "#ef4444" },
	{ id: "exam", label: "Hari H", icon: "🎓", color: "#10b981" },
];

export function roadmap(p: FlashcardPlugin, e: Exam): RDay[] {
	const D0 = daysTo(e);
	if (D0 < 0) return [];
	const plan = examPlan(p, e);
	const paths = (e.paths.length ? e.paths : p.sortedPaths()).filter((x) => p.index.has(x));
	const fresh = new Map<string, number>();
	for (const c of plan.cards) if (!p.data.cards[c.id] || !p.data.cards[c.id].history?.length) fresh.set(c.path, (fresh.get(c.path) ?? 0) + 1);
	const learnDays = D0 >= 6 ? Math.floor(D0 * 0.6) : Math.max(1, D0 - 2);
	const totalFresh = [...fresh.values()].reduce((a, n) => a + n, 0);
	const perDay = Math.max(1, Math.ceil(totalFresh / Math.max(1, learnDays)));
	const queue = paths.filter((x) => (fresh.get(x) ?? 0) > 0).map((x) => ({ path: x, left: fresh.get(x)! }));
	const out: RDay[] = [];
	let readI = 0;
	for (let i = 0; i <= D0; i++) {
		const k = dayKey(addDays(startOfDay(Date.now()), i));
		const steps: Step[] = [];
		let phase = "review";
		if (i === D0) { phase = "exam"; steps.push({ kind: "exam", icon: "🎓", text: `Hari ujian: ${e.name}`, sub: "Ulas ringan 10 menit, sarapan, dan berdoa. Semoga lancar!" }); }
		else if (D0 >= 2 && i === D0 - 1) { phase = "weak"; steps.push({ kind: "weak", icon: "🎯", text: "Latih 30 kartu tersulit", sub: "Kartu dengan ingatan paling rendah" }, { kind: "review", icon: "🔁", text: "Ulas kartu jatuh tempo" }); }
		else if (D0 >= 3 && i === D0 - 3) { phase = "sim"; steps.push({ kind: "sim", icon: "📝", text: "Simulasi ujian", sub: "Soal campuran, berwaktu, dengan perkiraan nilai" }, { kind: "review", icon: "🔁", text: "Ulas kartu jatuh tempo" }); }
		else if (i < learnDays && queue.length) {
			phase = "learn";
			let need = perDay;
			while (need > 0 && queue.length) {
				const q = queue[0];
				const take = Math.min(need, q.left);
				steps.push({ kind: "learn", icon: "📘", text: `Pelajari ${basename(q.path)}`, sub: `${take} kartu baru`, path: q.path, n: take });
				q.left -= take;
				need -= take;
				if (q.left <= 0) queue.shift();
			}
			steps.push({ kind: "review", icon: "🔁", text: "Ulas kartu jatuh tempo" });
		} else {
			phase = "review";
			steps.push({ kind: "review", icon: "🔁", text: "Ulas kartu jatuh tempo" }, { kind: "quiz", icon: "❓", text: "Kuis campuran semua materi", sub: "Latihan bebas, jadwal kartu tidak berubah" });
			if (paths.length) { const path = paths[readI++ % paths.length]; steps.push({ kind: "read", icon: "📖", text: `Baca ulang ${basename(path)}`, path }); }
		}
		const ph = PHASES.find((x) => x.id === phase)!;
		out.push({ k, idx: i, phase, color: ph.color, steps });
	}
	return out;
}

/** Hari-hari ketika kartu ujian benar-benar dipelajari (untuk tanda ✓ di peta jalan). */
function activeDays(p: FlashcardPlugin, cards: Card[]): Set<string> {
	const s = new Set<string>();
	for (const c of cards) for (const h of p.data.cards[c.id]?.history ?? []) s.add(dayKey(h.t));
	return s;
}

export function runStep(hub: HubView, e: Exam, st: Step) {
	const p = hub.plugin;
	const cards = examCards(p, e);
	const mode = p.data.settings.defaultMode;
	switch (st.kind) {
		case "learn": return void hub.startSession(st.path ? p.index.get(st.path) ?? [] : cards, { title: `${e.name} · ${st.path ? basename(st.path) : "materi"}`, cram: false, mode, examId: e.id });
		case "review":
			if (!p.buildQueue(cards, false).length) return void new Notice("Tidak ada kartu ujian yang jatuh tempo hari ini. 👍 Coba kuis campuran.");
			return void hub.startSession(cards, { title: `${e.name} · ulasan`, cram: false, mode, examId: e.id });
		case "quiz": return void hub.startSession(cards, { title: `${e.name} · kuis`, cram: true, mode: "quiz" });
		case "read": if (st.path) void p.openAt(st.path, 0); return;
		case "sim": return openSim(hub, cards, e.name, e.date);
		case "weak": {
			const now = Date.now();
			const weak = cards.filter((c) => p.data.cards[c.id]?.history?.length).sort((a, b) => (retention(p.data.cards[a.id], now) ?? 1) - (retention(p.data.cards[b.id], now) ?? 1)).slice(0, 30);
			if (!weak.length) return void new Notice("Belum ada kartu yang dipelajari untuk ujian ini.");
			return void hub.startSession(weak, { title: `${e.name} · tersulit`, cram: true, mode });
		}
		case "exam": {
			const q = p.quickQueue(10, cards);
			if (!q.length) return void new Notice("Tidak ada kartu untuk diulas.");
			return void hub.startSession(q, { title: `${e.name} · ulas ringan`, cram: true, mode, timeLimit: 10 * 60_000, exact: true });
		}
	}
}

// ---------------------------------------------------------------- modal ujian
export class ExamEditModal extends Modal {
	private e: Exam;
	private isNew: boolean;
	private sel: Set<string>;
	private makeBlock = true;
	private makeTasks = true;
	private time = "19:00";
	private dur = 30;
	private days = new Set([0, 1, 2, 3, 4, 5, 6]);
	constructor(app: App, private p: FlashcardPlugin, private done: (e?: Exam) => void, e?: Exam) {
		super(app);
		this.isNew = !e;
		this.e = e ? { ...e, paths: [...e.paths] } : { id: uid("e"), name: "", date: dayKey(addDays(startOfDay(Date.now()), 14)), paths: [] };
		this.sel = new Set(this.e.paths);
		const blk = p.data.blocks.find((b) => b.target === "exam:" + this.e.id);
		if (blk) { this.time = blk.time; this.dur = blk.duration; this.days = new Set(blk.days); }
		this.makeBlock = this.isNew || !!blk;
		this.makeTasks = this.isNew;
	}
	onOpen() {
		this.modalEl.addClass("fch-modal", "fch-exam-modal");
		const el = this.contentEl;
		el.empty();
		const e = this.e;
		el.createDiv({ cls: "fch-modal-title", text: this.isNew ? "🎓 Ujian baru" : "🎓 Ubah ujian" });
		const f = (label: string, parent: HTMLElement = el) => { const x = parent.createDiv("fch-field"); x.createEl("label", { text: label }); return x; };
		const name = f("Nama ujian").createEl("input", { type: "text", cls: "fch-input", attr: { placeholder: "mis. UTS Biologi, Ujian Tahfidz Juz 30" } });
		name.value = e.name;
		name.oninput = () => (e.name = name.value);
		const row = el.createDiv("fch-task-grid");
		const date = f("Tanggal ujian", row).createEl("input", { type: "date", cls: "fch-input" });
		date.value = e.date;
		date.min = dayKey(Date.now());
		date.onchange = () => { e.date = date.value || e.date; info.setText(this.dateInfo()); };
		const tm = f("Jam ujian (opsional)", row).createEl("input", { type: "time", cls: "fch-input" });
		tm.value = (e as Exam & { time?: string }).time ?? "";
		tm.onchange = () => ((e as Exam & { time?: string }).time = tm.value || undefined);
		const quick = el.createDiv("fch-row");
		for (const [l, n] of [["1 minggu lagi", 7], ["2 minggu", 14], ["1 bulan", 30], ["2 bulan", 60]] as [string, number][])
			btn(quick, { text: l, cls: "fch-btn-sm fch-btn-ghost", onClick: () => { e.date = dayKey(addDays(startOfDay(Date.now()), n)); date.value = e.date; info.setText(this.dateInfo()); } });
		const info = el.createDiv({ cls: "fch-small fch-strong fch-exam-dinfo", text: this.dateInfo() });
		el.createDiv({ cls: "fch-agenda-title fch-mt", text: "Berkas / materi ujian" });
		el.createDiv({ cls: "fch-muted fch-small", text: "Pilih catatan (berkas) berisi flashcard yang diujikan. Peta jalan belajar disusun dari berkas-berkas ini." });
		materialPicker(this.p, el, this.sel);
		el.createDiv({ cls: "fch-agenda-title fch-mt", text: "Rencana otomatis" });
		const t1 = el.createEl("label", { cls: "fch-toggle" });
		const c1 = t1.createEl("input", { type: "checkbox" });
		c1.checked = this.makeBlock;
		c1.onchange = () => { this.makeBlock = c1.checked; this.onOpen(); };
		t1.createSpan({ text: "Jadwal belajar harian sampai hari ujian (dengan pengingat & tombol Mulai)" });
		if (this.makeBlock) {
			const r2 = el.createDiv("fch-task-grid");
			const ti = f("Jam belajar", r2).createEl("input", { type: "time", cls: "fch-input" });
			ti.value = this.time;
			ti.onchange = () => (this.time = ti.value || "19:00");
			const du = f("Durasi", r2).createEl("select", { cls: "dropdown fch-select" });
			[15, 20, 30, 45, 60, 90].forEach((v) => du.createEl("option", { text: `${v} menit`, attr: { value: String(v) } }));
			du.value = String(this.dur);
			du.onchange = () => (this.dur = parseInt(du.value, 10));
			const dd = el.createDiv("fch-row");
			[1, 2, 3, 4, 5, 6, 0].forEach((d) => { const c = dd.createEl("button", { cls: "fch-chip" + (this.days.has(d) ? " is-active" : ""), text: D[d] }); c.onclick = () => { if (this.days.has(d)) this.days.delete(d); else this.days.add(d); c.toggleClass("is-active", this.days.has(d)); }; });
		}
		const t2 = el.createEl("label", { cls: "fch-toggle" });
		const c2 = t2.createEl("input", { type: "checkbox" });
		c2.checked = this.makeTasks;
		c2.onchange = () => (this.makeTasks = c2.checked);
		t2.createSpan({ text: this.isNew ? "Buat tugas persiapan (pelajari per materi, simulasi H-3, latih H-1)" : "Susun ulang tugas persiapan" });
		const foot = el.createDiv("fch-modal-foot fch-mt");
		if (!this.isNew) btn(foot, { text: "Hapus ujian", icon: "trash-2", cls: "fch-btn-ghost fch-danger", onClick: () => this.remove() });
		foot.createDiv("fch-grow");
		btn(foot, { text: "Batal", cls: "fch-btn-ghost", onClick: () => this.close() });
		btn(foot, { text: this.isNew ? "Buat ujian & rencana" : "Simpan", icon: "check", cls: "fch-btn-primary", onClick: () => this.save() });
		if (this.isNew) window.setTimeout(() => name.focus(), 30);
	}
	private dateInfo() {
		const n = Math.round((keyT(this.e.date) - startOfDay(Date.now())) / DAY);
		return `📅 ${fmtDate(this.e.date)} · ${n === 0 ? "hari ini" : n > 0 ? `H-${n} (${n} hari lagi)` : "sudah lewat"}`;
	}
	private save() {
		const p = this.p, e = this.e;
		if (!e.name.trim()) return void new Notice("Isi nama ujian.");
		if (daysTo(e) < 0) return void new Notice("Tanggal ujian sudah lewat.");
		e.name = e.name.trim();
		e.paths = p.sortedPaths().filter((x) => this.sel.has(x));
		p.data.exams = [...p.data.exams.filter((x) => x.id !== e.id), e].sort((a, b) => a.date.localeCompare(b.date));
		const target = "exam:" + e.id;
		const last = dayKey(addDays(keyT(e.date), -1));
		const old = p.data.blocks.find((b) => b.target === target);
		if (this.makeBlock && daysTo(e) > 0) {
			const b = old ?? { id: uid("b"), kind: "cards" as const, target, title: "", days: [], time: this.time, duration: this.dur, remind: true, created: dayKey(Date.now()), log: {} };
			Object.assign(b, { title: `Belajar ${e.name}`, days: [...this.days], time: this.time, duration: this.dur, until: last });
			if (!old) p.data.blocks.push(b);
		} else if (old) p.data.blocks = p.data.blocks.filter((b) => b !== old);
		if (this.makeTasks && daysTo(e) > 0) planExam(p, e);
		p.requestSave();
		p.refreshViews();
		play("coin");
		new Notice(`🎓 ${e.name} · ${fmtDate(e.date)} · peta jalan belajar siap.`);
		this.close();
		this.done(e);
	}
	private remove() {
		const p = this.p, e = this.e;
		if (!window.confirm(`Hapus ujian “${e.name}”? Jadwal belajar & tugas persiapan yang belum selesai ikut dihapus.`)) return;
		p.data.exams = p.data.exams.filter((x) => x.id !== e.id);
		p.data.blocks = p.data.blocks.filter((b) => b.target !== "exam:" + e.id);
		p.data.tasks = p.data.tasks.filter((t) => !(t.planId === e.id && !t.done));
		for (const pr of p.data.projects) if (pr.examId === e.id) pr.archived = true;
		p.requestSave();
		p.refreshViews();
		this.close();
		this.done();
	}
	onClose() { this.contentEl.empty(); }
}

// ---------------------------------------------------------------- halaman Ujian
let selected = "";
export const selectExam = (id: string) => { selected = id; };

export function renderExams(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const upcoming = p.data.exams.filter((e) => daysTo(e) >= 0).sort((a, b) => a.date.localeCompare(b.date));
	const past = p.data.exams.filter((e) => daysTo(e) < 0).sort((a, b) => b.date.localeCompare(a.date));
	const head = el.createDiv("fch-pagehead fch-pagehead-row");
	const ht = head.createDiv();
	ht.createEl("h1", { text: "🎓 Ujian" });
	ht.createDiv({ cls: "fch-muted", text: "Atur tanggal ujian dan berkas materinya; peta jalan belajar harian disusun otomatis sampai hari H." });
	btn(head, { text: "Ujian baru", icon: "plus", cls: "fch-btn-primary", onClick: () => new ExamEditModal(hub.app, p, (e) => { if (e) selected = e.id; hub.renderPage(); }).open() });

	if (!upcoming.length) {
		const em = el.createDiv("fch-exam-empty");
		em.createDiv({ cls: "fch-exam-empty-ic", text: "🎓" });
		em.createEl("h3", { text: past.length ? "Tidak ada ujian mendatang" : "Belum ada ujian" });
		const steps = em.createDiv("fch-exam-how");
		[["1", "Pilih tanggal", "Tentukan hari ujian dan jamnya"], ["2", "Pilih berkas", "Catatan berisi flashcard yang diujikan"], ["3", "Ikuti peta jalan", "Langkah belajar harian disusun otomatis"]].forEach(([n, t, d]) => { const s = steps.createDiv("fch-exam-how-it"); s.createDiv({ cls: "fch-exam-how-n", text: n }); s.createDiv({ cls: "fch-strong", text: t }); s.createDiv({ cls: "fch-muted fch-small", text: d }); });
		btn(em, { text: "Buat ujian pertama", icon: "plus", cls: "fch-btn-primary fch-btn-lg", onClick: () => new ExamEditModal(hub.app, p, (e) => { if (e) selected = e.id; hub.renderPage(); }).open() });
	}
	if (upcoming.length) {
		if (!upcoming.some((e) => e.id === selected)) selected = upcoming[0].id;
		const e = upcoming.find((x) => x.id === selected)!;
		// pemilih ujian
		if (upcoming.length > 1) {
			const tabs = el.createDiv("fch-exam-tabs");
			for (const x of upcoming) {
				const t = tabs.createEl("button", { cls: "fch-exam-tab" + (x.id === selected ? " is-on" : "") });
				t.createSpan({ cls: "fch-exam-tab-h", text: daysTo(x) === 0 ? "Hari ini" : `H-${daysTo(x)}` });
				t.createSpan({ text: x.name });
				t.onclick = () => { selected = x.id; hub.renderPage(); };
			}
		}
		renderExamHero(hub, el, e);
		renderRoadmap(hub, el, e);
	}
	if (past.length) {
		const ps = el.createDiv("fch-panel fch-mt");
		ps.createEl("h3", { text: "Ujian yang sudah lewat" });
		for (const x of past.slice(0, 10)) {
			const r = ps.createDiv("fch-cal-row");
			r.createSpan({ text: `🎓 ${x.name}` });
			r.createSpan({ cls: "fch-muted", text: new Date(keyT(x.date)).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) });
			btn(r, { icon: "trash-2", cls: "fch-btn-ghost fch-btn-sm", label: "Hapus", onClick: () => { p.data.exams = p.data.exams.filter((y) => y.id !== x.id); p.data.blocks = p.data.blocks.filter((b) => b.target !== "exam:" + x.id); p.requestSave(); hub.renderPage(); } });
		}
	}
}

function renderExamHero(hub: HubView, el: HTMLElement, e: Exam) {
	const p = hub.plugin;
	const n = daysTo(e);
	const rd = readiness(p, e);
	const plan = examPlan(p, e);
	const hero = el.createDiv("fch-exam-hero");
	const l = hero.createDiv("fch-exam-hero-l");
	const top = l.createDiv("fch-row");
	top.createDiv({ cls: "fch-exam-count", text: n === 0 ? "HARI H" : `H-${n}` });
	const tt = top.createDiv("fch-grow");
	tt.createDiv({ cls: "fch-exam-name", text: e.name });
	const tm = (e as Exam & { time?: string }).time;
	tt.createDiv({ cls: "fch-exam-date", text: `${fmtDate(e.date)}${tm ? " · pukul " + tm : ""}` });
	// ubah tanggal langsung
	const dr = l.createDiv("fch-row fch-exam-dater");
	dr.createSpan({ cls: "fch-small", text: "📅 Tanggal:" });
	const di = dr.createEl("input", { type: "date", cls: "fch-input" });
	di.value = e.date;
	di.min = dayKey(Date.now());
	di.onchange = () => {
		if (!di.value) return;
		e.date = di.value;
		const blk = p.data.blocks.find((b) => b.target === "exam:" + e.id);
		if (blk) blk.until = dayKey(addDays(keyT(e.date), -1));
		if (p.data.tasks.some((t) => t.planId === e.id)) planExam(p, e); // tugas persiapan ikut tanggal baru
		p.requestSave();
		new Notice(`📅 Tanggal ${e.name} diubah ke ${fmtDate(e.date)}. Peta jalan disusun ulang.`);
		hub.renderPage();
	};
	const mats = l.createDiv("fch-exam-mats");
	const paths = e.paths.length ? e.paths : ["(semua materi)"];
	for (const x of paths.slice(0, 8)) mats.createSpan({ cls: "fch-exam-mat", text: "📄 " + basename(x) });
	if (paths.length > 8) mats.createSpan({ cls: "fch-exam-mat", text: `+${paths.length - 8}` });
	const stats = l.createDiv("fch-exam-stats");
	const st = (v: string, lbl: string) => { const s = stats.createDiv("fch-exam-stat"); s.createDiv({ cls: "fch-exam-sv", text: v }); s.createDiv({ cls: "fch-exam-sl", text: lbl }); };
	st(`${rd.learned}/${rd.total}`, "kartu dipelajari");
	st(rd.learned ? `${Math.round(rd.pred * 100)}%` : "—", "prediksi ingatan di hari H");
	st(String(plan.quota), "kartu baru/hari");
	st(String(plan.due), "ulasan hari ini");
	const acts = l.createDiv("fch-row fch-mt");
	const rm = roadmap(p, e);
	const today = rm[0];
	if (today) btn(acts, { text: `Mulai sesi hari ini · ${today.steps[0].text}`, icon: "play", cls: "fch-btn-primary fch-btn-lg", onClick: () => runStep(hub, e, today.steps[0]) });
	btn(acts, { text: "Simulasi", icon: "file-check", cls: "fch-btn-sm", onClick: () => openSim(hub, rd.cards, e.name, e.date) });
	btn(acts, { text: "Ubah", icon: "pencil", cls: "fch-btn-sm", onClick: () => new ExamEditModal(hub.app, p, () => hub.renderPage(), e).open() });
	const r = hero.createDiv("fch-exam-hero-r");
	const ring = r.createDiv("fch-exam-ring");
	ring.style.setProperty("--p", String(rd.score));
	const ri = ring.createDiv("fch-exam-ring-in");
	ri.createDiv({ cls: "fch-exam-rv", text: `${Math.round(rd.score * 100)}%` });
	ri.createDiv({ cls: "fch-small", text: "kesiapan" });
	r.createDiv({ cls: "fch-small fch-exam-rhint", text: rd.score >= 0.8 ? "Siap tempur! 💪" : rd.score >= 0.5 ? "Sudah separuh jalan" : n <= 3 ? "Fokus pada kartu tersulit" : "Ikuti peta jalan setiap hari" });
	if (rd.score >= 0.8 && p.data.settings.confetti && n <= 1) confetti(hero);
}

function renderRoadmap(hub: HubView, el: HTMLElement, e: Exam) {
	const p = hub.plugin;
	const rm = roadmap(p, e);
	const act = activeDays(p, examCards(p, e));
	const box = el.createDiv("fch-panel fch-mt fch-road");
	const h = box.createDiv("fch-section-head");
	h.createEl("h3", { text: "🗺️ Peta jalan belajar" });
	h.createSpan({ cls: "fch-muted fch-small", text: `${rm.length} hari sampai ujian` });
	// strip fase
	const strip = box.createDiv("fch-road-phases");
	for (const ph of PHASES) {
		const ds = rm.filter((d) => d.phase === ph.id);
		if (!ds.length) continue;
		const c = strip.createDiv("fch-road-phase");
		c.style.setProperty("--c", ph.color);
		c.style.flexGrow = String(ds.length);
		c.createDiv({ cls: "fch-strong fch-small", text: `${ph.icon} ${ph.label}` });
		const a = new Date(keyT(ds[0].k)), b = new Date(keyT(ds[ds.length - 1].k));
		c.createDiv({ cls: "fch-road-pd", text: ds.length === 1 ? a.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : `${a.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${b.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}` });
	}
	const tl = box.createDiv("fch-road-tl");
	for (const d of rm) {
		const isToday = d.idx === 0;
		const row = tl.createDiv("fch-road-day" + (isToday ? " is-today" : "") + (d.phase === "exam" ? " is-exam" : ""));
		row.style.setProperty("--c", d.color);
		const dt = row.createDiv("fch-road-date");
		const t = new Date(keyT(d.k));
		dt.createDiv({ cls: "fch-road-dn", text: String(t.getDate()) });
		dt.createDiv({ cls: "fch-road-dw", text: isToday ? "Hari ini" : t.toLocaleDateString("id-ID", { weekday: "short" }) });
		row.createDiv("fch-road-node").setText(act.has(d.k) ? "✓" : "");
		const body = row.createDiv("fch-road-body");
		body.createDiv({ cls: "fch-road-ph", text: `${PHASES.find((x) => x.id === d.phase)!.icon} ${PHASES.find((x) => x.id === d.phase)!.label}${d.phase === "exam" ? "" : ` · H-${rm.length - 1 - d.idx}`}` });
		for (const s of d.steps) {
			const r = body.createDiv("fch-road-step");
			r.createSpan({ text: s.icon });
			const tx = r.createDiv("fch-grow");
			tx.createSpan({ cls: "fch-road-st", text: s.text });
			if (s.sub) tx.createSpan({ cls: "fch-road-ss", text: ` · ${s.sub}` });
			if (isToday) btn(r, { text: "Mulai", icon: "play", cls: "fch-btn-sm" + (s === d.steps[0] ? " fch-btn-primary" : ""), onClick: () => runStep(hub, e, s) });
		}
	}
	if (rm.length > 1) box.createDiv({ cls: "fch-muted fch-small fch-mt", text: "✓ = hari ketika kartu ujian benar-benar kamu pelajari. Peta jalan menyesuaikan otomatis dengan progresmu setiap hari." });
}
