/**
 * Penulisan resep lengkap (format resep dokter Indonesia): kop dokter, tempat & tanggal, R/ dengan jumlah
 * angka Romawi, signa singkatan Latin, paraf tiap R/, identitas pasien (pro, umur, BB, alamat).
 * Item bertanda `kg` dihitung ulang dari BB pasien memakai regimen di database obat.
 */
import { DRUGS, Drug, Prep, Reg } from "./med-data";
import type { Rx, RxItem } from "./med-dis";
import { Patient, ageMonths, amount, calc, fracText, num } from "./med-engine";

export interface DocInfo { name: string; sip: string; addr: string; city: string; phone: string }
export interface RxPatient { name: string; age: string; w: string; addr: string; type: "anak" | "dewasa"; preg?: boolean }
export const DEFAULT_DOC: DocInfo = { name: "", sip: "", addr: "", city: "", phone: "" };

const R: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
/** Angka Romawi untuk jumlah obat (resep). */
export function roman(n: number): string {
	let v = Math.max(1, Math.round(n));
	let out = "";
	for (const [k, s] of R) while (v >= k) { out += s; v -= k; }
	return out;
}
/** Takaran sendok: cth = 5 mL (sendok teh), C = 15 mL (sendok makan). */
function spoon(ml: number): string | null {
	const q = Math.round((ml / 5) * 4) / 4;
	if (Math.abs(q * 5 - ml) > 0.26 || q <= 0) return null;
	const whole = Math.floor(q), frac = q - whole;
	const f = frac === 0.5 ? "½" : frac === 0.25 ? "¼" : frac === 0.75 ? "¾" : "";
	return `cth ${whole ? roman(whole) : ""}${f}`.trim();
}
const ABBR: Record<Prep["form"], string> = { tab: "tab", kap: "caps", syr: "syr", drop: "gtt", inj: "inj", inf: "inf", supp: "supp", neb: "nebul", lain: "" };

export interface RxLine { r: string; s: string; note?: string; d?: Drug; auto?: boolean; warn?: string }

