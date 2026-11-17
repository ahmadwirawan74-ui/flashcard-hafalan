/**
 * Beranda ringkas (v20): tiga bagian saja — Study (Belajar, Rencana, Wawasan, Game), Ibadah, dan Medis.
 * Tampilan lengkap (panel yang bisa diatur) tetap tersedia lewat tombol "Tampilan lengkap".
 */
import type { HubView } from "../hub-view";
import { dayKey } from "../scheduler";
import { dueToday } from "../tasks";
import { blocksOn } from "../studyplan";
import { TOTAL, fromGid, openReader, todayRead } from "../quran";
import { countdown, hijri, mscore, nextPrayer } from "../ibadah";
import { DISEASES } from "../med-dis";
import { DRUGS } from "../med-data";
import { openDrug } from "../medis";
import { openDisease } from "../medis3";
import { btn } from "../util";

type Tile = { icon: string; title: string; sub: string; color: string; badge?: string; go: () => void };

function tiles(parent: HTMLElement, list: Tile[]) {
	const g = parent.createDiv("fch-sh-tiles");
	for (const t of list) {
		const b = g.createEl("button", { cls: "fch-sh-tile" });
		b.style.setProperty("--c", t.color);
		b.createSpan({ cls: "fch-sh-tile-ic", text: t.icon });
		const tx = b.createDiv("fch-sh-tile-tx");
		tx.createDiv({ cls: "fch-sh-tile-t", text: t.title });
		tx.createDiv({ cls: "fch-sh-tile-s", text: t.sub });
		if (t.badge) b.createSpan({ cls: "fch-sh-badge", text: t.badge });
		b.onclick = t.go;
	}
}
function block(parent: HTMLElement, icon: string, title: string, color: string, more?: [string, () => void]) {
	const s = parent.createDiv("fch-sh-block");
	s.style.setProperty("--c", color);
	const h = s.createDiv("fch-sh-block-h");
	h.createSpan({ cls: "fch-sh-block-ic", text: icon });
	h.createSpan({ cls: "fch-sh-block-t", text: title });
	if (more) { const a = h.createEl("button", { cls: "fch-sh-more", text: more[0] }); a.onclick = more[1]; }
	return s;
}

