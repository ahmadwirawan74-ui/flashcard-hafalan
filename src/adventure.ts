import { Notice } from "obsidian";
import type { HubView } from "./hub-view";
import type FlashcardPlugin from "./main";
import { BossBattle, bossSprite } from "./boss";
import { mascotState } from "./missions";
import { isNewState } from "./scheduler";
import { basename, btn, folderOf } from "./util";

const THEMES = [
	{ name: "Padang Hijau", bg: "#7cc36b", bg2: "#6ab45a", deco: ["🌲", "🌳", "🌼", "🍄"] },
	{ name: "Gurun Pasir", bg: "#e9c46a", bg2: "#dcb45a", deco: ["🌵", "🏜️", "🦂", "🌴"] },
	{ name: "Pegunungan Salju", bg: "#cfe3f3", bg2: "#bcd5ea", deco: ["🏔️", "⛄", "🌲", "❄️"] },
	{ name: "Pulau Tropis", bg: "#56c2c9", bg2: "#47b2b9", deco: ["🏝️", "🐚", "🌴", "🐠"] },
	{ name: "Gunung Api", bg: "#b35a4a", bg2: "#a14d3e", deco: ["🌋", "🔥", "🪨", "💎"] },
];

/** Penguasaan materi = porsi kartu dengan interval ≥ 3 hari (sudah "lulus" belajar awal). */
export function mastery(p: FlashcardPlugin, path: string): number {
	const cs = (p.index.get(path) ?? []).filter((c) => !p.data.cards[c.id]?.suspended);
	if (!cs.length) return 0;
	return cs.filter((c) => { const st = p.data.cards[c.id]; return !isNewState(st) && st!.interval >= 3; }).length / cs.length;
}

let selected = "";

