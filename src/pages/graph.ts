import type { HubView } from "../hub-view";
import { basename, btn, folderOf } from "../util";

const NS = "http://www.w3.org/2000/svg";
const svg = (tag: string, a: Record<string, string | number>, parent: Element) => {
	const e = document.createElementNS(NS, tag);
	for (const k in a) e.setAttribute(k, String(a[k]));
	parent.appendChild(e);
	return e;
};
let colorBy: "retention" | "mastery" = "retention";
let selected = "";

/** Peta pengetahuan: materi sebagai simpul, tautan [[...]] antar catatan sebagai garis. */
export function renderGraph(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const paths = p.sortedPaths();
	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "Peta pengetahuan" });
	head.createDiv({ cls: "fch-muted", text: "Materi yang saling ditautkan ([[…]]) di Obsidian. Warna menunjukkan kekuatan ingatan, ukuran menunjukkan jumlah kartu. Klik simpul untuk detail." });
	if (paths.length < 2) {
		el.createDiv({ cls: "fch-empty", text: "Butuh minimal 2 materi untuk membentuk peta." });
		return;
	}
	const ctr = el.createDiv("fch-row");
	for (const [v, l] of [["retention", "Warna: ingatan"], ["mastery", "Warna: penguasaan"]] as const)
		btn(ctr, { text: l, cls: "fch-btn-sm" + (colorBy === v ? " fch-btn-primary" : ""), onClick: () => { colorBy = v; hub.renderPage(); } });

	// simpul & sisi
	const idx = new Map(paths.map((x, i) => [x, i]));
	const links = p.app.metadataCache.resolvedLinks ?? {};
	const edges: { a: number; b: number; w: number; folder?: boolean }[] = [];
	const seen = new Set<string>();
	for (const a of paths) for (const [b, n] of Object.entries(links[a] ?? {})) {
		if (!idx.has(b) || a === b) continue;
		const k = [idx.get(a), idx.get(b)].sort().join("-");
		if (seen.has(k)) continue;
		seen.add(k);
		edges.push({ a: idx.get(a)!, b: idx.get(b)!, w: n as number });
	}
	// materi satu folder dihubungkan tipis agar peta tetap bermakna tanpa tautan
	const byFolder = new Map<string, number[]>();
	paths.forEach((x, i) => (byFolder.get(folderOf(x)) ?? byFolder.set(folderOf(x), []).get(folderOf(x))!).push(i));
	for (const g of byFolder.values()) for (let i = 1; i < g.length; i++) {
		const k = [g[i - 1], g[i]].sort().join("-");
		if (!seen.has(k)) { seen.add(k); edges.push({ a: g[i - 1], b: g[i], w: 0.3, folder: true }); }
	}
	const stats = paths.map((x) => p.countFor([x]));
	const W = 900, H = 560;
	const pos = paths.map((_, i) => ({ x: W / 2 + Math.cos(i * 2.4) * (60 + i * 9), y: H / 2 + Math.sin(i * 2.4) * (60 + i * 9), vx: 0, vy: 0 }));
	// tata letak gaya sederhana
	for (let it = 0; it < 320; it++) {
		const cool = 1 - it / 320;
		for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
			const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
			const d2 = Math.max(80, dx * dx + dy * dy), f = 5200 / d2;
			const d = Math.sqrt(d2);
			pos[i].vx -= (dx / d) * f; pos[i].vy -= (dy / d) * f;
			pos[j].vx += (dx / d) * f; pos[j].vy += (dy / d) * f;
		}
		for (const e of edges) {
			const a = pos[e.a], b = pos[e.b];
			const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
			const f = (d - (e.folder ? 110 : 90)) * 0.02 * (e.folder ? 0.6 : 1);
			a.vx += (dx / d) * f; a.vy += (dy / d) * f;
			b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
		}
		for (const q of pos) {
			q.vx += (W / 2 - q.x) * 0.004; q.vy += (H / 2 - q.y) * 0.004;
			q.x = Math.min(W - 60, Math.max(60, q.x + q.vx * cool)); q.y = Math.min(H - 30, Math.max(30, q.y + q.vy * cool));
			q.vx *= 0.5; q.vy *= 0.5;
		}
	}

	const box = el.createDiv("fch-panel fch-graph");
	const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "fch-graph-svg" }, box);
	const neighbors = (i: number) => new Set(edges.filter((e) => !e.folder && (e.a === i || e.b === i)).map((e) => (e.a === i ? e.b : e.a)));
	const sel = selected && idx.has(selected) ? idx.get(selected)! : -1;
	const near = sel >= 0 ? neighbors(sel) : new Set<number>();
	for (const e of edges) {
		const on = sel >= 0 && (e.a === sel || e.b === sel);
		svg("line", { x1: pos[e.a].x, y1: pos[e.a].y, x2: pos[e.b].x, y2: pos[e.b].y, class: "fch-gedge" + (e.folder ? " is-folder" : "") + (on ? " is-on" : ""), "stroke-width": e.folder ? 1 : Math.min(4, 1 + e.w) }, root);
	}
	const color = (i: number) => {
		const c = stats[i];
		const v = colorBy === "retention" ? c.retention : c.total ? (c.total - c.fresh) / c.total : 0;
		if (v === null) return "var(--background-modifier-border)";
		return v >= 0.85 ? "#2f9e66" : v >= 0.7 ? "#84b62f" : v >= 0.5 ? "#e8902a" : "#e5484d";
	};
	paths.forEach((path, i) => {
		const r = 7 + Math.sqrt(stats[i].total) * 2.4;
		const g = svg("g", { class: "fch-gnode" + (i === sel ? " is-sel" : "") + (sel >= 0 && i !== sel && !near.has(i) ? " is-dim" : ""), transform: `translate(${pos[i].x},${pos[i].y})` }, root);
		svg("circle", { r, fill: color(i) }, g);
		if (stats[i].due) svg("circle", { r: r + 4, class: "fch-gdue" }, g);
		const t = svg("text", { y: r + 14, "text-anchor": "middle", class: "fch-glabel" }, g);
		t.textContent = basename(path).slice(0, 22);
		const title = svg("title", {}, g);
		title.textContent = `${basename(path)} · ${stats[i].total} kartu`;
		g.addEventListener("click", () => { selected = path; hub.renderPage(); });
	});
	const legend = box.createDiv("fch-glegend");
	for (const [c, l] of [["#2f9e66", "≥ 85%"], ["#84b62f", "70–85%"], ["#e8902a", "50–70%"], ["#e5484d", "< 50%"]])
		legend.createSpan({ text: l }).style.setProperty("--c", c);
	legend.createSpan({ cls: "is-due", text: "ada ulasan hari ini" });

	if (sel >= 0) {
		const c = stats[sel];
		const d = el.createDiv("fch-panel fch-gdetail");
		d.createEl("h3", { text: basename(selected) });
		d.createDiv({ cls: "fch-muted fch-small", text: `${c.total} kartu · ${c.due} ulasan · ${c.fresh} baru · ingatan ${c.retention === null ? "—" : Math.round(c.retention * 100) + "%"}` });
		const nb = [...near].map((i) => paths[i]);
		if (nb.length) d.createDiv({ cls: "fch-small", text: "Terhubung dengan: " + nb.map(basename).join(", ") });
		const row = d.createDiv("fch-row");
		btn(row, { text: "Belajar materi ini", icon: "play", cls: "fch-btn-primary fch-btn-sm", onClick: () => hub.startSession(p.index.get(selected) ?? [], { title: basename(selected), cram: false, mode: p.data.settings.defaultMode }) });
		if (nb.length) btn(row, { text: `+ ${nb.length} materi terkait (selang-seling)`, icon: "network", cls: "fch-btn-sm", onClick: () => hub.startSession([selected, ...nb].flatMap((x) => p.index.get(x) ?? []), { title: `${basename(selected)} & terkait`, cram: false, mode: p.data.settings.defaultMode, interleave: true }) });
		btn(row, { text: "Buka catatan", icon: "file-text", cls: "fch-btn-ghost fch-btn-sm", onClick: () => void p.openAt(selected, 0) });
	}
}
