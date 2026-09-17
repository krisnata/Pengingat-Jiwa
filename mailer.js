// mailer.js - Modul Pengiriman Email SMTP Murni & Template Notifikasi SPM Keswa
const net = require('node:net');
const tls = require('node:tls');
const { getSetting } = require('./db');

/**
 * Mengirim email menggunakan protokol SMTP standar (mendukung Port 465 SSL, 587 STARTTLS, 25 Plain)
 */
function sendSmtpEmail({ host, port, secure, user, pass, from, to, subject, html, text }) {
  return new Promise((resolve, reject) => {
    const isExplicitTls = Number(port) === 465 || secure === true || secure === 'true';
    let socket;
    let step = 0;
    let buffer = '';

    const timeoutMs = 15000;
    const timer = setTimeout(() => {
      if (socket) socket.destroy();
      reject(new Error(`Koneksi SMTP ke ${host}:${port} timeout (${timeoutMs / 1000} detik)`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      if (socket && !socket.destroyed) {
        socket.end();
      }
    }

    function send(cmd) {
      if (socket && socket.writable) {
        socket.write(cmd + '\r\n');
      }
    }

    function handleResponse(response) {
      const lines = response.trim().split('\r\n');
      const lastLine = lines[lines.length - 1];
      const code = parseInt(lastLine.substring(0, 3), 10);
      const isMultiLine = lastLine.charAt(3) === '-';

      if (isMultiLine) return; // Tunggu kelanjutan baris respons SMTP

      if (step === 0 && code === 220) {
        // Terhubung, kirim EHLO
        step = 1;
        send(`EHLO localhost`);
      } else if (step === 1 && code === 250) {
        if (!isExplicitTls && (Number(port) === 587 || Number(port) === 25)) {
          // Coba STARTTLS
          step = 2;
          send('STARTTLS');
        } else if (user && pass) {
          // Langsung Auth jika sudah TLS atau plain
          step = 4;
          send('AUTH LOGIN');
        } else {
          step = 7;
          send(`MAIL FROM:<${from}>`);
        }
      } else if (step === 2 && code === 220) {
        // Upgrade socket ke TLS untuk STARTTLS
        step = 3;
        socket.removeAllListeners('data');
        const tlsSocket = tls.connect({
          socket: socket,
          host: host,
          rejectUnauthorized: false
        }, () => {
          socket = tlsSocket;
          socket.on('data', onData);
          step = 1;
          send('EHLO localhost');
        });
        tlsSocket.on('error', (err) => {
          cleanup();
          reject(err);
        });
      } else if (step === 4 && code === 334) {
        // Kirim Username Base64
        step = 5;
        send(Buffer.from(user).toString('base64'));
      } else if (step === 5 && code === 334) {
        // Kirim Password Base64
        step = 6;
        send(Buffer.from(pass.replace(/\s+/g, '')).toString('base64'));
      } else if (step === 6 && code === 235) {
        // Auth Sukses
        step = 7;
        send(`MAIL FROM:<${from}>`);
      } else if (step === 7 && code === 250) {
        step = 8;
        send(`RCPT TO:<${to}>`);
      } else if (step === 8 && (code === 250 || code === 251)) {
        step = 9;
        send('DATA');
      } else if (step === 9 && code === 354) {
        step = 10;
        const boundary = '----=_Part_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
        const headers = [
          `From: "${from.name || 'Pengingat Jiwa'}" <${from.email || from}>`,
          `To: <${to}>`,
          `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
          `MIME-Version: 1.0`,
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          `Date: ${new Date().toUTCString()}`,
          `X-Mailer: Puskesmas-Keswa-App/1.0`,
          ''
        ].join('\r\n');

        const message = [
          headers,
          `--${boundary}`,
          `Content-Type: text/plain; charset=UTF-8`,
          `Content-Transfer-Encoding: base64`,
          '',
          Buffer.from(text || '').toString('base64'),
          '',
          `--${boundary}`,
          `Content-Type: text/html; charset=UTF-8`,
          `Content-Transfer-Encoding: base64`,
          '',
          Buffer.from(html || '').toString('base64'),
          '',
          `--${boundary}--`,
          '.'
        ].join('\r\n');

        send(message);
      } else if (step === 10 && code === 250) {
        step = 11;
        send('QUIT');
        cleanup();
        resolve({ success: true, messageId: lastLine });
      } else if (code >= 400) {
        cleanup();
        reject(new Error(`SMTP Error [${code}]: ${lastLine}`));
      }
    }

    function onData(data) {
      buffer += data.toString('utf8');
      if (buffer.includes('\n')) {
        const fullResponse = buffer;
        buffer = '';
        handleResponse(fullResponse);
      }
    }

    try {
      if (isExplicitTls) {
        socket = tls.connect({
          host,
          port: Number(port),
          rejectUnauthorized: false
        }, () => {});
      } else {
        socket = net.connect({
          host,
          port: Number(port)
        }, () => {});
      }

      socket.on('data', onData);
      socket.on('error', (err) => {
        cleanup();
        reject(err);
      });
    } catch (e) {
      cleanup();
      reject(e);
    }
  });
}

/**
 * Dispatcher email utama: mengecek apakah SMTP siap. Jika belum, simpan sebagai simulasi log.
 */
async function dispatchEmail({ to, subject, html, text }) {
  const host = getSetting('smtp_host', 'smtp.gmail.com');
  const port = getSetting('smtp_port', '465');
  const secure = getSetting('smtp_secure', 'true') === 'true';
  const user = getSetting('smtp_user', '');
  const pass = getSetting('smtp_pass', '');
  const senderName = getSetting('smtp_sender_name', 'Layanan Keswa Puskesmas Sesela');

  // Jika kredensial belum diisi, kita lakukan simulasi pengiriman yang aman
  if (!user || !pass) {
    return {
      simulated: true,
      status: 'Simulasi',
      message: 'SMTP belum dikonfigurasi (Email dicatat dalam mode simulasi)'
    };
  }

  try {
    const res = await sendSmtpEmail({
      host,
      port,
      secure,
      user,
      pass,
      from: { name: senderName, email: user },
      to,
      subject,
      html,
      text
    });
    return { simulated: false, status: 'Terkirim', message: res.messageId };
  } catch (err) {
    return { simulated: false, status: 'Gagal', error: err.message };
  }
}

/**
 * Template Email Pengingat H-1 Jadwal Kontrol Rutin
 */
function generateControlReminderEmail({ patient, prescription, faskes }) {
  const subject = `[PENGINGAT H-1 KONTROL] Jadwal Pemeriksaan Rutin Jiwa: ${patient.name} (${patient.no_rm})`;
  
  const text = `
PENGINGAT JADWAL KONTROL KESEHATAN JIWA (H-1)
${faskes.name}

Kepada Yth. Bapak/Ibu ${patient.pmo_name} (${patient.pmo_relation} dari Pasien ${patient.name}),

Berdasarkan data rekam medis kami dan Standar Pelayanan Minimal (SPM) Pelayanan Kesehatan Jiwa, kami mengingatkan bahwa jadwal kontrol rutin pasien adalah BESOK:
- Tanggal Kontrol: ${prescription.next_control_date}
- Nama Pasien: ${patient.name}
- No. Rekam Medis: ${patient.no_rm}
- Diagnosa: ${patient.diagnosis_code} - ${patient.diagnosis_name}
- Lokasi: Poli Kesehatan Jiwa / Umum ${faskes.name}

PENTING UNTUK KELUARGA/PMO:
1. Kontrol tepat waktu sangat penting untuk mencegah kekambuhan (relaps) dan putus obat.
2. Harap membawa Kartu Identitas (KTP/KK), Kartu BPJS/KIS, dan sisa kemasan obat sebelumnya.
3. Informasikan kepada dokter jika ada efek samping atau perubahan perilaku pasien.

Alamat: ${faskes.address}
Hotline / Telepon: ${faskes.phone}
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #2d3748; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 0; font-size: 13px; opacity: 0.9; }
    .badge-h1 { display: inline-block; background-color: #fef08a; color: #854d0e; font-weight: bold; font-size: 13px; padding: 6px 14px; border-radius: 9999px; margin-top: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .content { padding: 24px; }
    .greeting { font-size: 15px; line-height: 1.6; margin-bottom: 20px; }
    .box-info { background: #f8fafc; border-left: 4px solid #0284c7; padding: 16px; border-radius: 6px; margin-bottom: 20px; }
    .table-info { width: 100%; border-collapse: collapse; }
    .table-info td { padding: 6px 0; font-size: 14px; vertical-align: top; }
    .table-info td.label { width: 38%; color: #64748b; font-weight: 600; }
    .table-info td.value { width: 62%; color: #0f172a; font-weight: 600; }
    .box-warning { background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 6px; margin-bottom: 20px; }
    .box-warning h4 { margin: 0 0 6px 0; color: #b45309; font-size: 14px; }
    .box-warning ul { margin: 0; padding-left: 20px; font-size: 13px; color: #78350f; line-height: 1.5; }
    .box-legal { background: #eff6ff; border: 1px solid #dbeafe; padding: 12px; border-radius: 6px; font-size: 12px; color: #1e40af; line-height: 1.5; margin-bottom: 20px; }
    .footer { background: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${faskes.name}</h1>
      <p>Pelayanan Kesehatan Jiwa Komprehensif (SPM Bidang Kesehatan)</p>
      <div class="badge-h1">PEMBERITAHUAN H-1 JADWAL KONTROL</div>
    </div>
    <div class="content">
      <p class="greeting">
        Kepada Yth. <strong>Bapak/Ibu ${patient.pmo_name}</strong><br>
        (Pengawas Menelan Obat / Keluarga dari <strong>${patient.name}</strong>)
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        Berdasarkan data pemantauan berkala pasien ODGJ di wilayah kerja kami, kami menginformasikan bahwa jadwal kontrol ulang dan evaluasi medis pasien dijadwalkan pada:
      </p>

      <div class="box-info">
        <table class="table-info">
          <tr>
            <td class="label">Tanggal Kontrol</td>
            <td class="value" style="color: #0284c7; font-size: 16px;">BESOK (${prescription.next_control_date})</td>
          </tr>
          <tr>
            <td class="label">Nama Pasien</td>
            <td class="value">${patient.name}</td>
          </tr>
          <tr>
            <td class="label">No. Rekam Medis</td>
            <td class="value">${patient.no_rm}</td>
          </tr>
          <tr>
            <td class="label">Diagnosis Klinis</td>
            <td class="value">${patient.diagnosis_code} - ${patient.diagnosis_name}</td>
          </tr>
          <tr>
            <td class="label">Kategori SPM</td>
            <td class="value"><span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-size:12px;">${patient.category_spm}</span></td>
          </tr>
          <tr>
            <td class="label">Obat yang Diminum</td>
            <td class="value">${prescription.medicine_name} (${prescription.dosage_per_day}x sehari)</td>
          </tr>
        </table>
      </div>

      <div class="box-warning">
        <h4>PENTING UNTUK DIPERHATIKAN KELUARGA (PMO):</h4>
        <ul>
          <li><strong>Jangan biarkan obat terputus:</strong> Putus obat berisiko memicu relaps (kekambuhan gejala) dan kegelisahan.</li>
          <li>Membawa <strong>KTP / Kartu Keluarga</strong> dan <strong>Kartu BPJS/KIS</strong> yang masih aktif.</li>
          <li>Membawa sisa obat atau kemasan obat untuk dilaporkan kepada dokter.</li>
          <li>Sampaikan perkembangan perilaku, kualitas tidur, dan pola makan pasien saat pemeriksaan.</li>
        </ul>
      </div>

      <div class="box-legal">
        <strong>Ketentuan Regulasi:</strong> Sesuai UU No. 17 Tahun 2023 tentang Kesehatan dan Permenkes Standar Pelayanan Minimal (SPM), setiap pasien ODGJ berhak mendapatkan pemantauan kesehatan rutin berkelanjutan minimal 1 bulan sekali secara komprehensif dan bebas dari diskriminasi maupun pemasungan.
      </div>
    </div>
    <div class="footer">
      <strong>${faskes.name}</strong><br>
      ${faskes.address}<br>
      Telepon / Hotline Keswa: ${faskes.phone}
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, text, html };
}

/**
 * Template Email Pengingat H-1 atau Hari H Obat Habis
 */
function generateMedicineReminderEmail({ patient, prescription, faskes, isExhaustedToday }) {
  const statusLabel = isExhaustedToday ? 'HARI INI HABIS' : 'H-1 OBAT HABIS';
  const subject = `[${statusLabel}] Peringatan Persediaan Obat Pasien Jiwa: ${patient.name} (${patient.no_rm})`;

  const text = `
PERINGATAN PERSEDIAAN OBAT JIWA (${statusLabel})
${faskes.name}

Kepada Yth. Bapak/Ibu ${patient.pmo_name} (${patient.pmo_relation} dari Pasien ${patient.name}),

Kami menginformasikan bahwa stok obat jiwa untuk pasien ${patient.name} (No. RM: ${patient.no_rm}) diperkirakan ${isExhaustedToday ? 'HABIS PADA HARI INI' : 'AKAN HABIS BESOK'}:
- Tanggal Obat Habis: ${prescription.medicine_exhausted_date}
- Nama Obat: ${prescription.medicine_name}
- Dosis Harian: ${prescription.dosage_per_day}x sehari
- Jadwal Kontrol Terkait: ${prescription.next_control_date}

MOHON SEGERA DILAKUKAN:
1. Segera dampingi pasien untuk datang ke Poli Jiwa ${faskes.name} untuk pemeriksaan dan perpanjangan resep obat.
2. Jangan sampai obat berhenti diminum walaupun sehari, untuk menjaga kestabilan kondisi pasien.
3. Jika berhalangan hadir tepat waktu, segera hubungi kontak petugas kesehatan jiwa kami di ${faskes.phone}.

Alamat: ${faskes.address}
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #2d3748; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #ea580c, #c2410c); color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 0; font-size: 13px; opacity: 0.9; }
    .badge-alert { display: inline-block; background-color: #fee2e2; color: #991b1b; font-weight: bold; font-size: 13px; padding: 6px 14px; border-radius: 9999px; margin-top: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .content { padding: 24px; }
    .box-info { background: #fff7ed; border-left: 4px solid #ea580c; padding: 16px; border-radius: 6px; margin: 18px 0; }
    .table-info { width: 100%; border-collapse: collapse; }
    .table-info td { padding: 6px 0; font-size: 14px; }
    .table-info td.label { width: 38%; color: #7c2d12; font-weight: 600; }
    .table-info td.value { width: 62%; color: #431407; font-weight: 600; }
    .box-danger { background: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 6px; margin-bottom: 20px; }
    .box-danger h4 { margin: 0 0 6px 0; color: #991b1b; font-size: 14px; }
    .box-danger ul { margin: 0; padding-left: 20px; font-size: 13px; color: #7f1d1d; line-height: 1.5; }
    .footer { background: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${faskes.name}</h1>
      <p>Sistem Pemantauan Kepatuhan Obat Jiwa (Pencegahan Relaps)</p>
      <div class="badge-alert">PERINGATAN: STOK OBAT ${isExhaustedToday ? 'HABIS HARI INI' : 'HABIS BESOK (H-1)'}</div>
    </div>
    <div class="content">
      <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">
        Kepada Yth. <strong>Bapak/Ibu ${patient.pmo_name}</strong><br>
        (Pendamping/PMO Pasien <strong>${patient.name}</strong>)
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        Berdasarkan perhitungan resep obat pada kunjungan terakhir, persediaan obat pasien <strong>${isExhaustedToday ? 'habis pada hari ini' : 'akan habis besok'}</strong>.
      </p>

      <div class="box-info">
        <table class="table-info">
          <tr>
            <td class="label">Nama Pasien</td>
            <td class="value">${patient.name} (${patient.no_rm})</td>
          </tr>
          <tr>
            <td class="label">Nama Obat</td>
            <td class="value">${prescription.medicine_name}</td>
          </tr>
          <tr>
            <td class="label">Dosis Harian</td>
            <td class="value">${prescription.dosage_per_day} tablet / hari</td>
          </tr>
          <tr>
            <td class="label">Tanggal Obat Habis</td>
            <td class="value" style="color: #c2410c; font-size: 15px;">${prescription.medicine_exhausted_date}</td>
          </tr>
          <tr>
            <td class="label">Jadwal Kontrol Terkait</td>
            <td class="value">${prescription.next_control_date}</td>
          </tr>
        </table>
      </div>

      <div class="box-danger">
        <h4>TINDAKAN SEGERA UNTUK KELUARGA / PMO:</h4>
        <ul>
          <li><strong>Segera bawa pasien kontrol ke Puskesmas:</strong> Jangan menunggu sampai obat benar-benar habis tanpa persediaan baru.</li>
          <li><strong>Bahaya Putus Obat:</strong> Penghentian obat psikotropika secara mendadak dapat menimbulkan gejala putus obat dan relaps (kembali kambuh / gaduh gelisah).</li>
          <li>Hubungi hotline kami jika pasien mengalami kendala mobilitas untuk koordinasi kunjungan rumah (Home Visit).</li>
        </ul>
      </div>
    </div>
    <div class="footer">
      <strong>${faskes.name}</strong><br>
      ${faskes.address}<br>
      Hotline Pelayanan Jiwa: ${faskes.phone}
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, text, html };
}

module.exports = {
  sendSmtpEmail,
  dispatchEmail,
  generateControlReminderEmail,
  generateMedicineReminderEmail
};
