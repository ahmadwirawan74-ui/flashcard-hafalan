import { Component } from "obsidian";
import type { HubView } from "./hub-view";
import { Game } from "./match";
import { Card, ChoiceOption } from "./types";
import { quizOptions } from "./learn";
import { btn, md, plainText, shuffle, basename, confetti } from "./util";
import { DAY, formatDuration, retention } from "./scheduler";
import { play } from "./sound";
import { cardFront } from "./occlusion";

interface Q { card: Card; options: ChoiceOption[]; picked: number | null; doubt: boolean }

/** Simulasi ujian: soal pilihan ganda campuran, waktu terbatas, tanpa umpan balik sampai selesai. */
export class ExamSim implements Game {
	ok: boolean;
	private qs: Q[] = [];
	private i = 0;
	private start = Date.now();
	private end: number;
	private done = 0;
	private el: HTMLElement | null = null;
	private comp: Component | null = null;
	private timer: number | null = null;
	private keyH = (e: KeyboardEvent) => this.onKey(e);

	constructor(private hub: HubView, cards: Card[], public title: string, count: number, minutes: number, private examDate?: string) {
		for (const c of shuffle([...cards])) {
			if (this.qs.length >= count) break;
			const options = quizOptions(hub.plugin, c, 4);
			if (options && options.filter((o) => o.correct).length === 1) this.qs.push({ card: c, options, picked: null, doubt: false });
		}
		this.ok = this.qs.length >= 5;
		this.end = this.start + minutes * 60_000;
	}

	mount(el: HTMLElement) {
		this.el = el;
		document.addEventListener("keydown", this.keyH, true);
		this.timer = window.setInterval(() => this.tick(), 500);
		this.draw();
	}

	unmount() {
		document.removeEventListener("keydown", this.keyH, true);
		if (this.timer) window.clearInterval(this.timer);
		this.comp?.unload();
		this.el = null;
	}

	private tick() {
		if (this.done) return;
		const left = this.end - Date.now();
		if (left <= 0) return this.submit();
		const t = this.el?.querySelector(".fch-sim-time");
		if (t) {
			t.setText(`⏳ ${formatDuration(left)}`);
			t.toggleClass("is-low", left < 60_000);
		}
	}

	private onKey(e: KeyboardEvent) {
		if (!this.el || this.done || e.ctrlKey || e.metaKey) return;
		const n = parseInt(e.key, 10);
		if (n >= 1 && n <= 4) { e.preventDefault(); this.pick(n - 1); }
		if (e.key === "ArrowRight") { e.preventDefault(); this.go(this.i + 1); }
		if (e.key === "ArrowLeft") { e.preventDefault(); this.go(this.i - 1); }
		if (e.key.toLowerCase() === "r") { e.preventDefault(); this.qs[this.i].doubt = !this.qs[this.i].doubt; this.draw(); }
	}

	private pick(k: number) {
		const q = this.qs[this.i];
		if (k >= q.options.length) return;
		q.picked = k;
		this.draw();
	}

	private go(i: number) {
		if (i < 0 || i >= this.qs.length) return;
		this.i = i;
		this.draw();
	}

	private submit() {
		if (this.done) return;
		this.done = Date.now();
		const p = this.hub.plugin;
		p.data.meta.simulations = (p.data.meta.simulations ?? 0) + 1;
		p.track("simulation");
		const score = this.qs.filter((q) => q.picked !== null && q.options[q.picked].correct).length;
		p.addCoins(Math.round((score / this.qs.length) * 30));
		play(score / this.qs.length >= 0.6 ? "victory" : "defeat");
		p.checkAchievements();
		this.draw();
	}

	private draw() {
		const root = this.el;
		if (!root) return;
		this.comp?.unload();
		this.comp = new Component();
		this.comp.load();
		root.empty();
		const wrap = root.createDiv("fch-sim");
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Keluar", onClick: () => this.hub.endGame() });
		const tt = top.createDiv("fch-study-title");
		tt.createDiv({ cls: "fch-study-name", text: `📝 Simulasi Ujian · ${this.title}` });
		tt.createDiv({ cls: "fch-muted fch-small", text: this.done ? "Selesai" : "Tanpa petunjuk & tanpa umpan balik sampai kamu menyerahkan jawaban." });
		const meta = top.createDiv("fch-study-meta");
		if (!this.done) meta.createSpan({ cls: "fch-sim-time", text: `⏳ ${formatDuration(this.end - Date.now())}` });
		if (this.done) return this.drawResult(wrap);

		const nav = wrap.createDiv("fch-sim-nav");
		this.qs.forEach((q, k) => {
			const b = nav.createEl("button", { cls: "fch-sim-dot" + (k === this.i ? " is-now" : "") + (q.picked !== null ? " is-done" : "") + (q.doubt ? " is-doubt" : ""), text: String(k + 1) });
			b.onclick = () => this.go(k);
		});
		const q = this.qs[this.i];
		const card = wrap.createDiv("fch-card fch-sim-card");
		const h = card.createDiv("fch-card-head");
		h.createSpan({ cls: "fch-type", text: `Soal ${this.i + 1} dari ${this.qs.length}` });
		h.createDiv({ cls: "fch-crumb", text: basename(q.card.path) });
		const body = card.createDiv("fch-card-body");
		cardFront(this.hub.plugin, this.comp, body, q.card);
		const list = body.createDiv("fch-choices");
		q.options.forEach((o, k) => {
			const b = list.createEl("button", { cls: "fch-choice" + (q.picked === k ? " is-picked" : "") });
			b.createSpan({ cls: "fch-choice-key", text: String(k + 1) });
			md(this.hub.app, this.comp!, b.createDiv("fch-choice-text markdown-rendered"), o.text, q.card.path);
			b.onclick = () => this.pick(k);
		});
		const foot = wrap.createDiv("fch-sim-foot");
		btn(foot, { text: "Sebelumnya", icon: "chevron-left", disabled: this.i === 0, onClick: () => this.go(this.i - 1) });
		btn(foot, { text: q.doubt ? "Ragu-ragu ✓" : "Ragu-ragu (R)", cls: q.doubt ? "fch-btn-warn" : "", onClick: () => { q.doubt = !q.doubt; this.draw(); } });
		foot.createDiv("fch-grow");
		const answered = this.qs.filter((x) => x.picked !== null).length;
		if (this.i < this.qs.length - 1) btn(foot, { text: "Berikutnya", icon: "chevron-right", cls: "fch-btn-primary", onClick: () => this.go(this.i + 1) });
		btn(foot, { text: `Serahkan (${answered}/${this.qs.length})`, icon: "check", cls: this.i === this.qs.length - 1 ? "fch-btn-primary" : "", onClick: () => {
			if (answered < this.qs.length && !window.confirm(`Masih ada ${this.qs.length - answered} soal belum dijawab. Serahkan sekarang?`)) return;
			this.submit();
		} });
	}

