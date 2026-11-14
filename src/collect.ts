import { App, Modal, Notice } from "obsidian";
import type FlashcardPlugin from "./main";
import type { HubView } from "./hub-view";
import { CollectState } from "./types";
import { addDays, dayKey } from "./scheduler";
import { weekKey, weekStart } from "./missions";
import { btn, confetti } from "./util";
import { play } from "./sound";

// ================================================================ data kartu koleksi
export type Rarity = "umum" | "langka" | "epik" | "legendaris";
export interface CCard { id: string; album: string; name: string; years: string; icon: string; rarity: Rarity; fact: string }
export const ALBUMS = [
	{ id: "sains", name: "Ilmuwan & Penemu Dunia", icon: "🔬", color: "#3b82f6", reward: "Bingkai Biru Sains" },
	{ id: "muslim", name: "Ilmuwan Muslim", icon: "🌙", color: "#10b981", reward: "Bingkai Zamrud Baitul Hikmah" },
	{ id: "pahlawan", name: "Pahlawan Nasional", icon: "🇮🇩", color: "#ef4444", reward: "Bingkai Merah Putih" },
	{ id: "event", name: "Edisi Terbatas", icon: "🎖️", color: "#ca8a04", reward: "Bingkai Emas Musiman" },
];
const C = (album: string, id: string, name: string, years: string, icon: string, rarity: Rarity, fact: string): CCard => ({ id, album, name, years, icon, rarity, fact });
/** Fakta ditulis singkat & hanya yang sudah mapan. */
export const CARDS: CCard[] = [
	C("sains", "newton", "Isaac Newton", "1643–1727", "🍎", "legendaris", "Merumuskan tiga hukum gerak dan hukum gravitasi universal dalam karyanya, Principia (1687)."),
	C("sains", "curie", "Marie Curie", "1867–1934", "☢️", "epik", "Orang pertama yang meraih dua Hadiah Nobel di dua bidang sains berbeda: Fisika (1903) dan Kimia (1911)."),
	C("sains", "einstein", "Albert Einstein", "1879–1955", "🌌", "epik", "Mencetuskan teori relativitas; meraih Nobel Fisika 1921 atas penjelasan efek fotolistrik."),
	C("sains", "galileo", "Galileo Galilei", "1564–1642", "🔭", "langka", "Memakai teleskop untuk mengamati langit dan menemukan empat bulan terbesar Jupiter pada 1610."),
	C("sains", "darwin", "Charles Darwin", "1809–1882", "🐢", "langka", "Menjelaskan evolusi melalui seleksi alam dalam buku On the Origin of Species (1859)."),
	C("sains", "pasteur", "Louis Pasteur", "1822–1895", "🧪", "langka", "Mengembangkan pasteurisasi dan vaksin rabies yang pertama kali berhasil dipakai pada manusia (1885)."),
	C("sains", "fleming", "Alexander Fleming", "1881–1955", "🍄", "langka", "Menemukan penisilin pada 1928 dari jamur Penicillium, cikal bakal antibiotik modern."),
	C("sains", "mendeleev", "Dmitri Mendeleev", "1834–1907", "🧱", "umum", "Menyusun tabel periodik unsur (1869) dan meramalkan unsur-unsur yang saat itu belum ditemukan."),
	C("sains", "mendel", "Gregor Mendel", "1822–1884", "🌱", "umum", "Lewat percobaan kacang ercis, ia menemukan pola pewarisan sifat yang menjadi dasar genetika."),
	C("sains", "edison", "Thomas Edison", "1847–1931", "💡", "umum", "Penemu produktif dengan lebih dari 1.000 paten, termasuk fonograf dan lampu pijar yang praktis."),
	C("sains", "tesla", "Nikola Tesla", "1856–1943", "⚡", "umum", "Mengembangkan sistem listrik arus bolak-balik (AC) dan motor induksi yang dipakai luas hingga kini."),
	C("sains", "lovelace", "Ada Lovelace", "1815–1852", "🧮", "umum", "Dianggap penulis program komputer pertama: algoritma untuk Mesin Analitik rancangan Charles Babbage."),
	C("muslim", "khawarizmi", "Al-Khawarizmi", "±780–850", "➗", "legendaris", "Kitabnya melahirkan ilmu aljabar, dan kata “algoritma” berasal dari namanya."),
	C("muslim", "ibnusina", "Ibnu Sina", "980–1037", "📕", "epik", "Menulis Al-Qanun fi ath-Thibb, ensiklopedia kedokteran yang menjadi rujukan selama berabad-abad."),
	C("muslim", "haitham", "Ibnu al-Haitham", "±965–±1040", "👁️", "epik", "Dalam Kitab al-Manazir ia menjelaskan cara kerja penglihatan dan menekankan pembuktian lewat eksperimen."),
	C("muslim", "biruni", "Al-Biruni", "973–±1050", "🌍", "langka", "Menghitung jari-jari Bumi dengan trigonometri dari puncak gunung, hasilnya mendekati nilai modern."),
	C("muslim", "zahrawi", "Az-Zahrawi", "936–1013", "🩺", "langka", "Dijuluki bapak ilmu bedah; kitab At-Tasrif memuat gambar ratusan alat bedah."),
	C("muslim", "jazari", "Al-Jazari", "1136–1206", "⚙️", "langka", "Insinyur yang merancang berbagai mesin dan jam otomatis, termasuk jam gajah yang terkenal."),
	C("muslim", "khaldun", "Ibnu Khaldun", "1332–1406", "📜", "langka", "Karyanya, Muqaddimah, menjadi pelopor ilmu sejarah dan sosiologi."),
	C("muslim", "idrisi", "Al-Idrisi", "1100–1165", "🗺️", "umum", "Membuat peta dunia Tabula Rogeriana (1154), salah satu peta paling teliti di zamannya."),
	C("muslim", "rusyd", "Ibnu Rusyd", "1126–1198", "🏛️", "umum", "Filsuf dan dokter dari Andalusia yang terkenal dengan ulasan-ulasannya atas karya Aristoteles."),
	C("muslim", "batutah", "Ibnu Batutah", "1304–±1369", "🧭", "umum", "Pengembara selama hampir 30 tahun ke berbagai negeri, termasuk Samudra Pasai di Sumatra."),
	C("muslim", "fihri", "Fatimah al-Fihri", "±800–±880", "🕌", "umum", "Mendirikan Al-Qarawiyyin di Fez pada 859, yang tercatat sebagai salah satu universitas tertua di dunia."),
	C("muslim", "jabir", "Jabir ibn Hayyan", "±721–±815", "⚗️", "umum", "Dikenal sebagai bapak kimia; tulisan yang dinisbatkan kepadanya membahas distilasi dan kristalisasi."),
	C("pahlawan", "soekarno", "Ir. Soekarno", "1901–1970", "🎙️", "legendaris", "Proklamator kemerdekaan bersama Mohammad Hatta pada 17 Agustus 1945 dan presiden pertama Indonesia."),
	C("pahlawan", "hatta", "Mohammad Hatta", "1902–1980", "📚", "epik", "Proklamator dan wakil presiden pertama Indonesia; dijuluki Bapak Koperasi Indonesia."),
	C("pahlawan", "sudirman", "Jenderal Sudirman", "1916–1950", "🎖️", "epik", "Panglima besar yang tetap memimpin perang gerilya walau sedang sakit parah."),
	C("pahlawan", "kartini", "R.A. Kartini", "1879–1904", "✉️", "langka", "Pejuang pendidikan perempuan; surat-suratnya dibukukan dengan judul Habis Gelap Terbitlah Terang."),
	C("pahlawan", "dewantara", "Ki Hajar Dewantara", "1889–1959", "🎓", "langka", "Mendirikan Taman Siswa (1922); hari lahirnya, 2 Mei, diperingati sebagai Hari Pendidikan Nasional."),
	C("pahlawan", "diponegoro", "Pangeran Diponegoro", "1785–1855", "🐎", "langka", "Memimpin Perang Jawa (1825–1830) melawan pemerintah kolonial Belanda."),
	C("pahlawan", "hasyim", "KH Hasyim Asy'ari", "1871–1947", "📿", "langka", "Pendiri Nahdlatul Ulama (1926); Resolusi Jihad 22 Oktober 1945 yang dicetuskannya diperingati sebagai Hari Santri."),
	C("pahlawan", "dahlan", "KH Ahmad Dahlan", "1868–1923", "🏫", "umum", "Mendirikan Muhammadiyah pada 1912 beserta banyak sekolah dan layanan kesehatan."),
	C("pahlawan", "cutnyak", "Cut Nyak Dhien", "1848–1908", "⚔️", "umum", "Pejuang Aceh yang terus memimpin perlawanan terhadap Belanda selama bertahun-tahun."),
	C("pahlawan", "bungtomo", "Bung Tomo", "1920–1981", "📻", "umum", "Lewat siaran radionya, ia membakar semangat arek-arek Suroboyo dalam pertempuran 10 November 1945."),
	C("pahlawan", "imambonjol", "Tuanku Imam Bonjol", "1772–1864", "🏔️", "umum", "Tokoh utama Perang Padri di Sumatra Barat melawan Belanda."),
	// ---- edisi terbatas: hanya dari event musiman
	C("event", "ev-pahlawan1", "Hari Pahlawan", "10 November", "🎖️", "legendaris", "Diperingati setiap 10 November untuk mengenang Pertempuran Surabaya tahun 1945."),
	C("event", "ev-pahlawan2", "Tugu Pahlawan", "Surabaya", "🏛️", "epik", "Monumen di Surabaya yang dibangun untuk mengenang para pejuang Pertempuran 10 November 1945."),
	C("event", "ev-hutri1", "Teks Proklamasi", "17 Agustus 1945", "📜", "legendaris", "Dibacakan oleh Soekarno, didampingi Mohammad Hatta, di Jalan Pegangsaan Timur 56, Jakarta."),
	C("event", "ev-hutri2", "Bendera Pusaka", "1945", "🚩", "epik", "Bendera Merah Putih yang dikibarkan saat Proklamasi Kemerdekaan, dijahit oleh Fatmawati."),
	C("event", "ev-hijriah1", "Peristiwa Hijrah", "622 M", "🐪", "legendaris", "Hijrahnya Nabi Muhammad ﷺ dari Makkah ke Madinah menjadi awal perhitungan kalender Hijriah."),
	C("event", "ev-hijriah2", "Kalender Hijriah", "Masa Khalifah Umar", "🌙", "epik", "Penanggalan Hijriah mulai ditetapkan penggunaannya pada masa Khalifah Umar bin Khattab."),
	C("event", "ev-ramadan1", "Nuzulul Qur'an", "Bulan Ramadan", "📖", "legendaris", "Al-Qur'an mulai diturunkan pada bulan Ramadan (QS. Al-Baqarah: 185)."),
	C("event", "ev-ramadan2", "Lailatul Qadar", "Sepuluh malam terakhir", "✨", "epik", "Malam yang lebih baik daripada seribu bulan (QS. Al-Qadr: 3)."),
	C("event", "ev-hardiknas1", "Hari Pendidikan Nasional", "2 Mei", "🏫", "legendaris", "Diperingati setiap 2 Mei, bertepatan dengan hari lahir Ki Hajar Dewantara."),
	C("event", "ev-hardiknas2", "Tut Wuri Handayani", "Semboyan pendidikan", "🤝", "epik", "Semboyan dari Ki Hajar Dewantara: dari belakang memberi dorongan."),
	C("event", "ev-santri1", "Hari Santri", "22 Oktober", "🕌", "legendaris", "Ditetapkan pada 2015 untuk mengenang Resolusi Jihad 22 Oktober 1945."),
	C("event", "ev-santri2", "Pesantren", "Nusantara", "📚", "epik", "Lembaga pendidikan Islam khas Nusantara, tempat para santri mendalami ilmu agama."),
	C("pahlawan", "dewisartika", "Dewi Sartika", "1884–1947", "📖", "umum", "Pelopor pendidikan perempuan; mendirikan Sakola Istri di Bandung pada 1904."),
];
export const RARITY: Record<Rarity, { label: string; stars: string; odds: number; dust: number; craft: number; color: string }> = {
	umum: { label: "Umum", stars: "★", odds: 62, dust: 5, craft: 40, color: "#94a3b8" },
	langka: { label: "Langka", stars: "★★", odds: 27, dust: 15, craft: 100, color: "#3b82f6" },
	epik: { label: "Epik", stars: "★★★", odds: 9, dust: 40, craft: 250, color: "#a855f7" },
	legendaris: { label: "Legendaris", stars: "★★★★", odds: 2, dust: 100, craft: 600, color: "#f59e0b" },
};
export const PACK_PRICE = 120;
const S = (p: FlashcardPlugin): CollectState => p.data.collect;

