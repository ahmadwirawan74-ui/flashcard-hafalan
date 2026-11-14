import { Component, Notice } from "obsidian";
import type { HubView } from "./hub-view";
import { Game } from "./match";
import { Card, ChoiceOption } from "./types";
import { quizOptions } from "./learn";
import { basename, btn, confetti, md, shuffle } from "./util";
import { play } from "./sound";
import { grantPack } from "./collect";
import { cardFront } from "./occlusion";
import { addMat, dropMats } from "./alchemy";
import { HeroStats, bagBar, gearStrip, heroFigure, heroStats, usePotion } from "./gear";
import { dayKey } from "./scheduler";

// ================================================================ dunia
type Room = "monster" | "elite" | "chest" | "trap" | "fountain" | "merchant" | "guardian" | "altar" | "camp" | "mystery" | "vault";
const ROOM: Record<Room, { icon: string; name: string; hint: string }> = {
	monster: { icon: "👹", name: "Monster", hint: "Jawab benar untuk menyerang" },
	elite: { icon: "⭐", name: "Monster elite", hint: "Lebih kuat, emas ×2,5" },
	chest: { icon: "🧰", name: "Peti harta", hint: "Emas, kunci, kadang bungkus kartu… atau Mimic!" },
	trap: { icon: "🪤", name: "Jebakan", hint: "Benar atau salah, cepat!" },
	fountain: { icon: "⛲", name: "Air mancur", hint: "+1 ❤️, tempat aman untuk keluar" },
	merchant: { icon: "🧙", name: "Pedagang", hint: "Belanja dengan emas dungeon" },
	guardian: { icon: "💀", name: "Bos Zona", hint: "Kalahkan untuk membuka zona berikutnya" },
	altar: { icon: "🔮", name: "Altar Berkah", hint: "Pilih 1 relik untuk penjelajahan ini" },
	camp: { icon: "🏕️", name: "Api unggun", hint: "Istirahat atau asah senjata" },
	mystery: { icon: "❔", name: "Ruang misteri", hint: "Siapa tahu apa yang menunggu…" },
	vault: { icon: "🔐", name: "Ruang harta", hint: "Butuh 🗝️ kunci. Harta besar!" },
};
type Mon = [string, string];
interface Zone { name: string; icon: string; c1: string; c2: string; acc: string; fx: string; mons: Mon[]; elite: Mon; boss: Mon }
export const ZONES: Zone[] = [
	{ name: "Gua Lumut", icon: "🍄", c1: "#166534", c2: "#052e16", acc: "#86efac", fx: "spores", mons: [["🐀", "Tikus Lupa"], ["🦇", "Kelelawar Bingung"], ["🐌", "Siput Lambat"]], elite: ["🕷️", "Laba-laba Ragu"], boss: ["🐲", "Naga Lumut"] },
	{ name: "Reruntuhan Kuno", icon: "🏺", c1: "#92400e", c2: "#1c1917", acc: "#fcd34d", fx: "dust", mons: [["🦂", "Kalajengking Keliru"], ["🐍", "Ular Pelupa"], ["🧟", "Zombi Ngantuk"]], elite: ["🗿", "Patung Pembisu"], boss: ["🦁", "Sfinks Teka-teki"] },
	{ name: "Kastil Es", icon: "❄️", c1: "#1e40af", c2: "#0b1224", acc: "#bae6fd", fx: "snow", mons: [["🐺", "Serigala Beku"], ["👻", "Hantu Dingin"], ["🦉", "Burung Hantu Kaku"]], elite: ["☃️", "Manusia Salju Malas"], boss: ["🧊", "Ratu Es Pelupa"] },
	{ name: "Lava Naga", icon: "🌋", c1: "#991b1b", c2: "#1c0a0a", acc: "#fdba74", fx: "embers", mons: [["👹", "Oni Remidi"], ["🦎", "Kadal Bara"], ["🔥", "Roh Api Panik"]], elite: ["👺", "Tengu Tergesa"], boss: ["🐉", "Naga Ujian"] },
	{ name: "Kehampaan Bintang", icon: "🌌", c1: "#581c87", c2: "#020617", acc: "#c4b5fd", fx: "stars", mons: [["👾", "Alien Acak"], ["🛸", "Piring Bingung"], ["🌀", "Pusaran Lupa"]], elite: ["🤖", "Robot Remidi"], boss: ["🌑", "Bayangan Agung"] },
];
export const zoneOf = (floor: number) => Math.min(ZONES.length - 1, Math.floor((floor - 1) / 5));

interface Relic { id: string; icon: string; name: string; desc: string }
const RELICS: Relic[] = [
	{ id: "pedang", icon: "🗡️", name: "Pedang Api", desc: "+1 kerusakan setiap serangan" },
	{ id: "jantung", icon: "💗", name: "Jantung Kristal", desc: "+1 ❤️ maksimal dan pulihkan 1 ❤️" },
	{ id: "kantong", icon: "💰", name: "Kantong Rakus", desc: "+30% emas dari semua sumber" },
	{ id: "mata", icon: "🦅", name: "Mata Elang", desc: "Setiap soal, 1 pilihan salah otomatis tersingkir" },
	{ id: "sayap", icon: "🪽", name: "Sayap Malaikat", desc: "+20% peluang menangkis serangan" },
	{ id: "jam", icon: "⏳", name: "Jam Pasir Abadi", desc: "+5 detik di jebakan & mode Mimpi Buruk" },
	{ id: "obor", icon: "🔥", name: "Obor Semangat", desc: "Semangat naik 2× lebih cepat" },
	{ id: "kunci", icon: "🗝️", name: "Kunci Master", desc: "Dapat 2 kunci; peti lebih sering berisi kunci" },
	{ id: "lilin", icon: "🕯️", name: "Lilin Penyembuh", desc: "Pulihkan 2 ❤️ setiap memasuki zona baru" },
];
const relic = (id: string) => RELICS.find((r) => r.id === id)!;

export type DMode = "santai" | "normal" | "mimpi";
export const MODES: Record<DMode, { label: string; icon: string; hp: number; time: number; gold: number; desc: string }> = {
	santai: { label: "Santai", icon: "🌿", hp: 6, time: 0, gold: 0.8, desc: "6 ❤️ · tanpa batas waktu · emas ×0,8" },
	normal: { label: "Normal", icon: "⚔️", hp: 4, time: 0, gold: 1, desc: "4 ❤️ · tanpa batas waktu" },
	mimpi: { label: "Mimpi Buruk", icon: "💀", hp: 3, time: 15, gold: 1.6, desc: "3 ❤️ · 15 detik per soal · emas ×1,6" },
};

