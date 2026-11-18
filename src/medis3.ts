/**
 * Bagian Medis v20: Penyakit (SKDI 2019 + materi lengkap), Pemeriksaan Fisik (Macleod), dan Resep lengkap.
 */
import { Notice, TFile } from "obsidian";
import type { HubView } from "./hub-view";
import { DRUGS } from "./med-data";
import { DISEASES, Disease, LEVELS, Rx, diseaseById, diseaseForRow, rowsOf } from "./med-dis";
import { ageText, apls, checkIx, num } from "./med-engine";
import { PF, PfModule } from "./med-pf";
import { parseAgeMonths, rxLine, rxText } from "./med-rx";
import { SKDI_CATS, SKDI_ROWS, SKDI_SKILLS, SKDI_SYS } from "./med-skdi";
import { copyText, disclaimer, drugById, list, med, openDrug, section } from "./medis";
import { play } from "./sound";
import { btn } from "./util";
import { cpptPrefill } from "./med-cppt";
import { openPf } from "./med-pfui";
import { rxPdfDoc, savePdf } from "./med-pdf";
import { ChipItem, acc, chipRow, firstSentence, glance, heroCard, ibtn, mlist, sysColor } from "./med-ui";

// ================================================================ util
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const sysOf = (id: string) => SKDI_SYS.find((s) => s.id === id) ?? { id, name: id, icon: "🩺" };
export function lvlBadge(parent: HTMLElement, lvl: string, long = false) {
	const L = LEVELS[lvl] ?? LEVELS["2"];
	const b = parent.createSpan({ cls: "fch-dz-lvl", text: long ? `SKDI ${lvl} · ${L.short}` : `SKDI ${lvl}` });
	b.style.setProperty("--c", L.color);
	b.setAttr("title", L.desc);
	return b;
}

type SkdiRow = { i: number; sys: { id: string; name: string; icon: string }; cat: string; no: number; name: string; lvl: string; d?: Disease };
let DZ = { q: "", sys: "", lvl: "", mode: "all", open: "" as string, tab: "ringkas", rx: 0, skdi: null as SkdiRow | null };
let ROWS: SkdiRow[] | null = null;
function allRows(): SkdiRow[] {
	if (!ROWS) ROWS = SKDI_ROWS.map((r, i) => ({ i, sys: SKDI_SYS[r[0]], cat: SKDI_CATS[r[1]], no: r[2], name: r[3], lvl: r[4], d: diseaseForRow(i) }));
	return ROWS;
}
const STXT = new Map<string, string>();
function searchText(r: SkdiRow): string {
	const d = r.d;
	if (!d) return norm(r.cat);
	let t = STXT.get(d.id);
	if (t === undefined) { t = norm([r.cat, d.def, ...d.klinis, ...d.drugs, ...d.etio.slice(0, 3)].join(" ")); STXT.set(d.id, t); }
	return t;
}
export function openDisease(hub: HubView, id: string, tab = "ringkas") { DZ.skdi = null; DZ.open = id; DZ.tab = tab; const mm = med(hub.plugin); mm.disRecent = [id, ...(mm.disRecent ?? []).filter((x) => x !== id)].slice(0, 12); hub.plugin.requestSave(); if (hub.page === "medpenyakit") hub.renderPage(); else hub.navigate("medpenyakit"); }

