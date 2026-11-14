import { Notice, normalizePath } from "obsidian";
import type { HubView } from "./hub-view";
import type FlashcardPlugin from "./main";
import { ACHIEVEMENTS, TIERS } from "./achievements";
import { DAY, addDays, dayKey, formatDuration } from "./scheduler";
import { weekKey, weekStart } from "./missions";
import { basename, btn, confetti } from "./util";

export interface WeekStats {
	from: number; to: number; label: string;
	reviews: number; correct: number; ms: number; days: number; newCards: number;
	bestDay: { label: string; n: number } | null;
	hour: number | null;
	topMaterial: { path: string; n: number; acc: number } | null;
	improved: { path: string; delta: number } | null;
	weakest: { path: string; acc: number } | null;
	achievements: string[];
	prevReviews: number; prevAcc: number | null;
	streak: number;
}

function range(p: FlashcardPlugin, from: number) {
	const to = addDays(from, 7);
	let reviews = 0, correct = 0, ms = 0, days = 0, newCards = 0;
	let best: { label: string; n: number } | null = null;
	for (let i = 0; i < 7; i++) {
		const t = addDays(from, i);
		const d = p.data.daily[dayKey(t)];
		if (!d?.reviews) continue;
		reviews += d.reviews; correct += d.correct; ms += d.ms; days++; newCards += d.newCards;
		if (!best || d.reviews > best.n) best = { label: new Date(t).toLocaleDateString("id-ID", { weekday: "long" }), n: d.reviews };
	}
	const byPath = new Map<string, { n: number; ok: number }>();
	const hours = new Array(24).fill(0);
	for (const c of p.allCards()) {
		const st = p.data.cards[c.id];
		if (!st) continue;
		for (const h of st.history) {
			if (h.t < from || h.t >= to) continue;
			const e = byPath.get(c.path) ?? byPath.set(c.path, { n: 0, ok: 0 }).get(c.path)!;
			e.n++;
			if (h.g > 0) e.ok++;
			hours[new Date(h.t).getHours()]++;
		}
	}
	return { to, reviews, correct, ms, days, newCards, best, byPath, hours };
}

export function weekStats(p: FlashcardPlugin, from: number): WeekStats {
	const cur = range(p, from);
	const prev = range(p, addDays(from, -7));
	let top: WeekStats["topMaterial"] = null, weakest: WeekStats["weakest"] = null, improved: WeekStats["improved"] = null;
	for (const [path, e] of cur.byPath) {
		const acc = e.ok / e.n;
		if (!top || e.n > top.n) top = { path, n: e.n, acc };
		if (e.n >= 5 && (!weakest || acc < weakest.acc)) weakest = { path, acc };
		const pe = prev.byPath.get(path);
		if (pe && pe.n >= 5 && e.n >= 5) {
			const delta = acc - pe.ok / pe.n;
			if (delta > 0.03 && (!improved || delta > improved.delta)) improved = { path, delta };
		}
	}
	const maxH = Math.max(...cur.hours);
	const ach = Object.entries(p.data.meta.unlocked ?? {}).filter(([, t]) => t >= from && t < cur.to).map(([k]) => {
		const [id, tier] = k.split(":");
		const d = ACHIEVEMENTS.find((a) => a.id === id);
		return d ? `${d.icon} ${d.name} (${TIERS[Number(tier)]})` : "";
	}).filter(Boolean);
	const fmt = (t: number) => new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
	return {
		from, to: cur.to, label: `${fmt(from)} – ${fmt(addDays(from, 6))}`,
		reviews: cur.reviews, correct: cur.correct, ms: cur.ms, days: cur.days, newCards: cur.newCards,
		bestDay: cur.best, hour: maxH > 0 ? cur.hours.indexOf(maxH) : null,
		topMaterial: top, improved, weakest, achievements: ach,
		prevReviews: prev.reviews, prevAcc: prev.reviews ? prev.correct / prev.reviews : null,
		streak: p.streak().current,
	};
}

export const lastWeekStart = () => addDays(weekStart(), -7);
export const reportReady = (p: FlashcardPlugin) => p.data.meta.lastReport !== weekKey(lastWeekStart()) && weekStats(p, lastWeekStart()).reviews > 0;

