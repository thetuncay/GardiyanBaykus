// BilgeBaykuş — PM2 Ecosystem Config
// Kullanım: npm run pm2:start
// Ubuntu otomatik başlatma: pm2 startup systemd -u $USER --hp $HOME && pm2 save

const path = require("path");

module.exports = {
  apps: [
    {
      name: "bilgebaykus",
      script: "dist/index.js",
      cwd: path.resolve(__dirname),

      // Node.js ESM modülü olduğu için interpreter flag gerekli
      node_args: "--experimental-vm-modules",

      // === ÇALIŞMA MODU ===
      instances: 1,       // Discord botu tek instance çalışmalı (sharding yoksa)
      exec_mode: "fork",

      // === RESTART STRATEJİSİ ===
      autorestart: true,
      watch: false,       // Dosya değişikliğinde restart etme (production)
      max_memory_restart: "512M",
      min_uptime: "10s",  // 10 saniyeden kısa çalışırsa crash sayılır
      max_restarts: 5,    // 15 dakika içinde max 5 crash → durdur
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,

      // === GRACEFUL SHUTDOWN ===
      kill_timeout: 10000,   // SIGKILL'den önce 10 saniye bekle (DB bağlantısı kapansın)
      wait_ready: false,     // process.send('ready') kullanmıyoruz

      // === LOG AYARLARI ===
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      merge_logs: true,
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // === ÇEVRE DEĞİŞKENLERİ ===
      // .env dosyası dotenv ile zaten yükleniyor,
      // burada sadece PM2'ye özel veya override edilecek değerler var.
      env: {
        NODE_ENV: "production",
        TZ: "Europe/Istanbul",
      },

      env_development: {
        NODE_ENV: "development",
        LOG_LEVEL: "debug",
      },
    },
  ],
};
