# Verification — Bukti dan batas pemeriksaan

- Tanggal: 2026-10-17.
- Source aplikasi: `b98653a0cf2c17cc20d28780452184d991019556`.
- Cakupan: tracked source, manifest/lockfile, installer, seed JSON, dan file tes pada checkout.
- Tidak menggunakan klaim percakapan untuk menetapkan status produksi.
- Tidak membaca file credential, isi database pengguna, atau environment VPS.

## Pemeriksaan yang dilakukan

| Pemeriksaan | Hasil |
| --- | --- |
| `npm test` (`node --test`) | Exit 0; 16 tests, 16 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo |
| Durasi satu run | 9228.237362 ms menurut runner; bukan benchmark/SLA |
| Schema sementara | 12 tabel, dibangun melalui createApp dan migrasi pada SQLite sementara |
| Constraint | Kolom, FK dan indeks dibaca dari PRAGMA pada DB sementara, lalu DB dihapus |
| Seed | 61 mitra; 5 profil rekomendasi, seluruhnya Lahat dan PKL pada file JSON |
| Endpoint | Diinventarisasi dari handler Express dan router akademik |
| Dependency | Versi resolusi dibaca dari package-lock.json |
| Inventaris endpoint | 22 method/path cocok dengan tabel API; tidak ada endpoint source yang terlewat |
| Link Markdown lokal | 106 referensi relatif diperiksa, tidak ada target yang hilang |
| DDL mandiri | schema.sql berhasil dimuat pada SQLite memory, menghasilkan 12 tabel |

## Tes yang ditemukan dan dijalankan

| File | Cakupan |
| --- | --- |
| test/app.test.js | Auth siswa, validasi pengajuan/PDF, akses akun, migrasi lama |
| test/approvals.test.js | Auth/cabang akademik, revisi, approve, versi, nomor unik, audit |
| test/branches.test.js | Cabang, NIS/nomor sama, isolasi, sesi/profil lama |
| test/browser.test.js | Browser desktop/mobile, profil, revisi lintas dua browser, approval, surat/amplop |
| test/career.test.js | Profil privat, metadata mitra, skor, consent/kuota, kegagalan AI simulasi |
| test/custom-partner.test.js | Tujuan manual, revisi, approval, PDF, migrasi audit/email |
| test/envelope.test.js | Approval/pemilik, format DL, satu halaman, logo/nama panjang |
| test/mail.test.js | Queue, restart, mapping cabang, retry dan error transport simulasi |
| test/partners.test.js | Impor ulang 61 mitra tanpa menggandakan data |
| test/signature.test.js | QR asli dan raster PDF, PKL Lahat, surat panjang |
| test/workbook-career.test.js | Lima profil sumber Excel, hasil rekomendasi dan pemilihan mitra |

## Hal yang tidak diverifikasi

- Akses aktual domain, DNS, IP VPS, sertifikat live dan commit service saat ini.
- Inbox email nyata, App Password, kredensial provider dan kuota produksi.
- Permintaan OpenAI nyata; jalur provider pada tes memakai simulasi.
- Pesan WhatsApp terkirim atau dibaca; pengiriman memang manual.
- Hasil printer, beban bersamaan, keamanan menyeluruh, uptime dan disaster recovery.

Schema tanpa baris pengguna tersedia di [schema.sql](schema.sql). Sumber kode schema: [server](../../../server.js), [branch migration](../../../branch-migration.js), [approval](../../../approvals.js), [career](../../../career.js), [email](../../../mail.js).
