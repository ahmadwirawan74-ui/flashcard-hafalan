import { Component, Notice, setIcon } from "obsidian";
import type { HubView } from "../hub-view";
import { TEMPLATES } from "../templates";
import { DraftKind, bulkToMarkdown, draftToMarkdown, emptyDraft, parseCards } from "../parser";
import { NewCard } from "../card-modal";
import { TYPE_LABEL } from "../types";
import { basename, btn, md } from "../util";
import { OcclusionEditor, renderImagePicker } from "../occlusion";
import { renderTableBuilder } from "../table";

type Kind = DraftKind | "bulk" | "table";
const KIND_HELP: Record<Kind, string> = {
	single: "Pertanyaan dan jawaban singkat dalam satu baris. Nyalakan dua arah untuk kosakata/istilah.",
	multi: "Pertanyaan dan jawaban panjang, boleh beberapa baris, gambar, atau rumus.",
	list: "Jawaban berupa daftar. Saat belajar, item diungkap satu per satu agar kamu mengingat urutannya.",
	mcq: "Pilihan ganda. Centang semua jawaban yang benar, tambahkan penjelasan bila perlu.",
	cloze: "Sembunyikan bagian kalimat. Pilih teks lalu klik “Jadikan cloze”. Setiap {{…}} menjadi satu kartu.",
	occlusion: "Tutup bagian gambar (diagram, peta, anatomi). Setiap kotak menjadi satu kartu. Pilih gambar dari vault, unggah, atau tempel screenshot.",
	table: "Buat tabel (mis. unsur–lambang–nomor atom, kosakata–arti–contoh), lalu pilih cara menghafalnya: per baris, sembunyikan kolom, atau hafal tabel utuh.",
	bulk: "Tempel banyak kartu sekaligus, satu per baris: pertanyaan lalu jawaban dipisah Tab, “ = ”, “ - ”, atau “;”.",
};

const recent: { md: string; path: string }[] = [];
let bulkText = "";
let kindState: Kind = "single";
const tableState = { header: ["Istilah", "Arti", "Contoh"], rows: [["", "", ""], ["", "", ""], ["", "", ""]] };

