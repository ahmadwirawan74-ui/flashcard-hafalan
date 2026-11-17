import type { HubView } from "../hub-view";
import { DAY, startOfDay } from "../scheduler";
import { heatmap } from "../charts";
import { basename, btn, icon, ring, seqLabel, shuffle } from "../util";
import { openQuick, openSim, startContrast, startRetentionTest } from "./launch";
import { BossBattle, weeklyBoss } from "../boss";
import { renderMascot, renderMissions, weekKey } from "../missions";
import { Notice } from "obsidian";
import { reportReady } from "../report";
import { renderBanners, renderTasksPanel } from "./home-tasks";
import { renderTodayClasses } from "../planner";
import { renderHabitStrip } from "../habits";
import { renderQuranPanel } from "../quran";
import { renderIbadahPanel } from "../ibadah";
import { renderBlocksPanel } from "../studyplan";
import { renderAgendaPanel, renderDashHero } from "./home-dash";
import { renderSimpleHome } from "./home-simple";
import { renderEventBanner } from "../events";
import { renderRamadanStrip } from "../ramadan";
import type FlashcardPlugin from "../main";
import { planExam, setProject } from "../projects";
import { ExamEditModal, selectExam } from "../exams";
import { AudioReview } from "../audio";
import { TIERS, evaluate, medal } from "../achievements";
import { decaying, examPlan, weakCards } from "../analytics";

const TIPS: { title: string; body: string }[] = [
	{ title: "Ingat dulu, baru buka", body: "Paksa otak mengingat jawaban sebelum membalik kartu. Usaha mengingat (active recall) jauh lebih ampuh daripada membaca ulang." },
	{ title: "Satu kartu, satu fakta", body: "Kartu yang memuat banyak hal sekaligus sulit diingat. Pecah menjadi beberapa kartu kecil, atau gunakan kartu List." },
	{ title: "Jujur saat menilai", body: "Tekan “Lagi” kalau memang lupa. Penilaian jujur membuat jadwal ulang pas dengan kekuatan ingatanmu." },
	{ title: "Sedikit tapi setiap hari", body: "15 menit setiap hari lebih efektif daripada 2 jam sekali seminggu. Itulah inti spaced repetition." },
	{ title: "Pakai mnemonik", body: "Buat singkatan, cerita lucu, atau gambar mental untuk kartu yang sering terlupa. Semakin aneh, semakin melekat." },
	{ title: "Selang-seling materi", body: "Mencampur topik (interleaving) melatih otak membedakan konsep. Coba urutan “Materi berurutan, kartu diacak”." },
	{ title: "Jelaskan dengan bahasamu", body: "Tulis jawaban kartu dengan kata-katamu sendiri, seolah menjelaskan ke teman (teknik Feynman)." },
	{ title: "Tidur memperkuat ingatan", body: "Belajar sebentar sebelum tidur dan ulas lagi di pagi hari. Otak mengonsolidasi memori saat tidur." },
	{ title: "Tambahkan gambar", body: "Kartu dengan gambar atau diagram lebih mudah diingat. Tempel gambar di catatan seperti biasa: ![[gambar.png]]." },
	{ title: "Uji dirimu dengan kuis", body: "Mode Kuis membuat pilihan ganda otomatis dari kartu lain. Cocok untuk latihan menjelang ujian." },
];

export const HOME_PANELS: { id: string; label: string; icon: string; sec: string }[] = [
	{ id: "mascot", label: "Teman belajar (maskot)", icon: "🐣", sec: "motiv" },
	{ id: "hero", label: "Kartu menunggu", icon: "🧠", sec: "learn" },
	{ id: "stats", label: "Streak, level & ujian", icon: "🔥", sec: "learn" },
	{ id: "classes", label: "Pelajaran hari ini", icon: "📚", sec: "today" },
	{ id: "agenda", label: "Agenda hari ini (linimasa)", icon: "🗓️", sec: "today" },
	{ id: "blocks", label: "Jadwal belajar hari ini", icon: "📅", sec: "today" },
	{ id: "tasks", label: "Tugas hari ini", icon: "✅", sec: "today" },
	{ id: "quran", label: "Al-Qur'an", icon: "📖", sec: "ibadah" },
	{ id: "ibadah", label: "Ibadah hari ini (sholat, dzikir, Ramadan)", icon: "🕌", sec: "ibadah" },
	{ id: "habits", label: "Kebiasaan hari ini", icon: "🔁", sec: "today" },
	{ id: "decay", label: "Ingatan memudar", icon: "⚠️", sec: "learn" },
	{ id: "quick", label: "Mode latihan cepat", icon: "⚡", sec: "learn" },
	{ id: "missions", label: "Misi harian & mingguan", icon: "🎯", sec: "motiv" },
	{ id: "continue", label: "Lanjutkan materi", icon: "📘", sec: "learn" },
	{ id: "activity", label: "Aktivitas & prestasi", icon: "🏆", sec: "motiv" },
	{ id: "tip", label: "Tip hari ini", icon: "💡", sec: "motiv" },
];

