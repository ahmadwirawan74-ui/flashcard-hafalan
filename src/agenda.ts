import type { HubView } from "./hub-view";
import type FlashcardPlugin from "./main";
import { dayKey, isNewState, startOfDay } from "./scheduler";
import { isOverdue, occursOn, tasksOn, toggleTask } from "./tasks";
import { classesOn } from "./planner";
import { blockMenu, blocksOn, startBlock, targetLabel, KINDS } from "./studyplan";
import { minutesOn } from "./studylog";
import { notesOn } from "./notes";
import { city } from "./ibadah";
import { hm, prayerTimes } from "./prayer";
import { selectExam } from "./exams";

export type AKind = "exam" | "class" | "plan" | "task" | "review" | "study" | "quran" | "pomo" | "note" | "habit" | "prayer";
export const KIND_META: Record<AKind, { label: string; icon: string; color: string }> = {
	exam: { label: "Ujian", icon: "🎓", color: "#ef4444" },
	class: { label: "Pelajaran", icon: "📚", color: "#f59e0b" },
	plan: { label: "Jadwal belajar", icon: "📅", color: "#8b5cf6" },
	task: { label: "Tugas", icon: "✅", color: "#0ea5e9" },
	review: { label: "Ulasan kartu", icon: "🧠", color: "#6366f1" },
	study: { label: "Aktivitas belajar", icon: "📈", color: "#10b981" },
	quran: { label: "Al-Qur'an", icon: "📖", color: "#14b8a6" },
	pomo: { label: "Pomodoro", icon: "🍅", color: "#f43f5e" },
	note: { label: "Catatan", icon: "🗒️", color: "#eab308" },
	habit: { label: "Kebiasaan", icon: "🔁", color: "#22c55e" },
	prayer: { label: "Waktu sholat", icon: "🕌", color: "#64748b" },
};
export const BLOCK_COLOR: Record<string, string> = { cards: "#8b5cf6", note: "#eab308", tilawah: "#14b8a6", ziyadah: "#10b981", murajaah: "#0ea5e9", hadits: "#f59e0b", asma: "#ec4899", custom: "#64748b" };

export interface AItem {
	kind: AKind;
	time?: string;
	end?: string;
	title: string;
	sub?: string;
	color?: string;
	icon?: string;
	done?: boolean;
	late?: boolean;
	onClick?: (e: MouseEvent) => void;
	action?: { label: string; icon: string; run: () => void };
	check?: () => void;
	/** Berulang rutin (jadwal mingguan / tugas berulang) — di sel bulan cukup tampil sebagai titik. */
	rec?: boolean;
}

const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);
const fromMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const kOf = (t: number) => dayKey(t);
export const tOf = (k: string) => new Date(k + "T00:00:00").getTime();

/** Jumlah kartu jatuh tempo per tanggal (dihitung sekali per render). */
export function dueMap(p: FlashcardPlugin): Map<string, { n: number; paths: Map<string, number> }> {
	const today = startOfDay(Date.now());
	const m = new Map<string, { n: number; paths: Map<string, number> }>();
	for (const c of p.allCards()) {
		const st = p.data.cards[c.id];
		if (!st || st.suspended || isNewState(st)) continue;
		const k = dayKey(Math.max(today, startOfDay(st.due)));
		const e = m.get(k) ?? m.set(k, { n: 0, paths: new Map() }).get(k)!;
		e.n++;
		e.paths.set(c.path, (e.paths.get(c.path) ?? 0) + 1);
	}
	return m;
}