/** Batas usia/kehamilan obat yang sering terlewat saat meresepkan (bulan). */
const AGE_MIN: Record<string, [number, string]> = {
	doksisiklin: [96, "Doksisiklin/tetrasiklin dihindari < 8 tahun (pewarnaan gigi, gangguan tulang) kecuali indikasi khusus (mis. riketsia berat)."],
	tetrasiklin: [96, "Tetrasiklin dihindari < 8 tahun (pewarnaan gigi permanen)."],
	siprofloksasin: [216, "Fluorokuinolon pada < 18 tahun hanya bila tidak ada alternatif (risiko artropati); dosis anak tersedia untuk indikasi khusus."],
	levofloksasin: [216, "Fluorokuinolon pada < 18 tahun hanya bila tidak ada alternatif."],
	ofloksasin: [216, "Fluorokuinolon oral pada < 18 tahun hanya bila tidak ada alternatif (tetes telinga/mata boleh)."],
	aspirin: [192, "Aspirin dihindari < 16 tahun (sindrom Reye), kecuali Kawasaki/indikasi spesialis."],
	kodein: [144, "Kodein kontraindikasi < 12 tahun (risiko depresi napas pada metabolizer ultra-cepat)."],
	tramadol: [144, "Tramadol tidak dianjurkan < 12 tahun."],
	loperamid: [72, "Loperamid tidak untuk diare anak < 6 tahun (Indonesia: tidak dianjurkan pada anak); fokus oralit + zinc."],
	metoklopramid: [12, "Metoklopramid kontraindikasi < 1 tahun; pada anak hanya lini kedua, maksimal 5 hari (risiko distonia)."],
	prometazin: [24, "Prometazin kontraindikasi < 2 tahun (depresi napas fatal)."],
	ctm: [24, "Antihistamin generasi pertama tidak dianjurkan < 2 tahun."],
	difenhidramin: [24, "Difenhidramin oral tidak dianjurkan < 2 tahun."],
	mefenamat: [168, "Asam mefenamat di Indonesia berlabel untuk ≥ 14 tahun."],
	metamizol: [3, "Metamizol tidak untuk bayi < 3 bulan / < 5 kg."],
	ibuprofen: [3, "Ibuprofen tidak untuk bayi < 3 bulan."],
	kloramfenikol: [1, "Kloramfenikol sistemik dihindari pada neonatus (gray baby syndrome)."],
	kotrimoksazol: [2, "Kotrimoksazol kontraindikasi < 6 minggu (kernikterus)."],
	seftriakson: [1, "Seftriakson dihindari pada neonatus ikterik/prematur dan jangan bersama kalsium IV."],
	domperidon: [0, ""],
	sefiksim: [6, "Sefiksim untuk ≥ 6 bulan."],
	albendazol: [12, "Albendazol untuk ≥ 1 tahun (12–23 bulan: 200 mg)."],
	mebendazol: [24, "Mebendazol untuk ≥ 2 tahun."],
	pirantel: [6, "Pirantel untuk ≥ 6 bulan (data < 2 tahun terbatas)."],
	ivermektin: [0, ""],
	primakuin: [6, "Primakuin kontraindikasi < 6 bulan, hamil, dan defisiensi G6PD berat."],
	fluoksetin: [96, "SSRI pada anak hanya oleh spesialis (risiko ide bunuh diri)."],
	sertralin: [72, "SSRI pada anak hanya oleh spesialis."],
	haloperidol: [36, "Haloperidol pada anak hanya oleh spesialis."],
	dekstrometorfan: [48, "Obat batuk-pilek bebas tidak dianjurkan < 4 tahun."],
	pseudoefedrin: [72, "Dekongestan oral tidak dianjurkan < 6 tahun."],
	oksimetazolin: [72, "Dekongestan hidung dewasa (0,05%) tidak untuk < 6 tahun; gunakan konsentrasi anak."],
	nitrofurantoin: [3, "Nitrofurantoin kontraindikasi < 3 bulan."],
	valproat: [0, ""],
	lisinopril: [72, "ACE-inhibitor pada anak hanya oleh spesialis."],
	griseofulvin: [24, "Griseofulvin untuk ≥ 2 tahun."],
	ketokonazol: [216, "Ketokonazol oral tidak lagi dianjurkan (hepatotoksik); untuk anak gunakan alternatif."],
};
/** Obat yang perlu dihindari/diwaspadai pada kehamilan (selain catatan di database). */
const PREG_BAD = new Set(["doksisiklin", "tetrasiklin", "siprofloksasin", "levofloksasin", "ofloksasin", "warfarin", "kaptopril", "ramipril", "lisinopril", "kandesartan", "losartan", "valsartan", "atorvastatin", "simvastatin", "rosuvastatin", "misoprostol", "metotreksat", "valproat", "isotretinoin", "tretinoin", "primakuin", "albendazol", "mebendazol", "griseofulvin", "ketokonazol", "kotrimoksazol", "metimazol", "fenitoin", "karbamazepin", "spironolakton", "amiodaron", "litium", "finasterid", "ivermektin", "podofilin", "klomifen", "danazol", "testosteron", "estrogen", "kontrasepsi"]);

export function ageWarn(d: Drug | undefined, pt: Patient): string | undefined {
	if (!d) return undefined;
	const am = ageMonths(pt);
	const out: string[] = [];
	const r = AGE_MIN[d.id];
	if (r && r[1] && pt.type === "anak" && am < r[0]) out.push(r[1]);
	if (pt.preg && (PREG_BAD.has(d.id) || /kontraindikasi|jangan|hindari/i.test(d.preg.split(/[.;]/)[0] ?? ""))) out.push(`Kehamilan: ${d.preg.split(/(?<=\.)\s/)[0]}`);
	return out.length ? out.join(" ") : undefined;
}

const ORAL = /oral|\bpo\b|per ?os|sirup|tablet/i;
const NON_ORAL = /\biv\b|\bim\b|intravena|intramuskular|injeksi|infus|nebul|inhal|rektal|intranasal|bukal|topikal|sc\b|subkutan/i;
const CALC = new Set(["kg", "kgday", "band", "age", "fixed"]);

