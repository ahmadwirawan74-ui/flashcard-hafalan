import { DRUGS, DUPE, Drug, IX, IxRule, Prep, Reg, Sev } from "./med-data";
import { BNF_EN, BNF_IX, BNF_TXT } from "./med-bnf";

export interface Patient { type: "anak" | "dewasa"; w: number; ageY: number; ageM: number; h: number; sex: "L" | "P"; scr: number; preg: boolean; lact: boolean; /** BB berasal dari perkiraan usia (bukan ditimbang). */ wAuto?: boolean }
export const DEFAULT_PT: Patient = { type: "anak", w: 16, ageY: 4, ageM: 0, h: 0, sex: "L", scr: 0, preg: false, lact: false, wAuto: true };
export const ageMonths = (p: Patient) => Math.max(0, (p.ageY || 0) * 12 + (p.ageM || 0));

// ---------------------------------------------------------------- angka
export function num(n: number, unit = ""): string {
	if (!isFinite(n)) return "–";
	const a = Math.abs(n);
	const d = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 2 : 3;
	const s = n.toLocaleString("id-ID", { maximumFractionDigits: d });
	return unit ? `${s} ${unit}` : s;
}
export const range = (lo: number, hi: number, unit = "") => (Math.abs(hi - lo) < 1e-9 ? num(lo, unit) : `${num(lo)}–${num(hi, unit)}`);

// ---------------------------------------------------------------- dosis
export interface Pick { per: number; day: number | null; capped: string[] }
export interface Calc {
	ok: boolean;
	unit: string;
	lo?: Pick;
	hi?: Pick;
	steps?: { txt: string; mg: number; capped: boolean }[];
	label?: string;
	warns: string[];
	info: string[];
	wUsed: number;
}

const unitOf = (r: Reg) => r.unit ?? "mg";
/** Satuan kecepatan infus → [satuan dasar, satuan waktu, faktor ke "per jam"]. */
export const RATE: Record<string, [string, string, number]> = { "mcg/menit": ["mcg", "menit", 60 / 1000], "mg/jam": ["mg", "jam", 1], "unit/jam": ["unit", "jam", 1] };
export const isRate = (u: string) => u in RATE;
/** Satuan per kg untuk tampilan: "mg/kg/dosis", "mcg/kg/menit", dll. */
export function perKgUnit(r: Reg): string {
	const u = unitOf(r);
	if (RATE[u]) return `${RATE[u][0]}/kg/${RATE[u][1]}`;
	return r.kind === "kgday" ? `${u}/kg/hari` : `${u}/kg/dosis`;
}

/** Hitung satu titik dosis (t = 0 batas bawah, 1 batas atas) beserta batas maksimal. */
export function pick(r: Reg, pt: Patient, t: number): Pick | null {
	if (!r.dose) return null;
	const w = Math.min(pt.w || 0, r.capKg ?? Infinity);
	const v = r.dose[0] + (r.dose[1] - r.dose[0]) * t;
	const freq = r.freq ?? 1;
	const capped: string[] = [];
	const u = unitOf(r);
	let per: number, day: number | null;
	if (r.kind === "kg") {
		per = v * w;
		if (r.max !== undefined && per > r.max) { per = r.max; capped.push(`dibatasi maks ${num(r.max, u)}/dosis`); }
		day = per * freq;
	} else if (r.kind === "kgday") {
		day = v * w;
		per = day / freq;
		if (r.max !== undefined && per > r.max) { per = r.max; day = per * freq; capped.push(`dibatasi maks ${num(r.max, u)}/dosis`); }
	} else if (r.kind === "fixed") {
		per = v;
		day = per * freq;
	} else return null;
	if (r.maxDayKg !== undefined && day > r.maxDayKg * w + 1e-9) { day = r.maxDayKg * w; per = day / freq; capped.push(`dibatasi maks ${num(r.maxDayKg)} ${u}/kg/hari`); }
	if (r.maxDay !== undefined && day > r.maxDay + 1e-9) { day = r.maxDay; per = Math.min(per, day / freq); capped.push(`dibatasi maks ${num(r.maxDay, u)}/hari`); }
	return { per, day: freq > 1 || r.kind === "kgday" ? day : null, capped };
}