// ================================================================ hadiah & bungkus
/** Beri bungkus kartu. `key` mencegah hadiah yang sama diberikan dua kali. */
export function grantPack(p: FlashcardPlugin, n: number, reason: string, key?: string) {
	const s = S(p);
	if (key) { if (s.granted.includes(key)) return false; s.granted = [...s.granted.slice(-400), key]; }
	s.packs += n;
	p.requestSave();
	new Notice(`🎴 +${n} bungkus kartu koleksi · ${reason}`, 5000);
	return true;
}

/** Cek hadiah berkala (streak kelipatan 7 hari). Aman dipanggil berkali-kali. */
export function collectTick(p: FlashcardPlugin) {
	const st = p.streak().current;
	if (st > 0 && st % 7 === 0) grantPack(p, 1, `streak ${st} hari`, `streak:${dayKey(Date.now())}`);
}

function rollRarity(minRare = false): Rarity {
	let r = Math.random() * 100;
	const order: Rarity[] = ["legendaris", "epik", "langka", "umum"];
	for (const k of order) { if (r < RARITY[k].odds) return k; r -= RARITY[k].odds; }
	return minRare ? "langka" : "umum";
}

/** Buka satu bungkus: 3 kartu (kartu ketiga minimal langka). */
export function openPack(p: FlashcardPlugin): { card: CCard; isNew: boolean; dust: number }[] {
	const s = S(p);
	if (s.packs <= 0) return [];
	s.packs--;
	s.opened++;
	const out: { card: CCard; isNew: boolean; dust: number }[] = [];
	for (let i = 0; i < 3; i++) {
		let r = rollRarity();
		if (i === 2 && r === "umum") r = "langka";
		const pool = CARDS.filter((c) => c.rarity === r && c.album !== "event");
		const card = pool[Math.floor(Math.random() * pool.length)];
		const isNew = !s.owned[card.id];
		s.owned[card.id] = (s.owned[card.id] ?? 0) + 1;
		const dust = isNew ? 0 : RARITY[r].dust;
		s.dust += dust;
		out.push({ card, isNew, dust });
	}
	p.requestSave();
	p.checkAchievements();
	return out;
}
export const albumProgress = (p: FlashcardPlugin, a: string) => { const cs = CARDS.filter((c) => c.album === a); return { have: cs.filter((c) => S(p).owned[c.id]).length, total: cs.length }; };

