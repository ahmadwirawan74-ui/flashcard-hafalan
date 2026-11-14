import { setIcon } from "obsidian";
import type { HubView } from "../hub-view";
import { Card, StudyMode } from "../types";
import type { SessionOpts } from "../session";
import { basename, btn, folderOf, shuffle } from "../util";
import { ExamSim } from "../sim";
import { materialPicker, titleOf } from "../picker";
import { WorksheetModal } from "../worksheet";
import { ContrastGame } from "../contrast";
import { confusablePairs } from "../analytics";
import { AudioReview } from "../audio";
import { Modal } from "obsidian";
import { Notice } from "obsidian";

const DAY_TIP = "Terlalu banyak kartu baru sekaligus membuat ulasan besok menumpuk. Bagi kebanyakan orang, 20–30 kartu baru per hari adalah takaran yang nyaman.";

export function scopeSelect(hub: HubView, parent: HTMLElement, value: string, onChange: (v: string) => void) {
	const p = hub.plugin;
	const sel = parent.createEl("select", { cls: "dropdown fch-select" });
	sel.createEl("option", { text: "Semua materi", attr: { value: "all" } });
	const paths = p.sortedPaths();
	const folders = [...new Set(paths.map(folderOf).filter(Boolean))];
	if (folders.length) {
		const g = sel.createEl("optgroup", { attr: { label: "Folder" } });
		folders.forEach((f) => g.createEl("option", { text: `📁 ${f}`, attr: { value: `folder:${f}` } }));
	}
	const g2 = sel.createEl("optgroup", { attr: { label: "Materi" } });
	paths.forEach((x) => g2.createEl("option", { text: x.replace(/\.md$/, ""), attr: { value: `file:${x}` } }));
	sel.value = value;
	if (sel.value !== value) sel.value = "all";
	sel.onchange = () => onChange(sel.value);
	return sel;
}

const MODES: { mode: StudyMode; icon: string; title: string; desc: string }[] = [
	{ mode: "classic", icon: "layers", title: "Klasik", desc: "Ingat jawabannya, buka kartu, lalu nilai seberapa mudah kamu mengingatnya." },
	{ mode: "type", icon: "keyboard", title: "Ketik jawaban", desc: "Tulis jawaban dulu. Kemiripannya dihitung dan nilai disarankan otomatis." },
	{ mode: "quiz", icon: "list-checks", title: "Kuis pilihan ganda", desc: "Pilihan jawaban dibuat otomatis dari kartu lain. Cepat dan seru." },
	{ mode: "draw", icon: "pencil", title: "Tulis tangan", desc: "Tulis/gambar jawaban dengan mouse, jari, atau stylus, lalu bandingkan." },
	{ mode: "explain", icon: "message-circle", title: "Jelaskan (Feynman)", desc: "Jelaskan konsep dengan kata-katamu sendiri; kata kunci yang terlewat disorot." },
];

export const scopeTitle = (scope: string) => (scope === "all" ? "Semua materi" : basename(scope.replace(/^(file|folder):/, "")));

