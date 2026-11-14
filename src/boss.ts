import { Component } from "obsidian";
import type { HubView } from "./hub-view";
import type FlashcardPlugin from "./main";
import { Game } from "./match";
import { Card, ChoiceOption } from "./types";
import { quizOptions } from "./learn";
import { weekKey } from "./missions";
import { retention } from "./scheduler";
import { basename, btn, confetti, md, shuffle } from "./util";
import { dayKey } from "./scheduler";
import { grantPack } from "./collect";
import { cardFront } from "./occlusion";
import { dropMats } from "./alchemy";
import { HeroStats, bagBar, gearStrip, heroFigure, heroStats, usePotion } from "./gear";
import { Notice } from "obsidian";
import { play } from "./sound";

// ---------------------------------------------------------------- sprite pixel
export interface BossDef { name: string; pal: Record<string, string>; rows: string[] }
export interface BossExtra { custom?: BossDef; eventId?: string; onWin?: () => string[]; back?: "boss" | "event" }
export const BOSSES: BossDef[] = [
	{
		name: "Slime Lupa", pal: { G: "#4caf50", L: "#9be27a", D: "#2e7d32", W: "#ffffff", K: "#1b1b2f", R: "#e5484d" },
		rows: [".....GGGGGG.....", "...GGGGGGGGGG...", "..GGLLGGGGGGGG..", ".GGLLGGGGGGGGGG.", ".GGGGGGGGGGGGGG.", "GGGWWWGGGGWWWGGG", "GGGWKKGGGGWKKGGG", "GGGGGGGGGGGGGGGG", "GGGGGKKKKKKGGGGG", "GGGGGKRRRRKGGGGG", "GGGGGGKKKKGGGGGG", ".GGGGGGGGGGGGGG.", "..DDDDDDDDDDDD.."],
	},
	{
		name: "Kelelawar Kabur", pal: { P: "#6a4fc4", L: "#a68cf0", D: "#3b2a7a", Y: "#ffd23f", K: "#1b1b2f", W: "#ffffff" },
		rows: ["D..............D", "DD.....PP.....DD", "DPD...PPPP...DPD", "DPPD.PPPPPP.DPPD", "DPPPPPPPPPPPPPPD", "DPPPPYYPPYYPPPPD", ".DPPPYKPPYKPPPD.", "..DPPPPPPPPPPD..", "...DPPWPPWPPD...", "....DPPPPPPD....", ".....DP..PD.....", "......D..D......"],
	},
	{
		name: "Golem Gagal", pal: { S: "#9aa4b1", L: "#c9d1db", D: "#5d6673", O: "#f07a2c", K: "#1b1b2f", M: "#7fbf5a" },
		rows: [".....SSSSSS.....", "....SLLSSSSS....", "...SSSSSSSSSS...", "...SSOOSSOOSS...", "...SSSSSSSSSS...", "..MSSSKKKKSSSM..", ".SSSSSSSSSSSSSS.", "SSS.SSSSSSSS.SSS", "SS..SSLSSSSS..SS", "SS..SSSSSSSS..SS", "....SSSDDSSS....", "...DDDD..DDDD..."],
	},
	{
		name: "Naga Ngantuk", pal: { R: "#d9363e", D: "#7f1d1d", O: "#f59e0b", Y: "#fde047", K: "#1b1b2f", W: "#ffffff" },
		rows: ["DD............DD", ".DRR........RRD.", "..RRRRRRRRRRRR..", ".RRRRRRRRRRRRRR.", ".RRYKRRRRRRYKRR.", ".RRRRRRRRRRRRRR.", "RRRRRWRWWRWRRRRR", "RRRRRRRRRRRRRRRR", ".RROOOOOOOOOORR.", "..ROOOOOOOOOOR..", "..RR.RRRRRR.RR..", ".DD...DDDD...DD."],
	},
	{
		name: "Hantu Hafalan", pal: { W: "#f1f5ff", L: "#c7d2fe", K: "#1b1b2f", B: "#f9a8d4" },
		rows: [".....WWWWWW.....", "...WWWWWWWWWW...", "..WWWWWWWWWWWW..", ".WWWWWWWWWWWWWW.", ".WWKKWWWWWWKKWW.", ".WWKKWWWWWWKKWW.", ".WWWWWWWWWWWWWW.", ".WWBWWWKKWWWBWW.", ".WWWWWWKKWWWWWW.", ".WWWWWWWWWWWWWW.", ".LWWWWWWWWWWWWL.", ".LW.WWW.WWW.WWL.", ".L...W...W...L.."],
	},
	{
		name: "Robot Remidi", pal: { S: "#94a3b8", D: "#475569", C: "#22d3ee", R: "#ef4444", Y: "#facc15" },
		rows: [".......RR.......", ".......DD.......", "...SSSSSSSSSS...", "...SDDDDDDDDS...", "...SDCCDDCCDS...", "...SDDDDDDDDS...", "...SSYYYYYYSS...", ".DDSSSSSSSSSSDD.", ".DSSSSDSSDSSSSD.", ".DSSSSSSSSSSSSD.", "...SSSSSSSSSS...", "...SS......SS...", "..DDD......DDD.."],
	},
];