export function renderSimpleHome(hub: HubView, el: HTMLElement, toFull: () => void) {
	const p = hub.plugin;
	const s = p.data.settings;
	const k = dayKey(Date.now());
	const hour = new Date().getHours();
	const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";

	// ---- sapaan singkat
	const top = el.createDiv("fch-sh-top");
	const tl = top.createDiv("fch-grow");
	tl.createDiv({ cls: "fch-sh-greet", text: `${greet} 👋` });
	tl.createDiv({ cls: "fch-sh-date", text: `${new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })} · ${hijri(p).text}` });
	btn(top, { text: "Tampilan lengkap", icon: "layout-dashboard", cls: "fch-btn-ghost fch-btn-sm", label: "Beralih ke beranda lengkap", onClick: toFull });

	// ---- STUDY
	const w = p.waitingToday();
	const waiting = w.due + w.fresh;
	const rev = p.data.daily[k]?.reviews ?? 0;
	const tasks = dueToday(p).length;
	const blocks = blocksOn(p, k);
	const bDone = blocks.filter((b) => b.log[k] === 1).length;
	const st = p.streak();
	const lv = p.level();
	const study = block(el, "📚", "Study", "#6366f1");
	tiles(study, [
		{ icon: "🧠", title: "Belajar", sub: waiting ? `${waiting} kartu menunggu · ${rev} diulas` : rev ? `${rev} kartu diulas — beres!` : "Tidak ada kartu jatuh tempo", color: "#6366f1", badge: waiting ? String(waiting) : undefined,
			go: () => (waiting ? hub.startSession(p.allCards(), { title: "Semua materi", cram: false, mode: s.defaultMode }) : hub.navigate("study")) },
		{ icon: "🗓️", title: "Rencana belajar", sub: blocks.length || tasks ? `${bDone}/${blocks.length} jadwal · ${tasks} tugas hari ini` : "Atur jadwal & tugas", color: "#8b5cf6", badge: tasks ? String(tasks) : undefined, go: () => hub.navigate("planner") },
		{ icon: "📈", title: "Wawasan", sub: `🔥 ${st.current} hari · Level ${lv.level}`, color: "#0ea5e9", go: () => hub.navigate("stats") },
		{ icon: "🎮", title: "Game", sub: `🪙 ${(p.data.meta.coins ?? 0).toLocaleString("id-ID")} koin · Arena & Dungeon`, color: "#f59e0b", go: () => hub.navigate("arena") },
	]);

	// ---- IBADAH
	const ib = block(el, "🕌", "Ibadah", "#10b981", ["Semua", () => hub.navigate("mutabaah")]);
	const np = nextPrayer(p);
	const tr = todayRead(p);
	const q = p.data.quran;
	const ms = mscore(p, k);
	const pr = ib.createDiv("fch-sh-prayer");
	pr.createSpan({ cls: "fch-sh-prayer-k", text: "Sholat berikutnya" });
	const pv = pr.createSpan({ cls: "fch-sh-prayer-v", text: `${np.name} ${new Date(np.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` });
	const pc = pr.createSpan({ cls: "fch-sh-prayer-c", text: `− ${countdown(np.at - Date.now())}` });
	const tm = window.setInterval(() => {
		if (!pc.isConnected) return window.clearInterval(tm);
		const n2 = nextPrayer(p);
		pv.setText(`${n2.name} ${new Date(n2.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`);
		pc.setText(`− ${countdown(n2.at - Date.now())}`);
	}, 1000);
	tiles(ib, [
		{ icon: "📖", title: "Al-Qur'an", sub: `${tr.pages.toFixed(1)}/${q.target} halaman hari ini`, color: "#14b8a6",
			go: () => { const g = q.last ? Math.min(TOTAL, q.last.g + 1) : 1; openReader(fromGid(g)[0], g); hub.navigate("quran"); } },
		{ icon: "✅", title: "Mutaba'ah", sub: `${Math.round(ms * 100)}% amalan hari ini`, color: "#10b981", go: () => hub.navigate("mutabaah") },
		{ icon: "📿", title: "Dzikir", sub: "Pagi-petang & tasbih", color: "#059669", go: () => hub.navigate("dzikir") },
	]);

	// ---- MEDIS
	if (s.medis) {
		const md = block(el, "🩺", "Medis", "#0d9488", ["Buka", () => hub.navigate("med")]);
		const box = md.createDiv("fch-md-search fch-sh-search");
		box.createSpan({ cls: "fch-md-search-ic", text: "🔎" });
		const inp = box.createEl("input", { type: "text", cls: "fch-md-search-in", attr: { placeholder: "Cari obat atau penyakit…" } });
		const res = md.createDiv("fch-sh-res");
		inp.oninput = () => {
			res.empty();
			const v = inp.value.trim().toLowerCase();
			if (v.length < 2) return;
			const ds = DISEASES.filter((d) => d.name.toLowerCase().includes(v) || (d.en ?? "").toLowerCase().includes(v)).slice(0, 4);
			const ob = DRUGS.filter((d) => d.name.toLowerCase().includes(v) || d.alias?.some((a) => a.toLowerCase().includes(v))).slice(0, 4);
			for (const d of ds) { const b = res.createEl("button", { cls: "fch-sh-hit", text: `🩺 ${d.name}` }); b.onclick = () => openDisease(hub, d.id); }
			for (const d of ob) { const b = res.createEl("button", { cls: "fch-sh-hit", text: `💊 ${d.name}` }); b.onclick = () => openDrug(hub, d.id); }
			if (!ds.length && !ob.length) res.createDiv({ cls: "fch-small fch-muted", text: "Tidak ditemukan." });
		};
		tiles(md, [
			{ icon: "🩺", title: "Penyakit", sub: `${DISEASES.length} materi · SKDI 2019`, color: "#16a34a", go: () => hub.navigate("medpenyakit") },
			{ icon: "📝", title: "Resep", sub: "Per penyakit, dosis anak otomatis", color: "#0ea5e9", go: () => hub.navigate("medresep") },
			{ icon: "🧮", title: "Kalkulator dosis", sub: "Dewasa & anak", color: "#0d9488", go: () => hub.navigate("medcalc") },
			{ icon: "💊", title: "Obat", sub: `${DRUGS.length} obat`, color: "#7c3aed", go: () => hub.navigate("med") },
		]);
	}
}
