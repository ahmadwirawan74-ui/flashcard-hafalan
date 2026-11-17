export type Grade = 0 | 1 | 2 | 3; // Lagi, Sulit, Baik, Mudah
export type StudyOrder = "sequential" | "shuffle-in-file" | "interleave" | "random";
export type CardType = "basic" | "reversed" | "multiline" | "cloze" | "list" | "mcq" | "occlusion";
export type StudyMode = "classic" | "type" | "quiz" | "explain" | "draw";

export interface ChoiceOption {
	text: string;
	correct: boolean;
}

export type Storage = "plugin" | "note";

export type UiStyle = "retro-web" | "retro-console" | "lounge" | "modern";

export interface Settings {
	uiStyle: UiStyle;
	storage: Storage;
	markSource: boolean;
	noteCardButtons: boolean;
	cardFx: boolean;
	eventDecor: boolean;
	medis: boolean;
	tag: string;
	folders: string;
	scanAllNotes: boolean;
	singleSep: string;
	reversedSep: string;
	multiSep: string;
	enableCloze: boolean;
	newPerDay: number;
	maxReviewsPerDay: number;
	order: StudyOrder;
	startingEase: number;
	easyBonus: number;
	maxInterval: number;
	leechThreshold: number;
	defaultMode: StudyMode;
	quizChoices: number;
	showMemoryCurve: boolean;
	ttsLang: string;
	autoSpeak: boolean;
	confetti: boolean;
	dailyGoal: number;
	examName: string;
	examDate: string;
	pomodoroWork: number;
	pomodoroBreak: number;
	pomodoroLong: number;
	pomodoroEvery: number;
	pomodoroAuto: boolean;
	pomodoroMusic: string;
	pomodoroMusicBreak: boolean;
	pomodoroMusicAuto: boolean;
	soundOn: boolean;
	sfxVolume: number;
	musicVolume: number;
	adventureLock: boolean;
	notesFolder: string;
	taskReminders: boolean;
	classReminder: number;
	homeLayout: { id: string; on: boolean }[];
	/** Beranda ringkas (Study · Ibadah · Medis) */
	homeSimple: boolean;
	/** Sembunyikan menu samping di layar sempit (HP) */
	navCollapsed: boolean;
	homeCollapsed: string[];
	statusBar: Record<string, boolean>;
	checklist: boolean;
	algorithm: "fsrs" | "sm2";
	desiredRetention: number;
	decayAlert: boolean;
	decayThreshold: number;
	skin: string;
}

export const DEFAULT_SETTINGS: Settings = {
	uiStyle: "retro-web",
	storage: "plugin",
	markSource: true,
	noteCardButtons: true,
	cardFx: true,
	eventDecor: true,
	medis: true,
	tag: "#flashcards",
	folders: "",
	scanAllNotes: false,
	singleSep: "::",
	reversedSep: ":::",
	multiSep: "?",
	enableCloze: true,
	newPerDay: 20,
	maxReviewsPerDay: 200,
	order: "sequential",
	startingEase: 2.5,
	easyBonus: 1.3,
	maxInterval: 3650,
	leechThreshold: 6,
	defaultMode: "classic",
	quizChoices: 4,
	showMemoryCurve: true,
	ttsLang: "id-ID",
	autoSpeak: false,
	confetti: true,
	dailyGoal: 30,
	examName: "",
	examDate: "",
	pomodoroWork: 25,
	pomodoroBreak: 5,
	pomodoroLong: 15,
	pomodoroEvery: 4,
	pomodoroAuto: false,
	pomodoroMusic: "lofi",
	pomodoroMusicBreak: false,
	pomodoroMusicAuto: true,
	soundOn: true,
	sfxVolume: 0.5,
	musicVolume: 0.35,
	adventureLock: true,
	notesFolder: "Catatan Belajar",
	taskReminders: true,
	classReminder: 10,
	homeLayout: [],
	homeSimple: true,
	navCollapsed: false,
	homeCollapsed: [],
	statusBar: { cards: true, tasks: true, pomo: true, classes: true, quran: true, menu: true },
	checklist: true,
	algorithm: "fsrs",
	desiredRetention: 0.9,
	decayAlert: true,
	decayThreshold: 0.8,
	skin: "default",
};

export interface ReviewEntry {
	t: number;
	g: Grade;
	i: number;
}

export interface CardState {
	due: number;
	interval: number;
	ease: number;
	reps: number;
	lapses: number;
	history: ReviewEntry[];
	/** FSRS: stabilitas (hari, saat peluang ingat 90%) & kesulitan (1–10). */
	s?: number;
	d?: number;
	suspended?: boolean;
	starred?: boolean;
}