export const HOME_SECTIONS: { id: string; label: string; icon: string; color: string }[] = [
	{ id: "today", label: "Hari ini", icon: "🌤️", color: "#0ea5e9" },
	{ id: "learn", label: "Belajar", icon: "🧠", color: "#8b5cf6" },
	{ id: "ibadah", label: "Al-Qur'an & ibadah", icon: "🕌", color: "#10b981" },
	{ id: "motiv", label: "Motivasi & progres", icon: "🎯", color: "#f59e0b" },
];

/** Susunan Beranda tersimpan + panel baru (aktif) yang belum ada di susunan. */
const DEFAULT_OFF = new Set(["classes", "blocks", "mascot"]);
export function homeLayout(p: FlashcardPlugin): { id: string; on: boolean }[] {
	const saved = (p.data.settings.homeLayout ?? []).filter((x) => HOME_PANELS.some((h) => h.id === x.id));
	const fresh = !saved.length;
	for (const [i, h] of HOME_PANELS.entries()) {
		if (saved.some((x) => x.id === h.id)) continue;
		// sisipkan sebelum panel tersimpan pertama yang posisinya sesudah panel ini
		const after = HOME_PANELS.slice(i + 1).map((x) => x.id);
		const at = saved.findIndex((x) => after.includes(x.id));
		const item = { id: h.id, on: fresh ? !DEFAULT_OFF.has(h.id) : true };
		if (at < 0) saved.push(item); else saved.splice(at, 0, item);
	}
	return saved;
}

let editing = false;
const WIDE = new Set(["hero", "stats", "quick", "continue", "missions", "activity", "decay"]);