// ================================================================ tampilan kartu
export function cardEl(parent: HTMLElement, c: CCard, owned: boolean, count = 0) {
	const al = ALBUMS.find((a) => a.id === c.album)!;
	const r = RARITY[c.rarity];
	const el = parent.createDiv(`fch-cc r-${c.rarity}` + (owned ? "" : " is-locked"));
	el.style.setProperty("--ac", al.color);
	el.style.setProperty("--rc", r.color);
	const top = el.createDiv("fch-cc-top");
	top.createSpan({ cls: "fch-cc-stars", text: r.stars });
	if (count > 1) top.createSpan({ cls: "fch-cc-count", text: `×${count}` });
	el.createDiv({ cls: "fch-cc-emblem", text: owned ? c.icon : "?" });
	el.createDiv({ cls: "fch-cc-name", text: owned ? c.name : "???" });
	el.createDiv({ cls: "fch-cc-years", text: owned ? c.years : r.label });
	return el;
}

class CardModal2 extends Modal {
	constructor(app: App, private p: FlashcardPlugin, private c: CCard, private done: () => void) { super(app); }
	onOpen() {
		this.modalEl.addClass("fch-modal", "fch-cc-modal");
		const el = this.contentEl;
		const s = S(this.p);
		const owned = !!s.owned[this.c.id];
		const r = RARITY[this.c.rarity];
		const wrap = el.createDiv("fch-cc-detail");
		cardEl(wrap, this.c, owned, s.owned[this.c.id] ?? 0).addClass("is-big");
		const info = wrap.createDiv("fch-cc-info");
		info.createDiv({ cls: "fch-cc-rar", text: `${r.stars} ${r.label}` });
		if (owned) {
			info.createEl("h2", { text: this.c.name });
			info.createDiv({ cls: "fch-muted", text: this.c.years });
			info.createDiv({ cls: "fch-cc-fact", text: this.c.fact });
		} else {
			info.createEl("h2", { text: "Kartu belum dimiliki" });
			if (this.c.album === "event") { info.createDiv({ cls: "fch-muted", text: "Kartu edisi terbatas: hanya bisa didapat saat event musimannya berlangsung (kalahkan boss event atau tukar token di Toko Event)." }); return; }
			info.createDiv({ cls: "fch-muted", text: "Dapatkan dari bungkus kartu, atau tempa dengan debu bintang." });
			btn(info, { text: `Tempa · ✨ ${r.craft}`, icon: "hammer", cls: "fch-btn-primary", disabled: s.dust < r.craft, onClick: () => {
				s.dust -= r.craft;
				s.owned[this.c.id] = 1;
				this.p.requestSave();
				this.p.checkAchievements();
				play("achievement");
				new Notice(`✨ ${this.c.name} berhasil ditempa!`);
				this.close();
				this.done();
			} });
			if (s.dust < r.craft) info.createDiv({ cls: "fch-small fch-muted", text: `Debu bintangmu: ✨ ${s.dust}` });
		}
	}
	onClose() { this.contentEl.empty(); }
}

