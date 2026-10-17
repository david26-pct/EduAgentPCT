# EduAgentPCT — Project Knowledge

[Dokumen lengkap dalam satu file](../PROJECT-MANAGER-PERFORMANCE.md)

Dokumentasi manajemen proyek dan teknis berdasarkan source code serta konfigurasi yang ada. Bahasa dokumentasi: Indonesia.

- Tanggal pemeriksaan: **2026-10-17**.
- Snapshot aplikasi: `b98653a0cf2c17cc20d28780452184d991019556`.
- Titik navigasi: [MOC](MOC.md).
- Ringkasan pengelolaan dan batas bukti performa: [Project Performance](project-performance.md).
- Evidence: [pemeriksaan](evidence/verification.md), [schema SQL](evidence/schema.sql).

## Cara membaca status

| Istilah | Arti |
| --- | --- |
| Diimplementasikan | Ada alur source code yang mendukung fitur |
| Diuji lokal | Ada tes yang dijalankan pada pemeriksaan ini |
| Bergantung konfigurasi | Memerlukan credential/data/operator di lingkungan tujuan |
| Tidak ditemukan | Tidak ada implementasinya dalam snapshot yang diperiksa |
| Belum diverifikasi | Source dan tes lokal tidak membuktikan kondisi produksi |

**Dokumentasi ini tidak menyatakan VPS terbaru sudah menjalankan commit tersebut, SMTP berhasil masuk inbox, API AI aktif, atau kapasitas pengguna tertentu tercapai.** Konfigurasi runtime dan rahasia VPS tidak dibaca.

Nama/domain yang dapat dibuktikan: paket `eduagentpct`, repositori `david26-pct/EduAgentPCT`, domain installer `eduagentpct.my.id`. Teks permintaan `eduagent.my.id` tidak ditemukan sebagai domain aplikasi pada konfigurasi yang diperiksa.

## Pemeliharaan

Perbarui catatan yang terdampak saat source berubah, sertakan sumber dan hasil pemeriksaannya. Pisahkan temuan statis, hasil tes lokal, dan observasi produksi. Jangan menyalin database pengguna, password, token sesi, App Password atau API key ke dokumentasi.

Sumber utama: [package.json](../../package.json), [server.js](../../server.js), [installer](../../deploy/install-vps.sh).
