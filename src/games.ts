import type { HubView } from "./hub-view";
import { Card } from "./types";
import { Game, pairsOf } from "./match";
import { btn, confetti, plainText, shuffle } from "./util";
import { play } from "./sound";

/** Kilat: 60 detik menebak apakah pasangan tanya-jawab benar atau salah. */
export class KilatGame implements Game {
	ok: boolean;
	private pairs: ReturnType<typeof pairsOf>;
	private cur: { q: string; a: string; truth: boolean } | null = null;
	private score = 0;
	private streak = 0;
	private best = 0;
	private wrongList: Card[] = [];
	private end = 0;
	private flash: "good" | "bad" | null = null;
	private el: HTMLElement | null = null;
	private timer: number | null = null;
	private keyH = (e: KeyboardEvent) => this.onKey(e);
	private cardOf = new Map<string, Card>();
	readonly duration = 60_000;

	constructor(private hub: HubView, cards: Card[], public title: string) {
		this.pairs = pairsOf(cards, 160, 100);
		this.pairs.forEach((p) => this.cardOf.set(p.q, p.card));
		this.ok = this.pairs.length >= 4;
	}

	private next() {
		const p = this.pairs[Math.floor(Math.random() * this.pairs.length)];
		const truth = Math.random() < 0.5;
		let a = p.a;
		if (!truth) {
			const others = this.pairs.filter((x) => x.a !== p.a);
			a = others[Math.floor(Math.random() * others.length)].a;
		}
		this.cur = { q: p.q, a, truth };
	}

	mount(el: HTMLElement) {
		this.el = el;
		document.addEventListener("keydown", this.keyH, true);
		this.timer = window.setInterval(() => this.tick(), 100);
		this.draw();
	}

	unmount() {
		document.removeEventListener("keydown", this.keyH, true);
		if (this.timer) window.clearInterval(this.timer);
		this.timer = null;
		this.el = null;
	}

	private tick() {
		if (!this.end) return;
		const left = this.end - Date.now();
		const bar = this.el?.querySelector(".fch-kilat-time") as HTMLElement | null;
		if (bar) bar.style.width = `${Math.max(0, left / this.duration) * 100}%`;
		const t = this.el?.querySelector(".fch-kilat-sec");
		t?.setText(`${Math.max(0, Math.ceil(left / 1000))} dtk`);
		if (left <= 0 && this.cur) this.finish();
	}

	private onKey(e: KeyboardEvent) {
		if (!this.el || e.ctrlKey || e.metaKey) return;
		const k = e.key.toLowerCase();
		if (!this.end && (k === " " || k === "enter")) { e.preventDefault(); this.begin(); return; }
		if (!this.cur || !this.end) return;
		if (k === "arrowleft" || k === "f" || k === "s") { e.preventDefault(); this.answer(false); }
		if (k === "arrowright" || k === "j" || k === "b") { e.preventDefault(); this.answer(true); }
	}

	private begin() {
		this.score = 0;
		this.streak = 0;
		this.best = 0;
		this.wrongList = [];
		this.end = Date.now() + this.duration;
		this.next();
		this.draw();
	}

	private answer(said: boolean) {
		if (!this.cur) return;
		const ok = said === this.cur.truth;
		play(ok ? "correct" : "wrong");
		if (ok) {
			this.streak++;
			this.score += this.streak >= 5 ? 2 : 1;
			this.best = Math.max(this.best, this.streak);
		} else {
			this.streak = 0;
			const c = this.cardOf.get(this.cur.q);
			if (c && !this.wrongList.includes(c)) this.wrongList.push(c);
			const other = this.pairs.find((x) => x.a === this.cur!.a)?.card;
			if (c && other && !this.cur.truth) this.hub.plugin.logConfusion(c.id, other.id);
		}
		this.flash = ok ? "good" : "bad";
		this.next();
		this.draw();
		window.setTimeout(() => { this.flash = null; this.el?.querySelector(".fch-kilat-card")?.removeClass("is-good", "is-bad"); }, 220);
	}

	private finish() {
		this.cur = null;
		const meta = this.hub.plugin.data.meta;
		meta.kilatPlayed = (meta.kilatPlayed ?? 0) + 1;
		this.hub.plugin.track("kilatGames");
		this.hub.plugin.track("kilatMax", this.score, true);
		const record = this.score > (meta.kilatBest ?? 0);
		if (record) meta.kilatBest = this.score;
		this.hub.plugin.addCoins(this.score);
		this.hub.plugin.checkAchievements();
		this.drawDone(record);
	}

