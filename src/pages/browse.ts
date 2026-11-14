import { setIcon } from "obsidian";
import type { HubView } from "../hub-view";
import { Card, CardState, TYPE_LABEL } from "../types";
import { endOfDay, formatDue, isNewState, retention } from "../scheduler";
import { basename, btn, plainText } from "../util";

type Filter = "all" | "new" | "due" | "learning" | "mature" | "hard" | "starred" | "flagged" | "suspended";
const FILTERS: { id: Filter; label: string }[] = [
	{ id: "all", label: "Semua" },
	{ id: "due", label: "Jatuh tempo" },
	{ id: "new", label: "Baru" },
	{ id: "learning", label: "Dipelajari" },
	{ id: "mature", label: "Matang" },
	{ id: "hard", label: "Sering lupa" },
	{ id: "starred", label: "⭐ Bertanda" },
	{ id: "flagged", label: "🚩 Perlu diperbaiki" },
	{ id: "suspended", label: "Ditangguhkan" },
];

export function renderBrowse(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const B = hub.browse;
	const thr = p.data.settings.leechThreshold;
	const end = endOfDay(Date.now());

	const test = (f: Filter, st: CardState | undefined, c?: Card): boolean => {
		switch (f) {
			case "all": return true;
			case "new": return !st?.suspended && isNewState(st);
			case "due": return !!st && !st.suspended && !isNewState(st) && st.due <= end;
			case "learning": return !!st && !st.suspended && !isNewState(st) && st.interval < 21;
			case "mature": return !!st && !st.suspended && st.interval >= 21;
			case "hard": return !!st && st.lapses >= thr;
			case "starred": return !!st?.starred;
			case "flagged": return !!c && (!!p.data.flags[c.id] || !!c.orphan);
			case "suspended": return !!st?.suspended;
		}
	};

	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "Semua kartu" });
	head.createDiv({ cls: "fch-muted", text: "Cari, saring, tandai, atau tangguhkan kartu. Klik kartu untuk membukanya di catatan." });

	const bar = el.createDiv("fch-browse-bar");
	const search = bar.createEl("input", { type: "search", cls: "fch-input fch-grow", attr: { placeholder: "Cari pertanyaan atau jawaban" } });
	search.value = B.q;
	const pathSel = bar.createEl("select", { cls: "dropdown fch-select" });
	pathSel.createEl("option", { text: "Semua materi", attr: { value: "" } });
	p.sortedPaths().forEach((x) => pathSel.createEl("option", { text: basename(x), attr: { value: x } }));
	pathSel.value = B.path;
	const sortSel = bar.createEl("select", { cls: "dropdown fch-select" });
	for (const [v, t] of [["material", "Urutan materi"], ["due", "Jatuh tempo terdekat"], ["lapses", "Paling sering lupa"]])
		sortSel.createEl("option", { text: t, attr: { value: v } });
	sortSel.value = B.sort;

	const chips = el.createDiv("fch-chips");
	const listHead = el.createDiv("fch-list-head");
	const list = el.createDiv("fch-cards");

	const draw = () => {
		const all = p.allCards().filter((c) => !B.path || c.path === B.path);
		const q = B.q.toLowerCase().trim();
		const matchQ = (c: Card) => !q || (c.front + " " + c.back).toLowerCase().includes(q);
		const base = all.filter(matchQ);

		chips.empty();
		for (const f of FILTERS) {
			const n = base.filter((c) => test(f.id, p.data.cards[c.id], c)).length;
			const ch = chips.createEl("button", { cls: "fch-chip" + (B.filter === f.id ? " is-active" : "") });
			ch.createSpan({ text: f.label });
			ch.createSpan({ cls: "fch-chip-n", text: String(n) });
			ch.onclick = () => { B.filter = f.id; B.limit = 60; draw(); };
		}

		let rows = base.filter((c) => test(B.filter as Filter, p.data.cards[c.id], c));
		if (B.sort === "due") rows = [...rows].sort((a, b) => (p.data.cards[a.id]?.due ?? Infinity) - (p.data.cards[b.id]?.due ?? Infinity));
		if (B.sort === "lapses") rows = [...rows].sort((a, b) => (p.data.cards[b.id]?.lapses ?? 0) - (p.data.cards[a.id]?.lapses ?? 0));

		listHead.empty();
		listHead.createSpan({ cls: "fch-muted", text: `${rows.length} kartu` });
		if (rows.length) btn(listHead, { text: `Latih ${rows.length} kartu ini`, icon: "zap", cls: "fch-btn-sm fch-btn-primary", onClick: () => hub.startSession(rows, { title: "Latihan pilihan", cram: true, mode: p.data.settings.defaultMode }) });

		list.empty();
		if (!rows.length) list.createDiv({ cls: "fch-empty", text: "Tidak ada kartu yang cocok." });
		for (const c of rows.slice(0, B.limit)) row(c);
		if (rows.length > B.limit) btn(list, { text: `Tampilkan lebih banyak (${rows.length - B.limit} lagi)`, cls: "fch-btn-ghost fch-more", onClick: () => { B.limit += 100; draw(); } });
	};

	const row = (c: Card) => {
		const st = p.data.cards[c.id];
		const status = st?.suspended ? "suspended" : isNewState(st) ? "new" : st!.due <= end ? "due" : st!.interval >= 21 ? "mature" : "learning";
		const r = list.createDiv(`fch-crow is-${status}`);
		const main = r.createDiv("fch-crow-main");
		main.createDiv({ cls: "fch-crow-front", text: plainText(c.front).replace(/\[…\]/g, "[…]") || "—" });
		main.createDiv({ cls: "fch-crow-back", text: plainText(c.answer ?? c.back) });
		const meta = main.createDiv("fch-crow-meta");
		meta.createSpan({ cls: `fch-type fch-type-${c.type}`, text: TYPE_LABEL[c.type] });
		meta.createSpan({ text: basename(c.path) });
		if (c.stored) meta.createSpan({ cls: "fch-type", text: "rapi" });
		if (c.orphan) meta.createSpan({ cls: "fch-type fch-type-leech", text: "teks sumber berubah", attr: { "aria-label": "Teks aslinya di catatan sudah diubah atau dihapus. Kartu tetap bisa dipelajari." } });
		if (st?.suspended) meta.createSpan({ text: "ditangguhkan" });
		else if (isNewState(st)) meta.createSpan({ text: "belum dipelajari" });
		else {
			meta.createSpan({ text: `ulas ${formatDue(st!.due)}` });
			const ret = retention(st, Date.now());
			if (ret !== null) meta.createSpan({ text: `ingat ±${Math.round(ret * 100)}%` });
			if (st!.lapses) meta.createSpan({ text: `${st!.lapses}× lupa` });
		}
		main.onclick = () => void p.openAt(c.path, c.line);

		const act = r.createDiv("fch-crow-act");
		const fl = act.createEl("button", { cls: "fch-flagbtn clickable-icon" + (p.data.flags[c.id] ? " is-on" : ""), attr: { "aria-label": p.data.flags[c.id] ? "Hapus tanda perbaiki" : "Tandai untuk diperbaiki nanti" } });
		setIcon(fl, "flag");
		fl.onclick = () => {
			if (p.data.flags[c.id]) p.setFlag(c, null);
			else p.setFlag(c, { reasons: [], note: "", t: Date.now() });
		};
		const star = act.createEl("button", { cls: "fch-star clickable-icon" + (st?.starred ? " is-on" : ""), attr: { "aria-label": "Tandai" } });
		setIcon(star, "star");
		star.onclick = () => { star.toggleClass("is-on", p.toggleStar(c)); };
		btn(act, { icon: st?.suspended ? "play" : "pause", cls: "fch-btn-ghost fch-btn-sm", label: st?.suspended ? "Aktifkan lagi" : "Tangguhkan", onClick: () => { p.toggleSuspend(c); draw(); } });
		btn(act, { icon: "rotate-ccw", cls: "fch-btn-ghost fch-btn-sm", label: "Reset progres (jadi kartu baru)", onClick: () => { p.resetCard(c); draw(); } });
		if (c.occ) {
			btn(act, { icon: "pencil", cls: "fch-btn-ghost fch-btn-sm", label: "Edit gambar & kotak", onClick: () => p.editOcclusion(c) });
			btn(act, { icon: "trash-2", cls: "fch-btn-ghost fch-btn-sm fch-danger", label: "Hapus kotak ini", onClick: () => p.deleteOcclusionMask(c) });
		}
		const sc = p.storedOf(c);
		if (sc) {
			btn(act, { icon: "pencil", cls: "fch-btn-ghost fch-btn-sm", label: "Edit kartu", onClick: () => p.editStored(sc) });
			btn(act, { icon: "trash-2", cls: "fch-btn-ghost fch-btn-sm fch-danger", label: "Hapus kartu", onClick: () => p.deleteStored(sc) });
		}
	};

	let t: number | undefined;
	search.oninput = () => {
		window.clearTimeout(t);
		t = window.setTimeout(() => { B.q = search.value; B.limit = 60; draw(); }, 150);
	};
	pathSel.onchange = () => { B.path = pathSel.value; draw(); };
	sortSel.onchange = () => { B.sort = sortSel.value as typeof B.sort; draw(); };
	draw();
}
