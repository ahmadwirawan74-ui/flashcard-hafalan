import { Notice, normalizePath } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { Task } from "./types";
import { addDays, dayKey, startOfDay } from "./scheduler";
import { weekKey, weekStart } from "./missions";
import { weekStats } from "./report";
import { isOverdue, toggleTask, deleteTask } from "./tasks";
import { minutesBySubject } from "./studylog";
import { average } from "./grades";
import { basename, btn, confetti } from "./util";
import { play } from "./sound";

/** Saatnya review: Jumat–Minggu, dan belum review minggu ini. */
export const reviewDue = (p: FlashcardPlugin) => [0, 5, 6].includes(new Date().getDay()) && p.data.meta.lastReview !== weekKey();

let step = 0;
const ans = { good: "", hard: "", change: "", prio: ["", "", ""] };

export function renderReview(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "🧭 Review mingguan" });
	head.createDiv({ cls: "fch-muted", text: "10 menit setiap akhir pekan: bereskan yang tertinggal, rayakan pencapaian, dan rencanakan minggu depan." });
	const STEPS = ["Bereskan tugas", "Pencapaian", "Refleksi", "Minggu depan", "Selesai"];
	const prog = el.createDiv("fch-steps");
	STEPS.forEach((s, i) => { const d = prog.createDiv("fch-step" + (i < step ? " is-done" : i === step ? " is-now" : "")); d.createSpan({ cls: "fch-step-n", text: i < step ? "✓" : String(i + 1) }); d.createSpan({ text: s }); });
	const box = el.createDiv("fch-panel fch-review");
	const nav = () => {
		const r = el.createDiv("fch-row fch-mt");
		if (step > 0 && step < 4) btn(r, { text: "Kembali", icon: "chevron-left", onClick: () => { step--; hub.renderPage(); } });
		r.createDiv("fch-grow");
		if (step < 3) btn(r, { text: "Lanjut", icon: "chevron-right", cls: "fch-btn-primary", onClick: () => { step++; hub.renderPage(); } });
	};

	if (step === 0) {
		box.createEl("h3", { text: "1 · Bereskan tugas yang tertinggal" });
		const late = p.data.tasks.filter(isOverdue);
		const nodate = p.data.tasks.filter((t) => !t.done && !t.due);
		if (!late.length && !nodate.length) box.createDiv({ cls: "fch-empty", text: "🎉 Tidak ada tugas yang tertinggal!" });
		const row = (t: Task, label: string) => {
			const r = box.createDiv("fch-review-task");
			r.createDiv({ cls: "fch-grow", text: t.title });
			r.createSpan({ cls: "fch-muted fch-small", text: label });
			btn(r, { text: "Selesai", icon: "check", cls: "fch-btn-sm", onClick: () => { toggleTask(p, t); hub.renderPage(); } });
			btn(r, { text: "Besok", cls: "fch-btn-sm", onClick: () => { t.due = dayKey(addDays(startOfDay(Date.now()), 1)); p.requestSave(); hub.renderPage(); } });
			btn(r, { text: "Senin", cls: "fch-btn-sm", onClick: () => { t.due = dayKey(addDays(weekStart(), 7)); p.requestSave(); hub.renderPage(); } });
			btn(r, { icon: "trash-2", cls: "fch-btn-ghost fch-btn-sm", label: "Hapus", onClick: () => { deleteTask(p, t); hub.renderPage(); } });
		};
		late.forEach((t) => row(t, `terlambat sejak ${t.due}`));
		nodate.slice(0, 10).forEach((t) => row(t, "tanpa tanggal"));
	} else if (step === 1) {
		box.createEl("h3", { text: "2 · Pencapaian minggu ini" });
		const ws = weekStart(), we = addDays(ws, 7);
		const w = weekStats(p, ws);
		const doneTasks = p.data.tasks.filter((t) => (t.doneAt && t.doneAt >= ws && t.doneAt < we) || t.log?.some((k) => k >= dayKey(ws) && k < dayKey(we))).length;
		const habits = p.data.habits.reduce((a, h) => a + h.log.filter((k) => k >= dayKey(ws) && k < dayKey(we)).length, 0);
		const mins = minutesBySubject(p, ws, we).reduce((a, x) => a + x[1], 0);
		const pomos = Object.entries(p.data.meta.pomoLog ?? {}).filter(([k]) => k >= dayKey(ws) && k < dayKey(we)).reduce((a, [, n]) => a + n, 0);
		const g = box.createDiv("fch-tiles");
		const tile = (v: string, l: string) => { const t = g.createDiv("fch-stat"); t.createDiv({ cls: "fch-tile-v", text: v }); t.createDiv({ cls: "fch-muted fch-small", text: l }); };
		tile(String(w.reviews), "kartu diulas");
		tile(w.reviews ? `${Math.round((w.correct / w.reviews) * 100)}%` : "—", "akurasi");
		tile(String(doneTasks), "tugas selesai");
		tile(`🍅 ${pomos}`, "sesi fokus");
		tile(`${Math.round(mins)} m`, "belajar mandiri");
		tile(String(habits), "kebiasaan dicentang");
		const grades = p.data.grades.filter((x) => x.date >= dayKey(ws) && x.date < dayKey(we));
		if (grades.length) box.createDiv({ cls: "fch-small fch-mt", text: `🏅 Nilai baru: ${grades.map((x) => `${x.subject} ${x.score}`).join(", ")} (rata-rata ${average(grades)?.toFixed(1)})` });
		if (w.topMaterial) box.createDiv({ cls: "fch-small", text: `📘 Paling sering dilatih: ${basename(w.topMaterial.path)}` });
	} else if (step === 2) {
		box.createEl("h3", { text: "3 · Refleksi" });
		const q = (label: string, key: "good" | "hard" | "change", ph: string) => {
			const f = box.createDiv("fch-field");
			f.createEl("label", { text: label });
			const t = f.createEl("textarea", { cls: "fch-input", attr: { rows: "2", placeholder: ph } });
			t.value = ans[key];
			t.oninput = () => (ans[key] = t.value);
		};
		q("😊 Apa yang berjalan baik minggu ini?", "good", "mis. Konsisten belajar pagi, nilai ulangan naik");
		q("😓 Apa yang sulit atau tertunda?", "hard", "mis. Bab Genetika masih bingung");
		q("🔧 Apa yang akan kuubah minggu depan?", "change", "mis. Pomodoro 2× sebelum makan malam");
	} else if (step === 3) {
		box.createEl("h3", { text: "4 · Tiga prioritas minggu depan" });
		box.createDiv({ cls: "fch-muted fch-small fch-desc", text: "Akan dibuat sebagai tugas berprioritas tinggi untuk Senin. Tanggal, jam, dan tag di dalam teks tetap dikenali." });
		ans.prio.forEach((v, i) => {
			const inp = box.createEl("input", { type: "text", cls: "fch-input fch-mt", attr: { placeholder: `Prioritas ${i + 1}` } });
			inp.value = v;
			inp.oninput = () => (ans.prio[i] = inp.value);
		});
		const r = el.createDiv("fch-row fch-mt");
		btn(r, { text: "Kembali", icon: "chevron-left", onClick: () => { step--; hub.renderPage(); } });
		r.createDiv("fch-grow");
		btn(r, { text: "Selesaikan review", icon: "check", cls: "fch-btn-primary", onClick: () => void finish(hub) });
		return;
	} else {
		box.createDiv({ cls: "fch-sum-emoji", text: "🧭" });
		box.createEl("h2", { text: "Review minggu ini selesai!" });
		box.createDiv({ cls: "fch-muted", text: "Refleksimu tersimpan sebagai catatan, dan prioritas minggu depan sudah masuk ke Tugas." });
		const r = box.createDiv("fch-row fch-mt");
		btn(r, { text: "Lihat tugas", icon: "check-square", cls: "fch-btn-primary", onClick: () => { step = 0; hub.navigate("tasks"); } });
		btn(r, { text: "Beranda", onClick: () => { step = 0; hub.navigate("home"); } });
		return;
	}
	nav();
}

