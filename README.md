<div align="center">

# 🧠 Flashcard Hafalan

**Plugin Obsidian untuk belajar & menghafal:** flashcard dengan algoritma **FSRS**, jadwal belajar, ujian, tugas, Pomodoro, serta fitur **Al-Qur'an, hadits & ibadah harian**. Semua bekerja **tanpa internet**.

![versi](https://img.shields.io/github/v/release/ahmadwirawan74-ui/flashcard-hafalan?label=versi)
![unduhan](https://img.shields.io/github/downloads/ahmadwirawan74-ui/flashcard-hafalan/total?label=unduhan)
![lisensi](https://img.shields.io/badge/lisensi-MIT-green)
![Obsidian](https://img.shields.io/badge/Obsidian-%E2%89%A5%201.4.0-7c3aed)

<img src="docs/screenshots/beranda.png" width="760" alt="Beranda">

</div>

---

## ✨ Fitur

| Ruang kerja | Isi |
|---|---|
| 🏠 **Beranda** | **Beranda ringkas** (Study · Ibadah · Medis) atau dasbor lengkap: progres hari ini, **"Berikutnya untukmu"**, agenda, tugas, ibadah |
| 🎓 **Belajar** | Flashcard **FSRS-4.5**, **halaman Ujian** dengan peta jalan belajar otomatis, **Membaca Bertahap** (artikel, bab buku & PDF dipecah per hari, blok kalimat → kartu), kartu **tabel**, materi, buat kartu (sintaks `::`, cloze, list, pilihan ganda, Image Occlusion), **Ruang Fokus** (Pomodoro + musik latar) |
| 📅 **Rencana** | Jadwal harian (time blocking), **jadwal belajar** dengan pengingat, tugas (bahasa sehari-hari: *"PR kimia besok jam 7 malam !tinggi"*), kalender, proyek/Kanban, kebiasaan, catatan, nilai |
| 🌙 **Ibadah** | **Al-Qur'an** (mushaf Utsmani + terjemahan Kemenag, tilawah & khatam, hafalan & murajaah), Mutaba'ah Yaumiyah, dzikir & tasbih, **Hadits Arbain & 100 hadits Muslim** (berharakat), doa harian, Asmaul Husna, Mode Ramadan |
| 🎮 **Main** | **Event Musiman** (boss bertema, misi, token & kartu edisi terbatas) · **Toko** (senjata, zirah, aksesori, ramuan & tempa) · **Bengkel Alkimia** (racik bahan dungeon) · **Aula Boss** (6 monster, 3 tingkat kesulitan, serangan pamungkas), **Dungeon 2.0** roguelike (5 zona, pilih pintu, relik, mode Mimpi Buruk & Dungeon Harian), **Harta Karun** (peti harian & peta mingguan), **Album Koleksi** 36 kartu tokoh ilmuwan & pahlawan, Arena minigame, Petualangan, Istana Ingatan, 60+ prestasi |
| 🩺 **Medis** | **Beranda Medis** (pencarian universal) · **CPPT** dokter (SOAP, tanda vital & tren, diagnosis ICD-10, sisip resep, peringatan alergi, **ekspor PDF**) · **Pemeriksaan fisik lengkap SKDI 2019** (105 materi, 286 keterampilan, Mode OSCE, kuis temuan) · **Penyakit** (materi lengkap untuk **semua** 913 penyakit SKDI 2019 + 29 penyakit THT, termasuk edukasi pasien) · **Resep lengkap** per penyakit (format Indonesia, dosis anak otomatis dari BB, puyer) · **Resep → PDF** · **Database 299 obat** (dosis dewasa & anak dicocokkan BNF 85, cara pakai, kontraindikasi, kehamilan, ginjal, antidot, edukasi pasien) · **Kalkulator dosis** (mL, tablet, mL/jam syringe pump, resep, CrCl/eGFR) · **Cek interaksi** (aturan kurasi + 588 pasangan BNF 85, duplikasi, triple whammy, matriks) · **Farmakologi** (38 golongan) · **Antidot & keracunan** (kalkulator NAC) · **Kuis farmakologi** · **Kalkulator klinis** (skor, konversi opioid/steroid) · **Kartu darurat anak** (PALS) |
| 📊 **Wawasan** | **Jam Emas Belajar** (jam paling tajammu & jadwal materi tersulit), Analitik, kurva lupa, laporan & review mingguan, kelemahan, peta pengetahuan |

**Kartu langsung di catatan**: tombol di ujung baris berisi flashcard untuk pratinjau dan menilai kartu tanpa meninggalkan catatan, plus latihan kartu di seleksi.

Juga ada: 4 tema tampilan (**Modern, Retro Web, Retro Konsol, Lounge Gamer**), Cari menu (`Ctrl/Cmd+K`), status bar, dan tampilan HP dengan menu samping yang bisa disembunyikan (☰).

<table>
<tr><td><img src="docs/screenshots/ujian.png" alt="Ujian"></td><td><img src="docs/screenshots/ruang-fokus.png" alt="Ruang Fokus"></td></tr>
<tr><td><img src="docs/screenshots/kalender-rencana.png" alt="Kalender & rencana"></td><td><img src="docs/screenshots/ibadah.png" alt="Ibadah"></td></tr>
<tr><td><img src="docs/screenshots/medis-beranda.png" alt="Medis: beranda medis"></td><td><img src="docs/screenshots/medis-cppt.png" alt="Medis: CPPT SOAP & ekspor PDF"></td></tr>
<tr><td><img src="docs/screenshots/medis-pemeriksaan-fisik.png" alt="Medis: pemeriksaan fisik SKDI"></td><td><img src="docs/screenshots/medis-penyakit.png" alt="Medis: penyakit SKDI"></td></tr>
<tr><td><img src="docs/screenshots/medis-resep-pf.png" alt="Medis: resep lengkap & pemeriksaan fisik"></td><td><img src="docs/screenshots/beranda-ringkas.png" alt="Beranda ringkas"></td></tr>
<tr><td><img src="docs/screenshots/tampilan-hp.png" alt="Tampilan HP dengan menu laci"></td><td><img src="docs/screenshots/medis-obat.png" alt="Medis: database obat"></td></tr>
<tr><td><img src="docs/screenshots/medis-kalkulator-interaksi.png" alt="Medis: kalkulator dosis & interaksi"></td><td><img src="docs/screenshots/medis-farmakologi-antidot.png" alt="Medis: farmakologi & antidot"></td></tr>
<tr><td><img src="docs/screenshots/medis-kuis-infus.png" alt="Medis: kuis farmakologi & kalkulator infus"></td><td><img src="docs/screenshots/dungeon-2.png" alt="Dungeon 2.0"></td></tr>
<tr><td><img src="docs/screenshots/arena-dungeon-lobi.png" alt="Arena & lobi Dungeon"></td><td><img src="docs/screenshots/album-boss.png" alt="Album & Boss"></td></tr>
<tr><td><img src="docs/screenshots/dungeon-harta-bacaan.png" alt="Dungeon, Harta Karun & Bacaan"></td><td><img src="docs/screenshots/animasi-jam-emas.png" alt="Animasi kartu & Jam Emas"></td></tr>
<tr><td><img src="docs/screenshots/bengkel-event.png" alt="Bengkel Alkimia & Event"></td><td><img src="docs/screenshots/toko-karakter.png" alt="Toko & karakter"></td></tr>
<tr><td><img src="docs/screenshots/kartu-di-catatan.png" alt="Kartu langsung di catatan"></td><td><img src="docs/screenshots/tema-lounge.png" alt="Tema Lounge"></td></tr>
<tr><td><img src="docs/screenshots/tema-retro.png" alt="Tema Retro"></td></tr>
</table>

## 📦 Instalasi

### Lewat BRAT (disarankan sebelum masuk daftar Community Plugins)
1. Pasang plugin **BRAT** dari *Settings → Community plugins → Browse*.
2. Buka *Settings → BRAT → Add Beta plugin*.
3. Masukkan `ahmadwirawan74-ui/flashcard-hafalan`, lalu aktifkan **Flashcard Hafalan**.

### Manual
1. Unduh `main.js`, `manifest.json`, dan `styles.css` dari [Release terbaru](https://github.com/ahmadwirawan74-ui/flashcard-hafalan/releases/latest).
2. Salin ketiganya ke `<vault>/.obsidian/plugins/flashcard-hafalan/`.
3. Muat ulang Obsidian, lalu aktifkan plugin di *Settings → Community plugins*.

## 🚀 Mulai cepat

Tulis kartu langsung di catatan:

```markdown
Ibu kota Jepang :: Tokyo
Fotosintesis ::: Proses tumbuhan membuat makanan dengan bantuan cahaya
Inti sel menyimpan {{DNA}} dan dilindungi membran inti.
```

Atau blok teks di catatan → klik kanan → **FLASHCARDS** untuk membuat kartu tanpa mengubah catatan. Buka tab plugin lewat ikon di ribbon atau perintah **"Buka tab Flashcard"**.

🤖 **Membuat kartu dengan AI lain (ChatGPT, Gemini, dll.):** salin prompt di [docs/prompt-flashcard-ai.md](docs/prompt-flashcard-ai.md), tempel materi Anda, lalu tempel hasilnya ke catatan Obsidian. Kartu langsung terbaca.

## 🔒 Privasi & jaringan

- Semua data (kartu, progres, tugas, jadwal) tersimpan **lokal** di `data.json` vault kamu. Tidak ada telemetri dan tidak ada akun.
- Teks Al-Qur'an, terjemahan, hadits, dan font sudah **dibundel di dalam plugin**, jadi bisa dipakai tanpa internet.
- **Satu-satunya akses jaringan:** fitur *murattal* (audio bacaan Al-Qur'an) memutar file MP3 dari `everyayah.com`, dan hanya saat kamu menekan tombol putar.

## 📚 Sumber data & lisensi pihak ketiga

| Isi | Sumber | Lisensi |
|---|---|---|
| Teks Al-Qur'an (Utsmani) & terjemahan Kemenag RI | [quran-json](https://github.com/risan/quran-json) (dari QuranEnc.com) | CC BY 4.0 |
| Metadata juz, halaman, sajdah | [quran-meta](https://github.com/quran-center/quran-meta) | MIT |
| Hadits, terjemahan, penjelasan, doa & dzikir | [HadeethEnc.com](https://hadeethenc.com) | Syarat penerbitan ulang HadeethEnc (ditampilkan apa adanya) |
| Harakat sebagian teks hadits | [Open Hadith Data](https://github.com/mhashim6/Open-Hadith-Data) | ODbL 1.0 / DbCL 1.0 |
| Font Amiri Quran, Poppins, Press Start 2P, VT323 | Google Fonts / Fontsource | SIL OFL 1.1 |
| Dekompresi data | [fflate](https://github.com/101arrowz/fflate) | MIT |

Rincian lengkap ada di [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) dan folder [`licenses/`](licenses/). Untuk keperluan ibadah yang penting, tetap rujuk mushaf dan kitab cetak bila ada keraguan.

## 🛠️ Pengembangan

```bash
npm install
npm run dev     # build otomatis saat file berubah
npm run build   # build produksi → main.js
```

Untuk mencoba di Obsidian, salin atau buat *symlink* folder repo ini ke `<vault>/.obsidian/plugins/flashcard-hafalan/`.

**Merilis versi baru:** `npm version patch` (atau `minor`/`major`), lalu `git push && git push --tags`. GitHub Actions akan membangun plugin dan membuat Release berisi `main.js`, `manifest.json`, dan `styles.css`.

## 📄 Lisensi

Kode plugin berlisensi [MIT](LICENSE). Data dan font yang dibundel mengikuti lisensinya masing-masing (lihat tabel di atas).
