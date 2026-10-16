import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.js';
import {seedAcademic,staffPassword} from '../test-support/academic.js';

test('Akademik: autentikasi cabang, approve/nomor unik, revisi, konflik versi, audit, dan PDF terkunci',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'eduagent-approval-'));const {app,db}=createApp({databasePath:join(dir,'app.sqlite')});
 seedAcademic(db);seedAcademic(db,'Palembang OPI','academic.opi');
 db.prepare('INSERT INTO partners(name,recipient) VALUES(?,?)').run('Mitra Approval','Pimpinan');
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;
 async function req(path,body,cookie,method=body?'POST':'GET'){return fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});}
 const cookie=r=>r.headers.get('set-cookie').split(';')[0];
 try{
  const registration=await req('/register',{branch:'Lahat',name:'Siswa Approval',nis:'303030',password:'password-siswa-aman',role:'academic'});const student=cookie(registration);
  const data={request_type:'PKL',category:'UI/UX Design',partner_id:1,start:'2026-10-01',end:'2026-11-01',issued:'2026-09-01',participants:[{name:'Siswa Approval',program:'Program Profesional 1 Tahun'}]};
  assert.equal((await req('/letters',{...data,number:'FORGED'},student)).status,400);
  const made=await(await req('/letters',{...data,status:'approved',approved_by:1},student)).json();const id=made.id;
  const row=db.prepare('SELECT * FROM letters WHERE id=?').get(id);assert.equal(row.status,'pending');assert.equal(row.number,null);
  const wa=new URL(made.whatsapp_url);assert.equal(wa.pathname,'/6282373725066');const url=new URL(wa.searchParams.get('text'));assert.equal(url.hostname,'eduagentpct.my.id');assert.equal(url.searchParams.get('request'),row.review_token);
  assert.equal((await req('/letters/'+id+'/pdf',undefined,student)).status,403);
  assert.equal((await req('/academic/requests',undefined,student)).status,401);
  assert.equal((await req('/academic/requests/'+row.review_token,undefined,student)).status,401);
  assert.equal((await req('/academic/login',{branch:'Lahat',username:'academic.test',password:'salah'})).status,401);
  const staff=cookie(await req('/academic/login',{branch:'Lahat',username:'academic.test',password:staffPassword}));
  const other=cookie(await req('/academic/login',{branch:'Palembang OPI',username:'academic.opi',password:staffPassword}));
  assert.equal((await req('/academic/requests/'+row.review_token,undefined,other)).status,404);
  assert.deepEqual(await(await req('/academic/requests',undefined,other)).json(),[]);
  assert.equal((await req('/academic/requests/'+row.review_token+'/decision',{action:'approve',number:'X',version:1},other)).status,404);
  // Viewing the link does not approve it.
  const viewed=await(await req('/academic/requests/'+row.review_token,undefined,staff)).json();assert.equal(viewed.status,'pending');
  assert.equal((await req('/academic/requests/'+row.review_token+'/decision',{action:'approve',number:'',version:1},staff)).status,400);
  assert.equal((await req('/letters/'+id,data,student,'PUT')).status,409);
  const revise=await req('/academic/requests/'+row.review_token+'/decision',{action:'revision',note:'Perbaiki periode kegiatan.',version:1},staff);assert.equal(revise.status,200);
  assert.equal((await req('/letters/'+id+'/pdf',undefined,student)).status,403);
  const own=await(await req('/letters',undefined,student)).json();assert.equal(own[0].review_note,'Perbaiki periode kegiatan.');
  assert.equal((await req('/letters/'+id,{...data,end:'2026-12-01'},student,'PUT')).status,200);
  assert.equal((await req('/academic/requests/'+row.review_token+'/decision',{action:'approve',number:'001/PKL/2026',version:1},staff)).status,409);
  const current=await(await req('/academic/requests/'+row.review_token,undefined,staff)).json();
  const approved=await req('/academic/requests/'+row.review_token+'/decision',{action:'approve',number:'001/PKL/2026',note:'Sesuai.',version:current.version},staff);assert.equal(approved.status,200);
  const final=await approved.json();assert.equal(final.status,'approved');assert.ok(final.approved_at);assert.ok(final.approved_by);
  assert.deepEqual(final.events.map(e=>e.action),['submitted','revision','resubmitted','approved']);
  assert.equal((await req('/letters/'+id+'/pdf',undefined,student)).status,200);
  assert.equal((await req('/letters/'+id,data,student,'PUT')).status,409);
  assert.equal((await req('/academic/requests/'+row.review_token+'/decision',{action:'approve',number:'002',version:current.version},staff)).status,409);
  const second=await(await req('/letters',data,student)).json();const secondRow=db.prepare('SELECT * FROM letters WHERE id=?').get(second.id);
  assert.equal((await req('/academic/requests/'+secondRow.review_token+'/decision',{action:'approve',number:'001/PKL/2026',version:1},staff)).status,409);
  assert.equal(db.prepare('SELECT status FROM letters WHERE id=?').get(second.id).status,'pending');
  assert.equal((await req('/academic/logout',{},staff)).status,200);
  assert.equal((await req('/academic/me',undefined,staff)).status,401);
 }finally{await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
});
