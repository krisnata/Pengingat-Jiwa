// server.js - Server HTTP, REST API, & Scheduler Otomatis Pengingat Jiwa
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const { getDb, getSetting, setSetting, getAllSettings } = require('./db');
const {
  dispatchEmail,
  generateControlReminderEmail,
  generateMedicineReminderEmail
} = require('./mailer');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Helper Tanggal Lokal (Format YYYY-MM-DD)
function getLocalDateString(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + Number(days));
  return getLocalDateString(d);
}

function daysDiff(targetDateStr, baseDateStr = getLocalDateString()) {
  const target = new Date(targetDateStr + 'T00:00:00');
  const base = new Date(baseDateStr + 'T00:00:00');
  const diffTime = target - base;
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// MIME Types untuk Static File Server
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * Logika Inti Otomasi Pengingat H-1 Kontrol & Obat Habis
 */
async function runReminderCheck() {
  const db = getDb();
  const todayStr = getLocalDateString();
  const tomorrowStr = addDaysToDate(todayStr, 1);

  const faskes = {
    name: getSetting('faskes_name', 'UPTD BLUD Puskesmas Sesela'),
    address: getSetting('faskes_address', 'Jl. Raya Sesela, Kec. Gunungsari, Kab. Lombok Barat'),
    phone: getSetting('faskes_phone', '(0370) 641234')
  };

  // Ambil resep aktif terbaru dari setiap pasien
  const activePrescriptions = db.prepare(`
    SELECT p.*, pt.name as patient_name, pt.no_rm, pt.diagnosis_code, pt.diagnosis_name,
           pt.category_spm, pt.pmo_name, pt.pmo_relation, pt.pmo_phone, pt.pmo_email, pt.status as patient_status
    FROM prescriptions p
    INNER JOIN patients pt ON p.patient_id = pt.id
    WHERE p.status = 'Berjalan' AND pt.status = 'Aktif'
    ORDER BY p.visit_date DESC
  `).all();

  const results = {
    h1ControlSent: 0,
    h1MedicineSent: 0,
    medicineExhaustedSent: 0,
    alreadySentCount: 0,
    errors: []
  };

  for (const pres of activePrescriptions) {
    const patientObj = {
      id: pres.patient_id,
      name: pres.patient_name,
      no_rm: pres.no_rm,
      diagnosis_code: pres.diagnosis_code,
      diagnosis_name: pres.diagnosis_name,
      category_spm: pres.category_spm,
      pmo_name: pres.pmo_name,
      pmo_relation: pres.pmo_relation,
      pmo_phone: pres.pmo_phone,
      pmo_email: pres.pmo_email
    };

    if (!patientObj.pmo_email || !patientObj.pmo_email.includes('@')) {
      continue;
    }

    // 1. Cek Apakah Besok adalah H-1 Jadwal Kontrol
    if (pres.next_control_date === tomorrowStr) {
      const alreadySent = db.prepare(`
        SELECT id FROM notification_logs 
        WHERE patient_id = ? AND prescription_id = ? AND notification_type = 'h1_control' AND sent_date = ?
      `).get(patientObj.id, pres.id, todayStr);

      if (!alreadySent) {
        const emailContent = generateControlReminderEmail({
          patient: patientObj,
          prescription: pres,
          faskes
        });

        try {
          const dispatch = await dispatchEmail({
            to: patientObj.pmo_email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
          });

          db.prepare(`
            INSERT INTO notification_logs (patient_id, prescription_id, notification_type, recipient_email, subject, body, status, error_message, sent_date)
            VALUES (?, ?, 'h1_control', ?, ?, ?, ?, ?, ?)
          `).run(
            patientObj.id,
            pres.id,
            patientObj.pmo_email,
            emailContent.subject,
            emailContent.html,
            dispatch.status,
            dispatch.error || dispatch.message || null,
            todayStr
          );

          results.h1ControlSent++;
        } catch (err) {
          results.errors.push(`H-1 Kontrol ${patientObj.name}: ${err.message}`);
        }
      } else {
        results.alreadySentCount++;
      }
    }

    // 2. Cek Apakah Besok adalah H-1 Obat Habis
    if (pres.medicine_exhausted_date === tomorrowStr) {
      const alreadySentMed = db.prepare(`
        SELECT id FROM notification_logs 
        WHERE patient_id = ? AND prescription_id = ? AND notification_type = 'h1_medicine' AND sent_date = ?
      `).get(patientObj.id, pres.id, todayStr);

      if (!alreadySentMed) {
        const emailContent = generateMedicineReminderEmail({
          patient: patientObj,
          prescription: pres,
          faskes,
          isExhaustedToday: false
        });

        try {
          const dispatch = await dispatchEmail({
            to: patientObj.pmo_email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
          });

          db.prepare(`
            INSERT INTO notification_logs (patient_id, prescription_id, notification_type, recipient_email, subject, body, status, error_message, sent_date)
            VALUES (?, ?, 'h1_medicine', ?, ?, ?, ?, ?, ?)
          `).run(
            patientObj.id,
            pres.id,
            patientObj.pmo_email,
            emailContent.subject,
            emailContent.html,
            dispatch.status,
            dispatch.error || dispatch.message || null,
            todayStr
          );

          results.h1MedicineSent++;
        } catch (err) {
          results.errors.push(`H-1 Obat ${patientObj.name}: ${err.message}`);
        }
      } else {
        results.alreadySentCount++;
      }
    }

    // 3. Cek Apakah Hari Ini Obat Habis
    if (pres.medicine_exhausted_date === todayStr) {
      const alreadySentExh = db.prepare(`
        SELECT id FROM notification_logs 
        WHERE patient_id = ? AND prescription_id = ? AND notification_type = 'medicine_exhausted' AND sent_date = ?
      `).get(patientObj.id, pres.id, todayStr);

      if (!alreadySentExh) {
        const emailContent = generateMedicineReminderEmail({
          patient: patientObj,
          prescription: pres,
          faskes,
          isExhaustedToday: true
        });

        try {
          const dispatch = await dispatchEmail({
            to: patientObj.pmo_email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
          });

          db.prepare(`
            INSERT INTO notification_logs (patient_id, prescription_id, notification_type, recipient_email, subject, body, status, error_message, sent_date)
            VALUES (?, ?, 'medicine_exhausted', ?, ?, ?, ?, ?, ?)
          `).run(
            patientObj.id,
            pres.id,
            patientObj.pmo_email,
            emailContent.subject,
            emailContent.html,
            dispatch.status,
            dispatch.error || dispatch.message || null,
            todayStr
          );

          results.medicineExhaustedSent++;
        } catch (err) {
          results.errors.push(`Obat Habis Hari Ini ${patientObj.name}: ${err.message}`);
        }
      }
    }
  }

  setSetting('last_scheduler_run', new Date().toISOString());
  return results;
}

// Inisialisasi Interval Scheduler (setiap 60 menit)
setInterval(() => {
  const autoEnabled = getSetting('auto_send_enabled', 'true') === 'true';
  if (autoEnabled) {
    console.log('[Scheduler] Menjalankan pengecekan otomatis H-1 pengingat jiwa...');
    runReminderCheck().catch(err => console.error('[Scheduler Error]:', err));
  }
}, 60 * 60 * 1000);

// Helper Request Parser
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Format JSON tidak valid'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

// Inisialisasi Web Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    return res.end();
  }

  // ===================== REST API ENDPOINTS =====================
  try {
    const db = getDb();
    const todayStr = getLocalDateString();
    const tomorrowStr = addDaysToDate(todayStr, 1);

    // 1. Dashboard Overview
    if (pathname === '/api/dashboard' && method === 'GET') {
      const totalPatients = db.prepare("SELECT COUNT(*) as count FROM patients WHERE status = 'Aktif'").get().count;
      
      const allActivePrescriptions = db.prepare(`
        SELECT p.*, pt.name as patient_name, pt.no_rm, pt.category_spm, pt.pmo_name, pt.pmo_phone, pt.pmo_email, pt.village
        FROM prescriptions p
        INNER JOIN patients pt ON p.patient_id = pt.id
        WHERE p.status = 'Berjalan' AND pt.status = 'Aktif'
        ORDER BY p.next_control_date ASC
      `).all();

      let countH1Control = 0;
      let countTodayControl = 0;
      let countOverdueControl = 0;
      let countH1Medicine = 0;
      let countTodayMedicine = 0;

      const urgentList = [];

      for (const p of allActivePrescriptions) {
        const diffControl = daysDiff(p.next_control_date, todayStr);
        const diffMed = daysDiff(p.medicine_exhausted_date, todayStr);

        let urgency = null;

        if (diffControl === 1) {
          countH1Control++;
          urgency = { type: 'h1_control', label: 'H-1 Kontrol Besok', color: 'blue', priority: 1 };
        } else if (diffControl === 0) {
          countTodayControl++;
          urgency = { type: 'today_control', label: 'Hari Ini Kontrol', color: 'emerald', priority: 2 };
        } else if (diffControl < 0) {
          countOverdueControl++;
          urgency = { type: 'overdue', label: `Terlambat ${Math.abs(diffControl)} Hari`, color: 'rose', priority: 0 };
        }

        if (diffMed === 1) {
          countH1Medicine++;
          if (!urgency) urgency = { type: 'h1_medicine', label: 'H-1 Obat Habis', color: 'amber', priority: 1 };
        } else if (diffMed <= 0) {
          countTodayMedicine++;
          if (!urgency) urgency = { type: 'medicine_exhausted', label: 'Obat Habis!', color: 'red', priority: 0 };
        }

        if (urgency) {
          urgentList.push({
            patient_id: p.patient_id,
            patient_name: p.patient_name,
            no_rm: p.no_rm,
            village: p.village,
            pmo_name: p.pmo_name,
            pmo_phone: p.pmo_phone,
            pmo_email: p.pmo_email,
            medicine_name: p.medicine_name,
            next_control_date: p.next_control_date,
            medicine_exhausted_date: p.medicine_exhausted_date,
            diffControl,
            diffMed,
            urgency
          });
        }
      }

      // Urutkan urgent list berdasarkan prioritas keterlambatan
      urgentList.sort((a, b) => a.urgency.priority - b.urgency.priority || a.diffControl - b.diffControl);

      const recentLogs = db.prepare(`
        SELECT l.*, pt.name as patient_name, pt.no_rm
        FROM notification_logs l
        LEFT JOIN patients pt ON l.patient_id = pt.id
        ORDER BY l.sent_at DESC
        LIMIT 10
      `).all();

      return sendJson(res, 200, {
        summary: {
          totalPatients,
          countH1Control,
          countTodayControl,
          countOverdueControl,
          countH1Medicine,
          countTodayMedicine
        },
        urgentList,
        recentLogs,
        todayStr,
        tomorrowStr,
        lastSchedulerRun: getSetting('last_scheduler_run', '')
      });
    }

    // 2. Daftar Pasien (dengan filter & status terbaru)
    if (pathname === '/api/patients' && method === 'GET') {
      const query = parsedUrl.query.search || '';
      const filter = parsedUrl.query.filter || 'all';

      let sql = `
        SELECT pt.*,
               (SELECT next_control_date FROM prescriptions WHERE patient_id = pt.id AND status = 'Berjalan' ORDER BY visit_date DESC LIMIT 1) as next_control_date,
               (SELECT medicine_exhausted_date FROM prescriptions WHERE patient_id = pt.id AND status = 'Berjalan' ORDER BY visit_date DESC LIMIT 1) as medicine_exhausted_date,
               (SELECT medicine_name FROM prescriptions WHERE patient_id = pt.id AND status = 'Berjalan' ORDER BY visit_date DESC LIMIT 1) as current_medicine,
               (SELECT dosage_per_day FROM prescriptions WHERE patient_id = pt.id AND status = 'Berjalan' ORDER BY visit_date DESC LIMIT 1) as dosage_per_day
        FROM patients pt
        WHERE pt.status != 'Meninggal'
      `;
      const params = [];

      if (query) {
        sql += ` AND (pt.name LIKE ? OR pt.no_rm LIKE ? OR pt.nik LIKE ? OR pt.village LIKE ?)`;
        params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
      }

      sql += ` ORDER BY pt.name ASC`;
      const patients = db.prepare(sql).all(...params);

      // Hitung diff hari untuk setiap pasien
      const enriched = patients.map(pt => {
        let diffControl = null;
        let diffMed = null;
        let statusBadge = { label: 'Terkontrol', color: 'emerald' };

        if (pt.next_control_date) {
          diffControl = daysDiff(pt.next_control_date, todayStr);
        }
        if (pt.medicine_exhausted_date) {
          diffMed = daysDiff(pt.medicine_exhausted_date, todayStr);
        }

        if (diffControl !== null) {
          if (diffControl < 0) {
            statusBadge = { label: `Telat (${Math.abs(diffControl)} Hari)`, color: 'rose' };
          } else if (diffControl === 0) {
            statusBadge = { label: 'Kontrol Hari Ini', color: 'emerald' };
          } else if (diffControl === 1) {
            statusBadge = { label: 'H-1 Kontrol Besok', color: 'blue' };
          } else if (diffControl <= 7) {
            statusBadge = { label: `${diffControl} Hari Lagi`, color: 'sky' };
          }
        }

        return {
          ...pt,
          diffControl,
          diffMed,
          statusBadge
        };
      });

      // Filter client-side jika dipilih kategori tertentu
      let filtered = enriched;
      if (filter === 'h1_control') {
        filtered = enriched.filter(p => p.diffControl === 1);
      } else if (filter === 'h1_medicine') {
        filtered = enriched.filter(p => p.diffMed === 1);
      } else if (filter === 'overdue') {
        filtered = enriched.filter(p => p.diffControl !== null && p.diffControl < 0);
      } else if (filter === 'today') {
        filtered = enriched.filter(p => p.diffControl === 0 || p.diffMed === 0);
      }

      return sendJson(res, 200, filtered);
    }

    // 3. Tambah Pasien Baru
    if (pathname === '/api/patients' && method === 'POST') {
      const data = await parseRequestBody(req);

      if (!data.name || !data.no_rm || !data.pmo_name || !data.pmo_email) {
        return sendJson(res, 400, { error: 'Nama, No. RM, Nama PMO, dan Email PMO wajib diisi!' });
      }

      // Cek apakah No RM sudah ada
      const existing = db.prepare('SELECT id FROM patients WHERE no_rm = ?').get(data.no_rm);
      if (existing) {
        return sendJson(res, 400, { error: `No. Rekam Medis ${data.no_rm} sudah terdaftar!` });
      }

      const stmt = db.prepare(`
        INSERT INTO patients (
          no_rm, nik, no_bpjs, name, gender, birth_date, age,
          address, village, diagnosis_code, diagnosis_name, category_spm,
          pmo_name, pmo_relation, pmo_phone, pmo_email, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const resInsert = stmt.run(
        data.no_rm.trim(),
        data.nik || null,
        data.no_bpjs || null,
        data.name.trim(),
        data.gender || 'L',
        data.birth_date || null,
        data.age ? Number(data.age) : null,
        data.address.trim(),
        data.village || 'Sesela',
        data.diagnosis_code || 'F20.0',
        data.diagnosis_name || 'Skizofrenia Paranoid',
        data.category_spm || 'ODGJ Berat',
        data.pmo_name.trim(),
        data.pmo_relation || 'Keluarga',
        data.pmo_phone || null,
        data.pmo_email.trim(),
        data.notes || null,
        data.status || 'Aktif'
      );

      return sendJson(res, 201, { id: resInsert.lastInsertRowid, message: 'Pasien berhasil ditambahkan' });
    }

    // 4. Detail Pasien (termasuk riwayat resep & log email)
    const matchPatientId = pathname.match(/^\/api\/patients\/(\d+)$/);
    if (matchPatientId && method === 'GET') {
      const patientId = Number(matchPatientId[1]);
      const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);

      if (!patient) {
        return sendJson(res, 404, { error: 'Pasien tidak ditemukan' });
      }

      const prescriptions = db.prepare(`
        SELECT * FROM prescriptions 
        WHERE patient_id = ? 
        ORDER BY visit_date DESC, id DESC
      `).all(patientId);

      const logs = db.prepare(`
        SELECT * FROM notification_logs 
        WHERE patient_id = ? 
        ORDER BY sent_at DESC
      `).all(patientId);

      return sendJson(res, 200, {
        patient,
        prescriptions,
        logs
      });
    }

    // 5. Update Pasien
    if (matchPatientId && method === 'PUT') {
      const patientId = Number(matchPatientId[1]);
      const data = await parseRequestBody(req);

      db.prepare(`
        UPDATE patients SET
          no_rm = ?, nik = ?, no_bpjs = ?, name = ?, gender = ?, birth_date = ?, age = ?,
          address = ?, village = ?, diagnosis_code = ?, diagnosis_name = ?, category_spm = ?,
          pmo_name = ?, pmo_relation = ?, pmo_phone = ?, pmo_email = ?, notes = ?, status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        data.no_rm.trim(),
        data.nik || null,
        data.no_bpjs || null,
        data.name.trim(),
        data.gender,
        data.birth_date || null,
        data.age ? Number(data.age) : null,
        data.address.trim(),
        data.village,
        data.diagnosis_code,
        data.diagnosis_name,
        data.category_spm,
        data.pmo_name.trim(),
        data.pmo_relation,
        data.pmo_phone || null,
        data.pmo_email.trim(),
        data.notes || null,
        data.status || 'Aktif',
        patientId
      );

      return sendJson(res, 200, { message: 'Data pasien berhasil diperbarui' });
    }

    // 6. Hapus Pasien
    if (matchPatientId && method === 'DELETE') {
      const patientId = Number(matchPatientId[1]);
      db.prepare('DELETE FROM patients WHERE id = ?').run(patientId);
      return sendJson(res, 200, { message: 'Pasien dan seluruh riwayatnya berhasil dihapus' });
    }

    // 7. Tambah Kunjungan & Resep Baru Pasien
    const matchPrescriptionAdd = pathname.match(/^\/api\/patients\/(\d+)\/prescriptions$/);
    if (matchPrescriptionAdd && method === 'POST') {
      const patientId = Number(matchPrescriptionAdd[1]);
      const data = await parseRequestBody(req);

      if (!data.visit_date || !data.medicine_name || !data.dosage_per_day || !data.quantity) {
        return sendJson(res, 400, { error: 'Tanggal kunjungan, nama obat, dosis, dan jumlah tablet wajib diisi!' });
      }

      // Hitung durasi hari ketersediaan obat
      const dosage = Number(data.dosage_per_day);
      const qty = Number(data.quantity);
      const daysSupply = Math.floor(qty / dosage);

      // Hitung tanggal obat habis
      const medicineExhaustedDate = addDaysToDate(data.visit_date, daysSupply);

      // Jika next_control_date tidak diisi, otomatis buat sesuai SPM (30 hari atau saat obat habis)
      const nextControlDate = data.next_control_date || medicineExhaustedDate;

      // Set status resep sebelumnya menjadi 'Selesai'
      db.prepare("UPDATE prescriptions SET status = 'Selesai' WHERE patient_id = ? AND status = 'Berjalan'").run(patientId);

      // Simpan resep baru
      const stmt = db.prepare(`
        INSERT INTO prescriptions (
          patient_id, visit_date, next_control_date, medicine_name, dosage_per_day,
          quantity, days_supply, medicine_exhausted_date, doctor_name, doctor_notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Berjalan')
      `);

      const ins = stmt.run(
        patientId,
        data.visit_date,
        nextControlDate,
        data.medicine_name.trim(),
        dosage,
        qty,
        daysSupply,
        medicineExhaustedDate,
        data.doctor_name || 'Dokter Puskesmas',
        data.doctor_notes || null
      );

      return sendJson(res, 201, {
        id: ins.lastInsertRowid,
        daysSupply,
        medicineExhaustedDate,
        nextControlDate,
        message: 'Kunjungan dan resep berhasil dicatat'
      });
    }

    // 8. Hapus Resep
    const matchPrescriptionId = pathname.match(/^\/api\/prescriptions\/(\d+)$/);
    if (matchPrescriptionId && method === 'DELETE') {
      const presId = Number(matchPrescriptionId[1]);
      db.prepare('DELETE FROM prescriptions WHERE id = ?').run(presId);
      return sendJson(res, 200, { message: 'Catatan resep berhasil dihapus' });
    }

    // 9. Trigger Cek & Kirim Pengingat Otomatis H-1 Sekarang
    if (pathname === '/api/notifications/check-and-send' && method === 'POST') {
      const results = await runReminderCheck();
      return sendJson(res, 200, {
        success: true,
        summary: results,
        message: `Pengecekan selesai. Terkirim H-1 Kontrol: ${results.h1ControlSent}, H-1 Obat: ${results.h1MedicineSent}, Obat Habis Hari Ini: ${results.medicineExhaustedSent}, Terlewati (Sudah Pernah Dikirim): ${results.alreadySentCount}`
      });
    }

    // 10. Kirim Pengingat Instan Manual untuk 1 Pasien Tertentu
    if (pathname === '/api/notifications/send-single' && method === 'POST') {
      const data = await parseRequestBody(req);
      const { patient_id, type } = data; // type: 'control' atau 'medicine'

      const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patient_id);
      if (!patient) {
        return sendJson(res, 404, { error: 'Pasien tidak ditemukan' });
      }

      const prescription = db.prepare(`
        SELECT * FROM prescriptions WHERE patient_id = ? AND status = 'Berjalan' ORDER BY visit_date DESC LIMIT 1
      `).get(patient_id);

      if (!prescription) {
        return sendJson(res, 400, { error: 'Pasien belum memiliki riwayat resep/kunjungan aktif' });
      }

      const faskes = {
        name: getSetting('faskes_name', 'UPTD BLUD Puskesmas Sesela'),
        address: getSetting('faskes_address', 'Jl. Raya Sesela, Kec. Gunungsari, Kab. Lombok Barat'),
        phone: getSetting('faskes_phone', '(0370) 641234')
      };

      let emailContent;
      let notifType = 'manual_reminder';

      if (type === 'medicine') {
        emailContent = generateMedicineReminderEmail({
          patient,
          prescription,
          faskes,
          isExhaustedToday: false
        });
        notifType = 'h1_medicine';
      } else {
        emailContent = generateControlReminderEmail({
          patient,
          prescription,
          faskes
        });
        notifType = 'h1_control';
      }

      const dispatch = await dispatchEmail({
        to: patient.pmo_email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });

      db.prepare(`
        INSERT INTO notification_logs (patient_id, prescription_id, notification_type, recipient_email, subject, body, status, error_message, sent_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        patient.id,
        prescription.id,
        notifType,
        patient.pmo_email,
        emailContent.subject,
        emailContent.html,
        dispatch.status,
        dispatch.error || dispatch.message || null,
        todayStr
      );

      return sendJson(res, 200, {
        success: true,
        dispatch,
        recipient: patient.pmo_email,
        subject: emailContent.subject,
        previewHtml: emailContent.html,
        message: `Notifikasi berhasil diproses (${dispatch.status}) ke ${patient.pmo_email}`
      });
    }

    // 11. Daftar Log Notifikasi
    if (pathname === '/api/notifications/logs' && method === 'GET') {
      const logs = db.prepare(`
        SELECT l.*, pt.name as patient_name, pt.no_rm, pt.village
        FROM notification_logs l
        LEFT JOIN patients pt ON l.patient_id = pt.id
        ORDER BY l.sent_at DESC
        LIMIT 100
      `).all();
      return sendJson(res, 200, logs);
    }

    // 12. Pengaturan (Get & Post)
    if (pathname === '/api/settings' && method === 'GET') {
      const settings = getAllSettings();
      // Masking password demi keamanan
      if (settings.smtp_pass) {
        settings.smtp_pass_masked = '••••••••';
      }
      return sendJson(res, 200, settings);
    }

    if (pathname === '/api/settings' && method === 'POST') {
      const data = await parseRequestBody(req);
      for (const [k, v] of Object.entries(data)) {
        if (k === 'smtp_pass' && (v === '••••••••' || v === '')) {
          // Jangan timpa password lama jika pengguna tidak merubahnya
          continue;
        }
        setSetting(k, v);
      }
      return sendJson(res, 200, { message: 'Pengaturan faskes dan SMTP berhasil disimpan' });
    }

    // 13. Tes Kirim Email SMTP
    if (pathname === '/api/settings/test-email' && method === 'POST') {
      const data = await parseRequestBody(req);
      const testRecipient = data.test_email || getSetting('smtp_user', '');

      if (!testRecipient) {
        return sendJson(res, 400, { error: 'Masukkan alamat email tujuan uji coba!' });
      }

      const faskesName = getSetting('faskes_name', 'UPTD BLUD Puskesmas Sesela');
      const subject = `[TES KONEKSI] Pengujian Sistem Notifikasi Email - ${faskesName}`;
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; border-radius: 8px;">
          <h2 style="color: #0284c7;">Tes Koneksi Pengingat Jiwa Berhasil!</h2>
          <p>Email ini adalah surat uji coba dari sistem pengingat kontrol & obat pasien ODGJ <strong>${faskesName}</strong>.</p>
          <p>Konfigurasi SMTP Anda sudah berjalan dengan baik. Notifikasi H-1 kontrol dan obat habis akan dapat terkirim secara otomatis ke keluarga pasien.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <small style="color: #64748b;">Waktu Pengujian: ${new Date().toLocaleString('id-ID')}</small>
        </div>
      `;

      const dispatch = await dispatchEmail({
        to: testRecipient,
        subject,
        html,
        text: 'Tes Koneksi Pengingat Jiwa Berhasil! Konfigurasi SMTP Anda telah aktif.'
      });

      if (dispatch.status === 'Gagal') {
        return sendJson(res, 500, {
          success: false,
          error: `Pengiriman gagal: ${dispatch.error}`
        });
      }

      return sendJson(res, 200, {
        success: true,
        status: dispatch.status,
        recipient: testRecipient,
        message: dispatch.simulated
          ? 'Mode Simulasi: SMTP belum diisi username/password. Email berhasil disimulasikan.'
          : `Email uji coba berhasil dikirim ke ${testRecipient}!`
      });
    }

  } catch (err) {
    console.error('[API Error]', err);
    return sendJson(res, 500, { error: err.message || 'Terjadi kesalahan internal pada server' });
  }

  // ===================== STATIC FILE SERVER =====================
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      return res.end('404 Not Found - Halaman tidak ditemukan');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[PORT OCCUPIED] Port ${PORT} sedang digunakan oleh proses lain.`);
    console.log(`Membuka browser ke instance aktif: http://localhost:${PORT}`);
    const { exec } = require('node:child_process');
    exec(`start http://localhost:${PORT}`);
  } else {
    console.error('[Server Error]:', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  Sistem Pengingat Jiwa - Puskesmas Sesela`);
  console.log(`  Regulasi: UU No. 17/2023 & SPM Bidang Kesehatan Jiwa`);
  console.log(`  Server aktif di: http://localhost:${PORT}`);
  console.log(`=======================================================`);

  // Buka browser otomatis setelah port dipastikan siap dan mendengarkan request
  try {
    const { exec } = require('node:child_process');
    exec(`start http://localhost:${PORT}`);
  } catch (e) {
    // Abaikan jika tidak dapat membuka browser secara programmatic
  }

  // Jalankan pemeriksaan awal saat server pertama kali menyala
  runReminderCheck().then(res => {
    console.log(`[Pemeriksaan Awal H-1] H-1 Kontrol: ${res.h1ControlSent}, H-1 Obat: ${res.h1MedicineSent}`);
  }).catch(e => console.error('[Error Pemeriksaan Awal]:', e));
});

