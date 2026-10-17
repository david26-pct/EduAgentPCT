# User Role & Permission

Peran web disimpan melalui tabel dan sesi terpisah, bukan kolom role pada siswa. Operator server adalah kewenangan operasional melalui CLI, bukan peran login web yang diimplementasikan.

| Aktor | Hak yang ditemukan | Pembatasan |
| --- | --- | --- |
| Pengunjung | Aset publik, health, pendaftaran/login siswa, login akademik | Tidak dapat membaca pengajuan melalui API tanpa sesi |
| Siswa | Profil sendiri, mitra cabang, rekomendasi cabang, membuat pengajuan, memperbaiki revision, membaca riwayat sendiri | Tidak boleh mengisi nomor, menyetujui, mengedit pending/approved, atau membaca PDF siswa lain |
| Akademik aktif | Antrean/detail cabangnya; approve dengan nomor; meminta revisi dengan catatan; audit | Tautan tidak melewati login/cabang; tidak ditemukan API CRUD mitra, kelola akun, atau unduh dokumen melalui sesi akademik |
| Operator server | Membuat akun akademik, impor mitra/profil, env/service/DB lewat akses OS | Tidak ditemukan dashboard superadmin |

## Sesi

- Siswa: cookie `session`, token acak 32 byte, digest SHA256 di `sessions`, berlaku 7 hari.
- Akademik: cookie `academic_session`, token acak 32 byte, digest di `academic_sessions`, berlaku 8 jam; akun harus `active=1`.
- Cookie menggunakan HttpOnly, SameSite Strict, path `/`, dan Secure bila `NODE_ENV=production`.
- Logout mencabut baris sesi yang sesuai, bukan seluruh sesi semua perangkat.
- Password memakai scrypt dengan salt acak; password bukan enkripsi yang dapat didekripsi.

Pendaftaran siswa tidak membuat akun akademik walaupun body memasukkan role. Akun akademik dibuat melalui terminal interaktif dengan password 12–128 karakter. Tidak ada password default pada source produksi; credential pada `test-support` hanya fixture tes.

## Otorisasi tautan dan QR

Review token acak adalah pengenal URL, bukan bearer permission. API akademik memerlukan sesi dan cabang yang cocok. PDF surat/amplop memeriksa kepemilikan siswa, status approved, nomor, dan konfigurasi kop. Aset gambar statis (termasuk QR) berada pada direktori publik; pembatasan download PDF bukan perlindungan akses atas file gambar tersebut.

Sumber: [server.js](../../server.js), [approvals.js](../../approvals.js), [CLI akademik](../../scripts/create-academic.js), [tes permission](../../test/approvals.test.js), [tes cabang](../../test/branches.test.js).
