/**
 * Bagian Medis v19: panduan golongan obat (farmakologi), antidot & keracunan, kuis farmakologi,
 * dan kalkulator klinis tambahan (ekuivalensi steroid, konversi opioid, skor klinis).
 */
import { Notice } from "obsidian";
import type { HubView } from "./hub-view";
import { DRUGS, Drug, IX, SEV_INFO } from "./med-data";
import { Patient, isRate, num, perKgUnit, range } from "./med-engine";
import { ANTIDOTES, CLASSES, CLASS_GROUPS, DrugClass, OPIOIDS, SCORES, STEROIDS } from "./med-ref";
import { allDrugs, catOf, disclaimer, drugById, field, hero, list, med, openDrug, section, seg, toNum } from "./medis";
import { play } from "./sound";
import { btn, confetti } from "./util";

// ================================================================ util
const shuffle = <T>(a: T[]): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pickOne = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export function membersOf(c: DrugClass, all: Drug[] = DRUGS): Drug[] {
	return all.filter((d) => c.ids?.includes(d.id) || d.tags.some((t) => c.tags?.includes(t)));
}
/** Golongan utama sebuah obat (id eksplisit didahulukan, lalu tag sesuai urutan daftar). */
export function classOfDrug(d: Drug): DrugClass | undefined {
	return CLASSES.find((c) => c.ids?.includes(d.id)) ?? CLASSES.find((c) => d.tags.some((t) => c.tags?.includes(t)));
}

// ================================================================ 1. FARMAKOLOGI (golongan obat)
let openCls: string | null = null;
let clsQ = "";
let clsGroup = "";
export function openClass(hub: HubView, id: string) { openCls = id; if (hub.page === "medclass") hub.renderPage(); else hub.navigate("medclass"); }

export function renderMedClass(hub: HubView, el: HTMLElement) {
	const all = allDrugs(hub.plugin);
	const cur = openCls ? CLASSES.find((c) => c.id === openCls) : undefined;
	if (cur) return classDetail(hub, el, cur, all);
	hero(el, "Farmakologi · Golongan Obat", "Mekanisme kerja, prototipe, indikasi, efek samping khas, dan mutiara klinis tiap golongan — terhubung ke database obat.", "📚", (t) => {
		const st = t.createDiv("fch-md-hero-stats");
		const s = (v: string, l: string) => { const x = st.createDiv("fch-md-hstat"); x.createDiv({ cls: "fch-md-hstat-v", text: v }); x.createDiv({ cls: "fch-md-hstat-l", text: l }); };
		s(String(CLASSES.length), "golongan");
		s(String(new Set(CLASSES.flatMap((c) => membersOf(c, all).map((d) => d.id))).size), "obat terhubung");
	});
	const bar = el.createDiv("fch-md-bar");
	const box = bar.createDiv("fch-md-search fch-grow");
	box.createSpan({ cls: "fch-md-search-ic", text: "🔎" });
	const inp = box.createEl("input", { type: "text", cls: "fch-md-search-in", attr: { placeholder: "Cari golongan, mekanisme, atau efek samping… (mis. “kanal kalsium”, “QT”, “hiperkalemia”)" } });
	inp.value = clsQ;
	btn(bar, { text: "Kuis golongan", icon: "target", cls: "fch-btn-sm", onClick: () => { QZ.mode = "gol"; QZ.cls = ""; resetQuiz(); hub.navigate("medquiz"); } });
	const chips = el.createDiv("fch-md-chips");
	const mk = (id: string, label: string) => {
		const c = chips.createEl("button", { cls: "fch-md-chip" + (clsGroup === id ? " is-on" : "") });
		c.style.setProperty("--c", "#8b5cf6");
		c.setText(label);
		c.onclick = () => { clsGroup = id; chips.querySelectorAll(".fch-md-chip").forEach((x) => x.removeClass("is-on")); c.addClass("is-on"); draw(); };
	};
	mk("", "✨ Semua");
	for (const g of CLASS_GROUPS) if (CLASSES.some((c) => c.group === g)) mk(g, g);
	const grid = el.createDiv("fch-md-clsgrid");
	const draw = () => {
		grid.empty();
		const s = clsQ.trim().toLowerCase();
		const hit = (c: DrugClass) => !s || [c.name, c.mech, c.proto, c.pearl, ...c.use, ...c.ae, ...c.caution].some((x) => x.toLowerCase().includes(s)) || membersOf(c, all).some((d) => d.name.toLowerCase().includes(s));
		const list2 = CLASSES.filter((c) => (!clsGroup || c.group === clsGroup) && hit(c));
		if (!list2.length) { grid.createDiv({ cls: "fch-md-empty", text: "Tidak ada golongan yang cocok." }); return; }
		list2.forEach((c, i) => {
			const card = grid.createEl("button", { cls: "fch-md-clscard" });
			card.style.setProperty("--c", c.color);
			card.style.animationDelay = `${Math.min(i, 20) * 0.03}s`;
			const top = card.createDiv("fch-md-clscard-top");
			top.createSpan({ cls: "fch-md-clscard-ic", text: c.icon });
			top.createSpan({ cls: "fch-md-mini", text: c.group });
			card.createDiv({ cls: "fch-md-dcard-name", text: c.name });
			card.createDiv({ cls: "fch-small fch-muted", text: `Prototipe: ${c.proto}` });
			card.createDiv({ cls: "fch-md-clscard-mech", text: c.mech });
			const n = membersOf(c, all).length;
			card.createDiv({ cls: "fch-small fch-md-clscard-n", text: `💊 ${n} obat di database` });
			card.onclick = () => { openCls = c.id; hub.renderPage(); };
		});
	};
	inp.oninput = () => { clsQ = inp.value; draw(); };
	draw();
	disclaimer(el);
}

