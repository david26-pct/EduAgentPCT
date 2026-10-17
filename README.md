# EduAgentPCT

[Dokumentasi lengkap dalam satu file](docs/PROJECT-MANAGER-PERFORMANCE.md)

Dokumentasi knowledge berbasis source: [README](docs/knowledge/README.md) · [MOC](docs/knowledge/MOC.md) · [Project Performance](docs/knowledge/project-performance.md).

Versi awal portal siswa LKP PalComTech untuk membuat surat permohonan PKL. Saat ini berupa aplikasi web responsif dan backend Node.js. Paket Flutter Android/iOS/Windows/macOS belum dibuat; jangan menyebut versi ini sebagai aplikasi native yang selesai.

## Fitur yang sudah berjalan

- Tombol mengambang Chatbot AI di ruang siswa, dengan panel panduan kategori, pemilihan mitra, dan pembuatan surat. Panel menyatakan koneksi AI belum aktif; panduan merupakan teks aplikasi, bukan keluaran model. Belum ada pengiriman pesan, integrasi API AI, atau rekomendasi mitra otomatis.

- Jenis permohonan PKL (Praktik Kerja Lapangan) atau TCS (Thread Case Study), dengan kategori wajib: Internet of Things, Web Programing, UI/UX Design, Desain Grafis, Content Creator, dan Digital Marekting. Pilihan disimpan serta ditampilkan di pratinjau, riwayat dan PDF.
- Migrasi database otomatis menambahkan kolom tanpa menghapus surat lama. Surat lama dianggap PKL dan kategorinya dibiarkan belum dipilih; kategori tidak ditebak.

- Daftar mandiri dengan nama, NIS unik (3–30 angka), dan password minimal 10 karakter.
- Login menggunakan nama, NIS, dan password. Hash password scrypt, cookie sesi HttpOnly/SameSite, masa berlaku 7 hari, pembatasan percobaan login, logout yang mencabut sesi.
- Ringkasan siswa, daftar mitra, satu hingga sepuluh peserta dalam surat, tanggal PKL, dan riwayat surat per akun.
- Pengajuan tanpa nomor, persetujuan akademik per cabang, revisi pada pengajuan yang sama, dan tombol WhatsApp dengan tautan pemeriksaan.
- Pratinjau pengajuan tanpa QR sebelum disetujui. PDF A4 dan QR hanya tersedia setelah persetujuan serta nomor yang diisi akademik. Nomor ganda per cabang ditolak.
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

Tes memakai database sementara yang dihapus sesudahnya, bukan database pengembangan. Pengujian integrasi mencakup backend dan browser: pendaftaran/login, validasi tanggal, pengajuan tanpa nomor, persetujuan/revisi akademik, nomor duplikat, isolasi akses antar-akun, logout, pratinjau beberapa peserta, unduhan PDF dan pemeriksaan teksnya, ukuran layar desktop dan ponsel, kedua jenis permohonan dengan seluruh kategori, dan migrasi database lama yang dijalankan ulang.

Tes browser membutuhkan Chromium di `/usr/bin/chromium` (atau variabel `CHROMIUM_PATH`) dan utilitas `pdftotext`. Jika belum tersedia, jalankan tes backend terpisah dengan `node --test test/app.test.js`; ini tidak menggantikan tes browser. Tidak perlu memasang Flutter untuk menjalankan versi web ini.

## Batasan sebelum peluncuran

