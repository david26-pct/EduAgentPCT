# Project Overview

EduAgentPCT adalah aplikasi web responsif untuk pengajuan surat PKL/TCS siswa PalComTech. Siswa mendaftar pada cabang, memilih tujuan dan peserta, mengajukan pemeriksaan akademik, lalu mengunduh surat/amplop setelah persetujuan dan penerbitan nomor.

## Cakupan yang ditemukan

- Antarmuka siswa pada `/`; antarmuka akademik pada `/academic.html`.
- Tujuh cabang: Palembang Sudirman, Palembang OPI, Palembang Sako, Prabumulih, Lahat, Baturaja, Lubuk Linggau.
- Jenis kegiatan: PKL = Praktik Kerja Lapangan; TCS = Thread Case Study, sesuai literal kode.
- Label rekomendasi: **Cari Rekomendasi Tempat PKL** dan **Rekomendasi Mitra PKL**.
- Profil keahlian, rekomendasi mitra berbobot, rencana belajar template, dan jalur rencana belajar melalui OpenAI.
- Notifikasi WhatsApp manual serta antrean email SMTP otomatis.

## Batas data bawaan

File `scripts/partners-palcomtech.json` berisi **61 mitra Lahat**. File `scripts/career-partners-lahat.json` berisi **5 profil mitra Lahat untuk PKL**. Jumlah file seed ini bukan jumlah baris database produksi.

Identitas kop, pimpinan, email akademik, dan nomor WhatsApp yang dikonfigurasi pada `LETTERHEADS` baru untuk Lahat. Surat cabang tanpa kop dikonfigurasi ditolak saat unduhan. Gambar QR hanya untuk PKL Lahat.

## Produk yang belum ada pada source

Tidak ditemukan klien Flutter, paket Android/iOS/Windows/macOS, atau service PostgreSQL. Tampilan Chatbot AI adalah panel panduan statis; tidak ada endpoint percakapan AI. Lihat [fitur belum selesai](features-incomplete.md).

Sumber: [index.html](../../public/index.html), [branches.js](../../public/branches.js), [request-options.js](../../public/request-options.js), [server.js](../../server.js), [seed mitra](../../scripts/partners-palcomtech.json), [seed profil](../../scripts/career-partners-lahat.json).