export function renderHome(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const s = p.data.settings;
	const paths = p.sortedPaths();
	const w = p.waitingToday();
	const waiting = w.due + w.fresh;
	const today = p.today();
	const streak = p.streak();
	const lv = p.level();


	if (s.homeSimple !== false && !editing) return renderSimpleHome(hub, el, () => { s.homeSimple = false; p.requestSave(); hub.renderPage(); });
	renderDashHero(hub, el, editing, () => { editing = !editing; hub.renderPage(); });
	{
		const back = el.createDiv("fch-sh-back");
		btn(back, { text: "Beranda ringkas", icon: "layout-grid", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { s.homeSimple = true; p.requestSave(); hub.renderPage(); } });
	}
	renderEventBanner(hub, el);
	if (editing) renderLayoutEditor(hub, el);

	// ---- Lanjutkan sesi
	if (hub.session && !hub.session.done) {
		const r = el.createDiv("fch-resume");
		icon(r, "play-circle");
		r.createDiv({ cls: "fch-resume-txt", text: `Sesi “${hub.session.opts.title}” belum selesai · tersisa ${hub.session.queue.length - hub.session.idx} kartu. Progresmu tersimpan.` });
		btn(r, { text: "Lanjutkan", cls: "fch-btn-primary", onClick: () => hub.navigate("study") });
	}


	if (reportReady(p)) {
		const r = el.createDiv("fch-resume fch-report-ready");
		r.createSpan({ text: "📊" });
		r.createDiv({ cls: "fch-resume-txt", text: "Laporan mingguanmu sudah siap! Lihat perkembanganmu minggu lalu." });
		btn(r, { text: "Lihat laporan", cls: "fch-btn-primary", onClick: () => hub.navigate("report") });
	}

	renderBanners(hub, el);

	let host: HTMLElement = el;
	const PANELS: Record<string, () => void> = {
		mascot: () => renderMascot(p, host, () => hub.renderPage()),
		hero: () => {
		const hero = host.createDiv("fch-hero");
		const hl = hero.createDiv("fch-hero-l");
		if (!paths.length) {
			hl.createDiv({ cls: "fch-hero-num", text: "Mulai dari sini" });
			hl.createDiv({ cls: "fch-hero-sub", text: "Belum ada kartu. Buat kartu pertamamu di sini, atau klik kanan di catatan → Flashcards." });
			const row = hl.createDiv("fch-row");
			btn(row, { text: "Buat kartu pertama", icon: "plus", cls: "fch-btn-primary fch-btn-lg", onClick: () => hub.navigate("create") });
		} else {
			hl.createDiv({ cls: "fch-hero-num", text: waiting ? `${waiting} kartu menunggu` : "Semua beres hari ini" });
			const mins = Math.max(1, Math.round((waiting * p.avgSecondsPerCard()) / 60));
			hl.createDiv({
				cls: "fch-hero-sub",
				text: waiting ? `${w.due} ulasan · ${w.fresh} kartu baru · sekitar ${mins} menit` : "Kartu berikutnya akan muncul saat waktunya tiba. Mau latihan bebas?",
			});
			const row = hl.createDiv("fch-row");
			const lim = p.limitInfo(p.allCards());
			if (lim.newBlocked) {
				const note = hl.createDiv("fch-hero-note");
				note.createSpan({ text: `${lim.newBlocked} kartu baru lagi tertahan batas harian (${p.newLimitToday()}/hari). ` });
				btn(note, { text: "+10 hari ini", cls: "fch-btn-link", onClick: () => p.extendToday("new", 10) });
				hl.insertBefore(note, row);
			}
			if (waiting)
				btn(row, { text: "Mulai belajar", icon: "play", cls: "fch-btn-primary fch-btn-lg", onClick: () => hub.startSession(p.allCards(), { title: "Semua materi", cram: false, mode: s.defaultMode }) });
			btn(row, { text: "Kuis cepat", icon: "list-checks", cls: "fch-btn-lg", onClick: () => hub.startSession(p.allCards(), { title: "Kuis cepat", cram: true, mode: "quiz" }) });
			btn(row, { text: "Cocokkan", icon: "puzzle", cls: "fch-btn-lg", onClick: () => hub.startMatch(p.allCards(), "Semua materi") });
			const hard = p.allCards().filter((c) => (p.data.cards[c.id]?.lapses ?? 0) >= 2 || p.data.cards[c.id]?.starred);
			if (hard.length) btn(row, { text: `Kartu sulit (${hard.length})`, icon: "flame", cls: "fch-btn-lg", onClick: () => hub.startSession(hard, { title: "Kartu sulit & bertanda", cram: true, mode: s.defaultMode }) });
		}
		const hr = hero.createDiv("fch-hero-r");
		const goal = Math.max(1, s.dailyGoal);
		const inner = ring(hr, today.reviews / goal, 120, undefined, "fch-ring-big").createDiv("fch-ring-inner");
		inner.createDiv({ cls: "fch-ring-num", text: String(today.reviews) });
		inner.createDiv({ cls: "fch-muted fch-small", text: `dari ${goal} ulasan` });
		},
		stats: () => {
		// ---- Kartu ringkas
		const tri = host.createDiv("fch-tri");
		const st = tri.createDiv("fch-panel fch-mini");
		st.createDiv({ cls: "fch-mini-v", text: `🔥 ${streak.current}` });
		st.createDiv({ cls: "fch-mini-l", text: streak.current ? `hari beruntun · rekor ${streak.best}` : "Belajar hari ini untuk memulai streak" });
		const week = st.createDiv("fch-week");
		for (let i = 6; i >= 0; i--) {
			const t = startOfDay(Date.now()) - i * DAY;
			const d = new Date(t);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
			const done = (p.data.daily[key]?.reviews ?? 0) > 0;
			const dot = week.createDiv("fch-week-d" + (done ? " is-done" : "") + (i === 0 ? " is-today" : ""));
			dot.createSpan({ text: d.toLocaleDateString("id-ID", { weekday: "narrow" }) });
		}

		const lvp = tri.createDiv("fch-panel fch-mini");
		lvp.createDiv({ cls: "fch-mini-v", text: `Level ${lv.level}` });
		lvp.createDiv({ cls: "fch-mini-l", text: `${lv.title} · ${lv.xp} XP` });
		lvp.createDiv("fch-bar").createDiv("fch-bar-fill").style.width = `${(lv.into / lv.need) * 100}%`;
		lvp.createDiv({ cls: "fch-muted fch-small", text: `${lv.need - lv.into} XP lagi ke level ${lv.level + 1}` });

		renderExams(hub, tri.createDiv("fch-panel fch-mini"));
		},
		classes: () => renderTodayClasses(hub, host),
		agenda: () => renderAgendaPanel(hub, host),
		blocks: () => renderBlocksPanel(hub, host),
		tasks: () => renderTasksPanel(hub, host),
		quran: () => renderQuranPanel(hub, host),
		ibadah: () => { renderRamadanStrip(hub, host); renderIbadahPanel(hub, host); },
		habits: () => renderHabitStrip(hub, host),
		decay: () => {
		// ---- Peringatan ingatan memudar
		const dec = decaying(p).slice(0, 4);
		if (dec.length) {
			const w = host.createDiv("fch-decay");
			w.createDiv({ cls: "fch-strong", text: "⚠️ Ingatan mulai memudar" });
			for (const d of dec) {
				const r = w.createDiv("fch-decay-row");
				r.createSpan({ cls: "fch-grow", text: basename(d.path) });
				r.createSpan({ cls: "fch-ret " + (d.retention >= 0.7 ? "is-mid" : "is-bad"), text: `±${Math.round(d.retention * 100)}%` });
				if (d.overdue) r.createSpan({ cls: "fch-muted fch-small", text: `${d.overdue} terlambat` });
				btn(r, { text: "Ulas", cls: "fch-btn-sm", onClick: () => hub.startSession(p.index.get(d.path) ?? [], { title: basename(d.path), cram: false, mode: s.defaultMode }) });
			}
		}
		},
		quick: () => {
		// ---- Mode latihan cepat
		const quick = host.createDiv("fch-quick");
		const q = (icon: string, title: string, desc: string, fn: () => void) => {
			const b = quick.createEl("button", { cls: "fch-quick-it" });
			b.createDiv({ cls: "fch-quick-ic", text: icon });
			b.createDiv({ cls: "fch-strong fch-small", text: title });
			b.createDiv({ cls: "fch-muted fch-small", text: desc });
			b.onclick = fn;
		};
		const reviewed = p.allCards().filter((c) => (p.data.cards[c.id]?.history.length ?? 0) > 0);
		q("⏱️", "Aku punya X menit", "Sesi efisien berwaktu", () => openQuick(hub));
		const wb = weeklyBoss(p);
		if (wb) q("👾", "Boss mingguan", p.data.meta.bossWeek === weekKey() ? "Sudah dikalahkan ✓" : basename(wb.path), () => { if (!hub.startGame(new BossBattle(hub, p.index.get(wb.path) ?? [], basename(wb.path), wb.sprite, true))) new Notice("Boss butuh minimal 4 kartu yang bisa dijadikan soal."); });
		q("🗺️", "Petualangan", "Peta level materi", () => hub.navigate("adventure"));
		q("⚖️", "Bedakan", "Kartu yang mirip", () => startContrast(hub));
		q("🔀", "Selang-seling", "Campur semua materi", () => { hub.startSession(p.allCards(), { title: "Selang-seling", cram: false, mode: s.defaultMode, interleave: true }); });
		q("🎲", "Ulasan acak", "20 kartu acak", () => hub.startSession(shuffle(reviewed).slice(0, 20), { title: "Ulasan acak", cram: true, mode: s.defaultMode }));
		q("🎯", "Kelemahan", `${weakCards(p).length} kartu lemah`, () => hub.navigate("weak"));
		q("🧪", "Tes retensi", "Uji kartu lama", () => startRetentionTest(hub));
		q("🗣️", "Jelaskan", "Mode Feynman", () => hub.startSession(shuffle(reviewed.length >= 5 ? reviewed : p.allCards()).slice(0, 10), { title: "Jelaskan kembali", cram: true, mode: "explain" }));
		q("📝", "Simulasi ujian", "Seperti ujian sungguhan", () => openSim(hub, p.allCards(), "Semua materi"));
		q("🔗", "Rantai hafalan", "Teks panjang", () => hub.openChain());
		q("🎧", "Mode dengar", "Dibacakan otomatis", () => { hub.startGame(new AudioReview(hub, p.buildQueue(p.allCards(), true).slice(0, 50), "Semua materi")); });
		},
		missions: () => renderMissions(p, host, () => hub.renderPage()),
		continue: () => {
		// ---- Lanjutkan materi berurutan
		if (paths.length) {
			const sec = host.createDiv("fch-section");
			const sh = sec.createDiv("fch-section-head");
			sh.createEl("h3", { text: "Lanjutkan materi" });
			btn(sh, { text: "Semua materi", cls: "fch-btn-link", onClick: () => hub.navigate("decks") });
			const next = paths.filter((x) => {
				const c = p.countFor([x]);
				return c.due + c.fresh > 0;
			}).slice(0, 3);
			if (!next.length) sec.createDiv({ cls: "fch-empty", text: "Semua materi sudah beres untuk hari ini. Kerja bagus!" });
			const list = sec.createDiv("fch-next");
			for (const path of next) {
				const c = p.countFor([path]);
				const row = list.createDiv("fch-next-row");
				const sq = seqLabel(path, paths.indexOf(path) + 1);
				if (sq) row.createDiv({ cls: "fch-seq", text: sq });
				const info = row.createDiv("fch-next-info");
				info.createDiv({ cls: "fch-next-name", text: basename(path) });
				const learned = c.total ? (c.total - c.fresh) / c.total : 0;
				const bar = info.createDiv("fch-bar fch-bar-thin");
				bar.createDiv("fch-bar-fill").style.width = `${learned * 100}%`;
				info.createDiv({ cls: "fch-muted fch-small", text: `${Math.round(learned * 100)}% dipelajari · ${c.due} ulasan · ${c.fresh} baru` });
				btn(row, { text: "Belajar", icon: "play", cls: "fch-btn-primary", onClick: () => hub.startSession(p.index.get(path) ?? [], { title: basename(path), cram: false, mode: s.defaultMode }) });
			}
		}
		},
		activity: () => {
		// ---- Aktivitas + lencana
		const duo = host.createDiv("fch-duo");
		const act = duo.createDiv("fch-panel");
		act.createEl("h3", { text: "Aktivitas" });
		heatmap(act.createDiv("fch-scroll"), p.data.daily, 17);
		const bd = duo.createDiv("fch-panel");
		const states = evaluate(p);
		const bh = bd.createDiv("fch-section-head");
		bh.createEl("h3", { text: "Prestasi" });
		btn(bh, { text: "Lihat semua", cls: "fch-btn-link", onClick: () => hub.navigate("awards") });
		const close = states.filter((x) => x.next !== null).sort((a, b) => b.progress - a.progress).slice(0, 3);
		for (const st of close) {
			const r = bd.createDiv("fch-ach-mini");
			medal(r, st.def.icon, st.tier, 40);
			const tx = r.createDiv("fch-grow");
			tx.createDiv({ cls: "fch-strong fch-small", text: `${st.def.name}${st.tier ? " · " + TIERS[st.tier - 1] : ""}` });
			tx.createDiv({ cls: "fch-muted fch-small", text: st.def.goal(st.next!) });
			tx.createDiv("fch-bar fch-bar-thin").createDiv("fch-bar-fill").style.width = `${st.progress * 100}%`;
		}
		},
		tip: () => {
		// ---- Tip
		const tip = TIPS[Math.floor(Date.now() / DAY) % TIPS.length];
		const tp = host.createDiv("fch-tip");
		icon(tp, "lightbulb");
		const tx = tp.createDiv();
		tx.createDiv({ cls: "fch-tip-title", text: `Tip hari ini: ${tip.title}` });
		tx.createDiv({ cls: "fch-muted", text: tip.body });
		},
	};
	const lay = homeLayout(p);
	const collapsed = new Set(p.data.settings.homeCollapsed ?? []);
	for (const sc of HOME_SECTIONS) {
		const ids = lay.filter((x) => x.on && HOME_PANELS.find((h) => h.id === x.id)?.sec === sc.id).map((x) => x.id);
		if (!ids.length) continue;
		const wrap = el.createDiv("fch-hsec" + (collapsed.has(sc.id) ? " is-collapsed" : ""));
		wrap.style.setProperty("--sec", sc.color);
		const hd = wrap.createEl("button", { cls: "fch-hsec-head", attr: { "aria-label": collapsed.has(sc.id) ? "Tampilkan bagian" : "Lipat bagian" } });
		hd.createSpan({ cls: "fch-hsec-ic", text: sc.icon });
		hd.createSpan({ cls: "fch-hsec-title", text: sc.label });
		hd.createSpan("fch-hsec-line");
		hd.createSpan({ cls: "fch-hsec-chev", text: collapsed.has(sc.id) ? "▸" : "▾" });
		hd.onclick = () => {
			const c = new Set(p.data.settings.homeCollapsed ?? []);
			if (c.has(sc.id)) c.delete(sc.id); else c.add(sc.id);
			p.data.settings.homeCollapsed = [...c];
			p.requestSave();
			hub.renderPage();
		};
		if (collapsed.has(sc.id)) continue;
		const body = wrap.createDiv("fch-hsec-body");
		for (const id of ids) {
			const cell = body.createDiv("fch-hcell is-" + (WIDE.has(id) ? "wide" : "half"));
			host = cell;
			// satu panel yang bermasalah tidak boleh membuat seluruh Beranda gagal tampil
			try { PANELS[id]?.(); if (!cell.childElementCount) cell.remove(); }
			catch (err) {
				console.error(`Flashcard Hafalan: panel Beranda "${id}" gagal`, err);
				host.createDiv({ cls: "fch-banner fch-mt", text: `⚠️ Panel “${HOME_PANELS.find((h) => h.id === id)?.label ?? id}” gagal dimuat. Panel lain tetap berjalan; sembunyikan lewat “Atur Beranda” bila perlu.` });
			}
		}
	}
}