export interface Card {
	id: string;
	path: string;
	line: number;
	order: number;
	type: CardType;
	front: string;
	back: string;
	/** Jawaban tersembunyi (cloze) untuk mode ketik/kuis. */
	answer?: string;
	/** Item jawaban (kartu List). */
	items?: string[];
	/** Pilihan (kartu Multiple Choice). */
	options?: ChoiceOption[];
	explanation?: string;
	context: string[];
	/** ID kartu tersimpan (dibuat dari seleksi / tab, tidak menulis ke catatan). */
	stored?: string;
	/** Teks sumber di catatan sudah berubah/hilang. */
	orphan?: boolean;
	/** Kartu Image Occlusion: id gambar-tertutup & id kotak target. */
	occ?: { id: string; mask: string };
}

/** Kotak penutup; koordinat relatif terhadap gambar (0–1). */
export interface Mask {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	label: string;
}

/** "all" = semua kotak tertutup, tebak satu. "one" = hanya kotak target yang tertutup. */
export type OcclusionMode = "all" | "one";

export interface Occlusion {
	id: string;
	/** Catatan materi tempat kartu-kartunya dikelompokkan. */
	path: string;
	/** Path gambar di vault (atau URL). */
	image: string;
	masks: Mask[];
	mode: OcclusionMode;
	title: string;
	created: number;
}

/** Penanda posisi kartu di catatan: kalimat sumber + teks yang dipilih. */
export interface Anchor {
	text: string;
	answer: string;
	pos: number;
}

/** Kartu yang disimpan di data plugin, catatan tetap bersih. */
export interface StoredCard {
	id: string;
	path: string;
	type: CardType;
	front: string;
	back: string;
	answer?: string;
	items?: string[];
	options?: ChoiceOption[];
	explanation?: string;
	anchor?: Anchor;
	/** Kartu dua arah berbagi grup yang sama. */
	group?: string;
	/** Kartu variasi otomatis dari kartu ini. */
	variantOf?: string;
	created: number;
}

export interface DailyStat {
	reviews: number;
	newCards: number;
	correct: number;
	ms: number;
	/** Tambahan batas kartu baru / ulasan khusus hari ini. */
	extraNew?: number;
	extraRev?: number;
}

/** Sesi yang sedang berjalan, disimpan agar bisa dilanjutkan setelah Obsidian ditutup. */
export interface SavedSession {
	ids: string[];
	idx: number;
	title: string;
	cram: boolean;
	mode: StudyMode;
	paths: string[];
	done: number;
	t: number;
	test?: boolean;
	examId?: string;
}

export interface Meta {
	bestMatchMs?: number;
	matchesPlayed?: number;
	perfectSessions?: number;
	maxCombo?: number;
	quizCorrect?: number;
	fixedCards?: number;
	pomodoros?: number;
	nightSessions?: number;
	morningSessions?: number;
	/** "idPrestasi:tingkat" → waktu terbuka */
	unlocked?: Record<string, number>;
	coins?: number;
	coinsTotal?: number;
	skins?: string[];
	kilatBest?: number;
	kilatPlayed?: number;
	susunDone?: number;
	interleaved?: number;
	weakSessions?: number;
	checklistPerfect?: number;
	retentionTests?: { t: number; n: number; correct: number }[];
	lastDecayAlert?: string;
	/** Catatan aktivitas untuk misi: hari → peristiwa → jumlah. */
	missionLog?: Record<string, Record<string, number>>;
	claimed?: string[];
	petName?: string;
	lastReport?: string;
	explains?: number;
	palaceWalks?: number;
	chainsDone?: number;
	simulations?: number;
	audioCards?: number;
	missionsDone?: number;
	pomoLog?: Record<string, number>;
	pomoTask?: string;
	bossWins?: number;
	bossWeek?: string;
	confusions?: Record<string, number>;
	ghosts?: Record<string, { times: number[]; correct: number; total: number; t: number }>;
	races?: number;
	duels?: number;
	worksheets?: number;
	drawings?: number;
	quickSessions?: number;
	contrasts?: number;
	tasksDone?: number;
	notesCreated?: number;
	stopwatch?: { subject: string; start: number };
	weeklyReviews?: number;
	blocksDone?: number;
	dungeonBest?: number;
	dungeonRuns?: number;
	/** 8 penjelajahan terbaik (urut lantai). */
	dungeonLog?: { t: number; floor: number; gold: number; mode: string; daily: boolean; relics: number; dead: boolean }[];
	/** Hari ketika bonus Dungeon Harian sudah diklaim. */
	dungeonDaily?: string;
	dungeonMode?: string;
	bossDefeats?: Record<string, number>;
	palaceGuideHidden?: boolean;
	lastReview?: string;
	habitChecks?: number;
	classReminded?: Record<string, string>;
	achInit?: boolean;
	lastLevel?: number;
}

