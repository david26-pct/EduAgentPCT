# Deployment ke VPS

Target yang diminta: Ubuntu 22.04, 2 vCPU / 2 GB RAM / 40 GB SSD, domain `eduagentpct.my.id`. Tidak ada password atau kunci akses di paket ini.

## Status

Instalasi remote belum dijalankan. SSH ke port 22 IP yang diberikan menolak koneksi. Paket disiapkan untuk ditinjau; skrip baru diperiksa sintaksnya, belum diuji di VPS. Perubahan produksi hanya mencakup versi web awal, bukan Flutter/login Google.

## Prasyarat

- Konfirmasikan port SSH dari panel Sumopod dan buka akses SSH pada firewall VPS/provider.
- A record `@` harus mengarah ke IP publik VPS, TTL misalnya 300. Hapus atau perbaiki AAAA jika IPv6 VPS belum dikonfigurasi.
- Port TCP 80 dan 443 harus terbuka untuk HTTPS dan validasi Let's Encrypt. Jangan membuka port backend 3000 ke publik.
- Konfirmasikan arsitektur x86_64 dan tidak ada layanan lain memakai port 3000/80/443. Periksa `sudo ss -ltnp` sebelum instalasi.
- Gunakan SSH host key yang telah dikonfirmasi lewat console/provider dan credential yang disampaikan melalui mekanisme aman. Jangan menyimpan password dalam script atau command line.

## Transfer dan pemasangan

Paket dapat dibangun dari checkout menggunakan:

```sh
tar -czf /workspace/artifacts/eduagentpct-deploy.tar.gz package.json package-lock.json server.js career.js branch-migration.js approvals.js mail.js public deploy scripts
```

Transfer paket ke home pengguna VPS melalui SCP dengan port SSH yang dikonfirmasi. Di VPS, ekstrak ke direktori kosong, baca skripnya, lalu jalankan `sudo bash deploy/install-vps.sh` dari direktori hasil ekstraksi.

Skrip memasang Node.js 24.19.0 dari sumber resmi HTTPS dan memeriksa SHA256, Nginx, SQLite CLI, dan Certbot; membuat service non-root; menyimpan database terpisah di `/var/lib/eduagentpct`; menerbitkan HTTPS untuk domain utama; dan mempertahankan release sebelumnya. Daftar 61 mitra yang diberikan pemilik proyek diimpor otomatis setelah backup menggunakan akun service, tanpa menggandakan nama atau mengganti data lama. Dependensi npm dipasang dengan lockfile, tanpa development dependencies dan tanpa lifecycle scripts. Konfigurasi Nginx lain tidak dihapus. File konfigurasi EduAgentPCT yang sudah ada hanya ditimpa jika memiliki penanda milik aplikasi. Jika instalasi gagal, jangan klaim deployment selesai; periksa pesan dan service.

Penerbitan sertifikat menggunakan akun ACME tanpa email. Tambahkan email administrator kemudian melalui Certbot agar mendapat pemberitahuan. Jangan menonaktifkan verifikasi TLS untuk mengatasi kegagalan sertifikat.

## Validasi dan pemeliharaan

- `systemctl status eduagentpct nginx` dan `journalctl -u eduagentpct -n 50 --no-pager`.
- HTTPS `/api/health` menghasilkan status ok, root menampilkan halaman masuk, HTTP mengarah ke HTTPS.
- Uji daftar/login/logout melalui browser, Secure cookie, serta pembuatan surat dan unduhan PDF setelah impor mitra resmi. Jangan memasukkan data contoh ke database produksi.
- Impor mitra lewat `DB_PATH=/var/lib/eduagentpct/app.sqlite` dengan akses service user, menggunakan script `scripts/import-partners.js` dari checkout yang sesuai. Jangan mengubah kepemilikan file database menjadi root.
- `sudo certbot renew --dry-run` untuk menguji pembaruan sertifikat.
- Gunakan backup SQLite yang konsisten, salin secara aman ke penyimpanan di luar VPS, dan uji pemulihannya. Backup sebelum deploy pada skrip hanyalah backup lokal.
- Rollback: pilih release lama di `/opt/eduagentpct/releases`, arahkan symlink `current` kepadanya, lalu restart service. Jangan menimpa database dengan backup lama tanpa meninjau kehilangan data baru.

Untuk produksi penuh masih diperlukan verifikasi NIS, kebijakan privasi, reset password, dan pemeriksaan identitas/kop surat oleh akademik. Aplikasi saat ini belum mengecek nomor surat manual terhadap arsip akademik.

Sesudah memasang versi approval, buat akun akademik melalui perintah interaktif pada README utama. Akun tidak dibuat otomatis. Pengajuan/surat lama menjadi menunggu pemeriksaan dan tidak bisa diunduh sebelum disetujui; informasikan perubahan alur kepada akademik.

Email otomatis memakai nodemailer melalui SMTP TLS dan tabel antrean persisten. Deploy tidak membuat/mengubah credential SMTP. Pengaturan pengirim harus diisi aman di `/etc/eduagentpct.env`; penerima default Lahat tugasbelajarpctlahat@gmail.com. Tanpa konfigurasi SMTP, pengajuan tetap tersimpan dan WhatsApp tetap tersedia. Lihat README utama untuk aktivasi dan uji inbox nyata.
