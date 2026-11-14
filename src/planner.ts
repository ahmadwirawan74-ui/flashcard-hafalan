import { Modal, Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { ClassSlot, Task } from "./types";
import { addDays, dayKey, startOfDay } from "./scheduler";
import { PRIO, occursOn, openTask, quickAdd, toggleTask } from "./tasks";
import { createNote, openNote } from "./notes";
import { basename, btn } from "./util";
import { play } from "./sound";
import { BlockModal, KINDS, blockMenu, blocksOn, blockState, registerPlannerTab, renderBlocks, startBlock, targetLabel } from "./studyplan";
import { BLOCK_COLOR, dayItems, dueMap } from "./agenda";
import { city } from "./ibadah";
import { hm, prayerTimes } from "./prayer";
import { App, Menu } from "obsidian";

export const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const CLASS_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];
const uid = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const classesOn = (p: FlashcardPlugin, t: number) =>
	p.data.classes.filter((c) => c.day === new Date(t).getDay()).sort((a, b) => a.start.localeCompare(b.start));
export const subjects = (p: FlashcardPlugin) =>
	[...new Set([...p.data.classes.map((c) => c.subject), ...p.data.grades.map((g) => g.subject), ...p.data.studyLog.map((l) => l.subject)].filter(Boolean))].sort();

/** Pengingat kelas, dicek tiap 30 detik. */
export function checkClassReminders(p: FlashcardPlugin) {
	const lead = p.data.settings.classReminder;
	if (!lead) return;
	const now = Date.now(), k = dayKey(now), m = p.data.meta;
	const mins = new Date(now).getHours() * 60 + new Date(now).getMinutes();
	for (const c of classesOn(p, now)) {
		const at = toMin(c.start) - lead;
		if (mins >= at && mins < toMin(c.start) + 5 && m.classReminded?.[c.id] !== k) {
			m.classReminded = { ...(m.classReminded ?? {}), [c.id]: k };
			play("chime");
			new Notice(`📚 ${c.subject} mulai pukul ${c.start}${c.room ? " di " + c.room : ""}`, 15_000);
			p.requestSave();
		}
	}
}

export async function lectureNote(hub: HubView, c: ClassSlot) {
	const p = hub.plugin;
	const f = await createNote(p, `${c.subject} ${dayKey(Date.now())}`, "kuliah", c.path ? { materi: `"[[${basename(c.path)}]]"` } : {});
	await p.app.vault.process(f, (d) => d.replace("**Mata kuliah:** ", `**Mata kuliah:** ${c.subject}`).replace("**Dosen:** ", `**Dosen:** ${c.teacher}`));
	openNote(f.path);
	hub.navigate("notes");
}

