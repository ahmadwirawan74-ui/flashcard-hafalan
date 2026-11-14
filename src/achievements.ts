import type FlashcardPlugin from "./main";
import { formatDuration } from "./scheduler";

export const TIERS = ["Perunggu", "Perak", "Emas", "Platinum", "Legenda"];

interface Ctx {
	reviews: number;
	bestDay: number;
	streak: number;
	mature: number;
	cards: number;
	level: number;
	mnemo: number;
	occ: number;
	x: Record<string, number>;
	m: Required<Pick<import("./types").Meta, "perfectSessions" | "maxCombo" | "quizCorrect" | "fixedCards" | "pomodoros" | "nightSessions" | "morningSessions">> & { bestMatchMs: number };
}

export interface AchDef {
	id: string;
	name: string;
	icon: string;
	group: string;
	tiers: number[];
	/** Teks target untuk satu tingkat. */
	goal: (t: number) => string;
	value: (c: Ctx) => number;
	/** Semakin kecil semakin baik (mis. waktu). */
	lower?: boolean;
	fmt?: (v: number) => string;
}

export const ACHIEVEMENTS: AchDef[] = [
	{ id: "reviews", name: "Penjelajah Memori", icon: "🧭", group: "Belajar", tiers: [10, 100, 500, 2000, 10000], goal: (t) => `Ulas ${t.toLocaleString("id-ID")} kartu`, value: (c) => c.reviews },
	{ id: "streak", name: "Api Abadi", icon: "🔥", group: "Kebiasaan", tiers: [3, 7, 14, 30, 100], goal: (t) => `Belajar ${t} hari beruntun`, value: (c) => c.streak },
	{ id: "day", name: "Maraton", icon: "🏃", group: "Belajar", tiers: [50, 100, 200, 350, 500], goal: (t) => `${t} ulasan dalam sehari`, value: (c) => c.bestDay },
	{ id: "mature", name: "Akar Kuat", icon: "🌳", group: "Ingatan", tiers: [10, 50, 150, 400, 1000], goal: (t) => `${t} kartu matang (interval ≥ 21 hari)`, value: (c) => c.mature },
	{ id: "perfect", name: "Tanpa Cela", icon: "💎", group: "Ingatan", tiers: [1, 5, 15, 40, 100], goal: (t) => `${t} sesi sempurna (≥ 10 kartu, semua benar)`, value: (c) => c.m.perfectSessions },
	{ id: "recover", name: "Bangkit Lagi", icon: "🦾", group: "Ingatan", tiers: [3, 15, 40, 100, 250], goal: (t) => `${t} kartu yang dulu sering lupa kini matang`, value: (c) => c.x.recovered },
	{ id: "retest", name: "Tahan Lama", icon: "🧪", group: "Ingatan", tiers: [1, 3, 8, 20, 50], goal: (t) => `Lulus ${t} tes retensi (skor ≥ 80%)`, value: (c) => c.x.testsPassed },
	{ id: "master", name: "Penguasa Materi", icon: "📘", group: "Ingatan", tiers: [1, 3, 8, 20, 50], goal: (t) => `${t} materi dengan ≥ 80% kartu matang`, value: (c) => c.x.mastered },
	{ id: "checklist", name: "Hafal Luar Kepala", icon: "✅", group: "Ingatan", tiers: [5, 25, 100, 250, 600], goal: (t) => `Centang semua bagian di ${t} kartu multi-baris`, value: (c) => c.x.checklist },
	{ id: "weak", name: "Pemburu Kelemahan", icon: "🎯", group: "Ingatan", tiers: [1, 5, 20, 50, 120], goal: (t) => `${t} sesi latihan kelemahan`, value: (c) => c.x.weakSessions },
	{ id: "exam", name: "Siap Ujian", icon: "🎓", group: "Ingatan", tiers: [1, 2, 4, 8, 15], goal: (t) => `${t} ujian dengan semua kartu sudah dipelajari`, value: (c) => c.x.examsReady },
	{ id: "combo", name: "Combo Master", icon: "⚡", group: "Ingatan", tiers: [10, 25, 50, 100, 200], goal: (t) => `Combo ${t} jawaban benar berturut-turut`, value: (c) => c.m.maxCombo },
	{ id: "quiz", name: "Ahli Kuis", icon: "🎯", group: "Permainan", tiers: [10, 50, 200, 500, 1500], goal: (t) => `Jawab benar ${t} soal pilihan ganda`, value: (c) => c.m.quizCorrect },
	{
		id: "match", name: "Tangan Kilat", icon: "🧩", group: "Permainan", tiers: [60_000, 45_000, 30_000, 20_000, 12_000], lower: true,
		goal: (t) => `Selesaikan Cocokkan di bawah ${t / 1000} detik`, value: (c) => c.m.bestMatchMs,
		fmt: (v) => (isFinite(v) ? formatDuration(v) : "—"),
	},
	{ id: "explain", name: "Guru Kecil", icon: "🗣️", group: "Ingatan", tiers: [5, 25, 75, 200, 500], goal: (t) => `Jelaskan ${t} konsep (mode Feynman)`, value: (c) => c.x.explains },
	{ id: "palace", name: "Penjelajah Istana", icon: "🏛️", group: "Ingatan", tiers: [1, 5, 15, 40, 100], goal: (t) => `Jelajahi istana ingatan ${t} kali`, value: (c) => c.x.palace },
	{ id: "chain", name: "Penghafal Teks", icon: "🔗", group: "Ingatan", tiers: [1, 5, 15, 40, 100], goal: (t) => `Tuntaskan ${t} rantai hafalan`, value: (c) => c.x.chains },
	{ id: "sim", name: "Siap Tempur", icon: "📝", group: "Ingatan", tiers: [1, 5, 15, 30, 60], goal: (t) => `Ikuti ${t} simulasi ujian`, value: (c) => c.x.sims },
	{ id: "audio", name: "Pendengar Setia", icon: "🎧", group: "Kebiasaan", tiers: [20, 100, 400, 1000, 3000], goal: (t) => `Dengarkan ${t} kartu di Mode Dengar`, value: (c) => c.x.audio },
	{ id: "missions", name: "Pemburu Misi", icon: "🎯", group: "Kebiasaan", tiers: [3, 15, 50, 120, 300], goal: (t) => `Selesaikan ${t} misi`, value: (c) => c.x.missions },
	{ id: "boss", name: "Penakluk Boss", icon: "👾", group: "Permainan", tiers: [1, 3, 8, 20, 50], goal: (t) => `Kalahkan ${t} boss`, value: (c) => c.x.boss },
	{ id: "worlds", name: "Penjelajah Dunia", icon: "🗺️", group: "Ingatan", tiers: [1, 2, 3, 5, 8], goal: (t) => `Kuasai seluruh level di ${t} dunia Petualangan`, value: (c) => c.x.worlds },
	{ id: "race", name: "Pelari Bayangan", icon: "🏁", group: "Permainan", tiers: [1, 5, 15, 40, 100], goal: (t) => `Ikut ${t} balapan melawan dirimu`, value: (c) => c.x.races },
	{ id: "duel", name: "Sang Penantang", icon: "⚔️", group: "Permainan", tiers: [1, 5, 15, 40, 100], goal: (t) => `Main ${t} duel`, value: (c) => c.x.duels },
	{ id: "contrast", name: "Mata Jeli", icon: "⚖️", group: "Ingatan", tiers: [1, 5, 15, 40, 100], goal: (t) => `Latih ${t} sesi Bedakan yang Mirip`, value: (c) => c.x.contrasts },
	{ id: "worksheet", name: "Guru Privat", icon: "🖨️", group: "Kreasi", tiers: [1, 3, 8, 20, 50], goal: (t) => `Buat ${t} lembar latihan`, value: (c) => c.x.worksheets },
	{ id: "drawing", name: "Pelukis Ingatan", icon: "🎨", group: "Kreasi", tiers: [5, 25, 75, 200, 500], goal: (t) => `Jawab ${t} kartu dengan tulis tangan`, value: (c) => c.x.drawings },
	{ id: "quick", name: "Efisien", icon: "⏱️", group: "Kebiasaan", tiers: [1, 5, 20, 50, 120], goal: (t) => `Selesaikan ${t} sesi "Aku punya X menit"`, value: (c) => c.x.quick },
	{ id: "tasks", name: "Produktif", icon: "✅", group: "Kebiasaan", tiers: [5, 25, 100, 300, 1000], goal: (t) => `Selesaikan ${t} tugas`, value: (c) => c.x.tasks },
	{ id: "notes", name: "Penulis Rajin", icon: "🗒️", group: "Kreasi", tiers: [1, 10, 30, 75, 200], goal: (t) => `Buat ${t} catatan`, value: (c) => c.x.notes },
	{ id: "habit", name: "Manusia Kebiasaan", icon: "🔁", group: "Kebiasaan", tiers: [10, 50, 200, 500, 1500], goal: (t) => `Centang kebiasaan ${t} kali`, value: (c) => c.x.habits },
	{ id: "review", name: "Navigator", icon: "🧭", group: "Kebiasaan", tiers: [1, 4, 12, 26, 52], goal: (t) => `Selesaikan ${t} review mingguan`, value: (c) => c.x.reviews },
	{ id: "selfstudy", name: "Pembelajar Mandiri", icon: "⏱", group: "Kebiasaan", tiers: [1, 10, 50, 150, 500], goal: (t) => `Catat ${t} jam belajar mandiri`, value: (c) => c.x.selfHours },
	{ id: "grades", name: "Pencatat Nilai", icon: "🏅", group: "Kreasi", tiers: [1, 10, 30, 75, 200], goal: (t) => `Catat ${t} nilai`, value: (c) => c.x.gradeCount },
	{ id: "khatam", name: "Khatam", icon: "📖", group: "Ibadah", tiers: [1, 2, 3, 5, 10], goal: (t) => `Khatam Al-Qur'an ${t} kali`, value: (c) => c.x.khatam },
	{ id: "hafidz", name: "Penjaga Hafalan", icon: "🧠", group: "Ibadah", tiers: [7, 100, 500, 1000, 6236], goal: (t) => `Hafal ${t} ayat`, value: (c) => c.x.hafal },
	{ id: "tilawah", name: "Istiqamah Tilawah", icon: "🌙", group: "Ibadah", tiers: [7, 30, 100, 200, 365], goal: (t) => `Tilawah di ${t} hari berbeda`, value: (c) => c.x.tilawahDays },
	{ id: "murajaah", name: "Rajin Murajaah", icon: "🔁", group: "Ibadah", tiers: [10, 50, 200, 500, 1500], goal: (t) => `Murajaah ${t} halaman`, value: (c) => c.x.murajaah },
	{ id: "sholat5", name: "Penjaga Sholat", icon: "🕌", group: "Ibadah", tiers: [7, 30, 100, 200, 365], goal: (t) => `Catat sholat 5 waktu lengkap di ${t} hari`, value: (c) => c.x.sholat5 },
	{ id: "hadits", name: "Penghafal Hadits", icon: "📜", group: "Ibadah", tiers: [1, 10, 42, 100, 142], goal: (t) => `Hafal ${t} hadits (Arbain & Muslim)`, value: (c) => c.x.hadits },
	{ id: "asmaul", name: "Asmaul Husna", icon: "✨", group: "Ibadah", tiers: [10, 25, 50, 75, 99], goal: (t) => `Hafal ${t} nama Asmaul Husna`, value: (c) => c.x.asma },
	{ id: "dzikir", name: "Ahli Dzikir", icon: "📿", group: "Ibadah", tiers: [7, 30, 100, 300, 1000], goal: (t) => `Selesaikan ${t} sesi dzikir pagi/petang`, value: (c) => c.x.dzikir },
	{ id: "tasbih", name: "Tasbih", icon: "🤲", group: "Ibadah", tiers: [1000, 10000, 33000, 100000, 333000], goal: (t) => `Bertasbih ${t.toLocaleString("id-ID")} kali`, value: (c) => c.x.tasbih },
	{ id: "puasa", name: "Shaum", icon: "🌙", group: "Ibadah", tiers: [7, 15, 29, 60, 120], goal: (t) => `Catat ${t} hari puasa Ramadan`, value: (c) => c.x.puasa },
	{ id: "alkemis", name: "Alkemis", icon: "⚗️", group: "Main", tiers: [1, 10, 30, 80], goal: (t) => `Racik ${t} kali di Bengkel Alkimia`, value: (c) => c.x.crafted },
	{ id: "musiman", name: "Pejuang Musiman", icon: "🎉", group: "Main", tiers: [1, 5, 15, 40], goal: (t) => `Kalahkan boss event ${t} kali`, value: (c) => c.x.evboss },
	{ id: "saudagar", name: "Pelanggan Setia", icon: "🛍️", group: "Main", tiers: [1, 5, 15, 40], goal: (t) => `Beli ${t} barang di Toko`, value: (c) => c.x.bought },
	{ id: "kolektor", name: "Kolektor", icon: "🎴", group: "Main", tiers: [5, 12, 24, 36], goal: (t) => `Kumpulkan ${t} kartu koleksi berbeda`, value: (c) => c.x.collect },
	{ id: "dungeon", name: "Penjelajah Dungeon", icon: "🗝️", group: "Main", tiers: [5, 10, 20, 30], goal: (t) => `Capai lantai ${t} di dungeon`, value: (c) => c.x.dungeon },
	{ id: "kutubuku", name: "Kutu Buku", icon: "📖", group: "Belajar", tiers: [10, 50, 150, 400], goal: (t) => `Baca ${t} potongan bacaan`, value: (c) => c.x.reading },
	{ id: "disiplin", name: "Disiplin", icon: "📅", group: "Kebiasaan", tiers: [5, 25, 100, 300, 1000], goal: (t) => `Jalankan ${t} jadwal belajar`, value: (c) => c.x.blocks },
	{ id: "kilat", name: "Raja Kilat", icon: "⚡", group: "Permainan", tiers: [10, 20, 30, 45, 60], goal: (t) => `Raih ${t} poin di Kilat`, value: (c) => c.x.kilatBest },
	{ id: "susun", name: "Penyusun Ulung", icon: "🔢", group: "Permainan", tiers: [1, 10, 30, 80, 200], goal: (t) => `Susun ${t} daftar dengan benar`, value: (c) => c.x.susun },
	{ id: "arcade", name: "Anak Arena", icon: "🕹️", group: "Permainan", tiers: [3, 15, 40, 100, 250], goal: (t) => `Main minigame ${t} kali`, value: (c) => c.x.games },
	{ id: "coins", name: "Kolektor Koin", icon: "🪙", group: "Koleksi", tiers: [100, 500, 2000, 6000, 15000], goal: (t) => `Kumpulkan total ${t.toLocaleString("id-ID")} koin`, value: (c) => c.x.coins },
	{ id: "skins", name: "Gaya Baru", icon: "🎨", group: "Koleksi", tiers: [1, 2, 3, 4, 6], goal: (t) => `Miliki ${t} tema kartu`, value: (c) => c.x.skins },
	{ id: "cards", name: "Arsitek Kartu", icon: "🏗️", group: "Kreasi", tiers: [10, 50, 150, 400, 1000], goal: (t) => `Punya ${t} flashcard`, value: (c) => c.cards },
	{ id: "occ", name: "Mata Elang", icon: "🦅", group: "Kreasi", tiers: [5, 25, 75, 200, 500], goal: (t) => `Buat ${t} kotak Image Occlusion`, value: (c) => c.occ },
	{ id: "mnemo", name: "Jembatan Keledai", icon: "🧠", group: "Kreasi", tiers: [1, 10, 30, 75, 200], goal: (t) => `Tulis ${t} mnemonik`, value: (c) => c.mnemo },
	{ id: "fix", name: "Penyelamat Kartu", icon: "🛠️", group: "Kreasi", tiers: [1, 10, 30, 75, 200], goal: (t) => `Perbaiki ${t} kartu bertanda`, value: (c) => c.m.fixedCards },
	{ id: "pomo", name: "Fokus Baja", icon: "🍅", group: "Kebiasaan", tiers: [1, 5, 20, 50, 150], goal: (t) => `Selesaikan ${t} sesi Pomodoro`, value: (c) => c.m.pomodoros },
	{ id: "night", name: "Burung Hantu", icon: "🦉", group: "Kebiasaan", tiers: [1, 5, 15, 40, 100], goal: (t) => `${t} sesi selesai antara 22.00–04.00`, value: (c) => c.m.nightSessions },
	{ id: "morning", name: "Burung Pagi", icon: "🐦", group: "Kebiasaan", tiers: [1, 5, 15, 40, 100], goal: (t) => `${t} sesi selesai antara 04.00–07.00`, value: (c) => c.m.morningSessions },
	{ id: "days", name: "Konsisten Sejati", icon: "📅", group: "Kebiasaan", tiers: [7, 30, 100, 200, 365], goal: (t) => `Belajar total ${t} hari`, value: (c) => c.x.days },
	{ id: "interleave", name: "Pengaduk Ilmu", icon: "🔀", group: "Kebiasaan", tiers: [1, 5, 20, 50, 120], goal: (t) => `${t} sesi selang-seling (interleaved)`, value: (c) => c.x.interleaved },
	{ id: "level", name: "Naik Kelas", icon: "👑", group: "Kebiasaan", tiers: [5, 10, 20, 35, 50], goal: (t) => `Capai level ${t}`, value: (c) => c.level },
];

