import { Menu } from "obsidian";
import type FlashcardPlugin from "./main";
import type { Page } from "./hub-view";
import { dueToday } from "./tasks";
import { classesOn } from "./planner";
import { todayRead, murDue, fromGid, openReader, TOTAL } from "./quran";
import { CaptureModal } from "./capture";
import { nextPrayer } from "./ibadah";
import { blocksOn, targetLabel } from "./studyplan";
import { fastingClock, ramadanInfo } from "./ramadan";

export const SB_ITEMS: { id: string; label: string }[] = [
	{ id: "cards", label: "🧠 Kartu menunggu" },
	{ id: "tasks", label: "✅ Tugas hari ini" },
	{ id: "pomo", label: "🍅 Timer Pomodoro / stopwatch" },
	{ id: "classes", label: "📚 Pelajaran / jadwal belajar berikutnya" },
	{ id: "quran", label: "📖 Tilawah hari ini" },
	{ id: "prayer", label: "🕌 Sholat berikutnya / Ramadan" },
	{ id: "menu", label: "⚡ Menu cepat" },
];

/** Info ringkas di status bar bawah Obsidian; klik untuk membuka halamannya. */
export class StatusBar {
	private els = new Map<string, HTMLElement>();
	constructor(private p: FlashcardPlugin) {
		for (const it of SB_ITEMS) {
			const el = p.addStatusBarItem();
			el.addClass("fch-sb", "mod-clickable");
			el.setAttr("aria-label", it.label);
			el.setAttr("data-tooltip-position", "top");
			this.els.set(it.id, el);
			el.onclick = (e) => this.click(it.id, e);
		}
		this.update();
	}

	private go(page: Page) { void this.p.openHub(page); }

	private click(id: string, e: MouseEvent) {
		const p = this.p;
		if (id === "cards") this.go("study");
		else if (id === "tasks") this.go("tasks");
		else if (id === "pomo") this.go("focus");
		else if (id === "classes") { void import("./studyplan").then((sp) => sp.setPlannerTab("blocks")); this.go("planner"); }
		else if (id === "prayer") this.go(ramadanInfo(p) ? "ramadan" : "mutabaah");
		else if (id === "quran") { const g = p.data.quran.last ? Math.min(TOTAL, p.data.quran.last.g + 1) : 1; openReader(fromGid(g)[0], g); this.go("quran"); }
		else {
			const m = new Menu();
			const w = p.waitingToday();
			m.addItem((i) => i.setTitle(`Mulai belajar (${w.due + w.fresh} kartu)`).setIcon("play").onClick(async () => { const h = await p.openHub("study"); h.startSession(p.allCards(), { title: "Semua materi", cram: false, mode: p.data.settings.defaultMode }); }));
			m.addItem((i) => i.setTitle("Tangkap cepat…").setIcon("zap").onClick(() => new CaptureModal(p.app, p).open()));
			m.addItem((i) => i.setTitle(p.pomo.running ? "Jeda Pomodoro" : "Mulai Pomodoro").setIcon("timer").onClick(() => p.pomo.toggle()));
			m.addItem((i) => i.setTitle("Lanjutkan tilawah").setIcon("book-open").onClick(() => this.click("quran", e)));
			const md = murDue(p).length;
			if (md) m.addItem((i) => i.setTitle(`Murajaah (${md} halaman)`).setIcon("rotate-ccw").onClick(async () => { const { MurajaahGame } = await import("./quran"); const h = await p.openHub("quran"); h.startGame(new MurajaahGame(h, murDue(p))); }));
			m.addSeparator();
			m.addItem((i) => i.setTitle("Tugas hari ini").setIcon("check-square").onClick(() => this.go("tasks")));
			m.addItem((i) => i.setTitle("Jadwal hari ini").setIcon("clock").onClick(() => this.go("planner")));
			m.addItem((i) => i.setTitle("Beranda Flashcard").setIcon("home").onClick(() => this.go("home")));
			m.showAtMouseEvent(e);
		}
	}

