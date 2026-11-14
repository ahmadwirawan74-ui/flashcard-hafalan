import { Component, Notice } from "obsidian";
import type { HubView } from "./hub-view";
import { Game } from "./match";
import { Card, ChoiceOption } from "./types";
import { quizOptions } from "./learn";
import { mascotState } from "./missions";
import { btn, confetti, md, shuffle } from "./util";
import { formatDuration } from "./scheduler";
import { play } from "./sound";
import { cardFront } from "./occlusion";

interface Q { card: Card; options: ChoiceOption[] }
const build = (hub: HubView, cards: Card[], n: number): Q[] => {
	const out: Q[] = [];
	for (const c of shuffle([...cards])) {
		const o = quizOptions(hub.plugin, c, 4);
		if (o && o.filter((x) => x.correct).length === 1) out.push({ card: c, options: o });
		if (out.length >= n) break;
	}
	return out;
};

/** Balapan melawan "hantu" dirimu sendiri dari sesi sebelumnya. */
export class RaceGame implements Game {
	ok: boolean;
	private qs: Q[];
	private i = 0;
	private correct = 0;
	private times: number[] = [];
	private start = 0;
	private end = 0;
	private picked: number | null = null;
	private ghost: { times: number[]; correct: number; total: number; t: number } | undefined;
	private el: HTMLElement | null = null;
	private comp: Component | null = null;
	private timer: number | null = null;
	private keyH = (e: KeyboardEvent) => this.onKey(e);

	constructor(private hub: HubView, cards: Card[], public title: string, private key: string) {
		this.qs = build(hub, cards, 12);
		this.ok = this.qs.length >= 5;
		this.ghost = hub.plugin.data.meta.ghosts?.[key];
	}
	mount(el: HTMLElement) {
		this.el = el;
		document.addEventListener("keydown", this.keyH, true);
		this.timer = window.setInterval(() => this.moveTrack(), 120);
		this.draw();
	}
	unmount() { document.removeEventListener("keydown", this.keyH, true); if (this.timer) window.clearInterval(this.timer); this.comp?.unload(); this.el = null; }

	private onKey(e: KeyboardEvent) {
		if (!this.el || e.ctrlKey || e.metaKey) return;
		if (!this.start && (e.key === " " || e.key === "Enter")) { e.preventDefault(); this.begin(); return; }
		const n = parseInt(e.key, 10);
		if (this.start && !this.end && this.picked === null && n >= 1 && n <= 4) { e.preventDefault(); this.pick(n - 1); }
	}
	private begin() { this.start = Date.now(); play("click"); this.draw(); }
	private pick(k: number) {
		const q = this.qs[this.i];
		if (k >= q.options.length) return;
		this.picked = k;
		const ok = q.options[k].correct;
		if (ok) { this.correct++; this.times.push(Date.now() - this.start); }
		play(ok ? "correct" : "wrong");
		this.draw();
		window.setTimeout(() => {
			this.picked = null;
			this.i++;
			if (this.i >= this.qs.length) this.finish();
			this.draw();
		}, ok ? 350 : 900);
	}
	private finish() {
		this.end = Date.now();
		const p = this.hub.plugin;
		const m = p.data.meta;
		const run = { times: this.times, correct: this.correct, total: this.qs.length, t: Date.now() };
		this.result = this.compare();
		m.ghosts = { ...(m.ghosts ?? {}), [this.key]: run };
		m.races = (m.races ?? 0) + 1;
		p.track("race");
		p.addCoins(this.correct + (this.result === "win" ? 10 : 0));
		p.checkAchievements();
		play(this.result === "win" ? "victory" : this.result === "lose" ? "defeat" : "chime");
	}
	private result: "win" | "lose" | "first" | "tie" = "first";
	private compare(): "win" | "lose" | "first" | "tie" {
		const g = this.ghost;
		if (!g) return "first";
		if (this.correct !== g.correct) return this.correct > g.correct ? "win" : "lose";
		const mine = this.times[this.times.length - 1] ?? Infinity, theirs = g.times[g.times.length - 1] ?? Infinity;
		return mine === theirs ? "tie" : mine < theirs ? "win" : "lose";
	}
	private moveTrack() {
		if (!this.start || !this.el) return;
		const now = (this.end || Date.now()) - this.start;
		const n = this.qs.length;
		const me = this.el.querySelector(".fch-runner.is-me") as HTMLElement | null;
		const gh = this.el.querySelector(".fch-runner.is-ghost") as HTMLElement | null;
		if (me) me.style.left = `${(this.correct / n) * 92}%`;
		if (gh && this.ghost) gh.style.left = `${(this.ghost.times.filter((t) => t <= now).length / n) * 92}%`;
		const t = this.el.querySelector(".fch-race-time");
		t?.setText(formatDuration(now));
	}

