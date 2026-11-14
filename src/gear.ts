import { App, Modal, Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { HeroState } from "./types";
import { dayKey } from "./scheduler";
import { btn, confetti } from "./util";
import { play } from "./sound";

// ================================================================ data barang
export type Slot = "weapon" | "armor" | "acc" | "potion";
export type GRarity = "umum" | "langka" | "epik" | "legendaris";
export interface Stats { atk?: number; crit?: number; hp?: number; block?: number; coin?: number; time?: number; combo?: number }
export interface Item { id: string; slot: Slot; name: string; icon: string; rarity: GRarity; price: number; desc: string; stats?: Stats; pal?: { A: string; a: string; H?: string }; /** hanya dari Bengkel Alkimia */ craft?: boolean; /** hanya dari event musiman */ event?: string }

export const ITEMS: Item[] = [
	// ---- senjata: serangan & kritis
	{ id: "pensil", slot: "weapon", name: "Pensil Kayu", icon: "✏️", rarity: "umum", price: 0, desc: "Senjata pertama setiap pelajar. Sederhana, tapi tajam kalau diraut.", stats: {} },
	{ id: "belati", slot: "weapon", name: "Belati Ringkas", icon: "🗡️", rarity: "umum", price: 150, desc: "Ringan dan cepat, cocok untuk ringkasan materi.", stats: { atk: 0.1 } },
	{ id: "pedangpena", slot: "weapon", name: "Pedang Pena", icon: "⚔️", rarity: "langka", price: 420, desc: "Pena lebih tajam dari pedang, apalagi pena yang berbentuk pedang.", stats: { atk: 0.2, crit: 0.05 } },
	{ id: "busur", slot: "weapon", name: "Busur Logika", icon: "🏹", rarity: "langka", price: 460, desc: "Setiap anak panah adalah premis yang tepat sasaran.", stats: { atk: 0.15, crit: 0.12 } },
	{ id: "palu", slot: "weapon", name: "Palu Rumus", icon: "🔨", rarity: "epik", price: 900, desc: "Menghantam soal hitungan sampai rata.", stats: { atk: 0.35 } },
	{ id: "tongkat", slot: "weapon", name: "Tongkat Ilham", icon: "🪄", rarity: "epik", price: 1000, desc: "Kadang ilham datang tiba-tiba, menghasilkan serangan kritis.", stats: { atk: 0.25, crit: 0.15 } },
	{ id: "cahaya", slot: "weapon", name: "Pedang Cahaya Ilmu", icon: "🌟", rarity: "legendaris", price: 2200, desc: "Ilmu adalah cahaya. Monster kebodohan gentar melihatnya.", stats: { atk: 0.5, crit: 0.2 } },
	// ---- zirah: hati & tangkis
	{ id: "baju", slot: "armor", name: "Baju Latihan", icon: "👕", rarity: "umum", price: 0, desc: "Nyaman dipakai belajar berjam-jam.", stats: {}, pal: { A: "#e2e8f0", a: "#94a3b8" } },
	{ id: "rompi", slot: "armor", name: "Rompi Kain", icon: "🦺", rarity: "umum", price: 150, desc: "Lapisan tambahan supaya tidak mudah tumbang.", stats: { hp: 1 }, pal: { A: "#d97706", a: "#92400e" } },
	{ id: "seragam", slot: "armor", name: "Seragam Pendekar", icon: "🥋", rarity: "langka", price: 420, desc: "Disiplin latihan membuat serangan lawan sering meleset.", stats: { hp: 1, block: 0.1 }, pal: { A: "#1f2937", a: "#020617" } },
	{ id: "zirahbesi", slot: "armor", name: "Zirah Besi", icon: "🛡️", rarity: "langka", price: 560, desc: "Berat, tapi kokoh. Dua hati tambahan.", stats: { hp: 2 }, pal: { A: "#94a3b8", a: "#475569", H: "#64748b" } },
	{ id: "jubah", slot: "armor", name: "Jubah Bijak", icon: "🧥", rarity: "epik", price: 1000, desc: "Jubah para guru: tenang menghadapi soal tersulit.", stats: { hp: 2, block: 0.15 }, pal: { A: "#7c3aed", a: "#4c1d95" } },
	{ id: "naga", slot: "armor", name: "Zirah Sisik Naga", icon: "🐉", rarity: "legendaris", price: 2400, desc: "Ditempa dari sisik Naga Ujian yang telah dikalahkan.", stats: { hp: 3, block: 0.2 }, pal: { A: "#dc2626", a: "#7f1d1d", H: "#f59e0b" } },
	// ---- aksesori
	{ id: "cincin", slot: "acc", name: "Cincin Saudagar", icon: "💍", rarity: "langka", price: 450, desc: "Setiap kemenangan menghasilkan koin lebih banyak.", stats: { coin: 0.2 } },
	{ id: "kalung", slot: "acc", name: "Kalung Fokus", icon: "📿", rarity: "langka", price: 500, desc: "Fokus terjaga: serangan kritis lebih sering.", stats: { crit: 0.1 } },
	{ id: "jam", slot: "acc", name: "Jam Tenang", icon: "⌚", rarity: "epik", price: 800, desc: "Waktu menjawab +5 detik di mode Sulit dan di jebakan dungeon.", stats: { time: 5 } },
	{ id: "jimat", slot: "acc", name: "Jimat Combo", icon: "🧿", rarity: "epik", price: 900, desc: "Serangan Pamungkas siap di combo 4 (biasanya 5).", stats: { combo: 1 } },
	{ id: "burunghantu", slot: "acc", name: "Lencana Burung Hantu", icon: "🦉", rarity: "legendaris", price: 2000, desc: "Simbol kebijaksanaan: +30% koin dan +10% kritis.", stats: { coin: 0.3, crit: 0.1 } },
	// ---- hasil racikan Bengkel Alkimia (tidak dijual di Toko)
	{ id: "kapak", slot: "weapon", name: "Kapak Rimba", icon: "🪓", rarity: "langka", price: 450, craft: true, desc: "Ditempa dari bijih besi dungeon. Kokoh dan tajam.", stats: { atk: 0.25, crit: 0.05 } },
	{ id: "tongkatkristal", slot: "weapon", name: "Tongkat Kristal", icon: "🔮", rarity: "epik", price: 1100, craft: true, desc: "Kristal ingatan memfokuskan setiap serangan.", stats: { atk: 0.3, crit: 0.18 } },
	{ id: "godam", slot: "weapon", name: "Godam Alkemis", icon: "⚒️", rarity: "legendaris", price: 2400, craft: true, desc: "Mahakarya Bengkel: menyatukan bara naga dan gulungan kuno.", stats: { atk: 0.55, crit: 0.15 } },
	{ id: "jubahdaun", slot: "armor", name: "Jubah Daun", icon: "🍃", rarity: "langka", price: 450, craft: true, desc: "Ringan dan lentur, dirajut dari daun herbal.", stats: { hp: 2, block: 0.05 }, pal: { A: "#16a34a", a: "#14532d" } },
	{ id: "zirahkristal", slot: "armor", name: "Zirah Kristal", icon: "💠", rarity: "epik", price: 1100, craft: true, desc: "Memantulkan serangan seperti cermin.", stats: { hp: 2, block: 0.2 }, pal: { A: "#38bdf8", a: "#0369a1", H: "#7dd3fc" } },
	{ id: "zirahbara", slot: "armor", name: "Zirah Bara", icon: "🔥", rarity: "legendaris", price: 2600, craft: true, desc: "Masih terasa hangat dari tungku naga.", stats: { hp: 4, block: 0.15 }, pal: { A: "#ea580c", a: "#7c2d12", H: "#facc15" } },
	{ id: "kacamata", slot: "acc", name: "Kacamata Alkemis", icon: "🥽", rarity: "epik", price: 900, craft: true, desc: "Melihat celah lawan: lebih kritis dan lebih tenang.", stats: { crit: 0.1, time: 3 } },
	{ id: "terompet", slot: "acc", name: "Terompet Kemenangan", icon: "📯", rarity: "legendaris", price: 2200, craft: true, desc: "Setiap kemenangan dirayakan dengan koin melimpah.", stats: { coin: 0.4, combo: 1 } },
	// ---- edisi event musiman (hanya dari Toko Event)
	{ id: "bambu", slot: "weapon", name: "Bambu Runcing Semangat", icon: "🎋", rarity: "epik", price: 1100, event: "pahlawan", desc: "Simbol semangat juang para pahlawan. Edisi Hari Pahlawan.", stats: { atk: 0.32, crit: 0.12 } },
	{ id: "jubahmp", slot: "armor", name: "Jubah Merah Putih", icon: "🧣", rarity: "epik", price: 1100, event: "hutri", desc: "Berkibar gagah. Edisi 17 Agustus.", stats: { hp: 2, block: 0.16 }, pal: { A: "#dc2626", a: "#f8fafc", H: "#991b1b" } },
	{ id: "kompas", slot: "acc", name: "Kompas Hijrah", icon: "🧭", rarity: "epik", price: 1000, event: "hijriah", desc: "Menunjuk arah perubahan yang lebih baik. Edisi Tahun Baru Hijriah.", stats: { crit: 0.08, time: 4, coin: 0.1 } },
	{ id: "lentera", slot: "acc", name: "Lentera Ramadan", icon: "🏮", rarity: "epik", price: 1000, event: "ramadan", desc: "Menerangi malam-malam belajarmu. Edisi Ramadan.", stats: { coin: 0.25, crit: 0.05 } },
	{ id: "pena", slot: "weapon", name: "Pena Tut Wuri", icon: "🖋️", rarity: "epik", price: 1100, event: "hardiknas", desc: "Dari belakang memberi dorongan. Edisi Hari Pendidikan Nasional.", stats: { atk: 0.28, crit: 0.15 } },
	{ id: "kitab", slot: "acc", name: "Kitab Kuning", icon: "📙", rarity: "epik", price: 1000, event: "santri", desc: "Teman setia para santri. Edisi Hari Santri.", stats: { combo: 1, coin: 0.1 } },
	// ---- ramuan
	{ id: "heal", slot: "potion", name: "Ramuan Penyembuh", icon: "🧪", rarity: "umum", price: 40, desc: "Pulihkan 1 ❤️." },
	{ id: "bigheal", slot: "potion", name: "Ramuan Agung", icon: "⚗️", rarity: "langka", price: 110, desc: "Pulihkan semua ❤️." },
	{ id: "shield", slot: "potion", name: "Perisai Sekali Pakai", icon: "🔰", rarity: "umum", price: 60, desc: "Tangkis serangan berikutnya." },
	{ id: "lens", slot: "potion", name: "Kaca Pembesar", icon: "🔍", rarity: "umum", price: 50, desc: "Hapus 2 pilihan jawaban yang salah." },
	{ id: "bomb", slot: "potion", name: "Bom Ilmu", icon: "💣", rarity: "langka", price: 90, desc: "Boss: 25 kerusakan. Dungeon: taklukkan monster biasa (tanpa emas)." },
	{ id: "hourglass", slot: "potion", name: "Jam Pasir", icon: "⏳", rarity: "umum", price: 50, desc: "Isi ulang waktu soal (mode Sulit) atau +8 detik di jebakan." },
	{ id: "clover", slot: "potion", name: "Semanggi Keberuntungan", icon: "🍀", rarity: "langka", price: 80, desc: "Koin/emas ×2 untuk pertarungan atau penjelajahan ini." },
	{ id: "phoenix", slot: "potion", name: "Bulu Phoenix", icon: "🪶", rarity: "epik", price: 160, desc: "Otomatis bangkit dengan 2 ❤️ saat kalah (sekali)." },
];
export const item = (id: string) => ITEMS.find((x) => x.id === id);
export const RAR: Record<GRarity, { label: string; color: string; stars: string }> = {
	umum: { label: "Umum", color: "#94a3b8", stars: "★" },
	langka: { label: "Langka", color: "#3b82f6", stars: "★★" },
	epik: { label: "Epik", color: "#a855f7", stars: "★★★" },
	legendaris: { label: "Legendaris", color: "#f59e0b", stars: "★★★★" },
};
export const MAX_LV = 5;
export const BAG_MAX = 9;
const H = (p: FlashcardPlugin): HeroState => p.data.hero;
export const upgradeCost = (it: Item, lv: number) => Math.max(60, Math.round(Math.max(it.price, 120) * 0.6 * lv));

/** Statistik satu barang pada level tertentu. Setiap level: +5% serangan / +3% tangkis / +5% koin. */
export function itemStats(it: Item, lv = 1): Required<Stats> {
	const s = { atk: 0, crit: 0, hp: 0, block: 0, coin: 0, time: 0, combo: 0, ...(it.stats ?? {}) };
	const up = Math.max(0, lv - 1);
	if (it.slot === "weapon") s.atk += up * 0.05;
	if (it.slot === "armor") s.block += up * 0.03;
	if (it.slot === "acc") s.coin += up * 0.05;
	return s;
}

export interface HeroStats { atk: number; crit: number; hp: number; block: number; coin: number; time: number; comboNeed: number; power: number }
export function heroStats(p: FlashcardPlugin, override?: Partial<HeroState["equip"]>): HeroStats {
	const h = H(p);
	const eq = { ...h.equip, ...(override ?? {}) };
	const t = { atk: 0, crit: 0, hp: 0, block: 0, coin: 0, time: 0, combo: 0 };
	for (const id of [eq.weapon, eq.armor, eq.acc]) {
		const it = id ? item(id) : undefined;
		if (!it) continue;
		const s = itemStats(it, h.owned[id] ?? 1);
		for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += s[k];
	}
	t.crit = Math.min(0.6, t.crit);
	t.block = Math.min(0.6, t.block);
	const power = Math.round(100 + t.atk * 220 + t.crit * 300 + t.hp * 45 + t.block * 260 + t.coin * 120 + t.time * 6 + t.combo * 60);
	return { atk: t.atk, crit: t.crit, hp: t.hp, block: t.block, coin: t.coin, time: t.time, comboNeed: 5 - t.combo, power };
}

export const bagCount = (p: FlashcardPlugin, id: string) => H(p).bag[id] ?? 0;
/** Pakai satu ramuan dari tas. false bila habis. */
export function usePotion(p: FlashcardPlugin, id: string): boolean {
	const h = H(p);
	if (!h.bag[id]) return false;
	h.bag[id]--;
	if (!h.bag[id]) delete h.bag[id];
	p.requestSave();
	return true;
}

/** Penawaran hari ini: satu barang diskon 30%, berganti setiap hari. */
export function dailyDeal(): { it: Item; price: number } {
	const k = dayKey(Date.now());
	let h = 0;
	for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	const pool = ITEMS.filter((x) => x.price > 0 && !x.craft && !x.event);
	const it = pool[h % pool.length];
	return { it, price: Math.round(it.price * 0.7) };
}
const priceOf = (it: Item) => { const d = dailyDeal(); return d.it.id === it.id ? d.price : it.price; };

function pay(p: FlashcardPlugin, n: number): boolean {
	const c = p.data.meta.coins ?? 0;
	if (c < n) return false;
	p.data.meta.coins = c - n;
	H(p).spent += n;
	return true;
}

// ================================================================ sprite pahlawan
const HERO_ROWS = [
	"......HHHH......",
	".....HHHHHH.....",
	"....HHSSSSHH....",
	"....HSSSSSSH....",
	"....SSESSESS....",
	"....SSSSSSSS....",
	".....SSMMSS.....",
	"....aAAAAAAa....",
	"...aAAAAAAAAa...",
	"..SaAAAGGAAAaS..",
	"..S.AAAAAAAA.S..",
	"....BBBBBBBB....",
	"....aaa..aaa....",
	"....aaa..aaa....",
	"....BBB..BBB....",
	"...BBBB..BBBB...",
];
export function heroSprite(p: FlashcardPlugin, parent: HTMLElement, px = 9, armorId?: string) {
	const ar = item(armorId ?? H(p).equip.armor) ?? item("baju")!;
	const pal: Record<string, string> = { H: ar.pal?.H ?? "#3f2a1d", S: "#f5c9a4", E: "#1e1b4b", M: "#c2410c", A: ar.pal?.A ?? "#e2e8f0", a: ar.pal?.a ?? "#94a3b8", B: "#422006", G: "#facc15" };
	const NS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("viewBox", "0 0 16 16");
	svg.setAttribute("width", String(16 * px));
	svg.setAttribute("height", String(16 * px));
	svg.setAttribute("shape-rendering", "crispEdges");
	svg.setAttribute("class", "fch-hero-svg");
	HERO_ROWS.forEach((row, y) => [...row].forEach((ch, x) => {
		const col = pal[ch];
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

/** Figur pahlawan lengkap: sprite + senjata di tangan + aksesori. */
export function heroFigure(p: FlashcardPlugin, parent: HTMLElement, px = 9) {
	const h = H(p);
	const fig = parent.createDiv("fch-hero-fig");
	fig.createDiv("fch-hero-aura");
	heroSprite(p, fig, px);
	const w = item(h.equip.weapon);
	if (w) fig.createDiv({ cls: "fch-hero-weapon", text: w.icon });
	const a = item(h.equip.acc);
	if (a) fig.createDiv({ cls: "fch-hero-acc", text: a.icon });
	fig.createDiv("fch-hero-shadow");
	return fig;
}

// ================================================================ tampilan
const statLine = (s: Partial<Stats>) => {
	const out: string[] = [];
	if (s.atk) out.push(`⚔️ +${Math.round(s.atk * 100)}% serangan`);
	if (s.crit) out.push(`🎯 ${Math.round(s.crit * 100)}% kritis`);
	if (s.hp) out.push(`❤️ +${s.hp} hati`);
	if (s.block) out.push(`🛡️ ${Math.round(s.block * 100)}% tangkis`);
	if (s.coin) out.push(`🪙 +${Math.round(s.coin * 100)}% koin`);
	if (s.time) out.push(`⏱️ +${s.time} dtk`);
	if (s.combo) out.push("⚡ Pamungkas di combo 4");
	return out;
};

class BuyModal extends Modal {
	private qty = 1;
	constructor(app: App, private p: FlashcardPlugin, private it: Item, private done: () => void) { super(app); }
	onOpen() {
		this.modalEl.addClass("fch-modal", "fch-buy-modal");
		const el = this.contentEl;
		el.empty();
		const it = this.it;
		const r = RAR[it.rarity];
		const top = el.createDiv("fch-buy-top");
		top.style.setProperty("--rc", r.color);
		top.createDiv({ cls: "fch-buy-ic", text: it.icon });
		const t = top.createDiv("fch-grow");
		t.createDiv({ cls: "fch-buy-rar", text: `${r.stars} ${r.label}` });
		t.createDiv({ cls: "fch-buy-name", text: it.name });
		t.createDiv({ cls: "fch-small fch-muted", text: it.desc });
		const stats = el.createDiv("fch-shop-stats");
		for (const s of statLine(itemStats(it))) stats.createSpan({ cls: "fch-shop-chip", text: s });
		const unit = priceOf(it);
		const coins = this.p.data.meta.coins ?? 0;
		if (it.slot === "potion") {
			const have = bagCount(this.p, it.id);
			const row = el.createDiv("fch-row fch-mt");
			row.createSpan({ cls: "fch-small fch-strong", text: "Jumlah:" });
			for (const n of [1, 3, 5]) {
				const b = btn(row, { text: `×${n}`, cls: "fch-btn-sm" + (this.qty === n ? " fch-btn-primary" : ""), disabled: have + n > BAG_MAX, onClick: () => { this.qty = n; this.onOpen(); } });
				void b;
			}
			row.createSpan({ cls: "fch-small fch-muted", text: `Di tas: ${have}/${BAG_MAX}` });
		}
		const total = unit * this.qty;
		const sum = el.createDiv("fch-buy-sum");
		sum.createSpan({ text: "Total" });
		sum.createSpan({ cls: "fch-buy-total", text: `🪙 ${total.toLocaleString("id-ID")}` });
		sum.createSpan({ cls: "fch-small fch-muted", text: `Sisa koin setelah membeli: ${(coins - total).toLocaleString("id-ID")}` });
		const foot = el.createDiv("fch-modal-foot fch-mt");
		foot.createDiv("fch-grow");
		btn(foot, { text: "Batal", cls: "fch-btn-ghost", onClick: () => this.close() });
		btn(foot, { text: coins < total ? `Kurang 🪙 ${total - coins}` : "Beli", icon: "shopping-bag", cls: "fch-btn-primary", disabled: coins < total, onClick: () => {
			if (!pay(this.p, total)) return;
			const h = H(this.p);
			if (it.slot === "potion") h.bag[it.id] = Math.min(BAG_MAX, (h.bag[it.id] ?? 0) + this.qty);
			else {
				h.owned[it.id] = 1;
				if (it.slot === "weapon" || it.slot === "armor" || it.slot === "acc") h.equip[it.slot] = it.id;
			}
			h.bought++;
			this.p.requestSave();
			this.p.checkAchievements();
			play(it.rarity === "legendaris" ? "victory" : "coin");
			new Notice(`🛍️ ${it.name}${this.qty > 1 ? ` ×${this.qty}` : ""} dibeli${it.slot !== "potion" ? " dan langsung dipakai" : " · masuk ke tas"}`);
			if (it.rarity === "legendaris" && this.p.data.settings.confetti) confetti(document.body);
			this.close();
			this.done();
		} });
	}
	onClose() { this.contentEl.empty(); }
}

const GREET = [
	"Selamat datang, petualang! Koinmu hasil belajar keras. Belanjakan dengan bijak.",
	"Boss minggu ini kuat sekali… Mungkin kamu butuh zirah baru?",
	"Ramuan penyembuh baru saja datang. Masih hangat!",
	"Pedang Cahaya Ilmu hanya untuk pelajar paling tekun.",
	"Ingat: senjata terbaik tetaplah ingatan yang kuat. Barangku hanya membantu.",
	"Dungeon makin dalam makin berbahaya. Bawa Bulu Phoenix, siapa tahu!",
];
let tab: Slot | "hero" = "weapon";
export const openShopTab = (t: Slot | "hero") => { tab = t; };

export function renderShop(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const h = H(p);
	const st = heroStats(p);
	const coins = p.data.meta.coins ?? 0;
	// ---------- spanduk toko
	const hero = el.createDiv("fch-shop-hero");
	const l = hero.createDiv("fch-shop-keeper");
	l.createDiv({ cls: "fch-shop-npc", text: "🧙‍♂️" });
	const bub = l.createDiv("fch-shop-bubble");
	bub.createDiv({ cls: "fch-strong", text: "Saudagar Ilmu" });
	bub.createDiv({ cls: "fch-small", text: GREET[(new Date().getDate() + new Date().getHours()) % GREET.length] });
	const deal = dailyDeal();
	const dc = hero.createDiv("fch-shop-deal");
	dc.style.setProperty("--rc", RAR[deal.it.rarity].color);
	dc.createDiv({ cls: "fch-shop-deal-tag", text: "🔥 PENAWARAN HARI INI · −30%" });
	const dr = dc.createDiv("fch-row");
	dr.createDiv({ cls: "fch-shop-deal-ic", text: deal.it.icon });
	const dt = dr.createDiv("fch-grow");
	dt.createDiv({ cls: "fch-strong", text: deal.it.name });
	const pr = dt.createDiv("fch-small");
	pr.createSpan({ cls: "fch-shop-old", text: `🪙 ${deal.it.price}` });
	pr.createSpan({ cls: "fch-shop-new", text: ` 🪙 ${deal.price}` });
	const ends = dt.createDiv({ cls: "fch-small fch-muted" });
	const tick = () => { const n = new Date(); const m = (23 - n.getHours()) * 60 + (59 - n.getMinutes()); ends.setText(`Berakhir dalam ${Math.floor(m / 60)} j ${m % 60} m`); };
	tick();
	const owned = deal.it.slot !== "potion" && !!h.owned[deal.it.id];
	btn(dc, { text: owned ? "Sudah dimiliki" : "Lihat", cls: "fch-btn-sm fch-btn-primary", disabled: owned, onClick: () => new BuyModal(hub.app, p, deal.it, () => hub.renderPage()).open() });
	const wal = hero.createDiv("fch-shop-wallet");
	wal.createDiv({ cls: "fch-shop-coins", text: `🪙 ${coins.toLocaleString("id-ID")}` });
	wal.createDiv({ cls: "fch-small", text: "koin" });
	wal.createDiv({ cls: "fch-shop-power", text: `⚡ ${st.power}` });
	wal.createDiv({ cls: "fch-small", text: "kekuatan" });

	// ---------- tab
	const tabs = el.createDiv("fch-shop-tabs");
	const T: [Slot | "hero", string][] = [["weapon", "⚔️ Senjata"], ["armor", "🛡️ Zirah"], ["acc", "💍 Aksesori"], ["potion", "🧪 Ramuan"], ["hero", "🎒 Karakter & Tas"]];
	for (const [id, label] of T) {
		const b = tabs.createEl("button", { cls: "fch-shop-tab" + (tab === id ? " is-on" : ""), text: label });
		if (id === "hero") { const n = Object.values(h.bag).reduce((a, x) => a + x, 0); if (n) b.createSpan({ cls: "fch-wstab-n", text: String(n) }); }
		b.onclick = () => { tab = id; hub.renderPage(); };
	}
	if (tab === "hero") return renderHero(hub, el);

	const grid = el.createDiv("fch-shop-grid");
	for (const it of ITEMS.filter((x) => x.slot === tab && !x.craft && !x.event)) {
		const r = RAR[it.rarity];
		const lv = h.owned[it.id] ?? 0;
		const equipped = it.slot !== "potion" && h.equip[it.slot as "weapon" | "armor" | "acc"] === it.id;
		const c = grid.createDiv(`fch-shop-item r-${it.rarity}` + (equipped ? " is-equipped" : "") + (lv ? " is-owned" : ""));
		c.style.setProperty("--rc", r.color);
		if (deal.it.id === it.id) c.createDiv({ cls: "fch-shop-ribbon", text: "−30%" });
		const ped = c.createDiv("fch-shop-pedestal");
		ped.createDiv({ cls: "fch-shop-ic", text: it.icon });
		c.createDiv({ cls: "fch-shop-rar", text: `${r.stars} ${r.label}` });
		c.createDiv({ cls: "fch-shop-name", text: it.name + (lv > 1 ? ` +${lv - 1}` : "") });
		c.createDiv({ cls: "fch-shop-desc", text: it.desc });
		const chips = c.createDiv("fch-shop-stats");
		if (it.slot === "potion") chips.createSpan({ cls: "fch-shop-chip", text: `🎒 di tas: ${bagCount(p, it.id)}` });
		for (const s of statLine(itemStats(it, Math.max(1, lv)))) chips.createSpan({ cls: "fch-shop-chip", text: s });
		// bandingkan dengan yang sedang dipakai
		if (it.slot !== "potion" && !equipped) {
			const cur = heroStats(p), alt = heroStats(p, { [it.slot]: it.id } as Partial<HeroState["equip"]>);
			const d = alt.power - cur.power;
			c.createDiv({ cls: "fch-shop-delta " + (d > 0 ? "is-up" : d < 0 ? "is-down" : ""), text: d > 0 ? `▲ +${d} kekuatan` : d < 0 ? `▼ ${d} kekuatan` : "＝ setara" });
		}
		const act = c.createDiv("fch-shop-act");
		if (it.slot === "potion") {
			const full = bagCount(p, it.id) >= BAG_MAX;
			btn(act, { text: full ? "Tas penuh" : `🪙 ${priceOf(it)}`, cls: "fch-btn-primary fch-btn-sm", disabled: full || coins < priceOf(it), onClick: () => new BuyModal(hub.app, p, it, () => hub.renderPage()).open() });
		} else if (!lv) {
			btn(act, { text: coins < priceOf(it) ? `🔒 🪙 ${priceOf(it)}` : `Beli · 🪙 ${priceOf(it)}`, cls: "fch-btn-primary fch-btn-sm", disabled: coins < priceOf(it), onClick: () => new BuyModal(hub.app, p, it, () => hub.renderPage()).open() });
		} else {
			if (equipped) act.createSpan({ cls: "fch-shop-eq", text: "✓ Dipakai" });
			else btn(act, { text: "Pakai", cls: "fch-btn-sm", onClick: () => { h.equip[it.slot as "weapon"] = it.id; p.requestSave(); play("click"); hub.renderPage(); } });
			if (lv < MAX_LV) {
				const cost = upgradeCost(it, lv);
				btn(act, { text: `Tempa +${lv} · 🪙 ${cost}`, icon: "hammer", cls: "fch-btn-sm", disabled: coins < cost, onClick: () => {
					if (!pay(p, cost)) return;
					h.owned[it.id] = lv + 1;
					p.requestSave();
					play("achievement");
					new Notice(`🔨 ${it.name} ditempa menjadi +${lv}!`);
					hub.renderPage();
				} });
			} else act.createSpan({ cls: "fch-shop-eq", text: "⭐ Level maks" });
			if (equipped && it.slot === "acc") btn(act, { text: "Lepas", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { h.equip.acc = ""; p.requestSave(); hub.renderPage(); } });
		}
	}
	el.createDiv({ cls: "fch-muted fch-small fch-mt", text: "Koin didapat dari belajar kartu, boss, dungeon, peti harian, dan misi. Perlengkapan dipakai otomatis di Aula Boss & Dungeon; ramuan dipakai dari tas selama bertarung. Tempa senjata (+5% serangan/level), zirah (+3% tangkis/level), atau aksesori (+5% koin/level) hingga level maksimal." });
}

function renderHero(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const h = H(p);
	const st = heroStats(p);
	const lv = p.level();
	const sheet = el.createDiv("fch-hero-sheet");
	// kiri: figur + slot
	const stage = sheet.createDiv("fch-hero-stage");
	const slots = (side: "l" | "r", ids: ("weapon" | "armor" | "acc")[]) => {
		const col = stage.createDiv("fch-hero-slots " + side);
		for (const s of ids) {
			const it = item(h.equip[s]);
			const b = col.createEl("button", { cls: "fch-hero-slot" + (it ? ` r-${it.rarity}` : "") });
			if (it) b.style.setProperty("--rc", RAR[it.rarity].color);
			b.createDiv({ cls: "fch-hero-slot-ic", text: it?.icon ?? "＋" });
			b.createDiv({ cls: "fch-hero-slot-l", text: s === "weapon" ? "Senjata" : s === "armor" ? "Zirah" : "Aksesori" });
			b.setAttr("aria-label", it ? `${it.name}${(h.owned[it.id] ?? 1) > 1 ? " +" + ((h.owned[it.id] ?? 1) - 1) : ""}` : "Kosong");
			b.onclick = () => { tab = s; hub.renderPage(); };
		}
	};
	slots("l", ["weapon", "armor"]);
	const mid = stage.createDiv("fch-hero-mid");
	heroFigure(p, mid, 11);
	mid.createDiv({ cls: "fch-hero-name", text: `Petualang Lv ${lv.level}` });
	mid.createDiv({ cls: "fch-small fch-muted", text: lv.title });
	slots("r", ["acc"]);
	// kanan: statistik
	const panel = sheet.createDiv("fch-hero-panel");
	panel.createDiv({ cls: "fch-hero-power", text: `⚡ ${st.power}` });
	panel.createDiv({ cls: "fch-small fch-muted", text: "Kekuatan total" });
	const bars: [string, number, number, string][] = [
		["⚔️ Serangan", st.atk, 1, `+${Math.round(st.atk * 100)}%`],
		["🎯 Kritis", st.crit, 0.6, `${Math.round(st.crit * 100)}%`],
		["❤️ Hati tambahan", st.hp, 3, `+${st.hp}`],
		["🛡️ Tangkis", st.block, 0.6, `${Math.round(st.block * 100)}%`],
		["🪙 Bonus koin", st.coin, 0.6, `+${Math.round(st.coin * 100)}%`],
	];
	for (const [l2, v, mx, txt] of bars) {
		const r = panel.createDiv("fch-hero-stat");
		r.createSpan({ cls: "fch-small fch-strong", text: l2 });
		r.createDiv("fch-hero-bar").createDiv().style.width = `${Math.min(100, (v / mx) * 100)}%`;
		r.createSpan({ cls: "fch-small", text: txt });
	}
	if (st.time) panel.createDiv({ cls: "fch-small", text: `⏱️ +${st.time} detik waktu menjawab` });
	if (st.comboNeed < 5) panel.createDiv({ cls: "fch-small", text: `⚡ Pamungkas siap di combo ${st.comboNeed}` });
	// tas
	const bag = el.createDiv("fch-panel fch-mt");
	const bh = bag.createDiv("fch-section-head");
	bh.createEl("h3", { text: "🎒 Tas ramuan" });
	btn(bh, { text: "Beli ramuan", cls: "fch-btn-link", onClick: () => { tab = "potion"; hub.renderPage(); } });
	const grid = bag.createDiv("fch-bag-grid");
	for (const it of ITEMS.filter((x) => x.slot === "potion")) {
		const n = bagCount(p, it.id);
		const c = grid.createDiv("fch-bag-slot" + (n ? "" : " is-empty"));
		c.style.setProperty("--rc", RAR[it.rarity].color);
		c.createDiv({ cls: "fch-bag-ic", text: it.icon });
		c.createDiv({ cls: "fch-bag-n", text: `×${n}` });
		c.setAttr("aria-label", `${it.name}: ${it.desc}`);
	}
	const owned = ITEMS.filter((x) => x.slot !== "potion" && h.owned[x.id]);
	const inv = el.createDiv("fch-panel fch-mt");
	inv.createEl("h3", { text: `🗃️ Koleksi perlengkapan (${owned.length}/${ITEMS.filter((x) => x.slot !== "potion").length})` });
	const ig = inv.createDiv("fch-bag-grid");
	for (const it of owned) {
		const eq = h.equip[it.slot as "weapon"] === it.id;
		const c = ig.createEl("button", { cls: "fch-bag-slot" + (eq ? " is-eq" : "") });
		c.style.setProperty("--rc", RAR[it.rarity].color);
		c.createDiv({ cls: "fch-bag-ic", text: it.icon });
		c.createDiv({ cls: "fch-bag-n", text: eq ? "✓" : `+${(h.owned[it.id] ?? 1) - 1}` });
		c.setAttr("aria-label", `${it.name}${eq ? " (dipakai)" : " · klik untuk memakai"}`);
		c.onclick = () => { h.equip[it.slot as "weapon"] = it.id; p.requestSave(); play("click"); hub.renderPage(); };
	}
	const how = el.createDiv("fch-panel fch-mt fch-b2-how");
	how.createEl("h3", { text: "📖 Cara kerja perlengkapan" });
	for (const t of [
		"⚔️ Senjata menambah kerusakan ke boss dan peluang kritis (×1,5). Di dungeon, serangan kritis memberi kerusakan ganda ke monster.",
		"🛡️ Zirah menambah hati di awal pertarungan dan peluang menangkis jawaban salah, sehingga hati tidak berkurang (combo tetap putus).",
		"💍 Aksesori memberi bonus koin, waktu menjawab, atau mempercepat Serangan Pamungkas.",
		"🧪 Ramuan dipakai dari bilah tas saat bertarung di Aula Boss atau Dungeon. Bulu Phoenix aktif otomatis saat hatimu habis.",
		"🧠 Kemenangan tetap bergantung pada jawabanmu: perlengkapan hanya membantu, tidak menjawab soal untukmu.",
	]) how.createDiv({ cls: "fch-small", text: t });
}

// ================================================================ bilah tas di pertarungan
export interface BagCtx { usable: (id: string) => boolean; use: (id: string) => void }
export function bagBar(p: FlashcardPlugin, parent: HTMLElement, ctx: BagCtx) {
	const bar = parent.createDiv("fch-bagbar");
	const ids = ITEMS.filter((x) => x.slot === "potion" && x.id !== "phoenix" && bagCount(p, x.id) > 0);
	if (!ids.length && !bagCount(p, "phoenix")) { bar.createSpan({ cls: "fch-small fch-muted", text: "🎒 Tas kosong · beli ramuan di Toko" }); return bar; }
	for (const it of ids) {
		const ok = ctx.usable(it.id);
		const b = bar.createEl("button", { cls: "fch-bagbtn" + (ok ? "" : " is-off") });
		b.createSpan({ text: it.icon });
		b.createSpan({ cls: "fch-bagbtn-n", text: String(bagCount(p, it.id)) });
		b.setAttr("aria-label", `${it.name}: ${it.desc}`);
		b.disabled = !ok;
		b.onclick = () => { if (ctx.usable(it.id) && usePotion(p, it.id)) { play("chime"); ctx.use(it.id); } };
	}
	if (bagCount(p, "phoenix")) bar.createSpan({ cls: "fch-bagbtn is-passive", text: `🪶 ${bagCount(p, "phoenix")}`, attr: { "aria-label": "Bulu Phoenix: aktif otomatis saat hati habis" } });
	return bar;
}

/** Strip perlengkapan: figur pahlawan, kekuatan, & isi tas, dengan tombol ke Toko. */
export function gearStrip(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const st = heroStats(p);
	const h = p.data.hero;
	const box = el.createDiv("fch-gearstrip");
	heroFigure(p, box.createDiv("fch-gearstrip-fig"), 4);
	const t = box.createDiv("fch-grow");
	t.createDiv({ cls: "fch-strong", text: `⚡ Kekuatan ${st.power}` });
	t.createDiv({ cls: "fch-small fch-muted", text: [item(h.equip.weapon)?.name, item(h.equip.armor)?.name, item(h.equip.acc)?.name].filter(Boolean).join(" · ") });
	const chips = t.createDiv("fch-shop-stats");
	if (st.atk) chips.createSpan({ cls: "fch-shop-chip", text: `⚔️ +${Math.round(st.atk * 100)}%` });
	if (st.crit) chips.createSpan({ cls: "fch-shop-chip", text: `🎯 ${Math.round(st.crit * 100)}%` });
	if (st.hp) chips.createSpan({ cls: "fch-shop-chip", text: `❤️ +${st.hp}` });
	if (st.block) chips.createSpan({ cls: "fch-shop-chip", text: `🛡️ ${Math.round(st.block * 100)}%` });
	const bag = Object.entries(h.bag).filter(([, n]) => n > 0).map(([id, n]) => `${item(id)?.icon ?? ""}${n}`).join(" ");
	chips.createSpan({ cls: "fch-shop-chip", text: bag ? `🎒 ${bag}` : "🎒 tas kosong" });
	btn(box, { text: `Toko · 🪙 ${(p.data.meta.coins ?? 0).toLocaleString("id-ID")}`, icon: "store", cls: "fch-btn-sm", onClick: () => hub.navigate("shop") });
}