// ================================================================ 1. DAFTAR PENYAKIT
const MODES: ChipItem[] = [{ id: "all", label: "Semua", icon: "✨" }, { id: "fav", label: "Favorit", icon: "★" }, { id: "rx", label: "Punya resep", icon: "📝" }, { id: "note", label: "Catatan saya", icon: "🗒️" }, { id: "recent", label: "Terakhir dibuka", icon: "🕘" }];
export function renderMedDisease(hub: HubView, el: HTMLElement) {
	const d = DZ.open ? diseaseById(DZ.open) : undefined;
	if (d) return diseaseDetail(hub, el, d);
	if (DZ.skdi) return skdiInfo(hub, el, DZ.skdi);
	const p = hub.plugin;
	const m = med(p);
	const head = el.createDiv("fch-mx-pagehead");
	const ht = head.createDiv("fch-grow");
	ht.createEl("h2", { text: "🩺 Penyakit" });
	ht.createDiv({ cls: "fch-small fch-muted", text: `${SKDI_ROWS.length} penyakit SKDI 2019 (+ THT SKDI 2012) · semuanya bermateri lengkap` });
	ibtn(head, "shuffle", "Acak", () => { const xs = DISEASES; openDisease(hub, xs[Math.floor(Math.random() * xs.length)].id); }, "fch-dz-rand");
	const box = el.createDiv("fch-md-search fch-mx-search");
	box.createSpan({ cls: "fch-md-search-ic", text: "🔎" });
	const inp = box.createEl("input", { type: "text", cls: "fch-md-search-in", attr: { placeholder: "Cari penyakit, gejala, ICD, atau obat… (mis. demam, mengi, J18)" } });
	inp.value = DZ.q;
	const clr = box.createEl("button", { cls: "fch-mx-clear", text: "✕", attr: { "aria-label": "Hapus" } });
	clr.onclick = () => { inp.value = ""; DZ.q = ""; draw(); inp.focus(); };
	const rowsAll = allRows();
	chipRow(el, MODES, DZ.mode, (v) => { DZ.mode = v; draw(); }, "fch-dz-modes");
	chipRow(el, [{ id: "", label: "Semua sistem", icon: "🧭", n: rowsAll.length }, ...SKDI_SYS.map((s) => ({ id: s.id, label: s.name.replace(/^Sistem /, ""), icon: s.icon, n: rowsAll.filter((r) => r.sys.id === s.id).length, color: sysColor(s.id) }))], DZ.sys, (v) => { DZ.sys = v; draw(); }, "fch-dz-syss");
	chipRow(el, [{ id: "", label: "Semua tingkat" }, ...Object.keys(LEVELS).map((k) => ({ id: k, label: `${k} · ${LEVELS[k].short.split(/[(,]/)[0].trim()}`, color: LEVELS[k].color, n: rowsAll.filter((r) => r.lvl === k).length }))], DZ.lvl, (v) => { DZ.lvl = v; draw(); }, "fch-dz-lvls");
	const listEl = el.createDiv("fch-dz-list");
	const draw = () => {
		listEl.empty();
		clr.toggleClass("is-hidden", !DZ.q);
		const q = norm(DZ.q);
		let rows = rowsAll.filter((r) => (!DZ.sys || r.sys.id === DZ.sys) && (!DZ.lvl || r.lvl === DZ.lvl));
		if (DZ.mode === "fav") rows = rows.filter((r) => r.d && m.disFav!.includes(r.d.id));
		else if (DZ.mode === "rx") rows = rows.filter((r) => r.d?.rx.length);
		else if (DZ.mode === "note") rows = rows.filter((r) => r.d && (m.notes[`dz:${r.d.id}`] ?? m.notes[`skdi:${r.name}`]));
		else if (DZ.mode === "recent") { const rec = m.disRecent ?? []; rows = rec.map((id) => rows.find((r) => r.d?.id === id)).filter((r): r is SkdiRow => !!r); }
		if (q) {
			const words = q.split(" ");
			const scored = rows.map((r) => { const nm = norm(r.name + " " + (r.d?.name ?? "") + " " + (r.d?.en ?? "") + " " + (r.d?.icd ?? "")); const all = nm + " " + searchText(r); return { r, s: words.every((w) => nm.includes(w)) ? 2 : words.every((w) => all.includes(w)) ? 1 : 0 }; }).filter((x) => x.s > 0);
			scored.sort((a, b) => b.s - a.s);
			rows = scored.map((x) => x.r);
		}
		listEl.createDiv({ cls: "fch-small fch-muted fch-dzl-count", text: `${rows.length} penyakit${q ? " cocok" : ""}` });
		if (!rows.length) listEl.createDiv({ cls: "fch-md-empty", text: DZ.mode === "fav" ? "Belum ada favorit. Buka penyakit lalu ketuk ☆ Simpan." : "Tidak ditemukan. Coba kata lain (nama penyakit, gejala, atau obat)." });
		let lastCat = "";
		const LIM = 300;
		for (const r of rows.slice(0, LIM)) {
			if (!q && DZ.mode !== "recent" && r.cat !== lastCat) { listEl.createDiv({ cls: "fch-dz-cat", text: `${r.sys.icon} ${r.cat}` }); lastCat = r.cat; }
			const row = listEl.createEl("button", { cls: "fch-dz-row" + (r.d ? " has-full" : " is-skdi") });
			row.style.setProperty("--c", sysColor(r.sys.id));
			row.createSpan({ cls: "fch-dz-row-ic", text: r.sys.icon });
			const t = row.createDiv("fch-grow");
			t.createDiv({ cls: "fch-dz-row-t", text: (r.d && m.disFav!.includes(r.d.id) ? "★ " : "") + r.name });
			t.createDiv({ cls: "fch-dz-row-s", text: [r.d?.icd, q || DZ.mode !== "all" ? r.cat : "", r.d?.rx.length ? "📝 resep" : "", r.d && r.d.name !== r.name ? `↳ ${r.d.name}` : ""].filter(Boolean).join(" · ") });
			lvlBadge(row, r.lvl);
			row.onclick = () => { if (r.d) openDisease(hub, r.d.id); else { DZ.skdi = r; hub.renderPage(); } };
		}
		if (rows.length > LIM) listEl.createDiv({ cls: "fch-small fch-muted", text: `Menampilkan ${LIM} dari ${rows.length}. Persempit dengan pencarian atau pilih sistem.` });
	};
	inp.oninput = () => { DZ.q = inp.value; draw(); };
	draw();
	disclaimer(el);
}

/** Kartu ringkas untuk penyakit SKDI tanpa materi lengkap: arti tingkat kemampuan + catatan pribadi. */
function skdiInfo(hub: HubView, el: HTMLElement, r: SkdiRow) {
	const p = hub.plugin;
	const m = med(p);
	const top = el.createDiv("fch-dz-dtop");
	btn(top, { icon: "arrow-left", text: "Daftar", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { DZ.skdi = null; hub.renderPage(); } });
	el.createEl("h2", { text: r.name });
	const meta = el.createDiv("fch-dz-meta");
	lvlBadge(meta, r.lvl, true);
	meta.createSpan({ cls: "fch-small fch-muted", text: `${r.sys.icon} ${r.sys.name} · ${r.cat} · No. ${r.no}` });
	const L = LEVELS[r.lvl];
	section(el, "🎯", "Kompetensi dokter umum (SKDI 2019)", "is-teal").createDiv({ cls: "fch-md-p", text: L?.desc ?? "" });
	list(section(el, "✅", "Yang harus dilakukan"), TODO[r.lvl] ?? []);
	const key = `skdi:${r.name}`;
	const nc = section(el, "📝", "Catatan pribadi");
	const ta = nc.createEl("textarea", { cls: "fch-md-note", attr: { placeholder: "Tulis ringkasan dari CMDT/Macleod atau catatan Anda…" } });
	ta.value = m.notes[key] ?? "";
	ta.oninput = () => { m.notes[key] = ta.value; p.requestSave(); };
	disclaimer(el);
}

