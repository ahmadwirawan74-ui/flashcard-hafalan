/**
 * Pemeriksaan Fisik v22: 105 materi pemeriksaan fisik yang mencakup seluruh keterampilan pemeriksaan fisik
 * SKDI 2019 (Lampiran 3). Interaktif: checklist langkah, mode OSCE (ingat-ungkap + skor), kartu temuan
 * abnormal, kuis temuan, dokumentasi siap salin / kirim ke CPPT. Alur per sistem (Macleod) tetap tersedia.
 */
import type { HubView } from "./hub-view";
import { PF, PREP } from "./med-pf";
import { PFM, PfMat } from "./med-pf-skdi";
import { SKDI_SKILLS, SKDI_SYS } from "./med-skdi";
import { DISEASES } from "./med-dis";
import { copyText, disclaimer, med } from "./medis";
import { openDisease, pfFlowDetail } from "./medis3";
import { cpptPrefill } from "./med-cppt";
import { acc, chipRow, dayIndex, glance, heroCard, ibtn, mlist, nrm, sysColor } from "./med-ui";
import { play } from "./sound";
import { btn } from "./util";

export const PF_GROUPS: { id: string; name: string; icon: string; flow?: string }[] = [
	{ id: "umum", name: "Umum & tanda vital", icon: "🩺", flow: "umum" },
	{ id: "saraf", name: "Neurologi", icon: "🧠", flow: "neuro" },
	{ id: "psikiatri", name: "Psikiatri", icon: "🧩" },
	{ id: "mata", name: "Mata", icon: "👁️", flow: "mata" },
	{ id: "tht", name: "THT & leher", icon: "👂", flow: "tht" },
	{ id: "respirasi", name: "Respirasi", icon: "🫁", flow: "respirasi" },
	{ id: "kardio", name: "Kardiovaskular", icon: "🫀", flow: "kardio" },
	{ id: "abdomen", name: "Abdomen & urologi", icon: "🫃", flow: "abdomen" },
	{ id: "reproduksi", name: "Reproduksi & obstetri", icon: "🤰", flow: "obstetri" },
	{ id: "muskulo", name: "Muskuloskeletal", icon: "🦴", flow: "muskulo" },
	{ id: "kulit", name: "Kulit & kelamin", icon: "🧴", flow: "kulit" },
	{ id: "anak", name: "Anak & neonatus", icon: "👶", flow: "anak" },
	{ id: "forensik", name: "Forensik", icon: "⚖️" },
];
export const pfGroup = (id: string) => PF_GROUPS.find((g) => g.id === id) ?? PF_GROUPS[0];

/** Tingkat keterampilan klinis SKDI (berbeda dengan tingkat kemampuan penyakit). */
export const SKILL_LV: Record<string, { label: string; color: string }> = {
	"4": { label: "4 · Mampu mandiri", color: "#16a34a" },
	"3": { label: "3 · Di bawah supervisi", color: "#f59e0b" },
	"2": { label: "2 · Pernah melihat/demonstrasi", color: "#0ea5e9" },
	"1": { label: "1 · Mengetahui teori", color: "#64748b" },
};
const lvNorm = (l: string) => (l.startsWith("4") ? "4" : l.startsWith("3") ? "3" : l === "2" ? "2" : l === "1" ? "1" : "");
export function matLevel(x: PfMat): string {
	const ls = x.sk.map((i) => lvNorm(SKDI_SKILLS[i]?.[2] ?? "")).filter(Boolean);
	return ls.sort().reverse()[0] ?? "4";
}
function skillBadge(parent: HTMLElement, lv: string, long = false) {
	const L = SKILL_LV[lv] ?? SKILL_LV["4"];
	const b = parent.createSpan({ cls: "fch-dz-lvl", text: long ? `Keterampilan ${L.label}` : `K${lv}` });
	b.style.setProperty("--c", L.color);
	b.setAttr("title", `Tingkat keterampilan klinis SKDI 2019: ${L.label}`);
	return b;
}
/** Keterampilan SKDI → materi yang membahasnya. */
let SK2M: Map<number, PfMat> | null = null;
export function matForSkill(i: number) {
	if (!SK2M) { SK2M = new Map(); for (const x of PFM) for (const k of x.sk) if (!SK2M.has(k)) SK2M.set(k, x); }
	return SK2M.get(i);
}

