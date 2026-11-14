import { Notice } from "obsidian";
import { gunzipSync, strFromU8 } from "fflate";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { IbadahState, MutaItem } from "./types";
import { DZIKIR_PAGI_PETANG, DZIKIR_UMUM, HADEETH_FIELDS, HADEETH_GZ, HADEETH_INFO, HADEETH_VERSION, HADEETH_VOCAL_GZ } from "./ibadah-data";
import { CITIES, City, PRAYER_NAMES, PrayerName, hm, prayerAt, prayerTimes } from "./prayer";
import { addDays, dayKey, startOfDay } from "./scheduler";
import { todayRead } from "./quran";
import { btn, confetti } from "./util";
import { play } from "./sound";

// ================================================================ data hadits (HadeethEnc)
export interface Hadeeth { id: number; title_ar: string; title: string; hadith_text_ar: string; hadith_text: string; explanation: string; benefits: string; grade: string; takhrij: string; link: string }
let H: Record<string, Hadeeth> | null = null;
export function hadeeth(id: number): Hadeeth {
	if (!H) {
		const bin = atob(HADEETH_GZ);
		const u8 = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
		const raw = JSON.parse(strFromU8(gunzipSync(u8))) as Record<string, unknown[]>;
		H = {};
		for (const [k, row] of Object.entries(raw)) H[k] = Object.fromEntries(HADEETH_FIELDS.map((f, i) => [f, row[i]])) as unknown as Hadeeth;
	}
	return H[String(id)];
}
let V: Record<string, [string, string[], number]> | null = null;
/** Teks Arab yang ditampilkan: versi berharakat (bila ada) atau teks asli HadeethEnc. */
export function arText(h: Hadeeth): { text: string; vocal: boolean; books: string[] } {
	if (!V) {
		const bin = atob(HADEETH_VOCAL_GZ);
		const u8 = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
		V = JSON.parse(strFromU8(gunzipSync(u8)));
	}
	const v = V![String(h.id)];
	return v ? { text: v[0], vocal: true, books: v[1] } : { text: h.hadith_text_ar, vocal: false, books: [] };
}
const showOrig = new Set<number>();
/** Kotak teks Arab bergaya mushaf + keterangan sumber harakat + tombol teks asli. */
export function arabicBlock(parent: HTMLElement, h: Hadeeth, extra = "") {
	const a = arText(h);
	const orig = showOrig.has(h.id);
	const box = parent.createDiv("fch-arbox" + (extra ? " " + extra : ""));
	box.createDiv({ cls: "fch-q-ar fch-h-ar", text: orig || !a.vocal ? h.hadith_text_ar : a.text, attr: { dir: "rtl", lang: "ar" } });
	if (a.vocal) {
		const meta = box.createDiv("fch-arbox-meta");
		meta.createSpan({ text: orig ? "Teks asli HadeethEnc" : `Harakat: ${a.books.join(", ")} · Open Hadith Data` });
		const t = meta.createEl("button", { cls: "fch-arbox-tg", text: orig ? "Tampilkan berharakat" : "Teks asli" });
		t.onclick = (e) => {
			e.stopPropagation();
			if (orig) showOrig.delete(h.id); else showOrig.add(h.id);
			const holder = document.createElement("div");
			const fresh = arabicBlock(holder, h, extra);
			box.replaceWith(fresh);
		};
	}
	return box;
}

/** Spanduk kepala halaman Ibadah: pola geometri, tanggal Hijriah, & hitung mundur sholat. */
export function decorateHero(p: FlashcardPlugin, head: HTMLElement, accent = "#10b981") {
	head.addClass("fch-ihero");
	head.style.setProperty("--ia", accent);
	head.createDiv("fch-ihero-pattern");
	const chips = head.createDiv("fch-ihero-chips");
	chips.createSpan({ cls: "fch-ihero-chip", text: `🌙 ${hijri(p).text}` });
	const np = nextPrayer(p);
	const c = chips.createSpan({ cls: "fch-ihero-chip", text: `🕌 ${np.name} · ${countdown(np.at - Date.now())}` });
	const tm = window.setInterval(() => { if (!c.isConnected) return window.clearInterval(tm); const n2 = nextPrayer(p); c.setText(`🕌 ${n2.name} · ${countdown(n2.at - Date.now())}`); }, 1000);
}

export const SOURCE_LINE = `Sumber: HadeethEnc.com — Ensiklopedia Hadits Terjemahan (bahasa Indonesia v${HADEETH_VERSION}). Teks ditampilkan apa adanya.`;
export { HADEETH_INFO };

// ================================================================ waktu: Hijriah & sholat
const I = (p: FlashcardPlugin): IbadahState => p.data.ibadah;

