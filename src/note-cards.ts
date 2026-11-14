import { App, Component, MarkdownRenderer, MarkdownView, Modal, Notice, TFile, editorInfoField, setIcon } from "obsidian";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import type FlashcardPlugin from "./main";
import { Card, Grade, TYPE_LABEL } from "./types";
import { formatInterval, isNewState, previewInterval, retention, schedule } from "./scheduler";
import { locate } from "./anchor";
import { refreshMarks } from "./editor-marks";
import { cardFront } from "./occlusion";
import { btn, plainText } from "./util";
import { play } from "./sound";

// ================================================================ posisi kartu di catatan
export interface Placed { card: Card; from: number; to: number; line: number }

/** Letak setiap kartu di teks catatan (kartu sintaks, kartu rapi dari seleksi, dan Image Occlusion). */
export function placeCards(p: FlashcardPlugin, path: string, text: string): Placed[] {
	const starts = [0];
	for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
	const lineAt = (pos: number) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= pos) lo = m; else hi = m - 1; } return lo; };
	const out: Placed[] = [];
	for (const c of p.index.get(path) ?? []) {
		if (c.stored) {
			const sc = p.data.stored[c.stored];
			const r = sc?.anchor ? locate(text, sc.anchor) : null;
			if (!r) continue;
			out.push({ card: c, from: r.from, to: r.to, line: lineAt(r.to) });
		} else if (c.occ) {
			const o = p.occOf(c);
			const name = o?.image.split("/").pop();
			const k = name ? text.indexOf(name) : -1;
			if (k < 0) continue;
			out.push({ card: c, from: k, to: k + name!.length, line: lineAt(k) });
		} else {
			if (c.line < 0 || c.line >= starts.length) continue;
			const from = starts[c.line];
			const to = (starts[c.line + 1] ?? text.length + 1) - 1;
			out.push({ card: c, from, to, line: c.line });
		}
	}
	return out;
}

/** Jarak waktu ke depan dalam bahasa sehari-hari (dibulatkan). */
export function untilText(ms: number): string {
	if (ms < 3600_000) return `${Math.max(1, Math.round(ms / 60_000))} mnt`;
	if (ms < 86400_000) return `${Math.round(ms / 3600_000)} jam`;
	return formatInterval(Math.round(ms / 86400_000));
}
export type Status = { kind: "new" | "due" | "later"; label: string };
export function statusOf(p: FlashcardPlugin, c: Card): Status {
	const st = p.data.cards[c.id];
	if (!st || isNewState(st)) return { kind: "new", label: "Baru" };
	const now = Date.now();
	if (st.due <= now) return { kind: "due", label: "Jatuh tempo" };
	const r = retention(st, now);
	return { kind: "later", label: `Berikutnya ${untilText(st.due - now)} lagi${r !== null ? ` · ingatan ${Math.round(r * 100)}%` : ""}` };
}

// ================================================================ latihan satu/lebih kartu (dipakai popover & modal)
const GRADES: { g: Grade; label: string; cls: string }[] = [
	{ g: 0, label: "Lupa", cls: "g0" }, { g: 1, label: "Sulit", cls: "g1" }, { g: 2, label: "Baik", cls: "g2" }, { g: 3, label: "Mudah", cls: "g3" },
];

export class Practice {
	idx = 0;
	revealed = false;
	results = new Map<string, string>();
	private comp = new Component();
	private shownAt = Date.now();
	constructor(private p: FlashcardPlugin, private host: HTMLElement, public cards: Card[], private opts: { onClose?: () => void; onChange?: () => void; title?: string } = {}) {
		this.comp.load();
	}
	destroy() { this.comp.unload(); }
	get card() { return this.cards[this.idx]; }

	go(i: number) { this.idx = (i + this.cards.length) % this.cards.length; this.revealed = false; this.shownAt = Date.now(); this.draw(); }
	reveal() { if (!this.revealed) { this.revealed = true; play("flip"); this.draw(); } }