/** Animasi membuka bungkus: kartu dibalik satu per satu. */
export class PackModal extends Modal {
	constructor(app: App, private p: FlashcardPlugin, private done: () => void) { super(app); }
	onOpen() {
		this.modalEl.addClass("fch-modal", "fch-pack-modal");
		const res = openPack(this.p);
		const el = this.contentEl;
		el.createDiv({ cls: "fch-modal-title", text: "🎴 Membuka bungkus kartu" });
		el.createDiv({ cls: "fch-muted fch-small", text: "Ketuk setiap kartu untuk membaliknya." });
		const row = el.createDiv("fch-pack-row");
		let flipped = 0;
		res.forEach(({ card, isNew, dust }, i) => {
			const slot = row.createDiv("fch-flip");
			const inner = slot.createDiv("fch-flip-in");
			const back = inner.createDiv("fch-flip-back");
			back.createDiv({ cls: "fch-flip-logo", text: "🎴" });
			const front = inner.createDiv("fch-flip-front");
			cardEl(front, card, true);
			if (isNew) front.createDiv({ cls: "fch-cc-new", text: "BARU!" });
			else front.createDiv({ cls: "fch-cc-dust", text: `+✨${dust}` });
			slot.style.animationDelay = `${i * 0.12}s`;
			slot.onclick = () => {
				if (slot.hasClass("is-flipped")) return;
				slot.addClass("is-flipped", `r-${card.rarity}`);
				play(card.rarity === "legendaris" ? "victory" : card.rarity === "epik" ? "achievement" : "flip");
				flipped++;
				if (card.rarity === "legendaris" && this.p.data.settings.confetti) confetti(el);
				if (flipped === res.length) foot.removeClass("is-hidden");
			};
		});
		const foot = el.createDiv("fch-modal-foot fch-mt is-hidden");
		foot.createDiv("fch-grow");
		if (S(this.p).packs > 0) btn(foot, { text: `Buka lagi (${S(this.p).packs})`, icon: "gift", onClick: () => { this.close(); new PackModal(this.app, this.p, this.done).open(); } });
		btn(foot, { text: "Selesai", cls: "fch-btn-primary", onClick: () => this.close() });
	}
	onClose() { this.contentEl.empty(); this.done(); }
}

