import { App, Modal, Notice, TFile, loadPdfJs, normalizePath } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { ReadingItem } from "./types";
import { addDays, dayKey, startOfDay } from "./scheduler";
import { extractSource } from "./anchor";
import { CardModal } from "./card-modal";
import { btn } from "./util";
import { play } from "./sound";

const uid = () => "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const FOLDER = "Bacaan";
const words = (t: string) => (t.match(/\S+/g) ?? []).length;

export interface Chunk { start: number; end: number; text: string; heading: string }
/** Pecah isi catatan per paragraf menjadi potongan ±size kata (judul memulai potongan baru). */
export function chunkText(content: string, size = 250): Chunk[] {
	let body0 = 0;
	const fm = content.match(/^---\n[\s\S]*?\n---\n/);
	if (fm) body0 = fm[0].length;
	const re = /\n\s*\n/g;
	const paras: { s: number; e: number }[] = [];
	let last = body0, m: RegExpExecArray | null;
	re.lastIndex = body0;
	while ((m = re.exec(content))) { if (m.index > last) paras.push({ s: last, e: m.index }); last = m.index + m[0].length; }
	if (last < content.length) paras.push({ s: last, e: content.length });
	const out: Chunk[] = [];
	let cur: { s: number; e: number; w: number; h: string } | null = null;
	let heading = "";
	for (const pr of paras) {
		const t = content.slice(pr.s, pr.e);
		if (!t.trim()) continue;
		const isH = /^#{1,6}\s/.test(t.trim());
		if (isH) heading = t.trim().replace(/^#+\s*/, "").split("\n")[0];
		const w = words(t);
		if (cur && (cur.w + w > size * 1.25 || (isH && cur.w >= size * 0.4))) { out.push({ start: cur.s, end: cur.e, text: content.slice(cur.s, cur.e), heading: cur.h }); cur = null; }
		if (!cur) cur = { s: pr.s, e: pr.e, w: 0, h: heading };
		cur.e = pr.e;
		cur.w += w;
	}
	if (cur) out.push({ start: cur.s, end: cur.e, text: content.slice(cur.s, cur.e), heading: cur.h });
	return out;
}

async function readChunks(p: FlashcardPlugin, it: ReadingItem): Promise<{ content: string; chunks: Chunk[] } | null> {
	const f = p.app.vault.getAbstractFileByPath(it.path);
	if (!(f instanceof TFile)) return null;
	const content = await p.app.vault.cachedRead(f);
	return { content, chunks: chunkText(content, it.size ?? 250) };
}
const due = (it: ReadingItem) => !it.done && it.next <= dayKey(Date.now());
const readToday = (it: ReadingItem) => it.log[dayKey(Date.now())] ?? 0;
export const readingDue = (p: FlashcardPlugin) => p.data.reading.filter((it) => due(it) && readToday(it) < it.perDay);

async function ensureFolder(p: FlashcardPlugin) { if (!p.app.vault.getAbstractFileByPath(FOLDER)) await p.app.vault.createFolder(FOLDER).catch(() => undefined); }
async function freeName(p: FlashcardPlugin, title: string) {
	const base = title.replace(/[\\/:*?"<>|#^[\]]/g, " ").trim().slice(0, 80) || "Bacaan";
	let path = normalizePath(`${FOLDER}/${base}.md`), i = 2;
	while (p.app.vault.getAbstractFileByPath(path)) path = normalizePath(`${FOLDER}/${base} ${i++}.md`);
	return path;
}

/** Ambil teks PDF dengan pdf.js bawaan Obsidian. */
async function pdfText(p: FlashcardPlugin, f: TFile): Promise<string> {
	const pdfjs = await loadPdfJs();
	const doc = await pdfjs.getDocument({ data: new Uint8Array(await p.app.vault.readBinary(f)) }).promise;
	const pages: string[] = [];
	for (let i = 1; i <= doc.numPages; i++) {
		const tc = await (await doc.getPage(i)).getTextContent();
		let line = "", out = "";
		let lastY: number | null = null;
		for (const it of tc.items as { str: string; transform: number[]; hasEOL?: boolean }[]) {
			const y = it.transform?.[5];
			if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 14) { out += line.trim() + "\n\n"; line = ""; }
			else if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) line += " ";
			line += it.str;
			lastY = y ?? lastY;
		}
		out += line.trim();
		pages.push(`## Halaman ${i}\n\n${out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()}`);
	}
	return pages.join("\n\n");
}

// ---------------------------------------------------------------- tambah bacaan
class AddReadingModal extends Modal {
	private tab: "note" | "paste" | "pdf" = "note";
	private perDay = 1;
	private every = 1;
	private size = 250;
	constructor(app: App, private p: FlashcardPlugin, private done: (it: ReadingItem) => void) { super(app); }
	onOpen() {
		this.modalEl.addClass("fch-modal");
		const el = this.contentEl;
		el.empty();
		el.createDiv({ cls: "fch-modal-title", text: "📖 Bacaan baru" });
		const seg = el.createDiv("fch-seg");
		for (const [v, l] of [["note", "Catatan di vault"], ["paste", "Tempel teks / artikel"], ["pdf", "PDF di vault"]] as const) {
			const b = seg.createEl("button", { cls: "fch-seg-btn" + (this.tab === v ? " is-active" : ""), text: l });
			b.onclick = () => { this.tab = v; this.onOpen(); };
		}
		const f = (l: string) => { const x = el.createDiv("fch-field"); x.createEl("label", { text: l }); return x; };
		let get: () => Promise<{ title: string; path: string; pdf?: string } | null>;
		if (this.tab === "note") {
			const i = f("Catatan").createEl("input", { type: "text", cls: "fch-input", attr: { list: "fch-rd-notes", placeholder: "Ketik nama catatan panjang…" } });
			const dl = el.createEl("datalist", { attr: { id: "fch-rd-notes" } });
			for (const x of this.p.app.vault.getMarkdownFiles().slice(0, 500)) dl.createEl("option", { attr: { value: x.path } });
			get = async () => { const file = this.p.app.vault.getAbstractFileByPath(i.value.trim()); if (!(file instanceof TFile)) { new Notice("Catatan tidak ditemukan."); return null; } return { title: file.basename, path: file.path }; };
		} else if (this.tab === "paste") {
			const t = f("Judul").createEl("input", { type: "text", cls: "fch-input", attr: { placeholder: "mis. Bab 4 — Sistem Peredaran Darah" } });
			const ta = f("Teks").createEl("textarea", { cls: "fch-input fch-rd-paste", attr: { rows: "8", placeholder: "Tempel artikel atau bab buku di sini. Pisahkan paragraf dengan baris kosong." } });
			get = async () => {
				if (!t.value.trim() || words(ta.value) < 30) { new Notice("Isi judul dan teks (minimal 30 kata)."); return null; }
				await ensureFolder(this.p);
				const path = await freeName(this.p, t.value);
				await this.p.app.vault.create(path, `# ${t.value.trim()}\n\n${ta.value.trim()}\n`);
				return { title: t.value.trim(), path };
			};
		} else {
			const i = f("File PDF").createEl("select", { cls: "dropdown fch-select" });
			const pdfs = this.p.app.vault.getFiles().filter((x) => x.extension === "pdf");
			for (const x of pdfs) i.createEl("option", { text: x.path, attr: { value: x.path } });
			if (!pdfs.length) el.createDiv({ cls: "fch-muted fch-small", text: "Belum ada PDF di vault. Seret file PDF ke Obsidian dulu." });
			el.createDiv({ cls: "fch-muted fch-small", text: "Teks PDF diambil dan disimpan sebagai catatan di folder “Bacaan”. PDF hasil pindaian (gambar) tidak punya teks yang bisa dibaca." });
			get = async () => {
				const file = this.p.app.vault.getAbstractFileByPath(i.value);
				if (!(file instanceof TFile)) return null;
				new Notice("⏳ Mengambil teks PDF…");
				let text = "";
				try { text = await pdfText(this.p, file); } catch (e) { new Notice("Gagal membaca PDF: " + (e as Error).message); return null; }
				if (words(text) < 30) { new Notice("PDF ini tidak berisi teks yang bisa dibaca (mungkin hasil pindaian)."); return null; }
				await ensureFolder(this.p);
				const path = await freeName(this.p, file.basename);
				await this.p.app.vault.create(path, `# ${file.basename}\n\n> Sumber: [[${file.path}]]\n\n${text}\n`);
				return { title: file.basename, path, pdf: file.path };
			};
		}
		const row = el.createDiv("fch-task-grid fch-mt");
		const sel = (label: string, opts: [number, string][], val: number, set: (v: number) => void) => {
			const x = row.createDiv("fch-field");
			x.createEl("label", { text: label });
			const s = x.createEl("select", { cls: "dropdown fch-select" });
			for (const [v, l] of opts) s.createEl("option", { text: l, attr: { value: String(v) } });
			s.value = String(val);
			s.onchange = () => set(parseInt(s.value, 10));
		};
		sel("Potongan per sesi", [[1, "1 potongan"], [2, "2 potongan"], [3, "3 potongan"], [5, "5 potongan"]], this.perDay, (v) => (this.perDay = v));
		sel("Jadwal", [[1, "Setiap hari"], [2, "Setiap 2 hari"], [3, "Setiap 3 hari"], [7, "Seminggu sekali"]], this.every, (v) => (this.every = v));
		sel("Panjang potongan", [[150, "Pendek (±150 kata)"], [250, "Sedang (±250 kata)"], [400, "Panjang (±400 kata)"]], this.size, (v) => (this.size = v));
		const foot = el.createDiv("fch-modal-foot fch-mt");
		foot.createDiv("fch-grow");
		btn(foot, { text: "Batal", cls: "fch-btn-ghost", onClick: () => this.close() });
		btn(foot, { text: "Tambahkan", icon: "check", cls: "fch-btn-primary", onClick: async () => {
			const src = await get();
			if (!src) return;
			const it: ReadingItem = { id: uid(), title: src.title, path: src.path, pdf: src.pdf, pos: 0, perDay: this.perDay, everyDays: this.every, next: dayKey(Date.now()), words: 0, created: Date.now(), log: {}, size: this.size };
			const rc = await readChunks(this.p, it);
			if (!rc || !rc.chunks.length) return void new Notice("Teks terlalu pendek untuk dipecah.");
			it.words = words(rc.content);
			this.p.data.reading.unshift(it);
			this.p.requestSave();
			new Notice(`📖 “${it.title}” dipecah menjadi ${rc.chunks.length} potongan (±${Math.ceil(rc.chunks.length / it.perDay) * it.everyDays} hari).`);
			this.close();
			this.done(it);
		} });
	}
	onClose() { this.contentEl.empty(); }
}

// ---------------------------------------------------------------- halaman
let openId = "";
export const openReading = (id: string) => { openId = id; };

export function renderReading(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const it = p.data.reading.find((x) => x.id === openId);
	if (it) return void renderReader(hub, el, it);
	openId = "";
	const head = el.createDiv("fch-pagehead fch-pagehead-row");
	const ht = head.createDiv();
	ht.createEl("h1", { text: "📖 Membaca Bertahap" });
	ht.createDiv({ cls: "fch-muted", text: "Bacaan panjang dipecah menjadi potongan kecil yang dijadwalkan. Blok kalimat penting saat membaca untuk langsung menjadikannya kartu." });
	btn(head, { text: "Bacaan baru", icon: "plus", cls: "fch-btn-primary", onClick: () => new AddReadingModal(hub.app, p, () => hub.renderPage()).open() });
	const dueList = readingDue(p);
	const hero = el.createDiv("fch-rd-hero");
	hero.createDiv({ cls: "fch-rd-hero-ic", text: dueList.length ? "📚" : "✅" });
	const t = hero.createDiv("fch-grow");
	t.createDiv({ cls: "fch-rd-hero-t", text: dueList.length ? `${dueList.reduce((a, x) => a + x.perDay - readToday(x), 0)} potongan menunggu dibaca hari ini` : p.data.reading.length ? "Bacaan hari ini selesai 🎉" : "Belum ada bacaan" });
	const todayW = p.data.meta.missionLog?.[dayKey(Date.now())] as Record<string, number> | undefined;
	t.createDiv({ cls: "fch-small", text: `${todayW?.reading ?? 0} potongan dibaca hari ini · ${p.data.reading.filter((x) => x.done).length} bacaan tamat` });
	if (dueList.length) btn(hero, { text: "Mulai membaca", icon: "book-open", cls: "fch-btn-primary fch-btn-lg", onClick: () => { openId = dueList[0].id; hub.renderPage(); } });
	if (!p.data.reading.length) {
		const how = el.createDiv("fch-exam-how fch-mt");
		[["1", "Tambah bacaan", "Catatan panjang, artikel tempelan, atau PDF"], ["2", "Baca sedikit-sedikit", "1–5 potongan sesuai jadwal pilihanmu"], ["3", "Jadikan kartu", "Blok kalimat penting → kartu tertaut ke bacaannya"]].forEach(([n, a, b]) => { const s = how.createDiv("fch-exam-how-it"); s.createDiv({ cls: "fch-exam-how-n", text: n }); s.createDiv({ cls: "fch-strong", text: a }); s.createDiv({ cls: "fch-muted fch-small", text: b }); });
		return;
	}
	const grid = el.createDiv("fch-rd-grid");
	for (const x of p.data.reading) {
		const c = grid.createDiv("fch-rd-card" + (x.done ? " is-done" : due(x) ? " is-due" : ""));
		c.createDiv({ cls: "fch-rd-card-ic", text: x.done ? "🏁" : x.pdf ? "📄" : "📘" });
		const tt = c.createDiv("fch-grow");
		tt.createDiv({ cls: "fch-strong", text: x.title });
		const bar = tt.createDiv("fch-bar fch-bar-thin fch-mt");
		const fill = bar.createDiv("fch-bar-fill");
		const info = tt.createDiv({ cls: "fch-small fch-muted" });
		void readChunks(p, x).then((rc) => {
			const n = rc?.chunks.length ?? 0;
			fill.style.width = `${n ? (Math.min(x.pos, n) / n) * 100 : 0}%`;
			info.setText(rc ? `${Math.min(x.pos, n)}/${n} potongan · ${x.words.toLocaleString("id-ID")} kata · ${x.done ? "tamat" : due(x) ? (readToday(x) >= x.perDay ? "hari ini selesai" : "jadwal hari ini") : "berikutnya " + new Date(x.next + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}` : "⚠️ catatan sumber tidak ditemukan");
		});
		const r = c.createDiv("fch-row");
		btn(r, { text: x.done ? "Baca ulang" : "Baca", icon: "book-open", cls: "fch-btn-sm" + (due(x) ? " fch-btn-primary" : ""), onClick: () => { if (x.done) { x.done = false; x.pos = 0; } openId = x.id; hub.renderPage(); } });
		btn(r, { icon: "file-text", cls: "fch-btn-ghost fch-btn-sm", label: "Buka catatan sumber", onClick: () => void p.openAt(x.path, 0) });
		btn(r, { icon: "trash-2", cls: "fch-btn-ghost fch-btn-sm", label: "Hapus dari daftar (catatan tidak dihapus)", onClick: () => { p.data.reading = p.data.reading.filter((y) => y !== x); p.requestSave(); hub.renderPage(); } });
	}
}

function renderReader(hub: HubView, el: HTMLElement, it: ReadingItem) {
	const p = hub.plugin;
	const box = el.createDiv("fch-rd-reader");
	void readChunks(p, it).then((rc) => {
		box.empty();
		const top = box.createDiv("fch-study-top");
		btn(top, { icon: "arrow-left", cls: "fch-btn-ghost", label: "Kembali", onClick: () => { openId = ""; hub.renderPage(); } });
		const tt = top.createDiv("fch-study-title");
		tt.createDiv({ cls: "fch-study-name", text: `📖 ${it.title}` });
		if (!rc) { box.createDiv({ cls: "fch-empty", text: "Catatan sumber tidak ditemukan. Mungkin sudah dipindah atau dihapus." }); return; }
		const n = rc.chunks.length;
		tt.createDiv({ cls: "fch-muted fch-small", text: `Potongan ${Math.min(it.pos + 1, n)} dari ${n} · hari ini ${readToday(it)}/${it.perDay}` });
		const bar = box.createDiv("fch-bar fch-rd-prog");
		bar.createDiv("fch-bar-fill").style.width = `${(it.pos / n) * 100}%`;
		if (it.pos >= n) {
			const end = box.createDiv("fch-rd-end");
			end.createDiv({ cls: "fch-dg-big", text: "🏁" });
			end.createEl("h2", { text: "Bacaan tamat!" });
			btn(end, { text: "Kembali ke daftar", cls: "fch-btn-primary", onClick: () => { openId = ""; hub.renderPage(); } });
			return;
		}
		const ch = rc.chunks[it.pos];
		const page = box.createDiv("fch-rd-page");
		if (ch.heading) page.createDiv({ cls: "fch-rd-heading", text: `§ ${ch.heading}` });
		// baris judul tampil sebagai judul; tanda # disembunyikan (teks DOM tetap identik agar posisi blok teks akurat)
		const txt = page.createDiv("fch-rd-text");
		ch.text.split("\n").forEach((line, i, arr) => {
			const hm = line.match(/^(#{1,6}\s+)(.*)$/);
			if (hm) { const h = txt.createSpan("fch-rd-hline"); h.createSpan({ cls: "fch-rd-hash", text: hm[1] }); h.appendChild(document.createTextNode(hm[2])); }
			else txt.appendChild(document.createTextNode(line));
			if (i < arr.length - 1) txt.appendChild(document.createTextNode("\n"));
		});
		page.createDiv({ cls: "fch-rd-meta", text: `±${words(ch.text)} kata · ±${Math.max(1, Math.round(words(ch.text) / 200))} menit` });
		// blok kalimat → jadikan kartu
		const tip = box.createDiv("fch-rd-tip is-hidden");
		btn(tip, { text: "Jadikan kartu", icon: "plus", cls: "fch-btn-primary fch-btn-sm", onClick: () => makeCard() });
		let selRange: [number, number] | null = null;
		const offsetIn = (node: Node, off: number) => { const r = document.createRange(); r.selectNodeContents(txt); r.setEnd(node, off); return r.toString().length; };
		txt.addEventListener("mouseup", () => window.setTimeout(() => {
			const s = window.getSelection();
			if (!s || s.isCollapsed || !txt.contains(s.anchorNode)) { tip.addClass("is-hidden"); selRange = null; return; }
			const a = offsetIn(s.anchorNode!, s.anchorOffset), b = offsetIn(s.focusNode!, s.focusOffset);
			selRange = [Math.min(a, b), Math.max(a, b)];
			tip.removeClass("is-hidden");
		}, 10));
		const makeCard = () => {
			if (!selRange) return;
			const from = ch.start + selRange[0], to = ch.start + selRange[1];
			new CardModal(hub.app, p, { path: it.path, kind: "single", source: extractSource(rc.content, from, to) }).open();
			tip.addClass("is-hidden");
		};
		box.createDiv({ cls: "fch-muted fch-small fch-center", text: "💡 Blok kalimat penting, lalu klik “Jadikan kartu”. Kartu tersimpan sebagai materi dari catatan bacaan ini." });
		const r = box.createDiv("fch-row fch-center fch-mt");
		btn(r, { text: "Tunda ke besok", icon: "clock", onClick: () => { it.next = dayKey(addDays(startOfDay(Date.now()), 1)); p.requestSave(); openId = ""; hub.renderPage(); } });
		btn(r, { text: it.pos + 1 >= n ? "Selesai — tamat!" : "Selesai, lanjut", icon: "check", cls: "fch-btn-primary fch-btn-lg", onClick: () => {
			const k = dayKey(Date.now());
			it.pos++;
			it.log[k] = (it.log[k] ?? 0) + 1;
			p.track("reading");
			play("correct");
			if (it.pos >= n) { it.done = true; p.addCoins(30); new Notice(`🏁 “${it.title}” tamat! +30 koin`); }
			else if (it.log[k] >= it.perDay) { it.next = dayKey(addDays(startOfDay(Date.now()), it.everyDays)); new Notice(`✅ Bacaan hari ini selesai. Lanjut ${it.everyDays === 1 ? "besok" : `${it.everyDays} hari lagi`}.`); }
			p.requestSave();
			p.checkAchievements();
			if (it.done || it.log[k] >= it.perDay) { const nx = readingDue(p)[0]; openId = nx ? nx.id : ""; }
			hub.renderPage();
		} });
	});
}
