/**
 * Pemeriksaan fisik per sistem. Urutan & interpretasi disusun ulang dengan bahasa sendiri mengikuti struktur
 * Macleod's Clinical Examination 15th ed. (2024); tingkat keterampilan merujuk Lampiran 3 SKDI 2019.
 */
export interface PfStep { t: string; how?: string }
export interface PfSection { title: string; steps: PfStep[]; abn?: [string, string][] }
export interface PfModule { id: string; name: string; icon: string; color: string; skdi: string; src: string; intro: string; prep: string[]; sections: PfSection[]; pearls?: string[] }

const PREP = ["Perkenalkan diri, konfirmasi identitas pasien, jelaskan tujuan & minta izin (informed consent lisan).", "Cuci tangan (6 langkah WHO) sebelum dan sesudah memeriksa.", "Tawarkan pendamping (chaperone) untuk pemeriksaan area sensitif.", "Jaga privasi, posisi & pencahayaan yang baik; buka area yang diperiksa secukupnya.", "Tanyakan apakah ada nyeri sebelum menyentuh."];

export const PF: PfModule[] = [
	{
		id: "umum", name: "Pemeriksaan umum & tanda vital", icon: "🩺", color: "#0d9488", skdi: "lain", src: "Macleod 15th ed. Bab 3 (General examination) & Bab 4 (tekanan darah, nadi)",
		intro: "Dilakukan pada setiap pasien sebagai pembuka: kesan umum, kesadaran, tanda vital, status gizi, dan tanda-tanda umum penyakit sistemik.",
		prep: PREP,
		sections: [
			{ title: "Kesan umum", steps: [
				{ t: "Amati dari ujung tempat tidur: tampak sakit ringan/sedang/berat, gelisah, sesak, nyeri, postur, gerakan abnormal." },
				{ t: "Kesadaran kualitatif (kompos mentis, apatis, somnolen, sopor, koma) dan kuantitatif dengan GCS (E4 V5 M6)." },
				{ t: "Perhatikan perawakan, habitus, bau napas (keton, uremik, alkohol), alat bantu (oksigen, infus, kateter)." },
			], abn: [["GCS ≤ 8", "Lindungi jalan napas; pertimbangkan intubasi/rujuk segera"], ["Bau aseton", "Ketoasidosis (DM, kelaparan)"], ["Fetor hepatikus", "Gagal hati"]] },
			{ title: "Tanda vital", steps: [
				{ t: "Tekanan darah", how: "Pasien duduk tenang ≥ 5 menit, lengan setinggi jantung, manset menutup 80% lingkar lengan. Raba a. brakialis, pompa 20–30 mmHg di atas hilangnya nadi, turunkan 2–3 mmHg/detik. Korotkoff I = sistolik, V = diastolik. Ukur kedua lengan pada kunjungan pertama; cek ortostatik bila pusing/jatuh." },
				{ t: "Nadi", how: "Radialis: frekuensi (hitung 30–60 detik bila tidak teratur), irama, isi; karotis/brakialis untuk karakter. Bandingkan kanan-kiri dan radio-femoral." },
				{ t: "Frekuensi napas", how: "Hitung 1 menit tanpa memberi tahu pasien (pura-pura masih meraba nadi); amati pola & penggunaan otot bantu." },
				{ t: "Suhu", how: "Aksila/timpani/oral; catat metode. Demam ≥ 37,8 °C (oral) / ≥ 37,5 °C (aksila)." },
				{ t: "Saturasi oksigen", how: "Oksimeter pada jari hangat tanpa kuteks; catat FiO₂ (udara ruang atau oksigen berapa liter)." },
				{ t: "Nyeri", how: "Skala 0–10 (NRS) atau Wong-Baker untuk anak." },
			], abn: [["TD ≥ 140/90 mmHg (klinik)", "Hipertensi — konfirmasi pengukuran berulang/di rumah"], ["Selisih sistolik antarlengan > 15 mmHg", "Penyakit arteri subklavia, diseksi aorta"], ["Penurunan sistolik ≥ 20 / diastolik ≥ 10 saat berdiri", "Hipotensi ortostatik (hipovolemia, obat, neuropati otonom)"], ["Nadi tidak teratur total", "Fibrilasi atrial"], ["Napas > 20×/menit (dewasa)", "Takipnea: pneumonia, asidosis, emboli, ansietas"], ["SpO₂ < 94% (udara ruang)", "Hipoksemia — beri oksigen, cari penyebab"]] },
			{ title: "Antropometri & status gizi", steps: [
				{ t: "Berat & tinggi badan → IMT (Asia: normal 18,5–22,9; overweight 23–24,9; obesitas ≥ 25 kg/m²)." },
				{ t: "Lingkar pinggang (obesitas sentral Asia: pria ≥ 90 cm, wanita ≥ 80 cm)." },
				{ t: "Anak: plot BB/TB/LK di kurva WHO; LILA untuk malnutrisi." },
			] },
			{ title: "Tangan, kepala & kulit (tanda umum)", steps: [
				{ t: "Tangan: suhu, CRT (normal ≤ 2 detik), jari tabuh, koilonikia, leukonikia, eritema palmaris, asteriksis, tremor." },
				{ t: "Konjungtiva (anemia), sklera (ikterus), bibir & lidah (sianosis sentral, dehidrasi)." },
				{ t: "Kelenjar getah bening: submental, submandibula, servikal, supraklavikula, aksila, inguinal — ukuran, konsistensi, nyeri, perlekatan." },
				{ t: "Edema: tekan ≥ 5 detik di atas tibia/maleolus (atau sakrum bila berbaring)." },
			], abn: [["Jari tabuh", "Kanker paru, bronkiektasis, empiema, endokarditis, sirosis, PJB sianotik"], ["Koilonikia", "Defisiensi besi"], ["KGB supraklavikula kiri keras (Virchow)", "Keganasan abdomen"], ["Edema pitting bilateral", "Gagal jantung, ginjal (sindrom nefrotik), hati, obat (amlodipin)"]] },
		],
		pearls: ["Tanda vital adalah 'pemeriksaan fisik' paling bernilai — selalu ulangi bila pasien memburuk.", "Dokumentasikan sistematis: KU, kesadaran/GCS, TD, N, RR, S, SpO₂, nyeri, BB/TB/IMT."],
	},
	{
		id: "kardio", name: "Kardiovaskular", icon: "🫀", color: "#e11d48", skdi: "kardio", src: "Macleod 15th ed. Bab 4 — The cardiovascular system",
		intro: "Posisi setengah duduk 45°, dada terbuka. Urutan: umum → tangan → nadi → TD → wajah → leher (JVP, karotis) → prekordium (inspeksi, palpasi, perkusi, auskultasi) → paru basal → edema & nadi perifer.",
		prep: PREP,
		sections: [
			{ title: "Perifer", steps: [
				{ t: "Tangan: suhu, CRT, sianosis perifer, jari tabuh, splinter hemorrhage, nodus Osler, lesi Janeway, xantoma tendon." },
				{ t: "Nadi radialis: frekuensi & irama; cek collapsing pulse (angkat lengan); bandingkan radial kanan-kiri dan radio-femoral." },
				{ t: "Nadi karotis (satu sisi): isi & karakter (slow-rising, bisferiens, kolaps)." },
				{ t: "Wajah: sianosis sentral, xantelasma, arkus kornea, fasies mitral; funduskopi (retinopati hipertensi/diabetik, Roth spot)." },
			], abn: [["Collapsing pulse", "Regurgitasi aorta, PDA, keadaan hiperdinamik"], ["Slow-rising pulse", "Stenosis aorta"], ["Pulsus paradoksus > 10 mmHg", "Tamponade, asma berat"], ["Radio-femoral delay", "Koarktasio aorta"]] },
			{ title: "Tekanan vena jugularis (JVP)", steps: [
				{ t: "Pasien 45°, kepala sedikit menoleh ke kiri, otot leher rileks." },
				{ t: "Cari pulsasi v. jugularis interna di antara dua kepala m. sternokleidomastoideus: bergelombang ganda, tidak teraba, tertekan dengan tekanan ringan, berubah dengan posisi & respirasi." },
				{ t: "Ukur tinggi vertikal puncak pulsasi dari angulus sterni (normal ≤ 3 cm ≈ JVP 5+3 cmH₂O). Tes hepatojugular: tekan kuadran kanan atas 10 detik." },
			], abn: [["JVP meningkat", "Gagal jantung kanan, kelebihan cairan, tamponade, emboli paru, perikarditis konstriktif"], ["Kussmaul (JVP naik saat inspirasi)", "Perikarditis konstriktif, tamponade, infark RV"], ["Gelombang v besar", "Regurgitasi trikuspid"]] },
			{ title: "Prekordium", steps: [
				{ t: "Inspeksi: bentuk dada, bekas operasi (sternotomi, torakotomi), pulsasi apeks yang tampak, pacu jantung." },
				{ t: "Palpasi apeks: normal di ruang interkosta V linea midklavikula kiri, luas ≤ 1 ruang. Nilai karakter (tapping, heaving, thrusting)." },
				{ t: "Palpasi parasternal kiri (heave RV) dan thrill di semua area katup." },
				{ t: "Perkusi batas jantung (relatif; kurang bernilai dibanding apeks/ rontgen)." },
				{ t: "Auskultasi dengan diafragma lalu bel di 4 area: apeks (mitral), sela iga IV parasternal kiri (trikuspid), sela iga II kiri (pulmonal), sela iga II kanan (aorta) — sambil meraba karotis untuk menentukan sistol." },
				{ t: "Manuver: miring kiri + bel di apeks (stenosis mitral); duduk condong ke depan + ekspirasi tahan (regurgitasi aorta); dengarkan penjalaran ke karotis dan aksila." },
				{ t: "Deskripsikan bising: waktu (sistolik/diastolik), lokasi terkeras, penjalaran, derajat (Levine 1–6), nada, pengaruh respirasi." },
			], abn: [["Apeks bergeser ke lateral/bawah", "Dilatasi ventrikel kiri (kardiomegali)"], ["S3 (gallop)", "Gagal jantung (normal pada usia muda/hamil)"], ["S4", "Ventrikel kaku: hipertensi, stenosis aorta, iskemia"], ["Pansistolik di apeks → aksila", "Regurgitasi mitral"], ["Ejeksi sistolik sela iga II kanan → karotis", "Stenosis aorta"], ["Mid-diastolik rumbling di apeks", "Stenosis mitral"], ["Early diastolik decrescendo parasternal kiri", "Regurgitasi aorta"], ["Pericardial friction rub", "Perikarditis"]] },
			{ title: "Penyelesaian", steps: [
				{ t: "Auskultasi basal paru (ronki/krepitasi), perkusi efusi pleura." },
				{ t: "Edema sakral & tungkai; palpasi hepar (hepatomegali kongestif)." },
				{ t: "Nadi perifer: femoral, poplitea, tibialis posterior, dorsalis pedis; auskultasi bruit karotis/femoral/abdominal; ABI bila curiga PAD." },
				{ t: "Usulkan: EKG 12 sadapan, rontgen toraks, urinalisis (hematuria pada endokarditis), funduskopi." },
			] },
		],
		pearls: ["Hubungkan bising dengan karotis untuk menentukan sistol/diastol.", "Bising diastolik selalu patologis — rujuk ekokardiografi."],
	},
	{
		id: "respirasi", name: "Respirasi", icon: "🫁", color: "#0ea5e9", skdi: "respirasi", src: "Macleod 15th ed. Bab 5 — The respiratory system",
		intro: "Pasien duduk 45° (lalu duduk tegak untuk dada belakang). Urutan: umum → tangan → wajah → leher (trakea, KGB) → dada depan → dada belakang (inspeksi, palpasi, perkusi, auskultasi).",
		prep: PREP,
		sections: [
			{ title: "Umum & perifer", steps: [
				{ t: "Frekuensi & pola napas, penggunaan otot bantu napas, pursed-lip breathing, retraksi (anak), kemampuan bicara dalam kalimat." },
				{ t: "Tangan: jari tabuh, sianosis, noda nikotin, flapping tremor (retensi CO₂), tremor halus (agonis β2)." },
				{ t: "Wajah: sianosis sentral, sindrom Horner (tumor apeks), plethora (polisitemia)." },
				{ t: "Leher: posisi trakea (jari di takik suprasternal), jarak krikoid–sternum (< 3 jari = hiperinflasi), KGB servikal & supraklavikula, JVP." },
			], abn: [["Tidak mampu bicara satu kalimat", "Distres napas berat (asma berat, PPOK eksaserbasi)"], ["Trakea bergeser menjauhi sisi lesi", "Pneumotoraks tension, efusi masif"], ["Trakea tertarik ke sisi lesi", "Kolaps lobus, fibrosis"]] },
			{ title: "Dada (depan & belakang)", steps: [
				{ t: "Inspeksi: bentuk (barrel chest, pektus), simetri gerak, bekas luka, bendungan vena." },
				{ t: "Palpasi ekspansi: ibu jari bertemu di garis tengah, jari melingkari dada; bandingkan saat inspirasi dalam (atas & bawah)." },
				{ t: "Fremitus taktil/vokal: sisi ulnar tangan, pasien mengucapkan 'tujuh puluh tujuh'; bandingkan kanan-kiri." },
				{ t: "Perkusi: bandingkan simetris dari apeks/supraklavikula ke basal, termasuk aksila; normal sonor; tentukan batas paru-hepar & peranjakan diafragma." },
				{ t: "Auskultasi dengan diafragma, pasien bernapas lewat mulut: kualitas suara napas (vesikular/bronkial), suara tambahan (ronki/krepitasi, mengi, friction rub), vocal resonance." },
			], abn: [["Perkusi redup + suara napas bronkial + fremitus meningkat", "Konsolidasi (pneumonia)"], ["Perkusi redup 'batu' + suara napas & fremitus menurun", "Efusi pleura"], ["Hipersonor + suara napas menghilang + fremitus menurun", "Pneumotoraks"], ["Hipersonor difus + ekspirasi memanjang + mengi", "PPOK/emfisema, asma"], ["Krepitasi halus akhir inspirasi bilateral basal", "Fibrosis paru, edema paru"], ["Krepitasi kasar yang berubah dengan batuk", "Bronkiektasis, sekret"], ["Stridor inspirasi", "Obstruksi jalan napas atas — darurat"]] },
			{ title: "Penyelesaian", steps: [
				{ t: "Periksa edema tungkai & tanda gagal jantung kanan (kor pulmonal)." },
				{ t: "Usulkan: SpO₂, peak flow/spirometri, rontgen toraks, sputum BTA/TCM, analisis gas darah bila berat." },
			] },
		],
		pearls: ["Selalu bandingkan sisi kanan dengan kiri pada titik yang sama.", "Perkusi aksila sering terlupa — pneumonia lobus tengah/lingula dapat terlewat."],
	},
	{
		id: "abdomen", name: "Abdomen (gastrointestinal)", icon: "🫃", color: "#84cc16", skdi: "gi", src: "Macleod 15th ed. Bab 6 — The gastrointestinal system",
		intro: "Pasien berbaring datar, satu bantal, lengan di samping, abdomen terbuka dari prosesus xifoideus hingga simfisis. Urutan pada abdomen: inspeksi → auskultasi (dianjurkan sebelum palpasi di Indonesia) → perkusi → palpasi; Macleod menempatkan auskultasi setelah palpasi — yang penting konsisten.",
		prep: PREP,
		sections: [
			{ title: "Umum & perifer", steps: [
				{ t: "Tangan: asteriksis, eritema palmaris, leukonikia, kontraktur Dupuytren, jari tabuh." },
				{ t: "Mata: ikterus sklera, anemia; mulut: stomatitis angularis, lidah (glositis), ulkus." },
				{ t: "Dada: spider naevi (> 5 bermakna), ginekomastia; KGB supraklavikula kiri (Virchow)." },
			] },
			{ title: "Abdomen", steps: [
				{ t: "Inspeksi: bentuk (datar/cembung/skafoid), distensi, bekas luka, stoma, pelebaran vena (kaput medusa), striae, gerak peristaltik, hernia (minta pasien batuk)." },
				{ t: "Auskultasi bising usus ≥ 1 menit (normal 5–35×/menit); bruit aorta/renal; succussion splash." },
				{ t: "Perkusi 9 regio; batas hepar (normal 6–12 cm di linea midklavikula kanan); traube space (splenomegali); shifting dullness & undulasi untuk asites." },
				{ t: "Palpasi ringan 9 regio dimulai dari area yang tidak nyeri sambil melihat wajah pasien (nyeri tekan, defans muskular), lalu palpasi dalam (massa)." },
				{ t: "Hepar: dari fossa iliaka kanan ke atas, ujung jari sejajar arkus costae, pasien tarik napas dalam; deskripsikan jarak di bawah arkus, tepi, permukaan, konsistensi, nyeri." },
				{ t: "Lien: dari fossa iliaka kanan diagonal ke kiri atas (Schuffner I–VIII); miringkan pasien ke kanan bila belum teraba." },
				{ t: "Ginjal: ballottement bimanual; nyeri ketok sudut kostovertebra." },
				{ t: "Tanda khusus sesuai indikasi: McBurney, Rovsing, psoas, obturator (apendisitis); Murphy (kolesistitis); nyeri lepas; pemeriksaan hernia; colok dubur (dengan pendamping)." },
			], abn: [["Defans muskular + nyeri lepas", "Peritonitis — rujuk bedah segera"], ["Nyeri tekan titik McBurney + Rovsing/psoas positif", "Apendisitis akut"], ["Murphy sign positif", "Kolesistitis akut"], ["Shifting dullness", "Asites (≥ 500 mL)"], ["Bising usus metalik/meningkat + distensi", "Obstruksi usus mekanik"], ["Bising usus hilang", "Ileus paralitik, peritonitis"], ["Hepatomegali nyeri", "Hepatitis, bendungan (gagal jantung), abses hati"]] },
			{ title: "Penyelesaian", steps: [
				{ t: "Periksa genitalia eksterna & orifisium hernia; colok dubur bila ada indikasi (perdarahan, nyeri perut bawah, prostat)." },
				{ t: "Usulkan: urinalisis, darah lengkap, fungsi hati, lipase, USG abdomen sesuai temuan." },
			] },
		],
		pearls: ["Mulai palpasi jauh dari area nyeri dan lihat wajah pasien, bukan tangan Anda.", "Ikterus lebih mudah terlihat di sklera dengan cahaya alami."],
	},
	{
		id: "neuro", name: "Neurologi", icon: "🧠", color: "#6366f1", skdi: "saraf", src: "Macleod 15th ed. Bab 7 — The nervous system",
		intro: "Pemeriksaan neurologis lengkap: status mental & GCS → rangsang meningeal → saraf kranial → motorik (inspeksi, tonus, kekuatan, refleks) → sensorik → koordinasi → gait.",
		prep: PREP,
		sections: [
			{ title: "Status mental & meningeal", steps: [
				{ t: "GCS (E/V/M), orientasi (orang, tempat, waktu), atensi (sebut bulan mundur), memori, bahasa (afasia), MMSE/MoCA bila curiga demensia." },
				{ t: "Kaku kuduk (fleksi leher pasif), Brudzinski I–II, Kernig, Laseque (iritasi radiks)." },
			], abn: [["Kaku kuduk + demam + penurunan kesadaran", "Meningitis/ensefalitis — darurat"], ["Laseque < 60° (nyeri menjalar ke tungkai)", "Iritasi radiks lumbosakral (HNP)"]] },
			{ title: "Saraf kranial (N. I–XII)", steps: [
				{ t: "N. I: penghidu tiap lubang hidung (kopi/sabun) bila ada keluhan." },
				{ t: "N. II: tajam penglihatan (Snellen), lapang pandang konfrontasi, refleks cahaya langsung & tidak langsung, funduskopi." },
				{ t: "N. III, IV, VI: kedudukan bola mata, gerak ke 6 arah (pola H), diplopia, nistagmus, ptosis, ukuran pupil." },
				{ t: "N. V: sensasi wajah 3 cabang, otot masseter/temporalis, refleks kornea." },
				{ t: "N. VII: angkat alis, pejamkan mata kuat, kembungkan pipi, tunjukkan gigi; bedakan lesi UMN (dahi tidak terkena) vs LMN (seluruh wajah)." },
				{ t: "N. VIII: gesekan jari/bisik; tes Rinne & Weber (garpu tala 512 Hz); Dix-Hallpike & head impulse untuk vertigo." },
				{ t: "N. IX, X: suara, uvula di tengah saat 'aaa', refleks muntah." },
				{ t: "N. XI: angkat bahu & menoleh melawan tahanan. N. XII: lidah di tengah saat dijulurkan, atrofi/fasikulasi." },
			], abn: [["Paresis wajah seluruh sisi (dahi ikut)", "Lesi N. VII perifer (Bell's palsy)"], ["Paresis wajah bawah saja", "Lesi UMN (stroke)"], ["Weber lateralisasi ke telinga sakit + Rinne negatif", "Tuli konduktif"], ["Dix-Hallpike: nistagmus rotatoar dengan laten, berkurang (fatigue)", "BPPV kanal posterior"]] },
			{ title: "Motorik & refleks", steps: [
				{ t: "Inspeksi: atrofi, fasikulasi, postur, gerakan involunter; tes pronator drift." },
				{ t: "Tonus: gerak pasif sendi (spastik 'clasp-knife', rigid 'lead-pipe/cogwheel', flaksid)." },
				{ t: "Kekuatan skala MRC 0–5 per kelompok otot (bahu, siku, pergelangan, jari, panggul, lutut, pergelangan kaki)." },
				{ t: "Refleks fisiologis: biseps (C5–6), triseps (C7), brakioradialis (C6), patela (L3–4), Achilles (S1); skala 0–4+." },
				{ t: "Refleks patologis: Babinski & variannya, Hoffmann; klonus pergelangan kaki." },
			], abn: [["Spastik + hiperrefleks + Babinski", "Lesi UMN (stroke, mielopati)"], ["Atrofi + fasikulasi + hiporefleks", "Lesi LMN (neuropati, kornu anterior)"], ["Rigiditas cogwheel + bradikinesia + tremor istirahat", "Parkinsonisme"]] },
			{ title: "Sensorik, koordinasi & gait", steps: [
				{ t: "Sensorik: raba halus, nyeri (jarum), suhu, getar (garpu tala 128 Hz di sendi distal), posisi sendi; petakan dermatom/stocking-glove." },
				{ t: "Koordinasi: finger-nose, heel-shin, gerakan bergantian cepat (disdiadokokinesia)." },
				{ t: "Romberg (stabil dengan mata terbuka, jatuh saat tertutup = ataksia sensorik); tandem gait; observasi gaya berjalan." },
			], abn: [["Hilang rasa stocking-glove", "Polineuropati (DM, defisiensi B12, alkohol)"], ["Dismetria & intention tremor", "Lesi serebelum"], ["Romberg positif", "Gangguan proprioseptif (kolumna dorsalis, neuropati)"]] },
		],
		pearls: ["Tentukan dulu: lesi UMN atau LMN, lalu lokasinya (otak, batang otak, medula, radiks, saraf, otot).", "Pada stroke akut catat waktu onset terakhir normal — penentu terapi reperfusi."],
	},
	{
		id: "muskulo", name: "Muskuloskeletal (GALS & sendi)", icon: "🦴", color: "#a16207", skdi: "muskulo", src: "Macleod 15th ed. Bab 13 — The musculoskeletal system",
		intro: "Skrining GALS (Gait, Arms, Legs, Spine), lalu pemeriksaan regional sendi yang bermasalah dengan prinsip Look–Feel–Move (+ tes khusus & fungsi).",
		prep: PREP,
		sections: [
			{ title: "Skrining GALS", steps: [
				{ t: "Tiga pertanyaan: nyeri/kaku pada otot, sendi, punggung? Kesulitan berpakaian? Kesulitan naik-turun tangga?" },
				{ t: "Gait: simetri, kelancaran, ayunan lengan, berputar." },
				{ t: "Arms: tangan di belakang kepala, lengan lurus ke depan, pronasi-supinasi, kepalan & oposisi jari, remas MCP (squeeze test)." },
				{ t: "Legs: fleksi lutut-panggul, rotasi internal panggul, palpasi efusi lutut, remas MTP." },
				{ t: "Spine: inspeksi dari belakang & samping, fleksi lateral leher, sentuh jari kaki (Schober), palpasi supraspinatus (fibromialgia)." },
			] },
			{ title: "Regional (Look–Feel–Move)", steps: [
				{ t: "Look: bengkak, kemerahan, deformitas, atrofi otot, bekas luka, nodul (tofus, nodul reumatoid)." },
				{ t: "Feel: suhu, nyeri tekan garis sendi, efusi (patellar tap, bulge test), krepitasi." },
				{ t: "Move: lingkup gerak aktif lalu pasif; catat derajat dan nyeri." },
				{ t: "Tes khusus: lutut (drawer, Lachman, McMurray), bahu (empty can, Hawkins), tangan (Phalen, Tinel), punggung (Laseque/SLR)." },
			], abn: [["Monoartritis akut merah-panas di MTP I", "Artritis gout — singkirkan artritis septik"], ["Poliartritis simetris sendi kecil tangan + kaku pagi > 1 jam", "Artritis reumatoid"], ["Krepitasi + nyeri saat beban, kaku pagi < 30 menit", "Osteoartritis"], ["Phalen/Tinel positif", "Carpal tunnel syndrome"]] },
		],
		pearls: ["Sendi merah-panas-bengkak tunggal = artritis septik sampai terbukti lain (aspirasi bila memungkinkan)."],
	},
	{
		id: "endokrin", name: "Tiroid & endokrin", icon: "🦋", color: "#c026d3", skdi: "endokrin", src: "Macleod 15th ed. Bab 10 — The endocrine system",
		intro: "Pemeriksaan tiroid & status tiroid, serta tanda penyakit endokrin lain (Cushing, akromegali, diabetes: kaki diabetik).",
		prep: PREP,
		sections: [
			{ title: "Kelenjar tiroid", steps: [
				{ t: "Inspeksi leher dari depan dengan leher sedikit ekstensi; minta pasien menelan air (tiroid ikut bergerak) dan menjulurkan lidah (kista duktus tiroglosus ikut naik)." },
				{ t: "Palpasi dari belakang: jari di kedua sisi trakea di bawah kartilago krikoid, raba isthmus & kedua lobus saat menelan; ukuran, konsistensi, nodul, nyeri." },
				{ t: "Perkusi manubrium (retrosternal), auskultasi bruit tiroid, KGB servikal." },
			], abn: [["Bruit tiroid", "Graves (vaskularisasi meningkat)"], ["Nodul soliter keras, terfiksasi + KGB", "Curiga keganasan — rujuk/BAJAH"]] },
			{ title: "Status tiroid", steps: [
				{ t: "Tangan: tremor halus (kertas di atas jari terentang), telapak hangat-lembap, onikolisis; nadi (takikardia/AF vs bradikardia)." },
				{ t: "Mata: eksoftalmus (lihat dari atas), lid lag, lid retraction, oftalmoplegia, kemosis." },
				{ t: "Refleks: relaksasi lambat (hipotiroid); miksedema pretibial (Graves)." },
				{ t: "Indeks Wayne/New Castle untuk hipertiroid klinis." },
			] },
			{ title: "Kaki diabetik", steps: [
				{ t: "Inspeksi kulit, kuku, deformitas (Charcot, hallux valgus), kalus, ulkus, infeksi di sela jari." },
				{ t: "Nadi dorsalis pedis & tibialis posterior; CRT; ABI bila nadi lemah." },
				{ t: "Sensasi: monofilamen 10 g di 10 titik plantar, garpu tala 128 Hz di ibu jari, refleks Achilles." },
			], abn: [["Monofilamen tidak terasa", "Neuropati sensorik — risiko ulkus tinggi"], ["Nadi kaki tidak teraba", "Penyakit arteri perifer"]] },
		],
	},
	{
		id: "kulit", name: "Kulit (dermatologi)", icon: "🧴", color: "#f97316", skdi: "kulit", src: "Macleod 15th ed. Bab 11 — The skin, hair and nails",
		intro: "Periksa seluruh kulit dengan pencahayaan baik, termasuk kulit kepala, kuku, mukosa, sela jari, genital (dengan izin). Deskripsikan efloresensi secara sistematis.",
		prep: PREP,
		sections: [
			{ title: "Deskripsi lesi (status dermatologikus)", steps: [
				{ t: "Lokasi & distribusi: regio, unilateral/bilateral, simetris, generalisata, dermatomal, area terpapar matahari/lipatan." },
				{ t: "Efloresensi primer: makula, papul, plak, nodul, vesikel, bula, pustul, urtika; sekunder: skuama, krusta, erosi, ekskoriasi, ulkus, likenifikasi." },
				{ t: "Ukuran (lentikular, numular, plakat), bentuk, batas (tegas/tidak), warna, susunan (anular, linear, herpetiformis, korimbiformis)." },
				{ t: "Palpasi: konsistensi, nyeri, suhu; diaskopi (blanching); tanda Nikolsky; Auspitz (psoriasis)." },
				{ t: "Pemeriksaan penunjang sederhana: KOH 10–20% (jamur), lampu Wood, Gram (impetigo), kerokan (skabies)." },
			], abn: [["Papul/terowongan di sela jari, gatal malam, anggota keluarga juga gatal", "Skabies"], ["Plak eritematosa berskuama tepi aktif, central healing", "Tinea korporis"], ["Vesikel berkelompok dermatomal unilateral + nyeri", "Herpes zoster"], ["Purpura tidak memucat + demam", "Sepsis meningokokus/dengue berat — darurat"]] },
			{ title: "Rambut, kuku & mukosa", steps: [
				{ t: "Kuku: pitting (psoriasis), onikomikosis, jari tabuh, Beau's lines." },
				{ t: "Rambut: alopesia (pola, sikatrik/non-sikatrik), tinea kapitis." },
				{ t: "Mukosa mulut & mata: erosi (SJS), bercak Koplik (campak), kandidiasis." },
			] },
		],
		pearls: ["Lesi berpigmen: nilai ABCDE (Asimetri, Border, Color, Diameter > 6 mm, Evolving) — curiga melanoma bila positif."],
	},
	{
		id: "mata", name: "Mata", icon: "👁️", color: "#0284c7", skdi: "indra", src: "Macleod 15th ed. Bab 8 — The visual system",
		intro: "Tajam penglihatan selalu diperiksa pertama (dokumen medikolegal). Lalu segmen anterior dengan senter, gerak bola mata, pupil, lapang pandang, funduskopi, tekanan intraokular (digital/tonometri).",
		prep: PREP,
		sections: [
			{ title: "Langkah", steps: [
				{ t: "Visus tiap mata dengan Snellen 6 m (pakai kacamata); bila < 6/6 ulangi dengan pinhole; hitung jari, lambaian tangan, persepsi cahaya." },
				{ t: "Inspeksi palpebra, konjungtiva (injeksi konjungtiva vs siliar), sekret, kornea (fluoresein untuk erosi/ulkus), bilik mata depan (hifema, hipopion), iris, lensa." },
				{ t: "Pupil: ukuran, bentuk, refleks langsung & konsensual, swinging flashlight (RAPD)." },
				{ t: "Gerak bola mata, lapang pandang konfrontasi, funduskopi (refleks fundus, diskus optikus, makula, pembuluh darah)." },
			], abn: [["Mata merah + visus turun + nyeri berat + pupil mid-dilatasi", "Glaukoma akut sudut tertutup — rujuk segera"], ["Mata merah, visus normal, sekret, injeksi konjungtiva", "Konjungtivitis"], ["Injeksi siliar + fotofobia + pupil miosis", "Uveitis anterior / keratitis"], ["Visus membaik dengan pinhole", "Kelainan refraksi"]] },
		],
	},
	{
		id: "tht", name: "Telinga, hidung & tenggorok", icon: "👂", color: "#14b8a6", skdi: "indra", src: "Macleod 15th ed. Bab 9 — The ear, nose and throat",
		intro: "Gunakan lampu kepala/otoskop. Periksa telinga (otoskopi, tes pendengaran), hidung (rinoskopi anterior), mulut & orofaring, leher.",
		prep: PREP,
		sections: [
			{ title: "Langkah", steps: [
				{ t: "Telinga: inspeksi aurikula & retroaurikula; tarik daun telinga ke atas-belakang (dewasa) atau bawah-belakang (anak); otoskopi liang & membran timpani (warna, refleks cahaya, bulging, perforasi)." },
				{ t: "Pendengaran: bisik, Rinne, Weber (garpu tala 512 Hz)." },
				{ t: "Hidung: rinoskopi anterior (mukosa, konka, sekret, septum, polip); nyeri tekan sinus." },
				{ t: "Orofaring: tonsil (ukuran T0–T4, detritus, membran), faring (hiperemis, granula), uvula, gigi, lidah; KGB leher." },
			], abn: [["Membran timpani hiperemis & bulging", "Otitis media akut stadium supurasi"], ["Nyeri tarik aurikula + liang edema", "Otitis eksterna"], ["Tonsil membesar + detritus + demam + tanpa batuk", "Tonsilofaringitis bakterial (skor Centor)"], ["Pseudomembran putih keabuan mudah berdarah", "Difteri — darurat & lapor"], ["Uvula terdorong + trismus + hot potato voice", "Abses peritonsil"]] },
		],
	},
	{
		id: "obstetri", name: "Obstetri (ibu hamil)", icon: "🤰", color: "#ec4899", skdi: "reproduksi", src: "Macleod 15th ed. Bab 12 (The reproductive system) & pedoman ANC Kemenkes",
		intro: "Pemeriksaan antenatal: tanda vital (terutama TD), BB, LILA, edema, tinggi fundus uteri, Leopold, denyut jantung janin; pemeriksaan dalam hanya atas indikasi.",
		prep: PREP,
		sections: [
			{ title: "Langkah", steps: [
				{ t: "TD (preeklamsia bila ≥ 140/90 setelah 20 minggu + proteinuria/gangguan organ), BB, LILA (KEK bila < 23,5 cm), edema, refleks patela (terapi MgSO₄)." },
				{ t: "Tinggi fundus uteri (cm, dari simfisis) ≈ usia kehamilan (minggu) setelah 20–24 minggu." },
				{ t: "Leopold I: bagian janin di fundus; II: punggung janin; III: bagian terbawah; IV: sudah masuk PAP (konvergen/divergen)." },
				{ t: "DJJ dengan Doppler/Laennec (normal 110–160×/menit); hitung 1 menit." },
				{ t: "Pemeriksaan dalam (inpartu): pembukaan, penipisan, ketuban, bagian terbawah & penurunan (Hodge/perlimaan), molase." },
			], abn: [["TD ≥ 160/110 + nyeri kepala/epigastrium/gangguan visus", "Preeklamsia berat — stabilisasi & rujuk"], ["DJJ < 110 atau > 160 menetap", "Gawat janin"], ["TFU tidak sesuai usia kehamilan", "IUGR, oligo/polihidramnion, kehamilan ganda, salah HPHT"]] },
		],
	},
	{
		id: "anak", name: "Anak (pediatrik)", icon: "🧒", color: "#f59e0b", skdi: "lain", src: "Macleod 15th ed. Bab 16 (Babies and children) & MTBS Kemenkes",
		intro: "Sesuaikan urutan dengan kooperasi anak: amati dulu, periksa yang tidak menakutkan lebih dulu (auskultasi saat tenang), tenggorok & telinga terakhir.",
		prep: [...PREP, "Libatkan orang tua; periksa anak di pangkuan bila perlu."],
		sections: [
			{ title: "Penilaian cepat & dehidrasi", steps: [
				{ t: "Tanda bahaya umum (MTBS): tidak bisa minum/menyusu, muntah semua, kejang, letargis/tidak sadar." },
				{ t: "Pertumbuhan: BB, PB/TB, LK, plot kurva WHO; status gizi (BB/TB z-score, LILA)." },
				{ t: "Dehidrasi: keadaan umum (gelisah/letargis), mata cekung, minum (lahap/malas), turgor kulit perut (kembali lambat/sangat lambat > 2 detik)." },
				{ t: "Napas: hitung 1 menit; napas cepat bila ≥ 60 (< 2 bln), ≥ 50 (2–12 bln), ≥ 40 (1–5 th); tarikan dinding dada bawah ke dalam, stridor, wheezing." },
				{ t: "Ubun-ubun besar (cekung/menonjol), kaku kuduk, ruam (petekie), CRT." },
			], abn: [["≥ 2 tanda: letargis, mata cekung, tidak bisa minum, turgor sangat lambat", "Dehidrasi berat — rencana terapi C"], ["≥ 2 tanda: gelisah, mata cekung, haus, turgor lambat", "Dehidrasi ringan–sedang — rencana terapi B (oralit 75 mL/kg dalam 3 jam)"], ["Tarikan dinding dada bawah atau saturasi < 90%", "Pneumonia berat — rujuk"]] },
		],
	},
	{
		id: "gcs", name: "Penurunan kesadaran & GCS", icon: "🚨", color: "#dc2626", skdi: "saraf", src: "Macleod 15th ed. Bab 7 & Bab 17 (The critically ill patient)",
		intro: "Pendekatan ABCDE pada pasien kritis/penurunan kesadaran, lalu penilaian neurologis terarah.",
		prep: ["Pastikan keamanan penolong & pasien.", "Panggil bantuan bila kondisi mengancam nyawa."],
		sections: [
			{ title: "ABCDE", steps: [
				{ t: "A — Airway: bicara? suara tambahan (snoring, gargling, stridor)? benda asing? Lakukan head tilt–chin lift/jaw thrust (trauma), suction, OPA/NPA." },
				{ t: "B — Breathing: RR, SpO₂, gerak dada, perkusi & auskultasi; beri oksigen sesuai target." },
				{ t: "C — Circulation: nadi, TD, CRT, akral, perdarahan; akses IV & cairan bila syok." },
				{ t: "D — Disability: GCS/AVPU, pupil, gula darah (koreksi < 70 mg/dL), kejang, lateralisasi." },
				{ t: "E — Exposure: suhu, ruam, trauma, tanda suntikan, kaki (TVD) — jaga suhu tubuh." },
			] },
			{ title: "Glasgow Coma Scale", steps: [
				{ t: "Eye: 4 spontan · 3 terhadap suara · 2 terhadap nyeri · 1 tidak ada." },
				{ t: "Verbal: 5 orientasi baik · 4 bingung · 3 kata tidak tepat · 2 suara tidak bermakna · 1 tidak ada (T bila intubasi)." },
				{ t: "Motor: 6 mengikuti perintah · 5 melokalisasi nyeri · 4 menarik (fleksi normal) · 3 fleksi abnormal (dekortikasi) · 2 ekstensi (deserebrasi) · 1 tidak ada." },
			], abn: [["Pupil anisokor + penurunan kesadaran", "Herniasi/ lesi desak ruang — CT & rujuk bedah saraf"], ["Pupil pinpoint + napas lambat", "Intoksikasi opioid (nalokson) atau perdarahan pons"]] },
		],
	},
];