/** Angka acak yang bisa diulang (Dungeon Harian: denah sama untuk semua percobaan di hari itu). */
function mulberry(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const seedOf = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

interface Q { card: Card; options: ChoiceOption[] }
type Phase = "room" | "doors" | "over";
interface Door { room: Room; hidden: boolean }
type Mystery = "statue" | "wish" | "glow" | "scroll";

export class DungeonRun implements Game {
	ok: boolean;
	private qs: Q[] = [];
	qi = 0;
	floor = 1;
	hp = 3;
	MAXHP = 5;
	private gear: HeroStats;
	private shield = false;
	private clover = false;
	hidden = new Set<number>();
	private note = "";
	gold = 0;
	private packs = 0;
	matsGot: string[] = [];
	private keys = 0;
	private relics: string[] = [];
	private streak = 0;
	private bestStreak = 0;
	private sharpen = 0;
	private cleared = 0;
	room: Room = "monster";
	phase: Phase = "room";
	doors: Door[] = [];
	private mon: Mon = ["👹", "Monster"];
	private monHp = 1;
	private monMax = 1;
	private fx: "" | "hit" | "crit" | "hurt" | "kill" | "block" = "";
	private dmg = 0;
	picked: number | null = null;
	trapClaim = { text: "", correct: true };
	trapAns: boolean | null = null;
	private trapTimer: number | null = null;
	private trapLeft = 8;
	private qTimer: number | null = null;
	private qStart = 0;
	outcome = "";
	resolved = false;
	private altarOffer: string[] = [];
	private shopOffer: { id: string; icon: string; name: string; price: number; sold?: boolean }[] = [];
	private mystery: Mystery = "statue";
	private mysteryQ = false;
	private history: { room: Room; ok: boolean }[] = [];
	over: "dead" | "escaped" | null = null;
	private zoneIntro = true;
	private el: HTMLElement | null = null;
	private comp: Component | null = null;
	private keyH = (e: KeyboardEvent) => this.onKey(e);
	private rng: () => number;

	constructor(private hub: HubView, cards: Card[], private title: string, private mode: DMode = "normal", private daily = false) {
		this.rng = daily ? mulberry(seedOf("dungeon-" + dayKey(Date.now()))) : Math.random;
		for (const c of daily ? [...cards].sort((a, b) => seedOf(a.id + dayKey(Date.now())) - seedOf(b.id + dayKey(Date.now()))) : shuffle([...cards])) {
			const o = quizOptions(hub.plugin, c, 4);
			if (o && o.filter((x) => x.correct).length === 1) this.qs.push({ card: c, options: o });
			if (this.qs.length >= 80) break;
		}
		this.ok = this.qs.length >= 4;
		this.gear = heroStats(hub.plugin);
		const m = MODES[mode];
		this.MAXHP = m.hp + this.gear.hp;
		this.hp = this.MAXHP;
		this.room = "monster";
	}
	mount(el: HTMLElement) {
		this.el = el;
		document.addEventListener("keydown", this.keyH, true);
		this.enterRoom("monster");
		window.setTimeout(() => { this.zoneIntro = false; if (this.phase === "room") this.draw(); }, 1600);
	}
	unmount() { document.removeEventListener("keydown", this.keyH, true); this.stopTimers(); this.comp?.unload(); this.el = null; }

	private get q() { return this.qs[this.qi % this.qs.length]; }
	private get zone() { return ZONES[zoneOf(this.floor)]; }
	private has(r: string) { return this.relics.includes(r); }
	private get mult() { return Math.min(2, 1 + this.streak * (this.has("obor") ? 0.2 : 0.1)); }
	private get qLimit() { return MODES[this.mode].time ? MODES[this.mode].time + this.gear.time + (this.has("jam") ? 5 : 0) : 0; }
	private isFight() { return this.room === "monster" || this.room === "elite" || this.room === "guardian" || (this.room === "mystery" && this.mysteryQ) || this.room === "chest"; }

	// ---------------------------------------------------------------- pintu & ruangan
	private rollDoors(): Door[] {
		const next = this.floor + 1;
		if (next % 5 === 0) return [{ room: "guardian", hidden: false }];
		const w: [Room, number][] = [["monster", 32], ["elite", next >= 3 ? 10 : 0], ["chest", 12], ["trap", 10], ["fountain", 6], ["merchant", next >= 3 ? 6 : 0], ["altar", 7], ["camp", this.room === "camp" ? 0 : 6], ["mystery", 9]];
		const pick = (): Room => { const tot = w.reduce((a, x) => a + x[1], 0); let r = this.rng() * tot; for (const [k, v] of w) { if (r < v) return k; r -= v; } return "monster"; };
		const n = next >= 6 ? 3 : 2;
		const out: Door[] = [];
		let guard = 0;
		while (out.length < n && guard++ < 40) { const r = pick(); if (out.some((d) => d.room === r)) continue; out.push({ room: r, hidden: r === "mystery" || this.rng() < 0.15 }); }
		if (this.keys > 0 && this.rng() < 0.6) out[out.length - 1] = { room: "vault", hidden: false };
		return out;
	}

	private enterRoom(r: Room) {
		const prevZone = zoneOf(this.floor - 1);
		this.room = r;
		this.phase = "room";
		this.picked = null;
		this.hidden.clear();
		this.outcome = "";
		this.note = "";
		this.resolved = false;
		this.trapAns = null;
		this.fx = "";
		this.mysteryQ = false;
		const z = this.zone;
		if (this.floor > 1 && zoneOf(this.floor) !== prevZone) {
			this.zoneIntro = true;
			if (this.has("lilin")) this.hp = Math.min(this.MAXHP, this.hp + 2);
			window.setTimeout(() => { this.zoneIntro = false; if (this.phase === "room") this.draw(); }, 1600);
		}
		const tier = Math.floor((this.floor - 1) / 5);
		if (r === "monster") { this.mon = z.mons[Math.floor(this.rng() * z.mons.length)]; this.monHp = this.monMax = 1 + (tier >= 3 ? 1 : 0); }
		if (r === "elite") { this.mon = z.elite; this.monHp = this.monMax = 2 + (tier >= 2 ? 1 : 0); }
		if (r === "guardian") { this.mon = z.boss; this.monHp = this.monMax = 3 + (tier >= 2 ? 1 : 0) + (tier >= 4 ? 1 : 0); }
		if (r === "chest" && this.rng() < 0.12) { this.room = "elite"; this.mon = ["🧰", "Mimic Penipu"]; this.monHp = this.monMax = 2; this.note = "😱 Petinya ternyata Mimic!"; }
		if (r === "fountain") { const before = this.hp; this.hp = Math.min(this.MAXHP, this.hp + 1); this.outcome = (this.hp > before ? "💧 Airnya menyegarkan: +1 ❤️" : "💧 Hatimu sudah penuh.") + this.drop("fountain"); this.resolved = true; play("chime"); }
		if (r === "altar") this.altarOffer = shuffle(RELICS.filter((x) => !this.has(x.id)).map((x) => x.id)).slice(0, 3);
		if (r === "merchant") this.shopOffer = shuffle([
			{ id: "potion", icon: "🧪", name: "Ramuan (+1 ❤️)", price: 20 },
			{ id: "key", icon: "🗝️", name: "Kunci", price: 30 },
			{ id: "relic", icon: "🔮", name: "Relik acak", price: 55 },
			{ id: "shield", icon: "🔰", name: "Perisai (tangkis 1×)", price: 18 },
			{ id: "big", icon: "⚗️", name: "Ramuan Agung (❤️ penuh)", price: 45 },
		]).slice(0, 3);
		if (r === "mystery") this.mystery = (["statue", "wish", "glow", "scroll"] as Mystery[])[Math.floor(this.rng() * 4)];
		if (r === "vault") { if (this.keys <= 0) { this.room = "chest"; } }
		if (this.room === "trap") {
			const q = this.q;
			const pick = this.rng() < 0.5 ? q.options.find((o) => o.correct)! : shuffle(q.options.filter((o) => !o.correct))[0];
			this.trapClaim = { text: pick.text, correct: !!pick.correct };
			this.trapLeft = 8 + this.gear.time + (this.has("jam") ? 5 : 0);
			this.stopTimers();
			this.trapTimer = window.setInterval(() => { this.trapLeft--; const t = this.el?.querySelector(".fch-dg2-trapt"); if (t) t.setText(`${this.trapLeft}`); if (this.trapLeft <= 0) this.answerTrap(null); }, 1000);
		}
		this.prepQuestion();
		this.draw();
	}

	/** Siapkan soal baru: Mata Elang menyingkirkan 1 pilihan salah, mode Mimpi Buruk memasang waktu. */
	private prepQuestion() {
		this.hidden.clear();
		this.picked = null;
		if (this.has("mata") && this.isFight()) { const w = this.q.options.map((o, i) => (o.correct ? -1 : i)).filter((i) => i >= 0); if (w.length) this.hidden.add(w[Math.floor(Math.random() * w.length)]); }
		if (this.qTimer) window.clearInterval(this.qTimer);
		this.qTimer = null;
		if (this.qLimit && this.isFight() && !this.resolved) {
			this.qStart = Date.now();
			this.qTimer = window.setInterval(() => {
				const left = this.qLimit - (Date.now() - this.qStart) / 1000;
				const bar = this.el?.querySelector(".fch-dg2-qtime > div") as HTMLElement | null;
				if (bar) bar.style.width = `${Math.max(0, (left / this.qLimit) * 100)}%`;
				if (left <= 0 && this.picked === null && !this.resolved && !this.zoneIntro) this.choose(-1);
			}, 200);
		}
	}
	private stopTimers() { if (this.trapTimer) window.clearInterval(this.trapTimer); this.trapTimer = null; if (this.qTimer) window.clearInterval(this.qTimer); this.qTimer = null; }

	// ---------------------------------------------------------------- hadiah & kerusakan
	private drop(src: "monster" | "chest" | "guardian" | "trap" | "fountain") {
		const got = dropMats(this.hub.plugin, src, this.floor);
		this.matsGot.push(...got);
		return got.length ? ` · ${got.join(", ")}` : "";
	}
	private loot(g: number) { const v = Math.round(g * (1 + this.gear.coin) * (this.has("kantong") ? 1.3 : 1) * MODES[this.mode].gold * this.mult); this.gold += v; return v; }

	/** Terima serangan: perisai/zirah/relik bisa menangkis, Bulu Phoenix bisa menghidupkan kembali. true = gugur. */
	private hurt(n = 1): boolean {
		if (this.shield) { this.shield = false; this.note = "🔰 Perisai menangkis serangan!"; this.fx = "block"; play("hit"); return false; }
		if (Math.random() < this.gear.block + (this.has("sayap") ? 0.2 : 0)) { this.note = "🛡️ Seranganmu tertangkis, hati tidak berkurang."; this.fx = "block"; play("hit"); return false; }
		this.hp -= n;
		this.note = "";
		this.fx = "hurt";
		play("hurt");
		if (this.hp <= 0 && usePotion(this.hub.plugin, "phoenix")) { this.hp = 2; this.note = "🪶 Bulu Phoenix menyala, kamu bangkit dengan 2 ❤️!"; play("levelup"); return false; }
		if (this.hp <= 0) { this.end("dead"); return true; }
		return false;
	}

	// ---------------------------------------------------------------- aksi
	choose(k: number) {
		if (this.picked !== null || this.resolved || (k >= 0 && this.hidden.has(k))) return;
		this.picked = k;
		if (this.qTimer) window.clearInterval(this.qTimer);
		const ok = k >= 0 && !!this.q.options[k]?.correct;
		play(ok ? "correct" : "wrong");
		if (ok) { this.streak++; this.bestStreak = Math.max(this.bestStreak, this.streak); } else this.streak = 0;
		const fight = this.room === "monster" || this.room === "elite" || this.room === "guardian";
		if (fight) {
			if (ok) {
				const crit = Math.random() < this.gear.crit;
				const d = (1 + (this.has("pedang") ? 1 : 0) + (this.sharpen > 0 ? 1 : 0)) * (crit ? 2 : 1);
				this.monHp = Math.max(0, this.monHp - d);
				this.dmg = d;
				this.fx = this.monHp <= 0 ? "kill" : crit ? "crit" : "hit";
				play("hit");
				if (this.monHp <= 0) {
					if (this.sharpen > 0) this.sharpen--;
					if (this.room === "guardian") {
						const g = this.loot(40 + this.floor * 3);
						this.outcome = `${crit ? "🎯 Kritis! " : ""}🏆 ${this.mon[1]} tumbang! +${g} emas` + this.drop("guardian");
						if (Math.random() < 0.5 && grantPack(this.hub.plugin, 1, "Bos Zona dungeon", `dungeon:${Date.now()}`)) { this.packs++; this.outcome += " · 🎴 1 bungkus kartu!"; }
						play("victory");
					} else {
						const g = this.loot((5 + Math.floor(Math.random() * 6) + this.floor) * (this.room === "elite" ? 2.5 : 1));
						this.outcome = `${crit ? "🎯 Kritis! " : ""}⚔️ ${this.mon[1]} kalah! +${g} emas` + this.drop("monster");
						if (this.room === "elite" && Math.random() < 0.35) { this.keys++; this.outcome += " · 🗝️ kunci!"; }
					}
					this.resolved = true;
				} else {
					this.outcome = `${crit ? "🎯 Kritis! " : "⚔️ "}−${d} HP · ${this.mon[1]} masih berdiri!`;
					const tok = this.qTok; window.setTimeout(() => this.nextQ(tok), 900);
				}
			} else {
				if (this.hurt(this.room === "guardian" && this.mode === "mimpi" ? 2 : 1)) return;
				this.outcome = this.note || `${k < 0 ? "⏰ Waktu habis! " : ""}💥 ${this.mon[1]} menyerangmu: −1 ❤️`;
				const tok = this.qTok; window.setTimeout(() => this.nextQ(tok), 1500);
			}
		} else if (this.room === "chest") {
			if (ok) {
				const g = this.loot(15 + Math.floor(Math.random() * 16));
				this.outcome = `🧰 Peti terbuka! +${g} emas` + this.drop("chest");
				if (Math.random() < (this.has("kunci") ? 0.6 : 0.3)) { this.keys++; this.outcome += " · 🗝️ kunci"; }
				if (Math.random() < 0.3 && grantPack(this.hub.plugin, 1, "ditemukan di dungeon", `dungeon:${Date.now()}`)) { this.packs++; this.outcome += " · 🎴 1 bungkus kartu!"; }
				play("coin");
			} else this.outcome = "🔒 Kuncinya patah, peti tetap tertutup.";
			this.resolved = true;
		} else if (this.room === "mystery") {
			if (ok) { const r = shuffle(RELICS.filter((x) => !this.has(x.id)))[0]; if (r) this.gainRelic(r.id); this.outcome = r ? `🗿 “Bijak sekali!” Patung memberimu ${r.icon} ${r.name}.` : "🗿 “Bijak sekali!” +30 emas"; if (!r) this.loot(30); }
			else { if (this.hurt()) return; this.outcome = this.note || "🗿 “Salah!” Patung melempar batu: −1 ❤️"; }
			this.resolved = true;
		}
		this.draw();
	}

	/** Soal berikutnya dalam pertarungan yang sama (monster masih hidup). */
	nextQ(tok?: number) {
		if (tok !== undefined && tok !== this.qTok) return;
		if (this.resolved || this.over || this.phase !== "room" || this.picked === null) return;
		this.qTok++;
		this.qi++;
		this.fx = "";
		this.outcome = "";
		this.prepQuestion();
		this.draw();
	}
	private qTok = 0;

	answerTrap(saysTrue: boolean | null) {
		if (this.trapAns !== null) return;
		this.stopTimers();
		this.trapAns = saysTrue;
		const ok = saysTrue !== null && saysTrue === this.trapClaim.correct;
		if (ok) { this.streak++; this.bestStreak = Math.max(this.bestStreak, this.streak); this.outcome = "🦶 Kamu melompati jebakan dengan lincah!" + this.drop("trap"); play("correct"); }
		else { this.streak = 0; if (this.hurt()) return; this.outcome = this.note || (saysTrue === null ? "⏰ Terlambat! Jebakan menjepit: −1 ❤️" : "🪤 Jebakan aktif: −1 ❤️"); }
		this.resolved = true;
		this.draw();
	}

	private gainRelic(id: string) {
		if (this.has(id)) return;
		this.relics.push(id);
		if (id === "jantung") { this.MAXHP++; this.hp = Math.min(this.MAXHP, this.hp + 1); }
		if (id === "kunci") this.keys += 2;
		play("achievement");
	}

	/** Selesai di ruangan ini → tampilkan pintu-pintu berikutnya. */
	descend() {
		if (!this.resolved || this.over) return;
		this.history.push({ room: this.room, ok: !this.outcome.includes("−1") && !this.outcome.includes("patah") });
		this.cleared++;
		this.qi++;
		this.doors = this.rollDoors();
		this.phase = "doors";
		this.stopTimers();
		this.draw();
	}
	pickDoor(i: number) {
		const d = this.doors[i];
		if (!d || this.phase !== "doors") return;
		play("click");
		const root = this.el?.querySelector(".fch-dg2");
		root?.addClass("is-transit");
		window.setTimeout(() => { this.floor++; this.enterRoom(d.room); }, root ? 380 : 0);
	}

	end(how: "dead" | "escaped") {
		if (this.over) return;
		this.stopTimers();
		this.over = how;
		this.phase = "over";
		const p = this.hub.plugin;
		const m = p.data.meta;
		if (how === "dead" || this.retreat) this.gold = Math.floor(this.gold / 2);
		if (this.clover) this.gold *= 2;
		p.addCoins(this.gold);
		m.dungeonRuns = (m.dungeonRuns ?? 0) + 1;
		const depth = this.floor - (how === "dead" ? 1 : 0);
		if (depth > (m.dungeonBest ?? 0)) m.dungeonBest = depth;
		m.dungeonLog = [...(m.dungeonLog ?? []), { t: Date.now(), floor: depth, gold: this.gold, mode: this.mode, daily: this.daily, relics: this.relics.length, dead: how === "dead" }].sort((a, b) => b.floor - a.floor || b.gold - a.gold).slice(0, 8);
		if (this.daily && m.dungeonDaily !== dayKey(Date.now()) && depth >= 5) {
			m.dungeonDaily = dayKey(Date.now());
			p.addCoins(150);
			this.dailyBonus = true;
			if (grantPack(p, 1, "Dungeon Harian", `dungeon-daily:${dayKey(Date.now())}`)) this.packs++;
			this.matsGot.push(addMat(p, "kristal"), addMat(p, "bulu"));
		}
		p.track("dungeonFloor", this.cleared);
		p.requestSave();
		p.checkAchievements();
		play(how === "escaped" ? "victory" : "defeat");
		this.draw();
	}
	private dailyBonus = false;
	private retreat = false;

	private onKey(e: KeyboardEvent) {
		if (!this.el || e.ctrlKey || e.metaKey) return;
		if (this.over) { if (e.key === "Enter") { e.preventDefault(); this.hub.endGame(); } return; }
		if (this.phase === "doors" && ["1", "2", "3"].includes(e.key)) { e.preventDefault(); this.pickDoor(parseInt(e.key, 10) - 1); return; }
		if (this.phase !== "room" || this.zoneIntro) return;
		if (this.resolved && (e.key === " " || e.key === "Enter")) { e.preventDefault(); this.descend(); return; }
		if (this.room === "trap" && this.trapAns === null && (e.key === "b" || e.key === "s")) { e.preventDefault(); this.answerTrap(e.key === "b"); return; }
		if (this.showsQuestion() && this.picked === null && ["1", "2", "3", "4"].includes(e.key)) { e.preventDefault(); this.choose(parseInt(e.key, 10) - 1); }
	}
	private showsQuestion() { return !this.resolved && (this.room === "monster" || this.room === "elite" || this.room === "guardian" || this.room === "chest" || (this.room === "mystery" && this.mysteryQ)); }

	// ---------------------------------------------------------------- tampilan
	private draw() {
		const root = this.el;
		if (!root) return;
		this.comp?.unload();
		this.comp = new Component();
		this.comp.load();
		root.empty();
		const z = this.zone;
		const wrap = root.createDiv(`fch-dg2 fx-${z.fx}` + (this.hp <= 1 && !this.over ? " is-danger" : "") + (this.fx === "hurt" ? " is-hurt" : ""));
		wrap.style.setProperty("--z1", z.c1); wrap.style.setProperty("--z2", z.c2); wrap.style.setProperty("--za", z.acc);
		const parts = wrap.createDiv("fch-dg2-particles");
		for (let i = 0; i < 18; i++) { const s = parts.createSpan(); s.style.left = `${(i * 53) % 100}%`; s.style.animationDelay = `${-(i * 0.9) % 9}s`; s.style.animationDuration = `${6 + (i % 5)}s`; }

		// ---- bilah atas & HUD
		const top = wrap.createDiv("fch-dg2-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost fch-dg2-x", label: "Keluar (tanpa membawa harta)", onClick: () => this.hub.endGame() });
		const tt = top.createDiv("fch-grow");
		tt.createDiv({ cls: "fch-dg2-zone", text: `${z.icon} ${z.name}${this.daily ? " · 📅 Dungeon Harian" : ""}` });
		tt.createDiv({ cls: "fch-dg2-floor", text: `Lantai ${this.floor} · ${MODES[this.mode].icon} ${MODES[this.mode].label} · ${this.title}` });
		const hud = top.createDiv("fch-dg2-hud");
		const hh = hud.createDiv("fch-dg2-hearts");
		for (let i = 0; i < this.MAXHP; i++) hh.createSpan({ cls: i < this.hp ? "is-full" : "", text: i < this.hp ? "❤️" : "🖤" });
		if (this.shield) hh.createSpan({ text: "🔰" });
		const chip = (t: string, tip: string, cls = "") => hud.createSpan({ cls: "fch-dg2-chip " + cls, text: t, attr: { "aria-label": tip } });
		chip(`🪙 ${this.gold}`, "Emas yang dibawa");
		if (this.keys) chip(`🗝️ ${this.keys}`, "Kunci untuk Ruang harta");
		if (this.packs) chip(`🎴 ${this.packs}`, "Bungkus kartu ditemukan");
		if (this.clover) chip("🍀×2", "Semanggi: emas ×2 di akhir");
		// semangat
		const sm = wrap.createDiv("fch-dg2-spirit");
		sm.createSpan({ cls: "fch-small fch-strong", text: `🔥 Semangat ×${this.mult.toFixed(1)}` });
		const sb = sm.createDiv("fch-dg2-spiritbar");
		sb.createDiv().style.width = `${((this.mult - 1) / 1) * 100}%`;
		if (this.relics.length) { const rl = sm.createDiv("fch-dg2-relics"); for (const id of this.relics) { const r = relic(id); rl.createSpan({ cls: "fch-dg2-relic", text: r.icon, attr: { "aria-label": `${r.name}: ${r.desc}` } }); } }
		if (this.sharpen) sm.createSpan({ cls: "fch-dg2-chip", text: `⚔️+1 ×${this.sharpen}` });

		// ---- peta jalur
		const map = wrap.createDiv("fch-dg2-map");
		const past = this.history.slice(-7);
		past.forEach((h) => { map.createDiv({ cls: "fch-dg2-node is-past" + (h.ok ? "" : " is-bad"), text: ROOM[h.room].icon }); map.createDiv("fch-dg2-link"); });
		map.createDiv({ cls: "fch-dg2-node is-now", text: this.over ? (this.over === "dead" ? "🪦" : "🌅") : this.phase === "doors" ? "🚪" : this.room === "guardian" ? "💀" : ROOM[this.room].icon });
		const toBoss = 5 - (this.floor % 5 || 5);
		if (!this.over) for (let i = 1; i <= 4; i++) { map.createDiv("fch-dg2-link is-dash"); map.createDiv({ cls: "fch-dg2-node is-next" + (i === toBoss || (toBoss === 0 && i === 5) ? " is-boss" : ""), text: i === toBoss ? "💀" : "·" }); }

		if (this.over) return this.drawEnd(wrap);
		if (this.zoneIntro) {
			const zi = wrap.createDiv("fch-dg2-zoneintro");
			zi.createDiv({ cls: "fch-dg2-zi-k", text: `ZONA ${zoneOf(this.floor) + 1}` });
			zi.createDiv({ cls: "fch-dg2-zi-t", text: `${z.icon} ${z.name}` });
			zi.createDiv({ cls: "fch-dg2-zi-s", text: this.floor === 1 ? "Penjelajahan dimulai… pilih jalanmu dengan bijak." : "Udara berubah. Monster di sini lebih tangguh." });
			return;
		}
		if (this.phase === "doors") return this.drawDoors(wrap);

		// ---- panggung
		const stage = wrap.createDiv("fch-dg2-stage" + (this.fx ? ` fx-${this.fx}` : ""));
		stage.createDiv("fch-dg2-floorline");
		const me = stage.createDiv("fch-dg2-me" + (this.fx === "hit" || this.fx === "crit" || this.fx === "kill" ? " is-attack" : this.fx === "hurt" ? " is-hit" : this.fx === "block" ? " is-block" : ""));
		heroFigure(this.hub.plugin, me, 6);
		const foe = stage.createDiv("fch-dg2-foe" + (this.fx === "hit" || this.fx === "crit" ? " is-hit" : this.fx === "kill" ? " is-dead" : this.fx === "hurt" ? " is-attack" : "") + (this.room === "guardian" ? " is-boss" : this.room === "elite" ? " is-elite" : ""));
		const fight = this.room === "monster" || this.room === "elite" || this.room === "guardian";
		const big = fight ? this.mon[0] : this.room === "mystery" ? ({ statue: "🗿", wish: "⛲", glow: "✨", scroll: "📜" } as Record<Mystery, string>)[this.mystery] : ROOM[this.room].icon;
		foe.createDiv({ cls: "fch-dg2-foe-ic", text: big });
		foe.createDiv("fch-dg2-foe-shadow");
		if (fight) {
			const nm = foe.createDiv("fch-dg2-foe-name");
			nm.setText((this.room === "elite" ? "⭐ " : this.room === "guardian" ? "👑 " : "") + this.mon[1]);
			const hpb = foe.createDiv("fch-dg2-foe-hp");
			for (let i = 0; i < this.monMax; i++) hpb.createSpan({ cls: i < this.monHp ? "is-on" : "" });
			if (this.fx === "hit" || this.fx === "crit" || this.fx === "kill") foe.createDiv({ cls: "fch-dg2-dmg" + (this.fx === "crit" ? " is-crit" : ""), text: `−${this.dmg}${this.fx === "crit" ? "!" : ""}` });
		} else foe.createDiv({ cls: "fch-dg2-foe-name", text: this.room === "mystery" ? "Ruang misteri" : ROOM[this.room].name });
		if (this.fx === "hurt") stage.createDiv({ cls: "fch-dg2-dmg is-me", text: "−1 ❤️" });

		bagBar(this.hub.plugin, wrap, {
			usable: (id) => {
				if (id === "heal" || id === "bigheal") return this.hp < this.MAXHP;
				if (id === "shield") return !this.shield;
				if (id === "lens") return this.showsQuestion() && this.picked === null && this.hidden.size < 2;
				if (id === "hourglass") return (this.room === "trap" && this.trapAns === null) || (!!this.qLimit && this.showsQuestion());
				if (id === "clover") return !this.clover;
				if (id === "bomb") return (this.room === "monster" || this.room === "elite") && !this.resolved;
				return false;
			},
			use: (id) => {
				if (id === "heal") this.hp = Math.min(this.MAXHP, this.hp + 1);
				else if (id === "bigheal") this.hp = this.MAXHP;
				else if (id === "shield") this.shield = true;
				else if (id === "lens") shuffle(this.q.options.map((o, i) => (o.correct || this.hidden.has(i) ? -1 : i)).filter((i) => i >= 0)).slice(0, 2 - this.hidden.size).forEach((i) => this.hidden.add(i));
				else if (id === "hourglass") { if (this.room === "trap") this.trapLeft += 8; else this.qStart = Date.now(); }
				else if (id === "clover") this.clover = true;
				else if (id === "bomb") { this.monHp = 0; this.fx = "kill"; this.dmg = 9; this.outcome = `💣 BOOM! ${this.mon[1]} terpental (tanpa emas).`; this.resolved = true; play("hit"); }
				this.draw();
			},
		});

		const panel = wrap.createDiv("fch-dg2-panel");
		if (this.note && !this.resolved) panel.createDiv({ cls: "fch-dg2-note", text: this.note });
		if (this.showsQuestion() && this.room !== "mystery") this.drawQuestion(panel, this.room === "chest" ? "🧰 Jawab benar untuk membuka peti:" : this.room === "guardian" ? `👑 Bos Zona! Kalahkan dengan ${this.monHp} serangan lagi.` : this.room === "elite" ? `⭐ Elite: butuh ${this.monHp} serangan lagi.` : "⚔️ Jawab benar untuk menyerang:");
		else if (this.room === "trap" && !this.resolved) this.drawTrap(panel);
		else if (this.room === "merchant" && !this.resolved) this.drawMerchant(panel);
		else if (this.room === "altar" && !this.resolved) this.drawAltar(panel);
		else if (this.room === "camp" && !this.resolved) this.drawCamp(panel);
		else if (this.room === "mystery" && !this.resolved) this.drawMystery(panel);
		else if (this.room === "vault" && !this.resolved) this.drawVault(panel);

		if (this.resolved) {
			const oc = panel.createDiv("fch-dg2-outcome");
			oc.setText(this.outcome);
			if (this.room === "trap") panel.createDiv({ cls: "fch-small fch-muted", text: `Pernyataan tadi ${this.trapClaim.correct ? "BENAR" : "SALAH"}.` });
			const r = panel.createDiv("fch-row fch-mt");
			btn(r, { text: (this.floor + 1) % 5 === 0 ? "Menuju gerbang Bos (Spasi)" : "Lanjut memilih jalan (Spasi)", icon: "arrow-right", cls: "fch-btn-primary fch-btn-lg", onClick: () => this.descend() });
			if (this.room === "fountain" || this.room === "guardian" || this.room === "camp") btn(r, { text: `Keluar membawa 🪙 ${this.gold}`, icon: "log-out", onClick: () => this.end("escaped") });
		} else if (this.outcome) panel.createDiv({ cls: "fch-dg2-outcome is-mid", text: this.outcome });
	}

	private drawQuestion(panel: HTMLElement, label: string) {
		panel.createDiv({ cls: "fch-small fch-strong fch-dg2-qlabel", text: label });
		if (this.qLimit && this.picked === null) panel.createDiv("fch-dg2-qtime").createDiv().style.width = `${Math.max(0, (1 - (Date.now() - this.qStart) / 1000 / this.qLimit) * 100)}%`;
		cardFront(this.hub.plugin, this.comp!, panel, this.q.card);
		const opts = panel.createDiv("fch-b2-opts");
		this.q.options.forEach((o, k) => {
			const b = opts.createEl("button", { cls: "fch-b2-opt" + (this.picked !== null ? (o.correct ? " is-ok" : this.picked === k ? " is-bad" : " is-dim") : this.hidden.has(k) ? " is-gone" : "") });
			if ((this.hidden.has(k) && this.picked === null) || this.picked !== null) b.disabled = true;
			b.createSpan({ cls: "fch-kbd", text: String(k + 1) });
			md(this.hub.app, this.comp!, b.createDiv("markdown-rendered"), o.text, this.q.card.path);
			b.onclick = () => this.choose(k);
		});
	}
	private drawTrap(panel: HTMLElement) {
		const h = panel.createDiv("fch-dg2-traphead");
		h.createDiv({ cls: "fch-strong", text: "🪤 Lantai berderak! Benarkah pernyataan ini?" });
		h.createDiv({ cls: "fch-dg2-trapt", text: String(this.trapLeft) });
		cardFront(this.hub.plugin, this.comp!, panel, this.q.card);
		const cl = panel.createDiv("fch-dg-claim");
		cl.createSpan({ text: "Jawabannya: " });
		md(this.hub.app, this.comp!, cl.createDiv("markdown-rendered"), this.trapClaim.text, this.q.card.path);
		const r = panel.createDiv("fch-dg2-tf");
		btn(r, { text: "✅ Benar (B)", cls: "fch-btn-lg fch-dg2-true", onClick: () => this.answerTrap(true) });
		btn(r, { text: "❌ Salah (S)", cls: "fch-btn-lg fch-dg2-false", onClick: () => this.answerTrap(false) });
	}
	private drawMerchant(panel: HTMLElement) {
		panel.createDiv({ cls: "fch-dg2-say", text: "🧙 “Barang bagus, harga bersahabat! Bayar pakai emas dungeon, ya.”" });
		const g = panel.createDiv("fch-dg2-offers");
		for (const o of this.shopOffer) {
			const c = g.createDiv("fch-dg2-offer" + (o.sold ? " is-sold" : ""));
			c.createDiv({ cls: "fch-dg2-offer-ic", text: o.icon });
			c.createDiv({ cls: "fch-small fch-strong", text: o.name });
			btn(c, { text: o.sold ? "Terjual" : `🪙 ${o.price}`, cls: "fch-btn-sm fch-btn-primary", disabled: !!o.sold || this.gold < o.price || (o.id === "relic" && RELICS.every((r) => this.has(r.id))), onClick: () => {
				this.gold -= o.price;
				o.sold = true;
				if (o.id === "potion") this.hp = Math.min(this.MAXHP, this.hp + 1);
				if (o.id === "big") this.hp = this.MAXHP;
				if (o.id === "key") this.keys++;
				if (o.id === "shield") this.shield = true;
				if (o.id === "relic") { const r = shuffle(RELICS.filter((x) => !this.has(x.id)))[0]; if (r) { this.gainRelic(r.id); new Notice(`${r.icon} ${r.name}: ${r.desc}`); } }
				play("coin");
				this.draw();
			} });
		}
		btn(panel, { text: "Selesai berbelanja", cls: "fch-mt", onClick: () => { this.outcome = "🧙 “Hati-hati di jalan, petualang!”"; this.resolved = true; this.draw(); } });
	}
	private drawAltar(panel: HTMLElement) {
		panel.createDiv({ cls: "fch-dg2-say", text: "🔮 Altar bercahaya menawarkan satu berkah. Pilih dengan bijak, berlaku sampai penjelajahan berakhir." });
		const g = panel.createDiv("fch-dg2-offers");
		for (const id of this.altarOffer) {
			const r = relic(id);
			const c = g.createEl("button", { cls: "fch-dg2-relcard" });
			c.createDiv({ cls: "fch-dg2-offer-ic", text: r.icon });
			c.createDiv({ cls: "fch-strong", text: r.name });
			c.createDiv({ cls: "fch-small fch-muted", text: r.desc });
			c.onclick = () => { this.gainRelic(id); this.outcome = `✨ Berkah diterima: ${r.icon} ${r.name}`; this.resolved = true; this.draw(); };
		}
		if (!this.altarOffer.length) { this.outcome = "🔮 Semua berkah sudah kamu miliki. +40 emas"; this.loot(40); this.resolved = true; }
	}
	private drawCamp(panel: HTMLElement) {
		panel.createDiv({ cls: "fch-dg2-say", text: "🏕️ Api unggun berderak hangat. Waktunya mengambil napas." });
		const g = panel.createDiv("fch-dg2-offers");
		const a = g.createEl("button", { cls: "fch-dg2-relcard" });
		a.createDiv({ cls: "fch-dg2-offer-ic", text: "😴" }); a.createDiv({ cls: "fch-strong", text: "Istirahat" }); a.createDiv({ cls: "fch-small fch-muted", text: "Pulihkan 2 ❤️" });
		a.onclick = () => { this.hp = Math.min(this.MAXHP, this.hp + 2); this.outcome = "😴 Tidur sejenak: +2 ❤️"; this.resolved = true; play("chime"); this.draw(); };
		const b = g.createEl("button", { cls: "fch-dg2-relcard" });
		b.createDiv({ cls: "fch-dg2-offer-ic", text: "⚒️" }); b.createDiv({ cls: "fch-strong", text: "Asah senjata" }); b.createDiv({ cls: "fch-small fch-muted", text: "+1 kerusakan untuk 3 pertarungan berikutnya" });
		b.onclick = () => { this.sharpen = 3; this.outcome = "⚒️ Senjatamu berkilau tajam!"; this.resolved = true; play("hit"); this.draw(); };
	}
	private drawMystery(panel: HTMLElement) {
		const say = (t: string) => panel.createDiv({ cls: "fch-dg2-say", text: t });
		const g = panel.createDiv("fch-dg2-offers");
		const choice = (icon: string, title: string, desc: string, fn: () => void) => { const c = g.createEl("button", { cls: "fch-dg2-relcard" }); c.createDiv({ cls: "fch-dg2-offer-ic", text: icon }); c.createDiv({ cls: "fch-strong", text: title }); c.createDiv({ cls: "fch-small fch-muted", text: desc }); c.onclick = fn; };
		const leave = () => { this.outcome = "Kamu memilih berlalu dengan hati-hati."; this.resolved = true; this.draw(); };
		if (this.mysteryQ) return this.drawQuestion(panel, "🗿 Teka-teki sang patung:");
		if (this.mystery === "statue") {
			say("🗿 Patung tua membuka mata: “Jawab teka-tekiku dengan benar, dan kuberi berkah. Salah… ada harganya.”");
			choice("🧠", "Terima tantangan", "Benar → relik acak · Salah → −1 ❤️", () => { this.mysteryQ = true; this.prepQuestion(); this.draw(); });
			choice("🚶", "Pergi", "Tidak terjadi apa-apa", leave);
		} else if (this.mystery === "wish") {
			say("⛲ Kolam harapan berkilau. Konon, siapa yang melempar koin akan diberi lebih… atau tidak.");
			choice("🪙", "Lempar 15 emas", "50%: dapat 45 emas · 50%: hilang", () => {
				if (this.gold < 15) return void new Notice("Emasmu kurang dari 15.");
				this.gold -= 15;
				if (Math.random() < 0.5) { this.gold += 45; this.outcome = "✨ Kolam memantulkan cahaya: +45 emas!"; play("coin"); } else { this.outcome = "💧 Plung… koinnya tenggelam."; }
				this.resolved = true; this.draw();
			});
			choice("🚶", "Pergi", "Simpan emasmu", leave);
		} else if (this.mystery === "glow") {
			say("✨ Sebuah peti bersinar aneh di tengah ruangan…");
			choice("🧰", "Buka peti", "70%: harta & kunci · 30%: Mimic!", () => {
				if (Math.random() < 0.7) { const g2 = this.loot(30); this.keys++; this.outcome = `🧰 Isinya ${g2} emas dan 🗝️ kunci!` + this.drop("chest"); play("coin"); this.resolved = true; this.draw(); }
				else { this.room = "elite"; this.mon = ["🧰", "Mimic Penipu"]; this.monHp = this.monMax = 2; this.note = "😱 Petinya menggigit! Mimic!"; this.fx = "hurt"; this.prepQuestion(); this.draw(); }
			});
			choice("🚶", "Biarkan", "Lebih baik aman", leave);
		} else {
			say("📜 Gulungan tua tergeletak di atas meja batu, penuh catatan alkimia.");
			choice("📜", "Ambil gulungan", "Bahan langka untuk Bengkel Alkimia", () => { const m = addMat(this.hub.plugin, "gulungan"); this.matsGot.push(m); this.outcome = `📜 Didapat: ${m}`; this.resolved = true; play("achievement"); this.draw(); });
		}
	}
	private drawVault(panel: HTMLElement) {
		panel.createDiv({ cls: "fch-dg2-say", text: `🔐 Pintu besi berukir. Kamu punya 🗝️ ${this.keys} kunci.` });
		btn(panel, { text: "Buka dengan 1 kunci", icon: "key", cls: "fch-btn-primary fch-btn-lg", onClick: () => {
			this.keys--;
			const g = this.loot(60 + Math.floor(Math.random() * 41) + this.floor * 2);
			this.outcome = `💎 Ruang harta! +${g} emas` + this.drop("chest") + this.drop("guardian");
			if (Math.random() < 0.6 && grantPack(this.hub.plugin, 1, "ruang harta dungeon", `dungeon:${Date.now()}`)) { this.packs++; this.outcome += " · 🎴 1 bungkus kartu!"; }
			this.resolved = true;
			play("victory");
			if (this.hub.plugin.data.settings.confetti && this.el) confetti(this.el);
			this.draw();
		} });
	}

	private drawDoors(wrap: HTMLElement) {
		const box = wrap.createDiv("fch-dg2-doors");
		box.createDiv({ cls: "fch-dg2-doors-t", text: this.doors.length === 1 ? "👑 Gerbang Bos Zona menanti…" : `Pilih jalan menuju lantai ${this.floor + 1}` });
		const row = box.createDiv("fch-dg2-doorrow");
		this.doors.forEach((d, i) => {
			const r = ROOM[d.room];
			const c = row.createEl("button", { cls: `fch-dg2-door d-${d.hidden ? "hidden" : d.room}` });
			c.style.animationDelay = `${i * 0.08}s`;
			c.createDiv("fch-dg2-door-arch");
			c.createDiv({ cls: "fch-dg2-door-ic", text: d.hidden ? "❔" : r.icon });
			c.createDiv({ cls: "fch-dg2-door-name", text: d.hidden ? "Misteri" : r.name });
			c.createDiv({ cls: "fch-dg2-door-hint", text: d.hidden ? "Bisa apa saja…" : r.hint });
			c.createSpan({ cls: "fch-kbd", text: String(i + 1) });
			c.onclick = () => this.pickDoor(i);
		});
		const r2 = box.createDiv("fch-row fch-center fch-mt");
		btn(r2, { text: `Pulang membawa 🪙 ${Math.floor(this.gold / 2)} (setengah)`, icon: "log-out", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { this.retreat = true; this.end("escaped"); } });
		box.createDiv({ cls: "fch-small fch-muted fch-center", text: "Pulang di tengah jalan = setengah emas. Keluar penuh hanya di air mancur, api unggun, atau setelah mengalahkan Bos Zona." });
	}

	private drawEnd(wrap: HTMLElement) {
		const p = this.hub.plugin;
		const win = this.over === "escaped";
		const box = wrap.createDiv("fch-dg2-end" + (win ? " is-win" : ""));
		box.createDiv({ cls: "fch-dg2-end-ic", text: win ? "🌅" : "🪦" });
		box.createEl("h2", { text: win ? (this.retreat ? "Kamu mundur ke permukaan" : "Berhasil keluar dengan selamat!") : "Penjelajahan berakhir…" });
		box.createDiv({ cls: "fch-muted", text: win && !this.retreat ? "Semua harta berhasil dibawa pulang." : "Setengah emas tercecer di perjalanan pulang." });
		if (this.dailyBonus) box.createDiv({ cls: "fch-dg2-daily", text: "📅 Bonus Dungeon Harian: 🪙 150 · 🎴 1 bungkus kartu · 💎 Kristal Ingatan · 🪶 Bulu Emas" });
		const route = box.createDiv("fch-dg2-route");
		this.history.forEach((h, i) => { const n = route.createSpan({ cls: "fch-dg2-node is-past" + (h.ok ? "" : " is-bad"), text: ROOM[h.room].icon }); n.style.animationDelay = `${i * 0.05}s`; });
		const st = box.createDiv("fch-b2-stats");
		const s = (v: string, l: string) => { const x = st.createDiv("fch-b2-stat"); x.createDiv({ cls: "fch-strong", text: v }); x.createDiv({ cls: "fch-small fch-muted", text: l }); };
		s(String(this.floor - (win ? 0 : 1)), "lantai tercapai");
		s(`🪙 ${this.gold}`, "dibawa pulang");
		s(`🔥 ${this.bestStreak}`, "semangat terbaik");
		s(String(p.data.meta.dungeonBest ?? 0), "rekor kedalaman");
		if (this.relics.length) { const rl = box.createDiv("fch-b2-rewards"); rl.createSpan({ cls: "fch-small fch-strong", text: "Relik:" }); for (const id of this.relics) { const r = relic(id); rl.createSpan({ cls: "fch-b2-rw", text: `${r.icon} ${r.name}` }); } }
		if (this.matsGot.length) {
			const tally = new Map<string, number>();
			for (const m of this.matsGot) { const k = m.replace(/ ×\d+$/, ""); const n = parseInt(m.match(/×(\d+)$/)?.[1] ?? "1", 10); tally.set(k, (tally.get(k) ?? 0) + n); }
			const mb = box.createDiv("fch-b2-rewards fch-mt");
			mb.createSpan({ cls: "fch-small fch-strong", text: "🧺 Bahan alkimia:" });
			for (const [k, n] of tally) mb.createSpan({ cls: "fch-b2-rw", text: `${k} ×${n}` });
		}
		if (this.packs) box.createDiv({ cls: "fch-small", text: `🎴 ${this.packs} bungkus kartu ditemukan` });
		const r = box.createDiv("fch-row fch-center fch-mt");
		btn(r, { text: "Jelajahi lagi", icon: "rotate-ccw", cls: "fch-btn-primary", onClick: () => { const g = new DungeonRun(this.hub, this.qs.map((x) => x.card), this.title, this.mode, false); this.hub.endGame(); if (!this.hub.startGame(g)) this.hub.navigate("dungeon"); } });
		if (this.packs) btn(r, { text: "Buka bungkus kartu", icon: "gift", onClick: () => { this.hub.endGame(); this.hub.navigate("album"); } });
		if (this.matsGot.length) btn(r, { text: "Ke Bengkel Alkimia", icon: "flask-conical", onClick: () => { this.hub.endGame(); this.hub.navigate("alchemy"); } });
		btn(r, { text: "Kembali", onClick: () => { this.hub.endGame(); this.hub.navigate("dungeon"); } });
		if (win && p.data.settings.confetti) confetti(box);
	}
}

