/**
 * CPPT (Catatan Perkembangan Pasien Terintegrasi) — versi dokter, format SOAP.
 * Data disimpan di data plugin (data.json, tidak pernah diunggah). Fitur: daftar pasien, catatan SOAP dengan
 * tanda vital terstruktur, pemilih diagnosis + ICD-10 dari database penyakit, sisip resep (dosis menyesuaikan
 * BB/usia), salin dari catatan sebelumnya, grafik tren tanda vital, ekspor PDF (format formulir CPPT) & Markdown.
 */
import { Notice, TFile, normalizePath } from "obsidian";
import type { HubView } from "./hub-view";
import { DISEASES, Disease } from "./med-dis";
import { apls } from "./med-engine";
import { parseAgeMonths, rxLine } from "./med-rx";
import { copyText, disclaimer, med } from "./medis";
import { acc, chipRow, heroCard, ibtn, nrm } from "./med-ui";
import { footerPages, kop, measure, newPdf, para, pdfSafe, safeName, savePdf } from "./med-pdf";
import { btn } from "./util";
import { play } from "./sound";

// ---------------------------------------------------------------- data
export interface CpptVit { td?: string; n?: string; rr?: string; t?: string; spo2?: string; gcs?: string; nyeri?: string; bb?: string; gds?: string }
export interface CpptDx { name: string; icd: string; id?: string }
export interface CpptNote { id: string; pid: string; t: number; s: string; o: string; a: string; p: string; instr: string; vit: CpptVit; dx: CpptDx[]; by: string; edited?: number }
export interface CpptPatient { id: string; name: string; rm: string; sex: "L" | "P" | ""; dob: string; age: string; addr: string; allergy: string; room: string; dpjp: string; created: number; done?: boolean }
export interface CpptHeader { faskes: string; unit: string; addr: string }
export interface CpptState { patients: CpptPatient[]; notes: CpptNote[]; header: CpptHeader }
type Pending = { s?: string; o?: string; a?: string; p?: string; dx?: CpptDx[] };

