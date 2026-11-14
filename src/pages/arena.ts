import { Modal, Notice } from "obsidian";
import type { HubView } from "../hub-view";
import { MatchGame } from "../match";
import { KilatGame, SusunGame } from "../games";
import { formatDuration } from "../scheduler";
import { basename, btn } from "../util";
import { scopeSelect, scopeTitle } from "./launch";
import { renderMissions, weekKey } from "../missions";
import { weeklyBoss } from "../boss";
import { DuelGame, RaceGame } from "../race";
import { heroFigure, heroStats } from "../gear";
import { chestState } from "../collect";
import { activeEvent, bossDoneToday, claimable } from "../events";
import { dayKey } from "../scheduler";
import { startContrast } from "./launch";

export const SKINS: { id: string; name: string; price: number; a: string; b: string }[] = [
	{ id: "default", name: "Klasik", price: 0, a: "var(--interactive-accent)", b: "var(--background-primary)" },
	{ id: "sakura", name: "Sakura", price: 80, a: "#f472b6", b: "#fff1f5" },
	{ id: "ocean", name: "Samudra", price: 120, a: "#0ea5e9", b: "#ecfeff" },
	{ id: "forest", name: "Hutan", price: 120, a: "#16a34a", b: "#f0fdf4" },
	{ id: "sunset", name: "Senja", price: 200, a: "#f97316", b: "#fff7ed" },
	{ id: "galaxy", name: "Galaksi", price: 350, a: "#8b5cf6", b: "#1e1b4b" },
	{ id: "gold", name: "Emas", price: 600, a: "#d4a017", b: "#fffbeb" },
];