/** Pilih regimen anak yang paling cocok: rute oral, batas usia & BB terpenuhi. */
export function autoReg(d: Drug, pt: Patient): { reg: Reg; idx: number; why?: string } | null {
	const am = ageMonths(pt);
	const regs = d.regs.map((reg, idx) => ({ reg, idx }));
	// remaja besar: pakai dosis dewasa oral bila ada
	if (pt.type === "anak" && am >= 144 && pt.w >= 40) {
		const ad = regs.find((x) => x.reg.who === "dewasa" && CALC.has(x.reg.kind) && !NON_ORAL.test(x.reg.route));
		if (ad) return { ...ad, why: "remaja ≥ 12 tahun & BB ≥ 40 kg → dosis dewasa" };
	}
	const who = pt.type;
	const ok = (r: Reg) => (r.minAge === undefined || am >= r.minAge) && (r.maxAge === undefined || am <= r.maxAge) && (r.minKg === undefined || !(pt.w > 0) || pt.w > r.minKg);
	const cand = regs.filter((x) => x.reg.who === who && CALC.has(x.reg.kind));
	const oral = cand.filter((x) => !NON_ORAL.test(x.reg.route) || ORAL.test(x.reg.route));
	return oral.find((x) => ok(x.reg)) ?? cand.find((x) => ok(x.reg)) ?? oral[0] ?? cand[0] ?? null;
}

interface PrepPick { prep: Prep; per: number; puyer?: boolean }
/** Pilih sediaan yang praktis untuk usia/BB: tetes (bayi), sirup (balita), tablet (anak besar/dewasa), atau puyer. */
export function autoPrep(d: Drug, lo: number, hi: number, pt: Patient, force?: number): PrepPick | null {
	const am = ageMonths(pt);
	const mid = (lo + hi) / 2;
	const tol = lo === hi ? 0.1 : 0;
	const L = lo * (1 - tol), H = hi * (1 + tol);
	const oral = d.preps.map((p, i) => ({ p, i })).filter((x) => ["tab", "kap", "syr", "drop"].includes(x.p.form));
	const fit = (p: Prep): number | null => {
		let step = 0;
		if (p.form === "tab" && p.mg) step = p.mg / 2;
		else if (p.form === "kap" && p.mg) step = p.mg;
		else if (p.form === "syr" && p.mgMl) step = 2.5 * p.mgMl;
		else if (p.form === "drop" && p.mgMl) step = 0.1 * p.mgMl;
		if (!step) return null;
		let best: number | null = null;
		for (let k = Math.max(1, Math.ceil(L / step - 1e-9)); k * step <= H + 1e-9 && k < 400; k++) { const v = k * step; if (best === null || Math.abs(v - mid) < Math.abs(best - mid)) best = v; }
		if (best === null) return null;
		if (p.form === "drop" && best / p.mgMl! > 2) return null; // tetes > 2 mL tidak praktis
		if (p.form === "syr" && best / p.mgMl! > 20) return null; // sirup > 4 sendok teh
		if ((p.form === "tab" || p.form === "kap") && best / p.mg! > 4) return null;
		return best;
	};
	if (force !== undefined && d.preps[force]) {
		const p = d.preps[force];
		const v = fit(p);
		return v !== null ? { prep: p, per: v } : { prep: p, per: mid, puyer: p.form === "tab" };
	}
	const order: string[] = pt.type === "dewasa" || am >= 144 ? ["tab", "kap", "syr", "drop"] : am < 12 ? ["drop", "syr", "tab"] : am < 72 ? ["syr", "drop", "tab"] : pt.w >= 25 ? ["tab", "syr", "kap", "drop"] : ["syr", "tab", "drop", "kap"];
	const minTabAge = 72; // tablet utuh/½ umumnya mulai usia ± 6 tahun
	for (const f of order) {
		const ps = oral.filter((x) => x.p.form === f).sort((a, b) => (a.p.mg ?? a.p.mgMl ?? 0) - (b.p.mg ?? b.p.mgMl ?? 0));
		for (const x of ps) {
			if ((f === "tab" || f === "kap") && pt.type === "anak" && am < minTabAge) continue;
			const v = fit(x.p);
			if (v !== null) return { prep: x.p, per: v };
		}
	}
	// tidak ada yang pas: puyer dari tablet terkecil, atau sirup dengan volume tepat
	const tab = oral.filter((x) => x.p.form === "tab" && x.p.mg).sort((a, b) => a.p.mg! - b.p.mg!)[0];
	const syr = oral.filter((x) => x.p.form === "syr" || x.p.form === "drop")[0];
	if (pt.type === "anak" && tab && (am < minTabAge || !syr)) return { prep: tab.p, per: mid, puyer: true };
	if (syr) return { prep: syr.p, per: mid };
	if (tab) return { prep: tab.p, per: mid, puyer: pt.type === "anak" };
	return null;
}

