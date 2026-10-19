import { BRANCHES } from './branches.js';
const $=s=>document.querySelector(s);
for(const branch of BRANCHES)$('#academic-login-form').elements.branch.add(new Option(branch,branch));
let account=null,letter=null;
const token=()=>new URL(location.href).searchParams.get('request');
const labels={pending:'Menunggu persetujuan',revision:'Perlu revisi',approved:'Disetujui'};
async function api(path,body){const r=await fetch('/api/academic'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok){if(r.status===401)clear();const e=Error(data.error||'Permintaan gagal.');e.status=r.status;throw e;}return data;}
function clear(){account=null;letter=null;$('#academic-workspace').hidden=true;$('#academic-login').hidden=false;for(const id of ['academic-list','academic-details','academic-events'])$('#'+id).replaceChildren();$('#academic-decision').reset();}
function text(tag,value,className){const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;}
function message(s){$('#academic-message').textContent=s;}
async function review(value){
 const data=await api('/requests/'+encodeURIComponent(value));letter=data;
 $('#academic-review').hidden=false;const target=$('#academic-details');target.replaceChildren();
 for(const [label,value] of [['Status',labels[data.status]],['Siswa',`${data.student_name} · NIS ${data.nis}`],['Cabang',data.branch],['Tujuan',data.partner_name],['Sumber tujuan',data.custom_partner_name ? 'Isian siswa — verifikasi instansi/perusahaan sebelum menyetujui.' : 'Daftar mitra cabang'],['Kegiatan',`${data.request_type} · ${data.category||'Kategori belum diisi'}`],['Kelas/Angkatan',data.class_name||'Belum diisi (surat lama)'],['Periode',data.start&&data.end?`${data.start} s.d. ${data.end}`:'Menunggu penetapan akademik'],['Tanggal surat',data.issued],['Nomor',data.number||'Belum diterbitkan'],['Catatan',data.review_note||'—']])target.append(text('p',`${label}: ${value}`));
 target.append(text('h3','Peserta'));for(const p of data.participants)target.append(text('p',`${p.name} — ${p.program}`));
 $('#academic-decision').hidden=data.status!=='pending';$('#academic-decision').elements.number.value=data.number||'';$('#academic-decision').elements.note.value='';for(const field of ['start','end'])$('#academic-decision').elements[field].value=data[field]||'';
 const history=$('#academic-events');history.replaceChildren();for(const event of data.events)history.append(text('p',`${event.created} · ${event.actor_name} · ${{submitted:'Mengajukan',resubmitted:'Mengajukan ulang',approved:'Menyetujui',revision:'Meminta revisi'}[event.action]||event.action}${event.number?' · '+event.number:''}${event.note?' · '+event.note:''}`,'fine'));
}
async function load(){
 $('#academic-login').hidden=true;$('#academic-workspace').hidden=false;$('#academic-identity').textContent=`${account.name} · PalComTech ${account.branch}`;
 const rows=await api('/requests');const list=$('#academic-list');list.replaceChildren();
 if(!rows.length)list.append(text('p','Belum ada pengajuan pada cabang ini.','notice'));
 for(const row of rows){const button=text('button',`${row.student_name} → ${row.partner_name} · ${labels[row.status]}`,'secondary');button.onclick=async()=>{message('');try{history.replaceState(null,'','?request='+row.review_token);await review(row.review_token);}catch(e){message(e.message);}};list.append(button);}
 if(token())await review(token());else $('#academic-review').hidden=true;
}
$('#academic-login-form').onsubmit=async event=>{event.preventDefault();message('');const button=event.target.querySelector('button');button.disabled=true;try{account=await api('/login',Object.fromEntries(new FormData(event.target)));event.target.reset();await load();}catch(e){message(e.message);}finally{button.disabled=false;}};
$('#academic-logout').onclick=async()=>{try{await api('/logout',{});clear();message('Keluar dari akun akademik.');}catch(e){message(e.message);}};
$('#academic-refresh').onclick=async()=>{message('');try{await load();}catch(e){message(e.message);}};
$('#academic-decision').onsubmit=async event=>{
 event.preventDefault();if(!letter)return;const data=Object.fromEntries(new FormData(event.target));data.action=event.submitter.value;data.version=letter.version;
 if(data.action==='approve'&&(!data.start||!data.end||data.start>data.end)){message('Isi tanggal mulai dan selesai; tanggal selesai tidak boleh sebelum tanggal mulai.');return;}
 if(data.action==='approve'&&!data.number.trim()){message('Isi nomor surat terlebih dahulu.');return;}if(data.action==='revision'&&!data.note.trim()){message('Isi catatan revisi terlebih dahulu.');return;}
 const buttons=event.target.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);message('');
 try{await api('/requests/'+letter.review_token+'/decision',data);await load();message(data.action==='approve'?'Disetujui. PDF sudah tersedia di akun siswa.':'Catatan revisi sudah tersedia di akun siswa.');}
 catch(e){message(e.message);if(e.status===409){try{await load();}catch{}}}finally{buttons.forEach(b=>b.disabled=false);}
};
(async()=>{try{account=await api('/me');await load();}catch(e){if(e.status!==401)message(e.message);}})();