let which: "last" | "this" = "last";
let slide = 0;

export function renderReport(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const from = which === "last" ? lastWeekStart() : weekStart();
	const w = weekStats(p, from);
	if (which === "last") { p.data.meta.lastReport = weekKey(from); p.requestSave(); }
	const head = el.createDiv("fch-pagehead fch-pagehead-row");
	const ht = head.createDiv();
	ht.createEl("h1", { text: "📊 Laporan mingguan" });
	ht.createDiv({ cls: "fch-muted", text: w.label });
	const seg = head.createDiv("fch-seg");
	for (const [v, l] of [["last", "Minggu lalu"], ["this", "Minggu ini"]] as const) {
		const b = seg.createEl("button", { cls: "fch-seg-btn" + (which === v ? " is-active" : ""), text: l });
		b.onclick = () => { which = v; slide = 0; hub.renderPage(); };
	}
	if (!w.reviews) {
		el.createDiv({ cls: "fch-empty fch-empty-big", text: which === "last" ? "Tidak ada aktivitas minggu lalu. Minggu ini kesempatan baru! 💪" : "Belum ada aktivitas minggu ini." });
		return;
	}
	const acc = w.correct / w.reviews;
	const trend = w.prevReviews ? Math.round(((w.reviews - w.prevReviews) / w.prevReviews) * 100) : null;
	const target = Math.max(50, Math.round((w.reviews * 1.1) / 10) * 10);
	const slides: { bg: string; kicker: string; big: string; sub: string }[] = [
		{ bg: "s1", kicker: which === "last" ? "Minggu lalu kamu mengulas" : "Minggu ini kamu mengulas", big: `${w.reviews} kartu`, sub: trend === null ? `dalam ${w.days} hari belajar` : `${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend)}% dibanding minggu sebelumnya` },
		{ bg: "s2", kicker: "Ketepatan jawabanmu", big: `${Math.round(acc * 100)}%`, sub: w.prevAcc === null ? `${w.correct} jawaban benar` : `minggu sebelumnya ${Math.round(w.prevAcc * 100)}%` },
		{ bg: "s3", kicker: "Waktu fokus belajar", big: formatDuration(w.ms), sub: w.bestDay ? `Hari paling rajin: ${w.bestDay.label} (${w.bestDay.n} ulasan)` : "" },
		{ bg: "s4", kicker: "Materi paling sering kamu latih", big: w.topMaterial ? basename(w.topMaterial.path) : "—", sub: w.topMaterial ? `${w.topMaterial.n} ulasan · ${Math.round(w.topMaterial.acc * 100)}% benar` : "" },
		{ bg: "s5", kicker: w.improved ? "Paling berkembang" : "Jam favoritmu", big: w.improved ? basename(w.improved.path) : w.hour !== null ? `${String(w.hour).padStart(2, "0")}.00` : "—", sub: w.improved ? `akurasi naik ${Math.round(w.improved.delta * 100)} poin 📈` : "jam ketika kamu paling sering belajar" },
		{ bg: "s6", kicker: "Target minggu depan", big: `${target} ulasan`, sub: w.weakest ? `Beri perhatian ekstra pada “${basename(w.weakest.path)}” (${Math.round(w.weakest.acc * 100)}% benar)` : "Pertahankan ritme belajarmu!" },
	];
	slide = Math.min(slide, slides.length - 1);
	const st = el.createDiv(`fch-wrap-slide ${slides[slide].bg}`);
	st.createDiv({ cls: "fch-wrap-kicker", text: slides[slide].kicker });
	st.createDiv({ cls: "fch-wrap-big", text: slides[slide].big });
	st.createDiv({ cls: "fch-wrap-sub", text: slides[slide].sub });
	const dots = st.createDiv("fch-wrap-dots");
	slides.forEach((_, k) => { const d = dots.createEl("button", { cls: "fch-wrap-dot" + (k === slide ? " is-on" : ""), attr: { "aria-label": `Slide ${k + 1}` } }); d.onclick = () => { slide = k; hub.renderPage(); }; });
	const nav = el.createDiv("fch-row fch-center fch-mt");
	btn(nav, { icon: "chevron-left", disabled: slide === 0, label: "Sebelumnya", onClick: () => { slide--; hub.renderPage(); } });
	btn(nav, { text: slide === slides.length - 1 ? "Ulangi dari awal" : "Berikutnya", icon: slide === slides.length - 1 ? "rotate-ccw" : "chevron-right", cls: "fch-btn-primary", onClick: () => { slide = slide === slides.length - 1 ? 0 : slide + 1; hub.renderPage(); } });
	if (slide === slides.length - 1 && p.data.settings.confetti) confetti(st);

	const grid = el.createDiv("fch-tiles fch-mt");
	const tile = (v: string, l: string) => { const t = grid.createDiv("fch-stat"); t.createDiv({ cls: "fch-tile-v", text: v }); t.createDiv({ cls: "fch-muted fch-small", text: l }); };
	tile(String(w.reviews), "ulasan");
	tile(`${Math.round(acc * 100)}%`, "akurasi");
	tile(`${w.days}/7`, "hari aktif");
	tile(String(w.newCards), "kartu baru");
	tile(`🔥 ${w.streak}`, "streak sekarang");
	if (w.achievements.length) {
		const a = el.createDiv("fch-panel fch-mt");
		a.createEl("h3", { text: "Prestasi yang terbuka" });
		a.createDiv({ cls: "fch-small", text: w.achievements.join(" · ") });
	}
	btn(el.createDiv("fch-row fch-mt"), { text: "Simpan sebagai catatan", icon: "file-text", onClick: () => void saveReport(p, w, acc, target) });
}