const TAIL = /(p\.c\.|a\.c\.|h\.s\.|p\.r\.n\.[^()]*|\(habiskan[^)]*\)|\([^)]*hari[^)]*\)|\([^)]*minggu[^)]*\))/g;

/** Hitung satu item resep. Item dengan `kg` dihitung dari BB & usia pasien (regimen & sediaan dipilih otomatis). */
export function rxLine(it: RxItem, pt: Patient): RxLine {
	const d = it.d ? DRUGS.find((x) => x.id === it.d) : undefined;
	const aw = ageWarn(d, pt);
	const base: RxLine = { r: it.r, s: it.s, d, warn: aw };
	if (!it.kg || !d) return base;
	if (!(pt.w > 0)) return { ...base, warn: [aw, "Isi BB (atau usia) pasien agar dosis dihitung."].filter(Boolean).join(" ") };
	const picked = it.kg.reg !== undefined && d.regs[it.kg.reg] ? { reg: d.regs[it.kg.reg], idx: it.kg.reg } : autoReg(d, pt);
	if (!picked) return { ...base, warn: [aw, "Tidak ada regimen terhitung untuk pasien ini — dosis statis ditampilkan."].filter(Boolean).join(" ") };
	const reg = picked.reg;
	const c = calc(reg, pt);
	if (!c.lo || !c.hi || !c.ok) return { ...base, warn: [aw, ...c.warns].filter(Boolean).join(" ") || undefined };
	const lo = Math.min(c.lo.per, c.hi.per), hi = Math.max(c.lo.per, c.hi.per);
	const u = c.unit;
	const pp = autoPrep(d, lo, hi, pt, it.kg.prep);
	if (!pp) return base;
	const prep = pp.prep;
	let per = pp.per;
	const freq = reg.kind === "age" ? (reg.ages!.find((x) => ageMonths(pt) <= x.to)?.freq ?? reg.freq ?? 1) : reg.freq ?? 1;
	const days = it.kg.days;
	const tail = it.s.match(TAIL)?.join(" ").trim() ?? "";
	const why = `${num(per, u)}/kali × ${freq}/hari${reg.kind === "kg" || reg.kind === "kgday" ? ` · BB ${num(pt.w)} kg${pt.wAuto ? " (perkiraan)" : ""}` : ""} · ${reg.label}${picked.why ? ` · ${picked.why}` : ""}`;
	const warns = [aw, ...c.warns, ...c.lo.capped.slice(0, 1)].filter(Boolean) as string[];
	const a = amount(prep, per, u);
	if (!a) return base;
	if (a.ml !== undefined && (prep.form === "syr" || prep.form === "drop")) {
		const ml = Math.round(a.ml * 10) / 10;
		const vol = prep.form === "drop" ? 15 : 60;
		const bottles = Math.max(1, Math.ceil((ml * freq * days) / vol));
		const how = prep.form === "drop" ? `${num(ml)} mL` : spoon(ml) ?? `${num(ml)} mL`;
		if (prep.form === "syr" && ml > 15) warns.push("Volume per kali besar — pertimbangkan tablet/kapsul.");
		return { d, auto: true, r: `${d.name} ${ABBR[prep.form]} ${prep.label.replace(/^(Sirup( kering)?( forte)?|Suspensi( forte)?|Drops?|Tetes)\s*/i, "")} fl. ${roman(bottles)}`.replace(/\s+/g, " "), s: `S ${freq} dd ${how} ${tail}`.trim(), note: why, warn: warns.join(" ") || undefined };
	}
	if (a.tabs !== undefined) {
		const t = per / (prep.mg || 1);
		const nice = Math.abs(t * 2 - Math.round(t * 2)) < 1e-6 && t >= 0.5 && !(prep.form === "kap" && t % 1 !== 0);
		if (pp.puyer || !nice) {
			per = per >= 10 ? Math.round(per) : Math.round(per * 10) / 10;
			const n = freq * days;
			return { d, auto: true, r: `${d.name} ${num(per, u)}\n    m.f. pulv. dtd No. ${roman(n)}`, s: `S ${freq} dd pulv I ${tail}`.trim(), note: `${why} · puyer dari ${prep.label}`, warn: warns.join(" ") || undefined };
		}
		const total = Math.ceil(t * freq * days);
		const whole = Math.floor(t + 1e-9), half = t - whole > 0.25 ? "½" : "";
		const tq = `${whole ? roman(whole) : ""}${half}` || fracText(t);
		return { d, auto: true, r: `${d.name} ${ABBR[prep.form]} ${prep.label.replace(/^(Tablet|Kapsul)\s*/i, "")} No. ${roman(total)}`.replace(/\s+/g, " "), s: `S ${freq} dd ${ABBR[prep.form]} ${tq} ${tail}`.trim(), note: why, warn: warns.join(" ") || undefined };
	}
	return base;
}