// ---------------------------------------------------------------- state
const S = { q: "", g: "", lv: "", open: "", flow: "", tab: "langkah", osce: false, filt: "all" };
export function openPf(hub: HubView, flowId: string) { S.open = ""; S.flow = flowId; go(hub); }
export function openPfMat(hub: HubView, id: string, tab = "langkah") { S.flow = ""; S.open = id; S.tab = tab; S.osce = false; go(hub); }
const go = (hub: HubView) => (hub.page === "medpf" ? hub.renderPage() : hub.navigate("medpf"));
const STX = new Map<string, string>();
const stext = (x: PfMat) => { let t = STX.get(x.id); if (t === undefined) { t = nrm([x.name, x.goal, ...x.steps.map((s) => s[0]), ...x.abn.map((a) => a[0] + " " + a[1]), ...x.sk.map((i) => SKDI_SKILLS[i]?.[1] ?? "")].join(" ")); STX.set(x.id, t); } return t; };

function checks(hub: HubView, x: PfMat): Set<string> { return new Set((med(hub.plugin).notes[`pfm:${x.id}`] ?? "").split(",").filter(Boolean)); }

// ================================================================ daftar
export function renderMedPf(hub: HubView, el: HTMLElement) {
	if (S.flow) { const mod = PF.find((m) => m.id === S.flow); if (mod) return pfFlowDetail(hub, el, mod, () => { S.flow = ""; hub.renderPage(); }); S.flow = ""; }
	const cur = S.open ? PFM.find((x) => x.id === S.open) : undefined;
	if (cur) return matDetail(hub, el, cur);
	const m = med(hub.plugin);
	const done = m.pfDone ?? {};
	const best = m.pfBest ?? {};
	const head = el.createDiv("fch-mx-pagehead");
	const ht = head.createDiv("fch-grow");
	ht.createEl("h2", { text: "🫀 Pemeriksaan Fisik" });
	const nSk = new Set(PFM.flatMap((x) => x.sk)).size;
	ht.createDiv({ cls: "fch-small fch-muted", text: `${PFM.length} materi · ${nSk} keterampilan klinis SKDI 2019 · ${PFM.reduce((a, x) => a + x.steps.length, 0)} langkah` });
	ibtn(head, "shuffle", "Acak", () => openPfMat(hub, PFM[Math.floor(Math.random() * PFM.length)].id));
	ibtn(head, "timer", "OSCE acak", () => { const x = PFM[Math.floor(Math.random() * PFM.length)]; openPfMat(hub, x.id); S.osce = true; hub.renderPage(); }, "fch-pf-osce-rand");

	// ringkasan progres
	const nDone = PFM.filter((x) => done[x.id]).length;
	const prog = el.createDiv("fch-mx-progress");
	const pt = prog.createDiv("fch-mx-progress-t");
	pt.createSpan({ cls: "fch-strong", text: `✅ ${nDone}/${PFM.length} dikuasai` });
	const bs = Object.values(best);
	pt.createSpan({ cls: "fch-small fch-muted", text: bs.length ? `OSCE: ${bs.length} materi · rata-rata ${Math.round(bs.reduce((a, b) => a + b, 0) / bs.length)}%` : "Belum ada latihan OSCE" });
	prog.createDiv("fch-mx-bar").createDiv("fch-mx-bar-f").style.width = `${(nDone / PFM.length) * 100}%`;
	const tday = PFM[dayIndex(PFM.length, 3)];
	const td = prog.createEl("button", { cls: "fch-mx-today" });
	td.createSpan({ text: "🎯 Latihan hari ini: " });
	td.createSpan({ cls: "fch-strong", text: tday.name });
	td.onclick = () => openPfMat(hub, tday.id);

	const box = el.createDiv("fch-md-search fch-mx-search");
	box.createSpan({ cls: "fch-md-search-ic", text: "🔎" });
	const inp = box.createEl("input", { type: "text", cls: "fch-md-search-in", attr: { placeholder: "Cari pemeriksaan, tanda, atau temuan… (mis. Lasègue, JVP, refleks, ronki)" } });
	inp.value = S.q;
	chipRow(el, [{ id: "all", label: "Semua", icon: "✨" }, { id: "todo", label: "Belum dikuasai", icon: "⏳" }, { id: "done", label: "Dikuasai", icon: "✅" }, { id: "osce", label: "Pernah OSCE", icon: "⏱️" }], S.filt, (v) => { S.filt = v; draw(); }, "fch-pf-filt");
	chipRow(el, [{ id: "", label: "Semua sistem", icon: "🧭", n: PFM.length }, ...PF_GROUPS.map((g) => ({ id: g.id, label: g.name, icon: g.icon, n: PFM.filter((x) => x.g === g.id).length, color: sysColor(g.id) }))], S.g, (v) => { S.g = v; draw(); }, "fch-pf-groups");
	chipRow(el, [{ id: "", label: "Semua tingkat" }, ...["4", "3", "2", "1"].map((k) => ({ id: k, label: SKILL_LV[k].label, color: SKILL_LV[k].color, n: PFM.filter((x) => matLevel(x) === k).length })).filter((c) => c.n > 0)], S.lv, (v) => { S.lv = v; draw(); }, "fch-pf-lvls");
	const grid = el.createDiv("fch-pf-mgrid");
	const draw = () => {
		grid.empty();
		const q = nrm(S.q);
		let xs = PFM.filter((x) => (!S.g || x.g === S.g) && (!S.lv || matLevel(x) === S.lv));
		if (S.filt === "todo") xs = xs.filter((x) => !done[x.id]);
		else if (S.filt === "done") xs = xs.filter((x) => done[x.id]);
		else if (S.filt === "osce") xs = xs.filter((x) => best[x.id] !== undefined);
		if (q) { const ws = q.split(" "); xs = xs.map((x) => ({ x, s: ws.every((w) => nrm(x.name).includes(w)) ? 2 : ws.every((w) => stext(x).includes(w)) ? 1 : 0 })).filter((r) => r.s).sort((a, b) => b.s - a.s).map((r) => r.x); }
		grid.createDiv({ cls: "fch-small fch-muted fch-pf-count", text: `${xs.length} materi` });
		if (!xs.length) grid.createDiv({ cls: "fch-md-empty", text: "Tidak ditemukan. Coba kata lain." });
		let lastG = "";
		for (const x of xs) {
			const g = pfGroup(x.g);
			if (!q && !S.g && x.g !== lastG) { grid.createDiv({ cls: "fch-dz-cat fch-pf-gh", text: `${g.icon} ${g.name}` }); lastG = x.g; }
			const c = grid.createEl("button", { cls: "fch-pf-mcard" + (done[x.id] ? " is-done" : "") });
			c.style.setProperty("--c", sysColor(x.g));
			const top = c.createDiv("fch-pf-mcard-top");
			top.createSpan({ cls: "fch-pf-mcard-ic", text: g.icon });
			skillBadge(top, matLevel(x));
			if (done[x.id]) top.createSpan({ cls: "fch-pf-mcard-ok", text: "✓" });
			c.createDiv({ cls: "fch-pf-mcard-t", text: x.name });
			const n = checks(hub, x).size;
			const meta = c.createDiv("fch-pf-mcard-s");
			meta.createSpan({ text: `${x.steps.length} langkah · ${x.abn.length} temuan` });
			if (best[x.id] !== undefined) meta.createSpan({ cls: "fch-pf-mcard-osce", text: `⏱️ ${best[x.id]}%` });
			const bar = c.createDiv("fch-mx-bar is-thin");
			bar.createDiv("fch-mx-bar-f").style.width = `${done[x.id] ? 100 : (n / x.steps.length) * 100}%`;
			c.onclick = () => openPfMat(hub, x.id);
		}
	};
	inp.oninput = () => { S.q = inp.value; draw(); };
	draw();

	const fl = acc(el, "🧭", `Alur pemeriksaan per sistem — head-to-toe (${PF.length} modul, Macleod)`, false);
	const fg = fl.createDiv("fch-pf-grid");
	for (const x of PF) {
		const b = fg.createEl("button", { cls: "fch-pf-card" });
		b.style.setProperty("--c", x.color);
		b.createSpan({ cls: "fch-pf-ic", text: x.icon });
		const t = b.createDiv("fch-grow");
		t.createDiv({ cls: "fch-strong", text: x.name });
		t.createDiv({ cls: "fch-small fch-muted", text: `${x.sections.length} bagian · ${x.sections.reduce((a, s) => a + s.steps.length, 0)} langkah` });
		b.onclick = () => openPf(hub, x.id);
	}
	const sk = acc(el, "📋", "Daftar keterampilan klinis SKDI 2019 (Lampiran 3) → materi", false);
	sk.createDiv({ cls: "fch-small fch-muted", text: "Keterampilan pemeriksaan fisik bertanda ✓ memiliki materi lengkap di sini; ketuk untuk membuka. Keterampilan penunjang/prosedur tercantum sebagai rujukan." });
	for (const sys of SKDI_SYS) {
		const rows = SKDI_SKILLS.map((r, i) => [r, i] as const).filter(([r]) => r[0] === sys.id || (sys.id === "forensik" && false));
		if (!rows.length) continue;
		const d = sk.createEl("details", { cls: "fch-md-det" });
		const nCov = rows.filter(([, i]) => matForSkill(i)).length;
		d.createEl("summary", { text: `${sys.icon} ${sys.name} — ${nCov} bermateri / ${rows.length}` });
		const t = d.createDiv("fch-pf-skills");
		for (const [[, name, lvl], i] of rows) {
			const mt = matForSkill(i);
			const r = t.createEl(mt ? "button" : "div", { cls: "fch-pf-skill" + (mt ? " is-link" : "") });
			r.createDiv({ cls: "fch-grow", text: (mt ? "✓ " : "") + name });
			if (lvNorm(lvl)) skillBadge(r, lvNorm(lvl));
			if (mt) r.onclick = () => openPfMat(hub, mt.id);
		}
	}
	disclaimer(el);
}

