# EduAgentPCT

Versi awal portal siswa LKP PalComTech Lahat untuk membuat surat permohonan PKL. Saat ini berupa aplikasi web responsif dan backend Node.js. Paket Flutter Android/iOS/Windows/macOS belum dibuat; jangan menyebut versi ini sebagai aplikasi native yang selesai.

## Fitur yang sudah berjalan

- Tombol mengambang Chatbot AI di ruang siswa, dengan panel panduan kategori, pemilihan mitra, dan pembuatan surat. Panel menyatakan koneksi AI belum aktif; panduan merupakan teks aplikasi, bukan keluaran model. Belum ada pengiriman pesan, integrasi API AI, atau rekomendasi mitra otomatis.

- Jenis permohonan PKL (Praktik Kerja Lapangan) atau TCS (Thread Case Study), dengan kategori wajib: Internet of Things, Web Programing, UI/UX Design, Desain Grafis, Content Creator, dan Digital Marekting. Pilihan disimpan serta ditampilkan di pratinjau, riwayat dan PDF.
- Migrasi database otomatis menambahkan kolom tanpa menghapus surat lama. Surat lama dianggap PKL dan kategorinya dibiarkan belum dipilih; kategori tidak ditebak.

- Daftar mandiri dengan nama, NIS unik (3–30 angka), dan password minimal 10 karakter.
- Login menggunakan nama, NIS, dan password. Hash password scrypt, cookie sesi HttpOnly/SameSite, masa berlaku 7 hari, pembatasan percobaan login, logout yang mencabut sesi.
- Ringkasan siswa, daftar mitra, satu hingga sepuluh peserta dalam surat, tanggal PKL, dan riwayat surat per akun.
- Simpan draf tanpa nomor. Tombol Lengkapi menyalin draf ke formulir; penyimpanan berikutnya membuat surat baru dan mempertahankan draf lama.
- Pratinjau isi dan unduhan PDF A4. Nomor dari akademik wajib ada sebelum PDF bisa diunduh; nomor ganda ditolak. Aplikasi tidak mengeluarkan nomor otomatis.
- Nama pimpinan tercetak, ruang tanda tangan/stempel kosong. Surat dicetak siswa dan dibawa ke akademik atau pimpinan.

## Menjalankan

Gunakan Node.js 24 (teruji dengan 24.19.0) dan npm 11. SQLite tersedia lewat modul bawaan Node.js; tidak perlu memasang server database untuk pengembangan awal.

```sh
cd /workspace/EduAgentPCT
npm ci --cache /workspace/.npm-cache
npm start
```

Secara default server hanya mendengarkan `127.0.0.1:3000`. Halaman aplikasi tersedia di root server. `GET /api/health` harus menghasilkan `{"status":"ok"}`. Database disimpan di `data/app.sqlite` dan tidak masuk Git. Database baru tidak memiliki akun. Daftar mitra resmi dimasukkan lewat perintah impor atau saat deploy; akun uji tidak dibuat di database utama.

Variabel proses opsional:

| Nama | Default | Kegunaan |
| --- | --- | --- |
| PORT | 3000 | Port HTTP backend |
| HOST | 127.0.0.1 | Alamat bind; gunakan 0.0.0.0 hanya untuk akses jaringan yang memang diizinkan |
| DB_PATH | data/app.sqlite relatif direktori proyek | Lokasi database SQLite |
| NODE_ENV | tidak disetel | Set production untuk cookie Secure; wajib HTTPS |

Aplikasi tidak memuat `.env` otomatis. Jangan memasukkan password/credential ke Git.

## Memasukkan mitra resmi

Daftar 61 mitra yang diberikan pemilik proyek tersedia di `scripts/partners-palcomtech.json`, termasuk Kantor Lurah Bandar Jaya pada judul tabel kedua. Nama disimpan sesuai daftar. Karena jabatan penerima belum diberikan, sapaan awal adalah “Pimpinan”. Pengadilan Agama dan Pengadilan Agama Lahat dipertahankan terpisah.

Untuk memasukkannya ke database pengembangan:

```sh
npm run partners:import -- scripts/partners-palcomtech.json
```