export function renderAdventure(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const s = p.data.settings;
	const paths = p.sortedPaths();
	const head = el.createDiv("fch-pagehead fch-pagehead-row");
	const ht = head.createDiv();
	ht.createEl("h1", { text: "🗺️ Petualangan" });
	ht.createDiv({ cls: "fch-muted", text: "Setiap materi adalah satu level. Kuasai ≥ 80% kartu (interval ≥ 3 hari) untuk membuka level berikutnya. Kalahkan boss di ujung setiap dunia!" });
	const lk = head.createEl("label", { cls: "fch-toggle" });
	const cb = lk.createEl("input", { type: "checkbox" });
	cb.checked = !s.adventureLock;
	cb.onchange = () => { s.adventureLock = !cb.checked; p.requestSave(); hub.renderPage(); };
	lk.createSpan({ cls: "fch-small", text: "Mode bebas (semua level terbuka)" });
	if (!paths.length) return void el.createDiv({ cls: "fch-empty", text: "Belum ada materi untuk dijelajahi." });

	const worlds = new Map<string, string[]>();
	for (const x of paths) (worlds.get(folderOf(x)) ?? worlds.set(folderOf(x), []).get(folderOf(x))!).push(x);
	const pet = mascotState(p);
	let wi = 0;
	let prevOk = true; // level pertama selalu terbuka
	for (const [folder, files] of worlds) {
		const th = THEMES[wi % THEMES.length];
		const world = el.createDiv("fch-world");
		const wh = world.createDiv("fch-world-head");
		wh.createSpan({ cls: "fch-world-num", text: `DUNIA ${wi + 1}` });
		wh.createSpan({ cls: "fch-world-name", text: `${folder || "Tanpa folder"} · ${th.name}` });
		const done = files.filter((f) => mastery(p, f) >= 0.8).length;
		wh.createSpan({ cls: "fch-muted fch-small", text: `${done}/${files.length} level dikuasai` });
		const map = world.createDiv("fch-map");
		map.style.setProperty("--map-bg", th.bg);
		map.style.setProperty("--map-bg2", th.bg2);
		const COLS = 4, CW = 170, RH = 130;
		const nodes = [...files, "__boss"];
		const pos = nodes.map((_, i) => {
			const row = Math.floor(i / COLS), col = i % COLS;
			return { x: 90 + (row % 2 ? COLS - 1 - col : col) * CW, y: 70 + row * RH };
		});
		const H = 70 + Math.ceil(nodes.length / COLS) * RH;
		map.style.height = `${H}px`;
		// jalur
		const NS = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(NS, "svg");
		svg.setAttribute("class", "fch-map-path");
		svg.setAttribute("viewBox", `0 0 ${90 * 2 + (COLS - 1) * CW} ${H}`);
		svg.setAttribute("preserveAspectRatio", "none");
		const pl = document.createElementNS(NS, "polyline");
		pl.setAttribute("points", pos.map((q) => `${q.x},${q.y}`).join(" "));
		svg.appendChild(pl);
		map.appendChild(svg);
		const W = 90 * 2 + (COLS - 1) * CW;
		// hiasan
		for (let k = 0; k < nodes.length + 3; k++) {
			const d = map.createSpan({ cls: "fch-map-deco", text: th.deco[k % th.deco.length] });
			const q = pos[k % pos.length];
			d.style.left = `${((q.x + (k % 2 ? 62 : -66)) / W) * 100}%`;
			d.style.top = `${q.y + (k % 3 === 0 ? 34 : -42)}px`;
		}
		let worldOk = true;
		nodes.forEach((path, i) => {
			const isBoss = path === "__boss";
			const m = isBoss ? 0 : mastery(p, path);
			const unlocked = !s.adventureLock || (isBoss ? worldOk && prevOk : prevOk);
			const mastered = !isBoss && m >= 0.8;
			const current = unlocked && !mastered && !isBoss && (i === 0 || prevOk);
			const n = map.createEl("button", { cls: "fch-node" + (isBoss ? " is-boss" : "") + (mastered ? " is-done" : unlocked ? " is-open" : " is-locked") + (selected === path ? " is-sel" : "") });
			n.style.left = `${(pos[i].x / W) * 100}%`;
			n.style.top = `${pos[i].y}px`;
			if (isBoss) bossSprite(n.createDiv("fch-node-tile"), wi, 3);
			else n.createDiv({ cls: "fch-node-tile", text: !unlocked ? "🔒" : mastered ? "⭐" : "🏰" });
			if (current) n.createDiv({ cls: "fch-node-pet", text: pet.stage.icon });
			n.createDiv({ cls: "fch-node-label", text: isBoss ? "BOSS" : basename(path).slice(0, 20) });
			if (!isBoss) {
				const bar = n.createDiv("fch-node-bar");
				bar.createDiv().style.width = `${Math.round(m * 100)}%`;
			}
			n.onclick = () => { selected = isBoss ? `__boss:${folder}` : path; hub.renderPage(); };
			if (!isBoss) {
				worldOk = worldOk && mastered;
				prevOk = mastered;
			}
		});
		wi++;
	}

	// detail level terpilih
	if (!selected) return;
	const d = el.createDiv("fch-panel fch-level");
	if (selected.startsWith("__boss:")) {
		const folder = selected.slice(7);
		const cards = paths.filter((x) => folderOf(x) === folder).flatMap((x) => p.index.get(x) ?? []);
		d.createEl("h3", { text: `👾 Boss Dunia · ${folder || "Tanpa folder"}` });
		d.createDiv({ cls: "fch-muted fch-small", text: "Soal pilihan ganda dari seluruh materi di dunia ini. Kalahkan untuk 20 koin dan prestasi Penakluk Boss." });
		const idx = [...worlds.keys()].indexOf(folder);
		btn(d, { text: "Lawan boss", icon: "swords", cls: "fch-btn-primary", onClick: () => {
			const all = paths.filter((x) => folderOf(x) === folder);
			const open = !s.adventureLock || all.every((x) => mastery(p, x) >= 0.8);
			if (!open) return void new Notice("Kuasai semua level di dunia ini dulu (≥ 80%), atau nyalakan Mode bebas.");
			if (!hub.startGame(new BossBattle(hub, cards, folder || "Dunia", idx, false))) new Notice("Butuh minimal 4 kartu yang bisa dijadikan soal.");
		} });
		return;
	}
	const c = p.countFor([selected]);
	const m = mastery(p, selected);
	d.createEl("h3", { text: `🏰 ${basename(selected)}` });
	d.createDiv({ cls: "fch-small", text: `Penguasaan ${Math.round(m * 100)}% · ${c.total} kartu · ${c.due} ulasan · ${c.fresh} baru` });
	d.createDiv("fch-bar fch-mt").createDiv("fch-bar-fill").style.width = `${Math.round(m * 100)}%`;
	const idx = paths.indexOf(selected);
	const locked = s.adventureLock && idx > 0 && (() => { for (let k = 0; k < idx; k++) if (mastery(p, paths[k]) < 0.8 && folderOf(paths[k]) === folderOf(selected)) return true; const prevWorld = paths.slice(0, idx).filter((x) => folderOf(x) !== folderOf(selected)); return prevWorld.some((x) => mastery(p, x) < 0.8); })();
	const r = d.createDiv("fch-row fch-mt");
	if (locked) d.createDiv({ cls: "fch-tipline", text: "🔒 Level ini masih terkunci. Kuasai level sebelumnya ≥ 80%, atau nyalakan Mode bebas." });
	btn(r, { text: "Mulai level", icon: "play", cls: "fch-btn-primary", disabled: locked, onClick: () => hub.startSession(p.index.get(selected) ?? [], { title: basename(selected), cram: false, mode: s.defaultMode }) });
	btn(r, { text: "Latihan bebas", icon: "zap", disabled: locked, onClick: () => hub.startSession(p.index.get(selected) ?? [], { title: basename(selected), cram: true, mode: s.defaultMode }) });
	btn(r, { text: "Peta pikiran", icon: "git-fork", cls: "fch-btn-ghost", onClick: () => hub.openMindmap(selected) });
}
