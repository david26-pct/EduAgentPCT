import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { createApp } from '../server.js';
import { BRANCHES, getSignatureQR } from '../public/branches.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const decode=path=>{const image=PNG.sync.read(readFileSync(path));return jsQR(new Uint8ClampedArray(image.data),image.width,image.height);};

test('QR asli tetap terbaca dari PDF PKL Lahat, termasuk surat panjang; tidak dipakai TCS/cabang lain',async()=>{
 const original=decode(join(root,'public/assets/signature-lahat.png'));assert.ok(original);
 for(const branch of BRANCHES){assert.equal(Boolean(getSignatureQR(branch,'PKL')),branch==='Lahat');assert.equal(getSignatureQR(branch,'TCS'),null);}
 const dir=mkdtempSync(join(tmpdir(),'eduagent-signature-'));
 writeFileSync(join(dir,'fonts.conf'), `<fontconfig><include>/etc/fonts/fonts.conf</include><cachedir>${dir}/font-cache</cachedir></fontconfig>`);const {app,db}=createApp({databasePath:join(dir,'app.sqlite')});
 db.prepare('INSERT INTO partners(name,recipient) VALUES(?,?)').run('Instansi Uji QR','Pimpinan');
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;
 try{
  const registration=await fetch(base+'/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({branch:'Lahat',name:'Siswa QR',nis:'909090',password:'password-qr-aman'})});assert.equal(registration.status,200);
  const headers={'Content-Type':'application/json',Cookie:registration.headers.get('set-cookie').split(';')[0]};
  for(const count of [1,10]){
   const participants=Array.from({length:count},(_,i)=>({name:i===0?'Siswa QR':`Siswa Peserta Dengan Nama Panjang Nomor ${i}`,program:'Program Profesional 1 Tahun Koding, AI, dan Bisnis Digital'}));
   const response=await fetch(base+'/letters',{method:'POST',headers,body:JSON.stringify({request_type:'PKL',category:'Web Programing',partner_id:1,class_name:'Koding A 2026',issued:'2026-09-01',participants})});assert.equal(response.status,201);
   const {id}=await response.json();db.prepare("UPDATE letters SET start='2026-10-01',end='2026-11-01',status='approved',number=? WHERE id=?").run(`QR/${count}`,id);const pdf=await fetch(base+`/letters/${id}/pdf`,{headers});assert.equal(pdf.status,200);
   const path=join(dir,`letter-${count}.pdf`);writeFileSync(path,Buffer.from(await pdf.arrayBuffer()));
   execFileSync(process.env.PDFTOPPM_PATH || '/usr/bin/pdftoppm',['-r','200','-png',path,join(dir,`page-${count}`)],{env:{...process.env,FONTCONFIG_FILE:join(dir,'fonts.conf')}});
   const found=readdirSync(dir).filter(n=>n.startsWith(`page-${count}-`)&&n.endsWith('.png')).map(n=>decode(join(dir,n))).filter(Boolean);
   assert.equal(found.length,1,'QR harus muncul tepat sekali');assert.equal(found[0].data,original.data,'Isi QR PDF harus sama persis dengan sumber');
   const text=execFileSync('pdftotext',['-layout',path,'-'],{encoding:'utf8'});assert.match(text,/Abdul Rajab/);
   if(count===1)copyFileSync(path,'/workspace/artifacts/eduagent-pkl-qr.pdf');
  }
 }finally{await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
});