export function calc(r: Reg, pt: Patient): Calc {
	const u = unitOf(r);
	const w = Math.min(pt.w || 0, r.capKg ?? Infinity);
	const out: Calc = { ok: true, unit: u, warns: [], info: [], wUsed: w };
	const am = ageMonths(pt);
	if (r.minAge !== undefined && am < r.minAge) out.warns.push(`Usia pasien di bawah batas minimal regimen ini (${ageText(r.minAge)}).`);
	if (r.maxAge !== undefined && am > r.maxAge) out.warns.push(`Regimen ini untuk usia ≤ ${ageText(r.maxAge)}; usia pasien ${ageText(am)}.`);
	if (r.minKg !== undefined && pt.w > 0 && pt.w <= r.minKg) out.warns.push(`Regimen ini untuk BB > ${r.minKg} kg; lihat catatan dosis untuk BB lebih kecil.`);
	if (r.capKg !== undefined && pt.w > r.capKg) out.info.push(`Berat dihitung maksimal ${r.capKg} kg.`);
	if ((r.kind === "kg" || r.kind === "kgday" || r.kind === "band" || r.kind === "steps") && !(pt.w > 0)) { out.ok = false; out.warns.push("Isi berat badan pasien."); return out; }
	if (r.kind === "kg" || r.kind === "kgday" || r.kind === "fixed") {
		out.lo = pick(r, pt, 0)!;
		out.hi = pick(r, pt, 1)!;
		if (r.kind !== "fixed" && pt.type === "anak" && pt.w >= 40) out.info.push("BB ≥ 40 kg: dosis anak dapat mencapai dosis dewasa; perhatikan batas maksimal.");
	} else if (r.kind === "band") {
		const b = r.bands!.find((x) => pt.w <= x.to) ?? r.bands![r.bands!.length - 1];
		out.lo = out.hi = { per: b.dose, day: (r.freq ?? 1) > 1 ? b.dose * (r.freq ?? 1) : null, capped: [] };
		out.label = b.txt ?? `BB ${bandRange(r, b)}: ${num(b.dose, u)}`;
		if (!b.dose) out.ok = false;
	} else if (r.kind === "age") {
		const a = r.ages!.find((x) => am <= x.to) ?? r.ages![r.ages!.length - 1];
		const af = a.freq ?? r.freq ?? 1;
		out.lo = out.hi = { per: a.dose, day: af > 1 ? a.dose * af : null, capped: [] };
		out.label = `${ageBandText(r, a)}: ${a.txt ?? num(a.dose, u)}`;
	} else if (r.kind === "steps") {
		out.steps = r.steps!.map((s) => {
			let mg = s.fixed ?? s.dose * w;
			let capped = false;
			if (s.max !== undefined && mg > s.max) { mg = s.max; capped = true; }
			return { txt: s.txt, mg, capped };
		});
	} else out.ok = false;
	return out;
}

function bandRange(r: Reg, b: { to: number }) {
	const i = r.bands!.indexOf(b as never);
	const from = i > 0 ? r.bands![i - 1].to : 0;
	return b.to >= 999 ? `> ${num(from)} kg` : i === 0 ? `≤ ${num(b.to)} kg` : `${num(from)}–${num(b.to)} kg`;
}
function ageBandText(r: Reg, a: { to: number }) {
	const i = r.ages!.indexOf(a as never);
	const from = i > 0 ? r.ages![i - 1].to : 0;
	if (a.to >= 9999) return `≥ ${ageText(from + 1)}`;
	return i === 0 ? `≤ ${ageText(a.to)}` : `${ageText(from + 1)}–${ageText(a.to)}`;
}
export function ageText(m: number) {
	if (m < 1) return `${Math.round(m * 4.345)} minggu`;
	if (m < 24) return `${num(m)} bulan`;
	return m % 12 === 0 ? `${m / 12} tahun` : `${Math.floor(m / 12)} th ${Math.round(m % 12)} bl`;
}

