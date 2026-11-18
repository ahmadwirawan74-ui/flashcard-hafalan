/**
 * Ekspor PDF bersama untuk CPPT dan resep (jsPDF, font standar Helvetica).
 * Teks disaring ke karakter WinAnsi agar tidak muncul simbol rusak; file disimpan di vault lalu dibuka.
 */
import { Notice, TFile, normalizePath } from "obsidian";
import { jsPDF } from "jspdf";
import type FlashcardPlugin from "./main";

/** Ganti karakter di luar Latin-1 dengan padanan ASCII yang aman untuk font standar PDF. */
export function pdfSafe(s: string): string {
	const map: Record<string, string> = {
		"≥": ">=", "≤": "<=", "−": "-", "⚠": "(!)", "℞": "R/", "→": "->", "←": "<-", "↑": "naik", "↓": "turun", "–": "-", "—": "-", "‘": "'", "’": "'", "“": '"', "”": '"', "…": "...",
		"•": "-", "₂": "2", "₃": "3", "⁺": "+", "⁻": "-", "√": "akar ", "∫": "", "≈": "~", "≠": "!=", "½": "1/2", "¼": "1/4", "⅓": "1/3", "✓": "v", "✗": "x", "✕": "x", "☐": "[ ]", "Ø": "O",
		" ": " ", " ": " ", " ": " ",
	};
	return Array.from(s, (c) => map[c] ?? (c >= "\u2010" && c <= "\u2015" ? "-" : c)).join("")
		.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
		.replace(/[^\x09\x0a\x0d\x20-\xff]/g, "");
}

export interface PdfCtx { doc: jsPDF; W: number; H: number; M: number; y: number }
export function newPdf(format: "a4" | "a5" = "a4", orient: "p" | "l" = "p"): PdfCtx {
	const doc = new jsPDF({ unit: "mm", format, orientation: orient, compress: true });
	doc.setFont("helvetica", "normal");
	const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
	return { doc, W, H, M: format === "a5" ? 10 : 14, y: format === "a5" ? 10 : 14 };
}
/** Tulis paragraf terbungkus; mengembalikan tinggi yang dipakai. */
export function para(c: PdfCtx, text: string, x: number, w: number, size = 10, style: "normal" | "bold" | "italic" = "normal", lh = 1.35): number {
	c.doc.setFont("helvetica", style);
	c.doc.setFontSize(size);
	const lines = c.doc.splitTextToSize(pdfSafe(text), w) as string[];
	const step = (size * 0.3528) * lh;
	lines.forEach((ln, i) => c.doc.text(ln, x, c.y + size * 0.3528 + i * step));
	return lines.length * step;
}
export function measure(c: PdfCtx, text: string, w: number, size = 10, style: "normal" | "bold" | "italic" = "normal", lh = 1.35): number {
	c.doc.setFont("helvetica", style);
	c.doc.setFontSize(size);
	return (c.doc.splitTextToSize(pdfSafe(text), w) as string[]).length * size * 0.3528 * lh;
}