function classDetail(hub: HubView, el: HTMLElement, c: DrugClass, all: Drug[]) {
	const head = el.createDiv("fch-md-dhead");
	head.style.setProperty("--c", c.color);
	const top = head.createDiv("fch-md-dhead-top");
	btn(top, { icon: "arrow-left", text: "Semua golongan", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { openCls = null; hub.renderPage(); } });
	top.createDiv("fch-grow");
	btn(top, { text: "Kuis golongan ini", icon: "target", cls: "fch-btn-sm", onClick: () => { QZ.mode = "mix"; QZ.cls = c.id; resetQuiz(); hub.navigate("medquiz"); } });
	const main = head.createDiv("fch-md-dhead-main");
	main.createDiv("fch-md-pill").createSpan({ text: c.icon });
	const info = main.createDiv("fch-grow");
	info.createDiv({ cls: "fch-md-dhead-cat", text: c.group });
	info.createEl("h1", { text: c.name });
	info.createDiv({ cls: "fch-md-dhead-cls", text: `Prototipe: ${c.proto}` });
	const g = el.createDiv("fch-md-two fch-mt");
	section(g, "⚙️", "Mekanisme kerja", "is-teal").createDiv({ cls: "fch-md-p", text: c.mech });
	list(section(g, "🎯", "Penggunaan klinis"), c.use);
	list(section(g, "🤒", "Efek samping khas", "is-amber"), c.ae);
	list(section(g, "⚠️", "Perhatian & interaksi", "is-red"), c.caution);
	const pe = section(el, "💡", "Mutiara klinis", "is-pink fch-mt");
	pe.createDiv({ cls: "fch-md-p fch-md-pearl", text: c.pearl });
	const mem = membersOf(c, all);
	const ms = section(el, "💊", `Anggota di database (${mem.length})`, "fch-mt");
	const wrap = ms.createDiv("fch-md-memgrid");
	mem.forEach((d, i) => {
		const b = wrap.createEl("button", { cls: "fch-md-mem" });
		b.style.setProperty("--c", catOf(d.cat).color);
		b.style.animationDelay = `${i * 0.03}s`;
		b.createDiv({ cls: "fch-strong", text: d.name });
		b.createDiv({ cls: "fch-small fch-muted", text: d.cls });
		b.onclick = () => openDrug(hub, d.id);
	});
	if (!mem.length) ms.createDiv({ cls: "fch-md-empty", text: "Belum ada anggota di database." });
	disclaimer(el);
}

