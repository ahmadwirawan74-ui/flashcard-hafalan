/**
 * Beranda Medis v22: satu pintu untuk Penyakit, Obat, Pemeriksaan Fisik, CPPT, dan alat klinis.
 * Pencarian universal, ubin utama, lanjutkan, kartu hari ini (flip), dan ringkasan pasien CPPT.
 */
import { setIcon } from "obsidian";
import type { HubView, Page } from "./hub-view";
import { PAGES } from "./hub-view";
import { DISEASES } from "./med-dis";
import { searchDrugs } from "./med-engine";
import { PFM } from "./med-pf-skdi";
import { SKDI_ROWS } from "./med-skdi";
import { allDrugs, catOf, disclaimer, drugById, med, openDrug } from "./medis";
import { openDisease } from "./medis3";
import { openPfMat, pfGroup } from "./med-pfui";
import { cppt, cpptOpenPatient } from "./med-cppt";
import { dayIndex, firstSentence, nrm, sysColor } from "./med-ui";

const TOOLS: [Page, string, string][] = [
	["medresep", "📝", "#0ea5e9"], ["medcalc", "🧮", "#0d9488"], ["medinter", "⚡", "#f59e0b"], ["medtools", "📐", "#6366f1"],
	["medemerg", "🚑", "#e11d48"], ["medclass", "📚", "#8b5cf6"], ["medtox", "☠️", "#475569"], ["medquiz", "🎯", "#db2777"],
];
let Q = "";

