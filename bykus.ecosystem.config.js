// ecosystem.config.js
// Baykuş Bot için PM2 yapılandırması
// Kullanım: pm2 start ecosystem.config.js
// Klasör yapısı: C:\Users\Administrator\Desktop\baykus_bot\

module.exports = {
  apps: [{
    name: 'baykus-bot',
    script: 'main.py',  // Ana bot dosyan (baykus_botu.py veya main.py)
    interpreter: 'python',
    interpreter_args: '',
    
    // === PERFORMANS AYARLARI ===
    instances: 1,
    exec_mode: 'fork',
    
    // === RESTART STRATEJİSİ ===
    autorestart: true,
    watch: false,
    max_memory_restart: '768M',  // 768MB (ekonomi sistemi için biraz daha fazla)
    
    // Restart koşulları
    min_uptime: '15s',           // En az 15 saniye çalışmalı
    max_restarts: 10,            // 15 dakikada max 10 restart
    restart_delay: 5000,         // Restart arası 5 saniye bekle
    
    // Exponential backoff (crash döngüsünü önler)
    exp_backoff_restart_delay: 200,  // İlk bekleme 200ms, sonra katlanarak artar
    
    // === TIMEOUT AYARLARI ===
    kill_timeout: 8000,          // SIGKILL'den önce 8 saniye bekle
    listen_timeout: 15000,       // Başlatma için 15 saniye timeout
    shutdown_with_message: false,
    
    // === ÇEVRE DEĞİŞKENLERİ ===
    env: {
      // Python encoding ayarları (Türkçe karakter desteği)
      PYTHONUNBUFFERED: '1',
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
      
      // Discord.py için timeout ayarları
      AIOHTTP_CLIENT_TIMEOUT: '180',    // API istekleri için 3 dakika
      DISCORD_TIMEOUT: '180',
      DISCORD_MAX_MESSAGES: '100',
      
      // Asyncio debug (production'da kapatabilirsin)
      PYTHONASYNCIODEBUG: '0',
      
      // Windows sistem bilgileri
      COMPUTERNAME: process.env.COMPUTERNAME || 'VM-BAYKUS',
      USERNAME: process.env.USERNAME || 'Administrator',
      
      // Timezone (Türkiye için)
      TZ: 'Europe/Istanbul'
    },
    
    // === LOG AYARLARI ===
    error_file: 'logs/baykus-error.log',
    out_file: 'logs/baykus-out.log',
    log_file: 'logs/baykus-combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    max_size: '50M',            // Her log dosyası max 50MB
    retain: 7,                  // Son 7 dosyayı tut
    
    // === OTOMATİK RESTART (CRON) ===
    // Her Pazar 05:00'te restart (haftalık rapor sonrası)
    cron_restart: '0 5 * * 0',
    
    // === WINDOWS AYARLARI ===
    windowsHide: false,         // Console penceresini gizleme
    
    // === MONİTORİNG ===
    pmx: true,                  // PM2 Plus monitoring aktif
    
    // === INSTANCE VAR MI KONTROL ET ===
    force: false,               // Aynı isimde instance varsa hata ver
    
    // === NODE CLUSTER AYARLARI (Python için gerekli değil ama PM2 için) ===
    instance_var: 'INSTANCE_ID',
    
    // === ERROR HANDLING ===
    // 5 saniye içinde 3 kez crash olursa durdur (sonsuz döngüyü önle)
    min_uptime: '5s',
    max_restarts: 3,
    autorestart_limit: 5,       // 5 ardışık başarısız start sonrası durdur
    
    // === NOTIFICATION WEBHOOK (opsiyonel) ===
    // Discord webhook URL'ini buraya ekleyebilirsin
    // error_file webhook ile bildirim gönderir
    
    // === GELİŞMİŞ AYARLAR ===
    vizion: true,               // Git bilgilerini topla
    post_update: ['npm install'],  // Güncelleme sonrası komut (gerekirse)
    
    // === KİLLİNG STRATEJISI ===
    kill_retry_time: 100,       // Kill retry arası 100ms bekle
    wait_ready: true,           // Ready sinyali bekle (process.send('ready'))
    
    // === BAYKUŞ BOTA ÖZEL NOTLAR ===
    // 1. Günlük kontrol: Sabah 00:00'da çalışır
    // 2. Günlük rapor: Sabah 09:00'da gönderilir
    // 3. Dinamik kontrol: Her 2 saatte bir
    // 4. HAFTALıK EKONOMİ RAPORU: Her Pazar 04:00'te
    // 
    // Bu yüzden cron_restart Pazar 05:00'e ayarlandı (haftalık rapor sonrası)
  }]
}

// === KULLANIM TALİMATLARI ===
/*
1. KURULUM:
   npm install pm2 -g

2. BOT BAŞLATMA:
   cd C:\Users\Administrator\Desktop\baykus_bot
   pm2 start ecosystem.config.js

3. DURUM KONTROL:
   pm2 status
   pm2 logs baykus-bot
   pm2 monit

4. RESTART/STOP:
   pm2 restart baykus-bot
   pm2 stop baykus-bot
   pm2 delete baykus-bot

5. OTOMATİK BAŞLATMA (Windows başlangıcında):
   pm2 startup
   pm2 save

6. LOG TEMİZLİĞİ:
   pm2 flush baykus-bot

7. MONİTORİNG:
   pm2 plus  (web tabanlı monitoring)

8. HATA AYIKLAMA:
   pm2 logs baykus-bot --err
   pm2 describe baykus-bot

9. GÜNCELLEME SONRASI:
   pm2 reload baykus-bot  (zero-downtime restart)

10. ACİL DURUM:
    pm2 kill  (tüm PM2 processleri durdur)
    pm2 resurrect  (son kaydedilen state'i geri yükle)
*/