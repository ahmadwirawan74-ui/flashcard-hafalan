import type { HubView } from "./hub-view";
import { Card } from "./types";
import { btn, confetti, plainText, shuffle } from "./util";
import { formatDuration } from "./scheduler";
import { play } from "./sound";

export interface Game {
	ok: boolean;
	mount(el: HTMLElement): void;
	unmount(): void;
}

interface Pair { q: string; a: string; card: Card }

/** Pasangan tanya-jawab teks pendek dari kartu (dipakai Cocokkan & Kilat). */
export function pairsOf(cards: Card[], maxQ = 140, maxA = 90): Pair[] {
	const out: Pair[] = [];
	const seen = new Set<string>();
	for (const c of cards) {
		if (c.type === "list" || c.type === "mcq" || c.type === "occlusion") continue;
		const q = plainText(c.front).replace(/\[…\]/g, "___");
		const a = plainText(c.answer ?? c.back);
		const kq = q.toLowerCase(), ka = a.toLowerCase();
		if (!q || !a || q.length > maxQ || a.length > maxA || seen.has(kq) || seen.has(ka)) continue;
		seen.add(kq);
		seen.add(ka);
		out.push({ q, a, card: c });
	}
	return out;
}

/** Cocokkan: dua kolom (pertanyaan & jawaban), beberapa ronde, keyboard 1–5 & A–E. */
export class MatchGame implements Game {
	ok = false;
	private pool: Pair[];
	private rounds: Pair[][] = [];
	private round = 0;
	private left: number[] = [];
	private right: number[] = [];
	private matched = new Set<number>();
	private selL: number | null = null;
	private selR: number | null = null;
	private wrong: { l: number; r: number } | null = null;
	private mistakes = 0;
	private combo = 0;
	private confused = new Set<Card>();
	private start = 0;
	private finished = 0;
	private record = false;
	private coins = 0;
	private el: HTMLElement | null = null;
	private timer: number | null = null;
	private timeEl: HTMLElement | null = null;
	private keyH = (e: KeyboardEvent) => this.onKey(e);

	constructor(private hub: HubView, cards: Card[], public title: string, private perRound = 5, private nRounds = 3) {
		this.pool = pairsOf(cards);
		this.ok = this.pool.length >= 3;
		if (this.ok) this.deal();
	}

	private deal() {
		const all = shuffle([...this.pool]);
		const per = Math.min(this.perRound, all.length);
		const n = Math.max(1, Math.min(this.nRounds, Math.floor(all.length / per)));
		this.rounds = Array.from({ length: n }, (_, i) => all.slice(i * per, i * per + per));
		this.round = 0;
		this.mistakes = 0;
		this.combo = 0;
		this.confused.clear();
		this.start = 0;
		this.finished = 0;
		this.record = false;
		this.coins = 0;
		this.newRound();
	}

	private newRound() {
		const n = this.rounds[this.round].length;
		this.left = shuffle([...Array(n).keys()]);
		this.right = shuffle([...Array(n).keys()]);
		this.matched.clear();
		this.selL = this.selR = null;
	}

	mount(el: HTMLElement) {
		this.el = el;
		document.addEventListener("keydown", this.keyH, true);
		this.timer = window.setInterval(() => {
			if (this.start && !this.finished) this.timeEl?.setText(formatDuration(Date.now() - this.start));
		}, 200);
		this.draw();
	}

	unmount() {
		document.removeEventListener("keydown", this.keyH, true);
		if (this.timer) window.clearInterval(this.timer);
		this.timer = null;
		this.el = null;
	}

	private onKey(e: KeyboardEvent) {
		if (!this.el || this.finished || e.ctrlKey || e.metaKey || e.altKey) return;
		if ((e.target as HTMLElement).tagName === "INPUT") return;
		const n = parseInt(e.key, 10);
		if (n >= 1 && n <= this.left.length) { e.preventDefault(); this.pick("l", this.left[n - 1]); }
		const ci = "abcdefgh".indexOf(e.key.toLowerCase());
		if (ci >= 0 && ci < this.right.length) { e.preventDefault(); this.pick("r", this.right[ci]); }
	}

	private pick(side: "l" | "r", i: number) {
		if (this.matched.has(i) || this.wrong) return;
		if (!this.start) this.start = Date.now();
		if (side === "l") this.selL = this.selL === i ? null : i;
		else this.selR = this.selR === i ? null : i;
		if (this.selL !== null && this.selR !== null) {
			if (this.selL === this.selR) {
				this.matched.add(this.selL);
				play("correct");
				this.combo++;
				this.coins += 1 + (this.combo >= 3 ? 1 : 0);
			} else {
				this.mistakes++;
				play("wrong");
				this.combo = 0;
				const pr = this.rounds[this.round];
				this.hub.plugin.logConfusion(pr[this.selL].card.id, pr[this.selR].card.id);
				this.confused.add(pr[this.selL].card);
				this.confused.add(pr[this.selR].card);
				this.wrong = { l: this.selL, r: this.selR };
				window.setTimeout(() => { this.wrong = null; this.draw(); }, 450);
			}
			this.selL = this.selR = null;
			if (this.matched.size === this.rounds[this.round].length) {
				this.draw();
				window.setTimeout(() => this.nextRound(), 550);
				return;
			}
		}
		this.draw();
	}