	/** Nilai kartu dengan FSRS (kartu baru / jatuh tempo). */
	grade(g: Grade) {
		const c = this.card;
		const p = this.p;
		const prev = p.data.cards[c.id];
		const next = schedule(prev, g, Date.now(), p.data.settings);
		next.starred = prev?.starred;
		p.data.cards[c.id] = next;
		p.recordReview(g, isNewState(prev), Date.now() - this.shownAt);
		p.addCoins(g > 0 ? 2 : 1);
		p.requestSave();
		p.checkAchievements();
		play(g > 0 ? "correct" : "wrong");
		this.results.set(c.id, `${GRADES[g].label} · muncul lagi ${untilText(next.due - Date.now())} lagi`);
		this.afterAnswer();
	}
	/** Uji diri tanpa mengubah jadwal (kartu yang belum jatuh tempo). */
	selfCheck(ok: boolean) {
		play(ok ? "correct" : "wrong");
		this.results.set(this.card.id, ok ? "Ingat ✓ (jadwal tetap)" : "Lupa ✗ (jadwal tetap)");
		this.afterAnswer();
	}
	private afterAnswer() {
		this.opts.onChange?.();
		this.p.refreshEditorMarks();
		const nextIdx = this.cards.findIndex((c, i) => i > this.idx && !this.results.has(c.id));
		const any = nextIdx >= 0 ? nextIdx : this.cards.findIndex((c) => !this.results.has(c.id));
		if (any >= 0) window.setTimeout(() => this.go(any), 450);
		else this.draw();
	}

	onKey(e: KeyboardEvent): boolean {
		if (e.ctrlKey || e.metaKey || e.altKey) return false;
		const st = statusOf(this.p, this.card);
		if (e.key === "Escape") { this.opts.onClose?.(); return true; }
		if (!this.revealed && (e.key === " " || e.key === "Enter")) { this.reveal(); return true; }
		if (this.revealed && !this.results.has(this.card.id)) {
			if (st.kind !== "later" && ["1", "2", "3", "4"].includes(e.key)) { this.grade((parseInt(e.key, 10) - 1) as Grade); return true; }
			if (st.kind === "later" && (e.key === "1" || e.key === "2")) { this.selfCheck(e.key === "2"); return true; }
		}
		if (this.cards.length > 1 && e.key === "ArrowRight") { this.go(this.idx + 1); return true; }
		if (this.cards.length > 1 && e.key === "ArrowLeft") { this.go(this.idx - 1); return true; }
		return false;
	}

