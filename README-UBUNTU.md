# BilgeBaykuş — Ubuntu Kurulum Rehberi

Repo: [github.com/thetuncay/GardiyanBaykus](https://github.com/thetuncay/GardiyanBaykus)

## Hızlı kurulum

```bash
git clone https://github.com/thetuncay/GardiyanBaykus.git gardiyanbot
cd gardiyanbot
chmod +x scripts/ubuntu-install.sh
./scripts/ubuntu-install.sh
nano .env
npm run deploy
npm run pm2:start
```

## Ortam değişkenleri (.env)

| Değişken | Açıklama |
|----------|----------|
| `DISCORD_TOKEN` | Bot token |
| `DISCORD_CLIENT_ID` | Uygulama ID |
| `MONGODB_URI` | Atlas: `...mongodb.net/baykusbot?retryWrites=true&w=majority` |
| `REDIS_URL` | `redis://localhost:6379` |
| `BOT_OWNER_ID` | Sahip Discord kullanıcı ID |
| `SEED_GUILD_IDS` | İlk kurulumda otomatik izin verilecek sunucu ID'leri |
| `PORT` | Uptime sunucusu (varsayılan: 3000) |

## PM2

```bash
npm run pm2:start
pm2 logs bilgebaykus
pm2 startup systemd -u $USER --hp $HOME
pm2 save
```

## MongoDB Atlas

VPS IP'sini Atlas → **Network Access** → **Add IP Address** ile ekleyin.
URI'de veritabanı adı olmalı: `/baykusbot`

Sunucudan test:

```bash
curl -4 ifconfig.me
mongosh "mongodb+srv://cluster.mongodb.net/baykusbot" --username YOUR_USER
```

## Windows'tan taşırken

```bash
rm -rf node_modules
npm ci
npm run build
pm2 restart bilgebaykus
```
