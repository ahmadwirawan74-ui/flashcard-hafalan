import { Component, ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import type FlashcardPlugin from "./main";
import { Card, StudyMode } from "./types";
import { Draft, emptyDraft } from "./parser";
import { StudySession, SessionOpts } from "./session";
import { Game, MatchGame } from "./match";
import { renderArena } from "./pages/arena";
import { renderCalendar } from "./pages/calendar";
import { renderWeak } from "./pages/weak";
import { renderGraph } from "./pages/graph";
import { examPlan } from "./analytics";
import { renderPalaces } from "./palace";
import { renderMindmap } from "./mindmap";
import { renderReport, reportReady } from "./report";
import { renderChainSetup } from "./chain";
import { mascotState } from "./missions";
import { renderFocus, resetZen } from "./pomodoro";
import { renderAdventure } from "./adventure";
import { renderTasks } from "./tasks";
import { renderNotes } from "./notes";
import { renderPlanner } from "./planner";
import { renderProjects } from "./projects";
import { renderHabits } from "./habits";
import { renderGrades } from "./grades";
import { renderReview } from "./review";
import { renderQuran, murDue, TOTAL, fromGid, openReader } from "./quran";
import { BlockModal, blocksOn } from "./studyplan";
import { FinderModal } from "./finder";
import { renderExams } from "./exams";
import { renderBossHall, weeklyBoss } from "./boss";
import { renderDungeon } from "./dungeon";
import { renderMedCalc, renderMedEmerg, renderMedHome, renderMedInter, renderMedTools } from "./medis";
import { renderMedClass, renderMedQuiz, renderMedTox } from "./medis2";
import { renderShop } from "./gear";
import { RECIPES, canCraft, discovered, renderAlchemy } from "./alchemy";
import { activeEvent, bossDoneToday, claimable, renderEvents } from "./events";
import { inGolden, renderGolden } from "./golden";
import { PackModal, chestState, renderAlbum, renderTreasure } from "./collect";
import { readingDue, renderReading } from "./reading";
import { weekKey } from "./missions";
import { examCards } from "./analytics";
import { renderMutabaah, renderDzikir } from "./ibadah";
import { renderHadits, renderAsmaul, hMurDue } from "./hadits";
import { renderRamadan } from "./ramadan";
import { renderHome } from "./pages/home";
import { renderDecks } from "./pages/decks";
import { renderStudyLauncher, renderLimit } from "./pages/launch";
import { renderCreate } from "./pages/create";
import { renderBrowse } from "./pages/browse";
import { renderStats } from "./pages/stats";
import { renderFix } from "./pages/fix";
import { renderAchievements } from "./pages/achievements";
import { TIERS, Unlock, medal } from "./achievements";
import { btn, ring } from "./util";

export const HUB_VIEW = "flashcard-hub";
export type Page = "home" | "study" | "exams" | "reading" | "shop" | "alchemy" | "event" | "golden" | "boss" | "dungeon" | "treasure" | "album" | "quran" | "mutabaah" | "dzikir" | "hadits" | "asmaul" | "ramadan" | "tasks" | "notes" | "planner" | "projects" | "habits" | "grades" | "review" | "focus" | "adventure" | "calendar" | "palace" | "decks" | "create" | "browse" | "fix" | "stats" | "report" | "weak" | "graph" | "mindmap" | "arena" | "awards" | "chain" | "play" | "med" | "medcalc" | "medinter" | "medtools" | "medemerg" | "medclass" | "medtox" | "medquiz";

/** Metadata setiap halaman: label, ikon, dan penjelasan singkat (dipakai tab & Cari menu). */
export const PAGES: Partial<Record<Page, { label: string; icon: string; desc: string }>> = {
	home: { label: "Beranda", icon: "home", desc: "Ringkasan hari ini" },
	study: { label: "Mulai belajar", icon: "graduation-cap", desc: "Pilih materi & mode, lalu belajar" },
	exams: { label: "Ujian", icon: "award", desc: "Tanggal ujian, berkas materi & peta jalan belajar" },
	reading: { label: "Bacaan", icon: "book-open-check", desc: "Membaca bertahap: artikel, bab buku & PDF dipecah per hari" },
	shop: { label: "Toko", icon: "store", desc: "Senjata, zirah, aksesori & ramuan untuk Boss dan Dungeon" },
	alchemy: { label: "Bengkel", icon: "flask-conical", desc: "Racik bahan dungeon menjadi ramuan & perlengkapan khusus" },
	event: { label: "Event", icon: "party-popper", desc: "Event musiman: boss bertema, misi, token & hadiah terbatas" },
	golden: { label: "Jam Emas", icon: "sun", desc: "Jam belajar terbaikmu & jadwal materi tersulit" },
	boss: { label: "Aula Boss", icon: "skull", desc: "Boss mingguan & boss setiap materi" },
	dungeon: { label: "Dungeon", icon: "door-open", desc: "Petualangan lantai demi lantai penuh soal & harta" },
	treasure: { label: "Harta Karun", icon: "gem", desc: "Peti harian & peta harta karun mingguan" },
	album: { label: "Album", icon: "layers", desc: "Kartu koleksi tokoh ilmuwan & pahlawan" },
	decks: { label: "Materi", icon: "library", desc: "Semua materi & progresnya" },
	create: { label: "Buat kartu", icon: "plus-circle", desc: "Tambah flashcard baru" },
	browse: { label: "Semua kartu", icon: "search", desc: "Cari, saring & edit kartu" },
	fix: { label: "Perbaiki", icon: "wrench", desc: "Kartu yang ditandai perlu diperbaiki" },
	focus: { label: "Ruang Fokus", icon: "timer", desc: "Pomodoro, musik & stopwatch" },
	tasks: { label: "Tugas", icon: "check-square", desc: "To-do, prioritas & pengingat" },
	planner: { label: "Jadwal", icon: "clock", desc: "Rencana harian, jadwal belajar & pelajaran" },
	calendar: { label: "Kalender", icon: "calendar-days", desc: "Semua agenda dalam satu kalender" },
	projects: { label: "Proyek", icon: "kanban", desc: "Papan Kanban & rencana ujian" },
	habits: { label: "Kebiasaan", icon: "repeat", desc: "Centang harian & streak" },
	notes: { label: "Catatan", icon: "sticky-note", desc: "Catatan, template & jurnal" },
	grades: { label: "Nilai", icon: "medal", desc: "Nilai, rata-rata & target" },
	quran: { label: "Al-Qur'an", icon: "book-open", desc: "Tilawah, khatam, hafalan & murajaah" },
	mutabaah: { label: "Mutaba'ah", icon: "list-checks", desc: "Sholat & amalan harian" },
	dzikir: { label: "Dzikir & Tasbih", icon: "circle-dot", desc: "Dzikir pagi-petang & tasbih digital" },
	hadits: { label: "Hadits & Doa", icon: "scroll", desc: "Arbain, 100 hadits Muslim & doa harian" },
	asmaul: { label: "Asmaul Husna", icon: "star", desc: "99 nama Allah & kuis" },
	ramadan: { label: "Ramadan", icon: "moon", desc: "Puasa, tarawih, sedekah & khatam" },
	arena: { label: "Arena", icon: "gamepad-2", desc: "Minigame, boss & toko tema" },
	adventure: { label: "Petualangan", icon: "map", desc: "Peta level materi" },
	palace: { label: "Istana Ingatan", icon: "landmark", desc: "Teknik memory palace" },
	awards: { label: "Prestasi", icon: "trophy", desc: "Lencana & level" },
	stats: { label: "Analitik", icon: "bar-chart-2", desc: "Grafik & kurva lupa" },
	report: { label: "Laporan mingguan", icon: "line-chart", desc: "Rangkuman minggu ini" },
	weak: { label: "Kelemahan", icon: "target", desc: "Kartu & topik yang sering salah" },
	review: { label: "Review mingguan", icon: "compass", desc: "Refleksi & rencana minggu depan" },
	graph: { label: "Peta pengetahuan", icon: "network", desc: "Graf hubungan materi" },
	mindmap: { label: "Peta pikiran", icon: "git-fork", desc: "Kartu tersusun menurut heading" },
	med: { label: "Obat", icon: "pill", desc: "Database obat: dosis, cara pakai, kontraindikasi, kehamilan, interaksi" },
	medcalc: { label: "Kalkulator dosis", icon: "calculator", desc: "Dosis dewasa & anak berdasarkan BB, usia, ginjal; mL & tablet" },
	medinter: { label: "Interaksi", icon: "zap", desc: "Cek interaksi & duplikasi beberapa obat sekaligus" },
	medtools: { label: "Kalkulator klinis", icon: "activity", desc: "CrCl, eGFR, BSA, IMT, cairan, tetesan infus, syringe pump, QTc, GCS, HPL" },
	medemerg: { label: "Kartu darurat", icon: "heart-pulse", desc: "Dosis resusitasi & kejang anak berdasarkan berat badan" },
	medclass: { label: "Farmakologi", icon: "book-open", desc: "Golongan obat: mekanisme, prototipe, efek samping, mutiara klinis" },
	medtox: { label: "Antidot", icon: "skull", desc: "Keracunan & antidot, kalkulator N-asetilsistein" },
	medquiz: { label: "Kuis obat", icon: "target", desc: "Kuis farmakologi otomatis dari database obat" },
};

/** Ruang kerja di menu kiri; halaman-halamannya tampil sebagai tab di bagian atas. */
export const WORKSPACES: { id: string; label: string; icon: string; color: string; desc: string; pages: Page[] }[] = [
	{ id: "home", label: "Beranda", icon: "home", color: "#6366f1", desc: "Hari ini", pages: ["home"] },
	{ id: "learn", label: "Belajar", icon: "graduation-cap", color: "#8b5cf6", desc: "Flashcard & fokus", pages: ["study", "exams", "reading", "decks", "create", "browse", "fix", "focus"] },
	{ id: "plan", label: "Rencana", icon: "calendar-check", color: "#0ea5e9", desc: "Tugas, jadwal & catatan", pages: ["planner", "tasks", "calendar", "projects", "habits", "notes", "grades"] },
	{ id: "ibadah", label: "Ibadah", icon: "moon-star", color: "#10b981", desc: "Al-Qur'an, sholat & dzikir", pages: ["quran", "mutabaah", "dzikir", "hadits", "asmaul", "ramadan"] },
	{ id: "play", label: "Main", icon: "gamepad-2", color: "#f59e0b", desc: "Game & prestasi", pages: ["arena", "event", "shop", "alchemy", "boss", "dungeon", "treasure", "album", "adventure", "palace", "awards"] },
	{ id: "insight", label: "Wawasan", icon: "bar-chart-2", color: "#ef4444", desc: "Analitik & refleksi", pages: ["stats", "golden", "report", "weak", "review", "graph", "mindmap"] },
	{ id: "medis", label: "Medis", icon: "stethoscope", color: "#0d9488", desc: "Obat, dosis & interaksi", pages: ["med", "medcalc", "medinter", "medtools", "medemerg", "medclass", "medtox", "medquiz"] },
];
export const wsOf = (page: Page) => WORKSPACES.find((w) => w.pages.includes(page));


export interface LaunchState {
	scope: string; // "all" | "file:<path>" | "folder:<path>"
	mode: StudyMode;
	cram: boolean;
	starred: boolean;
	interleave?: boolean;
}

export interface BrowseState {
	q: string;
	filter: string;
	path: string;
	sort: "material" | "due" | "lapses";
	limit: number;
}

export class HubView extends ItemView {
	page: Page = "home";
	session: StudySession | null = null;
	game: Game | null = null;
	draft: Draft = emptyDraft();
	createTarget = "";
	/** Sesi yang tertahan batas harian (ditampilkan di halaman Belajar). */
	limit: { cards: Card[]; opts: SessionOpts } | null = null;
	private restoreTried = false;
	ioImage?: string;
	launch: LaunchState;
	browse: BrowseState = { q: "", filter: "all", path: "", sort: "material", limit: 60 };
	pageComp: Component | null = null;
	private navEl!: HTMLElement;
	private shellEl!: HTMLElement;
	private toastEl!: HTMLElement;
	private toastQueue: (Unlock | { level: number })[] = [];
	private toasting = false;
	zen = false;
	private returnPage: Page = "arena";
	private chainPrefill?: { title: string; text: string };
	private mindPath?: string;
	mainEl!: HTMLElement;
	private pomoEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, public plugin: FlashcardPlugin) {
		super(leaf);
		this.launch = { scope: "all", mode: plugin.data.settings.defaultMode, cram: false, starred: false };
	}

	getViewType() { return HUB_VIEW; }
	getDisplayText() { return "Flashcard"; }
	getIcon() { return "layers"; }

	async onOpen() {
		const root = this.contentEl;
		root.empty();
		root.addClass("fch");
		this.applySkin();
		const shell = (this.shellEl = root.createDiv("fch-shell"));
		this.navEl = shell.createDiv("fch-nav");
		this.mainEl = shell.createDiv("fch-main");
		this.toastEl = root.createDiv("fch-toasts");
		this.register(this.plugin.pomo.subscribe(() => this.renderPomo()) as unknown as () => void);
		this.registerDomEvent(document, "keydown", (e) => this.onKey(e), true);
		this.renderNav();
		this.renderPage();
	}

	async onClose() {
		this.session?.unmount();
		this.game?.unmount();
	}

	// ---------- navigasi ----------
	/** Halaman terakhir yang dibuka di setiap ruang kerja. */
	private lastIn: Record<string, Page> = {};
	private lastWs = "home";

	navigate(page: Page) {
		if (page !== "study") this.limit = null;
		this.page = page;
		const ws = wsOf(page);
		if (ws) { this.lastIn[ws.id] = page; this.lastWs = ws.id; }
		this.renderNav();
		this.renderPage();
	}

	refresh() {
		if (!this.navEl) return;
		this.renderNav();
		// jangan menggambar ulang saat pengguna sedang mengetik
		const a = document.activeElement as HTMLElement | null;
		if (a && this.mainEl.contains(a) && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT")) return;
		const live = (this.page === "study" && this.session) || this.page === "play" || this.page === "focus" || this.page === "notes" || this.page === "create" || this.page === "graph" || this.page === "palace" || this.page === "chain" || this.page === "report";
		if (!live) {
			const top = this.mainEl.scrollTop;
			this.renderPage();
			this.mainEl.scrollTop = top;
		}
	}

	private renderNav() {
		const nav = this.navEl;
		nav.empty();
		const brand = nav.createDiv("fch-brand");
		const pet = mascotState(this.plugin);
		brand.createSpan({ cls: `fch-brand-mark mood-${pet.mood}`, text: pet.stage.icon, attr: { "aria-label": `${pet.name}: ${pet.msg}` } });
		brand.createSpan({ cls: "fch-brand-name", text: "Hafalan" });

		const find = nav.createEl("button", { cls: "fch-find-btn", attr: { "aria-label": "Cari menu & aksi (Ctrl/Cmd+K)" } });
		setIcon(find.createSpan("fch-nav-ic"), "search");
		find.createSpan({ cls: "fch-nav-label", text: "Cari menu…" });
		find.createSpan({ cls: "fch-kbd fch-nav-label", text: "Ctrl K" });
		find.onclick = () => this.openFinder();

		const curWs = wsOf(this.page) ?? WORKSPACES.find((x) => x.id === this.lastWs);
		const list = nav.createDiv("fch-nav-list fch-ws-list");
		for (const ws of WORKSPACES) {
			if (ws.id === "medis" && !this.plugin.data.settings.medis) continue;
			const item = list.createEl("button", { cls: "fch-nav-item fch-ws-item" + (curWs?.id === ws.id ? " is-active" : ""), attr: { "aria-label": `${ws.label} — ${ws.desc}` } });
			item.style.setProperty("--ws", ws.color);
			setIcon(item.createSpan("fch-nav-ic fch-ws-ic"), ws.icon);
			const t = item.createSpan("fch-nav-label fch-ws-txt");
			t.createSpan({ cls: "fch-ws-name", text: ws.label });
			t.createSpan({ cls: "fch-ws-desc", text: ws.desc });
			const n = ws.pages.reduce((a, pg) => a + (this.badge(pg)?.n ?? 0), 0);
			const warn = ws.pages.some((pg) => this.badge(pg)?.warn);
			if (ws.id === "learn" && this.session && !this.session.done) item.createSpan({ cls: "fch-nav-dot", attr: { "aria-label": "Sesi berjalan" } });
			else if (n) item.createSpan({ cls: "fch-nav-count" + (warn ? " is-warn" : ""), text: n > 99 ? "99+" : String(n) });
			else if (ws.pages.some((pg) => this.badge(pg)?.dot)) item.createSpan({ cls: "fch-nav-dot is-new" });
			item.onclick = () => this.navigate(this.lastIn[ws.id] && ws.pages.includes(this.lastIn[ws.id]) ? this.lastIn[ws.id] : ws.pages[0]);
		}

		const foot = nav.createDiv("fch-nav-foot");
		const lv = this.plugin.level();
		const prof = foot.createEl("button", { cls: "fch-profile", attr: { "aria-label": `Level ${lv.level} · ${lv.xp} XP — lihat prestasi` } });
		const r = ring(prof, lv.into / lv.need, 40, String(lv.level), "fch-profile-ring");
		r.style.setProperty("--fch-ring-bg", "var(--fch-surface)");
		const pt = prof.createDiv("fch-profile-txt");
		pt.createDiv({ cls: "fch-profile-title", text: lv.title });
		pt.createDiv({ cls: "fch-profile-xp", text: `🪙 ${(this.plugin.data.meta.coins ?? 0).toLocaleString("id-ID")} · ${lv.need - lv.into} XP lagi` });
		prof.onclick = () => this.navigate("awards");
		this.pomoEl = foot.createDiv("fch-pomo");
		this.renderPomo();
		const STYLES = [["retro-web", "Retro Web", "monitor"], ["retro-console", "Retro Konsol", "gamepad-2"], ["lounge", "Lounge Gamer", "flame"], ["modern", "Modern", "sparkles"]] as const;
		const cur = STYLES.findIndex((x) => x[0] === this.plugin.data.settings.uiStyle);
		const sty = foot.createEl("button", { cls: "fch-nav-item fch-style-btn", attr: { "aria-label": "Ganti gaya tampilan" } });
		setIcon(sty.createSpan("fch-nav-ic"), STYLES[Math.max(0, cur)][2]);
		sty.createSpan({ cls: "fch-nav-label", text: `Gaya: ${STYLES[Math.max(0, cur)][1]}` });
		sty.onclick = () => void this.plugin.setUiStyle(STYLES[(Math.max(0, cur) + 1) % STYLES.length][0]);
		const set = foot.createEl("button", { cls: "fch-nav-item", attr: { "aria-label": "Pengaturan" } });
		setIcon(set.createSpan("fch-nav-ic"), "settings");
		set.createSpan({ cls: "fch-nav-label", text: "Pengaturan" });
		set.onclick = () => this.openSettings();
	}

	/** Angka/titik pemberitahuan untuk sebuah halaman. */
	badge(page: Page): { n?: number; warn?: boolean; dot?: boolean } | null {
		const p = this.plugin;
		const k = new Date();
		const key = `${k.getFullYear()}-${String(k.getMonth() + 1).padStart(2, "0")}-${String(k.getDate()).padStart(2, "0")}`;
		switch (page) {
			case "study": { const w = p.waitingToday(); return w.due + w.fresh ? { n: w.due + w.fresh } : null; }
			case "tasks": { const n = p.data.tasks.filter((t) => !t.done && t.due && t.due <= key).length; return n ? { n } : null; }
			case "planner": { const n = blocksOn(p, key).filter((b) => !b.log[key]).length; return n ? { n } : null; }
			case "fix": { const n = p.fixCount(); return n ? { n, warn: true } : null; }
			case "quran": { const n = murDue(p).length; return n ? { n } : null; }
			case "hadits": { const n = hMurDue(p).filter((x) => !x.startsWith("n:")).length; return n ? { n } : null; }
			case "report": return reportReady(p) ? { dot: true } : null;
			case "album": return p.data.collect.packs ? { n: p.data.collect.packs } : null;
			case "event": { const o = activeEvent(p); if (!o) return null; const c = claimable(p, o); return c ? { n: c } : !bossDoneToday(p, o) ? { dot: true } : null; }
			case "alchemy": { const n = RECIPES.filter((r) => discovered(p, r) && canCraft(p, r).ok).length; return n ? { n } : null; }
			case "golden": return inGolden(p) ? { dot: true } : null;
			case "treasure": { const c = chestState(p); return c.ready && !c.opened ? { dot: true } : null; }
			case "reading": { const n = readingDue(p).length; return n ? { n } : null; }
			case "boss": return weeklyBoss(p) && !p.data.collect.granted.includes(`boss:week:${weekKey()}`) ? { dot: true } : null;
			case "exams": { const n = p.data.exams.filter((e) => { const d = Math.round((new Date(e.date + "T00:00:00").getTime() - new Date(key + "T00:00:00").getTime()) / 86400000); return d >= 0 && d <= 14; }).length; return n ? { n } : null; }
			default: return null;
		}
	}

	/** Bilah tab ruang kerja + aksi utama, tampil di atas setiap halaman. */
	private renderWsBar(el: HTMLElement) {
		const ws = wsOf(this.page);
		if (!ws || ws.pages.length < 2) return;
		if (this.page === "play") return;
		// Selama sesi belajar berjalan, bilah tab tetap tampil (ringkas) agar bisa pindah ke Ujian, Materi, dll.
		const inSession = !!(this.session && !this.session.done);
		const bar = el.createDiv("fch-wsbar" + (inSession && this.page === "study" ? " is-compact" : ""));
		bar.style.setProperty("--ws", ws.color);
		const head = bar.createDiv("fch-wsbar-head");
		const ic = head.createSpan("fch-wsbar-ic");
		setIcon(ic, ws.icon);
		head.createSpan({ cls: "fch-wsbar-title", text: ws.label });
		head.createDiv("fch-grow");
		const acts = head.createDiv("fch-wsbar-acts");
		for (const a of this.wsActions(ws.id)) btn(acts, { text: a.text, icon: a.icon, label: a.text, cls: "fch-btn-sm" + (a.primary ? " fch-btn-primary" : ""), onClick: a.run });
		const tabs = bar.createDiv("fch-wsbar-tabs");
		for (const pg of ws.pages) {
			const m = PAGES[pg]!;
			const t = tabs.createEl("button", { cls: "fch-wstab" + (this.page === pg ? " is-active" : ""), attr: { "aria-label": m.desc } });
			setIcon(t.createSpan("fch-wstab-ic"), m.icon);
			t.createSpan({ text: m.label });
			if (pg === "study" && inSession) { t.createSpan({ cls: "fch-wstab-live", text: "● sesi berjalan" }); t.setAttr("aria-label", "Lanjutkan sesi yang sedang berjalan"); }
			const b = this.badge(pg);
			if (b?.n) t.createSpan({ cls: "fch-wstab-n" + (b.warn ? " is-warn" : ""), text: String(b.n) });
			else if (b?.dot) t.createSpan({ cls: "fch-nav-dot is-new" });
			t.onclick = () => this.navigate(pg);
		}
		window.setTimeout(() => (tabs.querySelector(".is-active") as HTMLElement | null)?.scrollIntoView({ inline: "center", block: "nearest" }), 0);
	}

	/** Aksi utama per ruang kerja: selalu satu klik dari halaman mana pun di dalamnya. */
	private wsActions(id: string): { text: string; icon: string; primary?: boolean; run: () => void }[] {
		const p = this.plugin;
		const w = p.waitingToday();
		switch (id) {
			case "learn": return [
				{ text: w.due + w.fresh ? `Mulai belajar (${w.due + w.fresh})` : "Latihan bebas", icon: "play", primary: true, run: () => { if (!this.startSession(p.allCards(), { title: "Semua materi", cram: !(w.due + w.fresh), mode: p.data.settings.defaultMode })) this.navigate("study"); } },
				{ text: "Kartu baru", icon: "plus", run: () => this.navigate("create") },
			];
			case "plan": return [
				{ text: "Tugas", icon: "plus", run: () => { this.navigate("tasks"); window.setTimeout(() => (this.mainEl.querySelector(".fch-quickadd input") as HTMLInputElement | null)?.focus(), 50); } },
				{ text: "Jadwal belajar", icon: "calendar-plus", primary: true, run: () => new BlockModal(this.app, p, () => this.renderPage()).open() },
			];
			case "ibadah": return [
				{ text: "Lanjut tilawah", icon: "book-open", primary: true, run: () => { const g = p.data.quran.last ? Math.min(TOTAL, p.data.quran.last.g + 1) : 1; openReader(fromGid(g)[0], g); this.navigate("quran"); } },
				{ text: "Tasbih", icon: "circle-dot", run: () => this.navigate("dzikir") },
			];
			case "play": return [
				{ text: "Boss mingguan", icon: "swords", primary: true, run: () => this.navigate("boss") },
				{ text: `Toko · 🪙 ${(p.data.meta.coins ?? 0).toLocaleString("id-ID")}`, icon: "store", run: () => this.navigate("shop") },
				{ text: `Bungkus kartu (${p.data.collect.packs})`, icon: "gift", run: () => { if (p.data.collect.packs) new PackModal(this.app, p, () => this.renderPage()).open(); else this.navigate("album"); } },
			];
			case "insight": return [{ text: "Review mingguan", icon: "compass", primary: true, run: () => this.navigate("review") }];
			case "medis": return [
				{ text: "Kalkulator dosis", icon: "calculator", primary: true, run: () => this.navigate("medcalc") },
				{ text: "Cek interaksi", icon: "zap", run: () => this.navigate("medinter") },
				{ text: "Kuis obat", icon: "target", run: () => this.navigate("medquiz") },
			];
			default: return [];
		}
	}

	openFinder() {
		new FinderModal(this.app, this).open();
	}

	openSettings() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const setting = (this.app as any).setting;
		setting?.open();
		setting?.openTabById(this.plugin.manifest.id);
	}

	/** Pulihkan sesi yang belum selesai (mis. setelah Obsidian ditutup). */
	private maybeRestore() {
		if (this.restoreTried || this.session || !this.plugin.index.size) return;
		this.restoreTried = true;
		const saved = this.plugin.data.lastSession;
		if (!saved || Date.now() - saved.t > 20 * 3600_000) return;
		const byId = new Map(this.plugin.allCards().map((c) => [c.id, c]));
		const queue = saved.ids.slice(saved.idx).map((id) => byId.get(id)).filter((c): c is Card => !!c);
		if (!queue.length) return;
		const source = saved.paths.flatMap((x) => this.plugin.index.get(x) ?? []);
		this.session = new StudySession(this, queue, { title: saved.title, cram: saved.cram, mode: saved.mode, test: saved.test, examId: saved.examId }, source, saved.done);
	}

	renderPage(): void {
		this.maybeRestore();
		this.session?.unmount();
		this.game?.unmount();
		if (this.pageComp) this.removeChild(this.pageComp);
		this.pageComp = this.addChild(new Component());
		const el = this.mainEl;
		el.empty();
		el.scrollTop = 0;
		if (this.page !== "focus") { this.containerEl.removeClass("fch-zen-focus"); resetZen(); }
		this.renderWsBar(el);
		const page = el.createDiv("fch-page fch-page-" + this.page);
		switch (this.page) {
			case "home": return renderHome(this, page);
			case "decks": return renderDecks(this, page);
			case "create": return renderCreate(this, page);
			case "browse": return renderBrowse(this, page);
			case "fix": return renderFix(this, page);
			case "awards": return renderAchievements(this, page);
			case "stats": return renderStats(this, page);
			case "study":
				if (this.session) return this.session.mount(page);
				if (this.limit) return renderLimit(this, page, this.limit.cards, this.limit.opts);
				return renderStudyLauncher(this, page);
			case "arena": return renderArena(this, page);
			case "boss": return renderBossHall(this, page);
			case "shop": return renderShop(this, page);
			case "alchemy": return renderAlchemy(this, page);
			case "event": return renderEvents(this, page);
			case "golden": return renderGolden(this, page);
			case "dungeon": return renderDungeon(this, page);
			case "treasure": return renderTreasure(this, page);
			case "album": return renderAlbum(this, page);
			case "reading": return renderReading(this, page);
			case "play":
				if (this.game) return this.game.mount(page);
				this.page = this.returnPage;
				return this.renderPage();
			case "palace": return renderPalaces(this, page);
			case "focus": return renderFocus(this, page);
			case "tasks": return renderTasks(this, page);
			case "planner": return renderPlanner(this, page);
			case "projects": return renderProjects(this, page);
			case "habits": return renderHabits(this, page);
			case "grades": return renderGrades(this, page);
			case "review": return renderReview(this, page);
			case "quran": return renderQuran(this, page);
			case "exams": return renderExams(this, page);
			case "mutabaah": return renderMutabaah(this, page);
			case "dzikir": return renderDzikir(this, page);
			case "hadits": return renderHadits(this, page);
			case "asmaul": return renderAsmaul(this, page);
			case "ramadan": return renderRamadan(this, page);
			case "notes": return void renderNotes(this, page);
			case "adventure": return renderAdventure(this, page);
			case "mindmap": return renderMindmap(this, page, this.mindPath);
			case "report": return renderReport(this, page);
			case "chain": {
				const pre = this.chainPrefill;
				this.chainPrefill = undefined;
				return renderChainSetup(this, page, pre);
			}
			case "calendar": return renderCalendar(this, page);
			case "weak": return renderWeak(this, page);
			case "graph": return renderGraph(this, page);
			case "med": return renderMedHome(this, page);
			case "medcalc": return renderMedCalc(this, page);
			case "medinter": return renderMedInter(this, page);
			case "medtools": return renderMedTools(this, page);
			case "medemerg": return renderMedEmerg(this, page);
			case "medclass": return renderMedClass(this, page);
			case "medtox": return renderMedTox(this, page);
			case "medquiz": return renderMedQuiz(this, page);
		}
	}

	// ---------- sesi ----------
	cardsForScope(scope: string, starred = false): Card[] {
		const p = this.plugin;
		let cards: Card[];
		if (scope.startsWith("exam:")) { const ex = p.data.exams.find((e) => e.id === scope.slice(5)); cards = ex ? examCards(p, ex) : []; }
		else if (scope.startsWith("file:")) cards = p.index.get(scope.slice(5)) ?? [];
		else if (scope.startsWith("folder:")) cards = p.pathsInFolder(scope.slice(7)).flatMap((x) => p.index.get(x) ?? []);
		else cards = p.allCards();
		return starred ? cards.filter((c) => p.data.cards[c.id]?.starred) : cards;
	}

	startSession(cards: Card[], opts: SessionOpts): boolean {
		const exam = opts.examId ? this.plugin.data.exams.find((e) => e.id === opts.examId) : undefined;
		const newCap = exam ? Math.max(this.plugin.newLeftToday(), examPlan(this.plugin, exam).remaining) : undefined;
		const q = opts.exact ? [...cards] : this.plugin.buildQueue(cards, opts.cram, { order: opts.interleave ? "interleave" : undefined, newCap });
		if (!q.length) {
			if (opts.cram) {
				new Notice("Tidak ada kartu untuk diulas.");
				return false;
			}
			// Tidak ada kartu: entah karena batas harian, atau memang semuanya sudah beres.
			this.session?.unmount();
			this.session = null;
			this.limit = { cards, opts };
			this.navigate("study");
			return false;
		}
		this.limit = null;
		this.session?.unmount();
		this.session = new StudySession(this, q, opts, cards);
		this.navigate("study");
		return true;
	}

	setZen(on: boolean) {
		this.zen = on;
		this.shellEl?.toggleClass("is-zen", on);
	}

	endSession(to: Page = "home") {
		this.session?.unmount();
		this.session = null;
		this.limit = null;
		if (this.plugin.data.lastSession) {
			delete this.plugin.data.lastSession;
			void this.plugin.saveNow();
		}
		this.setZen(false);
		this.plugin.refreshViews();
		this.navigate(to);
	}

	startMatch(cards: Card[], title: string): boolean {
		const ok = this.startGame(new MatchGame(this, cards, title));
		if (!ok) new Notice("Butuh minimal 3 kartu berjawaban singkat untuk bermain Cocokkan.");
		return ok;
	}

	startGame(game: Game): boolean {
		if (!game.ok) return false;
		this.game?.unmount();
		if (this.page !== "play") this.returnPage = this.page;
		this.game = game;
		this.navigate("play");
		return true;
	}

	endGame() {
		this.game?.unmount();
		this.game = null;
		this.navigate(this.returnPage);
	}

	openChain(prefill?: { title: string; text: string }) {
		this.chainPrefill = prefill;
		this.navigate("chain");
	}

	openMindmap(path?: string) {
		this.mindPath = path;
		this.navigate("mindmap");
	}

	applySkin() {
		const root = this.contentEl;
		[...root.classList].filter((c) => c.startsWith("fch-skin-")).forEach((c) => root.removeClass(c));
		root.addClass(`fch-skin-${this.plugin.data.settings.skin || "default"}`);
	}

	// ---------- keyboard ----------
	private onKey(e: KeyboardEvent) {
		if (this.app.workspace.getActiveViewOfType(HubView) !== this) return;
		if (document.querySelector(".modal-container, .menu, .suggestion-container")) return;
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); e.stopPropagation(); this.openFinder(); return; }
		if (this.page === "study" && this.session) this.session.onKey(e);
	}

	// ---------- pomodoro (widget di menu) ----------
	private renderPomo() {
		const el = this.pomoEl;
		if (!el) return;
		const P = this.plugin.pomo;
		el.empty();
		el.toggleClass("is-break", P.phase !== "work");
		el.toggleClass("is-running", P.running);
		el.style.setProperty("--p", String(1 - P.left / P.total()));
		const info = el.createDiv("fch-pomo-info");
		info.createSpan({ cls: "fch-pomo-mode", text: P.label() + (P.today() ? ` · ${P.today()}🍅` : "") });
		info.createSpan({ cls: "fch-pomo-time", text: P.clock() });
		info.onclick = () => this.navigate("focus");
		info.setAttr("aria-label", "Buka Ruang Fokus");
		const ctr = el.createDiv("fch-pomo-ctr");
		const playB = ctr.createEl("button", { cls: "clickable-icon", attr: { "aria-label": P.running ? "Jeda" : "Mulai fokus" } });
		setIcon(playB, P.running ? "pause" : "play");
		playB.onclick = () => P.toggle();
		const full = ctr.createEl("button", { cls: "clickable-icon" + (P.musicOn ? " is-active" : ""), attr: { "aria-label": P.musicOn ? "Hentikan musik" : "Putar musik latar" } });
		setIcon(full, P.musicOn ? "volume-2" : "music");
		full.onclick = () => { if (P.musicOn) P.stopMusicNow(); else P.playMusicNow(); };
	}

	// ---------- notifikasi prestasi ----------
	toast(u: Unlock | { level: number }) {
		this.toastQueue.push(u);
		if (!this.toasting) this.nextToast();
	}

	private nextToast() {
		const u = this.toastQueue.shift();
		if (!u || !this.toastEl) {
			this.toasting = false;
			return;
		}
		this.toasting = true;
		const t = this.toastEl.createDiv("fch-toast");
		if ("level" in u) {
			const m = t.createDiv({ cls: "fch-medal t5 fch-toast-medal" });
			m.style.setProperty("--size", "52px");
			m.createSpan({ cls: "fch-medal-ic fch-medal-num", text: String(u.level) });
			const tx = t.createDiv();
			tx.createDiv({ cls: "fch-toast-kicker", text: "Naik level!" });
			tx.createDiv({ cls: "fch-toast-name", text: `Level ${u.level} · ${this.plugin.level().title}` });
		} else {
			medal(t, u.def.icon, u.tier + 1, 52).addClass("fch-toast-medal");
			const tx = t.createDiv();
			tx.createDiv({ cls: "fch-toast-kicker", text: `Prestasi ${TIERS[u.tier]}` });
			tx.createDiv({ cls: "fch-toast-name", text: u.def.name });
			tx.createDiv({ cls: "fch-toast-goal", text: u.def.goal(u.def.tiers[u.tier]) });
		}
		t.onclick = () => this.navigate("awards");
		window.setTimeout(() => t.addClass("is-out"), 3600);
		window.setTimeout(() => {
			t.remove();
			this.nextToast();
		}, 4000);
		this.renderNav();
	}
}
