import type { HubView } from "../hub-view";
import { dayKey } from "../scheduler";
import { dueToday } from "../tasks";
import { blocksOn, nextBlock, startBlock, targetLabel } from "../studyplan";
import { MurajaahGame, TOTAL, fromGid, murDue, openReader, todayRead } from "../quran";
import { countdown, hijri, mscore, nextPrayer } from "../ibadah";
import { agendaRow, dayItems, dueMap } from "../agenda";
import { openReading, readingDue } from "../reading";
import { chestState } from "../collect";
import { activeEvent, bossDoneToday } from "../events";
import { inGolden } from "../golden";
import { btn, setIconSafe } from "./home-util";

interface Sug { icon: string; title: string; sub: string; label: string; color: string; run: () => void }

/** Saran langkah berikutnya, diurutkan dari yang paling mendesak. */
export function suggestions(hub: HubView): Sug[] {
	const p = hub.plugin;
	const out: Sug[] = [];
	const now = Date.now(), k = dayKey(now);
	const nb = nextBlock(p);
	if (nb && nb.k === k && nb.at - now < 90 * 60_000) out.push({ icon: "📅", title: targetLabel(p, nb.b), sub: nb.at <= now ? `Jadwal belajar sedang berlangsung (${nb.b.time})` : `Jadwal belajar ${nb.b.time} · ${nb.b.duration} menit`, label: "Mulai", color: "#8b5cf6", run: () => startBlock(hub, nb.b) });
	const w = p.waitingToday();
	if (w.due + w.fresh) out.push({ icon: "🧠", title: `Ulas ${w.due + w.fresh} kartu`, sub: `${w.due} ulasan · ${w.fresh} kartu baru · ±${Math.max(1, Math.round(((w.due + w.fresh) * p.avgSecondsPerCard()) / 60))} menit`, label: "Belajar", color: "#6366f1", run: () => hub.startSession(p.allCards(), { title: "Semua materi", cram: false, mode: p.data.settings.defaultMode }) });
	const md = murDue(p);
	if (md.length) out.push({ icon: "🔁", title: `Murajaah ${md.length} halaman`, sub: "Hafalan Al-Qur'an yang jadwalnya tiba", label: "Murajaah", color: "#0ea5e9", run: () => hub.startGame(new MurajaahGame(hub, md)) });
	const tasks = dueToday(p).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || b.priority - a.priority);
	if (tasks.length) out.push({ icon: "✅", title: tasks[0].title, sub: tasks.length > 1 ? `Tugas berikutnya · ${tasks.length - 1} lainnya menunggu` : "Tugas hari ini", label: "Buka", color: "#0ea5e9", run: () => hub.navigate("tasks") });
	const tr = todayRead(p), q = p.data.quran;
	if (tr.pages < q.target) out.push({ icon: "📖", title: "Lanjutkan tilawah", sub: `${tr.pages.toFixed(1)} dari ${q.target} halaman hari ini`, label: "Baca", color: "#14b8a6", run: () => { const g = q.last ? Math.min(TOTAL, q.last.g + 1) : 1; openReader(fromGid(g)[0], g); hub.navigate("quran"); } });
	const ev = activeEvent(p);
	if (ev && !bossDoneToday(p, ev)) out.push({ icon: ev.def.icon, title: `Boss event: ${ev.def.boss.name}`, sub: `${ev.def.name} · hadiah harian ${ev.def.token.icon} 6 token`, label: "Lawan", color: ev.def.c1, run: () => hub.navigate("event") });
	if ((w.due + w.fresh) && inGolden(p)) out.splice(Math.min(1, out.length), 0, { icon: "☀️", title: "Sekarang jam emasmu!", sub: "Waktu terbaik untuk materi tersulit", label: "Lihat", color: "#d97706", run: () => hub.navigate("golden") });
	const rd = readingDue(p);
	if (rd.length) out.push({ icon: "📖", title: `Bacaan: ${rd[0].title}`, sub: `${rd.reduce((a, x) => a + x.perDay - (x.log[k] ?? 0), 0)} potongan dijadwalkan hari ini`, label: "Baca", color: "#0891b2", run: () => { openReading(rd[0].id); hub.navigate("reading"); } });
	const ch = chestState(p);
	if (ch.ready && !ch.opened) out.push({ icon: "🎁", title: "Peti harian siap dibuka!", sub: `Peti ${ch.tier} · target belajar hari ini tercapai`, label: "Buka", color: "#d97706", run: () => hub.navigate("treasure") });
	if (p.data.collect.packs) out.push({ icon: "🎴", title: `${p.data.collect.packs} bungkus kartu koleksi`, sub: "Buka dan lengkapi albummu", label: "Buka", color: "#7c3aed", run: () => hub.navigate("album") });
	if (nb && !out.some((x) => x.icon === "📅")) out.push({ icon: "📅", title: targetLabel(p, nb.b), sub: `Jadwal berikutnya · ${new Date(nb.at).toLocaleDateString("id-ID", { weekday: "short" })} ${nb.b.time}`, label: "Lihat", color: "#8b5cf6", run: () => hub.navigate("planner") });
	if (!out.length) out.push({ icon: "🎉", title: "Semua beres hari ini!", sub: "Saatnya latihan santai: lawan boss mingguan atau main Cocokkan", label: "Ke Arena", color: "#f59e0b", run: () => hub.navigate("arena") });
	return out;
}

