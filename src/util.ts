import { App, Component, MarkdownRenderer, setIcon } from "obsidian";

export function shuffle<T>(a: T[]): T[] {
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export function plainText(md: string): string {
	return md
		.replace(/<[^>]+>/g, " ")
		.replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, a: string, b?: string) => b ?? a)
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?/gm, "")
		.replace(/[*_`~=#>]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

export function similarity(a: string, b: string): number {
	const x = plainText(a).toLowerCase().slice(0, 400), y = plainText(b).toLowerCase().slice(0, 400);
	if (!x && !y) return 1;
	let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
	for (let i = 1; i <= x.length; i++) {
		const cur = [i];
		for (let j = 1; j <= y.length; j++)
			cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
		prev = cur;
	}
	return 1 - prev[y.length] / Math.max(x.length, y.length);
}

export function md(app: App, comp: Component, el: HTMLElement, text: string, path: string) {
	void MarkdownRenderer.render(app, text, el, path, comp);
}

export function icon(parent: HTMLElement, name: string, cls = ""): HTMLElement {
	const s = parent.createSpan({ cls: ("fch-ic " + cls).trim() });
	setIcon(s, name);
	return s;
}

export interface BtnOpts {
	text?: string;
	icon?: string;
	cls?: string;
	label?: string;
	disabled?: boolean;
	onClick?: (e: MouseEvent) => void;
}

export function btn(parent: HTMLElement, o: BtnOpts): HTMLButtonElement {
	const b = parent.createEl("button", { cls: ("fch-btn " + (o.cls ?? "")).trim() });
	if (o.icon) icon(b, o.icon);
	if (o.text) b.createSpan({ text: o.text });
	if (o.label) b.setAttr("aria-label", o.label);
	if (o.disabled) b.disabled = true;
	if (o.onClick) b.onclick = (e) => o.onClick!(e);
	return b;
}

/** Cincin progres berbasis conic-gradient. */
export function ring(parent: HTMLElement, pct: number, size: number, center?: string, cls = ""): HTMLElement {
	const r = parent.createDiv({ cls: ("fch-ring " + cls).trim() });
	r.style.setProperty("--p", String(Math.max(0, Math.min(1, pct))));
	r.style.setProperty("--size", `${size}px`);
	if (center !== undefined) r.createSpan({ cls: "fch-ring-c", text: center });
	return r;
}

export function confetti(host: HTMLElement) {
	if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
	const layer = host.createDiv("fch-confetti");
	const bits = ["🎉", "✨", "⭐", "🧠", "🎊", "💡"];
	for (let i = 0; i < 36; i++) {
		const b = layer.createSpan({ text: bits[i % bits.length] });
		b.style.left = `${Math.random() * 100}%`;
		b.style.animationDelay = `${Math.random() * 0.6}s`;
		b.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
		b.style.fontSize = `${14 + Math.random() * 14}px`;
	}
	window.setTimeout(() => layer.remove(), 3800);
}

export const basename = (path: string) => path.split("/").pop()!.replace(/\.md$/, "");
export const folderOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");

/** Nomor urut materi; disembunyikan bila nama file sudah diawali angka. */
export const seqLabel = (path: string, index: number): string | null =>
	/^\d+/.test(basename(path)) ? null : String(index).padStart(2, "0");

/** Ledakan partikel dari sebuah tombol (dipakai saat menilai kartu). */
export function burst(stage: HTMLElement, from: HTMLElement | null, g: number) {
	const sr = stage.getBoundingClientRect();
	const r = from?.getBoundingClientRect();
	const x = r ? r.left + r.width / 2 - sr.left : sr.width / 2;
	const y = r ? r.top + r.height / 2 - sr.top : sr.height * 0.6;
	const box = stage.createDiv("fch-burst");
	box.style.left = `${x}px`;
	box.style.top = `${y}px`;
	const colors = g >= 3 ? ["#fbbf24", "#f472b6", "#60a5fa", "#a78bfa", "#34d399"] : g === 2 ? ["#22c55e", "#4ade80", "#86efac", "#fde047"] : ["#f59e0b", "#fbbf24", "#fcd34d"];
	const n = g >= 3 ? 22 : g === 2 ? 16 : 10;
	for (let i = 0; i < n; i++) {
		const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
		const d = 50 + Math.random() * (g >= 3 ? 110 : 80);
		const star = g >= 3 && i % 3 === 0;
		const pt = box.createEl("i", { cls: star ? "is-star" : "" });
		if (star) pt.setText("✦");
		pt.style.setProperty("--dx", `${Math.cos(a) * d}px`);
		pt.style.setProperty("--dy", `${Math.sin(a) * d - 40}px`);
		pt.style.setProperty("--pc", colors[i % colors.length]);
		pt.style.animationDelay = `${Math.random() * 60}ms`;
	}
	window.setTimeout(() => box.remove(), 900);
}

/** Angka berhitung naik (mis. "87%", "12", "⚡ 5"); teks tanpa angka di depan dibiarkan. */
export function countUp(el: HTMLElement, text: string, ms = 900) {
	const m = text.match(/^(\D*?)(\d+)(\D*)$/);
	if (!m) return;
	const [, pre, num, post] = m;
	const target = parseInt(num, 10);
	if (!target) return;
	const t0 = performance.now();
	const step = (t: number) => {
		const k = Math.min(1, (t - t0) / ms);
		const e = 1 - Math.pow(1 - k, 3);
		el.setText(`${pre}${Math.round(target * e)}${post}`);
		if (k < 1 && el.isConnected) requestAnimationFrame(step);
	};
	el.setText(`${pre}0${post}`);
	requestAnimationFrame(step);
}