- Belum ada penautan/login Google. Tampilan menyebutnya belum tersedia; tidak ada tombol login palsu. Diperlukan proyek OAuth Google, domain HTTPS, dan implementasi callback serta penautan identitas yang aman.
- Belum ada verifikasi NIS terhadap daftar siswa akademik. Validasi sekarang hanya memeriksa format dan keunikan. Nomor surat yang diketik juga belum diverifikasi ke arsip akademik.
- Logo pada halaman login, sidebar, pratinjau, dan PDF berasal dari aset kop asli dalam `Contoh Format.docx` (`public/assets/palcomtech-letterhead.jpg`). CSS dan layout PDF menampilkan area logo dari aset tersebut tanpa mengubah file gambar. Isi surat mengikuti contoh, tetapi kesamaan tata letak lengkap dengan Word belum diterapkan. Identitas pimpinan dan kontak berasal dari contoh; akademik perlu mengonfirmasi sebelum dipakai resmi.
- Belum ada reset password. Portal akademik dan audit pengajuan tersedia; data mitra masih dikelola lewat perintah impor lokal.
- Database awal SQLite, bukan PostgreSQL yang direncanakan untuk pengembangan produksi. Migrasi perlu dilakukan terpisah; kapasitas VPS belum diuji.
- Belum dipasang ke VPS Sumopod dan belum mengubah DNS `eduagentpct.my.id`. Rencana backend produksi: `api.eduagentpct.my.id`, HTTPS lewat reverse proxy, layanan non-root, backup di luar VPS, dan pengujian akses sebelum peluncuran. Frontend web dan API saat ini harus dilayani dari origin yang sama.
- Build native Flutter belum tersedia. Percobaan memasang SDK resmi terhalang respons proxy 403 ke `storage.googleapis.com`. Setelah akses diizinkan, lanjutkan pemasangan SDK dan implementasi klien Flutter; build iOS/macOS memerlukan macOS/Xcode.

## Keamanan dan operasional

Jangan membuka versi pengembangan ke publik sebagai layanan produksi. Saat produksi gunakan HTTPS, `NODE_ENV=production`, backup database SQLite dengan mekanisme backup SQLite yang konsisten (jangan hanya menyalin file utama ketika WAL aktif), serta verifikasi NIS dan kebijakan privasi siswa. Reverse proxy perlu ditata sesuai topologi sebenarnya agar pembatasan IP bekerja; jangan mengaktifkan trust proxy secara membabi buta.

Setiap tugas cloud sudah terisolasi. Gunakan checkout yang ada; jangan membuat Git worktree tanpa permintaan pengguna. Dependensi dan file database bertahan pada filesystem, tetapi proses server perlu dijalankan ulang pada tugas baru.


## Cari Rekomendasi Tempat PKL

Menu **Cari Rekomendasi Tempat PKL** menyimpan profil kategori PKL/TCS, keahlian, minat, pengalaman, lokasi, dan tautan portofolio per akun. Menyimpan ulang profil membatalkan rencana lama agar tidak ditampilkan untuk profil yang berubah.

**Career Match** menggunakan pencocokan berbobot transparan, bukan model AI: kategori dan jenis kegiatan wajib sesuai (60 poin), persentase keahlian yang cocok menambah maksimal 30 poin, dan lokasi yang sama persis menambah 10 poin. Normalisasi hanya huruf kecil dan spasi; belum ada pemahaman sinonim atau jarak geografis. Hanya profil mitra dengan `verified: true` dan penerimaan selain `closed` yang dipakai. Status `unknown` tetap harus dikonfirmasi. Skor bukan peluang diterima. Tombol pilih mitra mengisi kategori, jenis kegiatan, dan mitra dalam formulir surat.

Daftar nama 61 mitra belum memuat profil pekerjaan terverifikasi. Aplikasi tidak menebak kecocokan berdasarkan nama. Operator dapat memasukkan profil yang dikonfirmasi akademik melalui JSON berikut (contoh format, bukan klaim tentang mitra nyata):

```json
[
  {
    "name": "Nama persis mitra yang sudah terdaftar",
    "categories": ["UI/UX Design"],
    "request_types": ["PKL", "TCS"],
    "skills": ["Figma", "User Research"],
    "location": "Lahat",
    "description": "Deskripsi tugas yang sudah dikonfirmasi ke mitra.",
    "acceptance": "unknown",
    "verified": true
  }
]
```

Jalankan `node scripts/import-partner-profiles.js /path/profil-mitra.json` untuk development. Untuk produksi jalankan dari release terpasang sebagai service user, misalnya `sudo -u eduagentpct env DB_PATH=/var/lib/eduagentpct/app.sqlite /opt/node-v24.19.0/bin/node /opt/eduagentpct/current/scripts/import-partner-profiles.js /path/profil-mitra.json`. File JSON harus dapat dibaca service user. Impor bersifat transaksional, menolak nama tidak dikenal, dan memperbarui metadata mitra yang disebut saja. Jangan menjalankan dengan data contoh atau kategori tebakan.