// ================================================================ 2. ANTIDOT & KERACUNAN
let toxQ = "";
export function renderMedTox(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const pt = med(p).pt;
	hero(el, "Antidot & Keracunan", "Tanda klinis, antidot, dan dosisnya untuk keracunan yang sering ditemui di IGD — plus kalkulator N-asetilsistein untuk overdosis paracetamol.", "☠️");
	const prin = section(el, "🧭", "Prinsip umum tata laksana keracunan", "is-teal");
	list(prin, [
		"ABCDE & stabilisasi lebih dahulu; periksa gula darah pada setiap penurunan kesadaran.",
		"Dekontaminasi: arang aktif 1 g/kg (maks 50 g) bila tertelan < 1 jam dan jalan napas aman; tidak untuk alkohol, besi, litium, logam, korosif, hidrokarbon.",
		"Kenali toksidrom: opioid, kolinergik, antikolinergik, simpatomimetik, sedatif-hipnotik, serotonin.",
		"Periksa EKG (QRS, QTc), elektrolit, analisis gas darah (anion gap, osmolal gap), kadar paracetamol pada semua overdosis disengaja.",
		"Hubungi Sentra Informasi Keracunan Nasional (SIKerNas BPOM) untuk konsultasi.",
	]);
	nacCalc(el, pt);
	const bar = el.createDiv("fch-md-bar fch-mt");
	const box = bar.createDiv("fch-md-search fch-grow");
	box.createSpan({ cls: "fch-md-search-ic", text: "🔎" });
	const inp = box.createEl("input", { type: "text", cls: "fch-md-search-in", attr: { placeholder: "Cari racun, obat, gejala, atau antidot… (mis. “pupil”, “QRS”, “insektisida”)" } });
	inp.value = toxQ;
	const grid = el.createDiv("fch-md-toxgrid");
	const draw = () => {
		grid.empty();
		const s = toxQ.trim().toLowerCase();
		const ok = ANTIDOTES.filter((a) => !s || [a.tox, a.sign, a.anti, a.dose, a.note ?? ""].some((x) => x.toLowerCase().includes(s)));
		if (!ok.length) grid.createDiv({ cls: "fch-md-empty", text: "Tidak ditemukan." });
		ok.forEach((a, i) => {
			const c = grid.createDiv("fch-md-tox");
			c.style.animationDelay = `${Math.min(i, 20) * 0.03}s`;
			const h = c.createDiv("fch-md-tox-h");
			h.createSpan({ cls: "fch-md-tox-ic", text: a.icon });
			const t = h.createDiv("fch-grow");
			t.createDiv({ cls: "fch-strong", text: a.tox });
			t.createDiv({ cls: "fch-md-tox-anti", text: `🧯 ${a.anti}` });
			c.createDiv({ cls: "fch-small fch-md-tox-sign", text: `Gejala: ${a.sign}` });
			c.createDiv({ cls: "fch-md-tox-dose", text: a.dose });
			if (a.note) c.createDiv({ cls: "fch-small fch-muted", text: `ℹ️ ${a.note}` });
			const links = [...(a.cause ?? []), ...(a.cure ?? [])].map((id) => drugById(p, id)).filter((d): d is Drug => !!d);
			const tagged = a.tags ? allDrugs(p).filter((d) => d.tags.some((x) => a.tags!.includes(x)) && !links.includes(d)).slice(0, 6) : [];
			if (links.length || tagged.length) {
				const row = c.createDiv("fch-md-tox-links");
				for (const d of [...links, ...tagged]) {
					const isCure = a.cure?.includes(d.id);
					const b = row.createEl("button", { cls: "fch-md-rchip" + (isCure ? " is-cure" : ""), text: `${isCure ? "🧯" : "⚠️"} ${d.name}` });
					b.onclick = () => openDrug(hub, d.id);
				}
			}
		});
	};
	inp.oninput = () => { toxQ = inp.value; draw(); };
	draw();
	disclaimer(el);
}

/** Kalkulator NAC rejimen 3 kantong (21 jam) + garis terapi nomogram BNF (100 mg/L pada 4 jam). */
function nacCalc(el: HTMLElement, pt: Patient) {
	const s = { w: pt.w || 60, mg: 0, hr: 0, lvl: 0, conc: 200 as 100 | 200 };
	const c = section(el, "💊", "Kalkulator N-asetilsistein (overdosis paracetamol)", "fch-mt fch-md-nac");
	const row = c.createDiv("fch-md-row");
	field(row, "Berat badan", s.w, (v) => { s.w = toNum(v); u(); }, { suffix: "kg" });
	field(row, "Paracetamol tertelan", "", (v) => { s.mg = toNum(v); u(); }, { suffix: "mg", ph: "opsional" });
	const row2 = c.createDiv("fch-md-row");
	field(row2, "Jam sejak tertelan", "", (v) => { s.hr = toNum(v); u(); }, { suffix: "jam", ph: "opsional" });
	field(row2, "Kadar paracetamol", "", (v) => { s.lvl = toNum(v); u(); }, { suffix: "mg/L", ph: "opsional" });
	const r3 = c.createDiv("fch-md-row fch-md-row-c");
	r3.createSpan({ cls: "fch-small", text: "Sediaan NAC:" });
	seg(r3, [["200", "200 mg/mL"], ["100", "100 mg/mL"]], String(s.conc) as "100" | "200", (v) => { s.conc = v === "100" ? 100 : 200; u(); }, "fch-md-seg-sm");
	const out = c.createDiv("fch-md-nac-out");
	const u = () => {
		out.empty();
		if (!(s.w > 0)) { out.createDiv({ cls: "fch-md-warnline", text: "Isi berat badan." }); return; }
		const w = Math.min(s.w, 110);
		const risk = out.createDiv("fch-md-nac-risk");
		if (s.mg > 0) {
			const mk = s.mg / s.w;
			risk.createDiv({ cls: `fch-md-alert ${mk >= 150 ? "is-red" : mk >= 75 ? "is-amber" : "is-ok"}`, text: `Dosis tertelan ≈ ${num(mk)} mg/kg — ${mk >= 150 ? "berpotensi hepatotoksik: berikan NAC" : mk >= 75 ? "pertimbangkan berdasarkan kadar & faktor risiko" : "risiko rendah bila tunggal dan waktu jelas"}` });
		}
		if (s.hr > 0 && s.lvl > 0) {
			if (s.hr < 4) risk.createDiv({ cls: "fch-md-alert is-amber", text: "Kadar sebelum 4 jam tidak dapat diinterpretasi; ulangi pada jam ke-4." });
			else if (s.hr > 24) risk.createDiv({ cls: "fch-md-alert is-amber", text: "> 24 jam: nomogram tidak berlaku; nilai klinis, ALT, INR." });
			else {
				const line = 100 * Math.pow(2, -(s.hr - 4) / 4);
				const over = s.lvl >= line;
				risk.createDiv({ cls: `fch-md-alert ${over ? "is-red" : "is-ok"}`, text: `Garis terapi pada jam ke-${num(s.hr)} ≈ ${num(line)} mg/L. Kadar ${num(s.lvl)} mg/L → ${over ? "DI ATAS garis: berikan NAC" : "di bawah garis: NAC umumnya tidak perlu (kecuali waktu tak pasti/staggered)"}.` });
			}
		}
		const kid = s.w < 40;
		const vol = kid ? (s.w < 20 ? [3 * s.w, 7 * s.w, 14 * s.w] : [100, 250, 500]) : [200, 500, 1000];
		const bags: [string, number, number, number][] = [["Kantong 1", 150, 1, vol[0]], ["Kantong 2", 50, 4, vol[1]], ["Kantong 3", 100, 16, vol[2]]];
		const tb = out.createDiv("fch-md-nac-bags");
		bags.forEach(([n, mgkg, h, v], i) => {
			const mg = mgkg * w;
			const b = tb.createDiv("fch-md-nac-bag");
			b.style.animationDelay = `${i * 0.1}s`;
			b.createDiv({ cls: "fch-small fch-muted", text: `${n} · ${mgkg} mg/kg dalam ${h} jam` });
			b.createDiv({ cls: "fch-md-nac-mg", text: `${num(Math.round(mg))} mg` });
			b.createDiv({ cls: "fch-small", text: `= ${num(Math.round((mg / s.conc) * 10) / 10)} mL NAC ${s.conc} mg/mL` });
			b.createDiv({ cls: "fch-small", text: `dalam ${num(Math.round(v))} mL dekstrosa 5%/NaCl 0,9% → ${num(Math.round(((v + mg / s.conc) / h) * 10) / 10)} mL/jam` });
		});
		out.createDiv({ cls: "fch-small fch-muted", text: `Total ${num(Math.round(300 * w))} mg selama 21 jam${s.w > 110 ? " (BB dihitung 110 kg)" : ""}. Periksa ALT, INR, kreatinin, dan kadar paracetamol menjelang akhir infus; lanjutkan kantong 3 bila ALT naik/INR > 1,3. Reaksi anafilaktoid (flushing, mengi) → hentikan sementara, antihistamin, lanjutkan dengan laju lebih lambat.` });
	};
	u();
}