// ================================================================ detail materi
const TABS: [string, string, string][] = [["langkah", "Langkah", "🧭"], ["temuan", "Temuan", "🔍"], ["doc", "Dokumentasi", "📝"], ["skdi", "SKDI & terkait", "🎯"]];

function matDetail(hub: HubView, el: HTMLElement, x: PfMat) {
	const p = hub.plugin;
	const m = med(p);
	m.pfDone ??= {}; m.pfBest ??= {};
	const g = pfGroup(x.g);
	const color = sysColor(x.g);
	const seq = PFM.filter((y) => y.g === x.g);
	const at = seq.indexOf(x);
	const prev = seq[at - 1], next = seq[at + 1];
	el.addClass("fch-mx-page");
	const top = el.createDiv("fch-dz-dtop fch-mx-top");
	btn(top, { icon: "arrow-left", text: "Semua materi", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { S.open = ""; hub.renderPage(); } });
	const nav = top.createDiv("fch-mx-nav");
	const pb = ibtn(nav, "chevron-left", prev ? `Sebelumnya: ${prev.name}` : "Sebelumnya", () => prev && openPfMat(hub, prev.id, S.tab), "fch-mx-only-ic"); pb.disabled = !prev;
	nav.createSpan({ cls: "fch-small fch-muted", text: `${at + 1}/${seq.length}` });
	const nb = ibtn(nav, "chevron-right", next ? `Berikutnya: ${next.name}` : "Berikutnya", () => next && openPfMat(hub, next.id, S.tab), "fch-mx-only-ic"); nb.disabled = !next;
	top.createDiv("fch-grow");
	ibtn(top, "timer", S.osce ? "Tutup OSCE" : "Mode OSCE", () => { S.osce = !S.osce; hub.renderPage(); }, "fch-pf-osce-btn" + (S.osce ? " is-on" : ""));
	ibtn(top, "copy", "Salin dokumentasi", () => copyText(docText(hub, x), "Dokumentasi pemeriksaan disalin"));
	ibtn(top, "clipboard-plus", "Kirim ke CPPT", () => cpptPrefill(hub, { o: docText(hub, x) }), "fch-pf-tocppt");

	const { chips } = heroCard(el, { color, emoji: g.icon, kicker: `Pemeriksaan fisik · ${g.name}`, title: x.name, titleCls: "fch-pf-title", sub: x.goal });
	skillBadge(chips, matLevel(x), true);
	chips.createSpan({ cls: "fch-mx-pill", text: `🧭 ${x.steps.length} langkah` });
	chips.createSpan({ cls: "fch-mx-pill", text: `🔍 ${x.abn.length} temuan` });
	if (m.pfBest[x.id] !== undefined) chips.createSpan({ cls: "fch-mx-pill", text: `⏱️ OSCE terbaik ${m.pfBest[x.id]}%` });

	if (S.osce) return osce(hub, el, x);

	glance(el, [
		{ icon: "🧰", label: "Alat", text: x.tools.join(" • ") || "Tangan pemeriksa" },
		{ icon: "✅", label: "Normal", text: x.normal.join(" ") },
		{ icon: "⭐", label: "Poin kunci OSCE", text: x.key.join(" • "), tone: "is-amber" },
	]);

	const tabs = el.createDiv("fch-dz-tabs fch-mx-tabs");
	const body = el.createDiv("fch-dz-body fch-pf-body");
	for (const [id, label, ic] of TABS) {
		const b = tabs.createEl("button", { cls: "fch-dz-tab" + (S.tab === id ? " is-on" : "") });
		b.createSpan({ cls: "fch-mx-tab-ic", text: ic });
		b.createSpan({ text: label });
		b.onclick = () => { S.tab = id; tabs.querySelectorAll(".fch-dz-tab").forEach((t) => t.removeClass("is-on")); b.addClass("is-on"); draw(); };
	}
	const draw = () => {
		body.empty();
		if (S.tab === "langkah") stepsTab(hub, body, x);
		else if (S.tab === "temuan") findingsTab(body, x);
		else if (S.tab === "doc") docTab(hub, body, x);
		else skdiTab(hub, body, x);
	};
	draw();
	if (prev || next) {
		const pn = el.createDiv("fch-mx-prevnext");
		for (const [y, lbl, cls] of [[prev, "← Sebelumnya", "is-prev"], [next, "Berikutnya →", "is-next"]] as const) {
			if (!y) { pn.createDiv(); continue; }
			const b = pn.createEl("button", { cls: "fch-mx-pn " + cls });
			b.createDiv({ cls: "fch-small fch-muted", text: lbl });
			b.createDiv({ cls: "fch-strong", text: y.name });
			b.onclick = () => openPfMat(hub, y.id, S.tab);
		}
	}
	disclaimer(el);
}

