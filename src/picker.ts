import type FlashcardPlugin from "./main";
import { basename, btn, folderOf } from "./util";

/** Daftar centang materi per folder. `sel` berisi path materi terpilih. */
export function materialPicker(p: FlashcardPlugin, parent: HTMLElement, sel: Set<string>, onChange?: () => void) {
	const paths = p.sortedPaths();
	const box = parent.createDiv("fch-exam-pick");
	const head = box.createDiv("fch-row");
	const count = head.createSpan({ cls: "fch-strong fch-small fch-grow" });
	btn(head, { text: "Semua", cls: "fch-btn-sm fch-btn-ghost", onClick: () => { paths.forEach((x) => sel.add(x)); draw(); } });
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
				const c = p.countFor([f]);
				l.createSpan({ cls: "fch-muted fch-small", text: `${c.total} kartu` });
				if (sel.has(f)) n += c.total;
			}
		}
		count.setText(sel.size ? `${sel.size} materi · ${n} kartu dipilih` : "Belum ada materi dipilih");
		onChange?.();
	};
	draw();
	return { redraw: draw };
}

export const titleOf = (sel: Set<string>, total: number) =>
	sel.size === total ? "Semua materi" : sel.size === 1 ? basename([...sel][0]) : `${sel.size} materi`;
