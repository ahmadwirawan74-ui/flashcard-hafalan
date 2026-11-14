import { Component, Notice, setIcon } from "obsidian";
import type { HubView } from "./hub-view";
import { Card, CardState, ChoiceOption, DailyStat, Grade, StudyMode, TYPE_LABEL } from "./types";
import { dayKey, formatDuration, formatInterval, isNewState, previewInterval, retention, schedule } from "./scheduler";
import { memoryCurve } from "./charts";
import { cardFront } from "./occlusion";
import { btn, confetti, md, plainText, ring, shuffle, similarity, basename, burst, countUp } from "./util";
import { ITEM_RE } from "./parser";
import { coverage, keywords } from "./learn";
import { play } from "./sound";

export interface SessionOpts {
	title: string;
	cram: boolean;
	mode: StudyMode;
	/** Tes retensi jangka panjang: skor dicatat di akhir. */
	test?: boolean;
	examId?: string;
	interleave?: boolean;
	/** Batas waktu sesi (ms) untuk "Aku punya X menit". */
	timeLimit?: number;
	/** Pakai urutan kartu apa adanya (tanpa disaring jadwal). */
	exact?: boolean;
}
interface Stats {
	rated: number;
	correct: number;
	grades: number[];
	failed: string[];
	xp: number;
}
interface Snapshot {
	queue: Card[];
	idx: number;
	cardId: string;
	prev?: CardState;
	daily?: DailyStat;
	dayK: string;
	stats: Stats;
}
interface Choice {
	options: ChoiceOption[];
	hidden: Set<number>;
	picked: Set<number>;
	checked: boolean;
	multi: boolean;
	correct: boolean;
}

const GRADE = ["Lagi", "Sulit", "Baik", "Mudah"];
const REASONS = ["Jawaban salah", "Typo / ejaan", "Pertanyaan ambigu", "Terlalu panjang", "Kurang konteks", "Format rusak"];

