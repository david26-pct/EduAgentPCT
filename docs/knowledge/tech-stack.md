# Tech Stack

Versi di bawah mengikuti deklarasi manifest dan lockfile, bukan versi service VPS yang diamati.

| Komponen | Deklarasi package.json | Resolusi package-lock.json |
| --- | --- | --- |
| express (runtime) | `^5.3.0` | `5.3.0` |
| express-rate-limit (runtime) | `^8.7.1` | `8.7.1` |
| helmet (runtime) | `^8.3.0` | `8.3.0` |
| nodemailer (runtime) | `^10.1.1` | `10.1.1` |
| pdfkit (runtime) | `^0.20.2` | `0.20.2` |
| @playwright/test (dev/test) | `^1.64.1` | `1.64.1` |
| jsqr (dev/test) | `^1.4.0` | `1.4.0` |
| pngjs (dev/test) | `^7.0.0` | `7.0.0` |

## Runtime dan tool

- JavaScript ESM (`type: module`), Node.js bawaan `node:sqlite`, crypto, fs/path/url.
- Installer mematok Node.js **24.19.0**, Linux **x86_64**. Tidak ada `engines` pada manifest yang memaksa versi saat npm dijalankan manual.
- Frontend: HTML, CSS, JavaScript DOM/ES modules; tidak ditemukan React/Vue, TypeScript, bundler, atau frontend build step.
- Database: SQLite melalui DatabaseSync; versi SQLite binary aktual tidak dipatok manifest.
- PDF: PDFKit. Browser tests memakai Playwright + Chromium; pemeriksaan PDF memakai pdftotext, pdfinfo, pdfimages, pdftoppm. QR diuji dengan jsQR/pngjs.
- Konversi workbook: Python standard library (zipfile, XML, JSON), tidak ada requirements Python.
- Deploy: Bash, apt-get, Nginx, Certbot, systemd, SQLite CLI, curl, xz/tar. Paket OS tidak dipatok versi oleh installer.
- Layanan eksternal: OpenAI Responses API untuk rencana AI; SMTP TLS untuk email; wa.me untuk membuka WhatsApp di perangkat siswa.

## Perintah npm

| Perintah | Implementasi |
| --- | --- |
| `npm start` | `node server.js` |
| `npm test` | `node --test` |
| `npm run partners:import -- file.json` | `node scripts/import-partners.js file.json` |

Sumber: [manifest](../../package.json), [lockfile](../../package-lock.json), [installer](../../deploy/install-vps.sh), [tes](../../test), [converter](../../scripts/convert-career-xlsx.py).
