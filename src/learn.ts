import type FlashcardPlugin from "./main";
import { Card, ChoiceOption } from "./types";
import { plainText, shuffle } from "./util";

// ---------------------------------------------------------------- teks
const STOP = new Set(("yang dan di ke dari untuk dengan pada adalah ini itu atau juga dalam oleh sebagai akan tidak bisa dapat ada karena " +
	"jika maka agar sehingga lebih para sudah telah masih saat secara antara setiap seperti serta namun tetapi bahwa kita kami mereka " +
	"dia ia anda saya kamu nya pun lah kah tersebut yaitu yakni hal suatu sebuah satu dua tiga banyak beberapa semua the a an of to and " +
	"in is are for on with as by be this that it or from at was were has have").split(" "));

export const tokens = (t: string) => plainText(t).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").match(/[\p{L}\p{N}]+/gu) ?? [];

/** Kata kunci penting dari jawaban (tanpa kata umum), urut kemunculan. */
export function keywords(text: string, max = 14): string[] {
	const out: string[] = [];
	for (const w of tokens(text)) {
		if (w.length < 4 && !/\d/.test(w)) continue;
		if (STOP.has(w) || out.includes(w)) continue;
		out.push(w);
		if (out.length >= max) break;
	}
	return out;
}

const near = (a: string, b: string) => {
	if (a === b) return true;
	const k = Math.min(a.length, b.length);
	if (k >= 5 && a.slice(0, 5) === b.slice(0, 5)) return true; // imbuhan: fotosintesis ~ fotosintesisnya
	if (Math.abs(a.length - b.length) > 1 || k < 5) return false;
	let diff = 0;
	for (let i = 0, j = 0; i < a.length && j < b.length; i++, j++) {
		if (a[i] !== b[j]) {
			if (++diff > 1) return false;
			if (a.length > b.length) j--;
			else if (b.length > a.length) i--;
		}
	}
	return true;
};

/** Kata kunci mana yang muncul di penjelasan pengguna. */
export function coverage(explanation: string, keys: string[]): { hit: string[]; miss: string[]; score: number } {
	const words = tokens(explanation);
	const hit = keys.filter((k) => words.some((w) => near(w, k)));
	const miss = keys.filter((k) => !hit.includes(k));
	return { hit, miss, score: keys.length ? hit.length / keys.length : 1 };
}

/** Bandingkan per kata (LCS): kata asli mana yang berhasil ditulis. */
export function wordDiff(original: string, typed: string): { words: { w: string; ok: boolean }[]; accuracy: number; extra: number } {
	const ow = original.split(/\s+/).filter(Boolean);
	const on = ow.map((w) => tokens(w).join(""));
	const tn = tokens(typed);
	const m = on.length, n = tn.length;
	const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
	for (let i = m - 1; i >= 0; i--)
		for (let j = n - 1; j >= 0; j--)
			dp[i][j] = on[i] && (on[i] === tn[j] || (on[i].length >= 5 && near(on[i], tn[j]))) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
	const ok = new Array<boolean>(m).fill(false);
	let i = 0, j = 0;
	while (i < m && j < n) {
		if (on[i] && (on[i] === tn[j] || (on[i].length >= 5 && near(on[i], tn[j])))) { ok[i] = true; i++; j++; }
		else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
		else j++;
	}
	const counted = on.filter(Boolean).length || 1;
	const good = ok.filter((x, k) => x && on[k]).length;
	return { words: ow.map((w, k) => ({ w, ok: ok[k] || !on[k] })), accuracy: good / counted, extra: Math.max(0, n - good) };
}

/** Pecah teks menjadi kalimat. */
export const sentences = (t: string) =>
	t.replace(/\s+/g, " ").trim().split(/(?<=[.!?;:])\s+(?=[\p{Lu}\d"“(])/u).map((x) => x.trim()).filter(Boolean);

// ---------------------------------------------------------------- pilihan ganda
/** Buat pilihan jawaban untuk kartu (pakai pilihan asli untuk kartu Multiple Choice). */
export function quizOptions(p: FlashcardPlugin, card: Card, n = 4): ChoiceOption[] | null {
	if (card.type === "mcq" && card.options) return shuffle(card.options.map((o) => ({ ...o })));
	if (card.type === "list" || (card.type === "occlusion" && !card.answer)) return null;
	const answerOf = (c: Card) => c.answer ?? c.back;
	const key = (t: string) => plainText(t).toLowerCase();
	const correct = answerOf(card);
	const seen = new Set([key(correct), key(card.front)]);
	const pool = p.allCards().filter((c) => c.id !== card.id && c.type !== "mcq" && c.type !== "list" && (c.type !== "occlusion" || !!c.answer));
	const rank = (c: Card) => (c.path === card.path ? 0 : 3) + (c.type === card.type ? 0 : 1);
	const ds: string[] = [];
	for (const c of shuffle(pool).sort((a, b) => rank(a) - rank(b))) {
		const a = answerOf(c);
		const k = key(a);
		if (!k || seen.has(k) || a.length > 200) continue;
		seen.add(k);
		ds.push(a);
		if (ds.length >= n - 1) break;
	}
	if (ds.length < 2) return null;
	return shuffle([{ text: correct, correct: true }, ...ds.map((t) => ({ text: t, correct: false }))]);
}

/** Hash string sederhana (untuk misi harian yang konsisten per hari). */
export function seedHash(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return h >>> 0;
}