function stepsTab(hub: HubView, body: HTMLElement, x: PfMat) {
	const p = hub.plugin;
	const m = med(p);
	const key = `pfm:${x.id}`;
	const done = checks(hub, x);
	const pr = acc(body, "🤝", "Persiapan", false);
	mlist(pr, [...PREP, ...x.prep]);
	if (x.tools.length) mlist(acc(body, "🧰", "Alat & bahan", false), x.tools);
	const box = acc(body, "🧭", "Langkah pemeriksaan", true, "is-accent");
	const progT = box.createDiv("fch-pf-prog");
	const bar = progT.createDiv("fch-mx-bar");
	const fill = bar.createDiv("fch-mx-bar-f");
	const lbl = progT.createSpan({ cls: "fch-small fch-strong" });
	const upd = () => {
		const n = x.steps.filter((_, i) => done.has(String(i))).length;
		fill.style.width = `${(n / x.steps.length) * 100}%`;
		lbl.setText(`${n}/${x.steps.length}`);
		if (n === x.steps.length && !m.pfDone![x.id]) { m.pfDone![x.id] = Date.now(); play("chime"); }
	};
	const ol = box.createEl("ol", { cls: "fch-pf-steps fch-pf-msteps" });
	x.steps.forEach(([t, how], i) => {
		const li = ol.createEl("li", { cls: done.has(String(i)) ? "is-done" : "" });
		const lab = li.createEl("label", { cls: "fch-pf-step" });
		const cb = lab.createEl("input", { type: "checkbox" });
		cb.checked = done.has(String(i));
		const tx = lab.createDiv("fch-grow");
		tx.createDiv({ cls: "fch-strong", text: t });
		if (how) tx.createDiv({ cls: "fch-small fch-pf-how", text: how });
		cb.onchange = () => { if (cb.checked) done.add(String(i)); else done.delete(String(i)); li.toggleClass("is-done", cb.checked); m.notes[key] = [...done].join(","); upd(); p.requestSave(); };
	});
	upd();
	const act = box.createDiv("fch-dz-links");
	btn(act, { text: m.pfDone![x.id] ? "✓ Dikuasai" : "Tandai dikuasai", icon: "check-circle", cls: "fch-btn-sm" + (m.pfDone![x.id] ? " fch-btn-primary" : ""), onClick: () => { if (m.pfDone![x.id]) delete m.pfDone![x.id]; else m.pfDone![x.id] = Date.now(); p.requestSave(); hub.renderPage(); } });
	btn(act, { text: "Reset centang", icon: "rotate-ccw", cls: "fch-btn-sm", onClick: () => { m.notes[key] = ""; delete m.pfDone![x.id]; p.requestSave(); hub.renderPage(); } });
	btn(act, { text: "Latihan OSCE", icon: "timer", cls: "fch-btn-sm", onClick: () => { S.osce = true; hub.renderPage(); } });
	if (x.key.length) mlist(acc(body, "⭐", "Poin kritis (penilaian OSCE)", true, "is-amber"), x.key);
	if (x.tips.length) mlist(acc(body, "💡", "Tips klinis", false), x.tips);
}