export function hijri(p: FlashcardPlugin, t = Date.now()): { d: number; m: number; y: number; text: string; month: string } {
	const at = new Date(addDays(startOfDay(t), I(p).hijriOffset) + 12 * 3600_000);
	try {
		const fmt = new Intl.DateTimeFormat("id-ID-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric" });
		const parts = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]));
		const d = parseInt(parts.day, 10), m = parseInt(parts.month, 10), y = parseInt(parts.year, 10);
		const month = HMONTHS[m - 1];
		return { d, m, y, month, text: `${d} ${month} ${y} H` };
	} catch {
		return { d: 0, m: 0, y: 0, month: "", text: "" };
	}
}
export const HMONTHS = ["Muharram", "Safar", "Rabiul Awal", "Rabiul Akhir", "Jumadil Awal", "Jumadil Akhir", "Rajab", "Syakban", "Ramadan", "Syawal", "Zulkaidah", "Zulhijah"];

export function city(p: FlashcardPlugin): City {
	const i = I(p);
	if (i.city === "__custom" && i.customCity) return i.customCity;
	return CITIES.find((c) => c.name === i.city) ?? CITIES[0];
}
/** Waktu sholat berikutnya dari sekarang. */
export function nextPrayer(p: FlashcardPlugin): { name: PrayerName; at: number } {
	const c = city(p), adj = I(p).adj;
	const now = Date.now();
	for (const off of [0, 1]) {
		const d = new Date(addDays(startOfDay(now), off));
		for (const n of ["Subuh", "Dzuhur", "Ashar", "Maghrib", "Isya"] as PrayerName[]) {
			const at = prayerAt(d, c, n, adj);
			if (at > now) return { name: n, at };
		}
	}
	return { name: "Subuh", at: now };
}
export const countdown = (ms: number) => {
	const s = Math.max(0, Math.round(ms / 1000));
	const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
	return `${h ? h + ":" : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(x).padStart(2, "0")}`;
};

/** Pengaturan lokasi & koreksi menit (dipakai Mutaba'ah, Ramadan, status bar). */
export function renderLocation(hub: HubView, parent: HTMLElement) {
	const p = hub.plugin;
	const i = I(p);
	const box = parent.createDiv("fch-panel fch-mt");
	box.createEl("h3", { text: "📍 Lokasi & jadwal sholat" });
	box.createDiv({ cls: "fch-muted fch-small fch-desc", text: "Dihitung tanpa internet dengan parameter Kemenag RI (Subuh 20°, Isya 18°, Ashar Syafi'i, ihtiyath 2 menit, Imsak = Subuh − 10 menit). Hasil bisa berbeda 1–3 menit dari jadwal resmi; cocokkan dengan jadwal Kemenag atau masjid setempat, lalu atur koreksinya." });
	const r = box.createDiv("fch-row");
	const sel = r.createEl("select", { cls: "dropdown fch-select" });
	CITIES.forEach((c) => sel.createEl("option", { text: c.name, attr: { value: c.name } }));
	sel.createEl("option", { text: "Koordinat sendiri…", attr: { value: "__custom" } });
	sel.value = i.city;
	sel.onchange = () => { i.city = sel.value; if (sel.value === "__custom" && !i.customCity) i.customCity = { name: "Lokasiku", lat: -6.2, lng: 106.8, tz: 7 }; p.requestSave(); hub.renderPage(); };
	const ho = r.createEl("select", { cls: "dropdown fch-select", attr: { "aria-label": "Koreksi tanggal Hijriah" } });
	[-2, -1, 0, 1, 2].forEach((v) => ho.createEl("option", { text: `Hijriah ${v > 0 ? "+" : ""}${v} hari`, attr: { value: String(v) } }));
	ho.value = String(i.hijriOffset);
	ho.onchange = () => { i.hijriOffset = parseInt(ho.value, 10); p.requestSave(); hub.renderPage(); };
	r.createSpan({ cls: "fch-muted fch-small", text: hijri(p).text });
	if (i.city === "__custom" && i.customCity) {
		const cc = i.customCity;
		const g = box.createDiv("fch-task-grid fch-mt");
		const f = (label: string, key: "lat" | "lng" | "tz") => {
			const x = g.createDiv("fch-field");
			x.createEl("label", { text: label });
			const inp = x.createEl("input", { type: "number", cls: "fch-input", attr: { step: key === "tz" ? "1" : "0.0001" } });
			inp.value = String(cc[key]);
			inp.onchange = () => { cc[key] = parseFloat(inp.value) || 0; p.requestSave(); hub.renderPage(); };
		};
		f("Lintang (−6.2 = LS)", "lat");
		f("Bujur (106.8)", "lng");
		f("Zona waktu (WIB 7, WITA 8, WIT 9)", "tz");
	}
	const t = prayerTimes(new Date(), city(p), i.adj);
	const tb = box.createDiv("fch-prayer-grid fch-mt");
	PRAYER_NAMES.forEach((n, k) => {
		const c = tb.createDiv("fch-prayer-cell");
		c.createDiv({ cls: "fch-small fch-muted", text: n });
		c.createDiv({ cls: "fch-prayer-time", text: hm(t[n]) });
		const a = c.createDiv("fch-row fch-center");
		const lab = a.createSpan({ cls: "fch-small", text: i.adj[k] ? `${i.adj[k] > 0 ? "+" : ""}${i.adj[k]}m` : "±0" });
		const ch = (d: number) => { i.adj[k] = (i.adj[k] ?? 0) + d; p.requestSave(); hub.renderPage(); };
		btn(a, { text: "−", cls: "fch-btn-ghost fch-btn-sm", label: "Kurangi 1 menit", onClick: () => ch(-1) });
		a.appendChild(lab);
		btn(a, { text: "+", cls: "fch-btn-ghost fch-btn-sm", label: "Tambah 1 menit", onClick: () => ch(1) });
	});
}