function renderLayoutEditor(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const box = el.createDiv("fch-panel fch-layout-ed");
	box.createEl("h3", { text: "🧩 Atur Beranda" });
	box.createDiv({ cls: "fch-muted fch-small fch-desc", text: "Seret untuk mengubah urutan (atau pakai tombol ↑ ↓), dan matikan panel yang tidak dipakai. Perubahan langsung tersimpan." });
	const list = box.createDiv("fch-layout-list");
	const lay = homeLayout(p);
	const save = () => { p.data.settings.homeLayout = lay.map((x) => ({ ...x })); p.requestSave(); hub.renderPage(); };
	let dragFrom = -1;
	lay.forEach((x, i) => {
		const meta = HOME_PANELS.find((h) => h.id === x.id)!;
		const row = list.createDiv("fch-layout-row" + (x.on ? "" : " is-off"));
		row.draggable = true;
		row.addEventListener("dragstart", (e) => { dragFrom = i; e.dataTransfer?.setData("text/plain", x.id); row.addClass("is-drag"); });
		row.addEventListener("dragend", () => row.removeClass("is-drag"));
		row.addEventListener("dragover", (e) => { e.preventDefault(); row.addClass("is-over"); });
		row.addEventListener("dragleave", () => row.removeClass("is-over"));
		row.addEventListener("drop", (e) => { e.preventDefault(); if (dragFrom < 0 || dragFrom === i) return; const [m] = lay.splice(dragFrom, 1); lay.splice(i, 0, m); save(); });
		row.createSpan({ cls: "fch-layout-grip", text: "⠿" });
		row.createSpan({ text: meta.icon });
		row.createSpan({ cls: "fch-grow", text: meta.label });
		btn(row, { icon: "arrow-up", cls: "fch-btn-ghost fch-btn-sm", label: "Naikkan", disabled: i === 0, onClick: () => { [lay[i - 1], lay[i]] = [lay[i], lay[i - 1]]; save(); } });
		btn(row, { icon: "arrow-down", cls: "fch-btn-ghost fch-btn-sm", label: "Turunkan", disabled: i === lay.length - 1, onClick: () => { [lay[i + 1], lay[i]] = [lay[i], lay[i + 1]]; save(); } });
		const t = row.createEl("label", { cls: "fch-toggle" });
		const cb = t.createEl("input", { type: "checkbox" });
		cb.checked = x.on;
		cb.onchange = () => { x.on = cb.checked; save(); };
		t.createSpan({ cls: "fch-small", text: x.on ? "Tampil" : "Sembunyi" });
	});
	const r = box.createDiv("fch-row fch-mt");
	btn(r, { text: "Kembalikan bawaan", icon: "rotate-ccw", cls: "fch-btn-sm", onClick: () => { p.data.settings.homeLayout = []; p.requestSave(); hub.renderPage(); } });
	btn(r, { text: "Tampilkan semua", cls: "fch-btn-sm fch-btn-ghost", onClick: () => { lay.forEach((x) => (x.on = true)); save(); } });
	btn(r, { text: "Minimalis", cls: "fch-btn-sm fch-btn-ghost", onClick: () => { const keep = new Set(["hero", "tasks", "classes", "quran"]); lay.forEach((x) => (x.on = keep.has(x.id))); save(); } });
}

