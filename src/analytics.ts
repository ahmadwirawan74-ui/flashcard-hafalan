import type FlashcardPlugin from "./main";
import { Card, CardState, Exam, TYPE_LABEL } from "./types";
import { DAY, endOfDay, isNewState, recall, retention, startOfDay } from "./scheduler";
import { basename, similarity, plainText } from "./util";

const recentFails = (st: CardState, n = 4) => st.history.slice(-n).filter((h) => h.g === 0).length;

// ---------------------------------------------------------------- kelemahan kartu
export interface WeakCard {
	card: Card;
	score: number;
	reasons: string[];
}

/** Deteksi kartu lemah berdasarkan pola riwayat ulasan. */
export function weakCards(p: FlashcardPlugin): WeakCard[] {
	const now = Date.now();
	const out: WeakCard[] = [];
	for (const card of p.allCards()) {
		const st = p.data.cards[card.id];
		if (!st || st.suspended || isNewState(st)) continue;
		const reasons: string[] = [];
		let score = 0;
		if (st.lapses >= 3) { reasons.push(`${st.lapses}× terlupa`); score += Math.min(3, st.lapses / 2); }
		const rf = recentFails(st);
		if (rf >= 2) { reasons.push("sering salah belakangan ini"); score += rf; }
		else if (st.history[st.history.length - 1]?.g === 0) { reasons.push("baru saja terlupa"); score += 1; }
		if (st.ease < 1.8) { reasons.push("terasa sulit terus"); score += 1.5; }
		const r = retention(st, now);
		if (r !== null && r < 0.7 && st.due < now) { reasons.push(`ingatan tinggal ±${Math.round(r * 100)}%`); score += (0.7 - r) * 5; }
		const g1 = st.history.slice(-5).filter((h) => h.g === 1).length;
		if (g1 >= 3) { reasons.push("sering dinilai Sulit"); score += 1; }
		if (score >= 1.5) out.push({ card, score, reasons });
	}
	return out.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------- topik lemah
export interface Topic {
	key: string;
	path: string;
	label: string;
	cards: Card[];
	reviewed: number;
	retention: number;
	accuracy: number;
	lapseRate: number;
	weakness: number;
}

/** Kelompokkan kartu per materi & heading, lalu nilai kelemahannya. */
export function topics(p: FlashcardPlugin): Topic[] {
	const now = Date.now();
	const groups = new Map<string, Card[]>();
	for (const c of p.allCards()) {
		const k = c.path + "§" + (c.context[0] ?? "") + "§" + (c.context[1] ?? "");
		(groups.get(k) ?? groups.set(k, []).get(k)!).push(c);
	}
	const out: Topic[] = [];
	for (const [key, cards] of groups) {
		let rev = 0, rSum = 0, ok = 0, tot = 0, lapses = 0;
		for (const c of cards) {
			const st = p.data.cards[c.id];
			if (!st || isNewState(st)) continue;
			rev++;
			rSum += retention(st, now) ?? 1;
			lapses += st.lapses;
			for (const h of st.history.slice(-6)) { tot++; if (h.g > 0) ok++; }
		}
		if (rev < 2) continue;
		const ret = rSum / rev, acc = tot ? ok / tot : 1, lapseRate = lapses / rev;
		const weakness = 0.45 * (1 - ret) + 0.4 * (1 - acc) + 0.15 * Math.min(1, lapseRate / 3);
		const c0 = cards[0];
		const label = [basename(c0.path), ...c0.context.slice(0, 2)].join(" › ");
		out.push({ key, path: c0.path, label, cards, reviewed: rev, retention: ret, accuracy: acc, lapseRate, weakness });
	}
	return out.sort((a, b) => b.weakness - a.weakness);
}

/** Akurasi per tipe kartu (dari 8 ulasan terakhir tiap kartu). */
export function typeAccuracy(p: FlashcardPlugin): { label: string; acc: number; n: number }[] {
	const m = new Map<string, { ok: number; n: number }>();
	for (const c of p.allCards()) {
		const st = p.data.cards[c.id];
		if (!st) continue;
		const e = m.get(TYPE_LABEL[c.type]) ?? m.set(TYPE_LABEL[c.type], { ok: 0, n: 0 }).get(TYPE_LABEL[c.type])!;
		for (const h of st.history.slice(-8)) { e.n++; if (h.g > 0) e.ok++; }
	}
	return [...m.entries()].filter(([, v]) => v.n >= 3).map(([label, v]) => ({ label, acc: v.ok / v.n, n: v.n })).sort((a, b) => a.acc - b.acc);
}

// ---------------------------------------------------------------- kurva lupa nyata
export interface CurveBucket { label: string; predicted: number; actual: number; n: number }

/** Bandingkan prediksi model dengan hasil nyata, dikelompokkan per jarak hari sejak ulasan sebelumnya. */
export function forgettingTracker(p: FlashcardPlugin): { byDays: CurveBucket[]; calib: CurveBucket[]; total: number } {
	const dayEdges = [[0, 1, "< 1 hr"], [1, 3, "1–3 hr"], [3, 7, "3–7 hr"], [7, 14, "1–2 mg"], [14, 30, "2–4 mg"], [30, 1e9, "> 1 bln"]] as const;
	const calEdges = [[0, 0.5, "< 50%"], [0.5, 0.7, "50–70%"], [0.7, 0.8, "70–80%"], [0.8, 0.9, "80–90%"], [0.9, 1.01, "> 90%"]] as const;
	const byDays = dayEdges.map(([, , label]) => ({ label, predicted: 0, actual: 0, n: 0 }));
	const calib = calEdges.map(([, , label]) => ({ label, predicted: 0, actual: 0, n: 0 }));
	let total = 0;
	for (const st of Object.values(p.data.cards)) {
		const h = st.history;
		for (let i = 1; i < h.length; i++) {
			if (h[i - 1].i <= 0) continue;
			const elapsed = h[i].t - h[i - 1].t;
			const pred = recall(elapsed, h[i - 1].i);
			const ok = h[i].g > 0 ? 1 : 0;
			const d = elapsed / DAY;
			const bi = dayEdges.findIndex(([a, b]) => d >= a && d < b);
			const ci = calEdges.findIndex(([a, b]) => pred >= a && pred < b);
			if (bi >= 0) { byDays[bi].predicted += pred; byDays[bi].actual += ok; byDays[bi].n++; }
			if (ci >= 0) { calib[ci].predicted += pred; calib[ci].actual += ok; calib[ci].n++; }
			total++;
		}
	}
	for (const b of [...byDays, ...calib]) if (b.n) { b.predicted /= b.n; b.actual /= b.n; }
	return { byDays, calib, total };
}

/** Volume & akurasi per jam (dari seluruh riwayat). */
export function hourStats(p: FlashcardPlugin): { n: number; ok: number }[] {
	const hours = Array.from({ length: 24 }, () => ({ n: 0, ok: 0 }));
	for (const st of Object.values(p.data.cards))
		for (const h of st.history) {
			const hr = new Date(h.t).getHours();
			hours[hr].n++;
			if (h.g > 0) hours[hr].ok++;
		}
	return hours;
}

/** Sebaran kematangan kartu. */
export function maturity(p: FlashcardPlugin) {
	const r = { fresh: 0, learning: 0, young: 0, mature: 0, suspended: 0 };
	for (const c of p.allCards()) {
		const st = p.data.cards[c.id];
		if (st?.suspended) r.suspended++;
		else if (isNewState(st)) r.fresh++;
		else if (st!.interval < 7) r.learning++;
		else if (st!.interval < 21) r.young++;
		else r.mature++;
	}
	return r;
}

// ---------------------------------------------------------------- ingatan memudar
export interface Decay { path: string; retention: number; overdue: number; reviewed: number }

export function decaying(p: FlashcardPlugin): Decay[] {
	const now = Date.now(), thr = p.data.settings.decayThreshold;
	const out: Decay[] = [];
	for (const path of p.sortedPaths()) {
		let rev = 0, rSum = 0, overdue = 0;
		for (const c of p.index.get(path) ?? []) {
			const st = p.data.cards[c.id];
			if (!st || st.suspended || isNewState(st)) continue;
			rev++;
			rSum += retention(st, now) ?? 1;
			if (st.due < startOfDay(now)) overdue++;
		}
		if (rev < 3) continue;
		const ret = rSum / rev;
		if (ret < thr || overdue >= 10) out.push({ path, retention: ret, overdue, reviewed: rev });
	}
	return out.sort((a, b) => a.retention - b.retention);
}

// ---------------------------------------------------------------- ujian
export interface ExamPlan {
	exam: Exam;
	cards: Card[];
	daysLeft: number;
	total: number;
	learned: number;
	fresh: number;
	newToday: number;
	quota: number;
	remaining: number;
	due: number;
	retention: number | null;
}

export function examCards(p: FlashcardPlugin, e: Exam): Card[] {
	if (!e.paths.length) return p.allCards();
	const set = new Set(e.paths);
	return p.allCards().filter((c) => set.has(c.path));
}

/** Target harian: sisa kartu baru dibagi rata ke hari tersisa (hari ujian dipakai untuk mengulang). */
export function examPlan(p: FlashcardPlugin, e: Exam): ExamPlan {
	const now = Date.now(), today = startOfDay(now), end = endOfDay(now);
	const cards = examCards(p, e);
	const date = new Date(e.date + "T00:00:00").getTime();
	const daysLeft = isNaN(date) ? 0 : Math.round((date - today) / DAY);
	let fresh = 0, newToday = 0, due = 0, rSum = 0, rN = 0;
	for (const c of cards) {
		const st = p.data.cards[c.id];
		if (st?.suspended) continue;
		if (isNewState(st)) { fresh++; continue; }
		if (st!.history[0].t >= today) newToday++;
		if (st!.due <= end) due++;
		const r = retention(st, now);
		if (r !== null) { rSum += r; rN++; }
	}
	const studyDays = Math.max(1, daysLeft);
	const quota = daysLeft <= 0 ? fresh + newToday : Math.ceil((fresh + newToday) / studyDays);
	return {
		exam: e, cards, daysLeft, total: cards.length, learned: cards.length - fresh, fresh, newToday,
		quota, remaining: Math.max(0, quota - newToday), due, retention: rN ? rSum / rN : null,
	};
}

// ---------------------------------------------------------------- pasangan yang mirip
export interface Pair { a: Card; b: Card; count: number; reason: string }

/** Pasangan kartu yang sering tertukar (tercatat) + yang mirip secara teks (deteksi otomatis). */
export function confusablePairs(p: FlashcardPlugin, max = 30): Pair[] {
	const byId = new Map(p.allCards().map((c) => [c.id, c]));
	const out: Pair[] = [];
	const seen = new Set<string>();
	for (const [k, n] of Object.entries(p.data.meta.confusions ?? {}).sort((x, y) => y[1] - x[1])) {
		const [a, b] = k.split("|").map((id) => byId.get(id));
		if (!a || !b) continue;
		seen.add(k);
		out.push({ a, b, count: n, reason: `tertukar ${n}×` });
	}
	if (out.length < max) {
		for (const path of p.sortedPaths()) {
			const cs = (p.index.get(path) ?? []).filter((c) => c.type !== "occlusion" && c.type !== "list").slice(0, 80);
			for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
				const a = cs[i], b = cs[j];
				const k = [a.id, b.id].sort().join("|");
				if (seen.has(k) || a.type === "reversed" || b.type === "reversed") continue;
				const qa = plainText(a.front), qb = plainText(b.front);
				const sq = similarity(qa, qb);
				const sa = similarity(plainText(a.answer ?? a.back), plainText(b.answer ?? b.back));
				if ((sq >= 0.6 && qa !== qb) || (sa >= 0.7 && sq >= 0.3)) {
					seen.add(k);
					out.push({ a, b, count: 0, reason: sq >= 0.6 ? "pertanyaan mirip" : "jawaban mirip" });
				}
			}
		}
	}
	return out.slice(0, max);
}
