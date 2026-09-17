// db.js - Modul Manajemen Database SQLite (node:sqlite bawaan Node.js)
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, 'pengingat_jiwa.db');

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  database.exec(`
    -- Tabel Pengaturan Faskes & SMTP
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabel Data Pasien ODGJ
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_rm TEXT UNIQUE NOT NULL,
      nik TEXT,
      no_bpjs TEXT,
      name TEXT NOT NULL,
      gender TEXT CHECK(gender IN ('L', 'P')) NOT NULL,
      birth_date TEXT,
      age INTEGER,
      address TEXT NOT NULL,
      village TEXT, -- Desa / Dusun
      diagnosis_code TEXT NOT NULL, -- ICD-10 misal F20.0, F31.9
      diagnosis_name TEXT NOT NULL, -- misal Skizofrenia Paranoid
      category_spm TEXT DEFAULT 'ODGJ Berat' CHECK(category_spm IN ('ODGJ Berat', 'ODGJ Ringan-Sedang')),
      pmo_name TEXT NOT NULL, -- Nama Pengawas Menelan Obat / Keluarga
      pmo_relation TEXT NOT NULL, -- Hubungan (Orang Tua, Anak, Suami/Istri, Saudara, Kader)
      pmo_phone TEXT,
      pmo_email TEXT NOT NULL, -- Email penerima notifikasi pengingat
      notes TEXT,
      status TEXT DEFAULT 'Aktif' CHECK(status IN ('Aktif', 'Meninggal', 'Pindah Faskes', 'Drop Out')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabel Kunjungan & Resep Obat Pasien
    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      visit_date TEXT NOT NULL, -- Format YYYY-MM-DD
      next_control_date TEXT NOT NULL, -- Format YYYY-MM-DD
      medicine_name TEXT NOT NULL, -- Nama obat jiwa misal Risperidone 2mg
      dosage_per_day REAL NOT NULL, -- Jumlah pemakaian per hari (misal 2 tablet/hari)
      quantity INTEGER NOT NULL, -- Total tablet yang diberikan (misal 60 tablet)
      days_supply INTEGER NOT NULL, -- Durasi hari obat cukup (misal 30 hari)
      medicine_exhausted_date TEXT NOT NULL, -- Format YYYY-MM-DD (visit_date + days_supply)
      doctor_name TEXT DEFAULT 'Dokter Puskesmas',
      doctor_notes TEXT, -- Catatan klinis / efek samping / saran
      status TEXT DEFAULT 'Berjalan' CHECK(status IN ('Berjalan', 'Selesai', 'Diganti')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    -- Tabel Log Pengiriman Notifikasi Email
    CREATE TABLE IF NOT EXISTS notification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      prescription_id INTEGER,
      notification_type TEXT NOT NULL, -- 'h1_control', 'h1_medicine', 'medicine_exhausted', 'manual_reminder'
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Terkirim', 'Gagal', 'Simulasi')),
      error_message TEXT,
      sent_date TEXT NOT NULL, -- Format YYYY-MM-DD
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
  `);

  // Inisialisasi default settings jika belum ada
  const count = database.prepare("SELECT COUNT(*) as count FROM settings WHERE key = 'faskes_name'").get();
  if (!count || count.count === 0) {
    const defaultSettings = [
      ['faskes_name', 'UPTD BLUD Puskesmas Sesela'],
      ['faskes_code', 'P5201010201'],
      ['faskes_address', 'Jl. Raya Sesela, Kec. Gunungsari, Kab. Lombok Barat, NTB'],
      ['faskes_phone', '(0370) 641234 / 0812-3456-7890 (Hotline Keswa)'],
      ['keswa_officer', 'Pengelola Program Jiwa Puskesmas Sesela'],
      ['smtp_host', 'smtp.gmail.com'],
      ['smtp_port', '465'],
      ['smtp_secure', 'true'],
      ['smtp_user', ''],
      ['smtp_pass', ''],
      ['smtp_sender_name', 'Layanan Keswa Puskesmas Sesela'],
      ['auto_send_enabled', 'true'],
      ['last_scheduler_run', '']
    ];

    const insert = database.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of defaultSettings) {
      insert.run(key, value);
    }
  }
}

// Helper query functions
function getSetting(key, defaultValue = '') {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setSetting(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, String(value));
}

function getAllSettings() {
  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of rows) {
    obj[r.key] = r.value;
  }
  return obj;
}

module.exports = {
  getDb,
  getSetting,
  setSetting,
  getAllSettings,
  DB_PATH
};
