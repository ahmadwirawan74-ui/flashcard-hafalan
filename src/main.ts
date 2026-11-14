import { Editor, MarkdownView, Notice, Plugin, TAbstractFile, TFile, TFolder, debounce, getAllTags, normalizePath } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { Card, CardState, DailyStat, DEFAULT_SETTINGS, Flag, Grade, Occlusion, PluginData, StoredCard, StudyMode, StudyOrder, UiStyle } from "./types";
import { decaying } from "./analytics";
import { OcclusionModal, imageOnLine, isImagePath, letterOf } from "./occlusion";
import { lineOf } from "./anchor";
import { TIERS, Unlock, collectUnlocks } from "./achievements";
import { extractSource, clozeOf, cleanLine, locate, newStoredId, storedToCard } from "./anchor";
import { CardModal, NewCard } from "./card-modal";
import { markExtension, refreshMarks } from "./editor-marks";
import { PracticeModal, addViewActions, closePopover, noteCardExtension, noteCards, openNoteModal } from "./note-cards";
import { DraftKind, ID_SEP, normalizeTag, parseCards, pathOfId } from "./parser";
import { DAY, dayKey, endOfDay, isNewState, newState, retention, startOfDay } from "./scheduler";
import { HubView, HUB_VIEW, Page } from "./hub-view";
import { Pomodoro } from "./pomodoro";
import { registerEmbed } from "./embed";
import { checkReminders } from "./tasks";
import { checkClassReminders } from "./planner";
import { BlockModal, checkBlockReminders } from "./studyplan";
import { collectTick, grantPack } from "./collect";
import { applyEventTheme } from "./events";
import { CaptureModal } from "./capture";
import { StatusBar } from "./statusbar";
import { TableModal, tableAt } from "./table";
import { configureSound, play, stopMusic } from "./sound";
import { FlashcardSettingTab } from "./settings";
import { plainText, shuffle } from "./util";
import { quizOptions } from "./learn";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export { TEMPLATES } from "./templates";
import { TEMPLATES } from "./templates";

export interface Counts {
	total: number;
	fresh: number;
	due: number;
	mature: number;
	retention: number | null;
}

export default class FlashcardPlugin extends Plugin {
	data!: PluginData;
	index = new Map<string, Card[]>();
	storedIndex = new Map<string, StoredCard[]>();
	pomo!: Pomodoro;
	statusBar: StatusBar | null = null;
	occIndex = new Map<string, Occlusion[]>();
	requestSave: () => void = () => {};
	refreshViews: () => void = () => {};
	private pending = new Set<string>();
	private flushPending: () => void = () => {};