// ================================================================ 3. KUIS FARMAKOLOGI
interface Q { kind: string; prompt: string; opts: string[]; ans: number; explain: string; drug?: string }
type QMode = "mix" | "gol" | "dosis" | "aman" | "ix";
export const QZ: { mode: QMode; cls: string; qs: Q[]; i: number; score: number; streak: number; picked: number | null; coins: number; done: boolean } = { mode: "mix", cls: "", qs: [], i: 0, score: 0, streak: 0, picked: null, coins: 0, done: false };
function resetQuiz() { QZ.qs = []; QZ.i = 0; QZ.score = 0; QZ.streak = 0; QZ.picked = null; QZ.coins = 0; QZ.done = false; }

const trimOpt = (s: string, n = 150) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
/** Bangun pilihan: 1 benar + 3 pengecoh unik (tidak identik/tidak saling memuat). */
function opts(correct: string, pool: string[]): { opts: string[]; ans: number } | null {
	const c = correct.trim();
	const lc = c.toLowerCase();
	const ds = shuffle([...new Set(pool.map((x) => x.trim()))].filter((x) => x && x.toLowerCase() !== lc && !x.toLowerCase().includes(lc) && !lc.includes(x.toLowerCase()))).slice(0, 3);
	if (ds.length < 3) return null;
	const o = shuffle([c, ...ds]);
	return { opts: o.map((x) => trimOpt(x)), ans: o.indexOf(c) };
}