	draw() {
		const p = this.p, c = this.card;
		this.comp.unload();
		this.comp = new Component();
		this.comp.load();
		const el = this.host;
		el.empty();
		if (!c) { el.createDiv({ cls: "fch-muted", text: "Tidak ada kartu." }); return; }
		const st = statusOf(p, c);
		const done = this.cards.filter((x) => this.results.has(x.id)).length;
		const head = el.createDiv("fch-np-head");
		head.createSpan({ cls: `fch-type fch-type-${c.type}`, text: TYPE_LABEL[c.type] });
		head.createSpan({ cls: `fch-np-status is-${st.kind}`, text: st.label });
		head.createDiv("fch-grow");
		if (this.cards.length > 1) {
			const nav = head.createDiv("fch-np-nav");
			btn(nav, { icon: "chevron-left", cls: "fch-btn-ghost fch-btn-sm", label: "Sebelumnya (←)", onClick: () => this.go(this.idx - 1) });
			nav.createSpan({ cls: "fch-small fch-strong", text: `${this.idx + 1}/${this.cards.length}` });
			btn(nav, { icon: "chevron-right", cls: "fch-btn-ghost fch-btn-sm", label: "Berikutnya (→)", onClick: () => this.go(this.idx + 1) });
		}
		if (this.opts.onClose) btn(head, { icon: "x", cls: "fch-btn-ghost fch-btn-sm", label: "Tutup (Esc)", onClick: () => this.opts.onClose!() });
		if (c.context.length) el.createDiv({ cls: "fch-np-crumb", text: c.context.join(" › ") });
		if (this.cards.length > 1) { const bar = el.createDiv("fch-np-prog"); bar.createDiv().style.width = `${(done / this.cards.length) * 100}%`; }

		const body = el.createDiv("fch-np-body");
		const showBackAsFront = this.revealed && (c.type === "cloze" || !!c.occ);
		cardFront(p, this.comp, body, c, { revealed: showBackAsFront });
		if (c.type === "mcq" && c.options) {
			const ol = body.createDiv("fch-np-opts");
			c.options.forEach((o, i) => {
				const r = ol.createDiv("fch-np-opt" + (this.revealed ? (o.correct ? " is-ok" : " is-dim") : ""));
				r.createSpan({ cls: "fch-kbd", text: String.fromCharCode(65 + i) });
				void MarkdownRenderer.render(p.app, o.text, r.createDiv("markdown-rendered"), c.path, this.comp);
			});
		}
		if (this.revealed && !showBackAsFront && c.type !== "mcq") {
			body.createDiv("fch-divider");
			void MarkdownRenderer.render(p.app, c.back, body.createDiv("fch-face fch-back markdown-rendered"), c.path, this.comp);
		}
		if (this.revealed && c.explanation) {
			const ex = body.createDiv("fch-np-expl");
			void MarkdownRenderer.render(p.app, `💡 ${c.explanation}`, ex, c.path, this.comp);
		}

		const act = el.createDiv("fch-np-act");
		const res = this.results.get(c.id);
		if (res) act.createDiv({ cls: "fch-np-result", text: `✓ ${res}` });
		else if (!this.revealed) {
			const b = btn(act, { text: "Tampilkan jawaban", cls: "fch-btn-primary fch-np-reveal", onClick: () => this.reveal() });
			b.createSpan({ cls: "fch-kbd", text: "Spasi" });
		} else if (st.kind !== "later") {
			const g = act.createDiv("fch-np-grades");
			for (const x of GRADES) {
				const b = g.createEl("button", { cls: `fch-grade ${x.cls}` });
				b.createDiv({ cls: "fch-grade-label", text: x.label });
				b.createDiv({ cls: "fch-grade-sub", text: `${x.g + 1} · ${formatInterval(previewInterval(p.data.cards[c.id], x.g, p.data.settings))}` });
				b.onclick = () => this.grade(x.g);
			}
		} else {
			act.createDiv({ cls: "fch-small fch-muted", text: "Kartu ini belum jatuh tempo, jadi uji diri ini tidak mengubah jadwalnya." });
			const g = act.createDiv("fch-np-grades is-two");
			const no = g.createEl("button", { cls: "fch-grade g0" });
			no.createDiv({ cls: "fch-grade-label", text: "Lupa" });
			no.createDiv({ cls: "fch-grade-sub", text: "1" });
			no.onclick = () => this.selfCheck(false);
			const yes = g.createEl("button", { cls: "fch-grade g2" });
			yes.createDiv({ cls: "fch-grade-label", text: "Ingat" });
			yes.createDiv({ cls: "fch-grade-sub", text: "2" });
			yes.onclick = () => this.selfCheck(true);
		}
		if (this.cards.length > 1 && done === this.cards.length) el.createDiv({ cls: "fch-np-done", text: `🎉 ${done} kartu selesai dilatih!` });

		const foot = el.createDiv("fch-np-foot");
		btn(foot, { text: "Edit", icon: "pencil", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { this.opts.onClose?.(); p.editAny(c); } });
		foot.createDiv("fch-grow");
		btn(foot, { text: this.cards.length > 1 ? `Latih ${this.cards.length} di tab` : "Buka di tab", icon: "play", cls: "fch-btn-sm", onClick: () => { this.opts.onClose?.(); void practiceInHub(p, this.cards, this.opts.title ?? "Kartu dari catatan"); } });
	}
}

