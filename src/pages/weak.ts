import type { HubView } from "../hub-view";
import { confusablePairs, topics, typeAccuracy, weakCards } from "../analytics";
import { startContrast } from "./launch";
import { Card, TYPE_LABEL } from "../types";
import { basename, btn, plainText } from "../util";

export function renderWeak(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const mode = p.data.settings.defaultMode;
	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "Kelemahan" });
	head.createDiv({ cls: "fch-muted", text: "Deteksi otomatis topik dan kartu yang paling sulit kamu ingat, beserta saran cara memperkuatnya." });

	const weak = weakCards(p);
	const tps = topics(p).filter((t) => t.weakness >= 0.12);
	const startWeak = (cards: Card[], title: string) => {
		p.bumpMeta("weakSessions");
		hub.startSession(cards, { title, cram: true, mode, interleave: true });
	};

	const hero = el.createDiv("fch-hero");
	const hl = hero.createDiv("fch-hero-l");
	hl.createDiv({ cls: "fch-hero-num", text: weak.length ? `${weak.length} kartu lemah` : "Tidak ada kartu lemah 💪" });
	hl.createDiv({ cls: "fch-hero-sub", text: weak.length ? `Tersebar di ${new Set(weak.map((w) => w.card.path)).size} materi. Latihan terfokus 10 menit bisa memperkuat semuanya.` : "Teruskan belajar rutin. Kartu yang mulai sulit akan muncul di sini." });
	if (weak.length) {
		const row = hl.createDiv("fch-row");
		btn(row, { text: `Latih ${Math.min(weak.length, 30)} kartu terlemah`, icon: "target", cls: "fch-btn-primary fch-btn-lg", onClick: () => startWeak(weak.slice(0, 30).map((w) => w.card), "Latihan kelemahan") });
	}

	// ---- topik lemah
	const sec = el.createDiv("fch-section");
	sec.createEl("h3", { text: "Topik lemah" });
	sec.createDiv({ cls: "fch-muted fch-small fch-desc", text: "Dikelompokkan per materi dan heading. Skor gabungan dari perkiraan ingatan, akurasi terbaru, dan seberapa sering terlupa." });
	if (!tps.length) sec.createDiv({ cls: "fch-empty", text: "Belum ada topik yang lemah (atau belum cukup data ulasan)." });
	const list = sec.createDiv("fch-topics");
	for (const t of tps.slice(0, 10)) {
		const r = list.createDiv("fch-topic");
		const info = r.createDiv("fch-grow");
		info.createDiv({ cls: "fch-strong", text: t.label });
		const meter = info.createDiv("fch-weakbar");
		meter.createDiv("fch-weakbar-fill").style.width = `${Math.min(1, t.weakness / 0.6) * 100}%`;
		info.createDiv({ cls: "fch-muted fch-small", text: `ingatan ±${Math.round(t.retention * 100)}% · akurasi ${Math.round(t.accuracy * 100)}% · ${t.lapseRate.toFixed(1)}× lupa/kartu · ${t.cards.length} kartu` });
		btn(r, { text: "Latih topik", icon: "zap", cls: "fch-btn-sm", onClick: () => startWeak(t.cards, t.label) });
	}

	// ---- pola kesalahan per tipe
	const ta = typeAccuracy(p);
	if (ta.length >= 2) {
		const s2 = el.createDiv("fch-panel");
		s2.createEl("h3", { text: "Tipe kartu tersulit" });
		for (const x of ta) {
			const r = s2.createDiv("fch-typeacc");
			r.createSpan({ cls: "fch-typeacc-l", text: x.label });
			const b = r.createDiv("fch-bar fch-grow");
			const f = b.createDiv("fch-bar-fill");
			f.style.width = `${x.acc * 100}%`;
			f.style.background = x.acc >= 0.85 ? "var(--fch-g2)" : x.acc >= 0.7 ? "var(--fch-g1)" : "var(--fch-g0)";
			r.createSpan({ cls: "fch-typeacc-v", text: `${Math.round(x.acc * 100)}%` });
		}
		const worst = ta[0];
		if (worst.acc < 0.8) s2.createDiv({ cls: "fch-tipline", text: `💡 Kartu ${worst.label} paling sering salah. ${worst.label === "List" || worst.label === "Multi Line" ? "Coba pecah jadi kartu yang lebih kecil, atau pakai checklist untuk menandai bagian yang belum hafal." : "Coba tambahkan mnemonik (M) atau ubah susunan kalimatnya agar lebih jelas."}` });
	}

	// ---- pasangan yang sering tertukar
	const pairs = confusablePairs(p, 8);
	if (pairs.length) {
		const ps = el.createDiv("fch-panel");
		const h = ps.createDiv("fch-section-head");
		h.createEl("h3", { text: "⚖️ Sering tertukar" });
		btn(h, { text: "Latih bedakan", cls: "fch-btn-link", onClick: () => startContrast(hub) });
		for (const x of pairs) {
			const r = ps.createDiv("fch-pair");
			r.createSpan({ cls: "fch-pair-a", text: plainText(x.a.front).slice(0, 60) });
			r.createSpan({ cls: "fch-pair-vs", text: "vs" });
			r.createSpan({ cls: "fch-pair-b", text: plainText(x.b.front).slice(0, 60) });
			r.createSpan({ cls: "fch-reason", text: x.reason });
		}
	}

	// ---- kartu lemah (weakness detection)
	const s3 = el.createDiv("fch-section");
	s3.createEl("h3", { text: "Kartu yang perlu perhatian" });
	const cl = s3.createDiv("fch-fix-list");
	for (const w of weak.slice(0, 25)) {
		const c = w.card;
		const r = cl.createDiv("fch-fix is-weak");
		const m = r.createDiv("fch-fix-main");
		const top = m.createDiv("fch-fix-top");
		top.createSpan({ cls: `fch-type fch-type-${c.type}`, text: TYPE_LABEL[c.type] });
		top.createSpan({ cls: "fch-muted fch-small", text: basename(c.path) });
		m.createDiv({ cls: "fch-fix-front", text: plainText(c.front).slice(0, 140) });
		const why = m.createDiv("fch-fix-why");
		w.reasons.forEach((x) => why.createSpan({ cls: "fch-reason", text: x }));
		if (!p.data.mnemo[c.id]) why.createSpan({ cls: "fch-reason is-tip", text: "saran: tulis mnemonik" });
		const act = r.createDiv("fch-fix-act");
		btn(act, { text: "Latih", icon: "zap", cls: "fch-btn-sm", onClick: () => startWeak([c], "Latihan kartu") });
		btn(act, { icon: "pencil", cls: "fch-btn-ghost fch-btn-sm", label: "Edit kartu", onClick: () => p.editAny(c) });
		btn(act, { icon: "flag", cls: "fch-btn-ghost fch-btn-sm", label: "Tandai untuk diperbaiki", onClick: () => p.setFlag(c, { reasons: ["Terdeteksi lemah"], note: w.reasons.join(", "), t: Date.now() }) });
	}
}
