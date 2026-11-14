import type { HubView } from "../hub-view";
import { renderTodayPanel } from "../tasks";
import { reviewDue } from "../review";
import { CaptureModal } from "../capture";
import { btn } from "../util";

/** Pemberitahuan penting (selalu tampil): review mingguan & stopwatch berjalan. */
export function renderBanners(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	if (reviewDue(p)) {
		const b = el.createDiv("fch-banner fch-mt");
		b.createSpan({ text: "🧭 Akhir pekan! Saatnya review mingguan: bereskan tugas, refleksi, dan rencanakan minggu depan (+30 🪙)." });
		btn(b, { text: "Mulai review", cls: "fch-btn-primary fch-btn-sm", onClick: () => hub.navigate("review") });
	}
	const sw = p.data.meta.stopwatch;
	if (sw) {
		const b = el.createDiv("fch-banner fch-mt");
		b.createSpan({ text: `⏱ Stopwatch berjalan: ${sw.subject} sejak ${new Date(sw.start).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` });
		btn(b, { text: "Buka", cls: "fch-btn-sm", onClick: () => hub.navigate("focus") });
	}
}

export function renderTasksPanel(hub: HubView, el: HTMLElement) {
	const wrap = el.createDiv("fch-mt");
	renderTodayPanel(hub, wrap);
	const cap = wrap.querySelector(".fch-today-tasks .fch-section-head") as HTMLElement | null;
	if (cap) btn(cap, { text: "⚡ Tangkap cepat", cls: "fch-btn-link", onClick: () => new CaptureModal(hub.app, hub.plugin).open() });
}
