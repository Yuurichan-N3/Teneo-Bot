# 🚀 TENEO BOT - Auto Task Completion

TENEO BOT adalah bot otomatis untuk menyelesaikan tugas-tugas di platform Teneo. Dengan fitur seperti WebSocket Client, penggunaan proxy, dan sistem logging yang interaktif, bot ini dirancang untuk meningkatkan efisiensi dalam mengelola akun Teneo Anda.

## 📌 Fitur
- 🌐 **WebSocket Client** untuk koneksi real-time dengan Teneo.
- 🔄 **Auto Reconnect** jika koneksi terputus.
- 🛡 **Dukungan Proxy** (SOCKS dan HTTPS).
- 📊 **Statistik Live** dengan tabel CLI.
- 📥 **Claim Referral** secara otomatis.
- 🎨 **Antarmuka CLI Interaktif** dengan `chalk` dan `cli-table3`.

## 📜 Persyaratan
- **Node.js** (v14 atau lebih baru)
- Clone Repository:

```bash
git clone https://github.com/Yuurichan-N3/Teneo-Bot.git
cd Teneo-Bot
```

File config.js (untuk konfigurasi X_API_KEY dan lainnya).

data.txt (berisi token akun Teneo, satu per baris).

proxy.txt (jika menggunakan proxy, satu per baris).


🚀 Instalasi & Penggunaan

1. install dependensi :

```
npm install ws axios chalk cli-progress cli-table3 colors readline fs https-proxy-agent socks-proxy-agent node-fetch
```


2. Masukkan token ke dalam data.txt, dan jika ingin menggunakan proxy, tambahkan daftar proxy ke proxy.txt.


3. Jalankan bot:

```
node bot.js
```

## 📜 Lisensi  

Script ini didistribusikan untuk keperluan pembelajaran dan pengujian. Penggunaan di luar tanggung jawab pengembang.  

Untuk update terbaru, bergabunglah di grup **Telegram**: [Klik di sini](https://t.me/sentineldiscus).


---

## 💡 Disclaimer
Penggunaan bot ini sepenuhnya tanggung jawab pengguna. Kami tidak bertanggung jawab atas penyalahgunaan skrip ini.
