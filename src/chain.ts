import { Notice } from "obsidian";
import type { HubView } from "./hub-view";
import { Game } from "./match";
import { Chain } from "./types";
import { sentences, wordDiff } from "./learn";
import { btn, confetti, plainText, basename } from "./util";

type Phase = "read" | "hint" | "recall" | "final" | "done";
const PASS = 0.85;

/**
 * Rantai Hafalan: teks dipecah per kalimat.
 * Tiap kalimat: baca → tulis dengan bantuan huruf awal → tulis tanpa bantuan bersama 2 kalimat sebelumnya.
 * Terakhir: tulis seluruh teks tanpa melihat.
 */
export class ChainGame implements Game {
	ok: boolean;
	private s: string[];
	private i = 0;
	private phase: Phase = "read";
	private typed = "";
	private result: ReturnType<typeof wordDiff> | null = null;
	private tries = 0;
	private el: HTMLElement | null = null;
	private keyH = (e: KeyboardEvent) => this.onKey(e);

	constructor(private hub: HubView, private chain: Chain) {
		this.s = sentences(plainText(chain.text));
		this.ok = this.s.length >= 1 && chain.text.trim().split(/\s+/).length >= 4;
	}

	mount(el: HTMLElement) {
		this.el = el;
		document.addEventListener("keydown", this.keyH, true);
		this.draw();
	}
	unmount() {
		document.removeEventListener("keydown", this.keyH, true);
		this.el = null;
	}