**Rencana dasar 14 hari** tersedia tanpa API, dengan template per kategori. **Rencana AI** memakai OpenAI Responses API, hanya dipanggil saat siswa menekan tombol dan memberi persetujuan. Profil keahlian (kategori, jenis kegiatan, skills, minat, pengalaman) dikirim; aplikasi tidak mengirim nama, NIS, ID siswa, password, lokasi, atau URL portofolio. Siswa diminta tidak memasukkan data pribadi ke teks bebas. Tautan portofolio tidak di-fetch.

Aktivasi pada VPS:

1. Perbarui aplikasi dengan skrip deploy. Service membaca file opsional `/etc/eduagentpct.env`, yang tidak masuk repositori.
2. Buat file root-only (`sudo install -m 600 /dev/null /etc/eduagentpct.env`) **hanya jika belum ada**, lalu edit melalui `sudo nano /etc/eduagentpct.env`. Pertahankan isi yang sudah ada. Tambahkan `AI_API_KEY` dengan nilai asli langsung di VPS serta `AI_MODEL=gpt-4.1-mini` (atau model Responses API yang tersedia untuk akun pengelola). Jangan memasukkan kunci dalam chat, source code, screenshot, atau perintah shell yang tercatat di history.
3. Jalankan `sudo systemctl restart eduagentpct`. Pastikan HTTPS keluar menuju `api.openai.com` diizinkan dan akun API memiliki saldo. Pengaturan kunci cloud development berbeda dengan kunci pada VPS.
4. Masuk sebagai siswa, simpan profil, beri persetujuan, dan buat rencana AI. Periksa hasilnya bersama pengajar. Jangan menganggap aktivasi berhasil hanya karena kunci telah disimpan.

Maksimal tiga **percobaan** AI per siswa per hari UTC, disimpan di database; kegagalan juga dihitung dan tidak diulang otomatis. Setiap permintaan dibatasi 1.200 output token dan 30 detik. Batas ini bukan batas biaya global: atur anggaran di akun penyedia dan verifikasi NIS sebelum membuka layanan AI ke banyak pengguna, karena akun siswa masih dapat didaftarkan mandiri. `store: false` diminta pada API, tetapi bukan janji tanpa retensi pada seluruh infrastruktur penyedia. Rencana disimpan lokal per siswa. AI bisa keliru dan tidak menjamin kompetensi/diterimanya siswa.

Pengujian: profil privat, validasi, impor metadata, pengurutan mitra terverifikasi, rencana dasar, persetujuan, batas harian, dan kegagalan penyedia diperiksa. Panggilan AI memakai **simulasi** dalam tes; panggilan nyata belum diverifikasi karena kunci API belum tersedia di development.


## Akun dan mitra per cabang

Login dan pendaftaran wajib memilih satu dari: Palembang Sudirman, Palembang OPI, Palembang Sako, Prabumulih, Lahat, Baturaja, Lubuk Linggau. Identitas umum aplikasi bertuliskan PalComTech; cabang aktif ditampilkan pada akun siswa. NIS unik per cabang, bukan lintas cabang. Cabang diambil dari sesi server, bukan parameter yang dapat diganti siswa untuk melihat mitra lain. Surat, daftar mitra, dan Career Match mengikuti cabang akun. Nomor surat unik per cabang.

Migrasi otomatis mempertahankan ID akun, sesi, surat, profil keahlian, dan rencana yang sudah ada; data lama ditempatkan di Lahat. Migrasi memeriksa foreign key dan membatalkan perubahan jika data lama tidak konsisten. Installer membuat backup SQLite sebelum migrasi. Jangan memindahkan akun antar-cabang secara manual tanpa meninjau kepemilikan surat dan data terkait.

Daftar 61 mitra saat ini khusus Lahat. Cabang lain awalnya kosong sampai daftar resminya dimasukkan. Untuk impor mitra atau profil pekerjaan, sertakan `"branch": "Palembang Sudirman"` (atau nama persis cabang lain) pada setiap objek JSON. Format lama tanpa `branch` tetap dianggap Lahat demi kompatibilitas. Nama mitra sama boleh muncul di beberapa cabang, masing-masing mempunyai ID sendiri. Profil pekerjaan diperbarui berdasarkan pasangan nama dan cabang.