function findingsTab(body: HTMLElement, x: PfMat) {
	const n = acc(body, "✅", "Temuan normal", true, "is-accent");
	mlist(n, x.normal);
	const ab = acc(body, "🔍", `Temuan abnormal → makna klinis (${x.abn.length})`, true);
	ab.createDiv({ cls: "fch-small fch-muted", text: "Ketuk kartu untuk membalik dan melihat maknanya. Coba tebak dulu!" });
	const grid = ab.createDiv("fch-pf-flips");
	for (const [a, b] of x.abn) {
		const c = grid.createEl("button", { cls: "fch-pf-flip" });
		const inner = c.createDiv("fch-pf-flip-in");
		const f = inner.createDiv("fch-pf-flip-f");
		f.createDiv({ cls: "fch-pf-flip-k", text: "Temuan" });
		f.createDiv({ text: a });
		const bk = inner.createDiv("fch-pf-flip-b");
		bk.createDiv({ cls: "fch-pf-flip-k", text: "Makna" });
		bk.createDiv({ text: b });
		c.onclick = () => c.toggleClass("is-flipped", !c.hasClass("is-flipped"));
	}
	const rw = ab.createDiv("fch-dz-links");
	btn(rw, { text: "Balik semua", icon: "repeat", cls: "fch-btn-sm", onClick: () => { const all = [...grid.querySelectorAll(".fch-pf-flip")]; const any = all.some((c) => !c.hasClass("is-flipped")); all.forEach((c) => c.toggleClass("is-flipped", any)); } });
	// kuis temuan
	const qz = acc(body, "🎯", "Kuis temuan (5 soal)", false);
	const start = () => quiz(qz, x);
	btn(qz.createDiv("fch-dz-links"), { text: "Mulai kuis", icon: "play", cls: "fch-btn-primary fch-btn-sm fch-pf-qstart", onClick: start });
}