// ================================================================ Mutaba'ah Yaumiyah
export const DEFAULT_ITEMS: MutaItem[] = [
	{ id: "subuh", label: "Subuh", icon: "🌅", kind: "prayer", on: true },
	{ id: "dzuhur", label: "Dzuhur", icon: "☀️", kind: "prayer", on: true },
	{ id: "ashar", label: "Ashar", icon: "🌤️", kind: "prayer", on: true },
	{ id: "maghrib", label: "Maghrib", icon: "🌇", kind: "prayer", on: true },
	{ id: "isya", label: "Isya", icon: "🌙", kind: "prayer", on: true },
	{ id: "tahajud", label: "Tahajud", icon: "🌌", kind: "check", on: true },
	{ id: "dhuha", label: "Dhuha", icon: "🌞", kind: "check", on: true },
	{ id: "rawatib", label: "Rawatib (rakaat)", icon: "🕌", kind: "count", max: 12, on: true },
	{ id: "witir", label: "Witir", icon: "✨", kind: "check", on: true },
	{ id: "puasa", label: "Puasa sunnah", icon: "🍽️", kind: "check", on: true },
	{ id: "dzikirpagi", label: "Dzikir pagi", icon: "🌄", kind: "check", on: true },
	{ id: "dzikirpetang", label: "Dzikir petang", icon: "🌆", kind: "check", on: true },
	{ id: "tilawah", label: "Tilawah (halaman)", icon: "📖", kind: "count", max: 40, on: true },
	{ id: "sedekah", label: "Sedekah", icon: "💝", kind: "check", on: true },
];
export function items(p: FlashcardPlugin): MutaItem[] {
	const i = I(p);
	const saved = i.items.filter((x) => x.custom || DEFAULT_ITEMS.some((d) => d.id === x.id));
	for (const d of DEFAULT_ITEMS) if (!saved.some((x) => x.id === d.id)) saved.push({ ...d });
	return saved;
}
const PRAYER_STATE = ["○ belum", "✓ sholat", "⏰ tepat waktu", "👥 berjamaah"];

/** Nilai item pada hari k (beberapa terisi otomatis dari fitur lain). */
export function mval(p: FlashcardPlugin, k: string, id: string): number {
	const i = I(p);
	const v = i.muta[k]?.[id] ?? 0;
	if (id === "tilawah") return Math.max(v, Math.floor(p.data.quran.read[k]?.pages ?? 0));
	if (id === "dzikirpagi") return Math.max(v, i.dzikir[k]?.pagi ? 1 : 0);
	if (id === "dzikirpetang") return Math.max(v, i.dzikir[k]?.petang ? 1 : 0);
	if (id === "puasa") return Math.max(v, i.ramadan.fast[k] === 1 ? 1 : 0);
	return v;
}
/** Skor harian 0–1. Sholat wajib berbobot lebih besar. */
export function mscore(p: FlashcardPlugin, k: string): number {
	let got = 0, max = 0;
	for (const it of items(p).filter((x) => x.on)) {
		const v = mval(p, k, it.id);
		if (it.kind === "prayer") { max += 3; got += v; }
		else if (it.kind === "count") { max += 1; got += v > 0 ? 1 : 0; }
		else { max += 1; got += v ? 1 : 0; }
	}
	return max ? got / max : 0;
}
export function mstreak(p: FlashcardPlugin, id: string): number {
	let n = 0, t = startOfDay(Date.now());
	if (!mval(p, dayKey(t), id)) t = addDays(t, -1);
	while (mval(p, dayKey(t), id)) { n++; t = addDays(t, -1); }
	return n;
}
function setVal(p: FlashcardPlugin, k: string, id: string, v: number) {
	const i = I(p);
	i.muta[k] = { ...(i.muta[k] ?? {}), [id]: v };
	if (v) p.track("muta");
	p.requestSave();
	p.checkAchievements();
}