/** Progres hari ini (gabungan beberapa target). */
export function todayProgress(hub: HubView): { label: string; icon: string; v: number; txt: string; color: string }[] {
	const p = hub.plugin;
	const k = dayKey(Date.now());
	const out: { label: string; icon: string; v: number; txt: string; color: string }[] = [];
	const rev = p.data.daily[k]?.reviews ?? 0, w = p.waitingToday();
	if (rev + w.due + w.fresh) out.push({ label: "Kartu", icon: "🧠", v: rev / (rev + w.due + w.fresh), txt: `${rev}/${rev + w.due + w.fresh}`, color: "#6366f1" });
	const tDone = p.data.tasks.filter((t) => (t.doneAt && dayKey(t.doneAt) === k) || t.log?.includes(k)).length, tLeft = dueToday(p).length;
	if (tDone + tLeft) out.push({ label: "Tugas", icon: "✅", v: tDone / (tDone + tLeft), txt: `${tDone}/${tDone + tLeft}`, color: "#0ea5e9" });
	const bs = blocksOn(p, k);
	if (bs.length) { const d = bs.filter((b) => b.log[k] === 1).length; out.push({ label: "Jadwal", icon: "📅", v: d / bs.length, txt: `${d}/${bs.length}`, color: "#8b5cf6" }); }
	const tr = todayRead(p), tg = p.data.quran.target;
	out.push({ label: "Tilawah", icon: "📖", v: Math.min(1, tr.pages / Math.max(1, tg)), txt: `${tr.pages.toFixed(1)}/${tg}`, color: "#14b8a6" });
	const ms = mscore(p, k);
	out.push({ label: "Ibadah", icon: "🕌", v: ms, txt: `${Math.round(ms * 100)}%`, color: "#10b981" });
	return out;
}