function quiz(host: HTMLElement, x: PfMat) {
	const pool = PFM.filter((y) => y.g === x.g).flatMap((y) => y.abn);
	const others = PFM.flatMap((y) => y.abn);
	const qs = [...x.abn].sort(() => Math.random() - 0.5).slice(0, Math.min(5, x.abn.length));
	let i = 0, score = 0;
	const show = () => {
		host.empty();
		if (i >= qs.length) {
			const r = host.createDiv("fch-pf-qres");
			r.createDiv({ cls: "fch-pf-qscore", text: `${score}/${qs.length}` });
			r.createDiv({ cls: "fch-small", text: score === qs.length ? "Sempurna! 🎉" : score >= qs.length * 0.6 ? "Bagus, ulangi yang salah." : "Pelajari lagi kartu temuan di atas." });
			if (score === qs.length) play("chime");
			btn(host.createDiv("fch-dz-links"), { text: "Ulangi", icon: "rotate-ccw", cls: "fch-btn-sm", onClick: () => quiz(host, x) });
			return;
		}
		const [a, b] = qs[i];
		host.createDiv({ cls: "fch-small fch-muted", text: `Soal ${i + 1}/${qs.length}` });
		host.createDiv({ cls: "fch-pf-qq", text: `Temuan: ${a}` });
		host.createDiv({ cls: "fch-small", text: "Apa makna klinisnya?" });
		const wrong = [...new Set([...pool, ...others].map((y) => y[1]).filter((y) => y !== b))].sort(() => Math.random() - 0.5).slice(0, 3);
		const opts = [b, ...wrong].sort(() => Math.random() - 0.5);
		const box = host.createDiv("fch-pf-qopts");
		for (const o of opts) {
			const ob = box.createEl("button", { cls: "fch-pf-qopt", text: o });
			ob.onclick = () => {
				box.querySelectorAll("button").forEach((z) => { (z as HTMLButtonElement).disabled = true; if (z.textContent === b) z.addClass("is-right"); });
				if (o === b) { score++; play("correct"); } else { ob.addClass("is-wrong"); play("wrong"); }
				window.setTimeout(() => { i++; show(); }, 1100);
			};
		}
	};
	show();
}

