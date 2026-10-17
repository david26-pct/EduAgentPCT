# Business Rules

## Akun dan cabang

1. Cabang wajib salah satu nilai pada `BRANCHES`; NIS unik per cabang.
2. Pendaftaran siswa: nama 1–100 karakter; NIS 3–30 digit; password 10–128 karakter. Konfirmasi password diperiksa frontend.
3. Login siswa memerlukan cabang, nama, NIS, password; pencocokan nama mengabaikan kapitalisasi.
4. Cabang untuk akses mitra/rekomendasi berasal dari sesi server. Data lama dipetakan ke Lahat oleh migrasi.

## Pengajuan dan dokumen

1. Pilih PKL/TCS dan kategori pada konfigurasi. Tujuh kategori aktual mencakup literal `Web Programing`, `Digital Marekting`, dan `Teknisi dan Jaringan`.
2. Peserta 1–10; nama pemilik akun wajib tercantum (pencocokan nama, bukan verifikasi NIS peserta lain).
3. Tanggal `YYYY-MM-DD` harus valid; mulai tidak boleh setelah selesai. Tidak ada aturan tambahan terhadap tanggal terbit yang ditemukan.
4. Tujuan adalah ID mitra cabang atau `partner_id=null` + `custom_partner_name` 1–150 karakter. Isian manual tidak menjadi mitra resmi; sapaan default Pimpinan.
5. Siswa tidak dapat mengisi nomor; status awal pending. Hanya revision dapat diedit/dikirim ulang pada ID yang sama.
6. Akademik cabang yang cocok menyetujui dengan nomor 1–80 karakter, atau meminta revisi dengan catatan wajib maksimum 1.000 karakter.
7. Nomor unik per cabang. Keputusan harus membawa versi terbaru; keputusan stale/sudah diproses ditolak.
8. PDF surat A4 dan amplop DL 220 × 110 mm memerlukan approved + nomor + kepemilikan + kop cabang.
9. QR gambar pimpinan hanya PKL Lahat yang sudah approved; bukan signature kriptografis. Amplop tidak memakai QR.
10. Nama peserta dan tujuan pada PDF berasal dari data pengajuan. Alamat amplop memakai Di Tempat; tidak ada alamat pos mitra pada model data saat ini.

## Notifikasi

- WhatsApp dibuka siswa; isi chat hanya tautan HTTPS pemeriksaan. Aplikasi tidak mengirim pesan melalui WhatsApp API.
- Email dijadwalkan setiap pengajuan baru/resubmission. Link tidak otomatis memberi persetujuan.
- Maksimum 3 percobaan SMTP; retry setelah kegagalan pertama 1 menit, setelah kedua 2 menit. Missing config tidak menghabiskan percobaan.
- `submitted` berarti server SMTP menerima tujuan, bukan bukti inbox/dibaca.

## Rekomendasi dan AI

- Mitra eligible: cabang sama, `verified=true`, penerimaan bukan closed, kategori dan PKL/TCS cocok.
- Skor = 60 + pembulatan(30 × jumlah skill cocok / jumlah skill mitra) + 10 bila lokasi cocok. Bila skill mitra kosong, komponen skill 0.
- Skill cocok berdasarkan string yang dinormalisasi; lokasi mengabaikan kapitalisasi, spasi pinggir, dan awalan Kota. Bukan geocoding atau pemahaman sinonim.
- Hasil maksimum 5; skor turun lalu nama `localeCompare('id')`. Skor bukan probabilitas diterima; status unknown tetap eligible.
- Rencana AI memerlukan key, profil, dan consent; maksimum 3 percobaan/hari UTC/siswa, kegagalan ikut dihitung. Tidak ada retry provider otomatis.
- Menyimpan profil menghapus rencana lama. API AI tidak sengaja mengirim nama/NIS/password/lokasi/URL portofolio, tetapi minat/pengalaman merupakan teks bebas siswa.

Sumber: [server.js](../../server.js), [approvals.js](../../approvals.js), [career.js](../../career.js), [mail.js](../../mail.js), [kategori](../../public/request-options.js), [cabang](../../public/branches.js).
