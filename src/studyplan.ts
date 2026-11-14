import { App, Menu, Modal, Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { BlockKind, StudyBlock, StudyMode } from "./types";
import { addDays, dayKey, startOfDay } from "./scheduler";
import { noteFiles, openNote } from "./notes";
import { HafalanPractice, MurajaahGame, TOTAL, fromGid, murDue, openReader, surahRange } from "./quran";
import { openHaditsTab } from "./hadits";
import { materialPicker } from "./picker";
import { basename, btn } from "./util";
import { play } from "./sound";

const uid = () => "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const D = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);

export const KINDS: { id: BlockKind; label: string; icon: string }[] = [
	{ id: "cards", label: "Flashcard", icon: "🧠" },
	{ id: "note", label: "Baca ulang catatan", icon: "🗒️" },
	{ id: "tilawah", label: "Tilawah Al-Qur'an", icon: "📖" },
	{ id: "ziyadah", label: "Hafalan baru Al-Qur'an (ziyadah)", icon: "🧠" },
	{ id: "murajaah", label: "Murajaah Al-Qur'an", icon: "🔁" },
	{ id: "hadits", label: "Hafalan hadits & doa", icon: "📜" },
	{ id: "asma", label: "Asmaul Husna", icon: "✨" },
	{ id: "custom", label: "Belajar lainnya", icon: "📚" },
];
const kindOf = (k: BlockKind) => KINDS.find((x) => x.id === k) ?? KINDS[0];

export function targetLabel(p: FlashcardPlugin, b: StudyBlock): string {
	if (b.title) return b.title;
	if (b.kind === "cards" && b.target.startsWith("exam:")) return `Ujian ${p.data.exams.find((e) => e.id === b.target.slice(5))?.name ?? ""}`.trim();
	if (b.kind === "cards") return b.target === "all" ? "Semua kartu jatuh tempo" : b.target.startsWith("folder:") ? `Folder ${b.target.slice(7) || "utama"}` : basename(b.target.replace(/^file:/, ""));
	if (b.kind === "note") return basename(b.target) || "Catatan";
	return kindOf(b.kind).label;
}

/** Jadwal yang jatuh pada tanggal k. */
export function blocksOn(p: FlashcardPlugin, k: string): StudyBlock[] {
	const dow = new Date(k + "T00:00:00").getDay();
	return p.data.blocks.filter((b) => (b.date ? b.date === k : b.days.includes(dow) && b.created <= k && (!b.until || k <= b.until))).sort((a, b) => a.time.localeCompare(b.time));
}
export const blockState = (b: StudyBlock, k: string) => b.log[k] ?? 0;

function cardsFor(hub: HubView, b: StudyBlock) {
	return hub.cardsForScope(b.target || "all");
}

/** Mulai sesi dari jadwal: langsung membuka hal yang dijadwalkan. */
export function startBlock(hub: HubView, b: StudyBlock) {
	const p = hub.plugin;
	const k = dayKey(Date.now());
	const mark = () => {
		if (b.log[k] !== 1) { b.log[k] = 1; p.data.meta.blocksDone = (p.data.meta.blocksDone ?? 0) + 1; p.track("block"); p.addCoins(3); }
		p.requestSave();
		p.checkAchievements();
	};
	const title = targetLabel(p, b);
	switch (b.kind) {
		case "cards": {
			const cards = cardsFor(hub, b);
			if (!cards.length) return void new Notice("Materi pada jadwal ini belum punya kartu.");
			mark();
			const opts = { title, mode: b.mode ?? p.data.settings.defaultMode, timeLimit: b.duration * 60_000, examId: b.target.startsWith("exam:") ? b.target.slice(5) : undefined };
			if (!p.buildQueue(cards, false).length) {
				new Notice("Tidak ada kartu jatuh tempo di jadwal ini, jadi dibuka sebagai latihan bebas (jadwal kartu tidak berubah).");
				hub.startSession(cards, { ...opts, cram: true });
			} else hub.startSession(cards, { ...opts, cram: false });
			return;
		}
		case "note": {
			const f = p.app.vault.getAbstractFileByPath(b.target);
			if (!f) return void new Notice("Catatan pada jadwal ini tidak ditemukan (mungkin sudah dipindah atau dihapus).");
			mark();
			if (noteFiles(p).some((x) => x.path === b.target)) { openNote(b.target); hub.navigate("notes"); }
			else void p.openAt(b.target, 0);
			return;
		}
		case "tilawah": {
			mark();
			const g = p.data.quran.last ? Math.min(TOTAL, p.data.quran.last.g + 1) : 1;
			openReader(fromGid(g)[0], g);
			hub.navigate("quran");
			return;
		}
		case "ziyadah": {
			mark();
			const q = p.data.quran;
			const s = q.focusSurah ?? 114;
			const [a, z] = surahRange(s);
			let g = a;
			while (g <= z && q.hafal[g] === 2) g++;
			if (g > z) { new Notice("Surah yang sedang dihafal sudah selesai. Pilih surah berikutnya di Al-Qur'an → Hafalan."); hub.navigate("quran"); return; }
			hub.startGame(new HafalanPractice(hub, g, Math.min(z, g + Math.max(1, q.ziyadah) - 1)));
			return;
		}
		case "murajaah": {
			mark();
			const due = murDue(p);
			if (due.length) hub.startGame(new MurajaahGame(hub, due));
			else { new Notice("Tidak ada halaman yang perlu dimurajaah hari ini. 👍"); hub.navigate("quran"); }
			return;
		}
		case "hadits": mark(); openHaditsTab("murajaah"); hub.navigate("hadits"); return;
		case "asma": mark(); hub.navigate("asmaul"); return;
		default:
			mark();
			if (!p.pomo.running) p.pomo.toggle();
			p.data.meta.pomoTask = title;
			new Notice(`📚 Jadwal "${title}" dimulai, Pomodoro berjalan.`);
			hub.navigate("focus");
	}
}

/** Pengingat jadwal (dicek tiap 30 detik): notifikasi dengan tombol Mulai. */
export function checkBlockReminders(p: FlashcardPlugin) {
	const now = new Date(), k = dayKey(now.getTime()), m = now.getHours() * 60 + now.getMinutes();
	for (const b of blocksOn(p, k)) {
		if (!b.remind || b.reminded === k || b.log[k]) continue;
		const at = toMin(b.time);
		if (m >= at && m < at + 60) {
			b.reminded = k;
			p.requestSave();
			play("chime");
			const frag = createFragment((f) => {
				f.createDiv({ text: `📚 Waktunya belajar (${b.time}): ${targetLabel(p, b)}` });
				const bt = f.createEl("button", { text: "Mulai sekarang", cls: "mod-cta" });
				bt.style.marginTop = "6px";
				bt.onclick = async () => { const h = await p.openHub(); startBlock(h, b); };
			});
			new Notice(frag, 30_000);
		}
	}
}

/** Menu aksi untuk satu jadwal (klik di garis waktu, Beranda, Kalender). */
export function blockMenu(hub: HubView, b: StudyBlock, e: MouseEvent, k = dayKey(Date.now())) {
	const p = hub.plugin;
	const m = new Menu();
	m.addItem((i) => i.setTitle("Mulai sekarang").setIcon("play").onClick(() => startBlock(hub, b)));
	m.addItem((i) => i.setTitle(b.log[k] === 1 ? "Batalkan tanda selesai" : "Tandai selesai").setIcon("check").onClick(() => { if (b.log[k] === 1) delete b.log[k]; else b.log[k] = 1; p.requestSave(); hub.renderPage(); }));
	m.addItem((i) => i.setTitle(b.log[k] === 2 ? "Jangan lewati" : "Lewati hari ini").setIcon("skip-forward").onClick(() => { if (b.log[k] === 2) delete b.log[k]; else b.log[k] = 2; p.requestSave(); hub.renderPage(); }));
	m.addSeparator();
	m.addItem((i) => i.setTitle("Ubah jadwal…").setIcon("pencil").onClick(() => new BlockModal(hub.app, p, () => hub.renderPage(), b).open()));
	m.showAtMouseEvent(e);
}

// ---------------------------------------------------------------- modal
export class BlockModal extends Modal {
	private b: StudyBlock;
	private isNew: boolean;
	constructor(app: App, private p: FlashcardPlugin, private done: () => void, b?: StudyBlock, preset: Partial<StudyBlock> = {}) {
		super(app);
		this.isNew = !b;
		const today = dayKey(Date.now());
		this.b = b ? { ...b, days: [...b.days], log: b.log } : { id: uid(), kind: "cards", target: "all", title: "", days: [1, 2, 3, 4, 5], time: "19:00", duration: 30, remind: true, created: today, log: {}, ...preset };
	}
	onOpen() {
		this.modalEl.addClass("fch-modal");
		const el = this.contentEl;
		const b = this.b;
		const p = this.p;
		el.empty();
		el.createDiv({ cls: "fch-modal-title", text: this.isNew ? "📅 Jadwal belajar baru" : "📅 Ubah jadwal belajar" });
		const f = (label: string, parent: HTMLElement = el) => { const x = parent.createDiv("fch-field"); x.createEl("label", { text: label }); return x; };
		// jenis
		const kinds = f("Apa yang dipelajari").createDiv("fch-kinds");
		for (const k of KINDS) {
			const c = kinds.createEl("button", { cls: "fch-kind" + (b.kind === k.id ? " is-active" : ""), text: `${k.icon} ${k.label}` });
			c.onclick = () => { b.kind = k.id; b.target = k.id === "cards" ? "all" : k.id === "note" ? (noteFiles(p)[0]?.path ?? "") : ""; this.onOpen(); };
		}
		// target
		if (b.kind === "cards") {
			const s = f("Materi").createEl("select", { cls: "dropdown fch-select" });
			s.createEl("option", { text: "🧠 Semua kartu jatuh tempo", attr: { value: "all" } });
			const folders = [...new Set(p.sortedPaths().map((x) => (x.includes("/") ? x.slice(0, x.lastIndexOf("/")) : "")))];
			for (const fo of folders) s.createEl("option", { text: `📁 Folder: ${fo || "(utama)"}`, attr: { value: "folder:" + fo } });
			for (const x of p.sortedPaths()) s.createEl("option", { text: `📘 ${basename(x)}`, attr: { value: "file:" + x } });
			s.value = b.target;
			s.onchange = () => (b.target = s.value);
			const md = f("Mode belajar").createEl("select", { cls: "dropdown fch-select" });
			([["classic", "Klasik"], ["quiz", "Kuis pilihan ganda"], ["type", "Ketik jawaban"], ["explain", "Jelaskan (Feynman)"], ["draw", "Tulis tangan"]] as [StudyMode, string][]).forEach(([v, l]) => md.createEl("option", { text: l, attr: { value: v } }));
			md.value = b.mode ?? p.data.settings.defaultMode;
			md.onchange = () => (b.mode = md.value as StudyMode);
		} else if (b.kind === "note") {
			const inp = f("Catatan").createEl("input", { type: "text", cls: "fch-input", attr: { list: "fch-notes-dl", placeholder: "Ketik nama catatan…" } });
			const dl = el.createEl("datalist", { attr: { id: "fch-notes-dl" } });
			const all = [...noteFiles(p), ...p.app.vault.getMarkdownFiles().filter((x) => !noteFiles(p).includes(x))].slice(0, 400);
			for (const x of all) dl.createEl("option", { attr: { value: x.path } });
			inp.value = b.target;
			inp.onchange = () => (b.target = inp.value.trim());
		} else if (b.kind === "custom") {
			const t = f("Nama kegiatan").createEl("input", { type: "text", cls: "fch-input", attr: { placeholder: "mis. Latihan soal matematika, Membaca buku" } });
			t.value = b.title;
			t.oninput = () => (b.title = t.value);
		}
		// kapan
		const once = el.createEl("label", { cls: "fch-toggle fch-mt" });
		const oc = once.createEl("input", { type: "checkbox" });
		oc.checked = !!b.date;
		once.createSpan({ text: "Sekali saja (tanggal tertentu)" });
		oc.onchange = () => { b.date = oc.checked ? dayKey(Date.now()) : undefined; this.onOpen(); };
		if (b.date) {
			const di = f("Tanggal").createEl("input", { type: "date", cls: "fch-input" });
			di.value = b.date;
			di.onchange = () => (b.date = di.value || dayKey(Date.now()));
		} else {
			const days = f("Hari").createDiv("fch-row");
			[1, 2, 3, 4, 5, 6, 0].forEach((d) => {
				const c = days.createEl("button", { cls: "fch-chip" + (b.days.includes(d) ? " is-active" : ""), text: D[d] });
				c.onclick = () => { b.days = b.days.includes(d) ? b.days.filter((x) => x !== d) : [...b.days, d]; c.toggleClass("is-active", b.days.includes(d)); };
			});
			const q = days.createDiv("fch-row");
			btn(q, { text: "Setiap hari", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { b.days = [0, 1, 2, 3, 4, 5, 6]; this.onOpen(); } });
			btn(q, { text: "Sen–Jum", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { b.days = [1, 2, 3, 4, 5]; this.onOpen(); } });
		}
		const row = el.createDiv("fch-task-grid");
		const tm = f("Jam", row).createEl("input", { type: "time", cls: "fch-input" });
		tm.value = b.time;
		tm.onchange = () => (b.time = tm.value || "19:00");
		const du = f("Durasi", row).createEl("select", { cls: "dropdown fch-select" });
		[10, 15, 20, 30, 45, 60, 90, 120].forEach((v) => du.createEl("option", { text: v < 60 ? `${v} menit` : `${v / 60} jam`, attr: { value: String(v) } }));
		du.value = String(b.duration);
		du.onchange = () => (b.duration = parseInt(du.value, 10));
		const rm = el.createEl("label", { cls: "fch-toggle" });
		const rc = rm.createEl("input", { type: "checkbox" });
		rc.checked = b.remind;
		rc.onchange = () => (b.remind = rc.checked);
		rm.createSpan({ text: "Ingatkan saat waktunya tiba (dengan tombol Mulai)" });
		if (b.kind === "cards") el.createDiv({ cls: "fch-muted fch-small", text: "Saat dimulai, sesi berhenti otomatis setelah durasi habis. Jika belum ada kartu jatuh tempo, dibuka sebagai latihan bebas." });

		const foot = el.createDiv("fch-modal-foot fch-mt");
		if (!this.isNew) btn(foot, { text: "Hapus", icon: "trash-2", cls: "fch-btn-ghost fch-danger", onClick: () => { p.data.blocks = p.data.blocks.filter((x) => x.id !== b.id); p.requestSave(); this.close(); this.done(); } });
		foot.createDiv("fch-grow");
		btn(foot, { text: "Batal", cls: "fch-btn-ghost", onClick: () => this.close() });
		btn(foot, { text: "Simpan jadwal", icon: "check", cls: "fch-btn-primary", onClick: () => {
			if (!b.date && !b.days.length) return void new Notice("Pilih minimal satu hari, atau centang “Sekali saja”.");
			if (b.kind === "note" && !p.app.vault.getAbstractFileByPath(b.target)) return void new Notice("Catatan tidak ditemukan. Pilih dari daftar saran.");
			if (b.kind === "custom" && !b.title.trim()) return void new Notice("Isi nama kegiatan.");
			p.data.blocks = [...p.data.blocks.filter((x) => x.id !== b.id), b];
			p.requestSave();
			play("click");
			new Notice(`📅 Jadwal disimpan: ${targetLabel(p, b)} · ${b.date ? new Date(b.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : b.days.length === 7 ? "setiap hari" : b.days.sort().map((d) => D[d]).join(", ")} ${b.time}`);
			this.close();
			this.done();
		} });
	}
	onClose() { this.contentEl.empty(); }
}

// ---------------------------------------------------------------- rencana otomatis
class AutoPlanModal extends Modal {
	private sel: Set<string>;
	private days = new Set([1, 2, 3, 4, 5]);
	private time = "19:00";
	private dur = 30;
	private perDay = 1;
	constructor(app: App, private p: FlashcardPlugin, private done: () => void) { super(app); this.sel = new Set(p.sortedPaths()); }
	onOpen() {
		this.modalEl.addClass("fch-modal");
		const el = this.contentEl;
		el.createDiv({ cls: "fch-modal-title", text: "🪄 Rencana belajar otomatis" });
		el.createDiv({ cls: "fch-muted fch-small", text: "Materi yang dipilih dibagi bergiliran ke hari-hari belajarmu, sehingga semuanya terulang setiap minggu. Ditambah satu sesi “semua kartu jatuh tempo” agar tidak ada ulasan yang tertinggal." });
		materialPicker(this.p, el, this.sel);
		const days = el.createDiv("fch-row fch-mt");
		days.createSpan({ cls: "fch-small fch-strong", text: "Hari belajar:" });
		[1, 2, 3, 4, 5, 6, 0].forEach((d) => { const c = days.createEl("button", { cls: "fch-chip" + (this.days.has(d) ? " is-active" : ""), text: D[d] }); c.onclick = () => { if (this.days.has(d)) this.days.delete(d); else this.days.add(d); c.toggleClass("is-active", this.days.has(d)); }; });
		const row = el.createDiv("fch-task-grid fch-mt");
		const fld = (l: string) => { const x = row.createDiv("fch-field"); x.createEl("label", { text: l }); return x; };
		const t = fld("Mulai jam").createEl("input", { type: "time", cls: "fch-input" });
		t.value = this.time;
		t.onchange = () => (this.time = t.value || "19:00");
		const d = fld("Durasi per materi").createEl("select", { cls: "dropdown fch-select" });
		[15, 20, 30, 45, 60].forEach((v) => d.createEl("option", { text: `${v} menit`, attr: { value: String(v) } }));
		d.value = String(this.dur);
		d.onchange = () => (this.dur = parseInt(d.value, 10));
		const n = fld("Materi per hari").createEl("select", { cls: "dropdown fch-select" });
		[1, 2, 3].forEach((v) => n.createEl("option", { text: String(v), attr: { value: String(v) } }));
		n.onchange = () => (this.perDay = parseInt(n.value, 10));
		const foot = el.createDiv("fch-modal-foot fch-mt");
		foot.createDiv("fch-grow");
		btn(foot, { text: "Batal", cls: "fch-btn-ghost", onClick: () => this.close() });
		btn(foot, { text: "Buat jadwal", icon: "wand", cls: "fch-btn-primary", onClick: () => this.make() });
	}
	private make() {
		const p = this.p;
		const mats = p.sortedPaths().filter((x) => this.sel.has(x));
		const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => this.days.has(d));
		if (!mats.length || !days.length) return void new Notice("Pilih minimal satu materi dan satu hari.");
		const today = dayKey(Date.now());
		const add = (b: Partial<StudyBlock>) => p.data.blocks.push({ id: uid(), kind: "cards", target: "all", title: "", days: [], time: this.time, duration: this.dur, remind: true, created: today, log: {}, ...b });
		// sesi ulasan harian di awal
		add({ title: "Ulas kartu jatuh tempo", target: "all", days, duration: 15 });
		let i = 0;
		let made = 1;
		const start = toMin(this.time) + 15;
		for (const d of days) {
			for (let k = 0; k < this.perDay; k++) {
				const path = mats[i++ % mats.length];
				const m = start + k * (this.dur + 5);
				add({ target: "file:" + path, days: [d], time: `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}` });
				made++;
			}
		}
		p.requestSave();
		new Notice(`🪄 ${made} jadwal belajar dibuat untuk ${mats.length} materi.`);
		this.close();
		this.done();
	}
	onClose() { this.contentEl.empty(); }
}