// ================================================================ halaman Album
let albumTab = "sains";
export function renderAlbum(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const s = S(p);
	const head = el.createDiv("fch-album-hero");
	const l = head.createDiv("fch-grow");
	l.createEl("h1", { text: "🎴 Album Koleksi" });
	l.createDiv({ cls: "fch-album-sub", text: "Kumpulkan kartu tokoh ilmuwan, penemu, dan pahlawan beserta fakta menariknya. Bungkus kartu didapat dari streak 7 hari, boss, prestasi baru, dungeon, dan peti harta." });
	const stats = l.createDiv("fch-album-stats");
	const total = CARDS.filter((c) => s.owned[c.id]).length;
	stats.createSpan({ text: `📚 ${total}/${CARDS.length} kartu` });
	stats.createSpan({ text: `✨ ${s.dust} debu bintang` });
	stats.createSpan({ text: `🪙 ${p.data.meta.coins ?? 0}` });
	const r = head.createDiv("fch-album-pack");
	const pk = r.createDiv("fch-pack-big" + (s.packs ? " has-pack" : ""));
	pk.createDiv({ cls: "fch-pack-ic", text: "🎴" });
	pk.createDiv({ cls: "fch-pack-n", text: `${s.packs} bungkus` });
	btn(r, { text: "Buka bungkus", icon: "gift", cls: "fch-btn-primary fch-btn-lg", disabled: !s.packs, onClick: () => new PackModal(hub.app, p, () => hub.renderPage()).open() });
	btn(r, { text: `Beli · 🪙 ${PACK_PRICE}`, cls: "fch-btn-sm", disabled: (p.data.meta.coins ?? 0) < PACK_PRICE, onClick: () => { p.data.meta.coins = (p.data.meta.coins ?? 0) - PACK_PRICE; s.packs++; p.requestSave(); play("coin"); hub.renderPage(); } });

	const tabs = el.createDiv("fch-album-tabs");
	for (const a of ALBUMS) {
		const pr = albumProgress(p, a.id);
		const t = tabs.createEl("button", { cls: "fch-album-tab" + (albumTab === a.id ? " is-on" : "") });
		t.style.setProperty("--ac", a.color);
		t.createSpan({ cls: "fch-album-tic", text: a.icon });
		const tt = t.createSpan("fch-grow");
		tt.createDiv({ cls: "fch-strong", text: a.name });
		const bar = tt.createDiv("fch-bar fch-bar-thin");
		bar.createDiv("fch-bar-fill").style.width = `${(pr.have / pr.total) * 100}%`;
		t.createSpan({ cls: "fch-small fch-muted", text: `${pr.have}/${pr.total}` });
		t.onclick = () => { albumTab = a.id; hub.renderPage(); };
	}
	const a = ALBUMS.find((x) => x.id === albumTab)!;
	const pr = albumProgress(p, a.id);
	if (pr.have === pr.total) {
		const done = el.createDiv("fch-album-done");
		done.createSpan({ text: `🏆 Album ${a.name} lengkap!` });
		if (!s.claimed.includes(a.id)) btn(done, { text: "Klaim hadiah: 🪙 500 + 2 bungkus", icon: "gift", cls: "fch-btn-primary", onClick: () => { s.claimed.push(a.id); p.addCoins(500); s.packs += 2; p.requestSave(); p.checkAchievements(); play("victory"); if (p.data.settings.confetti) confetti(hub.mainEl); new Notice(`🏆 Hadiah album diterima: ${a.reward}`); hub.renderPage(); } });
		else done.createSpan({ cls: "fch-small", text: `· ${a.reward} ✓` });
	}
	const grid = el.createDiv("fch-cc-grid" + (s.claimed.includes(a.id) ? " is-golden" : ""));
	for (const c of CARDS.filter((x) => x.album === a.id).sort((x, y) => Object.keys(RARITY).indexOf(y.rarity) - Object.keys(RARITY).indexOf(x.rarity))) {
		const ce = cardEl(grid, c, !!s.owned[c.id], s.owned[c.id] ?? 0);
		ce.onclick = () => new CardModal2(hub.app, p, c, () => hub.renderPage()).open();
	}
	el.createDiv({ cls: "fch-muted fch-small fch-mt", text: `Peluang tiap kartu: Umum ${RARITY.umum.odds}% · Langka ${RARITY.langka.odds}% · Epik ${RARITY.epik.odds}% · Legendaris ${RARITY.legendaris.odds}% (kartu ketiga minimal Langka). Kartu ganda berubah menjadi debu bintang untuk menempa kartu yang belum dimiliki. Gambar kartu berupa lambang ilustratif, bukan potret tokoh.` });
}