// ---------------------------------------------------------------- modal kelas
export class ClassModal extends Modal {
	private c: ClassSlot;
	constructor(app: App, private p: FlashcardPlugin, private onDone: () => void, c?: ClassSlot, day = 1) {
		super(app);
		this.c = c ? { ...c } : { id: uid(), subject: "", day, start: "07:00", end: "08:30", room: "", teacher: "", color: CLASS_COLORS[p.data.classes.length % CLASS_COLORS.length] };
		this.isNew = !c;
	}
	private isNew: boolean;
	onOpen() {
		this.modalEl.addClass("fch-modal");
		const el = this.contentEl;
		const c = this.c;
		el.createDiv({ cls: "fch-modal-title", text: this.isNew ? "📚 Pelajaran baru" : "📚 Edit pelajaran" });
		const f = (label: string) => { const x = el.createDiv("fch-field"); x.createEl("label", { text: label }); return x; };
		const subj = f("Mata pelajaran / kuliah").createEl("input", { type: "text", cls: "fch-input", attr: { list: "fch-subj" } });
		const dl = el.createEl("datalist", { attr: { id: "fch-subj" } });
		subjects(this.p).forEach((s) => dl.createEl("option", { attr: { value: s } }));
		subj.value = c.subject;
		const row = el.createDiv("fch-task-grid");
		const g = (label: string) => { const x = row.createDiv("fch-field"); x.createEl("label", { text: label }); return x; };
		const day = g("Hari").createEl("select", { cls: "dropdown fch-select" });
		[1, 2, 3, 4, 5, 6, 0].forEach((d) => day.createEl("option", { text: DAY_NAMES[d], attr: { value: String(d) } }));
		day.value = String(c.day);
		const st = g("Mulai").createEl("input", { type: "time", cls: "fch-input" });
		st.value = c.start;
		const en = g("Selesai").createEl("input", { type: "time", cls: "fch-input" });
		en.value = c.end;
		const row2 = el.createDiv("fch-task-grid");
		const h = (label: string) => { const x = row2.createDiv("fch-field"); x.createEl("label", { text: label }); return x; };
		const room = h("Ruang").createEl("input", { type: "text", cls: "fch-input", attr: { placeholder: "mis. R.201" } });
		room.value = c.room;
		const tch = h("Guru / dosen").createEl("input", { type: "text", cls: "fch-input" });
		tch.value = c.teacher;
		const mat = h("Materi flashcard").createEl("select", { cls: "dropdown fch-select" });
		mat.createEl("option", { text: "—", attr: { value: "" } });
		this.p.sortedPaths().forEach((x) => mat.createEl("option", { text: basename(x), attr: { value: x } }));
		mat.value = c.path ?? "";
		const dots = el.createDiv("fch-note-dots fch-mt");
		for (const col of CLASS_COLORS) {
			const d = dots.createEl("button", { cls: "fch-color-dot" + (c.color === col ? " is-on" : "") });
			d.style.setProperty("--dot", col);
			d.onclick = () => { c.color = col; dots.querySelectorAll(".fch-color-dot").forEach((x) => x.removeClass("is-on")); d.addClass("is-on"); };
		}
		const foot = el.createDiv("fch-modal-foot fch-mt");
		if (!this.isNew) btn(foot, { text: "Hapus", icon: "trash-2", cls: "fch-btn-ghost fch-danger", onClick: () => { this.p.data.classes = this.p.data.classes.filter((x) => x.id !== c.id); this.p.requestSave(); this.close(); this.onDone(); } });
		foot.createDiv("fch-grow");
		btn(foot, { text: "Simpan", icon: "check", cls: "fch-btn-primary", onClick: () => {
			if (!subj.value.trim()) return void new Notice("Isi nama pelajaran.");
			if (toMin(en.value || "00:00") <= toMin(st.value || "00:00")) return void new Notice("Jam selesai harus setelah jam mulai.");
			Object.assign(c, { subject: subj.value.trim(), day: parseInt(day.value, 10), start: st.value, end: en.value, room: room.value.trim(), teacher: tch.value.trim(), path: mat.value || undefined });
			this.p.data.classes = [...this.p.data.classes.filter((x) => x.id !== c.id), c];
			this.p.requestSave();
			this.close();
			this.onDone();
		} });
		window.setTimeout(() => subj.focus(), 30);
	}
	onClose() { this.contentEl.empty(); }
}

// ---------------------------------------------------------------- halaman Jadwal
let tab: "today" | "week" | "blocks" = "today";
registerPlannerTab((t) => { tab = t as typeof tab; });
let dayOff = 0;
const H0 = 4, H1 = 23, PX = 56; // jam awal, jam akhir, piksel per jam

export function renderPlanner(hub: HubView, el: HTMLElement) {
	const head = el.createDiv("fch-pagehead fch-pagehead-row");
	const ht = head.createDiv();
	ht.createEl("h1", { text: "🗓️ Jadwal" });
	ht.createDiv({ cls: "fch-muted", text: "Atur hari per jam (time blocking): seret tugas ke slot waktu. Jadwal pelajaran mingguan ikut tampil otomatis." });
	const seg = head.createDiv("fch-seg");
	for (const [v, l] of [["today", "Rencana harian"], ["blocks", "Jadwal belajar"], ["week", "Jadwal pelajaran"]] as const) {
		const b = seg.createEl("button", { cls: "fch-seg-btn" + (tab === v ? " is-active" : ""), text: l });
		b.onclick = () => { tab = v; hub.renderPage(); };
	}
	if (tab === "week") renderWeek(hub, el);
	else if (tab === "blocks") renderBlocks(hub, el);
	else renderDay(hub, el);
}