export function cppt(hub: HubView): CpptState {
	const m = med(hub.plugin) as ReturnType<typeof med> & { cppt?: CpptState };
	m.cppt ??= { patients: [], notes: [], header: { faskes: "", unit: "", addr: "" } };
	const c = m.cppt;
	c.patients ??= []; c.notes ??= []; c.header ??= { faskes: "", unit: "", addr: "" };
	return c;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const VIT: [keyof CpptVit, string, string, string][] = [
	["td", "TD", "mmHg", "120/80"], ["n", "Nadi", "x/mnt", "80"], ["rr", "RR", "x/mnt", "18"], ["t", "Suhu", "°C", "36,7"], ["spo2", "SpO₂", "%", "98"],
	["gcs", "GCS", "", "E4V5M6"], ["nyeri", "Nyeri", "/10", "0"], ["bb", "BB", "kg", "60"], ["gds", "GDS", "mg/dL", "110"],
];
const fnum = (v?: string) => { const n = parseFloat((v ?? "").replace(",", ".")); return isFinite(n) ? n : NaN; };
/** Tandai tanda vital di luar rentang dewasa yang lazim. */
function vitBad(k: keyof CpptVit, v?: string): boolean {
	if (!v) return false;
	if (k === "td") { const [s, d] = v.split("/").map((x) => fnum(x)); return s >= 140 || s < 90 || d >= 90; }
	const n = fnum(v);
	if (!isFinite(n)) return false;
	return ({ n: n > 100 || n < 60, rr: n > 20 || n < 12, t: n >= 37.5 || n < 35.5, spo2: n < 95, nyeri: n >= 4, gds: n >= 200 || n < 70, bb: false, gcs: false } as Record<string, boolean>)[k] ?? false;
}
const vitLine = (v: CpptVit) => VIT.filter(([k]) => v[k]).map(([k, l, u]) => `${l} ${v[k]}${u && !u.startsWith("/") ? " " + u : u}`).join(", ");
const fmtDT = (t: number) => new Date(t).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtD = (t: number) => new Date(t).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtT = (t: number) => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
function ageOf(pt: CpptPatient): string {
	if (pt.dob) {
		const b = new Date(pt.dob), n = new Date();
		if (!isNaN(b.getTime())) {
			let mo = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
			if (n.getDate() < b.getDate()) mo--;
			return mo >= 24 ? `${Math.floor(mo / 12)} tahun` : mo >= 1 ? `${mo} bulan` : `${Math.max(0, Math.floor((n.getTime() - b.getTime()) / 864e5))} hari`;
		}
	}
	return pt.age;
}
const notesOf = (c: CpptState, pid: string) => c.notes.filter((n) => n.pid === pid).sort((a, b) => b.t - a.t);
const docName = (hub: HubView) => { const d = med(hub.plugin).doc!; return d.name ? (d.name.toLowerCase().startsWith("dr") ? d.name : `dr. ${d.name}`) : "Dokter"; };

// ---------------------------------------------------------------- state halaman
const C = { view: "list" as "list" | "patient" | "edit" | "pform", pid: "", nid: "", q: "", filt: "aktif", pending: null as Pending | null, draft: null as CpptNote | null };

/** Dipanggil dari penyakit/PF/resep: buka CPPT dengan isian awal. */
export function cpptPrefill(hub: HubView, pre: Pending) {
	C.pending = pre;
	const c = cppt(hub);
	if (C.pid && c.patients.some((x) => x.id === C.pid)) { C.view = "edit"; C.nid = ""; C.draft = null; }
	else C.view = "list";
	if (hub.page === "medcppt") hub.renderPage(); else hub.navigate("medcppt");
	if (C.view === "list") new Notice("Pilih pasien (atau tambah pasien baru) untuk membuat catatan CPPT dengan data ini.");
}

export function renderMedCppt(hub: HubView, el: HTMLElement) {
	const c = cppt(hub);
	el.addClass("fch-cp-page");
	const pt = c.patients.find((x) => x.id === C.pid);
	if ((C.view === "patient" || C.view === "edit") && !pt) C.view = "list";
	if (C.view === "pform") return patientForm(hub, el, c, C.pid ? pt : undefined);
	if (C.view === "edit" && pt) return editor(hub, el, c, pt);
	if (C.view === "patient" && pt) return patientView(hub, el, c, pt);
	return listView(hub, el, c);
}

// ================================================================ daftar pasien
function listView(hub: HubView, el: HTMLElement, c: CpptState) {
	const p = hub.plugin;
	const head = el.createDiv("fch-mx-pagehead");
	const ht = head.createDiv("fch-grow");
	ht.createEl("h2", { text: "📋 CPPT" });
	const act = c.patients.filter((x) => !x.done).length;
	ht.createDiv({ cls: "fch-small fch-muted", text: `Catatan Perkembangan Pasien Terintegrasi · ${act} pasien aktif · ${c.notes.length} catatan SOAP` });
	ibtn(head, "user-plus", "Pasien baru", () => { C.pid = ""; C.view = "pform"; hub.renderPage(); }, "fch-cp-newpt is-primary");
	if (C.pending) {
		const bn = el.createDiv("fch-cp-banner");
		bn.createDiv({ text: `✍️ Ada isian dari ${C.pending.dx?.length ? `diagnosis “${C.pending.dx[0].name}”` : C.pending.o ? "pemeriksaan fisik" : "resep"} — pilih pasien di bawah atau tambah pasien baru.` });
		btn(bn, { text: "Batalkan", cls: "fch-btn-sm fch-btn-ghost", onClick: () => { C.pending = null; hub.renderPage(); } });
	}
	const box = el.createDiv("fch-md-search fch-mx-search");
	box.createSpan({ cls: "fch-md-search-ic", text: "🔎" });
	const inp = box.createEl("input", { type: "text", cls: "fch-md-search-in", attr: { placeholder: "Cari nama, No. RM, ruang, atau diagnosis…" } });
	inp.value = C.q;
	chipRow(el, [{ id: "aktif", label: "Aktif", icon: "🟢", n: act }, { id: "selesai", label: "Selesai/pulang", icon: "✅", n: c.patients.length - act }, { id: "semua", label: "Semua", icon: "👥", n: c.patients.length }], C.filt, (v) => { C.filt = v; draw(); }, "fch-cp-filt");
	const list = el.createDiv("fch-cp-list");
	const draw = () => {
		list.empty();
		const q = nrm(C.q);
		let xs = c.patients.filter((x) => C.filt === "semua" || (C.filt === "aktif" ? !x.done : x.done));
		const last = (x: CpptPatient) => notesOf(c, x.id)[0];
		if (q) xs = xs.filter((x) => nrm([x.name, x.rm, x.room, ...(last(x)?.dx.map((d) => d.name + " " + d.icd) ?? [])].join(" ")).includes(q));
		xs.sort((a, b) => (last(b)?.t ?? b.created) - (last(a)?.t ?? a.created));
		if (!c.patients.length) {
			const e = list.createDiv("fch-cp-empty");
			e.createDiv({ cls: "fch-cp-empty-ic", text: "📋" });
			e.createDiv({ cls: "fch-strong", text: "Belum ada pasien" });
			e.createDiv({ cls: "fch-small fch-muted", text: "Tambahkan pasien, lalu tulis catatan SOAP harian. Semua data tersimpan lokal di perangkat ini (data plugin) dan bisa diekspor ke PDF." });
			btn(e, { text: "Tambah pasien pertama", icon: "user-plus", cls: "fch-btn-primary", onClick: () => { C.pid = ""; C.view = "pform"; hub.renderPage(); } });
			return;
		}
		if (!xs.length) list.createDiv({ cls: "fch-md-empty", text: "Tidak ada pasien yang cocok." });
		for (const x of xs) {
			const ln = last(x);
			const n = notesOf(c, x.id).length;
			const card = list.createEl("button", { cls: "fch-cp-card" + (x.done ? " is-done" : "") });
			const av = card.createDiv({ cls: "fch-cp-av", text: (x.name.trim()[0] ?? "?").toUpperCase() });
			av.toggleClass("is-p", x.sex === "P");
			const t = card.createDiv("fch-grow");
			t.createDiv({ cls: "fch-cp-name", text: x.name || "(tanpa nama)" });
			t.createDiv({ cls: "fch-small fch-muted", text: [x.rm ? `RM ${x.rm}` : "", [x.sex, ageOf(x)].filter(Boolean).join(", "), x.room].filter(Boolean).join(" · ") });
			if (ln?.dx.length) t.createDiv({ cls: "fch-cp-dxline", text: `A: ${ln.dx.map((d) => d.name).join("; ")}` });
			const r = card.createDiv("fch-cp-card-r");
			r.createDiv({ cls: "fch-cp-badge", text: `${n} catatan` });
			r.createDiv({ cls: "fch-small fch-muted", text: ln ? fmtDT(ln.t) : "belum ada catatan" });
			if (x.allergy) r.createDiv({ cls: "fch-cp-allergy is-mini", text: "⚠ alergi" });
			card.onclick = () => { C.pid = x.id; if (C.pending) { C.view = "edit"; C.nid = ""; C.draft = null; } else C.view = "patient"; hub.renderPage(); };
		}
	};
	inp.oninput = () => { C.q = inp.value; draw(); };
	draw();
	headerSettings(hub, el, c);
	const pv = el.createDiv("fch-cp-privacy");
	pv.setText("🔒 Data pasien hanya disimpan di data plugin pada perangkat ini (tidak di catatan vault, tidak diunggah). Ekspor PDF/Markdown akan membuat file di vault Anda — jaga kerahasiaannya sesuai UU Praktik Kedokteran & PMK Rekam Medis.");
	void p;
}

function headerSettings(hub: HubView, el: HTMLElement, c: CpptState) {
	const p = hub.plugin;
	const m = med(p);
	const d = m.doc!;
	const body = acc(el, "🏥", `Kop & identitas dokter${c.header.faskes ? ` — ${c.header.faskes}` : ""}`, false);
	const f = body.createDiv("fch-cp-form");
	const inp = (label: string, val: string, on: (v: string) => void, ph = "") => { const w = f.createDiv("fch-md-field"); w.createEl("label", { text: label }); const i = w.createEl("input", { type: "text", cls: "fch-md-in", attr: { placeholder: ph } }); i.value = val; i.oninput = () => { on(i.value); p.requestSave(); }; return i; };
	inp("Nama fasilitas kesehatan", c.header.faskes, (v) => (c.header.faskes = v), "RSUD / Puskesmas / Klinik …");
	inp("Unit/ruang", c.header.unit, (v) => (c.header.unit = v), "IGD / Rawat inap / Poli umum");
	inp("Alamat fasilitas", c.header.addr, (v) => (c.header.addr = v), "Jl. …");
	inp("Nama dokter", d.name, (v) => (d.name = v), "dr. Nama Anda");
	inp("No. SIP", d.sip, (v) => (d.sip = v), "SIP …");
	body.createDiv({ cls: "fch-small fch-muted", text: "Nama dokter & SIP dipakai bersama dengan kop resep." });
}

// ================================================================ form pasien
function patientForm(hub: HubView, el: HTMLElement, c: CpptState, pt?: CpptPatient) {
	const p = hub.plugin;
	const x: CpptPatient = pt ? { ...pt } : { id: uid(), name: "", rm: "", sex: "", dob: "", age: "", addr: "", allergy: "", room: "", dpjp: docName(hub), created: Date.now() };
	const top = el.createDiv("fch-dz-dtop fch-mx-top");
	btn(top, { icon: "arrow-left", text: pt ? "Kembali" : "Daftar pasien", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { C.view = pt ? "patient" : "list"; hub.renderPage(); } });
	el.createEl("h2", { text: pt ? "✏️ Edit identitas pasien" : "👤 Pasien baru" });
	const f = el.createDiv("fch-cp-form fch-cp-pform");
	const field = (label: string, k: keyof CpptPatient, ph = "", type = "text", wide = false) => {
		const w = f.createDiv("fch-md-field" + (wide ? " is-wide" : ""));
		w.createEl("label", { text: label });
		const i = w.createEl("input", { type, cls: "fch-md-in fch-cp-in-" + k, attr: { placeholder: ph } });
		i.value = String(x[k] ?? "");
		i.oninput = () => { (x as unknown as Record<string, string>)[k] = i.value; if (k === "dob") ageHint.setText(i.value ? `Umur: ${ageOf(x)}` : ""); };
		return i;
	};
	const nm = field("Nama pasien *", "name", "Tn./Ny./An. …", "text", true);
	field("No. rekam medis", "rm", "00-12-34");
	const sw = f.createDiv("fch-md-field");
	sw.createEl("label", { text: "Jenis kelamin" });
	const seg = sw.createDiv("fch-cp-sex");
	for (const [v, l] of [["L", "Laki-laki"], ["P", "Perempuan"]] as const) { const b = seg.createEl("button", { cls: "fch-mx-chip" + (x.sex === v ? " is-on" : ""), text: l }); b.onclick = () => { x.sex = v; seg.querySelectorAll("button").forEach((z) => z.removeClass("is-on")); b.addClass("is-on"); }; }
	field("Tanggal lahir", "dob", "", "date");
	const ageHint = f.createDiv({ cls: "fch-small fch-muted fch-cp-agehint", text: x.dob ? `Umur: ${ageOf(x)}` : "" });
	field("Umur (bila tgl lahir tak diketahui)", "age", "mis. 45 tahun");
	field("Ruang/bed", "room", "Melati 3 / IGD bed 2");
	field("DPJP", "dpjp", "dr. …");
	field("Alamat", "addr", "opsional", "text", true);
	field("Alergi", "allergy", "Obat/makanan; kosongkan bila tidak ada", "text", true);
	const act = el.createDiv("fch-dz-links");
	btn(act, { text: pt ? "Simpan perubahan" : "Simpan & tulis catatan pertama", icon: "save", cls: "fch-btn-primary fch-cp-savept", onClick: () => {
		if (!x.name.trim()) { new Notice("Nama pasien wajib diisi"); nm.focus(); return; }
		if (pt) Object.assign(pt, x); else c.patients.push(x);
		p.requestSave();
		C.pid = x.id;
		C.view = pt ? "patient" : "edit"; C.nid = ""; C.draft = null;
		hub.renderPage();
	} });
	if (pt) btn(act, { text: "Hapus pasien & semua catatan", icon: "trash", cls: "fch-btn-danger fch-btn-sm", onClick: () => {
		if (!confirmTwice(act, `hapus-${pt.id}`)) return;
		c.patients = c.patients.filter((y) => y.id !== pt.id); c.notes = c.notes.filter((n) => n.pid !== pt.id);
		p.requestSave(); C.pid = ""; C.view = "list"; hub.renderPage(); new Notice("Pasien dihapus");
	} });
	window.setTimeout(() => nm.focus(), 30);
}
/** Konfirmasi tanpa dialog bawaan (dialog memblokir di Obsidian mobile): ketuk dua kali dalam 4 detik. */
const armed = new Map<string, number>();
function confirmTwice(parent: HTMLElement, key: string): boolean {
	const t = armed.get(key);
	if (t && Date.now() - t < 4000) { armed.delete(key); return true; }
	armed.set(key, Date.now());
	new Notice("Ketuk sekali lagi untuk mengonfirmasi");
	void parent;
	return false;
}

// ================================================================ halaman pasien
function patientView(hub: HubView, el: HTMLElement, c: CpptState, pt: CpptPatient) {
	const p = hub.plugin;
	const ns = notesOf(c, pt.id);
	const top = el.createDiv("fch-dz-dtop fch-mx-top");
	btn(top, { icon: "arrow-left", text: "Daftar pasien", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { C.view = "list"; hub.renderPage(); } });
	top.createDiv("fch-grow");
	ibtn(top, "file-down", "Ekspor PDF", () => void exportPdf(hub, c, pt), "fch-cp-pdf");
	ibtn(top, "file-text", "Markdown", () => void exportMd(hub, c, pt));
	ibtn(top, "pencil", "Edit pasien", () => { C.view = "pform"; hub.renderPage(); });
	ibtn(top, pt.done ? "rotate-ccw" : "check-circle", pt.done ? "Aktifkan lagi" : "Selesai/pulang", () => { pt.done = !pt.done; p.requestSave(); hub.renderPage(); });

	const { chips } = heroCard(el, { color: pt.sex === "P" ? "#db2777" : "#0ea5e9", emoji: pt.sex === "P" ? "👩" : pt.sex === "L" ? "👨" : "🧑", kicker: [pt.rm ? `No. RM ${pt.rm}` : "", pt.room].filter(Boolean).join(" · ") || "Pasien", title: pt.name, titleCls: "fch-cp-title", sub: [pt.sex === "L" ? "Laki-laki" : pt.sex === "P" ? "Perempuan" : "", ageOf(pt), pt.dob ? `lahir ${fmtD(new Date(pt.dob).getTime())}` : "", pt.dpjp ? `DPJP ${pt.dpjp}` : ""].filter(Boolean).join(" · ") });
	chips.createSpan({ cls: "fch-mx-pill", text: `📝 ${ns.length} catatan` });
	if (pt.done) chips.createSpan({ cls: "fch-mx-pill", text: "✅ Selesai" });
	if (pt.allergy) el.createDiv({ cls: "fch-cp-allergy", text: `⚠ Alergi: ${pt.allergy}` });

	const add = el.createDiv("fch-cp-addbar");
	btn(add, { text: "Catatan SOAP baru", icon: "plus", cls: "fch-btn-primary fch-cp-addnote", onClick: () => { C.view = "edit"; C.nid = ""; C.draft = null; hub.renderPage(); } });
	if (ns.length) btn(add, { text: "Lanjutkan dari catatan terakhir", icon: "copy-plus", cls: "fch-cp-carry", onClick: () => { C.view = "edit"; C.nid = ""; C.draft = carry(ns[0]); hub.renderPage(); } });

	if (ns.length >= 2) trends(el, ns);
	const tl = el.createDiv("fch-cp-timeline");
	if (!ns.length) tl.createDiv({ cls: "fch-md-empty", text: "Belum ada catatan. Ketuk “Catatan SOAP baru”." });
	let lastDay = "";
	for (const n of ns) {
		const day = new Date(n.t).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
		if (day !== lastDay) { tl.createDiv({ cls: "fch-cp-day", text: day }); lastDay = day; }
		noteCard(hub, tl, c, pt, n);
	}
	disclaimer(el);
}

function carry(n: CpptNote): CpptNote {
	return { ...n, id: "", t: Date.now(), vit: {}, s: "", o: n.o, a: n.a, p: n.p, instr: n.instr, dx: n.dx.map((d) => ({ ...d })), edited: undefined };
}

function noteCard(hub: HubView, parent: HTMLElement, c: CpptState, pt: CpptPatient, n: CpptNote) {
	const p = hub.plugin;
	const card = parent.createDiv("fch-cp-note");
	const h = card.createDiv("fch-cp-note-h");
	h.createSpan({ cls: "fch-cp-time", text: fmtT(n.t) });
	h.createSpan({ cls: "fch-small fch-muted", text: `${n.by || "Dokter"}${n.edited ? " · disunting" : ""}` });
	h.createDiv("fch-grow");
	ibtn(h, "pencil", "Edit", () => { C.view = "edit"; C.nid = n.id; C.draft = null; hub.renderPage(); }, "fch-mx-only-ic fch-cp-edit");
	ibtn(h, "copy-plus", "Salin ke catatan baru", () => { C.view = "edit"; C.nid = ""; C.draft = carry(n); hub.renderPage(); }, "fch-mx-only-ic");
	ibtn(h, "copy", "Salin teks", () => copyText(noteText(n), "Catatan disalin"), "fch-mx-only-ic");
	ibtn(h, "trash", "Hapus", () => { if (!confirmTwice(h, n.id)) return; c.notes = c.notes.filter((x) => x.id !== n.id); p.requestSave(); hub.renderPage(); }, "fch-mx-only-ic fch-cp-del");
	const vs = VIT.filter(([k]) => n.vit[k]);
	if (vs.length) {
		const vr = card.createDiv("fch-cp-vits");
		for (const [k, l, u] of vs) { const chip = vr.createSpan({ cls: "fch-cp-vit" + (vitBad(k, n.vit[k]) ? " is-bad" : "") }); chip.createSpan({ cls: "fch-cp-vit-l", text: l }); chip.createSpan({ text: ` ${n.vit[k]}${u ? (u.startsWith("/") ? u : " " + u) : ""}` }); }
	}
	const sec = (k: string, label: string, text: string) => { if (!text.trim()) return; const r = card.createDiv("fch-cp-soap is-" + k); r.createSpan({ cls: "fch-cp-soap-k", text: label }); r.createDiv({ cls: "fch-cp-soap-v", text }); };
	sec("s", "S", n.s);
	sec("o", "O", n.o);
	if (n.dx.length || n.a.trim()) {
		const r = card.createDiv("fch-cp-soap is-a");
		r.createSpan({ cls: "fch-cp-soap-k", text: "A" });
		const v = r.createDiv("fch-cp-soap-v");
		if (n.dx.length) { const w = v.createDiv("fch-cp-dxs"); for (const d of n.dx) w.createSpan({ cls: "fch-cp-dx", text: d.icd ? `${d.name} (${d.icd})` : d.name }); }
		if (n.a.trim()) v.createDiv({ text: n.a });
	}
	sec("p", "P", n.p);
	sec("i", "Instruksi", n.instr);
	void pt;
}

export function noteText(n: CpptNote): string {
	const L = [`${fmtDT(n.t)} — ${n.by || "Dokter"}`];
	const v = vitLine(n.vit);
	if (n.s.trim()) L.push(`S: ${n.s.trim()}`);
	if (n.o.trim() || v) L.push(`O: ${[v ? `TTV: ${v}` : "", n.o.trim()].filter(Boolean).join("\n")}`);
	const a = [n.dx.map((d) => (d.icd ? `${d.name} (${d.icd})` : d.name)).join("; "), n.a.trim()].filter(Boolean).join("\n");
	if (a) L.push(`A: ${a}`);
	if (n.p.trim()) L.push(`P: ${n.p.trim()}`);
	if (n.instr.trim()) L.push(`Instruksi: ${n.instr.trim()}`);
	return L.join("\n");
}

/** Grafik tren tanda vital kecil (SVG) dari catatan-catatan pasien. */
function trends(el: HTMLElement, ns: CpptNote[]) {
	const asc = [...ns].reverse();
	const series: [string, string, (n: CpptNote) => number, string, [number, number]][] = [
		["TD sistolik", "mmHg", (n) => fnum(n.vit.td?.split("/")[0]), "#6366f1", [90, 140]],
		["Nadi", "x/mnt", (n) => fnum(n.vit.n), "#f59e0b", [60, 100]],
		["Suhu", "°C", (n) => fnum(n.vit.t), "#0d9488", [35.5, 37.5]],
		["SpO₂", "%", (n) => fnum(n.vit.spo2), "#0ea5e9", [95, 100]],
		["GDS", "mg/dL", (n) => fnum(n.vit.gds), "#65a30d", [70, 200]],
		["Nyeri", "/10", (n) => fnum(n.vit.nyeri), "#8b5cf6", [0, 3]],
	];
	const shown = series.filter(([, , f]) => asc.filter((n) => isFinite(f(n))).length >= 2);
	if (!shown.length) return;
	const box = acc(el, "📈", "Tren tanda vital", true);
	const g = box.createDiv("fch-cp-trends");
	const NS = "http://www.w3.org/2000/svg";
	for (const [label, unit, f, color, [lo, hi]] of shown) {
		const pts = asc.map((n) => [n.t, f(n)] as const).filter(([, v]) => isFinite(v));
		const c = g.createDiv("fch-cp-trend");
		c.style.setProperty("--c", color);
		const last = pts[pts.length - 1][1];
		const hd = c.createDiv("fch-cp-trend-h");
		hd.createSpan({ cls: "fch-small fch-muted", text: label });
		hd.createSpan({ cls: "fch-cp-trend-v" + (last < lo || last > hi ? " is-bad" : ""), text: `${String(last).replace(".", ",")}${unit.startsWith("/") ? "" : " "}${unit}` });
		const W = 220, H = 56, P = 5;
		const vs = pts.map(([, v]) => v);
		const mn = Math.min(...vs, lo), mx = Math.max(...vs, hi);
		const t0 = pts[0][0], t1 = pts[pts.length - 1][0];
		const X = (t: number) => P + (t1 === t0 ? (W - 2 * P) / 2 : ((t - t0) / (t1 - t0)) * (W - 2 * P));
		const Y = (v: number) => H - P - ((v - mn) / (mx - mn || 1)) * (H - 2 * P);
		const svg = document.createElementNS(NS, "svg");
		svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
		svg.setAttribute("class", "fch-cp-spark");
		svg.setAttribute("preserveAspectRatio", "none");
		const band = document.createElementNS(NS, "rect");
		band.setAttribute("x", "0"); band.setAttribute("width", String(W));
		band.setAttribute("y", String(Y(hi))); band.setAttribute("height", String(Math.max(0, Y(lo) - Y(hi))));
		band.setAttribute("class", "fch-cp-band");
		svg.appendChild(band);
		const path = document.createElementNS(NS, "polyline");
		path.setAttribute("points", pts.map(([t, v]) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join(" "));
		path.setAttribute("class", "fch-cp-line");
		svg.appendChild(path);
		for (const [t, v] of pts) { const d = document.createElementNS(NS, "line"); d.setAttribute("x1", X(t).toFixed(1)); d.setAttribute("y1", Y(v).toFixed(1)); d.setAttribute("x2", X(t).toFixed(1)); d.setAttribute("y2", Y(v).toFixed(1)); d.setAttribute("class", "fch-cp-dot" + (v < lo || v > hi ? " is-bad" : "")); const tt = document.createElementNS(NS, "title"); tt.textContent = `${fmtDT(t)}: ${v} ${unit}`; d.appendChild(tt); svg.appendChild(d); }
		c.appendChild(svg);
	}
}

// ================================================================ editor SOAP
const O_TPL: [string, string][] = [
	["KU", "KU: tampak sakit ringan, kompos mentis (GCS E4V5M6)."],
	["Kepala-leher", "Kepala: konjungtiva anemis (−/−), sklera ikterik (−/−). Leher: JVP tidak meningkat, KGB tidak membesar."],
	["Toraks", "Paru: simetris, vesikuler +/+, ronki −/−, wheezing −/−. Jantung: BJ I–II reguler, murmur (−), gallop (−)."],
	["Abdomen", "Abdomen: datar, supel, bising usus (+) normal, nyeri tekan (−), hepar/lien tidak teraba."],
	["Ekstremitas", "Ekstremitas: akral hangat, CRT < 2 detik, edema (−)."],
	["Neurologis", "Neurologis: pupil isokor 3 mm/3 mm, RC +/+, motorik 5555/5555, refleks fisiologis +2, patologis (−)."],
];
const S_TPL = ["Keluhan membaik.", "Demam (−), mual (−), muntah (−).", "Makan-minum baik, BAB/BAK normal.", "Nyeri berkurang.", "Sesak (−), batuk berkurang.", "Tidur cukup."];
const I_TPL = ["Observasi TTV tiap 4 jam.", "Cek DL ulang besok pagi.", "Diet lunak.", "Mobilisasi bertahap.", "Rencana pulang bila klinis stabil.", "Konsul spesialis terkait.", "Edukasi pasien & keluarga."];

function editor(hub: HubView, el: HTMLElement, c: CpptState, pt: CpptPatient) {
	const p = hub.plugin;
	const old = C.nid ? c.notes.find((n) => n.id === C.nid) : undefined;
	const n: CpptNote = C.draft ?? (old ? { ...old, vit: { ...old.vit }, dx: old.dx.map((d) => ({ ...d })) } : { id: "", pid: pt.id, t: Date.now(), s: "", o: "", a: "", p: "", instr: "", vit: {}, dx: [], by: docName(hub) });
	n.pid = pt.id;
	C.draft = n;
	if (C.pending) {
		const pe = C.pending;
		const join = (a: string, b?: string) => (b ? (a.trim() ? `${a.trimEnd()}\n${b}` : b) : a);
		n.s = join(n.s, pe.s); n.o = join(n.o, pe.o); n.a = join(n.a, pe.a); n.p = join(n.p, pe.p);
		for (const d of pe.dx ?? []) if (!n.dx.some((x) => x.name === d.name)) n.dx.push(d);
		C.pending = null;
	}
	const top = el.createDiv("fch-dz-dtop fch-mx-top");
	btn(top, { icon: "x", text: "Batal", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { C.draft = null; C.view = "patient"; hub.renderPage(); } });
	top.createDiv({ cls: "fch-grow fch-cp-edtitle", text: `${old ? "Edit catatan" : "Catatan baru"} · ${pt.name}` });
	const save = () => {
		if (!n.s.trim() && !n.o.trim() && !n.a.trim() && !n.p.trim() && !n.dx.length && !Object.values(n.vit).some(Boolean)) { new Notice("Isi minimal satu bagian SOAP"); return; }
		for (const k of Object.keys(n.vit) as (keyof CpptVit)[]) if (!n.vit[k]?.trim()) delete n.vit[k];
		if (old) { Object.assign(old, n, { edited: Date.now() }); }
		else c.notes.push({ ...n, id: uid() });
		p.requestSave(); play("chime");
		C.draft = null; C.view = "patient"; hub.renderPage();
		new Notice("💾 Catatan CPPT disimpan");
	};
	btn(top, { icon: "save", text: "Simpan", cls: "fch-btn-primary fch-btn-sm fch-cp-save", onClick: save });
	if (pt.allergy) el.createDiv({ cls: "fch-cp-allergy", text: `⚠ Alergi: ${pt.allergy}` });

	// waktu & PPA
	const meta = el.createDiv("fch-cp-form fch-cp-meta");
	const w1 = meta.createDiv("fch-md-field");
	w1.createEl("label", { text: "Tanggal & jam" });
	const dt = w1.createEl("input", { type: "datetime-local", cls: "fch-md-in fch-cp-dt" });
	const z = (x: number) => String(x).padStart(2, "0");
	const d0 = new Date(n.t);
	dt.value = `${d0.getFullYear()}-${z(d0.getMonth() + 1)}-${z(d0.getDate())}T${z(d0.getHours())}:${z(d0.getMinutes())}`;
	dt.onchange = () => { const t = new Date(dt.value).getTime(); if (isFinite(t)) n.t = t; };
	const w2 = meta.createDiv("fch-md-field");
	w2.createEl("label", { text: "PPA (dokter)" });
	const by = w2.createEl("input", { type: "text", cls: "fch-md-in" });
	by.value = n.by; by.oninput = () => (n.by = by.value);

	// tanda vital
	const vb = acc(el, "💓", "Tanda vital", true, "is-accent");
	const vg = vb.createDiv("fch-cp-vitform");
	for (const [k, l, u, ph] of VIT) {
		const w = vg.createDiv("fch-cp-vf");
		w.createEl("label", { text: `${l}${u ? ` (${u})` : ""}` });
		const i = w.createEl("input", { type: "text", cls: "fch-md-in fch-cp-v-" + k, attr: { placeholder: ph, inputmode: k === "td" || k === "gcs" ? "text" : "decimal" } });
		i.value = n.vit[k] ?? "";
		const chk = () => i.toggleClass("is-bad", vitBad(k, i.value));
		i.oninput = () => { n.vit[k] = i.value; chk(); };
		chk();
	}
	const prevN = notesOf(c, pt.id).find((x) => x.id !== n.id && Object.keys(x.vit).length);
	if (prevN) vb.createDiv({ cls: "fch-small fch-muted", text: `Sebelumnya (${fmtDT(prevN.t)}): ${vitLine(prevN.vit)}` });

	const area = (k: "s" | "o" | "a" | "p" | "instr", icon: string, title: string, ph: string, tpl?: (ta: HTMLTextAreaElement) => void) => {
		const b = acc(el, icon, title, true, "fch-cp-sec-" + k);
		if (tpl) { const t = b.createDiv("fch-cp-tpl"); tpl(t as unknown as HTMLTextAreaElement); }
		const ta = b.createEl("textarea", { cls: "fch-md-note fch-cp-ta fch-cp-ta-" + k, attr: { placeholder: ph, rows: "3" } });
		ta.value = n[k];
		const fit = () => { ta.style.height = "auto"; ta.style.height = `${Math.min(420, ta.scrollHeight + 2)}px`; };
		ta.oninput = () => { n[k] = ta.value; fit(); };
		window.setTimeout(fit, 0);
		return { b, ta };
	};
	const addTo = (ta: HTMLTextAreaElement, txt: string) => { ta.value = ta.value.trim() ? `${ta.value.trimEnd()}\n${txt}` : txt; ta.dispatchEvent(new Event("input")); };
	const chipsFor = (host: HTMLElement, items: [string, string][], getTa: () => HTMLTextAreaElement) => { for (const [l, t] of items) { const b = host.createEl("button", { cls: "fch-md-rchip is-link", text: `+ ${l}` }); b.onclick = () => addTo(getTa(), t); } };

	let sTa!: HTMLTextAreaElement, oTa!: HTMLTextAreaElement, pTa!: HTMLTextAreaElement, iTa!: HTMLTextAreaElement;
	sTa = area("s", "🗣️", "S — Subjektif", "Keluhan, riwayat singkat sejak catatan terakhir…", (h) => chipsFor(h as unknown as HTMLElement, S_TPL.map((x) => [x.replace(/\.$/, ""), x]), () => sTa)).ta;
	oTa = area("o", "🩺", "O — Objektif", "Pemeriksaan fisik & penunjang (TTV terisi otomatis di atas)…", (h) => chipsFor(h as unknown as HTMLElement, O_TPL, () => oTa)).ta;

	// A — diagnosis
	const ab = acc(el, "🎯", "A — Asesmen / diagnosis", true, "fch-cp-sec-a");
	const dxw = ab.createDiv("fch-cp-dxs fch-cp-dxedit");
	const drawDx = () => {
		dxw.empty();
		if (!n.dx.length) dxw.createSpan({ cls: "fch-small fch-muted", text: "Belum ada diagnosis — cari di bawah atau ketik bebas." });
		n.dx.forEach((d, i) => { const ch = dxw.createSpan({ cls: "fch-cp-dx is-edit", text: d.icd ? `${d.name} (${d.icd})` : d.name }); const x = ch.createEl("button", { cls: "fch-cp-dx-x", text: "✕", attr: { "aria-label": "Hapus" } }); x.onclick = () => { n.dx.splice(i, 1); drawDx(); drawRx(); }; });
	};
	const pick = ab.createDiv("fch-md-pick");
	const sbox = pick.createDiv("fch-md-search");
	sbox.createSpan({ cls: "fch-md-search-ic", text: "🔎" });
	const dIn = sbox.createEl("input", { type: "text", cls: "fch-md-search-in fch-cp-dxin", attr: { placeholder: "Cari diagnosis atau kode ICD-10… (Enter = tambah teks bebas)" } });
	const sug = pick.createDiv("fch-md-sug");
	let hits: Disease[] = [];
	const addDx = (d: CpptDx) => { if (!n.dx.some((x) => x.name === d.name)) n.dx.push(d); dIn.value = ""; sug.empty(); sug.removeClass("is-open"); drawDx(); drawRx(); };
	dIn.oninput = () => {
		sug.empty();
		const q = nrm(dIn.value);
		if (q.length < 2) { sug.removeClass("is-open"); return; }
		const ws = q.split(" ");
		hits = DISEASES.filter((d) => { const t = nrm(`${d.name} ${d.en ?? ""} ${d.icd ?? ""}`); return ws.every((w) => t.includes(w)); }).slice(0, 8);
		sug.toggleClass("is-open", hits.length > 0);
		for (const d of hits) { const r = sug.createDiv("fch-md-sug-row"); const t = r.createDiv("fch-grow"); t.createDiv({ cls: "fch-strong", text: d.name }); t.createDiv({ cls: "fch-small fch-muted", text: [d.icd, d.en].filter(Boolean).join(" · ") }); r.onmousedown = (e) => { e.preventDefault(); addDx({ name: d.name, icd: d.icd ?? "", id: d.id }); }; }
	};
	dIn.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); if (hits[0] && sug.hasClass("is-open")) addDx({ name: hits[0].name, icd: hits[0].icd ?? "", id: hits[0].id }); else if (dIn.value.trim()) addDx({ name: dIn.value.trim(), icd: "" }); } };
	dIn.onblur = () => window.setTimeout(() => sug.removeClass("is-open"), 150);
	const aTa = ab.createEl("textarea", { cls: "fch-md-note fch-cp-ta fch-cp-ta-a", attr: { placeholder: "Catatan asesmen: masalah aktif, derajat, perkembangan…", rows: "2" } });
	aTa.value = n.a; aTa.oninput = () => (n.a = aTa.value);
	drawDx();

	// P — rencana + sisip resep
	const pr = area("p", "💊", "P — Rencana / terapi", "Terapi, pemeriksaan lanjutan, edukasi…");
	pTa = pr.ta;
	const rxBox = pr.b.createDiv("fch-cp-rx");
	const drawRx = () => {
		rxBox.empty();
		const ds = n.dx.map((d) => (d.id ? DISEASES.find((x) => x.id === d.id) : undefined)).filter((d): d is Disease => !!d && d.rx.length > 0);
		if (!ds.length) { rxBox.createDiv({ cls: "fch-small fch-muted", text: "💡 Pilih diagnosis dari database untuk menyisipkan resep standar (dosis menyesuaikan umur & BB pasien)." }); return; }
		rxBox.createDiv({ cls: "fch-small fch-strong", text: "Sisipkan resep:" });
		const w = rxBox.createDiv("fch-dz-links");
		for (const d of ds) for (const rx of d.rx) {
			const b = w.createEl("button", { cls: "fch-md-rchip is-link fch-cp-rxchip", text: `📝 ${d.name}: ${rx.label}` });
			b.onclick = () => addTo(pTa, rxForPatient(pt, n, rx));
		}
	};
	drawRx();
	iTa = area("instr", "📌", "Instruksi & tindak lanjut", "Instruksi untuk perawat/PPA lain, rencana kontrol…", (h) => chipsFor(h as unknown as HTMLElement, I_TPL.map((x) => [x.replace(/\.$/, ""), x]), () => iTa)).ta;
	void sTa; void oTa;

	const act = el.createDiv("fch-dz-links fch-cp-actbar");
	btn(act, { text: "Simpan catatan", icon: "save", cls: "fch-btn-primary fch-cp-save2", onClick: save });
	const prevAny = notesOf(c, pt.id).find((x) => x.id !== n.id);
	if (prevAny && !old) btn(act, { text: "Salin S/O/A/P dari catatan terakhir", icon: "copy-plus", onClick: () => { C.draft = { ...carry(prevAny), vit: n.vit, t: n.t, s: n.s || prevAny.s }; hub.renderPage(); } });
	btn(act, { text: "Batal", cls: "fch-btn-ghost", onClick: () => { C.draft = null; C.view = "patient"; hub.renderPage(); } });
}

