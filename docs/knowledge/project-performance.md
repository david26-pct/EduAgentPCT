# Project Performance — Ringkasan Manajemen

## Status delivery berbasis bukti

| Area | Status source | Apa yang belum dibuktikan |
| --- | --- | --- |
| Pengajuan dan approval | Implementasi + tes API/browser | Penggunaan produksi terakhir |
| Pemisahan cabang | Implementasi + tes isolasi/migrasi | Isi akun/mitra aktual setiap cabang VPS |
| Surat, QR, amplop | Implementasi + tes PDF/QR/dimensi | Hasil printer fisik dan konfigurasi semua cabang |
| WhatsApp | Link dibuat dan diuji | Pengiriman/delivery pesan nyata; server tidak mengirim |
| Email otomatis | Queue dan transport simulasi diuji | Login SMTP dan inbox nyata |
| Rekomendasi | Rule-based + 5 profil seed diuji | Kualitas kecocokan terhadap evaluasi akademik di lapangan |
| AI rencana belajar | Jalur provider dan kegagalan disimulasikan | Provider/model/saldo aktual dan mutu jawaban nyata |
| Chatbot | Panduan statis | Belum ada percakapan model |
| Deployment | Installer tersedia | Version/hash/health/sertifikat VPS sekarang |

## Hasil pemeriksaan lokal

`npm test`: **16 test, 16 pass, 0 fail, 0 skipped**, durasi runner sekitar **9,23 detik** pada pemeriksaan 2026-10-17. Detail: [verification](evidence/verification.md). Durasi satu run ini bukan benchmark aplikasi dan tidak setara waktu respons pengguna.

## Parameter performa yang benar-benar ada pada konfigurasi

| Parameter | Nilai source | Makna |
| --- | --- | --- |
| JSON body Express | 32 KB | Batas payload parser |
| Nginx body | 64 KB | Batas proxy; parser backend tetap lebih kecil |
| API rate limit umum | 150/menit | Batas request, bukan kapasitas layanan |
| Auth siswa | 20/15 menit | Limit middleware register/login yang sama |
| Auth akademik | 15/15 menit | Limit login akademik |
| Rencana belajar | 10/menit | Limit endpoint plan; AI juga 3 percobaan/hari UTC/siswa |
| Output AI | 1.200 token, timeout 30 detik | Batas permintaan, bukan SLA |
| Email worker | Startup + tiap 30 detik, 10 job/putaran | Maksimum batch yang diambil; bukan jaminan delivery 30 detik |
| Lease email | 120 detik | Pemulihan job sending yang ditinggalkan |
| Frontend polling | 30 detik saat tab terlihat, juga saat fokus | Bukan push/WebSocket |
| SQLite | WAL; busy_timeout 5.000 ms | Pengaturan konkurensi SQLite, bukan bukti throughput |

## Data manajemen yang tidak tersedia

Tidak ditemukan target SLA/SLO, p95/p99 latency, concurrency benchmark, uptime, jumlah pengguna aktif, volume email, anggaran/token aktual, persentase penyelesaian proyek, tim/PIC resmi, biaya VPS, timeline atau deadline proyek. Dokumen ini tidak mengisi angka perkiraan untuk menggantikannya.

Untuk pekerjaan tersisa berbasis source, lihat [fitur belum selesai](features-incomplete.md) dan [technical debt](bug-technical-debt.md). Keduanya bukan sprint backlog yang sudah disepakati.

Sumber: [server.js](../../server.js), [career.js](../../career.js), [mail.js](../../mail.js), [frontend](../../public/app.js), [installer](../../deploy/install-vps.sh), [evidence](evidence/verification.md).
