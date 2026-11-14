import { App, Modal, Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import { Exam } from "./types";
import { basename, btn, folderOf } from "./util";

/** Atur ujian: nama, tanggal, dan materi yang diujikan. */
export class ExamModal extends Modal {
	private e: Exam;
	constructor(app: App, private plugin: FlashcardPlugin, exam?: Exam) {
		super(app);
		this.e = exam ? { ...exam, paths: [...exam.paths] } : { id: "e" + Date.now().toString(36), name: "", date: "", paths: [] };
		this.isNew = !exam;
	}
	private isNew: boolean;

	onOpen() {
		this.modalEl.addClass("fch-modal");
		const el = this.contentEl;
		el.empty();
		el.createDiv({ cls: "fch-modal-title", text: this.isNew ? "🎓 Ujian baru" : "🎓 Edit ujian" });
		el.createDiv({ cls: "fch-muted fch-small", text: "Pilih materi yang diujikan. Target kartu per hari menyesuaikan sisa kartu dan sisa hari." });
		const r = el.createDiv("fch-row");
		const name = r.createEl("input", { type: "text", cls: "fch-input fch-grow", attr: { placeholder: "Nama ujian, mis. UTS Biologi" } });
		name.value = this.e.name;
		const date = r.createEl("input", { type: "date", cls: "fch-input" });
		date.style.width = "170px";
		date.value = this.e.date;

		const paths = this.plugin.sortedPaths();
		const sel = new Set(this.e.paths.length ? this.e.paths : []);
		const box = el.createDiv("fch-exam-pick");
		const head = box.createDiv("fch-row");
		const count = head.createSpan({ cls: "fch-strong fch-small fch-grow" });
		btn(head, { text: "Pilih semua", cls: "fch-btn-sm fch-btn-ghost", onClick: () => { paths.forEach((x) => sel.add(x)); draw(); } });
		btn(head, { text: "Kosongkan", cls: "fch-btn-sm fch-btn-ghost", onClick: () => { sel.clear(); draw(); } });
		const list = box.createDiv("fch-exam-list");
		const draw = () => {
			list.empty();
			const groups = new Map<string, string[]>();
			for (const x of paths) (groups.get(folderOf(x)) ?? groups.set(folderOf(x), []).get(folderOf(x))!).push(x);
			let n = 0;
			for (const [folder, files] of groups) {
				const all = files.every((f) => sel.has(f));
				const fl = list.createEl("label", { cls: "fch-exam-folder" });
				const fcb = fl.createEl("input", { type: "checkbox" });
				fcb.checked = all;
				fcb.indeterminate = !all && files.some((f) => sel.has(f));
				fcb.onchange = () => { files.forEach((f) => (fcb.checked ? sel.add(f) : sel.delete(f))); draw(); };
				fl.createSpan({ text: `📁 ${folder || "Tanpa folder"}` });
				for (const f of files) {
					const l = list.createEl("label", { cls: "fch-exam-file" });
					const cb = l.createEl("input", { type: "checkbox" });
					cb.checked = sel.has(f);
					cb.onchange = () => { if (cb.checked) sel.add(f); else sel.delete(f); draw(); };
					l.createSpan({ text: basename(f) });
					const c = this.plugin.countFor([f]);
					l.createSpan({ cls: "fch-muted fch-small", text: `${c.total} kartu` });
					if (sel.has(f)) n += c.total;
				}
			}
			count.setText(sel.size ? `${sel.size} materi · ${n} kartu dipilih` : "Belum ada materi dipilih");
		};
		draw();

		const foot = el.createDiv("fch-modal-foot");
		if (!this.isNew) btn(foot, { text: "Hapus ujian", icon: "trash-2", cls: "fch-btn-ghost fch-danger", onClick: async () => {
			this.plugin.data.exams = this.plugin.data.exams.filter((x) => x.id !== this.e.id);
			await this.plugin.saveNow();
			this.plugin.refreshViews();
			this.close();
		} });
		foot.createDiv("fch-grow");
		btn(foot, { text: "Batal", cls: "fch-btn-ghost", onClick: () => this.close() });
		btn(foot, { text: "Simpan", icon: "check", cls: "fch-btn-primary", onClick: async () => {
			if (!date.value) return void new Notice("Isi tanggal ujian.");
			if (!sel.size) return void new Notice("Pilih minimal satu materi.");
			this.e.name = name.value.trim() || "Ujian";
			this.e.date = date.value;
			this.e.paths = [...sel];
			const list = this.plugin.data.exams.filter((x) => x.id !== this.e.id);
			list.push(this.e);
			list.sort((a, b) => a.date.localeCompare(b.date));
			this.plugin.data.exams = list;
			await this.plugin.saveNow();
			this.plugin.refreshViews();
			this.close();
		} });
	}

	onClose() {
		this.contentEl.empty();
	}
}