	private draw() {
		const root = this.el;
		if (!root) return;
		this.comp?.unload();
		this.comp = new Component();
		this.comp.load();
		root.empty();
		const wrap = root.createDiv("fch-race");
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Keluar", onClick: () => this.hub.endGame() });
		const tt = top.createDiv("fch-study-title");
		tt.createDiv({ cls: "fch-study-name", text: `🏁 Lawan Dirimu Kemarin · ${this.title}` });
		tt.createDiv({ cls: "fch-muted fch-small", text: this.ghost ? `Hantumu: ${this.ghost.correct}/${this.ghost.total} benar dalam ${formatDuration(this.ghost.times[this.ghost.times.length - 1] ?? 0)} (${new Date(this.ghost.t).toLocaleDateString("id-ID", { day: "numeric", month: "short" })})` : "Balapan pertama: hasilmu akan menjadi hantu untuk dikalahkan berikutnya." });
		top.createDiv("fch-study-meta").createSpan({ cls: "fch-timer fch-race-time", text: "0:00" });
		const track = wrap.createDiv("fch-track");
		const lane = (cls: string, icon: string, label: string) => {
			const l = track.createDiv("fch-lane");
			l.createSpan({ cls: "fch-lane-label", text: label });
			l.createDiv({ cls: `fch-runner ${cls}`, text: icon });
			l.createDiv({ cls: "fch-finish", text: "🏁" });
		};
		lane("is-me", mascotState(this.hub.plugin).stage.icon, "Kamu");
		if (this.ghost) lane("is-ghost", "👻", "Kemarin");
		if (!this.start) {
			const b = btn(wrap.createDiv("fch-actions fch-mt"), { text: `Mulai balapan (${this.qs.length} soal)`, icon: "flag", cls: "fch-btn-primary fch-btn-xl", onClick: () => this.begin() });
			b.createSpan({ cls: "fch-kbd", text: "Spasi" });
			return;
		}
		if (this.end) {
			const box = wrap.createDiv("fch-summary");
			const txt = { win: "🏆 Kamu mengalahkan dirimu kemarin!", lose: "👻 Hantumu masih lebih unggul", tie: "🤝 Seri dengan dirimu kemarin", first: "🏁 Balapan pertama selesai!" }[this.result];
			box.createEl("h2", { text: txt });
			const mine = this.times[this.times.length - 1] ?? 0, theirs = this.ghost?.times[this.ghost.times.length - 1] ?? 0;
			box.createEl("p", { cls: "fch-muted", text: `${this.correct}/${this.qs.length} benar · ${formatDuration(mine)}` + (this.ghost ? ` · selisih ${mine <= theirs ? "lebih cepat" : "lebih lambat"} ${formatDuration(Math.abs(theirs - mine))}` : "") + ` · 🪙 +${this.correct + (this.result === "win" ? 10 : 0)}` });
			const r = box.createDiv("fch-row fch-center");
			btn(r, { text: "Balapan lagi", icon: "rotate-ccw", cls: "fch-btn-primary", onClick: () => this.hub.startGame(new RaceGame(this.hub, this.qs.map((q) => q.card), this.title, this.key)) });
			btn(r, { text: "Selesai", onClick: () => this.hub.endGame() });
			if (this.result === "win" && this.hub.plugin.data.settings.confetti) confetti(root);
			window.setTimeout(() => this.moveTrack(), 20);
			return;
		}
		const q = this.qs[this.i];
		const card = wrap.createDiv("fch-card fch-boss-q");
		const h = card.createDiv("fch-card-head");
		h.createSpan({ cls: "fch-type", text: `Soal ${this.i + 1}/${this.qs.length}` });
		cardFront(this.hub.plugin, this.comp, card, q.card);
		const list = card.createDiv("fch-choices");
		q.options.forEach((o, k) => {
			let cls = "fch-choice";
			if (this.picked !== null && o.correct) cls += " is-correct";
			if (this.picked === k && !o.correct) cls += " is-wrong";
			const b = list.createEl("button", { cls });
			b.createSpan({ cls: "fch-choice-key", text: String(k + 1) });
			md(this.hub.app, this.comp!, b.createDiv("fch-choice-text markdown-rendered"), o.text, q.card.path);
			b.disabled = this.picked !== null;
			b.onclick = () => this.pick(k);
		});
		window.setTimeout(() => this.moveTrack(), 20);
	}
}

/** Duel 2 pemain bergantian di satu perangkat. */
export class DuelGame implements Game {
	ok: boolean;
	private qs: Q[];
	private i = 0;
	private score = [0, 0];
	private picked: number | null = null;
	private names: [string, string];
	private el: HTMLElement | null = null;
	private comp: Component | null = null;
	private keyH = (e: KeyboardEvent) => this.onKey(e);

