import { App, Notice, PluginSettingTab, Setting, debounce } from "obsidian";
import type FlashcardPlugin from "./main";
import { Settings, StudyMode, StudyOrder } from "./types";
import { SB_ITEMS } from "./statusbar";

export class FlashcardSettingTab extends PluginSettingTab {
	private reindex = debounce(() => void this.plugin.reindexAll(), 800, true);

	constructor(app: App, private plugin: FlashcardPlugin) {
		super(app, plugin);
	}

	private async set<K extends keyof Settings>(key: K, value: Settings[K], reparse = false) {
		this.plugin.data.settings[key] = value;
		await this.plugin.saveNow();
		if (reparse) this.reindex();
		else this.plugin.refreshViews();
	}

	private text(c: HTMLElement, key: "tag" | "folders" | "singleSep" | "reversedSep" | "multiSep" | "ttsLang" | "examName", name: string, desc: string, reparse = true) {
		new Setting(c).setName(name).setDesc(desc).addText((t) =>
			t.setValue(this.plugin.data.settings[key]).onChange((v) => void this.set(key, v, reparse)));
	}

	private num(c: HTMLElement, key: "newPerDay" | "maxReviewsPerDay" | "startingEase" | "easyBonus" | "maxInterval" | "leechThreshold" | "dailyGoal" | "quizChoices" | "pomodoroWork" | "pomodoroBreak", name: string, desc: string) {
		new Setting(c).setName(name).setDesc(desc).addText((t) => {
			t.inputEl.type = "number";
			t.setValue(String(this.plugin.data.settings[key])).onChange((v) => {
				const n = parseFloat(v);
				if (!isNaN(n) && n >= 0) void this.set(key, n);
			});
		});
	}

	private toggle(c: HTMLElement, key: "scanAllNotes" | "enableCloze" | "showMemoryCurve" | "checklist" | "decayAlert" | "autoSpeak" | "confetti", name: string, desc: string, reparse = false) {
		new Setting(c).setName(name).setDesc(desc).addToggle((t) =>
			t.setValue(this.plugin.data.settings[key]).onChange((v) => void this.set(key, v, reparse)));
	}