const TODO: Record<string, string[]> = {
		"1": ["Kenali gambaran klinis utama.", "Jelaskan kepada pasien & keluarga, rujuk ke spesialis yang tepat.", "Tindak lanjuti setelah pasien kembali dari rujukan."],
		"2": ["Tegakkan diagnosis klinis dari anamnesis & pemeriksaan fisik.", "Rujuk ke fasilitas yang tepat dengan surat rujukan lengkap.", "Tindak lanjuti setelah rujukan."],
		"3A": ["Diagnosis dengan anamnesis, pemeriksaan fisik & penunjang sederhana.", "Berikan terapi pendahuluan (bukan gawat darurat).", "Rujuk untuk tata laksana lanjutan."],
		"3B": ["Kenali kegawatan dan stabilisasi (ABCDE) segera.", "Berikan terapi pendahuluan untuk menyelamatkan nyawa/mencegah kecacatan.", "Rujuk secepatnya dengan pendampingan bila perlu."],
		"4": ["Diagnosis klinis lengkap termasuk penunjang yang tersedia di FKTP.", "Tata laksana mandiri dan tuntas (farmakologi, nonfarmakologi, edukasi).", "Rujuk hanya bila ada komplikasi atau gagal terapi."],
};

// ================================================================ 2. DETAIL PENYAKIT
const TABS: [string, string, string][] = [["ringkas", "Ringkasan", "📖"], ["dx", "Diagnosis & PF", "🎯"], ["tx", "Tata laksana", "💊"], ["rx", "Resep", "📝"], ["obat", "Obat", "💉"], ["src", "Sumber", "📚"]];
let MEMO = false;
/** Urutan penyakit bermateri dalam satu sistem (untuk tombol sebelumnya/berikutnya). */
function sysSeq(sys: string): Disease[] {
	const seen = new Set<string>();
	const out: Disease[] = [];
	for (const r of allRows()) if (r.d && r.sys.id === sys && !seen.has(r.d.id)) { seen.add(r.d.id); out.push(r.d); }
	for (const d of DISEASES) if (d.sys === sys && !seen.has(d.id)) { seen.add(d.id); out.push(d); }
	return out;
}
const short = (s: string, n = 110) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function diseaseDetail(hub: HubView, el: HTMLElement, d: Disease) {
	const p = hub.plugin;
	const m = med(p);
	const sys = sysOf(d.sys);
	const color = sysColor(d.sys);
	const seq = sysSeq(d.sys);
	const at = seq.findIndex((x) => x.id === d.id);
	const prev = at > 0 ? seq[at - 1] : undefined;
	const next = at >= 0 && at < seq.length - 1 ? seq[at + 1] : undefined;
	el.addClass("fch-mx-page");
	el.toggleClass("fch-mx-memo", MEMO);
	const top = el.createDiv("fch-dz-dtop fch-mx-top");
	btn(top, { icon: "arrow-left", text: "Daftar", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { DZ.open = ""; hub.renderPage(); } });
	const nav = top.createDiv("fch-mx-nav");
	const pb = ibtn(nav, "chevron-left", prev ? `Sebelumnya: ${prev.name}` : "Sebelumnya", () => prev && openDisease(hub, prev.id, DZ.tab), "fch-mx-only-ic");
	pb.disabled = !prev;
	nav.createSpan({ cls: "fch-small fch-muted", text: at >= 0 ? `${at + 1}/${seq.length}` : "" });
	const nb = ibtn(nav, "chevron-right", next ? `Berikutnya: ${next.name}` : "Berikutnya", () => next && openDisease(hub, next.id, DZ.tab), "fch-mx-only-ic");
	nb.disabled = !next;
	top.createDiv("fch-grow");
	const fav = m.disFav!.includes(d.id);
	ibtn(top, "star", fav ? "Favorit" : "Simpan", () => { m.disFav = fav ? m.disFav!.filter((x) => x !== d.id) : [...m.disFav!, d.id]; p.requestSave(); hub.renderPage(); }, "fch-dz-fav" + (fav ? " is-on" : ""));
	ibtn(top, "layers", "Flashcard", () => void diseaseCards(hub, d));
	ibtn(top, "clipboard-plus", "Pakai di CPPT", () => cpptPrefill(hub, { dx: [{ name: d.name, icd: d.icd ?? "", id: d.id }] }), "fch-dz-tocppt");
	ibtn(top, MEMO ? "eye" : "eye-off", MEMO ? "Hafalan: aktif" : "Mode hafalan", () => { MEMO = !MEMO; hub.renderPage(); }, "fch-dz-memo" + (MEMO ? " is-on" : ""));

	const { chips } = heroCard(el, { color, emoji: sys.icon, kicker: `${sys.name}${d.icd ? ` · ICD-10 ${d.icd}` : ""}`, title: d.name, titleCls: "fch-dz-title", sub: d.en });
	lvlBadge(chips, d.lvl, true);
	if (d.rx.length) chips.createSpan({ cls: "fch-mx-pill", text: `📝 ${d.rx.length} resep` });
	if (d.pfMod.length) chips.createSpan({ cls: "fch-mx-pill", text: `🩺 PF terarah` });
	if (MEMO) el.createDiv({ cls: "fch-mx-memo-tip", text: "🧠 Mode hafalan: butir-butir disamarkan. Coba ingat dulu, lalu ketuk butir untuk membukanya." });

	glance(el, [
		{ icon: "📖", label: "Intinya", text: firstSentence(d.def), tone: "is-wide" },
		{ icon: "🤒", label: "Klinis kunci", text: d.klinis.slice(0, 2).map((x) => short(x, 80)).join(" • ") },
		{ icon: "🎯", label: "Diagnosis", text: short(d.dx[0] ?? "") },
		{ icon: "💊", label: "Terapi utama", text: short(d.farm[0] ?? d.non[0] ?? "") },
		{ icon: "🚑", label: "Rujuk bila", text: short(d.rujuk?.[0] ?? ""), tone: "is-red" },
	]);

	const tabs = el.createDiv("fch-dz-tabs fch-mx-tabs");
	const body = el.createDiv("fch-dz-body");
	const cnt: Record<string, number> = { rx: d.rx.length, obat: new Set([...d.drugs, ...d.rx.flatMap((r) => r.items.map((i) => i.d).filter(Boolean))]).size };
	for (const [id, label, ic] of TABS) {
		const b = tabs.createEl("button", { cls: "fch-dz-tab" + (DZ.tab === id ? " is-on" : "") });
		b.createSpan({ cls: "fch-mx-tab-ic", text: ic });
		b.createSpan({ text: label });
		if (cnt[id]) b.createSpan({ cls: "fch-mx-chip-n", text: String(cnt[id]) });
		b.onclick = () => { DZ.tab = id; tabs.querySelectorAll(".fch-dz-tab").forEach((x) => x.removeClass("is-on")); b.addClass("is-on"); draw(); };
	}
	const draw = () => {
		body.empty();
		const tools = body.createDiv("fch-mx-tools");
		const sec = (icon: string, title: string, items: string[] | undefined, open = true, tone = "") => { if (items?.length) mlist(acc(body, icon, `${title}`, open, tone), items); };
		if (DZ.tab === "ringkas") {
			const df = acc(body, "📖", "Definisi", true, "is-accent");
			df.createDiv({ cls: "fch-md-p", text: d.def });
			sec("🦠", "Etiologi & faktor risiko", d.etio);
			sec("🤒", "Gambaran klinis", d.klinis);
			sec("🌏", "Epidemiologi", d.epi, false);
			sec("🗂️", "Klasifikasi", d.klas, false);
			sec("⚙️", "Patofisiologi", d.pato, false);
			sec("🔀", "Subtipe & varian", d.sub, false);
			sec("🔬", "Patologi", d.patol, false);
			const rs = rowsOf(d.id);
			if (rs.length) {
				const k = acc(body, "🎯", "Kompetensi dokter umum (SKDI)", false);
				for (const i of rs) { const r = allRows()[i]; if (!r) continue; const ln = k.createDiv("fch-dz-skrow"); lvlBadge(ln, r.lvl); ln.createSpan({ text: ` ${r.name} — ${LEVELS[r.lvl]?.short ?? ""}${i >= 913 ? " (SKDI 2012)" : ""}` }); }
				list(k, TODO[d.lvl] ?? []);
			}
			const key = `dz:${d.id}`;
			const nc = acc(body, "📝", "Catatan pribadi", !!m.notes[key]);
			const ta = nc.createEl("textarea", { cls: "fch-md-note", attr: { placeholder: "Tambahkan catatan Anda (kasus, tips konsulen, sumber lain)…" } });
			ta.value = m.notes[key] ?? (rs.map((i) => m.notes[`skdi:${allRows()[i]?.name}`]).find(Boolean) ?? "");
			ta.oninput = () => { m.notes[key] = ta.value; p.requestSave(); };
		} else if (DZ.tab === "dx") {
			sec("🎯", "Kriteria diagnosis", d.dx, true, "is-accent");
			const pf = acc(body, "🩺", "Pemeriksaan fisik terarah", true);
			mlist(pf, d.pf);
			const links = pf.createDiv("fch-dz-links");
			for (const id of d.pfMod) { const mod = PF.find((x) => x.id === id); if (!mod) continue; const b = links.createEl("button", { cls: "fch-md-rchip is-link", text: `${mod.icon} Langkah lengkap: ${mod.name}` }); b.onclick = () => openPf(hub, mod.id); }
			sec("🧪", "Pemeriksaan penunjang", d.lab);
			const dd = acc(body, "⚖️", "Diagnosis banding", true);
			const wrap = dd.createDiv("fch-dz-links");
			for (const x of d.ddx) {
				const nx = norm(x);
				const hit = DISEASES.find((y) => { if (y.id === d.id) return false; const ny = norm(y.name); return ny.length >= 5 && (nx === ny || nx.startsWith(ny + " ") || nx.includes(" " + ny) || ny.startsWith(nx)); });
				const b = wrap.createEl(hit ? "button" : "span", { cls: "fch-md-rchip" + (hit ? " is-link" : ""), text: hit ? `${x} ↗` : x });
				if (hit) b.onclick = () => openDisease(hub, hit.id, "ringkas");
			}
		} else if (DZ.tab === "tx") {
			sec("💊", "Farmakologi", d.farm, true, "is-accent");
			sec("🥗", "Nonfarmakologi", d.non);
			sec("🗣️", "Edukasi pasien & keluarga", d.edu);
			sec("⚠️", "Komplikasi", d.komp, true, "is-amber");
			sec("🚑", "Kriteria rujukan", d.rujuk, true, "is-red");
			const go = body.createDiv("fch-dz-links");
			if (d.rx.length) btn(go, { text: "Lihat resep lengkap", icon: "file-text", cls: "fch-btn-primary", onClick: () => { DZ.tab = "rx"; hub.renderPage(); } });
			btn(go, { text: "Pakai di CPPT", icon: "clipboard-plus", onClick: () => cpptPrefill(hub, { dx: [{ name: d.name, icd: d.icd ?? "", id: d.id }], p: [...d.farm.slice(0, 3), ...d.edu.slice(0, 2)].join("\n") }) });
		} else if (DZ.tab === "rx") {
			rxPanel(hub, body, d);
		} else if (DZ.tab === "obat") {
			const grid = body.createDiv("fch-dz-drugs");
			for (const id of [...new Set([...d.drugs, ...d.rx.flatMap((r) => r.items.map((i) => i.d).filter((v): v is string => !!v))])]) {
				const x = drugById(p, id);
				if (!x) continue;
				const b = grid.createEl("button", { cls: "fch-dz-drug" });
				b.createDiv({ cls: "fch-strong", text: x.name });
				b.createDiv({ cls: "fch-small fch-muted", text: x.cls });
				b.onclick = () => openDrug(hub, x.id);
			}
			const ids = [...new Set(d.rx.flatMap((r) => r.items.map((i) => i.d).filter((v): v is string => !!v)))];
			const ix = checkIx(ids.map((i) => DRUGS.find((y) => y.id === i)!).filter(Boolean));
			const s = acc(body, "⚡", "Interaksi antarobat dalam resep penyakit ini", true);
			const hits = ix.hits.filter((h) => h.rule.sev !== "minor");
			if (!hits.length) s.createDiv({ cls: "fch-md-p", text: "Tidak ada interaksi mayor/moderat di database." });
			for (const x of hits.slice(0, 8)) s.createDiv({ cls: "fch-md-p", text: `${x.a.name} + ${x.b.name}: ${x.rule.eff}` });
		} else {
			sec("📚", "Sumber", d.src);
			body.createDiv({ cls: "fch-small fch-muted", text: "Materi ditulis ulang dengan bahasa sendiri dari CURRENT Medical Diagnosis & Treatment 2026 dan Macleod's Clinical Examination 15th ed., disesuaikan dengan SKDI 2019 dan pedoman nasional. Selalu verifikasi dengan pedoman terbaru." });
		}
		const accs = body.querySelectorAll("details.fch-mx-acc");
		if (accs.length > 1) {
			ibtn(tools, "chevrons-down-up", "Buka/tutup semua", () => { const anyClosed = [...accs].some((x) => !(x as HTMLDetailsElement).open); accs.forEach((x) => ((x as HTMLDetailsElement).open = anyClosed)); }, "fch-mx-sm");
			if (MEMO) ibtn(tools, "eye", "Ungkap semua", () => body.querySelectorAll(".fch-mx-list li").forEach((x) => x.addClass("is-shown")), "fch-mx-sm");
		} else tools.remove();
	};
	draw();
	if (prev || next) {
		const pn = el.createDiv("fch-mx-prevnext");
		for (const [x, lbl, cls] of [[prev, "← Sebelumnya", "is-prev"], [next, "Berikutnya →", "is-next"]] as const) {
			if (!x) { pn.createDiv(); continue; }
			const b = pn.createEl("button", { cls: "fch-mx-pn " + cls });
			b.createDiv({ cls: "fch-small fch-muted", text: lbl });
			b.createDiv({ cls: "fch-strong", text: x.name });
			b.onclick = () => openDisease(hub, x.id, DZ.tab);
		}
	}
	disclaimer(el);
}

