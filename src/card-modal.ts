import { App, Component, Modal, Notice, setIcon } from "obsidian";
import type FlashcardPlugin from "./main";
import { Anchor, ChoiceOption, StoredCard, TYPE_LABEL } from "./types";
import { DraftKind, ITEM_RE, parseCards } from "./parser";
import { TEMPLATES } from "./templates";
import { Source, cleanBlock, cleanLine, clozeOf } from "./anchor";
import { btn, md, plainText, shuffle } from "./util";

export type NewCard = Omit<StoredCard, "id" | "path" | "created">;

export interface ModalInit {
	path: string;
	kind: DraftKind;
	source?: Source;
	edit?: StoredCard;
}

interface State {
	kind: DraftKind;
	question: string;
	answer: string;
	both: boolean;
	items: string[];
	options: ChoiceOption[];
	explanation: string;
	hint: string;
	wide: boolean;
	text: string; // cloze tanpa sumber: kalimat dengan {{ }}
}

const sentenceBlank = (src: Source, mark = "___") =>
	cleanBlock(src.sentence.slice(0, src.sentencePos) + mark + src.sentence.slice(src.sentencePos + src.selection.length));

/** Modal pembuat kartu: dari teks terpilih, kosong, atau untuk mengedit kartu tersimpan. */
export class CardModal extends Modal {
	private st: State;
	private src?: Source;
	private comp = new Component();
	private body!: HTMLElement;
	private prev!: HTMLElement;

	constructor(app: App, private plugin: FlashcardPlugin, private init: ModalInit) {
		super(app);
		this.src = init.source;
		if (!this.src && init.edit?.anchor) {
			const a = init.edit.anchor;
			this.src = { selection: a.answer, sentence: a.text, sentencePos: a.pos, paragraph: a.text, paragraphPos: a.pos, lineBefore: "", heading: "", multiLine: a.answer.includes("\n"), isList: false };
		}
		this.st = init.edit ? this.fromStored(init.edit) : this.fromSource(init.kind);
	}

	// ---------- isi awal ----------
	private blank(kind: DraftKind): State {
		return {
			kind, question: "", answer: "", both: false, items: ["", "", ""],
			options: [{ text: "", correct: true }, { text: "", correct: false }, { text: "", correct: false }, { text: "", correct: false }],
			explanation: "", hint: "", wide: false, text: "",
		};
	}

	private fromSource(kind: DraftKind): State {
		const st = this.blank(kind);
		const s = this.src;
		if (!s) return st;
		const sel = s.selection.trim();
		const before = cleanLine(s.sentence.slice(0, s.sentencePos)).trim().replace(/[,:;–-]\s*$/, "");
		const q = before ? `${before} …` : sentenceBlank(s, "…");
		const listQ = s.lineBefore || s.heading;
		st.question = s.multiLine ? listQ : q;
		st.answer = s.multiLine ? sel : cleanLine(sel);
		if (s.multiLine || s.isList) st.items = sel.split("\n").map((l) => (ITEM_RE.exec(l)?.[1] ?? l).trim()).filter(Boolean);
		else st.items = cleanLine(sel).split(/\s*[,;]\s*|\s+(?:dan|serta|atau)\s+/).map((x) => x.trim()).filter(Boolean);
		if (st.items.length < 2) st.items = [...st.items, ""];
		if (kind === "list" && (s.multiLine || s.isList)) st.question = listQ;
		st.options = [{ text: cleanLine(sel), correct: true }, ...this.suggest(cleanLine(sel), 3).map((t) => ({ text: t, correct: false }))];
		while (st.options.length < 4) st.options.push({ text: "", correct: false });
		if (kind === "mcq") st.question = sentenceBlank(s);
		return st;
	}

	private fromStored(sc: StoredCard): State {
		const kind: DraftKind = sc.type === "cloze" ? "cloze" : sc.type === "list" ? "list" : sc.type === "mcq" ? "mcq" : sc.type === "multiline" ? "multi" : "single";
		const st = this.blank(kind);
		const group = sc.group ? Object.values(this.plugin.data.stored).filter((x) => x.group === sc.group) : [sc];
		const main = group.find((x) => x.type !== "reversed") ?? sc;
		st.question = main.front;
		st.answer = main.back;
		st.both = group.length > 1;
		if (main.items) st.items = [...main.items];
		if (main.options) st.options = main.options.map((o) => ({ ...o }));
		st.explanation = main.explanation ?? "";
		if (kind === "cloze") {
			st.hint = /fc-cloze">\[([^\]]*)\]/.exec(main.front)?.[1].replace("…", "") ?? "";
			st.wide = false;
			if (!main.anchor) st.text = main.back.replace(/<span class="fc-cloze-ans">(.*?)<\/span>/g, "{{$1}}");
		}
		return st;
	}