/** Teks resep untuk ditempel di P, dosis dihitung dari umur & BB terbaru pasien. */
function rxForPatient(pt: CpptPatient, n: CpptNote, rx: Disease["rx"][number]): string {
	const ageTxt = ageOf(pt);
	const am0 = parseAgeMonths(ageTxt, rx.who);
	const ageM = am0 ?? (rx.who === "anak" ? 48 : 360);
	const type: "anak" | "dewasa" = am0 !== null ? (ageM < 216 ? "anak" : "dewasa") : rx.who;
	const wIn = fnum(n.vit.bb);
	const est = type === "anak" ? apls(ageM) : NaN;
	const w = wIn > 0 ? wIn : type === "anak" && isFinite(est) ? Math.round(est * 10) / 10 : 60;
	const ptx = { type, w, ageY: Math.floor(ageM / 12), ageM: ageM % 12, h: 0, sex: pt.sex === "P" ? "P" : "L", scr: 0, preg: false, lact: false, wAuto: !(wIn > 0) } as unknown as Parameters<typeof rxLine>[1];
	const lines = rx.items.map((it) => rxLine(it, ptx));
	const head = `${rx.label}${!(wIn > 0) && type === "anak" ? ` (BB perkiraan ${w} kg)` : ""}:`;
	const al = allergyHits(pt.allergy, lines.map((l) => l.d).filter((d): d is NonNullable<typeof d> => !!d));
	if (al.length) new Notice(`⚠ PERHATIAN ALERGI: pasien alergi “${pt.allergy}” — resep berisi ${al.join(", ")}. Periksa ulang/ganti obat!`, 9000);
	return [head, ...lines.map((l) => `- R/ ${l.r.replace(/\n/g, " ")} — ${l.s}${l.d && al.includes(l.d.name) ? " ⚠ ALERGI" : ""}${l.warn ? ` ⚠ ${l.warn}` : ""}`)].join("\n");
}