// ================================================================ 3. RESEP
function rxPanel(hub: HubView, el: HTMLElement, d: Disease) {
	const p = hub.plugin;
	const m = med(p);
	const doc = m.doc!;
	const pa = m.rxPt!;
	if (!d.rx.length) {
		const box = el.createDiv("fch-dz-empty");
		box.createDiv({ cls: "fch-strong", text: `Tingkat ${d.lvl}: tidak ada resep mandiri di layanan primer` });
		box.createDiv({ cls: "fch-small fch-muted", text: d.lvl === "1" || d.lvl === "2" ? "Dokter umum mengenali/mendiagnosis lalu merujuk. Tata laksana definitif dilakukan spesialis — lihat tab Tata laksana untuk terapi awal & persiapan rujukan." : "Tata laksana dilakukan sesuai tab Tata laksana." });
		return;
	}
	if (DZ.rx >= d.rx.length) DZ.rx = 0;
	const pick = el.createDiv("fch-dz-rxpick");
	d.rx.forEach((r, i) => {
		const b = pick.createEl("button", { cls: "fch-dz-rxopt" + (i === DZ.rx ? " is-on" : "") });
		b.createDiv({ cls: "fch-strong", text: r.label });
		b.createDiv({ cls: "fch-small fch-muted", text: r.who === "anak" ? "🧒 Anak" : "🧑 Dewasa" });
		b.onclick = () => { DZ.rx = i; hub.renderPage(); };
	});
	const rx = d.rx[DZ.rx];
	const hasKg = rx.items.some((i) => i.kg);
	if (pa.preg === undefined) pa.preg = false;
	// pasien
	const form = el.createDiv("fch-dz-rxform");
	const f = (label: string, val: string, on: (v: string) => void, ph = "", type = "text") => {
		const w = form.createDiv("fch-md-field");
		w.createEl("label", { text: label });
		const i = w.createEl("input", { type, cls: "fch-md-in", attr: { placeholder: ph } });
		i.value = val;
		i.oninput = () => { on(i.value); p.requestSave(); redraw(); };
		return i;
	};
	f("Nama pasien (Pro)", pa.name, (v) => (pa.name = v), "Tn./Ny./An. …");
	f("Umur", pa.age, (v) => (pa.age = v), rx.who === "anak" ? "4 tahun" : "35 tahun");
	f("BB (kg)", pa.w, (v) => (pa.w = v), hasKg ? "kosong = perkiraan dari usia" : "opsional", "number");
	f("Alamat", pa.addr, (v) => (pa.addr = v), "opsional");
	const pg = form.createEl("label", { cls: "fch-md-check" });
	const pgi = pg.createEl("input", { type: "checkbox" });
	pgi.checked = !!pa.preg;
	pg.append(" Hamil");
	pgi.onchange = () => { pa.preg = pgi.checked; p.requestSave(); redraw(); };
	const det = el.createEl("details", { cls: "fch-md-det" });
	det.createEl("summary", { text: `🧑‍⚕️ Identitas dokter (kop resep)${doc.name ? `: ${doc.name}` : ""}` });
	const df = det.createDiv("fch-dz-rxform");
	const g = (label: string, k: keyof typeof doc, ph: string) => { const w = df.createDiv("fch-md-field"); w.createEl("label", { text: label }); const i = w.createEl("input", { type: "text", cls: "fch-md-in", attr: { placeholder: ph } }); i.value = doc[k]; i.oninput = () => { doc[k] = i.value; p.requestSave(); redraw(); }; };
	g("Nama dokter", "name", "dr. Nama Anda"); g("No. SIP", "sip", "SIP …"); g("Alamat praktik", "addr", "Jl. …"); g("Kota", "city", "Makassar"); g("Telepon", "phone", "08…");
	const out = el.createDiv("fch-dz-rxout");
	const redraw = () => {
		out.empty();
		const wIn = parseFloat(pa.w.replace(",", "."));
		const am0 = parseAgeMonths(pa.age, rx.who);
		const ageM = am0 ?? (rx.who === "anak" ? 48 : 360);
		const type: "anak" | "dewasa" = am0 !== null ? (ageM < 216 ? "anak" : "dewasa") : rx.who;
		const est = type === "anak" ? apls(ageM) : NaN;
		const wAuto = !(wIn > 0) && type === "anak" && isFinite(est);
		const w = wIn > 0 ? wIn : wAuto ? Math.round(est * 10) / 10 : 0;
		const pt = { ...m.pt, type, w, ageY: Math.floor(ageM / 12), ageM: ageM % 12, preg: !!pa.preg, wAuto };
		const lines = rx.items.map((it) => rxLine(it, pt));
		const warnBox = (t: string, act?: [string, () => void]) => { const x = out.createDiv({ cls: "fch-md-warnline", text: t }); if (act) { const b = x.createEl("a", { text: ` ${act[0]}`, href: "#" }); b.onclick = (e) => { e.preventDefault(); act[1](); }; } };
		const other = (who: "anak" | "dewasa") => d.rx.findIndex((r) => r.who === who);
		if (am0 === null && hasKg) warnBox(`Isi umur pasien (mis. "3 tahun", "8 bulan"). Sementara dihitung untuk ${rx.who === "anak" ? "anak 4 tahun" : "dewasa"}.`);
		if (rx.who === "dewasa" && type === "anak" && ageM < 144) { const j = other("anak"); warnBox(`Resep ini untuk dewasa, pasien berusia ${ageText(ageM)}.`, j >= 0 ? ["Pakai resep anak →", () => { DZ.rx = j; hub.renderPage(); }] : undefined); }
		if (rx.who === "anak" && type === "dewasa") { const j = other("dewasa"); warnBox(`Resep ini untuk anak, pasien berusia ${ageText(ageM)}.`, j >= 0 ? ["Pakai resep dewasa →", () => { DZ.rx = j; hub.renderPage(); }] : undefined); }
		if (wAuto && hasKg) out.createDiv({ cls: "fch-md-wnote", text: `⚖️ BB belum diisi — dipakai perkiraan dari usia (APLS): ${num(w)} kg. Timbang pasien untuk dosis yang tepat.` });
		if (wIn > 0 && type === "anak" && isFinite(est) && (wIn > est * 1.8 || wIn < est * 0.55)) warnBox(`BB ${num(wIn)} kg jauh dari perkiraan usia ${ageText(ageM)} (± ${num(Math.round(est))} kg). Cek ulang BB/usia; bila benar (gizi kurang/obesitas), dosis per kg tetap dipakai dengan batas maksimal.`);
		const paper = out.createDiv("fch-dz-paper");
		const kop = paper.createDiv("fch-dz-kop");
		kop.createDiv({ cls: "fch-dz-kop-n", text: doc.name ? (doc.name.toLowerCase().startsWith("dr") ? doc.name : `dr. ${doc.name}`) : "dr. ……………………" });
		kop.createDiv({ cls: "fch-small", text: `SIP: ${doc.sip || "……………………"}` });
		if (doc.addr || doc.phone) kop.createDiv({ cls: "fch-small", text: [doc.addr, doc.phone ? `Telp. ${doc.phone}` : ""].filter(Boolean).join(" · ") });
		paper.createDiv({ cls: "fch-dz-date", text: `${doc.city || "…………"}, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}` });
		for (const l of lines) {
			const r = paper.createDiv("fch-dz-r");
			const rl = r.createDiv("fch-dz-rl");
			rl.createSpan({ cls: "fch-dz-rsym", text: "R/" });
			const txt = rl.createDiv("fch-grow");
			for (const [i, ln] of l.r.split("\n").entries()) txt.createDiv({ cls: i ? "fch-dz-rsub" : "fch-dz-rmain", text: ln.trim() });
			txt.createDiv({ cls: "fch-dz-sig", text: l.s });
			if (l.auto && l.note) txt.createDiv({ cls: "fch-dz-auto", text: `⚖️ dihitung: ${l.note}` });
			if (l.warn) txt.createDiv({ cls: "fch-dz-auto is-warn", text: `⚠️ ${l.warn}` });
			r.createDiv({ cls: "fch-dz-paraf", text: "∫" });
			if (l.d) { const a = txt.createEl("a", { cls: "fch-small", text: "lihat obat ↗", href: "#" }); a.onclick = (e) => { e.preventDefault(); openDrug(hub, l.d!.id); }; }
		}
		const pro = paper.createDiv("fch-dz-pro");
		pro.createDiv({ text: `Pro : ${pa.name || "……………………"}` });
		pro.createDiv({ text: `Umur : ${pa.age || "……"}${pa.w ? `   BB: ${pa.w} kg` : wAuto && hasKg ? `   BB: ± ${num(w)} kg (perkiraan)` : ""}` });
		pro.createDiv({ text: `Alamat : ${pa.addr || "……………………"}` });
		if (rx.note) out.createDiv({ cls: "fch-dz-rxnote", text: `📝 ${rx.note}` });
		const act = out.createDiv("fch-dz-links");
		const txt = rxText(rx, lines, doc, pa);
		btn(act, { text: "Salin resep", icon: "copy", cls: "fch-btn-primary", onClick: () => copyText(txt, "Resep disalin") });
		btn(act, { text: "Ekspor PDF", icon: "file-down", cls: "fch-dz-rxpdf", onClick: () => void savePdf(p, rxPdfDoc({ doc, pa, lines, title: rx.label, dx: d.name, note: rx.note, wText: pa.w ? `${pa.w} kg` : wAuto && hasKg ? `± ${num(w)} kg (perkiraan)` : "" }), "Medis/Resep", `Resep ${pa.name || d.name}`) });
		btn(act, { text: "Simpan ke catatan", icon: "file-plus", onClick: () => void saveRx(hub, d, rx, txt) });
		btn(act, { text: "Pakai di CPPT", icon: "clipboard-plus", onClick: () => cpptPrefill(hub, { dx: [{ name: d.name, icd: d.icd ?? "", id: d.id }], p: [`${rx.label}:`, ...lines.map((l) => `- R/ ${l.r.replace(/\n/g, " ")} — ${l.s}`)].join("\n") }) });
		btn(act, { text: "Cek interaksi", icon: "zap", onClick: () => { m.inter = [...new Set(lines.map((l) => l.d?.id).filter((v): v is string => !!v))]; p.requestSave(); hub.navigate("medinter"); } });
		const legend = out.createEl("details", { cls: "fch-md-det" });
		legend.createEl("summary", { text: "📖 Singkatan resep" });
		list(legend, ["R/ = recipe (ambillah) · No. = jumlah (angka Romawi) · fl. = botol · m.f. pulv. dtd = buatlah puyer, berikan sebanyak", "S = signa (tandai/aturan pakai) · dd = de die (sehari) · cth = sendok teh 5 mL · C = sendok makan 15 mL · gtt = tetes", "a.c. = sebelum makan · p.c. = sesudah makan · p.r.n. = bila perlu · h.s. = sebelum tidur · mane = pagi · u.e. = pemakaian luar · imm = diberikan oleh dokter", "OD/OS/ODS = mata kanan/kiri/kedua · applic. = oleskan · ∫ = paraf dokter di akhir tiap R/"]);
	};
	redraw();
}

