import type { HubView } from "../hub-view";
import { Card, TYPE_LABEL } from "../types";
import { basename, btn, plainText } from "../util";

export function renderFix(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const cards = p.allCards();
	const flagged = cards.filter((c) => p.data.flags[c.id]).sort((a, b) => p.data.flags[b.id].t - p.data.flags[a.id].t);
	const orphans = cards.filter((c) => c.orphan && !p.data.flags[c.id]);

	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "Perbaiki" });
	head.createDiv({ cls: "fch-muted", text: "Kartu yang kamu tandai saat belajar (tekan P), dan kartu yang teks sumbernya sudah berubah di catatan." });

	if (!flagged.length && !orphans.length) {
		const e = el.createDiv("fch-empty fch-empty-big");
		e.createDiv({ cls: "fch-empty-ic", text: "✨" });
		e.createDiv({ cls: "fch-strong", text: "Tidak ada yang perlu diperbaiki" });
		e.createDiv({ cls: "fch-muted fch-small", text: "Saat belajar, tekan P atau tombol bendera kalau menemukan kartu yang salah atau typo. Kartunya akan muncul di sini untuk diperbaiki nanti." });
		return;
	}

	const fmtDate = (t: number) => new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

	const row = (list: HTMLElement, c: Card, orphan: boolean) => {
		const f = p.data.flags[c.id];
		const sc = p.storedOf(c);
		const r = list.createDiv("fch-fix" + (orphan ? " is-orphan" : ""));
		const main = r.createDiv("fch-fix-main");
		const top = main.createDiv("fch-fix-top");
		top.createSpan({ cls: `fch-type fch-type-${c.type}`, text: TYPE_LABEL[c.type] });
		top.createSpan({ cls: "fch-muted fch-small", text: basename(c.path) });
		if (f) top.createSpan({ cls: "fch-muted fch-small", text: `· ditandai ${fmtDate(f.t)}` });
		main.createDiv({ cls: "fch-fix-front", text: plainText(c.front).replace(/\[…\]/g, "[…]") });
		main.createDiv({ cls: "fch-fix-back", text: "→ " + plainText(c.answer ?? c.back) });
		if (f && (f.reasons.length || f.note)) {
			const why = main.createDiv("fch-fix-why");
			f.reasons.forEach((x) => why.createSpan({ cls: "fch-reason", text: x }));
			if (f.note) why.createSpan({ cls: "fch-fix-note", text: `“${f.note}”` });
		}
		if (orphan) main.createDiv({ cls: "fch-fix-why" }).createSpan({ cls: "fch-reason is-warn", text: "Teks sumber di catatan sudah berubah atau dihapus" });

		const act = r.createDiv("fch-fix-act");
		if (sc || c.occ) btn(act, { text: "Edit kartu", icon: "pencil", cls: "fch-btn-primary fch-btn-sm", onClick: () => p.editAny(c) });
		if (!orphan && !c.occ) btn(act, { text: sc ? "Lihat di catatan" : "Edit di catatan", icon: "file-text", cls: sc ? "fch-btn-sm" : "fch-btn-primary fch-btn-sm", onClick: () => void p.openAt(c.path, c.line) });
		if (f) btn(act, { text: "Selesai", icon: "check", cls: "fch-btn-sm fch-btn-ok", label: "Tandai sudah diperbaiki", onClick: () => p.resolveFlag(c) });
		if (orphan && sc) btn(act, { text: "Lepas dari teks", icon: "unlink", cls: "fch-btn-sm", label: "Pertahankan kartu tanpa terikat ke teks catatan", onClick: () => p.detachStored(sc) });
		if (sc) btn(act, { icon: "trash-2", cls: "fch-btn-ghost fch-btn-sm fch-danger", label: "Hapus kartu", onClick: () => p.deleteStored(sc) });
	};

	if (flagged.length) {
		const sec = el.createDiv("fch-section");
		const sh = sec.createDiv("fch-section-head");
		sh.createEl("h3", { text: `🚩 Ditandai (${flagged.length})` });
		btn(sh, { text: "Latih kartu ini", icon: "zap", cls: "fch-btn-sm", onClick: () => hub.startSession(flagged, { title: "Kartu ditandai", cram: true, mode: "classic" }) });
		const list = sec.createDiv("fch-fix-list");
		flagged.forEach((c) => row(list, c, !!c.orphan));
	}
	if (orphans.length) {
		const sec = el.createDiv("fch-section");
		sec.createEl("h3", { text: `🔗 Teks sumber berubah (${orphans.length})` });
		sec.createDiv({ cls: "fch-muted fch-small fch-desc", text: "Kartunya tetap bisa dipelajari. Edit kalau isinya sudah tidak sesuai, atau lepas dari teks agar tidak muncul di sini lagi." });
		const list = sec.createDiv("fch-fix-list");
		orphans.forEach((c) => row(list, c, true));
	}
}