/** Teks regimen, mis. "10–15 mg/kg/dosis tiap 4–6 jam (maks 1.000 mg/dosis; 60 mg/kg/hari)". */
export function regText(r: Reg): string {
	const u = unitOf(r);
	const lim: string[] = [];
	if (r.max !== undefined) lim.push(`maks ${num(r.max, u)}/dosis`);
	if (r.maxDayKg !== undefined) lim.push(`${num(r.maxDayKg)} ${u}/kg/hari`);
	if (r.maxDay !== undefined) lim.push(`${r.max !== undefined || r.maxDayKg !== undefined ? "" : "maks "}${num(r.maxDay, u)}/hari`);
	const L = lim.length ? ` (${lim.join("; ")})` : "";
	const basis = r.basis ? ` (sebagai ${r.basis})` : "";
	const d = r.dose ? range(r.dose[0], r.dose[1]) : "";
	switch (r.kind) {
		case "kg": return `${d} ${perKgUnit(r)}${basis} ${r.every ?? ""}${L}`;
		case "kgday": return `${d} ${u}/kg/hari${basis}, ${r.every ?? ""}${L}`;
		case "fixed": return `${d} ${u}${basis} ${r.every ?? ""}${L}`;
		case "band": return r.bands!.map((b) => b.txt ?? `${bandRange(r, b)}: ${num(b.dose, u)}`).join(" · ") + ` — ${r.every ?? ""}`;
		case "age": return r.ages!.map((a) => `${ageBandText(r, a)}: ${a.txt ?? num(a.dose, u)}`).join(" · ") + ` — ${r.every ?? ""}`;
		case "steps": return r.steps!.map((s) => `${s.txt}: ${s.fixed !== undefined ? num(s.fixed, u) : `${num(s.dose)} ${u}/kg`}${s.max !== undefined ? ` (maks ${num(s.max, u)})` : ""}`).join(" → ");
		default: return r.text ?? "";
	}
}

// ---------------------------------------------------------------- sediaan
export interface Amount { main: string; sub?: string; ml?: number; tabs?: number; warn?: string; rate?: boolean }
const FRAC: [number, string][] = [[0.25, "¼"], [0.5, "½"], [0.75, "¾"]];
export function fracText(n: number) {
	const whole = Math.floor(n + 1e-9);
	const rest = n - whole;
	const f = FRAC.find(([v]) => Math.abs(v - rest) < 0.01)?.[1] ?? "";
	return whole ? `${whole}${f ? " " + f : ""}` : f || "0";
}
export function amount(p: Prep, dose: number, unit: string): Amount | null {
	if (unit === "mL") return null;
	if (RATE[unit]) {
		if (!p.mgMl) return null;
		const mlh = (dose * RATE[unit][2]) / p.mgMl;
		const v = mlh < 1 ? Math.round(mlh * 100) / 100 : Math.round(mlh * 10) / 10;
		return { main: `${num(v)} mL/jam`, sub: `kecepatan pompa · ≈ ${num(Math.round((mlh / 60) * 1000) / 1000)} mL/menit`, ml: mlh, rate: true };
	}
	if (p.mgMl) {
		const ml = dose / p.mgMl;
		const main = `${num(ml < 1 ? Math.round(ml * 100) / 100 : Math.round(ml * 10) / 10)} mL`;
		const sub = p.form === "syr" && ml >= 2.5 ? `≈ ${fracText(Math.round((ml / 5) * 4) / 4)} sendok takar (5 mL)` : p.form === "drop" && ml < 1 ? `≈ ${Math.round(ml * 20)} tetes (bila 20 tetes/mL; gunakan pipet kemasan)` : undefined;
		return { main, sub, ml };
	}
	if (p.mg) {
		const n = dose / p.mg;
		const q = Math.round(n * 4) / 4;
		const word = p.form === "kap" ? "kapsul" : p.form === "supp" ? "supositoria/rektal" : "tablet";
		if (q < 0.25) return { main: `${num(n)} ${word}`, warn: "Dosis terlalu kecil untuk sediaan ini; gunakan sediaan cair.", tabs: n };
		const off = Math.abs(q - n) / n;
		const warn = p.form === "kap" && q % 1 !== 0 ? "Kapsul tidak dapat dibagi; pilih sediaan lain atau bulatkan." : off > 0.12 ? `Pembulatan ke ${fracText(q)} ${word} menggeser dosis ${Math.round(off * 100)}%.` : undefined;
		return { main: `${fracText(q)} ${word}`, sub: `tepatnya ${num(n)} ${word}`, tabs: q, warn };
	}
	return null;
}

