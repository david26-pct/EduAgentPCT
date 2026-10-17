# Deployment Notes

Dokumen ini menerangkan **apa yang dilakukan installer**, bukan laporan deployment live. Domain pada script adalah `eduagentpct.my.id`; source tidak mencantumkan IP VPS, password SSH, atau alias `eduagent.my.id`.

## Konfigurasi proses dan lokasi

| Item | Nilai source |
| --- | --- |
| Runtime | Node 24.19.0, x86_64 Linux |
| Backend | HOST=127.0.0.1, PORT=3000 |
| Service | eduagentpct.service; user/group eduagentpct |
| Code/release | `/opt/eduagentpct/releases/<timestamp>-<pid>` |
| Release aktif | `/opt/eduagentpct/current` symlink |
| Database | `/var/lib/eduagentpct/app.sqlite` |
| Env opsional | `/etc/eduagentpct.env` |
| Nginx | `/etc/nginx/sites-available/eduagentpct` + symlink sites-enabled |
| Backup lokal | `/var/backups/eduagentpct/pre-deploy-*.sqlite` |
| Sertifikat | `/etc/letsencrypt/live/eduagentpct.my.id/` |

Installer memakai apt-get, sehingga petunjuk praktisnya membutuhkan OS keluarga Debian/Ubuntu dengan systemd. Source memeriksa root dan arsitektur; tidak memverifikasi release Ubuntu tertentu atau kapasitas RAM/disk.

## Tahapan installer

1. Menolak menimpa file Nginx aplikasi yang tidak memiliki penanda pengelola.
2. Memasang prasyarat OS; mengunduh Node resmi melalui HTTPS dan memeriksa SHA256 dari manifest resmi.
3. Membuat user/state directory; menyalin modul root yang didaftarkan dan public/scripts ke release.
4. `npm ci --omit=dev --ignore-scripts` untuk dependency runtime.
5. Backup SQLite jika DB ada, kemudian menghentikan service untuk migrasi/impor.
6. CLI impor menambahkan 61 mitra; impor 5 profil memakai --only-missing agar edit operator tidak ditimpa.
7. Mengganti current, menulis unit systemd, menjalankan/restart service dan health lokal.
8. Menyediakan challenge ACME; menerbitkan sertifikat jika file sertifikat belum ada.
9. HTTPS 443 + redirect 80; proxy header Host/proto dan X-Forwarded-For=$remote_addr.
10. Renewal hook me-reload Nginx; certbot.timer diaktifkan. Health HTTPS dan teks login diperiksa.

Hardening unit: NoNewPrivileges, PrivateTmp, ProtectHome, ProtectSystem=strict, ReadWritePaths hanya state directory, UMask=0077. Backend memercayai proxy loopback hanya bila TRUST_LOCAL_PROXY=1. Tidak ditemukan konfigurasi firewall atau provisioning DNS otomatis.

## Environment aplikasi

| Nama | Fungsi/default |
| --- | --- |
| HOST / PORT | Bind loopback / 3000 |
| DB_PATH | Path SQLite; default folder data proyek |
| NODE_ENV | production mengaktifkan Secure cookie |
| TRUST_LOCAL_PROXY | 1 mengaktifkan trust proxy loopback |
| PUBLIC_APP_URL | Origin HTTPS tautan review; default https://eduagentpct.my.id |
| AI_API_KEY / AI_MODEL | Rencana AI; default model gpt-4.1-mini |
| SMTP_HOST / SMTP_PORT | SMTP; default port kode 587; hanya 465/587 diterima |
| SMTP_USER / SMTP_PASS / MAIL_FROM | Credential SMTP dan alamat pengirim yang diizinkan |
| ACADEMIC_EMAIL_LAHAT | Override penerima Lahat |
| ACADEMIC_EMAILS_JSON | Pemetaan penerima per cabang, prioritas atas override Lahat/default cabang |

File .env.example adalah contoh; Node tidak memuatnya otomatis. systemd memuat `/etc/eduagentpct.env`. Tulis nilai rahasia langsung di server dengan akses terbatas; jangan menyalin nilai ke knowledge atau Git.

## Perintah operasional yang didukung source

Pengembangan:

```sh
npm ci --cache /workspace/.npm-cache --ignore-scripts
npm start
```

Instalasi dari checkout yang sudah disiapkan pada VPS:

```sh
sudo bash deploy/install-vps.sh
```

Membuat akun akademik (sekali per username/cabang, password diminta interaktif):

```sh
sudo -u eduagentpct env DB_PATH=/var/lib/eduagentpct/app.sqlite /opt/node-v24.19.0/bin/node /opt/eduagentpct/current/scripts/create-academic.js --branch Lahat --username akademik.lahat --name "Akademik Lahat"
```

Pemeriksaan operator di VPS, tidak dijalankan sebagai bagian dokumentasi ini:

```sh
sudo systemctl is-active eduagentpct
sudo journalctl -u eduagentpct -n 50 --no-pager
curl --fail https://eduagentpct.my.id/api/health
sudo certbot renew --dry-run
```

Periksa output sebelum membagikannya dan jangan menampilkan env/credential. Health OK tidak membuktikan SMTP/AI siap. Uji inbox, approval, dan PDF melalui akun sah.

## Batas operasi

Backup yang dikodekan hanya lokal dan sebelum deploy, belum ada offsite/schedule retention. Release lama dipertahankan, tetapi tidak ada rollback otomatis setelah health gagal dan tidak ada down migration. Import gagal mencoba menyalakan kembali service lama; rollback kode setelah perubahan schema belum tentu kompatibel. Tidak ada akun akademik default atau SMTP/API key dalam installer.

Sumber: [installer](../../deploy/install-vps.sh), [server.js](../../server.js), [.env.example](../../.env.example), [CLI akun](../../scripts/create-academic.js), [petunjuk proyek](../../deploy/README.md).