/** Tanda "perbaiki nanti" pada kartu. */
export interface Flag {
	reasons: string[];
	note: string;
	t: number;
}

/** Ujian dengan materi pilihan; target harian dihitung dari sisa kartu. */
export interface Exam {
	id: string;
	name: string;
	date: string;
	paths: string[];
	/** Jam ujian (opsional), HH:MM. */
	time?: string;
}

/** Istana ingatan: gambar denah + titik-titik (loci) yang masing-masing memuat satu kartu. */
export interface Locus { id: string; x: number; y: number; label: string; cardId: string; /** Bayangan/asosiasi yang kamu buat untuk titik ini. */ story?: string }
export interface Palace { id: string; name: string; image: string; loci: Locus[]; created: number; lastWalk?: number; lastScore?: number; walks?: number }

/** Album Koleksi & harta karun. */
export interface CollectState {
	owned: Record<string, number>;
	packs: number;
	dust: number;
	opened: number;
	claimed: string[];
	/** Kunci sumber hadiah yang sudah diberikan (mencegah hadiah ganda). */
	granted: string[];
	chestDay?: string;
	mapWeek?: string;
	mapClaimed?: boolean;
}

/** Membaca bertahap: sumber teks dipecah menjadi potongan yang dijadwalkan. */
export interface ReadingItem {
	id: string;
	title: string;
	/** Catatan di vault yang berisi teks bacaan. */
	path: string;
	/** Indeks potongan berikutnya yang akan dibaca. */
	pos: number;
	perDay: number;
	everyDays: number;
	next: string;
	words: number;
	created: number;
	log: Record<string, number>;
	done?: boolean;
	pdf?: string;
	/** Target kata per potongan. */
	size?: number;
}

/** Teks panjang untuk Rantai Hafalan. */
export interface Chain { id: string; title: string; text: string; best: number; runs: number; updated: number }

/** Tugas (to-do). due = YYYY-MM-DD, time = HH:MM. Prioritas 0 = tanpa, 1 rendah, 2 sedang, 3 tinggi. */
export type Repeat = "daily" | "weekdays" | "weekly" | "monthly";
export interface Subtask { id: string; text: string; done: boolean }
export interface Task {
	id: string;
	title: string;
	notes: string;
	due?: string;
	time?: string;
	priority: 0 | 1 | 2 | 3;
	tags: string[];
	path?: string;
	subtasks: Subtask[];
	repeat?: Repeat;
	done: boolean;
	doneAt?: number;
	created: number;
	pomos: number;
	reminded?: string;
	/** Riwayat tanggal selesai (untuk tugas berulang & kalender). */
	log?: string[];
	/** Durasi blok waktu (menit) untuk time blocking. */
	duration?: number;
	project?: string;
	status?: "todo" | "doing";
	/** Dibuat oleh Rencana Ujian Otomatis (id ujian). */
	planId?: string;
}

/** Jadwal pelajaran/kuliah mingguan. day: 0 = Minggu … 6 = Sabtu. */
export interface ClassSlot { id: string; subject: string; day: number; start: string; end: string; room: string; teacher: string; color: string; path?: string }
export interface GradeEntry { id: string; subject: string; name: string; score: number; max: number; weight: number; date: string; kind: string }
export interface Habit { id: string; name: string; icon: string; days: number[]; log: string[]; created: number }
export interface Project { id: string; name: string; color: string; deadline?: string; created: number; examId?: string; archived?: boolean }
export interface StudyLog { id: string; subject: string; start: number; ms: number; note: string }

/** Data Al-Qur'an. g = nomor ayat global 1–6236. */
export interface QuranState {
	last?: { g: number; t: number };
	/** Posisi khatam: ayat terakhir yang dibaca berurutan. */
	pos: number;
	khatam: number;
	khatamDates: string[];
	bookmarks: { g: number; note: string; t: number }[];
	read: Record<string, { ayat: number; pages: number }>;
	/** Target tilawah (halaman per hari). */
	target: number;
	khatamBy?: string;
	/** Status hafalan per ayat: 1 = sedang dihafal, 2 = hafal. */
	hafal: Record<number, 1 | 2>;
	hafalLog: Record<string, number>;
	/** Jadwal murajaah per unit "surah:halaman". */
	mur: Record<string, CardState>;
	murLog: Record<string, number>;
	ziyadah: number;
	focusSurah?: number;
	font: number;
	trans: boolean;
	qari: string;
	repeat: number;
}

