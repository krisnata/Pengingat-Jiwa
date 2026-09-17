# Pengingat Jiwa - Sistem Pengingat Kontrol & Minum Obat Pasien ODGJ

Aplikasi sistem informasi kesehatan khusus untuk fasilitas pelayanan kesehatan tingkat pertama (Puskesmas / Klinik / Praktik Dokter) guna memantau kepatuhan kontrol berkala dan konsumsi obat pasien **ODGJ (Orang Dengan Gangguan Jiwa)** sesuai dengan ketentuan perundang-undangan dan Standar Pelayanan Minimal (SPM) Kesehatan Jiwa di Indonesia.

Sistem ini secara otomatis mengirimkan surat notifikasi email resmi kepada Pengawas Menelan Obat (PMO) / keluarga pasien pada **H-1 sebelum tanggal jadwal kontrol** atau **H-1 sebelum stok persediaan obat habis**.

---

## 1. Landasan Hukum & Regulasi Pelayanan

1. **Undang-Undang Republik Indonesia Nomor 17 Tahun 2023 tentang Kesehatan**:
   - Menjamin hak setiap orang dengan gangguan jiwa (ODGJ) untuk mendapatkan upaya promotif, preventif, kuratif, dan rehabilitatif yang berkesinambungan (*continuum of care*).
   - Menegaskan pentingnya kepatuhan terapi psikotropika jangka panjang guna mencegah kekambuhan (*relapse*), mencegah komplikasi gaduh gelisah, serta menghapuskan segala bentuk tindakan pemasungan dan penelantaran.
2. **Peraturan Menteri Kesehatan RI No. 4 Tahun 2019 tentang Standar Pelayanan Minimal (SPM) Bidang Kesehatan**:
   - Menetapkan indikator nasional: **Pelayanan Kesehatan Orang Dengan Gangguan Jiwa (ODGJ) Berat sebesar 100%**.
   - Mengharuskan faskes primer melakukan pemeriksaan rutin minimal 1 (satu) bulan sekali, pemantauan konsumsi obat tanpa jeda, serta edukasi kepatuhan kepada keluarga atau Pengawas Menelan Obat (PMO).

---

## 2. Mengapa Notifikasi H-1 Sangat Krusial?

- **Pencegahan Putus Obat (*Drug Default / Drop Out*)**: Obat antipsikotik dan psikotropika memerlukan kestabilan kadar dalam darah (*steady state*). Penghentian obat mendadak memicu timbulnya sindrom putus obat dan relaps akut.
- **Kesiapan Keluarga & Transportasi**: Pemberitahuan pada **H-1** memberikan tenggat waktu yang cukup bagi keluarga/PMO untuk merencanakan waktu pendampingan ke Puskesmas sebelum obat benar-benar habis di rumah.
- **Peringatan Dini Keterlambatan**: Jika pasien melewati batas tanggal kontrol (*overdue*), sistem segera memberikan sinyal merah bagi petugas pengelola program jiwa dan kader desa untuk segera menjadwalkan kunjungan rumah (*home visit / pelacakan kasus*).

---

## 3. Fitur-Fitur Utama Aplikasi

1. **Dashboard Indikator Kepatuhan SPM**:
   - Ringkasan KPI: Total Pasien Terdaftar, Pasien Kontrol Besok (H-1), Pasien Obat Habis Besok (H-1), dan Pasien Terlambat (*Overdue*).
   - Daftar Pasien Memerlukan Perhatian & Tindakan Segera.
   - Tombol **"Cek & Kirim Pengingat H-1 Sekarang"** untuk memicu pemeriksaan dan pengiriman email kapan saja.
2. **Manajemen Pasien ODGJ**:
   - Data Rekam Medis (No. RM, NIK, No. BPJS/KIS, Nama, Usia, Alamat, Desa Wilayah Binaan).
   - Klasifikasi Diagnosis Medis (ICD-10, misal: F20.0 Skizofrenia Paranoid, F31 Bipolar, dll.).
   - Data Lengkap Pengawas Menelan Obat (PMO) / Wali Pasien beserta No. HP dan **Alamat Email Notifikasi**.
