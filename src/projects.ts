import { Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { Exam, Project, Task } from "./types";
import { DAY, addDays, dayKey, startOfDay } from "./scheduler";
import { PRIO, openTask, quickAdd, toggleTask } from "./tasks";
import { examPlan } from "./analytics";
import { basename, btn } from "./util";
import { play } from "./sound";

const COLORS = ["#6366f1", "#ef4444", "#f59e0b", "#10b981", "#ec4899", "#14b8a6", "#8b5cf6"];
const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const keyT = (k: string) => new Date(k + "T00:00:00").getTime();

export const projectTasks = (p: FlashcardPlugin, id: string) => p.data.tasks.filter((t) => t.project === id);
export function progressOf(p: FlashcardPlugin, id: string) {
	const ts = projectTasks(p, id);
	const done = ts.filter((t) => t.done).length;
	return { total: ts.length, done, pct: ts.length ? done / ts.length : 0 };
}

// ---------------------------------------------------------------- rencana ujian otomatis
/**
 * Susun rangkaian tugas belajar sampai hari ujian:
 * - 60% hari pertama: pelajari setiap materi (berurutan, dibagi rata)
 * - lalu ulas ulang semua materi, kerjakan simulasi ujian, latih kartu tersulit, dan istirahat cukup.
 * Tugas rencana yang belum selesai disusun ulang bila dipanggil lagi.
 */
export function planExam(p: FlashcardPlugin, e: Exam): number {
	const today = startOfDay(Date.now());
	const exam = keyT(e.date);
	const days = Math.round((exam - today) / DAY);
	if (days < 1) { new Notice("Ujian sudah hari ini atau sudah lewat."); return 0; }
	let proj = p.data.projects.find((x) => x.examId === e.id);
	if (!proj) {
		proj = { id: uid("p"), name: `Persiapan ${e.name}`, color: "#ef4444", deadline: e.date, created: Date.now(), examId: e.id };
		p.data.projects.push(proj);
	}
	proj.deadline = e.date;
	p.data.tasks = p.data.tasks.filter((t) => !(t.planId === e.id && !t.done));
	const mats = (e.paths.length ? e.paths : p.sortedPaths()).filter((x) => p.index.has(x));
	const plan = examPlan(p, e);
	const studyDays = Math.max(1, Math.floor(days * 0.6));
	const out: Partial<Task>[] = [];
	mats.forEach((m, i) => {
		const d = addDays(today, Math.min(studyDays - 1, Math.floor((i * studyDays) / Math.max(1, mats.length))));
		const c = p.countFor([m]);
		out.push({ title: `Pelajari ${basename(m)}`, due: dayKey(d), path: m, priority: 2, notes: `${c.total} kartu · ${c.fresh} belum dipelajari` });
	});
	if (days >= 4) out.push({ title: `Ulas ulang semua materi ${e.name}`, due: dayKey(addDays(today, Math.min(days - 3, studyDays))), priority: 2, notes: "Mode Cram atau Selang-seling" });
	if (days >= 3) out.push({ title: `Simulasi ujian ${e.name}`, due: dayKey(addDays(exam, -3 + (days < 3 ? 1 : 0))), priority: 3, notes: "Halaman Belajar → Simulasi ujian" });
	if (days >= 2) out.push({ title: "Latih kartu tersulit & yang sering tertukar", due: dayKey(addDays(exam, -1)), priority: 3, notes: "Halaman Kelemahan" });
	out.push({ title: `Ujian ${e.name} — sarapan & istirahat cukup 😴`, due: e.date, priority: 3 });
	for (const o of out)
		p.data.tasks.push({ id: uid("t"), title: o.title!, notes: o.notes ?? "", due: o.due, priority: (o.priority ?? 2) as Task["priority"], tags: ["ujian"], subtasks: [], done: false, created: Date.now(), pomos: 0, path: o.path, project: proj.id, planId: e.id });
	p.requestSave();
	p.refreshViews();
	new Notice(`📋 ${out.length} tugas belajar disusun untuk ${e.name} (${plan.fresh} kartu baru, H-${days}).`);
	return out.length;
}

// ---------------------------------------------------------------- halaman Proyek
let current = "";
export const setProject = (id: string) => { current = id; };

export function renderProjects(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const head = el.createDiv("fch-pagehead fch-pagehead-row");
	const ht = head.createDiv();
	ht.createEl("h1", { text: "📁 Proyek" });
	ht.createDiv({ cls: "fch-muted", text: "Kelompokkan tugas dalam proyek dan pindahkan antarkolom di papan Kanban. Rencana ujian otomatis juga tampil di sini." });

	const bar = el.createDiv("fch-proj-bar");
	const all = bar.createEl("button", { cls: "fch-proj-tab" + (!current ? " is-on" : ""), text: "Semua tugas" });
	all.onclick = () => { current = ""; hub.renderPage(); };
	for (const pr of p.data.projects.filter((x) => !x.archived)) {
		const g = progressOf(p, pr.id);
		const b = bar.createEl("button", { cls: "fch-proj-tab" + (current === pr.id ? " is-on" : "") });
		b.style.setProperty("--pc", pr.color);
		b.createSpan({ cls: "fch-proj-dot" });
		b.createSpan({ text: pr.name });
		b.createSpan({ cls: "fch-muted fch-small", text: `${g.done}/${g.total}` });
		b.onclick = () => { current = pr.id; hub.renderPage(); };
	}
	const nw = bar.createEl("input", { type: "text", cls: "fch-input fch-proj-new", attr: { placeholder: "+ Proyek baru (Enter)" } });
	nw.onkeydown = (e) => {
		if (e.key !== "Enter" || !nw.value.trim()) return;
		const pr: Project = { id: uid("p"), name: nw.value.trim(), color: COLORS[p.data.projects.length % COLORS.length], created: Date.now() };
		p.data.projects.push(pr);
		current = pr.id;
		p.requestSave();
		play("click");
		hub.renderPage();
	};

	const pr = p.data.projects.find((x) => x.id === current);
	if (pr) {
		const info = el.createDiv("fch-panel fch-proj-info");
		info.style.setProperty("--pc", pr.color);
		const r = info.createDiv("fch-row");
		const name = r.createEl("input", { type: "text", cls: "fch-input fch-proj-name fch-grow" });
		name.value = pr.name;
		name.onchange = () => { pr.name = name.value.trim() || pr.name; p.requestSave(); hub.renderPage(); };
		const dl = r.createEl("input", { type: "date", cls: "fch-input", attr: { "aria-label": "Tenggat" } });
		dl.value = pr.deadline ?? "";
		dl.onchange = () => { pr.deadline = dl.value || undefined; p.requestSave(); hub.renderPage(); };
		const exam = pr.examId ? p.data.exams.find((x) => x.id === pr.examId) : undefined;
		if (exam) btn(r, { text: "Susun ulang rencana", icon: "rotate-ccw", cls: "fch-btn-sm", onClick: () => { planExam(p, exam); hub.renderPage(); } });
		btn(r, { icon: "archive", cls: "fch-btn-ghost fch-btn-sm", label: "Arsipkan proyek", onClick: () => { pr.archived = true; current = ""; p.requestSave(); hub.renderPage(); } });
		const g = progressOf(p, pr.id);
		const pb = info.createDiv("fch-row");
		pb.createDiv("fch-bar fch-grow").createDiv("fch-bar-fill").style.width = `${g.pct * 100}%`;
		const left = pr.deadline ? Math.round((keyT(pr.deadline) - startOfDay(Date.now())) / DAY) : null;
		pb.createSpan({ cls: "fch-small fch-strong", text: `${Math.round(g.pct * 100)}%` + (left !== null ? ` · ${left > 0 ? `${left} hari lagi` : left === 0 ? "tenggat hari ini" : `lewat ${-left} hari`}` : "") });
	}

	quickAdd(hub, el, pr ? { project: pr.id } : {}, pr ? `Tambah tugas ke “${pr.name}”…` : "Tambah tugas…");
	const tasks = p.data.tasks.filter((t) => (pr ? t.project === pr.id : true) && (!t.done || (t.doneAt && Date.now() - t.doneAt < 7 * DAY)));
	const cols: { id: "todo" | "doing" | "done"; title: string; items: Task[] }[] = [
		{ id: "todo", title: "📝 Belum", items: tasks.filter((t) => !t.done && t.status !== "doing") },
		{ id: "doing", title: "⚙️ Dikerjakan", items: tasks.filter((t) => !t.done && t.status === "doing") },
		{ id: "done", title: "✅ Selesai", items: tasks.filter((t) => t.done) },
	];
	const board = el.createDiv("fch-kanban");
	for (const c of cols) {
		const col = board.createDiv("fch-kcol is-" + c.id);
		const h = col.createDiv("fch-kcol-head");
		h.createSpan({ text: c.title });
		h.createSpan({ cls: "fch-tab-n", text: String(c.items.length) });
		const zone = col.createDiv("fch-kzone");
		zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.addClass("is-over"); });
		zone.addEventListener("dragleave", () => zone.removeClass("is-over"));
		zone.addEventListener("drop", (e) => {
			e.preventDefault();
			zone.removeClass("is-over");
			const t = p.data.tasks.find((x) => x.id === e.dataTransfer?.getData("text/plain"));
			if (!t) return;
			if (c.id === "done") { if (!t.done) toggleTask(p, t, hub.mainEl); }
			else {
				if (t.done) toggleTask(p, t);
				t.status = c.id === "doing" ? "doing" : undefined;
				play("click");
			}
			p.requestSave();
			hub.renderPage();
		});
		c.items.sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || b.priority - a.priority);
		for (const t of c.items) {
			const k = zone.createDiv("fch-kcard" + (t.done ? " is-done" : ""));
			k.draggable = true;
			k.style.setProperty("--prio", PRIO[t.priority].color);
			k.addEventListener("dragstart", (e) => { e.dataTransfer?.setData("text/plain", t.id); k.addClass("is-drag"); });
			k.addEventListener("dragend", () => k.removeClass("is-drag"));
			k.createDiv({ cls: "fch-kcard-title", text: t.title });
			const m = k.createDiv("fch-task-meta");
			if (t.due) m.createSpan({ text: "📅 " + new Date(keyT(t.due)).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) });
			if (t.subtasks.length) m.createSpan({ text: `☑ ${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` });
			if (t.path) m.createSpan({ text: "📘 " + basename(t.path) });
			const pj = !pr && t.project ? p.data.projects.find((x) => x.id === t.project) : undefined;
			if (pj) m.createSpan({ cls: "fch-task-proj", text: "📁 " + pj.name, attr: { style: `--pc:${pj.color}` } });
			const mv = k.createDiv("fch-kmove");
			const order: ("todo" | "doing" | "done")[] = ["todo", "doing", "done"];
			const ci = order.indexOf(c.id);
			const move = (to: "todo" | "doing" | "done") => {
				if (to === "done") { if (!t.done) toggleTask(p, t, hub.mainEl); }
				else { if (t.done) toggleTask(p, t); t.status = to === "doing" ? "doing" : undefined; play("click"); }
				p.requestSave();
				hub.renderPage();
			};
			if (ci > 0) btn(mv, { icon: "chevron-left", cls: "fch-btn-ghost fch-btn-sm", label: "Pindah ke kolom sebelumnya", onClick: (e) => { e.stopPropagation(); move(order[ci - 1]); } });
			if (ci < 2) btn(mv, { icon: "chevron-right", cls: "fch-btn-ghost fch-btn-sm", label: "Pindah ke kolom berikutnya", onClick: (e) => { e.stopPropagation(); move(order[ci + 1]); } });
			k.onclick = () => { openTask(t.id); hub.navigate("tasks"); };
		}
		if (!c.items.length) zone.createDiv({ cls: "fch-muted fch-small fch-kempty", text: "Seret kartu tugas ke sini" });
	}
	const arch = p.data.projects.filter((x) => x.archived);
	if (arch.length) {
		const a = el.createDiv("fch-mt fch-muted fch-small");
		a.createSpan({ text: `Arsip: ` });
		arch.forEach((x) => { const b = a.createEl("a", { text: x.name, href: "#" }); b.onclick = (e) => { e.preventDefault(); x.archived = false; current = x.id; p.requestSave(); hub.renderPage(); }; a.createSpan({ text: "  " }); });
	}
}
