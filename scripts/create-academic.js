import { randomBytes, scryptSync } from 'node:crypto';
import { createApp } from '../server.js';
import { BRANCHES } from '../public/branches.js';
const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf('--'+name);return i<0?null:args[i+1];};
const branch=option('branch'),username=option('username'),name=option('name');
if(!BRANCHES.includes(branch)||!username||!/^[A-Za-z0-9._-]{3,100}$/.test(username)||!name?.trim()||name.length>100)throw Error('Penggunaan: node scripts/create-academic.js --branch Lahat --username akademik.lahat --name "Akademik Lahat"');
if(!process.stdin.isTTY)throw Error('Jalankan melalui terminal interaktif. Password tidak diterima lewat argumen atau environment.');
function hidden(prompt){
 process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{
  let value='';const done=(error)=>{process.stdin.setRawMode(false);process.stdin.pause();process.stdin.off('data',read);process.stdout.write('\n');error?reject(error):resolve(value);};
  const read=chunk=>{for(const c of chunk.toString()){if(c==='\u0003')return done(Error('Dibatalkan'));if(c==='\r'||c==='\n')return done();if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' '&&value.length<128)value+=c;}};
  process.stdin.on('data',read);
 });
}
const password=await hidden('Password akademik (12–128 karakter, tidak ditampilkan): ');
const confirmation=await hidden('Ulangi password: ');
if(password!==confirmation||password.length<12||password.length>128)throw Error('Password tidak sama atau panjangnya tidak sesuai.');
const {db}=createApp();
try{
 const salt=randomBytes(16).toString('hex');
 db.prepare('INSERT INTO academic_accounts(branch,username,name,salt,hash) VALUES(?,?,?,?,?)').run(branch,username.trim(),name.trim(),salt,scryptSync(password,salt,64).toString('hex'));
 console.log(`Akun akademik ${username} untuk ${branch} berhasil dibuat. Masuk melalui /academic.html.`);
}catch(e){if(String(e).includes('UNIQUE'))throw Error('Username sudah ada pada cabang ini; akun tidak diubah.');throw e;}finally{db.close();}
