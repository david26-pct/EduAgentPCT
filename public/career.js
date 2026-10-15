import { CATEGORIES, REQUEST_TYPES } from './request-options.js';
export function initCareer({ api, toast, onChoose }) {
  const $ = s => document.querySelector(s);
  const form = $('#career-form');
  const fields = form.elements;
  for (const [value, name] of Object.entries(REQUEST_TYPES)) fields.request_type.add(new Option(`${value} (${name})`, value));
  fields.category.add(new Option('Pilih kategori', ''));
  for (const category of CATEGORIES) fields.category.add(new Option(category, category));
  let profile = null, dirty = false, aiAvailable = false, generation = 0, planning = false;
  const error = message => $('#career-error').textContent = message;
  function showPlan(plan) {
    $('#career-plan').textContent = plan?.content || '';
    $('#career-plan-status').textContent = plan ? (plan.mode === 'ai' ? 'Dihasilkan AI · periksa kembali bersama pengajar.' : 'Panduan berbasis template · bukan hasil AI.') : '';
  }
  function clear() {
    generation++; form.reset(); profile = null; dirty = false; aiAvailable = false;
    error(''); showPlan(null); $('#career-matches').replaceChildren(); $('#career-consent').checked = false;
    $('#career-save-status').textContent = 'Belum ada profil tersimpan.';
    $('#career-ai-plan').disabled = true;
  }
  async function load() {
    clear(); const version = generation;
    const data = await api('/career'); if (version !== generation) return;
    profile = data.profile; aiAvailable = data.ai_available;
    if (profile) {
      for (const name of ['request_type', 'category', 'interests', 'experience', 'location', 'portfolio']) fields[name].value = profile[name] || '';
      fields.skills.value = profile.skills.join(', ');
      $('#career-save-status').textContent = 'Profil tersimpan. Siap mencari mitra dan membuat rencana.';
    }
    $('#career-ai-status').textContent = aiAvailable ? 'Layanan AI dikonfigurasi. Persetujuan diperlukan sebelum mengirim profil keahlian.' : 'AI belum dikonfigurasi pengelola. Kamu tetap bisa memakai rencana dasar.';
    showPlan(data.plan);
  }
  form.addEventListener('input', () => { dirty = true; $('#career-save-status').textContent = 'Ada perubahan yang belum disimpan.'; $('#career-matches').replaceChildren(); showPlan(null); });
  const ready = () => {
    error('');
    if (!profile || dirty) { error('Simpan profil terbaru terlebih dahulu.'); return false; }
    return true;
  };
  form.onsubmit = async event => {
    event.preventDefault(); error(''); $('#career-save').disabled = true;
    const version = generation;
    const data = Object.fromEntries(new FormData(form)); data.skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
    const snapshot = JSON.stringify(data);
    try {
      const saved = await api('/career/profile', { method: 'PUT', body: JSON.stringify(data) }); if (version !== generation) return;
      const current = Object.fromEntries(new FormData(form)); current.skills = current.skills.split(',').map(s => s.trim()).filter(Boolean);
      profile = saved; dirty = snapshot !== JSON.stringify(current); showPlan(null); $('#career-matches').replaceChildren();
      $('#career-save-status').textContent = dirty ? 'Ada perubahan baru yang belum disimpan.' : 'Profil berhasil disimpan.'; toast('Profil keahlian tersimpan.');
    } catch (e) { if (version === generation) error(e.message); } finally { $('#career-save').disabled = false; }
  };
  $('#career-match').onclick = async () => {
    if (!ready()) return; const version = generation; const usedProfile = JSON.stringify(profile);
    const button = $('#career-match'); button.disabled = true;
    try {
      const data = await api('/career/matches'); if (version !== generation || dirty || usedProfile !== JSON.stringify(profile)) return;
      const target = $('#career-matches'); target.replaceChildren();
      const note = document.createElement('p'); note.className = 'fine'; note.textContent = data.note; target.append(note);
      if (!data.matches.length) { const empty = document.createElement('p'); empty.className = 'notice'; empty.textContent = data.verified_profiles ? 'Belum ada profil mitra terverifikasi yang sesuai dengan kategori dan jenis kegiatanmu. Konsultasikan pilihanmu ke akademik.' : 'Profil pekerjaan 61 mitra belum diverifikasi. Rekomendasi belum dapat ditampilkan. Kamu tetap dapat memilih mitra dari daftar surat dan berkonsultasi dengan akademik.'; target.append(empty); }
      for (const match of data.matches) {
        const card = document.createElement('article'); card.className = 'career-result';
        const title = document.createElement('h3'); title.textContent = match.name;
        const score = document.createElement('strong'); score.textContent = `${match.score}/100 poin kecocokan`;
        const description = document.createElement('p'); description.textContent = `${match.description}\n${match.reason}\nLokasi: ${match.location}\nPenerimaan: ${match.acceptance === 'open' ? 'tercatat menerima — konfirmasikan kembali' : 'belum dikonfirmasi'}\nKeahlian yang perlu dipersiapkan: ${match.gap.join(', ') || 'tidak ada dari daftar persyaratan tercatat'}.`;
        const choose = document.createElement('button'); choose.type = 'button'; choose.className = 'secondary'; choose.textContent = 'Pilih untuk surat →'; choose.onclick = () => onChoose(match.id, profile);
        card.append(title, score, description, choose); target.append(card);
      }
    } catch (e) { if (version === generation) error(e.message); } finally { button.disabled = false; }
  };
  $('#career-consent').onchange = () => $('#career-ai-plan').disabled = planning || !aiAvailable || !$('#career-consent').checked;
  async function generate(useAI) {
    if (!ready()) return;
    if (planning) return; planning = true;
    const version = generation; const usedProfile = JSON.stringify(profile);
    $('#career-basic-plan').disabled = true; $('#career-ai-plan').disabled = true;
    $('#career-plan-status').textContent = useAI ? 'Sedang membuat rencana AI…' : 'Menyiapkan rencana dasar…';
    try {
      const data = await api('/career/plan', { method: 'POST', body: JSON.stringify({ use_ai: useAI, consent: $('#career-consent').checked }) });
      if (version === generation && !dirty && usedProfile === JSON.stringify(profile)) showPlan(data);
    } catch (e) { if (version === generation) { error(e.message); $('#career-plan-status').textContent = 'Rencana baru belum berhasil dibuat.'; } }
    finally { planning = false; $('#career-basic-plan').disabled = false; $('#career-ai-plan').disabled = planning || !aiAvailable || !$('#career-consent').checked; }
  }
  $('#career-basic-plan').onclick = () => generate(false);
  $('#career-ai-plan').onclick = () => generate(true);
  return { load, clear };
}