async function finish(hub: HubView) {
	const p = hub.plugin;
	const mon = dayKey(addDays(weekStart(), 7));
	const made = ans.prio.filter((x) => x.trim());
	for (const t of made) {
		const { addTask } = await import("./tasks");
		const task = addTask(p, t.trim(), { due: mon, priority: 3 });
		if (task && !/\b(besok|lusa|senin|selasa|rabu|kamis|jumat|sabtu|minggu|tgl|\d+\/\d+)\b/i.test(t)) task.due = mon;
	}
	const ws = weekStart();
	const w = weekStats(p, ws);
	const folder = normalizePath(p.data.settings.notesFolder || "Catatan Belajar");
	if (!p.app.vault.getAbstractFileByPath(folder)) await p.app.vault.createFolder(folder);
	let path = normalizePath(`${folder}/Review ${weekKey().slice(1)}.md`);
	for (let i = 2; p.app.vault.getAbstractFileByPath(path); i++) path = normalizePath(`${folder}/Review ${weekKey().slice(1)} (${i}).md`);
	const body = [
		`---\ndibuat: ${dayKey(Date.now())}\nwarna: biru\n---`,
		`# 🧭 Review minggu ${new Date(ws).toLocaleDateString("id-ID", { day: "numeric", month: "long" })}`, "",
		`- 🧠 ${w.reviews} kartu diulas · akurasi ${w.reviews ? Math.round((w.correct / w.reviews) * 100) : 0}%`,
		`- 📅 ${w.days}/7 hari aktif`, "",
		"## 😊 Yang berjalan baik", ans.good || "-", "",
		"## 😓 Yang sulit", ans.hard || "-", "",
		"## 🔧 Yang akan kuubah", ans.change || "-", "",
		"## 🎯 Prioritas minggu depan", ...made.map((x) => `- [ ] ${x}`), "",
	].join("\n");
	await p.app.vault.create(path, body);
	p.data.meta.lastReview = weekKey();
	p.data.meta.weeklyReviews = (p.data.meta.weeklyReviews ?? 0) + 1;
	p.addCoins(30);
	p.requestSave();
	p.checkAchievements();
	play("victory");
	new Notice("🧭 Review mingguan tersimpan (+30 🪙)");
	ans.good = ans.hard = ans.change = "";
	ans.prio = ["", "", ""];
	step = 4;
	hub.renderPage();
	if (p.data.settings.confetti) confetti(hub.mainEl);
}