export function docText(hub: HubView, x: PfMat): string {
	const v = med(hub.plugin).notes[`pfdoc:${x.id}`];
	return v?.trim() ? v : x.doc;
}
function docTab(hub: HubView, body: HTMLElement, x: PfMat) {
	const p = hub.plugin;
	const m = med(p);
	const c = acc(body, "📝", "Templat dokumentasi (rekam medis/CPPT)", true, "is-accent");
	c.createDiv({ cls: "fch-small fch-muted", text: "Ubah sesuai temuan pasien. Perubahan Anda disimpan sebagai templat pribadi untuk materi ini." });
	const ta = c.createEl("textarea", { cls: "fch-md-note fch-pf-doc" });
	ta.value = docText(hub, x);
	ta.oninput = () => { m.notes[`pfdoc:${x.id}`] = ta.value; p.requestSave(); };
	const act = c.createDiv("fch-dz-links");
	btn(act, { text: "Salin", icon: "copy", cls: "fch-btn-primary fch-btn-sm", onClick: () => copyText(ta.value, "Dokumentasi disalin") });
	btn(act, { text: "Kirim ke CPPT (O)", icon: "clipboard-plus", cls: "fch-btn-sm", onClick: () => cpptPrefill(hub, { o: ta.value }) });
	btn(act, { text: "Kembalikan templat asli", icon: "rotate-ccw", cls: "fch-btn-sm", onClick: () => { delete m.notes[`pfdoc:${x.id}`]; p.requestSave(); ta.value = x.doc; } });
	const ab = acc(body, "🧩", "Sisipkan kalimat temuan abnormal", false);
	const w = ab.createDiv("fch-dz-links");
	for (const [a] of x.abn) { const b = w.createEl("button", { cls: "fch-md-rchip is-link", text: `+ ${a}` }); b.onclick = () => { ta.value = `${ta.value.trimEnd()}\n${a}.`; ta.dispatchEvent(new Event("input")); }; }
}

function skdiTab(hub: HubView, body: HTMLElement, x: PfMat) {
	const k = acc(body, "🎯", `Keterampilan klinis SKDI 2019 yang dicakup (${x.sk.length})`, true, "is-accent");
	for (const i of x.sk) {
		const r = SKDI_SKILLS[i];
		if (!r) continue;
		const row = k.createDiv("fch-pf-skill");
		row.createDiv({ cls: "fch-grow", text: `${SKDI_SYS.find((s) => s.id === r[0])?.icon ?? ""} ${r[1]}` });
		if (lvNorm(r[2])) skillBadge(row, lvNorm(r[2]), true);
	}
	const dz = x.dz.map((id) => DISEASES.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => !!d);
	const rel = DISEASES.filter((d) => !x.dz.includes(d.id) && d.pf.some((t) => { const n = nrm(t); return nrm(x.name).split(" ").filter((w) => w.length > 5).some((w) => n.includes(w)); })).slice(0, 8);
	if (dz.length || rel.length) {
		const s = acc(body, "🩺", "Penyakit terkait", true);
		const w = s.createDiv("fch-dz-links");
		for (const d of [...dz, ...rel]) { const b = w.createEl("button", { cls: "fch-md-rchip is-link", text: d.name }); b.onclick = () => openDisease(hub, d.id, "dx"); }
	}
	const g = pfGroup(x.g);
	if (g.flow) {
		const mod = PF.find((y) => y.id === g.flow);
		if (mod) { const s = acc(body, "🧭", "Alur pemeriksaan sistem (head-to-toe)", true); btn(s, { text: `${mod.icon} ${mod.name}`, cls: "fch-btn-sm", onClick: () => openPf(hub, mod.id) }); }
	}
	body.createDiv({ cls: "fch-small fch-muted", text: "Materi ditulis ulang dengan bahasa sendiri merujuk Macleod's Clinical Examination 15th ed., Bates' Guide to Physical Examination, dan modul keterampilan klinis; tingkat keterampilan sesuai SKDI 2019 (KKI)." });
}