	private header(wrap: HTMLElement) {
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Kembali ke Arena", onClick: () => this.hub.endGame() });
		const tt = top.createDiv("fch-study-title");
		tt.createDiv({ cls: "fch-study-name", text: `⚡ Kilat · ${this.title}` });
		tt.createDiv({ cls: "fch-muted fch-small", text: "Benar atau salah? ← / F = Salah, → / J = Benar" });
		const meta = top.createDiv("fch-study-meta");
		if (this.streak >= 3) meta.createDiv({ cls: "fch-combo" + (this.streak >= 5 ? " is-hot" : ""), text: `⚡ ${this.streak}` });
		meta.createSpan({ cls: "fch-coin", text: `★ ${this.score}` });
		meta.createSpan({ cls: "fch-timer fch-kilat-sec", text: "60 dtk" });
	}

	private draw() {
		const root = this.el;
		if (!root) return;
		root.empty();
		const wrap = root.createDiv("fch-match");
		this.header(wrap);
		if (!this.end) {
			const box = wrap.createDiv("fch-summary");
			box.createDiv({ cls: "fch-sum-emoji", text: "⚡" });
			box.createEl("h2", { text: "Kilat: Benar atau Salah" });
			box.createEl("p", { cls: "fch-muted", text: "Kamu punya 60 detik. Setiap layar menampilkan pertanyaan dan sebuah jawaban, lalu tentukan apakah pasangannya benar. 5 jawaban benar beruntun = poin ganda." });
			box.createEl("p", { cls: "fch-muted fch-small", text: `Rekor: ${this.hub.plugin.data.meta.kilatBest ?? 0} poin` });
			const b = btn(box.createDiv("fch-row fch-center"), { text: "Mulai", icon: "play", cls: "fch-btn-primary fch-btn-lg", onClick: () => this.begin() });
			b.createSpan({ cls: "fch-kbd", text: "Spasi" });
			return;
		}
		wrap.createDiv("fch-bar fch-kilat-bar").createDiv("fch-bar-fill fch-kilat-time");
		const c = this.cur!;
		const card = wrap.createDiv("fch-kilat-card" + (this.flash ? ` is-${this.flash}` : ""));
		card.createDiv({ cls: "fch-kilat-q", text: c.q });
		card.createDiv({ cls: "fch-kilat-eq", text: "=" });
		card.createDiv({ cls: "fch-kilat-a", text: c.a });
		const row = wrap.createDiv("fch-kilat-btns");
		const no = btn(row, { text: "Salah", icon: "x", cls: "fch-kilat-no", onClick: () => this.answer(false) });
		no.createSpan({ cls: "fch-kbd", text: "←" });
		const yes = btn(row, { text: "Benar", icon: "check", cls: "fch-kilat-yes", onClick: () => this.answer(true) });
		yes.createSpan({ cls: "fch-kbd", text: "→" });
		this.tick();
	}

	private drawDone(record: boolean) {
		const root = this.el;
		if (!root) return;
		root.empty();
		const wrap = root.createDiv("fch-match");
		this.header(wrap);
		const box = wrap.createDiv("fch-summary");
		box.createDiv({ cls: "fch-sum-emoji", text: record ? "🏆" : "⚡" });
		box.createEl("h2", { text: record ? `Rekor baru: ${this.score} poin!` : `${this.score} poin` });
		box.createEl("p", { cls: "fch-muted", text: `Beruntun terbaik ${this.best} · 🪙 +${this.score} koin · rekor ${this.hub.plugin.data.meta.kilatBest ?? 0}` });
		if (this.wrongList.length) {
			const c = box.createDiv("fch-continue");
			c.createDiv({ cls: "fch-strong", text: `${this.wrongList.length} kartu terkecoh` });
			btn(c.createDiv("fch-row fch-center"), { text: "Latih kartu ini", icon: "zap", cls: "fch-btn-primary", onClick: () => this.hub.startSession(this.wrongList, { title: "Kartu yang terkecoh", cram: true, mode: "classic" }) });
		}
		const row = box.createDiv("fch-row fch-center");
		btn(row, { text: "Main lagi", icon: "rotate-ccw", cls: "fch-btn-primary", onClick: () => this.begin() });
		btn(row, { text: "Arena", onClick: () => this.hub.endGame() });
		if (record && this.hub.plugin.data.settings.confetti) confetti(this.el!);
	}
}

