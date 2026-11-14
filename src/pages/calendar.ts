import type { HubView } from "../hub-view";
import { addDays, dayKey, startOfDay } from "../scheduler";
import { examPlan } from "../analytics";
import { isOverdue, occursOn, quickAdd, taskRow, tasksOn } from "../tasks";
import { BlockModal } from "../studyplan";
import { hijri } from "../ibadah";
import { AItem, AKind, KIND_META, agendaRow, dayItems, dueMap, tOf } from "../agenda";
import { basename, btn } from "../util";

let view: "month" | "week" | "agenda" = "month";
let offset = 0;
let selected = "";
const hide = new Set<AKind>(["prayer"]);
const FILTERS: AKind[] = ["exam", "class", "plan", "task", "review", "study", "quran", "pomo", "habit", "note", "prayer"];
const H0 = 4, H1 = 23, PX = 44;
const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);

export function renderCalendar(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const today = startOfDay(Date.now());
	const tk = dayKey(today);
	if (!selected) selected = tk;
	const due = dueMap(p);
	const items = (k: string) => dayItems(hub, k, due, { prayers: !hide.has("prayer") }).filter((x) => !hide.has(x.kind));
	const untimed = (k: string) => (hide.has("task") ? [] : tasksOn(p, k).filter((x) => !x.time));

	// ---- kepala: judul, navigasi, pilihan tampilan
	let start: number, count: number, title: string;
	if (view === "month") {
		const base = new Date(today); base.setDate(1); base.setMonth(base.getMonth() + offset);
		start = base.getTime(); count = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
		title = base.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
	} else if (view === "week") {
		start = addDays(today, -((new Date(today).getDay() + 6) % 7) + offset * 7); count = 7;
		title = `${new Date(start).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${new Date(addDays(start, 6)).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
	} else {
		start = addDays(today, offset * 21); count = 21;
		title = offset ? `${new Date(start).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${new Date(addDays(start, 20)).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}` : "3 minggu ke depan";
	}
	const h1 = hijri(p, start), h2 = hijri(p, addDays(start, count - 1));
	const head = el.createDiv("fch-cal2-head");
	const hl = head.createDiv("fch-cal2-titlebox");
	hl.createDiv({ cls: "fch-cal2-title", text: title });
	if (h1.y) hl.createDiv({ cls: "fch-cal2-hijri", text: `${h1.month}${h1.month !== h2.month ? " – " + h2.month : ""} ${h2.y} H` });
	const nav = head.createDiv("fch-cal2-nav");
	btn(nav, { icon: "chevron-left", cls: "fch-btn-sm", label: "Sebelumnya", onClick: () => { offset--; hub.renderPage(); } });
	btn(nav, { text: "Hari ini", cls: "fch-btn-sm" + (offset ? "" : " fch-btn-ghost"), onClick: () => { offset = 0; selected = tk; hub.renderPage(); } });
	btn(nav, { icon: "chevron-right", cls: "fch-btn-sm", label: "Berikutnya", onClick: () => { offset++; hub.renderPage(); } });
	const seg = head.createDiv("fch-seg");
	for (const [v, l] of [["month", "Bulan"], ["week", "Minggu"], ["agenda", "Agenda"]] as const) {
		const b = seg.createEl("button", { cls: "fch-seg-btn" + (view === v ? " is-active" : ""), text: l });
		b.onclick = () => { view = v; offset = 0; hub.renderPage(); };
	}
	btn(head, { text: "Jadwal belajar", icon: "calendar-plus", cls: "fch-btn-primary fch-btn-sm", onClick: () => new BlockModal(hub.app, p, () => hub.renderPage(), undefined, { date: selected, days: [] }).open() });

	// ---- legenda = filter
	const leg = el.createDiv("fch-cal2-legend");
	for (const kd of FILTERS) {
		const m = KIND_META[kd];
		const c = leg.createEl("button", { cls: "fch-legend" + (hide.has(kd) ? " is-off" : ""), attr: { "aria-label": hide.has(kd) ? `Tampilkan ${m.label}` : `Sembunyikan ${m.label}` } });
		c.style.setProperty("--c", m.color);
		c.createSpan("fch-legend-dot");
		c.createSpan({ text: m.label });
		c.onclick = () => { if (hide.has(kd)) hide.delete(kd); else hide.add(kd); hub.renderPage(); };
	}

	if (view === "agenda") return renderAgendaList(hub, el, start, items, untimed);
	const layout = el.createDiv("fch-cal2" + (view === "week" ? " is-week" : ""));
	const main = layout.createDiv("fch-cal2-main");
	const side = layout.createDiv("fch-cal2-side");
	if (view === "month") renderMonth(hub, main, start, count, items, untimed, due);
	else renderWeek(hub, main, start, items);
	renderDayPanel(hub, side, selected, items, untimed, due);
}

function renderMonth(hub: HubView, el: HTMLElement, start: number, count: number, items: (k: string) => AItem[], untimed: (k: string) => ReturnType<typeof tasksOn>, due: ReturnType<typeof dueMap>) {
	const p = hub.plugin;
	const today = startOfDay(Date.now()), tk = dayKey(today);
	let maxRev = 1;
	for (const d of Object.values(p.data.daily)) maxRev = Math.max(maxRev, d.reviews);
	const grid = el.createDiv("fch-cal2-grid");
	["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].forEach((d) => grid.createDiv({ cls: "fch-cal2-dow", text: d }));
	const pad = (new Date(start).getDay() + 6) % 7;
	for (let i = 0; i < pad; i++) grid.createDiv("fch-cal2-cell is-pad");
	for (let d = 0; d < count; d++) {
		const t = addDays(start, d), k = dayKey(t);
		const its = items(k);
		const tasks = untimed(k);
		const cell = grid.createEl("button", { cls: "fch-cal2-cell" + (k === tk ? " is-today" : "") + (k === selected ? " is-sel" : "") + (t < today ? " is-past" : "") + (its.some((x) => x.kind === "exam") ? " has-exam" : "") });
		const rev = p.data.daily[k]?.reviews ?? 0;
		if (rev && t <= today) cell.style.setProperty("--heat", String(Math.min(1, rev / maxRev)));
		const top = cell.createDiv("fch-cal2-top");
		top.createSpan({ cls: "fch-cal2-num", text: String(new Date(t).getDate()) });
		const hj = hijri(p, t);
		if (hj.d) top.createSpan({ cls: "fch-cal2-h", text: hj.d === 1 ? `1 ${hj.month.split(" ")[0]}` : String(hj.d) });
		const lines = cell.createDiv("fch-cal2-lines");
		// utamakan yang khusus (ujian, tugas, jadwal sekali); jadwal rutin cukup sebagai titik warna
		const rank = (x: AItem) => (x.kind === "exam" ? 0 : x.kind === "task" && !x.rec ? 1 : x.kind === "plan" && !x.rec ? 2 : 9);
		const special = its.filter((x) => rank(x) < 9).sort((a, b) => rank(a) - rank(b));
		const untimedShow = tasks.filter((x) => !x.repeat && !x.done).map((x) => ({ kind: "task" as AKind, title: x.title } as AItem));
		const show = [...special, ...untimedShow].slice(0, 3);
		for (const x of show) {
			const l = lines.createDiv("fch-cal2-line" + (x.done ? " is-done" : ""));
			l.style.setProperty("--c", x.color ?? KIND_META[x.kind].color);
			l.setText(`${x.time ? x.time + " " : ""}${x.title}`);
		}
		const dots = cell.createDiv("fch-cal2-dots");
		const kinds = [...new Set(its.map((x) => x.kind))];
		if (tasks.length) kinds.push("task");
		for (const kd of [...new Set(kinds)].slice(0, 6)) dots.createSpan({ cls: "fch-cal2-dot", attr: { style: `--c:${KIND_META[kd].color}` } });
		const more = its.filter((x) => !x.rec && !["study", "quran", "pomo", "habit", "note"].includes(x.kind)).length + tasks.filter((x) => !x.repeat).length - show.length;
		if (more > 0) dots.createSpan({ cls: "fch-cal2-more", text: `+${more}` });
		cell.onclick = () => { selected = k; hub.renderPage(); };
		cell.ondblclick = () => new BlockModal(hub.app, p, () => hub.renderPage(), undefined, { date: k, days: [] }).open();
	}
	void due;
}

function renderWeek(hub: HubView, el: HTMLElement, start: number, items: (k: string) => AItem[]) {
	const tk = dayKey(Date.now());
	const wrap = el.createDiv("fch-wk");
	const head = wrap.createDiv("fch-wk-head");
	head.createDiv("fch-wk-gut");
	const allday = wrap.createDiv("fch-wk-allday");
	allday.createDiv({ cls: "fch-wk-gut fch-muted", text: "hari" });
	const body = wrap.createDiv("fch-wk-body");
	const gut = body.createDiv("fch-wk-gut");
	for (let h = H0; h < H1; h++) gut.createDiv({ cls: "fch-wk-hour", text: `${String(h).padStart(2, "0")}:00` });
	for (let i = 0; i < 7; i++) {
		const t = addDays(start, i), k = dayKey(t);
		const its = items(k);
		const hd = head.createEl("button", { cls: "fch-wk-day" + (k === tk ? " is-today" : "") + (k === selected ? " is-sel" : "") });
		hd.createDiv({ cls: "fch-small fch-muted", text: new Date(t).toLocaleDateString("id-ID", { weekday: "short" }) });
		hd.createDiv({ cls: "fch-wk-num", text: String(new Date(t).getDate()) });
		hd.onclick = () => { selected = k; hub.renderPage(); };
		const ad = allday.createDiv("fch-wk-adcol");
		for (const x of its.filter((x) => !x.time).slice(0, 3)) { const c = ad.createDiv({ cls: "fch-wk-chip", text: `${KIND_META[x.kind].icon} ${x.title}` }); c.style.setProperty("--c", KIND_META[x.kind].color); }
		const col = body.createDiv("fch-wk-col" + (k === tk ? " is-today" : ""));
		col.style.height = `${(H1 - H0) * PX}px`;
		const timed = its.filter((x) => x.time);
		for (const x of timed) {
			const st = toMin(x.time!), en = x.end ? toMin(x.end) : st + 30;
			if (en <= H0 * 60 || st >= H1 * 60) continue;
			const b = col.createDiv("fch-wk-ev" + (x.done ? " is-done" : "") + (x.kind === "prayer" ? " is-prayer" : ""));
			b.style.top = `${((Math.max(st, H0 * 60) - H0 * 60) / 60) * PX}px`;
			b.style.height = x.kind === "prayer" ? "2px" : `${Math.max(20, ((Math.min(en, H1 * 60) - Math.max(st, H0 * 60)) / 60) * PX - 2)}px`;
			b.style.setProperty("--c", x.color ?? KIND_META[x.kind].color);
			if (x.kind === "prayer") { b.setAttr("aria-label", `${x.title} ${x.time}`); b.createSpan({ cls: "fch-wk-pl", text: x.title }); continue; }
			b.createDiv({ cls: "fch-wk-evt", text: `${x.icon ?? KIND_META[x.kind].icon} ${x.title}` });
			b.createDiv({ cls: "fch-wk-evs", text: `${x.time}${x.end ? "–" + x.end : ""}` });
			if (x.onClick) b.onclick = (e) => x.onClick!(e);
		}
		if (k === tk) {
			const n = new Date(), m = n.getHours() * 60 + n.getMinutes();
			if (m > H0 * 60 && m < H1 * 60) { const nl = col.createDiv("fch-tb-now"); nl.style.top = `${((m - H0 * 60) / 60) * PX}px`; nl.style.left = "0"; }
		}
		col.ondblclick = (e) => {
			const r = col.getBoundingClientRect();
			const mm = H0 * 60 + Math.round((((e.clientY - r.top) / PX) * 60) / 15) * 15;
			new BlockModal(hub.app, hub.plugin, () => hub.renderPage(), undefined, { date: k, days: [], time: `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}` }).open();
		};
	}
	window.setTimeout(() => { const n = el.querySelector(".fch-tb-now") as HTMLElement | null; if (n) body.scrollTop = Math.max(0, n.offsetTop - 120); else body.scrollTop = PX * 2; }, 30);
}

function renderDayPanel(hub: HubView, el: HTMLElement, k: string, items: (k: string) => AItem[], untimed: (k: string) => ReturnType<typeof tasksOn>, due: ReturnType<typeof dueMap>) {
	const p = hub.plugin;
	const t = tOf(k), today = startOfDay(Date.now()), tk = dayKey(today);
	const its = items(k);
	const box = el.createDiv("fch-dayp");
	const hd = box.createDiv("fch-dayp-head");
	const big = hd.createDiv("fch-dayp-date");
	big.createDiv({ cls: "fch-dayp-num", text: String(new Date(t).getDate()) });
	const meta = hd.createDiv("fch-grow");
	meta.createDiv({ cls: "fch-strong", text: new Date(t).toLocaleDateString("id-ID", { weekday: "long", month: "long", year: "numeric" }) });
	meta.createDiv({ cls: "fch-muted fch-small", text: `${hijri(p, t).text}${k === tk ? " · hari ini" : t < today ? "" : ` · ${Math.round((t - today) / 86400000)} hari lagi`}` });
	const tasks = untimed(k);
	const nPlan = its.filter((x) => x.kind === "plan").length, nTask = tasks.length + its.filter((x) => x.kind === "task").length;
	const chips = box.createDiv("fch-dayp-chips");
	if (nPlan) chips.createSpan({ cls: "fch-dayp-chip", text: `📅 ${nPlan} jadwal` });
	if (nTask) chips.createSpan({ cls: "fch-dayp-chip", text: `✅ ${nTask} tugas` });
	const d = due.get(k);
	if (d?.n && t >= today) chips.createSpan({ cls: "fch-dayp-chip", text: `🧠 ${d.n} kartu` });
	for (const e of p.data.exams.filter((x) => x.date === k)) {
		const plan = examPlan(p, e);
		const ex = box.createDiv("fch-dayp-exam");
		ex.createSpan({ text: `🎓 ${e.name}` });
		ex.createSpan({ cls: "fch-small", text: `${plan.learned}/${plan.total} kartu dipelajari` });
	}
	const act = box.createDiv("fch-row");
	btn(act, { text: "Jadwal belajar", icon: "calendar-plus", cls: "fch-btn-sm", onClick: () => new BlockModal(hub.app, p, () => hub.renderPage(), undefined, { date: k, days: [] }).open() });
	quickAdd(hub, box, { due: k }, `Tambah tugas ${k === tk ? "hari ini" : "tanggal ini"}… mis. “PR jam 19:00”`);

	const timed = its.filter((x) => x.time && x.kind !== "exam");
	const sec = (title: string) => { const s = box.createDiv("fch-dayp-sec"); s.createDiv({ cls: "fch-dayp-sectitle", text: title }); return s; };
	if (timed.length) { const s = sec("Linimasa"); for (const x of timed) agendaRow(s, x); }
	if (tasks.length) {
		const s = sec(`Tugas tanpa jam · ${tasks.length}`);
		for (const x of tasks.sort((a, b) => Number(a.done) - Number(b.done) || b.priority - a.priority)) taskRow(hub, s, x, { compact: true });
	}
	if (k === tk) {
		const late = p.data.tasks.filter((x) => isOverdue(x) && !occursOn(x, k));
		if (late.length) { const s = sec(`⚠️ Terlambat · ${late.length}`); for (const x of late.slice(0, 5)) taskRow(hub, s, x, { compact: true }); }
	}
	const rest = its.filter((x) => !x.time && x.kind !== "exam");
	if (rest.length) { const s = sec(t < today ? "Yang sudah dilakukan" : "Lainnya"); for (const x of rest) agendaRow(s, x); }
	if (d?.n && t >= today) {
		const s = sec("Kartu per materi");
		const list = s.createDiv("fch-dayp-mats");
		[...(due.get(k)?.paths ?? new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([path, n]) => {
			const r = list.createDiv("fch-dayp-mat");
			r.createSpan({ cls: "fch-grow", text: basename(path) });
			r.createSpan({ cls: "fch-muted fch-small", text: `${n}` });
		});
	}
	if (!timed.length && !tasks.length && !rest.length) box.createDiv({ cls: "fch-dayp-empty", text: t < today ? "Tidak ada aktivitas tercatat." : "Hari yang lapang ✨ Tambahkan tugas atau jadwal belajar di atas." });
}

function renderAgendaList(hub: HubView, el: HTMLElement, start: number, items: (k: string) => AItem[], untimed: (k: string) => ReturnType<typeof tasksOn>) {
	const p = hub.plugin;
	const tk = dayKey(Date.now());
	const list = el.createDiv("fch-agl");
	let any = false;
	for (let i = 0; i < 21; i++) {
		const t = addDays(start, i), k = dayKey(t);
		const its = items(k).filter((x) => x.kind !== "study");
		const tasks = untimed(k);
		if (!its.length && !tasks.length) continue;
		any = true;
		const day = list.createDiv("fch-agl-day" + (k === tk ? " is-today" : ""));
		const dh = day.createDiv("fch-agl-date");
		dh.createDiv({ cls: "fch-agl-num", text: String(new Date(t).getDate()) });
		dh.createDiv({ cls: "fch-small", text: new Date(t).toLocaleDateString("id-ID", { weekday: "short", month: "short" }) });
		dh.createDiv({ cls: "fch-muted fch-small", text: hijri(p, t).d ? `${hijri(p, t).d} ${hijri(p, t).month.split(" ")[0]}` : "" });
		const body = day.createDiv("fch-agl-body");
		for (const x of its) agendaRow(body, x);
		for (const x of tasks) taskRow(hub, body, x, { compact: true });
		dh.onclick = () => { selected = k; view = "month"; offset = 0; hub.renderPage(); };
	}
	if (!any) list.createDiv({ cls: "fch-dayp-empty", text: "Belum ada agenda. Tambahkan jadwal belajar atau tugas." });
}
