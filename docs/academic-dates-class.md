# Tanggal kegiatan dan kelas/angkatan

Perubahan 19 Oktober 2026, berlaku untuk formulir pengajuan PKL/TCS yang sama.

- Siswa wajib mengisi `class_name` (nama kelas/angkatan manual, maksimal 100 karakter).
- API pengajuan dan revisi siswa menolak properti `start` atau `end`, termasuk jika kosong. Nomor surat tetap hanya diisi akademik.
- Pengajuan baru menyimpan periode kosong (`''`) sampai disetujui. Kolom tanggal lama tetap NOT NULL; tidak ada tanggal fiktif sebagai pengganti.
- Akademik mengisi kedua tanggal di formulir pemeriksaan sebelum menyetujui, bersama nomor surat. Validasi kalender dan urutan tanggal berlaku di server. Meminta revisi tidak mewajibkan tanggal.
- Kelas/angkatan ditampilkan di detail akademik, pratinjau siswa, dan PDF surat. Satu kelas/angkatan berlaku bagi peserta dalam satu pengajuan.
- Migrasi menambahkan `letters.class_name TEXT NOT NULL DEFAULT ''`. Surat lama beserta periode dan persetujuannya dipertahankan; surat lama yang diminta revisi wajib dilengkapi kelas saat diajukan ulang.
- Endpoint tetap sama. Dokumentasi snapshot 17 Oktober di knowledge dan PROJECT-MANAGER-PERFORMANCE mendeskripsikan perilaku sebelum perubahan ini.

## Pembaruan VPS

Jalankan di terminal SSH Ubuntu:

```bash
cd ~/eduagentpct-app && git pull --ff-only origin deploy/initial-web && sudo bash deploy/install-vps.sh
```

Installer mencadangkan database dan menjalankan migrasi saat aplikasi dimulai. Sesudah pembaruan, muat ulang browser siswa dan akademik dengan Ctrl+F5. Tidak perlu menghapus database atau membuat ulang akun.
