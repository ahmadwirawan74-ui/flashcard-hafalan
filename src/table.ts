import { App, Editor, Modal, Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { NewCard } from "./card-modal";
import { btn } from "./util";

export interface MdTable { header: string[]; rows: { cells: string[]; raw: string }[] }

const cellsOf = (line: string) => line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim());

/** Cari tabel Markdown di seleksi atau di sekitar kursor. */
export function tableAt(editor: Editor): MdTable | null {
	const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
	let lines: string[];
	const sel = editor.getSelection();
	if (sel.includes("|")) lines = sel.split("\n").filter(isRow);
	else {
		const n = editor.getCursor().line;
		if (!isRow(editor.getLine(n))) return null;
		let a = n, b = n;
		while (a > 0 && isRow(editor.getLine(a - 1))) a--;
		while (b < editor.lineCount() - 1 && isRow(editor.getLine(b + 1))) b++;
		lines = [];
		for (let i = a; i <= b; i++) lines.push(editor.getLine(i));
	}
	if (lines.length < 3 || !/^\s*\|?\s*:?-{2,}/.test(lines[1].replace(/\|/g, "|"))) return null;
	const header = cellsOf(lines[0]);
	const rows = lines.slice(2).map((raw) => ({ cells: cellsOf(raw), raw })).filter((r) => r.cells.some(Boolean));
	return rows.length ? { header, rows } : null;
}

/** Pilih kolom pertanyaan & jawaban, lalu setiap baris tabel menjadi kartu (catatan tidak diubah). */
type TMode = "row" | "col" | "rowctx" | "whole";
const MODES: { id: TMode; label: string; desc: string }[] = [
	{ id: "row", label: "Tanya-jawab per baris", desc: "Setiap baris menjadi kartu: kolom pertanyaan → kolom jawaban." },
	{ id: "col", label: "Sembunyikan kolom", desc: "Satu kartu per kolom: seluruh tabel tampil, isi kolom itu harus diingat (❓)." },
	{ id: "rowctx", label: "Per baris, dalam tabel", desc: "Satu kartu per baris: tabel utuh tampil, isi baris itu disembunyikan (kecuali kolom kunci)." },
	{ id: "whole", label: "Hafal tabel utuh", desc: "Satu kartu: hanya kolom kunci yang tampil, semua isi lainnya harus diingat." },
];
const esc = (c: string) => c.replace(/\|/g, "\\|");
/** Tabel Markdown dengan sel tertentu disembunyikan (❓) atau disorot (==…==). */
export function tableMd(t: MdTable, hide: (r: number, c: number) => boolean, mode: "ask" | "show"): string {
	const H = t.header;
	const lines = [`| ${H.map(esc).join(" | ")} |`, `| ${H.map(() => "---").join(" | ")} |`];
	t.rows.forEach((r, ri) => lines.push(`| ${H.map((_, ci) => { const v = (r.cells[ci] ?? "").trim(); return hide(ri, ci) && v ? (mode === "ask" ? "❓" : `==${esc(v)}==`) : esc(v); }).join(" | ")} |`));
	return lines.join("\n");
}

export class TableModal extends Modal {
	private mode: TMode = "row";
	private hideCols = new Set<number>();
	private q = 0;
	private a = new Set<number>([1]);
	private both = false;
	private withHeader = true;
	private prev!: HTMLElement;

	constructor(app: App, private p: FlashcardPlugin, private path: string, private t: MdTable) {
		super(app);
		if (t.header.length < 2) this.a = new Set();
		for (let i = 1; i < t.header.length; i++) this.hideCols.add(i);
	}