// ---------------------------------------------------------------- resep (signa)
export function signa(d: Drug, r: Reg, p: Prep | null, per: number): string {
	const u = unitOf(r);
	const a = p ? amount(p, per, u) : null;
	const freq = r.freq ?? 1;
	if (isRate(u)) return `R/ ${d.name}${p ? " — " + p.label : ""}\n    Infus kontinu ${a ? a.main : ""} (${num(per, u)})${r.dur ? ` — ${r.dur}` : ""}\n    ${r.route} · ${r.every ?? ""}`;
	const how = a?.ml !== undefined ? `${num(Math.round(a.ml * 10) / 10)} mL` : a?.tabs !== undefined ? `${fracText(a.tabs)} ${p?.form === "kap" ? "kaps" : "tab"}` : num(per, u);
	const sig = r.every?.includes("tunggal") ? "S 1 dd (dosis tunggal)" : `S ${freq} dd`;
	return `R/ ${d.name}${p ? " — " + p.label : ""}\n    ${sig} ${how} (${num(per, u)})${r.dur ? ` — ${r.dur}` : ""}\n    ${r.route} · ${r.every ?? ""}`;
}

// ---------------------------------------------------------------- interaksi
export interface IxHit { a: Drug; b: Drug; rule: IxRule }
export const SEV_ORDER: Record<Sev, number> = { kontra: 0, mayor: 1, moderat: 2, minor: 3 };
const match = (tok: string, d: Drug) => (tok.startsWith("@") ? d.tags.includes(tok.slice(1)) : d.id === tok);

const BNF_SEV: Sev[] = ["mayor", "moderat", "minor"];
const BNF_ACT = ["Hindari kombinasi bila memungkinkan; bila harus, pantau sangat ketat dan sesuaikan dosis.", "Pantau respons klinis/kadar obat dan sesuaikan dosis bila perlu.", "Biasanya tidak perlu tindakan khusus; waspadai bila ada gejala."];
let bnfIdx: Map<string, IxRule[]> | null = null;
/** Indeks interaksi BNF per pasangan obat (urut paling berat, teks unik). */
function bnfPairs(): Map<string, IxRule[]> {
	if (bnfIdx) return bnfIdx;
	bnfIdx = new Map();
	for (const [a, b, sv, ti, grp] of BNF_IX) {
		const key = a < b ? `${a}|${b}` : `${b}|${a}`;
		const txt = BNF_TXT[ti] ?? "";
		const cut = txt.indexOf(". ");
		const eff = cut > 0 ? txt.slice(0, cut + 1) : txt;
		const rest = cut > 0 ? txt.slice(cut + 2).trim() : "";
		const rule: IxRule = { a, b, sev: BNF_SEV[sv] ?? "minor", eff, act: rest || BNF_ACT[sv] || BNF_ACT[2], grp, src: "BNF 85" };
		const arr = bnfIdx.get(key) ?? [];
		const norm = (t: string) => t.replace(/ diperkirakan| berpotensi| mungkin| cukup/g, "");
		const same = arr.findIndex((x) => norm(x.eff) === norm(eff));
		if (same >= 0) { if (SEV_ORDER[rule.sev] < SEV_ORDER[arr[same].sev]) arr[same] = rule; }
		else arr.push(rule);
		bnfIdx.set(key, arr);
	}
	for (const arr of bnfIdx.values()) arr.sort((p, q) => SEV_ORDER[p.sev] - SEV_ORDER[q.sev]);
	return bnfIdx;
}

/**
 * Aturan interaksi untuk satu pasangan. Urutan: (1) aturan kurasi spesifik obat, (2) data BNF 85 per pasangan,
 * (3) aturan kurasi per golongan (@tag) dengan de-duplikasi grup. Entri BNF hanya ditambahkan bila
 * tidak ada aturan kurasi untuk pasangan itu, atau bila BNF menilai lebih berat.
 */