/** Obat dalam resep yang cocok dengan teks alergi pasien (nama obat atau golongannya, mis. "penisilin"). */
export function allergyHits(allergy: string, drugs: { name: string; cls: string; alias?: string[] }[]): string[] {
	const a = nrm(allergy);
	if (!a || /^(tidak ada|tidak|disangkal|negatif|-)$/.test(a)) return [];
	const aw = a.split(" ").filter((w) => w.length >= 5);
	const hits: string[] = [];
	for (const d of drugs) {
		const dn = nrm([d.name, ...(d.alias ?? [])].join(" "));
		const dc = nrm(d.cls);
		const nameW = dn.split(" ").filter((w) => w.length >= 5);
		const sulfa = /sulfa|kotrimoksazol/.test(a) && /sulfa|kotrimoksazol/.test(dn + " " + dc);
		const pen = /penisilin|penicillin/.test(a) && /penisilin|amoksisilin|ampisilin|amoxicillin/.test(dn + " " + dc);
		const nsaid = /oains|nsaid/.test(a) && /oains|nsaid/.test(dc);
		if (sulfa || pen || nsaid || nameW.some((w) => a.includes(w)) || aw.some((w) => dn.includes(w) || dc.includes(w))) hits.push(d.name);
	}
	return [...new Set(hits)];
}