export function bossSprite(parent: HTMLElement, idx: number | BossDef, px = 10) {
	const b = typeof idx === "number" ? BOSSES[idx % BOSSES.length] : idx;
	const NS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(NS, "svg");
	const w = Math.max(...b.rows.map((r) => r.length)), h = b.rows.length;
	svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
	svg.setAttribute("width", String(w * px));
	svg.setAttribute("height", String(h * px));
	svg.setAttribute("shape-rendering", "crispEdges");
	svg.setAttribute("class", "fch-sprite");
	b.rows.forEach((row, y) => [...row].forEach((ch, x) => {
		const col = b.pal[ch];
		if (!col) return;
		const r = document.createElementNS(NS, "rect");
		r.setAttribute("x", String(x)); r.setAttribute("y", String(y));
		r.setAttribute("width", "1"); r.setAttribute("height", "1");
		r.setAttribute("fill", col);
		svg.appendChild(r);
	}));
	parent.appendChild(svg);
	return svg;
}

/** Boss mingguan: materi dengan ingatan terlemah. */
export function weeklyBoss(p: FlashcardPlugin): { path: string; sprite: number } | null {
	const now = Date.now();
	let best: { path: string; r: number } | null = null;
	for (const path of p.sortedPaths()) {
		let s = 0, n = 0;
		for (const c of p.index.get(path) ?? []) { const r = retention(p.data.cards[c.id], now); if (r !== null) { s += r; n++; } }
		const cards = (p.index.get(path) ?? []).length;
		if (cards < 4) continue;
		const r = n >= 3 ? s / n : 1.5; // belum banyak dipelajari = prioritas rendah
		if (!best || r < best.r) best = { path, r };
	}
	if (!best) return null;
	const wk = weekKey();
	let h = 0;
	for (const ch of wk) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return { path: best.path, sprite: h % BOSSES.length };
}

interface Q { card: Card; options: ChoiceOption[] }
export type Diff = "mudah" | "normal" | "sulit";
export const DIFFS: Record<Diff, { label: string; hearts: number; time: number; mult: number; desc: string }> = {
	mudah: { label: "Mudah", hearts: 5, time: 0, mult: 0.8, desc: "5 hati · tanpa batas waktu" },
	normal: { label: "Normal", hearts: 4, time: 0, mult: 1, desc: "4 hati · tanpa batas waktu" },
	sulit: { label: "Sulit", hearts: 3, time: 15, mult: 1.5, desc: "3 hati · 15 detik per soal · hadiah ×1,5" },
};

export class BossBattle implements Game {
	ok: boolean;
	private qs: Q[] = [];
	private qi = 0;
	private hp = 100;
	private hearts = 5;
	private combo = 0;
	private maxCombo = 0;
	private correct = 0;
	private wrongCards: Card[] = [];
	private picked: number | null = null;
	private fx: "hit" | "crit" | "special" | "hurt" | null = null;
	private dmg = 0;
	private el: HTMLElement | null = null;
	private comp: Component | null = null;
	private keyH = (e: KeyboardEvent) => this.onKey(e);
	private finished: "win" | "lose" | null = null;
	private intro = true;
	private started = Date.now();
	private qStart = Date.now();
	private timer: number | null = null;
	private rewards: string[] = [];
	private gear: HeroStats;
	private maxHearts = 5;
	private shield = false;
	private clover = false;
	private hidden = new Set<number>();
	private msg = "";