	private onKey(e: KeyboardEvent) {
		if (!this.el) return;
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); this.primary(); return; }
		const t = e.target as HTMLElement;
		if (t.tagName === "TEXTAREA") return;
		if (e.key === " " || e.key === "Enter") { e.preventDefault(); this.primary(); }
	}

	private windowStart = () => Math.max(0, this.i - 2);
	private target(): string {
		if (this.phase === "hint") return this.s[this.i];
		if (this.phase === "recall") return this.s.slice(this.windowStart(), this.i + 1).join(" ");
		return this.s.join(" ");
	}

	private primary() {
		if (this.phase === "read") return this.setPhase("hint");
		if (this.phase === "done") return this.hub.endGame();
		if (this.result) return this.advance();
		this.check();
	}

	private setPhase(p: Phase) {
		this.phase = p;
		this.typed = "";
		this.result = null;
		this.draw();
	}

	private check() {
		this.result = wordDiff(this.target(), this.typed);
		this.tries++;
		this.draw();
	}

	private advance() {
		const pass = (this.result?.accuracy ?? 0) >= PASS;
		if (this.phase === "hint") return this.setPhase(pass ? "recall" : "hint");
		if (this.phase === "recall") {
			if (!pass) return this.setPhase("hint");
			this.hub.plugin.track("chain");
			this.i++;
			if (this.i >= this.s.length) return this.setPhase(this.s.length > 1 ? "final" : "done");
			return this.setPhase("read");
		}
		if (this.phase === "final") {
			const acc = this.result?.accuracy ?? 0;
			const c = this.chain;
			c.best = Math.max(c.best, Math.round(acc * 100));
			c.runs++;
			c.updated = Date.now();
			const p = this.hub.plugin;
			if (!p.data.chains.some((x) => x.id === c.id)) p.data.chains.unshift(c);
			p.data.meta.chainsDone = (p.data.meta.chainsDone ?? 0) + 1;
			p.addCoins(Math.round(acc * 25));
			p.checkAchievements();
			p.requestSave();
			this.phase = "done";
			this.draw();
		}
	}

	private masked(sentence: string): string {
		return sentence.split(/\s+/).map((w, k) => {
			const letters = w.replace(/[^\p{L}\p{N}]/gu, "");
			if (letters.length <= 2 || (k % 2 === 0 && letters.length < 8)) return w;
			return w[0] + "＿".repeat(Math.min(6, letters.length - 1)) + (/[.,;:!?]$/.test(w) ? w.slice(-1) : "");
		}).join(" ");
	}

	private draw() {
		const root = this.el;
		if (!root) return;
		root.empty();
		const wrap = root.createDiv("fch-chain");
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Keluar", onClick: () => this.hub.endGame() });
		const tt = top.createDiv("fch-study-title");
		tt.createDiv({ cls: "fch-study-name", text: `🔗 Rantai Hafalan · ${this.chain.title}` });
		tt.createDiv({ cls: "fch-muted fch-small", text: this.phase === "final" || this.phase === "done" ? "Tahap akhir: seluruh teks" : `Kalimat ${Math.min(this.i + 1, this.s.length)} dari ${this.s.length}` });
		const steps = wrap.createDiv("fch-rounds");
		this.s.forEach((_, k) => steps.createDiv({ cls: "fch-round-dot" + (k < this.i ? " is-done" : k === this.i ? " is-now" : "") }));

		if (this.phase === "done") {
			const acc = Math.round((this.result?.accuracy ?? 1) * 100);
			const box = wrap.createDiv("fch-summary");
			box.createDiv({ cls: "fch-sum-emoji", text: acc >= 95 ? "🏆" : acc >= 80 ? "🎉" : "🔗" });
			box.createEl("h2", { text: `Seluruh teks: ${acc}% tepat` });
			box.createEl("p", { cls: "fch-muted", text: `Skor terbaik ${this.chain.best}% · percobaan ke-${this.chain.runs}. Ulangi besok untuk menguatkan ingatan jangka panjang.` });
			if (this.result) this.drawDiff(box, this.result);
			const r = box.createDiv("fch-row fch-center");
			btn(r, { text: "Ulangi dari awal", icon: "rotate-ccw", cls: "fch-btn-primary", onClick: () => { this.i = 0; this.setPhase("read"); } });
			btn(r, { text: "Simpan sebagai kartu", icon: "plus", onClick: () => {
				const path = this.hub.plugin.sortedPaths()[0];
				if (!path) return void new Notice("Buat materi dulu untuk menyimpan kartu.");
				this.hub.plugin.saveStored(path, [{ type: "multiline", front: `Tulis lengkap: ${this.chain.title}`, back: this.chain.text }]);
				new Notice(`Disimpan sebagai kartu di ${basename(path)} agar diulang terjadwal.`);
			} });
			btn(r, { text: "Selesai", onClick: () => this.hub.endGame() });
			if (acc >= 90 && this.hub.plugin.data.settings.confetti) confetti(root);
			return;
		}

		const stage = wrap.createDiv("fch-card fch-chain-card");
		const hint = {
			read: "1 · Baca kalimat ini dengan teliti, ucapkan dalam hati.",
			hint: "2 · Tulis kalimat lengkap. Huruf awal kata yang disembunyikan masih terlihat.",
			recall: this.i > 0 ? "3 · Tanpa bantuan: tulis kalimat ini bersama kalimat sebelumnya." : "3 · Tanpa bantuan: tulis kalimat ini dari ingatan.",
			final: "Tahap akhir · Tulis seluruh teks tanpa melihat.",
		}[this.phase];
		stage.createDiv({ cls: "fch-chain-step", text: hint });
		const text = stage.createDiv("fch-chain-text");
		this.s.forEach((sen, k) => {
			if (this.phase === "final") return;
			const inWindow = this.phase === "recall" && k >= this.windowStart() && k <= this.i;
			if (k < this.i && !inWindow) text.createSpan({ cls: "fch-chain-old", text: sen + " " });
			else if (k === this.i && this.phase === "read") text.createSpan({ cls: "fch-chain-now", text: sen + " " });
			else if (k === this.i && this.phase === "hint") text.createSpan({ cls: "fch-chain-now is-masked", text: this.masked(sen) + " " });
			else if (inWindow) text.createSpan({ cls: "fch-chain-blank", text: "▁▁▁▁▁▁ " });
		});
		if (this.phase !== "read") {
			const ta = stage.createEl("textarea", { cls: "fch-input fch-explain-input", attr: { rows: this.phase === "final" ? "8" : "3", placeholder: "Tulis di sini…" } });
			ta.value = this.typed;
			ta.disabled = !!this.result;
			ta.oninput = () => (this.typed = ta.value);
			if (!this.result) window.setTimeout(() => ta.focus(), 30);
		}
		if (this.result) {
			const pass = this.result.accuracy >= PASS;
			const fb = stage.createDiv("fch-feedback " + (pass ? "is-good" : "is-bad"));
			fb.createDiv({ cls: "fch-feedback-title", text: `${Math.round(this.result.accuracy * 100)}% tepat — ${pass ? "lanjut!" : "ulangi dengan bantuan"}` });
			this.drawDiff(fb, this.result);
		}
		const act = wrap.createDiv("fch-actions");
		const label = this.phase === "read" ? "Sembunyikan & mulai menulis" : this.result ? ((this.result.accuracy >= PASS) ? (this.phase === "final" ? "Lihat hasil" : "Lanjut") : "Coba lagi") : "Periksa";
		const b = btn(act, { text: label, cls: "fch-btn-primary fch-btn-xl", onClick: () => this.primary() });
		b.createSpan({ cls: "fch-kbd", text: this.phase === "read" || this.result ? "Spasi" : "Ctrl+Enter" });
	}

	private drawDiff(parent: HTMLElement, r: ReturnType<typeof wordDiff>) {
		const d = parent.createDiv("fch-diff");
		for (const w of r.words) d.createSpan({ cls: w.ok ? "is-ok" : "is-miss", text: w.w + " " });
		if (r.extra) parent.createDiv({ cls: "fch-muted fch-small", text: `${r.extra} kata tambahan/keliru` });
	}
}