// ================================================================ ekspor
async function exportMd(hub: HubView, c: CpptState, pt: CpptPatient) {
	const p = hub.plugin;
	const ns = notesOf(c, pt.id).reverse();
	const L = [`# CPPT — ${pt.name}`, "", `- No. RM: ${pt.rm || "-"}`, `- Jenis kelamin / umur: ${pt.sex || "-"} / ${ageOf(pt) || "-"}`, `- Ruang: ${pt.room || "-"} · DPJP: ${pt.dpjp || "-"}`, `- Alergi: ${pt.allergy || "tidak ada"}`, `- Diekspor: ${fmtDT(Date.now())}`, ""];
	for (const n of ns) L.push(`## ${fmtDT(n.t)}`, "", "```text", noteText(n), "```", "");
	const dir = "CPPT";
	if (!p.app.vault.getAbstractFileByPath(dir)) { try { await p.app.vault.createFolder(dir); } catch { /* ada */ } }
	const path = normalizePath(`${dir}/${safeName(pt.name)}${pt.rm ? ` RM ${safeName(pt.rm)}` : ""}.md`);
	const ex = p.app.vault.getAbstractFileByPath(path);
	if (ex instanceof TFile) await p.app.vault.modify(ex, L.join("\n"));
	else await p.app.vault.create(path, L.join("\n"));
	new Notice(`📝 CPPT diekspor ke ${path}`);
}

