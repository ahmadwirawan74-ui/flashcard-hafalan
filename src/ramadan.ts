import { Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { RAMADAN_HADITH } from "./ibadah-data";
import { SOURCE_LINE, arabicBlock, city, countdown, decorateHero, hadeeth, hijri, renderLocation } from "./ibadah";
import { hm, prayerAt, prayerTimes } from "./prayer";
import { JUZ } from "./quran-data";
import { fromGid, openReader, todayRead } from "./quran";
import { addDays, dayKey, startOfDay } from "./scheduler";
import { btn } from "./util";
import { play } from "./sound";

const R = (p: FlashcardPlugin) => p.data.ibadah.ramadan;

/** Status Ramadan: hari ke-berapa (1–30) dan tanggal mulai; null bila bukan Ramadan. */
export function ramadanInfo(p: FlashcardPlugin): { day: number; start: number; year: number; preview: boolean } | null {
	const mode = R(p).mode;
	if (mode === "off") return null;
	const h = hijri(p);
	if (h.m === 9) return { day: h.d, start: addDays(startOfDay(Date.now()), -(h.d - 1)), year: h.y, preview: false };
	if (mode === "on") return { day: 1, start: startOfDay(Date.now()), year: h.y + (h.m > 9 ? 1 : 0), preview: true };
	return null;
}
export function nextRamadan(p: FlashcardPlugin): { date: number; days: number; year: number } | null {
	for (let i = 1; i < 400; i++) {
		const t = addDays(startOfDay(Date.now()), i);
		const h = hijri(p, t);
		if (h.m === 9 && h.d === 1) return { date: t, days: i, year: h.y };
	}
	return null;
}

/** Hitung mundur berikutnya: berbuka (Maghrib) atau imsak. */
export function fastingClock(p: FlashcardPlugin): { label: string; at: number; name: string } {
	const c = city(p), adj = p.data.ibadah.adj;
	const now = Date.now();
	const today = new Date(startOfDay(now));
	const imsak = prayerAt(today, c, "Imsak", adj), maghrib = prayerAt(today, c, "Maghrib", adj);
	if (now < imsak) return { label: "Waktu sahur · imsak dalam", at: imsak, name: "Imsak" };
	if (now < maghrib) return { label: "Berbuka puasa dalam", at: maghrib, name: "Maghrib" };
	return { label: "Waktu sahur · imsak dalam", at: prayerAt(new Date(addDays(startOfDay(now), 1)), c, "Imsak", adj), name: "Imsak" };
}

const FAST = ["·", "✓", "✗", "○"];
const FAST_LABEL = ["belum dicatat", "puasa", "tidak puasa", "udzur"];

export function renderRamadan(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const r = R(p);
	const info = ramadanInfo(p);
	const head = el.createDiv("fch-pagehead fch-pagehead-row");
	decorateHero(p, head, "#4338ca");
	const ht = head.createDiv();
	ht.createEl("h1", { text: "🌙 Mode Ramadan" });
	const nx = nextRamadan(p);
	ht.createDiv({ cls: "fch-muted", text: info && !info.preview ? `${info.day} Ramadan ${info.year} H · ${hijri(p).text}` : nx ? `Ramadan ${nx.year} H diperkirakan mulai ${new Date(nx.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} (${nx.days} hari lagi). Penetapan resmi mengikuti keputusan pemerintah.` : "" });
	const ms = head.createEl("select", { cls: "dropdown fch-select" });
	[["auto", "Otomatis (saat Ramadan)"], ["on", "Selalu tampil (pratinjau)"], ["off", "Matikan"]].forEach(([v, l]) => ms.createEl("option", { text: l, attr: { value: v } }));
	ms.value = r.mode;
	ms.onchange = () => { r.mode = ms.value as typeof r.mode; p.requestSave(); hub.renderPage(); };
	if (!info) {
		el.createDiv({ cls: "fch-empty", text: r.mode === "off" ? "Mode Ramadan dimatikan." : "Saat ini bukan bulan Ramadan. Mode ini akan aktif otomatis saat Ramadan tiba, atau pilih “Selalu tampil” untuk melihat pratinjaunya." });
		renderLocation(hub, el);
		return;
	}
	if (info.preview) el.createDiv({ cls: "fch-banner", text: "👀 Pratinjau: data di bawah dihitung seolah hari ini adalah 1 Ramadan." });

	// hitung mundur
	const fc = fastingClock(p);
	const cdBox = el.createDiv("fch-hero fch-ram-hero");
	const hl = cdBox.createDiv("fch-hero-l");
	const lab = hl.createDiv({ cls: "fch-hero-sub", text: fc.label });
	const clock = hl.createDiv({ cls: "fch-hero-num fch-ram-clock", text: countdown(fc.at - Date.now()) });
	const t = prayerTimes(new Date(), city(p), p.data.ibadah.adj);
	hl.createDiv({ cls: "fch-hero-sub", text: `${city(p).name} · Imsak ${hm(t.Imsak)} · Subuh ${hm(t.Subuh)} · Maghrib ${hm(t.Maghrib)} · Isya ${hm(t.Isya)}` });
	let lastName = fc.name;
	const tm = window.setInterval(() => {
		if (!clock.isConnected) return window.clearInterval(tm);
		const f2 = fastingClock(p);
		clock.setText(countdown(f2.at - Date.now()));
		lab.setText(f2.label);
		if (f2.name !== lastName) { lastName = f2.name; play("chime"); new Notice(f2.name === "Imsak" ? "🌇 Waktu berbuka telah tiba. Selamat berbuka puasa!" : "⏰ Waktu imsak."); }
	}, 1000);
	const hr = cdBox.createDiv("fch-hero-r");
	hr.createDiv({ cls: "fch-ram-day", text: String(info.day) });
	hr.createDiv({ cls: "fch-small", text: "Ramadan" });

	// target khatam 30 hari
	const q = p.data.quran;
	const kh = el.createDiv("fch-panel fch-mt");
	kh.createEl("h3", { text: "📖 Khatam 30 hari" });
	const juz = Math.min(30, info.day);
	const [a, b] = [JUZ[juz - 1], JUZ[juz] - 1];
	const inJuz = Math.max(0, Math.min(b, q.pos) - a + 1) / (b - a + 1);
	const tr = todayRead(p);
	kh.createDiv({ cls: "fch-small", text: `Hari ke-${info.day}: target Juz ${juz} · tilawah hari ini ${tr.pages.toFixed(1)} halaman · target ${q.target} halaman/hari` });
	kh.createDiv("fch-bar fch-mt").createDiv("fch-bar-fill").style.width = `${inJuz * 100}%`;
	const kr = kh.createDiv("fch-row fch-mt");
	btn(kr, { text: `Baca Juz ${juz}`, icon: "book-open", cls: "fch-btn-primary", onClick: () => { const g = q.pos >= a && q.pos < b ? q.pos + 1 : a; openReader(fromGid(g)[0], g); hub.navigate("quran"); } });
	if (q.target !== 20) btn(kr, { text: "Atur target 20 halaman/hari (1 juz)", cls: "fch-btn-sm", onClick: () => { q.target = 20; p.requestSave(); new Notice("🎯 Target tilawah: 20 halaman/hari"); hub.renderPage(); } });

	// puasa & tarawih
	const grid = el.createDiv("fch-panel fch-mt");
	const fasted = Object.entries(r.fast).filter(([k, v]) => v === 1 && k >= dayKey(info.start)).length;
	grid.createEl("h3", { text: `🍽️ Puasa · ${fasted} hari` });
	grid.createDiv({ cls: "fch-muted fch-small fch-desc", text: "Klik tanggal untuk mengganti: ✓ puasa → ✗ tidak → ○ udzur. Malam ganjil di 10 malam terakhir diberi tanda ★." });
	const cells = grid.createDiv("fch-ram-grid");
	for (let d = 1; d <= 30; d++) {
		const tt = addDays(info.start, d - 1), k = dayKey(tt);
		const v = r.fast[k] ?? 0;
		const future = tt > startOfDay(Date.now());
		const c = cells.createEl("button", { cls: `fch-ram-cell f${v}` + (d === info.day ? " is-today" : "") + (d >= 21 ? " is-last10" : "") + (future ? " is-future" : "") });
		c.createDiv({ cls: "fch-ram-n", text: String(d) + (d >= 21 && d % 2 === 1 ? "★" : "") });
		c.createDiv({ cls: "fch-small", text: FAST[v] });
		const tw = r.tarawih[k];
		if (tw) c.createDiv({ cls: "fch-ram-tw", text: `🕌${tw}` });
		c.setAttr("aria-label", `${d} Ramadan (${new Date(tt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}): ${FAST_LABEL[v]}`);
		c.disabled = future;
		c.onclick = () => { r.fast[k] = (v % 3) + 1; if (r.fast[k] === 1) { play("correct"); p.track("puasa"); } p.requestSave(); p.checkAchievements(); hub.renderPage(); };
	}
	const k = dayKey(Date.now());
	const twr = grid.createDiv("fch-row fch-mt");
	twr.createSpan({ cls: "fch-small fch-strong", text: "🕌 Tarawih & witir malam ini:" });
	const seg = twr.createDiv("fch-seg");
	[0, 8, 11, 20, 23].forEach((n) => { const bb = seg.createEl("button", { cls: "fch-seg-btn" + ((r.tarawih[k] ?? 0) === n ? " is-active" : ""), text: n ? `${n} rakaat` : "Belum" }); bb.onclick = () => { r.tarawih[k] = n; if (n) play("correct"); p.requestSave(); hub.renderPage(); }; });
	const twTotal = Object.entries(r.tarawih).filter(([kk, v]) => v && kk >= dayKey(info.start)).length;
	twr.createSpan({ cls: "fch-muted fch-small", text: `${twTotal} malam` });

	// sedekah
	const sd = el.createDiv("fch-panel fch-mt");
	const total = Object.entries(r.sedekah).filter(([kk]) => kk >= dayKey(info.start)).reduce((s, [, v]) => s + v, 0);
	sd.createEl("h3", { text: "💝 Target sedekah Ramadan" });
	const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
	sd.createDiv({ cls: "fch-small", text: `${rp(total)} dari target ${rp(r.sedekahTarget)} · hari ini ${rp(r.sedekah[k] ?? 0)}` });
	sd.createDiv("fch-bar fch-mt").createDiv("fch-bar-fill").style.width = `${Math.min(100, (total / Math.max(1, r.sedekahTarget)) * 100)}%`;
	const sr = sd.createDiv("fch-row fch-mt");
	const amt = sr.createEl("input", { type: "number", cls: "fch-input", attr: { placeholder: "Jumlah (Rp)", min: "0", step: "1000" } });
	btn(sr, { text: "Catat sedekah", icon: "plus", cls: "fch-btn-primary", onClick: () => { const v = parseFloat(amt.value); if (!(v > 0)) return; r.sedekah[k] = (r.sedekah[k] ?? 0) + v; const m = p.data.ibadah.muta; m[k] = { ...(m[k] ?? {}), sedekah: 1 }; play("coin"); p.requestSave(); hub.renderPage(); } });
	const tg = sr.createEl("input", { type: "number", cls: "fch-input", attr: { "aria-label": "Target sedekah", step: "50000" } });
	tg.value = String(r.sedekahTarget);
	tg.onchange = () => { r.sedekahTarget = Math.max(0, parseFloat(tg.value) || 0); p.requestSave(); hub.renderPage(); };
	sr.createSpan({ cls: "fch-muted fch-small", text: "← target" });

	// 10 malam terakhir
	const last = el.createDiv("fch-panel fch-mt fch-ram-last");
	last.createEl("h3", { text: "✨ 10 malam terakhir" });
	const nights = last.createDiv("fch-ram-nights");
	for (let n = 21; n <= 30; n++) {
		const key = dayKey(addDays(info.start, n - 2)); // malam ke-n jatuh pada petang hari sebelumnya
		const v = r.nights[key] ?? 0;
		const c = nights.createDiv("fch-ram-night" + (n % 2 ? " is-odd" : "") + (info.day + 1 === n || (info.day === n && new Date().getHours() < 4) ? " is-now" : ""));
		c.createDiv({ cls: "fch-strong", text: `Malam ${n}${n % 2 ? " ★" : ""}` });
		const opts: [number, string][] = [[1, "Qiyamul lail"], [2, "I'tikaf"], [4, "Tilawah & doa"]];
		for (const [bit, l] of opts) {
			const lb = c.createEl("label", { cls: "fch-toggle" });
			const cb = lb.createEl("input", { type: "checkbox" });
			cb.checked = !!(v & bit);
			cb.onchange = () => { r.nights[key] = cb.checked ? v | bit : v & ~bit; p.requestSave(); hub.renderPage(); };
			lb.createSpan({ cls: "fch-small", text: l });
		}
	}
	// hadits Ramadan
	const hs = el.createDiv("fch-panel fch-mt");
	hs.createEl("h3", { text: "📜 Hadits seputar Ramadan" });
	for (const id of RAMADAN_HADITH) {
		const h = hadeeth(id);
		if (!h) continue;
		const c = hs.createDiv("fch-ram-h");
		c.createDiv({ cls: "fch-strong", text: h.title });
		arabicBlock(c, h, "fch-ram-ar");
		c.createDiv({ cls: "fch-h-tr", text: h.hadith_text });
		c.createDiv({ cls: "fch-muted fch-small", text: `${h.grade} ${h.takhrij}` });
	}
	hs.createDiv({ cls: "fch-muted fch-small fch-mt", text: SOURCE_LINE });
	renderLocation(hub, el);
}

/** Baris ringkas Ramadan untuk Beranda (bila aktif). */
export function renderRamadanStrip(hub: HubView, parent: HTMLElement) {
	const p = hub.plugin;
	const info = ramadanInfo(p);
	if (!info || info.preview) return;
	const b = parent.createDiv("fch-banner fch-mt fch-ram-strip");
	const f = fastingClock(p);
	const s = b.createSpan({ text: `🌙 ${info.day} Ramadan · ${f.label} ${countdown(f.at - Date.now())}` });
	const tm = window.setInterval(() => { if (!s.isConnected) return window.clearInterval(tm); const f2 = fastingClock(p); s.setText(`🌙 ${info.day} Ramadan · ${f2.label} ${countdown(f2.at - Date.now())}`); }, 1000);
	btn(b, { text: "Buka", cls: "fch-btn-sm", onClick: () => hub.navigate("ramadan") });
}