Kop/pimpinan yang diberikan sejauh ini hanya Lahat. `public/branches.js` memuat data surat per cabang; tambahkan identitas resmi setelah dikonfirmasi. PDF cabang tanpa identitas surat ditolak dengan pesan jelas, dan pratinjau tidak memakai nama pimpinan/kontak Lahat sebagai pengganti. Daftar cabang bukan verifikasi bahwa pendaftar adalah siswa cabang tersebut; pencocokan NIS ke data akademik tetap belum tersedia.

## Profil Career Match dari Excel sementara

`scripts/career-partners-lahat.json` berisi lima profil dari file pengguna `Daftar Mitra Perusahaan untuk PKL.xlsx`: Caesar Advertising, Notaris Laogita, Badan Pusat Statistik, Badan Zakat Nasional, dan Jemmy Computer. Semuanya cabang Lahat dan menerima PKL saja. Status penerimaan/verifikasi mengikuti isian pengguna; tidak ada verifikasi eksternal yang dilakukan aplikasi. Kategori, keahlian, lokasi dan tugas dipertahankan dari workbook. Header “Contoh pengisian” pada workbook diperlakukan sebagai nama kolom; pengguna secara eksplisit meminta isi lima lembar dipakai untuk uji Career Match.

Konversi dapat diulang dengan `python3 scripts/convert-career-xlsx.py /path/input.xlsx /path/output.json` tanpa library tambahan. Formula tidak dievaluasi dan ditolak. Ejaan Web Programming dan Digital Marketing dipetakan ke ID kategori lama Web Programing dan Digital Marekting. Kategori Teknisi dan Jaringan ditambahkan berdasarkan isian Jemmy Computer. Lokasi “Kota Lahat” dan “Lahat” kini dianggap sama dengan mengabaikan awalan “Kota”; tidak ada pencarian jarak geografis.

Impor development:

```sh
npm run partners:import -- scripts/partners-palcomtech.json
node scripts/import-partner-profiles.js scripts/career-partners-lahat.json --only-missing
```

Installer VPS menjalankan dua impor tersebut otomatis setelah backup/migrasi dan sebelum service dinyalakan ulang. Opsi `--only-missing` tidak menimpa metadata yang telah diedit akademik. Untuk memperbarui profil yang sudah ada secara sengaja, gunakan perintah impor tanpa opsi tersebut, setelah meninjau perubahannya. Cabang lain dan TCS tidak diberi profil hasil tebakan.

Contoh uji: masuk cabang Lahat, buka Cari Rekomendasi Tempat PKL, pilih PKL + UI/UX Design, isi keahlian Figma dan lokasi Lahat, simpan, lalu cari mitra. Notaris Laogita akan muncul berdasarkan data ini. PKL + Web Programing menampilkan Badan Pusat Statistik. Rekomendasi tetap bukan jaminan penerimaan; konfirmasikan kembali kepada mitra.

## QR pimpinan pada surat PKL Lahat

`public/assets/signature-lahat.png` adalah gambar asli `qr.png` dari arsip `qr.rar` yang diberikan pemilik proyek. File disalin tanpa mengubah piksel; hash SHA256-nya `27a33fba18decb088fe34b09f1cede9390cd6ea4fd1b1f2c6314659ecb3f86c5`.

QR tampil di pratinjau dan PDF PKL cabang Lahat yang sudah disetujui akademik, di bawah tulisan Pimpinan dan sebelum nama Abdul Rajab, S.E. Surat TCS dan cabang lain tidak memakai gambar ini. PDF menampilkan gambar berukuran 100 pt (sekitar 35 mm), mempertahankan seluruh gambar dan rasio aslinya; blok tanda tangan dipindahkan ke halaman berikutnya bila ruang tidak cukup. Unduhan ulang PDF surat lama PKL Lahat mengikuti template terbaru, termasuk QR ini, setelah persetujuan akademik.

Ini penempatan gambar QR yang diberikan pengguna, bukan implementasi tanda tangan kriptografis atau verifikasi keaslian surat. Tujuan QR tidak dibuka otomatis oleh aplikasi. Ketentuan stempel tetap mengikuti akademik.

Tes mendekode QR asli dan hasil raster PDF untuk surat satu dan sepuluh peserta, lalu membandingkan isinya tanpa mencetak isi QR ke log. Uji raster membutuhkan `pdftoppm` (`/usr/bin/pdftoppm`, dapat diatur lewat `PDFTOPPM_PATH`), di samping prasyarat tes lain.


