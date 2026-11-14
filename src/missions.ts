import type FlashcardPlugin from "./main";
import { DAY, addDays, dayKey, startOfDay } from "./scheduler";
import { seedHash } from "./learn";

export interface Mission { id: string; text: string; event: string; target: number; reward: number; icon: string }

const DAILY: Mission[] = [
	{ id: "rev20", text: "Ulas 20 kartu", event: "reviews", target: 20, reward: 10, icon: "📚" },
	{ id: "rev40", text: "Ulas 40 kartu", event: "reviews", target: 40, reward: 20, icon: "📚" },
	{ id: "rev70", text: "Ulas 70 kartu", event: "reviews", target: 70, reward: 35, icon: "📚" },
	{ id: "new5", text: "Pelajari 5 kartu baru", event: "newCards", target: 5, reward: 10, icon: "🌱" },
	{ id: "new12", text: "Pelajari 12 kartu baru", event: "newCards", target: 12, reward: 20, icon: "🌱" },
	{ id: "combo10", text: "Raih combo ⚡10", event: "comboMax", target: 10, reward: 15, icon: "⚡" },
	{ id: "combo20", text: "Raih combo ⚡20", event: "comboMax", target: 20, reward: 25, icon: "⚡" },
	{ id: "hard3", text: "Jawab benar 3 kartu yang sering terlupa", event: "hardCorrect", target: 3, reward: 20, icon: "🦾" },
	{ id: "kilat15", text: "Raih 15 poin di Kilat", event: "kilatMax", target: 15, reward: 20, icon: "⚡" },
	{ id: "match0", text: "Selesaikan Cocokkan tanpa salah", event: "matchPerfect", target: 1, reward: 20, icon: "🧩" },
	{ id: "explain3", text: "Jelaskan 3 konsep dengan skor ≥ 70% (Feynman)", event: "explainGood", target: 3, reward: 25, icon: "🗣️" },
	{ id: "chain1", text: "Selesaikan 1 tahap Rantai Hafalan", event: "chain", target: 1, reward: 20, icon: "🔗" },
	{ id: "min15", text: "Belajar 15 menit", event: "minutes", target: 15, reward: 15, icon: "⏱️" },
	{ id: "mnemo1", text: "Tulis 1 mnemonik", event: "mnemo", target: 1, reward: 10, icon: "🧠" },
	{ id: "palace1", text: "Jelajahi istana ingatan", event: "palace", target: 1, reward: 20, icon: "🏛️" },
	{ id: "block1", text: "Jalankan 1 jadwal belajar", event: "block", target: 1, reward: 15, icon: "📅" },
	{ id: "muta5", text: "Isi 5 amalan di Mutaba'ah", event: "muta", target: 5, reward: 10, icon: "🕌" },
	{ id: "dzikir1", text: "Selesaikan dzikir pagi atau petang", event: "dzikir", target: 1, reward: 10, icon: "📿" },
	{ id: "tilawah2", text: "Tilawah 2 halaman", event: "quranPages", target: 2, reward: 15, icon: "📖" },
	{ id: "mur3", text: "Murajaah 3 halaman hafalan", event: "murajaah", target: 3, reward: 15, icon: "🔁" },
	{ id: "habit3", text: "Centang 3 kebiasaan", event: "habit", target: 3, reward: 10, icon: "🔁" },
	{ id: "self30", text: "Belajar mandiri 30 menit (stopwatch)", event: "studyMin", target: 30, reward: 20, icon: "⏱" },
	{ id: "task3", text: "Selesaikan 3 tugas", event: "taskDone", target: 3, reward: 15, icon: "✅" },
	{ id: "race1", text: "Ikut 1 balapan melawan dirimu sendiri", event: "race", target: 1, reward: 15, icon: "🏁" },
	{ id: "boss1", text: "Kalahkan boss", event: "boss", target: 1, reward: 30, icon: "👾" },
	{ id: "audio10", text: "Dengarkan 10 kartu di Mode Dengar", event: "audio", target: 10, reward: 15, icon: "🎧" },
];
const WEEKLY: Mission[] = [
	{ id: "w_rev300", text: "Ulas 300 kartu minggu ini", event: "reviews", target: 300, reward: 100, icon: "🏔️" },
	{ id: "w_days5", text: "Belajar 5 hari minggu ini", event: "days", target: 5, reward: 100, icon: "📅" },
	{ id: "w_sim1", text: "Ikuti 1 Simulasi Ujian", event: "simulation", target: 1, reward: 80, icon: "📝" },
	{ id: "w_perfect2", text: "2 sesi sempurna (≥ 10 kartu)", event: "perfectSession", target: 2, reward: 80, icon: "💎" },
	{ id: "w_new50", text: "Pelajari 50 kartu baru", event: "newCards", target: 50, reward: 80, icon: "🌳" },
	{ id: "w_games6", text: "Main 6 minigame", event: "games", target: 6, reward: 60, icon: "🕹️" },
];