/** "3 tahun", "8 bln", "2 th 6 bl", "35" → bulan. */
export function parseAgeMonths(s: string, who: "anak" | "dewasa"): number | null {
	const t = s.toLowerCase().replace(",", ".");
	let m = 0, hit = false;
	const y = t.match(/(\d+(?:\.\d+)?)\s*(th|thn|tahun|y|yr|tah)/);
	const mo = t.match(/(\d+(?:\.\d+)?)\s*(bl|bln|bulan|mo|m\b)/);
	const wk = t.match(/(\d+(?:\.\d+)?)\s*(mg|minggu|wk|hari|hr)/);
	if (y) { m += parseFloat(y[1]) * 12; hit = true; }
	if (mo) { m += parseFloat(mo[1]); hit = true; }
	if (wk && !hit) { m += /hari|hr/.test(wk[2]) ? parseFloat(wk[1]) / 30 : parseFloat(wk[1]) / 4.345; hit = true; }
	if (!hit) { const n = parseFloat(t); if (isFinite(n)) { m = n * 12; hit = true; } }
	if (!hit) return null;
	void who;
	return m;
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const tglIndo = (d = new Date()) => `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;

/** Susun teks resep lengkap siap salin/cetak. */
export function rxText(rx: Rx, lines: RxLine[], doc: DocInfo, pa: RxPatient): string {
	const W = 46;
	const hr = "─".repeat(W);
	const center = (s: string) => " ".repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s;
	const out: string[] = [];
	out.push(center(doc.name ? (doc.name.toLowerCase().startsWith("dr") ? doc.name : `dr. ${doc.name}`) : "dr. ........................"));
	out.push(center(`SIP: ${doc.sip || "........................"}`));
	if (doc.addr) out.push(center(doc.addr));
	if (doc.phone) out.push(center(`Telp. ${doc.phone}`));
	out.push(hr);
	out.push(`${" ".repeat(Math.max(0, W - (doc.city || "............").length - tglIndo().length - 2))}${doc.city || "............"}, ${tglIndo()}`);
	out.push("");
	for (const l of lines) {
		const [r1, ...rr] = l.r.split("\n");
		out.push(`R/ ${r1}`);
		for (const x of rr) out.push(x);
		out.push(`   ${l.s}`);
		out.push(`${" ".repeat(W - 6)}——∫`);
		out.push("");
	}
	out.push(hr);
	out.push(`Pro    : ${pa.name || "........................"}`);
	out.push(`Umur   : ${pa.age || "......"}${pa.w ? `      BB: ${pa.w} kg` : ""}`);
	out.push(`Alamat : ${pa.addr || "........................"}`);
	if (rx.note) out.push("", `Catatan: ${rx.note}`);
	return out.join("\n");
}