function genQuestion(mode: QMode, pool: Drug[], used: Set<string>): Q | null {
	const kinds: Record<QMode, string[]> = { mix: ["cls", "ind", "se", "ci", "mech", "dose", "anti", "ix", "member", "tox"], gol: ["cls", "mech", "member", "pearl"], dosis: ["dose", "dose", "dosekid"], aman: ["se", "ci", "preg"], ix: ["ix", "anti", "tox"] };
	const kind = pickOne(kinds[mode]);
	const fresh = pool.filter((d) => !used.has(d.id));
	const d = pickOne(fresh.length ? fresh : pool);
	const others = DRUGS.filter((x) => x.id !== d.id);
	const diffCat = others.filter((x) => x.cat !== d.cat);
	const ex = (o: { opts: string[]; ans: number } | null, prompt: string, explain: string, drug?: string): Q | null => (o ? { kind, prompt, ...o, explain, drug } : null);
	switch (kind) {
		case "cls": return ex(opts(d.cls, others.filter((x) => classOfDrug(x)?.id !== classOfDrug(d)?.id).map((x) => x.cls)), `${d.name} termasuk golongan…`, `${d.name}: ${d.cls}.${d.mech ? " " + d.mech : ""}`, d.id);
		case "ind": { if (!d.ind.length) return null; const c = pickOne(d.ind); return ex(opts(c, diffCat.flatMap((x) => x.ind)), `Manakah indikasi ${d.name}?`, `Indikasi ${d.name}: ${d.ind.join("; ")}.`, d.id); }
		case "se": { if (!d.se.length) return null; const c = pickOne(d.se.slice(0, 3)); return ex(opts(c, diffCat.flatMap((x) => x.se).filter((s) => !d.se.some((y) => y.toLowerCase() === s.toLowerCase()))), `Efek samping yang khas dari ${d.name} adalah…`, `Efek samping ${d.name}: ${d.se.join(", ")}.`, d.id); }
		case "ci": { if (!d.ci.length) return null; const c = pickOne(d.ci.slice(0, 4)); return ex(opts(c, diffCat.flatMap((x) => x.ci).filter((s) => !d.ci.includes(s))), `Manakah yang merupakan kontraindikasi ${d.name}?`, `Kontraindikasi ${d.name}: ${d.ci.join("; ")}.`, d.id); }
		case "mech": { if (!d.mech) return null; return ex(opts(d.mech, others.filter((x) => x.cls !== d.cls && x.mech).map((x) => x.mech!)), `Mekanisme kerja ${d.name}?`, `${d.name} (${d.cls}): ${d.mech}`, d.id); }
		case "preg": {
			const bad = pool.filter((x) => /^kontraindikasi/i.test(x.preg));
			const safe = DRUGS.filter((x) => /dapat dipakai|dianjurkan|data keamanan baik|pilihan/i.test(x.preg) && !/hindari|kontraindikasi/i.test(x.preg));
			if (!bad.length || safe.length < 3) return null;
			const x = pickOne(bad);
			return ex(opts(x.name, safe.map((y) => y.name)), "Obat manakah yang KONTRAINDIKASI pada kehamilan?", `${x.name}: ${x.preg}`, x.id);
		}
		case "dose": case "dosekid": {
			const who = kind === "dosekid" ? "anak" : "dewasa";
			const cand = pool.flatMap((x) => x.regs.filter((r) => r.who === who && (r.kind === "fixed" || r.kind === "kg") && r.dose && r.dose[0] > 0).map((r) => [x, r] as const));
			if (!cand.length) return null;
			const [dx, r] = pickOne(cand);
			const u = r.unit ?? "mg";
			const fq = r.freq ?? 1;
			const rate = isRate(u);
			const fmt = (k: number) => `${range(r.dose![0] * k, r.dose![1] * k)} ${r.kind === "kg" ? perKgUnit(r) : u}${rate ? "" : " per kali"}${fq > 1 ? ` · ${fq}x sehari` : ""}`.replace("/kg/dosis per kali", "/kg per kali");
			const correct = fmt(1);
			const wrong = shuffle([10, 0.1, 4, 0.25, 3]).slice(0, 3).map(fmt);
			const o = shuffle([correct, ...wrong]);
			return { kind, prompt: `Dosis ${who} ${dx.name} untuk “${r.label}” (${r.route})?`,  opts: o.map((x) => trimOpt(x)), ans: o.indexOf(correct), explain: `${dx.name} — ${r.label}: ${correct} (${r.every ?? ""})${r.max ? ` (maks ${num(r.max)} ${u}/dosis)` : ""}${r.maxDay ? ` (maks ${num(r.maxDay)} ${u}/hari)` : ""}.`, drug: dx.id };
		}
		case "anti": {
			const cand = pool.filter((x) => x.antidote);
			if (!cand.length) return null;
			const x = pickOne(cand);
			const first = (s: string) => trimOpt(s.split(/[.;]/)[0].trim(), 90);
			return ex(opts(first(x.antidote!), DRUGS.filter((y) => y.antidote && y.id !== x.id).map((y) => first(y.antidote!)).concat(ANTIDOTES.map((a) => a.anti))), `Antidot / tata laksana toksisitas ${x.name}?`, `${x.name}: ${x.antidote}`, x.id);
		}
		case "tox": {
			const a = pickOne(ANTIDOTES);
			return ex(opts(a.anti, ANTIDOTES.filter((b) => b !== a).map((b) => b.anti)), `Antidot / terapi spesifik untuk: ${a.tox}?`, `${a.tox}: ${a.anti}. ${a.dose}`);
		}
		case "ix": {
			const ids = new Set(pool.map((x) => x.id));
			const rules = IX.filter((r) => !r.a.startsWith("@") && !r.b.startsWith("@") && (r.sev === "kontra" || r.sev === "mayor") && (ids.has(r.a) || ids.has(r.b)));
			if (!rules.length) return null;
			const r = pickOne(rules);
			const A = DRUGS.find((y) => y.id === r.a), B = DRUGS.find((y) => y.id === r.b);
			if (!A || !B) return null;
			return ex(opts(r.eff, IX.filter((y) => y.eff !== r.eff && y.sev !== "minor").map((y) => y.eff)), `Risiko utama kombinasi ${A.name} + ${B.name}?`, `${SEV_INFO[r.sev].icon} ${SEV_INFO[r.sev].label}: ${r.eff} ➜ ${r.act}`, A.id);
		}
		case "member": {
			const cs = CLASSES.filter((c) => membersOf(c).length >= 1);
			const c = QZ.cls ? CLASSES.find((k) => k.id === QZ.cls) ?? pickOne(cs) : pickOne(cs);
			const mem = membersOf(c);
			if (!mem.length) return null;
			const right = pickOne(mem);
			return ex(opts(right.name, DRUGS.filter((y) => !mem.includes(y)).map((y) => y.name)), `Obat manakah yang termasuk golongan ${c.name}?`, `${right.name} termasuk ${c.name}. Anggota lain: ${mem.filter((y) => y !== right).slice(0, 5).map((y) => y.name).join(", ") || "—"}.`, right.id);
		}
		case "pearl": {
			const c = QZ.cls ? CLASSES.find((k) => k.id === QZ.cls) ?? pickOne(CLASSES) : pickOne(CLASSES);
			return ex(opts(c.name, CLASSES.filter((k) => k !== c).map((k) => k.name)), `Mekanisme berikut milik golongan apa?\n“${trimOpt(c.mech, 220)}”`, `${c.name} — prototipe ${c.proto}. ${c.pearl}`);
		}
	}
	return null;
}