async function saveReport(p: FlashcardPlugin, w: WeekStats, acc: number, target: number) {
	const folder = "Laporan Flashcard";
	if (!p.app.vault.getAbstractFileByPath(folder)) await p.app.vault.createFolder(folder);
	let path = normalizePath(`${folder}/Laporan ${dayKey(w.from)}.md`);
	for (let i = 2; p.app.vault.getAbstractFileByPath(path); i++) path = normalizePath(`${folder}/Laporan ${dayKey(w.from)} (${i}).md`);
	const lines = [
		`# 📊 Laporan belajar ${w.label}`, "",
		`| | |`, `|---|---|`,
		`| Ulasan | **${w.reviews}**${w.prevReviews ? ` (minggu sebelumnya ${w.prevReviews})` : ""} |`,
		`| Akurasi | **${Math.round(acc * 100)}%** |`,
		`| Waktu belajar | ${formatDuration(w.ms)} |`,
		`| Hari aktif | ${w.days}/7 |`,
		`| Kartu baru | ${w.newCards} |`,
		`| Streak | 🔥 ${w.streak} hari |`, "",
		w.topMaterial ? `- **Materi paling sering dilatih:** [[${w.topMaterial.path.replace(/\.md$/, "")}|${basename(w.topMaterial.path)}]] (${w.topMaterial.n} ulasan)` : "",
		w.improved ? `- **Paling berkembang:** ${basename(w.improved.path)} (+${Math.round(w.improved.delta * 100)} poin akurasi)` : "",
		w.weakest ? `- **Perlu perhatian:** ${basename(w.weakest.path)} (${Math.round(w.weakest.acc * 100)}% benar)` : "",
		w.hour !== null ? `- **Jam favorit:** ${String(w.hour).padStart(2, "0")}.00` : "",
		w.achievements.length ? `- **Prestasi:** ${w.achievements.join(", ")}` : "",
		"", `## 🎯 Target minggu depan`, `- [ ] ${target} ulasan`, `- [ ] Belajar minimal 5 hari`, w.weakest ? `- [ ] Latih ulang ${basename(w.weakest.path)}` : "",
	].filter((l, i, a) => l !== "" || a[i - 1] !== "");
	const f = await p.app.vault.create(path, lines.join("\n") + "\n");
	new Notice(`Laporan disimpan: ${f.path}`);
	await p.openAt(f.path, 0);
	void DAY;
}
