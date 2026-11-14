import { Notice, TFile, normalizePath, setIcon } from "obsidian";
import type { HubView } from "./hub-view";
import type FlashcardPlugin from "./main";
import { CardModal } from "./card-modal";
import { extractSource } from "./anchor";
import { addTask } from "./tasks";
import { dayKey } from "./scheduler";
import { basename, btn, md, plainText } from "./util";
import { play } from "./sound";

export const COLORS: { id: string; label: string; bg: string }[] = [
	{ id: "", label: "Polos", bg: "transparent" },
	{ id: "kuning", label: "Kuning", bg: "#fde68a" },
	{ id: "pink", label: "Merah muda", bg: "#fbcfe8" },
	{ id: "biru", label: "Biru", bg: "#bfdbfe" },
	{ id: "hijau", label: "Hijau", bg: "#bbf7d0" },
	{ id: "ungu", label: "Ungu", bg: "#ddd6fe" },
	{ id: "oranye", label: "Oranye", bg: "#fed7aa" },
];

const TEMPLATES: { id: string; label: string; icon: string; body: (title: string) => string }[] = [
	{ id: "kosong", label: "Kosong", icon: "📄", body: () => "" },
	{ id: "cornell", label: "Cornell", icon: "📐", body: () =>
		"> Tulis pertanyaan dan catatan dengan urutan yang sama: butir ke-1 Pertanyaan ↔ butir ke-1 Catatan. Lalu klik **Cornell → Kartu**.\n\n## ❓ Pertanyaan / kata kunci\n- \n\n## 📝 Catatan\n- \n\n## 🧾 Ringkasan\n(Tulis ringkasan 2–3 kalimat dengan kata-katamu sendiri.)\n" },
	{ id: "bab", label: "Ringkasan bab", icon: "📚", body: () =>
		"## 🎯 Tujuan belajar\n- \n\n## 🔑 Konsep utama\n1. \n\n## 📌 Istilah penting\n- **Istilah** — arti\n\n## ❔ Pertanyaan yang masih bingung\n- \n\n## ✅ Langkah selanjutnya\n- [ ] Buat flashcard dari istilah penting\n" },
	{ id: "kuliah", label: "Catatan kuliah", icon: "🎓", body: () =>
		"**Mata kuliah:** \n**Dosen:** \n**Pertemuan ke-:** \n\n## Materi\n- \n\n## Tugas & tenggat\n- [ ] \n\n## Pertanyaan untuk dosen\n- \n" },
	{ id: "jurnal", label: "Jurnal belajar", icon: "📔", body: () =>
		"## Hari ini aku belajar\n- \n\n## Yang paling sulit\n- \n\n## Yang ingin kuulang besok\n- [ ] \n\n## Suasana hati\n😀 😐 😟\n" },
];

let editing = "";
let query = "";
let preview = false;
let matFilter = "";

const folderOf = (p: FlashcardPlugin) => normalizePath(p.data.settings.notesFolder || "Catatan Belajar");

export function noteFiles(p: FlashcardPlugin): TFile[] {
	const f = folderOf(p) + "/";
	return p.app.vault.getMarkdownFiles().filter((x) => x.path.startsWith(f));
}

const fm = (p: FlashcardPlugin, f: TFile) => (p.app.metadataCache.getFileCache(f)?.frontmatter ?? {}) as Record<string, unknown>;

async function ensureFolder(p: FlashcardPlugin) {
	const f = folderOf(p);
	if (!p.app.vault.getAbstractFileByPath(f)) await p.app.vault.createFolder(f);
	return f;
}