export function renderStudyLauncher(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const L = hub.launch;
	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "Belajar" });
	head.createDiv({ cls: "fch-muted", text: "Atur sesi sesukamu: materi, cara belajar, dan jenis ulasan." });

	if (!p.index.size) {
		el.createDiv({ cls: "fch-empty", text: "Belum ada kartu. Buat dulu di halaman Buat kartu." });
		btn(el, { text: "Buat kartu", icon: "plus", cls: "fch-btn-primary", onClick: () => hub.navigate("create") });
		return;
	}

	const form = el.createDiv("fch-panel fch-launch");
	const r1 = form.createDiv("fch-field");
	r1.createEl("label", { text: "Materi" });
	scopeSelect(hub, r1, L.scope, (v) => { L.scope = v; update(); });

	const r2 = form.createDiv("fch-field");
	r2.createEl("label", { text: "Cara belajar" });
	const modes = r2.createDiv("fch-modes");
	const drawModes = () => {
		modes.empty();
		for (const m of MODES) {
			const b = modes.createEl("button", { cls: "fch-mode" + (L.mode === m.mode ? " is-active" : "") });
			setIcon(b.createSpan("fch-mode-ic"), m.icon);
			b.createDiv({ cls: "fch-mode-title", text: m.title });
			b.createDiv({ cls: "fch-muted fch-small", text: m.desc });
			b.onclick = () => { L.mode = m.mode; drawModes(); };
		}
	};
	drawModes();

	const r3 = form.createDiv("fch-field fch-toggles");
	const toggle = (label: string, desc: string, get: () => boolean, set: (v: boolean) => void) => {
		const t = r3.createEl("label", { cls: "fch-toggle" });
		const cb = t.createEl("input", { type: "checkbox" });
		cb.checked = get();
		cb.onchange = () => { set(cb.checked); update(); };
		const tx = t.createDiv();
		tx.createDiv({ cls: "fch-strong", text: label });
		tx.createDiv({ cls: "fch-muted fch-small", text: desc });
	};
	toggle("Cram", "Ulas semua kartu, termasuk yang belum jatuh tempo. Jadwal tidak berubah.", () => L.cram, (v) => (L.cram = v));
	toggle("Hanya kartu bertanda ⭐", "Fokus ke kartu yang kamu tandai saat belajar.", () => L.starred, (v) => (L.starred = v));
	toggle("Selang-seling materi (interleaved)", "Kartu dari materi berbeda diambil bergantian. Melatih otak membedakan konsep yang mirip.", () => !!L.interleave, (v) => (L.interleave = v));

	const quota = form.createDiv("fch-quota");
	const drawQuota = () => {
		quota.empty();
		const t = p.today();
		const lim = p.newLimitToday();
		quota.createSpan({ cls: "fch-small", text: `Kartu baru hari ini: ${Math.min(t.newCards, lim)} / ${lim}` });
		const bar = quota.createDiv("fch-bar fch-bar-thin fch-grow");
		bar.createDiv("fch-bar-fill").style.width = `${Math.min(1, t.newCards / Math.max(1, lim)) * 100}%`;
		btn(quota, { text: "+10 hari ini", cls: "fch-btn-sm", label: "Tambah jatah kartu baru khusus hari ini", onClick: () => { p.extendToday("new", 10); drawQuota(); update(); } });
	};
	drawQuota();

	const foot = form.createDiv("fch-launch-foot");
	const info = foot.createDiv("fch-launch-info");
	const go = btn(foot, { text: "Mulai", icon: "play", cls: "fch-btn-primary fch-btn-lg" });
	const update = () => {
		const cards = hub.cardsForScope(L.scope, L.starred);
		const n = p.buildQueue(cards, L.cram, { order: L.interleave ? "interleave" : undefined }).length;
		info.empty();
		info.createSpan({ cls: "fch-launch-n", text: String(n) });
		info.createSpan({ cls: "fch-muted", text: n ? ` kartu siap · ±${Math.max(1, Math.round((n * p.avgSecondsPerCard()) / 60))} menit` : " kartu siap. Nyalakan Cram untuk latihan bebas." });
		go.disabled = !n;
	};
	go.onclick = () => {
		const title = L.scope === "all" ? "Semua materi" : basename(L.scope.replace(/^(file|folder):/, ""));
		hub.startSession(hub.cardsForScope(L.scope, L.starred), { title, cram: L.cram, mode: L.mode, interleave: L.interleave });
	};
	update();

	const extra = el.createDiv("fch-quick");
	const xq = (ic: string, t: string, d: string, fn: () => void) => {
		const b = extra.createEl("button", { cls: "fch-quick-it" });
		b.createDiv({ cls: "fch-quick-ic", text: ic });
		b.createDiv({ cls: "fch-strong fch-small", text: t });
		b.createDiv({ cls: "fch-muted fch-small", text: d });
		b.onclick = fn;
	};
	xq("🎲", "Ulasan acak", "20 kartu acak dari materi terpilih", () => {
		const pool = hub.cardsForScope(L.scope).filter((c) => (p.data.cards[c.id]?.history.length ?? 0) > 0);
		hub.startSession(shuffle(pool).slice(0, 20), { title: "Ulasan acak", cram: true, mode: L.mode });
	});
	xq("🧪", "Tes retensi jangka panjang", "Kartu lama yang sudah lama tidak diulas", () => startRetentionTest(hub, L.scope));
	xq("🎯", "Latih kelemahan", "Kartu yang paling sering salah", () => hub.navigate("weak"));
	xq("⏱️", "Aku punya X menit", "Sesi paling efisien sesuai waktumu", () => openQuick(hub, hub.cardsForScope(L.scope)));
	xq("⚖️", "Bedakan yang mirip", "Kartu yang sering tertukar", () => startContrast(hub));
	xq("🖨️", "Lembar latihan", "Soal cetak + kunci jawaban (PDF)", () => new WorksheetModal(hub.app, p, L.scope.startsWith("file:") ? [L.scope.slice(5)] : []).open());
	xq("📝", "Simulasi ujian", "Soal campuran, waktu terbatas", () => openSim(hub, hub.cardsForScope(L.scope), scopeTitle(L.scope)));
	xq("🔗", "Rantai hafalan", "Hafalkan teks panjang kata per kata", () => hub.openChain());
	xq("🎧", "Mode dengar", "Kartu dibacakan, tanpa layar", () => { if (!hub.startGame(new AudioReview(hub, hub.cardsForScope(L.scope), scopeTitle(L.scope)))) new Notice("Tidak ada kartu atau suara tidak didukung."); });
	xq("🏛️", "Istana ingatan", "Teknik juara lomba menghafal", () => hub.navigate("palace"));

	const keys = el.createDiv("fch-panel fch-keys");
	keys.createEl("h3", { text: "Pintasan keyboard" });
	const tbl = keys.createDiv("fch-keys-grid");
	const k = (key: string, what: string) => {
		tbl.createSpan({ cls: "fch-kbd", text: key });
		tbl.createSpan({ text: what });
	};
	k("Spasi", "Buka jawaban / ungkap item List / nilai Baik");
	k("1 2 3 4", "Lagi · Sulit · Baik · Mudah — atau pilih jawaban kuis");
	k("Enter", "Periksa / lanjut");
	k("H", "Petunjuk huruf awal / hapus satu pilihan salah");
	k("P", "Tandai untuk diperbaiki nanti 🚩");
	k("M", "Tulis mnemonik (setelah jawaban dibuka)");
	k("Z", "Mode fokus");
	k("F", "Tandai kartu ⭐");
	k("U", "Batalkan nilai terakhir");
	k("S", "Bacakan kartu");
	k("E", "Edit kartu di catatan");
}

