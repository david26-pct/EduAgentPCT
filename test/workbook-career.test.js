import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createApp } from '../server.js';
const root=fileURLToPath(new URL('../',import.meta.url));

test('Data Excel: lima profil PKL Lahat menghasilkan rekomendasi nyata dan dapat dipilih untuk surat',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'eduagent-workbook-')),databasePath=join(dir,'app.sqlite');
 const {app,db}=createApp({databasePath});
 const run=(script,...args)=>execFileSync(process.execPath,[script,...args],{cwd:root,env:{...process.env,DB_PATH:databasePath}});
 run('scripts/import-partners.js','scripts/partners-palcomtech.json');
 run('scripts/import-partner-profiles.js','scripts/career-partners-lahat.json','--only-missing');
 run('scripts/import-partner-profiles.js','scripts/career-partners-lahat.json','--only-missing');
 assert.equal(db.prepare('SELECT count(*) AS n FROM partner_profiles').get().n,5);
 const profiles=JSON.parse(readFileSync(join(root,'scripts/career-partners-lahat.json')));
 for(const p of profiles){assert.equal(p.branch,'Lahat');assert.deepEqual(p.request_types,['PKL']);assert.equal(p.verified,true);}
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const registered=await fetch(base+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({branch:'Lahat',name:'Siswa Uji Excel',nis:'989898',password:'password-excel-aman'})});
  assert.equal(registered.status,200);const headers={'Content-Type':'application/json',Cookie:registered.headers.get('set-cookie').split(';')[0]};
  async function match(category,request_type='PKL',skills=['Canva','Capcut','Laravel']){
   const saved=await fetch(base+'/api/career/profile',{method:'PUT',headers,body:JSON.stringify({request_type,category,skills,location:'Lahat'})});assert.equal(saved.status,200);
   return(await fetch(base+'/api/career/matches',{headers})).json();
  }
  const web=await match('Web Programing');assert.equal(web.matches.length,1);assert.equal(web.matches[0].name,'Badan Pusat Statistik');assert.equal(web.matches[0].score,100);
  assert.equal((await match('UI/UX Design')).matches[0].name,'Notaris Laogita');
  assert.equal((await match('Internet of Things')).matches[0].name,'Jemmy Computer');
  assert.equal((await match('Teknisi dan Jaringan')).matches[0].name,'Jemmy Computer');
  const design=await match('Desain Grafis');assert.equal(design.matches.length,5);assert.ok(design.matches.some(p=>p.name==='Caesar Advertising'));
  const marketing=await match('Digital Marekting');assert.deepEqual(new Set(marketing.matches.map(p=>p.name)),new Set(['Jemmy Computer','Badan Zakat Nasional']));
  assert.equal((await match('Desain Grafis','TCS')).matches.length,0);
  await match('UI/UX Design','PKL',['Figma']);
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:'session',value:headers.Cookie.slice('session='.length),url:base}]);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#greeting').waitFor();await page.locator('aside [data-view=career]').click();
  await page.locator('#career-match').click();await page.locator('.career-result').waitFor();
  assert.match(await page.locator('.career-result').innerText(),/Notaris Laogita/);
  await page.screenshot({path:'/workspace/artifacts/eduagent-career-match.png',fullPage:true});
  await page.locator('.career-result button').click();
  assert.equal(await page.locator('#letter-form [name=category]').inputValue(),'UI/UX Design');
  const partnerId=await page.locator('#letter-form [name=partner_id]').inputValue();assert.equal(db.prepare('SELECT name FROM partners WHERE id=?').get(partnerId).name,'Notaris Laogita');
  assert.deepEqual(errors,[]);
  // Initial data must not overwrite a later academic edit on subsequent deployment.
  const row=db.prepare('SELECT partner_id,data FROM partner_profiles LIMIT 1').get();const data=JSON.parse(row.data);data.acceptance='closed';
  db.prepare('UPDATE partner_profiles SET data=? WHERE partner_id=?').run(JSON.stringify(data),row.partner_id);
  run('scripts/import-partner-profiles.js','scripts/career-partners-lahat.json','--only-missing');
  assert.equal(JSON.parse(db.prepare('SELECT data FROM partner_profiles WHERE partner_id=?').get(row.partner_id).data).acceptance,'closed');
 }finally{await browser.close();await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
});