/** Petunjuk bertahap: huruf awal tiap kata, sisanya disamarkan. */
export function hintOf(answer: string, level: number): string {
	return plainText(answer)
		.split(/(\s+)/)
		.map((w) => {
			if (/^\s+$/.test(w)) return w;
			const letters = [...w];
			let shown = 0;
			return letters.map((ch) => {
				if (!/[\p{L}\p{N}]/u.test(ch)) return ch;
				return shown++ < level ? ch : "·";
			}).join("");
		})
		.join("");
}
const MODE_LABEL: Record<StudyMode, string> = { classic: "Klasik", type: "Ketik jawaban", quiz: "Kuis", explain: "Jelaskan (Feynman)", draw: "Tulis tangan" };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export class StudySession {
	idx = 0;
	private revealed = false;
	private typed = "";
	private shown = 0;
	private choice: Choice | null = null;
	private flip = false;
	private hint = 0;
	private panel: "flag" | "mnemo" | null = null;
	private combo = 0;
	private maxCombo = 0;
	private busy = false;
	private counted = false;
	/** Checklist bagian kartu multi-baris: indeks yang dicentang "hafal". */
	private checks = new Set<number>();
	private manual = false;
	private requeueNext = false;
	private coinsEarned = 0;
	private flagDraft: { reasons: string[]; note: string } = { reasons: [], note: "" };
	private stats: Stats = { rated: 0, correct: 0, grades: [0, 0, 0, 0], failed: [], xp: 0 };
	private undoStack: Snapshot[] = [];
	private startTime = Date.now();
	private cardStart = Date.now();
	private el: HTMLElement | null = null;
	private comp: Component | null = null;
	private timer: number | null = null;
	private timerEl: HTMLElement | null = null;

	/** Semua kartu dalam cakupan sesi (untuk melanjutkan setelah batas harian). */
	private source: Card[];

	constructor(private hub: HubView, public queue: Card[], public opts: SessionOpts, source?: Card[], private doneBefore = 0) {
		this.source = source && source.length ? source : queue;
		this.prepare();
		this.persist();
	}

	/** Simpan posisi sesi agar bisa dilanjutkan kapan saja. */
	private persist() {
		const data = this.plugin.data;
		if (this.done) {
			if (data.lastSession) delete data.lastSession;
		} else {
			data.lastSession = {
				ids: this.queue.map((c) => c.id), idx: this.idx,
				title: this.opts.title, cram: this.opts.cram, mode: this.opts.mode,
				paths: [...new Set(this.source.map((c) => c.path))],
				done: this.doneBefore + this.stats.rated, t: Date.now(), test: this.opts.test, examId: this.opts.examId,
			};
		}
		this.plugin.requestSave();
	}

	get done() {
		return this.idx >= this.queue.length;
	}
	private get plugin() {
		return this.hub.plugin;
	}
	private get s() {
		return this.plugin.data.settings;
	}
	private get card(): Card {
		return this.queue[this.idx];
	}

	mount(el: HTMLElement) {
		this.el = el;
		this.timer = window.setInterval(() => this.tick(), 1000);
		this.draw();
		if (this.s.autoSpeak) this.speak();
	}

	unmount() {
		if (this.timer) window.clearInterval(this.timer);
		this.timer = null;
		this.comp?.unload();
		this.comp = null;
		this.el = null;
		window.speechSynthesis?.cancel();
	}

	// ---------- persiapan kartu ----------
	private prepare() {
		this.revealed = false;
		this.typed = "";
		this.shown = 0;
		this.flip = false;
		this.choice = null;
		this.hint = 0;
		this.panel = null;
		this.explainCounted = false;
		this.drawCounted = false;
		this.checks = new Set();
		this.manual = this.opts.mode === "explain" || this.opts.mode === "draw";
		this.drawing = "";
		this.cardStart = Date.now();
		if (this.source) this.persist();
		if (this.done) return;
		const c = this.card;
		if (c.type === "mcq" && c.options) {
			const options = shuffle(c.options.map((o) => ({ ...o })));
			this.choice = { options, hidden: new Set(), picked: new Set(), checked: false, multi: options.filter((o) => o.correct).length > 1, correct: false };
		} else if (this.opts.mode === "quiz" && c.type !== "list" && (c.type !== "occlusion" || c.answer)) this.choice = this.buildQuiz(c);
	}

	private buildQuiz(card: Card): Choice | null {
		const answerOf = (c: Card) => c.answer ?? c.back;
		const key = (t: string) => plainText(t).toLowerCase();
		const correct = answerOf(card);
		const seen = new Set([key(correct), key(card.front)]);
		const isCloze = card.type === "cloze";
		const pool = this.plugin.allCards().filter((c) => c.id !== card.id && c.type !== "mcq" && c.type !== "list" && (c.type !== "occlusion" || !!c.answer));
		const rankOf = (c: Card) => (c.path === card.path ? 0 : 3) + (c.type === card.type ? 0 : (c.type === "cloze") === isCloze ? 1 : 2);
		const ordered = shuffle(pool).sort((a, b) => rankOf(a) - rankOf(b));
		const ds: string[] = [];
		for (const c of ordered) {
			const a = answerOf(c);
			const k = key(a);
			if (!k || seen.has(k)) continue;
			seen.add(k);
			ds.push(a);
			if (ds.length >= Math.max(1, this.s.quizChoices - 1)) break;
		}
		if (!ds.length) return null;
		const options = shuffle([{ text: correct, correct: true }, ...ds.map((t) => ({ text: t, correct: false }))]);
		return { options, hidden: new Set(), picked: new Set(), checked: false, multi: false, correct: false };
	}

	// ---------- keyboard ----------
	onKey(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && this.opts.mode === "explain" && !this.revealed && !this.done) {
			e.preventDefault();
			e.stopPropagation();
			this.reveal();
			return;
		}
		if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
		const t = e.target as HTMLElement | null;
		const inInput = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
		const stop = () => {
			e.preventDefault();
			e.stopPropagation();
		};
		if (this.done) {
			if (e.key === "Enter") {
				stop();
				this.hub.endSession();
			}
			return;
		}
		if (this.busy) return;
		if (e.key === "Escape" && this.panel) return stop(), this.openPanel(null);
		if (this.panel) return;
		if (!inInput) {
			const k = e.key.toLowerCase();
			if (k === "u") return stop(), this.undo();
			if (k === "s") return stop(), this.speak();
			if (k === "e") return stop(), this.edit();
			if (k === "f") return stop(), this.star();
			if (k === "p") return stop(), this.openPanel("flag");
			if (k === "h") return stop(), this.giveHint();
			if (k === "m" && this.revealed) return stop(), this.openPanel("mnemo");
			if (k === "z") return stop(), this.hub.setZen(!this.hub.zen), this.draw();
			if (k === "v") return stop(), this.variations();
		}
		const ch = this.choice;
		if (ch) {
			if (!ch.checked) {
				const n = parseInt(e.key, 10);
				if (!inInput && n >= 1 && n <= ch.options.length && !ch.hidden.has(n - 1)) return stop(), this.pick(n - 1);
				if (e.key === "Enter" && ch.multi && ch.picked.size) return stop(), this.check();
			} else if (e.key === "Enter" || (e.key === " " && !inInput)) {
				stop();
				this.rate(ch.correct ? 2 : 0);
			}
			return;
		}
		if (this.card.type === "list" && !this.revealed) {
			if (e.key === " " && !inInput) return stop(), this.showNext();
			if (e.key === "Enter") return stop(), this.showAll();
			return;
		}
		if (!this.revealed) {
			if (inInput && t?.tagName === "TEXTAREA") return;
			if (e.key === "Enter" || (e.key === " " && !inInput)) {
				stop();
				this.reveal();
			}
			return;
		}
		const parts = this.checklistParts();
		if (parts && !this.manual && !inInput) {
			const n = parseInt(e.key, 10);
			if (n >= 1 && n <= Math.min(9, parts.length)) return stop(), this.toggleCheck(n - 1);
			if (e.key.toLowerCase() === "a") return stop(), this.checkAll();
			if (e.key === "Enter" || e.key === " ") return stop(), this.submitChecklist();
			return;
		}
		const map: Record<string, Grade> = this.opts.cram
			? { "1": 0, "2": 2, " ": 2, Enter: 2 }
			: { "1": 0, "2": 1, "3": 2, "4": 3, " ": 2, Enter: 2 };
		if (e.key in map && !inInput) {
			stop();
			this.rate(map[e.key]);
		}
	}

	// ---------- tampilan ----------
	private drawing = "";
	private timeUp = false;

	private tick() {
		const lim = this.opts.timeLimit;
		if (lim) {
			const left = lim - (Date.now() - this.startTime);
			if (left <= 0 && !this.timeUp && !this.done) {
				this.timeUp = true;
				new Notice("⏰ Waktu habis! Selesaikan kartu ini, lalu sesi berakhir.", 5000);
				play("chime");
			}
			this.timerEl?.setText(left > 0 ? `⏳ ${formatDuration(left)}` : "⏰ waktu habis");
			this.timerEl?.toggleClass("is-low", left < 60_000);
			return;
		}
		this.timerEl?.setText(formatDuration(Date.now() - this.startTime));
	}

	private render(el: HTMLElement, text: string) {
		md(this.hub.app, this.comp!, el, text, this.card?.path ?? "");
	}

	private draw() {
		const root = this.el;
		if (!root) return;
		this.comp?.unload();
		this.comp = new Component();
		this.comp.load();
		root.empty();
		if (this.done) return this.drawSummary(root);

		const card = this.card;
		const st = this.plugin.stateOf(card);
		const fx = this.fxOn();
		const wrap = root.createDiv("fch-study" + (fx ? " fx" : ""));
		if (fx) { const bg = wrap.createDiv("fch-fx-bg"); for (let i = 0; i < 3; i++) bg.createDiv(`fch-fx-blob b${i}`); }

		// ---- bilah atas
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Jeda (sesi tetap tersimpan)", onClick: () => this.hub.navigate("home") });
		const tt = top.createDiv("fch-study-title");
		tt.createDiv({ cls: "fch-study-name", text: this.opts.title });
		const tags = tt.createDiv("fch-study-tags");
		tags.createSpan({ cls: "fch-tag", text: MODE_LABEL[this.opts.mode] });
		if (this.opts.cram) tags.createSpan({ cls: "fch-tag fch-tag-warn", text: "Cram · jadwal tidak berubah" });
		const meta = top.createDiv("fch-study-meta");
		if (this.combo >= 3) meta.createDiv({ cls: "fch-combo" + (this.combo >= 10 ? " is-hot" : ""), text: `⚡ ${this.combo}`, attr: { "aria-label": `Combo ${this.combo} jawaban benar berturut-turut` } });
		const score = meta.createDiv("fch-score");
		score.createSpan({ cls: "fch-score-ok", text: `✓ ${this.stats.correct}` });
		score.createSpan({ cls: "fch-score-bad", text: `✗ ${this.stats.rated - this.stats.correct}` });
		this.timerEl = meta.createSpan({ cls: "fch-timer" });
		this.tick();
		btn(meta, { icon: this.hub.zen ? "minimize-2" : "maximize-2", cls: "fch-btn-ghost fch-tool", label: this.hub.zen ? "Keluar mode fokus (Z)" : "Mode fokus (Z)", onClick: () => { this.hub.setZen(!this.hub.zen); this.draw(); } });

		const prog = wrap.createDiv("fch-prog");
		const bar = prog.createDiv("fch-bar");
		const pct = (this.idx / this.queue.length) * 100;
		bar.createDiv("fch-bar-fill").style.width = `${pct}%`;
		for (const m of [25, 50, 75]) { const mk = bar.createDiv("fch-prog-mark" + (pct >= m ? " is-hit" : "")); mk.style.left = `${m}%`; }
		prog.createSpan({ cls: "fch-prog-txt", text: `${this.idx + 1} / ${this.queue.length}` + (this.doneBefore ? ` · ${this.doneBefore} sebelumnya` : "") });

		// ---- kartu
		const left = this.queue.length - this.idx;
		const stage = wrap.createDiv("fch-stage" + (left > 2 ? " stack-2" : left > 1 ? " stack-1" : ""));
		const cardEl = stage.createDiv("fch-card" + (this.flip ? " is-flip" : "") + (this.revealed ? " is-revealed" : "") + (this.enter && fx ? ` is-enter ${this.lastGrade === 0 ? "from-bad" : "from-good"}` : ""));
		this.flip = false;
		this.enter = false;
		if (fx && window.matchMedia?.("(pointer: fine)").matches) {
			cardEl.addEventListener("pointermove", (e) => {
				const r = cardEl.getBoundingClientRect();
				cardEl.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 6}deg`);
				cardEl.style.setProperty("--rx", `${-((e.clientY - r.top) / r.height - 0.5) * 6}deg`);
				cardEl.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
				cardEl.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
			});
			cardEl.addEventListener("pointerleave", () => { cardEl.style.setProperty("--rx", "0deg"); cardEl.style.setProperty("--ry", "0deg"); });
		}

		const head = cardEl.createDiv("fch-card-head");
		head.createSpan({ cls: `fch-type fch-type-${card.type}`, text: TYPE_LABEL[card.type] });
		if (isNewState(st)) head.createSpan({ cls: "fch-type fch-type-new", text: "Baru" });
		else if (st && st.lapses >= this.s.leechThreshold) head.createSpan({ cls: "fch-type fch-type-leech", text: "Sering lupa" });
		const flag = this.plugin.flagOf(card);
		if (flag) head.createSpan({ cls: "fch-type fch-type-flag", text: "🚩 Perlu diperbaiki", attr: { "aria-label": [...flag.reasons, flag.note].filter(Boolean).join(" · ") || "Ditandai" } });
		const crumb = head.createDiv("fch-crumb");
		crumb.setText([basename(card.path), ...card.context].join("  ›  "));
		const starBtn = head.createEl("button", { cls: "fch-star clickable-icon" + (st?.starred ? " is-on" : ""), attr: { "aria-label": "Tandai kartu (F)" } });
		setIcon(starBtn, "star");
		starBtn.onclick = () => this.star();

		const short = (t: string) => !t.includes("\n") && t.length < 140;
		const body = cardEl.createDiv("fch-card-body" + ((short(card.front) && short(card.back) && !this.choice && card.type !== "list") || card.occ ? " is-short" : ""));
		const occ = this.plugin.occOf(card);
		if (occ && card.occ) {
			cardFront(this.plugin, this.comp ?? this.plugin, body, card, { revealed: this.revealed });
		} else {
			const front = body.createDiv("fch-face fch-front markdown-rendered");
			this.render(front, this.revealed && card.type === "cloze" && !this.choice ? card.back : card.front);
		}

		if (this.hint && !this.revealed && !this.choice && (card.type !== "occlusion" || card.answer)) {
			const target = card.type === "list" ? card.items?.[this.shown] ?? "" : card.answer ?? card.back;
			const h = body.createDiv("fch-hintline");
			h.createSpan({ cls: "fch-hint-label", text: "💡" });
			h.createSpan({ cls: "fch-hint-text", text: hintOf(target, this.hint) });
		}

		const actions = wrap.createDiv("fch-actions");

		if (this.choice) this.drawChoice(body, actions, this.choice);
		else if (card.type === "list") this.drawList(body, actions, card, st);
		else this.drawClassic(body, actions, card, st);

		if (this.revealed) {
			const mn = this.plugin.data.mnemo[card.id];
			if (mn && this.panel !== "mnemo") {
				const box = body.createDiv("fch-mnemo");
				box.createSpan({ cls: "fch-mnemo-label", text: "🧠 Jembatan keledai" });
				box.createDiv({ cls: "fch-mnemo-text", text: mn });
				box.onclick = () => this.openPanel("mnemo");
			}
		}
		if (this.panel) this.drawPanel(stage, card);

		if (this.revealed && this.s.showMemoryCurve && st && st.history.length) {
			const det = wrap.createEl("details", { cls: "fch-curve" });
			const r = retention(st, Date.now()) ?? 0;
			const sum = det.createEl("summary");
			sum.createSpan({ text: "Kurva memori kartu ini" });
			sum.createSpan({ cls: "fch-muted", text: `peluang ingat ±${Math.round(r * 100)}% · ${st.history.length}× diulas · ${st.lapses}× lupa` });
			det.open = true;
			memoryCurve(det.createDiv("fch-curve-wrap"), st);
		}

		const tools = wrap.createDiv("fch-tools");
		const tool = (ic: string, label: string, fn: () => void, disabled = false) =>
			btn(tools, { icon: ic, cls: "fch-btn-ghost fch-tool", label, disabled, onClick: fn });
		if (!this.revealed) tool("lightbulb", "Petunjuk huruf awal (H)", () => this.giveHint());
		tool("flag", this.plugin.flagOf(card) ? "Ubah tanda perbaiki (P)" : "Tandai untuk diperbaiki nanti (P)", () => this.openPanel("flag"));
		if (this.revealed) tool("message-square-plus", "Tulis mnemonik (M)", () => this.openPanel("mnemo"));
		tool("volume-2", "Bacakan (S)", () => this.speak());
		tool("undo", "Batalkan nilai terakhir (U)", () => this.undo(), !this.undoStack.length);
		tool("skip-forward", "Lewati, taruh di akhir", () => this.skip());
		tool("pause", "Tangguhkan kartu ini", () => this.suspend());
		if (["basic", "multiline", "cloze"].includes(card.type) && !(card.stored && this.plugin.data.stored[card.stored]?.variantOf))
			tool("copy-plus", "Buat variasi otomatis: kebalikan, cloze, pilihan ganda (V)", () => this.variations());
		tool("pencil", card.stored || card.occ ? "Edit kartu (E)" : "Edit di catatan (E)", () => this.edit());
		if (card.stored && !card.orphan) tool("file-text", "Lihat di catatan", () => void this.plugin.openAt(card.path, card.line));
	}

	private drawClassic(body: HTMLElement, actions: HTMLElement, card: Card, st: CardState | undefined) {
		const typeMode = this.opts.mode === "type";
		const explain = this.opts.mode === "explain";
		const drawMode = this.opts.mode === "draw";
		if (!this.revealed) {
			if (drawMode) {
				this.drawCanvas(body);
				const b = btn(actions, { text: "Bandingkan dengan jawaban", icon: "eye", cls: "fch-btn-primary fch-btn-xl", onClick: () => this.reveal() });
				b.createSpan({ cls: "fch-kbd", text: "Spasi" });
				return;
			}
			if (explain) {
				const ta = body.createEl("textarea", { cls: "fch-input fch-explain-input", attr: { rows: "5", placeholder: "Jelaskan konsep ini dengan kata-katamu sendiri, seolah mengajari teman…" } });
				ta.value = this.typed;
				ta.oninput = () => (this.typed = ta.value);
				window.setTimeout(() => ta.focus(), 30);
				const b = btn(actions, { text: "Periksa penjelasanku", icon: "sparkles", cls: "fch-btn-primary fch-btn-xl", onClick: () => this.reveal() });
				b.createSpan({ cls: "fch-kbd", text: "Ctrl+Enter" });
				return;
			}
			if (typeMode) {
				const input = body.createEl("input", { type: "text", cls: "fch-type-input", attr: { placeholder: "Ketik jawabanmu, lalu tekan Enter" } });
				input.value = this.typed;
				input.oninput = () => (this.typed = input.value);
				window.setTimeout(() => input.focus(), 30);
			}
			const b = btn(actions, { text: "Tampilkan jawaban", cls: "fch-btn-primary fch-btn-xl", onClick: () => this.reveal() });
			b.createSpan({ cls: "fch-kbd", text: typeMode ? "Enter" : "Spasi" });
			return;
		}
		if (explain) return this.drawExplain(body, actions, card, st);
		if (drawMode) {
			const cmp = body.createDiv("fch-draw-compare");
			const a = cmp.createDiv("fch-draw-col");
			a.createDiv({ cls: "fch-draw-label", text: "Tulisanmu" });
			if (this.drawing) a.createEl("img", { attr: { src: this.drawing, alt: "Tulisanmu" } });
			else a.createDiv({ cls: "fch-muted fch-small", text: "(kosong)" });
			const b = cmp.createDiv("fch-draw-col");
			b.createDiv({ cls: "fch-draw-label", text: "Jawaban" });
			this.render(b.createDiv("fch-face fch-back markdown-rendered fch-draw-answer"), card.type === "cloze" ? card.back : card.answer ?? card.back);
			if (!this.drawCounted) { this.drawCounted = true; this.plugin.data.meta.drawings = (this.plugin.data.meta.drawings ?? 0) + 1; }
			this.drawGrades(actions, st, null);
			return;
		}
		const parts = this.checklistParts();
		if (parts && !this.manual) {
			body.createDiv("fch-divider");
			this.drawChecklist(body, actions, parts);
			return;
		}
		if (card.type !== "cloze" && card.type !== "occlusion") {
			body.createDiv("fch-divider");
			this.render(body.createDiv("fch-face fch-back markdown-rendered"), card.back);
		}
		let suggest: Grade | null = null;
		if (typeMode && this.typed.trim()) {
			const sim = similarity(this.typed, card.answer ?? card.back);
			suggest = sim >= 0.9 ? 2 : sim >= 0.6 ? 1 : 0;
			const box = body.createDiv("fch-typed " + (sim >= 0.9 ? "is-good" : sim >= 0.6 ? "is-mid" : "is-bad"));
			ring(box, sim, 42, `${Math.round(sim * 100)}`);
			const tx = box.createDiv();
			tx.createDiv({ cls: "fch-muted", text: "Jawabanmu" });
			tx.createDiv({ text: this.typed });
		}
		this.drawGrades(actions, st, suggest);
	}

	private drawList(body: HTMLElement, actions: HTMLElement, card: Card, st: CardState | undefined) {
		const items = card.items ?? [];
		const parts = this.checklistParts();
		if (parts && !this.manual) {
			this.drawChecklist(body, actions, parts);
			return;
		}
		const ol = body.createEl("ol", { cls: "fch-list" });
		items.forEach((it, i) => {
			const li = ol.createEl("li", { cls: i < this.shown ? "is-shown" : "is-locked" });
			if (i < this.shown) this.render(li, it);
			else li.createSpan({ cls: "fch-list-blank", text: `Item ${i + 1}` });
		});
		if (!this.revealed) {
			const row = actions.createDiv("fch-row");
			const next = btn(row, { text: `Ungkap item ${this.shown + 1}`, cls: "fch-btn-primary fch-btn-xl", onClick: () => this.showNext() });
			next.createSpan({ cls: "fch-kbd", text: "Spasi" });
			const all = btn(row, { text: "Ungkap semua", cls: "fch-btn-xl", onClick: () => this.showAll() });
			all.createSpan({ cls: "fch-kbd", text: "Enter" });
			return;
		}
		this.drawGrades(actions, st, null);
	}

	private drawChoice(body: HTMLElement, actions: HTMLElement, ch: Choice) {
		const card = this.card;
		if (ch.multi && !ch.checked) body.createDiv({ cls: "fch-hint", text: "Bisa lebih dari satu jawaban benar." });
		const list = body.createDiv("fch-choices");
		ch.options.forEach((o, i) => {
			let cls = "fch-choice";
			if (ch.picked.has(i)) cls += " is-picked";
			if (ch.checked && o.correct) cls += " is-correct";
			if (ch.checked && ch.picked.has(i) && !o.correct) cls += " is-wrong";
			if (ch.hidden.has(i) && !ch.checked) cls += " is-elim";
			const b = list.createEl("button", { cls });
			b.createSpan({ cls: "fch-choice-key", text: String(i + 1) });
			this.render(b.createDiv("fch-choice-text markdown-rendered"), o.text);
			if (ch.checked && (o.correct || ch.picked.has(i))) setIcon(b.createSpan("fch-choice-mark"), o.correct ? "check" : "x");
			b.disabled = ch.checked || (ch.hidden.has(i) && !ch.checked);
			b.onclick = () => this.pick(i);
		});
		if (!ch.checked) {
			if (ch.multi) btn(actions, { text: "Periksa jawaban", cls: "fch-btn-primary fch-btn-xl", disabled: !ch.picked.size, onClick: () => this.check() });
			else actions.createDiv({ cls: "fch-hint fch-center", text: "Pilih jawaban, atau tekan angka 1–" + ch.options.length });
			return;
		}
		const fb = body.createDiv("fch-feedback " + (ch.correct ? "is-good" : "is-bad"));
		fb.createDiv({ cls: "fch-feedback-title", text: ch.correct ? "Benar! 🎉" : "Belum tepat" });
		const extra = card.type === "mcq" ? card.explanation : card.type === "cloze" ? card.back : "";
		if (extra) this.render(fb.createDiv("markdown-rendered"), extra);
		const b = btn(actions, { text: ch.correct ? "Lanjut" : "Lanjut — kartu ini akan diulang", cls: "fch-btn-primary fch-btn-xl", onClick: () => this.rate(ch.correct ? 2 : 0) });
		b.createSpan({ cls: "fch-kbd", text: "Enter" });
	}

	private drawGrades(actions: HTMLElement, st: CardState | undefined, suggest: Grade | null) {
		const row = actions.createDiv("fch-grades");
		const grades: Grade[] = this.opts.cram ? [0, 2] : [0, 1, 2, 3];
		grades.forEach((g, i) => {
			const b = row.createEl("button", { cls: `fch-grade g${g}` + (suggest === g ? " is-suggested" : "") });
			b.createDiv({ cls: "fch-grade-emo", text: ["😵", "😬", "🙂", "🤩"][g] });
			b.createDiv({ cls: "fch-grade-label", text: this.opts.cram ? (g === 0 ? "Belum hafal" : "Sudah hafal") : GRADE[g] });
			b.createDiv({ cls: "fch-grade-sub", text: this.opts.cram ? `${i + 1}` : `${formatInterval(previewInterval(st, g, this.s))} · ${g + 1}` });
			b.onclick = () => this.rate(g);
		});
	}

	// ---------- mode tulis tangan ----------
	private drawCounted = false;
	private drawCanvas(body: HTMLElement) {
		const wrap = body.createDiv("fch-draw");
		const tools = wrap.createDiv("fch-draw-tools");
		const cv = wrap.createEl("canvas", { cls: "fch-draw-canvas" });
		const W = 720, H = 300, dpr = Math.min(2, window.devicePixelRatio || 1);
		cv.width = W * dpr;
		cv.height = H * dpr;
		const ctx = cv.getContext("2d")!;
		ctx.scale(dpr, dpr);
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		let color = getComputedStyle(body).color || "#222", size = 4, erase = false;
		if (this.drawing) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, W, H); im.src = this.drawing; }
		const pick = (label: string, fn: () => void, on = false) => {
			const b = tools.createEl("button", { cls: "fch-draw-btn" + (on ? " is-on" : ""), text: label });
			b.onclick = () => { tools.querySelectorAll(".fch-draw-btn").forEach((x) => x.removeClass("is-on")); b.addClass("is-on"); fn(); };
			return b;
		};
		pick("✏️ Pena", () => { erase = false; size = 4; }, true);
		pick("🖊️ Tebal", () => { erase = false; size = 9; });
		pick("🔴", () => { erase = false; color = "#d9453a"; });
		pick("🔵", () => { erase = false; color = "#3b6fd6"; });
		pick("⚫", () => { erase = false; color = getComputedStyle(body).color || "#222"; });
		pick("🧽 Hapus", () => { erase = true; size = 22; });
		const clear = tools.createEl("button", { cls: "fch-draw-btn", text: "🗑️ Bersihkan" });
		clear.onclick = () => { ctx.clearRect(0, 0, W, H); this.drawing = ""; };
		const pos = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
		let down = false;
		cv.addEventListener("pointerdown", (e) => {
			down = true;
			cv.setPointerCapture(e.pointerId);
			const [x, y] = pos(e);
			ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
			ctx.strokeStyle = color;
			ctx.lineWidth = size * (e.pressure && e.pointerType === "pen" ? 0.5 + e.pressure : 1);
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x + 0.01, y + 0.01);
			ctx.stroke();
		});
		cv.addEventListener("pointermove", (e) => {
			if (!down) return;
			const [x, y] = pos(e);
			if (e.pointerType === "pen" && e.pressure) ctx.lineWidth = size * (0.5 + e.pressure);
			ctx.lineTo(x, y);
			ctx.stroke();
		});
		const up = () => { if (!down) return; down = false; this.drawing = cv.toDataURL("image/png"); };
		cv.addEventListener("pointerup", up);
		cv.addEventListener("pointercancel", up);
		wrap.createDiv({ cls: "fch-muted fch-small", text: "Tulis atau gambar jawabanmu (mouse, jari, atau stylus), lalu bandingkan." });
	}

	// ---------- mode Feynman ----------
	private drawExplain(body: HTMLElement, actions: HTMLElement, card: Card, st: CardState | undefined) {
		const ans = card.answer ?? card.back;
		const keys = keywords(ans);
		const cov = coverage(this.typed, keys);
		body.createDiv("fch-divider");
		const back = body.createDiv("fch-face fch-back markdown-rendered");
		this.render(back, card.type === "cloze" ? card.back : ans);
		// sorot kata kunci di jawaban: hijau = kamu sebut, oranye = terlewat
		window.setTimeout(() => highlightWords(back, cov.hit, cov.miss), 60);
		const box = body.createDiv("fch-explain " + (cov.score >= 0.8 ? "is-good" : cov.score >= 0.5 ? "is-mid" : "is-bad"));
		ring(box, cov.score, 52, `${Math.round(cov.score * 100)}`);
		const tx = box.createDiv("fch-grow");
		tx.createDiv({ cls: "fch-strong", text: !this.typed.trim() ? "Kamu belum menulis penjelasan" : cov.score >= 0.8 ? "Penjelasanmu lengkap!" : cov.score >= 0.5 ? "Sudah cukup baik, ada yang terlewat" : "Banyak poin penting yang terlewat" });
		if (this.typed.trim()) tx.createDiv({ cls: "fch-explain-you", text: `“${this.typed.trim()}”` });
		const chips = tx.createDiv("fch-chips");
		cov.hit.forEach((k) => chips.createSpan({ cls: "fch-kw is-hit", text: "✓ " + k }));
		cov.miss.forEach((k) => chips.createSpan({ cls: "fch-kw is-miss", text: k }));
		if (this.typed.trim().length > 15)
			btn(tx, { text: "Simpan penjelasanku sebagai mnemonik", icon: "message-square-plus", cls: "fch-btn-link", onClick: () => { this.plugin.setMnemo(card, this.typed.trim()); new Notice("Disimpan sebagai mnemonik 🧠"); } });
		if (!this.explainCounted) {
			this.explainCounted = true;
			this.plugin.data.meta.explains = (this.plugin.data.meta.explains ?? 0) + 1;
			if (cov.score >= 0.7) this.plugin.track("explainGood");
		}
		const suggest: Grade = cov.score >= 0.8 ? 2 : cov.score >= 0.5 ? 1 : 0;
		this.drawGrades(actions, st, suggest);
	}
	private explainCounted = false;

	// ---------- checklist multi-baris ----------
	/** Bagian yang bisa dicentang: item List, atau baris jawaban kartu Multi Line. Null bila tidak berlaku. */
	private checklistParts(): string[] | null {
		if (!this.s.checklist || !this.revealed || this.choice || this.done) return null;
		const c = this.card;
		let parts: string[] = [];
		if (c.type === "list") parts = c.items ?? [];
		else if (c.type === "multiline") parts = c.back.split("\n").map((l) => (ITEM_RE.exec(l)?.[1] ?? l).trim()).filter(Boolean);
		return parts.length >= 2 && parts.length <= 30 ? parts : null;
	}

	private drawChecklist(body: HTMLElement, actions: HTMLElement, parts: string[]) {
		const card = this.card;
		const missed = new Set(this.plugin.data.partial[card.id] ?? []);
		body.createDiv({ cls: "fch-check-hint", text: "Centang bagian yang berhasil kamu ingat (angka 1–9, A = semua)" });
		const list = body.createDiv("fch-checklist");
		parts.forEach((t, i) => {
			const on = this.checks.has(i);
			const row = list.createEl("button", { cls: "fch-check" + (on ? " is-on" : "") + (missed.has(i) ? " was-missed" : "") });
			row.createSpan({ cls: "fch-check-box", text: on ? "✓" : String(i + 1) });
			this.render(row.createDiv("fch-check-text markdown-rendered"), t);
			if (missed.has(i)) row.createSpan({ cls: "fch-check-tag", text: "belum hafal sebelumnya" });
			row.onclick = () => this.toggleCheck(i);
		});
		const k = this.checks.size, n = parts.length;
		const r = actions.createDiv("fch-row");
		btn(r, { text: "Hafal semua", icon: "check-circle-2", cls: "fch-btn-xl", onClick: () => this.checkAll() });
		const sub = btn(r, { text: k === n ? "Selesai · semua hafal" : `Selesai · ${k}/${n} hafal`, cls: "fch-btn-primary fch-btn-xl", onClick: () => this.submitChecklist() });
		sub.createSpan({ cls: "fch-kbd", text: "Enter" });
		const m = actions.createDiv("fch-center fch-small");
		btn(m, { text: k < n ? `${n - k} bagian yang belum hafal akan diulang lagi di sesi ini` : "Nilai manual", cls: "fch-btn-link", onClick: () => { this.manual = true; this.draw(); } });
	}

	private toggleCheck(i: number) {
		if (this.checks.has(i)) this.checks.delete(i);
		else this.checks.add(i);
		this.draw();
	}

	private checkAll() {
		const parts = this.checklistParts();
		if (!parts) return;
		parts.forEach((_, i) => this.checks.add(i));
		this.draw();
	}

	private submitChecklist() {
		const parts = this.checklistParts();
		if (!parts) return;
		const n = parts.length, k = this.checks.size;
		const missed = parts.map((_, i) => i).filter((i) => !this.checks.has(i));
		const id = this.card.id;
		if (missed.length) this.plugin.data.partial[id] = missed;
		else {
			delete this.plugin.data.partial[id];
			this.plugin.bumpMeta("checklistPerfect");
		}
		const ratio = k / n;
		const g: Grade = k === n ? 2 : this.opts.cram ? 0 : ratio >= 0.6 ? 1 : 0;
		if (g === 1) this.requeueNext = true;
		this.rate(g);
	}

	// ---------- bantuan belajar ----------
	private giveHint() {
		if (this.done || this.revealed) return;
		const ch = this.choice;
		if (ch) {
			if (ch.checked) return;
			const wrong = ch.options.map((o, i) => i).filter((i) => !ch.options[i].correct && !ch.hidden.has(i));
			if (wrong.length <= 1) return void new Notice("Tidak ada lagi pilihan yang bisa dihapus.");
			ch.hidden.add(wrong[Math.floor(Math.random() * wrong.length)]);
		} else if (this.card.type === "occlusion" && !this.card.answer) return void new Notice("Kotak ini belum punya label teks. Tambahkan label lewat Edit (E).");
		else this.hint = Math.min(this.hint + 1, 4);
		this.draw();
	}

	private openPanel(p: "flag" | "mnemo" | null) {
		if (this.done) return;
		if (p === "flag") {
			const f = this.plugin.flagOf(this.card);
			this.flagDraft = { reasons: [...(f?.reasons ?? [])], note: f?.note ?? "" };
		}
		this.panel = this.panel === p ? null : p;
		this.draw();
	}

	private drawPanel(stage: HTMLElement, card: Card) {
		const box = stage.parentElement!.createDiv("fch-panel fch-sheet");
		stage.after(box);
		if (this.panel === "flag") {
			const has = !!this.plugin.flagOf(card);
			box.createDiv({ cls: "fch-strong", text: "🚩 Tandai untuk diperbaiki nanti" });
			box.createDiv({ cls: "fch-muted fch-small", text: "Kartu tetap dipelajari seperti biasa, dan muncul di halaman Perbaiki." });
			const chips = box.createDiv("fch-chips");
			for (const r of REASONS) {
				const c = chips.createEl("button", { cls: "fch-chip" + (this.flagDraft.reasons.includes(r) ? " is-active" : ""), text: r });
				c.onclick = () => {
					const i = this.flagDraft.reasons.indexOf(r);
					if (i >= 0) this.flagDraft.reasons.splice(i, 1);
					else this.flagDraft.reasons.push(r);
					c.toggleClass("is-active", i < 0);
				};
			}
			const inp = box.createEl("input", { type: "text", cls: "fch-input", attr: { placeholder: "Catatan (opsional), mis. jawabannya seharusnya M. leprae" } });
			inp.value = this.flagDraft.note;
			inp.oninput = () => (this.flagDraft.note = inp.value);
			const save = () => {
				this.plugin.setFlag(card, { reasons: this.flagDraft.reasons, note: this.flagDraft.note.trim(), t: Date.now() });
				new Notice("🚩 Ditandai. Perbaiki nanti dari halaman Perbaiki.", 2500);
				this.panel = null;
				this.draw();
			};
			inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); save(); } };
			const row = box.createDiv("fch-row");
			btn(row, { text: has ? "Simpan tanda" : "Tandai", icon: "flag", cls: "fch-btn-primary fch-btn-sm", onClick: save });
			if (has) btn(row, { text: "Hapus tanda", cls: "fch-btn-sm", onClick: () => { this.plugin.setFlag(card, null); this.panel = null; this.draw(); } });
			const sc = this.plugin.storedOf(card);
			btn(row, { text: sc ? "Edit sekarang" : "Buka di catatan", icon: "pencil", cls: "fch-btn-ghost fch-btn-sm", onClick: () => this.edit() });
			btn(row, { text: "Batal", cls: "fch-btn-ghost fch-btn-sm", onClick: () => this.openPanel(null) });
			window.setTimeout(() => inp.focus(), 20);
		} else if (this.panel === "mnemo") {
			box.createDiv({ cls: "fch-strong", text: "🧠 Jembatan keledai" });
			box.createDiv({ cls: "fch-muted fch-small", text: "Singkatan, cerita lucu, atau asosiasi pribadi yang membantumu mengingat. Muncul setiap kali jawaban dibuka." });
			const ta = box.createEl("textarea", { cls: "fch-input", attr: { rows: "2", placeholder: "mis. “Mycobacterium Leprae = Mati rasa & Lepas rambut”" } });
			ta.value = this.plugin.data.mnemo[card.id] ?? "";
			const save = () => {
				const had = !!this.plugin.data.mnemo[card.id];
				this.plugin.setMnemo(card, ta.value);
				if (!had && ta.value.trim()) this.plugin.checkAchievements();
				this.panel = null;
				this.draw();
			};
			ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } };
			const row = box.createDiv("fch-row");
			btn(row, { text: "Simpan", icon: "check", cls: "fch-btn-primary fch-btn-sm", onClick: save });
			btn(row, { text: "Batal", cls: "fch-btn-ghost fch-btn-sm", onClick: () => this.openPanel(null) });
			window.setTimeout(() => ta.focus(), 20);
		}
	}

	// ---------- aksi ----------
	private reveal() {
		play("flip");
		this.revealed = true;
		this.flip = true;
		this.draw();
		if (this.s.autoSpeak) this.speak();
	}

	private showNext() {
		const n = this.card.items?.length ?? 0;
		this.shown = Math.min(n, this.shown + 1);
		if (this.shown >= n) this.revealed = true;
		this.draw();
	}

	private showAll() {
		this.shown = this.card.items?.length ?? 0;
		this.revealed = true;
		this.flip = true;
		this.draw();
	}

	private pick(i: number) {
		const ch = this.choice;
		if (!ch || ch.checked) return;
		if (ch.multi) {
			if (ch.picked.has(i)) ch.picked.delete(i);
			else ch.picked.add(i);
			this.draw();
		} else {
			ch.picked = new Set([i]);
			this.check();
		}
	}

	private check() {
		const ch = this.choice;
		if (!ch) return;
		ch.checked = true;
		ch.correct = ch.options.every((o, i) => o.correct === ch.picked.has(i));
		play(ch.correct ? "correct" : "wrong");
		if (!ch.correct && !ch.multi) {
			const txt = ch.options[[...ch.picked][0]]?.text;
			const other = this.plugin.allCards().find((c) => c.id !== this.card.id && (c.answer ?? c.back) === txt);
			if (other) this.plugin.logConfusion(this.card.id, other.id);
		}
		this.revealed = true;
		this.draw();
	}

	private rate(g: Grade) {
		if (this.busy) return;
		if (!this.choice?.checked) play(g > 0 ? "correct" : "wrong");
		const stage = this.el?.querySelector(".fch-stage") as HTMLElement | null;
		const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		this.lastGrade = g;
		this.enter = true;
		if (stage && !reduce) {
			this.busy = true;
			stage.addClass(g === 0 ? "is-pulse-bad" : "is-pulse-good");
			if (this.fxOn()) {
				stage.addClass(g === 0 ? "is-exit-bad" : "is-exit-good");
				const btnEl = this.el?.querySelector(`.fch-grade.g${g}`) as HTMLElement | null;
				if (g > 0) burst(stage, btnEl, g);
				const next = this.combo + 1;
				if (g > 0 && [5, 10, 15, 20, 30, 50, 75, 100].includes(next)) {
					stage.createDiv({ cls: "fch-combo-burst" + (next >= 20 ? " is-mega" : ""), text: `COMBO ×${next}! ${next >= 20 ? "🔥🔥" : "🔥"}` });
					play("levelup");
				}
			}
			if (!this.opts.cram) {
				const f = stage.createDiv({ cls: "fch-xpfloat" + (g === 0 ? " is-low" : ""), text: g === 0 ? "+4 XP" : this.combo + 1 >= 3 ? `+10 XP · ⚡${this.combo + 1}` : "+10 XP" });
				f.style.left = `${40 + Math.random() * 20}%`;
			}
			window.setTimeout(() => {
				this.busy = false;
				this.applyRate(g);
			}, this.fxOn() ? 340 : 230);
		} else this.applyRate(g);
	}

	private enter = false;
	private lastGrade: Grade | null = null;
	/** Animasi kartu aktif (pengaturan + preferensi sistem). */
	private fxOn() {
		return this.s.cardFx !== false && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
	}

	private applyRate(g: Grade) {
		const card = this.card;
		const data = this.plugin.data;
		const prev = data.cards[card.id];
		const k = dayKey(Date.now());
		this.undoStack.push({
			queue: [...this.queue], idx: this.idx, cardId: card.id,
			prev: prev ? clone(prev) : undefined,
			daily: data.daily[k] ? clone(data.daily[k]) : undefined,
			dayK: k, stats: clone(this.stats),
		});
		if (this.undoStack.length > 50) this.undoStack.shift();

		if (!this.opts.cram) {
			const next = schedule(prev, g, Date.now(), this.s);
			next.starred = prev?.starred;
			data.cards[card.id] = next;
			this.plugin.recordReview(g, isNewState(prev), Date.now() - this.cardStart);
			this.stats.xp += g > 0 ? 10 : 4;
			if (g === 0 && next.lapses === this.s.leechThreshold)
				new Notice(`🩹 Kartu ini sudah ${next.lapses}× terlupa. Coba tulis ulang, beri mnemonik/gambar, atau pecah jadi kartu lebih kecil.`, 9000);
			this.plugin.requestSave();
		}
		this.stats.rated++;
		this.stats.grades[g]++;
		if (g > 0) this.stats.correct++;
		this.combo = g > 0 ? this.combo + 1 : 0;
		this.plugin.track("comboMax", this.combo, true);
		if (g > 0 && (prev?.lapses ?? 0) >= 2) this.plugin.track("hardCorrect");
		if (this.combo > this.maxCombo) this.maxCombo = this.combo;
		const meta = this.plugin.data.meta;
		if (this.combo > (meta.maxCombo ?? 0)) meta.maxCombo = this.combo;
		if (this.choice?.checked && this.choice.correct) this.plugin.bump("quizCorrect");
		if (!this.opts.cram || this.combo % 10 === 0) this.plugin.checkAchievements();
		if (g === 0 || this.requeueNext) {
			if (!this.stats.failed.includes(card.id)) this.stats.failed.push(card.id);
			this.queue.splice(Math.min(this.idx + 4, this.queue.length), 0, card);
		}
		this.requeueNext = false;
		if (!this.opts.cram) {
			const c = g > 0 ? 2 : 1;
			this.coinsEarned += c;
			this.plugin.addCoins(c);
		}
		this.idx++;
		if (this.timeUp) this.queue = this.queue.slice(0, this.idx);
		this.prepare();
		this.draw();
		if (this.s.autoSpeak && !this.done) this.speak();
	}

	private undo() {
		const snap = this.undoStack.pop();
		if (!snap) return;
		const data = this.plugin.data;
		if (!this.opts.cram) {
			if (snap.prev) data.cards[snap.cardId] = snap.prev;
			else delete data.cards[snap.cardId];
			if (snap.daily) data.daily[snap.dayK] = snap.daily;
			else delete data.daily[snap.dayK];
			this.plugin.requestSave();
		}
		this.queue = snap.queue;
		this.idx = snap.idx;
		this.stats = snap.stats;
		this.combo = 0;
		this.prepare();
		this.draw();
	}

	private skip() {
		const [card] = this.queue.splice(this.idx, 1);
		this.queue.push(card);
		this.prepare();
		this.draw();
	}

	private suspend() {
		const card = this.card;
		this.plugin.toggleSuspend(card);
		this.queue = [...this.queue.slice(0, this.idx), ...this.queue.slice(this.idx).filter((c) => c.id !== card.id)];
		new Notice("Kartu ditangguhkan. Aktifkan lagi dari halaman Semua kartu.");
		this.prepare();
		this.draw();
	}

	private variations() {
		if (this.done) return;
		const n = this.plugin.makeVariations(this.card);
		new Notice(n ? `✓ ${n} variasi dibuat (kebalikan/cloze/pilihan ganda). Muncul di sesi berikutnya.` : "Variasi untuk kartu ini sudah ada atau tidak memungkinkan.");
	}

	private star() {
		if (this.done) return;
		const on = this.plugin.toggleStar(this.card);
		new Notice(on ? "⭐ Kartu ditandai" : "Tanda dihapus", 1500);
		this.draw();
	}

	private edit() {
		if (this.done) return;
		this.plugin.editAny(this.card);
	}

	private speak() {
		const synth = window.speechSynthesis;
		if (this.done || !synth) return;
		const c = this.card;
		let text = this.revealed ? (c.type === "cloze" ? c.back : `${c.front}. ${c.back}`) : c.front.replace(/\[…\]/g, " titik titik ");
		if (this.choice && !this.choice.checked) text += ". " + this.choice.options.map((o, i) => `${i + 1}, ${plainText(o.text)}`).join(". ");
		synth.cancel();
		const u = new SpeechSynthesisUtterance(plainText(text));
		u.lang = this.s.ttsLang;
		synth.speak(u);
	}

	private drawTestResult(wrap: HTMLElement, rated: number, correct: number) {
		const box = wrap.createDiv("fch-continue");
		const pct = Math.round((correct / rated) * 100);
		box.createDiv({ cls: "fch-strong", text: `Skor retensi jangka panjang: ${pct}%` });
		const prev = (this.plugin.data.meta.retentionTests ?? []).slice(-2, -1)[0];
		box.createDiv({ cls: "fch-muted fch-small", text: prev ? `Tes sebelumnya: ${Math.round((prev.correct / prev.n) * 100)}%. ${pct >= 80 ? "Ingatan jangka panjangmu kuat." : "Beberapa kartu lama mulai pudar."}` : pct >= 80 ? "Ingatan jangka panjangmu kuat." : "Beberapa kartu lama mulai pudar." });
		const failed = this.stats.failed;
		if (failed.length)
			btn(box.createDiv("fch-row fch-center"), {
				text: `Jadwalkan ulang ${failed.length} kartu yang terlupa`, icon: "rotate-ccw", cls: "fch-btn-primary",
				onClick: () => {
					for (const id of failed) {
						const st = this.plugin.data.cards[id];
						if (st) { st.due = Date.now(); st.interval = Math.max(1, Math.round(st.interval / 3)); }
					}
					this.plugin.requestSave();
					this.plugin.refreshViews();
					new Notice("Kartu yang terlupa dijadwalkan untuk diulas hari ini.");
				},
			});
	}

	/** Ajakan melanjutkan bila masih ada kartu di cakupan sesi. */
	private drawContinue(wrap: HTMLElement) {
		const p = this.plugin;
		const next = p.buildQueue(this.source, false).length;
		const info = p.limitInfo(this.source);
		const box = wrap.createDiv("fch-continue");
		const restart = () => this.hub.startSession(this.source, { ...this.opts });
		if (next) {
			box.createDiv({ cls: "fch-strong", text: `Masih ada ${next} kartu yang bisa dipelajari hari ini` });
			box.createDiv({ cls: "fch-muted fch-small", text: "Progres sesi ini sudah tersimpan." });
			btn(box.createDiv("fch-row fch-center"), { text: `Lanjut ${next} kartu berikutnya`, icon: "play", cls: "fch-btn-primary", onClick: restart });
		} else if (info.newBlocked || info.revBlocked) {
			const n = info.newBlocked || info.revBlocked;
			const kind = info.newBlocked ? "new" : "rev";
			box.createDiv({ cls: "fch-strong", text: `${n} kartu ${kind === "new" ? "baru" : "ulasan"} lagi menunggu — batas harian tercapai` });
			box.createDiv({ cls: "fch-muted fch-small", text: "Progresmu sudah tersimpan. Kamu bisa menambah jatah khusus hari ini tanpa mengubah pengaturan." });
			const r = box.createDiv("fch-row fch-center");
			btn(r, { text: "+10 kartu", onClick: () => { p.extendToday(kind, 10); restart(); } });
			btn(r, { text: "+25 kartu", onClick: () => { p.extendToday(kind, 25); restart(); } });
			btn(r, { text: `Lanjut semua (${n})`, icon: "play", cls: "fch-btn-primary", onClick: () => { p.extendToday(kind, n); restart(); } });
		} else box.remove();
	}

	// ---------- ringkasan ----------
	private drawSummary(root: HTMLElement) {
		this.timerEl = null;
		const { rated, correct, grades, failed, xp } = this.stats;
		const acc = rated ? correct / rated : 0;
		if (!this.counted) void this.plugin.saveNow();
		if (!this.counted && rated) {
			if (this.opts.test) {
				const tests = (this.plugin.data.meta.retentionTests ??= []);
				tests.push({ t: Date.now(), n: rated, correct });
			}
			if (this.opts.interleave) this.plugin.bumpMeta("interleaved");
			if (rated >= 10 && correct === rated) { this.plugin.addCoins(10); this.coinsEarned += 10; this.plugin.track("perfectSession"); }
			if (rated >= 10 && correct === rated) this.plugin.bump("perfectSessions");
			const h = new Date().getHours();
			if (h >= 22 || h < 4) this.plugin.bump("nightSessions");
			else if (h >= 4 && h < 7) this.plugin.bump("morningSessions");
			this.hub.setZen(false);
			window.setTimeout(() => this.plugin.checkAchievements(), 400);
		}
		const fx = this.fxOn();
		const wrap = root.createDiv("fch-summary" + (fx ? " fx" : ""));
		wrap.createDiv({ cls: "fch-sum-emoji", text: acc >= 0.9 ? "🏆" : acc >= 0.75 ? "🎉" : acc >= 0.5 ? "💪" : "🌱" });
		if (rated) {
			const stars = wrap.createDiv("fch-sum-stars");
			const n = acc >= 0.9 ? 3 : acc >= 0.75 ? 2 : acc >= 0.5 ? 1 : 0;
			for (let i = 0; i < 3; i++) { const sEl = stars.createSpan({ cls: "fch-sum-star" + (i < n ? " is-on" : ""), text: "★" }); sEl.style.animationDelay = `${0.25 + i * 0.22}s`; }
		}
		wrap.createEl("h2", { text: "Sesi selesai" });
		wrap.createEl("p", {
			cls: "fch-muted",
			text: acc >= 0.9 ? "Ingatanmu tajam sekali hari ini."
				: acc >= 0.75 ? "Mantap, sebagian besar sudah melekat."
				: acc >= 0.5 ? "Lumayan. Kartu yang terlupa akan muncul lagi lebih cepat."
				: "Tidak apa-apa. Lupa adalah bagian dari proses menghafal.",
		});

		const grid = wrap.createDiv("fch-sum-grid");
		const tile = (v: string, l: string) => {
			const t = grid.createDiv("fch-sum-tile");
			const vEl = t.createDiv({ cls: "fch-sum-v", text: v });
			if (fx) countUp(vEl, v);
			t.createDiv({ cls: "fch-muted", text: l });
		};
		tile(String(rated), "kartu dinilai");
		tile(`${Math.round(acc * 100)}%`, "akurasi");
		tile(formatDuration(Date.now() - this.startTime), "durasi");
		tile(`⚡ ${this.maxCombo}`, "combo terbaik");
		if (this.coinsEarned) grid.createDiv({ cls: "fch-sum-coins", text: `🪙 +${this.coinsEarned} koin` });
		if (this.opts.test && rated) this.drawTestResult(wrap, rated, correct);

		if (rated) {
			const dist = wrap.createDiv("fch-dist");
			grades.forEach((n, g) => {
				if (!n) return;
				const seg = dist.createDiv({ cls: `fch-dist-seg g${g}`, attr: { "aria-label": `${GRADE[g]}: ${n}` } });
				seg.style.flexGrow = String(n);
				seg.setText(String(n));
			});
		}

		if (!this.opts.cram && xp) {
			const lv = this.plugin.level();
			const box = wrap.createDiv("fch-xp");
			box.createDiv({ cls: "fch-xp-gain", text: `+${xp} XP` });
			const lvl = box.createDiv("fch-xp-level");
			lvl.createSpan({ text: `Level ${lv.level} · ${lv.title}` });
			lvl.createSpan({ cls: "fch-muted", text: `${lv.into} / ${lv.need} XP` });
			box.createDiv("fch-bar").createDiv("fch-bar-fill").style.width = `${(lv.into / lv.need) * 100}%`;
			const tomorrow = this.plugin.forecast(2)[1] ?? 0;
			wrap.createEl("p", { cls: "fch-muted", text: `Besok ada ${tomorrow} kartu yang perlu diulas.` });
		}

		if (!this.opts.cram) this.drawContinue(wrap);

		const row = wrap.createDiv("fch-row fch-center");
		if (failed.length)
			btn(row, {
				text: `Ulangi ${failed.length} kartu yang terlupa`, icon: "rotate-ccw",
				onClick: () => {
					const all = new Map(this.plugin.allCards().map((c) => [c.id, c]));
					const cards = failed.map((id) => all.get(id)).filter((c): c is Card => !!c);
					this.hub.startSession(cards, { title: "Ulangi yang terlupa", cram: true, mode: this.opts.mode });
				},
			});
		btn(row, { text: "Selesai", cls: "fch-btn-primary", onClick: () => this.hub.endSession() });
		if (this.s.confetti && rated && acc >= 0.75) confetti(root);
	}
}

/** Bungkus kata kunci di dalam elemen hasil render agar bisa diberi warna. */
function highlightWords(root: HTMLElement, hit: string[], miss: string[]) {
	if (!hit.length && !miss.length) return;
	const norm = (w: string) => w.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const nodes: Text[] = [];
	while (walker.nextNode()) nodes.push(walker.currentNode as Text);
	for (const n of nodes) {
		const parts = (n.textContent ?? "").split(/([\p{L}\p{N}]+)/u);
		if (parts.length < 2) continue;
		const frag = document.createDocumentFragment();
		let changed = false;
		for (const part of parts) {
			const k = norm(part);
			const cls = hit.includes(k) ? "fch-hl-hit" : miss.includes(k) ? "fch-hl-miss" : "";
			if (cls) { const sp = document.createElement("mark"); sp.className = cls; sp.textContent = part; frag.appendChild(sp); changed = true; }
			else frag.appendChild(document.createTextNode(part));
		}
		if (changed) n.replaceWith(frag);
	}
}