	constructor(private hub: HubView, cards: Card[], public title: string, private sprite: number, private weekly: boolean, private diff: Diff = "normal", private path = "", private extra: BossExtra = {}) {
		this.gear = heroStats(hub.plugin);
		for (const c of shuffle([...cards])) {
			const o = quizOptions(hub.plugin, c, 4);
			if (o && o.filter((x) => x.correct).length === 1) this.qs.push({ card: c, options: o });
			if (this.qs.length >= 40) break;
		}
		this.ok = this.qs.length >= 4;
		this.hearts = this.maxHearts = DIFFS[diff].hearts + this.gear.hp;
	}
	mount(el: HTMLElement) {
		this.el = el;
		document.addEventListener("keydown", this.keyH, true);
		this.draw();
		window.setTimeout(() => { this.intro = false; this.qStart = Date.now(); this.startTimer(); this.draw(); }, 1500);
	}
	unmount() { document.removeEventListener("keydown", this.keyH, true); this.stopTimer(); this.comp?.unload(); this.el = null; }

	private get boss() { return this.extra.custom ?? BOSSES[this.sprite % BOSSES.length]; }
	private get enraged() { return this.hp <= 50 && !this.finished; }
	private get limit() { const t = DIFFS[this.diff].time; return t ? (this.enraged ? t - 3 : t) + this.gear.time : 0; }

	private startTimer() {
		this.stopTimer();
		if (!this.limit || this.finished) return;
		this.timer = window.setInterval(() => {
			const left = this.limit - (Date.now() - this.qStart) / 1000;
			const bar = this.el?.querySelector(".fch-b2-timefill") as HTMLElement | null;
			if (bar) bar.style.width = `${Math.max(0, (left / this.limit) * 100)}%`;
			if (left <= 0 && this.picked === null) this.choose(-1);
		}, 200);
	}
	private stopTimer() { if (this.timer) window.clearInterval(this.timer); this.timer = null; }

	private onKey(e: KeyboardEvent) {
		if (!this.el || this.intro || e.ctrlKey || e.metaKey) return;
		if (this.finished) { if (e.key === "Enter") { e.preventDefault(); this.hub.endGame(); } return; }
		if (this.picked === null && ["1", "2", "3", "4"].includes(e.key)) { e.preventDefault(); this.choose(parseInt(e.key, 10) - 1); }
		else if (this.picked === null && (e.key === "s" || e.key === "S") && this.combo >= this.gear.comboNeed) { e.preventDefault(); this.special(); }
		else if (this.picked !== null && (e.key === " " || e.key === "Enter")) { e.preventDefault(); this.next(); }
	}

	private hitBoss(n: number, kind: "hit" | "crit" | "special") {
		this.dmg = Math.round(n);
		this.hp = Math.max(0, this.hp - this.dmg);
		this.fx = kind;
		play("hit");
	}

	private special() {
		if (this.combo < this.gear.comboNeed || this.finished) return;
		this.combo = 0;
		this.hitBoss(30 * (1 + this.gear.atk), "special");
		if (this.hp <= 0) return this.finish("win");
		this.draw();
	}

	private choose(k: number) {
		if (this.picked !== null || this.finished || (k >= 0 && this.hidden.has(k))) return;
		const q = this.qs[this.qi % this.qs.length];
		this.picked = k;
		this.stopTimer();
		const ok = k >= 0 && !!q.options[k]?.correct;
		if (ok) {
			this.correct++;
			this.combo++;
			this.maxCombo = Math.max(this.maxCombo, this.combo);
			const base = (10 + Math.min(10, this.combo * 2)) * (1 + this.gear.atk);
			const crit = this.combo >= 3 || Math.random() < this.gear.crit;
			this.hitBoss(crit ? base * 1.5 : base, crit ? "crit" : "hit");
			this.msg = crit && this.combo < 3 ? "🎯 Serangan kritis dari senjatamu!" : "";
			play("correct");
		} else {
			this.combo = 0;
			this.wrongCards.push(q.card);
			if (this.shield) { this.shield = false; this.msg = "🔰 Perisai menangkis serangan boss!"; play("hit"); }
			else if (Math.random() < this.gear.block) { this.msg = "🛡️ Zirahmu menangkis serangan! Hati tidak berkurang."; play("hit"); }
			else {
				this.hearts -= this.enraged && this.diff === "sulit" ? 2 : 1;
				this.fx = "hurt";
				this.msg = "";
				play("hurt");
			}
		}
		if (this.hp <= 0) return this.finish("win");
		if (this.hearts <= 0 && usePotion(this.hub.plugin, "phoenix")) { this.hearts = 2; this.msg = "🪶 Bulu Phoenix menyala, kamu bangkit dengan 2 ❤️!"; play("levelup"); }
		if (this.hearts <= 0) return this.finish("lose");
		this.draw();
		if (ok) window.setTimeout(() => { if (this.picked !== null && !this.finished) this.next(); }, 900);
	}

