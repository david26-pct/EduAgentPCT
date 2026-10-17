# Fitur yang belum selesai / bergantung prasyarat

## Belum ditemukan implementasi

| Item | Bukti batas saat ini |
| --- | --- |
| Aplikasi native Flutter/mobile/desktop | Source hanya web statis dan Node; tidak ada manifest Flutter/proyek native |
| Login/penautan Google | UI menulis belum tersedia; tidak ada route OAuth |
| Percakapan Chatbot AI | `public/chatbot.js` hanya respons panduan lokal; tidak ada endpoint chat |
| Analisis portofolio AI, CV AI, evaluasi jurnal | Tidak ditemukan route, UI alur, atau tabel khusus |
| Validasi status siswa terhadap akademik | Register hanya memeriksa nama/format NIS/keunikan |
| Reset password, MFA aplikasi, manajemen sesi perangkat | Tidak ditemukan route/alur pada source |
| Dashboard CRUD mitra dan kelola akun akademik | Saat ini memakai CLI, bukan UI admin |
| WhatsApp otomatis / balasan persetujuan via WhatsApp | Hanya tombol wa.me; tidak ada webhook/provider |
| Verifikasi tanda tangan digital per surat | QR adalah gambar tetap, bukan signature/certificate per dokumen |
| PostgreSQL, CI/CD, benchmark beban | Tidak ada implementasi/konfigurasi terkait dalam snapshot |

## Diimplementasikan tetapi perlu konfigurasi atau data

- AI rencana belajar membutuhkan AI_API_KEY/model yang dapat diakses dan saldo provider. `ai_available` hanya menilai keberadaan key, bukan uji provider.
- SMTP membutuhkan host/akun/password/from yang valid. Tes tidak membuktikan inbox Gmail menerima email.
- Kop/pimpinan/WhatsApp/email penerima baru dikonfigurasi untuk Lahat pada file cabang; penerima email cabang lain dapat dioverride environment.
- Dataset mitra dan profil rekomendasi bawaan hanya Lahat/PKL. Data TCS/cabang lain tidak boleh diartikan telah tersedia.
- Alamat pos penerima belum ada; amplop memakai Di Tempat.
- Performa, backup eksternal, restore produksi, DNS aktif, sertifikat saat ini, dan versi aplikasi di VPS tidak diverifikasi dalam pemeriksaan ini.

Daftar ini bukan komitmen roadmap atau jadwal. Item yang tidak ditemukan tidak otomatis berarti disetujui untuk dikerjakan.

Sumber: [struktur proyek](../../package.json), [UI](../../public/index.html), [chatbot](../../public/chatbot.js), [server](../../server.js), [cabang](../../public/branches.js), [email](../../mail.js), [AI](../../career.js).
