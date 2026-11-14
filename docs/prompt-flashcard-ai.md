# Prompt pembuat flashcard (plugin Flashcard Hafalan)

Salin semua teks di dalam kotak di bawah ini ke ChatGPT, Gemini, Claude, atau AI lain. Isi bagian PENGATURAN, lalu tempel materi Anda di bagian paling bawah.

````text
Kamu adalah pembuat flashcard untuk plugin Obsidian "Flashcard Hafalan". Ubah MATERI di bagian bawah menjadi SATU catatan Markdown yang langsung terbaca sebagai flashcard. Ikuti format di bawah ini PERSIS, karena plugin membaca sintaksnya secara harfiah.

=== PENGATURAN (boleh diubah) ===
Topik/tag      : farmakologi
Jumlah kartu   : sekitar 40 (sesuaikan dengan banyaknya materi)
Tingkat        : mahasiswa kedokteran / dokter umum
Bahasa         : Indonesia (istilah medis/ilmiah boleh tetap bahasa aslinya)
Fokus khusus   : (kosongkan, atau tulis mis. "dosis dan kontraindikasi")

=== BENTUK KELUARAN ===
1. Tulis seluruh catatan di dalam SATU blok kode ```markdown agar mudah disalin. Di luar blok kode hanya boleh ada satu baris ringkasan: "Jumlah kartu: N (satu baris: a, cloze: b, daftar: c, pilihan ganda: d, multi-baris/tabel: e)".
2. Baris pertama catatan WAJIB frontmatter berikut (ganti <topik> dengan Topik/tag, huruf kecil, tanpa spasi, pakai tanda hubung):
---
tags:
  - flashcards/<topik>
---
3. Kelompokkan kartu dengan judul Markdown: "# Judul besar", "## Subbab", "### Sub-subbab". Judul menjadi konteks/dek kartu, jadi buat judul yang jelas.

=== FORMAT KARTU (pakai beberapa jenis secara bervariasi) ===

A. SATU BARIS — untuk fakta singkat
Pertanyaan :: Jawaban
- Satu kartu = satu baris. Tanda "::" hanya boleh muncul SATU kali di baris itu.
- Contoh: Antidot overdosis opioid :: **Nalokson**

B. DUA ARAH — hanya untuk pasangan istilah ↔ definisi yang masuk akal ditanyakan bolak-balik
Istilah ::: Definisi
- Contoh: Bradikardia ::: Laju jantung < 60 kali/menit

C. CLOZE (isian rumpang) — untuk kalimat kunci
Kalimat dengan {{jawaban}} yang disembunyikan.
- Petunjuk opsional: {{jawaban|petunjuk}}
- Setiap {{...}} menjadi satu kartu terpisah. Maksimal 1–3 rumpang per kalimat, pilih kata yang benar-benar penting.
- JANGAN gabungkan cloze dengan "::" di baris yang sama.
- Contoh: Obat lini pertama syok septik adalah {{norepinefrin|vasopresor}}.

D. MULTI-BARIS — untuk penjelasan, mekanisme, atau langkah
Pertanyaan (boleh lebih dari satu baris)
?
Baris jawaban 1
Baris jawaban 2
- Baris "?" berdiri sendiri, tanpa teks lain.
- Gunakan "??" (bukan "?") bila kartu juga perlu dibalik (jawaban → pertanyaan).

E. DAFTAR — untuk "sebutkan …"
Sebutkan 4 efek samping X
?
- butir 1
- butir 2
- butir 3
- butir 4
- SEMUA baris jawaban harus diawali "- " (minimal 2 butir).

F. PILIHAN GANDA — untuk soal kasus / vignette
Pertanyaan atau kasus singkat
?
- [ ] pilihan salah
- [x] pilihan benar
- [ ] pilihan salah
- [ ] pilihan salah
Penjelasan singkat mengapa jawaban itu benar.
- 4 pilihan, minimal 1 bertanda [x]. Pengecoh harus masuk akal.
- Baris penjelasan TIDAK boleh diawali "-".

G. TABEL — untuk perbandingan (dosis, golongan, diagnosis banding, dll.)
Bandingkan A dan B
?
| Aspek | A | B |
| --- | --- | --- |
| ... | ... | ... |
- Tabel ditulis tepat di bawah "?" tanpa baris kosong di antara barisnya.

=== ATURAN WAJIB (agar tidak rusak saat dibaca plugin) ===
1. Pisahkan setiap kartu multi-baris/daftar/pilihan ganda/tabel dengan SATU baris kosong sebelum dan sesudahnya.
2. Di DALAM satu kartu tidak boleh ada baris kosong (baris kosong = kartu berakhir).
3. Jangan menulis "::" atau "{{ }}" di teks biasa yang bukan kartu.
4. Jangan menaruh kartu di dalam blok kode atau kutipan; jangan pakai HTML.
5. Jangan menulis label "Pertanyaan:", "Jawaban:", "Kartu 1", atau penomoran kartu.
6. Satuan dan angka ditulis lengkap (mg, mg/kg, mmHg, hari). Gunakan **tebal** atau ==sorot== untuk kata kunci.

=== ATURAN KUALITAS ===
1. Satu kartu = satu fakta/konsep (atomik). Pecah jawaban panjang menjadi beberapa kartu.
2. Pertanyaan harus jelas tanpa melihat kartu lain; sebut subjeknya (nama obat/penyakit), jangan "obat ini".
3. Jawaban satu baris singkat (idealnya ≤ 15 kata).
4. Utamakan yang sering keluar ujian dan penting secara klinis: definisi, mekanisme, indikasi, dosis, kontraindikasi, efek samping, tanda khas, tata laksana, angka penting.
5. Komposisi kira-kira: 45% satu baris, 20% cloze, 15% daftar/multi-baris/tabel, 20% pilihan ganda kasus.
6. Liput SELURUH bagian materi secara merata, urut sesuai materi.
7. Jangan mengarang di luar materi. Bila menambah fakta penting yang tidak ada di materi, beri tanda "(tambahan)" di akhir jawaban.
8. Tulis ulang dengan bahasamu sendiri; jangan menyalin paragraf panjang.

=== CONTOH KELUARAN YANG BENAR ===
---
tags:
  - flashcards/farmakologi
---
# Farmakologi Kardiovaskular

## ACE inhibitor

Efek samping ACE inhibitor yang paling sering membuat pasien berhenti minum obat :: **Batuk kering** (penumpukan bradikinin)
ACE inhibitor ::: Obat yang menghambat perubahan angiotensin I menjadi angiotensin II
ACE inhibitor dikontraindikasikan pada {{kehamilan|kondisi}} karena bersifat {{fetotoksik}}.

Sebutkan 4 efek samping utama ACE inhibitor
?
- Batuk kering
- Angioedema
- Hiperkalemia
- Gangguan ginjal akut

Pasien hipertensi batuk kering setelah minum kaptopril. Obat pengganti yang paling tepat adalah…
?
- [ ] Lisinopril
- [x] Losartan
- [ ] Enalapril
- [ ] Ramipril
ARB tidak menumpuk bradikinin sehingga jarang menyebabkan batuk.

Bandingkan ACE inhibitor dan ARB
?
| Aspek | ACE inhibitor | ARB |
| --- | --- | --- |
| Mekanisme | Menghambat enzim ACE | Memblok reseptor AT1 |
| Batuk | Sering | Jarang |
| Contoh | Kaptopril | Losartan |

=== MATERI ===
(Tempel catatan, teks buku, transkrip kuliah, atau tabel di sini)
````

## Cara memakai hasilnya

1. Tekan tombol **Copy** pada blok kode jawaban AI. Yang tersalin hanya isinya, tanpa ``` di awal dan akhir.
2. Di Obsidian, buat catatan baru lalu tempel. Jangan ikut menempel baris ```markdown dan ```, karena kartu di dalam blok kode diabaikan plugin.
3. Kartu langsung muncul (catatan bertag `#flashcards/...`). Bila tag di pengaturan plugin bukan `#flashcards`, ganti tag di frontmatter.

## Tambahan untuk materi yang panjang

Bila materi lebih dari ±10 halaman, kirim per bab, dan tambahkan kalimat ini di atas MATERI:

```text
Ini bagian ke-2 dari materi yang sama. Lanjutkan dengan format yang sama, judul "# <nama bab>", tanpa mengulang kartu sebelumnya.
```

## Prompt singkat: tabel saja

Untuk materi berbentuk perbandingan, pakai prompt ini, lalu di Obsidian letakkan kursor di tabel dan jalankan perintah **"Buat kartu dari tabel di bawah kursor"**.

```text
Ubah MATERI berikut menjadi tabel Markdown untuk dihafal. Kolom pertama = kata kunci (nama obat/penyakit/istilah), kolom berikutnya = atribut (mis. golongan, dosis dewasa, dosis anak, kontraindikasi, efek samping khas). Isi sel singkat (≤ 12 kata), tanpa baris kosong, tanpa sel gabungan, tanpa tanda "|" di dalam sel. Keluarkan hanya tabelnya di dalam satu blok kode ```markdown.

MATERI:
(tempel di sini)
```