	private next() {
		this.picked = null;
		this.fx = null;
		this.hidden.clear();
		if (!this.msg.startsWith("🪶")) this.msg = "";
		this.qi++;
		this.qStart = Date.now();
		this.draw();
		this.startTimer();
	}

	private finish(r: "win" | "lose") {
		this.finished = r;
		this.stopTimer();
		const p = this.hub.plugin;
		const m = DIFFS[this.diff].mult;
		if (r === "win") {
			const coins = Math.round((this.weekly ? 100 : 40 + this.correct * 2) * m * (1 + this.gear.coin) * (this.clover ? 2 : 1));
			p.addCoins(coins);
			this.rewards.push(`🪙 ${coins} koin`);
			const mats = dropMats(p, this.weekly ? "weekly" : this.extra.eventId ? "event" : this.diff === "sulit" ? "bossHard" : "boss");
			this.rewards.push(...mats);
			if (this.extra.onWin) this.rewards.push(...this.extra.onWin());
			p.data.meta.bossWins = (p.data.meta.bossWins ?? 0) + 1;
			if (this.path) { const d = (p.data.meta.bossDefeats ??= {}); d[this.path] = (d[this.path] ?? 0) + 1; }
			if (this.weekly) { if (grantPack(p, 2, "Boss mingguan dikalahkan", `boss:week:${weekKey()}`)) this.rewards.push("🎴 2 bungkus kartu"); }
			else if (grantPack(p, 1, "Boss dikalahkan", `boss:${this.path}:${dayKey(Date.now())}`)) this.rewards.push("🎴 1 bungkus kartu");
			if (this.weekly) p.data.meta.bossWeek = weekKey();
			p.track("boss");
			play("victory");
		} else {
			p.addCoins(10);
			this.rewards.push("🪙 10 koin hiburan");
			play("defeat");
		}
		p.requestSave();
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
		const wrap = root.createDiv("fch-b2" + (this.enraged ? " is-enraged" : "") + (this.fx === "hurt" ? " is-hurt" : ""));
		wrap.style.setProperty("--bc", Object.values(this.boss.pal)[0]);
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Keluar", onClick: () => this.hub.endGame() });
		const tt = top.createDiv("fch-study-title");
		tt.createDiv({ cls: "fch-study-name", text: `${this.weekly ? "👑 Boss mingguan · " : "⚔️ "}${this.title}` });
		tt.createDiv({ cls: "fch-muted fch-small", text: `${DIFFS[this.diff].label} · ${DIFFS[this.diff].desc}` });

		const stage = wrap.createDiv("fch-b2-stage");
		const bossBox = stage.createDiv("fch-b2-boss" + (this.fx ? " fx-" + this.fx : "") + (this.finished === "win" ? " is-dead" : ""));
		bossSprite(bossBox, this.extra.custom ?? this.sprite, 14);
		if (this.fx && this.fx !== "hurt") bossBox.createDiv({ cls: "fch-b2-dmg" + (this.fx !== "hit" ? " is-big" : ""), text: `-${this.dmg}${this.fx === "special" ? " ⚡" : this.fx === "crit" ? "!" : ""}` });
		const info = stage.createDiv("fch-b2-info");
		const me = stage.createDiv("fch-b2-me" + (this.fx === "hurt" ? " is-hit" : ""));
		heroFigure(this.hub.plugin, me, 5);
		info.createDiv({ cls: "fch-b2-name", text: this.boss.name + (this.enraged ? " · MENGAMUK! 🔥" : "") });
		const hpb = info.createDiv("fch-b2-hp");
		hpb.createDiv("fch-b2-hptrail").style.width = `${Math.min(100, this.hp + this.dmg)}%`;
		hpb.createDiv("fch-b2-hpfill").style.width = `${this.hp}%`;
		hpb.createSpan({ cls: "fch-b2-hptxt", text: `${this.hp} / 100` });

		if (this.intro) {
			const sp = wrap.createDiv("fch-b2-intro");
			sp.createDiv({ cls: "fch-b2-intro-t", text: `${this.boss.name} muncul!` });
			sp.createDiv({ cls: "fch-b2-intro-s", text: "Jawab benar untuk menyerang · 1–4 memilih · S = pamungkas" });
			return;
		}

		const player = wrap.createDiv("fch-b2-player");
		const hearts = player.createDiv("fch-b2-hearts");
		for (let i = 0; i < Math.max(this.maxHearts, this.hearts); i++) hearts.createSpan({ text: i < this.hearts ? "❤️" : "🖤" });
		if (this.shield) hearts.createSpan({ cls: "fch-b2-shield", text: "🔰" });
		const cm = player.createDiv("fch-b2-combo");
		cm.createSpan({ cls: "fch-small fch-strong", text: `Combo ${this.combo}` });
		const seg = cm.createDiv("fch-b2-segs");
		const need = this.gear.comboNeed;
		for (let i = 0; i < need; i++) seg.createSpan({ cls: i < Math.min(need, this.combo) ? "is-on" : "" });
		const sb = player.createEl("button", { cls: "fch-b2-special" + (this.combo >= need && !this.finished ? " is-ready" : ""), text: "⚡ Pamungkas (S)" });
		sb.disabled = this.combo < need || !!this.finished;
		sb.onclick = () => this.special();
		if (!this.finished) {
			const p = this.hub.plugin;
			bagBar(p, wrap, {
				usable: (id) => {
					if (id === "heal" || id === "bigheal") return this.hearts < this.maxHearts;
					if (id === "shield") return !this.shield;
					if (id === "lens") return this.picked === null && this.hidden.size === 0;
					if (id === "hourglass") return !!this.limit && this.picked === null;
					if (id === "clover") return !this.clover;
					return id === "bomb";
				},
				use: (id) => {
					if (id === "heal") { this.hearts = Math.min(this.maxHearts, this.hearts + 1); this.msg = "🧪 +1 ❤️"; }
					else if (id === "bigheal") { this.hearts = this.maxHearts; this.msg = "⚗️ Semua hati pulih!"; }
					else if (id === "shield") { this.shield = true; this.msg = "🔰 Perisai siap menangkis serangan berikutnya."; }
					else if (id === "lens") { const q = this.qs[this.qi % this.qs.length]; const wrong = shuffle(q.options.map((o, i) => (o.correct ? -1 : i)).filter((i) => i >= 0)); wrong.slice(0, 2).forEach((i) => this.hidden.add(i)); this.msg = "🔍 Dua pilihan salah disingkirkan."; }
					else if (id === "hourglass") { this.qStart = Date.now(); this.msg = "⏳ Waktu diisi ulang!"; }
					else if (id === "clover") { this.clover = true; this.msg = "🍀 Koin ×2 untuk pertarungan ini!"; }
					else if (id === "bomb") { this.hitBoss(25, "special"); this.msg = "💣 BOOM! 25 kerusakan."; if (this.hp <= 0) return this.finish("win"); }
					this.draw();
				},
			});
			if (this.msg) wrap.createDiv({ cls: "fch-b2-msg", text: this.msg });
		}

		if (this.finished) return this.drawResult(wrap);
		const q = this.qs[this.qi % this.qs.length];
		const card = wrap.createDiv("fch-b2-q");
		if (this.limit) { const tf = card.createDiv("fch-b2-time").createDiv("fch-b2-timefill"); tf.style.width = `${Math.max(0, (1 - (Date.now() - this.qStart) / 1000 / this.limit) * 100)}%`; }
		cardFront(this.hub.plugin, this.comp, card, q.card);
		const opts = card.createDiv("fch-b2-opts");
		q.options.forEach((o, k) => {
			const b = opts.createEl("button", { cls: "fch-b2-opt" + (this.picked !== null ? (o.correct ? " is-ok" : this.picked === k ? " is-bad" : " is-dim") : this.hidden.has(k) ? " is-gone" : "") });
			if (this.hidden.has(k) && this.picked === null) b.disabled = true;
			b.createSpan({ cls: "fch-kbd", text: String(k + 1) });
			md(this.hub.app, this.comp!, b.createDiv("markdown-rendered"), o.text, q.card.path);
			b.onclick = () => this.choose(k);
		});
		if (this.picked !== null && !q.options[this.picked]?.correct) {
			const fb = card.createDiv("fch-b2-fb");
			fb.createSpan({ text: this.picked < 0 ? "⏰ Waktu habis! " : "💥 Boss menyerang! " });
			fb.createSpan({ cls: "fch-muted", text: "Perhatikan jawaban yang benar (hijau)." });
			btn(card, { text: "Lanjut (Spasi)", cls: "fch-btn-primary fch-mt", onClick: () => this.next() });
		}
	}