## Persetujuan akademik dan WhatsApp

Alur saat ini menggantikan penerbitan mandiri sebelumnya: siswa mengajukan tanpa nomor → `pending` → akademik meninjau → `approved` dengan nomor surat, atau `revision` dengan catatan wajib. Pengajuan yang direvisi diedit dan dikirim ulang pada ID/tautan yang sama. Siswa tidak dapat mengedit saat menunggu atau setelah disetujui. PDF server selalu memeriksa pemilik akun, status approved, dan nomor; QR tidak muncul pada pratinjau pending/revisi. Persetujuan berlaku untuk PKL dan TCS, dengan QR tetap hanya PKL Lahat.

Tombol **Kirim ke WhatsApp Akademik** membuka `wa.me` dengan teks **hanya URL** ke `/academic.html?request=<token-acak>`. Tidak ada pesan yang dikirim server dan aplikasi tidak mengklaim pesan terkirim/terbaca. Siswa harus menekan Kirim di WhatsApp. Nomor Lahat sementara adalah kontak akademik pada contoh Word, `0823-73725066`, disimpan sebagai `academic_whatsapp` pada `public/branches.js`. Cabang tanpa nomor WhatsApp menampilkan pesan untuk menghubungi akademik; antrean tetap tersedia di portal cabang.

Portal `/academic.html` mempunyai login **terpisah** dari siswa, akun hanya dapat dibuat operator, tidak dapat didaftarkan lewat formulir siswa. Membuka atau meneruskan tautan tidak menyetujui surat dan tidak membuka data tanpa autentikasi akademik cabang yang sama. Akademik dapat melihat antrean cabang, detail peserta/periode/kategori, catatan, dan riwayat tindakan. Keputusan menggunakan transaksi dan pemeriksaan versi untuk menolak persetujuan dari halaman usang atau nomor duplikat. Waktu, identitas pemeriksa, nomor, dan catatan dicatat pada audit. Session akademik berlaku 8 jam dan dicabut saat logout. Akun bersama sebaiknya diganti akun individual per petugas agar audit jelas.

**Pembuatan akun akademik pertama di VPS (sekali saja, sesudah deploy):**

```sh
sudo -u eduagentpct env DB_PATH=/var/lib/eduagentpct/app.sqlite /opt/node-v24.19.0/bin/node /opt/eduagentpct/current/scripts/create-academic.js --branch Lahat --username akademik.lahat --name "Akademik Lahat"
```

Perintah meminta password 12–128 karakter dua kali melalui terminal tanpa echo. Tidak ada password default, password tidak diterima lewat argumen/environment, dan hanya hash scrypt disimpan. Jangan kirim password ke chat atau Git. Username yang sudah ada tidak ditimpa. Untuk cabang lain, gunakan nama cabang persis dalam tanda kutip dan username petugas yang sesuai. Akun siswa biasa tidak dapat memberikan dirinya peran akademik. Jalankan sebagai service user agar kepemilikan SQLite/WAL tetap benar.

`PUBLIC_APP_URL` opsional menentukan origin HTTPS pada tautan; default `https://eduagentpct.my.id`. Jangan membangun URL akademik dari header Host yang dikirim klien. Status di akun siswa dimuat ulang saat tab mendapat fokus, setiap 30 detik selama terlihat, atau melalui tombol Perbarui status. Tidak ada notifikasi WhatsApp balik otomatis atau pengiriman PDF melalui WhatsApp.

**Migrasi surat lama:** semua surat yang belum mempunyai status persetujuan menjadi pending, termasuk surat yang sebelumnya diberi nomor siswa. Data/nomor lama dipertahankan untuk ditinjau, tidak dianggap otomatis sah. Akademik harus memeriksa dan menyetujui sebelum unduhan berikutnya; file yang pernah diunduh sebelumnya tidak dapat dicabut dari perangkat pengguna. Backup dibuat installer sebelum migrasi. Tidak ada akun akademik produksi yang dibuat otomatis saat deploy; buat akun pertama sebelum meminta siswa mengajukan.

