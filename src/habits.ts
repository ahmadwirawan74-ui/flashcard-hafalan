import { Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { Habit } from "./types";
import { DAY, addDays, dayKey, startOfDay } from "./scheduler";
import { btn, confetti } from "./util";
import { play } from "./sound";

const ICONS = ["📖", "💧", "🏃", "🧠", "🧘", "✍️", "🍎", "😴", "🎧", "🌱", "🕌", "📵"];
const D = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const uid = () => "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const active = (h: Habit, t: number) => h.days.includes(new Date(t).getDay());

/** Streak = hari aktif berturut-turut yang dicentang (hari ini boleh belum). */
export function habitStreak(h: Habit): number {
	let n = 0;
	let t = startOfDay(Date.now());
	if (!h.log.includes(dayKey(t))) t = addDays(t, -1);
	for (let i = 0; i < 400; i++, t = addDays(t, -1)) {
		if (!active(h, t)) continue;
		if (h.log.includes(dayKey(t))) n++;
		else break;
	}
	return n;
}

export function toggleHabit(p: FlashcardPlugin, h: Habit, k = dayKey(Date.now()), host?: HTMLElement) {
	if (h.log.includes(k)) { h.log = h.log.filter((x) => x !== k); play("click"); }
	else {
		h.log = [...h.log, k].slice(-500);
		p.data.meta.habitChecks = (p.data.meta.habitChecks ?? 0) + 1;
		p.addCoins(1);
		p.track("habit");
		play("correct");
		const today = dayKey(Date.now());
		if (k === today && p.data.habits.filter((x) => active(x, Date.now())).every((x) => x.log.includes(today))) {
			new Notice("🌟 Semua kebiasaan hari ini tuntas!");
			if (host && p.data.settings.confetti) confetti(host);
			play("victory");
		}
		p.checkAchievements();
	}
	p.requestSave();
}

export function renderHabits(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "🔁 Kebiasaan" });
	head.createDiv({ cls: "fch-muted", text: "Bangun kebiasaan kecil setiap hari. Centang untuk +1 koin, dan jaga streak-nya!" });
	const add = el.createDiv("fch-panel fch-habit-add");
	let icon = ICONS[0];
	const icons = add.createDiv("fch-row");
	ICONS.forEach((ic) => { const b = icons.createEl("button", { cls: "fch-habit-ic" + (ic === icon ? " is-on" : ""), text: ic }); b.onclick = () => { icon = ic; icons.querySelectorAll(".fch-habit-ic").forEach((x) => x.removeClass("is-on")); b.addClass("is-on"); }; });
	const r = add.createDiv("fch-row fch-mt");
	const name = r.createEl("input", { type: "text", cls: "fch-input fch-grow", attr: { placeholder: "Kebiasaan baru, mis. Baca 10 halaman" } });
	const days = new Set([0, 1, 2, 3, 4, 5, 6]);
	const dd = r.createDiv("fch-seg");
	[1, 2, 3, 4, 5, 6, 0].forEach((d) => { const b = dd.createEl("button", { cls: "fch-seg-btn is-active", text: D[d] }); b.onclick = () => { if (days.has(d)) days.delete(d); else days.add(d); b.toggleClass("is-active", days.has(d)); }; });
	const save = () => {
		if (!name.value.trim() || !days.size) return void new Notice("Isi nama dan minimal satu hari.");
		p.data.habits.push({ id: uid(), name: name.value.trim(), icon, days: [...days], log: [], created: Date.now() });
		p.requestSave();
		play("click");
		hub.renderPage();
	};
	name.onkeydown = (e) => { if (e.key === "Enter") save(); };
	btn(r, { text: "Tambah", icon: "plus", cls: "fch-btn-primary", onClick: save });

	if (!p.data.habits.length) return void el.createDiv({ cls: "fch-empty fch-mt", text: "Belum ada kebiasaan. Mulai dari yang kecil, misalnya “Hafalan 10 menit” atau “Minum 8 gelas air”." });
	const today = startOfDay(Date.now());
	const N = 28;
	const list = el.createDiv("fch-habits");
	for (const h of p.data.habits) {
		const card = list.createDiv("fch-habit");
		const top = card.createDiv("fch-row");
		top.createSpan({ cls: "fch-habit-big", text: h.icon });
		const t = top.createDiv("fch-grow");
		t.createDiv({ cls: "fch-strong", text: h.name });
		const st = habitStreak(h);
		const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, -i)).filter((x) => active(h, x));
		const rate = last30.length ? last30.filter((x) => h.log.includes(dayKey(x))).length / last30.length : 0;
		t.createDiv({ cls: "fch-muted fch-small", text: `🔥 ${st} hari beruntun · ${Math.round(rate * 100)}% dalam 30 hari · ${h.days.length === 7 ? "setiap hari" : h.days.sort().map((d) => D[d]).join(", ")}` });
		const done = h.log.includes(dayKey(today));
		const big = top.createEl("button", { cls: "fch-habit-check" + (done ? " is-on" : "") + (!active(h, today) ? " is-off" : ""), text: done ? "✓" : active(h, today) ? "" : "—", attr: { "aria-label": done ? "Batalkan" : "Centang hari ini" } });
		big.onclick = () => { toggleHabit(p, h, undefined, hub.mainEl); hub.renderPage(); };
		btn(top, { icon: "trash-2", cls: "fch-btn-ghost fch-btn-sm", label: "Hapus kebiasaan", onClick: () => { if (window.confirm(`Hapus kebiasaan “${h.name}”?`)) { p.data.habits = p.data.habits.filter((x) => x.id !== h.id); p.requestSave(); hub.renderPage(); } } });
		const grid = card.createDiv("fch-habit-grid");
		for (let i = N - 1; i >= 0; i--) {
			const d = addDays(today, -i), k = dayKey(d);
			const c = grid.createEl("button", { cls: "fch-habit-day" + (h.log.includes(k) ? " is-on" : "") + (!active(h, d) ? " is-off" : "") + (i === 0 ? " is-today" : ""), attr: { "aria-label": new Date(d).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" }) } });
			c.onclick = () => { toggleHabit(p, h, k); hub.renderPage(); };
		}
	}
	void DAY;
}

/** Strip kebiasaan hari ini (untuk Beranda). */
export function renderHabitStrip(hub: HubView, parent: HTMLElement) {
	const p = hub.plugin;
	const t = Date.now();
	const hs = p.data.habits.filter((h) => active(h, t));
	if (!hs.length) return;
	const box = parent.createDiv("fch-panel fch-mt");
	const h = box.createDiv("fch-section-head");
	const done = hs.filter((x) => x.log.includes(dayKey(t))).length;
	h.createEl("h3", { text: `🔁 Kebiasaan hari ini · ${done}/${hs.length}` });
	btn(h, { text: "Kelola", cls: "fch-btn-link", onClick: () => hub.navigate("habits") });
	const row = box.createDiv("fch-habit-strip");
	for (const x of hs) {
		const on = x.log.includes(dayKey(t));
		const b = row.createEl("button", { cls: "fch-habit-pill" + (on ? " is-on" : "") });
		b.createSpan({ text: x.icon });
		b.createSpan({ text: x.name });
		const st = habitStreak(x);
		if (st) b.createSpan({ cls: "fch-muted fch-small", text: `🔥${st}` });
		b.onclick = () => { toggleHabit(p, x, undefined, hub.mainEl); hub.renderPage(); };
	}
}