// ---------------------------------------------------------------- halaman Jadwal belajar (tab di Jadwal)
const COLOR: Record<string, string> = { cards: "#8b5cf6", note: "#eab308", tilawah: "#14b8a6", ziyadah: "#10b981", murajaah: "#0ea5e9", hadits: "#f59e0b", asma: "#ec4899", custom: "#64748b" };

/** Jadwal berikutnya (hari ini yang belum selesai, atau hari-hari berikutnya). */
export function nextBlock(p: FlashcardPlugin): { b: StudyBlock; at: number; k: string } | null {
	const now = Date.now();
	for (let i = 0; i < 8; i++) {
		const t = addDays(startOfDay(now), i), k = dayKey(t);
		for (const b of blocksOn(p, k)) {
			if (b.log[k]) continue;
			const at = t + toMin(b.time) * 60_000;
			if (at + b.duration * 60_000 > now) return { b, at, k };
		}
	}
	return null;
}

const TEMPLATES: { icon: string; title: string; sub: string; preset: Partial<StudyBlock> }[] = [
	{ icon: "🧠", title: "Ulas flashcard", sub: "Setiap hari · 19:00 · 20 mnt", preset: { kind: "cards", target: "all", days: [0, 1, 2, 3, 4, 5, 6], time: "19:00", duration: 20 } },
	{ icon: "📖", title: "Tilawah ba'da Subuh", sub: "Setiap hari · 05:00 · 15 mnt", preset: { kind: "tilawah", target: "", days: [0, 1, 2, 3, 4, 5, 6], time: "05:00", duration: 15 } },
	{ icon: "🔁", title: "Murajaah hafalan", sub: "Setiap hari · 05:20 · 15 mnt", preset: { kind: "murajaah", target: "", days: [0, 1, 2, 3, 4, 5, 6], time: "05:20", duration: 15 } },
	{ icon: "🧠", title: "Ziyadah Al-Qur'an", sub: "Sen–Jum · 20:00 · 20 mnt", preset: { kind: "ziyadah", target: "", days: [1, 2, 3, 4, 5], time: "20:00", duration: 20 } },
	{ icon: "📜", title: "Hafalan hadits", sub: "Sen, Rab, Jum · 20:30 · 15 mnt", preset: { kind: "hadits", target: "", days: [1, 3, 5], time: "20:30", duration: 15 } },
	{ icon: "🗒️", title: "Baca ulang catatan", sub: "Sabtu · 09:00 · 30 mnt", preset: { kind: "note", days: [6], time: "09:00", duration: 30 } },
];

