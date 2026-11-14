import type { HubView } from "../hub-view";
import { ACHIEVEMENTS, TIERS, evaluate, medal, recentUnlocks } from "../achievements";
import { ring } from "../util";

export function renderAchievements(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const lv = p.level();
	const states = evaluate(p);
	const total = ACHIEVEMENTS.length * TIERS.length;
	const got = states.reduce((a, s) => a + s.tier, 0);

	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "Prestasi" });
	head.createDiv({ cls: "fch-muted", text: "Setiap prestasi punya 5 tingkat: Perunggu, Perak, Emas, Platinum, dan Legenda." });

	const hero = el.createDiv("fch-hero fch-ach-hero");
	const lring = ring(hero, lv.into / lv.need, 128, undefined, "fch-ring-big fch-level-ring");
	const inner = lring.createDiv("fch-ring-inner");
	inner.createDiv({ cls: "fch-muted fch-small", text: "Level" });
	inner.createDiv({ cls: "fch-ring-num", text: String(lv.level) });
	const info = hero.createDiv("fch-hero-l");
	info.createDiv({ cls: "fch-hero-num", text: lv.title });
	info.createDiv({ cls: "fch-hero-sub", text: `${lv.xp.toLocaleString("id-ID")} XP · ${(lv.need - lv.into).toLocaleString("id-ID")} XP lagi menuju level ${lv.level + 1}` });
	const facts = info.createDiv("fch-facts");
	const fact = (v: string, l: string) => {
		const f = facts.createDiv("fch-fact");
		f.createDiv({ cls: "fch-fact-v", text: v });
		f.createDiv({ cls: "fch-muted fch-small", text: l });
	};
	fact(`${got}/${total}`, "tingkat terbuka");
	fact(String(states.filter((s) => s.tier === 5).length), "prestasi Legenda");
	fact(`⚡ ${p.data.meta.maxCombo ?? 0}`, "combo terbaik");
	fact(`💎 ${p.data.meta.perfectSessions ?? 0}`, "sesi sempurna");

	const recent = recentUnlocks(p, 6);
	if (recent.length) {
		const sec = el.createDiv("fch-section");
		sec.createEl("h3", { text: "Baru saja terbuka" });
		const row = sec.createDiv("fch-recent-ach");
		for (const r of recent) {
			const it = row.createDiv("fch-recent-it");
			medal(it, r.def.icon, r.tier + 1, 48);
			it.createDiv({ cls: "fch-strong fch-small", text: r.def.name });
			it.createDiv({ cls: "fch-muted fch-small", text: `${TIERS[r.tier]} · ${new Date(r.t).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}` });
		}
	}

	const groups = [...new Set(ACHIEVEMENTS.map((a) => a.group))];
	for (const g of groups) {
		const sec = el.createDiv("fch-section");
		sec.createEl("h3", { text: g });
		const grid = sec.createDiv("fch-ach-grid");
		for (const st of states.filter((s) => s.def.group === g)) {
			const d = st.def;
			const card = grid.createDiv("fch-ach" + (st.tier ? ` t${st.tier}` : " is-locked"));
			medal(card, d.icon, st.tier, 60);
			const body = card.createDiv("fch-ach-body");
			const top = body.createDiv("fch-ach-top");
			top.createSpan({ cls: "fch-ach-name", text: d.name });
			if (st.tier) top.createSpan({ cls: `fch-tier t${st.tier}`, text: TIERS[st.tier - 1] });
			body.createDiv({ cls: "fch-muted fch-small", text: st.next !== null ? d.goal(st.next) : `Tuntas! ${d.goal(d.tiers[4])}` });
			const bar = body.createDiv("fch-bar fch-bar-thin");
			bar.createDiv("fch-bar-fill").style.width = `${st.progress * 100}%`;
			const meta = body.createDiv("fch-ach-meta");
			const pips = meta.createDiv("fch-pips");
			for (let i = 0; i < 5; i++) pips.createSpan({ cls: `fch-pip t${i + 1}` + (i < st.tier ? " is-on" : ""), attr: { "aria-label": `${TIERS[i]}: ${d.goal(d.tiers[i])}` } });
			const fmt = d.fmt ?? ((v: number) => v.toLocaleString("id-ID"));
			meta.createSpan({ cls: "fch-muted fch-small", text: st.next !== null ? `${fmt(st.value)} / ${fmt(st.next)}` : fmt(st.value) });
		}
	}
}