export function renderDashHero(hub: HubView, el: HTMLElement, editing: boolean, toggleEdit: () => void) {
	const p = hub.plugin;
	const lv = p.level();
	const streak = p.streak();
	const hour = new Date().getHours();
	const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";
	const hero = el.createDiv("fch-dash");
	const l = hero.createDiv("fch-dash-l");
	const top = l.createDiv("fch-row");
	top.createDiv({ cls: "fch-dash-greet fch-grow", text: `${greet} 👋` });
	btn(top, { text: editing ? "Selesai" : "Atur", icon: editing ? "check" : "layout-dashboard", cls: "fch-btn-sm" + (editing ? " fch-btn-primary" : " fch-btn-ghost"), label: "Atur susunan Beranda", onClick: toggleEdit });
	l.createDiv({ cls: "fch-dash-date", text: `${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${hijri(p).text}` });
	const chips = l.createDiv("fch-dash-chips");
	const chip = (t: string, tip: string, go?: () => void) => { const c = chips.createEl("button", { cls: "fch-dash-chip", text: t, attr: { "aria-label": tip } }); if (go) c.onclick = go; return c; };
	chip(`🔥 ${streak.current} hari`, `Streak belajar · rekor ${streak.best}`);
	chip(`⭐ Level ${lv.level}`, `${lv.title} · ${lv.need - lv.into} XP lagi`, () => hub.navigate("awards"));
	chip(`🪙 ${(p.data.meta.coins ?? 0).toLocaleString("id-ID")}`, "Koin — tukar di Arena", () => hub.navigate("arena"));
	const np = nextPrayer(p);
	const pc = chip(`🕌 ${np.name} ${countdown(np.at - Date.now())}`, `Sholat berikutnya pukul ${new Date(np.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`, () => hub.navigate("mutabaah"));
	const tm = window.setInterval(() => { if (!pc.isConnected) return window.clearInterval(tm); const n2 = nextPrayer(p); pc.setText(`🕌 ${n2.name} ${countdown(n2.at - Date.now())}`); }, 1000);

	// berikutnya untukmu
	const sg = suggestions(hub);
	const main = sg[0];
	const nx = l.createDiv("fch-nextup");
	nx.style.setProperty("--c", main.color);
	nx.createDiv({ cls: "fch-nextup-ic", text: main.icon });
	const nt = nx.createDiv("fch-grow");
	nt.createDiv({ cls: "fch-nextup-k", text: "Berikutnya untukmu" });
	nt.createDiv({ cls: "fch-nextup-t", text: main.title });
	nt.createDiv({ cls: "fch-nextup-s", text: main.sub });
	btn(nx, { text: main.label, icon: "play", cls: "fch-btn-primary fch-btn-lg fch-nextup-btn", onClick: main.run });
	if (sg.length > 1) {
		const more = l.createDiv("fch-nextup-more");
		for (const s of sg.slice(1, 4)) {
			const c = more.createEl("button", { cls: "fch-nextup-mini" });
			c.style.setProperty("--c", s.color);
			c.createSpan({ text: s.icon });
			const tt = c.createSpan("fch-grow");
			tt.createSpan({ cls: "fch-strong", text: s.title });
			c.onclick = s.run;
		}
	}

	// progres hari ini
	const r = hero.createDiv("fch-dash-r");
	const prog = todayProgress(hub);
	const avg = prog.reduce((a, x) => a + x.v, 0) / Math.max(1, prog.length);
	const ring = r.createDiv("fch-dash-ring");
	ring.style.setProperty("--p", String(avg));
	const ri = ring.createDiv("fch-dash-ring-in");
	ri.createDiv({ cls: "fch-dash-pct", text: `${Math.round(avg * 100)}%` });
	ri.createDiv({ cls: "fch-small fch-muted", text: "hari ini" });
	const ms = r.createDiv("fch-dash-meters");
	for (const m of prog) {
		const row = ms.createDiv("fch-dash-meter");
		row.style.setProperty("--c", m.color);
		row.createSpan({ cls: "fch-dash-mi", text: m.icon });
		row.createSpan({ cls: "fch-dash-ml", text: m.label });
		row.createDiv("fch-dash-mbar").createDiv().style.width = `${Math.round(m.v * 100)}%`;
		row.createSpan({ cls: "fch-dash-mv", text: m.txt });
	}
	void setIconSafe;
}

/** Panel Beranda: agenda hari ini sebagai linimasa. */
export function renderAgendaPanel(hub: HubView, parent: HTMLElement) {
	const p = hub.plugin;
	const k = dayKey(Date.now());
	const its = dayItems(hub, k, dueMap(p)).filter((x) => x.time && x.kind !== "prayer");
	const box = parent.createDiv("fch-panel fch-mt fch-home-agenda");
	const h = box.createDiv("fch-section-head");
	h.createEl("h3", { text: `🗓️ Agenda hari ini${its.length ? ` · ${its.length}` : ""}` });
	btn(h, { text: "Kalender", cls: "fch-btn-link", onClick: () => hub.navigate("calendar") });
	const nowM = new Date().getHours() * 60 + new Date().getMinutes();
	const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);
	let nowShown = false;
	for (const x of its) {
		if (!nowShown && toMin(x.time!) > nowM) { box.createDiv({ cls: "fch-agenda-now", text: `Sekarang ${String(Math.floor(nowM / 60)).padStart(2, "0")}:${String(nowM % 60).padStart(2, "0")}` }); nowShown = true; }
		agendaRow(box, x);
	}
	if (!its.length) {
		box.createDiv({ cls: "fch-muted fch-small", text: "Belum ada agenda berjam hari ini." });
		btn(box, { text: "Buat jadwal belajar", icon: "calendar-plus", cls: "fch-btn-sm fch-mt", onClick: () => hub.navigate("planner") });
	}
}
