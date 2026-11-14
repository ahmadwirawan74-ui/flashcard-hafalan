import { Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { MUSIC, MusicKind, musicPlaying, play, playMusic, stopMusic } from "./sound";
import { dayKey } from "./scheduler";
import { btn } from "./util";
import { renderStopwatch } from "./studylog";

export type PomoPhase = "work" | "break" | "long";

export const PRESETS: { id: string; label: string; work: number; brk: number; long: number }[] = [
	{ id: "klasik", label: "Klasik 25/5", work: 25, brk: 5, long: 15 },
	{ id: "dalam", label: "Fokus dalam 50/10", work: 50, brk: 10, long: 20 },
	{ id: "singkat", label: "Singkat 15/3", work: 15, brk: 3, long: 10 },
	{ id: "ujian", label: "Mode ujian 90/15", work: 90, brk: 15, long: 30 },
];

/** Timer Pomodoro milik plugin: tetap berjalan walau halaman berganti. */
export class Pomodoro {
	phase: PomoPhase = "work";
	left: number;
	running = false;
	done = 0; // sesi fokus selesai sejak siklus dimulai
	private subs = new Set<() => void>();

	constructor(private p: FlashcardPlugin) {
		this.left = this.total();
	}

	total(ph: PomoPhase = this.phase) {
		const s = this.p.data.settings;
		return (ph === "work" ? s.pomodoroWork : ph === "break" ? s.pomodoroBreak : s.pomodoroLong) * 60_000;
	}
	today() {
		return this.p.data.meta.pomoLog?.[dayKey(Date.now())] ?? 0;
	}
	subscribe(fn: () => void) {
		this.subs.add(fn);
		return () => this.subs.delete(fn);
	}
	private emit() {
		this.subs.forEach((f) => f());
	}

	/** true bila musik diputar sendiri lewat tombol Putar: berputar terus sampai Stop, tidak diatur timer. */
	manual = false;

	private syncMusic() {
		const s = this.p.data.settings;
		if (this.manual || !s.pomodoroMusicAuto) return;
		const want = (this.running && (this.phase === "work" || s.pomodoroMusicBreak) ? s.pomodoroMusic : "off") as MusicKind;
		if (musicPlaying() !== want) playMusic(want);
	}

	/** Putar musik terus-menerus (loop) sampai stopMusicNow dipanggil. */
	playMusicNow(kind?: string) {
		if (kind) this.p.data.settings.pomodoroMusic = kind;
		this.manual = true;
		playMusic(this.p.data.settings.pomodoroMusic as MusicKind);
		this.p.requestSave();
		this.emit();
	}
	stopMusicNow() {
		this.manual = false;
		stopMusic();
		this.emit();
	}
	get musicOn() { return musicPlaying() !== "off"; }

	toggle() {
		this.running = !this.running;
		play("click");
		this.syncMusic();
		this.emit();
	}
	reset() {
		this.running = false;
		this.phase = "work";
		this.done = 0;
		this.left = this.total();
		this.syncMusic();
		this.emit();
	}
	skip() {
		this.left = 0;
		this.finishPhase(true);
	}
	applyPreset(id: string) {
		const pr = PRESETS.find((x) => x.id === id);
		if (!pr) return;
		const s = this.p.data.settings;
		s.pomodoroWork = pr.work;
		s.pomodoroBreak = pr.brk;
		s.pomodoroLong = pr.long;
		this.p.requestSave();
		if (!this.running) this.left = this.total();
		this.emit();
	}
	/** Pilih trek. Bila musik sedang berbunyi, langsung pindah ke trek baru (tetap berputar terus). */
	setMusic(kind: string) {
		this.p.data.settings.pomodoroMusic = kind;
		this.p.requestSave();
		if (this.musicOn) playMusic(kind as MusicKind);
		this.emit();
	}

	tick() {
		if (!this.running) return;
		this.left -= 1000;
		if (this.left <= 0) this.finishPhase(false);
		this.emit();
	}

	private finishPhase(skipped: boolean) {
		const s = this.p.data.settings;
		const m = this.p.data.meta;
		if (this.phase === "work") {
			if (!skipped) {
				this.done++;
				const k = dayKey(Date.now());
				m.pomoLog = { ...(m.pomoLog ?? {}), [k]: (m.pomoLog?.[k] ?? 0) + 1 };
				this.p.bump("pomodoros");
				const tid = (m as Record<string, unknown>).pomoTaskId as string | undefined;
				const task = tid ? this.p.data.tasks.find((x) => x.id === tid && !x.done) : undefined;
				if (task) task.pomos++;
				this.p.addCoins(5);
				this.p.checkAchievements();
			}
			this.phase = this.done > 0 && this.done % Math.max(2, s.pomodoroEvery) === 0 ? "long" : "break";
			if (!skipped) new Notice(this.phase === "long" ? `🍅 ${this.done} sesi fokus! Istirahat panjang ${s.pomodoroLong} menit.` : `🍅 Fokus selesai (+5 🪙). Istirahat ${s.pomodoroBreak} menit dulu.`, 10_000);
		} else {
			this.phase = "work";
			if (!skipped) new Notice("☕ Istirahat selesai. Siap fokus lagi?", 10_000);
		}
		if (!skipped) play("chime");
		this.left = this.total();
		this.running = this.running && (s.pomodoroAuto || skipped);
		this.syncMusic();
		this.emit();
	}

	label() {
		return this.phase === "work" ? "🍅 Fokus" : this.phase === "long" ? "🌴 Istirahat panjang" : "☕ Istirahat";
	}
	clock() {
		const sec = Math.max(0, Math.round(this.left / 1000));
		return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
	}
}

/** Halaman Ruang Fokus. */
let zen = false;
/** Mode layar penuh hanya berlaku selama berada di Ruang Fokus. */
export const resetZen = () => { zen = false; };
const BREAK_IDEAS = ["🧘 Regangkan leher, bahu & punggung", "💧 Minum segelas air", "👀 Aturan 20-20-20: lihat benda sejauh 6 m selama 20 detik", "🚶 Jalan sebentar & hirup udara segar", "🤲 Istighfar & shalawat beberapa kali", "😮‍💨 Tarik napas 4 detik, tahan 4, buang 6"];

export function renderFocus(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const P = p.pomo;
	const s = p.data.settings;
	const color = P.phase === "work" ? "#ef4444" : P.phase === "long" ? "#0ea5e9" : "#10b981";
	hub.containerEl.toggleClass("fch-zen-focus", zen);
	const wrap = el.createDiv("fch-focus2" + (zen ? " is-zen" : ""));
	wrap.style.setProperty("--fc", color);

	// ================= kiri: timer
	const left = wrap.createDiv("fch-f2-timer");
	const tabs = left.createDiv("fch-f2-phases");
	([["work", "🍅 Fokus"], ["break", "☕ Istirahat"], ["long", "🌴 Istirahat panjang"]] as const).forEach(([ph, l]) => tabs.createSpan({ cls: "fch-f2-phase" + (P.phase === ph ? " is-on" : ""), text: l }));
	const R = 128, C = 2 * Math.PI * R;
	const NS = "http://www.w3.org/2000/svg";
	const box = left.createDiv("fch-f2-ringbox" + (P.running ? " is-running" : ""));
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("viewBox", "0 0 300 300");
	svg.setAttribute("class", "fch-f2-svg");
	const bg = document.createElementNS(NS, "circle");
	bg.setAttribute("cx", "150"); bg.setAttribute("cy", "150"); bg.setAttribute("r", String(R)); bg.setAttribute("class", "fch-f2-track");
	const fg = document.createElementNS(NS, "circle");
	fg.setAttribute("cx", "150"); fg.setAttribute("cy", "150"); fg.setAttribute("r", String(R)); fg.setAttribute("class", "fch-f2-prog");
	fg.setAttribute("stroke-dasharray", String(C));
	const setProg = () => fg.setAttribute("stroke-dashoffset", String(C * (P.left / P.total())));
	setProg();
	svg.append(bg, fg);
	box.appendChild(svg);
	const inner = box.createDiv("fch-f2-inner");
	const clock = inner.createDiv({ cls: "fch-f2-clock", text: P.clock() });
	inner.createDiv({ cls: "fch-f2-sub", text: P.running ? (P.phase === "work" ? "sedang fokus" : "istirahat") : "dijeda" });
	const cyc = Math.max(2, s.pomodoroEvery);
	const dots = left.createDiv("fch-f2-dots");
	for (let i = 0; i < cyc; i++) dots.createSpan({ cls: "fch-f2-dot" + (i < P.done % cyc ? " is-done" : i === P.done % cyc && P.phase === "work" ? " is-now" : "") });
	left.createDiv({ cls: "fch-f2-task", text: p.data.meta.pomoTask ? `🎯 ${p.data.meta.pomoTask}` : "🎯 Pilih atau tulis tugas yang dikerjakan →" });
	const ctr = left.createDiv("fch-f2-ctrls");
	btn(ctr, { icon: "rotate-ccw", cls: "fch-f2-sbtn", label: "Ulang siklus", onClick: () => P.reset() });
	const main = ctr.createEl("button", { cls: "fch-f2-main", attr: { "aria-label": P.running ? "Jeda" : "Mulai" } });
	main.setText(P.running ? "❚❚" : "▶");
	main.onclick = () => P.toggle();
	btn(ctr, { icon: "skip-forward", cls: "fch-f2-sbtn", label: "Lewati ke fase berikutnya", onClick: () => P.skip() });
	btn(left, { text: zen ? "Keluar layar penuh" : "Layar penuh", icon: zen ? "minimize-2" : "maximize-2", cls: "fch-btn-sm fch-btn-ghost fch-f2-zen", onClick: () => { zen = !zen; hub.renderPage(); } });
	if (P.phase !== "work") {
		const ideas = left.createDiv("fch-f2-ideas");
		ideas.createDiv({ cls: "fch-strong fch-small", text: "Ide istirahat:" });
		const d = new Date().getMinutes();
		[0, 1, 2].forEach((k) => ideas.createDiv({ cls: "fch-small", text: BREAK_IDEAS[(d + k * 2) % BREAK_IDEAS.length] }));
	}

	// ================= kanan
	const right = wrap.createDiv("fch-f2-side");
	// tugas
	const tk = right.createDiv("fch-f2-card");
	tk.createDiv({ cls: "fch-f2-ct", text: "🎯 Sedang dikerjakan" });
	const sel = tk.createEl("select", { cls: "dropdown fch-select" });
	sel.createEl("option", { text: "— pilih dari tugas hari ini —", attr: { value: "" } });
	const tasks = p.data.tasks.filter((t) => !t.done).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")).slice(0, 30);
	for (const t of tasks) sel.createEl("option", { text: `${t.pomos ? "🍅" + t.pomos + " " : ""}${t.title}`, attr: { value: t.id } });
	sel.value = String((p.data.meta as Record<string, unknown>).pomoTaskId ?? "");
	sel.onchange = () => { const t = tasks.find((x) => x.id === sel.value); (p.data.meta as Record<string, unknown>).pomoTaskId = t?.id; if (t) p.data.meta.pomoTask = t.title; p.requestSave(); hub.renderPage(); };
	const inp = tk.createEl("input", { type: "text", cls: "fch-input", attr: { placeholder: "…atau tulis sendiri, mis. Hafalan Bab 3" } });
	inp.value = p.data.meta.pomoTask ?? "";
	inp.onchange = () => { p.data.meta.pomoTask = inp.value; (p.data.meta as Record<string, unknown>).pomoTaskId = undefined; p.requestSave(); hub.renderPage(); };
	// durasi
	const du = right.createDiv("fch-f2-card");
	du.createDiv({ cls: "fch-f2-ct", text: "⏱ Durasi" });
	const pr = du.createDiv("fch-f2-presets");
	for (const x of PRESETS) {
		const on = s.pomodoroWork === x.work && s.pomodoroBreak === x.brk;
		const b = pr.createEl("button", { cls: "fch-f2-preset" + (on ? " is-on" : "") });
		b.createDiv({ cls: "fch-strong", text: `${x.work}/${x.brk}` });
		b.createDiv({ cls: "fch-small fch-muted", text: x.label.replace(/\s*\d+\/\d+$/, "") });
		b.onclick = () => { P.applyPreset(x.id); hub.renderPage(); };
	}
	const cu = du.createDiv("fch-f2-custom");
	const num = (label: string, val: number, set: (v: number) => void) => {
		const f = cu.createDiv("fch-field");
		f.createEl("label", { text: label });
		const i = f.createEl("input", { type: "number", cls: "fch-input", attr: { min: "1", max: "180" } });
		i.value = String(val);
		i.onchange = () => { const v = Math.max(1, Math.min(180, parseInt(i.value, 10) || val)); set(v); p.requestSave(); if (!P.running) P.reset(); hub.renderPage(); };
	};
	num("Fokus (mnt)", s.pomodoroWork, (v) => (s.pomodoroWork = v));
	num("Istirahat", s.pomodoroBreak, (v) => (s.pomodoroBreak = v));
	num("Istirahat panjang", s.pomodoroLong, (v) => (s.pomodoroLong = v));
	const tog = (label: string, get: () => boolean, set: (v: boolean) => void) => {
		const t = du.createEl("label", { cls: "fch-toggle" });
		const cb = t.createEl("input", { type: "checkbox" });
		cb.checked = get();
		cb.onchange = () => { set(cb.checked); p.requestSave(); };
		t.createSpan({ cls: "fch-small", text: label });
	};
	tog("Lanjut otomatis ke sesi berikutnya", () => s.pomodoroAuto, (v) => (s.pomodoroAuto = v));
	tog("Putar musik otomatis saat fokus dimulai", () => s.pomodoroMusicAuto, (v) => (s.pomodoroMusicAuto = v));
	tog("Musik tetap berbunyi saat istirahat", () => s.pomodoroMusicBreak, (v) => (s.pomodoroMusicBreak = v));

	// musik
	const mu = right.createDiv("fch-f2-card fch-f2-music" + (P.musicOn ? " is-playing" : ""));
	const mh = mu.createDiv("fch-f2-mhead");
	const cur = MUSIC.find((m) => m.id === s.pomodoroMusic) ?? MUSIC[0];
	const eq = mh.createDiv("fch-eq");
	for (let i = 0; i < 4; i++) eq.createSpan();
	const mt = mh.createDiv("fch-grow");
	mt.createDiv({ cls: "fch-f2-ct", text: P.musicOn ? "Sedang diputar" : "Musik latar" });
	mt.createDiv({ cls: "fch-strong", text: `${cur.icon} ${cur.label}` });
	const pb = mh.createEl("button", { cls: "fch-f2-play", attr: { "aria-label": P.musicOn ? "Hentikan musik" : "Putar musik" } });
	pb.setText(P.musicOn ? "■" : "▶");
	pb.onclick = () => { if (P.musicOn) P.stopMusicNow(); else P.playMusicNow(); hub.renderPage(); };
	const grid = mu.createDiv("fch-f2-tracks");
	for (const m of MUSIC) {
		const b = grid.createEl("button", { cls: "fch-f2-track-it" + (s.pomodoroMusic === m.id ? " is-on" : "") });
		b.createSpan({ cls: "fch-f2-tic", text: m.icon });
		const tt = b.createSpan("fch-grow");
		tt.createDiv({ cls: "fch-small fch-strong", text: m.label });
		tt.createDiv({ cls: "fch-f2-tdesc", text: m.desc });
		b.onclick = () => { P.playMusicNow(m.id); hub.renderPage(); };
	}
	const vol = mu.createDiv("fch-vol");
	const slider = (label: string, val: number, set: (v: number) => void) => {
		const r = vol.createDiv("fch-row");
		r.createSpan({ cls: "fch-small fch-strong", text: label });
		const i = r.createEl("input", { type: "range", attr: { min: "0", max: "100", step: "5" } });
		i.value = String(Math.round(val * 100));
		i.oninput = () => set(parseInt(i.value, 10) / 100);
		i.onchange = () => p.requestSave();
	};
	slider("🔊 Musik", s.musicVolume, (v) => { s.musicVolume = v; p.applySound(); });
	slider("🔔 Efek", s.sfxVolume, (v) => { s.sfxVolume = v; p.applySound(); });
	mu.createDiv({ cls: "fch-muted fch-small", text: "Musik dibuat langsung oleh plugin (tanpa internet) dan berputar terus sampai kamu menekan ■." });

	// statistik
	const st = right.createDiv("fch-f2-card");
	st.createDiv({ cls: "fch-f2-ct", text: "📊 Fokus kamu" });
	const log = p.data.meta.pomoLog ?? {};
	const today = new Date();
	const kOf = (d: Date) => dayKey(d.getTime());
	const n = P.today();
	let streak = 0;
	for (let i = 0; i < 365; i++) { const d = new Date(today); d.setDate(d.getDate() - i); if (log[kOf(d)]) streak++; else if (i > 0) break; }
	const facts = st.createDiv("fch-f2-facts");
	const fact = (v: string, l: string) => { const f = facts.createDiv("fch-f2-fact"); f.createDiv({ cls: "fch-f2-fv", text: v }); f.createDiv({ cls: "fch-small fch-muted", text: l }); };
	fact(`🍅 ${n}`, "sesi hari ini");
	fact(`${Math.floor((n * s.pomodoroWork) / 60)}j ${(n * s.pomodoroWork) % 60}m`, "waktu fokus");
	fact(`🔥 ${streak}`, "hari beruntun");
	const bars = st.createDiv("fch-f2-bars");
	let mx = 1;
	const days: [string, number][] = [];
	for (let i = 6; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const v = log[kOf(d)] ?? 0; mx = Math.max(mx, v); days.push([d.toLocaleDateString("id-ID", { weekday: "narrow" }), v]); }
	for (const [l, v] of days) { const b = bars.createDiv("fch-f2-bar"); b.createDiv({ cls: "fch-f2-bv", text: v ? String(v) : "" }); b.createDiv("fch-f2-bfill").style.height = `${Math.max(4, (v / mx) * 100)}%`; b.createDiv({ cls: "fch-small fch-muted", text: l }); }

	renderStopwatch(hub, el);

	// perbarui jam tanpa menggambar ulang seluruh halaman
	const unsub = P.subscribe(() => {
		if (!clock.isConnected) return void unsub();
		clock.setText(P.clock());
		setProg();
		const playing = P.musicOn;
		if (box.hasClass("is-running") !== P.running || !wrap.style.getPropertyValue("--fc").includes(P.phase === "work" ? "ef4444" : P.phase === "long" ? "0ea5e9" : "10b981") || mu.hasClass("is-playing") !== playing) { unsub(); hub.renderPage(); }
	});
}
