# Decision Log

Catatan keputusan implementasi yang dapat dibuktikan dari kode dan riwayat Git. Ini bukan notulen rapat: penanggung jawab, alasan bisnis awal, tenggat dan keputusan yang hanya ada dalam percakapan tidak direkonstruksi.

| ID | Keputusan/hasil implementasi | Jejak | Konsekuensi yang tampak |
| --- | --- | --- | --- |
| D-01 | Web statis + Express + SQLite | b704523; server.js/package.json | Satu proses aplikasi; belum ada klien native/PostgreSQL |
| D-02 | Kategori PKL/TCS disimpan bersama pengajuan | 639c2ef; request-options.js | Dokumen menyesuaikan jenis kegiatan |
| D-03 | Rekomendasi rule-based terpisah dari rencana AI | 4605a16; career.js | Matching tidak memerlukan API key; rencana AI opsional dengan consent/kuota |
| D-04 | Tujuh cabang dan keunikan per cabang | 996ecc1; branch-migration.js | NIS/nomor boleh sama pada cabang berbeda; legacy dipetakan Lahat |
| D-05 | Profil rekomendasi berasal dataset terkontrol | 207df90; career-partners-lahat.json | Hanya 5 profil PKL Lahat dalam seed |
| D-06 | QR gambar hanya untuk PKL Lahat | 14f426b; getSignatureQR | Tidak diterapkan TCS/cabang lain; bukan signature kriptografis |
| D-07 | Nomor dan PDF memerlukan approval akademik | 08c453f; approvals.js/server.js | Siswa tidak lagi menerbitkan nomor sendiri; legacy menunggu pemeriksaan |
| D-08 | Notifikasi email memakai antrean SQLite | d0dc747; mail.js | Pengajuan tidak menunggu SMTP; retry/lease disimpan |
| D-09 | Alamat email default Lahat diganti | 6e16b3f; branches.js | Default tugasbelajarpctlahat@gmail.com; runtime override tetap mungkin |
| D-10 | Tujuan manual disimpan per surat | 2c55f4d; custom_partner_name | Tidak otomatis membuat mitra resmi atau profil rekomendasi |
| D-11 | Amplop menjadi PDF terpisah | b98653a; envelope endpoint | Ukuran DL; akses sama dengan surat approved |

Hash pada tabel dapat dicari dengan `git show <hash>` pada riwayat lokal. Urutan ID merangkum keputusan, bukan tanggal rilis produksi.

Sumber: `git log` snapshot, [server.js](../../server.js), [career.js](../../career.js), [approvals.js](../../approvals.js), [mail.js](../../mail.js), [branches.js](../../public/branches.js).