const pick = <T>(list: T[], n: number, seed: number): T[] => {
	const a = [...list];
	let x = seed || 1;
	for (let i = a.length - 1; i > 0; i--) {
		x = (Math.imul(x, 1103515245) + 12345) >>> 0;
		const j = x % (i + 1);
		[a[i], a[j]] = [a[j], a[i]];
	}
	// hindari dua misi dengan peristiwa yang sama
	const out: T[] = [];
	for (const m of a) if (!out.some((o) => (o as unknown as Mission).event === (m as unknown as Mission).event)) { out.push(m); if (out.length >= n) break; }
	return out;
};

export const weekStart = (t = Date.now()) => {
	const s = startOfDay(t);
	const dow = (new Date(s).getDay() + 6) % 7;
	return addDays(s, -dow);
};
export const weekKey = (t = Date.now()) => "W" + dayKey(weekStart(t));

export function dailyMissions(): Mission[] {
	return pick(DAILY, 3, seedHash(dayKey(Date.now())));
}
export function weeklyMissions(): Mission[] {
	return pick(WEEKLY, 2, seedHash(weekKey()));
}

function dayValue(p: FlashcardPlugin, key: string, event: string): number {
	const d = p.data.daily[key];
	if (event === "reviews") return d?.reviews ?? 0;
	if (event === "newCards") return d?.newCards ?? 0;
	if (event === "minutes") return Math.floor((d?.ms ?? 0) / 60_000);
	const log = p.data.meta.missionLog?.[key] ?? {};
	if (event === "games") return (log.kilatGames ?? 0) + (log.matchGames ?? 0) + (log.susunGames ?? 0);
	return log[event] ?? 0;
}

export function progress(p: FlashcardPlugin, m: Mission, weekly: boolean): number {
	if (!weekly) return dayValue(p, dayKey(Date.now()), m.event);
	const ws = weekStart();
	let v = 0;
	for (let i = 0; i < 7; i++) {
		const k = dayKey(addDays(ws, i));
		if (m.event === "days") v += (p.data.daily[k]?.reviews ?? 0) > 0 ? 1 : 0;
		else v += dayValue(p, k, m.event);
	}
	return v;
}

export const claimKey = (m: Mission, weekly: boolean) => (weekly ? weekKey() : dayKey(Date.now())) + ":" + m.id;

export function claim(p: FlashcardPlugin, m: Mission, weekly: boolean): boolean {
	const k = claimKey(m, weekly);
	const meta = p.data.meta;
	if ((meta.claimed ?? []).includes(k) || progress(p, m, weekly) < m.target) return false;
	meta.claimed = [...(meta.claimed ?? []).slice(-60), k];
	meta.missionsDone = (meta.missionsDone ?? 0) + 1;
	p.addCoins(m.reward);
	p.checkAchievements();
	return true;
}

/** Panel misi (dipakai di Beranda & Arena). */
export function renderMissions(p: FlashcardPlugin, parent: HTMLElement, onChange: () => void) {
	const box = parent.createDiv("fch-panel fch-missions");
	const row = (m: Mission, weekly: boolean) => {
		const v = Math.min(progress(p, m, weekly), m.target);
		const done = (p.data.meta.claimed ?? []).includes(claimKey(m, weekly));
		const r = box.createDiv("fch-mission" + (done ? " is-claimed" : v >= m.target ? " is-ready" : ""));
		r.createDiv({ cls: "fch-mission-ic", text: m.icon });
		const t = r.createDiv("fch-grow");
		t.createDiv({ cls: "fch-small fch-strong", text: m.text });
		const bar = t.createDiv("fch-bar fch-bar-thin");
		bar.createDiv("fch-bar-fill").style.width = `${(v / m.target) * 100}%`;
		t.createDiv({ cls: "fch-muted fch-small", text: `${v}/${m.target}` });
		if (done) r.createDiv({ cls: "fch-mission-done", text: "✓" });
		else {
			const b = r.createEl("button", { cls: "fch-btn fch-btn-sm" + (v >= m.target ? " fch-btn-primary" : ""), text: `🪙 ${m.reward}` });
			b.disabled = v < m.target;
			b.setAttr("aria-label", v >= m.target ? "Klaim hadiah" : "Selesaikan misi untuk klaim");
			b.onclick = () => { if (claim(p, m, weekly)) onChange(); };
		}
	};
	const h = box.createDiv("fch-section-head");
	h.createEl("h3", { text: "🎯 Misi harian" });
	const left = Math.ceil((startOfDay(Date.now()) + DAY - Date.now()) / 3600_000);
	h.createSpan({ cls: "fch-muted fch-small", text: `berganti dalam ${left} jam` });
	dailyMissions().forEach((m) => row(m, false));
	const h2 = box.createDiv("fch-section-head fch-mt");
	h2.createEl("h3", { text: "🗓️ Misi mingguan" });
	weeklyMissions().forEach((m) => row(m, true));
}

