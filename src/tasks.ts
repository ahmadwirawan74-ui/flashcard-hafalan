import { Notice, setIcon } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { Repeat, Task } from "./types";
import { DAY, addDays, dayKey, startOfDay } from "./scheduler";
import { basename, btn, confetti, ring } from "./util";
import { play } from "./sound";

const uid = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const todayKey = () => dayKey(Date.now());
const keyToTime = (k: string) => new Date(k + "T00:00:00").getTime();
const DAYS = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
const MONTHS = ["jan", "feb", "mar", "apr", "mei", "jun", "jul", "agu", "sep", "okt", "nov", "des"];
export const PRIO = [
	{ label: "Tanpa", color: "var(--text-faint)" },
	{ label: "Rendah", color: "#3b82f6" },
	{ label: "Sedang", color: "#f59e0b" },
	{ label: "Tinggi", color: "#ef4444" },
];
export const REPEAT_LABEL: Record<Repeat, string> = { daily: "Setiap hari", weekdays: "Hari kerja", weekly: "Setiap minggu", monthly: "Setiap bulan" };

// ---------------------------------------------------------------- tambah cepat (bahasa sehari-hari)
export interface Parsed { title: string; due?: string; time?: string; priority: 0 | 1 | 2 | 3; tags: string[]; repeat?: Repeat; path?: string }

/**
 * Contoh: "Kerjakan latihan kimia besok jam 7 malam !tinggi #kimia @01 Sel"
 *   → judul "Kerjakan latihan kimia", besok 19:00, prioritas tinggi, tag kimia, materi 01 Sel.
 */
