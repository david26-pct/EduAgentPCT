# Fitur yang sudah selesai pada source

“Selesai” di halaman ini berarti diimplementasikan dan/atau dicakup tes lokal, bukan konfirmasi aktivasi produksi. Lihat [verification](evidence/verification.md).

| Fitur | Implementasi | Evidence utama |
| --- | --- | --- |
| Web siswa responsif dan branding PalComTech | Login, dashboard, form, riwayat, logo | `public/index.html`, `public/app.js`, `test/browser.test.js` |
| Akun tujuh cabang | NIS per cabang, sesi siswa/akademik terpisah | `server.js`, `approvals.js`, `test/branches.test.js` |
| Pengajuan PKL/TCS | Kategori, periode, peserta, tujuan resmi/manual | `server.js`, `test/app.test.js`, `test/custom-partner.test.js` |
| Persetujuan akademik | Nomor, revisi, versi, audit, antrean cabang | `approvals.js`, `public/academic.js`, `test/approvals.test.js` |
| WhatsApp | Link pemeriksaan melalui tombol wa.me | `approvals.js`, `test/browser.test.js` |
| Antrean email otomatis | SMTP TLS, retry, lease, status siswa | `mail.js`, `test/mail.test.js`; transport simulasi |
| Surat PDF dan QR | A4, logo, PKL Lahat approved | `server.js`, `test/signature.test.js` |
| Amplop PDF | DL satu halaman, logo, nomor, tujuan | `server.js`, `test/envelope.test.js` |
| Profil keahlian dan rekomendasi | Rule-based sesuai metadata mitra | `career.js`, `test/career.test.js`, `test/workbook-career.test.js` |
| Rencana belajar dasar | Template 14 hari per kategori | `career.js`, `public/career.js` |
| Jalur rencana AI | Responses API, consent, kuota, penanganan error | `career.js`, `test/career.test.js`; API simulasi |
| Tool operator dan migrasi | Akun akademik, impor, data lama | `scripts/`, `branch-migration.js`, tes migrasi |
| Instalasi VPS | Release, systemd, Nginx, Certbot, backup | `deploy/install-vps.sh`; bukan bukti deploy terakhir |

Dataset terkontrol source: 61 mitra Lahat, 5 profil rekomendasi PKL Lahat. Tidak menyatakan dataset aktual VPS sama.

Sumber: file yang tercantum pada tabel, [direktori tes](../../test), [package.json](../../package.json).