/** Mulai sesi di tab plugin: kartu jatuh tempo/baru dinilai normal; bila tidak ada, latihan bebas (jadwal tidak berubah). */
export async function practiceInHub(p: FlashcardPlugin, cards: Card[], title: string) {
	const hub = await p.openHub();
	const anyDue = cards.some((c) => statusOf(p, c).kind !== "later");
	hub.startSession(cards, { title, cram: !anyDue, mode: p.data.settings.defaultMode });
	if (!anyDue) new Notice("Semua kartu ini belum jatuh tempo: dibuka sebagai latihan bebas (jadwal tidak berubah).");
}

// ================================================================ popover di dekat tombol kartu
let open: { el: HTMLElement; pr: Practice; off: () => void } | null = null;
export function closePopover() {
	if (!open) return;
	open.off();
	open.pr.destroy();
	open.el.remove();
	open = null;
}
export function openPopover(p: FlashcardPlugin, cards: Card[], anchor: HTMLElement) {
	closePopover();
	const el = document.body.createDiv("fch-modal fch-npop");
	const pr = new Practice(p, el, cards, { onClose: closePopover });
	pr.draw();
	const place = () => {
		const r = anchor.getBoundingClientRect();
		const w = el.offsetWidth, h = el.offsetHeight;
		let left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left - w + r.width));
		let top = r.bottom + 6;
		if (top + h > window.innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
		top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
		left = Math.max(8, left);
		el.style.left = `${left}px`;
		el.style.top = `${top}px`;
	};
	place();
	const ro = new ResizeObserver(place);
	ro.observe(el);
	const down = (e: MouseEvent) => { const t = e.target as Node; if (!el.contains(t) && !anchor.contains(t) && !(t as HTMLElement).closest?.(".modal-container, .menu")) closePopover(); };
	const key = (e: KeyboardEvent) => { if (document.querySelector(".modal-container")) return; if (pr.onKey(e)) { e.preventDefault(); e.stopPropagation(); } };
	window.setTimeout(() => document.addEventListener("mousedown", down, true), 0);
	document.addEventListener("keydown", key, true);
	open = { el, pr, off: () => { ro.disconnect(); document.removeEventListener("mousedown", down, true); document.removeEventListener("keydown", key, true); } };
}

