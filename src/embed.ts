import { MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownRenderer } from "obsidian";
import type FlashcardPlugin from "./main";
import { Card, ChoiceOption } from "./types";
import { quizOptions } from "./learn";
import { plainText, shuffle } from "./util";
import { play } from "./sound";

/**
 * Blok kode ```flashcard-kuis
 *   materi: [[01 Sel]], Biologi/02 Fotosintesis   (opsional; bawaan = kartu di catatan ini)
 *   jumlah: 5                                      (opsional)
 *   Ibu kota Jepang :: Tokyo                       (opsional; kartu langsung di dalam blok)
 * ```
 */
export function registerEmbed(p: FlashcardPlugin) {
	p.registerMarkdownCodeBlockProcessor("flashcard-kuis", (src, el, ctx) => {
		ctx.addChild(new EmbedQuiz(el, p, src, ctx));
	});
}

class EmbedQuiz extends MarkdownRenderChild {
	private cards: Card[] = [];
	private qs: { card: Card; options: ChoiceOption[] | null }[] = [];
	private i = 0;
	private score = 0;
	private picked: number | null = null;
	private revealed = false;

	constructor(el: HTMLElement, private p: FlashcardPlugin, private src: string, private ctx: MarkdownPostProcessorContext) {
		super(el);
	}

	onload() {
		const lines = this.src.split("\n").map((l) => l.trim()).filter(Boolean);
		let count = 5;
		const mats: string[] = [];
		const inline: Card[] = [];
		for (const l of lines) {
			const kv = /^(materi|jumlah)\s*:\s*(.+)$/i.exec(l);
			if (kv) {
				if (kv[1].toLowerCase() === "jumlah") count = Math.max(1, Math.min(50, parseInt(kv[2], 10) || 5));
				else for (const part of kv[2].split(",")) {
					const name = part.trim().replace(/^\[\[|\]\]$/g, "").split("|")[0];
					const f = this.p.app.metadataCache.getFirstLinkpathDest(name, this.ctx.sourcePath);
					if (f) mats.push(f.path);
				}
				continue;
			}
			const k = l.indexOf("::");
			if (k > 0) inline.push({ id: `embed:${l}`, path: this.ctx.sourcePath, line: 0, order: inline.length, type: "basic", front: l.slice(0, k).trim(), back: l.slice(k + 2).trim(), context: [] });
		}
		if (inline.length) this.cards = inline;
		else if (mats.length) this.cards = mats.flatMap((x) => this.p.index.get(x) ?? []);
		else this.cards = this.p.index.get(this.ctx.sourcePath) ?? this.p.allCards();
		this.cards = this.cards.filter((c) => c.type !== "occlusion");
		const pick = shuffle([...this.cards]).slice(0, count);
		this.qs = pick.map((card) => ({ card, options: inline.length ? this.inlineOptions(card, inline) : quizOptions(this.p, card, 4) }));
		this.draw();
	}

	private inlineOptions(card: Card, all: Card[]): ChoiceOption[] | null {
		const others = shuffle(all.filter((c) => c !== card && c.back !== card.back)).slice(0, 3);
		if (others.length < 2) return null;
		return shuffle([{ text: card.back, correct: true }, ...others.map((c) => ({ text: c.back, correct: false }))]);
	}

	private draw() {
		const el = this.containerEl;
		el.empty();
		el.addClass("fch-embed");
		const head = el.createDiv("fch-embed-head");
		head.createSpan({ text: "🧠 Kuis cepat" });
		head.createSpan({ cls: "fch-embed-score", text: this.qs.length ? `${Math.min(this.i + 1, this.qs.length)}/${this.qs.length} · ✓ ${this.score}` : "" });
		if (!this.qs.length) {
			el.createDiv({ cls: "fch-embed-empty", text: "Belum ada kartu. Tulis kartu di dalam blok (Pertanyaan :: Jawaban) atau isi `materi: [[Nama catatan]]`." });
			return;
		}
		if (this.i >= this.qs.length) {
			const pct = Math.round((this.score / this.qs.length) * 100);
			el.createDiv({ cls: "fch-embed-done", text: `${pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "🌱"} Skor ${this.score}/${this.qs.length} (${pct}%)` });
			const again = el.createEl("button", { cls: "fch-embed-btn", text: "↻ Ulangi" });
			again.onclick = () => { this.i = 0; this.score = 0; this.qs = shuffle(this.qs); this.draw(); };
			return;
		}
		const q = this.qs[this.i];
		const front = el.createDiv("fch-embed-q");
		void MarkdownRenderer.render(this.p.app, q.card.front, front, this.ctx.sourcePath, this);
		if (q.options) {
			const list = el.createDiv("fch-embed-opts");
			q.options.forEach((o, k) => {
				let cls = "fch-embed-opt";
				if (this.picked !== null && o.correct) cls += " is-correct";
				if (this.picked === k && !o.correct) cls += " is-wrong";
				const b = list.createEl("button", { cls, text: `${k + 1}. ${plainText(o.text)}` });
				b.disabled = this.picked !== null;
				b.onclick = () => {
					this.picked = k;
					if (o.correct) this.score++;
					play(o.correct ? "correct" : "wrong");
					this.draw();
				};
			});
		} else if (!this.revealed) {
			const b = el.createEl("button", { cls: "fch-embed-btn", text: "Tampilkan jawaban" });
			b.onclick = () => { this.revealed = true; this.draw(); };
		} else {
			const a = el.createDiv("fch-embed-a");
			void MarkdownRenderer.render(this.p.app, q.card.type === "cloze" ? q.card.back : q.card.back, a, this.ctx.sourcePath, this);
			const row = el.createDiv("fch-embed-row");
			for (const [t, ok] of [["✗ Lupa", false], ["✓ Ingat", true]] as const) {
				const b = row.createEl("button", { cls: "fch-embed-btn", text: t });
				b.onclick = () => { if (ok) this.score++; play(ok ? "correct" : "wrong"); this.revealed = false; this.i++; this.draw(); };
			}
		}
		if (this.picked !== null) {
			const n = el.createEl("button", { cls: "fch-embed-btn is-next", text: "Lanjut →" });
			n.onclick = () => { this.picked = null; this.i++; this.draw(); };
		}
	}
}