// ================================================================ Harta Karun: peti harian & peta mingguan
export function chestState(p: FlashcardPlugin): { ready: boolean; opened: boolean; tier: "kayu" | "perak" | "emas"; need: number; got: number } {
	const k = dayKey(Date.now());
	const d = p.data.daily[k];
	const goal = Math.max(5, Math.min(p.data.settings.dailyGoal || 20, 40));
	const got = d?.reviews ?? 0;
	const acc = d?.reviews ? d.correct / d.reviews : 0;
	const tier = got >= goal * 2 ? "emas" : acc >= 0.85 ? "perak" : "kayu";
	return { ready: got >= goal, opened: S(p).chestDay === k, tier, need: goal, got };
}
function openChest(p: FlashcardPlugin): string[] {
	const st = chestState(p);
	const s = S(p);
	s.chestDay = dayKey(Date.now());
	const base = st.tier === "emas" ? 120 : st.tier === "perak" ? 70 : 40;
	const coins = base + Math.floor(Math.random() * base);
	p.addCoins(coins);
	const got = [`🪙 ${coins} koin`];
	const packChance = st.tier === "emas" ? 1 : st.tier === "perak" ? 0.6 : 0.3;
	if (Math.random() < packChance) { s.packs++; got.push("🎴 1 bungkus kartu"); }
	const dust = 5 + Math.floor(Math.random() * (st.tier === "emas" ? 40 : 20));
	s.dust += dust;
	got.push(`✨ ${dust} debu bintang`);
	p.requestSave();
	return got;
}