Pengujian mencakup E2E dua browser siswa/akademik: ajukan → tautan WhatsApp tanpa mengirim pesan → login akademik → revisi → siswa memperbaiki pada ID sama → persetujuan dan nomor → unduh PDF. Tes API memeriksa akses lintas-cabang, upaya memalsukan status/nomor, persetujuan usang, audit, logout, dan nomor ganda. Pengiriman pesan WhatsApp nyata tidak diuji dan tidak dilakukan.

## Email persetujuan otomatis

Selain tombol WhatsApp, setiap pengajuan baru dan pengiriman ulang revisi kini membuat pekerjaan email pada tabel `academic_email_jobs` di dalam transaksi penyimpanan pengajuan. Penerima default cabang Lahat adalah **tugasbelajarpctlahat@gmail.com**, sesuai informasi pemilik proyek. Email cabang lain harus dikonfigurasi terpisah; tidak ada fallback lintas-cabang.

Email berisi tautan HTTPS `/academic.html?request=...` tanpa lampiran PDF, nama/NIS siswa, atau rincian peserta. Akademik tetap harus login pada cabang terkait dan melakukan tindakan eksplisit untuk menyetujui/mengisi nomor. WhatsApp tetap manual dan independen dari hasil email. Kegagalan SMTP tidak membatalkan pengajuan.

Service utama memproses antrean saat startup dan setiap 30 detik, maksimal 10 pekerjaan per putaran. Modul `createApp` tidak memulai pengiriman otomatis ketika dipakai CLI impor atau tes. Antrean bertahan dalam database saat proses restart. Konfigurasi tidak lengkap membuat pekerjaan blocked tanpa menghabiskan percobaan. Kegagalan SMTP dicoba ulang maksimal tiga percobaan dengan jeda 1 lalu 2 menit; setelah itu failed. Pengajuan yang sudah diputuskan atau mempunyai versi lebih baru dibatalkan notifikasinya bila belum dikirim. Tidak ada backfill otomatis untuk surat lama agar tidak tiba-tiba mengirim banyak pesan; surat lama tetap tersedia di antrean akademik/WhatsApp.

Riwayat siswa menunjukkan queued/blocked/sending/retry/failed atau submitted. Submitted berarti **server SMTP menerima alamat tujuan**, bukan bukti pesan tiba di inbox atau dibaca. Periksa spam dan reputasi pengirim. Lease 2 menit dan Message-ID stabil mengurangi pengiriman ganda pada proses normal; crash tepat setelah SMTP menerima sebelum database mencatat hasil masih bisa menyebabkan pengiriman ulang. Tidak ada klaim exactly-once atau pemantauan bounce/inbox.

### Konfigurasi di VPS

Pengiriman belum aktif sebelum alamat pengirim dan akses SMTP dipasang. Edit **file yang sudah ada** `/etc/eduagentpct.env` sebagai root dan pertahankan pengaturan AI/variabel lain. Bila file belum ada, buat dengan mode 0600 terlebih dahulu. Jangan memasukkan password ke command line, Git, screenshot atau chat.

Isi variabel berikut dengan nilai milik pengelola:

```ini
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=tugasbelajarpctlahat@gmail.com
SMTP_PASS=isi-langsung-di-VPS
MAIL_FROM=tugasbelajarpctlahat@gmail.com
```

Pemilik proyek memilih Gmail tugasbelajarpctlahat@gmail.com sebagai pengirim sekaligus penerima cabang Lahat. Gunakan **App Password** dengan verifikasi dua langkah bila akun mendukungnya, bukan password login biasa. Jika akun Workspace membatasi SMTP/App Password, gunakan konfigurasi resmi administrator atau provider SMTP lain. Port yang didukung 465 (TLS langsung) atau 587 (STARTTLS wajib), dengan pemeriksaan sertifikat tetap aktif. Untuk provider lain sesuaikan host/port. MAIL_FROM harus alamat pengirim yang diizinkan akun SMTP, tanpa display name.

Penerima Lahat sudah disimpan pada konfigurasi cabang. Opsional override lewat `ACADEMIC_EMAIL_LAHAT`; untuk beberapa cabang gunakan `ACADEMIC_EMAILS_JSON` berisi objek nama cabang → satu alamat email. Override JSON memiliki prioritas tertinggi. Jangan memakai alamat tujuan yang dikirim browser siswa sebagai penerima.

