import type { HubView } from "./hub-view";
import { Card } from "./types";
import { retention } from "./scheduler";
import { basename, btn, plainText } from "./util";

interface MNode { label: string; children: MNode[]; cards: Card[]; leaf?: Card; y?: number; depth: number }
let current = "";

/** Peta pikiran otomatis: materi → heading → kartu, berwarna menurut kekuatan ingatan. */
export function renderMindmap(hub: HubView, el: HTMLElement, path?: string) {
	const p = hub.plugin;
	if (path) current = path;
	const paths = p.sortedPaths();
	if (!current || !paths.includes(current)) current = paths[0] ?? "";
	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "🧭 Peta pikiran" });
	head.createDiv({ cls: "fch-muted", text: "Kartu disusun otomatis menurut heading catatan. Klik cabang untuk belajar topik itu, arahkan kursor ke kartu untuk mengintip jawabannya." });
	if (!current) return void el.createDiv({ cls: "fch-empty", text: "Belum ada materi." });
	const sel = el.createEl("select", { cls: "dropdown fch-select" });
	paths.forEach((x) => sel.createEl("option", { text: x.replace(/\.md$/, ""), attr: { value: x } }));
	sel.value = current;
	sel.onchange = () => { current = sel.value; hub.renderPage(); };

	// bangun pohon
	const cards = p.index.get(current) ?? [];
	const root: MNode = { label: basename(current), children: [], cards: [], depth: 0 };
	for (const c of cards) {
		let node = root;
		node.cards.push(c);
		for (const h of c.context.slice(0, 3)) {
			let ch = node.children.find((x) => !x.leaf && x.label === h);
			if (!ch) { ch = { label: h, children: [], cards: [], depth: node.depth + 1 }; node.children.push(ch); }
			ch.cards.push(c);
			node = ch;
		}
		node.children.push({ label: plainText(c.type === "cloze" ? c.back : c.front), children: [], cards: [c], leaf: c, depth: node.depth + 1 });
	}
	// batasi daun per cabang agar tetap terbaca
	const trim = (n: MNode) => {
		const leaves = n.children.filter((x) => x.leaf);
		if (leaves.length > 10) {
			const keep = leaves.slice(0, 9);
			n.children = [...n.children.filter((x) => !x.leaf), ...keep, { label: `+${leaves.length - 9} kartu lagi`, children: [], cards: leaves.slice(9).flatMap((x) => x.cards), depth: n.depth + 1 }];
		}
		n.children.forEach(trim);
	};
	trim(root);
	// tata letak kiri → kanan
	const ROW = 34, COL = 230;
	let row = 0, maxDepth = 0;
	const place = (n: MNode) => {
		maxDepth = Math.max(maxDepth, n.depth);
		if (!n.children.length) { n.y = row++ * ROW + 24; return; }
		n.children.forEach(place);
		n.y = (n.children[0].y! + n.children[n.children.length - 1].y!) / 2;
	};
	place(root);
	const W = (maxDepth + 1) * COL + 40, H = row * ROW + 30;
	const now = Date.now();
	const color = (cs: Card[]) => {
		let s = 0, n = 0;
		for (const c of cs) { const r = retention(p.data.cards[c.id], now); if (r !== null) { s += r; n++; } }
		if (!n) return "var(--background-modifier-border)";
		const v = s / n;
		return v >= 0.85 ? "#2f9e66" : v >= 0.7 ? "#84b62f" : v >= 0.5 ? "#e8902a" : "#e5484d";
	};
	const box = el.createDiv("fch-panel fch-mind");
	const NS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
	svg.setAttribute("width", String(W));
	svg.setAttribute("class", "fch-mind-svg");
	box.appendChild(svg);
	const mk = (tag: string, a: Record<string, string | number>, parent: Element) => {
		const e = document.createElementNS(NS, tag);
		for (const k in a) e.setAttribute(k, String(a[k]));
		parent.appendChild(e);
		return e;
	};
	const draw = (n: MNode) => {
		const x = 20 + n.depth * COL;
		for (const ch of n.children) {
			const cx = 20 + ch.depth * COL;
			mk("path", { d: `M${x + 190},${n.y} C${x + 210},${n.y} ${cx - 20},${ch.y} ${cx},${ch.y}`, class: "fch-mind-link", stroke: color(ch.cards) }, svg);
			draw(ch);
		}
		const g = mk("g", { class: "fch-mind-node" + (n.leaf ? " is-leaf" : n.depth === 0 ? " is-root" : " is-branch"), transform: `translate(${x},${n.y! - 13})` }, svg);
		mk("rect", { width: 190, height: 26, rx: 13, stroke: color(n.cards) }, g);
		const t = mk("text", { x: 12, y: 17 }, g);
		t.textContent = (n.leaf || n.depth ? "" : "📘 ") + (n.label.length > 26 ? n.label.slice(0, 25) + "…" : n.label);
		const tip = mk("title", {}, g);
		tip.textContent = n.leaf ? `${plainText(n.leaf.front)}\n→ ${plainText(n.leaf.answer ?? n.leaf.back)}` : `${n.label} · ${n.cards.length} kartu (klik untuk belajar)`;
		g.addEventListener("click", () => hub.startSession(n.cards, { title: n.leaf ? "Kartu" : n.label, cram: !!n.leaf, mode: p.data.settings.defaultMode }));
	};
	draw(root);
	const r = el.createDiv("fch-row fch-mt");
	btn(r, { text: "Belajar seluruh materi", icon: "play", cls: "fch-btn-primary", onClick: () => hub.startSession(cards, { title: basename(current), cram: false, mode: p.data.settings.defaultMode }) });
	btn(r, { text: "Buka catatan", icon: "file-text", onClick: () => void p.openAt(current, 0) });
}