	constructor(private hub: HubView, cards: Card[], public title: string, names: [string, string], rounds = 8) {
		this.names = names;
		this.qs = build(hub, cards, rounds * 2);
		if (this.qs.length % 2) this.qs.pop();
		this.ok = this.qs.length >= 4;
		if (!this.ok) new Notice("Butuh lebih banyak kartu yang bisa dijadikan soal pilihan ganda.");
	}
	mount(el: HTMLElement) { this.el = el; document.addEventListener("keydown", this.keyH, true); this.draw(); }
	unmount() { document.removeEventListener("keydown", this.keyH, true); this.comp?.unload(); this.el = null; }
	private get turn() { return this.i % 2; }
	private onKey(e: KeyboardEvent) {
		if (!this.el || e.ctrlKey || e.metaKey || this.i >= this.qs.length) return;
		const n = parseInt(e.key, 10);
		if (this.picked === null && n >= 1 && n <= 4) { e.preventDefault(); this.pick(n - 1); }
		else if (this.picked !== null && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); this.next(); }
	}
	private pick(k: number) {
		const q = this.qs[this.i];
		if (k >= q.options.length) return;
		this.picked = k;
		const ok = q.options[k].correct;
		if (ok) this.score[this.turn]++;
		play(ok ? "correct" : "wrong");
		this.draw();
	}
	private next() {
		this.picked = null;
		this.i++;
		if (this.i >= this.qs.length) {
			const m = this.hub.plugin.data.meta;
			m.duels = (m.duels ?? 0) + 1;
			this.hub.plugin.requestSave();
			this.hub.plugin.checkAchievements();
			play("victory");
		} else play("click");
		this.draw();
	}
	private draw() {
		const root = this.el;
		if (!root) return;
		this.comp?.unload();
		this.comp = new Component();
		this.comp.load();
		root.empty();
		const wrap = root.createDiv("fch-duel");
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Keluar", onClick: () => this.hub.endGame() });
		top.createDiv("fch-study-title").createDiv({ cls: "fch-study-name", text: `⚔️ Duel · ${this.title}` });
		const sb = wrap.createDiv("fch-duel-score");
		[0, 1].forEach((k) => {
			const pl = sb.createDiv("fch-duel-p" + (this.turn === k && this.i < this.qs.length ? " is-turn" : ""));
			pl.createDiv({ cls: "fch-duel-name", text: (k ? "🟦 " : "🟥 ") + this.names[k] });
			pl.createDiv({ cls: "fch-duel-pts", text: String(this.score[k]) });
		});
		if (this.i >= this.qs.length) {
			const box = wrap.createDiv("fch-summary");
			const w: number = this.score[0] === this.score[1] ? -1 : this.score[0] > this.score[1] ? 0 : 1;
			box.createEl("h2", { text: w < 0 ? "🤝 Seri!" : `🏆 ${this.names[w === 0 ? 0 : 1]} menang!` });
			box.createEl("p", { cls: "fch-muted", text: `${this.score[0]} – ${this.score[1]} dari ${this.qs.length / 2} soal per pemain` });
			const r = box.createDiv("fch-row fch-center");
			btn(r, { text: "Duel lagi", icon: "rotate-ccw", cls: "fch-btn-primary", onClick: () => this.hub.startGame(new DuelGame(this.hub, this.qs.map((q) => q.card), this.title, this.names, this.qs.length / 2)) });
			btn(r, { text: "Selesai", onClick: () => this.hub.endGame() });
			if (this.hub.plugin.data.settings.confetti) confetti(root);
			return;
		}
		wrap.createDiv({ cls: "fch-duel-turn", text: `Giliran ${this.names[this.turn]} · soal ${Math.floor(this.i / 2) + 1}/${this.qs.length / 2}` });
		const q = this.qs[this.i];
		const card = wrap.createDiv("fch-card fch-boss-q");
		cardFront(this.hub.plugin, this.comp, card, q.card);
		const list = card.createDiv("fch-choices");
		q.options.forEach((o, k) => {
			let cls = "fch-choice";
			if (this.picked !== null && o.correct) cls += " is-correct";
			if (this.picked === k && !o.correct) cls += " is-wrong";
			const b = list.createEl("button", { cls });
			b.createSpan({ cls: "fch-choice-key", text: String(k + 1) });
			md(this.hub.app, this.comp!, b.createDiv("fch-choice-text markdown-rendered"), o.text, q.card.path);
			b.disabled = this.picked !== null;
			b.onclick = () => this.pick(k);
		});
		if (this.picked !== null) {
			const b = btn(wrap.createDiv("fch-actions"), { text: `Serahkan ke ${this.names[1 - this.turn]} →`, cls: "fch-btn-primary fch-btn-xl", onClick: () => this.next() });
			b.createSpan({ cls: "fch-kbd", text: "Enter" });
		}
	}
}