export async function createNote(p: FlashcardPlugin, title: string, tpl = "kosong", extra: Record<string, string> = {}): Promise<TFile> {
	const folder = await ensureFolder(p);
	const safe = (title.trim() || "Catatan tanpa judul").replace(/[\\/:*?"<>|#^[\]]/g, "-");
	let path = normalizePath(`${folder}/${safe}.md`);
	for (let i = 2; p.app.vault.getAbstractFileByPath(path); i++) path = normalizePath(`${folder}/${safe} ${i}.md`);
	const t = TEMPLATES.find((x) => x.id === tpl) ?? TEMPLATES[0];
	const meta = Object.entries({ dibuat: dayKey(Date.now()), ...extra }).map(([k, v]) => `${k}: ${v}`).join("\n");
	const f = await p.app.vault.create(path, `---\n${meta}\n---\n${t.body(safe)}`);
	p.data.meta.notesCreated = (p.data.meta.notesCreated ?? 0) + 1;
	p.requestSave();
	p.checkAchievements();
	return f;
}

/** Jurnal harian: buka (atau buat) catatan bertanggal hari ini. */
export async function openJournal(hub: HubView) {
	const p = hub.plugin;
	const name = `Jurnal ${dayKey(Date.now())}`;
	const path = normalizePath(`${folderOf(p)}/${name}.md`);
	const f = p.app.vault.getAbstractFileByPath(path);
	editing = f instanceof TFile ? f.path : (await createNote(p, name, "jurnal", { warna: "kuning" })).path;
	hub.navigate("notes");
}

function split(content: string): { head: string; body: string } {
	const m = /^---\n[\s\S]*?\n---\n?/.exec(content);
	return m ? { head: m[0], body: content.slice(m[0].length) } : { head: "", body: content };
}

export function renderNotes(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	if (editing) {
		const f = p.app.vault.getAbstractFileByPath(editing);
		if (f instanceof TFile) return void renderEditor(hub, el, f);
		editing = "";
	}
	const head = el.createDiv("fch-pagehead fch-pagehead-row");
	const ht = head.createDiv();
	ht.createEl("h1", { text: "🗒️ Catatan" });
	ht.createDiv({ cls: "fch-muted", text: `Catatan Markdown biasa di folder “${folderOf(p)}”, jadi bisa ditautkan, dicari, dan disinkronkan seperti catatan Obsidian lainnya.` });
	const hr = head.createDiv("fch-row");
	btn(hr, { text: "Jurnal hari ini", icon: "calendar-days", onClick: () => void openJournal(hub) });

	// template catatan baru
	const tp = el.createDiv("fch-note-templates");
	for (const t of TEMPLATES) {
		const b = tp.createEl("button", { cls: "fch-note-tpl" });
		b.createDiv({ cls: "fch-note-tpl-ic", text: t.icon });
		b.createDiv({ cls: "fch-small fch-strong", text: t.id === "kosong" ? "Catatan baru" : t.label });
		b.onclick = async () => { const f = await createNote(p, t.id === "kosong" ? "Catatan baru" : `${t.label} ${dayKey(Date.now())}`, t.id); editing = f.path; play("click"); hub.renderPage(); };
	}

	const bar = el.createDiv("fch-browse-bar");
	const s = bar.createEl("input", { type: "search", cls: "fch-input fch-grow", attr: { placeholder: "Cari catatan…" } });
	s.value = query;
	const ms = bar.createEl("select", { cls: "dropdown fch-select" });
	ms.createEl("option", { text: "Semua materi", attr: { value: "" } });
	p.sortedPaths().forEach((x) => ms.createEl("option", { text: basename(x), attr: { value: basename(x) } }));
	ms.value = matFilter;
	const grid = el.createDiv("fch-notes");
	const files = noteFiles(p);
	const draw = async () => {
		grid.empty();
		const q = query.toLowerCase();
		const rows = await Promise.all(files.map(async (f) => ({ f, m: fm(p, f), text: split(await p.app.vault.cachedRead(f)).body })));
		const shown = rows.filter((r) => (!q || (r.f.basename + " " + r.text).toLowerCase().includes(q)) && (!matFilter || String(r.m.materi ?? "").includes(matFilter)))
			.sort((a, b) => Number(!!b.m.sematkan) - Number(!!a.m.sematkan) || b.f.stat.mtime - a.f.stat.mtime);
		if (!shown.length) grid.createDiv({ cls: "fch-empty", text: files.length ? "Tidak ada catatan yang cocok." : "Belum ada catatan. Pilih template di atas untuk mulai menulis." });
		for (const r of shown) {
			const col = COLORS.find((c) => c.id === r.m.warna);
			const c = grid.createEl("button", { cls: "fch-note" + (col?.id ? " has-color" : "") });
			if (col?.id) c.style.setProperty("--note", col.bg);
			const top = c.createDiv("fch-note-top");
			top.createDiv({ cls: "fch-note-title", text: r.f.basename });
			if (r.m.sematkan) top.createSpan({ text: "📌" });
			const body = plainText(r.text).slice(0, 180);
			c.createDiv({ cls: "fch-note-body", text: body || "(kosong)" });
			const foot = c.createDiv("fch-note-foot");
			if (r.m.materi) foot.createSpan({ cls: "fch-note-mat", text: "📘 " + String(r.m.materi).replace(/\[\[|\]\]/g, "") });
			const todo = (r.text.match(/- \[ \]/g) ?? []).length;
			if (todo) foot.createSpan({ text: `☐ ${todo}` });
			foot.createSpan({ cls: "fch-muted", text: new Date(r.f.stat.mtime).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) });
			c.onclick = () => { editing = r.f.path; preview = false; hub.renderPage(); };
		}
	};
	let tm: number | undefined;
	s.oninput = () => { window.clearTimeout(tm); tm = window.setTimeout(() => { query = s.value; void draw(); }, 150); };
	ms.onchange = () => { matFilter = ms.value; void draw(); };
	void draw();
}

async function renderEditor(hub: HubView, el: HTMLElement, f: TFile) {
	const p = hub.plugin;
	const content = await p.app.vault.read(f);
	let { head, body } = split(content);
	const meta = fm(p, f);
	const wrap = el.createDiv("fch-note-editor");
	const col = COLORS.find((c) => c.id === meta.warna);
	if (col?.id) wrap.style.setProperty("--note", col.bg);
	const top = wrap.createDiv("fch-note-ed-top");
	btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Kembali ke daftar", onClick: () => { editing = ""; hub.renderPage(); } });
	const title = top.createEl("input", { type: "text", cls: "fch-input fch-note-ed-title" });
	title.value = f.basename;
	title.onchange = async () => {
		const n = title.value.trim().replace(/[\\/:*?"<>|#^[\]]/g, "-");
		if (!n || n === f.basename) return;
		const np = normalizePath(`${f.parent?.path ?? ""}/${n}.md`);
		if (p.app.vault.getAbstractFileByPath(np)) return void new Notice("Nama itu sudah dipakai.");
		await p.app.fileManager.renameFile(f, np);
		editing = np;
	};
	const status = top.createSpan({ cls: "fch-muted fch-small", text: "tersimpan" });

	const tools = wrap.createDiv("fch-note-tools");
	const dots = tools.createDiv("fch-note-dots");
	for (const c of COLORS) {
		const d = dots.createEl("button", { cls: "fch-color-dot" + ((meta.warna ?? "") === c.id ? " is-on" : ""), attr: { "aria-label": c.label } });
		d.style.setProperty("--dot", c.id ? c.bg : "transparent");
		d.onclick = async () => { await p.app.fileManager.processFrontMatter(f, (x: Record<string, unknown>) => { if (c.id) x.warna = c.id; else delete x.warna; }); window.setTimeout(() => hub.renderPage(), 150); };
	}
	btn(tools, { icon: "pin", cls: "fch-btn-ghost fch-btn-sm" + (meta.sematkan ? " is-on" : ""), label: meta.sematkan ? "Lepas sematan" : "Sematkan di atas", onClick: async () => { await p.app.fileManager.processFrontMatter(f, (x: Record<string, unknown>) => { if (x.sematkan) delete x.sematkan; else x.sematkan = true; }); window.setTimeout(() => hub.renderPage(), 150); } });
	const mat = tools.createEl("select", { cls: "dropdown fch-select" });
	mat.createEl("option", { text: "📘 Tautkan materi…", attr: { value: "" } });
	p.sortedPaths().forEach((x) => mat.createEl("option", { text: basename(x), attr: { value: basename(x) } }));
	mat.value = String(meta.materi ?? "").replace(/\[\[|\]\]/g, "");
	mat.onchange = async () => { await p.app.fileManager.processFrontMatter(f, (x: Record<string, unknown>) => { if (mat.value) x.materi = `[[${mat.value}]]`; else delete x.materi; }); };
	tools.createDiv("fch-grow");
	const pv = btn(tools, { text: preview ? "Edit" : "Pratinjau", icon: preview ? "pencil" : "eye", cls: "fch-btn-sm", onClick: () => { preview = !preview; hub.renderPage(); } });
	void pv;

	const fmtBar = wrap.createDiv("fch-note-fmt");
	const area = wrap.createEl("textarea", { cls: "fch-input fch-note-area", attr: { placeholder: "Mulai menulis… (Markdown didukung)" } });
	area.value = body;
	const out = wrap.createDiv("fch-note-preview markdown-rendered");
	if (preview) { area.style.display = "none"; fmtBar.style.display = "none"; if (hub.pageComp) md(p.app, hub.pageComp, out, body, f.path); }
	else out.style.display = "none";

	let timer: number | undefined;
	const save = () => {
		status.setText("menyimpan…");
		window.clearTimeout(timer);
		timer = window.setTimeout(async () => {
			body = area.value;
			const cur = await p.app.vault.read(f);
			head = split(cur).head;
			await p.app.vault.modify(f, head + body);
			status.setText("✓ tersimpan");
			stats();
		}, 600);
	};
	area.oninput = save;
	const wrapSel = (a: string, b = a, ph = "teks") => {
		const s = area.selectionStart, e = area.selectionEnd;
		const sel = area.value.slice(s, e) || ph;
		area.setRangeText(a + sel + b, s, e, "select");
		area.focus();
		save();
	};
	const linePrefix = (pre: string) => {
		const s = area.selectionStart;
		const ls = area.value.lastIndexOf("\n", s - 1) + 1;
		area.setRangeText(pre, ls, ls, "end");
		area.focus();
		save();
	};
	const tb = (label: string, tip: string, fn: () => void) => { const b = fmtBar.createEl("button", { cls: "fch-fmt-btn", text: label, attr: { "aria-label": tip } }); b.onclick = fn; };
	tb("B", "Tebal", () => wrapSel("**"));
	tb("I", "Miring", () => wrapSel("*"));
	tb("H", "Judul", () => linePrefix("## "));
	tb("•", "Daftar", () => linePrefix("- "));
	tb("☐", "Checklist", () => linePrefix("- [ ] "));
	tb("==", "Sorot", () => wrapSel("=="));
	tb("[[ ]]", "Tautan catatan", () => wrapSel("[[", "]]", "Nama catatan"));
	fmtBar.createDiv("fch-grow");
	if (/^##\s*❓/m.test(area.value)) btn(fmtBar, { text: "Cornell → Kartu", icon: "layers", cls: "fch-btn-sm fch-btn-primary", label: "Buat flashcard dari kolom Pertanyaan & Catatan", onClick: () => {
		const n = cornellToCards(p, f.path, f.basename, area.value);
		new Notice(n ? `🧠 ${n} kartu dibuat dari catatan Cornell` : "Tidak ada pasangan baru. Isi daftar di bagian Pertanyaan dan Catatan dengan urutan yang sama.");
		if (n) play("coin");
	} });
	const selText = () => area.value.slice(area.selectionStart, area.selectionEnd).trim();
	btn(fmtBar, { text: "→ Kartu", icon: "copy", cls: "fch-btn-sm", label: "Jadikan teks terpilih flashcard", onClick: () => {
		const s = area.selectionStart, e = area.selectionEnd;
		const full = head + area.value;
		if (s === e) return void new CardModal(p.app, p, { path: f.path, kind: "single" }).open();
		new CardModal(p.app, p, { path: f.path, kind: area.value.slice(s, e).includes("\n") ? "multi" : "cloze", source: extractSource(full, head.length + s, head.length + e) }).open();
	} });
	btn(fmtBar, { text: "→ Tugas", icon: "check-square", cls: "fch-btn-sm", label: "Jadikan teks terpilih tugas", onClick: () => {
		const t = selText() || area.value.split("\n")[area.value.slice(0, area.selectionStart).split("\n").length - 1]?.replace(/^\s*[-*]\s*(\[.\]\s*)?/, "");
		if (!t?.trim()) return void new Notice("Pilih teks yang ingin dijadikan tugas.");
		const task = addTask(p, t.trim());
		if (task) { task.notes = `Dari catatan [[${f.basename}]]`; new Notice(`✅ Tugas ditambahkan: ${task.title}`); play("click"); }
	} });

	const foot = wrap.createDiv("fch-note-foot2");
	const st = foot.createSpan({ cls: "fch-muted fch-small" });
	const stats = () => {
		const words = (area.value.match(/[\p{L}\p{N}]+/gu) ?? []).length;
		const todo = (area.value.match(/- \[ \]/g) ?? []).length, done = (area.value.match(/- \[x\]/gi) ?? []).length;
		st.setText(`${words} kata · ±${Math.max(1, Math.round(words / 200))} menit baca` + (todo + done ? ` · checklist ${done}/${todo + done}` : ""));
	};
	stats();
	foot.createDiv("fch-grow");
	btn(foot, { text: "Buka di Obsidian", icon: "file-text", cls: "fch-btn-sm", onClick: () => void p.openAt(f.path, 0) });
	btn(foot, { text: "Hapus", icon: "trash-2", cls: "fch-btn-ghost fch-btn-sm fch-danger", onClick: async () => {
		if (!window.confirm(`Hapus catatan “${f.basename}”? (dipindah ke tempat sampah)`)) return;
		await p.app.vault.trash(f, true);
		editing = "";
		hub.renderPage();
	} });
	if (!preview) window.setTimeout(() => area.focus(), 40);
}

/** Catatan yang dibuat/diubah pada tanggal tertentu (untuk Kalender). */
export function notesOn(p: FlashcardPlugin, k: string): TFile[] {
	return noteFiles(p).filter((f) => dayKey(f.stat.ctime) === k || String(fm(p, f).dibuat ?? "") === k);
}
export const openNote = (path: string) => { editing = path; };
void setIcon;

/** Pasangkan butir ke-i di "Pertanyaan" dengan butir ke-i di "Catatan"; "Ringkasan" menjadi kartu Jelaskan. */
export function cornellToCards(p: FlashcardPlugin, path: string, title: string, body: string): number {
	const section = (re: RegExp) => {
		const m = re.exec(body);
		if (!m) return [] as string[];
		const rest = body.slice(m.index + m[0].length);
		const end = rest.search(/^##\s/m);
		return (end >= 0 ? rest.slice(0, end) : rest).split("\n");
	};
	const bullets = (lines: string[]) => lines.map((l) => /^\s*(?:[-*]|\d+[.)])\s+(.+)$/.exec(l)?.[1]?.trim() ?? "").filter((x) => x && !/^\[.\]/.test(x));
	const qs = bullets(section(/^##\s*❓.*$/m));
	const ns = bullets(section(/^##\s*📝.*$/m));
	const summary = section(/^##\s*🧾.*$/m).join("\n").trim();
	const have = new Set(Object.values(p.data.stored).filter((x) => x.path === path).map((x) => x.front));
	let n = 0;
	for (let i = 0; i < Math.min(qs.length, ns.length); i++) {
		if (have.has(qs[i])) continue;
		p.saveStored(path, [{ type: "basic", front: qs[i], back: ns[i], anchor: { text: ns[i], answer: ns[i], pos: 0 } }]);
		n++;
	}
	const front = `Jelaskan inti dari “${title}”`;
	if (summary && !summary.startsWith("(Tulis") && !have.has(front)) {
		p.saveStored(path, [{ type: "multiline", front, back: summary }]);
		n++;
	}
	return n;
}
