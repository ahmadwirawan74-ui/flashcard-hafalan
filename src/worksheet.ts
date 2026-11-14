import { App, Modal, Notice, normalizePath } from "obsidian";
import type FlashcardPlugin from "./main";
import { Card } from "./types";
import { quizOptions } from "./learn";
import { materialPicker, titleOf } from "./picker";
import { btn, plainText, shuffle } from "./util";

const qText = (c: Card) => plainText(c.front).replace(/\[…\]|\[[^\]]*\]/g, "________");
const aText = (c: Card) => plainText(c.answer ?? c.back);

/** Lembar latihan cetak: isian, pilihan ganda, menjodohkan + kunci jawaban → catatan siap diekspor ke PDF. */
export class WorksheetModal extends Modal {
	private sel: Set<string>;
	private nFill = 10;
	private nMcq = 10;
	private nMatch = 6;
	private key = true;

	constructor(app: App, private p: FlashcardPlugin, initial: string[] = []) {
		super(app);
		this.sel = new Set(initial.length ? initial : p.sortedPaths());
	}

	onOpen() {
		this.modalEl.addClass("fch-modal");
		const el = this.contentEl;
		el.createDiv({ cls: "fch-modal-title", text: "🖨️ Lembar latihan cetak" });
		el.createDiv({ cls: "fch-muted fch-small", text: "Membuat catatan berisi soal isian, pilihan ganda, dan menjodohkan, lengkap dengan kunci jawaban di halaman terpisah. Ekspor ke PDF lewat menu ⋯ → Export to PDF." });
		const title = el.createEl("input", { type: "text", cls: "fch-input fch-mt", attr: { placeholder: "Judul, mis. Latihan Biologi Bab 1–3" } });
		materialPicker(this.p, el, this.sel);
		const opt = (label: string, vals: number[], get: () => number, set: (v: number) => void) => {
			const r = el.createDiv("fch-row fch-mt");
			r.createSpan({ cls: "fch-small fch-strong", text: label });
			const seg = r.createDiv("fch-seg");
			const draw = () => { seg.empty(); for (const v of vals) { const b = seg.createEl("button", { cls: "fch-seg-btn" + (get() === v ? " is-active" : ""), text: v ? String(v) : "—" }); b.onclick = () => { set(v); draw(); }; } };
			draw();
		};
		opt("Isian singkat", [0, 5, 10, 20], () => this.nFill, (v) => (this.nFill = v));
		opt("Pilihan ganda", [0, 5, 10, 20], () => this.nMcq, (v) => (this.nMcq = v));
		opt("Menjodohkan", [0, 4, 6, 8], () => this.nMatch, (v) => (this.nMatch = v));
		const t = el.createEl("label", { cls: "fch-toggle fch-mt" });
		const cb = t.createEl("input", { type: "checkbox" });
		cb.checked = this.key;
		cb.onchange = () => (this.key = cb.checked);
		t.createSpan({ text: "Sertakan kunci jawaban (halaman terpisah)" });
		const foot = el.createDiv("fch-modal-foot fch-mt");
		foot.createDiv("fch-grow");
		btn(foot, { text: "Batal", cls: "fch-btn-ghost", onClick: () => this.close() });
		btn(foot, { text: "Buat lembar", icon: "printer", cls: "fch-btn-primary", onClick: () => void this.make(title.value.trim()) });
	}

	private async make(titleIn: string) {
		const p = this.p;
		const cards = shuffle([...this.sel].flatMap((x) => p.index.get(x) ?? []).filter((c) => c.type !== "occlusion" && c.type !== "reversed"));
		if (cards.length < 3) return void new Notice("Pilih materi dengan minimal 3 kartu.");
		const title = titleIn || `Latihan ${titleOf(this.sel, p.sortedPaths().length)}`;
		const used = new Set<string>();
		const take = (n: number, ok: (c: Card) => boolean) => { const out: Card[] = []; for (const c of cards) { if (out.length >= n) break; if (!used.has(c.id) && ok(c)) { used.add(c.id); out.push(c); } } return out; };
		const mcq = take(this.nMcq, (c) => !!quizOptions(p, c, 4)).map((c) => ({ c, o: quizOptions(p, c, 4)! }));
		const match = take(this.nMatch, (c) => c.type !== "list" && c.type !== "mcq" && aText(c).length <= 60 && qText(c).length <= 90);
		const fill = take(this.nFill, (c) => c.type !== "mcq");
		const L = "ABCDEFGH";
		const lines: string[] = [`# 📝 ${title}`, "", "**Nama:** ______________________  **Kelas:** ________  **Tanggal:** ____________  **Nilai:** ______", ""];
		const key: string[] = [];
		let sec = 0;
		if (fill.length) {
			lines.push(`## ${L[sec++]}. Isian singkat`, "");
			fill.forEach((c, i) => {
				lines.push(`${i + 1}. ${qText(c)}`, "   Jawaban: ________________________________________", "");
				key.push(`- **Isian ${i + 1}:** ${c.type === "list" && c.items ? c.items.join("; ") : aText(c)}`);
			});
		}
		if (mcq.length) {
			lines.push(`## ${L[sec++]}. Pilihan ganda`, "", "_Lingkari satu jawaban yang paling tepat._", "");
			mcq.forEach(({ c, o }, i) => {
				lines.push(`${i + 1}. ${qText(c)}`);
				o.forEach((x, k) => lines.push(`    ${L[k].toLowerCase()}. ${plainText(x.text)}`));
				lines.push("");
				key.push(`- **PG ${i + 1}:** ${L[o.findIndex((x) => x.correct)].toLowerCase()}. ${plainText(o.find((x) => x.correct)!.text)}`);
			});
		}
		if (match.length >= 2) {
			lines.push(`## ${L[sec++]}. Menjodohkan`, "", "_Pasangkan pernyataan di kiri dengan jawaban yang tepat di kanan._", "", "| No | Pernyataan | Huruf | Pilihan |", "|:-:|---|:-:|---|");
			const right = shuffle(match.map((c, i) => ({ i, a: aText(c) })));
			match.forEach((c, i) => lines.push(`| ${i + 1} | ${qText(c).replace(/\|/g, "/")} | …… | **${L[i]}.** ${right[i].a.replace(/\|/g, "/")} |`));
			lines.push("");
			match.forEach((c, i) => key.push(`- **Jodohkan ${i + 1}:** ${L[right.findIndex((r) => r.i === i)]}`));
		}
		if (this.key) lines.push('<div style="page-break-after: always;"></div>', "", "## 🔑 Kunci jawaban", "", ...key);
		lines.push("", `_Dibuat dengan Flashcard Hafalan · ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}_`);
		const folder = "Lembar Latihan";
		if (!p.app.vault.getAbstractFileByPath(folder)) await p.app.vault.createFolder(folder);
		const safe = title.replace(/[\\/:*?"<>|#^[\]]/g, "-");
		let path = normalizePath(`${folder}/${safe}.md`);
		for (let i = 2; p.app.vault.getAbstractFileByPath(path); i++) path = normalizePath(`${folder}/${safe} (${i}).md`);
		const f = await p.app.vault.create(path, lines.join("\n") + "\n");
		p.data.meta.worksheets = (p.data.meta.worksheets ?? 0) + 1;
		p.requestSave();
		p.checkAchievements();
		new Notice(`🖨️ Lembar latihan dibuat: ${f.path}. Ekspor ke PDF lewat ⋯ → Export to PDF.`, 8000);
		this.close();
		await p.openAt(f.path, 0);
	}

	onClose() { this.contentEl.empty(); }
}
