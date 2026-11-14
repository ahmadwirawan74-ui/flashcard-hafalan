import { App, Modal, Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import { addTask, parseQuick, fmtDue } from "./tasks";
import { createNote } from "./notes";
import { parseCards } from "./parser";
import { Task } from "./types";
import { basename, btn } from "./util";
import { play } from "./sound";

type Kind = "task" | "card" | "note";
const LABEL: Record<Kind, string> = { task: "✅ Tugas", card: "🧠 Kartu", note: "🗒️ Catatan" };

/** Tebak jenis: Q :: A → kartu; teks panjang/multi-baris → catatan; selain itu → tugas. */
export function guessKind(text: string): Kind {
	const t = text.trim();
	if (/\S\s*:{2,3}\s*\S/.test(t) || /\{\{.+?\}\}/.test(t)) return "card";
	if (t.includes("\n") || t.length > 140) return "note";
	return "task";
}

/** Tangkap Cepat: satu kotak untuk tugas, kartu, atau catatan. */
export class CaptureModal extends Modal {
	private kind: Kind | null = null;
	constructor(app: App, private p: FlashcardPlugin) { super(app); }
	onOpen() {
		this.modalEl.addClass("fch-modal", "fch-capture");
		const el = this.contentEl;
		el.createDiv({ cls: "fch-modal-title", text: "⚡ Tangkap cepat" });
		const ta = el.createEl("textarea", { cls: "fch-input fch-capture-in", attr: { rows: "3", placeholder: "Ketik apa saja…\n• “Kerjakan PR fisika besok jam 7 malam” → tugas\n• “Ibu kota Jepang :: Tokyo” → kartu\n• Teks panjang / beberapa baris → catatan" } });
		const seg = el.createDiv("fch-row fch-mt");
		seg.createSpan({ cls: "fch-small fch-muted", text: "Simpan sebagai:" });
		const segs = seg.createDiv("fch-seg");
		const info = el.createDiv({ cls: "fch-muted fch-small fch-capture-info" });
		const target = this.p.app.workspace.getActiveFile();
		const cardPath = target?.extension === "md" ? target.path : this.p.sortedPaths()[0];
		const update = () => {
			const k = this.kind ?? guessKind(ta.value);
			segs.empty();
			(Object.keys(LABEL) as Kind[]).forEach((x) => {
				const b = segs.createEl("button", { cls: "fch-seg-btn" + (k === x ? " is-active" : ""), text: LABEL[x] });
				b.onclick = () => { this.kind = x; update(); ta.focus(); };
			});
			info.empty();
			if (!ta.value.trim()) return;
			if (k === "task") {
				const q = parseQuick(this.p, ta.value.split("\n")[0]);
				info.setText(`Tugas “${q.title}”` + (q.due ? ` · ${fmtDue({ due: q.due, time: q.time } as Task)}` : "") + (q.priority ? " · prioritas" : "") + (q.tags.length ? ` · #${q.tags.join(" #")}` : ""));
			} else if (k === "card") {
				const n = parseCards(ta.value, "x.md", { ...this.p.data.settings, enableCloze: true }).length;
				info.setText(n ? `${n} kartu → disimpan di “${cardPath ? basename(cardPath) : "materi baru"}” (catatan tidak diubah)` : "Format kartu: Pertanyaan :: Jawaban (atau ::: untuk dua arah, {{…}} untuk cloze)");
			} else info.setText(`Catatan baru “${ta.value.trim().split("\n")[0].slice(0, 60)}”`);
		};
		ta.oninput = update;
		const save = async () => {
			const text = ta.value.trim();
			if (!text) return;
			const k = this.kind ?? guessKind(text);
			if (k === "task") {
				let n = 0;
				for (const line of text.split("\n").map((l) => l.replace(/^\s*[-*]\s*(\[.\]\s*)?/, "").trim()).filter(Boolean)) if (addTask(this.p, line)) n++;
				new Notice(`✅ ${n} tugas ditambahkan`);
			} else if (k === "card") {
				const path = cardPath ?? (await this.p.createMaterial("Kartu cepat")).path;
				const cards = parseCards(text, path, { ...this.p.data.settings, enableCloze: true });
				if (!cards.length) return void new Notice("Tidak ada kartu yang dikenali. Gunakan format Pertanyaan :: Jawaban.");
				for (const c of cards) this.p.saveStored(path, [{ type: c.type, front: c.front, back: c.back, answer: c.answer, items: c.items, options: c.options, explanation: c.explanation }]);
				new Notice(`🧠 ${cards.length} kartu disimpan di ${basename(path)}`);
			} else {
				const [first, ...rest] = text.split("\n");
				const f = await createNote(this.p, first.slice(0, 60), "kosong");
				await this.p.app.vault.process(f, (d) => d + (rest.length ? rest.join("\n") : first) + "\n");
				new Notice(`🗒️ Catatan “${f.basename}” dibuat`);
			}
			play("coin");
			this.close();
		};
		ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void save(); } };
		const foot = el.createDiv("fch-modal-foot fch-mt");
		foot.createSpan({ cls: "fch-muted fch-small", text: "Enter = simpan · Shift+Enter = baris baru" });
		foot.createDiv("fch-grow");
		btn(foot, { text: "Simpan", icon: "check", cls: "fch-btn-primary", onClick: () => void save() });
		update();
		window.setTimeout(() => ta.focus(), 30);
	}
	onClose() { this.contentEl.empty(); }
}
