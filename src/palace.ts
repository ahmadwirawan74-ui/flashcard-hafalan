import { Component, Notice } from "obsidian";
import type { HubView } from "./hub-view";
import { Game } from "./match";
import { Card, Palace } from "./types";
import { cardFront, fitImage, imageSrc, renderImagePicker } from "./occlusion";
import { basename, btn, confetti, md, plainText } from "./util";
import { play } from "./sound";

// ---------------------------------------------------------------- denah bawaan (SVG)
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const room = (x: number, y: number, w: number, h: number, label: string, fill: string, icon: string) =>
	`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="#94a3b8" stroke-width="3"/>` +
	`<text x="${x + w / 2}" y="${y + h / 2 - 6}" font-size="34" text-anchor="middle">${icon}</text>` +
	`<text x="${x + w / 2}" y="${y + h / 2 + 26}" font-family="sans-serif" font-size="17" font-weight="700" fill="#475569" text-anchor="middle">${esc(label)}</text>`;
const svgUri = (inner: string) => "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560"><rect width="900" height="560" fill="#f8fafc"/>${inner}</svg>`);

export const PRESETS: { id: string; name: string; image: string; loci: [number, number, string][] }[] = [
	{
		id: "rumah", name: "🏠 Rumah",
		image: svgUri(room(20, 20, 260, 240, "Teras & pintu", "#fef3c7", "🚪") + room(300, 20, 320, 240, "Ruang tamu", "#e0f2fe", "🛋️") + room(640, 20, 240, 240, "Dapur", "#dcfce7", "🍳") +
			room(20, 280, 260, 260, "Kamar mandi", "#ede9fe", "🛁") + room(300, 280, 320, 260, "Kamar tidur", "#fce7f3", "🛏️") + room(640, 280, 240, 260, "Taman", "#d1fae5", "🌳")),
		loci: [[0.16, 0.25, "Pintu depan"], [0.5, 0.25, "Sofa"], [0.84, 0.25, "Kompor"], [0.84, 0.73, "Pohon"], [0.5, 0.73, "Kasur"], [0.16, 0.73, "Bak mandi"]],
	},
	{
		id: "kelas", name: "🏫 Kelas",
		image: svgUri(room(20, 20, 860, 120, "Papan tulis", "#dcfce7", "🧑‍🏫") + room(20, 160, 200, 380, "Jendela", "#e0f2fe", "🪟") + room(240, 160, 200, 180, "Meja depan", "#fef3c7", "📚") +
			room(460, 160, 200, 180, "Meja tengah", "#fef3c7", "✏️") + room(680, 160, 200, 380, "Pintu & rak", "#fce7f3", "🚪") + room(240, 360, 420, 180, "Meja belakang", "#ede9fe", "🎒")),
		loci: [[0.5, 0.14, "Papan tulis"], [0.37, 0.45, "Meja depan"], [0.62, 0.45, "Meja tengah"], [0.87, 0.6, "Pintu"], [0.5, 0.8, "Meja belakang"], [0.13, 0.6, "Jendela"]],
	},
];

const uid = () => Math.random().toString(36).slice(2, 9);

// ---------------------------------------------------------------- halaman
let editing: Palace | null = null;
let pickingImage = false;
let fillPath = "";

export function renderPalaces(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	if (editing) return renderEditor(hub, el, editing);
	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "🏛️ Istana Ingatan" });
	head.createDiv({ cls: "fch-muted", text: "Teknik para juara lomba menghafal: taruh setiap fakta di tempat yang kamu kenal, lalu \"berjalan\" menyusuri tempat itu untuk mengingatnya. Bayangkan fakta itu benar-benar ada di sana, semakin aneh semakin melekat." });

	if (pickingImage) {
		const box = el.createDiv("fch-panel");
		const r = box.createDiv("fch-section-head");
		r.createEl("h3", { text: "Pilih denah atau foto tempat" });
		btn(r, { text: "Batal", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { pickingImage = false; hub.renderPage(); } });
		const pre = box.createDiv("fch-palace-presets");
		for (const ps of PRESETS) {
			const b = pre.createEl("button", { cls: "fch-thumb" });
			b.createEl("img", { attr: { src: ps.image, alt: "" } });
			b.createDiv({ cls: "fch-thumb-name", text: ps.name });
			b.onclick = () => {
				editing = { id: "p" + Date.now().toString(36), name: ps.name.replace(/^\S+\s/, ""), image: ps.image, created: Date.now(), loci: ps.loci.map(([x, y, label]) => ({ id: uid(), x, y, label, cardId: "" })) };
				pickingImage = false;
				hub.renderPage();
			};
		}
		box.createDiv({ cls: "fch-muted fch-small fch-mt", text: "…atau pakai foto/denah tempatmu sendiri (rumah, sekolah, rute ke kampus):" });
		renderImagePicker(p, box.createDiv(), p.sortedPaths()[0] ?? "Istana.md", (img) => {
			editing = { id: "p" + Date.now().toString(36), name: basename(img).replace(/\.[^.]+$/, ""), image: img, created: Date.now(), loci: [] };
			pickingImage = false;
			hub.renderPage();
		});
		return;
	}

	const guideOpen = !p.data.palaces.length || !p.data.meta.palaceGuideHidden;
	const guide = el.createDiv("fch-pg" + (guideOpen ? "" : " is-closed"));
	const gh = guide.createDiv("fch-pg-head");
	gh.createSpan({ cls: "fch-strong", text: "📖 Cara memakai Istana Ingatan" });
	btn(gh, { text: guideOpen ? "Sembunyikan" : "Tampilkan", cls: "fch-btn-ghost fch-btn-sm", onClick: () => { p.data.meta.palaceGuideHidden = guideOpen; p.requestSave(); hub.renderPage(); } });
	if (guideOpen) {
		const steps = guide.createDiv("fch-pg-steps");
		[["🏠", "1. Pilih tempat", "Pakai denah Rumah/Kelas, atau foto tempat yang kamu hafal betul: kamarmu, rute ke sekolah, masjid dekat rumah."],
			["📍", "2. Tandai rute", "Klik titik-titik di gambar sesuai urutan kamu berjalan: pintu → rak sepatu → sofa → meja… Urutan = jalur ingatan."],
			["🃏", "3. Taruh kartu", "Isi setiap titik dengan satu kartu (atau “Isi otomatis” dari materi). Satu titik, satu fakta."],
			["🎨", "4. Buat bayangan", "Tulis bayangan yang aneh, lucu, atau berlebihan: “mitokondria raksasa menyala seperti lampu di pintu”. Semakin aneh, semakin lengket!"],
			["🚶", "5. Jelajahi", "Berjalanlah di istana: lihat tempatnya, ingat isinya. Ulangi besok, 3 hari lagi, lalu seminggu lagi."]].forEach(([i, t, d]) => {
			const s = steps.createDiv("fch-pg-step");
			s.createDiv({ cls: "fch-pg-ic", text: i });
			s.createDiv({ cls: "fch-strong fch-small", text: t });
			s.createDiv({ cls: "fch-muted fch-small", text: d });
		});
		guide.createDiv({ cls: "fch-small fch-pg-tip", text: "💡 Tips: libatkan indra (bau, suara, warna), buat benda bergerak atau meledak, dan kaitkan dengan bentuk kata. Cocok untuk urutan (tahapan proses, daftar raja, urutan surah) dan daftar panjang." });
	}
	btn(el, { text: "Bangun istana baru", icon: "plus", cls: "fch-btn-primary fch-btn-lg", onClick: () => { pickingImage = true; hub.renderPage(); } });
	if (!p.data.palaces.length) {
		el.createDiv({ cls: "fch-empty fch-mt", text: "Belum ada istana. Mulai dari denah Rumah atau Kelas, atau pakai foto tempat yang kamu kenal baik." });
		return;
	}
	const grid = el.createDiv("fch-palaces");
	for (const pl of p.data.palaces) {
		const c = grid.createDiv("fch-palace");
		c.createEl("img", { attr: { src: pl.image.startsWith("data:") ? pl.image : imageSrc(p.app, pl.image), alt: "" } });
		c.createDiv({ cls: "fch-strong", text: pl.name });
		const filled = pl.loci.filter((l) => l.cardId).length;
		const stories = pl.loci.filter((l) => l.story?.trim()).length;
		c.createDiv({ cls: "fch-muted fch-small", text: `${pl.loci.length} titik · ${filled} berisi kartu · ${stories} bayangan` });
		const days = pl.lastWalk ? Math.floor((Date.now() - pl.lastWalk) / 86400000) : -1;
		const st = c.createDiv("fch-palace-stat");
		if (pl.lastScore !== undefined) {
			const pct = Math.round(pl.lastScore * 100);
			const bar = st.createDiv("fch-bar fch-bar-thin fch-grow");
			bar.createDiv("fch-bar-fill").style.width = `${pct}%`;
			st.createSpan({ cls: "fch-small fch-strong", text: `${pct}%` });
		}
		const gap = (pl.walks ?? 0) <= 1 ? 1 : (pl.walks ?? 0) <= 2 ? 3 : 7;
		c.createDiv({ cls: "fch-small " + (days >= gap ? "fch-palace-due" : "fch-muted"), text: days < 0 ? "Belum pernah dijelajahi" : days >= gap ? `🔔 Saatnya dijelajahi lagi (terakhir ${days} hari lalu)` : `Terakhir dijelajahi ${days === 0 ? "hari ini" : days + " hari lalu"} · ${pl.walks ?? 0}×` });
		if (filled < 2) c.createDiv({ cls: "fch-small fch-palace-due", text: "⚠️ Isi minimal 2 titik dengan kartu lewat tombol Edit." });
		const r = c.createDiv("fch-row");
		btn(r, { text: "Jelajahi", icon: "footprints", cls: "fch-btn-primary fch-btn-sm", onClick: () => { if (!hub.startGame(new PalaceWalk(hub, pl))) new Notice("Isi minimal 2 titik dengan kartu dulu."); } });
		btn(r, { icon: "pencil", cls: "fch-btn-ghost fch-btn-sm", label: "Edit", onClick: () => { editing = JSON.parse(JSON.stringify(pl)); hub.renderPage(); } });
	}
}

function renderEditor(hub: HubView, el: HTMLElement, pl: Palace) {
	const p = hub.plugin;
	const all = p.allCards().filter((c) => c.type !== "occlusion");
	const byId = new Map(all.map((c) => [c.id, c]));
	let sel = "";
	const head = el.createDiv("fch-pagehead fch-pagehead-row");
	const name = head.createEl("input", { type: "text", cls: "fch-input fch-palace-name" });
	name.value = pl.name;
	name.oninput = () => (pl.name = name.value);
	const hr = head.createDiv("fch-row");
	btn(hr, { text: "Batal", cls: "fch-btn-ghost", onClick: () => { editing = null; hub.renderPage(); } });
	btn(hr, { text: "Simpan istana", icon: "check", cls: "fch-btn-primary", onClick: () => {
		const list = p.data.palaces.filter((x) => x.id !== pl.id);
		list.unshift({ ...pl, name: pl.name.trim() || "Istana" });
		p.data.palaces = list;
		p.requestSave();
		editing = null;
		new Notice("🏛️ Istana disimpan");
		hub.renderPage();
	} });
	if (p.data.palaces.some((x) => x.id === pl.id))
		btn(hr, { icon: "trash-2", cls: "fch-btn-ghost fch-danger", label: "Hapus istana", onClick: () => { p.data.palaces = p.data.palaces.filter((x) => x.id !== pl.id); p.requestSave(); editing = null; hub.renderPage(); } });

	const body = el.createDiv("fch-ioe-body");
	const canvas = body.createDiv("fch-ioe-canvas");
	const box = canvas.createDiv("fch-io fch-palace-map is-edit");
	const img = box.createEl("img", { attr: { src: pl.image.startsWith("data:") ? pl.image : imageSrc(p.app, pl.image), draggable: "false", alt: "" } });
	fitImage(img, canvas, window.innerHeight * 0.6);
	const svgLayer = box.createDiv("fch-palace-path");
	const side = body.createDiv("fch-ioe-side");
	const fill = side.createDiv("fch-row");
	const fsel = fill.createEl("select", { cls: "dropdown fch-select fch-grow" });
	fsel.createEl("option", { text: "Isi otomatis dari materi…", attr: { value: "" } });
	p.sortedPaths().forEach((x) => fsel.createEl("option", { text: basename(x), attr: { value: x } }));
	fsel.value = fillPath;
	btn(fill, { text: "Isi", cls: "fch-btn-sm", onClick: () => {
		fillPath = fsel.value;
		if (!fillPath) return;
		const used = new Set(pl.loci.map((l) => l.cardId));
		const free = (p.index.get(fillPath) ?? []).filter((c) => !used.has(c.id) && c.type !== "occlusion");
		for (const l of pl.loci) if (!l.cardId && free.length) l.cardId = free.shift()!.id;
		draw();
	} });
	const steps = side.createDiv("fch-pg-mini");
	steps.createDiv({ text: "① Klik gambar untuk menambah titik (urutan = rute)" });
	steps.createDiv({ text: "② Pilih kartu untuk tiap titik, atau Isi otomatis" });
	steps.createDiv({ text: "③ Tulis bayangan yang aneh & hidup di tiap titik" });
	const list = side.createDiv("fch-ioe-list");

	box.addEventListener("click", (e) => {
		if ((e.target as HTMLElement).closest(".fch-pin")) return;
		const r = box.getBoundingClientRect();
		const l = { id: uid(), x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, label: `Titik ${pl.loci.length + 1}`, cardId: "" };
		pl.loci.push(l);
		sel = l.id;
		draw();
	});

	const draw = () => {
		box.querySelectorAll(".fch-pin").forEach((x) => x.remove());
		svgLayer.empty();
		drawPath(svgLayer, pl, -1);
		pl.loci.forEach((l, k) => {
			const pin = box.createDiv({ cls: "fch-pin" + (l.id === sel ? " is-sel" : "") + (l.cardId ? " has-card" : "") });
			Object.assign(pin.style, { left: `${l.x * 100}%`, top: `${l.y * 100}%` });
			pin.setText(String(k + 1));
			pin.onclick = () => { sel = l.id; draw(); };
		});
		list.empty();
		pl.loci.forEach((l, k) => {
			const r = list.createDiv("fch-palace-item" + (l.id === sel ? " is-sel" : ""));
			const top = r.createDiv("fch-row");
			top.createSpan({ cls: "fch-io-chip", text: String(k + 1) });
			const li = top.createEl("input", { type: "text", cls: "fch-input fch-grow", attr: { placeholder: "Nama tempat" } });
			li.value = l.label;
			li.oninput = () => (l.label = li.value);
			li.onfocus = () => { if (sel !== l.id) { sel = l.id; box.querySelectorAll(".fch-pin").forEach((x, i) => x.toggleClass("is-sel", pl.loci[i].id === sel)); } };
			btn(top, { icon: "x", cls: "fch-btn-ghost fch-btn-sm", label: "Hapus titik", onClick: () => { pl.loci = pl.loci.filter((x) => x.id !== l.id); draw(); } });
			const cs = r.createEl("select", { cls: "dropdown fch-select" });
			cs.createEl("option", { text: "— pilih kartu —", attr: { value: "" } });
			const cur = byId.get(l.cardId);
			const pool = (fillPath ? p.index.get(fillPath) ?? [] : all).slice(0, 300);
			if (cur && !pool.includes(cur)) cs.createEl("option", { text: plainText(cur.front).slice(0, 60), attr: { value: cur.id } });
			for (const c of pool) cs.createEl("option", { text: plainText(c.front).slice(0, 60), attr: { value: c.id } });
			cs.value = l.cardId;
			cs.onchange = () => { l.cardId = cs.value; draw(); };
			const st = r.createEl("textarea", { cls: "fch-input fch-palace-story", attr: { rows: "2", placeholder: "🎨 Bayangan: mis. “mitokondria raksasa menyala seperti lampu di atas pintu”" } });
			st.value = l.story ?? "";
			st.oninput = () => (l.story = st.value);
		});
	};
	draw();
}

function drawPath(layer: HTMLElement, pl: Palace, upto: number) {
	const NS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("viewBox", "0 0 100 100");
	svg.setAttribute("preserveAspectRatio", "none");
	for (let k = 1; k < pl.loci.length; k++) {
		const a = pl.loci[k - 1], b = pl.loci[k];
		const line = document.createElementNS(NS, "line");
		line.setAttribute("x1", String(a.x * 100)); line.setAttribute("y1", String(a.y * 100));
		line.setAttribute("x2", String(b.x * 100)); line.setAttribute("y2", String(b.y * 100));
		line.setAttribute("class", upto >= 0 && k <= upto ? "is-walked" : "");
		line.setAttribute("vector-effect", "non-scaling-stroke");
		svg.appendChild(line);
	}
	layer.appendChild(svg);
}

// ---------------------------------------------------------------- berjalan
export class PalaceWalk implements Game {
	ok: boolean;
	private stops: { label: string; card: Card; x: number; y: number; story: string }[] = [];
	private k = 0;
	private revealed = false;
	private ask = true;
	private hideStory = true;
	private results: boolean[] = [];
	private el: HTMLElement | null = null;
	private comp: Component | null = null;
	private keyH = (e: KeyboardEvent) => this.onKey(e);

	constructor(private hub: HubView, private pl: Palace) {
		const byId = new Map(hub.plugin.allCards().map((c) => [c.id, c]));
		for (const l of pl.loci) { const c = byId.get(l.cardId); if (c) this.stops.push({ label: l.label, card: c, x: l.x, y: l.y, story: l.story ?? "" }); }
		this.ok = this.stops.length >= 2;
	}

	mount(el: HTMLElement) { this.el = el; document.addEventListener("keydown", this.keyH, true); this.draw(); }
	unmount() { document.removeEventListener("keydown", this.keyH, true); this.comp?.unload(); this.el = null; }

	private onKey(e: KeyboardEvent) {
		if (!this.el || e.ctrlKey || e.metaKey) return;
		if (this.k >= this.stops.length) { if (e.key === "Enter") this.hub.endGame(); return; }
		if (!this.revealed && (e.key === " " || e.key === "Enter")) { e.preventDefault(); this.revealed = true; this.draw(); }
		else if (this.revealed && (e.key === "1" || e.key === "2" || e.key === " ")) { e.preventDefault(); this.rate(e.key !== "1"); }
	}

	private rate(ok: boolean) {
		play(ok ? "correct" : "wrong");
		this.results.push(ok);
		this.k++;
		this.revealed = false;
		this.hideStory = true;
		if (this.k >= this.stops.length) {
			const p = this.hub.plugin;
			p.data.meta.palaceWalks = (p.data.meta.palaceWalks ?? 0) + 1;
			const real = p.data.palaces.find((x) => x.id === this.pl.id);
			if (real) { real.lastWalk = Date.now(); real.lastScore = this.results.filter(Boolean).length / this.stops.length; real.walks = (real.walks ?? 0) + 1; }
			p.requestSave();
			p.track("palace");
			p.addCoins(this.results.filter(Boolean).length * 2);
			p.checkAchievements();
		}
		this.draw();
	}

	private draw() {
		const root = this.el;
		if (!root) return;
		this.comp?.unload();
		this.comp = new Component();
		this.comp.load();
		root.empty();
		const wrap = root.createDiv("fch-palace-walk");
		const top = wrap.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Keluar", onClick: () => this.hub.endGame() });
		const tt = top.createDiv("fch-study-title");
		tt.createDiv({ cls: "fch-study-name", text: `🏛️ ${this.pl.name}` });
		tt.createDiv({ cls: "fch-muted fch-small", text: `Perhentian ${Math.min(this.k + 1, this.stops.length)} dari ${this.stops.length}` });
		const meta = top.createDiv("fch-study-meta");
		const t = meta.createEl("label", { cls: "fch-small fch-row" });
		const cb = t.createEl("input", { type: "checkbox" });
		cb.checked = this.ask;
		cb.onchange = () => { this.ask = cb.checked; this.draw(); };
		t.createSpan({ text: "Tampilkan pertanyaan" });

		const done = this.k >= this.stops.length;
		const layout = wrap.createDiv("fch-palace-layout");
		const canvas = layout.createDiv("fch-ioe-canvas");
		const box = canvas.createDiv("fch-io fch-palace-map");
		const img = box.createEl("img", { attr: { src: this.pl.image.startsWith("data:") ? this.pl.image : imageSrc(this.hub.app, this.pl.image), draggable: "false", alt: "" } });
		fitImage(img, canvas, window.innerHeight * 0.55);
		drawPath(box.createDiv("fch-palace-path"), { ...this.pl, loci: this.stops.map((s, i) => ({ id: String(i), x: s.x, y: s.y, label: s.label, cardId: "" })) }, this.k);
		this.stops.forEach((s, i) => {
			const pin = box.createDiv({ cls: "fch-pin" + (i < this.k ? (this.results[i] ? " is-ok" : " is-bad") : i === this.k ? " is-now" : "") });
			Object.assign(pin.style, { left: `${s.x * 100}%`, top: `${s.y * 100}%` });
			pin.setText(i < this.k ? (this.results[i] ? "✓" : "✗") : String(i + 1));
		});

		const panel = layout.createDiv("fch-panel fch-palace-panel");
		if (done) {
			const ok = this.results.filter(Boolean).length;
			panel.createDiv({ cls: "fch-sum-emoji", text: ok === this.stops.length ? "🏆" : "🏛️" });
			panel.createEl("h2", { text: `${ok}/${this.stops.length} tempat diingat` });
			panel.createDiv({ cls: "fch-muted", text: `🪙 +${ok * 2} koin. Jelajahi lagi besok, lalu coba matikan “Tampilkan pertanyaan” agar ingatanmu bertumpu pada tempatnya.` });
			const miss = this.stops.filter((_, i) => !this.results[i]).map((s) => s.card);
			const r = panel.createDiv("fch-row fch-mt");
			if (miss.length) btn(r, { text: `Latih ${miss.length} yang terlupa`, icon: "zap", cls: "fch-btn-primary", onClick: () => this.hub.startSession(miss, { title: this.pl.name, cram: true, mode: "classic" }) });
			btn(r, { text: "Jelajahi lagi", icon: "rotate-ccw", onClick: () => { this.k = 0; this.results = []; this.draw(); } });
			btn(r, { text: "Selesai", onClick: () => this.hub.endGame() });
			if (ok === this.stops.length && this.hub.plugin.data.settings.confetti) confetti(root);
			return;
		}
		const s = this.stops[this.k];
		panel.createDiv({ cls: "fch-palace-loc", text: `📍 ${s.label}` });
		if (s.story.trim()) {
			const sh = panel.createDiv("fch-palace-hint");
			if (this.revealed || !this.hideStory) sh.setText(`🎨 ${s.story}`);
			else { sh.setText("🎨 Ingat bayanganmu di tempat ini… (ketuk untuk melihat)"); sh.addClass("is-hidden-story"); sh.onclick = () => { this.hideStory = false; this.draw(); }; }
		}
		panel.createDiv({ cls: "fch-muted fch-small", text: this.ask ? "Apa yang kamu simpan di sini?" : "Tanpa pertanyaan: ingat fakta apa yang ada di tempat ini." });
		if (this.ask || this.revealed) cardFront(this.hub.plugin, this.comp, panel, s.card);
		if (!this.revealed) {
			const b = btn(panel, { text: "Lihat isinya", cls: "fch-btn-primary fch-btn-xl", onClick: () => { this.revealed = true; this.draw(); } });
			b.createSpan({ cls: "fch-kbd", text: "Spasi" });
		} else {
			panel.createDiv("fch-divider");
			md(this.hub.app, this.comp, panel.createDiv("fch-face fch-back markdown-rendered"), s.card.type === "cloze" ? s.card.back : s.card.back, s.card.path);
			const g = panel.createDiv("fch-grades");
			const a = g.createEl("button", { cls: "fch-grade g0" });
			a.createDiv({ cls: "fch-grade-label", text: "Lupa" });
			a.createDiv({ cls: "fch-grade-sub", text: "1" });
			a.onclick = () => this.rate(false);
			const b2 = g.createEl("button", { cls: "fch-grade g2" });
			b2.createDiv({ cls: "fch-grade-label", text: "Ingat" });
			b2.createDiv({ cls: "fch-grade-sub", text: "2" });
			b2.onclick = () => this.rate(true);
		}
	}
}