	/** Pengecoh pilihan ganda: variasi angka, lalu jawaban kartu lain di materi/folder yang sama. */
	private suggest(correct: string, n: number): string[] {
		const key = correct.toLowerCase();
		const out: string[] = [];
		const seen = new Set([key]);
		const push = (t: string) => {
			const k = t.toLowerCase().trim();
			if (!k || seen.has(k) || out.length >= n) return;
			seen.add(k);
			out.push(t.trim());
		};
		if (/\d/.test(correct)) {
			const fns = [(x: number) => x * 2, (x: number) => x + (x < 10 ? 1 : Math.round(x * 0.2)), (x: number) => Math.max(1, Math.round(x / 2)), (x: number) => x * 3];
			for (const f of fns) push(correct.replace(/\d+(?:[.,]\d+)?/g, (m) => (/[.,]/.test(m) ? m : String(f(parseInt(m, 10))))));
		}
		const folder = this.init.path.includes("/") ? this.init.path.slice(0, this.init.path.lastIndexOf("/") + 1) : "";
		const same = this.plugin.index.get(this.init.path) ?? [];
		const near = this.plugin.allCards().filter((c) => c.path !== this.init.path && c.path.startsWith(folder) && !!folder);
		const len = correct.length;
		for (const group of [same, near]) {
			const cand = shuffle(group.filter((c) => c.type !== "list" && c.type !== "mcq").map((c) => plainText(c.answer ?? c.back)).filter((t) => t && t.length < 80));
			cand.sort((a, b) => Math.abs(a.length - len) - Math.abs(b.length - len));
			cand.forEach(push);
		}
		return out;
	}

	// ---------- kartu yang dihasilkan ----------
	private anchor(): Anchor | undefined {
		const s = this.src;
		if (!s || !s.selection.trim()) return undefined;
		if (this.st.kind === "cloze" && this.st.wide) return { text: s.paragraph, answer: s.selection, pos: s.paragraphPos };
		return { text: s.sentence, answer: s.selection, pos: s.sentencePos };
	}

	build(): NewCard[] {
		const st = this.st;
		const anchor = this.anchor();
		const q = st.question.trim();
		switch (st.kind) {
			case "single":
			case "multi": {
				const a = st.answer.trim();
				if (!q || !a) return [];
				const type = st.kind === "single" ? "basic" : "multiline";
				const out: NewCard[] = [{ type, front: q, back: a, anchor }];
				if (st.both) out.push({ type: "reversed", front: a, back: q, anchor });
				return out;
			}
			case "list": {
				const items = st.items.map((i) => i.trim()).filter(Boolean);
				if (!q || items.length < 2) return [];
				return [{ type: "list", front: q, back: items.map((i) => `- ${i}`).join("\n"), items, answer: items.join("; "), anchor }];
			}
			case "mcq": {
				const options = st.options.map((o) => ({ text: o.text.trim(), correct: o.correct })).filter((o) => o.text);
				if (!q || options.length < 2 || !options.some((o) => o.correct)) return [];
				const right = options.filter((o) => o.correct).map((o) => o.text);
				const ex = st.explanation.trim();
				return [{ type: "mcq", front: q, back: right.map((r) => "✓ " + r).join("\n\n") + (ex ? "\n\n" + ex : ""), options, explanation: ex, answer: right.join("; "), anchor }];
			}
			case "occlusion":
				return [];
			case "cloze": {
				const s = this.src;
				if (s && s.selection.trim()) {
					const ctx = st.wide ? s.paragraph : s.sentence;
					const pos = st.wide ? s.paragraphPos : s.sentencePos;
					const { front, back } = clozeOf(ctx, pos, s.selection, st.hint.trim());
					return [{ type: "cloze", front, back, answer: cleanLine(s.selection.trim()), anchor }];
				}
				const text = st.text.replace(/\s*\n\s*/g, " ").trim();
				if (!/\{\{.+?\}\}/.test(text)) return [];
				return parseCards(text, "x.md", { ...this.plugin.data.settings, enableCloze: true })
					.map((c) => ({ type: c.type, front: c.front, back: c.back, answer: c.answer }));
			}
		}
	}