Skrip deploy mengimpor daftar ini setelah backup, dengan pengguna service `eduagentpct`. Impor berulang melewatkan nama yang sudah ada, mempertahankan ID, jabatan penerima yang sudah disesuaikan, dan data lain. Daftar tidak dimasukkan otomatis pada setiap startup aplikasi.

Untuk daftar tambahan, siapkan JSON dari data yang dikonfirmasi akademik, di luar repositori:

```json
[
  { "name": "Nama perusahaan mitra resmi", "recipient": "Manager" }
]
```

```sh
npm run partners:import -- /path/mitra-resmi.json
```

Impor menambah mitra, mempertahankan data lama, dan melewatkan nama yang telah ada. Ini adalah perintah operator lokal, bukan fitur admin publik. Tidak ada panel admin pada tahap ini.

## Validasi

```sh
npm test
```

Tes memakai database sementara yang dihapus sesudahnya, bukan database pengembangan. Pengujian integrasi mencakup backend dan browser: pendaftaran/login, validasi tanggal, draf tanpa nomor, nomor duplikat, isolasi akses antar-akun, logout, pratinjau beberapa peserta, unduhan PDF dan pemeriksaan teksnya, ukuran layar desktop dan ponsel, kedua jenis permohonan dengan seluruh kategori, dan migrasi database lama yang dijalankan ulang.

Tes browser membutuhkan Chromium di `/usr/bin/chromium` (atau variabel `CHROMIUM_PATH`) dan utilitas `pdftotext`. Jika belum tersedia, jalankan tes backend terpisah dengan `node --test test/app.test.js`; ini tidak menggantikan tes browser. Tidak perlu memasang Flutter untuk menjalankan versi web ini.

## Batasan sebelum peluncuran

- Belum ada penautan/login Google. Tampilan menyebutnya belum tersedia; tidak ada tombol login palsu. Diperlukan proyek OAuth Google, domain HTTPS, dan implementasi callback serta penautan identitas yang aman.
- Belum ada verifikasi NIS terhadap daftar siswa akademik. Validasi sekarang hanya memeriksa format dan keunikan. Nomor surat yang diketik juga belum diverifikasi ke arsip akademik.
- Logo pada halaman login, sidebar, pratinjau, dan PDF berasal dari aset kop asli dalam `Contoh Format.docx` (`public/assets/palcomtech-letterhead.jpg`). CSS dan layout PDF menampilkan area logo dari aset tersebut tanpa mengubah file gambar. Isi surat mengikuti contoh, tetapi kesamaan tata letak lengkap dengan Word belum diterapkan. Identitas pimpinan dan kontak berasal dari contoh; akademik perlu mengonfirmasi sebelum dipakai resmi.
- Belum ada reset password, panel akademik, atau audit administratif. Data mitra dikelola lewat perintah impor lokal.
- Database awal SQLite, bukan PostgreSQL yang direncanakan untuk pengembangan produksi. Migrasi perlu dilakukan terpisah; kapasitas VPS belum diuji.
- Belum dipasang ke VPS Sumopod dan belum mengubah DNS `eduagentpct.my.id`. Rencana backend produksi: `api.eduagentpct.my.id`, HTTPS lewat reverse proxy, layanan non-root, backup di luar VPS, dan pengujian akses sebelum peluncuran. Frontend web dan API saat ini harus dilayani dari origin yang sama.
- Build native Flutter belum tersedia. Percobaan memasang SDK resmi terhalang respons proxy 403 ke `storage.googleapis.com`. Setelah akses diizinkan, lanjutkan pemasangan SDK dan implementasi klien Flutter; build iOS/macOS memerlukan macOS/Xcode.

## Keamanan dan operasional

Jangan membuka versi pengembangan ke publik sebagai layanan produksi. Saat produksi gunakan HTTPS, `NODE_ENV=production`, backup database SQLite dengan mekanisme backup SQLite yang konsisten (jangan hanya menyalin file utama ketika WAL aktif), serta verifikasi NIS dan kebijakan privasi siswa. Reverse proxy perlu ditata sesuai topologi sebenarnya agar pembatasan IP bekerja; jangan mengaktifkan trust proxy secara membabi buta.

Setiap tugas cloud sudah terisolasi. Gunakan checkout yang ada; jangan membuat Git worktree tanpa permintaan pengguna. Dependensi dan file database bertahan pada filesystem, tetapi proses server perlu dijalankan ulang pada tugas baru.
