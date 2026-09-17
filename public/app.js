// app.js - Logika Frontend Interaktif SPA Pengingat Jiwa
let currentTab = 'dashboard';
let currentPatientFilter = 'all';
let currentSearchQuery = '';
let dashboardData = null;
let currentSettings = {};

// Deteksi otomatis base URL API (mendukung http://localhost:3000 maupun file://)
const API_BASE = (window.location.protocol === 'file:') ? 'http://localhost:3000' : '';

// Wrapper Fetch dengan Penanganan Error Ramah Pengguna
async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, options);
    hideConnectionErrorBanner();
    return res;
  } catch (err) {
    showConnectionErrorBanner();
    throw new Error('Tidak dapat terhubung ke server. Pastikan aplikasi telah dijalankan melalui file "jalankan.bat" di http://localhost:3000');
  }
}

function showConnectionErrorBanner() {
  const banner = document.getElementById('connection-error-banner');
  if (banner) banner.style.display = 'block';
}

function hideConnectionErrorBanner() {
  const banner = document.getElementById('connection-error-banner');
  if (banner) banner.style.display = 'none';
}

function retryConnection() {
  hideConnectionErrorBanner();
  loadSettings();
  loadDashboard();
}

// Helper Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Modal Helpers
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

// Tab Switching
function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `view-${tabName}`);
  });

  if (tabName === 'dashboard') loadDashboard();
  if (tabName === 'patients') loadPatients();
  if (tabName === 'logs') loadLogs();
  if (tabName === 'settings') loadSettings();
}