	async onload() {
		await this.loadAll();
		this.requestSave = debounce(() => void this.saveData(this.data), 800, true);
		this.refreshViews = debounce(() => this.doRefresh(), 250, true);
		this.flushPending = debounce(() => void this.processPending(), 400, true);

		this.rebuildStoredIndex();
		this.applyUiStyle();
		this.applySound();
		this.pomo = new Pomodoro(this);
		this.registerInterval(window.setInterval(() => this.pomo.tick(), 1000));
		this.registerInterval(window.setInterval(() => { checkReminders(this); checkClassReminders(this); checkBlockReminders(this); this.statusBar?.update(); this.applyEventTheme(); }, 30_000));
		window.setTimeout(() => { checkReminders(this); checkBlockReminders(this); }, 3000);
		this.app.workspace.onLayoutReady(() => {
			this.statusBar = new StatusBar(this);
			let last = 0;
			this.pomo.subscribe(() => { const n = Date.now(); if (n - last > 900) { last = n; this.statusBar?.update(); } });
		});
		this.registerView(HUB_VIEW, (leaf) => new HubView(leaf, this));
		registerEmbed(this);
		this.registerEditorExtension(markExtension(this));
		this.registerEditorExtension(noteCardExtension(this));
		// tombol “Flashcard di catatan ini” di bilah atas setiap catatan (juga di mode baca)
		this.registerEvent(this.app.workspace.on("layout-change", () => addViewActions(this)));
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => { addViewActions(this); closePopover(); }));
		this.app.workspace.onLayoutReady(() => { addViewActions(this); this.applyEventTheme(); });
		this.addRibbonIcon("layers", "Buka Flashcard", () => void this.openHub());


		this.addCommands();
		this.addSettingTab(new FlashcardSettingTab(this.app, this));

		// Menu klik kanan di editor: sisipkan kartu (seperti menu "Flashcards")
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, info) => {
				const file = info.file ?? null;
				menu.addItem((i) => i.setTitle("FLASHCARDS").setIsLabel(true).setSection("flashcards"));
				if (file) {
					const from = editor.posToOffset(editor.getCursor("from")), to = editor.posToOffset(editor.getCursor("to"));
					const range = { from, to, lineFrom: editor.getCursor("from").line, lineTo: editor.getCursor("to").line };
					const here = noteCards(this, file, editor.getValue(), range);
					if (here.length) menu.addItem((i) => i.setTitle(`Latih ${here.length} kartu di ${from === to ? "baris ini" : "seleksi"}`).setIcon("play").setSection("flashcards")
						.onClick(() => new PracticeModal(this.app, this, here, `Kartu di ${from === to ? "baris ini" : "seleksi"}`, here.length > 1).open()));
					if (this.index.get(file.path)?.length) menu.addItem((i) => i.setTitle("Pratinjau semua kartu di catatan ini").setIcon("layers").setSection("flashcards")
						.onClick(() => void openNoteModal(this, file)));
				}
				const hit = file ? this.storedAt(editor, file.path) : null;
				if (hit) {
					menu.addItem((i) => i.setTitle("Edit flashcard ini").setIcon("pencil").setSection("flashcards")
						.onClick(() => this.editStored(hit)));
					menu.addItem((i) => i.setTitle("Hapus flashcard ini").setIcon("trash-2").setSection("flashcards")
						.onClick(() => this.deleteStored(hit)));
				}
				for (const t of TEMPLATES)
					menu.addItem((i) => i.setTitle(t.label).setIcon(t.icon).setSection("flashcards")
						.onClick(() => this.fromEditor(editor, file, t.kind)));
				const lineTxt = editor.getSelection().trim() || editor.getLine(editor.getCursor().line).replace(/^\s*[-*]\s*(\[.\]\s*)?/, "").trim();
				if (lineTxt && lineTxt.length < 200)
					menu.addItem((i) => i.setTitle("Jadikan tugas").setIcon("check-square").setSection("flashcards")
						.onClick(async () => {
							const { addTask } = await import("./tasks");
							const t = addTask(this, lineTxt);
							if (t) { if (file) t.notes = `Dari catatan [[${file.basename}]]`; new Notice(`✅ Tugas ditambahkan: ${t.title}`); }
						}));
				const tbl = tableAt(editor);
				if (tbl && file)
					menu.addItem((i) => i.setTitle(`Kartu dari tabel (${tbl.rows.length} baris)`).setIcon("table").setSection("flashcards")
						.onClick(() => new TableModal(this.app, this, file.path, tbl).open()));
				const selText = editor.getSelection().trim();
				if (selText.split(/\s+/).length >= 6)
					menu.addItem((i) => i.setTitle("Rantai Hafalan (teks panjang)").setIcon("link").setSection("flashcards")
						.onClick(async () => { const hub = await this.openHub(); hub.openChain({ title: file ? file.basename : "Teks", text: selText }); }));
			}),
		);

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFile && this.index.has(file.path)) {
					menu.addItem((i) => i.setTitle("Belajar flashcard catatan ini").setIcon("graduation-cap")
						.onClick(() => void this.studyPaths([file.path], { title: file.basename })));
					menu.addItem((i) => i.setTitle("Cram flashcard catatan ini").setIcon("zap")
						.onClick(() => void this.studyPaths([file.path], { title: file.basename, cram: true })));
				} else if (file instanceof TFile && isImagePath(file.path)) {
					menu.addItem((i) => i.setTitle("Buat Image Occlusion").setIcon("image")
						.onClick(() => {
							const active = this.app.workspace.getActiveFile();
							this.openOcclusion(active?.extension === "md" ? active.path : this.sortedPaths()[0] ?? "", file.path);
						}));
				} else if (file instanceof TFolder) {
					const paths = this.pathsInFolder(file.path);
					if (paths.length)
						menu.addItem((i) => i.setTitle(`Belajar flashcard folder (${paths.length} materi)`).setIcon("graduation-cap")
							.onClick(() => void this.studyPaths(paths, { title: file.name || "Vault" })));
				}
			}),
		);

		this.app.workspace.onLayoutReady(async () => {
			await this.reindexAll();
			const first = !this.data.meta.achInit;
			this.data.meta.achInit = true;
			this.checkAchievements(first);
			window.setTimeout(() => this.checkDecay(), 4000);
			this.registerInterval(window.setInterval(() => this.checkDecay(), 3 * 3600_000));
			this.registerEvent(this.app.metadataCache.on("changed", (f) => this.queue(f.path)));
			this.registerEvent(this.app.vault.on("delete", (f) => {
				if (this.index.delete(f.path)) this.refreshViews();
			}));
			this.registerEvent(this.app.vault.on("rename", (f, old) => this.handleRename(f, old)));
		});
	}

	/** Hiasan tampilan selama event musiman. */
	applyEventTheme() { applyEventTheme(this); }

	onunload() {
		closePopover();
		document.body.removeClass("fch-ev-on", "fch-ev-pahlawan", "fch-ev-hutri", "fch-ev-hijriah", "fch-ev-ramadan", "fch-ev-hardiknas", "fch-ev-santri");
		document.body.removeClass("fch-retro-on", "fch-ui-retro-web", "fch-ui-retro-console", "fch-lounge-on");
		stopMusic();
		void this.saveData(this.data);
	}

	// ---------- data ----------
	async loadAll() {
		const raw = (await this.loadData()) ?? {};
		const settings = Object.assign({}, DEFAULT_SETTINGS, raw.settings);
		if (raw.settings?.typeAnswer && !raw.settings?.defaultMode) settings.defaultMode = "type";
		this.data = { settings, cards: raw.cards ?? {}, daily: raw.daily ?? {}, meta: raw.meta ?? {}, stored: raw.stored ?? {}, flags: raw.flags ?? {}, mnemo: raw.mnemo ?? {}, occlusions: raw.occlusions ?? {}, lastSession: raw.lastSession,
			exams: raw.exams ?? [], partial: raw.partial ?? {}, palaces: raw.palaces ?? [], chains: raw.chains ?? [], tasks: raw.tasks ?? [],
			classes: raw.classes ?? [], grades: raw.grades ?? [], targets: raw.targets ?? {}, habits: raw.habits ?? [], projects: raw.projects ?? [], studyLog: raw.studyLog ?? [],
			blocks: raw.blocks ?? [],
			collect: { owned: {}, packs: 1, dust: 0, opened: 0, claimed: [], granted: [], ...(raw.collect ?? {}) },
			reading: raw.reading ?? [],
			med: raw.med,
			events: { tokens: {}, spent: {}, claimed: [], bossWins: {}, bossDay: {}, ...(raw.events ?? {}) },
			hero: { owned: { pensil: 1, baju: 1 }, equip: { weapon: "pensil", armor: "baju", acc: "" }, bag: { heal: 2 }, spent: 0, bought: 0, ...(raw.hero ?? {}) },
			ibadah: { muta: {}, items: [], hafal: {}, mur: {}, murLog: {}, dzikir: {}, tasbih: { total: 0, day: {} }, city: "Jakarta", adj: [0, 0, 0, 0, 0, 0, 0, 0], hijriOffset: 0, ...(raw.ibadah ?? {}), ramadan: { mode: "auto", fast: {}, tarawih: {}, sedekah: {}, sedekahTarget: 1000000, nights: {}, ...(raw.ibadah?.ramadan ?? {}) } },
			quran: { pos: 0, khatam: 0, khatamDates: [], bookmarks: [], read: {}, target: 4, hafal: {}, hafalLog: {}, mur: {}, murLog: {}, ziyadah: 5, font: 30, trans: true, qari: "Alafasy_128kbps", repeat: 1, ...(raw.quran ?? {}) } };
		// pindahkan hitung mundur ujian lama (satu ujian, semua materi)
		if (!raw.exams && settings.examDate) this.data.exams.push({ id: "e" + Date.now().toString(36), name: settings.examName || "Ujian", date: settings.examDate, paths: [] });
	}

	async saveNow() {
		await this.saveData(this.data);
	}

	today(): DailyStat {
		return this.data.daily[dayKey(Date.now())] ?? { reviews: 0, newCards: 0, correct: 0, ms: 0 };
	}

	recordReview(grade: Grade, wasNew: boolean, ms: number) {
		const d = (this.data.daily[dayKey(Date.now())] ??= { reviews: 0, newCards: 0, correct: 0, ms: 0 });
		d.reviews++;
		if (wasNew) d.newCards++;
		if (grade > 0) d.correct++;
		d.ms += Math.min(ms, 5 * 60_000);
	}

	streak(): { current: number; best: number } {
		const days = new Set(Object.entries(this.data.daily).filter(([, v]) => v.reviews > 0).map(([k]) => k));
		let cur = 0;
		let t = Date.now();
		if (!days.has(dayKey(t))) t -= DAY;
		while (days.has(dayKey(t))) {
			cur++;
			t -= DAY;
		}
		let best = 0, run = 0, prev: number | null = null;
		for (const k of [...days].sort()) {
			const d = new Date(k + "T00:00:00").getTime();
			run = prev !== null && Math.round((d - prev) / DAY) === 1 ? run + 1 : 1;
			best = Math.max(best, run);
			prev = d;
		}
		return { current: cur, best: Math.max(best, cur) };
	}

	/** XP: 10 per jawaban benar, 4 per jawaban salah (usaha tetap dihargai). */
	xp(): number {
		let xp = 0;
		for (const d of Object.values(this.data.daily)) xp += d.correct * 10 + (d.reviews - d.correct) * 4;
		return xp + (this.data.meta.matchesPlayed ?? 0) * 15;
	}

	level(): { level: number; title: string; xp: number; into: number; need: number } {
		const xp = this.xp();
		const th = (l: number) => 50 * (l - 1) * l;
		let level = Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2);
		if (th(level + 1) <= xp) level++;
		const titles = ["Pemula", "Pelajar", "Penghafal", "Cendekia", "Ahli", "Master", "Legenda"];
		const title = titles[Math.min(titles.length - 1, Math.floor((level - 1) / 3))];
		return { level, title, xp, into: xp - th(level), need: th(level + 1) - th(level) };
	}

	accuracy(days: number): { reviews: number; correct: number } {
		let reviews = 0, correct = 0;
		for (let i = 0; i < days; i++) {
			const d = this.data.daily[dayKey(Date.now() - i * DAY)];
			if (d) {
				reviews += d.reviews;
				correct += d.correct;
			}
		}
		return { reviews, correct };
	}

	/** Terapkan gaya tampilan (Retro Web / Retro Konsol / Modern) ke tab & modal plugin. */
	applyUiStyle() {
		const st = this.data.settings.uiStyle;
		document.body.removeClass("fch-retro-on", "fch-ui-retro-web", "fch-ui-retro-console", "fch-lounge-on");
		if (st === "lounge") document.body.addClass("fch-lounge-on");
		else if (st !== "modern") document.body.addClass("fch-retro-on", `fch-ui-${st}`);
	}

	applySound() {
		const s = this.data.settings;
		configureSound({ enabled: s.soundOn, sfxVol: s.sfxVolume, musicVol: s.musicVolume });
	}

	async setUiStyle(st: UiStyle) {
		this.data.settings.uiStyle = st;
		this.applyUiStyle();
		this.applySound();
		this.pomo = new Pomodoro(this);
		this.registerInterval(window.setInterval(() => this.pomo.tick(), 1000));
		await this.saveNow();
		this.refreshViews();
	}

	// ---------- prestasi ----------
	/** Periksa prestasi & naik level. silent = catat tanpa notifikasi. */
	checkAchievements(silent = false) {
		const meta = this.data.meta;
		collectTick(this);
		const news = collectUnlocks(this);
		// hadiah bungkus kartu untuk prestasi baru (dibatasi agar tidak membanjir)
		if (news.length) grantPack(this, Math.min(3, news.length), news.length > 1 ? `${news.length} prestasi baru` : "prestasi baru");
		const lv = this.level().level;
		const levelUp = meta.lastLevel !== undefined && lv > meta.lastLevel;
		meta.lastLevel = lv;
		if (news.length || levelUp) this.requestSave();
		if (silent) return;
		const hubs = this.app.workspace.getLeavesOfType(HUB_VIEW).map((l) => l.view as HubView);
		if (levelUp) play("levelup");
		else if (news.length) play("achievement");
		const show = (u: Unlock | { level: number }) => {
			if (hubs.length) hubs[0].toast(u);
			else if ("level" in u) new Notice(`👑 Naik ke Level ${u.level}!`);
			else new Notice(`🏆 Prestasi terbuka: ${u.def.icon} ${u.def.name} — ${TIERS[u.tier]}`);
		};
		if (levelUp) show({ level: lv });
		news.forEach(show);
	}

	bump(key: "perfectSessions" | "quizCorrect" | "fixedCards" | "pomodoros" | "nightSessions" | "morningSessions", n = 1) {
		this.data.meta[key] = (this.data.meta[key] ?? 0) + n;
		this.requestSave();
	}

	// ---------- perbaiki nanti ----------
	flagOf(card: Card): Flag | undefined {
		return this.data.flags[card.id];
	}

	setFlag(card: Card, flag: Flag | null) {
		if (flag) this.data.flags[card.id] = flag;
		else delete this.data.flags[card.id];
		this.requestSave();
		this.refreshViews();
	}

	/** Tandai selesai diperbaiki. */
	resolveFlag(card: Card) {
		if (this.data.flags[card.id]) {
			delete this.data.flags[card.id];
			this.bump("fixedCards");
			this.refreshViews();
			this.checkAchievements();
		}
	}

	fixCount(): number {
		let n = 0;
		for (const c of this.allCards()) if (this.data.flags[c.id] || c.orphan) n++;
		return n;
	}

	setMnemo(card: Card, text: string) {
		if (text.trim() && !this.data.mnemo[card.id]) this.track("mnemo");
		if (text.trim()) this.data.mnemo[card.id] = text.trim();
		else delete this.data.mnemo[card.id];
		this.requestSave();
	}

	// ---------- indeks ----------
	isFlashcardFile(file: TFile): boolean {
		const s = this.data.settings;
		if (file.extension !== "md") return false;
		if (s.scanAllNotes) return true;
		const folders = s.folders.split(",").map((f) => f.trim().replace(/\/$/, "")).filter(Boolean);
		if (folders.some((f) => file.path.startsWith(f + "/"))) return true;
		if (!s.tag.trim()) return false;
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return false;
		const want = normalizeTag(s.tag);
		return (getAllTags(cache) ?? []).some((t) => {
			const tl = t.toLowerCase();
			return tl === want || tl.startsWith(want + "/");
		});
	}

	async indexFile(file: TFile) {
		const stored = this.storedIndex.get(file.path) ?? [];
		const occs = this.occIndex.get(file.path) ?? [];
		const inline = file.extension === "md" && this.isFlashcardFile(file);
		if (!inline && !stored.length && !occs.length) {
			this.index.delete(file.path);
			return;
		}
		const content = await this.app.vault.cachedRead(file);
		const cards = inline ? parseCards(content, file.path, this.data.settings) : [];
		if (stored.length) {
			const lines = content.split("\n");
			for (const sc of stored) cards.push(storedToCard(sc, content, lines));
		}
		for (const o of occs) {
			const name = o.title || (o.image.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
			const k = content.indexOf(o.image.split("/").pop()!);
			const line = k >= 0 ? lineOf(content, k) : 1e9;
			o.masks.forEach((m, i) => {
				const label = m.label.trim();
				cards.push({
					id: `${o.path}${ID_SEP}io${o.id}_${m.id}`, path: o.path, line: k >= 0 ? line : 0, order: line + 0.45 + i * 1e-4,
					type: "occlusion", front: `${name} — bagian ${letterOf(i)}`, back: label || `Bagian ${letterOf(i)}`, answer: label || undefined,
					context: [], occ: { id: o.id, mask: m.id },
				});
			});
		}
		// urutkan sesuai posisi di catatan; kartu tanpa posisi di akhir
		const key = (c: Card) => (c.stored || c.occ ? c.order + 0.5 : c.line);
		const sorted = cards.map((c, i) => ({ c, i })).sort((a, b) => key(a.c) - key(b.c) || a.i - b.i).map((x, i) => ({ ...x.c, order: i }));
		if (sorted.length) this.index.set(file.path, sorted);
		else this.index.delete(file.path);
	}

	// ---------- kartu tersimpan (catatan tetap bersih) ----------
	rebuildStoredIndex() {
		this.occIndex.clear();
		for (const o of Object.values(this.data.occlusions))
			(this.occIndex.get(o.path) ?? this.occIndex.set(o.path, []).get(o.path)!).push(o);
		this.storedIndex.clear();
		for (const sc of Object.values(this.data.stored))
			(this.storedIndex.get(sc.path) ?? this.storedIndex.set(sc.path, []).get(sc.path)!).push(sc);
	}

	private async afterStoredChange(path: string) {
		this.rebuildStoredIndex();
		this.requestSave();
		const f = this.app.vault.getAbstractFileByPath(path);
		if (f instanceof TFile) await this.indexFile(f);
		this.refreshViews();
		this.refreshEditorMarks();
	}

	refreshEditorMarks() {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const cm = ((leaf.view as MarkdownView).editor as any)?.cm as EditorView | undefined;
			cm?.dispatch({ effects: refreshMarks.of(null) });
		}
	}

	/** Simpan kartu baru (atau ganti kartu yang diedit beserta pasangannya). */
	saveStored(path: string, cards: NewCard[], replace?: StoredCard): string[] {
		const now = Date.now();
		let keepState: CardState | undefined;
		let keepMnemo: string | undefined;
		let wasFlagged = false;
		if (replace) {
			const group = replace.group ? Object.values(this.data.stored).filter((x) => x.group === replace.group) : [replace];
			const mainOld = group.find((x) => x.type !== "reversed") ?? replace;
			keepState = this.data.cards[`${mainOld.path}${ID_SEP}${mainOld.id}`];
			keepMnemo = this.data.mnemo[`${mainOld.path}${ID_SEP}${mainOld.id}`];
			for (const x of group) {
				const xid = `${x.path}${ID_SEP}${x.id}`;
				if (this.data.flags[xid]) wasFlagged = true;
				delete this.data.flags[xid];
				delete this.data.mnemo[xid];
				delete this.data.stored[x.id];
				if (x !== mainOld) delete this.data.cards[xid];
			}
			delete this.data.cards[`${mainOld.path}${ID_SEP}${mainOld.id}`];
		}
		const group = cards.length > 1 ? newStoredId() : undefined;
		const ids: string[] = [];
		cards.forEach((c, i) => {
			const id = newStoredId() + i;
			ids.push(`${path}${ID_SEP}${id}`);
			this.data.stored[id] = { ...c, id, path, group, created: now + i };
			if (i === 0 && keepState) this.data.cards[`${path}${ID_SEP}${id}`] = keepState;
			if (i === 0 && keepMnemo) this.data.mnemo[`${path}${ID_SEP}${id}`] = keepMnemo;
		});
		if (wasFlagged) this.bump("fixedCards");
		void this.afterStoredChange(path).then(() => this.checkAchievements());
		return ids;
	}

	deleteStored(sc: StoredCard) {
		const group = sc.group ? Object.values(this.data.stored).filter((x) => x.group === sc.group) : [sc];
		for (const x of group) {
			const xid = `${x.path}${ID_SEP}${x.id}`;
			delete this.data.stored[x.id];
			delete this.data.cards[xid];
			delete this.data.flags[xid];
			delete this.data.mnemo[xid];
		}
		new Notice("Flashcard dihapus");
		void this.afterStoredChange(sc.path);
	}

	// ---------- variasi otomatis ----------
	/** Buat variasi dari satu kartu: kebalikan, cloze, dan pilihan ganda. Mengembalikan jumlah kartu baru. */
	makeVariations(card: Pick<Card, "id" | "path" | "type" | "front" | "back" | "answer">): number {
		if (!["basic", "multiline", "cloze"].includes(card.type)) return 0;
		const have = new Set(Object.values(this.data.stored).filter((x) => x.variantOf === card.id).map((x) => x.type));
		const q = card.front.trim(), a = (card.answer ?? card.back).trim();
		const short = plainText(a).length <= 120;
		const out: NewCard[] = [];
		if (card.type !== "cloze" && short && !have.has("reversed")) out.push({ type: "reversed", front: a, back: q, variantOf: card.id });
		if (card.type !== "cloze" && plainText(a).length <= 80 && !have.has("cloze"))
			out.push({ type: "cloze", front: `${q} → <span class="fc-cloze">[…]</span>`, back: `${q} → <span class="fc-cloze-ans">${a}</span>`, answer: plainText(a), variantOf: card.id });
		if (!have.has("mcq")) {
			const opts = quizOptions(this, card as Card, 4);
			if (opts && opts.filter((o) => o.correct).length === 1)
				out.push({ type: "mcq", front: card.type === "cloze" ? card.front : q, back: "✓ " + a, options: opts.map((o) => ({ text: plainText(o.text), correct: o.correct })), answer: plainText(a), variantOf: card.id });
		}
		for (const c of out) this.saveStored(card.path, [c]);
		return out.length;
	}

	// ---------- image occlusion ----------
	occOf(card: Card): Occlusion | undefined {
		return card.occ ? this.data.occlusions[card.occ.id] : undefined;
	}

	private occCardId = (o: Occlusion, maskId: string) => `${o.path}${ID_SEP}io${o.id}_${maskId}`;

	private dropCardData(id: string) {
		delete this.data.cards[id];
		delete this.data.flags[id];
		delete this.data.mnemo[id];
	}

	saveOcclusion(o: Occlusion) {
		const old = this.data.occlusions[o.id];
		let fixed = false;
		if (old) {
			const keep = new Set(o.masks.map((m) => m.id));
			for (const m of old.masks) {
				const oldId = this.occCardId(old, m.id);
				if (this.data.flags[oldId]) fixed = true;
				if (!keep.has(m.id)) this.dropCardData(oldId);
				else if (old.path !== o.path) {
					const nid = this.occCardId(o, m.id);
					for (const map of [this.data.cards, this.data.mnemo] as Record<string, unknown>[])
						if (map[oldId] !== undefined) { map[nid] = map[oldId]; delete map[oldId]; }
				}
				delete this.data.flags[oldId];
			}
		}
		this.data.occlusions[o.id] = { ...o, masks: o.masks.map((m) => ({ ...m, label: m.label.trim() })) };
		if (fixed) this.bump("fixedCards");
		void (async () => {
			if (!this.app.vault.getAbstractFileByPath(o.path)) await this.createMaterial(o.path, false);
			if (old && old.path !== o.path) await this.afterStoredChange(old.path);
			await this.afterStoredChange(o.path);
			this.checkAchievements();
		})();
	}

	deleteOcclusionMask(card: Card) {
		const o = this.occOf(card);
		if (!o) return;
		this.dropCardData(card.id);
		o.masks = o.masks.filter((m) => m.id !== card.occ!.mask);
		if (!o.masks.length) delete this.data.occlusions[o.id];
		new Notice("Kartu Image Occlusion dihapus");
		void this.afterStoredChange(o.path);
	}

	editOcclusion(card: Card) {
		const o = this.occOf(card);
		if (o) new OcclusionModal(this.app, this, { path: o.path, occ: o }).open();
	}

	openOcclusion(path: string, image?: string) {
		new OcclusionModal(this.app, this, { path, image }).open();
	}

	/** Edit kartu apa pun: tersimpan → modal, occlusion → editor gambar, sintaks → buka catatan. */
	editAny(card: Card) {
		const sc = this.storedOf(card);
		if (card.occ) this.editOcclusion(card);
		else if (sc) this.editStored(sc);
		else void this.openAt(card.path, card.line);
	}

	/** Lepaskan kartu dari teks sumbernya (dipakai bila teks sumber sudah berubah). */
	detachStored(sc: StoredCard) {
		const group = sc.group ? Object.values(this.data.stored).filter((x) => x.group === sc.group) : [sc];
		for (const x of group) delete x.anchor;
		void this.afterStoredChange(sc.path);
	}

	editStored(sc: StoredCard) {
		new CardModal(this.app, this, { path: sc.path, kind: "single", edit: sc }).open();
	}

	storedOf(card: Card): StoredCard | undefined {
		return card.stored ? this.data.stored[card.stored] : undefined;
	}

	/** Kartu tersimpan yang teksnya berada di bawah kursor/seleksi. */
	storedAt(editor: Editor, path: string): StoredCard | null {
		const list = (this.storedIndex.get(path) ?? []).filter((s) => s.anchor);
		if (!list.length) return null;
		const text = editor.getValue();
		const off = editor.posToOffset(editor.getCursor("from"));
		for (const sc of list) {
			const r = locate(text, sc.anchor!);
			if (r && off >= r.from && off <= r.to) return sc.group ? (list.find((x) => x.group === sc.group && x.type !== "reversed") ?? sc) : sc;
		}
		return null;
	}

	/** Dari menu klik kanan: buat kartu dari teks terpilih tanpa mengubah catatan. */
	fromEditor(editor: Editor, file: TFile | null, kind: DraftKind) {
		if (kind === "occlusion") {
			if (!file) return;
			const line = editor.getLine(editor.getCursor("from").line);
			this.openOcclusion(file.path, imageOnLine(this.app, line, file.path) ?? undefined);
			return;
		}
		if (this.data.settings.storage === "note") {
			void this.insertTemplate(editor, kind, file);
			return;
		}
		if (!file) return;
		const doc = editor.getValue();
		let from = editor.posToOffset(editor.getCursor("from"));
		let to = editor.posToOffset(editor.getCursor("to"));
		while (from < to && /\s/.test(doc[from])) from++;
		while (to > from && /\s/.test(doc[to - 1])) to--;
		const src = from < to ? extractSource(doc, from, to) : undefined;
		if (kind === "cloze" && src && !src.multiLine) {
			const { front, back } = clozeOf(src.sentence, src.sentencePos, src.selection);
			this.saveStored(file.path, [{ type: "cloze", front, back, answer: cleanLine(src.selection), anchor: { text: src.sentence, answer: src.selection, pos: src.sentencePos } }]);
			new Notice("✓ Cloze dibuat. Klik kanan pada teks bergaris untuk mengedit.");
			return;
		}
		new CardModal(this.app, this, { path: file.path, kind, source: src }).open();
	}

	async reindexAll() {
		this.index.clear();
		for (const f of this.app.vault.getMarkdownFiles()) await this.indexFile(f);
		this.refreshViews();
	}

	private queue(path: string) {
		this.pending.add(path);
		this.flushPending();
	}

	private async processPending() {
		const paths = [...this.pending];
		this.pending.clear();
		for (const p of paths) {
			const f = this.app.vault.getAbstractFileByPath(p);
			if (f instanceof TFile) await this.indexFile(f);
		}
		this.refreshViews();
		this.refreshEditorMarks();
	}

	private handleRename(file: TAbstractFile, oldPath: string) {
		const folder = file instanceof TFolder;
		const remap = (p: string): string | null =>
			folder ? (p.startsWith(oldPath + "/") ? file.path + p.slice(oldPath.length) : null) : p === oldPath ? file.path : null;
		const newId = (id: string, p: string, np: string) => np + id.slice(p.length);
		let changed = false;
		for (const map of [this.data.cards, this.data.flags, this.data.mnemo] as Record<string, unknown>[])
			for (const id of Object.keys(map)) {
				const p = pathOfId(id);
				const np = remap(p);
				if (np) {
					map[newId(id, p, np)] = map[id];
					delete map[id];
					changed = true;
				}
			}
		for (const o of Object.values(this.data.occlusions)) {
			const np = remap(o.path);
			if (np) { o.path = np; changed = true; }
			const ni = remap(o.image);
			if (ni) { o.image = ni; changed = true; }
		}
		for (const sc of Object.values(this.data.stored)) {
			const np = remap(sc.path);
			if (np) {
				sc.path = np;
				changed = true;
			}
		}
		this.rebuildStoredIndex();
		for (const [p, cards] of [...this.index]) {
			const np = remap(p);
			if (!np) continue;
			this.index.delete(p);
			this.index.set(np, cards.map((c) => ({ ...c, path: np, id: newId(c.id, p, np) })));
		}
		if (changed) this.requestSave();
		if (file instanceof TFile) this.queue(file.path);
		this.refreshViews();
	}

	cleanOrphans(): number {
		for (const sc of Object.values(this.data.stored))
			if (!this.app.vault.getAbstractFileByPath(sc.path)) delete this.data.stored[sc.id];
		for (const o of Object.values(this.data.occlusions))
			if (!this.app.vault.getAbstractFileByPath(o.path)) delete this.data.occlusions[o.id];
		this.rebuildStoredIndex();
		const live = new Set<string>();
		for (const cards of this.index.values()) for (const c of cards) live.add(c.id);
		let n = 0;
		for (const id of Object.keys(this.data.cards)) {
			if (!live.has(id)) {
				delete this.data.cards[id];
				n++;
			}
		}
		for (const map of [this.data.flags, this.data.mnemo] as Record<string, unknown>[])
			for (const id of Object.keys(map)) if (!live.has(id)) delete map[id];
		this.requestSave();
		return n;
	}

	// ---------- query ----------
	sortedPaths(): string[] {
		return [...this.index.keys()].sort((a, b) => collator.compare(a, b));
	}

	pathsInFolder(folder: string): string[] {
		const all = this.sortedPaths();
		return folder === "/" || folder === "" ? all : all.filter((p) => p.startsWith(folder + "/"));
	}

	allCards(): Card[] {
		return this.sortedPaths().flatMap((p) => this.index.get(p) ?? []);
	}

	stateOf(card: Card): CardState | undefined {
		return this.data.cards[card.id];
	}

	countFor(paths: string[]): Counts {
		const now = Date.now(), end = endOfDay(now);
		let total = 0, fresh = 0, due = 0, mature = 0, rSum = 0, rN = 0;
		for (const p of paths)
			for (const c of this.index.get(p) ?? []) {
				total++;
				const st = this.data.cards[c.id];
				if (st?.suspended) continue;
				if (isNewState(st)) {
					fresh++;
					continue;
				}
				if (st!.due <= end) due++;
				if (st!.interval >= 21) mature++;
				const r = retention(st, now);
				if (r !== null) {
					rSum += r;
					rN++;
				}
			}
		return { total, fresh, due, mature, retention: rN ? rSum / rN : null };
	}

	waitingToday(): { due: number; fresh: number } {
		const c = this.countFor(this.sortedPaths());
		return { due: c.due, fresh: Math.min(c.fresh, this.newLeftToday()) };
	}

	forecast(days: number): number[] {
		const counts = new Array(days).fill(0);
		const today = startOfDay(Date.now());
		for (const c of this.allCards()) {
			const st = this.data.cards[c.id];
			if (!st || st.suspended || isNewState(st)) continue;
			const d = Math.max(0, Math.round((startOfDay(st.due) - today) / DAY));
			if (d < days) counts[d]++;
		}
		return counts;
	}

	newLimitToday(): number {
		return this.data.settings.newPerDay + (this.today().extraNew ?? 0);
	}

	newLeftToday(): number {
		return Math.max(0, this.newLimitToday() - this.today().newCards);
	}

	revLeftToday(): number {
		const t = this.today();
		return Math.max(0, this.data.settings.maxReviewsPerDay + (t.extraRev ?? 0) - (t.reviews - t.newCards));
	}

	/** Tambah jatah kartu baru / ulasan khusus hari ini (tidak mengubah pengaturan). */
	extendToday(kind: "new" | "rev", n: number) {
		const d = (this.data.daily[dayKey(Date.now())] ??= { reviews: 0, newCards: 0, correct: 0, ms: 0 });
		if (kind === "new") d.extraNew = (d.extraNew ?? 0) + n;
		else d.extraRev = (d.extraRev ?? 0) + n;
		this.requestSave();
		this.refreshViews();
	}

	/** Berapa kartu di daftar ini yang tertahan oleh batas harian. */
	limitInfo(cards: Card[]) {
		const end = endOfDay(Date.now());
		let fresh = 0, due = 0;
		for (const c of cards) {
			const st = this.data.cards[c.id];
			if (st?.suspended) continue;
			if (isNewState(st)) fresh++;
			else if (st!.due <= end) due++;
		}
		const newLeft = this.newLeftToday(), revLeft = this.revLeftToday();
		return {
			fresh, due, newLeft, revLeft,
			newBlocked: Math.max(0, fresh - newLeft),
			revBlocked: Math.max(0, due - revLeft),
		};
	}

	avgSecondsPerCard(): number {
		let ms = 0, n = 0;
		for (const d of Object.values(this.data.daily)) {
			ms += d.ms;
			n += d.reviews;
		}
		return n >= 10 ? Math.max(3, ms / n / 1000) : 8;
	}

	/** Catat peristiwa untuk misi harian/mingguan. */
	track(event: string, n = 1, max = false) {
		const k = dayKey(Date.now());
		const log = (this.data.meta.missionLog ??= {});
		if (!log[k]) {
			log[k] = {};
			const keep = new Set(Array.from({ length: 15 }, (_, i) => dayKey(Date.now() - i * DAY)));
			for (const old of Object.keys(log)) if (!keep.has(old)) delete log[old];
		}
		const d = log[k];
		d[event] = max ? Math.max(d[event] ?? 0, n) : (d[event] ?? 0) + n;
		this.requestSave();
	}

	/** Catat dua kartu yang tertukar (dari kuis, Cocokkan, Kilat). */
	logConfusion(a: string, b: string) {
		if (a === b) return;
		const k = [a, b].sort().join("|");
		const c = (this.data.meta.confusions ??= {});
		c[k] = (c[k] ?? 0) + 1;
		const keys = Object.keys(c);
		if (keys.length > 400) for (const x of keys.sort((p, q) => c[p] - c[q]).slice(0, 100)) delete c[x];
		this.requestSave();
	}

	/** Antrean untuk sesi berwaktu: kartu paling berisiko terlupa dulu, lalu kartu baru. */
	quickQueue(minutes: number, cards: Card[] = this.allCards()): Card[] {
		const n = Math.max(3, Math.round((minutes * 60) / this.avgSecondsPerCard()));
		const now = Date.now(), end = endOfDay(now);
		const due: { c: Card; r: number }[] = [], fresh: Card[] = [];
		for (const c of cards) {
			const st = this.data.cards[c.id];
			if (st?.suspended) continue;
			if (isNewState(st)) fresh.push(c);
			else if (st!.due <= end) due.push({ c, r: retention(st, now) ?? 1 });
		}
		due.sort((a, b) => a.r - b.r);
		const q = due.map((x) => x.c).slice(0, n);
		if (q.length < n) q.push(...fresh.slice(0, Math.min(n - q.length, this.newLeftToday())));
		if (q.length < n) {
			// masih ada waktu: ulas kartu lama dengan ingatan terendah
			const rest = cards.filter((c) => !q.includes(c) && !isNewState(this.data.cards[c.id]) && !this.data.cards[c.id]?.suspended)
				.sort((a, b) => (retention(this.data.cards[a.id], now) ?? 1) - (retention(this.data.cards[b.id], now) ?? 1));
			q.push(...rest.slice(0, n - q.length));
		}
		return q;
	}

	addCoins(n: number) {
		if (n <= 0) return;
		const m = this.data.meta;
		m.coins = (m.coins ?? 0) + n;
		m.coinsTotal = (m.coinsTotal ?? 0) + n;
		this.requestSave();
	}

	bumpMeta(key: "kilatPlayed" | "susunDone" | "interleaved" | "weakSessions" | "checklistPerfect", n = 1) {
		this.data.meta[key] = (this.data.meta[key] ?? 0) + n;
		this.requestSave();
	}

	/** Peringatan ingatan memudar, paling banyak sekali sehari. */
	checkDecay(force = false) {
		const s = this.data.settings;
		if (!s.decayAlert && !force) return;
		const today = dayKey(Date.now());
		if (!force && this.data.meta.lastDecayAlert === today) return;
		const list = decaying(this);
		if (!list.length) return;
		this.data.meta.lastDecayAlert = today;
		this.requestSave();
		const top = list.slice(0, 3).map((d) => `${d.path.split("/").pop()!.replace(/\.md$/, "")} (±${Math.round(d.retention * 100)}%)`).join(", ");
		new Notice(`⚠️ Ingatan mulai memudar: ${top}. Buka tab Flashcard untuk mengulasnya.`, 12_000);
	}

	buildQueue(cards: Card[], cram: boolean, o: { order?: StudyOrder; newCap?: number } = {}): Card[] {
		const s = this.data.settings;
		const order = o.order ?? s.order;
		const rank = new Map(this.sortedPaths().map((p, i) => [p, i]));
		const byMaterial = (a: Card, b: Card) => (rank.get(a.path) ?? 0) - (rank.get(b.path) ?? 0) || a.order - b.order;
		const sorted = [...cards].sort(byMaterial);
		let q: Card[];
		if (cram) q = sorted.filter((c) => !this.data.cards[c.id]?.suspended);
		else {
			const end = endOfDay(Date.now());
			const due: Card[] = [], fresh: Card[] = [];
			for (const c of sorted) {
				const st = this.data.cards[c.id];
				if (st?.suspended) continue;
				if (isNewState(st)) fresh.push(c);
				else if (st!.due <= end) due.push(c);
			}
			q = [...due.slice(0, this.revLeftToday()), ...fresh.slice(0, o.newCap ?? this.newLeftToday())];
		}
		// kubur saudara: variasi dari kartu yang sama tidak muncul bersamaan (kecuali Cram)
		if (!cram) {
			const seen = new Set<string>();
			q = q.filter((c) => {
				const base = (c.stored && this.data.stored[c.stored]?.variantOf) || c.id;
				if (seen.has(base)) return false;
				seen.add(base);
				return true;
			});
		}
		if (order === "random") return shuffle(q);
		q.sort(byMaterial);
		if (order === "interleave") {
			// selang-seling: ambil bergiliran satu kartu dari tiap materi
			const groups = new Map<string, Card[]>();
			for (const c of q) (groups.get(c.path) ?? groups.set(c.path, []).get(c.path)!).push(c);
			const lists = [...groups.values()].map((g) => shuffle(g));
			const out: Card[] = [];
			while (out.length < q.length) for (const l of lists) if (l.length) out.push(l.shift()!);
			return out;
		}
		if (order === "shuffle-in-file") {
			const groups = new Map<string, Card[]>();
			for (const c of q) (groups.get(c.path) ?? groups.set(c.path, []).get(c.path)!).push(c);
			return [...groups.values()].flatMap((g) => shuffle(g));
		}
		return q;
	}

	toggleStar(card: Card): boolean {
		const st = this.data.cards[card.id] ?? newState(this.data.settings);
		st.starred = !st.starred;
		this.data.cards[card.id] = st;
		this.requestSave();
		return st.starred;
	}

	toggleSuspend(card: Card): boolean {
		const st = this.data.cards[card.id] ?? newState(this.data.settings);
		st.suspended = !st.suspended;
		this.data.cards[card.id] = st;
		this.requestSave();
		this.refreshViews();
		return st.suspended;
	}

	resetCard(card: Card) {
		const old = this.data.cards[card.id];
		const st = newState(this.data.settings);
		if (old?.starred) st.starred = true;
		this.data.cards[card.id] = st;
		this.requestSave();
		this.refreshViews();
	}

	// ---------- tab & sesi ----------
	async openHub(page?: Page): Promise<HubView> {
		const ws = this.app.workspace;
		let leaf = ws.getLeavesOfType(HUB_VIEW)[0];
		if (!leaf) {
			leaf = ws.getLeaf("tab");
			await leaf.setViewState({ type: HUB_VIEW, active: true });
		}
		await ws.revealLeaf(leaf);
		ws.setActiveLeaf(leaf, { focus: true });
		const view = leaf.view as HubView;
		if (page) view.navigate(page);
		return view;
	}

	async studyPaths(paths: string[], o: { title: string; cram?: boolean; mode?: StudyMode }) {
		const cards = paths.flatMap((p) => this.index.get(p) ?? []);
		if (!cards.length) {
			new Notice(`Belum ada flashcard di sini. Tambahkan tag ${this.data.settings.tag} dan kartu seperti: Pertanyaan :: Jawaban`);
			return;
		}
		const hub = await this.openHub();
		hub.startSession(cards, { title: o.title, cram: !!o.cram, mode: o.mode ?? this.data.settings.defaultMode });
	}

	async openAt(path: string, line: number) {
		const f = this.app.vault.getAbstractFileByPath(path);
		if (!(f instanceof TFile)) return;
		const ws = this.app.workspace;
		const leaf = ws.getLeavesOfType("markdown")[0] ?? ws.getLeaf("split", "vertical");
		await leaf.openFile(f, { eState: { line }, active: true });
	}

	// ---------- menulis kartu ----------
	async ensureTagged(file: TFile) {
		const s = this.data.settings;
		if (this.isFlashcardFile(file) || !s.tag.trim()) return;
		const tag = normalizeTag(s.tag).slice(1);
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const t = fm.tags;
			if (!t) fm.tags = [tag];
			else if (Array.isArray(t)) {
				if (!t.map(String).map((x) => x.toLowerCase()).includes(tag)) t.push(tag);
			} else fm.tags = [...String(t).split(/[,\s]+/).filter(Boolean), tag];
		});
	}

	async createMaterial(path: string, withTag = this.data.settings.storage === "note"): Promise<TFile> {
		const p = normalizePath(path.trim().replace(/\.md$/, "") + ".md");
		const existing = this.app.vault.getAbstractFileByPath(p);
		if (existing instanceof TFile) {
			if (withTag) await this.ensureTagged(existing);
			return existing;
		}
		const folder = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
		if (folder && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
		const tag = withTag && this.data.settings.tag.trim() ? normalizeTag(this.data.settings.tag).slice(1) : "";
		const name = p.split("/").pop()!.replace(/\.md$/, "");
		const body = (tag ? `---\ntags:\n  - ${tag}\n---\n` : "") + `# ${name}\n\n`;
		return await this.app.vault.create(p, body);
	}

	async appendToNote(path: string, markdown: string): Promise<TFile | null> {
		let f = this.app.vault.getAbstractFileByPath(path);
		if (!(f instanceof TFile)) f = await this.createMaterial(path);
		const file = f as TFile;
		await this.app.vault.process(file, (data) => data.replace(/\s+$/, "") + "\n\n" + markdown.trim() + "\n");
		await this.ensureTagged(file);
		await this.indexFile(file);
		this.queue(file.path);
		return file;
	}

	async insertTemplate(editor: Editor, kind: DraftKind, file: TFile | null) {
		if (kind === "occlusion") return this.fromEditor(editor, file, kind);
		const s = this.data.settings;
		const ms = s.multiSep || "?";
		const sel = editor.getSelection().trim();
		if (kind === "cloze") {
			if (sel) editor.replaceSelection(`{{${sel}}}`);
			else {
				const c = editor.getCursor();
				editor.replaceRange("{{jawaban}}", c);
				editor.setSelection({ line: c.line, ch: c.ch + 2 }, { line: c.line, ch: c.ch + 9 });
			}
		} else if (kind === "single") {
			const c = editor.getCursor("to");
			const line = editor.getLine(c.line);
			if (sel) editor.replaceSelection(`${sel} ${s.singleSep} `);
			else if (line.trim() && !line.includes(s.singleSep)) editor.setCursor(this.insertAt(editor, { line: c.line, ch: line.length }, ` ${s.singleSep} `));
			else if (!line.trim()) {
				editor.replaceRange(`Pertanyaan ${s.singleSep} Jawaban`, { line: c.line, ch: 0 });
				editor.setSelection({ line: c.line, ch: 0 }, { line: c.line, ch: 10 });
			} else this.insertBlock(editor, `Pertanyaan ${s.singleSep} Jawaban`, "Pertanyaan");
		} else {
			if (sel) editor.replaceSelection("");
			const q = sel || "Pertanyaan";
			const body =
				kind === "multi" ? "Jawaban"
				: kind === "list" ? "- Item pertama\n- Item kedua\n- Item ketiga"
				: "- [ ] Pilihan A\n- [x] Pilihan yang benar\n- [ ] Pilihan C\n- [ ] Pilihan D";
			this.insertBlock(editor, `${q}\n${ms}\n${body}`, sel ? (kind === "multi" ? "Jawaban" : "") : "Pertanyaan");
		}
		if (file) await this.ensureTagged(file);
	}

	private insertAt(editor: Editor, pos: { line: number; ch: number }, text: string) {
		editor.replaceRange(text, pos);
		return { line: pos.line, ch: pos.ch + text.length };
	}

	/** Sisipkan paragraf kartu dengan baris kosong di sekitarnya lalu pilih placeholder. */
	private insertBlock(editor: Editor, text: string, select: string) {
		const cur = editor.getCursor("to");
		const lineText = editor.getLine(cur.line);
		let pos: { line: number; ch: number }, prefix: string, startLine: number;
		if (lineText.trim()) {
			pos = { line: cur.line, ch: lineText.length };
			prefix = "\n\n";
			startLine = cur.line + 2;
		} else {
			pos = { line: cur.line, ch: 0 };
			const prev = cur.line > 0 ? editor.getLine(cur.line - 1) : "";
			prefix = prev.trim() ? "\n" : "";
			startLine = cur.line + (prefix ? 1 : 0);
		}
		const next = pos.line + 1 < editor.lineCount() ? editor.getLine(pos.line + 1) : "";
		const suffix = lineText.trim() ? (next.trim() ? "\n" : "") : "\n";
		editor.replaceRange(prefix + text + suffix, pos);
		const lines = text.split("\n");
		const k = select ? lines.findIndex((l) => l.includes(select)) : -1;
		if (k >= 0) {
			const ch = lines[k].indexOf(select);
			editor.setSelection({ line: startLine + k, ch }, { line: startLine + k, ch: ch + select.length });
		} else editor.setCursor({ line: startLine + lines.length - 1, ch: lines[lines.length - 1].length });
		editor.focus();
	}

	private doRefresh() {
		this.statusBar?.update();
		for (const l of this.app.workspace.getLeavesOfType(HUB_VIEW)) (l.view as HubView).refresh();
	}

	private addCommands() {
		const activeIndexed = () => {
			const f = this.app.workspace.getActiveFile();
			return f && this.index.has(f.path) ? f : null;
		};
		this.addCommand({ id: "open-hub", name: "Buka tab Flashcard", callback: () => void this.openHub("home") });
		this.addCommand({ id: "study-all", name: "Belajar semua kartu jatuh tempo", callback: () => void this.studyPaths(this.sortedPaths(), { title: "Semua materi" }) });
		this.addCommand({
			id: "study-current", name: "Belajar kartu di catatan ini",
			checkCallback: (check) => {
				const f = activeIndexed();
				if (!f) return false;
				if (!check) void this.studyPaths([f.path], { title: f.basename });
				return true;
			},
		});
		this.addCommand({
			id: "cram-current", name: "Cram: ulas semua kartu di catatan ini",
			checkCallback: (check) => {
				const f = activeIndexed();
				if (!f) return false;
				if (!check) void this.studyPaths([f.path], { title: f.basename, cram: true });
				return true;
			},
		});
		this.addCommand({
			id: "quiz-current", name: "Kuis pilihan ganda dari catatan ini",
			checkCallback: (check) => {
				const f = activeIndexed();
				if (!f) return false;
				if (!check) void this.studyPaths([f.path], { title: f.basename, cram: true, mode: "quiz" });
				return true;
			},
		});
		this.addCommand({ id: "create-card", name: "Buat kartu baru", callback: () => void this.openHub("create") });
		this.addCommand({
			id: "table-cards", name: "Buat kartu dari tabel di bawah kursor", icon: "table",
			editorCallback: (editor, ctx) => {
				const t = tableAt(editor);
				if (!t || !ctx.file) return void new Notice("Letakkan kursor di dalam tabel Markdown (minimal judul + 1 baris).");
				new TableModal(this.app, this, ctx.file.path, t).open();
			},
		});
		this.addCommand({ id: "note-cards", name: "Pratinjau & latih flashcard di catatan ini", icon: "layers", callback: () => void openNoteModal(this, this.app.workspace.getActiveFile()) });
		this.addCommand({ id: "practice-selection", name: "Latih flashcard di seleksi / baris ini", icon: "play", editorCallback: (editor, ctx) => {
			const from = editor.posToOffset(editor.getCursor("from")), to = editor.posToOffset(editor.getCursor("to"));
			void openNoteModal(this, ctx.file, { from, to, lineFrom: editor.getCursor("from").line, lineTo: editor.getCursor("to").line });
		} });
		this.addCommand({ id: "add-block", name: "Tambah jadwal belajar", icon: "calendar-plus", callback: async () => { const h = await this.openHub("planner"); new BlockModal(this.app, this, () => h.renderPage()).open(); } });
		this.addCommand({ id: "open-blocks", name: "Buka jadwal belajar", icon: "calendar-clock", callback: async () => { const sp = await import("./studyplan"); sp.setPlannerTab("blocks"); void this.openHub("planner"); } });
		this.addCommand({ id: "open-mutabaah", name: "Buka Mutaba'ah Yaumiyah", icon: "list-checks", callback: () => void this.openHub("mutabaah") });
		this.addCommand({ id: "open-tasbih", name: "Tasbih digital", icon: "circle-dot", callback: async () => { const m = await import("./ibadah"); void m; void this.openHub("dzikir"); } });
		this.addCommand({ id: "open-ramadan", name: "Buka Mode Ramadan", icon: "moon", callback: () => void this.openHub("ramadan") });
		this.addCommand({ id: "open-hadits", name: "Buka Hadits & Doa", icon: "scroll", callback: () => void this.openHub("hadits") });
		this.addCommand({ id: "open-quran", name: "Buka Al-Qur'an", icon: "book-open", callback: () => void this.openHub("quran") });
		this.addCommand({ id: "quran-continue", name: "Lanjutkan tilawah", icon: "book-open", callback: async () => { const Q = await import("./quran"); const g = this.data.quran.last ? Math.min(Q.TOTAL, this.data.quran.last.g + 1) : 1; Q.openReader(Q.fromGid(g)[0], g); void this.openHub("quran"); } });
		this.addCommand({ id: "quran-murajaah", name: "Mulai murajaah hafalan", icon: "rotate-ccw", callback: async () => { const Q = await import("./quran"); const d = Q.murDue(this); if (!d.length) return void new Notice("Tidak ada murajaah hari ini. 👍"); const h = await this.openHub("quran"); h.startGame(new Q.MurajaahGame(h, d)); } });
		this.addCommand({ id: "quick-capture", name: "Tangkap cepat (tugas / kartu / catatan)", icon: "zap", callback: () => new CaptureModal(this.app, this).open() });
		this.addCommand({ id: "weekly-review", name: "Review mingguan", icon: "compass", callback: () => void this.openHub("review") });
		this.addCommand({ id: "open-planner", name: "Buka Jadwal (rencana harian)", icon: "clock", callback: () => void this.openHub("planner") });
		this.addCommand({
			id: "stopwatch", name: "Mulai/hentikan stopwatch belajar", icon: "timer",
			callback: async () => {
				const sw = await import("./studylog");
				if (this.data.meta.stopwatch) sw.stopStopwatch(this);
				else { sw.startStopwatch(this, "Belajar mandiri"); new Notice("⏱ Stopwatch belajar dimulai. Ganti mata pelajaran di Ruang Fokus."); }
				this.refreshViews();
			},
		});
		this.addRibbonIcon("zap", "Tangkap cepat", () => new CaptureModal(this.app, this).open());
		this.addCommand({ id: "open-tasks", name: "Buka Tugas", icon: "check-square", callback: () => void this.openHub("tasks") });
		this.addCommand({ id: "open-notes", name: "Buka Catatan", icon: "sticky-note", callback: () => void this.openHub("notes") });
		this.addCommand({ id: "journal", name: "Jurnal belajar hari ini", icon: "calendar-days", callback: async () => { const { openJournal } = await import("./notes"); void openJournal(await this.openHub()); } });
		this.addCommand({
			id: "selection-to-task", name: "Jadikan teks terpilih sebagai tugas", icon: "check-square",
			editorCallback: async (editor, ctx) => {
				const { addTask } = await import("./tasks");
				const line = editor.getSelection().trim() || editor.getLine(editor.getCursor().line).replace(/^\s*[-*]\s*(\[.\]\s*)?/, "").trim();
				const t = addTask(this, line);
				if (t) { if (ctx.file) t.notes = `Dari catatan [[${ctx.file.basename}]]`; new Notice(`✅ Tugas ditambahkan: ${t.title}${t.due ? " · " + t.due : ""}`); }
			},
		});
		this.addCommand({ id: "open-focus", name: "Buka Ruang Fokus (Pomodoro & musik)", icon: "timer", callback: () => void this.openHub("focus") });
		this.addCommand({ id: "pomo-toggle", name: "Mulai/jeda Pomodoro", icon: "timer", callback: () => this.pomo.toggle() });
		this.addCommand({ id: "open-adventure", name: "Buka Peta Petualangan", icon: "map", callback: () => void this.openHub("adventure") });
		this.addCommand({
			id: "image-occlusion", name: "Buat Image Occlusion", icon: "image",
			callback: () => {
				const f = this.app.workspace.getActiveFile();
				this.openOcclusion(f?.extension === "md" ? f.path : this.sortedPaths()[0] ?? "");
			},
		});
		this.addCommand({
			id: "card-from-selection", name: "Buat flashcard dari teks terpilih", icon: "copy",
			editorCallback: (editor, ctx) => {
				const multi = editor.getSelection().includes("\n");
				const k: DraftKind = !editor.getSelection().trim() ? "single" : multi ? (/^\s*(?:[-*+]|\d+[.)])\s+/m.test(editor.getSelection()) ? "list" : "multi") : "cloze";
				if (this.data.settings.storage === "note") return void this.insertTemplate(editor, k, ctx.file ?? null);
				const doc = editor.getValue();
				const from = editor.posToOffset(editor.getCursor("from")), to = editor.posToOffset(editor.getCursor("to"));
				const file = ctx.file;
				if (!file) return;
				new CardModal(this.app, this, { path: file.path, kind: k, source: from < to ? extractSource(doc, from, to) : undefined }).open();
			},
		});
		this.addCommand({ id: "open-stats", name: "Buka statistik", callback: () => void this.openHub("stats") });
		this.addCommand({ id: "open-match", name: "Buka Arena (minigame)", callback: () => void this.openHub("arena") });
		for (const t of TEMPLATES)
			this.addCommand({
				id: `insert-${t.kind}`, name: `Sisipkan kartu ${t.label}`, icon: t.icon,
				editorCallback: (editor, ctx) => this.fromEditor(editor, ctx.file ?? null, t.kind),
			});
		this.addCommand({
			id: "reindex", name: "Pindai ulang semua flashcard",
			callback: async () => {
				await this.reindexAll();
				new Notice(`Ditemukan ${this.allCards().length} kartu di ${this.index.size} materi.`);
			},
		});
	}
}
