# MOC — Map of Content

Mulai dari [README Knowledge](README.md). Semua catatan di bawah berada pada snapshot yang sama.

## Manajemen proyek

- [Project Overview](project-overview.md): tujuan yang didukung kode dan cakupan saat ini.
- [Project Performance](project-performance.md): status delivery, hasil tes, dan batas data performa.
- [Fitur yang sudah selesai](features-completed.md): implementasi dan evidence.
- [Fitur yang belum selesai](features-incomplete.md): implementasi yang belum ada atau perlu konfigurasi.
- [Decision Log](decision-log.md): keputusan yang dapat ditelusuri ke source/commit.
- [Bug / Technical Debt](bug-technical-debt.md): temuan statis dan keterbatasan, tanpa klaim insiden produksi.

## Pengetahuan teknis

- [Arsitektur](architecture.md)
- [Tech Stack](tech-stack.md)
- [Struktur Database](database.md)
- [API / Endpoint](api-endpoints.md)
- [User Role & Permission](roles-permissions.md)
- [Business Rules](business-rules.md)
- [Deployment Notes](deployment-notes.md)

## Bukti dan petunjuk proyek

- [Verification](evidence/verification.md)
- [DDL setelah migrasi](evidence/schema.sql)
- [README proyek](../../README.md)
- [Petunjuk deployment yang sudah ada](../../deploy/README.md)

Alur baca untuk operator: Deployment → Roles → Business Rules → Verification.
Alur baca untuk pengembang: Architecture → Database → API → Technical Debt.