	private nextRound() {
		if (!this.el) return;
		if (this.round + 1 < this.rounds.length) {
			this.round++;
			this.newRound();
			this.draw(true);
			return;
		}
		this.finished = Date.now();
		const ms = this.finished - this.start + this.mistakes * 2000;
		const meta = this.hub.plugin.data.meta;
		meta.matchesPlayed = (meta.matchesPlayed ?? 0) + 1;
		this.hub.plugin.track("matchGames");
		if (!this.mistakes) this.hub.plugin.track("matchPerfect");
		this.record = meta.bestMatchMs === undefined || ms < meta.bestMatchMs;
		if (this.record) { meta.bestMatchMs = ms; this.coins += 10; }
		play("victory");
		this.hub.plugin.addCoins(this.coins);
		this.hub.plugin.checkAchievements();
		this.draw();
	}

	private draw(roundIntro = false) {
		const root = this.el;
		if (!root) return;
		root.empty();
		const wrap = root.createDiv("fch-match");
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Kembali ke Arena", onClick: () => this.hub.endGame() });
		const tt = top.createDiv("fch-study-title");
		tt.createDiv({ cls: "fch-study-name", text: `🧩 Cocokkan · ${this.title}` });
		tt.createDiv({ cls: "fch-muted fch-small", text: "Pilih pertanyaan (1–5), lalu jawabannya (A–E)." });
		const meta = top.createDiv("fch-study-meta");
		if (this.combo >= 3) meta.createDiv({ cls: "fch-combo", text: `⚡ ${this.combo}` });
		meta.createSpan({ cls: "fch-score-bad", text: `✗ ${this.mistakes}` });
		meta.createSpan({ cls: "fch-coin", text: `🪙 ${this.coins}` });
		this.timeEl = meta.createSpan({ cls: "fch-timer", text: formatDuration(this.start ? (this.finished || Date.now()) - this.start : 0) });

		if (this.finished) return this.drawDone(wrap);

		const steps = wrap.createDiv("fch-rounds");
		this.rounds.forEach((_, i) => steps.createDiv({ cls: "fch-round-dot" + (i < this.round ? " is-done" : i === this.round ? " is-now" : "") }));
		steps.createSpan({ cls: "fch-muted fch-small", text: `Ronde ${this.round + 1} dari ${this.rounds.length}` });

		const pr = this.rounds[this.round];
		const board = wrap.createDiv("fch-board" + (roundIntro ? " is-intro" : ""));
		const col = (side: "l" | "r", order: number[], label: string) => {
			const c = board.createDiv("fch-col");
			c.createDiv({ cls: "fch-col-head", text: label });
			order.forEach((i, pos) => {
				let cls = `fch-mtile side-${side}`;
				if (this.matched.has(i)) cls += " is-matched";
				if ((side === "l" ? this.selL : this.selR) === i) cls += " is-sel";
				if (this.wrong && (side === "l" ? this.wrong.l : this.wrong.r) === i) cls += " is-wrong";
				const b = c.createEl("button", { cls });
				b.createSpan({ cls: "fch-mkey", text: side === "l" ? String(pos + 1) : "ABCDEFGH"[pos] });
				b.createSpan({ cls: "fch-mtext", text: side === "l" ? pr[i].q : pr[i].a });
				if (this.matched.has(i)) b.createSpan({ cls: "fch-mcheck", text: "✓" });
				b.disabled = this.matched.has(i);
				b.onclick = () => this.pick(side, i);
			});
		};
		col("l", this.left, "Pertanyaan");
		col("r", this.right, "Jawaban");
	}

	private drawDone(wrap: HTMLElement) {
		const ms = this.finished - this.start + this.mistakes * 2000;
		const total = this.rounds.reduce((a, r) => a + r.length, 0);
		const box = wrap.createDiv("fch-summary");
		box.createDiv({ cls: "fch-sum-emoji", text: this.record ? "🏆" : this.mistakes === 0 ? "💎" : "🧩" });
		box.createEl("h2", { text: this.record ? "Rekor baru!" : "Semua cocok!" });
		const grid = box.createDiv("fch-sum-grid");
		const tile = (v: string, l: string) => {
			const t = grid.createDiv("fch-sum-tile");
			t.createDiv({ cls: "fch-sum-v", text: v });
			t.createDiv({ cls: "fch-muted", text: l });
		};
		tile(formatDuration(ms), "waktu (+2 dtk/salah)");
		tile(String(total), "pasangan");
		tile(`${Math.round((total / (total + this.mistakes)) * 100)}%`, "ketepatan");
		tile(`🪙 ${this.coins}`, "koin");
		box.createEl("p", { cls: "fch-muted", text: `Rekor terbaik: ${formatDuration(this.hub.plugin.data.meta.bestMatchMs ?? ms)}` });
		if (this.confused.size) {
			const c = box.createDiv("fch-continue");
			c.createDiv({ cls: "fch-strong", text: `${this.confused.size} kartu sempat tertukar` });
			c.createDiv({ cls: "fch-muted fch-small", text: [...this.confused].slice(0, 4).map((x) => plainText(x.front).slice(0, 40)).join(" · ") });
			btn(c.createDiv("fch-row fch-center"), { text: "Latih kartu ini", icon: "zap", cls: "fch-btn-primary", onClick: () => this.hub.startSession([...this.confused], { title: "Kartu yang tertukar", cram: true, mode: "classic" }) });
		}
		const row = box.createDiv("fch-row fch-center");
		btn(row, { text: "Main lagi", icon: "rotate-ccw", cls: "fch-btn-primary", onClick: () => { this.deal(); this.draw(); } });
		btn(row, { text: "Arena", onClick: () => this.hub.endGame() });
		if (this.hub.plugin.data.settings.confetti && (this.record || this.mistakes === 0)) confetti(this.el!);
	}
}
