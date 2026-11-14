import { App, Modal, Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { GradeEntry } from "./types";
import { subjects } from "./planner";
import { dayKey } from "./scheduler";
import { btn, ring } from "./util";
import { play } from "./sound";

const KINDS = ["Ulangan", "Tugas", "Kuis", "UTS", "UAS", "Praktikum", "Lainnya"];
const uid = () => "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Rata-rata berbobot dalam skala 0–100. */
export function average(list: GradeEntry[]): number | null {
	const w = list.reduce((a, g) => a + g.weight, 0);
	return w ? list.reduce((a, g) => a + (g.score / g.max) * 100 * g.weight, 0) / w : null;
}
/** Konversi ke huruf & bobot 4.0 (skala umum perguruan tinggi Indonesia). */
export function letter(v: number): { l: string; ip: number } {
	const T: [number, string, number][] = [[85, "A", 4], [80, "A-", 3.7], [75, "B+", 3.3], [70, "B", 3], [65, "B-", 2.7], [60, "C+", 2.3], [55, "C", 2], [40, "D", 1], [0, "E", 0]];
	const x = T.find(([min]) => v >= min)!;
	return { l: x[1], ip: x[2] };
}

class GradeModal extends Modal {
	constructor(app: App, private p: FlashcardPlugin, private done: () => void, private g?: GradeEntry, private subject = "") { super(app); }
	onOpen() {
		this.modalEl.addClass("fch-modal");
		const el = this.contentEl;
		const g = this.g;
		el.createDiv({ cls: "fch-modal-title", text: g ? "✏️ Edit nilai" : "➕ Catat nilai" });
		const f = (label: string, parent = el) => { const x = parent.createDiv("fch-field"); x.createEl("label", { text: label }); return x; };
		const subj = f("Mata pelajaran").createEl("input", { type: "text", cls: "fch-input", attr: { list: "fch-subj2" } });
		const dl = el.createEl("datalist", { attr: { id: "fch-subj2" } });
		subjects(this.p).forEach((s) => dl.createEl("option", { attr: { value: s } }));
		subj.value = g?.subject ?? this.subject;
		const name = f("Nama penilaian").createEl("input", { type: "text", cls: "fch-input", attr: { placeholder: "mis. Ulangan Bab 3" } });
		name.value = g?.name ?? "";
		const row = el.createDiv("fch-task-grid");
		const score = f("Nilai", row).createEl("input", { type: "number", cls: "fch-input" });
		score.value = g ? String(g.score) : "";
		const max = f("Nilai maksimal", row).createEl("input", { type: "number", cls: "fch-input" });
		max.value = String(g?.max ?? 100);
		const weight = f("Bobot", row).createEl("input", { type: "number", cls: "fch-input", attr: { step: "0.5", min: "0" } });
		weight.value = String(g?.weight ?? 1);
		const kind = f("Jenis", row).createEl("select", { cls: "dropdown fch-select" });
		KINDS.forEach((k) => kind.createEl("option", { text: k, attr: { value: k } }));
		kind.value = g?.kind ?? "Ulangan";
		kind.onchange = () => { if (!g) weight.value = kind.value === "UAS" ? "3" : kind.value === "UTS" ? "2" : "1"; };
		const date = f("Tanggal", row).createEl("input", { type: "date", cls: "fch-input" });
		date.value = g?.date ?? dayKey(Date.now());
		el.createDiv({ cls: "fch-muted fch-small", text: "Bobot menentukan pengaruh nilai ke rata-rata, misalnya UTS = 2 dan UAS = 3." });
		const foot = el.createDiv("fch-modal-foot fch-mt");
		if (g) btn(foot, { text: "Hapus", icon: "trash-2", cls: "fch-btn-ghost fch-danger", onClick: () => { this.p.data.grades = this.p.data.grades.filter((x) => x.id !== g.id); this.p.requestSave(); this.close(); this.done(); } });
		foot.createDiv("fch-grow");
		btn(foot, { text: "Simpan", icon: "check", cls: "fch-btn-primary", onClick: () => {
			const sc = parseFloat(score.value), mx = parseFloat(max.value) || 100;
			if (!subj.value.trim() || isNaN(sc)) return void new Notice("Isi mata pelajaran dan nilainya.");
			const e: GradeEntry = { id: g?.id ?? uid(), subject: subj.value.trim(), name: name.value.trim() || kind.value, score: sc, max: mx, weight: Math.max(0, parseFloat(weight.value) || 1), date: date.value || dayKey(Date.now()), kind: kind.value };
			this.p.data.grades = [...this.p.data.grades.filter((x) => x.id !== e.id), e];
			this.p.requestSave();
			this.p.checkAchievements();
			play("coin");
			this.close();
			this.done();
		} });
		window.setTimeout(() => (g ? score : subj.value ? name : subj).focus(), 30);
	}
	onClose() { this.contentEl.empty(); }
}

let open = "";

export function renderGrades(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const head = el.createDiv("fch-pagehead fch-pagehead-row");
	const ht = head.createDiv();
	ht.createEl("h1", { text: "🏅 Nilai" });
	ht.createDiv({ cls: "fch-muted", text: "Catat nilai ulangan, tugas, dan ujian. Rata-rata berbobot, konversi huruf/IP, dan nilai yang dibutuhkan untuk mencapai target dihitung otomatis." });
	btn(head, { text: "Catat nilai", icon: "plus", cls: "fch-btn-primary", onClick: () => new GradeModal(hub.app, p, () => hub.renderPage()).open() });
	const subs = [...new Set(p.data.grades.map((g) => g.subject))].sort();
	if (!subs.length) return void el.createDiv({ cls: "fch-empty fch-mt", text: "Belum ada nilai. Klik “Catat nilai” untuk mulai, misalnya Biologi · Ulangan Bab 1 · 85." });
	// ringkasan keseluruhan
	const avgs = subs.map((s) => ({ s, v: average(p.data.grades.filter((g) => g.subject === s))! }));
	const all = avgs.reduce((a, x) => a + x.v, 0) / avgs.length;
	const ip = avgs.reduce((a, x) => a + letter(x.v).ip, 0) / avgs.length;
	const hero = el.createDiv("fch-hero");
	const hl = hero.createDiv("fch-hero-l");
	hl.createDiv({ cls: "fch-hero-num", text: `Rata-rata ${all.toFixed(1)}` });
	hl.createDiv({ cls: "fch-hero-sub", text: `${subs.length} mata pelajaran · ${p.data.grades.length} nilai tercatat · setara IP ${ip.toFixed(2)} (${letter(all).l})` });
	const best = [...avgs].sort((a, b) => b.v - a.v);
	hl.createDiv({ cls: "fch-hero-sub", text: `Terbaik: ${best[0].s} (${best[0].v.toFixed(1)})` + (best.length > 1 ? ` · perlu perhatian: ${best[best.length - 1].s} (${best[best.length - 1].v.toFixed(1)})` : "") });
	ring(hero.createDiv("fch-hero-r"), all / 100, 110, letter(all).l, "fch-ring-big");

	const grid = el.createDiv("fch-grade-grid");
	for (const s of subs) {
		const list = p.data.grades.filter((g) => g.subject === s).sort((a, b) => a.date.localeCompare(b.date));
		const v = average(list)!;
		const target = p.data.targets[s];
		const card = grid.createDiv("fch-grade-card" + (open === s ? " is-open" : ""));
		const top = card.createDiv("fch-row");
		top.createDiv({ cls: "fch-grade-subj fch-grow", text: s });
		top.createDiv({ cls: "fch-grade-letter " + (v >= 80 ? "is-good" : v >= 65 ? "is-mid" : "is-bad"), text: letter(v).l });
		card.createDiv({ cls: "fch-grade-avg", text: v.toFixed(1) });
		// grafik garis kecil
		const NS = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(NS, "svg");
		svg.setAttribute("viewBox", "0 0 200 44");
		svg.setAttribute("class", "fch-spark");
		const pts = list.map((g, i) => [list.length === 1 ? 100 : (i / (list.length - 1)) * 196 + 2, 42 - (g.score / g.max) * 40]);
		const pl = document.createElementNS(NS, "polyline");
		pl.setAttribute("points", pts.map((x) => x.join(",")).join(" "));
		svg.appendChild(pl);
		if (target) { const tl = document.createElementNS(NS, "line"); tl.setAttribute("x1", "0"); tl.setAttribute("x2", "200"); tl.setAttribute("y1", String(42 - target * 0.4)); tl.setAttribute("y2", String(42 - target * 0.4)); tl.setAttribute("class", "is-target"); svg.appendChild(tl); }
		pts.forEach(([x, y]) => { const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", String(x)); c.setAttribute("cy", String(y)); c.setAttribute("r", "2.5"); svg.appendChild(c); });
		card.appendChild(svg);
		// target & kalkulator
		const tr = card.createDiv("fch-row");
		tr.createSpan({ cls: "fch-small", text: "🎯 Target" });
		const ti = tr.createEl("input", { type: "number", cls: "fch-input fch-num", attr: { placeholder: "—", min: "0", max: "100" } });
		ti.value = target ? String(target) : "";
		ti.onchange = () => { const n = parseFloat(ti.value); if (n > 0) p.data.targets[s] = n; else delete p.data.targets[s]; p.requestSave(); hub.renderPage(); };
		if (target) {
			const W = list.reduce((a, g) => a + g.weight, 0);
			const need = (nextW: number) => (target * (W + nextW) - v * W) / nextW;
			const n1 = need(1), n3 = need(3);
			card.createDiv({ cls: "fch-grade-need", text: v >= target ? `✅ Sudah di atas target (${target}).` : n3 > 100 ? `⚠️ Target ${target} sulit dicapai: butuh ${n3.toFixed(0)} di ujian berbobot 3.` : `Butuh ${Math.max(0, n1).toFixed(0)} di penilaian berbobot 1, atau ${Math.max(0, n3).toFixed(0)} di ujian berbobot 3 (mis. UAS).` });
		}
		const act = card.createDiv("fch-row");
		btn(act, { text: open === s ? "Tutup" : `${list.length} nilai`, cls: "fch-btn-sm fch-btn-ghost", onClick: () => { open = open === s ? "" : s; hub.renderPage(); } });
		btn(act, { text: "Tambah", icon: "plus", cls: "fch-btn-sm", onClick: () => new GradeModal(hub.app, p, () => hub.renderPage(), undefined, s).open() });
		if (open === s) {
			const tb = card.createDiv("fch-grade-list");
			for (const g of [...list].reverse()) {
				const r = tb.createEl("button", { cls: "fch-grade-row" });
				r.createSpan({ cls: "fch-grow", text: `${g.name} · ${g.kind}` });
				r.createSpan({ cls: "fch-muted fch-small", text: new Date(g.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" }) });
				r.createSpan({ cls: "fch-strong", text: g.max === 100 ? String(g.score) : `${g.score}/${g.max}` });
				if (g.weight !== 1) r.createSpan({ cls: "fch-pill", text: `×${g.weight}` });
				r.onclick = () => new GradeModal(hub.app, p, () => hub.renderPage(), g).open();
			}
		}
	}
}
