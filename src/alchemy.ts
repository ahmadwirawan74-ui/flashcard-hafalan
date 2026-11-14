import { App, Modal, Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { BAG_MAX, ITEMS, RAR, heroFigure, item, itemStats } from "./gear";
import { btn, confetti } from "./util";
import { play } from "./sound";

// ================================================================ bahan
export interface Mat { id: string; name: string; icon: string; rarity: "umum" | "langka" | "epik"; from: string }
export const MATS: Mat[] = [
	{ id: "bijih", name: "Bijih Besi", icon: "🪨", rarity: "umum", from: "Monster & peti dungeon" },
	{ id: "herbal", name: "Daun Herbal", icon: "🌿", rarity: "umum", from: "Monster dungeon & air mancur" },
	{ id: "bulu", name: "Bulu Emas", icon: "🪶", rarity: "langka", from: "Lolos dari jebakan dungeon, boss" },
	{ id: "kristal", name: "Kristal Ingatan", icon: "💎", rarity: "langka", from: "Peti harta, ruang harta & Bos Zona dungeon, boss" },
	{ id: "bara", name: "Bara Naga", icon: "🔥", rarity: "epik", from: "Penjaga dungeon lantai 10+, boss Sulit" },
	{ id: "gulungan", name: "Gulungan Kuno", icon: "📜", rarity: "epik", from: "Boss mingguan & boss event, Bos Zona dungeon (jarang)" },
];
export const mat = (id: string) => MATS.find((m) => m.id === id)!;

const H = (p: FlashcardPlugin) => p.data.hero;
export const matCount = (p: FlashcardPlugin, id: string) => H(p).mats?.[id] ?? 0;

/** Tambah bahan; kembalikan teks singkat seperti "🌿 Daun Herbal ×2". */
export function addMat(p: FlashcardPlugin, id: string, n = 1): string {
	const h = H(p);
	h.mats ??= {};
	h.mats[id] = (h.mats[id] ?? 0) + n;
	h.seenMats ??= [];
	if (!h.seenMats.includes(id)) h.seenMats.push(id);
	p.requestSave();
	const m = mat(id);
	return `${m.icon} ${m.name}${n > 1 ? ` ×${n}` : ""}`;
}

type Source = "monster" | "chest" | "guardian" | "trap" | "fountain" | "boss" | "bossHard" | "weekly" | "event";
/** Jatahkan bahan dari sebuah kejadian. floor = lantai dungeon. */
export function dropMats(p: FlashcardPlugin, src: Source, floor = 1): string[] {
	const out: string[] = [];
	const r = Math.random;
	const give = (id: string, n = 1) => out.push(addMat(p, id, n));
	switch (src) {
		case "monster": if (r() < 0.6) give(r() < 0.5 ? "herbal" : "bijih"); break;
		case "chest": give("bijih", 1 + (r() < 0.4 ? 1 : 0)); if (r() < 0.45) give("kristal"); break;
		case "trap": if (r() < 0.35) give("bulu"); break;
		case "fountain": if (r() < 0.5) give("herbal"); break;
		case "guardian": give("kristal"); if (floor >= 10 && r() < 0.35) give("bara"); if (r() < 0.12) give("gulungan"); break;
		case "boss": give(r() < 0.5 ? "bijih" : "herbal", 2); if (r() < 0.5) give("kristal"); if (r() < 0.3) give("bulu"); break;
		case "bossHard": give("kristal"); give(r() < 0.5 ? "bulu" : "bijih", 2); if (r() < 0.5) give("bara"); break;
		case "weekly": give("gulungan"); give("kristal"); give(r() < 0.5 ? "bara" : "bulu"); break;
		case "event": give("gulungan"); give(r() < 0.5 ? "bara" : "kristal"); break;
	}
	return out;
}

// ================================================================ resep
export interface Recipe { id: string; out: string; qty: number; need: Record<string, number>; coins: number; secret?: boolean }
export const RECIPES: Recipe[] = [
	// ramuan
	{ id: "r-heal", out: "heal", qty: 2, need: { herbal: 2 }, coins: 0 },
	{ id: "r-lens", out: "lens", qty: 1, need: { kristal: 1, herbal: 1 }, coins: 0 },
	{ id: "r-shield", out: "shield", qty: 2, need: { bijih: 2, herbal: 1 }, coins: 0 },
	{ id: "r-hourglass", out: "hourglass", qty: 1, need: { kristal: 1, bulu: 1 }, coins: 0 },
	{ id: "r-bigheal", out: "bigheal", qty: 1, need: { herbal: 3, kristal: 1 }, coins: 0 },
	{ id: "r-bomb", out: "bomb", qty: 2, need: { bijih: 2, bara: 1 }, coins: 0 },
	{ id: "r-clover", out: "clover", qty: 1, need: { herbal: 3, bulu: 1 }, coins: 0 },
	{ id: "r-phoenix", out: "phoenix", qty: 1, need: { bulu: 2, bara: 1, kristal: 1 }, coins: 0 },
	// perlengkapan khusus
	{ id: "c-kapak", out: "kapak", qty: 1, need: { bijih: 6, herbal: 2 }, coins: 100 },
	{ id: "c-jubahdaun", out: "jubahdaun", qty: 1, need: { herbal: 8, bulu: 2 }, coins: 100 },
	{ id: "c-kacamata", out: "kacamata", qty: 1, need: { kristal: 3, bulu: 2 }, coins: 200, secret: true },
	{ id: "c-tongkat", out: "tongkatkristal", qty: 1, need: { kristal: 4, bulu: 2, gulungan: 1 }, coins: 250, secret: true },
	{ id: "c-zirahkristal", out: "zirahkristal", qty: 1, need: { kristal: 5, bijih: 4, gulungan: 1 }, coins: 250, secret: true },
	{ id: "c-godam", out: "godam", qty: 1, need: { bijih: 8, bara: 3, gulungan: 2 }, coins: 400, secret: true },
	{ id: "c-zirahbara", out: "zirahbara", qty: 1, need: { bara: 4, kristal: 3, gulungan: 2 }, coins: 400, secret: true },
	{ id: "c-terompet", out: "terompet", qty: 1, need: { gulungan: 2, bara: 2, bulu: 3 }, coins: 400, secret: true },
];
/** Resep rahasia terbuka setelah semua bahannya pernah didapat. */
export const discovered = (p: FlashcardPlugin, r: Recipe) => !r.secret || Object.keys(r.need).every((m) => H(p).seenMats?.includes(m));
export function canCraft(p: FlashcardPlugin, r: Recipe): { ok: boolean; why?: string } {
	const it = item(r.out)!;
	if (it.slot !== "potion" && H(p).owned[it.id]) return { ok: false, why: "Sudah dimiliki" };
	if (it.slot === "potion" && (H(p).bag[it.id] ?? 0) + r.qty > BAG_MAX) return { ok: false, why: "Tas penuh" };
	for (const [m, n] of Object.entries(r.need)) if (matCount(p, m) < n) return { ok: false, why: "Bahan kurang" };
	if ((p.data.meta.coins ?? 0) < r.coins) return { ok: false, why: "Koin kurang" };
	return { ok: true };
}
function craft(p: FlashcardPlugin, r: Recipe) {
	const h = H(p);
	for (const [m, n] of Object.entries(r.need)) h.mats![m] -= n;
	p.data.meta.coins = (p.data.meta.coins ?? 0) - r.coins;
	const it = item(r.out)!;
	if (it.slot === "potion") h.bag[it.id] = Math.min(BAG_MAX, (h.bag[it.id] ?? 0) + r.qty);
	else { h.owned[it.id] = 1; h.equip[it.slot as "weapon"] = it.id; }
	h.crafted = (h.crafted ?? 0) + 1;
	p.requestSave();
	p.checkAchievements();
}

/** Animasi kuali: bahan masuk, mendidih, lalu hasilnya muncul. */
class BrewModal extends Modal {
	constructor(app: App, private p: FlashcardPlugin, private r: Recipe, private done: () => void) { super(app); }
	onOpen() {
		this.modalEl.addClass("fch-modal", "fch-brew-modal");
		const el = this.contentEl;
		const it = item(this.r.out)!;
		const stage = el.createDiv("fch-brew");
		const ings = stage.createDiv("fch-brew-ings");
		Object.entries(this.r.need).forEach(([m, n], i) => { const s = ings.createSpan({ cls: "fch-brew-ing", text: `${mat(m).icon}×${n}` }); s.style.animationDelay = `${i * 0.18}s`; });
		const pot = stage.createDiv("fch-brew-pot");
		pot.createDiv({ cls: "fch-brew-cauldron", text: it.slot === "potion" ? "⚗️" : "🔨" });
		for (let i = 0; i < 7; i++) { const b = pot.createDiv("fch-brew-bubble"); b.style.left = `${15 + i * 11}%`; b.style.animationDelay = `${(i % 4) * 0.25}s`; }
		const res = stage.createDiv("fch-brew-result");
		res.style.setProperty("--rc", RAR[it.rarity].color);
		play("chime");
		window.setTimeout(() => {
			craft(this.p, this.r);
			stage.addClass("is-done");
			res.createDiv({ cls: "fch-brew-ic", text: it.icon });
			res.createDiv({ cls: "fch-brew-rar", text: `${RAR[it.rarity].stars} ${RAR[it.rarity].label}` });
			res.createDiv({ cls: "fch-brew-name", text: `${it.name}${this.r.qty > 1 ? ` ×${this.r.qty}` : ""}` });
			res.createDiv({ cls: "fch-small fch-muted", text: it.slot === "potion" ? "Masuk ke tas ramuan." : "Langsung dipakai. Lihat di Toko → Karakter & Tas." });
			play(it.rarity === "legendaris" ? "victory" : "achievement");
			if ((it.rarity === "legendaris" || it.rarity === "epik") && this.p.data.settings.confetti) confetti(el);
			btn(res, { text: "Mantap!", cls: "fch-btn-primary fch-mt", onClick: () => this.close() });
		}, 1500);
	}
	onClose() { this.contentEl.empty(); this.done(); }
}

// ================================================================ halaman Bengkel
let tab: "potion" | "gear" = "potion";
export function renderAlchemy(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const h = H(p);
	const hero = el.createDiv("fch-alc-hero");
	const art = hero.createDiv("fch-alc-art");
	art.createDiv({ cls: "fch-alc-pot", text: "⚗️" });
	for (let i = 0; i < 5; i++) { const b = art.createDiv("fch-brew-bubble"); b.style.left = `${20 + i * 14}%`; b.style.animationDelay = `${i * 0.35}s`; }
	const t = hero.createDiv("fch-grow");
	t.createEl("h1", { text: "⚗️ Bengkel Alkimia" });
	t.createDiv({ cls: "fch-alc-sub", text: "Racik bahan dari Dungeon dan Boss menjadi ramuan, atau tempa perlengkapan khusus yang tidak dijual di Toko. Resep rahasia terbuka setelah kamu pernah mendapatkan semua bahannya." });
	const st = t.createDiv("fch-alc-stats");
	st.createSpan({ text: `🧪 ${h.crafted ?? 0} racikan` });
	st.createSpan({ text: `🪙 ${(p.data.meta.coins ?? 0).toLocaleString("id-ID")}` });
	st.createSpan({ text: `📖 ${RECIPES.filter((r) => discovered(p, r)).length}/${RECIPES.length} resep` });
	const fig = hero.createDiv("fch-alc-fig");
	heroFigure(p, fig, 5);

	// ---- gudang bahan
	const inv = el.createDiv("fch-panel fch-mt");
	const ih = inv.createDiv("fch-section-head");
	ih.createEl("h3", { text: "🧺 Gudang bahan" });
	btn(ih, { text: "Cari bahan di Dungeon", icon: "door-open", cls: "fch-btn-link", onClick: () => hub.navigate("dungeon") });
	const g = inv.createDiv("fch-alc-mats");
	for (const m of MATS) {
		const n = matCount(p, m.id);
		const c = g.createDiv("fch-alc-mat" + (n ? "" : " is-empty"));
		c.style.setProperty("--rc", RAR[m.rarity].color);
		c.createDiv({ cls: "fch-alc-mic", text: m.icon });
		c.createDiv({ cls: "fch-alc-mn", text: `×${n}` });
		c.createDiv({ cls: "fch-small fch-strong", text: m.name });
		c.createDiv({ cls: "fch-alc-from", text: m.from });
	}

	// ---- resep
	const tabs = el.createDiv("fch-shop-tabs fch-mt");
	for (const [id, label] of [["potion", "🧪 Ramuan"], ["gear", "⚒️ Perlengkapan khusus"]] as const) {
		const b = tabs.createEl("button", { cls: "fch-shop-tab" + (tab === id ? " is-on" : ""), text: label });
		b.onclick = () => { tab = id; hub.renderPage(); };
	}
	const grid = el.createDiv("fch-alc-grid");
	for (const r of RECIPES.filter((x) => (tab === "potion") === (item(x.out)!.slot === "potion"))) {
		const it = item(r.out)!;
		const known = discovered(p, r);
		const cc = canCraft(p, r);
		const c = grid.createDiv(`fch-alc-rec r-${it.rarity}` + (known ? "" : " is-secret") + (cc.ok ? " is-ready" : ""));
		c.style.setProperty("--rc", RAR[it.rarity].color);
		const top = c.createDiv("fch-alc-rtop");
		top.createDiv({ cls: "fch-alc-ric", text: known ? it.icon : "❔" });
		const tt = top.createDiv("fch-grow");
		tt.createDiv({ cls: "fch-shop-rar", text: `${RAR[it.rarity].stars} ${RAR[it.rarity].label}` });
		tt.createDiv({ cls: "fch-shop-name", text: known ? `${it.name}${r.qty > 1 ? ` ×${r.qty}` : ""}` : "Resep rahasia" });
		if (known) {
			c.createDiv({ cls: "fch-shop-desc", text: it.desc });
			if (it.slot !== "potion") { const s = c.createDiv("fch-shop-stats"); const x = itemStats(it); if (x.atk) s.createSpan({ cls: "fch-shop-chip", text: `⚔️ +${Math.round(x.atk * 100)}%` }); if (x.crit) s.createSpan({ cls: "fch-shop-chip", text: `🎯 ${Math.round(x.crit * 100)}%` }); if (x.hp) s.createSpan({ cls: "fch-shop-chip", text: `❤️ +${x.hp}` }); if (x.block) s.createSpan({ cls: "fch-shop-chip", text: `🛡️ ${Math.round(x.block * 100)}%` }); if (x.coin) s.createSpan({ cls: "fch-shop-chip", text: `🪙 +${Math.round(x.coin * 100)}%` }); if (x.time) s.createSpan({ cls: "fch-shop-chip", text: `⏱️ +${x.time} dtk` }); if (x.combo) s.createSpan({ cls: "fch-shop-chip", text: "⚡ combo 4" }); }
		} else c.createDiv({ cls: "fch-shop-desc", text: "Kumpulkan semua jenis bahannya sekali saja untuk membuka resep ini." });
		const need = c.createDiv("fch-alc-need");
		for (const [m, n] of Object.entries(r.need)) {
			const have = matCount(p, m);
			const seen = H(p).seenMats?.includes(m);
			need.createSpan({ cls: "fch-alc-chip" + (have >= n ? " is-ok" : ""), text: `${seen || known ? mat(m).icon : "❔"} ${have}/${n}` });
		}
		if (r.coins) need.createSpan({ cls: "fch-alc-chip" + ((p.data.meta.coins ?? 0) >= r.coins ? " is-ok" : ""), text: `🪙 ${r.coins}` });
		const act = c.createDiv("fch-shop-act");
		if (known) btn(act, { text: cc.ok ? (it.slot === "potion" ? "Racik" : "Tempa") : cc.why!, icon: cc.ok ? (it.slot === "potion" ? "flask-conical" : "hammer") : undefined, cls: "fch-btn-sm" + (cc.ok ? " fch-btn-primary" : ""), disabled: !cc.ok, onClick: () => new BrewModal(hub.app, p, r, () => hub.renderPage()).open() });
	}
	el.createDiv({ cls: "fch-muted fch-small fch-mt", text: "Bahan didapat dari Dungeon (monster, peti, jebakan, air mancur, Bos Zona, ruang harta) dan dari mengalahkan Boss. Boss Sulit, Boss mingguan, dan Boss event memberi bahan langka. Perlengkapan hasil tempa bisa ditingkatkan di Toko seperti perlengkapan lainnya." });
	void ITEMS;
}

export const notifyMats = (got: string[]) => { if (got.length) new Notice(`🧺 Bahan: ${got.join(", ")}`, 4000); };