	update() {
		const p = this.p;
		const on = p.data.settings.statusBar ?? {};
		const set = (id: string, text: string, tip?: string) => {
			const el = this.els.get(id);
			if (!el) return;
			const show = on[id] !== false && !!text;
			el.toggleClass("fch-sb-hidden", !show);
			if (show) { el.setText(text); if (tip) el.setAttr("aria-label", tip); }
		};
		const w = p.waitingToday();
		const n = w.due + w.fresh;
		set("cards", n ? `🧠 ${n}` : "🧠 ✓", n ? `${w.due} ulasan · ${w.fresh} kartu baru menunggu — klik untuk belajar` : "Semua kartu beres hari ini");
		const t = dueToday(p).length;
		set("tasks", `✅ ${t}`, t ? `${t} tugas hari ini/terlambat — klik untuk membuka` : "Tidak ada tugas hari ini");
		const sw = p.data.meta.stopwatch;
		if (sw) {
			const m = Math.floor((Date.now() - sw.start) / 60_000);
			set("pomo", `⏱ ${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`, `Stopwatch belajar: ${sw.subject}`);
		} else set("pomo", p.pomo.running || p.pomo.left < p.pomo.total() ? `${p.pomo.phase === "work" ? "🍅" : "☕"} ${p.pomo.clock()}${p.pomo.running ? "" : " ⏸"}` : "🍅", "Pomodoro — klik untuk Ruang Fokus");
		const nowM = new Date().getHours() * 60 + new Date().getMinutes();
		const next = classesOn(p, Date.now()).find((c) => parseInt(c.end.slice(0, 2), 10) * 60 + parseInt(c.end.slice(3), 10) > nowM);
		const k = new Date(); const kk = `${k.getFullYear()}-${String(k.getMonth() + 1).padStart(2, "0")}-${String(k.getDate()).padStart(2, "0")}`;
		const nb = blocksOn(p, kk).find((b) => !b.log[kk] && parseInt(b.time.slice(0, 2), 10) * 60 + parseInt(b.time.slice(3), 10) + b.duration > nowM);
		const nbM = nb ? parseInt(nb.time.slice(0, 2), 10) * 60 + parseInt(nb.time.slice(3), 10) : 9999;
		const ncM = next ? parseInt(next.start.slice(0, 2), 10) * 60 + parseInt(next.start.slice(3), 10) : 9999;
		if (nb && nbM <= ncM) set("classes", `📅 ${nb.time} ${targetLabel(p, nb).slice(0, 22)}`, `Jadwal belajar berikutnya: ${targetLabel(p, nb)} (${nb.duration} menit) — klik untuk membuka`);
		else set("classes", next ? `📚 ${next.subject} ${next.start}` : "", next ? `${next.subject} ${next.start}–${next.end}${next.room ? " · " + next.room : ""}` : undefined);
		const r = todayRead(p);
		set("quran", `📖 ${r.pages ? r.pages.toFixed(1) : 0}/${p.data.quran.target}`, `Tilawah hari ini ${r.pages.toFixed(1)} dari ${p.data.quran.target} halaman — klik untuk lanjut membaca`);
		const ri = ramadanInfo(p);
		if (ri && !ri.preview) { const f = fastingClock(p); set("prayer", `🌙 ${f.name === "Maghrib" ? "Berbuka" : "Imsak"} ${new Date(f.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`, `${ri.day} Ramadan · ${f.label}`); }
		else { const np = nextPrayer(p); set("prayer", `🕌 ${np.name} ${new Date(np.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`, `Sholat berikutnya (${p.data.ibadah.city === "__custom" ? "lokasi sendiri" : p.data.ibadah.city})`); }
		set("menu", "⚡", "Menu cepat Flashcard Hafalan");
	}
}