/** Halaman persiapan: tempel teks baru atau pilih teks tersimpan. */
export function renderChainSetup(hub: HubView, el: HTMLElement, prefill?: { title: string; text: string }) {
	const p = hub.plugin;
	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "🔗 Rantai Hafalan" });
	head.createDiv({ cls: "fch-muted", text: "Untuk menghafal teks panjang kata per kata: ayat, pasal, puisi, definisi, atau rumus. Teks dipecah per kalimat, lalu bantuan dikurangi sedikit demi sedikit sampai kamu bisa menulis semuanya tanpa melihat." });
	const box = el.createDiv("fch-panel fch-launch");
	const title = box.createEl("input", { type: "text", cls: "fch-input", attr: { placeholder: "Judul, mis. Pasal 28A UUD 1945" } });
	title.value = prefill?.title ?? "";
	const ta = box.createEl("textarea", { cls: "fch-input", attr: { rows: "7", placeholder: "Tempel teks yang ingin dihafal di sini…" } });
	ta.value = prefill?.text ?? "";
	ta.style.marginTop = "8px";
	const info = box.createDiv({ cls: "fch-muted fch-small" });
	const upd = () => info.setText(ta.value.trim() ? `${sentences(ta.value).length} kalimat · ${ta.value.trim().split(/\s+/).length} kata` : "");
	ta.oninput = upd;
	upd();
	const r = box.createDiv("fch-launch-foot");
	r.createDiv("fch-grow");
	btn(r, { text: "Mulai menghafal", icon: "play", cls: "fch-btn-primary fch-btn-lg", onClick: () => {
		const text = ta.value.trim();
		if (text.split(/\s+/).length < 4) return void new Notice("Teksnya terlalu pendek.");
		const c: Chain = { id: "c" + Date.now().toString(36), title: title.value.trim() || text.slice(0, 40), text, best: 0, runs: 0, updated: Date.now() };
		p.data.chains.unshift(c);
		p.requestSave();
		hub.startGame(new ChainGame(hub, c));
	} });
	if (p.data.chains.length) {
		const sec = el.createDiv("fch-section");
		sec.createEl("h3", { text: "Teks tersimpan" });
		const list = sec.createDiv("fch-fix-list");
		for (const c of p.data.chains.slice(0, 20)) {
			const row = list.createDiv("fch-chain-row");
			const t = row.createDiv("fch-grow");
			t.createDiv({ cls: "fch-strong", text: c.title });
			t.createDiv({ cls: "fch-muted fch-small", text: `${sentences(c.text).length} kalimat · terbaik ${c.best}% · ${c.runs}× latihan` });
			btn(row, { text: "Latih", icon: "play", cls: "fch-btn-sm fch-btn-primary", onClick: () => hub.startGame(new ChainGame(hub, c)) });
			btn(row, { icon: "trash-2", cls: "fch-btn-ghost fch-btn-sm", label: "Hapus", onClick: () => { p.data.chains = p.data.chains.filter((x) => x.id !== c.id); p.requestSave(); hub.renderPage(); } });
		}
	}
}