// Format Tanggal Bahasa Indonesia
function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Format Timestamp Waktu
function formatTimeIndo(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Inisialisasi Ikon SVG
function initIcons() {
  document.getElementById('brand-logo-icon').innerHTML = Icons.heartPulse;
  document.getElementById('bell-icon').innerHTML = Icons.bell;
  document.getElementById('nav-icon-dashboard').innerHTML = Icons.calendar;
  document.getElementById('nav-icon-patients').innerHTML = Icons.users;
  document.getElementById('nav-icon-logs').innerHTML = Icons.mail;
  document.getElementById('nav-icon-settings').innerHTML = Icons.settings;
  document.getElementById('shield-icon').innerHTML = Icons.shieldCheck;
  document.getElementById('kpi-icon-users').innerHTML = Icons.users;
  document.getElementById('kpi-icon-calendar').innerHTML = Icons.calendar;
  document.getElementById('kpi-icon-pill').innerHTML = Icons.pill;
  document.getElementById('kpi-icon-alert').innerHTML = Icons.alertTriangle;
  document.getElementById('urgent-header-icon').innerHTML = Icons.alertTriangle;
  document.getElementById('recent-log-icon').innerHTML = Icons.mail;
  document.getElementById('search-icon-box').innerHTML = Icons.search;
  document.getElementById('plus-icon-patient').innerHTML = Icons.plus;
  document.getElementById('log-section-icon').innerHTML = Icons.mail;
  document.getElementById('settings-card-icon').innerHTML = Icons.settings;
}

// ==================== DASHBOARD ====================
async function loadDashboard() {
  try {
    const res = await apiFetch('/api/dashboard');
    const data = await res.json();
    dashboardData = data;

    // Update Banner Tanggal
    const today = new Date();
    document.getElementById('current-date-badge').innerText = today.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Update KPI
    document.getElementById('kpi-total-patients').innerText = data.summary.totalPatients;
    document.getElementById('kpi-h1-control').innerText = data.summary.countH1Control;
    document.getElementById('kpi-h1-medicine').innerText = data.summary.countH1Medicine;
    document.getElementById('kpi-overdue').innerText = data.summary.countOverdueControl;

    // Render Urgent Table
    const tbodyUrgent = document.getElementById('urgent-table-body');
    if (!data.urgentList || data.urgentList.length === 0) {
      tbodyUrgent.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--success); padding: 30px;">
            <div style="font-weight: 600; margin-bottom: 4px;">Semua Pasien Terpantau Baik</div>
            <div style="font-size: 12px; color: var(--text-muted);">Tidak ada jadwal kontrol mendesak (H-1) atau keterlambatan hari ini.</div>
          </td>
        </tr>
      `;
    } else {
      tbodyUrgent.innerHTML = data.urgentList.map(item => {
        let badgeClass = 'badge-blue';
        if (item.urgency.color === 'amber') badgeClass = 'badge-amber';
        if (item.urgency.color === 'rose' || item.urgency.color === 'red') badgeClass = 'badge-rose';
        if (item.urgency.color === 'emerald') badgeClass = 'badge-emerald';

        return `
          <tr>
            <td>
              <span class="badge ${badgeClass}">${item.urgency.label}</span>
            </td>
            <td>
              <strong style="color: var(--secondary);">${item.patient_name}</strong>
              <div style="font-size: 11.5px; color: var(--text-muted);">${item.no_rm}</div>
            </td>
            <td>${item.village || '-'}</td>
            <td>
              <div><strong>${item.pmo_name}</strong></div>
              <div style="font-size: 11.5px; color: var(--primary);">${item.pmo_email}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${item.pmo_phone || '-'}</div>
            </td>
            <td>${item.medicine_name || '-'}</td>
            <td>
              <strong style="color: ${item.diffControl === 1 ? 'var(--primary)' : 'inherit'}">
                ${formatDateIndo(item.next_control_date)}
              </strong>
            </td>
            <td>
              <span style="color: ${item.diffMed <= 1 ? 'var(--danger)' : 'inherit'}">
                ${formatDateIndo(item.medicine_exhausted_date)}
              </span>
            </td>
            <td>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="btn btn-primary btn-sm" onclick="sendSingleReminder(${item.patient_id}, 'control')" title="Kirim Pengingat Kontrol Sekarang">
                  Kirim Email
                </button>
                <button class="btn btn-secondary btn-sm" onclick="openPatientDetail(${item.patient_id})">
                  Detail
                </button>
                <button class="btn btn-secondary btn-sm" onclick="printControlSlip(${item.patient_id})" title="Cetak Surat Pengingat Kontrol">
                  Cetak
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Render Recent Logs Table
    const tbodyLogs = document.getElementById('recent-logs-body');
    if (!data.recentLogs || data.recentLogs.length === 0) {
      tbodyLogs.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
            Belum ada notifikasi email yang tercatat. Klik tombol 'Cek & Kirim Pengingat H-1' di atas untuk memulai.
          </td>
        </tr>
      `;
    } else {
      tbodyLogs.innerHTML = data.recentLogs.map(log => {
        let typeBadge = '<span class="badge badge-blue">H-1 Kontrol</span>';
        if (log.notification_type === 'h1_medicine') typeBadge = '<span class="badge badge-amber">H-1 Obat Habis</span>';
        if (log.notification_type === 'medicine_exhausted') typeBadge = '<span class="badge badge-rose">Obat Habis</span>';
        if (log.notification_type === 'manual_reminder') typeBadge = '<span class="badge badge-gray">Manual</span>';

        let statusBadge = `<span class="badge badge-emerald">${log.status}</span>`;
        if (log.status === 'Gagal') statusBadge = `<span class="badge badge-rose">Gagal</span>`;
        if (log.status === 'Simulasi') statusBadge = `<span class="badge badge-amber" title="Tercatat dalam mode simulasi">Simulasi</span>`;

        return `
          <tr>
            <td style="font-size: 12px; color: var(--text-muted);">${formatTimeIndo(log.sent_at)}</td>
            <td>${typeBadge}</td>
            <td>
              <strong>${log.patient_name || '-'}</strong>
              <div style="font-size: 11px; color: var(--text-muted);">${log.no_rm || '-'}</div>
            </td>
            <td>${log.recipient_email}</td>
            <td>${statusBadge}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="previewEmailLog(${log.id})">
                Pratinjau
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

  } catch (err) {
    console.error('Error load dashboard:', err);
    showToast(err.message, 'error');
  }
}

// ==================== DATA PASIEN ====================
async function loadPatients() {
  try {
    const params = new URLSearchParams();
    if (currentSearchQuery) params.append('search', currentSearchQuery);
    if (currentPatientFilter !== 'all') params.append('filter', currentPatientFilter);

    const res = await apiFetch(`/api/patients?${params.toString()}`);
    const patients = await res.json();

    const tbody = document.getElementById('patients-table-body');
    if (!patients || patients.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">
            Tidak ada data pasien yang cocok dengan pencarian / filter ini.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = patients.map(p => {
      let badgeClass = 'badge-emerald';
      if (p.statusBadge.color === 'rose') badgeClass = 'badge-rose';
      if (p.statusBadge.color === 'blue') badgeClass = 'badge-blue';
      if (p.statusBadge.color === 'amber') badgeClass = 'badge-amber';
      if (p.statusBadge.color === 'sky') badgeClass = 'badge-blue';

      return `
        <tr>
          <td>
            <strong style="color: var(--secondary); font-family: monospace;">${p.no_rm}</strong>
          </td>
          <td>
            <strong>${p.name}</strong>
            <div style="font-size: 12px; color: var(--text-muted);">
              ${p.gender === 'L' ? 'Laki-Laki' : 'Perempuan'}${p.age ? `, ${p.age} thn` : ''}
            </div>
          </td>
          <td>
            <div style="font-weight: 600; font-size: 12.5px;">${p.diagnosis_code}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${p.diagnosis_name}</div>
          </td>
          <td>
            <div>${p.village || '-'}</div>
            <div style="font-size: 11.5px; color: var(--text-muted);">${p.address}</div>
          </td>
          <td>
            <strong>${p.pmo_name}</strong>
            <div style="font-size: 11.5px; color: var(--text-muted);">${p.pmo_relation}</div>
          </td>
          <td>
            <div style="font-size: 12.5px; color: var(--primary); font-weight: 500;">${p.pmo_email}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${p.pmo_phone || '-'}</div>
          </td>
          <td>
            <div style="font-weight: 600;">${formatDateIndo(p.next_control_date)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">Obat: ${p.current_medicine || '-'}</div>
          </td>
          <td>
            <span class="badge ${badgeClass}">${p.statusBadge.label}</span>
          </td>
          <td>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="openPatientDetail(${p.id})" title="Rekam Medis & Riwayat">
                Detail
              </button>
              <button class="btn btn-primary btn-sm" onclick="openAddPrescriptionModal(${p.id})" title="Catat Kunjungan Baru">
                + Resep
              </button>
              <button class="btn btn-secondary btn-sm" onclick="openEditPatientModal(${p.id})" title="Ubah Data Pasien">
                Ubah
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error load patients:', err);
    showToast(err.message, 'error');
  }
}

// ==================== MODAL TAMBAH & EDIT PASIEN ====================
function openAddPatientModal() {
  document.getElementById('form-patient').reset();
  document.getElementById('patient_id').value = '';
  document.getElementById('modal-patient-title').innerText = 'Tambah Data Pasien ODGJ Baru';
  document.getElementById('patient_category_spm').value = 'ODGJ Berat';
  openModal('modal-patient');
}

async function openEditPatientModal(patientId) {
  try {
    const res = await apiFetch(`/api/patients/${patientId}`);
    const data = await res.json();
    const p = data.patient;

    document.getElementById('patient_id').value = p.id;
    document.getElementById('patient_no_rm').value = p.no_rm;
    document.getElementById('patient_nik').value = p.nik || '';
    document.getElementById('patient_no_bpjs').value = p.no_bpjs || '';
    document.getElementById('patient_name').value = p.name;
    document.getElementById('patient_gender').value = p.gender;
    document.getElementById('patient_age').value = p.age || '';
    document.getElementById('patient_address').value = p.address;
    document.getElementById('patient_village').value = p.village || 'Desa Sesela';
    document.getElementById('patient_category_spm').value = p.category_spm;
    document.getElementById('patient_diagnosis_code').value = p.diagnosis_code;
    document.getElementById('patient_diagnosis_name').value = p.diagnosis_name;
    document.getElementById('patient_pmo_name').value = p.pmo_name;
    document.getElementById('patient_pmo_relation').value = p.pmo_relation;
    document.getElementById('patient_pmo_phone').value = p.pmo_phone || '';
    document.getElementById('patient_pmo_email').value = p.pmo_email;
    document.getElementById('patient_notes').value = p.notes || '';

    document.getElementById('modal-patient-title').innerText = `Ubah Data Pasien: ${p.name}`;
    openModal('modal-patient');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('form-patient').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('patient_id').value;

  const payload = {
    no_rm: document.getElementById('patient_no_rm').value,
    nik: document.getElementById('patient_nik').value,
    no_bpjs: document.getElementById('patient_no_bpjs').value,
    name: document.getElementById('patient_name').value,
    gender: document.getElementById('patient_gender').value,
    age: document.getElementById('patient_age').value,
    address: document.getElementById('patient_address').value,
    village: document.getElementById('patient_village').value,
    category_spm: document.getElementById('patient_category_spm').value,
    diagnosis_code: document.getElementById('patient_diagnosis_code').value,
    diagnosis_name: document.getElementById('patient_diagnosis_name').value,
    pmo_name: document.getElementById('patient_pmo_name').value,
    pmo_relation: document.getElementById('patient_pmo_relation').value,
    pmo_phone: document.getElementById('patient_pmo_phone').value,
    pmo_email: document.getElementById('patient_pmo_email').value,
    notes: document.getElementById('patient_notes').value
  };

  try {
    const endpoint = id ? `/api/patients/${id}` : '/api/patients';
    const method = id ? 'PUT' : 'POST';

    const res = await apiFetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Gagal menyimpan pasien');

    showToast(result.message || 'Data pasien berhasil disimpan!', 'success');
    closeModal('modal-patient');
    loadPatients();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ==================== MODAL CATAT KUNJUNGAN & RESEP ====================
async function openAddPrescriptionModal(patientId) {
  try {
    const res = await apiFetch(`/api/patients/${patientId}`);
    const data = await res.json();
    const p = data.patient;

    document.getElementById('form-prescription').reset();
    document.getElementById('presc_patient_id').value = p.id;
    document.getElementById('presc-modal-patient-name').innerText = p.name;
    document.getElementById('presc-modal-patient-info').innerText = `No. RM: ${p.no_rm} | Diagnosa: ${p.diagnosis_code} - ${p.diagnosis_name}`;

    // Set default tanggal hari ini
    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('presc_visit_date').value = todayStr;

    // Default dosis 2x1 dan 60 tablet (30 hari)
    document.getElementById('presc_dosage_per_day').value = '2';
    document.getElementById('presc_quantity').value = '60';

    updatePrescriptionCalculation();
    openModal('modal-prescription');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updatePrescriptionCalculation() {
  const visitDateStr = document.getElementById('presc_visit_date').value;
  const dosage = parseFloat(document.getElementById('presc_dosage_per_day').value);
  const qty = parseInt(document.getElementById('presc_quantity').value, 10);
  const previewDiv = document.getElementById('presc-calc-preview');
  const nextControlInput = document.getElementById('presc_next_control_date');

  if (!visitDateStr || !dosage || !qty || dosage <= 0 || qty <= 0) {
    previewDiv.innerText = 'Masukkan tanggal kunjungan, aturan minum dan jumlah tablet yang valid.';
    return;
  }

  const daysSupply = Math.floor(qty / dosage);
  const d = new Date(visitDateStr + 'T00:00:00');
  d.setDate(d.getDate() + daysSupply);

  const exhaustYear = d.getFullYear();
  const exhaustMonth = String(d.getMonth() + 1).padStart(2, '0');
  const exhaustDay = String(d.getDate()).padStart(2, '0');
  const exhaustDateStr = `${exhaustYear}-${exhaustMonth}-${exhaustDay}`;

  previewDiv.innerHTML = `
    <strong>Masa Persediaan Obat:</strong> ${daysSupply} hari.<br>
    <strong>Tanggal Perkiraan Obat Habis:</strong> ${formatDateIndo(exhaustDateStr)}.<br>
    <em>Email pengingat H-1 akan otomatis dikirim 1 hari sebelum tanggal ini.</em>
  `;

  // Otomatis sinkronkan jadwal kontrol berikutnya dengan tanggal obat habis jika belum diubah
  nextControlInput.value = exhaustDateStr;
}

document.getElementById('presc_visit_date').addEventListener('change', updatePrescriptionCalculation);
document.getElementById('presc_dosage_per_day').addEventListener('input', updatePrescriptionCalculation);
document.getElementById('presc_quantity').addEventListener('input', updatePrescriptionCalculation);

document.getElementById('form-prescription').addEventListener('submit', async (e) => {
  e.preventDefault();
  const patientId = document.getElementById('presc_patient_id').value;

  const payload = {
    visit_date: document.getElementById('presc_visit_date').value,
    next_control_date: document.getElementById('presc_next_control_date').value,
    medicine_name: document.getElementById('presc_medicine_name').value,
    dosage_per_day: document.getElementById('presc_dosage_per_day').value,
    quantity: document.getElementById('presc_quantity').value,
    doctor_name: document.getElementById('presc_doctor_name').value,
    doctor_notes: document.getElementById('presc_doctor_notes').value
  };

  try {
    const res = await apiFetch(`/api/patients/${patientId}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Gagal menyimpan resep');

    showToast('Kunjungan dan resep berhasil dicatat!', 'success');
    closeModal('modal-prescription');
    loadPatients();
    loadDashboard();
    if (document.getElementById('modal-detail').classList.contains('open')) {
      openPatientDetail(patientId);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ==================== DETAIL PASIEN ====================
async function openPatientDetail(patientId) {
  try {
    const res = await apiFetch(`/api/patients/${patientId}`);
    const data = await res.json();
    const { patient, prescriptions, logs } = data;

    const body = document.getElementById('detail-modal-body');
    const footer = document.getElementById('detail-modal-footer');

    body.innerHTML = `
      <!-- Profil Pasien & PMO -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px;">
          <h4 style="font-size: 14px; color: var(--primary); margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            ${Icons.users} Data Identitas Pasien
          </h4>
          <table style="width: 100%; font-size: 13px; line-height: 1.8;">
            <tr><td style="color: var(--text-muted); width: 40%;">No. Rekam Medis</td><td><strong>${patient.no_rm}</strong></td></tr>
            <tr><td style="color: var(--text-muted);">Nama Pasien</td><td><strong>${patient.name}</strong></td></tr>
            <tr><td style="color: var(--text-muted);">NIK / BPJS</td><td>${patient.nik || '-'} / ${patient.no_bpjs || '-'}</td></tr>
            <tr><td style="color: var(--text-muted);">Jenis Kelamin / Usia</td><td>${patient.gender === 'L' ? 'Laki-Laki' : 'Perempuan'} (${patient.age || '-'} Tahun)</td></tr>
            <tr><td style="color: var(--text-muted);">Alamat / Wilayah</td><td>${patient.address}, ${patient.village || '-'}</td></tr>
            <tr><td style="color: var(--text-muted);">Diagnosis Klinis</td><td><strong>${patient.diagnosis_code}</strong> - ${patient.diagnosis_name}</td></tr>
            <tr><td style="color: var(--text-muted);">Kategori SPM</td><td><span class="badge badge-blue">${patient.category_spm}</span></td></tr>
          </table>
        </div>

        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px;">
          <h4 style="font-size: 14px; color: var(--primary); margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            ${Icons.bell} Pengawas Menelan Obat (PMO) & Notifikasi
          </h4>
          <table style="width: 100%; font-size: 13px; line-height: 1.8;">
            <tr><td style="color: var(--text-muted); width: 40%;">Nama Pendamping / PMO</td><td><strong>${patient.pmo_name}</strong></td></tr>
            <tr><td style="color: var(--text-muted);">Hubungan Keluarga</td><td>${patient.pmo_relation}</td></tr>
            <tr><td style="color: var(--text-muted);">No. Telepon / HP</td><td>${patient.pmo_phone || '-'}</td></tr>
            <tr><td style="color: var(--text-muted);">Email Notifikasi H-1</td><td style="color: var(--primary); font-weight: 600;">${patient.pmo_email}</td></tr>
            <tr><td style="color: var(--text-muted);">Catatan Pasien</td><td>${patient.notes || '-'}</td></tr>
          </table>

          <div style="margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" onclick="sendSingleReminder(${patient.id}, 'control')">
              Kirim Email Pengingat Kontrol
            </button>
            <button class="btn btn-secondary btn-sm" onclick="sendSingleReminder(${patient.id}, 'medicine')">
              Kirim Email Stok Obat
            </button>
          </div>
        </div>
      </div>

      <!-- Riwayat Resep & Kunjungan -->
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h4 style="font-size: 14px; font-weight: 700; color: var(--secondary);">Riwayat Kunjungan & Resep Obat</h4>
          <button class="btn btn-primary btn-sm" onclick="openAddPrescriptionModal(${patient.id})">+ Catat Kunjungan Baru</button>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Tgl Kunjungan</th>
                <th>Nama Obat & Dosis</th>
                <th>Jumlah / Masa</th>
                <th>Tgl Obat Habis</th>
                <th>Tgl Kontrol Berikutnya</th>
                <th>Status</th>
                <th>Dokter & Catatan</th>
              </tr>
            </thead>
            <tbody>
              ${prescriptions.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">Belum ada riwayat resep yang dicatat.</td></tr>
              ` : prescriptions.map(pr => `
                <tr>
                  <td>${formatDateIndo(pr.visit_date)}</td>
                  <td><strong>${pr.medicine_name}</strong> (${pr.dosage_per_day}x1)</td>
                  <td>${pr.quantity} tablet (${pr.days_supply} hari)</td>
                  <td><span style="color: var(--warning); font-weight: 600;">${formatDateIndo(pr.medicine_exhausted_date)}</span></td>
                  <td><strong style="color: var(--primary);">${formatDateIndo(pr.next_control_date)}</strong></td>
                  <td><span class="badge ${pr.status === 'Berjalan' ? 'badge-emerald' : 'badge-gray'}">${pr.status}</span></td>
                  <td style="font-size: 12px;">${pr.doctor_notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Riwayat Log Notifikasi Email untuk Pasien ini -->
      <div>
        <h4 style="font-size: 14px; font-weight: 700; color: var(--secondary); margin-bottom: 10px;">Riwayat Email Terkirim ke Keluarga Pasien</h4>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Waktu Pengiriman</th>
                <th>Tipe Notifikasi</th>
                <th>Email Tujuan</th>
                <th>Status</th>
                <th>Pratinjau</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length === 0 ? `
                <tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 16px;">Belum ada email yang dikirimkan untuk pasien ini.</td></tr>
              ` : logs.map(l => `
                <tr>
                  <td>${formatTimeIndo(l.sent_at)}</td>
                  <td><span class="badge badge-blue">${l.notification_type}</span></td>
                  <td>${l.recipient_email}</td>
                  <td><span class="badge ${l.status === 'Gagal' ? 'badge-rose' : 'badge-emerald'}">${l.status}</span></td>
                  <td><button class="btn btn-secondary btn-sm" onclick="previewEmailLog(${l.id})">Lihat Isi Surat</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    footer.innerHTML = `
      <button type="button" class="btn btn-danger btn-sm" style="margin-right: auto;" onclick="deletePatient(${patient.id}, '${patient.name}')">
        Hapus Pasien
      </button>
      <button type="button" class="btn btn-secondary" onclick="printControlSlip(${patient.id})">
        ${Icons.printer} Cetak Surat Pengingat Kontrol
      </button>
      <button type="button" class="btn btn-primary" onclick="closeModal('modal-detail')">Tutup</button>
    `;

    openModal('modal-detail');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Hapus Pasien
async function deletePatient(patientId, patientName) {
  if (!confirm(`Apakah Anda yakin ingin menghapus data pasien ${patientName}? Seluruh riwayat resep dan log notifikasi akan ikut terhapus.`)) {
    return;
  }

  try {
    const res = await apiFetch(`/api/patients/${patientId}`, { method: 'DELETE' });
    const result = await res.json();
    showToast(result.message || 'Pasien berhasil dihapus', 'success');
    closeModal('modal-detail');
    loadPatients();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== NOTIFIKASI ENGINE TRIGGER ====================
// Tombol Header: Cek & Kirim Pengingat H-1 Sekarang
document.getElementById('btn-trigger-check').addEventListener('click', async () => {
  const btn = document.getElementById('btn-trigger-check');
  btn.disabled = true;
  btn.innerHTML = `<span>Memeriksa & Mengirim...</span>`;

  try {
    const res = await apiFetch('/api/notifications/check-and-send', { method: 'POST' });
    const result = await res.json();

    if (result.success) {
      showToast(result.message, 'success');
      loadDashboard();
      loadLogs();
      loadPatients();
    } else {
      showToast(result.error || 'Gagal menjalankan pengecekan', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${Icons.bell} <span>Cek & Kirim Pengingat H-1</span>`;
  }
});

// Kirim Pengingat Manual ke 1 Pasien Tertentu
async function sendSingleReminder(patientId, type) {
  try {
    showToast('Sedang memproses email pengingat...', 'info');
    const res = await apiFetch('/api/notifications/send-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, type })
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Pengiriman gagal');

    showToast(result.message, 'success');
    loadDashboard();
    loadLogs();
    if (document.getElementById('modal-detail').classList.contains('open')) {
      openPatientDetail(patientId);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== RIWAYAT NOTIFIKASI & PRATINJAU ====================
async function loadLogs() {
  try {
    const res = await apiFetch('/api/notifications/logs');
    const logs = await res.json();

    const tbody = document.getElementById('full-logs-body');
    if (!logs || logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
            Belum ada riwayat email pengingat yang tercatat.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = logs.map(l => {
      let typeBadge = '<span class="badge badge-blue">H-1 Kontrol</span>';
      if (l.notification_type === 'h1_medicine') typeBadge = '<span class="badge badge-amber">H-1 Obat Habis</span>';
      if (l.notification_type === 'medicine_exhausted') typeBadge = '<span class="badge badge-rose">Obat Habis Hari Ini</span>';
      if (l.notification_type === 'manual_reminder') typeBadge = '<span class="badge badge-gray">Manual</span>';

      let statusBadge = `<span class="badge badge-emerald">${l.status}</span>`;
      if (l.status === 'Gagal') statusBadge = `<span class="badge badge-rose">Gagal: ${l.error_message || ''}</span>`;
      if (l.status === 'Simulasi') statusBadge = `<span class="badge badge-amber" title="Mode Simulasi (SMTP belum diatur)">Simulasi</span>`;

      return `
        <tr>
          <td>#${l.id}</td>
          <td style="font-size: 12.5px;">${formatTimeIndo(l.sent_at)}</td>
          <td>${typeBadge}</td>
          <td>
            <strong>${l.patient_name || '-'}</strong>
            <div style="font-size: 11px; color: var(--text-muted);">${l.no_rm || '-'}</div>
          </td>
          <td>${l.recipient_email}</td>
          <td style="font-size: 12.5px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${l.subject}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="previewEmailLog(${l.id})">
              Pratinjau
            </button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('btn-refresh-logs').addEventListener('click', loadLogs);

async function previewEmailLog(logId) {
  try {
    const res = await apiFetch('/api/notifications/logs');
    const logs = await res.json();
    const log = logs.find(item => item.id === logId);

    if (!log) throw new Error('Data log tidak ditemukan');

    const container = document.getElementById('preview-email-container');
    container.innerHTML = log.body;
    openModal('modal-preview-email');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== CETAK SURAT PENGINGAT (A4 PRINT) ====================
async function printControlSlip(patientId) {
  try {
    const res = await apiFetch(`/api/patients/${patientId}`);
    const data = await res.json();
    const { patient, prescriptions } = data;
    const latestPresc = prescriptions[0] || {};
    const faskesName = currentSettings.faskes_name || 'UPTD BLUD PUSKESMAS SESELA';
    const faskesAddress = currentSettings.faskes_address || 'Jl. Raya Sesela, Kec. Gunungsari, Kab. Lombok Barat';
    const faskesPhone = currentSettings.faskes_phone || '(0370) 641234';

    const printArea = document.getElementById('print-sheet');
    printArea.innerHTML = `
      <div style="max-width: 750px; margin: 0 auto; padding: 30px; font-family: 'Times New Roman', serif; color: black; background: white;">
        
        <!-- KOP PUSKESMAS -->
        <div style="text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 20px;">
          <h3 style="margin: 0; font-size: 16pt; font-weight: bold; text-transform: uppercase;">PEMERINTAH KABUPATEN LOMBOK BARAT</h3>
          <h4 style="margin: 2px 0; font-size: 14pt; font-weight: bold; text-transform: uppercase;">DINAS KESEHATAN</h4>
          <h2 style="margin: 4px 0; font-size: 17pt; font-weight: bold; text-transform: uppercase;">${faskesName}</h2>
          <p style="margin: 0; font-size: 10pt; font-style: italic;">${faskesAddress} | Telp/Hotline: ${faskesPhone}</p>
        </div>

        <!-- JUDUL SURAT -->
        <div style="text-align: center; margin-bottom: 24px;">
          <h4 style="margin: 0; font-size: 13pt; text-decoration: underline; font-weight: bold;">
            SURAT PEMBERITAHUAN JADWAL KONTROL & PENGAMBILAN OBAT PASIEN ODGJ
          </h4>
          <p style="margin: 2px 0; font-size: 10.5pt;">Program Standar Pelayanan Minimal (SPM) Kesehatan Jiwa</p>
        </div>

        <p style="font-size: 11pt; line-height: 1.6;">
          Diberitahukan kepada Yth. <strong>Bapak/Ibu ${patient.pmo_name}</strong> (${patient.pmo_relation} / PMO dari Pasien <strong>${patient.name}</strong>), bahwa berdasarkan rekam pemantauan berkala pasien kesehatan jiwa, jadwal kontrol dan pemeriksaan ulang di faskes kami adalah sebagai berikut:
        </p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 11pt;">
          <tr>
            <td style="width: 35%; padding: 5px 0; font-weight: bold;">Nama Pasien</td>
            <td style="width: 5%;">:</td>
            <td><strong>${patient.name}</strong></td>
          </tr>
          <tr>
            <td style="padding: 5px 0; font-weight: bold;">No. Rekam Medis (RM)</td>
            <td>:</td>
            <td><strong>${patient.no_rm}</strong></td>
          </tr>
          <tr>
            <td style="padding: 5px 0;">Diagnosis Klinis</td>
            <td>:</td>
            <td>${patient.diagnosis_code} - ${patient.diagnosis_name} (${patient.category_spm})</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;">Alamat Pasien</td>
            <td>:</td>
            <td>${patient.address}, ${patient.village || ''}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; font-weight: bold; color: #0284c7;">JADWAL KONTROL ULANG</td>
            <td>:</td>
            <td style="font-weight: bold; font-size: 12pt; text-decoration: underline;">
              ${formatDateIndo(latestPresc.next_control_date)}
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 0;">Perkiraan Obat Habis</td>
            <td>:</td>
            <td>${formatDateIndo(latestPresc.medicine_exhausted_date)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;">Resep Obat Saat Ini</td>
            <td>:</td>
            <td>${latestPresc.medicine_name || '-'} (${latestPresc.dosage_per_day || 2}x1 per hari)</td>
          </tr>
        </table>

        <!-- PESAN KEPATUHAN -->
        <div style="border: 1px solid #000; padding: 12px; margin: 18px 0; font-size: 10pt; line-height: 1.5;">
          <strong>PERHATIAN PENTING BAGI KELUARGA / PENDAMPING (PMO):</strong>
          <ol style="margin: 6px 0 0 16px; padding: 0;">
            <li>Sesuai amanat UU No. 17 Tahun 2023 tentang Kesehatan, pengobatan ODGJ harus dilakukan secara teratur dan berkesinambungan tanpa terputus untuk mencegah kekambuhan (relaps).</li>
            <li>Harap membawa Kartu KTP/KK, Kartu BPJS/KIS, dan kemasan sisa obat lama saat kontrol ke Puskesmas.</li>
            <li>Jika ada kendala transportasi atau pasien gaduh gelisah, segera hubungi Hotline Keswa Puskesmas Sesela di: <strong>${faskesPhone}</strong>.</li>
          </ol>
        </div>

        <!-- TANDA TANGAN -->
        <div style="margin-top: 35px; display: flex; justify-content: flex-end;">
          <div style="text-align: center; width: 250px; font-size: 11pt;">
            Sesela, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br>
            Pengelola Program Kesehatan Jiwa<br>
            ${faskesName}
            <br><br><br><br>
            ( __________________________ )<br>
            NIP. ........................................
          </div>
        </div>

      </div>
    `;

    // Tampilkan print preview browser
    printArea.style.display = 'block';
    window.print();
    printArea.style.display = 'none';

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== PENGATURAN & SMTP ====================
async function loadSettings() {
  try {
    const res = await apiFetch('/api/settings');
    const data = await res.json();
    currentSettings = data;

    document.getElementById('setting_faskes_name').value = data.faskes_name || '';
    document.getElementById('setting_faskes_code').value = data.faskes_code || '';
    document.getElementById('setting_faskes_address').value = data.faskes_address || '';
    document.getElementById('setting_faskes_phone').value = data.faskes_phone || '';
    document.getElementById('setting_keswa_officer').value = data.keswa_officer || '';
    document.getElementById('setting_smtp_host').value = data.smtp_host || 'smtp.gmail.com';
    document.getElementById('setting_smtp_port').value = data.smtp_port || '465';
    document.getElementById('setting_smtp_user').value = data.smtp_user || '';
    document.getElementById('setting_smtp_pass').value = data.smtp_pass_masked || '';
    document.getElementById('setting_smtp_sender_name').value = data.smtp_sender_name || '';

    // Update Header Brand Subtitle
    if (data.faskes_name) {
      document.getElementById('header-faskes-title').innerText = `${data.faskes_name} • Standar Pelayanan Minimal ODGJ`;
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('form-settings').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    faskes_name: document.getElementById('setting_faskes_name').value,
    faskes_code: document.getElementById('setting_faskes_code').value,
    faskes_address: document.getElementById('setting_faskes_address').value,
    faskes_phone: document.getElementById('setting_faskes_phone').value,
    keswa_officer: document.getElementById('setting_keswa_officer').value,
    smtp_host: document.getElementById('setting_smtp_host').value,
    smtp_port: document.getElementById('setting_smtp_port').value,
    smtp_user: document.getElementById('setting_smtp_user').value,
    smtp_pass: document.getElementById('setting_smtp_pass').value,
    smtp_sender_name: document.getElementById('setting_smtp_sender_name').value
  };

  try {
    const res = await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Gagal menyimpan pengaturan');

    showToast('Pengaturan faskes dan SMTP berhasil disimpan!', 'success');
    loadSettings();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Uji Coba Kirim Email SMTP
document.getElementById('btn-send-test-email').addEventListener('click', async () => {
  const testEmail = document.getElementById('input-test-email').value;
  if (!testEmail || !testEmail.includes('@')) {
    showToast('Masukkan alamat email tujuan uji coba yang valid!', 'error');
    return;
  }

  const btn = document.getElementById('btn-send-test-email');
  btn.disabled = true;
  btn.innerText = 'Mengirim email uji coba...';

  try {
    const res = await apiFetch('/api/settings/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test_email: testEmail })
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Pengiriman gagal');

    showToast(result.message, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Kirim Email Tes Sekarang';
  }
});

// ==================== SEARCH & FILTER PASIEN ====================
document.getElementById('patient-search-input').addEventListener('input', (e) => {
  currentSearchQuery = e.target.value.trim();
  loadPatients();
});

document.querySelectorAll('.filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPatientFilter = btn.dataset.filter;
    loadPatients();
  });
});

document.getElementById('btn-add-patient').addEventListener('click', openAddPatientModal);

// Inisialisasi Nav Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

// Tutup modal jika klik di luar box
document.querySelectorAll('.modal-backdrop').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open');
    }
  });
});

// Inisialisasi Awal Aplikasi
window.addEventListener('DOMContentLoaded', () => {
  initIcons();
  loadSettings();
  loadDashboard();
});
