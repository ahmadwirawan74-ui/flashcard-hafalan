# Riwayat perubahan

Catatan perubahan setiap versi, dari yang terbaru.

## 21.0.0 — Materi lengkap untuk SEMUA penyakit SKDI, resep menyesuaikan BB & usia, edukasi pasien

### 🩺 Seluruh penyakit kini punya materi lengkap
- **Semua 913 penyakit SKDI 2019 + 29 penyakit THT (SKDI 2012)** kini terisi materi — tidak ada lagi penyakit yang hanya berupa nama. Total **769 entri materi** (beberapa baris SKDI yang saling berkaitan digabung dalam satu entri, misalnya talasemia & hemoglobinopati, atau luka bakar derajat 1 & 2 ≤ 10%).
- Setiap entri berisi: definisi, epidemiologi (konteks Indonesia), etiologi & faktor risiko, klasifikasi, patofisiologi, gambaran klinis, pemeriksaan fisik, diagnosis & pemeriksaan penunjang, diagnosis banding, tata laksana farmakologi & nonfarmakologi, **edukasi pasien**, komplikasi, kriteria rujukan, modul pemeriksaan fisik terkait, obat terkait, dan sumber (PNPK/PPK Kemenkes, IDAI, POGI, PERKENI, PERDOSKI, PERHATI-KL, WHO, NICE, IDSA, dll.).
- Tingkat 1–2: ringkas dan fokus pada pengenalan & rujukan. Tingkat 3A, 3B, dan 4: lengkap dengan terapi awal/tuntas.
- Bab forensik & medikolegal (visum et repertum, kekerasan seksual, asfiksia, tenggelam, toksikologi, pemeriksaan jenazah, sertifikat kematian) ditulis sebagai panduan kompetensi.

### 📝 Resep untuk tingkat 3A, 3B & 4
- **936 set resep** (dewasa dan anak bila relevan), termasuk dosis pertama pra-rujukan untuk kegawatan (sepsis, artritis septik, demam neutropenia, angioedema, luka bakar berat, dll.).
- **Resep anak dihitung dari BB dan usia**: mesin resep memilih regimen sesuai usia, menolak/memberi peringatan bila usia atau BB di bawah batas regimen (mis. griseofulvin < 2 tahun, ivermektin < 15 kg), membatasi dosis maksimum, dan memberi peringatan volume sirup yang terlalu besar.
- Dosis tertulis di resep dicocokkan otomatis dengan dosis hitungan mesin; resep yang dosisnya khusus (mis. ITP, JIA, frostbite) ditampilkan statis agar tidak bertentangan.

### 💊 Database obat bertambah menjadi 299 obat
- ±96 obat baru: sediaan topikal kulit (permetrin, salep 2-4, antijamur, kortikosteroid topikal berbagai potensi, retinoid, keratolitik, silver sulfadiazin), tetes mata/telinga/hidung, MDT kusta (dapson, klofazimin), ARV & obat hepatitis, imunoglobulin & serum (HTIG, rabies, ADS, SABU), vitamin & mineral, hormonal & kontrasepsi, DMARD (metotreksat, sulfasalazin, hidroksiklorokuin), serta sefazolin, pentoksifilin, tamoksifen, dan lainnya.

### 🐞 Perbaikan
- Formulir resep: kotak centang "Hamil" memakai API DOM standar sehingga formulir selalu tampil lengkap.
- Beberapa teks dosis resep lama diselaraskan dengan hitungan mesin (asiklovir ensefalitis anak, deksametason croup IM, amoksisilin skarlatina).

## 20.0.0 — Penyakit (SKDI 2019), resep lengkap, pemeriksaan fisik, beranda ringkas & tampilan HP

### 🩺 Halaman baru: Penyakit
- **54 penyakit dengan materi lengkap**: definisi, epidemiologi, etiologi, klasifikasi, patofisiologi, gambaran klinis, subtipe/varian, diagnosis, pemeriksaan penunjang, patologi, diagnosis banding, tata laksana (farmakologi, nonfarmakologi, edukasi), komplikasi, kriteria rujukan, temuan pemeriksaan fisik, obat terkait, resep, dan sumber.
- **913 penyakit SKDI 2019** terindeks lengkap dengan tingkat kemampuan (1, 2, 3A, 3B, 4), artinya, dan catatan pribadi. Penyakit yang punya materi lengkap ditandai dan bisa langsung dibuka.
- Saring per sistem SKDI dan per tingkat kemampuan, cari berdasarkan nama/gejala/obat, favorit, dan **buat flashcard** (`Medis/Penyakit/<nama>.md`).
- Setiap penyakit terhubung ke **database obat** (dan sebaliknya, halaman obat menampilkan "Dipakai pada penyakit") serta ke modul pemeriksaan fisik.

### 📝 Halaman baru: Resep
- Resep **lengkap per penyakit** dengan format resep dokter Indonesia: kop dokter (nama, SIP, alamat), kota & tanggal, R/ dengan jumlah angka Romawi, signa singkatan Latin (S 3 dd cth I p.c.), paraf tiap R/, serta Pro/Umur/BB/Alamat.
- **Resep anak dihitung otomatis dari BB**: dosis dibulatkan ke takaran praktis (½ sendok teh, ½ tablet, 0,1 mL tetes), jumlah botol/tablet dihitung dari lama terapi, dan otomatis menjadi **puyer (m.f. pulv. dtd)** bila pecahan tablet tidak praktis.
- Salin resep, simpan ke catatan (`Medis/Resep/`), cek interaksi obat dalam resep, dan daftar arti singkatan resep.

### 🔍 Halaman baru: Pemeriksaan fisik
- 13 modul langkah demi langkah (umum & tanda vital, kardiovaskular, respirasi, abdomen, neurologi, muskuloskeletal, endokrin, kulit, mata, THT, obstetri, anak, GCS) dengan cara melakukan, temuan abnormal beserta maknanya, mutiara klinis, keterampilan SKDI terkait, dan daftar centang yang tersimpan.

### 🏠 Beranda ringkas
- Beranda baru yang singkat: **Study** (Belajar, Rencana belajar, Wawasan, Game), **Ibadah** (sholat berikutnya, Al-Qur'an, Mutaba'ah, Dzikir), dan **Medis** (cari obat/penyakit, Penyakit, Resep, Kalkulator, Obat). Beranda lengkap tetap ada lewat tombol *Tampilan lengkap*.

### 📱 Tampilan HP & menu samping
- Di HP (Android) menu samping kini menjadi **laci yang tersembunyi**; buka dengan tombol ☰ di bilah atas, tutup dengan mengetuk area gelap atau setelah memilih menu.
- Di layar lebar menu samping bisa **diringkas jadi ikon saja** (tombol di samping logo).
- Huruf, ikon, tab, dan bentuk diperkecil di layar sempit (termasuk tema Retro dan Lounge) agar mudah dibaca dan diketuk.

### 🐞 Perbaikan
- **Kalkulator dosis dewasa tidak bisa diklik**: data pasien selalu ditimpa ulang setiap kali halaman dibuka sehingga pilihan Dewasa/Anak dan isian hilang. Kini tersimpan dengan benar.
- **Perkiraan BB dari usia** kini otomatis (APLS, sampai usia 17 tahun) di kalkulator dosis dan kartu darurat; begitu BB diketik manual, perkiraan berhenti, dan bisa diaktifkan lagi dengan satu ketukan.
- Tombol salin tidak lagi gagal di perangkat yang memblokir akses papan klip.

> Sumber: CURRENT Medical Diagnosis & Treatment 2026, Macleod's Clinical Examination 15th ed. (2024), dan SKDI 2019 (KKI). Daftar THT tidak ada di berkas SKDI 2019, sehingga OMA dan rinitis alergi memakai tingkat SKDI 2012. Semua teks ditulis ulang dalam bahasa Indonesia; dosis disesuaikan dengan pedoman nasional. Tetap verifikasi dengan pedoman terbaru dan kondisi pasien.

## 19.0.0 — Medis diperluas: 203 obat, data BNF 85, farmakologi, antidot & kuis