/** Semua kegiatan pada tanggal k (berjam & sepanjang hari). Tugas tanpa jam tidak termasuk (ditampilkan sebagai daftar centang). */
export function dayItems(hub: HubView, k: string, due: Map<string, { n: number }>, opts: { prayers?: boolean } = {}): AItem[] {
	const p = hub.plugin;
	const t = tOf(k), today = startOfDay(Date.now()), tk = dayKey(today);
	const out: AItem[] = [];
	for (const e of p.data.exams.filter((x) => x.date === k)) out.push({ kind: "exam", time: e.time, title: e.name, sub: "Ujian · ketuk untuk peta jalan", onClick: () => { selectExam(e.id); hub.navigate("exams"); } });
	for (const c of classesOn(p, t)) out.push({ kind: "class", rec: true, time: c.start, end: c.end, title: c.subject, sub: [c.room, c.teacher].filter(Boolean).join(" · "), color: c.color });
	for (const b of blocksOn(p, k)) {
		const st = b.log[k];
		const kind = KINDS.find((x) => x.id === b.kind);
		out.push({
			kind: "plan", time: b.time, end: fromMin(toMin(b.time) + b.duration), title: targetLabel(p, b), icon: kind?.icon, color: BLOCK_COLOR[b.kind], rec: !b.date,
			sub: `${b.duration} menit · ${kind?.label ?? ""}${st === 1 ? " · selesai" : st === 2 ? " · dilewati" : ""}`, done: st === 1,
			late: k === tk && !st && new Date().getHours() * 60 + new Date().getMinutes() > toMin(b.time) + b.duration,
			onClick: (e) => blockMenu(hub, b, e, k),
			action: k === tk && st !== 1 ? { label: "Mulai", icon: "play", run: () => startBlock(hub, b) } : undefined,
		});
	}
	for (const x of tasksOn(p, k)) {
		if (!x.time) continue;
		const done = x.done || !!x.log?.includes(k);
		out.push({ kind: "task", rec: !!x.repeat, time: x.time, end: fromMin(toMin(x.time) + (x.duration ?? 60)), title: x.title, sub: x.repeat ? "🔁 berulang" : undefined, done, late: isOverdue(x), check: occursOn(x, k) && !done && k <= tk ? () => toggleTask(p, x, hub.mainEl) : undefined });
	}
	const d = due.get(k);
	if (t >= today && d?.n) out.push({ kind: "review", title: `${d.n} kartu dijadwalkan diulas`, action: k === tk ? { label: "Belajar", icon: "play", run: () => hub.startSession(p.allCards(), { title: "Semua materi", cram: false, mode: p.data.settings.defaultMode }) } : undefined });
	const rec = p.data.daily[k];
	const self = minutesOn(p, k);
	if (t <= today && (rec?.reviews || self >= 1)) out.push({ kind: "study", title: [rec?.reviews ? `${rec.reviews} ulasan · ${Math.round((rec.correct / rec.reviews) * 100)}%` : "", self >= 1 ? `${Math.round(self)} mnt belajar mandiri` : ""].filter(Boolean).join(" · "), done: true });
	const q = p.data.quran;
	const qr = q.read[k], qh = q.hafalLog[k], qm = q.murLog[k];
	if (qr?.ayat || qh || qm) out.push({ kind: "quran", title: [qr?.ayat ? `${qr.pages.toFixed(1)} hal. tilawah` : "", qh ? `+${qh} ayat hafal` : "", qm ? `${qm} hal. murajaah` : ""].filter(Boolean).join(" · "), done: true });
	const pomo = p.data.meta.pomoLog?.[k];
	if (pomo) out.push({ kind: "pomo", title: `${pomo} sesi fokus`, done: true });
	const hb = p.data.habits.filter((h) => h.log.includes(k)).length;
	if (hb) out.push({ kind: "habit", title: `${hb} kebiasaan dicentang`, done: true });
	const ns = notesOn(p, k);
	if (ns.length) out.push({ kind: "note", title: ns.length === 1 ? ns[0].basename : `${ns.length} catatan`, onClick: () => hub.navigate("notes") });
	if (opts.prayers) {
		const pt = prayerTimes(new Date(t), city(p), p.data.ibadah.adj);
		for (const n of ["Subuh", "Dzuhur", "Ashar", "Maghrib", "Isya"] as const) out.push({ kind: "prayer", time: hm(pt[n]), title: n });
	}
	return out.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
}

/** Satu baris agenda (dipakai Kalender & Beranda). */
export function agendaRow(parent: HTMLElement, it: AItem) {
	const m = KIND_META[it.kind];
	const r = parent.createDiv("fch-arow" + (it.done ? " is-done" : "") + (it.late ? " is-late" : "") + (it.onClick ? " is-click" : ""));
	r.style.setProperty("--c", it.color ?? m.color);
	const tm = r.createDiv("fch-arow-time");
	if (it.time) { tm.createDiv({ cls: "fch-arow-t1", text: it.time }); if (it.end) tm.createDiv({ cls: "fch-arow-t2", text: it.end }); }
	else tm.createDiv({ cls: "fch-arow-t2", text: "•" });
	r.createDiv("fch-arow-bar");
	const body = r.createDiv("fch-arow-body");
	body.createDiv({ cls: "fch-arow-title", text: `${it.icon ?? m.icon} ${it.title}` });
	if (it.sub) body.createDiv({ cls: "fch-arow-sub", text: it.sub });
	if (it.check) {
		const c = r.createEl("button", { cls: "fch-task-check", attr: { "aria-label": "Tandai selesai" } });
		c.onclick = (e) => { e.stopPropagation(); it.check!(); };
	}
	if (it.action) {
		const a = r.createEl("button", { cls: "fch-btn fch-btn-sm fch-btn-primary", text: it.action.label });
		a.onclick = (e) => { e.stopPropagation(); it.action!.run(); };
	}
	if (it.onClick) r.onclick = (e) => it.onClick!(e);
	return r;
}
