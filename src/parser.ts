import { Card, CardType, ChoiceOption, Settings } from "./types";

export const ID_SEP = "§§";

export function hash(str: string): string {
	let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
	for (let i = 0; i < str.length; i++) {
		const ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// Kartu List memakai kunci "multiline" agar progres lama tidak hilang.
export const makeId = (path: string, type: CardType, front: string) =>
	`${path}${ID_SEP}${hash((type === "list" ? "multiline" : type) + "\n" + front)}`;

export const pathOfId = (id: string) => id.slice(0, id.lastIndexOf(ID_SEP));

export function normalizeTag(t: string): string {
	const s = t.trim().toLowerCase();
	return s.startsWith("#") ? s : "#" + s;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LIST_RE = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?/;
const CLOZE_RE = /\{\{(.+?)\}\}/g;
export const TASK_RE = /^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/;
export const ITEM_RE = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;

function splitHint(inner: string): [string, string] {
	const k = inner.indexOf("|");
	return k < 0 ? [inner.trim(), ""] : [inner.slice(0, k).trim(), inner.slice(k + 1).trim()];
}

/**
 * Sintaks yang didukung:
 *   Pertanyaan :: Jawaban            (satu baris)
 *   A ::: B                          (dua arah → 2 kartu)
 *   Paragraf dengan baris "?"        (multi-baris)
 *   Paragraf dengan baris "??"       (multi-baris dua arah)
 *   Ibu kota Jepang adalah {{Tokyo}} (cloze, petunjuk: {{Tokyo|kota}})
 */
export function parseCards(content: string, path: string, s: Settings): Card[] {
	const lines = content.split(/\r?\n/);
	const cards: Card[] = [];
	const heads: string[] = [];
	const tag = s.tag.trim() ? normalizeTag(s.tag) : "";
	const tagRe = tag ? new RegExp("(^|\\s)" + escapeRe(tag) + "(?:/[^\\s]*)?(?=\\s|$)", "gi") : null;
	const stripTag = (t: string) => (tagRe ? t.replace(tagRe, "$1") : t);
	const clean = (t: string) => stripTag(t).trim();
	let order = 0;

	const push = (type: CardType, front: string, back: string, line: number, extra: Partial<Card> = {}) => {
		front = front.trim();
		back = back.trim();
		if (!front || !back) return;
		cards.push({
			id: makeId(path, type, front),
			path, line, order: order++, type, front, back,
			context: heads.filter(Boolean),
			...extra,
		});
	};

	const parseCloze = (text: string, line: number) => {
		const matches = [...text.matchAll(CLOZE_RE)];
		matches.forEach((m, k) => {
			let n = 0;
			const front = text.replace(CLOZE_RE, (_x, inner: string) => {
				const [a, h] = splitHint(inner);
				return n++ === k ? `<span class="fc-cloze">[${h || "…"}]</span>` : a;
			});
			n = 0;
			const back = text.replace(CLOZE_RE, (_x, inner: string) => {
				const [a] = splitHint(inner);
				return n++ === k ? `<span class="fc-cloze-ans">${a}</span>` : a;
			});
			push("cloze", front, back, line, { answer: splitHint(m[1])[0] });
		});
	};

	const parseLine = (raw: string, line: number) => {
		const text = clean(raw.replace(LIST_RE, ""));
		if (!text) return;
		if (s.enableCloze && /\{\{.+?\}\}/.test(text)) return parseCloze(text, line);
		const rs = s.reversedSep, ss = s.singleSep;
		if (rs && text.includes(rs)) {
			const k = text.indexOf(rs);
			const a = text.slice(0, k), b = text.slice(k + rs.length);
			push("basic", a, b, line);
			push("reversed", b, a, line);
			return;
		}
		if (ss && text.includes(ss)) {
			const k = text.indexOf(ss);
			push("basic", text.slice(0, k), text.slice(k + ss.length), line);
		}
	};

	const processBlock = (b: { text: string; line: number }[]) => {
		const ms = s.multiSep.trim();
		if (ms) {
			const both = b.findIndex((l) => l.text.trim() === ms + ms);
			const one = b.findIndex((l) => l.text.trim() === ms);
			const k = both > 0 ? both : one;
			if (k > 0 && k < b.length - 1) {
				// Bagian depan = baris tepat di atas "?" sampai bertemu baris kartu lain / baris tag.
				const isCardLine = (t: string) => {
					const x = clean(t.replace(LIST_RE, ""));
					return !x || (!!s.singleSep && x.includes(s.singleSep)) || (!!s.reversedSep && x.includes(s.reversedSep)) || (s.enableCloze && /\{\{.+?\}\}/.test(x));
				};
				let start = k - 1;
				while (start > 0 && !isCardLine(b[start - 1].text)) start--;
				if (isCardLine(b[start].text) && start < k - 1) start++;
				for (const l of b.slice(0, start)) parseLine(l.text, l.line);
				const front = clean(b.slice(start, k).map((l) => l.text).join("\n"));
				const backLines = b.slice(k + 1).map((l) => stripTag(l.text).replace(/\s+$/, "")).filter((l) => l.trim() !== "");
				const back = backLines.join("\n");
				if (both > 0) {
					push("multiline", front, back, b[start].line);
					push("reversed", back, front, b[start].line);
					return;
				}
				const tasks = backLines.map((l) => TASK_RE.exec(l));
				const options: ChoiceOption[] = tasks.filter((m): m is RegExpExecArray => !!m)
					.map((m) => ({ text: m[2].trim(), correct: m[1].toLowerCase() === "x" }));
				if (options.length >= 2 && options.some((o) => o.correct)) {
					const explanation = backLines.filter((l) => !TASK_RE.test(l)).join("\n").trim();
					const answer = options.filter((o) => o.correct).map((o) => o.text).join("; ");
					const shown = options.filter((o) => o.correct).map((o) => "✓ " + o.text).join("\n\n") + (explanation ? "\n\n" + explanation : "");
					push("mcq", front, shown, b[start].line, { options, explanation, answer });
					return;
				}
				if (backLines.length >= 2 && backLines.every((l) => ITEM_RE.test(l))) {
					const items = backLines.map((l) => ITEM_RE.exec(l)![1].trim());
					push("list", front, back, b[start].line, { items, answer: items.join("; ") });
					return;
				}
				push("multiline", front, back, b[start].line);
				return;
			}
		}
		for (const l of b) parseLine(l.text, l.line);
	};

	let i = 0;
	if (lines[0]?.trim() === "---") {
		const end = lines.findIndex((l, k) => k > 0 && l.trim() === "---");
		if (end > 0) i = end + 1;
	}
	let inCode = false;
	let block: { text: string; line: number }[] = [];
	const flush = () => {
		if (block.length) processBlock(block);
		block = [];
	};

	for (; i < lines.length; i++) {
		const raw = lines[i];
		if (/^\s*(```|~~~)/.test(raw)) {
			flush();
			inCode = !inCode;
			continue;
		}
		if (inCode) continue;
		const h = /^(#{1,6})\s+(.+)$/.exec(raw);
		if (h) {
			flush();
			const lvl = h[1].length;
			heads.length = lvl - 1;
			heads[lvl - 1] = clean(h[2]);
			continue;
		}
		if (!raw.trim()) {
			flush();
			continue;
		}
		block.push({ text: raw, line: i });
	}
	flush();
	return cards;
}

// ---------- Pembuat kartu ----------
export type DraftKind = "single" | "multi" | "list" | "mcq" | "cloze" | "occlusion";

export interface Draft {
	kind: DraftKind;
	question: string;
	answer: string;
	both: boolean;
	items: string[];
	options: ChoiceOption[];
	explanation: string;
	text: string;
}

export const emptyDraft = (kind: DraftKind = "single"): Draft => ({
	kind, question: "", answer: "", both: false,
	items: ["", "", ""],
	options: [{ text: "", correct: true }, { text: "", correct: false }, { text: "", correct: false }],
	explanation: "", text: "",
});

const oneLine = (t: string) => t.replace(/\s*\n\s*/g, " ").trim();
const noBlank = (t: string) => t.replace(/\n\s*\n/g, "\n").trim();

export function draftToMarkdown(d: Draft, s: Settings): string {
	const ms = s.multiSep || "?";
	switch (d.kind) {
		case "single":
			return `${oneLine(d.question)} ${d.both ? s.reversedSep : s.singleSep} ${oneLine(d.answer)}`;
		case "multi":
			return `${noBlank(d.question)}\n${d.both ? ms + ms : ms}\n${noBlank(d.answer)}`;
		case "list":
			return `${noBlank(d.question)}\n${ms}\n${d.items.filter((i) => i.trim()).map((i) => `- ${oneLine(i)}`).join("\n")}`;
		case "mcq": {
			const opts = d.options.filter((o) => o.text.trim()).map((o) => `- [${o.correct ? "x" : " "}] ${oneLine(o.text)}`);
			const ex = noBlank(d.explanation);
			return `${noBlank(d.question)}\n${ms}\n${opts.join("\n")}${ex ? "\n" + ex : ""}`;
		}
		case "cloze":
			return oneLine(d.text);
		case "occlusion":
			return "";
	}
}

/** Ubah daftar "pertanyaan<pemisah>jawaban" per baris menjadi kartu satu baris. */
export function bulkToMarkdown(raw: string, s: Settings): { md: string; count: number } {
	const seps = ["\t", " = ", " — ", " – ", " - ", ";", "|"];
	const out: string[] = [];
	for (const line of raw.split(/\r?\n/)) {
		const t = line.trim();
		if (!t) continue;
		if (t.includes(s.singleSep)) { out.push(t); continue; }
		const sep = seps.find((x) => t.includes(x));
		if (!sep) continue;
		const k = t.indexOf(sep);
		const q = t.slice(0, k).trim(), a = t.slice(k + sep.length).trim();
		if (q && a) out.push(`${q} ${s.singleSep} ${a}`);
	}
	return { md: out.join("\n"), count: out.length };
}