async function saveRx(hub: HubView, d: Disease, rx: Rx, txt: string) {
	const p = hub.plugin;
	const now = new Date();
	const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	const path = `Medis/Resep/${stamp} ${d.name.replace(/[\\/:*?"<>|#^[\]()]/g, "").slice(0, 60)}.md`;
	const md = [`## ${rx.label}`, "", "```text", txt, "```", ""].join("\n");
	const f = await p.appendToNote(path, md);
	if (f) { new Notice(`💾 Resep disimpan di ${path}`); play("chime"); }
}

async function diseaseCards(hub: HubView, d: Disease) {
	const p = hub.plugin;
	const path = `Medis/Penyakit/${d.name.replace(/[\\/:*?"<>|#^[\]()]/g, "").replace(/\s+/g, " ").trim()}.md`;
	if (p.app.vault.getAbstractFileByPath(path) instanceof TFile) { new Notice("Catatan sudah ada. Membukanya…"); void p.openAt(path, 0); return; }
	const c = (s: string) => s.replace(/::/g, ":").replace(/\{\{|\}\}/g, "");
	const blk = (q: string, items?: string[]) => (items?.length ? [`${q}`, "?", ...items.map((x) => `- ${c(x)}`), ""] : []);
	const L = [`> Dibuat dari bagian Medis · SKDI ${d.lvl} · ${(d.src[0] ?? "").replace(/::/g, ":")}`, "", `# ${d.name}`, "", `Definisi ${d.name} :: ${c(d.def)}`, `Tingkat kemampuan SKDI ${d.name} :: ${d.lvl} — ${LEVELS[d.lvl]?.short ?? ""}`, ""];
	L.push(...blk(`Etiologi & faktor risiko ${d.name}`, d.etio), ...blk(`Klasifikasi ${d.name}`, d.klas), ...blk(`Patofisiologi ${d.name}`, d.pato), ...blk(`Gambaran klinis ${d.name}`, d.klinis));
	L.push(...blk(`Kriteria diagnosis ${d.name}`, d.dx), ...blk(`Temuan pemeriksaan fisik ${d.name}`, d.pf), ...blk(`Diagnosis banding ${d.name}`, d.ddx));
	L.push(...blk(`Terapi farmakologi ${d.name}`, d.farm), ...blk(`Terapi nonfarmakologi ${d.name}`, d.non), ...blk(`Edukasi ${d.name}`, d.edu), ...blk(`Komplikasi ${d.name}`, d.komp), ...blk(`Kriteria rujukan ${d.name}`, d.rujuk));
	for (const r of d.rx) L.push(`Resep ${d.name} — ${c(r.label)}`, "?", ...r.items.map((i) => `- R/ ${c(i.r)} — ${c(i.s)}`), "");
	const f = await p.appendToNote(path, L.join("\n"));
	if (f) { new Notice(`🃏 Flashcard ${d.name} dibuat di ${path}`); play("chime"); void p.openAt(f.path, 0); }
}