function buildRound(n = 10): Q[] {
	const cls = QZ.cls ? CLASSES.find((c) => c.id === QZ.cls) : undefined;
	const pool = cls ? membersOf(cls) : DRUGS;
	const out: Q[] = [];
	const used = new Set<string>();
	const seen = new Set<string>();
	for (let tries = 0; out.length < n && tries < n * 30; tries++) {
		const q = genQuestion(QZ.mode, pool.length ? pool : DRUGS, used);
		if (!q || seen.has(q.prompt)) continue;
		seen.add(q.prompt);
		if (q.drug) used.add(q.drug);
		out.push(q);
	}
	return out;
}

export function renderMedQuiz(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const m = med(p);
	const st = m.quiz!;
	hero(el, "Kuis Farmakologi", "Soal pilihan ganda yang dibuat otomatis dari database obat, golongan, interaksi, dan antidot. Setiap jawaban benar memberi koin.", "🎯", (t) => {
		const s0 = t.createDiv("fch-md-hero-stats");
		const s = (v: string, l: string) => { const x = s0.createDiv("fch-md-hstat"); x.createDiv({ cls: "fch-md-hstat-v", text: v }); x.createDiv({ cls: "fch-md-hstat-l", text: l }); };
		s(String(st.best), "rekor");
		s(String(st.played), "ronde");
		s(st.total ? `${Math.round((st.correct / st.total) * 100)}%` : "–", "akurasi");
	});
	const modes: [QMode, string][] = [["mix", "🎲 Campuran"], ["gol", "📚 Golongan & mekanisme"], ["dosis", "💊 Dosis"], ["aman", "🛡️ Keamanan"], ["ix", "⚡ Interaksi & antidot"]];
	const bar = el.createDiv("fch-md-qzbar");
	seg(bar.createDiv("fch-md-qzsegwrap"), modes, QZ.mode, (v) => { QZ.mode = v; resetQuiz(); window.setTimeout(() => hub.renderPage(), 200); }, "fch-md-qzseg");
	if (QZ.cls) {
		const c = CLASSES.find((k) => k.id === QZ.cls);
		const chip = bar.createDiv("fch-md-qzcls");
		chip.setText(`Fokus: ${c?.icon ?? ""} ${c?.name ?? QZ.cls}`);
		const x = chip.createEl("button", { cls: "fch-md-qzx", text: "✕", attr: { "aria-label": "Hapus fokus golongan" } });
		x.onclick = () => { QZ.cls = ""; resetQuiz(); hub.renderPage(); };
	}
	if (!QZ.qs.length) QZ.qs = buildRound();
	const stage = el.createDiv("fch-md-qz");
	if (!QZ.qs.length) { stage.createDiv({ cls: "fch-md-empty", text: "Soal tidak dapat dibuat untuk pilihan ini." }); return; }

	if (QZ.done) {
		const pct = QZ.score / QZ.qs.length;
		const end = stage.createDiv("fch-md-qzend");
		end.createDiv({ cls: "fch-md-qzend-ic", text: pct === 1 ? "🏆" : pct >= 0.7 ? "🎉" : pct >= 0.4 ? "👍" : "📖" });
		end.createEl("h2", { text: `${QZ.score} / ${QZ.qs.length} benar` });
		end.createDiv({ cls: "fch-md-p", text: pct === 1 ? "Sempurna! Hafalan obat Anda sangat kuat." : pct >= 0.7 ? "Bagus sekali — tinggal sedikit lagi." : pct >= 0.4 ? "Lumayan. Ulas obat yang terlewat lalu coba lagi." : "Jadikan ini daftar belajar: buka obat yang salah dan buat flashcard-nya." });
		end.createDiv({ cls: "fch-md-qzcoin", text: `🪙 +${QZ.coins} koin` });
		const wrong = QZ.qs.filter((q) => (q as Q & { got?: boolean }).got === false && q.drug);
		if (wrong.length) {
			const w = end.createDiv("fch-md-qzwrong");
			w.createDiv({ cls: "fch-small fch-muted", text: "Perlu diulas:" });
			for (const q of wrong) { const d = DRUGS.find((x) => x.id === q.drug); if (!d) continue; const b = w.createEl("button", { cls: "fch-md-rchip", text: `💊 ${d.name}` }); b.onclick = () => openDrug(hub, d.id); }
		}
		btn(end, { text: "Ronde baru", icon: "refresh-cw", cls: "fch-btn-primary fch-btn-lg", onClick: () => { resetQuiz(); hub.renderPage(); } });
		disclaimer(el);
		return;
	}

	const q = QZ.qs[QZ.i];
	const top = stage.createDiv("fch-md-qztop");
	top.createSpan({ cls: "fch-small", text: `Soal ${QZ.i + 1} dari ${QZ.qs.length}` });
	top.createDiv("fch-grow");
	top.createSpan({ cls: "fch-md-qzstreak" + (QZ.streak >= 3 ? " is-hot" : ""), text: `🔥 ${QZ.streak}` });
	top.createSpan({ cls: "fch-strong", text: `✅ ${QZ.score}` });
	const prog = stage.createDiv("fch-md-qzprog");
	prog.createDiv("fch-md-qzprog-fill").style.setProperty("--w", `${(QZ.i / QZ.qs.length) * 100}%`);
	const card = stage.createDiv("fch-md-qzcard");
	card.createDiv({ cls: "fch-md-qzq", text: q.prompt });
	const grid = card.createDiv("fch-md-qzopts");
	const fb = card.createDiv("fch-md-qzfb");
	const answered = QZ.picked !== null;
	q.opts.forEach((o, i) => {
		const b = grid.createEl("button", { cls: "fch-md-qzopt" });
		b.createSpan({ cls: "fch-md-qzopt-k", text: "ABCD"[i] });
		b.createSpan({ text: o });
		b.style.animationDelay = `${i * 0.06}s`;
		if (answered) {
			b.disabled = true;
			if (i === q.ans) b.addClass("is-right");
			else if (i === QZ.picked) b.addClass("is-wrong");
		}
		b.onclick = () => {
			if (QZ.picked !== null) return;
			QZ.picked = i;
			const ok = i === q.ans;
			(q as Q & { got?: boolean }).got = ok;
			st.total++;
			if (ok) { QZ.score++; QZ.streak++; st.correct++; const c = 3 + (QZ.streak >= 3 ? 2 : 0); QZ.coins += c; play("correct"); } else { QZ.streak = 0; play("wrong"); }
			p.requestSave();
			hub.renderPage();
		};
	});
	if (answered) {
		const ok = QZ.picked === q.ans;
		fb.addClass(ok ? "is-ok" : "is-bad");
		fb.createDiv({ cls: "fch-strong", text: ok ? pickOne(["Tepat sekali!", "Benar!", "Mantap!", "Betul, lanjut!"]) : `Kurang tepat — jawaban: ${"ABCD"[q.ans]}` });
		fb.createDiv({ cls: "fch-md-p", text: q.explain });
		const acts = fb.createDiv("fch-md-qzacts");
		if (q.drug) btn(acts, { text: "Buka obat", icon: "pill", cls: "fch-btn-sm", onClick: () => openDrug(hub, q.drug!) });
		const last = QZ.i === QZ.qs.length - 1;
		const next = btn(acts, { text: last ? "Lihat hasil" : "Soal berikutnya", icon: last ? "flag" : "arrow-right", cls: "fch-btn-primary", onClick: () => {
			if (last) {
				QZ.done = true;
				if (QZ.score === QZ.qs.length) QZ.coins += 10;
				st.played++;
				st.best = Math.max(st.best, QZ.score);
				p.addCoins(QZ.coins);
				p.requestSave();
				play(QZ.score >= QZ.qs.length * 0.7 ? "victory" : "chime");
				if (QZ.score === QZ.qs.length && p.data.settings.confetti) confetti(hub.mainEl);
				new Notice(`🎯 Kuis selesai: ${QZ.score}/${QZ.qs.length} · +${QZ.coins} koin`);
			} else { QZ.i++; QZ.picked = null; }
			hub.renderPage();
		} });
		window.setTimeout(() => next.focus(), 30);
	}
	disclaimer(el);
}

