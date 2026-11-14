import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { editorInfoField } from "obsidian";
import type FlashcardPlugin from "./main";
import { locate } from "./anchor";
import { TYPE_LABEL } from "./types";

export const refreshMarks = StateEffect.define<null>();

/** Garis bawah tipis pada teks yang sudah dijadikan flashcard (tanpa mengubah catatan). */
export function markExtension(plugin: FlashcardPlugin) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) {
				this.decorations = this.build(view);
			}
			update(u: ViewUpdate) {
				if (u.docChanged || u.transactions.some((t) => t.effects.some((e) => e.is(refreshMarks))))
					this.decorations = this.build(u.view);
			}
			build(view: EditorView): DecorationSet {
				try {
					if (!plugin.data.settings.markSource) return Decoration.none;
					const file = view.state.field(editorInfoField, false)?.file;
					if (!file) return Decoration.none;
					const list = (plugin.storedIndex.get(file.path) ?? []).filter((s) => s.anchor);
					if (!list.length) return Decoration.none;
					const text = view.state.doc.toString();
					const ranges = new Map<string, { from: number; to: number; labels: string[] }>();
					for (const sc of list) {
						const r = locate(text, sc.anchor!);
						if (!r || r.from >= r.to) continue;
						const k = `${r.from}:${r.to}`;
						const cur = ranges.get(k) ?? ranges.set(k, { from: r.from, to: r.to, labels: [] }).get(k)!;
						if (!cur.labels.includes(TYPE_LABEL[sc.type])) cur.labels.push(TYPE_LABEL[sc.type]);
					}
					const b = new RangeSetBuilder<Decoration>();
					for (const r of [...ranges.values()].sort((a, c) => a.from - c.from || a.to - c.to))
						b.add(r.from, r.to, Decoration.mark({ class: "fch-mark", attributes: { "aria-label": `Flashcard · ${r.labels.join(", ")}` } }));
					return b.finish();
				} catch {
					return Decoration.none;
				}
			}
		},
		{ decorations: (v) => v.decorations },
	);
}