// ================================================================ 4. PEMERIKSAAN FISIK — alur per sistem (Macleod); halaman utama ada di med-pfui.ts
export function pfFlowDetail(hub: HubView, el: HTMLElement, x: PfModule, onBack: () => void) {
	const p = hub.plugin;
	const top = el.createDiv("fch-dz-dtop");
	btn(top, { icon: "arrow-left", text: "Pemeriksaan fisik", cls: "fch-btn-ghost fch-btn-sm", onClick: onBack });
	el.createEl("h2", { cls: "fch-dz-title", text: `${x.icon} ${x.name}` });
	el.createDiv({ cls: "fch-md-p", text: x.intro });
	const pr = el.createEl("details", { cls: "fch-md-det" });
	pr.createEl("summary", { text: "Persiapan (wajib)" });
	list(pr, x.prep);
	const key = `pf:${x.id}`;
	const m = med(p);
	const done = new Set((m.notes[key] ?? "").split(",").filter(Boolean));
	for (const [si, s] of x.sections.entries()) {
		const c = section(el, "▸", s.title, "fch-mt");
		const ol = c.createEl("ol", { cls: "fch-pf-steps" });
		s.steps.forEach((st, i) => {
			const id = `${si}.${i}`;
			const li = ol.createEl("li", { cls: done.has(id) ? "is-done" : "" });
			const lab = li.createEl("label", { cls: "fch-pf-step" });
			const cb = lab.createEl("input", { type: "checkbox" });
			cb.checked = done.has(id);
			const tx = lab.createDiv("fch-grow");
			tx.createDiv({ cls: "fch-strong", text: st.t });
			if (st.how) tx.createDiv({ cls: "fch-small", text: st.how });
			cb.onchange = () => { if (cb.checked) done.add(id); else done.delete(id); li.toggleClass("is-done", cb.checked); m.notes[key] = [...done].join(","); p.requestSave(); };
		});
		if (s.abn?.length) {
			const t = c.createDiv("fch-pf-abn");
			t.createDiv({ cls: "fch-small fch-strong", text: "Temuan abnormal → makna" });
			for (const [a, b] of s.abn) { const r = t.createDiv("fch-pf-abnrow"); r.createDiv({ cls: "fch-pf-a", text: a }); r.createDiv({ cls: "fch-pf-b", text: b }); }
		}
	}
	if (x.pearls?.length) list(section(el, "💡", "Tips", "is-amber fch-mt"), x.pearls);
	const act = el.createDiv("fch-dz-links");
	btn(act, { text: "Reset centang", icon: "rotate-ccw", cls: "fch-btn-sm", onClick: () => { m.notes[key] = ""; p.requestSave(); hub.renderPage(); } });
	const sk = SKDI_SKILLS.filter((s) => s[0] === x.skdi);
	if (sk.length) {
		const d = el.createEl("details", { cls: "fch-md-det fch-mt" });
		d.createEl("summary", { text: `📋 Keterampilan klinis SKDI 2019 — ${sysOf(x.skdi).name || x.skdi} (${sk.length})` });
		const t = d.createDiv("fch-pf-skills");
		for (const [, name, lvl] of sk) { const r = t.createDiv("fch-pf-skill"); r.createDiv({ cls: "fch-grow", text: name }); if (lvl) lvlBadge(r, lvl === "4" ? "4" : lvl === "3" ? "3A" : lvl); }
	}
	const rel = DISEASES.filter((d) => d.pfMod.includes(x.id));
	if (rel.length) {
		const s = section(el, "🩺", "Penyakit terkait", "fch-mt");
		const w = s.createDiv("fch-dz-links");
		for (const d of rel) { const b = w.createEl("button", { cls: "fch-md-rchip is-link", text: d.name }); b.onclick = () => openDisease(hub, d.id, "dx"); }
	}
	disclaimer(el);
}