export interface AchState {
	def: AchDef;
	value: number;
	/** Jumlah tingkat yang tercapai (0–5). */
	tier: number;
	next: number | null;
	progress: number;
}

function context(p: FlashcardPlugin): Ctx {
	let reviews = 0, bestDay = 0;
	for (const d of Object.values(p.data.daily)) {
		reviews += d.reviews;
		bestDay = Math.max(bestDay, d.reviews);
	}
	const m = p.data.meta;
	return {
		reviews, bestDay,
		streak: p.streak().best,
		mature: p.countFor(p.sortedPaths()).mature,
		cards: p.allCards().length,
		level: p.level().level,
		mnemo: Object.values(p.data.mnemo).filter((x) => x.trim()).length,
		occ: Object.values(p.data.occlusions).reduce((n, o) => n + o.masks.length, 0),
		x: extra(p),
		m: {
			perfectSessions: m.perfectSessions ?? 0, maxCombo: m.maxCombo ?? 0, quizCorrect: m.quizCorrect ?? 0,
			fixedCards: m.fixedCards ?? 0, pomodoros: m.pomodoros ?? 0, nightSessions: m.nightSessions ?? 0,
			morningSessions: m.morningSessions ?? 0, bestMatchMs: m.bestMatchMs ?? Infinity,
		},
	};
}