	private drawResult(wrap: HTMLElement) {
		const win = this.finished === "win";
		const r = wrap.createDiv("fch-b2-result" + (win ? " is-win" : " is-lose"));
		r.createDiv({ cls: "fch-b2-rt", text: win ? "🏆 MENANG!" : "💀 Kalah…" });
		r.createDiv({ cls: "fch-muted", text: win ? `${this.boss.name} tumbang! Ingatanmu tentang materi ini makin kuat.` : "Jangan menyerah. Latih kartu yang salah, lalu tantang lagi." });
		const st = r.createDiv("fch-b2-stats");
		const total = this.correct + this.wrongCards.length;
		const s = (v: string, l: string) => { const x = st.createDiv("fch-b2-stat"); x.createDiv({ cls: "fch-strong", text: v }); x.createDiv({ cls: "fch-small fch-muted", text: l }); };
		s(`${total ? Math.round((this.correct / total) * 100) : 0}%`, "akurasi");
		s(String(this.maxCombo), "combo tertinggi");
		s(`${Math.round((Date.now() - this.started) / 1000)} dtk`, "waktu");
		const rw = r.createDiv("fch-b2-rewards");
		for (const x of this.rewards) rw.createSpan({ cls: "fch-b2-rw", text: x });
		const bt = r.createDiv("fch-row fch-center fch-mt");
		if (this.wrongCards.length) btn(bt, { text: `Latih ${this.wrongCards.length} kartu yang salah`, icon: "zap", onClick: () => this.hub.startSession([...new Set(this.wrongCards)], { title: this.title, cram: true, mode: "classic" }) });
		if (this.rewards.some((x) => x.includes("bungkus"))) btn(bt, { text: "Buka bungkus kartu", icon: "gift", cls: "fch-btn-primary", onClick: () => { this.hub.endGame(); this.hub.navigate("album"); } });
		const back = this.extra.back ?? "boss";
		btn(bt, { text: back === "event" ? "Kembali ke Event" : "Kembali ke Aula Boss", cls: win ? "" : "fch-btn-primary", onClick: () => { this.hub.endGame(); this.hub.navigate(back); } });
		if (win && this.hub.plugin.data.settings.confetti) confetti(wrap);
	}
}