let mDay = 0;

export function renderMutabaah(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const i = I(p);
	const day = addDays(startOfDay(Date.now()), mDay);
	const k = dayKey(day);
	const head = el.createDiv("fch-pagehead fch-pagehead-row");
	decorateHero(p, head, "#059669");
	const ht = head.createDiv();
	ht.createEl("h1", { text: "🕌 Mutaba'ah Yaumiyah" });
	ht.createDiv({ cls: "fch-muted", text: `${new Date(day).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })} · ${hijri(p, day).text}` });
	const nav = head.createDiv("fch-row");
	btn(nav, { icon: "chevron-left", cls: "fch-btn-ghost fch-btn-sm", label: "Hari sebelumnya", onClick: () => { mDay--; hub.renderPage(); } });
	btn(nav, { icon: "chevron-right", cls: "fch-btn-ghost fch-btn-sm", label: "Hari berikutnya", disabled: mDay >= 0, onClick: () => { mDay++; hub.renderPage(); } });
	if (mDay) btn(nav, { text: "Hari ini", cls: "fch-btn-sm", onClick: () => { mDay = 0; hub.renderPage(); } });

	// jadwal & sholat berikutnya
	if (mDay === 0 && false) {
		const np = nextPrayer(p);
		const bar = el.createDiv("fch-banner");
		const cd = bar.createSpan({ text: `🕌 ${np.name} pukul ${new Date(np.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · ${countdown(np.at - Date.now())} lagi (${city(p).name})` });
		const tm = window.setInterval(() => { if (!cd.isConnected) return window.clearInterval(tm); const n2 = nextPrayer(p); cd.setText(`🕌 ${n2.name} pukul ${new Date(n2.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · ${countdown(n2.at - Date.now())} lagi (${city(p).name})`); }, 1000);
	}

	const sc = mscore(p, k);
	const hero = el.createDiv("fch-panel fch-muta-hero");
	hero.createDiv({ cls: "fch-mini-v", text: `${Math.round(sc * 100)}%` });
	hero.createDiv({ cls: "fch-muted fch-small", text: "skor ibadah hari ini" });
	hero.createDiv("fch-bar fch-mt").createDiv("fch-bar-fill").style.width = `${sc * 100}%`;

	const list = el.createDiv("fch-panel fch-mt fch-muta");
	const its = items(p).filter((x) => x.on);
	const sections: [string, (x: MutaItem) => boolean][] = [["Sholat wajib", (x) => x.kind === "prayer"], ["Sunnah & amalan", (x) => x.kind !== "prayer"]];
	const pt = prayerTimes(new Date(day), city(p), i.adj);
	for (const [title, f] of sections) {
		list.createDiv({ cls: "fch-agenda-title fch-mt", text: title });
		if (title === "Sholat wajib") {
			const grid = list.createDiv("fch-pcards");
			for (const it of its.filter(f)) {
				const v = mval(p, k, it.id);
				const name = it.label as PrayerName;
				const c = grid.createDiv("fch-pcard2 s" + v);
				c.createDiv({ cls: "fch-pcard2-ic", text: it.icon });
				c.createDiv({ cls: "fch-pcard2-name", text: it.label });
				c.createDiv({ cls: "fch-pcard2-time", text: pt[name] !== undefined ? hm(pt[name]) : "" });
				c.createDiv({ cls: "fch-pcard2-state", text: PRAYER_STATE[v] });
				const st = mstreak(p, it.id);
				if (st > 1) c.createDiv({ cls: "fch-pcard2-streak", text: `🔥 ${st}` });
				const seg = c.createDiv("fch-pcard2-btns");
				["○", "✓", "⏰", "👥"].forEach((sym, n) => {
					const b2 = seg.createEl("button", { cls: "fch-pcard2-b" + (v === n ? " is-active" : ""), text: sym, attr: { "aria-label": PRAYER_STATE[n] } });
					b2.onclick = () => { setVal(p, k, it.id, n); if (n) play("correct"); hub.renderPage(); };
				});
			}
			continue;
		}
		for (const it of its.filter(f)) {
			const v = mval(p, k, it.id);
			const r = list.createDiv("fch-muta-row" + (v ? " is-on" : ""));
			r.createSpan({ cls: "fch-muta-ic", text: it.icon });
			const t = r.createDiv("fch-grow");
			t.createDiv({ cls: "fch-strong", text: it.label });
			const st = mstreak(p, it.id);
			if (st > 1) t.createDiv({ cls: "fch-muted fch-small", text: `🔥 ${st} hari beruntun` });
			if (it.kind === "prayer") {
				const seg = r.createDiv("fch-seg");
				PRAYER_STATE.forEach((label, n) => {
					const b = seg.createEl("button", { cls: "fch-seg-btn" + (v === n ? " is-active" : ""), text: label });
					b.onclick = () => { setVal(p, k, it.id, n); if (n) play("correct"); hub.renderPage(); };
				});
			} else if (it.kind === "count") {
				const auto = it.id === "tilawah";
				const c = r.createDiv("fch-row");
				btn(c, { text: "−", cls: "fch-btn-sm", disabled: v <= 0 || auto, onClick: () => { setVal(p, k, it.id, Math.max(0, v - (it.id === "rawatib" ? 2 : 1))); hub.renderPage(); } });
				c.createSpan({ cls: "fch-muta-n", text: String(v) });
				btn(c, { text: "+", cls: "fch-btn-sm", disabled: auto, onClick: () => { setVal(p, k, it.id, Math.min(it.max ?? 99, v + (it.id === "rawatib" ? 2 : 1))); play("click"); hub.renderPage(); } });
				if (auto) c.createSpan({ cls: "fch-muted fch-small", text: "otomatis dari Al-Qur'an" });
			} else {
				const b = r.createEl("button", { cls: "fch-habit-check" + (v ? " is-on" : ""), text: v ? "✓" : "", attr: { "aria-label": v ? "Batalkan" : "Tandai" } });
				b.onclick = () => { setVal(p, k, it.id, v ? 0 : 1); if (!v) play("correct"); hub.renderPage(); };
				if (it.id === "puasa") {
					const dow = new Date(day).getDay(), hd = hijri(p, day).d;
					const hint = dow === 1 || dow === 4 ? "Senin/Kamis" : [13, 14, 15].includes(hd) ? "Ayyamul Bidh" : "";
					if (hint) t.createDiv({ cls: "fch-small", text: `💡 Hari ini ${hint}` });
				}
				if (it.id.startsWith("dzikir") && !v) btn(r, { text: "Buka dzikir", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { dzTab = it.id === "dzikirpagi" ? "pagi" : "petang"; hub.navigate("dzikir"); } });
			}
		}
	}
	if (mscore(p, k) === 1 && mDay === 0 && p.data.settings.confetti) { confetti(hub.mainEl); }

	// grafik 14 hari
	const ch = el.createDiv("fch-panel fch-mt");
	ch.createEl("h3", { text: "Grafik 14 hari" });
	const bars = ch.createDiv("fch-muta-bars");
	for (let d = 13; d >= 0; d--) {
		const t = addDays(startOfDay(Date.now()), -d), kk = dayKey(t);
		const s = mscore(p, kk);
		const b = bars.createDiv("fch-muta-bar" + (d === 0 ? " is-today" : ""));
		b.createDiv("fch-muta-fill").style.height = `${Math.max(2, s * 100)}%`;
		b.createDiv({ cls: "fch-small fch-muted", text: new Date(t).toLocaleDateString("id-ID", { weekday: "narrow" }) });
		b.setAttr("aria-label", `${new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}: ${Math.round(s * 100)}%`);
	}
	// grid 28 hari per item
	const gr = el.createDiv("fch-panel fch-mt");
	gr.createEl("h3", { text: "Grid 28 hari" });
	const g = gr.createDiv("fch-muta-grid");
	for (const it of its) {
		const row = g.createDiv("fch-muta-grow");
		row.createSpan({ cls: "fch-small fch-muta-glabel", text: `${it.icon} ${it.label}` });
		const cells = row.createDiv("fch-habit-grid");
		for (let d = 27; d >= 0; d--) {
			const kk = dayKey(addDays(startOfDay(Date.now()), -d));
			const v = mval(p, kk, it.id);
			const c = cells.createDiv("fch-muta-cell" + (v ? " is-on" : "") + (it.kind === "prayer" && v === 3 ? " is-best" : ""));
			c.setAttr("aria-label", `${kk}: ${it.kind === "prayer" ? PRAYER_STATE[v] : v}`);
		}
	}
	// kelola item
	const cf = el.createDiv("fch-panel fch-mt");
	cf.createEl("h3", { text: "⚙ Kelola amalan" });
	const tg = cf.createDiv("fch-chips");
	for (const it of items(p)) {
		const c = tg.createEl("button", { cls: "fch-chip" + (it.on ? " is-active" : ""), text: `${it.icon} ${it.label}` });
		c.onclick = () => { const all = items(p); const x = all.find((y) => y.id === it.id)!; x.on = !x.on; i.items = all; p.requestSave(); hub.renderPage(); };
	}
	const add = cf.createDiv("fch-row fch-mt");
	const inp = add.createEl("input", { type: "text", cls: "fch-input fch-grow", attr: { placeholder: "Amalan sendiri, mis. Kajian, Membaca buku Islami, Birrul walidain" } });
	const addIt = () => {
		if (!inp.value.trim()) return;
		const all = items(p);
		all.push({ id: "c" + Date.now().toString(36), label: inp.value.trim(), icon: "⭐", kind: "check", on: true, custom: true });
		i.items = all;
		p.requestSave();
		hub.renderPage();
	};
	inp.onkeydown = (e) => { if (e.key === "Enter") addIt(); };
	btn(add, { text: "Tambah", icon: "plus", onClick: addIt });
	renderLocation(hub, el);
}

