import { randomBytes,scryptSync } from 'node:crypto';
export const staffPassword='test-akademik-password';
export function seedAcademic(db,branch='Lahat',username='academic.test'){
 const salt=randomBytes(16).toString('hex');
 return db.prepare('INSERT INTO academic_accounts(branch,username,name,salt,hash) VALUES(?,?,?,?,?)').run(branch,username,'Akademik Uji',salt,scryptSync(staffPassword,salt,64).toString('hex'));
}
