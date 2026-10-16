const panel = document.querySelector('#chatbot-panel');
const toggle = document.querySelector('#chatbot-toggle');
const guide = document.querySelector('#chatbot-guide');
const guides = {
  category: 'Pilih kategori sesuai kemampuan dan minatmu: Internet of Things, Web Programing, UI/UX Design, Desain Grafis, Content Creator, atau Digital Marekting. Jika masih ragu, konsultasikan dengan akademik sebelum mengajukan surat.',
  partner: 'Daftar mitra sudah tersedia di formulir. Rekomendasi berdasarkan keahlian belum aktif karena profil pekerjaan dan kategori tiap mitra belum dilengkapi. Konfirmasikan tugas, pembimbing, dan penerimaan PKL/TCS kepada akademik atau mitra; nama perusahaan saja belum cukup untuk menentukan kecocokan.',
  letter: 'Pilih PKL atau TCS beserta kategori, mitra, periode, dan peserta. Ajukan lalu tekan Kirim ke WhatsApp Akademik pada riwayat. Akademik memeriksa dan mengisi nomor saat menyetujui. PDF hanya tersedia setelah disetujui. Jika diminta revisi, perbaiki dari riwayat dan ajukan ulang.',
};
toggle.addEventListener('click', () => panel.showModal());
document.querySelector('#chatbot-close').addEventListener('click', () => panel.close());
panel.addEventListener('close', () => {
  guide.replaceChildren();
  const heading = document.createElement('strong'); heading.textContent = 'Panduan aplikasi';
  const text = document.createElement('p'); text.textContent = 'Pilih pertanyaan di atas untuk membaca panduan. Panduan ini bukan jawaban dari AI.';
  guide.append(heading, text);
});
document.querySelectorAll('[data-chat-guide]').forEach(button => button.addEventListener('click', () => {
  guide.replaceChildren();
  const heading = document.createElement('strong'); heading.textContent = 'Panduan aplikasi · bukan jawaban AI';
  const text = document.createElement('p'); text.textContent = guides[button.dataset.chatGuide];
  guide.append(heading, text);
}));