Sesudah menyimpan: `sudo chmod 600 /etc/eduagentpct.env` dan `sudo systemctl restart eduagentpct`. Pastikan koneksi SMTP keluar diizinkan provider VPS. Uji dengan **satu pengajuan baru** milik siswa uji, lihat status di riwayat, periksa inbox/spam, dan buka tautan melalui akun akademik yang benar. Jangan menganggap pengiriman nyata berhasil hanya dari tes simulasi. Tidak ada SMTP credential di development saat implementasi, jadi pengiriman email asli belum diverifikasi.

Tes memakai transport SMTP simulasi: transaksi pengajuan tetap tersimpan, pemetaan cabang, notifikasi ulang revisi, pengabaian pekerjaan usang, antrean setelah restart, retry terbatas, ketiadaan konfigurasi, serta tidak bocornya error/kredensial provider pada status siswa. Tes tidak mengirim email kepada orang lain.


## Tujuan instansi/perusahaan Lainnya

Opsi terakhir pada daftar tujuan adalah **Lainnya — ketik sendiri**. Pilihan ini membuka nama instansi/perusahaan wajib, maksimum 150 karakter. Isian boleh diajukan pada cabang yang belum mempunyai daftar mitra. Nama disimpan per surat sebagai `custom_partner_name`, dengan `partner_id` NULL; tidak membuat entri mitra resmi atau profil rekomendasi.

Nama tujuan tampil pada pratinjau, riwayat siswa, portal akademik dan PDF yang disetujui. Portal akademik menandainya sebagai isian siswa yang perlu diverifikasi, dengan sapaan umum Pimpinan pada surat. Alur nomor, revisi, persetujuan, WhatsApp/email dan pembatasan PDF tetap berlaku. Mengganti pilihan ke mitra resmi mengabaikan isian tujuan manual. Siswa tidak dapat menunjuk ID mitra cabang lain melalui API.

Migrasi mempertahankan seluruh kolom, ID, indeks dan referensi surat lama saat mengubah partner_id agar dapat kosong; perubahan dibatalkan jika foreign key tidak valid. Tes memeriksa surat disetujui, audit dan antrean email sebelum/sesudah migrasi, serta pengajuan manual melalui browser hingga PDF. Cabang tanpa identitas kop/pimpinan tetap perlu melengkapi konfigurasi sebelum dapat menghasilkan PDF.

Nama menu/judul sekarang **Cari Rekomendasi Tempat PKL** dan label panel pencocokan **Rekomendasi Mitra PKL**. Nama endpoint/internal tidak berubah.

## PDF amplop surat

Surat yang sudah disetujui mempunyai tombol **PDF Surat** dan **PDF Amplop** di riwayat siswa. Endpoint `/api/letters/:id/envelope.pdf` memakai pemeriksaan persetujuan, nomor, kepemilikan akun, dan identitas cabang yang sama dengan PDF surat; pending/revisi ditolak. Tidak diperlukan persetujuan terpisah untuk amplop. PKL maupun TCS mengikuti jenis suratnya.

Draf amplop memakai format DL landscape 220 × 110 mm, satu halaman: logo asli PalComTech dan identitas pengirim di kiri atas, kotak perangko di kanan atas, penerima/instansi di kanan bawah, serta perihal dan nomor di kiri bawah. Tujuan manual Lainnya juga didukung, dengan sapaan Pimpinan. Alamat penerima memakai “Di Tempat” karena data alamat pos belum tersedia; jangan menganggapnya cukup untuk pengiriman lewat pos sebelum melengkapi alamat fisik. QR pimpinan tidak dicetak pada amplop.

Cetak pada media DL dengan **Actual size / 100%**, tanpa Fit to page. Sesuaikan arah pemasukan amplop dengan printer dan uji pada kertas biasa terlebih dahulu. Ini layout untuk dicetak pada amplop jadi, bukan pola potong/lipat amplop dari kertas A4. Gunakan printer yang mendukung ukuran amplop tersebut.

Tes memeriksa unduhan lewat browser setelah approval, penolakan akun lain/pending, logo tertanam, ukuran PDF, satu halaman untuk nama panjang, dan nama tujuan resmi/manual. Hasil cetak fisik di printer pengguna belum diuji.
