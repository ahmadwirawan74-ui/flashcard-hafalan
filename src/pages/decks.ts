import { Notice } from "obsidian";
import type { HubView } from "../hub-view";
import { basename, btn, folderOf, ring, seqLabel } from "../util";

export function renderDecks(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const s = p.data.settings;
	const paths = p.sortedPaths();

	const head = el.createDiv("fch-pagehead fch-pagehead-row");
	const ht = head.createDiv();
	ht.createEl("h1", { text: "Materi" });
	ht.createDiv({ cls: "fch-muted", text: "Diurutkan sesuai nama file. Beri nomor seperti “01 Pengantar” untuk mengatur urutan." });
	const newBox = el.createDiv("fch-panel fch-newmat is-hidden");
	btn(head, { text: "Materi baru", icon: "folder-plus", cls: "fch-btn-primary", onClick: () => { newBox.toggleClass("is-hidden", !newBox.hasClass("is-hidden")); newBox.querySelector("input")?.focus(); } });

	// ---- form materi baru
	const folders = [...new Set(paths.map(folderOf).filter(Boolean))];
	newBox.createDiv({ cls: "fch-strong", text: "Buat catatan materi baru" });
	const row = newBox.createDiv("fch-row");
	const dl = newBox.createEl("datalist", { attr: { id: "fch-folders" } });
	folders.forEach((f) => dl.createEl("option", { attr: { value: f } }));
	const fIn = row.createEl("input", { type: "text", cls: "fch-input", attr: { placeholder: "Folder (opsional)", list: "fch-folders" } });
	const nIn = row.createEl("input", { type: "text", cls: "fch-input fch-grow", attr: { placeholder: "Nama materi, mis. 03 Fotosintesis" } });
	const create = async () => {
		const name = nIn.value.trim();
		if (!name) return nIn.focus();
		const f = await p.createMaterial((fIn.value.trim() ? fIn.value.trim().replace(/\/$/, "") + "/" : "") + name);
		hub.createTarget = f.path;
		hub.navigate("create");
	};
	nIn.onkeydown = (e) => { if (e.key === "Enter") void create(); };
	btn(row, { text: "Buat & tambah kartu", cls: "fch-btn-primary", onClick: () => void create() });

	if (!paths.length) {
		el.createDiv({ cls: "fch-empty", text: `Belum ada materi. Buat materi baru di atas, atau tambahkan tag ${s.tag} ke catatan yang sudah ada.` });
		return;
	}

	const search = el.createEl("input", { type: "search", cls: "fch-input fch-search", attr: { placeholder: "Cari materi" } });
	const listEl = el.createDiv();
	const draw = () => {
		listEl.empty();
		const q = search.value.toLowerCase().trim();
		const shown = q ? paths.filter((x) => x.toLowerCase().includes(q)) : paths;
		const groups = new Map<string, string[]>();
		for (const x of shown) (groups.get(folderOf(x)) ?? groups.set(folderOf(x), []).get(folderOf(x))!).push(x);
		for (const [folder, files] of groups) {
			const g = listEl.createDiv("fch-group");
			const gh = g.createDiv("fch-group-head");
			const c = p.countFor(files);
			gh.createEl("h3", { text: folder || "Tanpa folder" });
			gh.createSpan({ cls: "fch-muted", text: `${files.length} materi · ${c.total} kartu` });
			if (folder) btn(gh, { text: "Belajar folder", icon: "play", cls: "fch-btn-sm", onClick: () => hub.startSession(p.pathsInFolder(folder).flatMap((x) => p.index.get(x) ?? []), { title: folder.split("/").pop()!, cram: false, mode: s.defaultMode }) });
			const grid = g.createDiv("fch-deck-grid");
			for (const path of files) deckTile(hub, grid, path, paths.indexOf(path) + 1);
		}
		if (!shown.length) listEl.createDiv({ cls: "fch-empty", text: "Tidak ada materi yang cocok." });
	};
	search.oninput = draw;
	draw();
}

function deckTile(hub: HubView, grid: HTMLElement, path: string, seq: number) {
	const p = hub.plugin;
	const mode = p.data.settings.defaultMode;
	const c = p.countFor([path]);
	const name = basename(path);
	const cards = () => p.index.get(path) ?? [];
	const learned = c.total ? (c.total - c.fresh) / c.total : 0;

	const t = grid.createDiv("fch-deck");
	const top = t.createDiv("fch-deck-top");
	const sq = seqLabel(path, seq);
	if (sq) top.createDiv({ cls: "fch-seq", text: sq });
	else top.createDiv();
	ring(top, learned, 46, `${Math.round(learned * 100)}%`);
	t.createDiv({ cls: "fch-deck-name", text: name });
	t.createDiv({ cls: "fch-muted fch-small", text: `${c.total} kartu · ${c.mature} matang` + (c.retention !== null ? ` · retensi ${Math.round(c.retention * 100)}%` : "") });
	const pills = t.createDiv("fch-pills");
	if (c.due) pills.createSpan({ cls: "fch-pill is-due", text: `${c.due} ulasan` });
	if (c.fresh) pills.createSpan({ cls: "fch-pill is-new", text: `${c.fresh} baru` });
	if (!c.due && !c.fresh) pills.createSpan({ cls: "fch-pill is-done", text: "✓ beres" });

	const act = t.createDiv("fch-deck-act");
	btn(act, { text: "Belajar", icon: "play", cls: "fch-btn-primary fch-btn-sm fch-grow", onClick: () => hub.startSession(cards(), { title: name, cram: false, mode }) });
	btn(act, { icon: "zap", cls: "fch-btn-sm", label: "Cram: ulas semua", onClick: () => hub.startSession(cards(), { title: name, cram: true, mode }) });
	btn(act, { icon: "list-checks", cls: "fch-btn-sm", label: "Kuis pilihan ganda", onClick: () => hub.startSession(cards(), { title: name, cram: true, mode: "quiz" }) });
	btn(act, { icon: "puzzle", cls: "fch-btn-sm", label: "Cocokkan", onClick: () => hub.startMatch(cards(), name) });
	btn(act, { icon: "plus", cls: "fch-btn-sm", label: "Tambah kartu", onClick: () => { hub.createTarget = path; hub.navigate("create"); } });
	btn(act, { icon: "file-text", cls: "fch-btn-sm", label: "Buka catatan", onClick: () => void p.openAt(path, 0) });
	btn(act, { icon: "git-fork", cls: "fch-btn-sm", label: "Peta pikiran", onClick: () => hub.openMindmap(path) });
	btn(act, { icon: "copy-plus", cls: "fch-btn-sm", label: "Buat variasi otomatis (kebalikan, cloze, pilihan ganda)", onClick: () => {
		const base = cards().filter((c) => ["basic", "multiline", "cloze"].includes(c.type) && !(c.stored && p.data.stored[c.stored]?.variantOf));
		if (!base.length) return void new Notice("Tidak ada kartu yang bisa dibuat variasinya.");
		if (!window.confirm(`Buat variasi untuk ${base.length} kartu di “${name}”? Kartu asli tidak diubah.`)) return;
		let n = 0;
		for (const c of base) n += p.makeVariations(c);
		new Notice(`✓ ${n} kartu variasi dibuat`);
	} });
}