/** Ditampilkan saat tidak ada kartu di antrean: jelaskan alasannya & beri jalan keluar. */
export function renderLimit(hub: HubView, el: HTMLElement, cards: Card[], opts: SessionOpts) {
	const p = hub.plugin;
	const s = p.data.settings;
	const info = p.limitInfo(cards);
	const today = p.today();
	const restart = () => hub.startSession(cards, opts);
	const box = el.createDiv("fch-limit");

	if (info.newBlocked || info.revBlocked) {
		const isNew = info.newBlocked > 0;
		const n = isNew ? info.newBlocked : info.revBlocked;
		const kind = isNew ? "new" : "rev";
		box.createDiv({ cls: "fch-limit-ic", text: "🎯" });
		box.createEl("h2", { text: isNew ? "Batas kartu baru hari ini tercapai" : "Batas ulasan hari ini tercapai" });
		box.createEl("p", {
			cls: "fch-muted",
			text: isNew
				? `Kamu sudah mempelajari ${today.newCards} kartu baru hari ini (batas harian ${p.newLimitToday()}). Masih ada ${n} kartu baru di “${opts.title}”.`
				: `Kamu sudah mengulas ${today.reviews - today.newCards} kartu hari ini (batas harian ${s.maxReviewsPerDay}). Masih ada ${n} kartu yang jatuh tempo di “${opts.title}”.`,
		});
		const saved = box.createDiv("fch-limit-saved");
		saved.createSpan({ text: "✓" });
		saved.createSpan({ text: "Progresmu tersimpan otomatis. Kartu yang sudah dipelajari akan muncul lagi sesuai jadwal ingatannya." });

		const r = box.createDiv("fch-row fch-center");
		btn(r, { text: "+10 kartu", onClick: () => { p.extendToday(kind, 10); restart(); } });
		btn(r, { text: "+25 kartu", onClick: () => { p.extendToday(kind, 25); restart(); } });
		btn(r, { text: `Lanjutkan semua (${n})`, icon: "play", cls: "fch-btn-primary fch-btn-lg", onClick: () => { p.extendToday(kind, n); restart(); } });
		box.createDiv({ cls: "fch-muted fch-small", text: "Tambahan ini hanya berlaku hari ini dan tidak mengubah pengaturan." });

		const perm = box.createDiv("fch-limit-perm");
		perm.createSpan({ cls: "fch-small", text: isNew ? "Ubah batas kartu baru per hari:" : "Ubah batas ulasan per hari:" });
		const inp = perm.createEl("input", { type: "number", cls: "fch-input fch-num", attr: { min: "1" } });
		inp.value = String(isNew ? s.newPerDay : s.maxReviewsPerDay);
		btn(perm, {
			text: "Simpan", cls: "fch-btn-sm",
			onClick: async () => {
				const v = parseInt(inp.value, 10);
				if (!(v > 0)) return;
				if (isNew) s.newPerDay = v;
				else s.maxReviewsPerDay = v;
				await p.saveNow();
				restart();
			},
		});
		if (isNew) box.createDiv({ cls: "fch-tipline", text: "💡 " + DAY_TIP });
	} else {
		const next = p.forecast(2)[1] ?? 0;
		box.createDiv({ cls: "fch-limit-ic", text: "🎉" });
		box.createEl("h2", { text: "Semua kartu di sini sudah beres hari ini" });
		box.createEl("p", { cls: "fch-muted", text: `Tidak ada kartu baru maupun kartu jatuh tempo di “${opts.title}”. Progresmu tersimpan. ${next ? `Besok ada ${next} kartu yang perlu diulas.` : ""}` });
	}

	const r2 = box.createDiv("fch-row fch-center");
	btn(r2, { text: "Ulangi semua (Cram)", icon: "zap", onClick: () => hub.startSession(cards, { ...opts, cram: true }) });
	btn(r2, { text: "Kuis", icon: "list-checks", onClick: () => hub.startSession(cards, { ...opts, cram: true, mode: "quiz" }) });
	btn(r2, { text: "Kembali", cls: "fch-btn-ghost", onClick: () => { hub.limit = null; hub.navigate("home"); } });
}