export function renderCreate(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const s = p.data.settings;
	const d = hub.draft;
	const paths = p.sortedPaths();
	if (kindState !== "bulk" && kindState !== "table") kindState = d.kind;

	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "Buat kartu" });
	head.createDiv({ cls: "fch-muted", text: "Tip: cara tercepat adalah memblok teks di catatan, klik kanan, lalu pilih tipe kartu di bagian FLASHCARDS." });

	// ---- tujuan
	const target = el.createDiv("fch-panel fch-target");
	target.createEl("label", { cls: "fch-strong", text: "Simpan ke" });
	const sel = target.createEl("select", { cls: "dropdown fch-select fch-grow" });
	const active = hub.app.workspace.getActiveFile();
	paths.forEach((x) => sel.createEl("option", { text: x.replace(/\.md$/, ""), attr: { value: x } }));
	const lastMd = hub.app.workspace.getLastOpenFiles?.().find((x) => x.endsWith(".md") && !paths.includes(x));
	const extra = active && active.extension === "md" && !paths.includes(active.path) ? active.path : lastMd;
	if (extra) sel.createEl("option", { text: `${extra.replace(/\.md$/, "")}${s.storage === "note" ? " (akan diberi tag)" : ""}`, attr: { value: extra } });
	const pending = hub.createTarget;
	if (pending && pending !== "__new" && pending !== extra && !paths.includes(pending) && hub.app.vault.getAbstractFileByPath(pending))
		sel.createEl("option", { text: pending.replace(/\.md$/, ""), attr: { value: pending } });
	sel.createEl("option", { text: "＋ Materi baru…", attr: { value: "__new" } });
	const newIn = target.createEl("input", { type: "text", cls: "fch-input fch-grow", attr: { placeholder: "Folder/Nama materi, mis. Biologi/03 Fotosintesis" } });
	if (!hub.createTarget || (![...sel.options].some((o) => o.value === hub.createTarget))) hub.createTarget = paths[0] ?? "__new";
	sel.value = hub.createTarget;
	const syncTarget = () => {
		hub.createTarget = sel.value;
		newIn.toggleClass("is-hidden", sel.value !== "__new");
	};
	sel.onchange = syncTarget;
	syncTarget();

	// ---- tipe (seperti menu Flashcards)
	const kinds = el.createDiv("fch-kinds");
	const all: { kind: Kind; label: string; icon: string }[] = [...TEMPLATES, { kind: "table", label: "Tabel", icon: "table" }, { kind: "bulk", label: "Massal", icon: "clipboard-list" }];
	for (const t of all) {
		const b = kinds.createEl("button", { cls: "fch-kind" + (kindState === t.kind ? " is-active" : "") });
		setIcon(b.createSpan("fch-kind-ic"), t.icon);
		b.createSpan({ text: t.label });
		b.onclick = () => {
			kindState = t.kind;
			if (t.kind !== "bulk" && t.kind !== "table") d.kind = t.kind;
			hub.renderPage();
		};
	}

	if (kindState === "table") {
		const panel = el.createDiv("fch-panel");
		panel.createDiv({ cls: "fch-muted fch-small", text: KIND_HELP.table });
		renderTableBuilder(panel.createDiv(), p, async () => {
			let path = hub.createTarget;
			if (path === "__new") {
				const name = newIn.value.trim();
				if (!name) { newIn.focus(); new Notice("Tulis nama materi baru dulu."); return null; }
				path = (await p.createMaterial(name)).path;
				hub.createTarget = path;
			}
			if (!hub.app.vault.getAbstractFileByPath(path)) path = (await p.createMaterial(path)).path;
			return path;
		}, tableState);
		return;
	}
	if (kindState === "occlusion") {
		const panel = el.createDiv("fch-panel fch-io-panel");
		const top = panel.createDiv("fch-row");
		top.createDiv({ cls: "fch-muted fch-small fch-grow", text: KIND_HELP.occlusion });
		const target = hub.createTarget && hub.createTarget !== "__new" ? hub.createTarget : (paths[0] ?? "");
		if (hub.ioImage) btn(top, { text: "Ganti gambar", cls: "fch-btn-link", onClick: () => { hub.ioImage = undefined; hub.renderPage(); } });
		const host = panel.createDiv();
		if (!hub.ioImage) renderImagePicker(p, host, target || "Image Occlusion.md", (img) => { hub.ioImage = img; hub.renderPage(); });
		else new OcclusionEditor(p, host, { path: target, image: hub.ioImage }, () => { hub.ioImage = undefined; hub.renderPage(); });
		return;
	}

	const cols = el.createDiv("fch-create");
	const form = cols.createDiv("fch-panel fch-form");
	const side = cols.createDiv("fch-preview-col");
	form.createDiv({ cls: "fch-muted fch-small fch-help", text: KIND_HELP[kindState] });

	const prevBox = side.createDiv("fch-panel fch-preview");
	let comp: Component | null = null;
	const currentMd = () => (kindState === "bulk" ? bulkToMarkdown(bulkText, s).md : draftToMarkdown(d, s));
	const updatePreview = () => {
		if (comp) hub.pageComp?.removeChild(comp);
		comp = hub.pageComp ? hub.pageComp.addChild(new Component()) : new Component();
		comp.load();
		prevBox.empty();
		const text = currentMd();
		const cards = text.trim() ? parseCards(text, "preview.md", s) : [];
		const ph = prevBox.createDiv("fch-preview-head");
		ph.createSpan({ cls: "fch-strong", text: "Pratinjau" });
		ph.createSpan({ cls: "fch-pill " + (cards.length ? "is-due" : "is-done"), text: cards.length ? `${cards.length} kartu` : "belum lengkap" });
		if (!cards.length) {
			prevBox.createDiv({ cls: "fch-muted fch-small", text: "Isi pertanyaan dan jawaban untuk melihat kartu." });
		}
		for (const c of cards.slice(0, 4)) {
			const k = prevBox.createDiv("fch-pcard");
			k.createDiv({ cls: `fch-type fch-type-${c.type}`, text: TYPE_LABEL[c.type] });
			md(hub.app, comp, k.createDiv("markdown-rendered fch-pcard-front"), c.front, "");
			const back = k.createDiv("fch-pcard-back");
			if (c.type === "mcq" && c.options) {
				for (const o of c.options) back.createDiv({ cls: "fch-pcard-opt" + (o.correct ? " is-correct" : ""), text: (o.correct ? "✓ " : "○ ") + o.text });
			} else if (c.type === "list" && c.items) {
				const ol = back.createEl("ol");
				c.items.forEach((i) => ol.createEl("li", { text: i }));
			} else md(hub.app, comp, back.createDiv("markdown-rendered"), c.back, "");
		}
		if (cards.length > 4) prevBox.createDiv({ cls: "fch-muted fch-small", text: `+${cards.length - 4} kartu lainnya` });
		const code = side.querySelector(".fch-code") as HTMLElement | null;
		if (code) code.setText(text || "…");
	};
	const codeBox = side.createDiv("fch-panel");
	codeBox.createDiv({ cls: "fch-strong fch-small", text: s.storage === "plugin" ? "Sintaks setara (tidak ditulis ke catatan)" : "Ditulis ke catatan sebagai" });
	codeBox.createEl("pre", { cls: "fch-code" });

	// ---- field
	const field = (label: string, parent = form) => {
		const f = parent.createDiv("fch-field");
		f.createEl("label", { text: label });
		return f;
	};
	const input = (parent: HTMLElement, value: string, ph: string, on: (v: string) => void, area = false, rows = 3) => {
		const i = area
			? parent.createEl("textarea", { cls: "fch-input", attr: { placeholder: ph, rows: String(rows) } })
			: parent.createEl("input", { type: "text", cls: "fch-input", attr: { placeholder: ph } });
		i.value = value;
		i.oninput = () => { on(i.value); updatePreview(); };
		return i;
	};
	const bothToggle = () => {
		const t = form.createEl("label", { cls: "fch-toggle" });
		const cb = t.createEl("input", { type: "checkbox" });
		cb.checked = d.both;
		cb.onchange = () => { d.both = cb.checked; updatePreview(); };
		const tx = t.createDiv();
		tx.createDiv({ cls: "fch-strong", text: "Dua arah" });
		tx.createDiv({ cls: "fch-muted fch-small", text: "Buat juga kartu kebalikannya (jawaban → pertanyaan)." });
	};

	let first: HTMLInputElement | HTMLTextAreaElement | null = null;
	switch (kindState) {
		case "single":
			first = input(field("Pertanyaan"), d.question, "Ibu kota Jepang", (v) => (d.question = v));
			input(field("Jawaban"), d.answer, "Tokyo", (v) => (d.answer = v));
			bothToggle();
			break;
		case "multi":
			first = input(field("Pertanyaan"), d.question, "Jelaskan proses fotosintesis", (v) => (d.question = v), true, 2);
			input(field("Jawaban"), d.answer, "Tulis jawaban lengkap. Markdown, gambar, dan rumus didukung.", (v) => (d.answer = v), true, 6);
			bothToggle();
			break;
		case "list": {
			first = input(field("Pertanyaan"), d.question, "Sebutkan tahapan mitosis", (v) => (d.question = v));
			const f = field("Item jawaban (berurutan)");
			const box = f.createDiv("fch-items");
			const drawItems = (focus = -1) => {
				box.empty();
				d.items.forEach((it, i) => {
					const r = box.createDiv("fch-item");
					r.createSpan({ cls: "fch-item-n", text: `${i + 1}.` });
					const inp = input(r, it, `Item ${i + 1}`, (v) => (d.items[i] = v)) as HTMLInputElement;
					inp.addClass("fch-grow");
					inp.onkeydown = (e) => {
						if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
							e.preventDefault();
							d.items.splice(i + 1, 0, "");
							drawItems(i + 1);
						}
					};
					btn(r, { icon: "x", cls: "fch-btn-ghost fch-btn-sm", label: "Hapus item", disabled: d.items.length <= 2, onClick: () => { d.items.splice(i, 1); drawItems(); updatePreview(); } });
					if (i === focus) window.setTimeout(() => inp.focus(), 10);
				});
			};
			drawItems();
			btn(f, { text: "Tambah item", icon: "plus", cls: "fch-btn-sm", onClick: () => { d.items.push(""); drawItems(d.items.length - 1); } });
			break;
		}
		case "mcq": {
			first = input(field("Pertanyaan"), d.question, "Organel penghasil energi sel adalah…", (v) => (d.question = v), true, 2);
			const f = field("Pilihan jawaban — centang yang benar");
			const box = f.createDiv("fch-items");
			const drawOpts = (focus = -1) => {
				box.empty();
				d.options.forEach((o, i) => {
					const r = box.createDiv("fch-item" + (o.correct ? " is-correct" : ""));
					const cb = r.createEl("input", { type: "checkbox", attr: { "aria-label": "Jawaban benar" } });
					cb.checked = o.correct;
					cb.onchange = () => { o.correct = cb.checked; r.toggleClass("is-correct", cb.checked); updatePreview(); };
					const inp = input(r, o.text, `Pilihan ${String.fromCharCode(65 + i)}`, (v) => (o.text = v)) as HTMLInputElement;
					inp.addClass("fch-grow");
					inp.onkeydown = (e) => {
						if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
							e.preventDefault();
							d.options.splice(i + 1, 0, { text: "", correct: false });
							drawOpts(i + 1);
						}
					};
					btn(r, { icon: "x", cls: "fch-btn-ghost fch-btn-sm", label: "Hapus pilihan", disabled: d.options.length <= 2, onClick: () => { d.options.splice(i, 1); drawOpts(); updatePreview(); } });
					if (i === focus) window.setTimeout(() => inp.focus(), 10);
				});
			};
			drawOpts();
			btn(f, { text: "Tambah pilihan", icon: "plus", cls: "fch-btn-sm", onClick: () => { d.options.push({ text: "", correct: false }); drawOpts(d.options.length - 1); } });
			input(field("Penjelasan (opsional)"), d.explanation, "Ditampilkan setelah menjawab", (v) => (d.explanation = v), true, 2);
			break;
		}
		case "cloze": {
			const f = field("Kalimat");
			const ta = input(f, d.text, "Mitokondria menghasilkan ATP melalui respirasi sel.", (v) => (d.text = v), true, 3) as HTMLTextAreaElement;
			first = ta;
			const row = f.createDiv("fch-row");
			btn(row, {
				text: "Jadikan cloze", icon: "brackets", cls: "fch-btn-sm",
				onClick: () => {
					const a = ta.selectionStart, b = ta.selectionEnd;
					if (a === b) return void new Notice("Pilih (blok) kata yang ingin disembunyikan dulu.");
					ta.value = ta.value.slice(0, a) + "{{" + ta.value.slice(a, b) + "}}" + ta.value.slice(b);
					d.text = ta.value;
					updatePreview();
					ta.focus();
				},
			});
			row.createSpan({ cls: "fch-muted fch-small", text: "Petunjuk: {{jawaban|petunjuk}}" });
			break;
		}
		case "bulk": {
			const f = field("Daftar kartu");
			first = input(f, bulkText, "apple = apel\nbook = buku\nchair = kursi", (v) => (bulkText = v), true, 10);
			break;
		}
	}

	const store = form.createDiv("fch-store");
	store.createSpan({ cls: "fch-small fch-strong", text: "Simpan sebagai" });
	const seg = store.createDiv("fch-seg");
	for (const [v, label, tip] of [["plugin", "Kartu rapi", "Catatan tidak diubah sama sekali"], ["note", "Teks di catatan", "Ditulis dengan sintaks ::, ?, {{ }}"]] as const) {
		const b = seg.createEl("button", { cls: "fch-seg-btn" + (s.storage === v ? " is-active" : ""), text: label, attr: { "aria-label": tip } });
		b.onclick = async () => { s.storage = v; await p.saveNow(); hub.renderPage(); };
	}
	store.createSpan({ cls: "fch-muted fch-small", text: s.storage === "plugin" ? "Catatan tetap bersih." : "Kartu ditulis di akhir catatan." });

	const foot = form.createDiv("fch-form-foot");
	const save = btn(foot, { text: "Simpan kartu", icon: "check", cls: "fch-btn-primary fch-btn-lg" });
	save.createSpan({ cls: "fch-kbd", text: "Ctrl+Enter" });
	btn(foot, { text: "Kosongkan", cls: "fch-btn-ghost", onClick: () => { const k = d.kind; hub.draft = emptyDraft(k); if (kindState === "bulk") bulkText = ""; hub.renderPage(); } });

	const doSave = async () => {
		const text = currentMd();
		const n = text.trim() ? parseCards(text, "x.md", s).length : 0;
		if (!n) return void new Notice("Kartu belum lengkap. Isi pertanyaan dan jawabannya dulu.");
		let path = hub.createTarget;
		if (path === "__new") {
			const name = newIn.value.trim();
			if (!name) {
				newIn.focus();
				return void new Notice("Tulis nama materi baru dulu.");
			}
			path = (await p.createMaterial(name)).path;
			hub.createTarget = path;
		}
		if (s.storage === "plugin") {
			if (!hub.app.vault.getAbstractFileByPath(path)) path = (await p.createMaterial(path)).path;
			const parsed = parseCards(text, path, { ...s, enableCloze: true });
			const byLine = new Map<number, NewCard[]>();
			for (const c of parsed) (byLine.get(c.line) ?? byLine.set(c.line, []).get(c.line)!).push({ type: c.type, front: c.front, back: c.back, answer: c.answer, items: c.items, options: c.options, explanation: c.explanation });
			for (const group of byLine.values()) {
				if (group.every((g) => g.type === "cloze")) group.forEach((g) => p.saveStored(path, [g]));
				else p.saveStored(path, group);
			}
		} else await p.appendToNote(path, text);
		recent.unshift({ md: text, path });
		recent.splice(8);
		new Notice(`✓ ${n} kartu ditambahkan ke ${basename(path)}`);
		hub.draft = emptyDraft(d.kind);
		if (kindState === "bulk") bulkText = "";
		hub.renderPage();
	};
	save.onclick = () => void doSave();
	el.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			void doSave();
		}
	});

	if (recent.length) {
		const r = side.createDiv("fch-panel");
		r.createDiv({ cls: "fch-strong fch-small", text: "Baru saja ditambahkan" });
		for (const x of recent) {
			const row = r.createDiv("fch-recent");
			row.createDiv({ cls: "fch-recent-md", text: x.md.split("\n")[0] });
			row.createDiv({ cls: "fch-muted fch-small", text: basename(x.path) });
			row.onclick = () => void p.openAt(x.path, 0);
		}
	}

	updatePreview();
	window.setTimeout(() => first?.focus(), 30);
}
