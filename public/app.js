import { BRANCHES, getSignatureQR } from './branches.js';
import { initCareer } from './career.js';
import './chatbot.js';
import { REQUEST_TYPES, CATEGORIES } from './request-options.js';
const $ = s => document.querySelector(s);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let mode = 'login', student, partners = [], letters = [], branchDetails = null, editingLetterId = null;
for (const name of BRANCHES) $('#auth-form [name=branch]').add(new Option(name, name));
$('[name="request_type"]').innerHTML = Object.entries(REQUEST_TYPES).map(([value, name]) => `<option value="${value}">${value} (${name})</option>`).join('');
$('[name="category"]').innerHTML += CATEGORIES.map(name => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join('');
async function api(path, options = {}) {
  const response = await fetch('/api' + path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) { if (response.status === 401 && student) signedOut(); throw new Error(data.error || 'Terjadi kesalahan.'); }
  return data;
}
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; setTimeout(() => $('#toast').hidden = true, 4500); }
function view(name) {
  for (const v of ['dashboard', 'create', 'history', 'career']) $('#' + v + '-view').hidden = v !== name;
  document.querySelectorAll('aside [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetLetterEditor() {
  editingLetterId = null;
  $('#letter-form').reset(); updateCustomPartner(); $('#participants').replaceChildren();
  if (student) addParticipant(student.name);
  $('#letter-form').elements.issued.value = today();
  $('#save-letter').textContent = 'Ajukan ke akademik →';
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { if (b.dataset.view === 'create') resetLetterEditor(); view(b.dataset.view); }));
function authMode(value) {
  mode = value;
  $('#login-tab').classList.toggle('selected', mode === 'login');
  $('#register-tab').classList.toggle('selected', mode === 'register');
  $('#confirm-label').hidden = mode !== 'register';
  $('[name="confirm"]').required = mode === 'register';
  $('[name="password"]').minLength = mode === 'register' ? 10 : 1;
  $('[name="password"]').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  $('[name="password"]').placeholder = mode === 'register' ? 'Minimal 10 karakter' : 'Masukkan password';
  $('#auth-title').textContent = mode === 'register' ? 'Mulai dengan akun baru' : 'Masuk ke ruang siswa';
  $('#auth-submit').textContent = mode === 'register' ? 'Buat akun siswa →' : 'Masuk ke akun →';
  $('#auth-error').textContent = '';
}
$('#login-tab').onclick = () => authMode('login');
$('#register-tab').onclick = () => authMode('register');
$('#auth-form').onsubmit = async event => {
  event.preventDefault(); $('#auth-error').textContent = '';
  const data = Object.fromEntries(new FormData(event.target));
  if (mode === 'register' && data.password !== data.confirm) { $('#auth-error').textContent = 'Konfirmasi password belum sesuai.'; return; }
  $('#auth-submit').disabled = true;
  try { student = await api('/' + mode, { method: 'POST', body: JSON.stringify(data) }); event.target.reset(); await signedIn(); }
  catch (e) { $('#auth-error').textContent = e.message; }
  finally { $('#auth-submit').disabled = false; }
};
function signedOut() { editingLetterId = null; career.clear(); student = null; branchDetails = null; letters = []; partners = []; $('#workspace').hidden = true; $('#auth').hidden = false; $('#letter-form').reset(); updateCustomPartner(); $('#participants').replaceChildren(); $('#preview').close(); $('#chatbot-panel').close(); $('#preview-content').replaceChildren(); }
$('#logout').onclick = async () => { try { await api('/logout', { method: 'POST', body: '{}' }); signedOut(); } catch (e) { toast(e.message); } };
const today = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
async function signedIn() {
  $('#auth').hidden = true; $('#workspace').hidden = false;
  $('#current-branch').textContent = 'PalComTech ' + student.branch;
  $('#student-name').textContent = student.name; $('#avatar').textContent = student.name[0].toUpperCase();
  $('#greeting').textContent = `Halo, ${student.name.split(' ')[0]} 👋`;
  $('#participants').replaceChildren(); addParticipant(student.name);
  $('#letter-form').elements.issued.value = today();
  try {
    branchDetails = (await api('/branch')).letterhead;
    partners = await api('/partners');
    const select = $('[name="partner_id"]');
    select.innerHTML = '<option value="">Pilih mitra resmi</option>' + partners.map(p => `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('') + '<option value="other">Lainnya — ketik sendiri</option>';
    updateCustomPartner();
    $('#partner-help').textContent = partners.length ? 'Pilih tujuan dari daftar mitra yang dikelola akademik.' : 'Daftar mitra cabang belum tersedia. Pilih Lainnya untuk mengajukan tujuan sendiri.';
    $('#save-letter').disabled = false;
    await refreshLetters();
    await career.load();
  } catch (e) { toast(e.message); }
  view('dashboard');
}
function addParticipant(name = '') {
  if ($('#participants').children.length >= 10) return;
  const item = document.createElement('div'); item.className = 'participant';
  item.innerHTML = `<label>Nama lengkap siswa *<input class="participant-name" required maxlength="100" value="${escapeHTML(name)}" ${name === student.name ? 'readonly' : ''}></label><label>Program studi *<input class="participant-program" required maxlength="150" value="Program Profesional 1 Tahun Koding, AI, dan Bisnis Digital"></label>${name === student.name ? '<span></span>' : '<button type="button" class="text-button" aria-label="Hapus peserta">Hapus</button>'}`;
  item.querySelector('button')?.addEventListener('click', () => { item.remove(); $('#add-participant').disabled = false; });
  $('#participants').append(item); $('#add-participant').disabled = $('#participants').children.length >= 10;
}
$('#add-participant').onclick = () => addParticipant();
function formData() {
  const data = Object.fromEntries(new FormData($('#letter-form')));
  data.partner_id = data.partner_id === 'other' ? null : Number(data.partner_id);
  if (data.partner_id !== null) delete data.custom_partner_name;
  data.participants = [...document.querySelectorAll('.participant')].map(row => ({ name: row.querySelector('.participant-name').value.trim(), program: row.querySelector('.participant-program').value.trim() }));
  return data;
}
function validForm() {
  $('#letter-error').textContent = '';
  if (!$('#letter-form').reportValidity()) return false;
  const data = formData();
  if (data.start > data.end) { $('#letter-error').textContent = 'Tanggal selesai harus sama atau setelah tanggal mulai.'; return false; }
  return true;
}
$('#letter-form').onsubmit = async event => {
  event.preventDefault(); if (!validForm()) return;
  $('#save-letter').disabled = true;
  try {
    await api(editingLetterId ? '/letters/' + editingLetterId : '/letters', { method: editingLetterId ? 'PUT' : 'POST', body: JSON.stringify(formData()) });
    editingLetterId = null; $('#save-letter').textContent = 'Ajukan ke akademik →';
    toast('Pengajuan tersimpan. Periksa status email di riwayat; kamu juga bisa mengirim tautan lewat WhatsApp.');
    event.target.reset(); updateCustomPartner(); $('#participants').replaceChildren(); addParticipant(student.name); event.target.elements.issued.value = today();
    await refreshLetters(); view('history');
  } catch (e) { $('#letter-error').textContent = e.message; }
  finally { $('#save-letter').disabled = false; }
};
const formatDate = value => new Date(value + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
function preview(data) {
  const partner = data.custom_partner_name ? {name:data.custom_partner_name,recipient:'Pimpinan'} : partners.find(p => p.id === data.partner_id);
  const requestName = REQUEST_TYPES[data.request_type || 'PKL'];
  const head = branchDetails;
  const signatureQR = data.status === 'approved' ? getSignatureQR(student.branch, data.request_type || 'PKL') : null;
  $('#preview-content').innerHTML = `<div class="preview-letterhead"><span class="brand-mark" role="img" aria-label="Logo PalComTech"><img src="/assets/palcomtech-letterhead.jpg" alt="" width="1239" height="222"></span><h2>PalComTech ${escapeHTML(student.branch)}</h2></div><p>Nomor: ${escapeHTML(data.number || '(Menunggu persetujuan dan nomor dari akademik)')}<br>Perihal: Permohonan ${escapeHTML(requestName)}</p><p>Kepada Yth,<br>${escapeHTML(partner?.recipient || '')}<br>${escapeHTML(partner?.name || '')}<br>Di Tempat</p><p>Dengan hormat,</p><p>Kami mengharapkan kesediaan Bapak/Ibu untuk memberikan izin kepada siswa Lembaga Pendidikan Komputer dan Internet PalComTech ${escapeHTML(student.branch)} untuk dapat menjalankan ${escapeHTML(requestName)} (${escapeHTML(data.request_type || 'PKL')}) dalam lingkungan Kantor/Perusahaan yang Bapak/Ibu pimpin, guna mengaplikasikan ilmu pengetahuan dan keterampilan yang dimiliki oleh siswa tersebut.</p><p>Adapun nama siswa yang akan melaksanakan ${escapeHTML(requestName)} pada ${escapeHTML(formatDate(data.start))} s.d. ${escapeHTML(formatDate(data.end))}, sebagai berikut:</p><p>Kategori: ${escapeHTML(data.category || 'Belum dipilih (surat lama)')}</p><table><thead><tr><th>No.</th><th>Nama</th><th>Program Studi</th></tr></thead><tbody>${data.participants.map((p, i) => `<tr><td>${i + 1}</td><td>${escapeHTML(p.name)}</td><td>${escapeHTML(p.program)}</td></tr>`).join('')}</tbody></table><p>Demikian surat ini kami sampaikan, atas perhatian dan kerjasamanya diucapkan terima kasih.</p><p class="signature-line">${escapeHTML(head?.city || student.branch)}, ${escapeHTML(formatDate(data.issued))}<br>Pimpinan</p>${signatureQR ? `<div class="signature-qr"><img src="${escapeHTML(signatureQR)}" alt="QR tanda tangan pimpinan PalComTech Lahat" width="134" height="134"></div>` : '<br><br>'}<p class="signature-line">${escapeHTML(head?.leader || 'Pimpinan cabang belum dikonfirmasi')}<br>${escapeHTML(head?.leader_id || '')}</p><p><small>Contact Person: ${escapeHTML(head?.contact || 'Hubungi akademik cabang')}<br>${escapeHTML(head?.contact_phone || '')}</small></p>`;
  $('#preview').showModal();
}
$('#preview-button').onclick = () => { if (validForm()) preview(formData()); };
$('#close-preview').onclick = () => $('#preview').close();
const statusLabels = { pending: 'Menunggu persetujuan akademik', revision: 'Perlu revisi', approved: 'Disetujui · siap dicetak' };
function renderList(target, entries) {
  if (!entries.length) { target.innerHTML = '<div class="empty"><strong>Belum ada pengajuan</strong><p>Buat pengajuan surat untuk diperiksa akademik.</p></div>'; return; }
  target.innerHTML = '<div class="letter-list">' + entries.map(l => `<article class="letter-card"><div><h3>${escapeHTML(l.partner_name)}</h3>${l.custom_partner_name ? '<p class="fine">Tujuan lainnya · isian siswa</p>' : ''}<p>${escapeHTML(l.request_type)} · ${escapeHTML(l.category || 'Kategori belum dipilih')}</p><p>${escapeHTML(l.number || 'Nomor diisi akademik')} · ${l.participants.length} siswa</p><p>${escapeHTML(formatDate(l.start))} – ${escapeHTML(formatDate(l.end))}</p><span class="status ${l.status === 'approved' ? '' : 'draft'}">${escapeHTML(statusLabels[l.status])}</span>${l.email_notification ? `<p class="email-notice">Email akademik: ${escapeHTML(l.email_notification.message)}</p>` : ''}${l.review_note ? `<p class="review-note">Catatan akademik: ${escapeHTML(l.review_note)}</p>` : ''}${l.approved_at ? `<p class="approved-info">Disetujui ${escapeHTML(new Date(l.approved_at).toLocaleString('id-ID'))}</p>` : ''}</div><div class="student-actions"><button class="secondary preview-saved" data-id="${l.id}">Lihat</button>${l.status === 'approved' ? `<button class="primary download" data-id="${l.id}">↓ PDF Surat</button><button class="secondary download-envelope" data-id="${l.id}">↓ PDF Amplop</button>` : ''}${l.status === 'pending' && l.whatsapp_url ? `<a class="secondary whatsapp" href="${escapeHTML(l.whatsapp_url)}" target="_blank" rel="noopener noreferrer">Kirim ke WhatsApp Akademik ↗</a>` : ''}${l.status === 'pending' && !l.whatsapp_url ? '<p class="fine">Nomor WhatsApp akademik cabang belum tersedia. Hubungi akademik.</p>' : ''}${l.status === 'revision' ? `<button class="secondary complete" data-id="${l.id}">Perbaiki pengajuan</button>` : ''}</div></article>`).join('') + '</div>';
  target.querySelectorAll('.preview-saved').forEach(b => b.onclick = () => preview(letters.find(l => l.id === Number(b.dataset.id))));
  target.querySelectorAll('.download, .download-envelope').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try {
      const envelope = b.classList.contains('download-envelope');
      const response = await fetch(`/api/letters/${b.dataset.id}/${envelope ? 'envelope.pdf' : 'pdf'}`);
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = `${envelope ? 'Amplop' : 'Surat'}-${letters.find(l => l.id === Number(b.dataset.id)).request_type || 'PKL'}-${b.dataset.id}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      if (envelope) toast('Amplop DL 22 × 11 cm. Cetak pada ukuran asli / 100%, tanpa Fit to page.');
    } catch (e) { toast(e.message); } finally { b.disabled = false; }
  });
  target.querySelectorAll('.complete').forEach(b => b.onclick = () => {
    const l = letters.find(l => l.id === Number(b.dataset.id));
    for (const field of ['partner_id', 'start', 'end', 'issued', 'request_type', 'category']) $('#letter-form').elements[field].value = l[field] || (field === 'request_type' ? 'PKL' : '');
    $('#letter-form').elements.partner_id.value = l.custom_partner_name ? 'other' : String(l.partner_id);
    $('#letter-form').elements.custom_partner_name.value = l.custom_partner_name || '';
    updateCustomPartner();
    $('#participants').replaceChildren(); l.participants.forEach(p => { addParticipant(p.name); $('#participants').lastElementChild.querySelector('.participant-program').value = p.program; });
    editingLetterId = l.id; $('#save-letter').textContent = 'Ajukan ulang revisi →'; view('create'); toast('Perbaiki sesuai catatan, lalu ajukan ulang. Nomor diisi oleh akademik.');
  });
}
async function refreshLetters() {
  letters = await api('/letters'); $('#total-count').textContent = letters.length;
  $('#ready-count').textContent = letters.filter(l => l.status === 'approved').length; $('#partner-count').textContent = partners.length;
  renderList($('#recent'), letters.slice(0, 3)); renderList($('#history'), letters);
}
const career = initCareer({ api, toast, onChoose: (partnerId, profile) => {
  resetLetterEditor();
  const form = $('#letter-form');
  form.elements.partner_id.value = String(partnerId); updateCustomPartner();
  form.elements.request_type.value = profile.request_type;
  form.elements.category.value = profile.category;
  view('create'); toast('Mitra dan kategori dipilih. Lengkapi data surat.');
} });
(async () => { try { student = await api('/me'); await signedIn(); } catch { /* Halaman masuk untuk sesi yang belum tersedia. */ } })();

$('#chatbot-start').onclick = () => { $('#chatbot-panel').close(); resetLetterEditor(); view('create'); };

for (const id of ['refresh-letters', 'history-refresh']) document.querySelector('#' + id)?.addEventListener('click', async () => { try { await refreshLetters(); toast('Status pengajuan diperbarui.'); } catch (e) { toast(e.message); } });
window.addEventListener('focus', () => { if (student) refreshLetters().catch(() => {}); });

setInterval(() => { if (student && !document.hidden) refreshLetters().catch(() => {}); }, 30000);

function updateCustomPartner() {
  const form=$('#letter-form');const custom=form.elements.partner_id.value==='other';
  $('#custom-partner-field').hidden=!custom;form.elements.custom_partner_name.required=custom;
  form.elements.custom_partner_name.disabled=!custom;
}
$('#letter-form').elements.partner_id.addEventListener('change', updateCustomPartner);
updateCustomPartner();