// ================================================================ modal: semua kartu di catatan / seleksi
export class PracticeModal extends Modal {
	private pr: Practice | null = null;
	private filter: "all" | "due" | "new" | "later" = "all";
	constructor(app: App, private p: FlashcardPlugin, private cards: Card[], private title: string, private listMode = true) { super(app); }
	onOpen() {
		this.modalEl.addClass("fch-modal", "fch-np-modal");
		this.draw();
		this.scope.register([], null, (e) => { if (this.pr && this.pr.onKey(e)) return false; return true; });
	}
	private draw() {
		const el = this.contentEl;
		el.empty();
		this.pr?.destroy();
		const p = this.p;
		const st = this.cards.map((c) => statusOf(p, c));
		const n = { new: st.filter((s) => s.kind === "new").length, due: st.filter((s) => s.kind === "due").length, later: st.filter((s) => s.kind === "later").length };
		const head = el.createDiv("fch-np-mhead");
		const t = head.createDiv("fch-grow");
		t.createDiv({ cls: "fch-modal-title", text: `🧠 ${this.title}` });
		t.createDiv({ cls: "fch-small fch-muted", text: `${this.cards.length} kartu · ${n.due} jatuh tempo · ${n.new} baru · ${n.later} terjadwal` });
		const acts = head.createDiv("fch-row");
		const dueCards = this.cards.filter((_, i) => st[i].kind !== "later");
		btn(acts, { text: dueCards.length ? `Latih ${dueCards.length} yang perlu di tab` : `Latihan bebas ${this.cards.length} kartu`, icon: "play", cls: "fch-btn-primary fch-btn-sm", onClick: () => { this.close(); void practiceInHub(p, dueCards.length ? dueCards : this.cards, this.title); } });
		if (!this.cards.length) {
			el.createDiv({ cls: "fch-empty", text: "Belum ada kartu di catatan ini. Blok teks → klik kanan → pilih tipe kartu di bagian FLASHCARDS." });
			return;
		}
		const wrap = el.createDiv("fch-np-split" + (this.listMode ? "" : " is-single"));
		const host = (this.listMode ? wrap.createDiv("fch-np-pane") : wrap).createDiv("fch-np-practice");
		let list: HTMLElement | null = null;
		const visible = this.cards.filter((_, i) => this.filter === "all" || st[i].kind === this.filter);
		this.pr = new Practice(p, host, visible.length ? visible : this.cards, { title: this.title, onChange: () => drawList() });
		const drawList = () => {
			if (!list) return;
			list.empty();
			this.pr!.cards.forEach((c, i) => {
				const s = statusOf(p, c);
				const r = list!.createDiv("fch-np-row" + (i === this.pr!.idx ? " is-sel" : "") + (this.pr!.results.has(c.id) ? " is-done" : ""));
				r.createSpan({ cls: `fch-np-dot is-${s.kind}` });
				const tt = r.createDiv("fch-grow");
				tt.createDiv({ cls: "fch-np-rowt", text: c.occ ? `🖼️ ${plainText(c.front)}` : plainText(c.front).replace(/\[…\]/g, "[…]").slice(0, 90) || "—" });
				tt.createDiv({ cls: "fch-small fch-muted", text: `${TYPE_LABEL[c.type]} · ${this.pr!.results.get(c.id) ?? s.label}` });
				r.onclick = () => { this.pr!.go(i); drawList(); };
			});
		};
		if (this.listMode) {
			const side = wrap.createDiv("fch-np-side");
			const fl = side.createDiv("fch-np-filters");
			for (const [k, l] of [["all", `Semua ${this.cards.length}`], ["due", `Jatuh tempo ${n.due}`], ["new", `Baru ${n.new}`], ["later", `Terjadwal ${n.later}`]] as const) {
				const b = fl.createEl("button", { cls: "fch-np-filter" + (this.filter === k ? " is-on" : ""), text: l });
				b.onclick = () => { this.filter = k; this.draw(); };
			}
			list = side.createDiv("fch-np-list");
		}
		const origGo = this.pr.go.bind(this.pr);
		this.pr.go = (i: number) => { origGo(i); drawList(); };
		this.pr.draw();
		drawList();
	}
	onClose() { this.pr?.destroy(); this.contentEl.empty(); }
}

/** Kartu di catatan aktif / di seleksi editor. */
export function noteCards(p: FlashcardPlugin, file: TFile, text: string, range?: { from: number; to: number; lineFrom: number; lineTo: number }): Card[] {
	const placed = placeCards(p, file.path, text).sort((a, b) => a.from - b.from);
	const sel = range ? placed.filter((x) => (x.from <= range.to && x.to >= range.from) || (x.line >= range.lineFrom && x.line <= range.lineTo)) : placed;
	const seen = new Set<string>();
	const out = sel.map((x) => x.card).filter((c) => !seen.has(c.id) && !!seen.add(c.id));
	// kartu tanpa posisi (mis. teks sumber berubah) tetap ikut saat melihat seluruh catatan
	if (!range) for (const c of p.index.get(file.path) ?? []) if (!seen.has(c.id)) { seen.add(c.id); out.push(c); }
	return out;
}