export function renderBlocks(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const k = dayKey(Date.now());
	// ---- kartu "Berikutnya" + progres minggu
	const ws = addDays(startOfDay(Date.now()), -((new Date().getDay() + 6) % 7));
	let plan = 0, done = 0;
	for (let i = 0; i < 7; i++) { const kk = dayKey(addDays(ws, i)); if (kk > k) break; for (const b of blocksOn(p, kk)) { plan++; if (b.log[kk] === 1) done++; } }
	const hero = el.createDiv("fch-bhero");
	const nx = nextBlock(p);
	const hl = hero.createDiv("fch-bhero-l");
	if (nx) {
		hero.style.setProperty("--c", COLOR[nx.b.kind] ?? "#8b5cf6");
		const live = nx.at <= Date.now();
		hl.createDiv({ cls: "fch-bhero-k", text: live ? "● Sedang berlangsung" : nx.k === k ? "Berikutnya hari ini" : new Date(nx.at).toLocaleDateString("id-ID", { weekday: "long" }) });
		hl.createDiv({ cls: "fch-bhero-t", text: `${kindOf(nx.b.kind).icon} ${targetLabel(p, nx.b)}` });
		const cd = hl.createDiv({ cls: "fch-bhero-s" });
		const upd = () => { const ms = nx.at - Date.now(); cd.setText(`${nx.b.time} · ${nx.b.duration} menit` + (ms > 0 ? ` · mulai dalam ${ms > 3600_000 ? Math.floor(ms / 3600_000) + " j " : ""}${Math.ceil((ms % 3600_000) / 60_000)} mnt` : "")); };
		upd();
		const tm = window.setInterval(() => { if (!cd.isConnected) return window.clearInterval(tm); upd(); }, 30_000);
		const r = hl.createDiv("fch-row");
		if (nx.k === k) btn(r, { text: "Mulai sekarang", icon: "play", cls: "fch-btn-primary fch-btn-lg", onClick: () => startBlock(hub, nx.b) });
		btn(r, { text: "Ubah", icon: "pencil", cls: "fch-btn-sm", onClick: () => new BlockModal(hub.app, p, () => hub.renderPage(), nx.b).open() });
	} else {
		hl.createDiv({ cls: "fch-bhero-k", text: "Jadwal belajar" });
		hl.createDiv({ cls: "fch-bhero-t", text: p.data.blocks.length ? "Semua jadwal minggu ini beres 🎉" : "Belum ada jadwal" });
		hl.createDiv({ cls: "fch-bhero-s", text: "Pilih template di bawah, atau buat jadwal sendiri." });
	}
	const hr = hero.createDiv("fch-bhero-r");
	const pct = plan ? done / plan : 0;
	const rg = hr.createDiv("fch-ring fch-bhero-ring");
	rg.style.setProperty("--p", String(pct));
	const ri = rg.createDiv("fch-ring-inner");
	ri.createDiv({ cls: "fch-ring-num", text: `${Math.round(pct * 100)}%` });
	ri.createDiv({ cls: "fch-small", text: `${done}/${plan} minggu ini` });

	const bar = el.createDiv("fch-row fch-mt");
	btn(bar, { text: "Jadwal baru", icon: "plus", cls: "fch-btn-primary", onClick: () => new BlockModal(hub.app, p, () => hub.renderPage()).open() });
	btn(bar, { text: "Rencana otomatis", icon: "wand", onClick: () => new AutoPlanModal(hub.app, p, () => hub.renderPage()).open() });

	// ---- template cepat
	const tp = el.createDiv("fch-btpl");
	for (const t of TEMPLATES) {
		const c = tp.createEl("button", { cls: "fch-btpl-it" });
		c.style.setProperty("--c", COLOR[t.preset.kind ?? "cards"]);
		c.createDiv({ cls: "fch-btpl-ic", text: t.icon });
		c.createDiv({ cls: "fch-strong fch-small", text: t.title });
		c.createDiv({ cls: "fch-muted fch-small", text: t.sub });
		c.onclick = () => new BlockModal(hub.app, p, () => hub.renderPage(), undefined, { ...t.preset, target: t.preset.kind === "note" ? (noteFiles(p)[0]?.path ?? "") : t.preset.target ?? "" }).open();
	}

	// ---- hari ini
	const today = el.createDiv("fch-panel fch-mt");
	today.createEl("h3", { text: "📅 Hari ini" });
	renderBlockList(hub, today, k, true);

	// ---- papan minggu ini
	const week = el.createDiv("fch-panel fch-mt");
	const wh = week.createDiv("fch-section-head");
	wh.createEl("h3", { text: "🗓️ Minggu ini" });
	wh.createSpan({ cls: "fch-muted fch-small", text: "ketuk jadwal untuk mulai, tandai, atau ubah" });
	const grid = week.createDiv("fch-bweek");
	for (let i = 0; i < 7; i++) {
		const t = addDays(ws, i), kk = dayKey(t);
		const col = grid.createDiv("fch-bweek-col" + (kk === k ? " is-today" : ""));
		const dh = col.createDiv("fch-bweek-day");
		dh.createSpan({ text: new Date(t).toLocaleDateString("id-ID", { weekday: "short" }) });
		dh.createSpan({ cls: "fch-bweek-num", text: String(new Date(t).getDate()) });
		for (const b of blocksOn(p, kk)) {
			const st = blockState(b, kk);
			const c = col.createDiv("fch-bweek-card" + (st === 1 ? " is-done" : st === 2 ? " is-skip" : kk < k ? " is-missed" : ""));
			c.style.setProperty("--c", COLOR[b.kind] ?? "#8b5cf6");
			c.createDiv({ cls: "fch-bweek-time", text: `${st === 1 ? "✓ " : ""}${b.time}` });
			c.createDiv({ cls: "fch-bweek-title", text: `${kindOf(b.kind).icon} ${targetLabel(p, b)}` });
			c.onclick = (e) => blockMenu(hub, b, e, kk);
		}
		const add = col.createEl("button", { cls: "fch-bweek-add", text: "+", attr: { "aria-label": "Tambah jadwal" } });
		add.onclick = () => new BlockModal(hub.app, p, () => hub.renderPage(), undefined, { days: [new Date(t).getDay()] }).open();
	}

	// ---- kelola semua jadwal
	if (p.data.blocks.length) {
		const all = el.createDiv("fch-panel fch-mt");
		all.createEl("h3", { text: `⚙️ Semua jadwal (${p.data.blocks.length})` });
		for (const b of [...p.data.blocks].sort((x, y) => x.time.localeCompare(y.time))) {
			const r = all.createDiv("fch-bmanage");
			r.style.setProperty("--c", COLOR[b.kind] ?? "#8b5cf6");
			r.createSpan({ cls: "fch-block-time", text: b.time });
			const t = r.createDiv("fch-grow");
			t.createDiv({ cls: "fch-strong", text: `${kindOf(b.kind).icon} ${targetLabel(p, b)}` });
			t.createDiv({ cls: "fch-muted fch-small", text: `${b.date ? new Date(b.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : b.days.length === 7 ? "Setiap hari" : [...b.days].sort().map((d) => D[d]).join(", ")} · ${b.duration} mnt · ${b.remind ? "🔔 pengingat" : "🔕 tanpa pengingat"}` });
			btn(r, { icon: b.remind ? "bell" : "bell-off", cls: "fch-btn-ghost fch-btn-sm", label: b.remind ? "Matikan pengingat" : "Nyalakan pengingat", onClick: () => { b.remind = !b.remind; p.requestSave(); hub.renderPage(); } });
			btn(r, { icon: "pencil", cls: "fch-btn-ghost fch-btn-sm", label: "Ubah", onClick: () => new BlockModal(hub.app, p, () => hub.renderPage(), b).open() });
		}
	}
}