// ================================================================ lobi dungeon
let scope = "all";
export function renderDungeon(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const m = p.data.meta;
	const mode = (m.dungeonMode as DMode) ?? "normal";
	const best = m.dungeonBest ?? 0;
	const hero = el.createDiv("fch-dg2-lobby");
	const gate = hero.createDiv("fch-dg2-gate");
	gate.createDiv("fch-dg2-portal");
	gate.createDiv({ cls: "fch-dg2-torch l", text: "🔥" });
	gate.createDiv({ cls: "fch-dg2-torch r", text: "🔥" });
	const t = hero.createDiv("fch-dg2-lobby-in");
	t.createEl("h1", { text: "🗝️ Dungeon Ilmu" });
	t.createDiv({ cls: "fch-dg2-lobby-sub", text: "Roguelike dari kartumu sendiri: pilih pintu, kalahkan monster dengan jawaban benar, kumpulkan relik, dan turuni 5 zona sampai Kehampaan Bintang." });
	const st = t.createDiv("fch-row");
	st.createSpan({ cls: "fch-b2-rw", text: `🏆 Rekor: lantai ${best}` });
	st.createSpan({ cls: "fch-b2-rw", text: `🧭 ${m.dungeonRuns ?? 0} penjelajahan` });
	// mode
	const modes = t.createDiv("fch-dg2-modes");
	for (const k of Object.keys(MODES) as DMode[]) {
		const md2 = MODES[k];
		const b = modes.createEl("button", { cls: "fch-dg2-mode" + (mode === k ? " is-on" : "") });
		b.createDiv({ cls: "fch-strong", text: `${md2.icon} ${md2.label}` });
		b.createDiv({ cls: "fch-small", text: md2.desc });
		b.onclick = () => { m.dungeonMode = k; p.requestSave(); hub.renderPage(); };
	}
	const pick = t.createDiv("fch-row fch-mt");
	const sel = pick.createEl("select", { cls: "dropdown fch-select" });
	sel.createEl("option", { text: "🌐 Semua materi", attr: { value: "all" } });
	for (const x of p.sortedPaths()) sel.createEl("option", { text: `📘 ${basename(x)}`, attr: { value: "file:" + x } });
	sel.value = scope;
	sel.onchange = () => (scope = sel.value);
	const go = (daily: boolean) => {
		const cards = daily ? p.allCards() : hub.cardsForScope(scope);
		const g = new DungeonRun(hub, cards, daily ? "Semua materi" : scope === "all" ? "Semua materi" : basename(scope.slice(5)), daily ? "normal" : mode, daily);
		if (!hub.startGame(g)) new Notice("Butuh minimal 4 kartu yang bisa dijadikan soal pilihan ganda.");
	};
	btn(pick, { text: "Masuki dungeon", icon: "door-open", cls: "fch-btn-primary fch-btn-lg fch-dg2-enter", onClick: () => go(false) });

	// dungeon harian
	const done = m.dungeonDaily === dayKey(Date.now());
	const dd = el.createDiv("fch-dg2-dailycard" + (done ? " is-done" : ""));
	dd.createDiv({ cls: "fch-dg2-daily-ic", text: done ? "✅" : "📅" });
	const dt = dd.createDiv("fch-grow");
	dt.createDiv({ cls: "fch-strong", text: `Dungeon Harian · ${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}` });
	dt.createDiv({ cls: "fch-small", text: done ? "Bonus hari ini sudah didapat. Denah baru besok, tapi kamu tetap boleh bermain lagi." : "Denah & urutan pintu sama sepanjang hari (mode Normal, semua materi). Capai lantai 5 untuk bonus: 🪙 150 · 🎴 1 bungkus · 💎 + 🪶." });
	btn(dd, { text: done ? "Main lagi" : "Mulai", icon: "calendar", cls: "fch-btn-sm" + (done ? "" : " fch-btn-primary"), onClick: () => go(true) });

	gearStrip(hub, el);

	// zona
	const zs = el.createDiv("fch-panel fch-mt");
	zs.createEl("h3", { text: "🗺️ Zona dungeon" });
	const zg = zs.createDiv("fch-dg2-zones");
	ZONES.forEach((z, i) => {
		const open = best >= i * 5 + 1 || i === 0;
		const c = zg.createDiv("fch-dg2-zonecard" + (open ? "" : " is-locked"));
		c.style.setProperty("--z1", z.c1); c.style.setProperty("--z2", z.c2); c.style.setProperty("--za", z.acc);
		c.createDiv({ cls: "fch-dg2-zc-ic", text: open ? z.icon : "🔒" });
		c.createDiv({ cls: "fch-strong", text: z.name });
		c.createDiv({ cls: "fch-small", text: `Lantai ${i * 5 + 1}–${i === ZONES.length - 1 ? "∞" : i * 5 + 5}` });
		c.createDiv({ cls: "fch-dg2-zc-mons", text: open ? [...z.mons.map((x) => x[0]), z.elite[0], z.boss[0]].join(" ") : "? ? ?" });
	});
	// rekor
	if (m.dungeonLog?.length) {
		const lg = el.createDiv("fch-panel fch-mt");
		lg.createEl("h3", { text: "🏆 Penjelajahan terbaik" });
		m.dungeonLog.slice(0, 5).forEach((x, i) => {
			const r = lg.createDiv("fch-dg2-log");
			r.createSpan({ cls: "fch-dg2-rank", text: ["🥇", "🥈", "🥉", "4", "5"][i] });
			r.createSpan({ cls: "fch-strong", text: `Lantai ${x.floor}` });
			r.createSpan({ cls: "fch-small fch-muted fch-grow", text: `${MODES[(x.mode as DMode) ?? "normal"]?.label ?? x.mode}${x.daily ? " · harian" : ""} · ${x.relics} relik · ${x.dead ? "gugur" : "selamat"}` });
			r.createSpan({ cls: "fch-small", text: `🪙 ${x.gold} · ${new Date(x.t).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}` });
		});
	}
	// ruangan
	const leg = el.createDiv("fch-panel fch-mt");
	leg.createEl("h3", { text: "📖 Ruangan yang bisa kamu temui" });
	const lg2 = leg.createDiv("fch-dg2-legend");
	for (const k of Object.keys(ROOM) as Room[]) { const c = lg2.createDiv("fch-dg2-leg"); c.createDiv({ cls: "fch-dg2-leg-ic", text: ROOM[k].icon }); const tt = c.createDiv(); tt.createDiv({ cls: "fch-strong fch-small", text: ROOM[k].name }); tt.createDiv({ cls: "fch-small fch-muted", text: ROOM[k].hint }); }
	el.createDiv({ cls: "fch-muted fch-small fch-mt", text: "Jawaban benar beruntun menaikkan 🔥 Semangat (emas sampai ×2). Monster elite & Bos Zona perlu beberapa serangan. Dungeon adalah latihan bebas: jadwal kartumu tidak berubah." });
}