function renderDay(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const day = addDays(startOfDay(Date.now()), dayOff);
	const k = dayKey(day);
	const due = dueMap(p);
	// ---- strip 7 hari: pilih tanggal dengan sekali ketuk
	const strip = el.createDiv("fch-dstrip");
	btn(strip, { icon: "chevron-left", cls: "fch-btn-ghost fch-btn-sm", label: "Minggu sebelumnya", onClick: () => { dayOff -= 7; hub.renderPage(); } });
	const base = Math.floor(dayOff / 7) * 7;
	for (let i = 0; i < 7; i++) {
		const off = base + i, t = addDays(startOfDay(Date.now()), off), kk = dayKey(t);
		const n = dayItems(hub, kk, due).filter((x) => x.time).length + p.data.tasks.filter((x) => !x.done && !x.time && occursOn(x, kk)).length;
		const b = strip.createEl("button", { cls: "fch-dpill" + (off === dayOff ? " is-sel" : "") + (off === 0 ? " is-today" : "") });
		b.createDiv({ cls: "fch-dpill-wd", text: off === 0 ? "Hari ini" : new Date(t).toLocaleDateString("id-ID", { weekday: "short" }) });
		b.createDiv({ cls: "fch-dpill-n", text: String(new Date(t).getDate()) });
		b.createDiv({ cls: "fch-dpill-c", text: n ? `${n} agenda` : "—" });
		b.onclick = () => { dayOff = off; hub.renderPage(); };
	}
	btn(strip, { icon: "chevron-right", cls: "fch-btn-ghost fch-btn-sm", label: "Minggu berikutnya", onClick: () => { dayOff += 7; hub.renderPage(); } });

	// ---- ringkasan hari
	const its = dayItems(hub, k, due);
	const plans = its.filter((x) => x.kind === "plan");
	const dayTasks = p.data.tasks.filter((x) => occursOn(x, k) || (x.done && x.doneAt && dayKey(x.doneAt) === k));
	const doneT = dayTasks.filter((x) => x.done || x.log?.includes(k)).length;
	const mins = its.filter((x) => x.time && x.end && x.kind !== "prayer").reduce((a, x) => a + Math.max(0, toMin(x.end!) - toMin(x.time!)), 0);
	const sum = el.createDiv("fch-dsum");
	const card = (icon: string, v: string, l: string, color: string, pct?: number) => {
		const c = sum.createDiv("fch-dsum-card");
		c.style.setProperty("--c", color);
		c.createDiv({ cls: "fch-dsum-ic", text: icon });
		const t2 = c.createDiv();
		t2.createDiv({ cls: "fch-dsum-v", text: v });
		t2.createDiv({ cls: "fch-dsum-l", text: l });
		if (pct !== undefined) c.createDiv("fch-dsum-bar").createDiv().style.width = `${Math.min(100, pct * 100)}%`;
	};
	card("📅", `${plans.filter((x) => x.done).length}/${plans.length}`, "jadwal belajar", "#8b5cf6", plans.length ? plans.filter((x) => x.done).length / plans.length : 0);
	card("✅", `${doneT}/${dayTasks.length}`, "tugas", "#0ea5e9", dayTasks.length ? doneT / dayTasks.length : 0);
	card("⏱", `${Math.floor(mins / 60)}j ${mins % 60}m`, "waktu terjadwal", "#10b981");
	const nowM = new Date().getHours() * 60 + new Date().getMinutes();
	const nx = plans.find((x) => !x.done && (dayOff > 0 || toMin(x.end!) > nowM));
	const nc = sum.createDiv("fch-dsum-card fch-dsum-next");
	nc.style.setProperty("--c", nx?.color ?? "#8b5cf6");
	if (nx) {
		const t2 = nc.createDiv("fch-grow");
		t2.createDiv({ cls: "fch-dsum-l", text: dayOff === 0 && toMin(nx.time!) <= nowM ? "Sedang berlangsung" : "Berikutnya" });
		t2.createDiv({ cls: "fch-dsum-v fch-dsum-vt", text: `${nx.time} ${nx.title}` });
		if (nx.action) btn(nc, { text: "Mulai", icon: "play", cls: "fch-btn-primary fch-btn-sm", onClick: nx.action.run });
	} else {
		const t2 = nc.createDiv("fch-grow");
		t2.createDiv({ cls: "fch-dsum-l", text: "Berikutnya" });
		t2.createDiv({ cls: "fch-dsum-v fch-dsum-vt", text: plans.length ? "Semua jadwal beres 🎉" : "Belum ada jadwal" });
		btn(nc, { text: "Jadwalkan", icon: "calendar-plus", cls: "fch-btn-sm", onClick: () => new BlockModal(hub.app, p, () => hub.renderPage(), undefined, { date: k, days: [] }).open() });
	}

	const wrap = el.createDiv("fch-tb");
	const tl = wrap.createDiv("fch-tb-line");
	tl.style.height = `${(H1 - H0) * PX}px`;
	for (let h = H0; h < H1; h++) {
		const r = tl.createDiv("fch-tb-hour");
		r.style.top = `${(h - H0) * PX}px`;
		r.createSpan({ cls: "fch-tb-label", text: `${String(h).padStart(2, "0")}:00` });
	}
	const y = (m: number) => ((m - H0 * 60) / 60) * PX;
	const block = (start: number, dur: number, cls: string, color: string) => {
		const b = tl.createDiv("fch-tb-block " + cls);
		b.style.top = `${y(start)}px`;
		b.style.height = `${Math.max(22, (dur / 60) * PX - 3)}px`;
		b.style.setProperty("--c", color);
		return b;
	};
	// pelajaran
	for (const c of classesOn(p, day)) {
		const b = block(toMin(c.start), toMin(c.end) - toMin(c.start), "is-class", c.color);
		b.createDiv({ cls: "fch-tb-title", text: `📚 ${c.subject}` });
		b.createDiv({ cls: "fch-tb-sub", text: `${c.start}–${c.end}${c.room ? " · " + c.room : ""}` });
		b.onclick = () => new ClassModal(hub.app, p, () => hub.renderPage(), c).open();
	}
	// jadwal belajar (flashcard, catatan, hafalan…)
	for (const sb of blocksOn(p, k)) {
		const st = blockState(sb, k);
		const b = block(toMin(sb.time), sb.duration, "is-plan" + (st === 1 ? " is-done" : st === 2 ? " is-skip" : ""), BLOCK_COLOR[sb.kind] ?? "#8b5cf6");
		b.createDiv({ cls: "fch-tb-title", text: `${st === 1 ? "✓ " : (KINDS.find((x) => x.id === sb.kind)?.icon ?? "📅") + " "}${targetLabel(p, sb)}` });
		b.createDiv({ cls: "fch-tb-sub", text: `${sb.time} · ${sb.duration} menit` });
		if (dayOff === 0 && st !== 1) { const go = b.createEl("button", { cls: "fch-tb-go", text: "▶ Mulai" }); go.onclick = (e) => { e.stopPropagation(); startBlock(hub, sb); }; }
		b.onclick = (e) => blockMenu(hub, sb, e, k);
	}
	// catatan waktu belajar (stopwatch)
	for (const l of p.data.studyLog.filter((x) => dayKey(x.start) === k)) {
		const d = new Date(l.start);
		const b = block(d.getHours() * 60 + d.getMinutes(), Math.max(15, l.ms / 60_000), "is-log", "#10b981");
		b.createDiv({ cls: "fch-tb-title", text: `⏱ ${l.subject}` });
		b.createDiv({ cls: "fch-tb-sub", text: `${Math.round(l.ms / 60_000)} menit belajar` });
	}
	// tugas berjam (bisa diseret)
	const timed = p.data.tasks.filter((t) => t.time && !t.done && occursOn(t, k));
	for (const t of timed) {
		const b = block(toMin(t.time!), t.duration ?? 60, "is-task", PRIO[t.priority].color === "var(--text-faint)" ? "#6366f1" : PRIO[t.priority].color);
		b.draggable = true;
		b.addEventListener("dragstart", (e) => { e.dataTransfer?.setData("text/plain", t.id); b.addClass("is-drag"); });
		const top = b.createDiv("fch-row");
		const cb = top.createEl("button", { cls: "fch-task-check", attr: { "aria-label": "Selesai" } });
		cb.onclick = (e) => { e.stopPropagation(); toggleTask(p, t, hub.mainEl); };
		top.createDiv({ cls: "fch-tb-title fch-grow", text: t.title });
		b.createDiv({ cls: "fch-tb-sub", text: `${t.time}–${fromMin(toMin(t.time!) + (t.duration ?? 60))}` });
		const dur = b.createEl("select", { cls: "fch-tb-dur", attr: { "aria-label": "Durasi" } });
		[15, 30, 45, 60, 90, 120, 180].forEach((m) => dur.createEl("option", { text: m < 60 ? `${m} mnt` : `${m / 60} jam`, attr: { value: String(m) } }));
		dur.value = String(t.duration ?? 60);
		dur.onclick = (e) => e.stopPropagation();
		dur.onchange = () => { t.duration = parseInt(dur.value, 10); p.requestSave(); hub.renderPage(); };
		b.onclick = (e) => {
			const m = new Menu();
			m.addItem((i) => i.setTitle("Ubah jam / durasi…").setIcon("clock").onClick(() => new TimeModal(hub.app, t.title, t.time ?? "", t.duration ?? 60, (time, dur) => { t.time = time; t.duration = dur; t.reminded = undefined; p.requestSave(); hub.renderPage(); }).open()));
			m.addItem((i) => i.setTitle("Lepas dari garis waktu").setIcon("x").onClick(() => { t.time = undefined; p.requestSave(); hub.renderPage(); }));
			m.addItem((i) => i.setTitle("Tandai selesai").setIcon("check").onClick(() => toggleTask(p, t, hub.mainEl)));
			m.addItem((i) => i.setTitle("Buka detail tugas").setIcon("pencil").onClick(() => { openTask(t.id); hub.navigate("tasks"); }));
			m.showAtMouseEvent(e);
		};
	}
	const pt = prayerTimes(new Date(day), city(p), p.data.ibadah.adj);
	for (const n of ["Subuh", "Dzuhur", "Ashar", "Maghrib", "Isya"] as const) {
		const m = Math.round(pt[n] * 60);
		if (m < H0 * 60 || m > H1 * 60) continue;
		const pl = tl.createDiv("fch-tb-prayer");
		pl.style.top = `${y(m)}px`;
		pl.createSpan({ text: `🕌 ${n} ${hm(pt[n])}` });
	}
	if (dayOff === 0) {
		const now = new Date();
		const m = now.getHours() * 60 + now.getMinutes();
		if (m >= H0 * 60 && m <= H1 * 60) { const n = tl.createDiv("fch-tb-now"); n.style.top = `${y(m)}px`; }
	}
	// menjatuhkan tugas ke slot waktu (dibulatkan ke 15 menit)
	const slotAt = (e: DragEvent | MouseEvent) => {
		const r = tl.getBoundingClientRect();
		const m = H0 * 60 + Math.round((((e.clientY - r.top) / PX) * 60) / 15) * 15;
		return Math.max(H0 * 60, Math.min(H1 * 60 - 15, m));
	};
	const ghost = tl.createDiv("fch-tb-ghost");
	tl.addEventListener("dragover", (e) => { e.preventDefault(); ghost.style.display = "block"; ghost.style.top = `${y(slotAt(e))}px`; ghost.setText(fromMin(slotAt(e))); });
	tl.addEventListener("dragleave", () => (ghost.style.display = "none"));
	tl.addEventListener("drop", (e) => {
		e.preventDefault();
		ghost.style.display = "none";
		const t = p.data.tasks.find((x) => x.id === e.dataTransfer?.getData("text/plain"));
		if (!t) return;
		t.due = k;
		t.time = fromMin(slotAt(e));
		t.duration ??= 60;
		t.reminded = undefined;
		play("click");
		p.requestSave();
		hub.renderPage();
	});

	// sisi kanan: tugas yang belum dijadwalkan
	const side = wrap.createDiv("fch-tb-side");
	side.createDiv({ cls: "fch-agenda-title", text: "Belum dijadwalkan" });
	side.createDiv({ cls: "fch-muted fch-small", text: "Seret ke garis waktu untuk menentukan jamnya. Klik slot kosong untuk menambah tugas di jam itu." });
	const inp = quickAdd(hub, side, { due: k }, "Tambah tugas…");
	tl.addEventListener("click", (e) => {
		if ((e.target as HTMLElement).closest(".fch-tb-block")) return;
		const at = fromMin(slotAt(e));
		const m = new Menu();
		m.addItem((i) => i.setTitle(`Tambah tugas jam ${at}`).setIcon("check-square").onClick(() => {
			inp.value = `${inp.value.replace(/\s*jam \d\d:\d\d$/, "")} jam ${at}`.trimStart();
			inp.focus();
			inp.setSelectionRange(0, 0);
		}));
		m.addItem((i) => i.setTitle(`Jadwalkan belajar jam ${at}…`).setIcon("calendar-plus").onClick(() => new BlockModal(hub.app, p, () => hub.renderPage(), undefined, { date: k, days: [], time: at }).open()));
		const pool2 = p.data.tasks.filter((t) => !t.done && !t.time && (!t.due || t.due <= k));
		if (pool2.length) {
			m.addSeparator();
			for (const t of pool2.slice(0, 8)) m.addItem((i) => i.setTitle(`Taruh di ${at}: ${t.title.slice(0, 40)}`).setIcon("clock").onClick(() => { t.due = k; t.time = at; t.duration ??= 60; t.reminded = undefined; p.requestSave(); hub.renderPage(); }));
		}
		m.showAtMouseEvent(e);
	});
	const pool = p.data.tasks.filter((t) => !t.done && !t.time && (!t.due || t.due <= k)).sort((a, b) => b.priority - a.priority);
	const list = side.createDiv("fch-tb-pool");
	list.addEventListener("dragover", (e) => e.preventDefault());
	list.addEventListener("drop", (e) => {
		e.preventDefault();
		const t = p.data.tasks.find((x) => x.id === e.dataTransfer?.getData("text/plain"));
		if (t) { t.time = undefined; p.requestSave(); hub.renderPage(); }
	});
	for (const t of pool) {
		const c = list.createDiv("fch-tb-chip");
		c.draggable = true;
		c.style.setProperty("--c", PRIO[t.priority].color);
		c.createSpan({ text: t.title });
		if (t.due && t.due < k) c.createSpan({ cls: "fch-tb-late", text: "terlambat" });
		c.addEventListener("dragstart", (e) => e.dataTransfer?.setData("text/plain", t.id));
		c.onclick = () => new TimeModal(hub.app, t.title, t.time ?? "", t.duration ?? 60, (time, dur) => { t.due = k; t.time = time; t.duration = dur; t.reminded = undefined; p.requestSave(); play("click"); hub.renderPage(); }).open();
		c.setAttr("aria-label", "Ketuk untuk memilih jam, atau seret ke garis waktu");
	}
	if (!pool.length) list.createDiv({ cls: "fch-muted fch-small", text: "Semua tugas sudah punya jam. 👍" });
	const total = timed.reduce((a, t) => a + (t.duration ?? 60), 0) + classesOn(p, day).reduce((a, c) => a + toMin(c.end) - toMin(c.start), 0);
	side.createDiv({ cls: "fch-muted fch-small fch-mt", text: `Terjadwal: ${Math.floor(total / 60)} j ${total % 60} m` });
	window.setTimeout(() => { const now = el.querySelector(".fch-tb-now") as HTMLElement | null; (now ?? el.querySelector(".fch-tb-block"))?.scrollIntoView({ block: "center" }); }, 50);
}