interface Clue { id: string; icon: string; text: string; need: number; val: (p: FlashcardPlugin) => number }
const sumWeek = (p: FlashcardPlugin, ev: string) => { const ws = weekStart(); let n = 0; for (let i = 0; i < 7; i++) n += (p.data.meta.missionLog?.[dayKey(addDays(ws, i))] as Record<string, number> | undefined)?.[ev] ?? 0; return n; };
const CLUES: Clue[] = [
	{ id: "days", icon: "📅", text: "Belajar flashcard di 4 hari berbeda", need: 4, val: (p) => { const ws = weekStart(); let n = 0; for (let i = 0; i < 7; i++) if (p.data.daily[dayKey(addDays(ws, i))]?.reviews) n++; return n; } },
	{ id: "rev", icon: "🧠", text: "Ulas 100 kartu", need: 100, val: (p) => { const ws = weekStart(); let n = 0; for (let i = 0; i < 7; i++) n += p.data.daily[dayKey(addDays(ws, i))]?.reviews ?? 0; return n; } },
	{ id: "boss", icon: "👾", text: "Kalahkan 1 boss", need: 1, val: (p) => sumWeek(p, "boss") },
	{ id: "block", icon: "📅", text: "Jalankan 3 jadwal belajar", need: 3, val: (p) => sumWeek(p, "block") },
	{ id: "read", icon: "📖", text: "Baca 5 potongan bacaan", need: 5, val: (p) => sumWeek(p, "reading") },
	{ id: "dungeon", icon: "🗝️", text: "Jelajahi 10 lantai dungeon", need: 10, val: (p) => sumWeek(p, "dungeonFloor") },
	{ id: "pomo", icon: "🍅", text: "Selesaikan 6 sesi Pomodoro", need: 6, val: (p) => { const ws = weekStart(); let n = 0; for (let i = 0; i < 7; i++) n += p.data.meta.pomoLog?.[dayKey(addDays(ws, i))] ?? 0; return n; } },
	{ id: "hafal", icon: "🕌", text: "Hafal 5 ayat atau hadits baru", need: 5, val: (p) => sumWeek(p, "hafalAyat") + sumWeek(p, "hafalHadits") },
	{ id: "task", icon: "✅", text: "Selesaikan 5 tugas", need: 5, val: (p) => sumWeek(p, "taskDone") },
];
export function weekClues(): Clue[] {
	const wk = weekKey();
	let h = 0;
	for (const ch of wk) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	const pool = [...CLUES];
	const out: Clue[] = [];
	while (out.length < 5) { h = (h * 1103515245 + 12345) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]); }
	return out;
}