// ---------------------------------------------------------------- maskot
const STAGES = [
	{ min: 1, icon: "🥚", name: "Telur" },
	{ min: 3, icon: "🐣", name: "Baru menetas" },
	{ min: 6, icon: "🐥", name: "Anak burung" },
	{ min: 10, icon: "🐦", name: "Burung muda" },
	{ min: 16, icon: "🦉", name: "Burung hantu bijak" },
	{ min: 25, icon: "🦚", name: "Burung legenda" },
];

export function mascotState(p: FlashcardPlugin) {
	const lv = p.level().level;
	const stage = [...STAGES].reverse().find((s) => lv >= s.min) ?? STAGES[0];
	const next = STAGES.find((s) => s.min > lv);
	let last = -1;
	for (let i = 0; i < 30; i++) if ((p.data.daily[dayKey(Date.now() - i * DAY)]?.reviews ?? 0) > 0) { last = i; break; }
	const today = p.today();
	const goal = p.data.settings.dailyGoal;
	const w = p.waitingToday();
	let mood: "happy" | "proud" | "ok" | "sad" | "sleep";
	let msg: string;
	if (last === 0 && today.reviews >= goal) { mood = "proud"; msg = `Target hari ini tercapai! Aku bangga padamu. 🎉`; }
	else if (last === 0) { mood = "happy"; msg = `${goal - today.reviews} ulasan lagi untuk mencapai target hari ini!`; }
	else if (last === 1) { mood = "ok"; msg = w.due + w.fresh ? `Ada ${w.due + w.fresh} kartu menunggu. Yuk jaga streak kita!` : "Ayo belajar sebentar hari ini!"; }
	else if (last >= 2 && last <= 4) { mood = "sad"; msg = `Sudah ${last} hari kita tidak belajar… aku kangen. 😢`; }
	else { mood = "sleep"; msg = "Zzz… bangunkan aku dengan belajar beberapa kartu."; }
	return { stage, next, mood, msg, level: lv, name: p.data.meta.petName || "Hoki" };
}

export function renderMascot(p: FlashcardPlugin, parent: HTMLElement, onRename?: () => void) {
	const st = mascotState(p);
	const box = parent.createDiv(`fch-pet mood-${st.mood}`);
	const av = box.createDiv("fch-pet-av");
	av.createSpan({ cls: "fch-pet-emoji", text: st.stage.icon });
	if (st.mood === "sleep") av.createSpan({ cls: "fch-pet-zz", text: "z" });
	const tx = box.createDiv("fch-pet-tx");
	const nm = tx.createDiv({ cls: "fch-pet-name" });
	nm.createSpan({ text: st.name });
	nm.createSpan({ cls: "fch-muted fch-small", text: ` · ${st.stage.name}` });
	if (onRename) {
		nm.setAttr("aria-label", "Klik untuk mengganti nama");
		nm.onclick = () => {
			// Electron tidak mendukung window.prompt, jadi ganti nama langsung di tempat
			nm.empty();
			const inp = nm.createEl("input", { type: "text", cls: "fch-input fch-pet-input" });
			inp.value = st.name;
			inp.focus();
			inp.select();
			let done = false;
			const save = (keep = true) => {
				if (done) return;
				done = true;
				const n = inp.value.trim();
				if (keep && n) { p.data.meta.petName = n.slice(0, 20); p.requestSave(); }
				window.setTimeout(onRename, 0);
			};
			inp.onkeydown = (e) => { if (e.key === "Enter") save(); if (e.key === "Escape") save(false); };
			inp.onblur = () => save();
			nm.onclick = null;
		};
	}
	tx.createDiv({ cls: "fch-pet-bubble", text: st.msg });
	if (st.next) tx.createDiv({ cls: "fch-muted fch-small", text: `Berevolusi menjadi ${st.next.icon} di level ${st.next.min}` });
	return box;
}
