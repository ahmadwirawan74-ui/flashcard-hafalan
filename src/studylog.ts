import { Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { subjects } from "./planner";
import { addDays, dayKey, formatDuration, startOfDay } from "./scheduler";
import { btn } from "./util";
import { play } from "./sound";

const uid = () => "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function startStopwatch(p: FlashcardPlugin, subject: string) {
	p.data.meta.stopwatch = { subject: subject.trim() || "Belajar mandiri", start: Date.now() };
	p.requestSave();
	play("click");
}

export function stopStopwatch(p: FlashcardPlugin, note = "") {
	const sw = p.data.meta.stopwatch;
	if (!sw) return;
	const ms = Date.now() - sw.start;
	delete p.data.meta.stopwatch;
	if (ms >= 60_000) {
		p.data.studyLog.push({ id: uid(), subject: sw.subject, start: sw.start, ms, note });
		p.data.studyLog = p.data.studyLog.slice(-2000);
		p.track("studyMin", Math.round(ms / 60_000));
		p.addCoins(Math.min(20, Math.floor(ms / 600_000)));
		new Notice(`⏱ ${formatDuration(ms)} belajar ${sw.subject} tercatat.`);
		play("chime");
		p.checkAchievements();
	} else new Notice("Kurang dari 1 menit, tidak dicatat.");
	p.requestSave();
}

/** Total menit belajar mandiri per mata pelajaran dalam rentang. */
export function minutesBySubject(p: FlashcardPlugin, from: number, to: number) {
	const m = new Map<string, number>();
	for (const l of p.data.studyLog) if (l.start >= from && l.start < to) m.set(l.subject, (m.get(l.subject) ?? 0) + l.ms / 60_000);
	return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
export const minutesOn = (p: FlashcardPlugin, k: string) => p.data.studyLog.filter((l) => dayKey(l.start) === k).reduce((a, l) => a + l.ms / 60_000, 0);

/** Bagian stopwatch di Ruang Fokus. */
export function renderStopwatch(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const box = el.createDiv("fch-panel fch-mt fch-sw");
	box.createEl("h3", { text: "⏱ Stopwatch belajar" });
	box.createDiv({ cls: "fch-muted fch-small fch-desc", text: "Catat waktu belajar di luar flashcard, misalnya membaca buku, mengerjakan soal, atau les. Hasilnya tampil di Kalender, Rencana harian, dan Review mingguan." });
	const sw = p.data.meta.stopwatch;
	const row = box.createDiv("fch-row");
	if (sw) {
		const clock = row.createDiv({ cls: "fch-sw-clock", text: formatDuration(Date.now() - sw.start) });
		row.createDiv({ cls: "fch-strong", text: sw.subject });
		const note = row.createEl("input", { type: "text", cls: "fch-input fch-grow", attr: { placeholder: "Catatan singkat (opsional), mis. Bab 3 hal. 40–55" } });
		btn(row, { text: "Selesai", icon: "square", cls: "fch-btn-primary", onClick: () => { stopStopwatch(p, note.value.trim()); hub.renderPage(); } });
		const t = window.setInterval(() => { if (!clock.isConnected) return window.clearInterval(t); clock.setText(formatDuration(Date.now() - sw.start)); }, 1000);
	} else {
		const subj = row.createEl("input", { type: "text", cls: "fch-input fch-grow", attr: { placeholder: "Mata pelajaran, mis. Matematika", list: "fch-subj3" } });
		const dl = box.createEl("datalist", { attr: { id: "fch-subj3" } });
		subjects(p).forEach((s) => dl.createEl("option", { attr: { value: s } }));
		subj.onkeydown = (e) => { if (e.key === "Enter") { startStopwatch(p, subj.value); hub.renderPage(); } };
		btn(row, { text: "Mulai", icon: "play", cls: "fch-btn-primary", onClick: () => { startStopwatch(p, subj.value); hub.renderPage(); } });
	}
	const today = startOfDay(Date.now());
	const week = minutesBySubject(p, addDays(today, -6), addDays(today, 1));
	if (week.length) {
		const total = week.reduce((a, x) => a + x[1], 0);
		box.createDiv({ cls: "fch-small fch-strong fch-mt", text: `7 hari terakhir: ${Math.floor(total / 60)} j ${Math.round(total % 60)} m` });
		for (const [s, m] of week.slice(0, 6)) {
			const r = box.createDiv("fch-typeacc");
			r.createSpan({ cls: "fch-typeacc-l", text: s });
			r.createDiv("fch-bar fch-grow").createDiv("fch-bar-fill").style.width = `${(m / week[0][1]) * 100}%`;
			r.createSpan({ cls: "fch-typeacc-v", text: `${Math.round(m)}m` });
		}
	}
}