	private build(): NewCard[][] {
		const H = this.t.header;
		const out: NewCard[][] = [];
		const t = this.t;
		const anchor0 = { text: t.rows[0].raw, answer: t.rows[0].cells[0]?.trim() ?? "", pos: Math.max(0, t.rows[0].raw.indexOf(t.rows[0].cells[0]?.trim() ?? "")) };
		const title = (x: string) => `📊 ${x}`;
		if (this.mode === "col") {
			for (const c of [...this.hideCols].sort()) {
				if (c === this.q) continue;
				const front = `${title(`Lengkapi kolom **${H[c] || "Kolom " + (c + 1)}**`)}\n\n${tableMd(t, (_, ci) => ci === c, "ask")}`;
				out.push([{ type: "multiline", front, back: tableMd(t, (_, ci) => ci === c, "show"), anchor: anchor0 }]);
			}
			return out;
		}
		if (this.mode === "rowctx") {
			t.rows.forEach((r, ri) => {
				const key = r.cells[this.q]?.trim();
				if (!key) return;
				const front = `${title(`Lengkapi baris **${key}**`)}\n\n${tableMd(t, (rr, ci) => rr === ri && ci !== this.q, "ask")}`;
				const anchor = { text: r.raw, answer: key, pos: Math.max(0, r.raw.indexOf(key)) };
				out.push([{ type: "multiline", front, back: tableMd(t, (rr, ci) => rr === ri && ci !== this.q, "show"), anchor }]);
			});
			return out;
		}
		if (this.mode === "whole") {
			const front = `${title(`Lengkapi seluruh tabel (kolom kunci: **${H[this.q] || "Kolom " + (this.q + 1)}**)`)}\n\n${tableMd(t, (_, ci) => ci !== this.q, "ask")}`;
			out.push([{ type: "multiline", front, back: tableMd(t, (_, ci) => ci !== this.q, "show"), anchor: anchor0 }]);
			return out;
		}
		for (const r of this.t.rows) {
			const q = r.cells[this.q]?.trim();
			const ans = [...this.a].filter((i) => i !== this.q && r.cells[i]?.trim()).map((i) => (this.withHeader && this.a.size > 1 ? `**${H[i]}:** ` : "") + r.cells[i].trim());
			if (!q || !ans.length) continue;
			const front = this.withHeader ? `${H[this.q]}: **${q}** → ${[...this.a].filter((i) => i !== this.q).map((i) => H[i]).join(", ")}?` : q;
			const back = ans.join("\n");
			const anchor = { text: r.raw, answer: r.cells[[...this.a][0]]?.trim() ?? q, pos: Math.max(0, r.raw.indexOf(r.cells[[...this.a][0]]?.trim() ?? q)) };
			const group: NewCard[] = [{ type: ans.length > 1 ? "multiline" : "basic", front, back, anchor }];
			if (this.both) group.push({ type: "reversed", front: back, back: q, anchor });
			out.push(group);
		}
		return out;
	}

	onOpen() {
		this.modalEl.addClass("fch-modal");
		const el = this.contentEl;
		el.createDiv({ cls: "fch-modal-title", text: "📊 Kartu dari tabel" });
		el.createDiv({ cls: "fch-muted fch-small", text: `${this.t.rows.length} baris × ${this.t.header.length} kolom ditemukan. Tabel di catatan tidak diubah.` });
		const ms = el.createDiv("fch-tmodes");
		for (const m of MODES) {
			const b = ms.createEl("button", { cls: "fch-tmode" + (this.mode === m.id ? " is-on" : "") });
			b.createDiv({ cls: "fch-strong fch-small", text: m.label });
			b.createDiv({ cls: "fch-muted fch-small", text: m.desc });
			b.onclick = () => { this.mode = m.id; this.contentEl.empty(); this.onOpen(); };
		}
		const H = this.t.header;
		const r1 = el.createDiv("fch-field fch-mt");
		r1.createEl("label", { text: this.mode === "row" ? "Kolom pertanyaan" : "Kolom kunci (selalu tampil)" });
		const seg = r1.createDiv("fch-row");
		const r2 = el.createDiv("fch-field");
		r2.createEl("label", { text: this.mode === "col" ? "Kolom yang disembunyikan (satu kartu per kolom)" : "Kolom jawaban (boleh lebih dari satu)" });
		if (this.mode === "rowctx" || this.mode === "whole") r2.addClass("is-hidden");
		const seg2 = r2.createDiv("fch-row");
		const draw = () => {
			seg.empty();
			seg2.empty();
			H.forEach((h, i) => {
				btn(seg, { text: h || `Kolom ${i + 1}`, cls: "fch-btn-sm" + (this.q === i ? " fch-btn-primary" : ""), onClick: () => { this.q = i; this.a.delete(i); if (!this.a.size) this.a.add(i === 0 ? 1 : 0); draw(); } });
				if (i !== this.q && this.mode === "col") btn(seg2, { text: h || `Kolom ${i + 1}`, cls: "fch-btn-sm" + (this.hideCols.has(i) ? " fch-btn-primary" : ""), onClick: () => { if (this.hideCols.has(i)) this.hideCols.delete(i); else this.hideCols.add(i); draw(); } });
				else if (i !== this.q && this.mode === "row") btn(seg2, { text: h || `Kolom ${i + 1}`, cls: "fch-btn-sm" + (this.a.has(i) ? " fch-btn-primary" : ""), onClick: () => { if (this.a.has(i)) this.a.delete(i); else this.a.add(i); draw(); } });
			});
			this.preview();
		};
		const tg = (label: string, get: () => boolean, set: (v: boolean) => void) => {
			const t = el.createEl("label", { cls: "fch-toggle" });
			const cb = t.createEl("input", { type: "checkbox" });
			cb.checked = get();
			cb.onchange = () => { set(cb.checked); this.preview(); };
			t.createSpan({ text: label });
		};
		if (this.mode === "row") {
			tg("Sertakan judul kolom di pertanyaan", () => this.withHeader, (v) => (this.withHeader = v));
			tg("Dua arah (buat juga kartu kebalikannya)", () => this.both, (v) => (this.both = v));
		}
		this.prev = el.createDiv("fch-modal-preview");
		const foot = el.createDiv("fch-modal-foot");
		foot.createDiv("fch-grow");
		btn(foot, { text: "Batal", cls: "fch-btn-ghost", onClick: () => this.close() });
		btn(foot, { text: "Buat kartu", icon: "check", cls: "fch-btn-primary", onClick: () => {
			const groups = this.build();
			if (!groups.length) return void new Notice("Tidak ada baris yang lengkap.");
			for (const g of groups) this.p.saveStored(this.path, g);
			new Notice(`✓ ${groups.reduce((a, g) => a + g.length, 0)} kartu dibuat dari tabel`);
			this.close();
		} });
		draw();
	}