	// ---------- tampilan ----------
	onOpen() {
		this.comp.load();
		this.modalEl.addClass("fch-modal");
		const el = this.contentEl;
		el.empty();
		const head = el.createDiv("fch-modal-head");
		head.createDiv({ cls: "fch-modal-title", text: this.init.edit ? "Edit flashcard" : "Buat flashcard" });
		head.createDiv({ cls: "fch-muted fch-small", text: this.init.path.replace(/\.md$/, "") + " · catatan tidak diubah" });

		if (this.src && this.src.selection.trim()) {
			const q = el.createDiv("fch-source");
			const s = this.src;
			q.createSpan({ text: cleanLine(s.sentence.slice(0, s.sentencePos)) });
			q.createEl("mark", { text: s.selection });
			q.createSpan({ text: s.sentence.slice(s.sentencePos + s.selection.length) });
		}

		const kinds = el.createDiv("fch-kinds fch-kinds-modal");
		for (const t of TEMPLATES) {
			if (t.kind === "occlusion" && this.init.edit) continue;
			const b = kinds.createEl("button", { cls: "fch-kind" + (this.st.kind === t.kind ? " is-active" : "") });
			setIcon(b.createSpan("fch-kind-ic"), t.icon);
			b.createSpan({ text: t.label });
			b.onclick = () => {
				if (t.kind === "occlusion") {
					this.close();
					this.plugin.openOcclusion(this.init.path);
					return;
				}
				const keep = this.init.edit ? this.st : null;
				this.st = keep ? { ...keep, kind: t.kind } : this.fromSource(t.kind);
				kinds.querySelectorAll(".fch-kind").forEach((x) => x.removeClass("is-active"));
				b.addClass("is-active");
				this.drawFields();
			};
		}
		this.body = el.createDiv("fch-modal-body");
		this.prev = el.createDiv("fch-modal-preview");
		const foot = el.createDiv("fch-modal-foot");
		if (this.init.edit) btn(foot, { text: "Hapus", icon: "trash-2", cls: "fch-btn-ghost fch-danger", onClick: () => { this.plugin.deleteStored(this.init.edit!); this.close(); } });
		foot.createDiv("fch-grow");
		btn(foot, { text: "Batal", cls: "fch-btn-ghost", onClick: () => this.close() });
		const save = btn(foot, { text: "Simpan", icon: "check", cls: "fch-btn-primary", onClick: () => this.save() });
		save.createSpan({ cls: "fch-kbd", text: "Ctrl+Enter" });
		this.modalEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.save();
			}
		});
		this.drawFields();
	}

	onClose() {
		this.comp.unload();
		this.contentEl.empty();
	}

	private drawFields() {
		const el = this.body;
		el.empty();
		const st = this.st;
		const field = (label: string) => {
			const f = el.createDiv("fch-field");
			f.createEl("label", { text: label });
			return f;
		};
		const input = (parent: HTMLElement, value: string, ph: string, on: (v: string) => void, area = false, rows = 2) => {
			const i = area
				? parent.createEl("textarea", { cls: "fch-input", attr: { placeholder: ph, rows: String(rows) } })
				: parent.createEl("input", { type: "text", cls: "fch-input", attr: { placeholder: ph } });
			i.value = value;
			i.oninput = () => { on(i.value); this.drawPreview(); };
			if (!area) i.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Enter" && !(e as KeyboardEvent).ctrlKey && !i.closest(".fch-items")) { e.preventDefault(); this.save(); } });
			return i;
		};
		const toggle = (label: string, desc: string, get: () => boolean, set: (v: boolean) => void) => {
			const t = el.createEl("label", { cls: "fch-toggle" });
			const cb = t.createEl("input", { type: "checkbox" });
			cb.checked = get();
			cb.onchange = () => { set(cb.checked); this.drawPreview(); };
			const tx = t.createDiv();
			tx.createDiv({ cls: "fch-strong", text: label });
			tx.createDiv({ cls: "fch-muted fch-small", text: desc });
		};
		const rows = (label: string, list: { get: () => string; set: (v: string) => void; correct?: ChoiceOption }[], add: () => void, remove: (i: number) => void, min: number) => {
			const f = field(label);
			const box = f.createDiv("fch-items");
			list.forEach((it, i) => {
				const r = box.createDiv("fch-item" + (it.correct?.correct ? " is-correct" : ""));
				if (it.correct) {
					const cb = r.createEl("input", { type: "checkbox", attr: { "aria-label": "Jawaban benar" } });
					cb.checked = it.correct.correct;
					cb.onchange = () => { it.correct!.correct = cb.checked; r.toggleClass("is-correct", cb.checked); this.drawPreview(); };
				} else r.createSpan({ cls: "fch-item-n", text: `${i + 1}.` });
				const inp = input(r, it.get(), it.correct ? `Pilihan ${String.fromCharCode(65 + i)}` : `Item ${i + 1}`, it.set);
				inp.addClass("fch-grow");
				inp.addEventListener("keydown", (e) => {
					if ((e as KeyboardEvent).key === "Enter" && !(e as KeyboardEvent).ctrlKey) {
						e.preventDefault();
						add();
						this.drawFields();
						const all = this.body.querySelectorAll<HTMLInputElement>(".fch-items .fch-input");
						all[i + 1]?.focus();
					}
				});
				btn(r, { icon: "x", cls: "fch-btn-ghost fch-btn-sm", label: "Hapus", disabled: list.length <= min, onClick: () => { remove(i); this.drawFields(); } });
			});
			btn(f, { text: "Tambah", icon: "plus", cls: "fch-btn-sm", onClick: () => { add(); this.drawFields(); } });
		};

		let first: HTMLElement | null = null;
		switch (st.kind) {
			case "single":
				first = input(field("Pertanyaan"), st.question, "Tulis pertanyaan", (v) => (st.question = v));
				input(field("Jawaban"), st.answer, "Jawaban", (v) => (st.answer = v));
				toggle("Dua arah", "Buat juga kartu kebalikannya.", () => st.both, (v) => (st.both = v));
				break;
			case "multi":
				first = input(field("Pertanyaan"), st.question, "Tulis pertanyaan", (v) => (st.question = v), true, 2);
				input(field("Jawaban"), st.answer, "Jawaban", (v) => (st.answer = v), true, 5);
				toggle("Dua arah", "Buat juga kartu kebalikannya.", () => st.both, (v) => (st.both = v));
				break;
			case "list":
				first = input(field("Pertanyaan"), st.question, "mis. Sebutkan gejala lepra", (v) => (st.question = v));
				rows("Item jawaban (berurutan)", st.items.map((_, i) => ({ get: () => st.items[i], set: (v: string) => (st.items[i] = v) })),
					() => st.items.push(""), (i) => st.items.splice(i, 1), 2);
				break;
			case "mcq":
				first = input(field("Pertanyaan"), st.question, "Tulis pertanyaan", (v) => (st.question = v), true, 2);
				rows("Pilihan — centang yang benar", st.options.map((o) => ({ get: () => o.text, set: (v: string) => (o.text = v), correct: o })),
					() => st.options.push({ text: "", correct: false }), (i) => st.options.splice(i, 1), 2);
				input(field("Penjelasan (opsional)"), st.explanation, "Ditampilkan setelah menjawab", (v) => (st.explanation = v), true, 2);
				break;
			case "cloze":
				if (this.src && this.src.selection.trim()) {
					first = input(field("Petunjuk (opsional)"), st.hint, "mis. nama bakteri", (v) => (st.hint = v));
					if (this.src.paragraph.trim() !== this.src.sentence.trim())
						toggle("Pakai seluruh paragraf", "Tampilkan paragraf lengkap sebagai konteks, bukan satu kalimat saja.", () => st.wide, (v) => (st.wide = v));
				} else {
					const f = field("Kalimat — bungkus jawaban dengan {{ }}");
					first = input(f, st.text, "Lepra disebabkan oleh {{Mycobacterium leprae}}.", (v) => (st.text = v), true, 3);
				}
				break;
		}
		this.drawPreview();
		window.setTimeout(() => (first as HTMLInputElement | null)?.focus(), 20);
	}

	private drawPreview() {
		const el = this.prev;
		el.empty();
		this.comp.unload();
		this.comp = new Component();
		this.comp.load();
		const cards = this.build();
		if (!cards.length) {
			el.createDiv({ cls: "fch-muted fch-small", text: "Lengkapi isian untuk melihat pratinjau kartu." });
			return;
		}
		const c = cards[0];
		const k = el.createDiv("fch-pcard");
		const h = k.createDiv("fch-row");
		h.createSpan({ cls: `fch-type fch-type-${c.type}`, text: TYPE_LABEL[c.type] });
		if (cards.length > 1) h.createSpan({ cls: "fch-muted fch-small", text: `+${cards.length - 1} kartu` });
		md(this.app, this.comp, k.createDiv("markdown-rendered fch-pcard-front"), c.front, this.init.path);
		const back = k.createDiv("fch-pcard-back");
		if (c.options) c.options.forEach((o) => back.createDiv({ cls: "fch-pcard-opt" + (o.correct ? " is-correct" : ""), text: (o.correct ? "✓ " : "○ ") + o.text }));
		else if (c.items) {
			const ol = back.createEl("ol");
			c.items.forEach((i) => ol.createEl("li", { text: i }));
		} else md(this.app, this.comp, back.createDiv("markdown-rendered"), c.back, this.init.path);
	}

	private save() {
		const cards = this.build();
		if (!cards.length) {
			new Notice("Kartu belum lengkap.");
			return;
		}
		this.plugin.saveStored(this.init.path, cards, this.init.edit);
		new Notice(this.init.edit ? "✓ Flashcard diperbarui" : `✓ ${cards.length > 1 ? cards.length + " flashcard" : "Flashcard"} dibuat`);
		this.close();
	}
}