function extra(p: FlashcardPlugin): Record<string, number> {
	const m = p.data.meta;
	let recovered = 0;
	for (const st of Object.values(p.data.cards)) if (st.lapses >= 2 && st.interval >= 21) recovered++;
	let mastered = 0;
	for (const path of p.sortedPaths()) {
		const c = p.countFor([path]);
		if (c.total >= 3 && c.mature / c.total >= 0.8) mastered++;
	}
	let examsReady = 0;
	for (const e of p.data.exams) {
		const set = new Set(e.paths);
		const cards = p.allCards().filter((c) => !e.paths.length || set.has(c.path));
		if (cards.length && cards.every((c) => (p.data.cards[c.id]?.history.length ?? 0) > 0)) examsReady++;
	}
	return {
		days: Object.values(p.data.daily).filter((d) => d.reviews > 0).length,
		interleaved: m.interleaved ?? 0,
		recovered, mastered, examsReady,
		testsPassed: (m.retentionTests ?? []).filter((t) => t.n && t.correct / t.n >= 0.8).length,
		checklist: m.checklistPerfect ?? 0,
		weakSessions: m.weakSessions ?? 0,
		kilatBest: m.kilatBest ?? 0,
		susun: m.susunDone ?? 0,
		games: (m.matchesPlayed ?? 0) + (m.kilatPlayed ?? 0) + Math.floor((m.susunDone ?? 0) / 3),
		coins: m.coinsTotal ?? 0,
		skins: (m.skins ?? []).length,
		explains: m.explains ?? 0, palace: m.palaceWalks ?? 0, chains: m.chainsDone ?? 0,
		sims: m.simulations ?? 0, audio: m.audioCards ?? 0, missions: m.missionsDone ?? 0,
		boss: m.bossWins ?? 0, races: m.races ?? 0, duels: m.duels ?? 0, contrasts: m.contrasts ?? 0,
		blocks: m.blocksDone ?? 0,
		collect: Object.keys(p.data.collect?.owned ?? {}).length,
		bought: p.data.hero?.bought ?? 0,
		crafted: p.data.hero?.crafted ?? 0,
		evboss: Object.values(p.data.events?.bossWins ?? {}).reduce((a, n) => a + n, 0),
		dungeon: m.dungeonBest ?? 0,
		reading: (p.data.reading ?? []).reduce((a, it) => a + Object.values(it.log).reduce((x, y) => x + y, 0), 0),
		tasks: m.tasksDone ?? 0, notes: m.notesCreated ?? 0,
		sholat5: Object.keys(p.data.ibadah.muta).filter((k) => ["subuh", "dzuhur", "ashar", "maghrib", "isya"].every((x) => (p.data.ibadah.muta[k]?.[x] ?? 0) > 0)).length,
		hadits: Object.entries(p.data.ibadah.hafal).filter(([k, v]) => v === 2 && (k.startsWith("a:") || k.startsWith("m:"))).length,
		asma: Object.entries(p.data.ibadah.hafal).filter(([k, v]) => v === 2 && k.startsWith("n:")).length,
		dzikir: Object.values(p.data.ibadah.dzikir).reduce((a, d) => a + (d.pagi ? 1 : 0) + (d.petang ? 1 : 0), 0),
		tasbih: p.data.ibadah.tasbih.total,
		puasa: Object.values(p.data.ibadah.ramadan.fast).filter((v) => v === 1).length,
		khatam: p.data.quran.khatam, hafal: Object.values(p.data.quran.hafal).filter((v) => v === 2).length,
		tilawahDays: Object.values(p.data.quran.read).filter((r) => r.ayat > 0).length,
		murajaah: Object.values(p.data.quran.murLog).reduce((a, n) => a + n, 0),
		habits: m.habitChecks ?? 0, reviews: m.weeklyReviews ?? 0, gradeCount: p.data.grades.length,
		selfHours: Math.floor(p.data.studyLog.reduce((a, l) => a + l.ms, 0) / 3600_000),
		worksheets: m.worksheets ?? 0, drawings: m.drawings ?? 0, quick: m.quickSessions ?? 0, worlds: worldsDone(p),
	};
}