	private drawResult(wrap: HTMLElement) {
		const p = this.hub.plugin;
		const n = this.qs.length;
		const right = this.qs.filter((q) => q.picked !== null && q.options[q.picked].correct);
		const wrong = this.qs.filter((q) => !(q.picked !== null && q.options[q.picked].correct));
		const score = Math.round((right.length / n) * 100);
		// perkiraan nilai ujian: gabungan skor simulasi & perkiraan ingatan di hari ujian
		const at = this.examDate ? new Date(this.examDate + "T09:00:00").getTime() : Date.now();
		let rs = 0, rn = 0;
		for (const q of this.qs) { const r = retention(p.data.cards[q.card.id], at); if (r !== null) { rs += r; rn++; } }
		const predicted = Math.round(rn ? 0.6 * score + 40 * (rs / rn) : score);
		const grade = predicted >= 85 ? "A" : predicted >= 75 ? "B" : predicted >= 65 ? "C" : predicted >= 50 ? "D" : "E";
		const box = wrap.createDiv("fch-summary fch-sim-result");
		box.createDiv({ cls: "fch-sim-grade g-" + grade, text: grade });
		box.createEl("h2", { text: `Nilai simulasi: ${score}` });
		box.createEl("p", { cls: "fch-muted", text: `${right.length} benar dari ${n} soal · waktu ${formatDuration(this.done - this.start)} · 🪙 +${Math.round((right.length / n) * 30)}` });
		const pr = box.createDiv("fch-continue");
		pr.createDiv({ cls: "fch-strong", text: `Perkiraan nilai ujianmu: ±${predicted}` });
		pr.createDiv({ cls: "fch-muted fch-small", text: this.examDate ? `Menggabungkan nilai simulasi dengan perkiraan ingatanmu pada ${new Date(at).toLocaleDateString("id-ID", { day: "numeric", month: "long" })} (H-${Math.max(0, Math.round((at - Date.now()) / DAY))}). Ulasan rutin akan menaikkannya.` : "Menggabungkan nilai simulasi dengan perkiraan ingatanmu saat ini." });
		// per materi
		const by = new Map<string, { ok: number; n: number }>();
		for (const q of this.qs) { const e = by.get(q.card.path) ?? by.set(q.card.path, { ok: 0, n: 0 }).get(q.card.path)!; e.n++; if (right.includes(q)) e.ok++; }
		const t = box.createDiv("fch-panel fch-sim-by");
		t.createEl("h3", { text: "Per materi" });
		for (const [path, e] of [...by.entries()].sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)) {
			const r = t.createDiv("fch-typeacc");
			r.createSpan({ cls: "fch-typeacc-l", text: basename(path) });
			const b = r.createDiv("fch-bar fch-grow");
			const f = b.createDiv("fch-bar-fill");
			f.style.width = `${(e.ok / e.n) * 100}%`;
			f.style.background = e.ok / e.n >= 0.8 ? "var(--fch-g2)" : e.ok / e.n >= 0.6 ? "var(--fch-g1)" : "var(--fch-g0)";
			r.createSpan({ cls: "fch-typeacc-v", text: `${e.ok}/${e.n}` });
		}
		if (wrong.length) {
			const w = box.createDiv("fch-panel fch-sim-wrong");
			w.createEl("h3", { text: `Pembahasan soal yang salah (${wrong.length})` });
			for (const q of wrong.slice(0, 30)) {
				const r = w.createDiv("fch-sim-w");
				r.createDiv({ cls: "fch-strong fch-small", text: plainText(q.card.front).slice(0, 160) });
				const right = q.options.find((o) => o.correct)!;
				if (q.picked !== null) r.createDiv({ cls: "fch-small fch-sim-bad", text: "✗ " + plainText(q.options[q.picked].text) });
				else r.createDiv({ cls: "fch-small fch-muted", text: "— tidak dijawab" });
				r.createDiv({ cls: "fch-small fch-sim-ok", text: "✓ " + plainText(right.text) });
			}
		}
		const row = box.createDiv("fch-row fch-center");
		if (wrong.length) btn(row, { text: `Latih ${wrong.length} soal yang salah`, icon: "zap", cls: "fch-btn-primary", onClick: () => this.hub.startSession(wrong.map((q) => q.card), { title: "Pembahasan simulasi", cram: true, mode: "classic" }) });
		btn(row, { text: "Selesai", onClick: () => this.hub.endGame() });
		if (score >= 85 && p.data.settings.confetti) confetti(this.el!);
	}
}
