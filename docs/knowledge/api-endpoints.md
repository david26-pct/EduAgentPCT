# API / Endpoint

API HTTP JSON pada `/api`, disajikan dari origin yang sama dengan frontend. PDF mengembalikan attachment application/pdf. Tidak ditemukan JWT/Bearer token atau OpenAPI spec pada source; autentikasi memakai cookie.

## Publik

| Method | Endpoint | Input/hasil |
| --- | --- | --- |
| GET | `/api/health` | `{ "status": "ok" }`; tidak melakukan probe SMTP/OpenAI atau health DB lanjutan |
| POST | `/api/register` | name, nis, password, branch → akun publik dan cookie session; tidak menerima role akademik |
| POST | `/api/login` | name, nis, password, branch → akun publik dan cookie session |
| POST | `/api/academic/login` | branch, username, password → name/branch dan academic_session |

## Sesi siswa

| Method | Endpoint | Input/hasil dan aturan |
| --- | --- | --- |
| GET | `/api/me` | id, name, nis, branch |
| POST | `/api/logout` | Hapus sesi saat ini |
| GET | `/api/branch` | branch + letterhead atau null |
| GET | `/api/partners` | Seluruh mitra cabang akun; belum ada pagination |
| GET | `/api/letters` | Riwayat sendiri; participants di-parse, partner_name, whatsapp_url, email_notification |
| POST | `/api/letters` | Pengajuan pending tanpa nomor; 201 + id/status/WhatsApp URL |
| PUT | `/api/letters/:id` | Perbaikan hanya saat revision; ID sama kembali pending |
| GET | `/api/letters/:id/pdf` | PDF A4 milik sendiri, approved + nomor + kop tersedia |
| GET | `/api/letters/:id/envelope.pdf` | PDF amplop DL dengan syarat yang sama |
| GET | `/api/career` | profile, plan, ai_available (keberadaan key saja) |
| PUT | `/api/career/profile` | Profil keahlian; menghapus plan lama |
| GET | `/api/career/matches` | method=rules, maksimum 5 matches, verified_profiles, note |
| POST | `/api/career/plan` | use_ai dan consent → mode/content/created; dapat memakai template tanpa AI |

Contoh bentuk body pengajuan (nilai hanya ilustrasi struktur, ID harus ada di cabang akun):

```json
{
  "request_type": "PKL",
  "category": "UI/UX Design",
  "partner_id": null,
  "custom_partner_name": "Nama Tujuan yang Diajukan Siswa",
  "start": "2026-11-01",
  "end": "2026-12-01",
  "issued": "2026-10-17",
  "participants": [{"name": "Nama Pemilik Akun", "program": "Program studi siswa"}]
}
```

Untuk mitra terdaftar gunakan integer partner_id; custom_partner_name harus kosong/tidak dikirim. Nomor dari siswa ditolak. issued tetap input tanggal siswa; persetujuan menyimpan approved_at terpisah.

Profil keahlian: request_type, category, skills (array), interests, experience, location, portfolio. URL portfolio harus HTTPS tanpa userinfo dan tidak di-fetch server. Rencana AI mengirim hanya jenis/kategori/skill/minat/pengalaman; consent wajib bila use_ai=true.

## Sesi akademik

| Method | Endpoint | Input/hasil |
| --- | --- | --- |
| GET | `/api/academic/me` | name dan branch petugas |
| POST | `/api/academic/logout` | Cabut sesi akademik saat ini |
| GET | `/api/academic/requests` | Antrean seluruh cabang petugas, pending didahulukan |
| GET | `/api/academic/requests/:token` | Detail + peserta, NIS, catatan, events; cabang wajib cocok |
| POST | `/api/academic/requests/:token/decision` | action approve/revision, version, number untuk approve, note wajib untuk revision |

Body keputusan:

```json
{"action":"approve","version":1,"number":"Nomor resmi dari akademik","note":"Catatan opsional"}
```

Version harus sama dengan data yang baru dibaca; status harus pending. GET tautan tidak melakukan persetujuan. Nomor unik per cabang.

## Respons error yang ditemukan

| Status | Penggunaan |
| --- | --- |
| 400 | Validasi input, profil belum disimpan, consent hilang, nomor dari siswa |
| 401 | Tidak ada sesi valid atau credential salah |
| 403 | Origin tidak diizinkan; PDF belum approved/bernomor |
| 404 | Pengajuan bukan milik akun/cabang, atau endpoint tidak ada |
| 409 | NIS/nomor duplikat, versi/status konflik, kop belum dikonfigurasi, profil berubah saat menunggu AI |
| 429 | Middleware rate limit atau kuota AI harian |
| 502 | Provider AI gagal/tidak menyelesaikan output |
| 503 | Permintaan AI tetapi key belum tersedia |
| 500 | Error tak tertangani, pesan umum dari handler |

Tidak semua error middleware memakai bentuk JSON yang sama: konfigurasi default express-rate-limit pada beberapa route dapat memberi body teks. Status email failed/blocked adalah state notifikasi dalam riwayat, bukan alasan pengajuan yang tersimpan berubah menjadi HTTP gagal.

Tidak ditemukan endpoint DELETE, upload file aplikasi, OAuth, chat AI, CRUD mitra web, atau administrasi akun web.

Sumber: [server.js](../../server.js), [approvals.js](../../approvals.js), [career.js](../../career.js), [mail.js](../../mail.js).
