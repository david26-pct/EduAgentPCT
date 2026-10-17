# Bug / Technical Debt

Temuan berikut berasal dari inspeksi statis. Selain tes pada [verification](evidence/verification.md), tidak dilakukan eksploitasi, benchmark, atau audit produksi.

## Ketidaksesuaian yang terlihat langsung

| ID | Temuan | Evidence dan batas |
| --- | --- | --- |
| B-01 | Panduan chatbot menyatakan rekomendasi belum aktif karena profil mitra belum lengkap, sementara source mempunyai matcher dan 5 profil seed | `public/chatbot.js` key partner vs `career.js` dan `scripts/career-partners-lahat.json`. Ketidaksesuaian copy, bukan bukti matcher gagal |
| B-02 | Panduan kategori chatbot belum memuat Teknisi dan Jaringan | `public/chatbot.js` key category vs `public/request-options.js` |
| B-03 | Metadata `main` menunjuk index.js yang tidak ada | `package.json` main=index.js; entry aktual npm start=node server.js. `npm start` tidak bergantung main ini |

Tidak ada assertion gagal dalam pemeriksaan tes lokal terakhir. Tidak berarti tidak ada bug lain.

## Technical debt yang dapat ditelusuri

| Area | Kondisi source | Dampak/risk yang belum diukur |
| --- | --- | --- |
| Performa server | DatabaseSync dan scryptSync di request; PDF dibuat per unduhan | Pekerjaan sinkron berpotensi menahan event loop; belum ada profil beban |
| Daftar data | Riwayat siswa/akademik tanpa pagination; status email dibaca per pending letter | Payload/query bertambah dengan jumlah pengajuan; tidak ada batas kapasitas terukur |
| Indeks | Tidak ditemukan indeks khusus letters.student_id, letters.branch, partners.branch atau pencarian antrean state/next_at | Optimasi belum dibuktikan perlu oleh EXPLAIN/benchmark |
| Rate limiting | express-rate-limit memakai store bawaan; tidak ada store terdistribusi | Tidak ada bukti koordinasi rate limit multi-instance |
| Migrasi | DDL startup dan inspeksi kolom; tidak ada migration ledger versi | Perubahan schema perlu diuji dengan bentuk data lama yang didukung |
| Integritas domain | branch/status JSON/config dan beberapa actor ID tidak dilindungi FK/CHECK | Validasi aplikasi penting; akses SQL langsung dapat melampaui aturan |
| Operasional email | Job gagal setelah 3 percobaan; tidak ada UI requeue; last_code umum | Diagnosis perlu pemeriksaan operator; tidak ada status inbox/bounce |
| Jaminan email | SMTP + DB tidak satu transaksi eksternal | Crash sesudah SMTP menerima sebelum pencatatan bisa mengirim ulang |
| Deployment | current diganti sebelum seluruh health/TLS check; tidak ada rollback otomatis sesudah gagal health | Release dan schema perlu ditinjau operator sebelum rollback; code lama belum tentu kompatibel dengan schema baru |
| Backup | Installer membuat backup lokal sebelum deploy | Tidak ditemukan jadwal backup eksternal/retention/restore otomatis |
| Otorisasi dan identitas | Tidak ada verifikasi NIS, MFA, reset password, CSRF token khusus; Origin diperiksa bila header ada | Fitur keamanan tersebut belum diimplementasikan; bukan hasil pentest |
| Persetujuan | Tidak ada pencabutan approved atau penghapusan/pembatalan pengajuan melalui API | Koreksi pasca-approval belum mempunyai alur resmi |
| Artefak dokumen | PDF dihasilkan ulang dari template saat diunduh | Tidak ditemukan penyimpanan immutable file PDF yang pertama kali diterbitkan |

Sumber: [server.js](../../server.js), [schema](evidence/schema.sql), [mail.js](../../mail.js), [branch-migration.js](../../branch-migration.js), [installer](../../deploy/install-vps.sh), [package.json](../../package.json), [chatbot](../../public/chatbot.js).