export function renderTreasure(hub: HubView, el: HTMLElement) {
	const p = hub.plugin;
	const s = S(p);
	const head = el.createDiv("fch-pagehead");
	head.createEl("h1", { text: "💰 Harta Karun" });
	head.createDiv({ cls: "fch-muted", text: "Peti harian terbuka setelah target belajar hari ini tercapai. Peta harta karun mingguan menyimpan hadiah besar di ujungnya." });
	// peti harian
	const st = chestState(p);
	const chest = el.createDiv(`fch-chest t-${st.tier}` + (st.opened ? " is-opened" : st.ready ? " is-ready" : ""));
	chest.createDiv({ cls: "fch-chest-ic", text: st.opened ? "📭" : st.ready ? "🎁" : "🔒" });
	const ct = chest.createDiv("fch-grow");
	ct.createDiv({ cls: "fch-chest-t", text: `Peti Harian · ${st.tier === "emas" ? "Emas ✨" : st.tier === "perak" ? "Perak" : "Kayu"}` });
	ct.createDiv({ cls: "fch-small", text: st.opened ? "Sudah dibuka hari ini. Kembali lagi besok!" : st.ready ? "Target tercapai, peti siap dibuka!" : `Ulas ${st.need - st.got} kartu lagi untuk membukanya (${st.got}/${st.need}).` });
	ct.createDiv({ cls: "fch-small fch-muted", text: "Peti Perak: akurasi ≥ 85% · Peti Emas: ulasan 2× target." });
	const bar = ct.createDiv("fch-bar fch-mt");
	bar.createDiv("fch-bar-fill").style.width = `${Math.min(100, (st.got / st.need) * 100)}%`;
	if (!st.opened) btn(chest, { text: st.ready ? "Buka peti" : "Belajar dulu", icon: st.ready ? "gift" : "play", cls: "fch-btn-primary fch-btn-lg", onClick: () => {
		if (!st.ready) return void hub.startSession(p.allCards(), { title: "Semua materi", cram: false, mode: p.data.settings.defaultMode });
		const got = openChest(p);
		play("victory");
		if (p.data.settings.confetti) confetti(hub.mainEl);
		new Notice(`🎁 Isi peti: ${got.join(" · ")}`, 8000);
		hub.renderPage();
	} });
	// peta mingguan
	const clues = weekClues();
	if (s.mapWeek !== weekKey()) { s.mapWeek = weekKey(); s.mapClaimed = false; p.requestSave(); }
	const done = clues.map((c) => c.val(p) >= c.need);
	const nDone = done.filter(Boolean).length;
	const map = el.createDiv("fch-tmap");
	map.createDiv({ cls: "fch-tmap-title", text: `🗺️ Peta Harta Karun minggu ini · ${nDone}/5 petunjuk` });
	const path = map.createDiv("fch-tmap-path");
	clues.forEach((c, i) => {
		const v = Math.min(c.need, c.val(p));
		const spot = path.createDiv("fch-tmap-spot" + (done[i] ? " is-done" : "") + (i === done.indexOf(false) ? " is-now" : ""));
		spot.createDiv({ cls: "fch-tmap-ic", text: done[i] ? "✓" : c.icon });
		const t = spot.createDiv("fch-tmap-txt");
		t.createDiv({ cls: "fch-strong fch-small", text: c.text });
		t.createDiv({ cls: "fch-muted fch-small", text: `${v}/${c.need}` });
	});
	const x = path.createDiv("fch-tmap-x" + (nDone === 5 ? " is-open" : ""));
	x.createDiv({ cls: "fch-tmap-ic", text: nDone === 5 ? (s.mapClaimed ? "📭" : "💎") : "❌" });
	x.createDiv({ cls: "fch-strong fch-small", text: "Harta karun" });
	if (nDone === 5 && !s.mapClaimed) btn(map, { text: "Gali harta: 🪙 300 + 3 bungkus kartu", icon: "gift", cls: "fch-btn-primary fch-btn-lg", onClick: () => { s.mapClaimed = true; p.addCoins(300); s.packs += 3; p.requestSave(); play("victory"); if (p.data.settings.confetti) confetti(hub.mainEl); new Notice("💎 Harta karun ditemukan! +300 koin & 3 bungkus kartu"); hub.renderPage(); } });
	else if (s.mapClaimed) map.createDiv({ cls: "fch-small fch-muted fch-center", text: "Harta minggu ini sudah digali. Peta baru muncul setiap Senin." });
	const sb = el.createDiv("fch-row fch-mt");
	btn(sb, { text: `Ke Album Koleksi (${s.packs} bungkus)`, icon: "layers", onClick: () => hub.navigate("album") });
}