function worldsDone(p: FlashcardPlugin): number {
	const by = new Map<string, string[]>();
	for (const x of p.sortedPaths()) { const f = x.includes("/") ? x.slice(0, x.lastIndexOf("/")) : ""; (by.get(f) ?? by.set(f, []).get(f)!).push(x); }
	let n = 0;
	for (const files of by.values()) if (files.every((f) => { const cs = p.index.get(f) ?? []; return cs.length > 0 && cs.filter((c) => (p.data.cards[c.id]?.interval ?? 0) >= 3).length / cs.length >= 0.8; })) n++;
	return n;
}

export function evaluate(p: FlashcardPlugin): AchState[] {
	const c = context(p);
	return ACHIEVEMENTS.map((def) => {
		const value = def.value(c);
		const reached = (t: number) => (def.lower ? value <= t : value >= t);
		const tier = def.tiers.filter(reached).length;
		const next = tier < def.tiers.length ? def.tiers[tier] : null;
		let progress = 1;
		if (next !== null) {
			if (def.lower) progress = isFinite(value) ? Math.max(0, Math.min(1, next / value)) : 0;
			else {
				const prev = tier ? def.tiers[tier - 1] : 0;
				progress = Math.max(0, Math.min(1, (value - prev) / (next - prev)));
			}
		}
		return { def, value, tier, next, progress };
	});
}