// ================================================================ 5. HALAMAN RESEP (pilih penyakit)
export function renderMedRx(hub: HubView, el: HTMLElement) {
	const head = el.createDiv("fch-dz-head");
	head.createEl("h2", { text: "📝 Resep berdasarkan penyakit" });
	head.createDiv({ cls: "fch-small fch-muted", text: "Pilih penyakit → pilih regimen → isi data pasien. Dosis anak dihitung otomatis dari BB." });
	const box = el.createDiv("fch-md-search");
	box.createSpan({ cls: "fch-md-search-ic", text: "🔎" });
	const inp = box.createEl("input", { type: "text", cls: "fch-md-search-in", attr: { placeholder: "Cari penyakit…" } });
	const listEl = el.createDiv("fch-dz-list");
	const draw = () => {
		listEl.empty();
		const q = norm(inp.value);
		for (const d of DISEASES.filter((x) => !q || norm(x.name + " " + (x.en ?? "")).includes(q))) {
			const row = listEl.createEl("button", { cls: "fch-dz-row" });
			row.createSpan({ cls: "fch-dz-row-ic", text: sysOf(d.sys).icon });
			const t = row.createDiv("fch-grow");
			t.createDiv({ cls: "fch-dz-row-t", text: d.name });
			t.createDiv({ cls: "fch-dz-row-s", text: d.rx.map((r) => r.label).join(" · ") });
			lvlBadge(row, d.lvl);
			row.onclick = () => { DZ.rx = 0; openDisease(hub, d.id, "rx"); };
		}
	};
	inp.oninput = draw;
	draw();
	disclaimer(el);
}