/** Daftar jadwal pada tanggal k dengan tombol Mulai (dipakai di tab, Beranda, Kalender). */
export function renderBlockList(hub: HubView, parent: HTMLElement, k: string, empty = false) {
	const p = hub.plugin;
	const bs = blocksOn(p, k);
	const isToday = k === dayKey(Date.now());
	const nowM = new Date().getHours() * 60 + new Date().getMinutes();
	for (const b of bs) {
		const st = blockState(b, k);
		const r = parent.createDiv("fch-block-row" + (st === 1 ? " is-done" : st === 2 ? " is-skip" : ""));
		r.createSpan({ cls: "fch-block-time", text: b.time });
		const t = r.createDiv("fch-grow");
		t.createDiv({ cls: "fch-strong", text: `${kindOf(b.kind).icon} ${targetLabel(p, b)}` });
		const late = isToday && !st && nowM > toMin(b.time) + b.duration;
		t.createDiv({ cls: "fch-muted fch-small", text: `${b.duration} menit · ${st === 1 ? "✓ selesai" : st === 2 ? "dilewati" : late ? "terlewat — masih bisa dikerjakan" : isToday && nowM >= toMin(b.time) ? "sekarang" : "belum"}` + (b.date ? "" : ` · ${b.days.length === 7 ? "setiap hari" : [...b.days].sort().map((d) => D[d]).join(", ")}`) });
		if (isToday && st !== 1) btn(r, { text: "Mulai", icon: "play", cls: "fch-btn-primary fch-btn-sm", onClick: () => startBlock(hub, b) });
		btn(r, { icon: "more-horizontal", cls: "fch-btn-ghost fch-btn-sm", label: "Pilihan", onClick: (e) => blockMenu(hub, b, e, k) });
	}
	if (!bs.length && empty) parent.createDiv({ cls: "fch-muted fch-small", text: "Tidak ada jadwal belajar hari ini." });
	return bs.length;
}

/** Panel Beranda. */
export function renderBlocksPanel(hub: HubView, parent: HTMLElement) {
	const p = hub.plugin;
	const k = dayKey(Date.now());
	if (!p.data.blocks.length) return;
	const box = parent.createDiv("fch-panel fch-mt");
	const h = box.createDiv("fch-section-head");
	const bs = blocksOn(p, k);
	h.createEl("h3", { text: `📅 Jadwal belajar hari ini · ${bs.filter((b) => b.log[k] === 1).length}/${bs.length}` });
	btn(h, { text: "Atur jadwal", cls: "fch-btn-link", onClick: () => { setPlannerTab("blocks"); hub.navigate("planner"); } });
	renderBlockList(hub, box, k, true);
}

let plannerTabSetter: ((t: string) => void) | null = null;
export const registerPlannerTab = (fn: (t: string) => void) => { plannerTabSetter = fn; };
export const setPlannerTab = (t: string) => plannerTabSetter?.(t);