// ================================================================ mode OSCE
function osce(hub: HubView, el: HTMLElement, x: PfMat) {
	const p = hub.plugin;
	const m = med(p);
	const box = el.createDiv("fch-pf-osce");
	const hd = box.createDiv("fch-pf-osce-h");
	hd.createDiv({ cls: "fch-strong", text: "⏱️ Mode OSCE — ingat & ungkap" });
	const clock = hd.createDiv({ cls: "fch-pf-clock", text: "00:00" });
	box.createDiv({ cls: "fch-small fch-muted", text: "Sebutkan (atau peragakan) tiap langkah secara berurutan, lalu ketuk untuk membuka dan nilai diri: Ingat ✓ atau Lupa ✗. Target waktu ±5–7 menit." });
	const t0 = Date.now();
	const tick = window.setInterval(() => { if (!clock.isConnected) { window.clearInterval(tick); return; } const s = Math.floor((Date.now() - t0) / 1000); clock.setText(`${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`); clock.toggleClass("is-over", s > 420); }, 500);
	const res: (boolean | null)[] = x.steps.map(() => null);
	const ol = box.createEl("ol", { cls: "fch-pf-osce-list" });
	const sumEl = box.createDiv("fch-pf-osce-sum");
	const finish = box.createDiv("fch-dz-links");
	const upd = () => {
		const ans = res.filter((r) => r !== null).length;
		const ok = res.filter((r) => r === true).length;
		sumEl.setText(`${ans}/${x.steps.length} dinilai · ${ok} ingat`);
		fb.disabled = ans < x.steps.length;
	};
	x.steps.forEach(([t, how], i) => {
		const li = ol.createEl("li", { cls: "fch-pf-osce-item" });
		const hid = li.createEl("button", { cls: "fch-pf-osce-hid", text: `Langkah ${i + 1} — ketuk untuk membuka` });
		const shown = li.createDiv("fch-pf-osce-shown");
		shown.createDiv({ cls: "fch-strong", text: t });
		if (how) shown.createDiv({ cls: "fch-small fch-muted", text: how });
		const rb = shown.createDiv("fch-pf-osce-rate");
		const y = rb.createEl("button", { cls: "fch-pf-osce-y", text: "✓ Ingat" });
		const n = rb.createEl("button", { cls: "fch-pf-osce-n", text: "✗ Lupa" });
		y.onclick = () => { res[i] = true; li.removeClass("is-miss"); li.addClass("is-ok"); upd(); };
		n.onclick = () => { res[i] = false; li.removeClass("is-ok"); li.addClass("is-miss"); upd(); };
		hid.onclick = () => li.addClass("is-open");
	});
	const fb = btn(finish, { text: "Selesai & hitung skor", icon: "flag", cls: "fch-btn-primary fch-pf-osce-done", onClick: () => {
		window.clearInterval(tick);
		const ok = res.filter((r) => r === true).length;
		const pct = Math.round((ok / x.steps.length) * 100);
		const secs = Math.floor((Date.now() - t0) / 1000);
		m.pfBest ??= {};
		const prevBest = m.pfBest[x.id];
		m.pfBest[x.id] = Math.max(prevBest ?? 0, pct);
		if (pct === 100) { m.pfDone ??= {}; m.pfDone[x.id] ??= Date.now(); }
		p.requestSave();
		play(pct >= 80 ? "chime" : "click");
		finish.empty();
		const r = finish.createDiv("fch-pf-qres");
		r.createDiv({ cls: "fch-pf-qscore", text: `${pct}%` });
		r.createDiv({ cls: "fch-small", text: `${ok}/${x.steps.length} langkah diingat · waktu ${Math.floor(secs / 60)}m ${secs % 60}d${prevBest !== undefined && pct > prevBest ? " · rekor baru! 🎉" : ""}` });
		const missed = x.steps.filter((_, i) => res[i] === false).map((s) => s[0]);
		if (missed.length) { r.createDiv({ cls: "fch-small fch-strong", text: "Perlu diulang:" }); mlist(r, missed); }
		if (x.key.length) { r.createDiv({ cls: "fch-small fch-strong", text: "Poin kritis penguji:" }); mlist(r, x.key); }
		const a = finish.createDiv("fch-dz-links");
		btn(a, { text: "Ulangi OSCE", icon: "rotate-ccw", cls: "fch-btn-sm", onClick: () => hub.renderPage() });
		btn(a, { text: "Kembali ke materi", icon: "book-open", cls: "fch-btn-sm", onClick: () => { S.osce = false; hub.renderPage(); } });
		btn(a, { text: "OSCE acak berikutnya", icon: "shuffle", cls: "fch-btn-sm", onClick: () => { const y = PFM[Math.floor(Math.random() * PFM.length)]; S.open = y.id; hub.renderPage(); } });
	} });
	upd();
}