	private preview() {
		const el = this.prev;
		el.empty();
		const g = this.build();
		el.createDiv({ cls: "fch-strong fch-small", text: `Pratinjau · ${g.reduce((a, x) => a + x.length, 0)} kartu` });
		if (this.mode !== "row") {
			const c = g[0]?.[0];
			if (c) { const k = el.createDiv("fch-pcard"); k.createDiv({ cls: "fch-pcard-front fch-pre", text: c.front.replace(/\*\*/g, "") }); }
			return;
		}
		for (const c of g.slice(0, 3).map((x) => x[0])) {
			const k = el.createDiv("fch-pcard");
			k.createDiv({ cls: "fch-pcard-front", text: c.front.replace(/\*\*/g, "") });
			k.createDiv({ cls: "fch-pcard-back", text: c.back.replace(/\*\*/g, "") });
		}
	}

	onClose() { this.contentEl.empty(); }
}

/** Pembuat tabel tanpa Markdown: isi sel, simpan ke catatan, lalu buat kartunya. */
export function renderTableBuilder(host: HTMLElement, p: FlashcardPlugin, getTarget: () => Promise<string | null>, state: { header: string[]; rows: string[][] }) {
	host.empty();
	const wrap = host.createDiv("fch-tb2");
	const ctr = wrap.createDiv("fch-row");
	btn(ctr, { text: "+ Baris", cls: "fch-btn-sm", onClick: () => { state.rows.push(state.header.map(() => "")); renderTableBuilder(host, p, getTarget, state); } });
	btn(ctr, { text: "+ Kolom", cls: "fch-btn-sm", onClick: () => { state.header.push(`Kolom ${state.header.length + 1}`); state.rows.forEach((r) => r.push("")); renderTableBuilder(host, p, getTarget, state); } });
	if (state.rows.length > 1) btn(ctr, { text: "− Baris", cls: "fch-btn-sm fch-btn-ghost", onClick: () => { state.rows.pop(); renderTableBuilder(host, p, getTarget, state); } });
	if (state.header.length > 2) btn(ctr, { text: "− Kolom", cls: "fch-btn-sm fch-btn-ghost", onClick: () => { state.header.pop(); state.rows.forEach((r) => r.pop()); renderTableBuilder(host, p, getTarget, state); } });
	const scroll = wrap.createDiv("fch-tb2-scroll");
	const tbl = scroll.createEl("table", { cls: "fch-tb2-table" });
	const hr = tbl.createEl("tr");
	state.header.forEach((h, i) => { const th = hr.createEl("th"); const inp = th.createEl("input", { type: "text", cls: "fch-input", attr: { placeholder: `Judul ${i + 1}` } }); inp.value = h; inp.oninput = () => (state.header[i] = inp.value); });
	state.rows.forEach((r, ri) => {
		const tr = tbl.createEl("tr");
		r.forEach((v, ci) => { const td = tr.createEl("td"); const inp = td.createEl("input", { type: "text", cls: "fch-input" }); inp.value = v; inp.oninput = () => (state.rows[ri][ci] = inp.value); });
	});
	wrap.createDiv({ cls: "fch-muted fch-small", text: "Tabel akan ditambahkan ke catatan tujuan, lalu kamu memilih cara mengubahnya menjadi kartu (per baris, sembunyikan kolom, atau hafal tabel utuh)." });
	btn(wrap, { text: "Simpan tabel & buat kartu", icon: "table", cls: "fch-btn-primary", onClick: async () => {
		const rows = state.rows.filter((r) => r.some((c) => c.trim()));
		if (rows.length < 1 || state.header.some((h) => !h.trim())) return void new Notice("Isi semua judul kolom dan minimal satu baris.");
		const path = await getTarget();
		if (!path) return;
		const mdRows = rows.map((r) => `| ${r.map((c) => esc(c.trim())).join(" | ")} |`);
		const text = [`| ${state.header.map((h) => esc(h.trim())).join(" | ")} |`, `| ${state.header.map(() => "---").join(" | ")} |`, ...mdRows].join("\n");
		await p.appendToNote(path, text);
		const t: MdTable = { header: state.header.map((h) => h.trim()), rows: rows.map((r, i) => ({ cells: r.map((c) => c.trim()), raw: mdRows[i] })) };
		new TableModal(p.app, p, path, t).open();
	} });
}