function renderWeek(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const r = el.createDiv("fch-row");
	btn(r, { text: "Tambah pelajaran", icon: "plus", cls: "fch-btn-primary", onClick: () => new ClassModal(hub.app, p, () => hub.renderPage()).open() });
	r.createSpan({ cls: "fch-muted fch-small", text: `Pengingat ${p.data.settings.classReminder} menit sebelum kelas (ubah di pengaturan).` });
	const grid = el.createDiv("fch-timetable");
	const todayDow = new Date().getDay();
	for (const d of [1, 2, 3, 4, 5, 6, 0]) {
		const items = p.data.classes.filter((c) => c.day === d).sort((a, b) => a.start.localeCompare(b.start));
		if (d === 0 && !items.length) continue;
		const col = grid.createDiv("fch-tt-col" + (d === todayDow ? " is-today" : ""));
		col.createDiv({ cls: "fch-tt-day", text: DAY_NAMES[d] });
		for (const c of items) {
			const card = col.createDiv("fch-tt-card");
			card.style.setProperty("--c", c.color);
			card.createDiv({ cls: "fch-tt-time", text: `${c.start}–${c.end}` });
			card.createDiv({ cls: "fch-tt-subj", text: c.subject });
			if (c.room || c.teacher) card.createDiv({ cls: "fch-muted fch-small", text: [c.room, c.teacher].filter(Boolean).join(" · ") });
			const act = card.createDiv("fch-row");
			btn(act, { icon: "sticky-note", cls: "fch-btn-ghost fch-btn-sm", label: "Buat catatan kuliah", onClick: (e) => { e.stopPropagation(); void lectureNote(hub, c); } });
			if (c.path) btn(act, { icon: "play", cls: "fch-btn-ghost fch-btn-sm", label: "Belajar materinya", onClick: (e) => { e.stopPropagation(); hub.startSession(p.index.get(c.path!) ?? [], { title: c.subject, cram: false, mode: p.data.settings.defaultMode }); } });
			card.onclick = () => new ClassModal(hub.app, p, () => hub.renderPage(), c).open();
		}
		btn(col, { icon: "plus", cls: "fch-btn-ghost fch-btn-sm", label: `Tambah pelajaran hari ${DAY_NAMES[d]}`, onClick: () => new ClassModal(hub.app, p, () => hub.renderPage(), undefined, d).open() });
	}
	if (!p.data.classes.length) el.createDiv({ cls: "fch-empty fch-mt", text: "Belum ada jadwal pelajaran. Tambahkan sekali, dan jadwal ini akan tampil setiap minggu di Beranda, Kalender, dan Rencana harian." });
}