// ================================================================ Dzikir pagi-petang & tasbih
/** Jumlah ulangan yang disebut di dalam masing-masing hadits (bantuan penghitung, bukan bagian teks). */
const REPEAT: Record<number, number> = { 6082: 3, 6093: 3, 5508: 3 };
export let dzTab: "pagi" | "petang" | "umum" | "tasbih" = "pagi";
const counts: Record<number, number> = {};
const PHRASES: [string, string][] = [
	["سُبْحَانَ اللَّهِ", "Subḥānallāh — Mahasuci Allah"],
	["الْحَمْدُ لِلَّهِ", "Alḥamdulillāh — Segala puji bagi Allah"],
	["اللَّهُ أَكْبَرُ", "Allāhu akbar — Allah Mahabesar"],
	["لَا إِلَٰهَ إِلَّا اللَّهُ", "Lā ilāha illallāh — Tiada tuhan yang berhak disembah selain Allah"],
	["أَسْتَغْفِرُ اللَّهَ", "Astagfirullāh — Aku memohon ampun kepada Allah"],
	["سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", "Subḥānallāhi wa biḥamdih — Mahasuci Allah dan dengan memuji-Nya"],
];
let phrase = 0;
let tcount = 0;
let ttarget = 33;
let afterSalat = false;

export function renderDzikir(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const i = I(p);
	const k = dayKey(Date.now());
	const head = el.createDiv("fch-pagehead");
	decorateHero(p, head, "#0d9488");
	head.createEl("h1", { text: "📿 Dzikir & Tasbih" });
	head.createDiv({ cls: "fch-muted", text: "Dzikir pagi-petang dari hadits sahih/hasan beserta terjemahannya, dan tasbih digital dengan penghitung." });
	const tabs = el.createDiv("fch-tabs");
	const T: [typeof dzTab, string][] = [["pagi", `🌄 Pagi${i.dzikir[k]?.pagi ? " ✓" : ""}`], ["petang", `🌆 Petang${i.dzikir[k]?.petang ? " ✓" : ""}`], ["umum", "Zikir umum"], ["tasbih", "📿 Tasbih"]];
	for (const [id, l] of T) { const b = tabs.createEl("button", { cls: "fch-tab" + (dzTab === id ? " is-active" : ""), text: l }); b.onclick = () => { dzTab = id; hub.renderPage(); }; }

	if (dzTab === "tasbih") return renderTasbih(hub, el);
	const ids = dzTab === "umum" ? DZIKIR_UMUM : DZIKIR_PAGI_PETANG;
	if (dzTab !== "umum") {
		const hr = new Date().getHours();
		el.createDiv({ cls: "fch-muted fch-small fch-desc", text: dzTab === "pagi" ? `Waktu dzikir pagi: setelah Subuh hingga matahari tinggi.${hr >= 12 ? " (Sekarang sudah siang.)" : ""}` : "Waktu dzikir petang: setelah Ashar hingga malam." });
	}
	if (dzTab !== "umum") {
		const doneN = ids.filter((id) => (counts[id] ?? 0) >= (REPEAT[id] ?? 1)).length;
		const pr = el.createDiv("fch-dz-prog");
		pr.createSpan({ cls: "fch-strong", text: `${doneN}/${ids.length} dzikir dibaca` });
		pr.createDiv("fch-bar fch-grow").createDiv("fch-bar-fill").style.width = `${(doneN / ids.length) * 100}%`;
	}
	const list = el.createDiv("fch-dz-list");
	for (const id of ids) {
		const h = hadeeth(id);
		if (!h) continue;
		const target = REPEAT[id] ?? 1;
		const card = list.createDiv("fch-panel fch-dz");
		card.createDiv({ cls: "fch-dz-title", text: h.title });
		arabicBlock(card, h);
		card.createDiv({ cls: "fch-h-tr", text: h.hadith_text });
		const meta = card.createDiv("fch-row");
		meta.createSpan({ cls: "fch-pill", text: h.grade });
		meta.createSpan({ cls: "fch-muted fch-small fch-grow", text: h.takhrij });
		if (dzTab !== "umum") {
			const n = counts[id] ?? 0;
			const c = meta.createEl("button", { cls: "fch-dz-count" + (n >= target ? " is-done" : ""), attr: { "aria-label": `Tandai dibaca (${n}/${target})` } });
			c.style.setProperty("--p", String(n / target));
			c.createSpan({ cls: "fch-dz-n", text: n >= target ? "✓" : `${n}/${target}` });
			c.createSpan({ cls: "fch-dz-l", text: n >= target ? "selesai" : "baca" });
			c.onclick = () => { counts[id] = Math.min(target, n + 1); play(counts[id] >= target ? "correct" : "click"); hub.renderPage(); };
		}
	}
	if (dzTab !== "umum") {
		const all = ids.every((id) => (counts[id] ?? 0) >= (REPEAT[id] ?? 1));
		const done = !!i.dzikir[k]?.[dzTab];
		const f = el.createDiv("fch-row fch-center fch-mt");
		btn(f, { text: done ? `✓ Dzikir ${dzTab} hari ini sudah dicatat` : `Selesai dzikir ${dzTab}`, icon: "check", cls: done ? "" : "fch-btn-primary fch-btn-lg", disabled: done, onClick: () => {
			if (!all && !window.confirm("Masih ada dzikir yang belum ditandai dibaca. Tetap catat selesai?")) return;
			i.dzikir[k] = { ...(i.dzikir[k] ?? {}), [dzTab]: true };
			p.track("dzikir");
			p.addCoins(5);
			p.requestSave();
			p.checkAchievements();
			play("achievement");
			new Notice(`🤲 Dzikir ${dzTab} tercatat di Mutaba'ah.`);
			for (const id of ids) delete counts[id];
			hub.renderPage();
		} });
	}
	el.createDiv({ cls: "fch-muted fch-small fch-mt fch-q-credit", text: SOURCE_LINE + " Penghitung jumlah bacaan hanyalah alat bantu; bacaan mengikuti teks hadits." });
}