export function parseQuick(p: FlashcardPlugin, raw: string): Parsed {
	let t = " " + raw + " ";
	const out: Parsed = { title: "", priority: 0, tags: [] };
	const today = startOfDay(Date.now());
	const take = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
		const m = re.exec(t);
		if (m) { fn(m); t = t.replace(m[0], " "); }
	};
	// prioritas
	take(/\s!(tinggi|penting|!!|1)(?=\s)/i, () => (out.priority = 3));
	take(/\s!(sedang|!|2)(?=\s)/i, () => (out.priority = 2));
	take(/\s!(rendah|3)(?=\s)/i, () => (out.priority = 1));
	take(/\s!(?=\s)/, () => (out.priority = 3));
	// tag & materi
	for (let m = /\s#([\p{L}\p{N}_/-]+)/u.exec(t); m; m = /\s#([\p{L}\p{N}_/-]+)/u.exec(t)) { out.tags.push(m[1].toLowerCase()); t = t.replace(m[0], " "); }
	take(/\s@([^\s!#][^!#]*?)(?=\s(?:besok|lusa|hari|jam|pukul|setiap|tiap|tgl|tanggal|senin|selasa|rabu|kamis|jumat|sabtu|minggu|\d)|\s*$)/i, (m) => {
		const q = m[1].trim().toLowerCase();
		const hit = p.sortedPaths().find((x) => basename(x).toLowerCase() === q) ?? p.sortedPaths().find((x) => basename(x).toLowerCase().includes(q));
		if (hit) out.path = hit;
	});
	// pengulangan
	take(/\s(?:setiap|tiap)\s+hari\s+kerja(?=\s)/i, () => (out.repeat = "weekdays"));
	take(/\s(?:setiap|tiap)\s+hari(?=\s)/i, () => (out.repeat = "daily"));
	take(/\s(?:setiap|tiap)\s+bulan(?=\s)/i, () => (out.repeat = "monthly"));
	take(/\s(?:setiap|tiap)\s+(minggu|senin|selasa|rabu|kamis|jumat|sabtu)(?=\s)/i, (m) => {
		out.repeat = "weekly";
		if (m[1].toLowerCase() !== "minggu" || /setiap\s+minggu\s/i.test(m[0] + " ")) {
			const d = DAYS.indexOf(m[1].toLowerCase());
			if (m[1].toLowerCase() !== "minggu") out.due = dayKey(addDays(today, (d - new Date(today).getDay() + 7) % 7));
		}
	});
	// tanggal
	take(/\s(hari ini|hr ini|nanti)(?=\s)/i, () => (out.due = dayKey(today)));
	take(/\sbesok(?=\s)/i, () => (out.due = dayKey(addDays(today, 1))));
	take(/\skemarin(?=\s)/i, () => (out.due = dayKey(addDays(today, -1))));
	take(/\slusa(?=\s)/i, () => (out.due = dayKey(addDays(today, 2))));
	take(/\sminggu depan(?=\s)/i, () => (out.due = dayKey(addDays(today, 7))));
	take(/\s(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu)(?=\s)/i, (m) => {
		const d = DAYS.indexOf(m[1].toLowerCase().replace("'", ""));
		out.due = dayKey(addDays(today, (d - new Date(today).getDay() + 7) % 7 || 7));
	});
	take(/\s(?:tgl|tanggal)?\s*(\d{1,2})\s*(?:\/|-|\s)\s*(\d{1,2}|jan\w*|feb\w*|mar\w*|apr\w*|mei|jun\w*|jul\w*|agu\w*|sep\w*|okt\w*|nov\w*|des\w*)(?:\s*(?:\/|-)\s*(\d{4}))?(?=\s)/i, (m) => {
		const d = parseInt(m[1], 10);
		const mo = /^\d+$/.test(m[2]) ? parseInt(m[2], 10) - 1 : MONTHS.findIndex((x) => m[2].toLowerCase().startsWith(x));
		if (mo < 0 || mo > 11 || d < 1 || d > 31) return;
		const now = new Date(today);
		let y = m[3] ? parseInt(m[3], 10) : now.getFullYear();
		if (!m[3] && new Date(y, mo, d).getTime() < today) y++;
		out.due = dayKey(new Date(y, mo, d).getTime());
	});
	take(/\s(?:tgl|tanggal)\s+(\d{1,2})(?=\s)/i, (m) => {
		const d = parseInt(m[1], 10);
		const now = new Date(today);
		let dt = new Date(now.getFullYear(), now.getMonth(), d);
		if (dt.getTime() < today) dt = new Date(now.getFullYear(), now.getMonth() + 1, d);
		out.due = dayKey(dt.getTime());
	});
	// jam
	take(/\s(?:jam|pukul|pkl\.?)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(pagi|siang|sore|malam)?(?=\s)/i, (m) => setTime(m[1], m[2], m[3]));
	take(/\s(\d{1,2})[:.](\d{2})\s*(pagi|siang|sore|malam)?(?=\s)/i, (m) => setTime(m[1], m[2], m[3]));
	function setTime(h: string, mi: string | undefined, part: string | undefined) {
		let hh = parseInt(h, 10);
		const p2 = (part ?? "").toLowerCase();
		if ((p2 === "sore" || p2 === "malam") && hh < 12) hh += 12;
		if (p2 === "siang" && hh < 6) hh += 12;
		if (hh > 23) return;
		out.time = `${String(hh).padStart(2, "0")}:${String(parseInt(mi ?? "0", 10)).padStart(2, "0")}`;
		if (!out.due) out.due = dayKey(today);
	}
	if (out.repeat && !out.due) out.due = dayKey(today);
	out.title = t.replace(/\s+/g, " ").trim();
	return out;
}

// ---------------------------------------------------------------- data
export function addTask(p: FlashcardPlugin, raw: string, preset: Partial<Task> = {}): Task | null {
	const q = parseQuick(p, raw);
	if (!q.title) return null;
	// Yang ditulis pengguna (tanggal, jam, prioritas, dst.) selalu menang atas nilai bawaan halaman.
	const t: Task = {
		id: uid(), notes: "", subtasks: [], done: false, created: Date.now(), pomos: 0,
		...preset,
		title: q.title,
		priority: q.priority || preset.priority || 0,
		tags: [...new Set([...(preset.tags ?? []), ...q.tags])],
		due: q.due ?? preset.due,
		time: q.time ?? preset.time,
		repeat: q.repeat ?? preset.repeat,
		path: q.path ?? preset.path,
	};
	p.data.tasks.push(t);
	p.requestSave();
	p.refreshViews();
	return t;
}

function nextDue(t: Task): string {
	let d = keyToTime(t.due ?? todayKey());
	const today = startOfDay(Date.now());
	do {
		if (t.repeat === "daily") d = addDays(d, 1);
		else if (t.repeat === "weekdays") { d = addDays(d, 1); while ([0, 6].includes(new Date(d).getDay())) d = addDays(d, 1); }
		else if (t.repeat === "weekly") d = addDays(d, 7);
		else { const x = new Date(d); x.setMonth(x.getMonth() + 1); d = x.getTime(); }
	} while (d <= today && t.repeat !== undefined && d < today);
	return dayKey(d);
}

export function toggleTask(p: FlashcardPlugin, t: Task, root?: HTMLElement) {
	const m = p.data.meta;
	if (!t.done) {
		const k = todayKey();
		t.log = [...(t.log ?? []).slice(-60), k];
		m.tasksDone = (m.tasksDone ?? 0) + 1;
		p.track("taskDone");
		p.addCoins(t.priority >= 3 ? 3 : 2);
		play("coin");
		if (t.repeat) {
			t.due = nextDue(t);
			t.subtasks.forEach((s) => (s.done = false));
			t.reminded = undefined;
			new Notice(`🔁 Selesai! Muncul lagi ${fmtDue(t)}.`, 3000);
		} else {
			t.done = true;
			t.doneAt = Date.now();
		}
		const left = dueToday(p).length;
		if (!left && root && p.data.settings.confetti) { confetti(root); play("victory"); new Notice("🎉 Semua tugas hari ini selesai!"); }
		p.checkAchievements();
	} else {
		t.done = false;
		t.doneAt = undefined;
		play("click");
	}
	p.requestSave();
	p.refreshViews();
}

export function deleteTask(p: FlashcardPlugin, t: Task) {
	p.data.tasks = p.data.tasks.filter((x) => x.id !== t.id);
	p.requestSave();
	p.refreshViews();
}

export const isOverdue = (t: Task) => !t.done && !!t.due && t.due < todayKey();
export const dueToday = (p: FlashcardPlugin) => p.data.tasks.filter((t) => !t.done && t.due && t.due <= todayKey());
/** Apakah tugas (termasuk tugas berulang) terjadwal pada tanggal k. */
export function occursOn(t: Task, k: string): boolean {
	if (!t.due) return false;
	if (!t.repeat) return t.due === k;
	if (k < t.due) return false;
	const d = new Date(k + "T00:00:00"), s = new Date(t.due + "T00:00:00");
	if (t.repeat === "daily") return true;
	if (t.repeat === "weekdays") return d.getDay() !== 0 && d.getDay() !== 6;
	if (t.repeat === "weekly") return d.getDay() === s.getDay();
	return d.getDate() === s.getDate();
}
export function tasksOn(p: FlashcardPlugin, k: string) {
	return p.data.tasks.filter((t) => (!t.done && occursOn(t, k)) || (t.done && t.doneAt && dayKey(t.doneAt) === k) || (t.repeat && t.log?.includes(k)));
}

/** Tugas berulang yang terlewat digeser ke kemunculan berikutnya (hari ini atau setelahnya), agar jadwal & pengingat tetap jalan. */
export function rollRecurring(p: FlashcardPlugin) {
	const k = todayKey();
	let changed = false;
	for (const t of p.data.tasks) {
		if (!t.repeat || t.done || !t.due || t.due >= k) continue;
		t.due = nextDue(t); // kemunculan pertama yang jatuh hari ini atau sesudahnya
		t.reminded = undefined;
		changed = true;
	}
	if (changed) p.requestSave();
}

export function fmtDue(t: Task): string {
	if (!t.due) return "";
	const d = Math.round((keyToTime(t.due) - startOfDay(Date.now())) / DAY);
	const day = d === 0 ? "Hari ini" : d === 1 ? "Besok" : d === -1 ? "Kemarin" : d < 0 ? `Terlambat ${-d} hari` : d < 7 ? new Date(keyToTime(t.due)).toLocaleDateString("id-ID", { weekday: "long" }) : new Date(keyToTime(t.due)).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
	return day + (t.time ? ` · ${t.time}` : "");
}

/** Pengingat: muncul saat jam tugas tiba (dicek tiap 30 detik oleh plugin). */
export function checkReminders(p: FlashcardPlugin) {
	rollRecurring(p);
	if (!p.data.settings.taskReminders) return;
	const now = Date.now(), k = todayKey();
	for (const t of p.data.tasks) {
		if (t.done || t.due !== k || !t.time || t.reminded === k) continue;
		const at = keyToTime(k) + (parseInt(t.time.slice(0, 2), 10) * 60 + parseInt(t.time.slice(3), 10)) * 60_000;
		if (now >= at && now - at < 3600_000) {
			t.reminded = k;
			play("chime");
			new Notice(`⏰ ${t.time} · ${t.title}`, 15_000);
			p.requestSave();
		}
	}
}

// ---------------------------------------------------------------- tampilan baris tugas
let openId = "";
export const openTask = (id: string) => { openId = id; };

export function taskRow(hub: HubView, parent: HTMLElement, t: Task, opts: { compact?: boolean } = {}) {
	const p = hub.plugin;
	const row = parent.createDiv("fch-task" + (t.done ? " is-done" : "") + (isOverdue(t) ? " is-overdue" : "") + (openId === t.id && !opts.compact ? " is-open" : ""));
	row.style.setProperty("--prio", PRIO[t.priority].color);
	const main = row.createDiv("fch-task-main");
	const cb = main.createEl("button", { cls: "fch-task-check", attr: { "aria-label": t.done ? "Tandai belum selesai" : "Tandai selesai" } });
	if (t.done) setIcon(cb, "check");
	cb.onclick = (e) => { e.stopPropagation(); row.addClass("is-ticking"); window.setTimeout(() => toggleTask(p, t, hub.mainEl), 180); };
	const body = main.createDiv("fch-task-body");
	body.createDiv({ cls: "fch-task-title", text: t.title });
	const meta = body.createDiv("fch-task-meta");
	if (t.due) meta.createSpan({ cls: "fch-task-due" + (isOverdue(t) ? " is-late" : t.due === todayKey() ? " is-today" : ""), text: "📅 " + fmtDue(t) });
	if (t.repeat) meta.createSpan({ text: "🔁 " + REPEAT_LABEL[t.repeat] });
	if (t.subtasks.length) meta.createSpan({ text: `☑ ${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` });
	if (t.pomos) meta.createSpan({ text: `🍅 ${t.pomos}` });
	if (t.path) meta.createSpan({ cls: "fch-task-mat", text: "📘 " + basename(t.path) });
	const pj = t.project ? p.data.projects.find((x) => x.id === t.project) : undefined;
	if (pj) meta.createSpan({ cls: "fch-task-proj", text: "📁 " + pj.name, attr: { style: `--pc:${pj.color}` } });
	t.tags.forEach((g) => meta.createSpan({ cls: "fch-task-tag", text: "#" + g }));
	if (t.notes.trim()) meta.createSpan({ text: "📝" });
	const act = main.createDiv("fch-task-act");
	if (t.path && !t.done) btn(act, { icon: "play", cls: "fch-btn-ghost fch-btn-sm", label: "Belajar materi ini", onClick: (e) => { e.stopPropagation(); hub.startSession(p.index.get(t.path!) ?? [], { title: basename(t.path!), cram: false, mode: p.data.settings.defaultMode }); } });
	if (!t.done) btn(act, { icon: "timer", cls: "fch-btn-ghost fch-btn-sm", label: "Fokus pada tugas ini (Pomodoro)", onClick: (e) => { e.stopPropagation(); focusTask(hub, t); } });
	main.onclick = () => { if (opts.compact) { openId = t.id; hub.navigate("tasks"); return; } openId = openId === t.id ? "" : t.id; hub.renderPage(); };
	if (openId === t.id && !opts.compact) taskEditor(hub, row, t);
}

export function focusTask(hub: HubView, t: Task) {
	const p = hub.plugin;
	p.data.meta.pomoTask = t.title;
	(p.data.meta as Record<string, unknown>).pomoTaskId = t.id;
	if (!p.pomo.running) p.pomo.toggle();
	hub.navigate("focus");
}

function taskEditor(hub: HubView, row: HTMLElement, t: Task) {
	const p = hub.plugin;
	const save = () => { p.requestSave(); };
	const ed = row.createDiv("fch-task-edit");
	ed.onclick = (e) => e.stopPropagation();
	const title = ed.createEl("input", { type: "text", cls: "fch-input fch-task-title-in" });
	title.value = t.title;
	title.oninput = () => { t.title = title.value; save(); };
	const notes = ed.createEl("textarea", { cls: "fch-input", attr: { rows: "2", placeholder: "Catatan tugas…" } });
	notes.value = t.notes;
	notes.oninput = () => { t.notes = notes.value; save(); };
	const grid = ed.createDiv("fch-task-grid");
	const field = (label: string) => { const f = grid.createDiv("fch-field"); f.createEl("label", { text: label }); return f; };
	const date = field("Tanggal").createEl("input", { type: "date", cls: "fch-input" });
	date.value = t.due ?? "";
	date.onchange = () => { t.due = date.value || undefined; t.reminded = undefined; save(); };
	const time = field("Jam").createEl("input", { type: "time", cls: "fch-input" });
	time.value = t.time ?? "";
	time.onchange = () => { t.time = time.value || undefined; t.reminded = undefined; save(); };
	const rep = field("Ulangi").createEl("select", { cls: "dropdown fch-select" });
	rep.createEl("option", { text: "Tidak", attr: { value: "" } });
	(Object.keys(REPEAT_LABEL) as Repeat[]).forEach((r) => rep.createEl("option", { text: REPEAT_LABEL[r], attr: { value: r } }));
	rep.value = t.repeat ?? "";
	rep.onchange = () => { t.repeat = (rep.value || undefined) as Repeat | undefined; if (t.repeat && !t.due) t.due = todayKey(); save(); };
	const dur = field("Durasi").createEl("select", { cls: "dropdown fch-select" });
	[15, 30, 45, 60, 90, 120, 180].forEach((m) => dur.createEl("option", { text: m < 60 ? `${m} menit` : `${m / 60} jam`, attr: { value: String(m) } }));
	dur.value = String(t.duration ?? 60);
	dur.onchange = () => { t.duration = parseInt(dur.value, 10); save(); };
	const proj = field("Proyek").createEl("select", { cls: "dropdown fch-select" });
	proj.createEl("option", { text: "—", attr: { value: "" } });
	p.data.projects.filter((x) => !x.archived).forEach((x) => proj.createEl("option", { text: x.name, attr: { value: x.id } }));
	proj.value = t.project ?? "";
	proj.onchange = () => { t.project = proj.value || undefined; save(); };
	const mat = field("Materi terkait").createEl("select", { cls: "dropdown fch-select" });
	mat.createEl("option", { text: "—", attr: { value: "" } });
	p.sortedPaths().forEach((x) => mat.createEl("option", { text: basename(x), attr: { value: x } }));
	mat.value = t.path ?? "";
	mat.onchange = () => { t.path = mat.value || undefined; save(); };
	const pr = ed.createDiv("fch-row");
	pr.createSpan({ cls: "fch-small fch-strong", text: "Prioritas" });
	const seg = pr.createDiv("fch-seg");
	PRIO.forEach((x, i) => {
		const b = seg.createEl("button", { cls: "fch-seg-btn" + (t.priority === i ? " is-active" : ""), text: x.label });
		b.onclick = () => { t.priority = i as Task["priority"]; save(); hub.renderPage(); };
	});
	const tg = pr.createEl("input", { type: "text", cls: "fch-input fch-grow", attr: { placeholder: "tag, pisahkan dengan koma" } });
	tg.value = t.tags.join(", ");
	tg.onchange = () => { t.tags = tg.value.split(",").map((x) => x.trim().replace(/^#/, "").toLowerCase()).filter(Boolean); save(); hub.renderPage(); };
	// sub-tugas
	const sub = ed.createDiv("fch-subtasks");
	t.subtasks.forEach((s, i) => {
		const r = sub.createDiv("fch-subtask" + (s.done ? " is-done" : ""));
		const c = r.createEl("input", { type: "checkbox" });
		c.checked = s.done;
		c.onchange = () => { s.done = c.checked; if (c.checked) play("click"); save(); r.toggleClass("is-done", c.checked); };
		const inp = r.createEl("input", { type: "text", cls: "fch-input fch-grow" });
		inp.value = s.text;
		inp.oninput = () => { s.text = inp.value; save(); };
		btn(r, { icon: "x", cls: "fch-btn-ghost fch-btn-sm", label: "Hapus", onClick: () => { t.subtasks.splice(i, 1); save(); hub.renderPage(); } });
	});
	const add = sub.createEl("input", { type: "text", cls: "fch-input", attr: { placeholder: "+ Tambah sub-tugas (Enter)" } });
	add.onkeydown = (e) => {
		if (e.key !== "Enter" || !add.value.trim()) return;
		t.subtasks.push({ id: uid(), text: add.value.trim(), done: false });
		save();
		hub.renderPage();
		window.setTimeout(() => (hub.mainEl.querySelector(".fch-subtasks input[placeholder^='+']") as HTMLInputElement | null)?.focus(), 30);
	};
	const foot = ed.createDiv("fch-row");
	btn(foot, { text: "Fokus", icon: "timer", cls: "fch-btn-sm", onClick: () => focusTask(hub, t) });
	if (t.path) btn(foot, { text: "Belajar materi", icon: "play", cls: "fch-btn-sm", onClick: () => hub.startSession(p.index.get(t.path!) ?? [], { title: basename(t.path!), cram: false, mode: p.data.settings.defaultMode }) });
	foot.createDiv("fch-grow");
	btn(foot, { text: "Hapus", icon: "trash-2", cls: "fch-btn-ghost fch-btn-sm fch-danger", onClick: () => { deleteTask(p, t); openId = ""; } });
	btn(foot, { text: "Tutup", cls: "fch-btn-sm", onClick: () => { openId = ""; p.refreshViews(); hub.renderPage(); } });
}

/** Kolom tambah cepat dengan pratinjau hasil tafsiran. */
export function quickAdd(hub: HubView, parent: HTMLElement, preset: Partial<Task> = {}, placeholder = "Tambah tugas… mis. “Latihan soal kimia besok jam 7 malam !tinggi #kimia”") {
	const p = hub.plugin;
	const box = parent.createDiv("fch-quickadd");
	const ic = box.createSpan("fch-quickadd-ic");
	setIcon(ic, "plus");
	const inp = box.createEl("input", { type: "text", cls: "fch-input fch-grow", attr: { placeholder } });
	const chips = parent.createDiv("fch-qa-chips");
	inp.oninput = () => {
		chips.empty();
		if (!inp.value.trim()) return;
		const q = parseQuick(p, inp.value);
		if (q.due) chips.createSpan({ cls: "fch-pill is-new", text: "📅 " + fmtDue({ due: q.due, time: q.time } as Task) });
		if (q.repeat) chips.createSpan({ cls: "fch-pill", text: "🔁 " + REPEAT_LABEL[q.repeat] });
		if (q.priority) chips.createSpan({ cls: "fch-pill", text: "⚑ " + PRIO[q.priority].label });
		q.tags.forEach((g) => chips.createSpan({ cls: "fch-pill", text: "#" + g }));
		if (q.path) chips.createSpan({ cls: "fch-pill is-due", text: "📘 " + basename(q.path) });
	};
	inp.onkeydown = (e) => {
		if (e.key !== "Enter") return;
		const t = addTask(p, inp.value, preset);
		if (!t) return;
		play("click");
		inp.value = "";
		chips.empty();
		const ph = inp.placeholder;
		hub.renderPage();
		window.setTimeout(() => ([...hub.mainEl.querySelectorAll<HTMLInputElement>(".fch-quickadd input")].find((x) => x.placeholder === ph))?.focus(), 60);
	};
	return inp;
}

// ---------------------------------------------------------------- halaman Tugas
let view: "today" | "upcoming" | "all" | "matrix" | "done" = "today";
let tagFilter = "";

export function renderTasks(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const k = todayKey();
	const open = p.data.tasks.filter((t) => !t.done);
	const today = open.filter((t) => t.due && t.due <= k);
	const doneToday = p.data.tasks.filter((t) => (t.doneAt && dayKey(t.doneAt) === k) || t.log?.includes(k)).length;
	const head = el.createDiv("fch-pagehead fch-pagehead-row");
	const ht = head.createDiv();
	ht.createEl("h1", { text: "✅ Tugas" });
	ht.createDiv({ cls: "fch-muted", text: "Tulis seperti biasa: tanggal, jam, prioritas (!tinggi), tag (#kimia), materi (@01 Sel), dan pengulangan (setiap senin) dikenali otomatis." });
	const total = today.length + doneToday;
	const rg = ring(head, total ? doneToday / total : 0, 74, `${doneToday}/${total}`, "fch-task-ring");
	rg.setAttr("aria-label", "Tugas hari ini selesai");

	quickAdd(hub, el, view === "today" ? { due: k } : {});

	const tabs = el.createDiv("fch-tabs");
	const tab = (id: typeof view, label: string, n?: number) => {
		const b = tabs.createEl("button", { cls: "fch-tab" + (view === id ? " is-active" : "") });
		b.createSpan({ text: label });
		if (n) b.createSpan({ cls: "fch-tab-n", text: String(n) });
		b.onclick = () => { view = id; hub.renderPage(); };
	};
	tab("today", "Hari ini", today.length);
	tab("upcoming", "Mendatang", open.filter((t) => t.due && t.due > k).length);
	tab("all", "Semua", open.length);
	tab("matrix", "Matriks prioritas");
	tab("done", "Selesai");
	const tags = [...new Set(open.flatMap((t) => t.tags))];
	if (tags.length) {
		const tf = el.createDiv("fch-chips");
		for (const g of ["", ...tags]) {
			const c = tf.createEl("button", { cls: "fch-chip" + (tagFilter === g ? " is-active" : ""), text: g ? "#" + g : "Semua tag" });
			c.onclick = () => { tagFilter = g; hub.renderPage(); };
		}
	}
	const pass = (t: Task) => !tagFilter || t.tags.includes(tagFilter);
	const sortT = (a: Task, b: Task) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || (a.time ?? "99").localeCompare(b.time ?? "99") || b.priority - a.priority;
	const list = el.createDiv("fch-tasklist");
	const section = (title: string, items: Task[], cls = "") => {
		if (!items.length) return;
		list.createDiv({ cls: "fch-task-sec " + cls, text: `${title} · ${items.length}` });
		items.forEach((t) => taskRow(hub, list, t));
	};

	if (view === "today") {
		// tugas otomatis dari jadwal belajar
		const w = p.waitingToday();
		if (w.due + w.fresh) {
			const r = list.createDiv("fch-task is-auto");
			const m = r.createDiv("fch-task-main");
			m.createSpan({ cls: "fch-task-auto-ic", text: "🧠" });
			const b = m.createDiv("fch-task-body");
			b.createDiv({ cls: "fch-task-title", text: `Ulas ${w.due + w.fresh} kartu flashcard` });
			b.createDiv({ cls: "fch-task-meta", text: "Otomatis dari jadwal FSRS" });
			btn(m.createDiv("fch-task-act"), { text: "Mulai", icon: "play", cls: "fch-btn-primary fch-btn-sm", onClick: () => hub.startSession(p.allCards(), { title: "Semua materi", cram: false, mode: p.data.settings.defaultMode }) });
		}
		for (const e of p.data.exams.filter((x) => x.date >= k).slice(0, 2)) {
			const days = Math.round((keyToTime(e.date) - startOfDay(Date.now())) / DAY);
			if (days > 14) continue;
			const r = list.createDiv("fch-task is-auto is-exam");
			const m = r.createDiv("fch-task-main");
			m.createSpan({ cls: "fch-task-auto-ic", text: "🎓" });
			const b = m.createDiv("fch-task-body");
			b.createDiv({ cls: "fch-task-title", text: `${e.name} · ${days === 0 ? "hari ini!" : `H-${days}`}` });
			b.createDiv({ cls: "fch-task-meta", text: "Ujian terjadwal" });
		}
		const items = today.filter(pass).sort(sortT);
		section("Terlambat", items.filter(isOverdue), "is-late");
		section("Hari ini", items.filter((t) => !isOverdue(t)));
		if (!items.length) list.createDiv({ cls: "fch-empty", text: doneToday ? "🎉 Semua tugas hari ini selesai!" : "Belum ada tugas untuk hari ini. Ketik di atas untuk menambah." });
	} else if (view === "upcoming") {
		const items = open.filter((t) => t.due && t.due > k && pass(t)).sort(sortT);
		const by = new Map<string, Task[]>();
		for (const t of items) (by.get(t.due!) ?? by.set(t.due!, []).get(t.due!)!).push(t);
		for (const [d, ts] of by) section(new Date(keyToTime(d)).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" }), ts);
		section("Tanpa tanggal", open.filter((t) => !t.due && pass(t)));
		if (!items.length && !open.some((t) => !t.due)) list.createDiv({ cls: "fch-empty", text: "Tidak ada tugas mendatang." });
	} else if (view === "all") {
		const items = open.filter(pass).sort(sortT);
		[3, 2, 1, 0].forEach((pr) => section(`Prioritas ${PRIO[pr].label.toLowerCase()}`, items.filter((t) => t.priority === pr)));
		if (!items.length) list.createDiv({ cls: "fch-empty", text: "Belum ada tugas." });
	} else if (view === "done") {
		const items = p.data.tasks.filter((t) => t.done && pass(t)).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)).slice(0, 80);
		section("Selesai", items);
		if (items.length) btn(list, { text: "Hapus semua tugas selesai", icon: "trash-2", cls: "fch-btn-ghost fch-btn-sm fch-danger", onClick: () => { p.data.tasks = p.data.tasks.filter((t) => !t.done); p.requestSave(); hub.renderPage(); } });
		else list.createDiv({ cls: "fch-empty", text: "Belum ada tugas yang selesai." });
	} else {
		const soon = dayKey(addDays(startOfDay(Date.now()), 2));
		const urgent = (t: Task) => !!t.due && t.due <= soon;
		const important = (t: Task) => t.priority >= 2;
		const grid = list.createDiv("fch-matrix");
		const q = (title: string, sub: string, cls: string, items: Task[]) => {
			const c = grid.createDiv("fch-quad " + cls);
			c.createDiv({ cls: "fch-quad-title", text: title });
			c.createDiv({ cls: "fch-muted fch-small", text: sub });
			items.sort(sortT).forEach((t) => taskRow(hub, c, t, { compact: true }));
			if (!items.length) c.createDiv({ cls: "fch-muted fch-small fch-mt", text: "—" });
		};
		const items = open.filter(pass);
		q("🔥 Kerjakan sekarang", "Penting & mendesak", "q1", items.filter((t) => important(t) && urgent(t)));
		q("📅 Jadwalkan", "Penting, belum mendesak", "q2", items.filter((t) => important(t) && !urgent(t)));
		q("⚡ Selesaikan cepat", "Mendesak, kurang penting", "q3", items.filter((t) => !important(t) && urgent(t)));
		q("🧺 Nanti saja", "Tidak mendesak & kurang penting", "q4", items.filter((t) => !important(t) && !urgent(t)));
	}
}

/** Panel ringkas "Tugas hari ini" untuk Beranda. */
export function renderTodayPanel(hub: HubView, parent: HTMLElement) {
	const p = hub.plugin;
	const box = parent.createDiv("fch-panel fch-today-tasks");
	const h = box.createDiv("fch-section-head");
	h.createEl("h3", { text: "✅ Tugas hari ini" });
	btn(h, { text: "Semua tugas", cls: "fch-btn-link", onClick: () => hub.navigate("tasks") });
	quickAdd(hub, box, { due: todayKey() }, "Tambah tugas hari ini…");
	const items = dueToday(p).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || b.priority - a.priority);
	items.slice(0, 6).forEach((t) => taskRow(hub, box, t, { compact: true }));
	if (items.length > 6) box.createDiv({ cls: "fch-muted fch-small", text: `+${items.length - 6} tugas lagi` });
	if (!items.length) box.createDiv({ cls: "fch-muted fch-small fch-mt", text: "Tidak ada tugas untuk hari ini. 🎈" });
}
