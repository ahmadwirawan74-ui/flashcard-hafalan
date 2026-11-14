import { Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { addDays, dayKey, startOfDay } from "./scheduler";
import { hijri } from "./ibadah";
import { BOSSES, BossBattle, BossDef, bossSprite } from "./boss";
import { CARDS, cardEl } from "./collect";
import { BAG_MAX, RAR, item } from "./gear";
import { addMat } from "./alchemy";
import { btn, confetti } from "./util";
import { play } from "./sound";

// ================================================================ definisi event
export interface EvDef {
	id: string; name: string; icon: string; blurb: string;
	token: { name: string; icon: string };
	c1: string; c2: string; c3: string;
	greg?: { m0: number; d0: number; m1: number; d1: number };
	hij?: { m: number; d0: number; d1: number };
	boss: BossDef; gear: string; cards: string[];
}
const reskin = (base: number, name: string, pal: Record<string, string>): BossDef => ({ name, rows: BOSSES[base].rows, pal });
export const EVENTS: EvDef[] = [
	{ id: "hardiknas", name: "Pekan Hari Pendidikan Nasional", icon: "🏫", blurb: "Merayakan 2 Mei dengan semangat belajar: tiada hari tanpa membaca!", token: { name: "Pena Emas", icon: "🖊️" }, c1: "#1d4ed8", c2: "#0ea5e9", c3: "#facc15",
		greg: { m0: 4, d0: 26, m1: 5, d1: 9 }, boss: reskin(1, "Kelelawar Malas Baca", { P: "#1d4ed8", L: "#60a5fa", D: "#1e3a8a", Y: "#facc15", K: "#0b1020", W: "#ffffff" }), gear: "pena", cards: ["ev-hardiknas1", "ev-hardiknas2"] },
	{ id: "hutri", name: "Semarak 17 Agustus", icon: "🇮🇩", blurb: "Dirgahayu Republik Indonesia! Rebut kemerdekaan dari rasa malas belajar.", token: { name: "Lencana Merah Putih", icon: "🎗️" }, c1: "#dc2626", c2: "#ef4444", c3: "#f8fafc",
		greg: { m0: 8, d0: 10, m1: 8, d1: 24 }, boss: reskin(3, "Naga Lupa Sejarah", { R: "#dc2626", D: "#7f1d1d", O: "#f8fafc", Y: "#fde047", K: "#1b1b2f", W: "#ffffff" }), gear: "jubahmp", cards: ["ev-hutri1", "ev-hutri2"] },
	{ id: "santri", name: "Pekan Hari Santri", icon: "🕌", blurb: "Mengenang 22 Oktober: santri sehat, santri hebat, santri rajin belajar.", token: { name: "Lencana Santri", icon: "📗" }, c1: "#15803d", c2: "#22c55e", c3: "#fde047",
		greg: { m0: 10, d0: 15, m1: 10, d1: 25 }, boss: reskin(5, "Robot Lalai", { S: "#16a34a", D: "#14532d", C: "#fde047", R: "#f59e0b", Y: "#dcfce7" }), gear: "kitab", cards: ["ev-santri1", "ev-santri2"] },
	{ id: "pahlawan", name: "Pekan Hari Pahlawan", icon: "🎖️", blurb: "Mengenang 10 November: jadilah pahlawan bagi ilmumu sendiri!", token: { name: "Medali Pahlawan", icon: "🏅" }, c1: "#b91c1c", c2: "#78350f", c3: "#fbbf24",
		greg: { m0: 11, d0: 1, m1: 11, d1: 17 }, boss: reskin(2, "Raksasa Menunda-nunda", { S: "#78716c", L: "#a8a29e", D: "#44403c", O: "#ef4444", K: "#1b1b2f", M: "#f8fafc" }), gear: "bambu", cards: ["ev-pahlawan1", "ev-pahlawan2"] },
	{ id: "hijriah", name: "Tahun Baru Hijriah", icon: "🌙", blurb: "Awal tahun baru Islam: berhijrah dari kebiasaan lama menuju yang lebih baik.", token: { name: "Bintang Hijrah", icon: "⭐" }, c1: "#4c1d95", c2: "#7c3aed", c3: "#fbbf24",
		hij: { m: 1, d0: 1, d1: 10 }, boss: reskin(4, "Bayangan Kebiasaan Lama", { W: "#c4b5fd", L: "#7c3aed", K: "#1e1b4b", B: "#fbbf24" }), gear: "kompas", cards: ["ev-hijriah1", "ev-hijriah2"] },
	{ id: "ramadan", name: "Festival Ramadan", icon: "🏮", blurb: "Bulan penuh berkah: tilawah, hafalan, dan belajar dengan semangat yang berlipat.", token: { name: "Lentera", icon: "🏮" }, c1: "#0f172a", c2: "#1e3a8a", c3: "#fbbf24",
		hij: { m: 9, d0: 1, d1: 30 }, boss: reskin(0, "Slime Kantuk Sahur", { G: "#1e3a8a", L: "#3b82f6", D: "#172554", W: "#fde68a", K: "#0b1020", R: "#f59e0b" }), gear: "lentera", cards: ["ev-ramadan1", "ev-ramadan2"] },
];

export interface Occ { def: EvDef; start: number; end: number; key: string }
const cache = new Map<string, Occ | null>();
const inHij = (p: FlashcardPlugin, def: EvDef, t: number) => { const h = hijri(p, t); return !!h.m && h.m === def.hij!.m && h.d >= def.hij!.d0 && h.d <= def.hij!.d1; };

/** Kemunculan event yang aktif pada waktu t, atau berikutnya bila `next`. */
function occurrence(p: FlashcardPlugin, def: EvDef, t: number, next: boolean): Occ | null {
	const ck = `${def.id}|${dayKey(t)}|${next}`;
	if (cache.has(ck)) return cache.get(ck)!;
	let res: Occ | null = null;
	const day = startOfDay(t);
	if (def.greg) {
		const g = def.greg;
		const y = new Date(day).getFullYear();
		for (const yy of [y - 1, y, y + 1]) {
			const s = new Date(yy, g.m0 - 1, g.d0).getTime(), e = new Date(yy, g.m1 - 1, g.d1, 23, 59, 59).getTime();
			if (next ? s > day : s <= t && t <= e) { res = { def, start: s, end: e, key: `${def.id}:${dayKey(s)}` }; break; }
		}
	} else if (def.hij) {
		let d = day;
		if (!next && !inHij(p, def, d)) res = null;
		else {
			if (next) { let i = 1; d = addDays(day, 1); while (i < 400 && !(inHij(p, def, d) && !inHij(p, def, addDays(d, -1)))) { d = addDays(d, 1); i++; } if (i >= 400) { cache.set(ck, null); return null; } }
			let s = d; while (inHij(p, def, addDays(s, -1))) s = addDays(s, -1);
			let e = d; while (inHij(p, def, addDays(e, 1))) e = addDays(e, 1);
			res = { def, start: s, end: e + 86400_000 - 1000, key: `${def.id}:${dayKey(s)}` };
		}
	}
	cache.set(ck, res);
	return res;
}
export const activeEvent = (p: FlashcardPlugin, t = Date.now()): Occ | null => { for (const d of EVENTS) { const o = occurrence(p, d, t, false); if (o) return o; } return null; };
export const upcoming = (p: FlashcardPlugin): Occ[] => EVENTS.map((d) => occurrence(p, d, Date.now(), true)).filter((x): x is Occ => !!x).sort((a, b) => a.start - b.start);

// ================================================================ token & misi
const E = (p: FlashcardPlugin) => p.data.events;
function windowDays(o: Occ): string[] { const out: string[] = []; for (let d = startOfDay(o.start); d <= Math.min(o.end, Date.now()); d = addDays(d, 1)) out.push(dayKey(d)); return out; }
const sumLog = (p: FlashcardPlugin, o: Occ, ev: string) => windowDays(o).reduce((a, k) => a + (((p.data.meta.missionLog?.[k] as Record<string, number> | undefined)?.[ev]) ?? 0), 0);
const reviewsIn = (p: FlashcardPlugin, o: Occ) => windowDays(o).reduce((a, k) => a + (p.data.daily[k]?.reviews ?? 0), 0);
export function balance(p: FlashcardPlugin, o: Occ) {
	const fromReviews = Math.floor(reviewsIn(p, o) / 30);
	return (E(p).tokens[o.key] ?? 0) + fromReviews - (E(p).spent[o.key] ?? 0);
}
interface Quest { id: string; text: string; need: number; reward: number; val: (p: FlashcardPlugin, o: Occ) => number }
const QUESTS: Quest[] = [
	{ id: "rev", text: "Ulas 100 kartu selama event", need: 100, reward: 6, val: reviewsIn },
	{ id: "days", text: "Belajar di 5 hari berbeda", need: 5, reward: 6, val: (p, o) => windowDays(o).filter((k) => p.data.daily[k]?.reviews).length },
	{ id: "boss", text: "Kalahkan boss event", need: 1, reward: 4, val: (p, o) => E(p).bossWins[o.key] ?? 0 },
	{ id: "dungeon", text: "Jelajahi 10 lantai dungeon", need: 10, reward: 4, val: (p, o) => sumLog(p, o, "dungeonFloor") },
	{ id: "block", text: "Jalankan 3 jadwal belajar", need: 3, reward: 3, val: (p, o) => sumLog(p, o, "block") },
];
export const claimable = (p: FlashcardPlugin, o: Occ) => QUESTS.filter((q) => q.val(p, o) >= q.need && !E(p).claimed.includes(`m:${o.key}:${q.id}`)).length;
export const bossDoneToday = (p: FlashcardPlugin, o: Occ) => E(p).bossDay[o.key] === dayKey(Date.now());

function startEventBoss(hub: HubView, o: Occ) {
	const p = hub.plugin;
	const g = new BossBattle(hub, p.allCards(), o.def.name, 0, false, "normal", "", {
		custom: o.def.boss, eventId: o.def.id, back: "event",
		onWin: () => {
			const e = E(p), out: string[] = [];
			const daily = e.bossDay[o.key] !== dayKey(Date.now());
			const tk = daily ? 6 : 2;
			e.tokens[o.key] = (e.tokens[o.key] ?? 0) + tk;
			e.bossDay[o.key] = dayKey(Date.now());
			e.bossWins[o.key] = (e.bossWins[o.key] ?? 0) + 1;
			out.push(`${o.def.token.icon} ${tk} ${o.def.token.name}${daily ? " (bonus harian)" : ""}`);
			const fk = `card:${o.key}`;
			const missing = o.def.cards.filter((c) => !p.data.collect.owned[c]);
			if (!e.claimed.includes(fk) && missing.length) {
				const c = missing[Math.floor(Math.random() * missing.length)];
				p.data.collect.owned[c] = 1;
				e.claimed.push(fk);
				out.push(`🎖️ Kartu edisi terbatas: ${CARDS.find((x) => x.id === c)?.name}`);
			}
			p.requestSave();
			return out;
		},
	});
	if (!hub.startGame(g)) new Notice("Butuh minimal 4 kartu yang bisa dijadikan soal pilihan ganda.");
}

// ================================================================ tema & tampilan
export function applyEventTheme(p: FlashcardPlugin) {
	const b = document.body;
	for (const d of EVENTS) b.removeClass(`fch-ev-${d.id}`);
	b.removeClass("fch-ev-on");
	const o = p.data.settings.eventDecor !== false ? activeEvent(p) : null;
	if (o) b.addClass("fch-ev-on", `fch-ev-${o.def.id}`);
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
function left(ms: number) { const d = Math.floor(ms / 86400_000), h = Math.floor((ms % 86400_000) / 3600_000), m = Math.floor((ms % 3600_000) / 60_000); return d ? `${d} hari ${h} jam` : h ? `${h} jam ${m} mnt` : `${m} mnt`; }

/** Spanduk kecil untuk Beranda. */
export function renderEventBanner(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const o = activeEvent(p);
	if (!o) return;
	const b = el.createDiv(`fch-evbanner ev-${o.def.id}`);
	b.style.setProperty("--e1", o.def.c1); b.style.setProperty("--e2", o.def.c2); b.style.setProperty("--e3", o.def.c3);
	b.createDiv({ cls: "fch-evbanner-ic", text: o.def.icon });
	const t = b.createDiv("fch-grow");
	t.createDiv({ cls: "fch-strong", text: `${o.def.name} sedang berlangsung!` });
	const c = claimable(p, o);
	t.createDiv({ cls: "fch-small", text: `Berakhir dalam ${left(o.end - Date.now())} · ${o.def.token.icon} ${balance(p, o)} ${o.def.token.name}${c ? ` · 🎁 ${c} hadiah misi siap diklaim` : ""}${bossDoneToday(p, o) ? "" : " · 👾 boss event menunggu"}` });
	btn(b, { text: "Buka event", icon: "party-popper", cls: "fch-btn-sm fch-btn-primary", onClick: () => hub.navigate("event") });
}

export function renderEvents(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const o = activeEvent(p);
	if (!o) {
		const head = el.createDiv("fch-pagehead");
		head.createEl("h1", { text: "🎉 Event Musiman" });
		head.createDiv({ cls: "fch-muted", text: "Acara terbatas mengikuti kalender: boss bertema, kartu album edisi terbatas, perlengkapan eksklusif, dan dekorasi tampilan. Saat ini belum ada event yang berlangsung." });
		renderUpcoming(p, el);
		return;
	}
	const d = o.def;
	const hero = el.createDiv(`fch-ev-hero ev-${d.id}`);
	hero.style.setProperty("--e1", d.c1); hero.style.setProperty("--e2", d.c2); hero.style.setProperty("--e3", d.c3);
	hero.createDiv("fch-ev-deco");
	const hl = hero.createDiv("fch-ev-hero-l");
	hl.createDiv({ cls: "fch-ev-tag", text: "EVENT TERBATAS" });
	hl.createEl("h1", { text: `${d.icon} ${d.name}` });
	hl.createDiv({ cls: "fch-ev-blurb", text: d.blurb });
	const cd = hl.createDiv({ cls: "fch-ev-count" });
	const tick = () => cd.setText(`⏳ Berakhir dalam ${left(o.end - Date.now())} · ${fmtDate(o.start)} – ${fmtDate(o.end)}`);
	tick();
	const tm = window.setInterval(() => { if (!cd.isConnected) return window.clearInterval(tm); tick(); }, 30_000);
	const wal = hero.createDiv("fch-ev-wallet");
	wal.createDiv({ cls: "fch-ev-tok", text: `${d.token.icon} ${balance(p, o)}` });
	wal.createDiv({ cls: "fch-small", text: d.token.name });
	wal.createDiv({ cls: "fch-ev-tokhint", text: "+1 setiap 30 kartu diulas" });

	const grid = el.createDiv("fch-ev-grid");
	// ---- boss event
	const bc = grid.createDiv("fch-ev-boss");
	bc.style.setProperty("--e1", d.c1); bc.style.setProperty("--e3", d.c3);
	bossSprite(bc.createDiv("fch-ev-boss-sp"), d.boss, 9);
	bc.createDiv({ cls: "fch-b2-badge", text: "👾 BOSS EVENT" });
	bc.createDiv({ cls: "fch-ev-boss-name", text: d.boss.name });
	const done = bossDoneToday(p, o);
	bc.createDiv({ cls: "fch-small", text: done ? "✓ Bonus harian sudah diambil. Tantang lagi untuk +2 token." : `Hadiah harian: ${d.token.icon} 6 token · bahan langka · kartu edisi terbatas (kemenangan pertama)` });
	btn(bc, { text: done ? "Tantang lagi" : "Lawan!", icon: "swords", cls: "fch-btn-primary fch-btn-lg", onClick: () => startEventBoss(hub, o) });
	// ---- misi
	const mc = grid.createDiv("fch-panel fch-ev-quests");
	mc.createEl("h3", { text: "📜 Misi event" });
	for (const q of QUESTS) {
		const v = Math.min(q.need, q.val(p, o));
		const key = `m:${o.key}:${q.id}`;
		const claimed = E(p).claimed.includes(key);
		const r = mc.createDiv("fch-ev-quest" + (claimed ? " is-claimed" : v >= q.need ? " is-ready" : ""));
		const t = r.createDiv("fch-grow");
		t.createDiv({ cls: "fch-small fch-strong", text: q.text });
		const bar = t.createDiv("fch-bar fch-bar-thin");
		bar.createDiv("fch-bar-fill").style.width = `${(v / q.need) * 100}%`;
		t.createDiv({ cls: "fch-small fch-muted", text: `${v}/${q.need}` });
		if (claimed) r.createSpan({ cls: "fch-small fch-strong", text: "✓ Diklaim" });
		else btn(r, { text: `${d.token.icon} +${q.reward}`, cls: "fch-btn-sm" + (v >= q.need ? " fch-btn-primary" : ""), disabled: v < q.need, onClick: () => {
			E(p).claimed.push(key);
			E(p).tokens[o.key] = (E(p).tokens[o.key] ?? 0) + q.reward;
			p.requestSave();
			play("coin");
			hub.renderPage();
		} });
	}

	// ---- toko event
	const sh = el.createDiv("fch-panel fch-mt");
	const shh = sh.createDiv("fch-section-head");
	shh.createEl("h3", { text: `🛒 Toko Event · ${d.token.icon} ${balance(p, o)}` });
	shh.createSpan({ cls: "fch-small fch-muted", text: "Token hangus saat event berakhir. Tukarkan sebelum tutup!" });
	const sg = sh.createDiv("fch-ev-shop");
	const offer = (icon: string, name: string, desc: string, cost: number, rarity: keyof typeof RAR, state: string | null, buy: () => string) => {
		const c = sg.createDiv(`fch-ev-offer r-${rarity}`);
		c.style.setProperty("--rc", RAR[rarity].color);
		c.createDiv({ cls: "fch-ev-offer-ic", text: icon });
		c.createDiv({ cls: "fch-shop-rar", text: `${RAR[rarity].stars} ${RAR[rarity].label}` });
		c.createDiv({ cls: "fch-strong", text: name });
		c.createDiv({ cls: "fch-shop-desc", text: desc });
		const bal = balance(p, o);
		if (state) c.createDiv({ cls: "fch-shop-eq", text: state });
		else btn(c, { text: `${d.token.icon} ${cost}`, cls: "fch-btn-sm fch-btn-primary", disabled: bal < cost, onClick: () => {
			if (balance(p, o) < cost) return;
			E(p).spent[o.key] = (E(p).spent[o.key] ?? 0) + cost;
			const msg = buy();
			p.requestSave();
			p.checkAchievements();
			play(rarity === "legendaris" || rarity === "epik" ? "victory" : "coin");
			if ((rarity === "legendaris" || rarity === "epik") && p.data.settings.confetti) confetti(hub.mainEl);
			new Notice(msg);
			hub.renderPage();
		} });
	};
	const gi = item(d.gear)!;
	const st = Object.entries(gi.stats ?? {}).map(([k, v]) => (k === "atk" ? `⚔️ +${Math.round(v * 100)}%` : k === "crit" ? `🎯 ${Math.round(v * 100)}%` : k === "hp" ? `❤️ +${v}` : k === "block" ? `🛡️ ${Math.round(v * 100)}%` : k === "coin" ? `🪙 +${Math.round(v * 100)}%` : k === "time" ? `⏱️ +${v} dtk` : "⚡ combo 4")).join(" · ");
	offer(gi.icon, gi.name, `${gi.desc} ${st}`, 18, gi.rarity, p.data.hero.owned[gi.id] ? "✓ Dimiliki" : null, () => { p.data.hero.owned[gi.id] = 1; p.data.hero.equip[gi.slot as "weapon"] = gi.id; return `${gi.icon} ${gi.name} didapat dan langsung dipakai!`; });
	for (const cid of d.cards) {
		const c = CARDS.find((x) => x.id === cid)!;
		offer(c.icon, `Kartu: ${c.name}`, "Kartu album edisi terbatas, hanya ada saat event ini.", 10, c.rarity, p.data.collect.owned[cid] ? "✓ Dimiliki" : null, () => { p.data.collect.owned[cid] = 1; return `🎖️ Kartu ${c.name} masuk ke Album!`; });
	}
	offer("🎴", "Bungkus kartu koleksi", "Satu bungkus berisi 3 kartu album biasa.", 4, "langka", null, () => { p.data.collect.packs++; return "🎴 +1 bungkus kartu koleksi"; });
	offer("🧪", "Paket ramuan", "2 ramuan acak: penyembuh, perisai, kaca pembesar, atau jam pasir.", 3, "umum", null, () => {
		const got: string[] = [];
		for (let i = 0; i < 2; i++) { const id = ["heal", "shield", "lens", "hourglass"][Math.floor(Math.random() * 4)]; const h = p.data.hero; h.bag[id] = Math.min(BAG_MAX, (h.bag[id] ?? 0) + 1); got.push(item(id)!.icon); }
		return `🧪 Paket ramuan: ${got.join(" ")}`;
	});
	offer("📜", "Gulungan Kuno", "Bahan langka untuk resep tingkat tinggi di Bengkel Alkimia.", 5, "epik", null, () => `🧺 ${addMat(p, "gulungan")}`);

	// ---- kartu edisi terbatas
	const cards = el.createDiv("fch-panel fch-mt");
	cards.createEl("h3", { text: "🎖️ Kartu edisi terbatas" });
	const cg = cards.createDiv("fch-cc-grid");
	for (const cid of d.cards) { const c = CARDS.find((x) => x.id === cid)!; const ce = cardEl(cg, c, !!p.data.collect.owned[cid]); if (p.data.collect.owned[cid]) ce.setAttr("aria-label", c.fact); }
	renderUpcoming(p, el);
}

function renderUpcoming(p: FlashcardPlugin, el: HTMLElement) {
	const box = el.createDiv("fch-panel fch-mt");
	box.createEl("h3", { text: "📅 Event mendatang" });
	for (const o of upcoming(p)) {
		const r = box.createDiv("fch-ev-up");
		r.style.setProperty("--e1", o.def.c1); r.style.setProperty("--e3", o.def.c3);
		r.createDiv({ cls: "fch-ev-up-ic", text: o.def.icon });
		const t = r.createDiv("fch-grow");
		t.createDiv({ cls: "fch-strong", text: o.def.name });
		t.createDiv({ cls: "fch-small fch-muted", text: `${fmtDate(o.start)} – ${fmtDate(o.end)} · ${Math.max(0, Math.ceil((o.start - Date.now()) / 86400_000))} hari lagi${o.def.hij ? " (perkiraan kalender Umm al-Qura)" : ""}` });
		const g = item(o.def.gear)!;
		r.createSpan({ cls: "fch-ev-up-prize", text: `${g.icon} ${o.def.cards.map((c) => CARDS.find((x) => x.id === c)?.icon).join("")}`, attr: { "aria-label": `Hadiah: ${g.name} & 2 kartu edisi terbatas` } });
	}
}
