import { App, Component, MarkdownRenderer, Modal, Notice, TFile, setIcon } from "obsidian";
import type FlashcardPlugin from "./main";
import { Card, Mask, Occlusion, OcclusionMode } from "./types";
import { btn } from "./util";

export const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
export const isImagePath = (p: string) => IMAGE_EXT.includes((p.split(".").pop() ?? "").toLowerCase());
export const letterOf = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : letterOf(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));
const uid = () => Math.random().toString(36).slice(2, 9);

/** Skalakan gambar agar pas di wadah (boleh diperbesar hingga 2,5×) tanpa merusak posisi kotak. */
export function fitImage(img: HTMLImageElement, container: HTMLElement, maxHeight: number) {
	const apply = () => {
		const nw = img.naturalWidth, nh = img.naturalHeight;
		if (!nw || !nh) return;
		const cw = Math.max(200, container.clientWidth - 4);
		const scale = Math.min(cw / nw, maxHeight / nh, 2.5);
		img.style.width = `${Math.round(nw * scale)}px`;
		img.style.height = "auto";
		img.style.maxWidth = "none";
		img.style.maxHeight = "none";
	};
	if (img.complete) window.setTimeout(apply, 0);
	img.addEventListener("load", apply);
	return apply;
}
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Cari embed gambar di sebuah baris: ![[gambar.png]] atau ![](gambar.png). */
export function imageOnLine(app: App, line: string, sourcePath: string): string | null {
	const wiki = /!\[\[([^\]|#]+?)(?:\|[^\]]*)?\]\]/.exec(line);
	const mdl = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(line);
	const raw = wiki?.[1] ?? (mdl ? decodeURI(mdl[1]) : null);
	if (!raw || !isImagePath(raw)) return null;
	if (/^https?:\/\//.test(raw)) return raw;
	return app.metadataCache.getFirstLinkpathDest(raw, sourcePath)?.path ?? null;
}

/**
 * Cari berkas gambar walaupun sudah dipindah/diganti nama saat plugin tidak berjalan
 * (mis. lewat sinkronisasi atau file manager): path tersimpan → tautan dari catatan → nama berkas yang sama.
 */
export function resolveImagePath(app: App, path: string, from = ""): string | null {
	if (!path) return null;
	if (/^(https?:|data:)/.test(path)) return path;
	const f = app.vault.getAbstractFileByPath(path);
	if (f instanceof TFile) return f.path;
	const name = path.split("/").pop() ?? path;
	const d = app.metadataCache.getFirstLinkpathDest(name, from);
	if (d) return d.path;
	const lower = name.toLowerCase();
	const hit = app.vault.getFiles().find((x) => x.name.toLowerCase() === lower);
	return hit?.path ?? null;
}

export function imageSrc(app: App, path: string, from = ""): string {
	const r = resolveImagePath(app, path, from);
	if (!r) return "";
	if (/^(https?:|data:)/.test(r)) return r;
	const f = app.vault.getAbstractFileByPath(r);
	return f instanceof TFile ? app.vault.getResourcePath(f) : "";
}

/** Kotak pengganti saat gambar tidak ditemukan (bukan sekadar nama gambar). */
function missingImage(parent: HTMLElement, occ: Occlusion) {
	const m = parent.createDiv("fch-io-missing");
	m.createDiv({ cls: "fch-io-missing-ic", text: "🖼️" });
	m.createDiv({ cls: "fch-strong", text: "Gambar tidak ditemukan" });
	m.createDiv({ cls: "fch-small fch-muted", text: occ.image });
	m.createDiv({ cls: "fch-small", text: "Berkas gambar mungkin dipindah, diganti nama, atau belum tersinkron. Kembalikan berkasnya, atau tekan Edit (E) untuk memilih ulang gambar." });
	return m;
}

// ---------------------------------------------------------------- pemilih gambar
export function renderImagePicker(plugin: FlashcardPlugin, host: HTMLElement, sourcePath: string, onPick: (path: string) => void) {
	const app = plugin.app;
	host.empty();
	host.addClass("fch-picker");
	host.tabIndex = 0;
	const head = host.createDiv("fch-picker-head");
	const search = head.createEl("input", { type: "search", cls: "fch-input fch-grow", attr: { placeholder: "Cari gambar di vault" } });
	const file = head.createEl("input", { type: "file", attr: { accept: "image/*" } });
	file.style.display = "none";
	btn(head, { text: "Unggah gambar", icon: "upload", onClick: () => file.click() });
	const drop = host.createDiv({ cls: "fch-drop", text: "Tempel screenshot (Ctrl+V) atau seret gambar ke sini" });
	const grid = host.createDiv("fch-thumbs");

	const save = async (name: string, data: ArrayBuffer) => {
		const path = await app.fileManager.getAvailablePathForAttachment(name, sourcePath);
		const f = await app.vault.createBinary(path, data);
		new Notice(`Gambar disimpan: ${f.path}`);
		onPick(f.path);
	};
	const fromBlob = async (blob: Blob, name?: string) => {
		const ext = (blob.type.split("/")[1] ?? "png").replace("jpeg", "jpg").replace("svg+xml", "svg");
		await save(name ?? `Occlusion ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`, await blob.arrayBuffer());
	};
	file.onchange = () => { if (file.files?.[0]) void fromBlob(file.files[0], file.files[0].name); };
	host.addEventListener("paste", (e) => {
		const it = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
		const b = it?.getAsFile();
		if (b) { e.preventDefault(); void fromBlob(b); }
	});
	drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.addClass("is-over"); });
	drop.addEventListener("dragleave", () => drop.removeClass("is-over"));
	drop.addEventListener("drop", (e) => {
		e.preventDefault();
		drop.removeClass("is-over");
		const f = [...(e.dataTransfer?.files ?? [])].find((x) => x.type.startsWith("image/"));
		if (f) void fromBlob(f, f.name);
	});

	const images = app.vault.getFiles().filter((f) => isImagePath(f.path)).sort((a, b) => b.stat.mtime - a.stat.mtime);
	const draw = () => {
		grid.empty();
		const q = search.value.toLowerCase().trim();
		const list = images.filter((f) => !q || f.path.toLowerCase().includes(q)).slice(0, 60);
		if (!list.length) grid.createDiv({ cls: "fch-empty", text: images.length ? "Tidak ada gambar yang cocok." : "Belum ada gambar di vault. Unggah atau tempel screenshot." });
		for (const f of list) {
			const t = grid.createEl("button", { cls: "fch-thumb", attr: { "aria-label": f.path } });
			t.createEl("img", { attr: { src: app.vault.getResourcePath(f), loading: "lazy", alt: "" } });
			t.createDiv({ cls: "fch-thumb-name", text: f.name });
			t.onclick = () => onPick(f.path);
		}
	};
	search.oninput = draw;
	draw();
	window.setTimeout(() => host.focus(), 30);
}

// ---------------------------------------------------------------- editor kotak
export interface EditorInit {
	path: string;
	image: string;
	occ?: Occlusion;
}

export class OcclusionEditor {
	masks: Mask[];
	mode: OcclusionMode;
	path: string;
	title: string;
	private sel: string | null = null;
	private history: string[] = [];
	private lastSize: { w: number; h: number } | null = null;
	private box!: HTMLElement;
	private list!: HTMLElement;
	private countEl!: HTMLElement;

	constructor(private plugin: FlashcardPlugin, private host: HTMLElement, private init: EditorInit, private done: (saved: boolean) => void) {
		this.masks = init.occ ? init.occ.masks.map((m) => ({ ...m })) : [];
		this.mode = init.occ?.mode ?? "all";
		this.path = init.occ?.path ?? init.path;
		this.title = init.occ?.title ?? (init.image.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
		if (this.masks.length) this.lastSize = { w: this.masks[0].w, h: this.masks[0].h };
		this.render();
	}

	private snapshot() {
		this.history.push(JSON.stringify(this.masks));
		if (this.history.length > 60) this.history.shift();
	}

	private undo() {
		const s = this.history.pop();
		if (!s) return;
		this.masks = JSON.parse(s);
		this.sel = null;
		this.drawMasks();
		this.drawList();
	}

	render() {
		const h = this.host;
		h.empty();
		h.addClass("fch-ioe");
		h.tabIndex = 0;

		// ---- bilah alat
		const bar = h.createDiv("fch-ioe-bar");
		const t = bar.createDiv("fch-ioe-title");
		const ti = t.createEl("input", { type: "text", cls: "fch-input", attr: { placeholder: "Judul, mis. Anatomi jantung" } });
		ti.value = this.title;
		ti.oninput = () => (this.title = ti.value);
		const seg = bar.createDiv("fch-seg");
		for (const [v, label, tip] of [["all", "Tutup semua", "Semua kotak tertutup, tebak satu"], ["one", "Tutup satu", "Hanya kotak yang ditanya yang tertutup"]] as const) {
			const b = seg.createEl("button", { cls: "fch-seg-btn" + (this.mode === v ? " is-active" : ""), text: label, attr: { "aria-label": tip } });
			b.onclick = () => {
				this.mode = v;
				seg.querySelectorAll(".fch-seg-btn").forEach((x) => x.removeClass("is-active"));
				b.addClass("is-active");
			};
		}
		btn(bar, { icon: "undo", cls: "fch-btn-ghost fch-btn-sm", label: "Urungkan (Ctrl+Z)", onClick: () => this.undo() });
		btn(bar, { icon: "trash-2", cls: "fch-btn-ghost fch-btn-sm", label: "Hapus kotak terpilih (Delete)", onClick: () => this.removeSelected() });

		// ---- kanvas + daftar
		const body = h.createDiv("fch-ioe-body");
		const canvas = body.createDiv("fch-ioe-canvas");
		this.box = canvas.createDiv("fch-io fch-io-edit");
		const img = this.box.createEl("img", { attr: { src: imageSrc(this.plugin.app, this.init.image), draggable: "false", alt: "" } });
		img.onerror = () => canvas.createDiv({ cls: "fch-empty", text: "Gambar tidak bisa dimuat." });
		fitImage(img, canvas, window.innerHeight * 0.62);
		this.bindPointer();

		const side = body.createDiv("fch-ioe-side");
		const sh = side.createDiv("fch-ioe-side-head");
		this.countEl = sh.createDiv("fch-strong");
		btn(sh, { text: "Urutkan", icon: "arrow-down-wide-narrow", cls: "fch-btn-ghost fch-btn-sm", label: "Urutkan huruf berdasarkan posisi (kolom kiri ke kanan, atas ke bawah)", onClick: () => this.sortMasks() });
		side.createDiv({ cls: "fch-muted fch-small", text: "Seret di gambar untuk menutup bagian. Klik sekali untuk membuat kotak seukuran kotak terakhir. Label (opsional) dipakai untuk kuis & mode ketik." });
		this.list = side.createDiv("fch-ioe-list");

		// ---- kaki
		const foot = h.createDiv("fch-ioe-foot");
		const sel = foot.createEl("select", { cls: "dropdown fch-select" });
		const paths = this.plugin.sortedPaths();
		const opts = [...new Set([this.path, ...paths].filter((x) => x && x.endsWith(".md")))];
		if (!opts.length) {
			this.path = "Image Occlusion.md";
			opts.push(this.path);
		}
		if (!this.path) this.path = opts[0];
		opts.forEach((x) => sel.createEl("option", { text: "Materi: " + x.replace(/\.md$/, ""), attr: { value: x } }));
		sel.value = this.path;
		sel.onchange = () => (this.path = sel.value);
		foot.createDiv("fch-grow");
		btn(foot, { text: "Batal", cls: "fch-btn-ghost", onClick: () => this.done(false) });
		const save = btn(foot, { text: "Simpan kartu", icon: "check", cls: "fch-btn-primary", onClick: () => this.save() });
		save.createSpan({ cls: "fch-kbd", text: "Ctrl+Enter" });

		h.addEventListener("keydown", (e) => {
			const inInput = (e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "SELECT";
			if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); this.save(); return; }
			if (inInput) return;
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); this.undo(); return; }
			if ((e.key === "Delete" || e.key === "Backspace") && this.sel) { e.preventDefault(); this.removeSelected(); return; }
			const m = this.masks.find((x) => x.id === this.sel);
			const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
			if (m && d[e.key]) {
				e.preventDefault();
				const step = e.shiftKey ? 0.02 : 0.004;
				m.x = clamp(m.x + d[e.key][0] * step, 0, 1 - m.w);
				m.y = clamp(m.y + d[e.key][1] * step, 0, 1 - m.h);
				this.drawMasks();
			}
		});
		this.drawMasks();
		this.drawList();
	}

	private pt(e: PointerEvent) {
		const r = this.box.getBoundingClientRect();
		return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
	}

	private bindPointer() {
		const box = this.box;
		let mode: "draw" | "move" | "resize" | null = null;
		let start = { x: 0, y: 0 };
		let orig: Mask | null = null;
		let temp: HTMLElement | null = null;
		let moved = false;

		box.addEventListener("pointerdown", (e) => {
			if (e.button !== 0) return;
			e.preventDefault();
			this.host.focus();
			start = this.pt(e);
			moved = false;
			const t = e.target as HTMLElement;
			const mEl = t.closest(".fch-io-box") as HTMLElement | null;
			if (mEl) {
				const m = this.masks.find((x) => x.id === mEl.dataset.id)!;
				this.sel = m.id;
				orig = { ...m };
				mode = t.hasClass("fch-io-handle") ? "resize" : "move";
				this.snapshot();
				this.drawMasks();
				this.highlightList();
			} else {
				mode = "draw";
				this.sel = null;
				temp = box.createDiv("fch-io-box is-temp");
			}
			box.setPointerCapture(e.pointerId);
		});
		box.addEventListener("pointermove", (e) => {
			if (!mode) return;
			const p = this.pt(e);
			if (Math.abs(p.x - start.x) + Math.abs(p.y - start.y) > 0.004) moved = true;
			if (mode === "draw" && temp) {
				const x = Math.min(p.x, start.x), y = Math.min(p.y, start.y);
				Object.assign(temp.style, { left: `${x * 100}%`, top: `${y * 100}%`, width: `${Math.abs(p.x - start.x) * 100}%`, height: `${Math.abs(p.y - start.y) * 100}%` });
			} else if (orig) {
				const m = this.masks.find((x) => x.id === orig!.id)!;
				if (mode === "move") {
					m.x = clamp(orig.x + p.x - start.x, 0, 1 - m.w);
					m.y = clamp(orig.y + p.y - start.y, 0, 1 - m.h);
				} else {
					m.w = clamp(orig.w + p.x - start.x, 0.01, 1 - m.x);
					m.h = clamp(orig.h + p.y - start.y, 0.01, 1 - m.y);
				}
				this.drawMasks();
			}
		});
		const end = (e: PointerEvent) => {
			if (!mode) return;
			const p = this.pt(e);
			if (mode === "draw") {
				temp?.remove();
				temp = null;
				let m: Mask | null = null;
				const w = Math.abs(p.x - start.x), h = Math.abs(p.y - start.y);
				if (w > 0.01 && h > 0.01) m = { id: uid(), x: Math.min(p.x, start.x), y: Math.min(p.y, start.y), w, h, label: "" };
				else if (!moved && this.lastSize) {
					const s = this.lastSize;
					m = { id: uid(), x: clamp(p.x - s.w / 2, 0, 1 - s.w), y: clamp(p.y - s.h / 2, 0, 1 - s.h), w: s.w, h: s.h, label: "" };
				}
				if (m) {
					this.snapshot();
					this.masks.push(m);
					this.sel = m.id;
					this.lastSize = { w: m.w, h: m.h };
					this.drawList(m.id);
				}
				this.drawMasks();
			} else {
				if (!moved) this.history.pop();
				const m = this.masks.find((x) => x.id === this.sel);
				if (m && mode === "resize") this.lastSize = { w: m.w, h: m.h };
				if (!moved && m) this.focusLabel(m.id);
			}
			mode = null;
			orig = null;
		};
		box.addEventListener("pointerup", end);
		box.addEventListener("pointercancel", end);
	}

	private drawMasks() {
		this.box.querySelectorAll(".fch-io-box:not(.is-temp)").forEach((x) => x.remove());
		this.masks.forEach((m, i) => {
			const d = this.box.createDiv({ cls: "fch-io-box fch-io-mask" + (m.id === this.sel ? " is-sel" : "") });
			d.dataset.id = m.id;
			Object.assign(d.style, { left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` });
			d.createSpan({ cls: "fch-io-letter", text: letterOf(i) });
			if (m.id === this.sel) d.createDiv("fch-io-handle");
		});
		this.countEl?.setText(`${this.masks.length} kotak = ${this.masks.length} kartu`);
	}

	private drawList(focus?: string) {
		const l = this.list;
		l.empty();
		if (!this.masks.length) l.createDiv({ cls: "fch-empty fch-small", text: "Belum ada kotak." });
		this.masks.forEach((m, i) => {
			const r = l.createDiv({ cls: "fch-ioe-item" + (m.id === this.sel ? " is-sel" : "") });
			r.dataset.id = m.id;
			r.createSpan({ cls: "fch-io-chip", text: letterOf(i) });
			const inp = r.createEl("input", { type: "text", cls: "fch-input fch-grow", attr: { placeholder: "Label (opsional)" } });
			inp.value = m.label;
			inp.onfocus = () => { this.sel = m.id; this.drawMasks(); this.highlightList(); };
			inp.oninput = () => (m.label = inp.value);
			inp.onkeydown = (e) => {
				if (e.key === "Enter" && !e.ctrlKey) {
					e.preventDefault();
					const next = this.masks[i + 1];
					if (next) this.focusLabel(next.id);
					else (inp.blur(), this.host.focus());
				}
			};
			btn(r, { icon: "x", cls: "fch-btn-ghost fch-btn-sm", label: "Hapus kotak", onClick: () => { this.sel = m.id; this.removeSelected(); } });
			if (m.id === focus) window.setTimeout(() => inp.focus(), 20);
		});
		this.drawMasks();
	}

	private highlightList() {
		this.list.querySelectorAll<HTMLElement>(".fch-ioe-item").forEach((x) => x.toggleClass("is-sel", x.dataset.id === this.sel));
	}

	private focusLabel(id: string) {
		this.list.querySelector<HTMLInputElement>(`.fch-ioe-item[data-id="${id}"] input`)?.focus();
	}

	private removeSelected() {
		if (!this.sel) return;
		this.snapshot();
		this.masks = this.masks.filter((m) => m.id !== this.sel);
		this.sel = null;
		this.drawList();
	}

	/** Urutkan per kolom (kiri/kanan) lalu atas ke bawah, seperti label di diagram. */
	private sortMasks() {
		this.snapshot();
		const cols = (m: Mask) => Math.floor((m.x + m.w / 2) * 3);
		this.masks.sort((a, b) => cols(a) - cols(b) || a.y - b.y);
		this.drawList();
	}

	private save() {
		if (!this.masks.length) return void new Notice("Gambar dulu minimal satu kotak di atas gambar.");
		if (!this.path) return void new Notice("Pilih materi tempat kartu disimpan.");
		this.plugin.saveOcclusion({
			id: this.init.occ?.id ?? "o" + Date.now().toString(36) + uid(),
			path: this.path, image: this.init.image, masks: this.masks, mode: this.mode,
			title: this.title.trim(), created: this.init.occ?.created ?? Date.now(),
		});
		new Notice(`✓ ${this.masks.length} kartu Image Occlusion ${this.init.occ ? "diperbarui" : "dibuat"}`);
		this.done(true);
	}
}

// ---------------------------------------------------------------- modal
export class OcclusionModal extends Modal {
	constructor(app: App, private plugin: FlashcardPlugin, private o: { path: string; image?: string; occ?: Occlusion }) {
		super(app);
	}

	onOpen() {
		this.modalEl.addClass("fch-modal", "fch-io-modal");
		this.show(this.o.occ?.image ?? this.o.image);
	}

	private show(image?: string) {
		const el = this.contentEl;
		el.empty();
		const head = el.createDiv("fch-modal-head");
		const ht = head.createDiv("fch-row");
		setIcon(ht.createSpan("fch-ic"), "image");
		ht.createDiv({ cls: "fch-modal-title", text: this.o.occ ? "Edit Image Occlusion" : "Image Occlusion" });
		if (image && !this.o.occ) btn(ht, { text: "Ganti gambar", cls: "fch-btn-link", onClick: () => this.show() });
		const host = el.createDiv();
		if (!image) {
			head.createDiv({ cls: "fch-muted fch-small", text: "Pilih gambar, lalu tutup bagian-bagian yang ingin dihafal." });
			renderImagePicker(this.plugin, host, this.o.path, (p) => this.show(p));
		} else new OcclusionEditor(this.plugin, host, { path: this.o.path, image, occ: this.o.occ }, () => this.close());
	}

	onClose() {
		this.contentEl.empty();
	}
}

// ---------------------------------------------------------------- tampilan saat belajar
export function renderOcclusion(app: App, parent: HTMLElement, occ: Occlusion, target: string, revealed: boolean): HTMLElement {
	const wrap = parent.createDiv("fch-io-wrap");
	const src = imageSrc(app, occ.image, occ.path);
	if (!src) { missingImage(wrap, occ); return wrap; }
	const box = wrap.createDiv("fch-io");
	const img = box.createEl("img", { attr: { src, alt: "", draggable: "false" } });
	img.addEventListener("error", () => { box.remove(); missingImage(wrap, occ); });
	let zoom = false;
	const fit = () => fitImage(img, wrap, zoom ? Infinity : window.innerHeight * 0.55)();
	fitImage(img, wrap, window.innerHeight * 0.55);
	occ.masks.forEach((m, i) => {
		const isT = m.id === target;
		if (!isT && occ.mode === "one") return;
		const d = box.createDiv({ cls: "fch-io-box " + (isT ? (revealed ? "fch-io-reveal" : "fch-io-mask is-target") : "fch-io-mask") });
		Object.assign(d.style, { left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` });
		if (!(isT && revealed)) d.createSpan({ cls: "fch-io-letter", text: isT ? "?" : letterOf(i) });
	});
	box.onclick = () => {
		zoom = !zoom;
		wrap.toggleClass("is-zoom", zoom);
		fit();
	};
	box.setAttr("aria-label", "Klik untuk memperbesar");
	return wrap;
}

/**
 * Muka kartu untuk mode apa pun (sesi, kuis, boss, dungeon, simulasi…).
 * Kartu Image Occlusion selalu tampil sebagai gambar dengan kotak “?”, bukan hanya namanya.
 */
export function cardFront(plugin: FlashcardPlugin, comp: Component, parent: HTMLElement, card: Card, opts: { revealed?: boolean; question?: boolean } = {}): HTMLElement {
	const occ = card.occ ? plugin.occOf(card) : undefined;
	if (occ && card.occ) {
		// perbaiki path yang usang secara otomatis
		const r = resolveImagePath(plugin.app, occ.image, occ.path);
		if (r && r !== occ.image && !/^(https?:|data:)/.test(r)) { occ.image = r; plugin.requestSave(); }
		const box = parent.createDiv("fch-face fch-front fch-io-face");
		const idx = occ.masks.findIndex((m) => m.id === card.occ!.mask);
		if (opts.question !== false) box.createDiv({ cls: "fch-io-q", text: opts.revealed ? (card.answer ?? `Bagian ${letterOf(Math.max(0, idx))}`) : "Apa nama bagian yang ditandai “?”" });
		renderOcclusion(plugin.app, box, occ, card.occ.mask, !!opts.revealed);
		return box;
	}
	const el = parent.createDiv("fch-face fch-front markdown-rendered");
	void MarkdownRenderer.render(plugin.app, opts.revealed && card.type === "cloze" ? card.back : card.front, el, card.path, comp);
	return el;
}