/** Item Mutaba'ah: "prayer" = 0 belum / 1 sholat / 2 tepat waktu / 3 berjamaah; "count" = angka; "check" = 0/1. */
export interface MutaItem { id: string; label: string; icon: string; kind: "prayer" | "check" | "count"; max?: number; on: boolean; custom?: boolean }
export interface IbadahState {
	muta: Record<string, Record<string, number>>;
	items: MutaItem[];
	/** Status hafalan: "a:<no>" Arbain, "m:<id>" Muslim, "d:<id>" doa/dzikir, "n:<no>" Asmaul Husna. 1 = sedang, 2 = hafal. */
	hafal: Record<string, 1 | 2>;
	mur: Record<string, CardState>;
	murLog: Record<string, number>;
	dzikir: Record<string, { pagi?: boolean; petang?: boolean }>;
	tasbih: { total: number; day: Record<string, number> };
	city: string;
	customCity?: { name: string; lat: number; lng: number; tz: number };
	adj: number[];
	hijriOffset: number;
	ramadan: { mode: "auto" | "on" | "off"; fast: Record<string, number>; tarawih: Record<string, number>; sedekah: Record<string, number>; sedekahTarget: number; nights: Record<string, number> };
}

/** Jadwal belajar: sesi terjadwal untuk flashcard, catatan, hafalan, dll. */
export type BlockKind = "cards" | "note" | "tilawah" | "ziyadah" | "murajaah" | "hadits" | "asma" | "custom";
export interface StudyBlock {
	id: string;
	kind: BlockKind;
	/** cards: "all" | "file:<path>" | "folder:<path>"; note: path catatan; lainnya: kosong */
	target: string;
	title: string;
	/** Hari dalam minggu (0 = Minggu). Kosong bila jadwal sekali (pakai `date`). */
	days: number[];
	date?: string;
	/** Jadwal berulang berhenti setelah tanggal ini (mis. sehari sebelum ujian). */
	until?: string;
	time: string;
	duration: number;
	mode?: StudyMode;
	remind: boolean;
	created: string;
	/** dayKey → 1 selesai, 2 dilewati */
	log: Record<string, 1 | 2>;
	reminded?: string;
}

import type { MedState } from "./medis";

export interface PluginData {
	settings: Settings;
	cards: Record<string, CardState>;
	daily: Record<string, DailyStat>;
	meta: Meta;
	stored: Record<string, StoredCard>;
	flags: Record<string, Flag>;
	/** Mnemonik / jembatan keledai pribadi per kartu. */
	mnemo: Record<string, string>;
	occlusions: Record<string, Occlusion>;
	lastSession?: SavedSession;
	exams: Exam[];
	/** Indeks bagian kartu multi-baris yang belum hafal. */
	partial: Record<string, number[]>;
	palaces: Palace[];
	chains: Chain[];
	tasks: Task[];
	classes: ClassSlot[];
	grades: GradeEntry[];
	targets: Record<string, number>;
	habits: Habit[];
	projects: Project[];
	studyLog: StudyLog[];
	quran: QuranState;
	ibadah: IbadahState;
	blocks: StudyBlock[];
	collect: CollectState;
	reading: ReadingItem[];
	hero: HeroState;
	events: EventState;
	/** Bagian Medis: favorit, catatan, obat pribadi, data pasien. */
	med?: MedState;
}

/** Perlengkapan petualang: senjata, zirah, aksesori (level 1–5) dan ramuan di tas. */
export interface HeroState {
	owned: Record<string, number>;
	equip: { weapon: string; armor: string; acc: string };
	bag: Record<string, number>;
	spent: number;
	bought: number;
	dealDay?: string;
	/** Bahan alkimia dari dungeon & boss. */
	mats?: Record<string, number>;
	/** Bahan yang pernah didapat (membuka resep tersembunyi). */
	seenMats?: string[];
	crafted?: number;
}

/** Event musiman. */
export interface EventState {
	tokens: Record<string, number>;
	spent: Record<string, number>;
	claimed: string[];
	bossWins: Record<string, number>;
	bossDay: Record<string, string>;
}

export const TYPE_LABEL: Record<CardType, string> = {
	basic: "Single Line",
	reversed: "Dua arah",
	multiline: "Multi Line",
	cloze: "Cloze",
	list: "List",
	mcq: "Multiple Choice",
	occlusion: "Image Occlusion",
};
