import { Notice } from "obsidian";
import type { HubView } from "./hub-view";
import { Game } from "./match";
import { Card } from "./types";
import { btn, plainText } from "./util";

/** Mode Dengar: pertanyaan dibacakan, jeda untuk menjawab dalam hati, lalu jawabannya. */
export class AudioReview implements Game {
	ok: boolean;
	private i = 0;
	private playing = false;
	private phase: "q" | "wait" | "a" | "gap" = "q";
	private pause = 5;
	private rate = 1;
	private hard: Card[] = [];
	private timer: number | null = null;
	private el: HTMLElement | null = null;
	private token = 0;

	constructor(private hub: HubView, private cards: Card[], public title: string) {
		this.cards = cards.filter((c) => c.type !== "occlusion").slice(0, 200);
		this.ok = this.cards.length > 0 && !!window.speechSynthesis;
		if (!window.speechSynthesis) new Notice("Perangkat ini tidak mendukung suara (text-to-speech).");
	}

	mount(el: HTMLElement) { this.el = el; this.draw(); }
	unmount() { this.stop(); this.el = null; }

	private stop() {
		this.playing = false;
		this.token++;
		if (this.timer) window.clearTimeout(this.timer);
		window.speechSynthesis?.cancel();
	}

	private say(text: string, then: () => void) {
		const tok = this.token;
		const u = new SpeechSynthesisUtterance(plainText(text).replace(/\[…\]/g, " titik titik "));
		u.lang = this.hub.plugin.data.settings.ttsLang;
		u.rate = this.rate;
		u.onend = () => { if (tok === this.token && this.playing) then(); };
		window.speechSynthesis.speak(u);
	}

	private wait(ms: number, then: () => void) {
		const tok = this.token;
		this.timer = window.setTimeout(() => { if (tok === this.token && this.playing) then(); }, ms);
	}

	private run() {
		if (!this.playing) return;
		if (this.i >= this.cards.length) { this.playing = false; this.draw(); return; }
		const c = this.cards[this.i];
		this.phase = "q"; this.draw();
		this.say(c.front, () => {
			this.phase = "wait"; this.draw();
			this.wait(this.pause * 1000, () => {
				this.phase = "a"; this.draw();
				this.say(c.type === "cloze" ? c.back : c.answer ?? c.back, () => {
					this.phase = "gap"; this.draw();
					this.hub.plugin.track("audio");
					this.hub.plugin.data.meta.audioCards = (this.hub.plugin.data.meta.audioCards ?? 0) + 1;
					this.wait(1200, () => { this.i++; this.run(); });
				});
			});
		});
	}

	private toggle() {
		if (this.playing) { this.stop(); this.draw(); return; }
		if (this.i >= this.cards.length) this.i = 0;
		this.playing = true;
		this.token++;
		this.run();
	}

	private jump(d: number) {
		const was = this.playing;
		this.stop();
		this.i = Math.max(0, Math.min(this.cards.length - 1, this.i + d));
		this.phase = "q";
		if (was) { this.playing = true; this.run(); } else this.draw();
	}

	private draw() {
		const root = this.el;
		if (!root) return;
		root.empty();
		const wrap = root.createDiv("fch-audio");
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Keluar", onClick: () => this.hub.endGame() });
		const tt = top.createDiv("fch-study-title");
		tt.createDiv({ cls: "fch-study-name", text: `🎧 Mode Dengar · ${this.title}` });
		tt.createDiv({ cls: "fch-muted fch-small", text: `Kartu ${Math.min(this.i + 1, this.cards.length)} dari ${this.cards.length}` });
		const done = this.i >= this.cards.length;
		const stage = wrap.createDiv("fch-audio-stage" + (this.playing ? " is-playing" : ""));
		const wave = stage.createDiv("fch-wave");
		for (let k = 0; k < 5; k++) wave.createSpan();
		if (done) {
			stage.createEl("h2", { text: "Selesai mendengarkan 🎧" });
			if (this.hard.length) btn(stage, { text: `Latih ${this.hard.length} kartu yang kamu tandai sulit`, icon: "zap", cls: "fch-btn-primary", onClick: () => this.hub.startSession(this.hard, { title: "Dari Mode Dengar", cram: true, mode: "classic" }) });
		} else {
			const c = this.cards[this.i];
			stage.createDiv({ cls: "fch-audio-phase", text: { q: "🔊 Pertanyaan", wait: `🤔 Jawab dalam hati… (${this.pause} dtk)`, a: "💡 Jawaban", gap: "✓" }[this.phase] });
			stage.createDiv({ cls: "fch-audio-q", text: plainText(c.front).replace(/\[…\]/g, "___") });
			if (this.phase === "a" || this.phase === "gap") stage.createDiv({ cls: "fch-audio-a", text: plainText(c.type === "cloze" ? c.back : c.answer ?? c.back) });
		}
		const ctr = wrap.createDiv("fch-audio-ctr");
		btn(ctr, { icon: "skip-back", cls: "fch-btn-ghost", label: "Sebelumnya", onClick: () => this.jump(-1) });
		btn(ctr, { icon: this.playing ? "pause" : "play", cls: "fch-btn-primary fch-audio-play", label: this.playing ? "Jeda" : "Putar", onClick: () => this.toggle() });
		btn(ctr, { icon: "skip-forward", cls: "fch-btn-ghost", label: "Berikutnya", onClick: () => this.jump(1) });
		if (!done) btn(ctr, { text: "Sulit", icon: "flag", cls: "fch-btn-sm", label: "Tandai untuk dilatih nanti", onClick: () => { const c = this.cards[this.i]; if (!this.hard.includes(c)) this.hard.push(c); new Notice("Ditandai sulit", 1200); } });
		const opt = wrap.createDiv("fch-audio-opt");
		const pick = (label: string, vals: number[], cur: number, fmt: (v: number) => string, set: (v: number) => void) => {
			const g = opt.createDiv("fch-row");
			g.createSpan({ cls: "fch-small fch-muted", text: label });
			const seg = g.createDiv("fch-seg");
			for (const v of vals) {
				const b = seg.createEl("button", { cls: "fch-seg-btn" + (cur === v ? " is-active" : ""), text: fmt(v) });
				b.onclick = () => { set(v); this.draw(); };
			}
		};
		pick("Jeda berpikir", [3, 5, 8, 12], this.pause, (v) => `${v} dtk`, (v) => (this.pause = v));
		pick("Kecepatan", [0.8, 1, 1.2], this.rate, (v) => `${v}×`, (v) => (this.rate = v));
		opt.createDiv({ cls: "fch-muted fch-small", text: "Tips: pakai earphone dan biarkan berjalan saat di perjalanan. Bahasa suara mengikuti pengaturan “Bahasa suara”." });
	}
}