// ---------------------------------------------------------------- Aula Boss
let hallDiff: Diff = "normal";
const spriteFor = (path: string) => { let h = 0; for (const ch of path) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % BOSSES.length; };

export function renderBossHall(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "👾 Aula Boss" });
	head.createDiv({ cls: "fch-muted", text: "Setiap materi dijaga monster. Jawab benar untuk menyerang; jawaban salah membuatmu kehilangan hati. Kalahkan untuk mendapat koin dan bungkus kartu koleksi." });
	gearStrip(hub, el);
	const seg = el.createDiv("fch-b2-diffs");
	for (const d of Object.keys(DIFFS) as Diff[]) {
		const b = seg.createEl("button", { cls: "fch-b2-diff" + (hallDiff === d ? " is-on" : "") });
		b.createDiv({ cls: "fch-strong", text: DIFFS[d].label });
		b.createDiv({ cls: "fch-small fch-muted", text: DIFFS[d].desc });
		b.onclick = () => { hallDiff = d; hub.renderPage(); };
	}
	const wb = weeklyBoss(p);
	if (wb) {
		const beaten = p.data.collect.granted.includes(`boss:week:${weekKey()}`);
		const hero = el.createDiv("fch-b2-hero" + (beaten ? " is-beaten" : ""));
		hero.style.setProperty("--bc", Object.values(BOSSES[wb.sprite].pal)[0]);
		const sp = hero.createDiv("fch-b2-hero-sprite");
		bossSprite(sp, wb.sprite, 12);
		const t = hero.createDiv("fch-grow");
		t.createDiv({ cls: "fch-b2-badge", text: "👑 BOSS MINGGUAN" });
		t.createDiv({ cls: "fch-b2-hero-name", text: BOSSES[wb.sprite].name });
		t.createDiv({ cls: "fch-small", text: `Menjaga materi terlemahmu: ${basename(wb.path)}` });
		const rw = t.createDiv("fch-row fch-mt");
		rw.createSpan({ cls: "fch-b2-rw", text: `🪙 ${Math.round(100 * DIFFS[hallDiff].mult)}` });
		rw.createSpan({ cls: "fch-b2-rw", text: "🎴 2 bungkus kartu" });
		if (beaten) rw.createSpan({ cls: "fch-b2-rw", text: "✓ sudah dikalahkan minggu ini" });
		btn(t, { text: beaten ? "Tantang lagi" : "Lawan!", icon: "swords", cls: "fch-btn-primary fch-btn-lg fch-mt", onClick: () => {
			const g = new BossBattle(hub, p.index.get(wb.path) ?? [], basename(wb.path), wb.sprite, !beaten, hallDiff, wb.path);
			if (!hub.startGame(g)) new Notice("Butuh minimal 4 kartu yang bisa dijadikan soal pilihan ganda.");
		} });
	}
	const gal = el.createDiv("fch-panel fch-mt");
	gal.createEl("h3", { text: "⚔️ Boss setiap materi" });
	const grid = gal.createDiv("fch-b2-gallery");
	const now = Date.now();
	for (const path of p.sortedPaths()) {
		const cards = p.index.get(path) ?? [];
		if (cards.length < 4) continue;
		let s = 0, n = 0;
		for (const c of cards) { const r = retention(p.data.cards[c.id], now); if (r !== null) { s += r; n++; } }
		const strength = n ? Math.round((1 - s / n) * 100) : 100;
		const sp = spriteFor(path);
		const wins = p.data.meta.bossDefeats?.[path] ?? 0;
		const c = grid.createDiv("fch-b2-gcard" + (wins ? " is-beaten" : ""));
		c.style.setProperty("--bc", Object.values(BOSSES[sp].pal)[0]);
		bossSprite(c.createDiv("fch-b2-gsprite"), sp, 5);
		c.createDiv({ cls: "fch-strong fch-small", text: basename(path) });
		c.createDiv({ cls: "fch-muted fch-small", text: `${BOSSES[sp].name}` });
		const bar = c.createDiv("fch-b2-gpow");
		bar.createDiv().style.width = `${strength}%`;
		c.createDiv({ cls: "fch-small", text: `Kekuatan ${strength}%${wins ? ` · 🏆 ${wins}×` : ""}` });
		btn(c, { text: "Tantang", icon: "swords", cls: "fch-btn-sm", onClick: () => { if (!hub.startGame(new BossBattle(hub, cards, basename(path), sp, false, hallDiff, path))) new Notice("Butuh minimal 4 kartu pilihan ganda."); } });
	}
	if (!grid.childElementCount) gal.createDiv({ cls: "fch-muted", text: "Belum ada materi dengan minimal 4 kartu." });
	const how = el.createDiv("fch-panel fch-mt fch-b2-how");
	how.createEl("h3", { text: "📖 Cara bertarung" });
	for (const t of ["✅ Jawaban benar menyerang boss (10–20 kerusakan). Combo ≥ 3 memberi serangan kritis ×1,5.", "⚡ Saat combo mencapai 5, tombol Pamungkas aktif: 30 kerusakan seketika.", "❤️ Jawaban salah mengurangi hati. Di mode Sulit, boss yang mengamuk (HP < 50%) memberi 2 kerusakan dan waktu menjawab berkurang.", "🎴 Boss mingguan memberi 2 bungkus kartu; boss materi memberi 1 bungkus (sekali per materi per hari).", "🧠 Kekuatan boss = seberapa lemah ingatanmu di materi itu. Semakin sering diulas, semakin lemah bossnya."]) how.createDiv({ cls: "fch-small", text: t });
}
