// seed.js - Seeder Data Simulasi Pasien ODGJ Puskesmas Sesela
const { getDb } = require('./db');

function getLocalDateString(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(baseDateStr, days) {
  const d = new Date(baseDateStr + 'T00:00:00');
  d.setDate(d.getDate() + Number(days));
  return getLocalDateString(d);
}

function seedDatabase() {
  const db = getDb();
  const today = getLocalDateString();
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const threeDaysAgo = addDays(today, -3);
  const thirtyDaysAgo = addDays(today, -30);
  const twentyDaysAgo = addDays(today, -20);
  const tenDaysAgo = addDays(today, -10);

  console.log(`[Seeder] Memulai inisialisasi data contoh (Hari ini: ${today}, Besok H-1: ${tomorrow})...`);

  // Kosongkan data lama jika ada
  db.exec(`
    DELETE FROM notification_logs;
    DELETE FROM prescriptions;
    DELETE FROM patients;
  `);

  const insertPatient = db.prepare(`
    INSERT INTO patients (
      no_rm, nik, no_bpjs, name, gender, birth_date, age,
      address, village, diagnosis_code, diagnosis_name, category_spm,
      pmo_name, pmo_relation, pmo_phone, pmo_email, notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPrescription = db.prepare(`
    INSERT INTO prescriptions (
      patient_id, visit_date, next_control_date, medicine_name, dosage_per_day,
      quantity, days_supply, medicine_exhausted_date, doctor_name, doctor_notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Berjalan')
  `);

  // 1. Pasien A: Kontrol BESOK (H-1 Kontrol)
  const p1 = insertPatient.run(
    'RM-00124',
    '5201011504920002',
    '0001892345671',
    'Ahmad Zulkifli',
    'L',
    '1992-04-15',
    34,
    'Dusun Karang Anyar RT 02/01',
    'Desa Sesela',
    'F20.0',
    'Skizofrenia Paranoid',
    'ODGJ Berat',
    'Hj. Siti Mariam',
    'Ibu Kandung',
    '0819-0712-3456',
    'keluarga.zulkifli@example.com',
    'Pasien kooperatif, tidur nyenyak jika minum obat teratur. Jangan lewat jadwal kontrol.',
    'Aktif'
  );

  insertPrescription.run(
    p1.lastInsertRowid,
    twentyDaysAgo,
    tomorrow, // Besok H-1 Kontrol!
    'Risperidone 2mg + Trihexyphenidyl 2mg',
    2.0,
    42,
    21,
    tomorrow, // Obat juga habis besok
    'dr. Ni Made Wulandari',
    'Pertahankan dosis. Evaluasi gejala waham dan kekakuan otot.'
  );

  // 2. Pasien B: Obat Habis BESOK (H-1 Obat Habis), tapi jadwal kontrol masih 3 hari lagi
  const p2 = insertPatient.run(
    'RM-00188',
    '5201015608880001',
    '0002441982736',
    'Baiq Nurhayati',
    'P',
    '1988-08-16',
    38,
    'Dusun Dasan Ketujur',
    'Desa Midang',
    'F31.1',
    'Gangguan Afektif Bipolar, Episode Kini Manik Tanpa Gejala Psikotik',
    'ODGJ Berat',
    'H. Lalu Sudirman',
    'Suami',
    '0878-6543-2109',
    'keluarga.nurhayati@example.com',
    'Sering gelisah jika obat terlambat diminum. PMO aktif mendampingi.',
    'Aktif'
  );

  insertPrescription.run(
    p2.lastInsertRowid,
    twentyDaysAgo,
    addDays(today, 3),
    'Haloperidol 5mg + Chlorpromazine 100mg',
    2.0,
    42,
    21,
    tomorrow, // Obat habis besok (H-1)!
    'dr. I Wayan Artana',
    'Pasien sempat mengeluh tremor ringan, ingatkan minum THP jika diperlukan.'
  );

  // 3. Pasien C: Terlambat Kontrol (Overdue 3 Hari) - Warning SPM Drop Out
  const p3 = insertPatient.run(
    'RM-00095',
    '5201011011850003',
    '0001229871234',
    'Mahsun Saputra',
    'L',
    '1985-11-10',
    41,
    'Dusun Karang Mas-Mas RT 01',
    'Desa Gunungsari',
    'F20.3',
    'Skizofrenia Tak Terinci',
    'ODGJ Berat',
    'Rohani',
    'Istri',
    '0852-3890-1122',
    'keluarga.mahsun@example.com',
    'Perlu pemantauan kader jiwa karena keluarga terkadang lupa mengambil resep.',
    'Aktif'
  );

  insertPrescription.run(
    p3.lastInsertRowid,
    thirtyDaysAgo,
    threeDaysAgo, // Terlambat 3 hari!
    'Chlorpromazine 100mg + Trihexyphenidyl 2mg',
    1.0,
    27,
    27,
    threeDaysAgo,
    'dr. Ni Made Wulandari',
    'Segera kunjungan rumah jika tidak hadir kontrol lebih dari 7 hari.'
  );

  // 4. Pasien D: Kondisi Terkontrol Baik (Jadwal Kontrol Masih 14 Hari Lagi)
  const p4 = insertPatient.run(
    'RM-00210',
    '5201014502950004',
    '0003991209384',
    'Lale Safitri',
    'P',
    '1995-02-05',
    31,
    'Dusun Dopang Tengah',
    'Desa Dopang',
    'F32.2',
    'Episode Depresif Berat Tanpa Gejala Psikotik',
    'ODGJ Ringan-Sedang',
    'Suparlan',
    'Ayah Kandung',
    '0813-3921-9988',
    'keluarga.lale@example.com',
    'Kondisi stabil, sudah mulai beraktivitas harian di rumah.',
    'Aktif'
  );

  insertPrescription.run(
    p4.lastInsertRowid,
    tenDaysAgo,
    addDays(today, 14),
    'Amitriptyline 25mg',
    1.0,
    30,
    30,
    addDays(today, 20),
    'dr. I Wayan Artana',
    'Respons pengobatan baik. Anjurkan dukungan sosial keluarga.'
  );

  // 5. Pasien E: Kontrol Hari Ini (Hari H)
  const p5 = insertPatient.run(
    'RM-00305',
    '5201012209990001',
    '0004128930192',
    'Muhammad Ridho',
    'L',
    '1999-09-22',
    27,
    'Dusun Kekait Daye',
    'Desa Kekait',
    'F20.1',
    'Skizofrenia Hebefrenik',
    'ODGJ Berat',
    'Siti Hajar',
    'Kakak Kandung',
    '0877-1234-8899',
    'keluarga.ridho@example.com',
    'Pasien rutin hadir tepat waktu didampingi kakaknya.',
    'Aktif'
  );

  insertPrescription.run(
    p5.lastInsertRowid,
    thirtyDaysAgo,
    today, // Hari ini jadwal kontrol!
    'Risperidone 2mg',
    2.0,
    60,
    30,
    today,
    'dr. Ni Made Wulandari',
    'Evaluasi fungsi kognitif dan interaksi sosial.'
  );

  console.log('[Seeder] Berhasil memasukkan 5 data pasien contoh ODGJ beserta resep & jadwal kontrol!');
}

seedDatabase();
