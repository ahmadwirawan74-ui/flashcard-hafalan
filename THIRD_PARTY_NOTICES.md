# Pemberitahuan pihak ketiga

Plugin ini membundel data dan font berikut. Masing-masing tetap berada di bawah lisensinya sendiri; teks lisensinya ada di folder [`licenses/`](licenses/).

## Teks Al-Qur'an & terjemahan
- **Sumber:** [quran-json](https://github.com/risan/quran-json) v3.1.2 oleh Risan Bagja Pradana — teks Rasm Utsmani dari *The Noble Qur'an Encyclopedia* (QuranEnc.com) dan terjemahan **Kementerian Agama Republik Indonesia** via QuranEnc.com.
- **Lisensi:** Creative Commons Attribution 4.0 (CC BY 4.0) — `licenses/LICENSE-quran-json-CC-BY-4.0.txt`.
- **Perubahan:** nomor catatan kaki pada terjemahan dihapus karena isi catatan kakinya tidak disertakan; teks Arab tidak diubah. Data dikompresi (gzip) di dalam `src/quran-data.ts`.

## Metadata Al-Qur'an
- **Sumber:** [quran-meta](https://github.com/quran-center/quran-meta) v7.0.0 — batas juz, halaman mushaf Madinah (604), dan ayat sajdah.
- **Lisensi:** MIT — `licenses/LICENSE-quran-meta-MIT.txt`.

## Hadits, doa & dzikir
- **Sumber:** [HadeethEnc.com](https://hadeethenc.com) — *Ensiklopedia Hadits Nabi Terjemahan*, bahasa Indonesia v1.22.0.
- **Ketentuan:** ditampilkan apa adanya tanpa perubahan isi, dengan mencantumkan sumber dan versi, sesuai syarat penerbitan ulang HadeethEnc — `licenses/SUMBER-HadeethEnc.txt`.

## Harakat hadits
- **Sumber:** [Open Hadith Data](https://github.com/mhashim6/Open-Hadith-Data) — 9 kitab hadits berharakat.
- **Lisensi:** Open Database License (ODbL) 1.0 / Database Contents License (DbCL) 1.0 — `licenses/SUMBER-OpenHadithData-ODbL.txt`.
- **Pemakaian:** harakat dicocokkan kata demi kata untuk hadits yang di HadeethEnc ditulis tanpa harakat. Data turunan ini (`HADEETH_VOCAL_GZ` di `src/ibadah-data.ts`) juga dilisensikan di bawah **ODbL 1.0**.

## Asmaul Husna
Daftar 99 nama mengikuti riwayat Tirmidzi yang masyhur. Nama Arab hanya dipakai bila dua sumber independen sepakat, dan arti ditulis sebagai terjemahan ringkas yang umum.

## Font
- **Amiri Quran** (Khaled Hosny), **Poppins** (Indian Type Foundry), **Press Start 2P** (CodeMan38), **VT323** (Peter Hull) — SIL Open Font License 1.1, diambil via Fontsource. Teks lisensi: `licenses/OFL-*.txt`.

## Pustaka
- **fflate** — MIT — `licenses/LICENSE-fflate-MIT.txt`.

## Audio murattal
Tidak dibundel. Saat diminta pengguna, plugin memutar MP3 langsung dari `everyayah.com`.
