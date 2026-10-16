// Rebuild only legacy tables whose global uniqueness must become per-branch.
// Keep IDs unchanged so sessions, letters, career profiles and plans retain ownership.
export function migrateBranches(db) {
  db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
  try {
    if (!db.prepare('PRAGMA table_info(students)').all().some(c => c.name === 'branch')) {
      db.exec(`CREATE TABLE students_branch_new(id INTEGER PRIMARY KEY, name TEXT NOT NULL, nis TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, branch TEXT NOT NULL DEFAULT 'Lahat', UNIQUE(branch,nis));
        INSERT INTO students_branch_new(id,name,nis,salt,hash) SELECT id,name,nis,salt,hash FROM students;
        DROP TABLE students; ALTER TABLE students_branch_new RENAME TO students;`);
    }
    if (!db.prepare('PRAGMA table_info(partners)').all().some(c => c.name === 'branch')) db.exec("ALTER TABLE partners ADD COLUMN branch TEXT NOT NULL DEFAULT 'Lahat'");
    if (!db.prepare('PRAGMA table_info(letters)').all().some(c => c.name === 'branch')) {
      db.exec(`CREATE TABLE letters_branch_new(id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), number TEXT, partner_id INTEGER NOT NULL REFERENCES partners(id), start TEXT NOT NULL, end TEXT NOT NULL, issued TEXT NOT NULL, participants TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP, request_type TEXT NOT NULL DEFAULT 'PKL', category TEXT, branch TEXT NOT NULL DEFAULT 'Lahat', UNIQUE(branch,number));
        INSERT INTO letters_branch_new(id,student_id,number,partner_id,start,end,issued,participants,created,request_type,category) SELECT id,student_id,number,partner_id,start,end,issued,participants,created,request_type,category FROM letters;
        DROP TABLE letters; ALTER TABLE letters_branch_new RENAME TO letters;`);
    }
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw Error('Branch migration stopped: inconsistent foreign keys. Original data retained.');
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  finally { db.exec('PRAGMA foreign_keys=ON'); }
}
