import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createApp} from '../server.js';
import {seedAcademic,staffPassword} from '../test-support/academic.js';

test('Amplop DL: persetujuan/pemilik wajib, logo, nama tujuan manual/resmi, dan satu halaman ukuran asli',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'eduagent-envelope-'));const {app,db}=createApp({databasePath:join(dir,'app.sqlite')});seedAcademic(db);
 db.prepare('INSERT INTO partners(name,recipient) VALUES(?,?)').run('Instansi Uji Amplop','Manager');
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;
 async function req(path,body,cookie){return fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});}
 const cookie=r=>r.headers.get('set-cookie').split(';')[0];
 try{
  assert.equal((await req('/letters/1/envelope.pdf')).status,401);
  const student=cookie(await req('/register',{branch:'Lahat',name:'Siswa Amplop',nis:'818181',password:'password-amplop-aman'}));
  const staff=cookie(await req('/academic/login',{branch:'Lahat',username:'academic.test',password:staffPassword}));
  const other=cookie(await req('/register',{branch:'Lahat',name:'Siswa Lain',nis:'828282',password:'password-lain-aman'}));
  for(const mode of ['official','custom','long']){
   const target=mode==='long'?'W'.repeat(150):'PT Tujuan Isian Siswa';
   if(mode==='long')db.prepare('UPDATE partners SET name=?,recipient=? WHERE id=1').run(target,'W'.repeat(150));
   const body={request_type:'PKL',category:'Desain Grafis',partner_id:mode==='custom'?null:1,...(mode==='custom'?{custom_partner_name:target}:{}),start:'2026-10-01',end:'2026-11-01',issued:'2026-09-01',participants:[{name:'Siswa Amplop',program:'Program Profesional 1 Tahun'}]};
   const created=await req('/letters',body,student);assert.equal(created.status,201);const {id}=await created.json();
   assert.equal((await req(`/letters/${id}/envelope.pdf`,undefined,student)).status,403);
   const row=db.prepare('SELECT * FROM letters WHERE id=?').get(id);
   assert.equal((await req('/academic/requests/'+row.review_token+'/decision',{action:'approve',number:mode==='long'?'W'.repeat(80):`AMPLOP/${mode}`,version:row.version},staff)).status,200);
   assert.equal((await req(`/letters/${id}/envelope.pdf`,undefined,other)).status,404);
   const envelope=await req(`/letters/${id}/envelope.pdf`,undefined,student);assert.equal(envelope.status,200);assert.match(envelope.headers.get('content-type'),/application\/pdf/);
   const path=join(dir,mode+'.pdf');writeFileSync(path,Buffer.from(await envelope.arrayBuffer()));
   const info=execFileSync('pdfinfo',[path],{encoding:'utf8'});assert.match(info,/Pages:\s+1/);assert.match(info,/Page size:\s+623\.62\d* x 311\.81\d* pts/);
   const text=execFileSync('pdftotext',['-layout',path,'-'],{encoding:'utf8'});assert.match(text,/PalComTech Lahat/);assert.match(text,/Kepada Yth/);assert.match(text,/Di Tempat/);
   if(mode!=='long')assert.ok(text.includes(mode==='custom'?target:'Instansi Uji Amplop'));
   const images=execFileSync('pdfimages',['-list',path],{encoding:'utf8'});assert.match(images,/1239\s+222/,'Logo asli harus tertanam pada amplop');
   if(mode==='official')copyFileSync(path,'/workspace/artifacts/draft-amplop-palcomtech.pdf');
  }
 }finally{await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
});