function renderExams(hub: HubView, box: HTMLElement) {
	const p = hub.plugin;
	const today = new Date().toISOString().slice(0, 10);
	const exams = p.data.exams.filter((e) => e.date >= today);
	box.addClass("fch-exam-mini");
	const h = box.createDiv("fch-section-head");
	h.createDiv({ cls: "fch-mini-l fch-strong", text: "🎓 Ujian" });
	btn(h, { text: "+ Ujian", cls: "fch-btn-link", onClick: () => new ExamEditModal(hub.app, p, (ex) => { if (ex) selectExam(ex.id); hub.navigate("exams"); }).open() });
	if (!exams.length) {
		box.createDiv({ cls: "fch-muted fch-small", text: "Tambahkan tanggal ujian dan pilih materinya. Target kartu per hari akan dihitung otomatis." });
		return;
	}
	const e = exams[0];
	const plan = examPlan(p, e);
	const big = box.createDiv("fch-row");
	big.createDiv({ cls: "fch-mini-v", text: plan.daysLeft === 0 ? "Hari H!" : `H-${plan.daysLeft}` });
	big.createDiv({ cls: "fch-muted fch-small fch-grow", text: e.name });
	box.createDiv("fch-bar fch-bar-thin").createDiv("fch-bar-fill").style.width = `${plan.total ? (plan.learned / plan.total) * 100 : 0}%`;
	box.createDiv({ cls: "fch-muted fch-small", text: `${plan.learned}/${plan.total} kartu dipelajari · target hari ini ${plan.remaining} baru + ${plan.due} ulasan` });
	const r = box.createDiv("fch-row");
	btn(r, { text: "Belajar target", icon: "play", cls: "fch-btn-primary fch-btn-sm", onClick: () => hub.startSession(plan.cards, { title: e.name, cram: false, mode: p.data.settings.defaultMode, examId: e.id }) });
	btn(r, { text: "Simulasi", icon: "file-check", cls: "fch-btn-sm", onClick: () => openSim(hub, plan.cards, e.name, e.date) });
	const hasPlan = p.data.tasks.some((t) => t.planId === e.id);
	btn(r, { text: hasPlan ? "Rencana" : "Susun rencana", icon: "list-checks", cls: "fch-btn-sm", onClick: () => { if (!hasPlan) planExam(p, e); const pr = p.data.projects.find((x) => x.examId === e.id); if (pr) setProject(pr.id); hub.navigate("projects"); } });
	btn(r, { icon: "map", cls: "fch-btn-ghost fch-btn-sm", label: "Peta jalan ujian", onClick: () => { selectExam(e.id); hub.navigate("exams"); } });
	if (exams.length > 1) box.createDiv({ cls: "fch-muted fch-small", text: `+${exams.length - 1} ujian lain — lihat di Kalender` });
}