### 💊 Database obat: 112 → 203 obat (510 regimen dosis)
- **91 obat baru** (berlabel *Baru*): kardiovaskular (diltiazem, verapamil, karvedilol, valsartan, lisinopril, nitrogliserin, ISMN, rosuvastatin, heparin, apixaban, rivaroxaban, streptokinase, hidralazin, nikardipin), vasopresor (norepinefrin, dobutamin, dopamin), endokrin (gliklazid, pioglitazon, sitagliptin, empagliflozin, dapagliflozin, insulin glargin, alendronat), antibiotik (penisilin V, benzatin penisilin, dikloksasilin, sefuroksim, seftazidim, meropenem, piperasilin-tazobaktam, vankomisin, nitrofurantoin, amikasin), antimalaria (DHP, artemeter-lumefantrin, artesunat, primakuin, kina), antiparasit & antijamur (ivermektin, praziquantel, terbinafin, valasiklovir), neurologi & psikiatri (levetirasetam, gabapentin, pregabalin, lorazepam, alprazolam, olanzapin, kuetiapin, risperidon, klorpromazin, mirtazapin, escitalopram, levodopa, triheksifenidil, betahistin, sumatriptan), analgesik (naproksen, celecoxib, meloksikam, kodein, fentanil, lidokain), GI & napas (pantoprazol, mesalazin, prometazin, montelukast, aminofilin, budesonid-formoterol), obstetri & urologi (oksitosin, misoprostol, metilergometrin, metildopa, labetalol, DMPA, tamsulosin, sildenafil), antidot & cairan (arang aktif, flumazenil, glukagon, pralidoksim, manitol, natrium bikarbonat, KCl, NaCl 0,9%, Ringer laktat), serta vitamin & mineral (sulfas ferosus, asam folat, vitamin B12, tiamin).
- 3 kategori baru: **Kegawatdaruratan & antidot**, **Obstetri, urologi & hormon**, **Vitamin, mineral & cairan**.
- **Dosis dicocokkan dengan BNF 85** dan beberapa diperbaiki: sefadroksil anak, klindamisin anak (3–6 mg/kg 4x, maks 450 mg), metronidazol anak (maks 400 mg), asiklovir HSV (200 mg 5x), CTM usia 1–2 tahun, loratadin batas 30 kg, ipratropium < 5 tahun, catatan BNF untuk fenobarbital, PTU, prednisolon PPOK, levofloksasin; amoksisilin-klavulanat IV 1,2 g ditambahkan.
- **Nama internasional (BNF)** di setiap obat, **edukasi pasien** untuk 40 obat yang sering diresepkan, dan pencarian kini juga menjangkau efek samping, mekanisme, dan nama Inggris.
- **Saringan cepat**: ada dosis anak, injeksi/infus, perlu penyesuaian ginjal, hindari saat hamil, ada edukasi pasien, obat baru, obat pribadi.
- Flashcard obat kini ikut memuat edukasi pasien dan nama internasional.

### 🧮 Kalkulator dosis: infus kontinu
- Satuan kecepatan **mcg/kg/menit, unit/jam, mg/jam** dengan konversi otomatis ke **mL/jam** untuk syringe pump (norepinefrin, dobutamin, dopamin, heparin, insulin KAD, nikardipin, aminofilin), lengkap dengan tampilan pompa beranimasi dan draf resep infus.
- Insulin KAD kini dihitung sebagai unit/jam dengan pengenceran 1 unit/mL.

### ⚡ Interaksi: + 588 pasangan dari BNF 85
- Lampiran 1 BNF 85 diolah untuk semua obat di database lalu **dituliskan ulang dalam bahasa Indonesia** (bertanda *BNF 85*). Aturan kurasi tetap didahulukan; entri BNF ditambahkan bila belum tercakup atau lebih berat.
- Efek farmakodinamik BNF (hipotensi, bradikardia, perdarahan, hiperkalemia, hiponatremia, nefro-/oto-/hepatotoksisitas, neuropati, QT, serotonin, SSP, antikolinergik) menjadi aturan golongan baru.
- 33 aturan kurasi baru, antara lain verapamil/diltiazem + beta-blocker, sildenafil + nitrat (kontraindikasi), meropenem + valproat, vankomisin + piperasilin-tazobaktam, KCl + ACEI/ARB, ergot + penghambat CYP3A4, levodopa + antagonis dopamin, DOAC + rifampisin/penghambat kuat.
- Interaksi minor di halaman obat dilipat agar yang penting terlihat lebih dulu.

### 📚 Halaman baru: Farmakologi
- **38 golongan obat**: mekanisme kerja, prototipe, penggunaan klinis, efek samping khas, perhatian & interaksi, mutiara klinis, dan daftar anggota yang dapat diklik. Disusun ulang dengan bahasa sendiri dari buku ajar farmakologi.

### ☠️ Halaman baru: Antidot & keracunan
- 23 keracunan (paracetamol, opioid, organofosfat, warfarin, heparin, DOAC, beta-blocker, CCB, digoksin, TCA, besi, metanol, sianida, methemoglobinemia, isoniazid, sulfonilurea, LAST, antikolinergik, distonia, MgSO₄, sindrom serotonin, gigitan ular) dengan gejala, antidot, dosis, dan tautan ke obat.
- **Kalkulator N-asetilsistein** rejimen 21 jam (mg & mL per kantong, volume pelarut, laju mL/jam) plus penilaian dosis tertelan (mg/kg) dan garis terapi nomogram.

### 🎯 Halaman baru: Kuis farmakologi
- Soal pilihan ganda otomatis dari database: golongan, mekanisme, indikasi, dosis, efek samping, kontraindikasi, kehamilan, interaksi, dan antidot. 5 mode, fokus per golongan, beruntun (streak), koin, rekor & akurasi, serta daftar obat yang perlu diulas.

### 📐 Kalkulator klinis
- Baru: **ekuivalensi kortikosteroid**, **konversi opioid** (ekuivalen morfin oral, reduksi toleransi silang, dosis penyelamat, ukuran patch fentanil), **CHA₂DS₂-VASc, HAS-BLED, CURB-65, qSOFA, Wells TVD, Centor/McIsaac**.

> Sumber: BNF 85 (berkas "BNF 89th" yang dilampirkan isinya adalah BNF edisi 85), The Top 100 Drugs, BRS Pharmacology, ditambah pedoman WHO/Kemenkes untuk malaria & kegawatdaruratan. Semua teks ditulis ulang; tidak ada kutipan langsung dari buku.

## 18.0.0 — Bagian Medis untuk dokter

Ruang kerja baru **🩺 Medis** di menu kiri (dapat disembunyikan di Pengaturan → *Bagian Medis*).

### 💊 Database obat (112 obat, 300+ regimen dosis)
- 9 kategori: analgesik, antibiotik, TB/antivirus/antijamur/antiparasit, napas & kortikosteroid, gastrointestinal, kardiovaskular, endokrin, neurologi & psikiatri, kegawatdaruratan & obstetri.
- Setiap obat memuat sediaan, indikasi, **dosis dewasa & anak** (mg/kg, berdasarkan berat/usia, atau bertahap), cara penggunaan, kontraindikasi, peringatan, efek samping, kehamilan & menyusui, penyesuaian ginjal/hati, mekanisme, pemantauan, dan antidot.
- Pencarian berdasarkan nama, alias, golongan, atau indikasi ("demam", "tifoid", "OAINS"), favorit, riwayat, catatan pribadi per obat, dan **obat sendiri** yang dapat ditambah/diedit.
- **Buat flashcard** dari obat mana pun: catatan `Medis/Obat/<obat>.md` berisi kartu golongan, indikasi, dosis, kontraindikasi, efek samping, dan interaksi penting.
- Obat juga dapat dicari dari Cari menu (Ctrl/Cmd+K).

### 🧮 Kalkulator dosis
- Data pasien: anak/dewasa, BB, usia, TB, jenis kelamin, kreatinin, hamil/menyusui. Otomatis menghitung BSA, IMT, **CrCl (Cockcroft-Gault)** atau **eGFR Schwartz** beserta stadium. Perkiraan BB dari usia (APLS).
- Dosis per kali dengan angka beranimasi, penggeser dalam rentang dosis, total harian, **batas maksimal per dosis/hari** (dengan pengukur), dan peringatan usia/berat.
- **Takaran sediaan**: mL (dengan sendok takar & spuit visual), jumlah tablet dibulatkan ke ¼, kadar sediaan lain, dan **draf resep** siap salin.
- Cek keamanan untuk pasien: ginjal, kehamilan, menyusui, dan kontraindikasi usia.
- **Tabel dosis cepat anak** untuk 18 obat yang sering dipakai.

### ⚡ Cek interaksi
- 116 aturan interaksi (spesifik & per golongan: CYP3A4, penginduksi enzim, QT, serotonin, perdarahan, kalium, SSP, khelasi, gula darah) dengan tingkat **Kontraindikasi / Mayor / Moderat / Minor**, mekanisme, dan tata laksana.
- Deteksi **duplikasi golongan** dan **triple whammy** (ACEI/ARB + diuretik + OAINS), ringkasan risiko, dan **matriks interaksi** berwarna.

### 📐 Kalkulator klinis
- Antropometri (IMT Asia-Pasifik, BSA, BB ideal & terkoreksi), fungsi ginjal (CrCl, CKD-EPI 2021, Schwartz), cairan rumatan & defisit, tetesan infus, syringe pump, Ca terkoreksi/anion gap/Na terkoreksi, MAP & QTc, HPL & usia kehamilan, GCS.

### 🚑 Kartu darurat anak
- Dosis resusitasi, aritmia, kejang, anafilaksis, cairan, energi defibrilasi/kardioversi, dan ukuran ETT otomatis dari BB (PALS/APLS), ditambah referensi cepat ACLS dewasa.

> Alat bantu referensi klinis, bukan pengganti penilaian dokter. Data disusun dari referensi standar (WHO Model Formulary, BNF/BNFc, PALS/ACLS AHA, PNPK/IDAI) untuk fungsi ginjal & hati normal; selalu verifikasi dengan pedoman terkini dan label produk.

## 17.0.0 — Dungeon 2.0 & Arena baru