	display() {
		const c = this.containerEl;
		c.empty();
		const s = this.plugin.data.settings;

		new Setting(c).setName("Tampilan").setHeading();
		new Setting(c).setName("Gaya tampilan")
			.setDesc("Retro Web: piksel ala web 90-an (navy, oranye, teal). Retro Konsol: panel game klasik (sage, merah karat). Lounge Gamer: dasbor game modern (marun, koral, emas). Modern: mengikuti tema Obsidian.")
			.addDropdown((d) => d.addOptions({ "retro-web": "🖥️ Retro Web", "retro-console": "🎮 Retro Konsol", lounge: "🔥 Lounge Gamer", modern: "✨ Modern" })
				.setValue(s.uiStyle).onChange((v) => void this.plugin.setUiStyle(v as Settings["uiStyle"])));

		new Setting(c).setName("Efek suara").setDesc("Bunyi 8-bit saat benar, salah, mendapat prestasi, dan naik level.")
			.addToggle((t) => t.setValue(s.soundOn).onChange(async (v) => { s.soundOn = v; this.plugin.applySound(); await this.plugin.saveNow(); }));
		new Setting(c).setName("Volume efek & musik").setDesc("Atur juga dari Ruang Fokus.")
			.addSlider((sl) => sl.setLimits(0, 100, 5).setValue(Math.round(s.sfxVolume * 100)).setDynamicTooltip().onChange(async (v) => { s.sfxVolume = v / 100; this.plugin.applySound(); await this.plugin.saveNow(); }))
			.addSlider((sl) => sl.setLimits(0, 100, 5).setValue(Math.round(s.musicVolume * 100)).setDynamicTooltip().onChange(async (v) => { s.musicVolume = v / 100; this.plugin.applySound(); await this.plugin.saveNow(); }));

		new Setting(c).setName("Status bar").setHeading();
		c.createEl("p", { cls: "setting-item-description", text: "Info ringkas di status bar bawah Obsidian (desktop). Klik untuk membuka halamannya. Susunan Beranda diatur lewat tombol “Atur Beranda” di Beranda." });
		for (const it of SB_ITEMS)
			new Setting(c).setName(it.label).addToggle((t) => t.setValue(s.statusBar?.[it.id] !== false).onChange(async (v) => { s.statusBar = { ...(s.statusBar ?? {}), [it.id]: v }; this.plugin.statusBar?.update(); await this.plugin.saveNow(); }));

		new Setting(c).setName("Tugas & catatan").setHeading();
		this.text(c, "notesFolder" as never, "Folder catatan", "Tempat catatan dari halaman Catatan disimpan.", false);
		new Setting(c).setName("Pengingat pelajaran").setDesc("Berapa menit sebelum kelas dimulai (0 = mati).")
			.addDropdown((d) => d.addOptions({ "0": "Mati", "5": "5 menit", "10": "10 menit", "15": "15 menit", "30": "30 menit" }).setValue(String(s.classReminder)).onChange(async (v) => { s.classReminder = parseInt(v, 10); await this.plugin.saveNow(); }));
		new Setting(c).setName("Pengingat tugas").setDesc("Munculkan notifikasi & bunyi saat jam tugas tiba (selama Obsidian terbuka).")
			.addToggle((t) => t.setValue(s.taskReminders).onChange(async (v) => { s.taskReminders = v; await this.plugin.saveNow(); }));

		new Setting(c).setName("Cara menyimpan kartu").setHeading();
		new Setting(c)
			.setName("Simpan kartu sebagai")
			.setDesc("Kartu rapi: blok teks → klik kanan → pilih tipe. Catatan tidak diubah sama sekali. Teks di catatan: menulis sintaks ::, ?, {{ }} ke dalam catatan (cara lama, tetap didukung).")
			.addDropdown((d) => d.addOptions({ plugin: "Kartu rapi (catatan tetap bersih)", note: "Teks di catatan (sintaks)" })
				.setValue(s.storage).onChange((v) => void this.set("storage", v as Settings["storage"])));
		new Setting(c)
			.setName("Tandai teks yang jadi kartu")
			.setDesc("Garis bawah titik-titik tipis di editor pada teks yang sudah dijadikan flashcard. Klik kanan teks itu untuk mengedit atau menghapus kartunya.")
			.addToggle((t) => t.setValue(s.markSource).onChange(async (v) => {
				await this.set("markSource", v);
				this.plugin.refreshEditorMarks();
			}));

		new Setting(c)
			.setName("Tombol kartu di catatan")
			.setDesc("Ikon kecil di ujung baris yang berisi flashcard. Klik untuk melihat kartunya dan langsung berlatih (menilai kartu jatuh tempo, atau uji diri) tanpa meninggalkan catatan. Warna: oranye = jatuh tempo, biru = baru, abu-abu = terjadwal.")
			.addToggle((t) => t.setValue(s.noteCardButtons).onChange(async (v) => {
				await this.set("noteCardButtons", v);
				this.plugin.refreshEditorMarks();
			}));

		new Setting(c)
			.setName("Animasi kartu")
			.setDesc("Kartu meluncur masuk, membalik 3D, terbang keluar saat dinilai, partikel, banner combo, dan bintang di akhir sesi. Otomatis mati bila sistem meminta gerakan dikurangi.")
			.addToggle((t) => t.setValue(s.cardFx).onChange((v) => void this.set("cardFx", v)));
		new Setting(c)
			.setName("Dekorasi event musiman")
			.setDesc("Hiasan tampilan (umbul-umbul, lentera, bulan sabit) selama event seperti Hari Pahlawan, 17 Agustus, Tahun Baru Hijriah, dan Ramadan.")
			.addToggle((t) => t.setValue(s.eventDecor).onChange(async (v) => { await this.set("eventDecor", v); this.plugin.applyEventTheme(); }));
		new Setting(c)
			.setName("Bagian Medis")
			.setDesc("Tampilkan ruang kerja Medis (database obat, kalkulator dosis, interaksi, kalkulator klinis, kartu darurat) di menu kiri.")
			.addToggle((t) => t.setValue(s.medis).onChange(async (v) => { await this.set("medis", v); }));

		new Setting(c).setName("Sumber kartu sintaks").setHeading();
		this.text(c, "tag", "Tag flashcard", "Catatan yang memiliki tag ini (atau sub-tag seperti #flashcards/biologi) dipindai.");
		this.text(c, "folders", "Folder flashcard", "Semua catatan di folder ini ikut dipindai. Pisahkan dengan koma, misalnya: Kuliah, Bahasa/Jepang");
		this.toggle(c, "scanAllNotes", "Pindai semua catatan", "Abaikan tag dan folder, cari kartu di seluruh vault.", true);

		new Setting(c).setName("Sintaks").setHeading();
		this.text(c, "singleSep", "Pemisah satu baris", "Pertanyaan :: Jawaban");
		this.text(c, "reversedSep", "Pemisah dua arah", "A ::: B membuat kartu A→B dan B→A");
		this.text(c, "multiSep", "Pemisah multi-baris", "Baris berisi ? memisahkan depan dan belakang. Gandakan (??) untuk dua arah.");
		this.toggle(c, "enableCloze", "Cloze {{…}}", "Teks di dalam {{ }} disembunyikan. Tambah petunjuk dengan {{jawaban|petunjuk}}.", true);

		new Setting(c).setName("Jadwal & urutan").setHeading();
		new Setting(c).setName("Algoritma penjadwalan")
			.setDesc("FSRS (disarankan): model ingatan modern yang lebih akurat, jadi ulasan lebih sedikit untuk tingkat ingatan yang sama. SM-2: algoritma klasik Anki lama.")
			.addDropdown((d) => d.addOptions({ fsrs: "FSRS-4.5 (disarankan)", sm2: "SM-2 (klasik)" }).setValue(s.algorithm).onChange((v) => void this.set("algorithm", v as Settings["algorithm"])));
		new Setting(c).setName("Target ingatan (FSRS)")
			.setDesc("Peluang ingat yang dituju saat kartu jatuh tempo. 90% = seimbang. Lebih tinggi = ulasan lebih sering.")
			.addDropdown((d) => d.addOptions({ "0.8": "80% (ringan)", "0.85": "85%", "0.9": "90% (disarankan)", "0.95": "95% (intensif)" })
				.setValue(String(s.desiredRetention)).onChange((v) => void this.set("desiredRetention", parseFloat(v))));
		new Setting(c)
			.setName("Urutan kartu")
			.setDesc("Berurutan mengikuti nama file lalu posisi kartu di catatan, cocok untuk materi yang bertahap.")
			.addDropdown((d) =>
				d.addOptions({
					sequential: "Berurutan per materi",
					"shuffle-in-file": "Materi berurutan, kartu diacak",
					interleave: "Selang-seling antar materi (interleaved)",
					random: "Acak semua",
				})
					.setValue(s.order)
					.onChange((v) => void this.set("order", v as StudyOrder)));
		this.num(c, "newPerDay", "Kartu baru per hari", "Batas kartu yang pertama kali dipelajari setiap hari. Saat batas tercapai, kamu bisa menambah jatah khusus hari itu (+10, +25, atau semua) tanpa mengubah angka ini. Isi angka besar (mis. 9999) bila tidak ingin dibatasi.");
		this.num(c, "maxReviewsPerDay", "Ulasan maksimal per hari", "Batas kartu lama yang diulas per hari.");
		this.num(c, "dailyGoal", "Target harian", "Jumlah ulasan yang ingin dicapai setiap hari.");
		this.num(c, "startingEase", "Kemudahan awal", "Pengali interval untuk kartu baru (bawaan 2.5).");
		this.num(c, "easyBonus", "Bonus Mudah", "Pengali tambahan saat menekan Mudah (bawaan 1.3).");
		this.num(c, "maxInterval", "Interval maksimal (hari)", "Jarak terjauh antar-ulasan.");
		this.num(c, "leechThreshold", "Batas sering lupa", "Setelah terlupa sebanyak ini, kartu ditandai dan kamu diberi saran.");

		new Setting(c).setName("Sesi belajar").setHeading();
		new Setting(c).setName("Cara belajar bawaan").setDesc("Dipakai saat mulai belajar dari Beranda, Materi, atau perintah.")
			.addDropdown((d) => d.addOptions({ classic: "Klasik (buka kartu)", type: "Ketik jawaban", quiz: "Kuis pilihan ganda" })
				.setValue(s.defaultMode).onChange((v) => void this.set("defaultMode", v as StudyMode)));
		this.num(c, "quizChoices", "Jumlah pilihan kuis", "Banyaknya pilihan jawaban di mode Kuis (2–6).");
		this.toggle(c, "checklist", "Checklist kartu multi-baris", "Setelah jawaban dibuka, centang bagian yang sudah hafal. Bagian yang belum hafal diulang lagi dalam sesi.");
		this.toggle(c, "decayAlert", "Peringatan ingatan memudar", "Beri tahu (maks. sekali sehari) bila perkiraan ingatan sebuah materi turun di bawah ambang.");
		new Setting(c).setName("Ambang peringatan memudar (%)").setDesc("Bawaan 80%.")
			.addText((t) => { t.inputEl.type = "number"; t.setValue(String(Math.round(s.decayThreshold * 100))).onChange((v) => { const n = parseFloat(v); if (n > 0 && n < 100) void this.set("decayThreshold", n / 100); }); });
		this.toggle(c, "showMemoryCurve", "Tampilkan kurva memori", "Grafik peluang ingat untuk setiap kartu setelah jawaban dibuka.");
		this.toggle(c, "autoSpeak", "Bacakan otomatis", "Bacakan pertanyaan dan jawaban dengan suara (text-to-speech).");
		this.text(c, "ttsLang", "Bahasa suara", "Kode bahasa, misalnya id-ID, en-US, ja-JP.", false);
		this.toggle(c, "confetti", "Perayaan", "Tampilkan konfeti ketika akurasi sesi tinggi.");

		new Setting(c).setName("Fokus & ujian").setHeading();
		this.num(c, "pomodoroWork", "Durasi fokus (menit)", "Timer Pomodoro di panel kiri tab Flashcard.");
		this.num(c, "pomodoroBreak", "Durasi istirahat (menit)", "");
		this.text(c, "examName", "Nama ujian", "Tampil di hitung mundur Beranda.", false);
		new Setting(c).setName("Tanggal ujian").setDesc("Beranda menghitung berapa kartu baru per hari yang perlu dipelajari.")
			.addText((t) => { t.inputEl.type = "date"; t.setValue(s.examDate).onChange((v) => void this.set("examDate", v)); });

		new Setting(c).setName("Data").setHeading();
		new Setting(c).setName("Pindai ulang").setDesc("Baca ulang semua catatan dan perbarui daftar kartu.")
			.addButton((b) => b.setButtonText("Pindai").onClick(async () => {
				await this.plugin.reindexAll();
				new Notice(`Ditemukan ${this.plugin.allCards().length} kartu.`);
			}));
		new Setting(c).setName("Aktifkan kartu yang ditangguhkan").setDesc("Kembalikan semua kartu yang ditangguhkan ke jadwal.")
			.addButton((b) => b.setButtonText("Aktifkan").onClick(async () => {
				let n = 0;
				for (const st of Object.values(this.plugin.data.cards)) if (st.suspended) { delete st.suspended; n++; }
				await this.plugin.saveNow();
				this.plugin.refreshViews();
				new Notice(`${n} kartu diaktifkan lagi.`);
			}));
		new Setting(c).setName("Bersihkan data lama").setDesc("Hapus progres kartu yang sudah tidak ada di catatan mana pun.")
			.addButton((b) => b.setButtonText("Bersihkan").onClick(async () => {
				await this.plugin.reindexAll();
				const n = this.plugin.cleanOrphans();
				new Notice(`${n} data kartu lama dihapus.`);
			}));
		let armed = false;
		new Setting(c).setName("Reset semua progres").setDesc("Menghapus seluruh jadwal, riwayat, dan statistik. Tidak bisa dibatalkan.")
			.addButton((b) => b.setButtonText("Reset").setWarning().onClick(async () => {
				if (!armed) {
					armed = true;
					b.setButtonText("Klik lagi untuk yakin");
					window.setTimeout(() => { armed = false; b.setButtonText("Reset"); }, 4000);
					return;
				}
				this.plugin.data.cards = {};
				this.plugin.data.daily = {};
				await this.plugin.saveNow();
				this.plugin.refreshViews();
				b.setButtonText("Reset");
				armed = false;
				new Notice("Semua progres flashcard sudah direset.");
			}));
	}
}