/** Susun Urutan: klik item kartu List sesuai urutan yang benar. */
export class SusunGame implements Game {
	ok: boolean;
	private cards: Card[];
	private i = 0;
	private order: number[] = [];
	private placed: number[] = [];
	private wrongAt: number | null = null;
	private mistakes = 0;
	private perfect = 0;
	private coins = 0;
	private el: HTMLElement | null = null;

	constructor(private hub: HubView, cards: Card[], public title: string) {
		this.cards = shuffle(cards.filter((c) => c.type === "list" && (c.items?.length ?? 0) >= 3)).slice(0, 6);
		this.ok = this.cards.length >= 1;
		this.reset();
	}

	private reset() {
		const n = this.cards[this.i]?.items?.length ?? 0;
		this.order = shuffle([...Array(n).keys()]);
		this.placed = [];
		this.wrongAt = null;
		this.roundMistakes = 0;
	}
	private roundMistakes = 0;

	mount(el: HTMLElement) {
		this.el = el;
		this.draw();
	}

	unmount() {
		this.el = null;
	}

	private pick(item: number) {
		const want = this.placed.length;
		if (item === want) {
			play("click");
			this.placed.push(item);
			if (this.placed.length === this.order.length) {
				if (!this.roundMistakes) { this.perfect++; this.coins += 5; }
				this.coins += 2;
				this.hub.plugin.bumpMeta("susunDone");
				window.setTimeout(() => {
					this.i++;
					if (this.i < this.cards.length) this.reset();
					else { this.hub.plugin.addCoins(this.coins); this.hub.plugin.track("susunGames"); this.hub.plugin.checkAchievements(); }
					this.draw();
				}, 650);
			}
		} else {
			this.mistakes++;
			play("wrong");
			this.roundMistakes++;
			this.wrongAt = item;
			window.setTimeout(() => { this.wrongAt = null; this.draw(); }, 400);
		}
		this.draw();
	}

	private draw() {
		const root = this.el;
		if (!root) return;
		root.empty();
		const wrap = root.createDiv("fch-match");
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Kembali ke Arena", onClick: () => this.hub.endGame() });
		const tt = top.createDiv("fch-study-title");
		tt.createDiv({ cls: "fch-study-name", text: `🔢 Susun Urutan · ${this.title}` });
		tt.createDiv({ cls: "fch-muted fch-small", text: "Klik item sesuai urutan yang benar, dari yang pertama." });
		const meta = top.createDiv("fch-study-meta");
		meta.createSpan({ cls: "fch-score-bad", text: `✗ ${this.mistakes}` });
		meta.createSpan({ cls: "fch-coin", text: `🪙 ${this.coins}` });

		if (this.i >= this.cards.length) {
			const box = wrap.createDiv("fch-summary");
			box.createDiv({ cls: "fch-sum-emoji", text: this.mistakes ? "🔢" : "💎" });
			box.createEl("h2", { text: "Semua urutan tersusun!" });
			box.createEl("p", { cls: "fch-muted", text: `${this.cards.length} daftar · ${this.perfect} sempurna · ${this.mistakes} salah · 🪙 +${this.coins} koin` });
			const row = box.createDiv("fch-row fch-center");
			btn(row, { text: "Main lagi", icon: "rotate-ccw", cls: "fch-btn-primary", onClick: () => { this.i = 0; this.mistakes = 0; this.perfect = 0; this.coins = 0; this.cards = shuffle(this.cards); this.reset(); this.draw(); } });
			btn(row, { text: "Arena", onClick: () => this.hub.endGame() });
			if (!this.mistakes && this.hub.plugin.data.settings.confetti) confetti(root);
			return;
		}
		const steps = wrap.createDiv("fch-rounds");
		this.cards.forEach((_, k) => steps.createDiv({ cls: "fch-round-dot" + (k < this.i ? " is-done" : k === this.i ? " is-now" : "") }));
		const card = this.cards[this.i];
		const items = card.items ?? [];
		const box = wrap.createDiv("fch-susun");
		box.createDiv({ cls: "fch-susun-q", text: plainText(card.front) });
		const done = box.createEl("ol", { cls: "fch-susun-done" });
		for (let k = 0; k < items.length; k++) {
			const li = done.createEl("li", { cls: k < this.placed.length ? "is-on" : "" });
			li.setText(k < this.placed.length ? plainText(items[this.placed[k]]) : "…");
		}
		const pool = box.createDiv("fch-susun-pool");
		for (const it of this.order) {
			if (this.placed.includes(it)) continue;
			const b = pool.createEl("button", { cls: "fch-mtile" + (this.wrongAt === it ? " is-wrong" : ""), text: plainText(items[it]) });
			b.onclick = () => this.pick(it);
		}
	}
}