// ================================================================ 4. KALKULATOR KLINIS TAMBAHAN
type ToolFn = (icon: string, title: string, build: (body: HTMLElement, out: HTMLElement) => () => void) => void;
type ResFn = (out: HTMLElement, rows: [string, string, string?][]) => void;

export function moreTools(tool: ToolFn, res: ResFn, _pt: Patient) {
	tool("🧪", "Ekuivalensi kortikosteroid", (b, out) => {
		const s = { from: "prednison", dose: 40 };
		const f = b.createDiv("fch-md-field fch-md-field-wide");
		f.createEl("label", { text: "Dari" });
		const se = f.createEl("select", { cls: "dropdown fch-md-sel" });
		for (const x of STEROIDS) se.createEl("option", { text: x.name, attr: { value: x.id } });
		se.value = s.from;
		se.onchange = () => { s.from = se.value; u(); };
		field(b.createDiv("fch-md-row"), "Dosis per hari", s.dose, (v) => { s.dose = toNum(v); u(); }, { suffix: "mg" });
		const u = () => {
			const src = STEROIDS.find((x) => x.id === s.from)!;
			if (!(s.dose > 0)) return res(out, [["", "Isi dosis"]]);
			const pe = (s.dose / src.eq) * 5;
			res(out, [["Setara prednison", `${num(pe)} mg`, pe > 7.5 ? "is-amber" : ""], ...STEROIDS.filter((x) => x.id !== s.from).map((x) => [x.name, `${num((s.dose / src.eq) * x.eq)} mg · MK ${x.mc}`] as [string, string]), ["Catatan", "Ekuivalensi antiinflamasi (glukokortikoid). Efek mineralokortikoid berbeda; hidrokortison dipilih untuk insufisiensi adrenal."]]);
		};
		return u;
	});
	tool("🌙", "Konversi opioid", (b, out) => {
		const s = { from: "morfin-po", to: "oksikodon", dose: 60, red: 30 };
		const sel = (label: string, k: "from" | "to") => {
			const f = b.createDiv("fch-md-field fch-md-field-wide");
			f.createEl("label", { text: label });
			const se = f.createEl("select", { cls: "dropdown fch-md-sel" });
			for (const x of OPIOIDS) se.createEl("option", { text: `${x.name} (${x.unit})`, attr: { value: x.id } });
			se.value = s[k];
			se.onchange = () => { s[k] = se.value; u(); };
		};
		sel("Opioid saat ini", "from");
		const row = b.createDiv("fch-md-row");
		field(row, "Total per hari", s.dose, (v) => { s.dose = toNum(v); u(); });
		field(row, "Reduksi toleransi silang", s.red, (v) => { s.red = toNum(v); u(); }, { suffix: "%" });
		sel("Ganti ke", "to");
		const u = () => {
			const a = OPIOIDS.find((x) => x.id === s.from)!, z = OPIOIDS.find((x) => x.id === s.to)!;
			if (!(s.dose > 0)) return res(out, [["", "Isi dosis harian"]]);
			const ome = s.dose * a.f;
			const target = (ome / z.f) * (1 - Math.min(75, Math.max(0, s.red)) / 100);
			res(out, [["Ekuivalen morfin oral", `${num(ome)} mg/hari`, ome >= 90 ? "is-red" : ome >= 50 ? "is-amber" : ""], [`${z.name} (setelah reduksi ${num(s.red)}%)`, `${num(target)} ${z.unit}`], ...(z.id === "fentanil-td" ? [["Patch terdekat", `${[12, 25, 37, 50, 75, 100].reduce((p, c) => (Math.abs(c - target) < Math.abs(p - target) ? c : p), 12)} mcg/jam`] as [string, string]] : []), ["Dosis penyelamat (breakthrough)", `≈ ${num(ome / 6)} mg morfin oral (1/6 dosis harian) bila perlu`], ...(z.note ? [["Catatan", z.note] as [string, string]] : []), ["Peringatan", "Rasio bersifat perkiraan (BNF). Titrasi ulang sesuai respons; hati-hati pada lansia, gangguan ginjal/hati."]]);
		};
		return u;
	});
	for (const sc of SCORES) {
		tool(sc.icon, sc.name, (b, out) => {
			const on = new Set<number>();
			const wrap = b.createDiv("fch-md-score");
			sc.items.forEach((it, i) => {
				const r = wrap.createEl("label", { cls: "fch-md-scorerow" });
				const cb = r.createEl("input", { type: "checkbox" });
				r.createSpan({ cls: "fch-grow", text: it.t });
				r.createSpan({ cls: "fch-md-scorep" + (it.p < 0 ? " is-neg" : ""), text: it.p > 0 ? `+${it.p}` : String(it.p) });
				cb.onchange = () => { if (cb.checked) on.add(i); else on.delete(i); r.toggleClass("is-on", cb.checked); u(); };
			});
			const u = () => {
				const n = [...on].reduce((a, i) => a + sc.items[i].p, 0);
				const [t, cl] = sc.interp(n);
				res(out, [["Skor", String(n), cl], ["Interpretasi", t]]);
			};
			return u;
		});
	}
}