/** Ringkasan pelajaran hari ini (untuk Beranda). */
export function renderTodayClasses(hub: HubView, parent: HTMLElement) {
	const p = hub.plugin;
	const items = classesOn(p, Date.now());
	if (!items.length) return;
	const box = parent.createDiv("fch-panel fch-mt fch-today-classes");
	const h = box.createDiv("fch-section-head");
	h.createEl("h3", { text: `📚 Pelajaran hari ini (${items.length})` });
	btn(h, { text: "Jadwal", cls: "fch-btn-link", onClick: () => hub.navigate("planner") });
	const nowM = new Date().getHours() * 60 + new Date().getMinutes();
	const row = box.createDiv("fch-tt-strip");
	for (const c of items) {
		const live = nowM >= toMin(c.start) && nowM < toMin(c.end), past = nowM >= toMin(c.end);
		const card = row.createDiv("fch-tt-card" + (live ? " is-live" : past ? " is-past" : ""));
		card.style.setProperty("--c", c.color);
		card.createDiv({ cls: "fch-tt-time", text: (live ? "● sedang berlangsung · " : "") + `${c.start}–${c.end}` });
		card.createDiv({ cls: "fch-tt-subj", text: c.subject });
		if (c.room) card.createDiv({ cls: "fch-muted fch-small", text: c.room });
		btn(card, { text: "Catatan", icon: "sticky-note", cls: "fch-btn-sm", onClick: () => void lectureNote(hub, c) });
	}
}
void ({} as Task);