export function pairRules(x: Drug, y: Drug): IxRule[] {
	const out: IxRule[] = [];
	const grps = new Set<string>();
	const tagged: IxRule[] = [];
	for (const r of IX) {
		const hit = (match(r.a, x) && match(r.b, y)) || (match(r.a, y) && match(r.b, x));
		if (!hit) continue;
		if (!r.a.startsWith("@") && !r.b.startsWith("@")) { if (r.grp) grps.add(r.grp); out.push(r); }
		else tagged.push(r);
	}
	for (const r of tagged) {
		if (r.grp) { if (grps.has(r.grp)) continue; grps.add(r.grp); }
		out.push(r);
	}
	const key = x.id < y.id ? `${x.id}|${y.id}` : `${y.id}|${x.id}`;
	const bnf = bnfPairs().get(key);
	if (bnf?.length) {
		const worst = out.length ? Math.min(...out.map((r) => SEV_ORDER[r.sev])) : 99;
		for (const r of bnf) {
			if (out.length && SEV_ORDER[r.sev] >= worst) continue;
			if (r.grp && grps.has(r.grp) && out.length) continue;
			out.push(r);
			if (r.grp) grps.add(r.grp);
		}
	}
	return out.sort((p, q) => SEV_ORDER[p.sev] - SEV_ORDER[q.sev]);
}


export function checkIx(list: Drug[]): { hits: IxHit[]; dupes: { label: string; drugs: Drug[] }[]; triple: Drug[] | null } {
	const hits: IxHit[] = [];
	for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) for (const rule of pairRules(list[i], list[j])) hits.push({ a: list[i], b: list[j], rule });
	hits.sort((p, q) => SEV_ORDER[p.rule.sev] - SEV_ORDER[q.rule.sev]);
	const dupes: { label: string; drugs: Drug[] }[] = [];
	for (const [tag, label] of Object.entries(DUPE)) {
		const ds = list.filter((d) => d.tags.includes(tag));
		if (ds.length > 1) dupes.push({ label, drugs: ds });
	}
	const raas = list.find((d) => d.tags.includes("raas")), diu = list.find((d) => d.tags.includes("diuretik")), ns = list.find((d) => d.tags.includes("nsaid"));
	return { hits, dupes, triple: raas && diu && ns ? [raas, diu, ns] : null };
}

/** Semua interaksi satu obat terhadap obat lain di database (untuk halaman detail). */
export function ixOf(d: Drug, all: Drug[] = DRUGS): { other: Drug; rule: IxRule }[] {
	const out: { other: Drug; rule: IxRule }[] = [];
	for (const o of all) if (o.id !== d.id) for (const rule of pairRules(d, o)) out.push({ other: o, rule });
	return out.sort((p, q) => SEV_ORDER[p.rule.sev] - SEV_ORDER[q.rule.sev] || p.other.name.localeCompare(q.other.name));
}

// ---------------------------------------------------------------- kalkulator klinis
export const bmi = (w: number, hCm: number) => w / Math.pow(hCm / 100, 2);
export function bmiCat(b: number) {
	if (b < 18.5) return { t: "Berat badan kurang", c: "#0ea5e9" };
	if (b < 23) return { t: "Normal", c: "#16a34a" };
	if (b < 25) return { t: "Berat badan lebih (berisiko)", c: "#eab308" };
	if (b < 30) return { t: "Obesitas I", c: "#f97316" };
	return { t: "Obesitas II", c: "#dc2626" };
}
export const bsa = (w: number, hCm: number) => Math.sqrt((w * hCm) / 3600);
export const ibw = (hCm: number, sex: "L" | "P") => (sex === "L" ? 50 : 45.5) + 0.9 * (hCm - 152.4);
export const abw = (ib: number, w: number) => ib + 0.4 * (w - ib);
export const crcl = (age: number, w: number, scr: number, sex: "L" | "P") => (((140 - age) * w) / (72 * scr)) * (sex === "P" ? 0.85 : 1);
export function ckdEpi(scr: number, age: number, sex: "L" | "P") {
	const k = sex === "P" ? 0.7 : 0.9, a = sex === "P" ? -0.241 : -0.302;
	return 142 * Math.pow(Math.min(scr / k, 1), a) * Math.pow(Math.max(scr / k, 1), -1.2) * Math.pow(0.9938, age) * (sex === "P" ? 1.012 : 1);
}
export const schwartz = (hCm: number, scr: number) => (0.413 * hCm) / scr;
export function holliday(w: number) {
	const day = w <= 10 ? 100 * w : w <= 20 ? 1000 + 50 * (w - 10) : 1500 + 20 * (w - 20);
	const hr = w <= 10 ? 4 * w : w <= 20 ? 40 + 2 * (w - 10) : 60 + (w - 20);
	return { day, hr };
}
/** Perkiraan berat anak dari usia (APLS). */
/** Perkiraan BB anak dari usia (rumus APLS; > 12 tahun hanya perkiraan kasar). */
export function apls(months: number) {
	if (months < 12) return months / 2 + 4;
	const y = months / 12;
	if (y <= 5) return 2 * y + 8;
	if (y <= 12) return 3 * y + 7;
	if (y < 18) return Math.min(3 * y + 7, 60); // perkiraan kasar remaja (di luar rentang APLS)
	return NaN;
}
export function gfrStage(g: number) {
	if (g >= 90) return "G1 (normal/tinggi)";
	if (g >= 60) return "G2 (turun ringan)";
	if (g >= 45) return "G3a (ringan–sedang)";
	if (g >= 30) return "G3b (sedang–berat)";
	if (g >= 15) return "G4 (berat)";
	return "G5 (gagal ginjal)";
}