export function renderMedHome(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const m = med(p);
	const c = cppt(hub);
	const drugs = allDrugs(p);
	el.addClass("fch-mh");

	// ---- hero
	const hero = el.createDiv("fch-mh-hero");
	const ecg = hero.createDiv("fch-mh-ecg");
	const NS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("viewBox", "0 0 600 60"); svg.setAttribute("preserveAspectRatio", "none");
	const path = document.createElementNS(NS, "path");
	path.setAttribute("d", "M0 30 H140 L152 30 L160 14 L168 46 L176 8 L186 52 L194 30 H380 L392 30 L400 14 L408 46 L416 8 L426 52 L434 30 H600");
	svg.appendChild(path); ecg.appendChild(svg);
	const h = new Date().getHours();
	const greet = h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
	const dn = m.doc?.name ? (m.doc.name.toLowerCase().startsWith("dr") ? m.doc.name : `dr. ${m.doc.name}`) : "dokter";
	const ht = hero.createDiv("fch-mh-hero-t");
	ht.createDiv({ cls: "fch-mh-kicker", text: new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" }) });
	ht.createEl("h1", { text: `${greet}, ${dn} 🩺` });
	const st = ht.createDiv("fch-mh-stats");
	const stat = (v: string, l: string) => { const x = st.createDiv("fch-mh-stat"); x.createSpan({ cls: "fch-mh-stat-v", text: v }); x.createSpan({ cls: "fch-mh-stat-l", text: l }); };
	stat(String(SKDI_ROWS.length), "penyakit");
	stat(String(drugs.length), "obat");
	stat(String(PFM.length), "materi PF");
	stat(String(c.patients.filter((x) => !x.done).length), "pasien aktif");

	// ---- pencarian universal
	const sw = el.createDiv("fch-mh-searchwrap");
	const box = sw.createDiv("fch-md-search fch-mx-search fch-mh-search");
	setIcon(box.createSpan("fch-md-search-ic"), "search");
	const inp = box.createEl("input", { type: "text", cls: "fch-md-search-in fch-mh-q", attr: { placeholder: "Cari apa saja: penyakit, obat, pemeriksaan, alat, pasien… (mis. pneumonia, amoksisilin, JVP)" } });
	inp.value = Q;
	const res = sw.createDiv("fch-mh-res");
	let first: (() => void) | null = null;
	const draw = () => {
		res.empty(); first = null;
		const q = nrm(Q);
		res.toggleClass("is-open", q.length >= 2);
		if (q.length < 2) return;
		const ws = q.split(" ");
		const groups: [string, { t: string; s: string; ic: string; c: string; go: () => void }[]][] = [];
		const dz = DISEASES.map((d) => ({ d, n: nrm(`${d.name} ${d.en ?? ""} ${d.icd ?? ""}`) })).filter((x) => ws.every((w) => x.n.includes(w))).slice(0, 6);
		groups.push(["🩺 Penyakit", dz.map(({ d }) => ({ t: d.name, s: [d.icd, `SKDI ${d.lvl}`].filter(Boolean).join(" · "), ic: "🩺", c: sysColor(d.sys), go: () => openDisease(hub, d.id) }))]);
		const dr = searchDrugs(Q, drugs).slice(0, 6);
		groups.push(["💊 Obat", dr.map((d) => ({ t: d.name, s: d.cls, ic: catOf(d.cat).icon, c: catOf(d.cat).color, go: () => openDrug(hub, d.id) }))]);
		const pf = PFM.filter((x) => { const n = nrm(x.name + " " + x.steps.map((s) => s[0]).join(" ")); return ws.every((w) => n.includes(w)); }).slice(0, 5);
		groups.push(["🫀 Pemeriksaan fisik", pf.map((x) => ({ t: x.name, s: pfGroup(x.g).name, ic: pfGroup(x.g).icon, c: sysColor(x.g), go: () => openPfMat(hub, x.id) }))]);
		const pts = c.patients.filter((x) => ws.every((w) => nrm(`${x.name} ${x.rm} ${x.room}`).includes(w))).slice(0, 4);
		groups.push(["📋 Pasien CPPT", pts.map((x) => ({ t: x.name, s: [x.rm ? `RM ${x.rm}` : "", x.room].filter(Boolean).join(" · "), ic: "📋", c: "#0ea5e9", go: () => cpptOpenPatient(hub, x.id) }))]);
		const tl = (["medobat", "medpenyakit", "medpf", "medcppt", ...TOOLS.map((t) => t[0])] as Page[]).filter((pg) => { const mt = PAGES[pg]; return mt && ws.every((w) => nrm(`${mt.label} ${mt.desc}`).includes(w)); });
		groups.push(["🧰 Alat & halaman", tl.map((pg) => ({ t: PAGES[pg]!.label, s: PAGES[pg]!.desc, ic: "🧰", c: "#6366f1", go: () => hub.navigate(pg) }))]);
		let any = false;
		for (const [title, items] of groups) {
			if (!items.length) continue;
			any = true;
			res.createDiv({ cls: "fch-mh-res-h", text: title });
			for (const it of items) {
				const b = res.createEl("button", { cls: "fch-mh-hit" });
				b.style.setProperty("--c", it.c);
				b.createSpan({ cls: "fch-mh-hit-ic", text: it.ic });
				const t = b.createDiv("fch-grow");
				t.createDiv({ cls: "fch-strong", text: it.t });
				t.createDiv({ cls: "fch-small fch-muted", text: it.s });
				b.onclick = () => { Q = ""; it.go(); };
				first ??= () => { Q = ""; it.go(); };
			}
		}
		if (!any) res.createDiv({ cls: "fch-md-empty", text: "Tidak ditemukan. Coba kata lain atau ejaan lain." });
	};
	inp.oninput = () => { Q = inp.value; draw(); };
	inp.onkeydown = (e) => { if (e.key === "Enter" && first) { e.preventDefault(); first(); } else if (e.key === "Escape") { Q = ""; inp.value = ""; draw(); } };
	draw();
	if (Q) window.setTimeout(() => inp.focus(), 20);

	// ---- ubin utama
	const big = el.createDiv("fch-mh-big");
	const doneN = Object.keys(m.pfDone ?? {}).length;
	const tile = (cls: string, ic: string, t: string, s: string, color: string, go: () => void, extra?: string) => {
		const b = big.createEl("button", { cls: "fch-mh-tile " + cls });
		b.style.setProperty("--c", color);
		b.createDiv({ cls: "fch-mh-tile-ic", text: ic });
		b.createDiv({ cls: "fch-mh-tile-t", text: t });
		b.createDiv({ cls: "fch-mh-tile-s", text: s });
		if (extra) b.createDiv({ cls: "fch-mh-tile-x", text: extra });
		b.onclick = go;
	};
	tile("is-dz", "🩺", "Penyakit", `${SKDI_ROWS.length} penyakit SKDI · materi & resep`, "#16a34a", () => hub.navigate("medpenyakit"), m.disFav?.length ? `★ ${m.disFav.length} favorit` : undefined);
	tile("is-ob", "💊", "Obat", `${drugs.length} obat · dosis dewasa & anak`, "#7c3aed", () => hub.navigate("medobat"), m.fav.length ? `⭐ ${m.fav.length} favorit` : undefined);
	tile("is-pf", "🫀", "Pemeriksaan fisik", `${PFM.length} materi SKDI · OSCE`, "#e11d48", () => hub.navigate("medpf"), `✅ ${doneN}/${PFM.length} dikuasai`);
	tile("is-cp", "📋", "CPPT", "Catatan SOAP · ekspor PDF", "#0ea5e9", () => hub.navigate("medcppt"), `${c.patients.filter((x) => !x.done).length} pasien aktif`);

	// ---- alat
	const tools = el.createDiv("fch-mh-tools");
	for (const [pg, ic, color] of TOOLS) {
		const mt = PAGES[pg];
		if (!mt) continue;
		const b = tools.createEl("button", { cls: "fch-mh-tool" });
		b.style.setProperty("--c", color);
		b.createSpan({ cls: "fch-mh-tool-ic", text: ic });
		b.createSpan({ cls: "fch-mh-tool-t", text: mt.label });
		b.setAttr("title", mt.desc);
		b.onclick = () => hub.navigate(pg);
	}

	const cols = el.createDiv("fch-mh-cols");
	// ---- lanjutkan
	const rec = cols.createDiv("fch-mh-card");
	rec.createDiv({ cls: "fch-mh-card-h", text: "🕘 Lanjutkan" });
	const items: { t: string; s: string; ic: string; go: () => void }[] = [];
	for (const id of (m.disRecent ?? []).slice(0, 4)) { const d = DISEASES.find((x) => x.id === id); if (d) items.push({ t: d.name, s: "Penyakit", ic: "🩺", go: () => openDisease(hub, d.id) }); }
	for (const id of m.recent.slice(0, 3)) { const d = drugById(p, id); if (d) items.push({ t: d.name, s: "Obat", ic: "💊", go: () => openDrug(hub, d.id) }); }
	const notes = m.notes;
	for (const x of PFM.filter((x) => notes[`pfm:${x.id}`] && !m.pfDone?.[x.id]).slice(0, 3)) items.push({ t: x.name, s: "Pemeriksaan fisik · sedang dipelajari", ic: "🫀", go: () => openPfMat(hub, x.id) });
	if (!items.length) rec.createDiv({ cls: "fch-small fch-muted", text: "Belum ada riwayat. Buka penyakit, obat, atau materi pemeriksaan fisik — akan muncul di sini." });
	for (const it of items.slice(0, 7)) { const b = rec.createEl("button", { cls: "fch-mh-row" }); b.createSpan({ text: it.ic }); const t = b.createDiv("fch-grow"); t.createDiv({ cls: "fch-strong", text: it.t }); t.createDiv({ cls: "fch-small fch-muted", text: it.s }); b.onclick = it.go; }

	// ---- kartu hari ini
	const today = cols.createDiv("fch-mh-card");
	today.createDiv({ cls: "fch-mh-card-h", text: "✨ Kartu hari ini" });
	const withRx = DISEASES.filter((d) => d.lvl === "4");
	const dzT = withRx[dayIndex(withRx.length, 1)];
	const drT = drugs[dayIndex(drugs.length, 2)];
	const pfT = PFM[dayIndex(PFM.length, 3)];
	const flip = (front: string, k: string, back: string, go: () => void, color: string) => {
		const f = today.createEl("button", { cls: "fch-mh-flip" });
		f.style.setProperty("--c", color);
		const inr = f.createDiv("fch-mh-flip-in");
		const a = inr.createDiv("fch-mh-flip-f");
		a.createDiv({ cls: "fch-small fch-muted", text: k });
		a.createDiv({ cls: "fch-strong", text: front });
		a.createDiv({ cls: "fch-mh-flip-hint", text: "ketuk untuk membalik ↻" });
		const b = inr.createDiv("fch-mh-flip-b");
		b.createDiv({ cls: "fch-small", text: back });
		const o = b.createEl("span", { cls: "fch-mh-flip-go", text: "Buka materi →" });
		o.onclick = (e) => { e.stopPropagation(); go(); };
		f.onclick = () => f.toggleClass("is-flipped", !f.hasClass("is-flipped"));
	};
	if (dzT) flip(dzT.name, "🩺 Penyakit · apa definisi & terapi utamanya?", `${firstSentence(dzT.def, 160)} Terapi: ${firstSentence(dzT.farm[0] ?? dzT.non[0] ?? "-", 120)}`, () => openDisease(hub, dzT.id), sysColor(dzT.sys));
	if (drT) flip(drT.name, "💊 Obat · golongan & indikasinya?", `${drT.cls}. Indikasi: ${drT.ind.slice(0, 2).join("; ")}`, () => openDrug(hub, drT.id), catOf(drT.cat).color);
	if (pfT) flip(pfT.name, "🫀 Pemeriksaan · sebutkan langkahnya!", pfT.steps.map((s, i) => `${i + 1}. ${s[0]}`).join("  "), () => openPfMat(hub, pfT.id), sysColor(pfT.g));

	// ---- CPPT mini
	const cp = cols.createDiv("fch-mh-card");
	const ch = cp.createDiv("fch-mh-card-h");
	ch.createSpan({ text: "📋 Pasien CPPT" });
	const act = c.patients.filter((x) => !x.done);
	const last = (pid: string) => c.notes.filter((n) => n.pid === pid).sort((a, b) => b.t - a.t)[0];
	act.sort((a, b) => (last(b.id)?.t ?? b.created) - (last(a.id)?.t ?? a.created));
	if (!act.length) cp.createDiv({ cls: "fch-small fch-muted", text: "Belum ada pasien aktif. Catat perkembangan pasien dengan format SOAP lalu ekspor ke PDF." });
	for (const x of act.slice(0, 4)) {
		const ln = last(x.id);
		const b = cp.createEl("button", { cls: "fch-mh-row" });
		b.createSpan({ text: x.sex === "P" ? "👩" : "👨" });
		const t = b.createDiv("fch-grow");
		t.createDiv({ cls: "fch-strong", text: x.name });
		t.createDiv({ cls: "fch-small fch-muted", text: [x.room, ln ? ln.dx.map((d) => d.name).join("; ") || "catatan terakhir " + new Date(ln.t).toLocaleDateString("id-ID") : "belum ada catatan"].filter(Boolean).join(" · ") });
		b.onclick = () => cpptOpenPatient(hub, x.id);
	}
	const ab = cp.createEl("button", { cls: "fch-mh-add", text: "+ Pasien / catatan baru" });
	ab.onclick = () => hub.navigate("medcppt");

	disclaimer(el);
}