// ================================================================ tombol kartu di editor
export function noteCardExtension(p: FlashcardPlugin) {
	class Chip extends WidgetType {
		constructor(readonly ids: string[], readonly kind: string) { super(); }
		eq(o: Chip) { return o.kind === this.kind && o.ids.join("|") === this.ids.join("|"); }
		toDOM() {
			const s = document.createElement("span");
			s.className = `fch-nchip is-${this.kind}`;
			s.setAttribute("aria-label", `${this.ids.length} flashcard · klik untuk pratinjau & latihan`);
			const ic = s.createSpan("fch-nchip-ic");
			setIcon(ic, "layers");
			s.createSpan({ text: this.ids.length > 1 ? String(this.ids.length) : this.kind === "due" ? "!" : "" });
			s.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
			s.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				const all = new Map<string, Card>();
				for (const cs of p.index.values()) for (const c of cs) all.set(c.id, c);
				const cards = this.ids.map((id) => all.get(id)).filter((c): c is Card => !!c);
				if (cards.length) openPopover(p, cards, s);
			});
			return s;
		}
		ignoreEvent() { return true; }
	}
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) { this.decorations = this.build(view); }
			update(u: ViewUpdate) {
				if (u.transactions.some((t) => t.effects.some((e) => e.is(refreshMarks)))) this.decorations = this.build(u.view);
				else if (u.docChanged) this.decorations = this.decorations.map(u.changes);
			}
			build(view: EditorView): DecorationSet {
				try {
					if (!p.data.settings.noteCardButtons) return Decoration.none;
					const file = view.state.field(editorInfoField, false)?.file;
					if (!file || !p.index.get(file.path)?.length) return Decoration.none;
					const doc = view.state.doc;
					const placed = placeCards(p, file.path, doc.toString());
					const byLine = new Map<number, Card[]>();
					for (const x of placed) (byLine.get(x.line) ?? byLine.set(x.line, []).get(x.line)!).push(x.card);
					const b = new RangeSetBuilder<Decoration>();
					for (const ln of [...byLine.keys()].sort((a, c) => a - c)) {
						if (ln + 1 > doc.lines) continue;
						const cards = byLine.get(ln)!;
						const kinds = cards.map((c) => statusOf(p, c).kind);
						const kind = kinds.includes("due") ? "due" : kinds.includes("new") ? "new" : "later";
						b.add(doc.line(ln + 1).to, doc.line(ln + 1).to, Decoration.widget({ widget: new Chip(cards.map((c) => c.id), kind), side: 1 }));
					}
					return b.finish();
				} catch {
					return Decoration.none;
				}
			}
		},
		{ decorations: (v) => v.decorations },
	);
}

/** Tombol “Kartu di catatan ini” di bilah atas setiap catatan (berfungsi juga di mode baca). */
const withAction = new WeakSet<MarkdownView>();
export function addViewActions(p: FlashcardPlugin) {
	for (const leaf of p.app.workspace.getLeavesOfType("markdown")) {
		const v = leaf.view as MarkdownView;
		if (withAction.has(v) || !v.addAction) continue;
		withAction.add(v);
		v.addAction("layers", "Flashcard di catatan ini: pratinjau & latih", () => void openNoteModal(p, v.file));
	}
}
export async function openNoteModal(p: FlashcardPlugin, file: TFile | null, range?: { from: number; to: number; lineFrom: number; lineTo: number }) {
	if (!file) return void new Notice("Buka sebuah catatan dulu.");
	const text = await p.app.vault.cachedRead(file);
	const view = p.app.workspace.getActiveViewOfType(MarkdownView);
	const live = view?.file?.path === file.path ? view.editor.getValue() : text;
	const cards = noteCards(p, file, live, range);
	if (range && !cards.length) return void new Notice("Tidak ada flashcard di baris/seleksi ini.");
	new PracticeModal(p.app, p, cards, range ? `Kartu di seleksi (${file.basename})` : file.basename, !range || cards.length > 1).open();
}
