import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.js';
const root = fileURLToPath(new URL('../', import.meta.url));

test('Profil privat, pencocokan mitra terverifikasi, impor profil, rencana dasar, dan AI simulasi', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'eduagent-career-')); const databasePath = join(dir, 'app.sqlite');
  let calls = 0, fail = false;
  const { app, db } = createApp({ databasePath, careerOptions: { aiKey: 'test-only-placeholder', aiFetch: async (url, options) => {
    calls++; const sent = JSON.parse(options.body);
    assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(sent.store, false);
    assert.equal(sent.input.includes('Siswa Career'), false); assert.equal(sent.input.includes('998877'), false);
    assert.equal(sent.input.includes('https://portfolio.example'), false); assert.equal(sent.input.includes('Lahat'), false);
    return fail ? { ok: false } : { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Hari 1–3: Latihan Figma. Hari 4–14: Buat prototipe dan evaluasi bersama pengajar.' }] }] }) };
  } } });
  for (const name of ['Mitra Sesuai', 'Mitra Tutup', 'Mitra Belum Terverifikasi', 'Mitra Kategori Lain']) db.prepare('INSERT INTO partners(name,recipient) VALUES(?,?)').run(name,'Pimpinan');
  const metadata = { categories: ['UI/UX Design'], request_types: ['PKL'], skills: ['Figma','User Research'], location: 'Lahat', description: 'Pembuatan prototipe aplikasi.', acceptance: 'open', verified: true };
  const profiles = ['Mitra Sesuai','Mitra Tutup','Mitra Belum Terverifikasi','Mitra Kategori Lain'].map(name => ({ name, ...metadata }));
  profiles[1].acceptance='closed'; profiles[2].verified=false; profiles[3].categories=['Content Creator'];
  writeFileSync(join(dir,'profiles.json'),JSON.stringify(profiles));
  execFileSync(process.execPath,['scripts/import-partner-profiles.js',join(dir,'profiles.json')],{cwd:root,env:{...process.env,DB_PATH:databasePath}});
  const server = app.listen(0,'127.0.0.1'); await new Promise(r => server.once('listening',r));
  const url = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, cookie, method = body ? 'POST' : 'GET') {
    return fetch(url+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  }
  try {
    assert.equal((await request('/career')).status,401);
    const registration = await request('/register',{branch:'Lahat',name:'Siswa Career',nis:'998877',password:'password-career-aman'});
    const cookie = registration.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/career/matches',undefined,cookie)).status,400);
    const profile = { request_type:'PKL',category:'UI/UX Design',skills:['Figma'],interests:'Desain aplikasi',experience:'Prototipe sederhana',location:'Lahat',portfolio:'https://portfolio.example' };
    assert.equal((await request('/career/profile',{...profile,portfolio:'javascript:alert(1)'},cookie,'PUT')).status,400);
    assert.equal((await request('/career/profile',profile,cookie,'PUT')).status,200);
    const result = await (await request('/career/matches',undefined,cookie)).json();
    assert.equal(result.matches.length,1); assert.equal(result.matches[0].name,'Mitra Sesuai');
    assert.equal(result.matches[0].score,85); assert.deepEqual(result.matches[0].gap,['user research']);
    const basic = await (await request('/career/plan',{use_ai:false},cookie)).json(); assert.equal(basic.mode,'template'); assert.match(basic.content,/UI\/UX Design/); assert.equal(calls,0);
    assert.equal((await request('/career/plan',{use_ai:true},cookie)).status,400); assert.equal(calls,0);
    const ai = await (await request('/career/plan',{use_ai:true,consent:true},cookie)).json(); assert.equal(ai.mode,'ai'); assert.equal(calls,1);
    fail=true; assert.equal((await request('/career/plan',{use_ai:true,consent:true},cookie)).status,502); fail=false;
    assert.equal((await (await request('/career',undefined,cookie)).json()).plan.mode,'ai');
    assert.equal((await request('/career/plan',{use_ai:true,consent:true},cookie)).status,200);
    // Verify both the persisted daily budget and the rejection before another provider call.
    const day=new Date().toISOString().slice(0,10); assert.equal(db.prepare('SELECT count FROM ai_attempts WHERE day=?').get(day).count,3);
    assert.equal((await request('/career/plan',{use_ai:true,consent:true},cookie)).status,429);
    assert.equal(calls,3);
    const other = await request('/register',{branch:'Lahat',name:'Autre Siswa',nis:'112233',password:'password-career-lain'});
    const otherCookie = other.headers.get('set-cookie').split(';')[0];
    const otherState=await (await request('/career',undefined,otherCookie)).json(); assert.equal(otherState.profile,null); assert.equal(otherState.plan,null);
    assert.equal((await request('/career/profile',{...profile,skills:['Figma','CSS']},cookie,'PUT')).status,200);
    assert.equal((await (await request('/career',undefined,cookie)).json()).plan,null);
  } finally { await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true}); }
});

test('Tanpa kunci API, AI ditolak dengan jelas dan rencana dasar tetap berfungsi', async () => {
 const dir=mkdtempSync(join(tmpdir(),'eduagent-noai-'));const {app,db}=createApp({databasePath:join(dir,'app.sqlite'),careerOptions:{aiKey:''}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}/api`;
 try {
  const registered=await fetch(url+'/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({branch:'Lahat',name:'Siswa Tanpa AI',nis:'123123',password:'password-tanpa-ai'})});
  const headers={'Content-Type':'application/json',Cookie:registered.headers.get('set-cookie').split(';')[0]};
  await fetch(url+'/career/profile',{method:'PUT',headers,body:JSON.stringify({request_type:'TCS',category:'Internet of Things',skills:['Sensor']})});
  assert.equal((await (await fetch(url+'/career',{headers})).json()).ai_available,false);
  assert.equal((await fetch(url+'/career/plan',{method:'POST',headers,body:JSON.stringify({use_ai:true,consent:true})})).status,503);
  const plan=await fetch(url+'/career/plan',{method:'POST',headers,body:JSON.stringify({use_ai:false})});assert.equal((await plan.json()).mode,'template');
 } finally {await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
});