export interface Unlock {
	def: AchDef;
	tier: number; // indeks 0..4
}

/** Catat tingkat baru yang tercapai. Mengembalikan daftar yang baru terbuka. */
export function collectUnlocks(p: FlashcardPlugin): Unlock[] {
	const meta = p.data.meta;
	const unlocked = (meta.unlocked ??= {});
	const out: Unlock[] = [];
	const now = Date.now();
	for (const st of evaluate(p))
		for (let t = 0; t < st.tier; t++) {
			const k = `${st.def.id}:${t}`;
			if (unlocked[k]) continue;
			unlocked[k] = now;
			out.push({ def: st.def, tier: t });
		}
	return out;
}

export function recentUnlocks(p: FlashcardPlugin, n: number): (Unlock & { t: number })[] {
	const u = p.data.meta.unlocked ?? {};
	return Object.entries(u)
		.sort((a, b) => b[1] - a[1])
		.slice(0, n)
		.map(([k, t]) => {
			const [id, tier] = k.split(":");
			const def = ACHIEVEMENTS.find((d) => d.id === id);
			return def ? { def, tier: Number(tier), t } : null;
		})
		.filter((x): x is Unlock & { t: number } => !!x);
}

/** Medali melingkar dengan warna tingkat. */
export function medal(parent: HTMLElement, icon: string, tier: number, size = 56): HTMLElement {
	const m = parent.createDiv({ cls: `fch-medal t${tier}` + (tier <= 0 ? " is-locked" : "") });
	m.style.setProperty("--size", `${size}px`);
	m.createSpan({ cls: "fch-medal-ic", text: icon });
	return m;
}