/** PDF format formulir CPPT (A4 tegak): kop, identitas pasien, tabel Tgl/Jam | PPA | SOAP | Instruksi | Verifikasi. */
export function cpptPdfDoc(hub: HubView, c: CpptState, pt: CpptPatient) {
	const d = med(hub.plugin).doc!;
	const ns = notesOf(c, pt.id).reverse();
	const cx = newPdf("a4");
	const { doc, W, H, M } = cx;
	kop(cx, c.header.faskes || "Fasilitas Kesehatan", [c.header.addr, c.header.unit ? `Unit: ${c.header.unit}` : ""], "RM-CPPT");
	doc.setFont("helvetica", "bold"); doc.setFontSize(12);
	doc.text("CATATAN PERKEMBANGAN PASIEN TERINTEGRASI (CPPT)", W / 2, cx.y + 3, { align: "center" });
	cx.y += 7;
	// identitas
	const idL: [string, string][] = [["Nama", pt.name], ["No. RM", pt.rm || "-"], ["Tgl lahir / umur", `${pt.dob ? fmtD(new Date(pt.dob).getTime()) : "-"} / ${ageOf(pt) || "-"}`], ["Jenis kelamin", pt.sex === "L" ? "Laki-laki" : pt.sex === "P" ? "Perempuan" : "-"]];
	const idR: [string, string][] = [["Ruang/bed", pt.room || "-"], ["DPJP", pt.dpjp || "-"], ["Alergi", pt.allergy || "Tidak ada"], ["Alamat", pt.addr || "-"]];
	const bx = cx.y, bh = 4 * 5 + 3;
	doc.setLineWidth(0.3); doc.rect(M, bx, W - 2 * M, bh);
	const half = (W - 2 * M) / 2;
	const kv = (x: number, y: number, k: string, v: string, red = false) => { doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.text(k, x + 2, y); doc.setFont("helvetica", "normal"); if (red) doc.setTextColor(200, 0, 0); doc.text(pdfSafe(": " + v).slice(0, 60), x + 27, y); doc.setTextColor(0); };
	idL.forEach(([k, v], i) => kv(M, bx + 5 + i * 5, k, v));
	idR.forEach(([k, v], i) => kv(M + half, bx + 5 + i * 5, k, v, k === "Alergi" && !!pt.allergy));
	cx.y = bx + bh + 4;
	// tabel
	const cols = [{ t: "Tgl / Jam", w: 21 }, { t: "PPA", w: 22 }, { t: "Hasil Asesmen Pasien (SOAP)", w: 79 }, { t: "Instruksi PPA", w: 36 }, { t: "Review & Verifikasi DPJP", w: 24 }];
	const tw = cols.reduce((a, x) => a + x.w, 0);
	const sc = (W - 2 * M) / tw;
	cols.forEach((x) => (x.w *= sc));
	const FS = 8.2, LH = FS * 0.3528 * 1.32, PAD = 1.6;
	const header = () => {
		const HH = 9;
		doc.setDrawColor(90); doc.setLineWidth(0.25);
		let x = M;
		for (const col of cols) {
			doc.setFillColor(226, 238, 235);
			doc.rect(x, cx.y, col.w, HH, "FD");
			doc.setFont("helvetica", "bold"); doc.setFontSize(7.6); doc.setTextColor(20);
			const ls = doc.splitTextToSize(col.t, col.w - 2) as string[];
			ls.forEach((l, i) => doc.text(l, x + col.w / 2, cx.y + HH / 2 + 1 + (i - (ls.length - 1) / 2) * 3.1, { align: "center" }));
			x += col.w;
		}
		doc.setTextColor(0);
		cx.y += HH;
	};
	type Ln = { t: string; b?: boolean; i?: number; lab?: string };
	const wrap = (text: string, w: number, bold = false, indent = 0): Ln[] => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(FS); return text.split("\n").flatMap((s) => (doc.splitTextToSize(pdfSafe(s), w - indent) as string[]).map((t) => ({ t, b: bold, i: indent }))); };
	const soap = (n: CpptNote, w: number): Ln[] => {
		const out: Ln[] = [];
		const blk = (k: string, txt: string) => { if (!txt.trim()) return; wrap(txt.trim(), w - 2 * PAD, false, 5.5).forEach((l, j) => out.push(j === 0 ? { ...l, lab: k } : l)); };
		const v = vitLine(n.vit);
		blk("S:", n.s);
		blk("O:", [v ? `TTV: ${v}` : "", n.o.trim()].filter(Boolean).join("\n"));
		blk("A:", [n.dx.map((x) => (x.icd ? `${x.name} (${x.icd})` : x.name)).join("; "), n.a.trim()].filter(Boolean).join("\n"));
		blk("P:", n.p);
		return out;
	};
	header();
	const bottom = H - 26;
	for (const n of ns) {
		const cells: Ln[][] = [
			[{ t: fmtD(n.t) }, { t: fmtT(n.t), b: true }],
			wrap(n.by || docName(hub), cols[1].w - 2 * PAD).concat([{ t: "(Dokter)" }]),
			soap(n, cols[2].w),
			wrap(n.instr || "", cols[3].w - 2 * PAD),
			[],
		];
		const rows = Math.max(3, ...cells.map((x) => x.length));
		let start = 0;
		while (start < rows) {
			let avail = Math.floor((bottom - cx.y - 2 * PAD) / LH);
			if (avail < 3) { doc.addPage(); cx.y = M; header(); avail = Math.floor((bottom - cx.y - 2 * PAD) / LH); }
			const k = Math.min(avail, rows - start);
			const h = k * LH + 2 * PAD;
			let x = M;
			doc.setDrawColor(90); doc.setLineWidth(0.25);
			cells.forEach((cell, ci) => {
				doc.rect(x, cx.y, cols[ci].w, h);
				for (let j = 0; j < k; j++) {
					const ln = cell[start + j];
					if (!ln) continue;
					const yy = cx.y + PAD + (j + 0.78) * LH;
					if (ln.lab) { doc.setFont("helvetica", "bold"); doc.setFontSize(FS); doc.text(ln.lab, x + PAD, yy); }
					doc.setFont("helvetica", ln.b ? "bold" : "normal"); doc.setFontSize(FS);
					doc.text(ln.t, x + PAD + (ln.i ?? 0), yy);
				}
				x += cols[ci].w;
			});
			cx.y += h; start += k;
			if (start < rows) { doc.addPage(); cx.y = M; header(); }
		}
	}
	if (!ns.length) { doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.text("Belum ada catatan.", M + 2, cx.y + 5); cx.y += 8; }
	// tanda tangan
	if (cx.y > bottom - 30) { doc.addPage(); cx.y = M; }
	cx.y += 8;
	const sx = W - M - 62;
	doc.setFont("helvetica", "normal"); doc.setFontSize(9);
	doc.text(pdfSafe(`Dicetak ${fmtDT(Date.now())}`), sx, cx.y);
	doc.text("Dokter Penanggung Jawab,", sx, cx.y + 5);
	doc.setFont("helvetica", "bold");
	doc.text(pdfSafe(pt.dpjp || docName(hub)), sx, cx.y + 24);
	doc.setLineWidth(0.2); doc.line(sx, cx.y + 25, sx + 55, cx.y + 25);
	doc.setFont("helvetica", "normal"); doc.setFontSize(8);
	if (d.sip) doc.text(pdfSafe(`SIP: ${d.sip}`), sx, cx.y + 29);
	footerPages(cx, `CPPT · ${pt.name}${pt.rm ? ` · RM ${pt.rm}` : ""} · RAHASIA — dokumen rekam medis`);
	void measure; void para;
	return cx;
}
async function exportPdf(hub: HubView, c: CpptState, pt: CpptPatient) {
	const cx = cpptPdfDoc(hub, c, pt);
	await savePdf(hub.plugin, cx, "CPPT", `CPPT ${pt.name}${pt.rm ? ` RM ${pt.rm}` : ""}`);
}

/** Buka halaman pasien CPPT tertentu (dari beranda/pencarian). */
export function cpptOpenPatient(hub: HubView, pid: string) {
	C.pid = pid; C.view = "patient"; C.draft = null;
	if (hub.page === "medcppt") hub.renderPage(); else hub.navigate("medcppt");
}