export function renderArena(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const m = p.data.meta;
	const lv = p.level();
	const hs = heroStats(p);

	// ---- kartu pemain
	const hero = el.createDiv("fch-ar2-hero");
	hero.createDiv("fch-ar2-hero-bg");
	const fig = hero.createDiv("fch-ar2-fig");
	heroFigure(p, fig, 7);
	const info = hero.createDiv("fch-ar2-info");
	info.createDiv({ cls: "fch-ar2-kicker", text: "🎮 ARENA PERMAINAN" });
	info.createEl("h1", { text: `Level ${lv.level} · ${lv.title}` });
	const xp = info.createDiv("fch-ar2-xp");
	xp.createDiv().style.width = `${Math.min(100, (lv.into / Math.max(1, lv.need)) * 100)}%`;
	info.createDiv({ cls: "fch-small fch-ar2-xpt", text: `${lv.into} / ${lv.need} XP menuju level ${lv.level + 1}` });
	const chips = info.createDiv("fch-ar2-chips");
	const chip = (t: string, l: string) => { const c = chips.createDiv("fch-ar2-chip"); c.createDiv({ cls: "fch-strong", text: t }); c.createDiv({ cls: "fch-small", text: l }); };
	chip(`🪙 ${(m.coins ?? 0).toLocaleString("id-ID")}`, "koin");
	chip(`⚡ ${hs.power}`, "kekuatan");
	chip(`🔥 ${p.streak().current}`, "hari beruntun");
	chip(`🗝️ ${m.dungeonBest ?? 0}`, "lantai terdalam");
	chip(`👾 ${m.bossWins ?? 0}`, "boss tumbang");

	// ---- hari ini
	const today = el.createDiv("fch-ar2-today");
	const quest = (icon: string, title: string, sub: string, done: boolean, go: () => void, hot = false) => {
		const c = today.createEl("button", { cls: "fch-ar2-quest" + (done ? " is-done" : hot ? " is-hot" : "") });
		c.createDiv({ cls: "fch-ar2-quest-ic", text: done ? "✅" : icon });
		const t = c.createDiv("fch-grow");
		t.createDiv({ cls: "fch-strong", text: title });
		t.createDiv({ cls: "fch-small", text: sub });
		c.onclick = go;
	};
	const wb = weeklyBoss(p);
	const bossDone = m.bossWeek === weekKey();
	quest("👾", "Boss mingguan", bossDone ? "Sudah dikalahkan minggu ini" : wb ? `Menjaga “${basename(wb.path)}” · 100 koin` : "Butuh materi ≥ 4 kartu", bossDone, () => hub.navigate("boss"), !!wb && !bossDone);
	const dd = m.dungeonDaily === dayKey(Date.now());
	quest("📅", "Dungeon harian", dd ? "Bonus hari ini sudah diambil" : "Capai lantai 5 · 🪙 150 + 🎴", dd, () => hub.navigate("dungeon"), !dd);
	const ch = chestState(p);
	quest("🧰", "Peti harian", ch.opened ? "Sudah dibuka hari ini" : ch.ready ? "Siap dibuka!" : `${ch.got}/${ch.need} kartu lagi`, ch.opened, () => hub.navigate("treasure"), ch.ready && !ch.opened);
	const ev = activeEvent(p);
	if (ev) quest(ev.def.icon, ev.def.name, bossDoneToday(p, ev) ? "Boss event hari ini selesai" : "Boss event & misi menunggu", bossDoneToday(p, ev) && !claimable(p, ev), () => hub.navigate("event"), !bossDoneToday(p, ev));

	// ---- petualangan
	const sec = (icon: string, title: string, sub: string) => { const s = el.createDiv("fch-ar2-sec"); const h = s.createDiv("fch-ar2-sech"); h.createSpan({ cls: "fch-ar2-sech-ic", text: icon }); const t = h.createDiv(); t.createDiv({ cls: "fch-ar2-sech-t", text: title }); t.createDiv({ cls: "fch-small fch-muted", text: sub }); return s; };
	const adv = sec("🗺️", "Petualangan", "Mode panjang dengan perlengkapan, hadiah, dan bahan alkimia").createDiv("fch-ar2-big");
	const big = (icon: string, title: string, desc: string, stat: string, c1: string, c2: string, go: () => void) => {
		const c = adv.createEl("button", { cls: "fch-ar2-bigtile" });
		c.style.setProperty("--c1", c1); c.style.setProperty("--c2", c2);
		c.createDiv({ cls: "fch-ar2-bigtile-ic", text: icon });
		c.createDiv({ cls: "fch-ar2-bigtile-t", text: title });
		c.createDiv({ cls: "fch-small fch-ar2-bigtile-d", text: desc });
		c.createDiv({ cls: "fch-ar2-bigtile-s", text: stat });
		c.onclick = go;
	};
	big("🗝️", "Dungeon Ilmu", "Roguelike 5 zona: pilih pintu, kumpulkan relik, kalahkan Bos Zona.", `Rekor lantai ${m.dungeonBest ?? 0}`, "#4c1d95", "#0f172a", () => hub.navigate("dungeon"));
	big("👾", "Aula Boss", "Tantang boss piksel dengan tingkat kesulitan berbeda.", `${m.bossWins ?? 0} kemenangan`, "#9f1239", "#1c1917", () => hub.navigate("boss"));
	big("🧭", "Peta Petualangan", "Taklukkan materi demi materi di peta dunia.", "Kuasai setiap pulau", "#065f46", "#0b1324", () => hub.navigate("adventure"));
	big("🏛️", "Istana Ingatan", "Tempatkan kartu di ruangan imajinasimu, lalu telusuri.", "Teknik loci", "#92400e", "#1c1917", () => hub.navigate("palace"));

	// ---- minigame
	const mg = sec("⚡", "Minigame cepat", "2–5 menit, cocok untuk pemanasan atau jeda");
	const bar = mg.createDiv("fch-ar2-scope");
	bar.createSpan({ cls: "fch-small fch-strong", text: "📘 Materi:" });
	let scope = hub.launch.scope;
	scopeSelect(hub, bar, scope, (v) => (scope = v));
	const games = mg.createDiv("fch-ar2-games");
	const game = (icon: string, name: string, desc: string, stat: string, start: () => boolean) => {
		const g = games.createEl("button", { cls: "fch-ar2-game" });
		g.createDiv({ cls: "fch-ar2-game-ic", text: icon });
		const t = g.createDiv("fch-grow");
		t.createDiv({ cls: "fch-strong", text: name });
		t.createDiv({ cls: "fch-small fch-muted", text: desc });
		g.createDiv({ cls: "fch-ar2-game-stat", text: stat });
		g.createDiv({ cls: "fch-ar2-play", text: "▶" });
		g.onclick = () => { if (!start()) new Notice("Materi ini belum punya cukup kartu untuk permainan ini."); };
	};
	const cards = () => hub.cardsForScope(scope);
	game("🧩", "Cocokkan", "3 ronde × 5 pasangan secepat mungkin", m.bestMatchMs !== undefined ? `⏱️ ${formatDuration(m.bestMatchMs)}` : "Belum ada rekor",
		() => hub.startGame(new MatchGame(hub, cards(), scopeTitle(scope))));
	game("⚡", "Kilat", "60 detik: benar atau salah?", `🏆 ${m.kilatBest ?? 0} poin`,
		() => hub.startGame(new KilatGame(hub, cards(), scopeTitle(scope))));
	game("🔢", "Susun Urutan", "Urutkan tahapan, proses, kronologi", `${m.susunDone ?? 0} tersusun`,
		() => hub.startGame(new SusunGame(hub, cards(), scopeTitle(scope))));
	game("🏁", "Lawan Dirimu Kemarin", "Balapan 12 soal melawan hantumu", `${m.races ?? 0} balapan`,
		() => hub.startGame(new RaceGame(hub, cards(), scopeTitle(scope), scope)));
	game("⚔️", "Duel 2 Pemain", "Bergantian di satu perangkat", `${m.duels ?? 0} duel`, () => {
		// Electron tidak mendukung window.prompt, jadi pakai modal sendiri
		const md = new Modal(hub.app);
		md.modalEl.addClass("fch-modal");
		md.contentEl.createDiv({ cls: "fch-modal-title", text: "⚔️ Duel 2 pemain" });
		const a = md.contentEl.createEl("input", { type: "text", cls: "fch-input fch-mt", attr: { placeholder: "Nama pemain 1" } });
		const b = md.contentEl.createEl("input", { type: "text", cls: "fch-input fch-mt", attr: { placeholder: "Nama pemain 2" } });
		const foot = md.contentEl.createDiv("fch-modal-foot fch-mt");
		foot.createDiv("fch-grow");
		const go = () => {
			md.close();
			if (!hub.startGame(new DuelGame(hub, cards(), scopeTitle(scope), [a.value.trim() || "Pemain 1", b.value.trim() || "Pemain 2"]))) new Notice("Materi ini belum punya cukup kartu untuk duel.");
		};
		btn(foot, { text: "Mulai duel", icon: "swords", cls: "fch-btn-primary", onClick: go });
		b.onkeydown = (e) => { if (e.key === "Enter") go(); };
		md.open();
		window.setTimeout(() => a.focus(), 30);
		return true;
	});
	game("⚖️", "Bedakan yang Mirip", "Kartu yang sering tertukar: A atau B?", `${m.contrasts ?? 0} kali`, () => { startContrast(hub); return true; });

	// ---- koleksi & toko
	const kol = sec("💎", "Koleksi & toko", "Belanjakan koin, racik bahan, lengkapi album").createDiv("fch-ar2-mini");
	const mini = (icon: string, t: string, s2: string, go: () => void) => { const c = kol.createEl("button", { cls: "fch-ar2-minitile" }); c.createDiv({ cls: "fch-ar2-minitile-ic", text: icon }); c.createDiv({ cls: "fch-strong fch-small", text: t }); c.createDiv({ cls: "fch-small fch-muted", text: s2 }); c.onclick = go; };
	mini("🛒", "Toko", "Senjata, zirah, ramuan", () => hub.navigate("shop"));
	mini("⚗️", "Bengkel Alkimia", "Racik bahan dungeon", () => hub.navigate("alchemy"));
	mini("🎴", "Album Koleksi", `${p.data.collect.packs} bungkus belum dibuka`, () => hub.navigate("album"));
	mini("🧰", "Harta Karun", "Peti harian & peta", () => hub.navigate("treasure"));
	mini("🏅", "Prestasi", "Lencana & tingkatan", () => hub.navigate("awards"));

	renderMissions(p, el, () => hub.renderPage());

	const shop = el.createDiv("fch-section fch-mt");
	shop.createEl("h3", { text: "Toko tema kartu" });
	shop.createDiv({ cls: "fch-muted fch-small fch-desc", text: "Koin didapat dari setiap kartu yang dinilai (+1, atau +2 bila benar), sesi sempurna (+10), dan minigame." });
	const grid = shop.createDiv("fch-skins");
	const owned = new Set(["default", ...(m.skins ?? [])]);
	for (const s of SKINS) {
		const c = grid.createDiv("fch-skin" + (p.data.settings.skin === s.id ? " is-on" : ""));
		const sw = c.createDiv("fch-skin-swatch");
		sw.style.background = `linear-gradient(135deg, ${s.b} 0 55%, ${s.a} 55%)`;
		sw.style.borderColor = s.a;
		c.createDiv({ cls: "fch-strong", text: s.name });
		if (p.data.settings.skin === s.id) c.createDiv({ cls: "fch-muted fch-small", text: "Dipakai" });
		else if (owned.has(s.id)) btn(c, { text: "Pakai", cls: "fch-btn-sm", onClick: async () => { p.data.settings.skin = s.id; await p.saveNow(); hub.applySkin(); hub.renderPage(); } });
		else btn(c, {
			text: `🪙 ${s.price}`, cls: "fch-btn-sm" + ((m.coins ?? 0) >= s.price ? " fch-btn-primary" : ""), disabled: (m.coins ?? 0) < s.price,
			onClick: async () => {
				m.coins = (m.coins ?? 0) - s.price;
				m.skins = [...(m.skins ?? []), s.id];
				p.data.settings.skin = s.id;
				await p.saveNow();
				hub.applySkin();
				p.checkAchievements();
				new Notice(`🎨 Tema ${s.name} terbuka!`);
				hub.renderPage();
			},
		});
	}
}