/** Fungsi ginjal pasien (dewasa: Cockcroft-Gault; anak: Schwartz). */
export function renalOf(pt: Patient): { val: number; label: string } | null {
	if (!(pt.scr > 0)) return null;
	if (pt.type === "dewasa" && pt.w > 0 && pt.ageY > 0) return { val: crcl(pt.ageY, pt.w, pt.scr, pt.sex), label: "CrCl (Cockcroft-Gault)" };
	if (pt.type === "anak" && pt.h > 0) return { val: schwartz(pt.h, pt.scr), label: "eGFR (Schwartz)" };
	return null;
}

/** Peringatan khusus pasien untuk satu obat. */
export function patientAlerts(d: Drug, pt: Patient): { lvl: "red" | "amber" | "blue"; t: string }[] {
	const out: { lvl: "red" | "amber" | "blue"; t: string }[] = [];
	const rf = renalOf(pt);
	if (rf && rf.val < 60 && d.renal) out.push({ lvl: rf.val < 30 ? "red" : "amber", t: `Ginjal (${rf.label} ${num(rf.val)} mL/menit): ${d.renal}` });
	if (pt.preg) out.push({ lvl: /kontraindikasi|hindari/i.test(d.preg) ? "red" : "blue", t: `Kehamilan: ${d.preg}` });
	if (pt.lact) out.push({ lvl: /kontraindikasi|hindari/i.test(d.lact) ? "amber" : "blue", t: `Menyusui: ${d.lact}` });
	if (pt.type === "anak" && !d.regs.some((r) => r.who === "anak")) out.push({ lvl: "amber", t: "Tidak ada regimen anak di database untuk obat ini." });
	const am = ageMonths(pt);
	if (pt.type === "anak") for (const c of d.ci) {
		const m = c.match(/<\s*(\d+(?:[.,]\d+)?)\s*(tahun|bulan|minggu)/i);
		const lim = m ? parseFloat(m[1].replace(",", ".")) * (m[2].toLowerCase() === "tahun" ? 12 : m[2].toLowerCase() === "bulan" ? 1 : 0.23) : /neonatus/i.test(c) ? 1 : -1;
		if (lim > 0 && am < lim) out.push({ lvl: "red", t: `Kontraindikasi usia: ${c} (usia pasien ${ageText(am)}).` });
	}
	return out;
}

export function searchDrugs(q: string, list: Drug[]): Drug[] {
	const s = q.trim().toLowerCase();
	if (!s) return list;
	const score = (d: Drug) => {
		const n = d.name.toLowerCase();
		if (n.startsWith(s)) return 0;
		if ((d.alias ?? []).some((a) => a.toLowerCase().startsWith(s))) return 1;
		if (n.includes(s)) return 2;
		if ((d.alias ?? []).some((a) => a.toLowerCase().includes(s))) return 3;
		if (d.cls.toLowerCase().includes(s)) return 4;
		if (d.ind.some((i) => i.toLowerCase().includes(s))) return 5;
		if ((BNF_EN[d.id] ?? "").toLowerCase().includes(s)) return 3;
		if (d.se.some((i) => i.toLowerCase().includes(s))) return 6;
		if ((d.mech ?? "").toLowerCase().includes(s) || d.tags.includes(s)) return 7;
		return 9;
	};
	return list.map((d) => [d, score(d)] as const).filter((x) => x[1] < 9).sort((a, b) => a[1] - b[1] || a[0].name.localeCompare(b[0].name)).map((x) => x[0]);
}