/** Tes retensi: kartu matang yang paling lama tidak diulas, tanpa mengubah jadwal. */
export function startRetentionTest(hub: HubView, scope = "all") {
	const p = hub.plugin;
	const now = Date.now();
	const pool = hub.cardsForScope(scope).filter((c) => {
		const st = p.data.cards[c.id];
		return st && !st.suspended && st.history.length && st.interval >= 7 && c.type !== "mcq";
	});
	if (pool.length < 3) return void new Notice("Belum cukup kartu lama (interval ≥ 7 hari) untuk tes retensi. Terus belajar ya!");
	const since = (id: string) => now - (p.data.cards[id].history[p.data.cards[id].history.length - 1]?.t ?? now);
	const pick = shuffle(pool.sort((a, b) => since(b.id) - since(a.id)).slice(0, 40)).slice(0, 20);
	hub.startSession(pick, { title: "Tes retensi jangka panjang", cram: true, mode: "classic", test: true });
}

/** Atur simulasi ujian: pilih materi, jumlah soal & waktu, lalu mulai. */
export function openSim(hub: HubView, cards: Card[], title: string, examDate?: string) {
	const p = hub.plugin;
	const m = new Modal(hub.app);
	m.modalEl.addClass("fch-modal");
	const el = m.contentEl;
	el.createDiv({ cls: "fch-modal-title", text: "📝 Simulasi ujian" });
	el.createDiv({ cls: "fch-muted fch-small", text: "Soal pilihan ganda campuran, tanpa petunjuk dan tanpa umpan balik sampai diserahkan. Jadwal kartu tidak berubah." });
	const sel = new Set(cards.map((c) => c.path));
	el.createDiv({ cls: "fch-strong fch-small fch-mt", text: "Materi yang diujikan" });
	const info = el.createDiv({ cls: "fch-muted fch-small" });
	materialPicker(p, el, sel, () => {
		const n = [...sel].reduce((a, x) => a + (p.index.get(x)?.length ?? 0), 0);
		info.setText(n < 5 ? "Pilih materi dengan total minimal 5 kartu." : "");
	});
	let n = 20, min = 20;
	const opt = (label: string, vals: number[], cur: () => number, set: (v: number) => void, fmt: (v: number) => string) => {
		const r = el.createDiv("fch-row fch-mt");
		r.createSpan({ cls: "fch-small fch-strong", text: label });
		const seg = r.createDiv("fch-seg");
		const draw = () => { seg.empty(); for (const v of vals) { const b = seg.createEl("button", { cls: "fch-seg-btn" + (cur() === v ? " is-active" : ""), text: fmt(v) }); b.onclick = () => { set(v); draw(); drawT(); }; } };
		draw();
		return draw;
	};
	opt("Jumlah soal", [10, 20, 40, 60], () => n, (v) => { n = v; min = Math.max(5, v); }, (v) => String(v));
	const drawT = opt("Waktu", [10, 20, 30, 45, 60, 90], () => min, (v) => (min = v), (v) => `${v} mnt`);
	const foot = el.createDiv("fch-modal-foot fch-mt");
	foot.createDiv("fch-grow");
	btn(foot, { text: "Batal", cls: "fch-btn-ghost", onClick: () => m.close() });
	btn(foot, { text: "Mulai ujian", icon: "play", cls: "fch-btn-primary", onClick: () => {
		if (!sel.size) return void new Notice("Pilih minimal satu materi.");
		const chosen = [...sel].flatMap((x) => p.index.get(x) ?? []);
		const sim = new ExamSim(hub, chosen, sel.size === cards.map((c) => c.path).filter((v, i, a) => a.indexOf(v) === i).length ? title : titleOf(sel, p.sortedPaths().length), n, min, examDate);
		m.close();
		if (!hub.startGame(sim)) new Notice("Butuh minimal 5 kartu yang bisa dijadikan soal pilihan ganda.");
	} });
	m.open();
}