function renderTasbih(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const i = I(p);
	const k = dayKey(Date.now());
	const top = el.createDiv("fch-row fch-center fch-mt");
	const ps = top.createEl("select", { cls: "dropdown fch-select" });
	PHRASES.forEach(([, l], n) => ps.createEl("option", { text: l.split(" — ")[0], attr: { value: String(n) } }));
	ps.value = String(phrase);
	ps.onchange = () => { phrase = parseInt(ps.value, 10); tcount = 0; afterSalat = false; hub.renderPage(); };
	const ts = top.createEl("select", { cls: "dropdown fch-select" });
	[33, 99, 100, 1000].forEach((v) => ts.createEl("option", { text: `target ${v}`, attr: { value: String(v) } }));
	ts.value = String(ttarget);
	ts.onchange = () => { ttarget = parseInt(ts.value, 10); hub.renderPage(); };
	btn(top, { text: afterSalat ? "Mode setelah salat ✓" : "Mode setelah salat (33-33-33)", cls: "fch-btn-sm" + (afterSalat ? " fch-btn-primary" : ""), onClick: () => { afterSalat = !afterSalat; phrase = 0; tcount = 0; ttarget = 33; hub.renderPage(); } });
	const [ar, tr] = PHRASES[phrase];
	const stage = el.createDiv("fch-tasbih");
	stage.createDiv({ cls: "fch-q-ar fch-tasbih-ar", text: ar, attr: { dir: "rtl", lang: "ar" } });
	stage.createDiv({ cls: "fch-muted", text: tr });
	const ringBox = stage.createDiv("fch-beads");
	const lit = ttarget <= 1 ? (tcount ? 33 : 0) : Math.round(((tcount % ttarget || (tcount && tcount % ttarget === 0 ? ttarget : 0)) / ttarget) * 33);
	for (let i = 0; i < 33; i++) {
		const bd = ringBox.createDiv("fch-bead" + (i < lit ? " is-on" : "") + (i === 0 ? " is-imam" : ""));
		bd.style.setProperty("--a", `${(i / 33) * 360}deg`);
	}
	const b = ringBox.createEl("button", { cls: "fch-tasbih-btn" });
	b.style.setProperty("--p", String(Math.min(1, tcount / ttarget)));
	b.createDiv({ cls: "fch-tasbih-n", text: String(tcount) });
	b.createDiv({ cls: "fch-small", text: `dari ${ttarget}` });
	const tap = () => {
		tcount++;
		i.tasbih.total++;
		i.tasbih.day[k] = (i.tasbih.day[k] ?? 0) + 1;
		(navigator as Navigator & { vibrate?: (n: number) => void }).vibrate?.(tcount % ttarget === 0 ? 60 : 8);
		if (tcount % ttarget === 0) {
			play("chime");
			if (afterSalat && phrase < 2) { phrase++; tcount = 0; }
			else if (afterSalat && phrase === 2) { phrase = 3; tcount = 0; ttarget = 1; }
			else if (afterSalat) { afterSalat = false; new Notice("🤲 Tasbih setelah salat selesai."); ttarget = 33; phrase = 0; tcount = 0; }
		} else play("click");
		p.requestSave();
		hub.renderPage();
	};
	b.onclick = tap;
	const r = stage.createDiv("fch-row fch-center");
	btn(r, { text: "Ulang", icon: "rotate-ccw", cls: "fch-btn-sm", onClick: () => { tcount = 0; hub.renderPage(); } });
	stage.createDiv({ cls: "fch-muted fch-small", text: `Hari ini: ${i.tasbih.day[k] ?? 0} · total: ${i.tasbih.total.toLocaleString("id-ID")} · tekan Spasi untuk menghitung` });
	if (afterSalat) {
		const h = hadeeth(10948);
		if (h) {
			const c = el.createDiv("fch-panel fch-mt");
			c.createDiv({ cls: "fch-dz-title", text: "Dalil: " + h.title });
			c.createDiv({ cls: "fch-h-tr", text: h.hadith_text });
			c.createDiv({ cls: "fch-muted fch-small", text: `${h.grade} ${h.takhrij} · HadeethEnc.com` });
		}
	}
	const key = (e: KeyboardEvent) => { if (!b.isConnected) return document.removeEventListener("keydown", key, true); if (e.key === " " && !(e.target as HTMLElement).closest("input,textarea,select")) { e.preventDefault(); tap(); } };
	document.addEventListener("keydown", key, true);
}

