import { Component } from "obsidian";
import type { HubView } from "./hub-view";
import { Game } from "./match";
import { Pair } from "./analytics";
import { tokens } from "./learn";
import { btn, confetti, md, plainText, shuffle } from "./util";
import { play } from "./sound";
import { cardFront } from "./occlusion";

/** Bedakan yang Mirip: tebak jawaban ini milik kartu A atau B, lalu lihat perbedaannya berdampingan. */
export class ContrastGame implements Game {
	ok: boolean;
	private pairs: Pair[];
	private i = 0;
	private which: 0 | 1 = 0;
	private picked: 0 | 1 | null = null;
	private score = 0;
	private el: HTMLElement | null = null;
	private comp: Component | null = null;
	private keyH = (e: KeyboardEvent) => this.onKey(e);

	constructor(private hub: HubView, pairs: Pair[]) {
		this.pairs = shuffle([...pairs]).slice(0, 10);
		this.ok = this.pairs.length > 0;
		this.which = Math.random() < 0.5 ? 0 : 1;
	}
	mount(el: HTMLElement) { this.el = el; document.addEventListener("keydown", this.keyH, true); this.draw(); }
	unmount() { document.removeEventListener("keydown", this.keyH, true); this.comp?.unload(); this.el = null; }

	private onKey(e: KeyboardEvent) {
		if (!this.el || e.ctrlKey || e.metaKey) return;
		if (this.i >= this.pairs.length) return;
		if (this.picked === null) {
			if (e.key === "1" || e.key === "ArrowLeft") { e.preventDefault(); this.pick(0); }
			if (e.key === "2" || e.key === "ArrowRight") { e.preventDefault(); this.pick(1); }
		} else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.next(); }
	}
	private pick(k: 0 | 1) {
		this.picked = k;
		const ok = k === this.which;
		if (ok) this.score++;
		else { const pr = this.pairs[this.i]; this.hub.plugin.logConfusion(pr.a.id, pr.b.id); }
		play(ok ? "correct" : "wrong");
		this.draw();
	}
	private next() {
		this.i++;
		this.picked = null;
		this.which = Math.random() < 0.5 ? 0 : 1;
		if (this.i >= this.pairs.length) {
			const p = this.hub.plugin;
			p.data.meta.contrasts = (p.data.meta.contrasts ?? 0) + 1;
			p.addCoins(this.score * 2);
			p.checkAchievements();
			play(this.score >= this.pairs.length * 0.7 ? "victory" : "chime");
		}
		this.draw();
	}

	private draw() {
		const root = this.el;
		if (!root) return;
		this.comp?.unload();
		this.comp = new Component();
		this.comp.load();
		root.empty();
		const wrap = root.createDiv("fch-contrast");
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Keluar", onClick: () => this.hub.endGame() });
		const tt = top.createDiv("fch-study-title");
		tt.createDiv({ cls: "fch-study-name", text: "⚖️ Bedakan yang Mirip" });
		tt.createDiv({ cls: "fch-muted fch-small", text: `Pasangan ${Math.min(this.i + 1, this.pairs.length)} dari ${this.pairs.length} · skor ${this.score}` });
		if (this.i >= this.pairs.length) {
			const box = wrap.createDiv("fch-summary");
			box.createDiv({ cls: "fch-sum-emoji", text: this.score === this.pairs.length ? "🏆" : "⚖️" });
			box.createEl("h2", { text: `${this.score}/${this.pairs.length} berhasil dibedakan` });
			box.createEl("p", { cls: "fch-muted", text: `🪙 +${this.score * 2}. Pasangan yang masih tertukar akan muncul lagi di sini.` });
			const r = box.createDiv("fch-row fch-center");
			btn(r, { text: "Latih semua kartu ini", icon: "zap", cls: "fch-btn-primary", onClick: () => this.hub.startSession(this.pairs.flatMap((x) => [x.a, x.b]), { title: "Bedakan yang mirip", cram: true, mode: "classic", interleave: true }) });
			btn(r, { text: "Selesai", onClick: () => this.hub.endGame() });
			if (this.score === this.pairs.length && this.hub.plugin.data.settings.confetti) confetti(root);
			return;
		}
		const pr = this.pairs[this.i];
		const cards = [pr.a, pr.b];
		const target = cards[this.which];
		const q = wrap.createDiv("fch-contrast-q");
		q.createDiv({ cls: "fch-muted fch-small", text: `Jawaban ini milik kartu mana? (${pr.reason})` });
		this.render(q.createDiv("fch-contrast-ans markdown-rendered"), target.type === "cloze" ? target.answer ?? target.back : target.answer ?? target.back, target.path);
		const cols = wrap.createDiv("fch-contrast-cols");
		const other = new Set(tokens(plainText(cards[1 - this.which].answer ?? cards[1 - this.which].back)));
		cards.forEach((c, k) => {
			let cls = "fch-contrast-card";
			if (this.picked !== null) cls += k === this.which ? " is-correct" : this.picked === k ? " is-wrong" : "";
			const b = cols.createEl("button", { cls });
			b.createDiv({ cls: "fch-contrast-key", text: k === 0 ? "A · 1" : "B · 2" });
			cardFront(this.hub.plugin, this.comp!, b, c, { question: false });
			if (this.picked !== null) {
				const ans = b.createDiv("fch-contrast-back");
				const words = plainText(c.answer ?? c.back).split(/\s+/);
				const mine = new Set(tokens(plainText(cards[1 - k].answer ?? cards[1 - k].back)));
				for (const w of words) ans.createSpan({ cls: tokens(w).some((t) => !(k === this.which ? other : mine).has(t)) ? "is-diff" : "", text: w + " " });
			}
			b.disabled = this.picked !== null;
			b.onclick = () => this.pick(k as 0 | 1);
		});
		if (this.picked !== null) {
			const tip = wrap.createDiv("fch-tipline");
			tip.setText(this.picked === this.which ? "✓ Tepat! Kata yang disorot adalah pembeda utama kedua kartu." : "✗ Tertukar. Perhatikan kata yang disorot, itulah pembedanya.");
			const b = btn(wrap.createDiv("fch-actions"), { text: "Lanjut", cls: "fch-btn-primary fch-btn-xl", onClick: () => this.next() });
			b.createSpan({ cls: "fch-kbd", text: "Enter" });
		}
	}
	private render(el: HTMLElement, text: string, path: string) {
		md(this.hub.app, this.comp!, el, text, path);
	}
}