### 🗝️ Dungeon 2.0 (Main → Dungeon)
- **Pilih jalanmu sendiri:** setelah setiap ruangan muncul 2–3 pintu (sebagian misteri ❔). Setiap lantai ke-5 adalah **Gerbang Bos Zona**.
- **5 zona** yang berganti tiap 5 lantai, masing-masing dengan warna, efek partikel, monster, elite, dan bos sendiri: 🍄 Gua Lumut, 🏺 Reruntuhan Kuno, ❄️ Kastil Es, 🌋 Lava Naga, 🌌 Kehampaan Bintang. Ada banner pembuka setiap kali memasuki zona baru.
- **Pertarungan sungguhan:** pahlawanmu berhadapan dengan monster besar yang punya bilah HP. Monster elite ⭐ dan Bos Zona 👑 butuh beberapa jawaban benar. Ada animasi menyerang/terkena, angka kerusakan melayang, serangan kritis, dan layar bergetar saat terkena.
- **Ruangan baru:** 🔮 Altar Berkah (pilih 1 dari 3 relik), 🏕️ Api unggun (istirahat +2 ❤️ atau asah senjata), ❔ Ruang misteri (teka-teki patung, kolam harapan, peti bersinar, gulungan tua), 🔐 Ruang harta (butuh 🗝️ kunci), dan **Mimic** yang menyamar sebagai peti.
- **9 relik** untuk satu penjelajahan, misalnya Pedang Api, Jantung Kristal, Kantong Rakus, Mata Elang, Sayap Malaikat, Jam Pasir Abadi, Obor Semangat, Kunci Master, dan Lilin Penyembuh.
- **Pedagang** menjual ramuan, kunci, perisai, dan relik dengan emas dungeon.
- **🔥 Semangat:** jawaban benar beruntun melipatgandakan emas hingga ×2.
- **3 mode:** 🌿 Santai (6 ❤️), ⚔️ Normal (4 ❤️), 💀 Mimpi Buruk (3 ❤️, 15 detik per soal, emas ×1,6).
- **📅 Dungeon Harian:** denah sama sepanjang hari. Capai lantai 5 untuk bonus 🪙 150, 1 bungkus kartu, 💎, dan 🪶.
- Peta jalur, vinyet merah saat hati tinggal satu, layar akhir dengan rekap rute, relik, dan bahan, serta **daftar 5 penjelajahan terbaik** di lobi.
- Lobi baru dengan portal beranimasi, pilihan mode, kartu Dungeon Harian, dan pratinjau zona (zona terkunci sampai kamu mencapainya).
- Pintasan: 1–4 menjawab, 1/2/3 memilih pintu, Spasi lanjut, B/S untuk jebakan.

### 🎮 Arena baru (Main → Arena)
- **Kartu pemain:** pahlawan, level, XP, koin, kekuatan, streak, rekor dungeon, dan jumlah boss yang dikalahkan.
- **Hari ini:** Boss mingguan, Dungeon harian, Peti harian, dan event yang sedang berjalan. Yang belum selesai menyala.
- Permainan dikelompokkan menjadi **Petualangan** (Dungeon, Aula Boss, Peta Petualangan, Istana Ingatan), **Minigame cepat** (Cocokkan, Kilat, Susun Urutan, Lawan Dirimu, Duel, Bedakan), dan **Koleksi & toko**.

## 16.0.0 — Jam Emas, Bengkel Alkimia, Event Musiman & flashcard yang lebih hidup

### ✨ Flashcard lebih hidup
- Kartu **meluncur masuk**, **membalik 3D** dengan kilau cahaya saat jawaban dibuka, lalu **terbang keluar** saat dinilai. Saat menjawab "Lupa", kartu bergetar lalu jatuh.
- **Ledakan partikel** dari tombol nilai (bintang untuk "Mudah"), **banner COMBO ×5/×10/×20** 🔥, dan api combo yang berdenyut.
- **Cincin cahaya** berputar di tepi kartu (berubah hijau-emas setelah jawaban dibuka), kartu **miring mengikuti kursor**, dan latar warna yang bergerak pelan.
- Tombol nilai dengan emoji (😵 😬 🙂 🤩) yang melompat saat disentuh, bilah progres berkilau dengan penanda 25/50/75%.
- Ringkasan sesi: **1–3 bintang**, angka yang berhitung naik, dan ubin yang muncul bergantian.
- Bisa dimatikan di Pengaturan → *Animasi kartu*. Otomatis mati bila sistem meminta gerakan dikurangi.