/** Pilih jam & durasi (pengganti seret-lepas, berfungsi di HP). */
class TimeModal extends Modal {
	constructor(app: App, private title: string, private time: string, private dur: number, private ok: (time: string, dur: number) => void) { super(app); }
	onOpen() {
		this.modalEl.addClass("fch-modal");
		const el = this.contentEl;
		el.createDiv({ cls: "fch-modal-title", text: "🕐 Jadwalkan" });
		el.createDiv({ cls: "fch-small fch-strong", text: this.title });
		const row = el.createDiv("fch-task-grid fch-mt");
		const f = (l: string) => { const x = row.createDiv("fch-field"); x.createEl("label", { text: l }); return x; };
		const t = f("Jam").createEl("input", { type: "time", cls: "fch-input" });
		t.value = this.time || `${String(Math.min(22, new Date().getHours() + 1)).padStart(2, "0")}:00`;
		const d = f("Durasi").createEl("select", { cls: "dropdown fch-select" });
		[15, 30, 45, 60, 90, 120, 180].forEach((v) => d.createEl("option", { text: v < 60 ? `${v} menit` : `${v / 60} jam`, attr: { value: String(v) } }));
		d.value = String(this.dur);
		const foot = el.createDiv("fch-modal-foot fch-mt");
		foot.createDiv("fch-grow");
		btn(foot, { text: "Simpan", icon: "check", cls: "fch-btn-primary", onClick: () => { if (!t.value) return; this.ok(t.value, parseInt(d.value, 10)); this.close(); } });
		window.setTimeout(() => t.focus(), 30);
	}
	onClose() { this.contentEl.empty(); }
}