/** Panel ringkas Beranda. */
export function renderIbadahPanel(hub: HubView, parent: HTMLElement) {
	const p = hub.plugin;
	const i = I(p);
	const k = dayKey(Date.now());
	const box = parent.createDiv("fch-panel fch-mt");
	const h = box.createDiv("fch-section-head");
	h.createEl("h3", { text: `🕌 Ibadah hari ini · ${hijri(p).text}` });
	btn(h, { text: "Mutaba'ah", cls: "fch-btn-link", onClick: () => hub.navigate("mutabaah") });
	const np = nextPrayer(p);
	const r = box.createDiv("fch-row");
	const cd = r.createDiv({ cls: "fch-grow fch-strong", text: `${np.name} ${new Date(np.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · ${countdown(np.at - Date.now())} lagi` });
	const tm = window.setInterval(() => { if (!cd.isConnected) return window.clearInterval(tm); const n2 = nextPrayer(p); cd.setText(`${n2.name} ${new Date(n2.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · ${countdown(n2.at - Date.now())} lagi`); }, 1000);
	const sc = mscore(p, k);
	r.createSpan({ cls: "fch-small", text: `Mutaba'ah ${Math.round(sc * 100)}%` });
	const row = box.createDiv("fch-row fch-mt");
	for (const it of DEFAULT_ITEMS.filter((x) => x.kind === "prayer")) {
		const v = mval(p, k, it.id);
		const c = row.createEl("button", { cls: "fch-habit-pill" + (v ? " is-on" : ""), text: `${it.icon} ${it.label}` });
		c.onclick = () => { setVal(p, k, it.id, v ? 0 : 2); if (!v) play("correct"); hub.renderPage(); };
	}
	const d = box.createDiv("fch-row fch-mt");
	btn(d, { text: i.dzikir[k]?.pagi ? "✓ Dzikir pagi" : "Dzikir pagi", cls: "fch-btn-sm" + (i.dzikir[k]?.pagi ? "" : " fch-btn-ghost"), onClick: () => { dzTab = "pagi"; hub.navigate("dzikir"); } });
	btn(d, { text: i.dzikir[k]?.petang ? "✓ Dzikir petang" : "Dzikir petang", cls: "fch-btn-sm" + (i.dzikir[k]?.petang ? "" : " fch-btn-ghost"), onClick: () => { dzTab = "petang"; hub.navigate("dzikir"); } });
	btn(d, { text: "📿 Tasbih", cls: "fch-btn-sm fch-btn-ghost", onClick: () => { dzTab = "tasbih"; hub.navigate("dzikir"); } });
	void todayRead;
}