3. **Pencatatan Resep & Perhitungan Stok Otomatis**:
   - Menginput aturan minum (misal: 2 tablet/hari) dan jumlah tablet diberikan (misal: 60 tablet).
   - Sistem secara otomatis menghitung masa cukup obat (30 hari) dan menetapkan tanggal obat habis serta tanggal H-1.
4. **Mesin Notifikasi Email Otomatis (SMTP)**:
   - Pengiriman otomatis setiap hari untuk pasien yang jadwal kontrolnya atau obatnya habis besok (H-1).
   - Template email ramah, empatik, bernuansa medis resmi, lengkap dengan informasi obat, panduan keluarga, serta nomor telepon hotline darurat jiwa Puskesmas.
   - Mode Simulasi: Jika SMTP belum diisi, sistem tetap mencatat email ke log simulasi sehingga petugas dapat melihat pratinjau surat tanpa error.
5. **Cetak Surat Pengingat Kontrol (A4 Print-Ready)**:
   - Template surat resmi berkop Puskesmas Sesela yang siap dicetak untuk dibawa kader kesehatan jiwa saat melakukan kunjungan rumah (*home care*).

---

## 4. Cara Menjalankan Aplikasi

Aplikasi telah dikonfigurasi mandiri (*self-contained*) dan tidak memerlukan instalasi database tambahan.

1. Buka folder `d:\Pengingat Jiwa\`.
2. Klik ganda pada file **`jalankan.bat`** (atau `start.bat`).
3. Browser otomatis terbuka mengarah ke alamat:
   ```
   http://localhost:3000
   ```
4. Aplikasi siap digunakan!

---

## 5. Panduan Konfigurasi Email Pengirim (Gmail SMTP)

Untuk mengaktifkan pengiriman email sungguhan ke keluarga pasien melalui Gmail:

1. Buka tab **Pengaturan Faskes & SMTP** di aplikasi.
2. Gunakan setelan default:
   - **SMTP Host**: `smtp.gmail.com`
   - **SMTP Port**: `465` (SSL)
3. Masukkan alamat email akun Gmail Puskesmas di kolom **Email Pengirim**.
4. Untuk **Password SMTP**, gunakan **Google App Password** (Kata Sandi Aplikasi 16 karakter):
   - Masuk ke akun Google Anda di [myaccount.google.com](https://myaccount.google.com/).
   - Masuk ke menu **Keamanan (Security)**, aktifkan **Verifikasi 2 Langkah**.
   - Buka menu **Sandi Aplikasi (App Passwords)**.
   - Buat sandi baru dengan nama *"Pengingat Jiwa"*.
   - Salin 16 karakter kode yang muncul (tanpa spasi) ke kolom Password SMTP di aplikasi.
5. Klik **Simpan Perubahan Pengaturan**.
6. Masukkan email Anda pada kotak **Uji Coba Kirim Email (Test Mail)** lalu klik **Kirim Email Tes Sekarang** untuk memastikan email berhasil diterima di kotak masuk Anda.

---

## 6. Struktur Berkas Sistem

```
d:\Pengingat Jiwa\
├── db.js                   # Modul database SQLite (node:sqlite bawaan)
├── mailer.js               # Klien SMTP murni & template email resmi
├── server.js               # REST API HTTP Server & Background Scheduler
├── seed.js                 # Data awal contoh pasien wilayah Sesela
├── public/                 # Antarmuka Pengguna (Web Frontend)
│   ├── index.html          # Halaman utama aplikasi
│   ├── style.css           # Desain visual modern & stylesheet cetak A4
│   ├── app.js              # Logika interaksi SPA & kalkulasi resep
│   └── icons.js            # Generator ikon visual SVG mandiri
├── jalankan.bat            # File peluncur 1-klik untuk Windows
├── start.bat               # Shortcut peluncur
├── pengingat_jiwa.db       # Database SQLite lokal (otomatis dibuat)
└── README.md               # Dokumentasi sistem ini
```

---

*Dikembangkan untuk mendukung pelayanan kesehatan jiwa berkualitas, terukur, dan humanis di wilayah kerja Puskesmas.*