### ☀️ Jam Emas Belajar (Wawasan → Jam Emas)
- Menganalisis **akurasi per jam** dari semua ulasan 90 hari terakhir, termasuk ulasan lama, jadi langsung berisi data.
- Menampilkan **jam emas** (rentang 2 jam terbaik) dan **jam terlemah**. Jendela dengan bukti lebih banyak diutamakan, sehingga satu-dua kebetulan tidak menipu.
- **Jam 24 jam berwarna** (panjang irisan = banyaknya ulasan) dan grafik akurasi per bagian hari (ba'da Subuh, pagi, siang, sore, malam…).
- **Materi tersulit** (ingatan rendah, sering lupa), dengan tombol **"Jadwalkan 3 teratas di jam emas"** yang membuat jadwal belajar tanpa bentrok.
- **Geser jadwal belajar** yang ada ke jam emas dengan satu klik. Beranda juga memberi tahu saat "Sekarang jam emasmu!".

### ⚗️ Bengkel Alkimia (Main → Bengkel)
- **6 bahan**: 🪨 Bijih Besi, 🌿 Daun Herbal, 🪶 Bulu Emas, 💎 Kristal Ingatan, 🔥 Bara Naga, 📜 Gulungan Kuno. Didapat dari monster, peti, jebakan, air mancur, dan penjaga dungeon, serta dari Boss (Boss Sulit, mingguan, dan event memberi bahan langka).
- **8 resep ramuan** dan **8 perlengkapan khusus yang tidak dijual di Toko** (mis. Kapak Rimba, Zirah Kristal, Godam Alkemis, Terompet Kemenangan).
- **Resep rahasia** terbuka setelah semua jenis bahannya pernah didapat. Animasi kuali saat meracik, dan prestasi baru *Alkemis*.

### 🎉 Event Musiman (Main → Event)
- **6 event**: Pekan Hari Pendidikan Nasional (26 Apr–9 Mei), Semarak 17 Agustus (10–24 Agu), Pekan Hari Santri (15–25 Okt), Pekan Hari Pahlawan (1–17 Nov), Tahun Baru Hijriah (1–10 Muharram), dan Festival Ramadan (sebulan penuh). Tanggal Hijriah mengikuti kalender Umm al-Qura beserta koreksi tanggal Hijriah di pengaturan Ibadah.
- **Boss bertema** dengan bonus harian, **5 misi event**, dan **token event** (+1 setiap 30 kartu diulas). Token ditukar di **Toko Event** dengan perlengkapan eksklusif, kartu album, bungkus kartu, ramuan, dan Gulungan Kuno. Token hangus saat event berakhir.
- **12 kartu album Edisi Terbatas** (2 per event) dengan fakta singkat, misalnya Teks Proklamasi, Nuzulul Qur'an, dan Hari Santri. Kartu ini tidak muncul di bungkus biasa dan tidak bisa ditempa.
- **Dekorasi tampilan** selama event (umbul-umbul, lentera, bulan sabit) dan spanduk di Beranda. Bisa dimatikan di Pengaturan → *Dekorasi event musiman*.

## 15.0.0 — Toko & perlengkapan, kartu langsung di catatan, perbaikan Image Occlusion

### 🔧 Perbaikan Image Occlusion
- **Gambar kini selalu tampil di semua mode**: kuis pilihan ganda, Aula Boss, Dungeon, Lawan Dirimu, Duel, Simulasi Ujian, Bedakan yang Mirip, dan Istana Ingatan. Sebelumnya mode-mode permainan hanya menampilkan teks kartu ("Jantung — bagian A").
- **Gambar yang dipindah atau diganti nama ditemukan kembali otomatis**, termasuk bila perubahannya terjadi saat Obsidian tertutup atau datang lewat sinkronisasi dari perangkat lain. Path di data plugin langsung diperbarui.
- Bila berkas gambar benar-benar hilang, muncul kotak **"Gambar tidak ditemukan"** beserta path-nya dan petunjuk memperbaikinya, bukan sekadar nama gambar.

### 🏪 Toko & perlengkapan (Main → Toko)
- **Saudagar Ilmu** menjual 7 senjata, 6 zirah, 5 aksesori, dan 8 ramuan dengan 4 tingkat kelangkaan. Ada **penawaran harian −30%** yang berganti setiap hari.
- **Senjata** menambah kerusakan dan peluang kritis; **zirah** menambah hati dan peluang menangkis; **aksesori** memberi bonus koin, waktu menjawab, atau mempercepat Pamungkas.
- **Tempa** perlengkapan hingga +4 (senjata +5% serangan/level, zirah +3% tangkis/level, aksesori +5% koin/level). Kartu barang menampilkan perbandingan kekuatan dengan yang sedang dipakai (▲/▼).
- **Lembar karakter**: pixel-hero yang zirahnya berganti warna sesuai perlengkapan, slot senjata/zirah/aksesori, statistik, kekuatan total, isi tas, dan koleksi perlengkapan.
- **Ramuan dipakai saat bertarung** dari bilah tas di Aula Boss dan Dungeon: 🧪 Penyembuh, ⚗️ Ramuan Agung, 🔰 Perisai, 🔍 Kaca Pembesar (hapus 2 pilihan salah), 💣 Bom Ilmu, ⏳ Jam Pasir, 🍀 Semanggi (koin ×2), dan 🪶 Bulu Phoenix (bangkit otomatis).
- Pahlawanmu tampil berhadapan dengan boss dan berjalan di lorong dungeon. Prestasi baru: *Pelanggan Setia*.

### 🧠 Kartu langsung di catatan
- **Tombol kartu di ujung baris** yang berisi flashcard: 🟠 jatuh tempo, 🔵 baru, ⚪ terjadwal (angka = jumlah kartu di baris itu).
- **Klik → popover pratinjau**: lihat muka kartu, tampilkan jawaban (Spasi), lalu **nilai langsung** (1–4, jadwal FSRS diperbarui) untuk kartu baru/jatuh tempo, atau **uji diri** tanpa mengubah jadwal untuk kartu yang belum jatuh tempo. Ada navigasi ←/→ bila satu baris berisi beberapa kartu, serta tombol Edit dan Buka di tab.
- **Blok beberapa baris → klik kanan → "Latih N kartu di seleksi"**, atau perintah *Latih flashcard di seleksi / baris ini*.
- **Ikon 🗂️ di bilah atas catatan** (juga di mode baca) atau perintah *Pratinjau & latih flashcard di catatan ini*: daftar semua kartu catatan dengan filter jatuh tempo/baru/terjadwal dan panel latihan di sampingnya.
- Bisa dimatikan di Pengaturan → *Tombol kartu di catatan*.

## 14.0.0 —: Album Koleksi, Dungeon, Harta Karun, Bacaan, Boss & Istana baru

### 🎴 Album Koleksi (Main → Album)
- 36 kartu koleksi dalam 3 album: **Ilmuwan & Penemu Dunia**, **Ilmuwan Muslim**, dan **Pahlawan Nasional**. Setiap kartu memuat fakta singkat yang sudah mapan.
- Kelangkaan **Umum · Langka · Epik · Legendaris**, dengan animasi membuka bungkus (kartu dibalik satu per satu).
- **Bungkus kartu** didapat dari streak setiap 7 hari, prestasi baru, boss, dungeon, peti harian, dan peta harta karun, atau dibeli dengan 120 koin.
- Kartu ganda berubah menjadi **debu bintang** untuk **menempa** kartu yang belum dimiliki. Melengkapi satu album memberi 500 koin dan 2 bungkus.
- Gambar kartu berupa lambang ilustratif, bukan potret tokoh.

### 💰 Harta Karun (Main → Harta Karun)
- **Peti Harian**: terbuka setelah target ulasan hari ini tercapai. Tingkatannya Kayu, Perak (akurasi ≥ 85%), atau Emas (ulasan 2× target), berisi koin, debu, dan kadang bungkus kartu.
- **Peta Harta Karun mingguan**: 5 petunjuk (mis. kalahkan boss, baca 5 potongan, ulas 100 kartu). Lengkapi semuanya untuk menggali 300 koin dan 3 bungkus kartu.

### 🗝️ Dungeon (Main → Dungeon)
- Roguelike lantai demi lantai dengan soal dari materimu: 👹 monster, 🧰 peti harta, 🪤 jebakan benar/salah 8 detik, ⛲ air mancur, 🧙 pedagang ramuan, dan 💀 penjaga setiap 5 lantai (2 soal berturut-turut).
- Keluar membawa harta di air mancur atau setelah mengalahkan penjaga. Kalau gugur, setengah emas hilang. Ada rekor kedalaman dan prestasi *Penjelajah Dungeon*.

### 👾 Aula Boss (Main → Aula Boss)
- **Boss mingguan** dan **boss untuk setiap materi**, dengan 6 monster (3 baru: Naga Ngantuk, Hantu Hafalan, Robot Remidi).
- **Tingkat kesulitan**: Mudah (5 hati), Normal (4 hati), Sulit (3 hati, 15 detik per soal, hadiah ×1,5).
- Layar pembuka, angka kerusakan, combo, **⚡ Serangan Pamungkas** saat combo ≥ 5, dan boss **mengamuk** saat HP < 50%.
- Layar hasil berisi akurasi, combo, waktu, hadiah, dan tombol "Latih kartu yang salah".

### 📖 Membaca Bertahap (Belajar → Bacaan)
- Sumber bacaan bisa berupa catatan di vault, teks/artikel yang ditempel, atau **PDF** (teksnya diambil otomatis). Teks dipecah menjadi potongan ±150/250/400 kata yang dijadwalkan (1–5 potongan, setiap hari sampai seminggu sekali).
- **Blok kalimat saat membaca → "Jadikan kartu"**. Kartu tertaut ke catatan bacaan dan muncul sebagai materi.

### 🏛️ Istana Ingatan
- **Panduan "Cara memakai"** dalam 5 langkah bergambar beserta tips membuat bayangan.
- **Kolom "Bayangan"** di setiap titik, yang muncul sebagai petunjuk saat menjelajah (tersembunyi sampai diketuk).
- Kartu istana menampilkan **skor jelajah terakhir**, kapan terakhir dijelajahi, dan **pengingat mengulang** (besok → 3 hari → 7 hari).

### 📊 Kartu tabel
- Modal tabel kini punya 4 mode: **Tanya-jawab per baris**, **Sembunyikan kolom**, **Per baris dalam tabel**, dan **Hafal tabel utuh**. Jawabannya menampilkan tabel lengkap dengan sel tersorot.
- **Buat kartu → Tabel**: isi tabel tanpa menulis Markdown, simpan ke catatan, lalu pilih mode kartunya.

## 13.1.1
- Rilis publik pertama di GitHub: struktur repositori, workflow rilis otomatis, lisensi & catatan pihak ketiga.
- Perintah "Tangkap cepat" tidak lagi memasang hotkey bawaan (sesuai pedoman Obsidian). Atur sendiri di *Settings → Hotkeys*.

## Perbaikan 13.1
- **Bilah tab Belajar (Mulai belajar, Ujian, Materi, …) tidak hilang lagi.** Sebelumnya bilah ini disembunyikan selama ada sesi belajar yang belum selesai. Karena sesi otomatis dipulihkan saat Obsidian dibuka, membuka "Belajar" selalu langsung masuk ke sesi tanpa tab. Sekarang bilah tab tetap tampil (ringkas) dengan penanda "● sesi berjalan", dan sesi bisa dilanjutkan kapan saja dari tab Mulai belajar.
- **Mode layar penuh Ruang Fokus** otomatis mati saat kamu berpindah halaman, sehingga menu dan tab tidak pernah tertinggal dalam keadaan tersembunyi.

## Baru di 13.0: Ruang Fokus baru, musik tanpa henti & halaman Ujian

### 🎵 Musik latar
- **Berputar terus sampai ditekan ■**. Sebelumnya, mengklik musik saat timer tidak berjalan hanya memutar cuplikan 4 detik, dan musik ikut berhenti saat timer dijeda.
- Musik yang diputar sendiri **tidak ikut berhenti** saat timer dijeda atau masuk istirahat. Opsi "putar musik otomatis saat fokus dimulai" tetap ada.
- **8 trek**: Lo-fi 8-bit, **Piano lembut** (baru), **Ambient tenang** (baru), Chiptune, Hujan, **Ombak** (baru), Derau coklat, dan Derau putih. Semuanya dibuat langsung oleh plugin, tanpa internet.
- Tombol 🎵 di widget Pomodoro pada menu langsung memutar/menghentikan musik.

### 🍅 Ruang Fokus
- **Timer besar** dengan cincin yang bergerak halus. Warnanya mengikuti fase: merah untuk fokus, hijau untuk istirahat, biru untuk istirahat panjang. Ada tab fase, titik siklus 4 sesi, dan tombol ▶ besar.
- **Pilih tugas** dari daftar tugas (🍅 tercatat di tugas itu) atau tulis sendiri.
- Durasi: 4 preset atau isi sendiri (fokus, istirahat, istirahat panjang), plus pilihan lanjut otomatis dan pengaturan musik.
- **Ide istirahat** saat jeda (peregangan, minum, 20-20-20, dzikir).
- **Statistik**: 🍅 hari ini, total waktu fokus, hari beruntun, dan grafik 7 hari.
- **Mode layar penuh** yang hanya menampilkan timer.

### 🎓 Halaman Ujian (ruang kerja Belajar → tab Ujian)
- **Buat ujian**: nama, **tanggal** (pemilih tanggal + pintasan 1 minggu, 2 minggu, 1 bulan, 2 bulan), jam ujian, dan **berkas/materi ujian**.
- **Rencana otomatis**: jadwal belajar harian (jam, durasi, hari) dengan pengingat yang **berhenti otomatis sehari sebelum ujian**, ditambah tugas persiapan.
- **Kartu ujian**: hitung mundur H-n, **ubah tanggal langsung** (peta jalan, jadwal, dan tugas menyesuaikan), statistik, dan cincin **kesiapan** (kartu dipelajari × prediksi ingatan pada hari H).
- **Peta jalan belajar per hari** sampai hari H dalam 5 fase:
  📘 Pelajari materi (kartu baru dibagi rata per berkas) → 🔁 Ulas & perkuat (ulasan, kuis campuran, baca ulang berkas) → 📝 Simulasi (H-3) → 🎯 Latih kartu tersulit (H-1) → 🎓 Hari H (ulas ringan 10 menit).
  Setiap langkah hari ini punya tombol **Mulai**, dan hari yang benar-benar dikerjakan diberi ✓.
- Ujian juga tampil di Kalender, Beranda, dan Cari menu.

## Baru di 12.0: hadits berharakat & tampilan Ibadah baru

### ✍️ Hadits & doa berharakat
Sebagian teks hadits di HadeethEnc ditulis tanpa harakat (134 dari 245). Sekarang **132 di antaranya tampil berharakat**: rata-rata 93% kata matan (sabda Nabi) diberi harakat.
- Harakat **tidak dibuat sendiri**. Harakat diambil dari **Open Hadith Data**, yaitu 9 kitab hadits berharakat (Bukhari, Muslim, Abu Dawud, Tirmidzi, Nasa'i, Ibnu Majah, Malik, Ahmad, Darimi; lisensi ODbL).
- Pencocokan dilakukan **kata demi kata**: sebuah kata hanya diberi harakat bila hurufnya identik dan berada dalam rangkaian minimal 3 kata yang sama berurutan. Kata lain dibiarkan persis seperti teks HadeethEnc.
- Di bawah setiap teks tercantum kitab sumber harakatnya, dan tombol **Teks asli** menampilkan teks HadeethEnc apa adanya.
- Latihan hafalan (tutup bertahap, huruf awal) juga memakai teks berharakat.

### 🕌 Tampilan Ibadah
- **Spanduk** bergradasi dengan pola geometri Islami, tanggal Hijriah, dan hitung mundur sholat di setiap halaman Ibadah, dengan warna berbeda per halaman.
- **Kotak teks Arab bergaya mushaf**: bingkai berhias, huruf lebih besar, dan jarak baris lega.
- **Mutaba'ah**: 5 **kartu sholat** berisi waktu sholat, status (belum/sholat/tepat waktu/berjamaah), dan streak.
- **Dzikir**: progres sesi ("3/7 dzikir dibaca") dan **penghitung berbentuk cincin**.
- **Tasbih**: **untaian 33 butir** yang menyala satu per satu, dengan butir "imam" berwarna emas.
- **Hadits & Doa**: nomor berbentuk bintang delapan dan lencana derajat (Sahih hijau, Hasan kuning).
- **Asmaul Husna**: kartu dengan latar pola geometri.

## Baru di 11.0: Beranda, Kalender & Rencana belajar yang baru

### 🏠 Beranda dasbor
- **Kepala dasbor**: sapaan, tanggal Masehi & Hijriah, chip streak/level/koin, dan hitung mundur sholat berikutnya.
- **Cincin "Progres hari ini"** yang menggabungkan kartu, tugas, jadwal belajar, tilawah, dan ibadah, masing-masing dengan meter berwarna.
- **Berikutnya untukmu**: satu tombol besar yang otomatis memilih hal terpenting untuk dikerjakan sekarang (jadwal belajar yang sedang berlangsung → kartu jatuh tempo → murajaah → tugas → tilawah), plus 3 saran lain.
- **Agenda hari ini** sebagai linimasa dengan garis "Sekarang".
- Panel tersusun dalam **grid 2 kolom** per bagian (menjadi 1 kolom di HP).

### 📅 Kalender
- Tiga tampilan: **Bulan** (dengan panel agenda hari terpilih di samping), **Minggu** (garis waktu per jam, ketuk dua kali untuk menjadwalkan), dan **Agenda** (daftar 3 minggu).
- Sel bulan mendahulukan hal khusus (ujian, tugas, jadwal sekali); jadwal rutin tampil sebagai titik warna. Ada garis merah untuk hari ujian, tanggal Hijriah, dan warna latar sesuai aktivitas belajar.
- **Legenda berwarna = filter**: klik untuk menampilkan/menyembunyikan Ujian, Pelajaran, Jadwal belajar, Tugas, Ulasan kartu, Al-Qur'an, Pomodoro, Kebiasaan, Catatan, dan Waktu sholat.
- Panel hari berisi linimasa (dengan tombol **Mulai** dan centang), tugas tanpa jam, tugas terlambat, kartu per materi, tambah tugas cepat, dan tombol **Jadwal belajar**.

### 🗓️ Rencana harian & Jadwal belajar
- **Strip 7 hari**: ketuk tanggal untuk berpindah hari, lengkap dengan jumlah agenda per hari.
- **Kartu ringkasan**: jadwal belajar selesai, tugas selesai, total waktu terjadwal, dan "Berikutnya" dengan tombol Mulai.
- Garis waktu mulai **04:00** dengan **penanda waktu sholat**; blok jadwal berwarna sesuai jenisnya dan punya tombol ▶ Mulai.
- Tab **Jadwal belajar**: kartu besar **Berikutnya** (hitung mundur + Mulai), cincin progres minggu ini, **template cepat** (ulas flashcard, tilawah ba'da Subuh, murajaah, ziyadah, hafalan hadits, baca ulang catatan), papan mingguan berwarna, dan daftar **kelola semua jadwal** (nyalakan/matikan pengingat dan ubah jadwal).

## Baru di 10.0: tampilan yang lebih rapi

### 🧭 Enam ruang kerja
Menu kiri kini hanya berisi **6 ruang kerja**, bukan 30 halaman. Halaman-halaman di dalamnya tampil sebagai **tab di bagian atas**.

| Ruang kerja | Isi (tab) | Aksi cepat |
|---|---|---|
| 🏠 **Beranda** | Ringkasan hari ini | — |
| 🎓 **Belajar** | Mulai belajar · Materi · Buat kartu · Semua kartu · Perbaiki · Ruang Fokus | Mulai belajar, Kartu baru |
| 📅 **Rencana** | Jadwal · Tugas · Kalender · Proyek · Kebiasaan · Catatan · Nilai | + Tugas, Jadwal belajar |
| 🌙 **Ibadah** | Al-Qur'an · Mutaba'ah · Dzikir & Tasbih · Hadits & Doa · Asmaul Husna · Ramadan | Lanjut tilawah, Tasbih |
| 🎮 **Main** | Arena · Petualangan · Istana Ingatan · Prestasi | Boss mingguan |
| 📊 **Wawasan** | Analitik · Laporan mingguan · Kelemahan · Review mingguan · Peta pengetahuan · Peta pikiran | Review mingguan |

- Setiap ruang kerja punya warna sendiri dan **mengingat tab terakhir** yang kamu buka.
- Angka notifikasi (kartu jatuh tempo, tugas, murajaah, …) dijumlahkan per ruang kerja dan tampil juga di masing-masing tab.
- **Cari menu (Ctrl/Cmd+K)**: ketik untuk melompat ke halaman mana pun atau menjalankan aksi (mulai belajar, tangkap cepat, tambah jadwal belajar, lanjutkan tilawah, Pomodoro, ganti tema).

### 🏠 Beranda berkelompok
Panel Beranda dikelompokkan menjadi **Hari ini · Belajar · Al-Qur'an & ibadah · Motivasi & progres**. Klik judul bagian untuk melipat atau membukanya, dan pilihan itu diingat. Urutan dan tampil/sembunyinya panel tetap bisa diatur lewat **Atur Beranda**.

## Baru di 9.1: Jadwal belajar & perbaikan penjadwalan

### 📅 Jadwal belajar
Menu **Jadwal** → tab **Jadwal belajar** (atau perintah *Tambah jadwal belajar*).
- **Jadwalkan apa saja**: flashcard (semua kartu jatuh tempo, satu folder, atau satu materi, lengkap dengan mode belajarnya), baca ulang catatan, tilawah, hafalan baru (ziyadah) atau murajaah Al-Qur'an, hafalan hadits & doa, Asmaul Husna, atau kegiatan lain.
- Pilih **hari** (setiap hari, Sen–Jum, atau hari tertentu) atau **tanggal sekali saja**, lalu jam dan durasi.
- **Pengingat** muncul tepat waktu dengan tombol **Mulai sekarang**, yang langsung membuka sesi yang dijadwalkan. Sesi flashcard berhenti otomatis setelah durasinya habis.
- **Rencana otomatis**: pilih materi dan hari belajar, maka materi dibagi bergiliran ke setiap hari, ditambah sesi "ulas kartu jatuh tempo".
- Jadwal tampil di **Rencana harian** (garis waktu), **Beranda** (panel *Jadwal belajar hari ini*), **Kalender**, dan **status bar** (jadwal berikutnya). Ada juga statistik keterlaksanaan per minggu dan prestasi *Disiplin*.

### 🔧 Perbaikan
- **Tanggal yang diketik kini dipakai.** Sebelumnya, menambah tugas dari tampilan *Hari ini*, *Rencana harian*, atau *Kalender* dengan teks seperti "besok" atau "senin" tetap terjadwal di tanggal halaman.
- **Tugas berulang** ("setiap hari", "setiap senin", …) kini muncul di **semua** tanggal yang sesuai di Kalender dan Rencana harian, bukan hanya sekali.
- **Pengingat tugas berulang** tetap berjalan walaupun ada hari yang terlewat (tanggalnya otomatis bergeser ke hari ini).
- **Bisa dipakai di HP tanpa seret-lepas**: ketuk tugas di "Belum dijadwalkan" untuk memilih jam, ketuk slot kosong di garis waktu untuk menambah tugas atau jadwal, ketuk blok untuk mengubah jam, dan pakai tombol ◀ ▶ untuk memindahkan kartu Kanban.
- **Beranda bisa gagal tampil di zona waktu WIB** pada hari-hari tertentu karena perhitungan "ayat hari ini". Ini sudah diperbaiki. Sekarang, bila satu panel Beranda bermasalah, panel lain tetap tampil.

## Baru di 9.0: fitur Ibadah
Grup menu **Ibadah** sekarang berisi Al-Qur'an, Mutaba'ah, Dzikir & Tasbih, Hadits & Doa, Asmaul Husna, dan Ramadan.

| Fitur | Isi |
|---|---|
| 🕌 **Mutaba'ah Yaumiyah** | Sholat 5 waktu (belum / sholat / tepat waktu / berjamaah), tahajud, dhuha, rawatib (rakaat), witir, puasa sunnah (dengan pengingat Senin-Kamis & Ayyamul Bidh), dzikir pagi/petang dan tilawah (terisi otomatis), sedekah, serta **amalan sendiri**. Ada skor harian, streak per amalan, grafik 14 hari, dan grid 28 hari. |
| 🕐 **Jadwal sholat** | Dihitung **tanpa internet** untuk 40 kota (atau koordinat sendiri) dengan parameter Kemenag RI. Ada koreksi menit per waktu, hitung mundur ke sholat berikutnya, dan tanggal **Hijriah** (dengan koreksi ±2 hari). |
| 📿 **Dzikir & Tasbih** | Dzikir pagi dan petang serta zikir umum dari hadits sahih/hasan, lengkap dengan teks Arab, terjemahan, dan penghitung bacaan. Selesai dzikir otomatis tercatat di Mutaba'ah. **Tasbih digital**: 6 kalimat, target 33/99/100/1000, tombol Spasi, getar di HP, dan **mode setelah salat** (33-33-33 + tahlil, beserta dalilnya). |
| 📜 **Hadits Arbain** | 42 hadits Arbain An-Nawawi dengan teks Arab, terjemahan, **penjelasan dan faedah**, derajat, dan takhrij. Ada ceklis hafal (belum/sedang/hafal), latihan hafalan (Baca & ulangi, Tutup bertahap, Huruf awal), dan murajaah FSRS. |
| 📜 **100 Hadits Muslim** | 100 hadits sahih yang **khusus riwayat Muslim**, dipilih dari yang matannya paling ringkas dan diurutkan dari yang termudah dihafal. Fitur hafalannya sama dengan Arbain. |
| 🤲 **Doa harian** | Doa masuk/keluar rumah, WC, dan masjid; doa untuk keadaan tertentu (makan, tidur, bepergian, angin, dan lainnya); doa-doa ma'tsur; doa dalam salat, dengan ceklis hafal dan murajaah. |
| ✨ **Asmaul Husna** | 99 nama dengan tulisan Arab, Latin, dan arti; ceklis hafal; dan **kuis** dua arah (nama → arti, arti → nama) per kelompok 10 nama. |
| 🌙 **Mode Ramadan** | Aktif otomatis saat Ramadan (atau sebagai pratinjau). Isinya: **hitung mundur berbuka/imsak**, target **khatam 30 hari** (1 juz/hari) dengan tombol "Baca Juz N", kalender puasa 30 hari (puasa/tidak/udzur), tarawih per malam, **target sedekah**, **10 malam terakhir** (malam ganjil ★, ceklis qiyamul lail/i'tikaf/tilawah), dan hadits-hadits Ramadan. |

Juga ada: panel "Ibadah hari ini" di Beranda (bisa diatur posisinya), sholat berikutnya atau waktu berbuka di status bar, tanggal Hijriah di Kalender, 6 prestasi baru, dan 2 misi harian baru.

> **Sumber & metode**
> - **Hadits, dzikir, dan doa**: [HadeethEnc.com](https://hadeethenc.com), *Ensiklopedia Hadits Terjemahan* (bahasa Indonesia v1.22.0), ditampilkan **apa adanya** sesuai syarat penerbitan ulang dari sumber (lihat `SUMBER-HadeethEnc.txt`). Setiap layar mencantumkan sumber, dan ada tautan ke halaman aslinya. Masukan untuk terjemahan bisa dikirim langsung ke HadeethEnc.com.
> - **Arbain**: nomor 1–42 dipetakan ke entri HadeethEnc dengan mencocokkan teks Arab, lalu **diperiksa satu per satu** (judul & takhrij).
> - **100 Hadits Muslim**: hadits HadeethEnc yang takhrijnya *khusus* Muslim (bukan *muttafaq 'alaih*), semuanya berderajat sahih, dan dipilih 100 yang matannya paling ringkas.
> - **Asmaul Husna**: urutan riwayat Tirmidzi yang masyhur. Nama Arab hanya dipakai bila **dua sumber independen sepakat**. Sumber ketiga yang dibuat dengan AI ditolak karena keliru menyusun daftar. Tiga salah ketik dikoreksi (no. 46, 74, 94).
> - **Jadwal sholat**: perhitungan astronomi dengan parameter Kemenag RI; bisa berbeda 1–3 menit dari jadwal resmi, sehingga tersedia koreksi manual. Awal Ramadan diperkirakan dengan kalender Umm al-Qura; **penetapan resmi mengikuti keputusan pemerintah**.

## Baru di 8.0

### 📖 Al-Qur'an (menu *Ibadah*)
| Bagian | Isi |
|---|---|
| **Ringkasan** | Tombol *Lanjutkan membaca* (surah, ayat, juz, halaman), cincin target tilawah harian, progres dan **perkiraan tanggal khatam**, jumlah khatam, streak tilawah, **ayat hari ini**, dan riwayat tilawah 12 minggu. |
| **Baca** | Mushaf 114 surah dengan teks **Rasm Utsmani** (font Amiri Quran) dan **terjemahan Kemenag RI**. Ada penanda juz, halaman, dan ayat sajdah ۩, ukuran huruf A−/A+, serta **mode hafalan** (teks disamarkan, klik untuk mengintip). Klik **✓ sampai sini** untuk mencatat bacaan; halaman dihitung pecahan sesuai mushaf Madinah 604 halaman. Tersedia pencarian surah, kata dalam terjemahan, atau teks Arab, dan lompat ke juz. |
| **Murattal** | Putar per ayat atau seluruh surah dengan 6 pilihan qari (termasuk Al-Husary Mu'allim untuk belajar), bisa **diulang 1–20× per ayat**, dan ayat yang sedang dibaca disorot. *Butuh internet (everyayah.com).* |
| **Hafalan** | Status per ayat (belum → sedang → hafal), **peta 30 juz**, grid ayat per surah, target **ziyadah** per hari, dan "Sedang dihafal" yang otomatis menunjukkan ayat berikutnya. |
| **Latihan hafalan** | 4 teknik: 🔁 **Ulangi** (penghitung ×N + murattal), 🙈 **Tutup bertahap** (25–100% kata disembunyikan), 🔤 **Huruf awal**, dan 🔗 **Sambung ayat**. |
| **Murajaah** | Setiap halaman hafalan dijadwalkan dengan **FSRS**, seperti flashcard. Bacalah dari ingatan, buka ayat satu per satu, lalu nilai *Lupa / Ragu / Lancar / Sangat lancar*. |
| **Penanda** | Bookmark ayat dengan catatan tadabbur, plus posisi terakhir dibaca. |

Juga ada: panel Al-Qur'an di Beranda, tilawah/hafalan/murajaah di Kalender, perintah *Lanjutkan tilawah* dan *Mulai murajaah*, 4 prestasi (Khatam, Penjaga Hafalan, Istiqamah Tilawah, Rajin Murajaah), serta misi harian tilawah dan murajaah.

> **Sumber data:** teks Rasm Utsmani dari *The Noble Qur'an Encyclopedia* (quranenc.com); terjemahan **Kementerian Agama RI** via quranenc.com (nomor catatan kaki dihapus karena isi catatannya tidak disertakan); data dikemas oleh [quran-json](https://github.com/risan/quran-json) (CC BY 4.0) dan [quran-meta](https://github.com/quran-center/quran-meta) (MIT). Teks disertakan di dalam plugin sehingga bisa dibaca **tanpa internet**; hanya murattal yang membutuhkan koneksi. Bila ragu, selalu rujuk mushaf cetak resmi.

### 📊 Status bar & menu cepat
Di bagian bawah Obsidian (desktop) tampil 🧠 kartu menunggu · ✅ tugas hari ini · 🍅 timer Pomodoro/stopwatch · 📚 pelajaran berikutnya · 📖 tilawah hari ini · ⚡ menu cepat. Klik untuk membuka halamannya. Menu ⚡ berisi: mulai belajar, tangkap cepat, Pomodoro, lanjutkan tilawah, murajaah, dan lainnya. Setiap item bisa dimatikan di Pengaturan → *Status bar*.

### 🧩 Beranda yang bisa diatur
Klik **Atur Beranda** di pojok kanan atas Beranda. Seret panel (atau pakai tombol ↑ ↓) untuk mengubah urutan, dan matikan yang tidak dipakai. Ada juga tombol *Minimalis* (hanya kartu, tugas, pelajaran, dan Al-Qur'an) serta *Kembalikan bawaan*.

## Baru di 7.0: grup menu "Rencana"
| Fitur | Cara pakai |
|---|---|
| 📚 **Jadwal pelajaran** | Jadwal → *Jadwal pelajaran* → Tambah pelajaran (hari, jam, ruang, guru/dosen, warna, materi flashcard). Jadwal tampil di Beranda, Kalender, dan Rencana harian. Ada pengingat N menit sebelum kelas, serta tombol 🗒️ yang membuat catatan kuliah dengan nama mata pelajaran sudah terisi. |
| 🕐 **Time blocking** | Jadwal → *Rencana harian*: garis waktu 06:00–23:00. **Seret tugas** dari "Belum dijadwalkan" ke jam yang diinginkan (dibulatkan ke 15 menit), atur durasinya, atau klik slot kosong untuk menambah tugas di jam itu. Ada garis merah penanda "sekarang". |
| 🏅 **Nilai** | Catat nilai per mata pelajaran dengan bobot (UTS ×2, UAS ×3). Kamu mendapat rata-rata berbobot, huruf & IP (skala 4.0), grafik kecil, dan **target**: plugin menghitung nilai yang dibutuhkan di penilaian berikutnya. |
| 🔁 **Kebiasaan** | Tambah kebiasaan dengan ikon dan hari aktif. Centang setiap hari (+1 koin) untuk membangun **streak**, dan lihat grid 28 hari terakhir. Strip kebiasaan hari ini tampil di Beranda. |
| 📁 **Proyek & Kanban** | Buat proyek dengan tenggat dan bar progres. **Seret kartu** antara *Belum → Dikerjakan → Selesai*. Tugas bisa dimasukkan ke proyek dari editor tugas. |
| 📋 **Rencana ujian otomatis** | Panel Ujian di Beranda → *Susun rencana*. Tugas belajar disebar sampai hari H: pelajari setiap materi, ulas ulang, simulasi (H-3), latih kartu tersulit (H-1), dan istirahat di hari ujian. Semuanya masuk ke proyek "Persiapan …" dan bisa **disusun ulang** kalau ada yang terlewat. |
| 📐 **Cornell → Kartu** | Di catatan bertemplate Cornell, butir ke-*n* di "Pertanyaan" dipasangkan dengan butir ke-*n* di "Catatan" menjadi flashcard, dan "Ringkasan" menjadi kartu penjelasan. Klik **Cornell → Kartu**; pasangan yang sudah ada tidak digandakan. |
| ⏱ **Stopwatch belajar** | Ruang Fokus → *Stopwatch belajar*: catat waktu belajar di luar flashcard per mata pelajaran. Hasilnya tampil di Rencana harian, Kalender, Review mingguan, dan misi. |
| ⚡ **Tangkap cepat** | **Ctrl/Cmd+Shift+J** atau ikon ⚡ di ribbon, dari mana saja. Plugin menebak jenis isinya: kalimat biasa menjadi **tugas**, `Tanya :: Jawab` menjadi **kartu** (di catatan aktif), dan teks panjang/multi-baris menjadi **catatan**. Jenisnya bisa diganti sebelum disimpan. |
| 🧭 **Review mingguan** | Beranda mengingatkan setiap Jumat–Minggu. Ada 5 langkah: bereskan tugas tertinggal → pencapaian minggu ini → refleksi → 3 prioritas minggu depan (menjadi tugas Senin) → tersimpan sebagai catatan (+30 koin). |

## Baru di 6.0: Tugas, Catatan & Kalender

### ✅ Tugas
Tulis seperti biasa, dan detailnya dikenali otomatis:

| Kamu menulis | Dikenali sebagai |
|---|---|
| `besok`, `lusa`, `kemarin`, `hari ini`, `senin`…`minggu`, `minggu depan` | tanggal |
| `tgl 20`, `20/11`, `20 nov` | tanggal tertentu |
| `jam 7 malam`, `pukul 16:00`, `19.30` | jam (dengan pengingat) |
| `!tinggi` / `!!` / `!sedang` / `!rendah` | prioritas |
| `#kimia` | tag |
| `@01 Sel` | materi terkait (ada tombol ▶ untuk langsung belajar) |
| `setiap hari`, `setiap senin`, `tiap bulan`, `setiap hari kerja` | tugas berulang |

Contoh: *"Latihan soal kimia besok jam 7 malam !tinggi #kimia"*.

Fitur lain:
- Tampilan **Hari ini / Mendatang / Semua / Matriks prioritas (Eisenhower) / Selesai**, dan filter tag.
- **Sub-tugas**, catatan tugas, dan **pengingat** berbunyi saat jamnya tiba.
- Tombol **Fokus** memulai Pomodoro untuk tugas itu, dan 🍅 terhitung di tugasnya.
- Kartu yang jatuh tempo dan ujian dekat otomatis muncul sebagai tugas hari ini.
- Setiap tugas selesai memberi +2 koin, dan konfeti muncul saat semua tugas hari ini beres.
- Klik kanan di catatan → **Jadikan tugas**, atau gunakan perintah "Jadikan teks terpilih sebagai tugas".
- Panel **Tugas hari ini** tampil di Beranda.

### 🗒️ Catatan
- Catatan Markdown asli di folder *Catatan Belajar* (bisa diubah di pengaturan).
- Template: **Cornell**, **Ringkasan bab**, **Catatan kuliah**, dan **Jurnal belajar**, plus tombol **Jurnal hari ini**.
- Editor di dalam tab: simpan otomatis, bilah format (tebal, judul, daftar, checklist, sorot, tautan), dan pratinjau.
- Warna seperti kertas tempel, **sematkan**, tautan ke materi, dan hitungan kata/waktu baca/checklist.
- **→ Kartu**: jadikan teks terpilih flashcard. **→ Tugas**: jadikan baris atau teks terpilih tugas (tanggal & jam dikenali).

### 📅 Kalender
- Tampilan **Bulan** dan **Minggu**, dengan filter Tugas, Ujian, Ulasan, Belajar, Pomodoro, dan Catatan.
- **Agenda harian**: centang tugas, tambah tugas untuk tanggal itu, lihat ujian, jadwal ulasan per materi, statistik belajar, dan catatan yang dibuat hari itu.
- Ringkasan **7 hari ke depan** (ulasan, tugas, ujian).

## Baru di 5.0
| Fitur | Cara pakai |
|---|---|
| 📝 **Simulasi ujian: pilih materi** | Saat membuka Simulasi, centang materi atau folder yang ingin diujikan. |
| 🍅 **Ruang Fokus** | Menu kiri → *Ruang Fokus*, atau klik timer di bawah menu. Ada preset (25/5, 50/10, 15/3, 90/15), istirahat panjang setiap 4 sesi, mulai otomatis, label tugas, hitungan 🍅 harian, dan +5 koin per sesi. Musik latar tersedia: Lo-fi 8-bit, Chiptune, Hujan, Derau coklat/putih. Semua dibuat langsung oleh plugin, jadi tetap berjalan tanpa internet. |
| 🔊 **Efek suara** | Bunyi 8-bit untuk jawaban benar/salah, membalik kartu, prestasi, naik level, boss, dan bel Pomodoro. Atur di Ruang Fokus atau Pengaturan → Tampilan. |
| 👾 **Boss Battle** | Arena → *Boss mingguan*. Monster pixel menjaga materi terlemahmu: jawaban benar menyerang (3 beruntun = kritis), jawaban salah mengurangi ❤️. Kemenangan pertama tiap minggu memberi 100 koin. |
| 🗺️ **Petualangan** | Materi tampil sebagai level di peta dunia (satu folder = satu dunia). Level berikutnya terbuka setelah ≥ 80% kartu dikuasai (interval ≥ 3 hari). Setiap dunia diakhiri boss. Ada juga *Mode bebas*. |
| ⏱️ **Aku punya X menit** | Pilih 5–30 menit. Kartu yang paling berisiko terlupa didahulukan, lalu kartu baru, dan sesi berhenti otomatis saat waktu habis. |
| ⚖️ **Bedakan yang Mirip** | Pasangan kartu yang sering tertukar (dicatat dari kuis, Cocokkan, dan Kilat) atau yang teksnya mirip. Tebak "jawaban ini milik kartu A atau B?", lalu lihat kata pembedanya disorot. |
| 📊 **Kartu dari tabel** | Klik kanan di dalam tabel Markdown → *Kartu dari tabel*. Pilih kolom pertanyaan dan jawaban; setiap baris menjadi kartu. Catatan tidak diubah. |
| 🧠 **Kuis tertanam** | Tulis blok ` ```flashcard-kuis ` di catatan mana pun (lihat contoh di bawah). Saat dibaca, blok itu tampil sebagai kuis interaktif. |
| ✍️ **Tulis tangan** | Mode belajar *Tulis tangan*: tulis atau gambar jawaban (mouse, jari, atau stylus dengan tekanan), lalu bandingkan berdampingan dengan jawaban asli. |
| 🖨️ **Lembar latihan** | Halaman Belajar → *Lembar latihan*. Pilih materi dan jumlah soal isian, pilihan ganda, dan menjodohkan. Hasilnya berupa catatan dengan kunci jawaban di halaman terpisah; ekspor lewat ⋯ → *Export to PDF*. |
| 🏁 **Lawan dirimu kemarin** | Balapan 12 soal melawan "hantu" dari balapan sebelumnya. Ada juga ⚔️ **Duel 2 pemain** yang bergantian di satu perangkat. |

Contoh kuis tertanam:

````markdown
```flashcard-kuis
jumlah: 5
materi: [[01 Sel]], [[02 Fotosintesis]]
```

```flashcard-kuis
Ibu kota Jepang :: Tokyo
Ibu kota Prancis :: Paris
Ibu kota Mesir :: Kairo
```
````
Tanpa `materi:` maupun kartu di dalam blok, kuis memakai kartu dari catatan itu sendiri.

## Tampilan Retro Pixel
Tab Flashcard memakai gaya **piksel retro** secara bawaan:
- **Retro Web**: ala situs 90-an. Latar krem bergaris kisi, menu navy, judul pixel oranye, dan jendela berbilah judul ungu.
- **Retro Konsol**: ala panel game klasik, dengan warna hijau sage, bilah judul merah karat, dan tombol oranye.
- **Lounge Gamer**: ala dasbor game modern. Panel marun gelap dengan aksen koral dan emas, rel ikon ramping di kiri, kartu hero bergradasi, tombol berbentuk pil yang bercahaya, dan bingkai aplikasi di atas latar merah muda.
- **Modern**: mengikuti tema Obsidian kamu.

Ganti gaya lewat tombol **Gaya** di bagian bawah menu kiri (sekali klik untuk berpindah), atau di Pengaturan → Tampilan. Isi kartu tetap memakai font catatanmu agar mudah dibaca.

Font yang dibenamkan: *Press Start 2P* (CodeMan38), *VT323* (Peter Hull), *Poppins* (Indian Type Foundry), dan *Amiri Quran* (Khaled Hosny), semuanya berlisensi SIL Open Font License 1.1.

## Algoritma FSRS
Penjadwalan kini memakai **FSRS-4.5** (Free Spaced Repetition Scheduler), algoritma modern yang juga dipakai Anki versi baru. FSRS memodelkan dua hal untuk setiap kartu:
- **Stabilitas**: berapa lama ingatan bertahan.
- **Kesulitan**: seberapa sulit kartu itu bagimu.

Dengan begitu, kartu dijadwalkan tepat saat peluang ingatmu turun ke target (bawaan 90%). Hasilnya, ulasan lebih sedikit untuk tingkat ingatan yang sama.

Progres lama dari SM-2 otomatis diubah dengan menghitung ulang seluruh riwayat ulasan. Di Pengaturan kamu bisa memilih target ingatan (80–95%) atau kembali ke SM-2.

## Mode belajar baru
| Mode | Cara pakai |
|---|---|
| 🗣️ **Jelaskan (Feynman)** | Pilih mode *Jelaskan* di halaman Belajar. Tulis penjelasan dengan kata-katamu sendiri, lalu tekan Ctrl+Enter. Kata kunci di jawaban disorot hijau (sudah disebut) atau oranye (terlewat), dan nilai disarankan otomatis. Penjelasanmu bisa disimpan sebagai mnemonik. |
| 🏛️ **Istana Ingatan** | Pilih denah Rumah/Kelas atau foto tempatmu sendiri. Klik untuk menaruh titik, lalu isi dengan kartu (bisa otomatis dari satu materi). Pilih *Jelajahi* untuk "berjalan" menyusuri rute dan mengingat isi setiap tempat. Matikan "Tampilkan pertanyaan" untuk latihan yang lebih sulit. |
| 📝 **Simulasi Ujian** | Soal pilihan ganda campuran dengan waktu terbatas, navigasi nomor soal, dan tombol "ragu-ragu" (R). Tanpa umpan balik sampai diserahkan. Hasilnya: nilai A–E, rincian per materi, pembahasan soal yang salah, dan **perkiraan nilai ujian** (dari panel Ujian, memakai perkiraan ingatan di hari ujian). |
| 🔗 **Rantai Hafalan** | Untuk teks panjang seperti ayat, pasal, puisi, atau definisi. Tiap kalimat melewati tiga tahap: baca → tulis dengan bantuan huruf awal → tulis tanpa bantuan bersama kalimat sebelumnya. Diakhiri dengan menulis seluruh teks. Bisa juga dimulai dari blok teks di editor: klik kanan → FLASHCARDS → *Rantai Hafalan*. |
| 🎧 **Mode Dengar** | Kartu dibacakan otomatis: pertanyaan → jeda berpikir (3–12 detik) → jawaban. Kecepatan bisa diatur, dan kartu bisa ditandai "Sulit" untuk dilatih nanti. |
| 🧭 **Peta Pikiran** | Kartu satu materi disusun otomatis menurut heading. Warna cabang menunjukkan kekuatan ingatan. Klik cabang untuk belajar topik itu. |
| 🔁 **Variasi otomatis** | Tekan V saat belajar, atau ikon variasi di Materi. Satu kartu menghasilkan kebalikan, cloze, dan pilihan ganda. Variasi dari kartu yang sama tidak muncul di sesi yang sama ("kubur saudara"). |

## Motivasi
- 🎯 **Misi harian & mingguan**: 3 misi harian dan 2 misi mingguan yang berganti otomatis (misalnya "Raih combo 10" atau "Jelaskan 3 konsep"). Klaim hadiah koinnya di Beranda atau Arena.
- 🥚 **Teman belajar**: maskot yang berevolusi sesuai levelmu (🥚 → 🐣 → 🐥 → 🐦 → 🦉 → 🦚) dan suasana hatinya mengikuti kebiasaan belajarmu. Klik namanya untuk mengganti nama.
- 📊 **Laporan mingguan**: rangkuman bergaya "Wrapped" (ulasan, akurasi, waktu, materi favorit, yang paling berkembang, target minggu depan) yang bisa disimpan sebagai catatan di vault.

## Ujian per materi
Beranda → panel **🎓 Ujian** → **+ Ujian**. Isi nama dan tanggal, lalu centang materi atau folder yang diujikan. Kamu bisa membuat beberapa ujian sekaligus.

Target harian dihitung otomatis: **sisa kartu baru ÷ sisa hari**, ditambah kartu yang jatuh tempo. Tombol **Belajar target** memakai kuota ujian ini walaupun batas kartu baru harian sudah habis, sehingga semua materi selesai tepat waktu. Tanggal ujian juga tampil di Kalender.

## Checklist kartu multi-baris
Setelah jawaban kartu **Multi Line** atau **List** dibuka, setiap baris atau item tampil sebagai checklist. Centang yang sudah hafal (angka 1–9, **A** = semua), lalu tekan **Enter**.
- Semua hafal → nilai *Baik*.
- Sebagian hafal → nilai *Sulit*, dan kartu diulang lagi di sesi yang sama.
- Sedikit yang hafal → nilai *Lagi*.

Bagian yang belum hafal ditandai oranye saat kartu muncul lagi. Fitur ini bisa dimatikan di pengaturan.

## Arena: minigame & koin
- 🧩 **Cocokkan**: 3 ronde × 5 pasangan dalam dua kolom (keyboard 1–5 & A–E). Kartu yang sempat tertukar bisa langsung dilatih.
- ⚡ **Kilat**: 60 detik menebak benar/salah (← / →). 5 jawaban benar beruntun = poin ganda.
- 🔢 **Susun Urutan**: susun item kartu List sesuai urutan yang benar.

**Koin 🪙** didapat dari setiap kartu yang dinilai (+1, atau +2 bila benar), sesi sempurna (+10), dan minigame. Koin bisa ditukar dengan **tema kartu** di toko Arena: Sakura, Samudra, Hutan, Senja, Galaksi, dan Emas.

## Wawasan
| Fitur | Isi |
|---|---|
| **Kalender** | Aktivitas harian, perkiraan ulasan per hari, jadwal ujian, detail per tanggal, dan rencana 7 hari |
| **Kelemahan** | Topik lemah (per materi & heading), deteksi kartu lemah beserta alasannya, tipe kartu tersulit, dan latihan terfokus |
| **Peta pengetahuan** | Graf materi dari tautan `[[…]]`, berwarna menurut ingatan/penguasaan. Bisa belajar satu materi beserta materi terkaitnya secara selang-seling |
| **Analitik** | Tren 30 hari, kematangan kartu, **pelacak kurva lupa** (prediksi vs kenyataan), jam belajar terbaik, riwayat **tes retensi** |

## Mode latihan
- **Selang-seling (interleaved)**: kartu dari materi berbeda diambil bergantian. Bisa dari Beranda, opsi di halaman Belajar, atau urutan bawaan di pengaturan.
- **Ulasan acak**: 20 kartu acak dari yang sudah pernah dipelajari.
- **Tes retensi jangka panjang**: kartu lama (interval ≥ 7 hari) yang paling lama tidak diulas, diuji tanpa mengubah jadwal. Skornya dicatat, dan kartu yang terlupa bisa dijadwalkan ulang.
- **Peringatan ingatan memudar**: maksimal sekali sehari, muncul bila perkiraan ingatan sebuah materi di bawah 80% (bisa diatur) atau ada ≥ 10 kartu terlambat. Daftarnya juga tampil di Beranda.

## Batas harian & melanjutkan sesi

Secara bawaan, plugin memperkenalkan **20 kartu baru per hari** (bisa diubah di pengaturan) supaya ulasan besok tidak menumpuk. Saat batas itu tercapai, halaman Belajar menjelaskan alasannya dan menawarkan:
- **+10 / +25 kartu** atau **Lanjutkan semua**. Ini tambahan khusus hari ini dan tidak mengubah pengaturan.
- **Ubah batas harian** secara permanen langsung dari halaman itu.
- **Cram** atau **Kuis** untuk mengulang tanpa memengaruhi jadwal.

Ringkasan sesi juga menampilkan tombol **Lanjut** bila masih ada kartu di materi itu. Halaman Belajar menunjukkan jatah kartu baru hari ini, dan Beranda memberi tahu bila ada kartu yang tertahan.

**Progres selalu tersimpan:**
- Setiap nilai langsung tercatat.
- Posisi sesi yang belum selesai juga disimpan. Kalau Obsidian ditutup di tengah sesi, Beranda menampilkan *"Sesi … belum selesai · tersisa N kartu"* dengan tombol **Lanjutkan** (berlaku hingga 20 jam).

## Urutan & jadwal

Materi diurutkan berdasarkan nama file secara natural (`Bab 2` sebelum `Bab 10`), dan kartu mengikuti urutan kemunculannya di catatan. Jadwal ulang memakai SM-2 dengan model lupa `R(t) = 0.9^(t / interval)`, sehingga kartu muncul lagi tepat saat peluang ingatmu turun ke ±90%.

## Mengembangkan

```bash
npm install
npm run dev     # build otomatis
npm run build   # build produksi
```
