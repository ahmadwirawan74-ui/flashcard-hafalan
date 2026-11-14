import { App, Modal, setIcon } from "obsidian";
import type { HubView, Page } from "./hub-view";
import { PAGES, WORKSPACES } from "./hub-view";
import { CaptureModal } from "./capture";
import { BlockModal, setPlannerTab } from "./studyplan";
import { TOTAL, fromGid, openReader } from "./quran";
import { allDrugs, openDrug } from "./medis";

interface Item { title: string; sub: string; icon: string; color: string; run: () => void; keys: string; onlyQuery?: boolean }

/** Cari menu: lompat ke halaman atau jalankan aksi dengan mengetik (Ctrl/Cmd+K). */
export class FinderModal extends Modal {
	private items: Item[] = [];
	private sel = 0;
	constructor(app: App, private hub: HubView) { super(app); }

	private build() {
		const hub = this.hub, p = hub.plugin;
		const go = (pg: Page) => () => hub.navigate(pg);
		const out: Item[] = [];
		const w = p.waitingToday();
		const act = (title: string, sub: string, icon: string, run: () => void, keys = "") => out.push({ title, sub, icon, color: "#6366f1", run, keys: (title + " " + sub + " " + keys).toLowerCase() });
		act(`Mulai belajar${w.due + w.fresh ? ` (${w.due + w.fresh} kartu)` : ""}`, "Aksi · flashcard", "play", () => { if (!hub.startSession(p.allCards(), { title: "Semua materi", cram: !(w.due + w.fresh), mode: p.data.settings.defaultMode })) hub.navigate("study"); }, "review ulas");
		act("Tangkap cepat", "Aksi · tugas, kartu, atau catatan", "zap", () => new CaptureModal(this.app, p).open(), "tambah capture");
		act("Tambah jadwal belajar", "Aksi · jadwalkan flashcard, catatan, hafalan", "calendar-plus", () => { setPlannerTab("blocks"); hub.navigate("planner"); new BlockModal(this.app, p, () => hub.renderPage()).open(); }, "jadwal rencana");
		act("Lanjutkan tilawah", "Aksi · Al-Qur'an", "book-open", () => { const g = p.data.quran.last ? Math.min(TOTAL, p.data.quran.last.g + 1) : 1; openReader(fromGid(g)[0], g); hub.navigate("quran"); }, "quran baca");
		act(p.pomo.running ? "Jeda Pomodoro" : "Mulai Pomodoro", "Aksi · fokus", "timer", () => p.pomo.toggle(), "fokus timer");
		act("Ganti gaya tampilan", "Aksi · Retro / Lounge / Modern", "palette", () => { const order = ["retro-web", "retro-console", "lounge", "modern"] as const; const i = order.indexOf(p.data.settings.uiStyle as (typeof order)[number]); void p.setUiStyle(order[(i + 1) % order.length]); }, "tema theme");
		act("Pengaturan", "Aksi", "settings", () => hub.openSettings(), "setting");
		for (const ws of WORKSPACES) for (const pg of ws.pages) {
			const m = PAGES[pg]!;
			out.push({ title: m.label, sub: `${ws.label} · ${m.desc}`, icon: m.icon, color: ws.color, run: go(pg), keys: `${m.label} ${ws.label} ${m.desc}`.toLowerCase() });
		}
		if (p.data.settings.medis) for (const d of allDrugs(p)) out.push({ title: d.name, sub: `Obat · ${d.cls}`, icon: "pill", color: "#0d9488", run: () => openDrug(hub, d.id), keys: `${d.name} ${(d.alias ?? []).join(" ")} ${d.cls} obat`.toLowerCase(), onlyQuery: true });
		return out;
	}

	onOpen() {
		this.modalEl.addClass("fch-modal", "fch-finder");
		const el = this.contentEl;
		const all = this.build();
		const box = el.createDiv("fch-finder-box");
		const ic = box.createSpan("fch-finder-ic");
		setIcon(ic, "search");
		const inp = box.createEl("input", { type: "text", cls: "fch-finder-in", attr: { placeholder: "Ketik nama menu atau aksi… mis. “tasbih”, “jadwal”, “kartu”" } });
		const list = el.createDiv("fch-finder-list");
		const draw = () => {
			const q = inp.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
			this.items = all.filter((x) => (!x.onlyQuery || q.length > 0) && q.every((w) => x.keys.includes(w))).slice(0, 60);
			this.sel = Math.min(this.sel, Math.max(0, this.items.length - 1));
			list.empty();
			this.items.forEach((x, i) => {
				const r = list.createDiv("fch-finder-row" + (i === this.sel ? " is-sel" : ""));
				const c = r.createSpan("fch-finder-chip");
				c.style.setProperty("--ws", x.color);
				setIcon(c, x.icon);
				const t = r.createDiv("fch-grow");
				t.createDiv({ cls: "fch-strong", text: x.title });
				t.createDiv({ cls: "fch-muted fch-small", text: x.sub });
				r.onclick = () => this.pick(i);
				r.onmouseenter = () => { this.sel = i; list.querySelectorAll(".fch-finder-row").forEach((e, j) => e.toggleClass("is-sel", j === i)); };
			});
			if (!this.items.length) list.createDiv({ cls: "fch-muted fch-small fch-finder-empty", text: "Tidak ditemukan." });
		};
		inp.oninput = () => { this.sel = 0; draw(); };
		inp.onkeydown = (e) => {
			if (e.key === "ArrowDown") { e.preventDefault(); this.sel = Math.min(this.items.length - 1, this.sel + 1); draw(); list.querySelector(".is-sel")?.scrollIntoView({ block: "nearest" }); }
			else if (e.key === "ArrowUp") { e.preventDefault(); this.sel = Math.max(0, this.sel - 1); draw(); list.querySelector(".is-sel")?.scrollIntoView({ block: "nearest" }); }
			else if (e.key === "Enter") { e.preventDefault(); this.pick(this.sel); }
			else if (e.key === "Escape") { e.preventDefault(); this.close(); }
		};
		el.createDiv({ cls: "fch-muted fch-small fch-finder-foot", text: "↑ ↓ pilih · Enter buka · Esc tutup" });
		draw();
		window.setTimeout(() => inp.focus(), 20);
	}
	private pick(i: number) {
		const it = this.items[i];
		if (!it) return;
		this.close();
		it.run();
	}
	onClose() { this.contentEl.empty(); }
}
