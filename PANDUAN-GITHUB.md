# 📘 Panduan mengunggah Flashcard Hafalan ke GitHub

Untuk: **Ahmad Wirawan** · akun GitHub: [`ahmadwirawan74-ui`](https://github.com/ahmadwirawan74-ui)
Alamat repo nanti: **https://github.com/ahmadwirawan74-ui/flashcard-hafalan**

Nama dan username sudah diisi di semua file (`manifest.json`, `package.json`, `LICENSE`, `README.md`). Tinggal unggah.

> ⚠️ **Jangan pernah mengunggah `data.json`** dari folder plugin di vault. File itu berisi progres belajar pribadi. Folder ini tidak memuatnya, dan `.gitignore` sudah mengabaikannya.

Ada tiga cara. Pilih **satu** saja:

| Cara | Cocok untuk | Catatan |
|---|---|---|
| **A. GitHub Desktop** (disarankan) | Tidak terbiasa terminal | Semua file (termasuk folder tersembunyi `.github`) terunggah sekaligus |
| **B. Browser** | Tidak mau memasang apa pun | Browser maksimal 100 file sekali unggah, jadi diunggah 2 tahap |
| **C. Git di terminal** | Sudah terbiasa Git | Paling cepat |

---

## Langkah 1 — Buat repositori (semua cara)

1. Masuk ke [github.com](https://github.com) dengan akun `ahmadwirawan74-ui`.
2. Klik **+** (kanan atas) → **New repository**.
3. **Repository name:** `flashcard-hafalan` (harus persis, huruf kecil, pakai tanda hubung).
4. **Description** (opsional): `Plugin Obsidian: flashcard FSRS, jadwal belajar, Al-Qur'an & ibadah, serta referensi obat untuk dokter.`
5. Pilih **Public**, karena repositori harus publik agar plugin bisa dipasang lewat BRAT atau Community Plugins.
6. **Jangan** centang *Add a README*, *Add .gitignore*, atau *Choose a license*. Semuanya sudah ada di folder ini.
7. Klik **Create repository**.

---

## Cara A — GitHub Desktop (disarankan)

1. Unduh dan pasang [GitHub Desktop](https://desktop.github.com), lalu masuk dengan akun `ahmadwirawan74-ui`.
2. **File → Clone repository** → pilih `ahmadwirawan74-ui/flashcard-hafalan` → tentukan lokasi (mis. `Documents\GitHub`) → **Clone**. Akan terbentuk folder kosong `flashcard-hafalan`.
3. Ekstrak `flashcard-hafalan-untuk-github-v19.0.zip`. Buka folder **`flashcard-hafalan-github`**, pilih **semua isinya** (Ctrl+A / Cmd+A), lalu salin ke folder `flashcard-hafalan` hasil clone tadi.
   - Windows: aktifkan *View → Show → Hidden items* agar `.github`, `.gitignore`, `.npmrc`, `.editorconfig` ikut tersalin.
   - macOS: tekan **Cmd+Shift+.** untuk menampilkan file tersembunyi.
4. Kembali ke GitHub Desktop. Di kolom kiri akan tampil ±134 file berubah. Di **Summary** tulis `Rilis pertama 19.0.0` → **Commit to main** → **Push origin**.
5. Lanjut ke **Langkah 2 — Buat Release**.

---

## Cara B — Browser (unggah 2 tahap)

GitHub di browser menolak lebih dari 100 file sekaligus, sedangkan folder ini berisi ±134 file. Jadi unggah dalam dua tahap. Gunakan **Chrome atau Edge** agar folder ikut terbawa saat diseret.

**Tahap 1: semua kecuali folder `src`**
1. Di halaman repo yang masih kosong, klik **uploading an existing file**.
2. Buka folder `flashcard-hafalan-github`, pilih **semua isinya kecuali folder `src`**, lalu seret ke browser.
3. Tulis pesan `Rilis pertama 19.0.0 (bagian 1)` → **Commit changes**.

**Tahap 2: folder `src`**
1. Di halaman repo, klik **Add file → Upload files**.
2. Seret **folder `src`** (foldernya, bukan isinya) ke browser.
3. Pesan `Rilis pertama 19.0.0 (bagian 2)` → **Commit changes**.

**Periksa file tersembunyi.** Pastikan di halaman repo terlihat `.github`, `.gitignore`, `.npmrc`, dan `.editorconfig`. Yang paling penting adalah `.github`, karena berisi workflow rilis otomatis. Bila ada yang tidak muncul:
1. **Add file → Create new file**.
2. Ketik nama `.github/workflows/release.yml` (garis miring otomatis membuat foldernya).
3. Buka file `release.yml` dari folder ini dengan Notepad/TextEdit, salin isinya, tempel → **Commit changes**.
4. Ulangi untuk `.github/workflows/build.yml`, `.gitignore`, `.npmrc`, dan `.editorconfig` bila perlu.

Lanjut ke **Langkah 2 — Buat Release**.

---

## Cara C — Git di terminal

Butuh [Git](https://git-scm.com). Atur identitas sekali saja (pakai email akun GitHub, atau email *noreply* dari **Settings → Emails** agar email asli tidak tampil di commit):

```bash
git config --global user.name "Ahmad Wirawan"
git config --global user.email "EMAIL_GITHUB_ANDA"
```

Lalu di folder hasil ekstrak:

```bash
cd flashcard-hafalan-github
git init -b main
git add .
git commit -m "Rilis pertama Flashcard Hafalan 19.0.0"
git remote add origin https://github.com/ahmadwirawan74-ui/flashcard-hafalan.git
git push -u origin main

# rilis otomatis lewat GitHub Actions
git tag 19.0.0
git push origin 19.0.0
```

Saat diminta *password*, GitHub tidak menerima kata sandi akun. Gunakan **Personal Access Token**: **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token**, centang `repo` dan `workflow`, salin token, lalu tempel sebagai password.

Setelah tag di-push, Release dibuat otomatis (lihat Langkah 2, pilihan otomatis).

---

## Langkah 2 — Buat Release (agar plugin bisa dipasang)

Obsidian dan BRAT memasang plugin dari **Release**, bukan dari kode. Pilih salah satu:

### Pilihan manual (paling pasti)
1. Di repo, klik **Releases** (kolom kanan) → **Create a new release**.
2. **Choose a tag:** ketik `19.0.0` → klik **Create new tag: 19.0.0 on publish**. Tulis **tanpa huruf `v`**, dan harus sama dengan `"version"` di `manifest.json`.
3. **Release title:** `19.0.0`.
4. **Description:** salin bagian `## 19.0.0` dari `CHANGELOG.md` (opsional).
5. Di kotak **Attach binaries**, seret **tiga file** ini:
   - `main.js` dari folder `rilis-19.0.0`
   - `styles.css` dari folder `rilis-19.0.0`
   - `manifest.json` dari folder `flashcard-hafalan-github`
6. Klik **Publish release**. 🎉

### Pilihan otomatis (GitHub Actions)
Bila folder `.github` sudah ada di repo, cukup buat tag `19.0.0` (lewat Cara C, atau lewat halaman *Create a new release* tanpa melampirkan file lalu **Publish**). Buka tab **Actions** dan tunggu ±1–2 menit sampai workflow **Rilis plugin** berwarna hijau. Release akan berisi `main.js`, `manifest.json`, dan `styles.css`.

> **Actions gagal karena izin?** Buka **Settings → Actions → General → Workflow permissions** → pilih **Read and write permissions** → **Save**, lalu buka tab Actions → workflow yang gagal → **Re-run all jobs**.
>
> **Release dibuat dua kali?** Bila Anda melampirkan file secara manual *dan* Actions juga berjalan, hapus salah satunya. Isinya sama.

---

## Langkah 3 — Pasang dari GitHub

**Lewat BRAT** (untuk Anda dan teman-teman):
1. Di Obsidian: **Settings → Community plugins → Browse** → cari **BRAT** → Install → Enable.
2. **Settings → BRAT → Add Beta plugin** → isi `ahmadwirawan74-ui/flashcard-hafalan` → **Add Plugin**.
3. Aktifkan **Flashcard Hafalan**. BRAT juga memperbarui plugin otomatis setiap ada Release baru.

**Manual:** unduh `main.js`, `manifest.json`, dan `styles.css` dari [Release terbaru](https://github.com/ahmadwirawan74-ui/flashcard-hafalan/releases/latest), lalu salin ke `<vault>/.obsidian/plugins/flashcard-hafalan/`.

> Progres belajar tidak hilang saat memperbarui plugin, karena `data.json` di folder plugin tidak ditimpa.

---

## Cek akhir

- [ ] Repo publik di `github.com/ahmadwirawan74-ui/flashcard-hafalan`
- [ ] Folder `.github/workflows` terlihat di repo
- [ ] Tab **Actions** → workflow **Build** hijau ✅
- [ ] Ada Release `19.0.0` berisi `main.js`, `manifest.json`, `styles.css`
- [ ] Lencana versi di README menampilkan `19.0.0` (bisa butuh beberapa menit)
- [ ] Plugin terpasang lewat BRAT di vault uji
- [ ] Tidak ada `data.json` di repo

---

## Merilis versi baru di kemudian hari

**Dengan Git & Node.js** (otomatis):
```bash
npm install                 # sekali saja
npm version patch           # 19.0.0 → 19.0.1  (minor: 19.1.0, major: 20.0.0)
git push && git push --tags # Actions membuat Release otomatis
```
Perintah `npm version` sekaligus memperbarui `manifest.json` dan `versions.json`, membuat commit, dan membuat tag (tanpa huruf `v`, sesuai syarat Obsidian).

> Bila muncul *"Git working directory not clean"*: commit dulu perubahan Anda (`git add . && git commit -m "..."`), lalu ulangi `npm version patch`.

**Lewat browser / GitHub Desktop:**
1. Ganti file yang berubah (biasanya isi `src/`, `styles.css`, dll.) dengan versi baru.
2. Ubah `"version"` di `manifest.json` dan `package.json` (mis. `19.0.1`).
3. Tambahkan baris di `versions.json`, mis. `"19.0.1": "1.4.0"`.
4. Commit, lalu buat Release baru dengan tag `19.0.1` dan lampirkan `main.js`, `manifest.json`, dan `styles.css` terbaru.

---

## (Opsional) Mengajukan ke daftar Community Plugins resmi Obsidian

Agar plugin muncul di *Settings → Community plugins → Browse* untuk semua orang:

1. Pastikan sudah ada **Release** berisi tiga file di atas, serta `README.md` dan `LICENSE` di repo. Semuanya sudah disiapkan.
2. Fork repo [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases).
3. Edit `community-plugins.json` dan tambahkan entri ini di **akhir** daftar (jangan lupa koma setelah entri sebelumnya):
   ```json
   {
     "id": "flashcard-hafalan",
     "name": "Flashcard Hafalan",
     "author": "Ahmad Wirawan",
     "description": "Belajar & menghafal dengan flashcard FSRS, jadwal belajar, ujian, tugas, Pomodoro, serta fitur Al-Qur'an, hadits & ibadah harian.",
     "repo": "ahmadwirawan74-ui/flashcard-hafalan"
   }
   ```
4. Buat **Pull Request** dan isi daftar periksa yang muncul. Tim Obsidian meninjau, biasanya dalam beberapa minggu, dan mungkin meminta perbaikan.

**Yang mungkin ditanyakan peninjau:**
- **Ukuran `main.js` ±2,7 MB**, karena teks Al-Qur'an, hadits, font, dan database obat dibundel agar bisa dipakai tanpa internet.
- **Deskripsi bahasa Inggris.** Bila diminta, ganti `description` di `manifest.json` (dan di entri `community-plugins.json`), mis.: *"Learn and memorize with FSRS flashcards, study schedules, exams, tasks, Pomodoro, plus Quran, hadith, worship tools and a drug reference for doctors."*
- **Akses jaringan** hanya untuk audio murattal (everyayah.com), dan sudah dijelaskan di README.
- Uji di Obsidian desktop **dan** HP sebelum mengajukan.

---

## Isi folder ini

| File / folder | Fungsi |
|---|---|
| `src/` | Kode sumber TypeScript |
| `styles.css` | Tampilan plugin |
| `manifest.json` | Identitas plugin untuk Obsidian |
| `versions.json` | Peta versi plugin → versi Obsidian minimum |
| `package.json`, `package-lock.json`, `tsconfig.json`, `esbuild.config.mjs`, `.npmrc` | Konfigurasi build |
| `version-bump.mjs` | Dipakai `npm version` untuk menaikkan versi |
| `.github/workflows/` | Build otomatis & Release otomatis |
| `README.md` | Halaman depan repo |
| `CHANGELOG.md` | Riwayat perubahan |
| `LICENSE`, `THIRD_PARTY_NOTICES.md`, `licenses/` | Lisensi kode, data, dan font |
| `docs/screenshots/` | Gambar untuk README |
| `docs/prompt-flashcard-ai.md` | Prompt untuk membuat flashcard dengan AI lain |
