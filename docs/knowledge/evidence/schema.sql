-- Source-derived schema on a fresh temporary SQLite database.
-- Source commit b98653a0cf2c17cc20d28780452184d991019556; inspected 2026-10-17.
-- No application/user rows are included. Not a production backup or migration script.

CREATE TABLE academic_accounts(id INTEGER PRIMARY KEY, branch TEXT NOT NULL, username TEXT NOT NULL, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, UNIQUE(branch,username));

CREATE TABLE academic_email_jobs(id INTEGER PRIMARY KEY, letter_id INTEGER NOT NULL REFERENCES letters(id), letter_version INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0, lease_token TEXT, last_code TEXT, submitted_at TEXT, UNIQUE(letter_id,letter_version));

CREATE TABLE academic_sessions(token TEXT PRIMARY KEY, academic_id INTEGER NOT NULL REFERENCES academic_accounts(id), expires INTEGER NOT NULL);

CREATE TABLE ai_attempts(student_id INTEGER NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(student_id,day));

CREATE TABLE letter_events(id INTEGER PRIMARY KEY, letter_id INTEGER NOT NULL REFERENCES letters(id), actor_type TEXT NOT NULL, actor_id INTEGER NOT NULL, actor_name TEXT NOT NULL, action TEXT NOT NULL, number TEXT, note TEXT NOT NULL DEFAULT '', created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE "letters" (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), number TEXT, partner_id INTEGER REFERENCES partners(id), start TEXT NOT NULL, end TEXT NOT NULL, issued TEXT NOT NULL, participants TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP, request_type TEXT NOT NULL DEFAULT 'PKL', category TEXT, branch TEXT NOT NULL DEFAULT 'Lahat', custom_partner_name TEXT, status TEXT NOT NULL DEFAULT 'pending', review_token TEXT, review_note TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1, approved_by INTEGER, approved_at TEXT, UNIQUE(branch,number));

CREATE TABLE partner_profiles(partner_id INTEGER PRIMARY KEY REFERENCES partners(id), data TEXT NOT NULL);

CREATE TABLE partners(id INTEGER PRIMARY KEY, name TEXT NOT NULL, recipient TEXT NOT NULL, branch TEXT NOT NULL DEFAULT 'Lahat');

CREATE TABLE preparation_plans(student_id INTEGER PRIMARY KEY REFERENCES students(id), mode TEXT NOT NULL, content TEXT NOT NULL, created TEXT NOT NULL);

CREATE TABLE sessions(token TEXT PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), expires INTEGER NOT NULL);

CREATE TABLE skill_profiles(student_id INTEGER PRIMARY KEY REFERENCES students(id), data TEXT NOT NULL);

CREATE TABLE "students"(id INTEGER PRIMARY KEY, name TEXT NOT NULL, nis TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, branch TEXT NOT NULL DEFAULT 'Lahat', UNIQUE(branch,nis));

CREATE UNIQUE INDEX letters_review_token ON letters(review_token);
