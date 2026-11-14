import { Anchor, Card, StoredCard } from "./types";
import { ID_SEP } from "./parser";

/** Cari posisi teks yang dipilih di catatan. Toleran bila teks sekitar berubah. */
export function locate(text: string, a: Anchor): { from: number; to: number; exact: boolean } | null {
	if (!a.answer) return null;
	let i = text.indexOf(a.text);
	while (i >= 0) {
		const from = i + a.pos;
		if (text.substr(from, a.answer.length) === a.answer) return { from, to: from + a.answer.length, exact: true };
		i = text.indexOf(a.text, i + 1);
	}
	const j = text.indexOf(a.answer);
	if (j >= 0 && text.indexOf(a.answer, j + 1) < 0 && a.answer.length >= 3) return { from: j, to: j + a.answer.length, exact: false };
	return null;
}

export const lineOf = (text: string, offset: number) => {
	let n = 0;
	for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
	return n;
};

export function headingsAt(lines: string[], line: number): string[] {
	const heads: string[] = [];
	for (let i = 0; i <= Math.min(line, lines.length - 1); i++) {
		const h = /^(#{1,6})\s+(.+)$/.exec(lines[i]);
		if (h) {
			heads.length = h[1].length - 1;
			heads[h[1].length - 1] = h[2].trim();
		}
	}
	return heads.filter(Boolean);
}

/** Hapus penanda Markdown di awal baris (list, heading, kutipan, checkbox). */
export const cleanLine = (t: string) => t.replace(/^\s*(?:>\s*)*(?:#{1,6}\s+|(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?)?/, "");
export const cleanBlock = (t: string) => t.split("\n").map(cleanLine).join("\n").trim();

export interface Source {
	selection: string;
	/** Kalimat mentah (sesuai catatan) yang memuat seleksi. */
	sentence: string;
	sentencePos: number;
	paragraph: string;
	paragraphPos: number;
	/** Baris non-daftar tepat sebelum seleksi (calon pertanyaan untuk List). */
	lineBefore: string;
	heading: string;
	multiLine: boolean;
	isList: boolean;
}

/** Ambil kalimat & paragraf di sekitar seleksi. */
export function extractSource(doc: string, from: number, to: number): Source {
	const selection = doc.slice(from, to);
	let ps = doc.lastIndexOf("\n\n", from - 1);
	ps = ps < 0 ? 0 : ps + 2;
	let pe = doc.indexOf("\n\n", to);
	pe = pe < 0 ? doc.length : pe;
	// paragraf jangan melewati heading
	const paraRaw = doc.slice(ps, pe);
	const multiLine = selection.includes("\n");

	// kalimat: dari tanda akhir kalimat / awal baris sebelum seleksi sampai tanda akhir kalimat sesudahnya
	let ss = from;
	while (ss > ps) {
		const c = doc[ss - 1];
		if (c === "\n") break;
		if (/[.!?]/.test(c) && /\s/.test(doc[ss] ?? " ") && !/\d/.test(doc[ss - 2] ?? "")) break;
		ss--;
	}
	while (ss < from && /\s/.test(doc[ss])) ss++;
	const ls = doc.lastIndexOf("\n", from - 1) + 1;
	const prefix = doc.slice(ls, ss);
	if (/^\s*(?:>\s*)*(?:#{1,6}\s+|(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?)?$/.test(prefix)) ss = ls + (doc.slice(ls).match(/^\s*(?:>\s*)*(?:#{1,6}\s+|(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?)?/)?.[0].length ?? 0);
	if (ss > from) ss = from;
	let se = to;
	while (se < pe) {
		const c = doc[se];
		if (c === "\n") break;
		se++;
		if (/[.!?]/.test(c) && /(\s|$)/.test(doc[se] ?? "") && !/\d/.test(doc[se] ?? "")) break;
	}
	if (multiLine) {
		ss = Math.max(ps, doc.lastIndexOf("\n", from - 1) + 1);
		se = to;
	}
	const sentence = doc.slice(ss, se);

	const lines = doc.slice(0, from).split("\n");
	let lineBefore = "";
	for (let i = lines.length - 2; i >= 0; i--) {
		const l = lines[i].trim();
		if (!l) {
			if (lineBefore) break;
			continue;
		}
		if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(lines[i])) continue;
		lineBefore = cleanLine(l).replace(/[:：]\s*$/, "");
		break;
	}
	const heading = headingsAt(lines, lines.length - 1).pop() ?? "";
	const selLines = selection.split("\n").filter((l) => l.trim());
	const isList = selLines.length >= 1 && selLines.every((l) => /^\s*(?:[-*+]|\d+[.)])\s+/.test(l)) && (multiLine || selLines.length > 1);
	return { selection, sentence, sentencePos: from - ss, paragraph: paraRaw, paragraphPos: from - ps, lineBefore, heading, multiLine, isList };
}

export function clozeOf(ctx: string, pos: number, answer: string, hint = ""): { front: string; back: string } {
	const before = ctx.slice(0, pos), after = ctx.slice(pos + answer.length);
	const front = cleanBlock(before + `<span class="fc-cloze">[${hint || "…"}]</span>` + after);
	const back = cleanBlock(before + `<span class="fc-cloze-ans">${answer.trim()}</span>` + after);
	return { front, back };
}

/** Ubah kartu tersimpan menjadi Card untuk sesi belajar. */
export function storedToCard(sc: StoredCard, content: string, lines: string[]): Card {
	const loc = sc.anchor ? locate(content, sc.anchor) : null;
	const line = loc ? lineOf(content, loc.from) : Number.MAX_SAFE_INTEGER;
	return {
		id: `${sc.path}${ID_SEP}${sc.id}`,
		path: sc.path,
		line: loc ? line : 0,
		order: loc ? line + Math.min(0.4, (loc.from - (content.lastIndexOf("\n", loc.from - 1) + 1)) / 1e5) : line,
		type: sc.type,
		front: sc.front,
		back: sc.back,
		answer: sc.answer,
		items: sc.items,
		options: sc.options,
		explanation: sc.explanation,
		context: loc ? headingsAt(lines, line) : [],
		stored: sc.id,
		orphan: !!sc.anchor && !loc,
	};
}

export const newStoredId = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