const stamp = () => { const d = new Date(); const z = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}${z(d.getMinutes())}`; };
export const safeName = (s: string) => s.replace(/[\\/:*?"<>|#^[\]()]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "Tanpa nama";

/** Simpan PDF ke vault (folder dibuat bila perlu) lalu buka di tab baru. */
export async function savePdf(p: FlashcardPlugin, c: PdfCtx, folder: string, base: string, open = true): Promise<TFile | null> {
	try {
		const vault = p.app.vault;
		const dir = normalizePath(folder);
		if (!vault.getAbstractFileByPath(dir)) { try { await vault.createFolder(dir); } catch { /* sudah ada */ } }
		let path = normalizePath(`${dir}/${safeName(base)} ${stamp()}.pdf`);
		for (let i = 2; vault.getAbstractFileByPath(path); i++) path = normalizePath(`${dir}/${safeName(base)} ${stamp()} (${i}).pdf`);
		const buf = c.doc.output("arraybuffer");
		const f = await vault.createBinary(path, buf);
		new Notice(`📄 PDF disimpan: ${path}`);
		if (open && f) await p.app.workspace.getLeaf(true).openFile(f);
		return f;
	} catch (e) {
		console.error(e);
		new Notice("Gagal membuat PDF: " + (e as Error).message);
		return null;
	}
}

/** Kepala halaman (kop) sederhana dengan garis bawah ganda. */
export function kop(c: PdfCtx, title: string, lines: string[], right?: string) {
	const { doc, W, M } = c;
	doc.setFont("helvetica", "bold");
	doc.setFontSize(13);
	doc.text(pdfSafe(title || "……………………"), M, c.y + 4.5);
	if (right) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(pdfSafe(right), W - M, c.y + 4, { align: "right" }); }
	c.y += 6.5;
	doc.setFont("helvetica", "normal");
	doc.setFontSize(8.5);
	for (const l of lines.filter(Boolean)) { doc.text(pdfSafe(l), M, c.y + 3); c.y += 3.8; }
	c.y += 1.2;
	doc.setLineWidth(0.6); doc.line(M, c.y, W - M, c.y);
	doc.setLineWidth(0.2); doc.line(M, c.y + 0.9, W - M, c.y + 0.9);
	c.y += 4;
}

export function footerPages(c: PdfCtx, label: string) {
	const n = c.doc.getNumberOfPages();
	for (let i = 1; i <= n; i++) {
		c.doc.setPage(i);
		c.doc.setFont("helvetica", "normal");
		c.doc.setFontSize(7.5);
		c.doc.setTextColor(120);
		c.doc.text(pdfSafe(label), c.M, c.H - 6);
		c.doc.text(`Hal. ${i}/${n}`, c.W - c.M, c.H - 6, { align: "right" });
		c.doc.setTextColor(0);
	}
}

// ================================================================ RESEP (A5)
import type { DocInfo, RxLine, RxPatient } from "./med-rx";
export function tglIndoLong(d = new Date()) { return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }); }

/** Bangun PDF resep A5 bergaya kertas resep dokter praktik. */
export function rxPdfDoc(o: { doc: DocInfo; pa: RxPatient; lines: RxLine[]; title: string; dx?: string; note?: string; wText?: string }): PdfCtx {
	const c = newPdf("a5");
	const { doc, W, M } = c;
	const dn = o.doc.name ? (o.doc.name.toLowerCase().startsWith("dr") ? o.doc.name : `dr. ${o.doc.name}`) : "dr. ……………………";
	kop(c, dn, [`SIP: ${o.doc.sip || "……………………"}`, [o.doc.addr, o.doc.phone ? `Telp. ${o.doc.phone}` : ""].filter(Boolean).join(" · ")]);
	doc.setFont("helvetica", "normal"); doc.setFontSize(9);
	doc.text(pdfSafe(`${o.doc.city || "…………"}, ${tglIndoLong()}`), W - M, c.y + 2, { align: "right" });
	c.y += 8;
	const xR = M + 9, wR = W - M - xR - 8;
	for (const l of o.lines) {
		const [r1, ...rr] = l.r.split("\n").map((s) => s.trim());
		const need = measure(c, r1, wR, 10.5, "bold") + rr.reduce((a, s) => a + measure(c, s, wR, 9.5), 0) + measure(c, l.s, wR, 10, "italic") + 6;
		if (c.y + need > c.H - 42) { doc.addPage(); c.y = M; }
		doc.setFont("times", "bolditalic"); doc.setFontSize(15);
		doc.text("R/", M, c.y + 5);
		c.y += para(c, r1, xR, wR, 10.5, "bold");
		for (const s of rr) c.y += para(c, s, xR, wR, 9.5);
		c.y += para(c, l.s, xR + 2, wR - 2, 10, "italic");
		// paraf
		doc.setLineWidth(0.25);
		doc.line(W - M - 22, c.y + 1.5, W - M - 4, c.y + 1.5);
		doc.setFont("times", "italic"); doc.setFontSize(12); doc.text("f", W - M - 3, c.y + 2.2);
		c.y += 6;
	}
	if (c.y > c.H - 42) { doc.addPage(); c.y = M; }
	c.y = Math.max(c.y + 2, c.H - 40);
	doc.setLineWidth(0.3); doc.line(M, c.y, W - M, c.y); c.y += 2;
	const kv = (k: string, v: string) => { doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text(k, M, c.y + 3.5); doc.setFont("helvetica", "normal"); doc.text(pdfSafe(": " + v), M + 15, c.y + 3.5); c.y += 5; };
	kv("Pro", o.pa.name || "……………………");
	kv("Umur", `${o.pa.age || "……"}${o.wText ? `      BB: ${o.wText}` : ""}`);
	kv("Alamat", o.pa.addr || "……………………");
	doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(120);
	doc.text(pdfSafe([o.dx ? `Dx: ${o.dx}` : "", o.title].filter(Boolean).join(" · ")), M, c.H - 9);
	doc.text("Resep sah bila ditandatangani dokter. Tidak boleh diulang tanpa resep baru (n.i.).", M, c.H - 6);
	doc.setTextColor(0);
	return c;
}