/** Pilih waktu yang tersedia, lalu mulai sesi paling efisien. */
export function openQuick(hub: HubView, cards?: Card[]) {
	const p = hub.plugin;
	const m = new Modal(hub.app);
	m.modalEl.addClass("fch-modal");
	const el = m.contentEl;
	el.createDiv({ cls: "fch-modal-title", text: "⏱️ Aku punya…" });
	el.createDiv({ cls: "fch-muted fch-small", text: "Kartu yang paling berisiko terlupa didahulukan, lalu kartu baru. Sesi berhenti otomatis saat waktu habis, dan jadwal kartu tetap diperbarui." });
	const grid = el.createDiv("fch-quick fch-mt");
	for (const min of [5, 10, 15, 20, 30]) {
		const n = p.quickQueue(min, cards).length;
		const b = grid.createEl("button", { cls: "fch-quick-it" });
		b.createDiv({ cls: "fch-quick-ic", text: min <= 5 ? "⚡" : min <= 15 ? "⏱️" : "🧠" });
		b.createDiv({ cls: "fch-strong", text: `${min} menit` });
		b.createDiv({ cls: "fch-muted fch-small", text: `±${n} kartu` });
		b.onclick = () => {
			m.close();
			const q = p.quickQueue(min, cards);
			if (!q.length) return void new Notice("Belum ada kartu.");
			p.data.meta.quickSessions = (p.data.meta.quickSessions ?? 0) + 1;
			hub.startSession(q, { title: `Sesi ${min} menit`, cram: false, mode: p.data.settings.defaultMode, timeLimit: min * 60_000, exact: true });
		};
	}
	m.open();
}

export function startContrast(hub: HubView) {
	const pairs = confusablePairs(hub.plugin);
	if (!pairs.length) return void new Notice("Belum ada pasangan kartu yang mirip atau sering tertukar. Main kuis atau Cocokkan dulu ya!");
	hub.startGame(new ContrastGame(hub, pairs));
}
