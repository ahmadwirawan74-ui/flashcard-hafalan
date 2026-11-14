import type { HubView } from "../hub-view";
import { CardState } from "../types";
import { dayKey, formatDuration } from "../scheduler";
import { compareChart, forecastBars, heatmap, hourChart, retentionForecast, trendChart } from "../charts";
import { forgettingTracker, hourStats, maturity } from "../analytics";
import { startRetentionTest } from "./launch";
import { btn } from "../util";
import { basename, plainText, ring } from "../util";

export function renderStats(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const paths = p.sortedPaths();
	const c = p.countFor(paths);
	const streak = p.streak();
	const today = p.today();
	const lv = p.level();
	const acc = p.accuracy(30);
	const cards = p.allCards();
	const states = cards.map((x) => p.data.cards[x.id]).filter((s): s is CardState => !!s && !s.suspended);
	const suspended = cards.filter((x) => p.data.cards[x.id]?.suspended).length;

	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "Analitik belajar" });
	head.createDiv({ cls: "fch-muted", text: "Pantau seberapa kuat ingatanmu dan bagaimana kebiasaan belajarmu terbentuk." });

	const hero = el.createDiv("fch-hero");
	const hl = hero.createDiv("fch-hero-l");
	hl.createDiv({ cls: "fch-hero-num", text: c.retention === null ? "—" : `${Math.round(c.retention * 100)}%` });
	hl.createDiv({ cls: "fch-hero-sub", text: "perkiraan isi ingatanmu saat ini, dihitung dari kurva lupa setiap kartu" });
	const facts = hl.createDiv("fch-facts");
	const fact = (v: string, l: string) => {
		const f = facts.createDiv("fch-fact");
		f.createDiv({ cls: "fch-fact-v", text: v });
		f.createDiv({ cls: "fch-muted fch-small", text: l });
	};
	fact(`🔥 ${streak.current}`, `beruntun · rekor ${streak.best}`);
	fact(String(today.reviews), `ulasan hari ini · ${formatDuration(today.ms)}`);
	fact(acc.reviews ? `${Math.round((acc.correct / acc.reviews) * 100)}%` : "—", "akurasi 30 hari");
	fact(`Lv ${lv.level}`, `${lv.title} · ${lv.xp} XP`);
	const hr = hero.createDiv("fch-hero-r");
	const learned = c.total ? (c.total - c.fresh) / c.total : 0;
	const inner = ring(hr, learned, 120, undefined, "fch-ring-big").createDiv("fch-ring-inner");
	inner.createDiv({ cls: "fch-ring-num", text: `${Math.round(learned * 100)}%` });
	inner.createDiv({ cls: "fch-muted fch-small", text: "dipelajari" });

	const tiles = el.createDiv("fch-tiles");
	const tile = (v: number, l: string, cls = "") => {
		const t = tiles.createDiv("fch-stat " + cls);
		t.createDiv({ cls: "fch-tile-v", text: String(v) });
		t.createDiv({ cls: "fch-muted fch-small", text: l });
	};
	tile(c.total, "kartu");
	tile(c.fresh, "belum dipelajari", "is-new");
	tile(c.due, "jatuh tempo", "is-due");
	tile(c.mature, "matang (≥ 21 hari)", "is-mature");
	tile(suspended, "ditangguhkan");

	const section = (parent: HTMLElement, title: string, desc?: string) => {
		const s = parent.createDiv("fch-panel");
		s.createEl("h3", { text: title });
		if (desc) s.createDiv({ cls: "fch-muted fch-small fch-desc", text: desc });
		return s;
	};

	// ---- tren 30 hari
	const days: { label: string; n: number; acc: number | null }[] = [];
	for (let i = 29; i >= 0; i--) {
		const t = Date.now() - i * 864e5;
		const d = p.data.daily[dayKey(t)];
		days.push({ label: new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short" }), n: d?.reviews ?? 0, acc: d?.reviews ? d.correct / d.reviews : null });
	}
	const tot30 = days.reduce((a, d) => a + d.n, 0);
	const active = days.filter((d) => d.n).length;
	trendChart(section(el, "Tren 30 hari", `${tot30} ulasan · aktif ${active} dari 30 hari · rata-rata ${active ? Math.round(tot30 / active) : 0} ulasan per hari aktif. Batang = jumlah ulasan, garis = akurasi.`).createDiv(), days);

	// ---- kematangan
	const mt = maturity(p);
	const ms = section(el, "Kematangan kartu", "Baru → dipelajari (< 7 hari) → muda (< 21 hari) → matang (≥ 21 hari).");
	const tot = Math.max(1, mt.fresh + mt.learning + mt.young + mt.mature);
	const stack = ms.createDiv("fch-stack");
	for (const [k, label, cls] of [["fresh", "Baru", "is-new"], ["learning", "Dipelajari", "is-learning"], ["young", "Muda", "is-young"], ["mature", "Matang", "is-mature"]] as const) {
		const v = mt[k];
		if (!v) continue;
		const seg = stack.createDiv({ cls: "fch-stack-seg " + cls, attr: { "aria-label": `${label}: ${v}` } });
		seg.style.flexGrow = String(v);
		seg.setText(v / tot > 0.08 ? `${label} ${v}` : String(v));
	}

	// ---- pelacak kurva lupa
	const ft = forgettingTracker(p);
	const fs = section(el, "Pelacak kurva lupa", "Garis ungu putus-putus = perkiraan model, garis hijau = kenyataan (persentase ulasan yang berhasil diingat), dikelompokkan menurut jarak sejak ulasan sebelumnya.");
	if (ft.total < 10) fs.createDiv({ cls: "fch-empty", text: "Butuh lebih banyak ulasan ulang untuk membandingkan kurva lupa." });
	else {
		compareChart(fs.createDiv(), ft.byDays);
		const legend = fs.createDiv("fch-glegend");
		legend.createSpan({ text: "Perkiraan model" }).style.setProperty("--c", "var(--interactive-accent)");
		legend.createSpan({ text: "Kenyataan" }).style.setProperty("--c", "#2f9e66");
		const cal = ft.calib.filter((b) => b.n >= 5);
		if (cal.length) {
			const diff = cal.reduce((a, b) => a + (b.actual - b.predicted) * b.n, 0) / cal.reduce((a, b) => a + b.n, 0);
			fs.createDiv({ cls: "fch-tipline", text: Math.abs(diff) < 0.05 ? "✅ Prediksi model sesuai dengan ingatanmu yang sebenarnya." : diff > 0 ? `📈 Ingatanmu ±${Math.round(diff * 100)}% lebih kuat dari perkiraan. Kamu bisa menaikkan "Kemudahan awal" agar interval lebih panjang.` : `📉 Ingatanmu ±${Math.round(-diff * 100)}% lebih lemah dari perkiraan. Pertimbangkan menurunkan "Kemudahan awal", atau tulis mnemonik untuk kartu yang sulit.` });
		}
	}

	// ---- jam terbaik
	const hs = hourStats(p);
	const hsec = section(el, "Waktu belajar terbaik", "Jumlah ulasan per jam. Warna = akurasi (hijau tinggi, merah rendah).");
	hourChart(hsec.createDiv(), hs);
	const good = hs.map((h, i) => ({ i, n: h.n, acc: h.n ? h.ok / h.n : 0 })).filter((h) => h.n >= 5).sort((a, b) => b.acc - a.acc);
	if (good.length >= 2) hsec.createDiv({ cls: "fch-tipline", text: `⏰ Akurasimu paling tinggi sekitar pukul ${String(good[0].i).padStart(2, "0")}.00 (${Math.round(good[0].acc * 100)}%) dan paling rendah sekitar pukul ${String(good[good.length - 1].i).padStart(2, "0")}.00 (${Math.round(good[good.length - 1].acc * 100)}%).` });

	// ---- tes retensi jangka panjang
	const tests = (p.data.meta.retentionTests ?? []).slice(-8).reverse();
	const tsec = section(el, "Tes retensi jangka panjang", "Uji kartu lama yang sudah lama tidak diulas, tanpa mengubah jadwal, untuk mengetahui seberapa awet ingatanmu.");
	btn(tsec, { text: "Mulai tes (20 kartu)", icon: "flask-conical", cls: "fch-btn-primary fch-btn-sm", onClick: () => startRetentionTest(hub) });
	if (tests.length) {
		const tl = tsec.createDiv("fch-tests");
		for (const t of tests) {
			const pct = Math.round((t.correct / t.n) * 100);
			const r = tl.createDiv("fch-test");
			r.createSpan({ cls: "fch-muted fch-small", text: new Date(t.t).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) });
			const b = r.createDiv("fch-bar fch-grow");
			b.createDiv("fch-bar-fill").style.width = `${pct}%`;
			r.createSpan({ cls: "fch-ret " + (pct >= 85 ? "is-good" : pct >= 65 ? "is-mid" : "is-bad"), text: `${pct}%` });
		}
	}

	heatmap(section(el, "Aktivitas belajar").createDiv("fch-scroll"), p.data.daily, 26);
	const duo = el.createDiv("fch-duo");
	forecastBars(section(duo, "Prakiraan 14 hari", "Jumlah kartu yang perlu diulas per hari.").createDiv(), p.forecast(14));
	retentionForecast(section(duo, "Kurva lupa", "Perkiraan rata-rata ingatan bila berhenti belajar mulai hari ini.").createDiv(), states);

	const tSec = section(el, "Per materi");
	const table = tSec.createDiv("fch-scroll").createEl("table", { cls: "fch-table" });
	const hrow = table.createEl("thead").createEl("tr");
	["#", "Materi", "Kartu", "Baru", "Tempo", "Matang", "Retensi"].forEach((h) => hrow.createEl("th", { text: h }));
	const tb = table.createEl("tbody");
	paths.forEach((path, i) => {
		const cc = p.countFor([path]);
		const tr = tb.createEl("tr");
		tr.createEl("td", { cls: "fch-muted", text: String(i + 1) });
		const a = tr.createEl("td").createEl("a", { text: basename(path), href: "#" });
		a.onclick = (e) => {
			e.preventDefault();
			hub.startSession(p.index.get(path) ?? [], { title: basename(path), cram: false, mode: p.data.settings.defaultMode });
		};
		[cc.total, cc.fresh, cc.due, cc.mature].forEach((v) => tr.createEl("td", { text: String(v) }));
		const rt = tr.createEl("td");
		if (cc.retention === null) rt.setText("—");
		else {
			const pct = Math.round(cc.retention * 100);
			rt.createSpan({ cls: "fch-ret " + (pct >= 85 ? "is-good" : pct >= 60 ? "is-mid" : "is-bad"), text: `${pct}%` });
		}
	});

	const thr = p.data.settings.leechThreshold;
	const leeches = cards.map((x) => ({ card: x, st: p.data.cards[x.id] })).filter((x) => x.st && x.st.lapses >= thr).sort((a, b) => b.st!.lapses - a.st!.lapses);
	const lSec = section(el, "Kartu yang sering terlupa", `Sudah ${thr}× atau lebih terlupa. Coba tulis ulang, beri mnemonik, atau pecah jadi kartu kecil.`);
	if (!leeches.length) lSec.createDiv({ cls: "fch-empty", text: "Tidak ada. Bagus!" });
	for (const { card, st } of leeches.slice(0, 20)) {
		const row = lSec.createDiv("fch-leech");
		row.createSpan({ cls: "fch-leech-n", text: `${st!.lapses}×` });
		const tx = row.createDiv();
		tx.createDiv({ text: plainText(card.front).slice(0, 120) });
		tx.createDiv({ cls: "fch-muted fch-small", text: basename(card.path) });
		row.onclick = () => void p.openAt(card.path, card.line);
	}
}
