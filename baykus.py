# Baykuş Botu - Discord Botu
import os
import json
import re
import asyncio
import io
from datetime import datetime, timedelta
import discord
from discord import Intents, app_commands
from discord.ext import commands
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import sys

# UTF-8 desteği
sys.stdout.reconfigure(encoding="utf-8")


# Yapılandırma dosyasını yükle
def load_config():
    try:
        pass  # TODO: Add your logic here
    except Exception as e:
        print(f"An error occurred: {e}")
        pass
    except Exception as e:
        print(f"An error occurred: {e}")
        pass  # TODO: Add your logic here
    except Exception as e:
        print(f"An error occurred: {e}")
        pass
    except Exception as e:
        print(f"An error occurred: {e}")
        with open("config.json", "r") as f:
            config = json.load(f)
            required_keys = [
                "guild_id",
                "log_kanali_id",
                "hata_kanali_id",
                "baykus_rolu",
            ]
            for key in required_keys:
                if not config.get(key):
                    print(f"[Hata] config.json'da {key} eksik!")
            return config
    except FileNotFoundError:
        print("[Hata] config.json bulunamadı!")
        return {}
    except Exception as e:
        print(f"Exception occurred: {e}")
        return {}


# Token ve yetkili kullanıcılar
config = load_config()
TOKEN = config.get("token") or os.getenv("DISCORD_TOKEN")
if not TOKEN:
    raise ValueError(
        "Token bulunamadı! config.json'a 'token' ekleyin veya ortam değişkeni tanımlayın."
    )
YETKILIER = config.get(
    "yetkililer", [
        "1110219662509224006", "220545025283588096"])
SUPER_YETKILI = config.get("super_yetkili", "220545025283588096")

# Emojiler
EMOJI_BAYKUS = "🦉"
EMOJI_PARA = "🪙"
EMOJI_LEVEL = "📊"
EMOJI_VIDEO = "🎬"
EMOJI_TICKET = "🎫"
EMOJI_WARNING = "⚠️"
EMOJI_ERROR = "❌"
EMOJI_SUCCESS = "✅"
EMOJI_MONEY_BAG = "💰"
EMOJI_CHART = "📈"
EMOJI_HOOT = "🦉📢"
EMOJI_NEST = "🏠"
EMOJI_FOREST = "🌲"
EMOJI_BRANCH = "🌿"
EMOJI_MOON = "🌙"
EMOJI_STAR = "⭐"
EMOJI_TREE = "🌳"
EMOJI_OWL_EYES = "👁️🦉"
EMOJI_FEATHER = "🪶"
EMOJI_TRASH = "🗑️"
EMOJI_CLOCK = "⏰"
EMOJI_EYES = "👀"
EMOJI_PENCIL = "✏️"
EMOJI_BELL = "🔔"

# Intents ayarları
intents = Intents.default()
intents.messages = True
intents.message_content = True
intents.guilds = True
intents.members = True
bot = commands.Bot(command_prefix="!", intents=intents)
tree = bot.tree


# Veritabanı işlemleri
def load_video_data():
    try:
        with open("database.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"baykuslar": []}


async def save_video_data(data):
    async with video_lock:
        with open("database.json", "w") as f:
            json.dump(data, f, indent=2)


def load_warning_data():
    try:
        with open("uyari_database.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"baykuslar": []}


async def save_warning_data(data):
    async with warning_lock:
        with open("uyari_database.json", "w") as f:
            json.dump(data, f, indent=2)


def load_economy_data():
    """Ekonomi veritabanını yükler"""
    try:
        with open("ekonomi_database.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"baykuslar": []}


async def save_economy_data(data):
    """Ekonomi veritabanını kaydeder"""
    async with economy_lock:
        with open("ekonomi_database.json", "w") as f:
            json.dump(data, f, indent=2)


def initialize_databases():
    """Tüm veritabanlarını oluşturur"""
    # Database.json oluştur
    if not os.path.exists("database.json"):
        with open("database.json", "w") as f:
            json.dump({"baykuslar": []}, f, indent=2)

    # Ticket_database.json oluştur
    if not os.path.exists("ticket_database.json"):
        with open("ticket_database.json", "w") as f:
            json.dump({"tickets": [], "ticket_counter": 1000}, f, indent=2)

    # Uyari_database.json oluştur ve eksik alanları ekle
    if not os.path.exists("uyari_database.json"):
        with open("uyari_database.json", "w") as f:
            json.dump({"baykuslar": []}, f, indent=2)
    else:
        # Mevcut veritabanındaki baykuşlara eksik alanları ekle
        warning_data = load_warning_data()
        for baykus in warning_data["baykuslar"]:
            baykus.setdefault("manuel_uyarilar", [])
            baykus.setdefault("tekrar_uyari_saat", 24)
            baykus.setdefault("son_tekrar_uyari", None)
            baykus.setdefault("bildirim_sayisi", 0)
            baykus.setdefault("bildirim_tarihleri", [])
            baykus.setdefault("uyari_sayisi", 0)
            baykus.setdefault("uyari_tarihleri", [])
            baykus.setdefault(
                "ekleme_tarihi", datetime.now().strftime("%Y-%m-%d %H:%M")
            )
            baykus.setdefault("hic_video_yok_uyari", False)

        # Senkron kaydet (async fonksiyon değil)
        with open("uyari_database.json", "w") as f:
            json.dump(warning_data, f, indent=2)

    # Ekonomi database oluştur
    if not os.path.exists("ekonomi_database.json"):
        with open("ekonomi_database.json", "w") as f:
            json.dump({"baykuslar": []}, f, indent=2)

    # Config.json oluştur
    if not os.path.exists("config.json"):
        with open("config.json", "w") as f:
            json.dump({"token": "",
                       "guild_id": "",
                       "log_kanali_id": "",
                       "hata_kanali_id": "",
                       "baykus_rolu": "Baykuş",
                       "uyari_suresi": 2,
                       "bildirim_suresi": 24,
                       "ticket_kategori_id": "",
                       "ticket_arsiv_kategori_id": "",
                       "ticket_yetkili_rol_id": "",
                       "video_basina_odeme": 5,
                       "gunluk_max_video": 10,
                       "yetkililer": ["1110219662509224006",
                                        "220545025283588096"],
                       "super_yetkili": "220545025283588096",
                       },
                      f,
                      indent=2,
                      )
        print(
            "[Uyarı] config.json oluşturuldu! Lütfen token ve diğer bilgileri ekleyin."
        )


# Veritabanlarını başlat
initialize_databases()


# Eşzamanlılık için kilitler
video_lock = asyncio.Lock()
warning_lock = asyncio.Lock()
economy_lock = asyncio.Lock()
ticket_lock = asyncio.Lock()


# URL'nin geçerli olup olmadığını kontrol eden fonksiyon
def is_valid_url(url: str) -> bool:
    url = url.strip().lower()
    youtube_patterns = [
        r"(https?://)?(www\.)?youtube\.com/watch\?v=[\w-]+",
        r"(https?://)?(www\.)?youtube\.com/shorts/[\w-]+",
        r"(https?://)?youtu\.be/[\w-]+",
        r"(https?://)?(www\.)?youtube\.com/embed/[\w-]+",
        r"(https?://)?music\.youtube\.com/watch\?v=[\w-]+",
        r"(https?://)?m\.youtube\.com/watch\?v=[\w-]+",
    ]
    tiktok_patterns = [
        r"(https?://)?(www\.)?tiktok\.com/@[^/]+/video/\d+",
        r"(https?://)?(www\.)?tiktok\.com/[^/@]+/video/\d+",
        r"(https?://)?vm\.tiktok\.com/[\w\-]+",
        r"(https?://)?vt\.tiktok\.com/[\w\-]+",
        r"(https?://)?(www\.)?tiktok\.com/t/[\w\-]+",
    ]
    instagram_patterns = [
        r"(https?://)?(www\.)?instagram\.com/p/[\w-]+",
        r"(https?://)?(www\.)?instagram\.com/reel/[\w-]+",
        r"(https?://)?(www\.)?instagram\.com/reels/[\w-]+",
        r"(https?://)?(www\.)?instagram\.com/tv/[\w-]+",
        r"(https?://)?(www\.)?instagram\.com/[\w-]+/reel/[\w-]+",
    ]
    all_patterns = youtube_patterns + tiktok_patterns + instagram_patterns
    for pattern in all_patterns:
        if re.search(pattern, url):
            return True
    return False


# Yetkili kontrolü
def is_yetkili():
    async def predicate(interaction: discord.Interaction) -> bool:
        return str(interaction.user.id) in YETKILIER

    return app_commands.check(predicate)


def is_super_yetkili():
    async def predicate(interaction: discord.Interaction) -> bool:
        return str(interaction.user.id) == SUPER_YETKILI

    return app_commands.check(predicate)


# Log ve hata gönderme fonksiyonları
async def log_gonder(mesaj: str):
    config = load_config()
    kanal_id = config.get("log_kanali_id")
    if not kanal_id:
        print("[Hata] config.json'da log_kanali_id eksik!")
        return
    try:
        kanal = await bot.fetch_channel(int(kanal_id))
        if kanal:
            zaman = datetime.now().strftime("%Y-%m-%d %H:%M")
            embed = discord.Embed(
                title=f"{EMOJI_BAYKUS} Baykuş Log",
                description=mesaj,
                color=0x8B4513,
                timestamp=datetime.now(),
            )
            embed.set_footer(text=f"BaykuşBot • {zaman}")
            await kanal.send(embed=embed)
            print(f"Log gönderildi: {mesaj}")
        else:
            print(f"[Hata] Log kanalı bulunamadı (ID: {kanal_id})")
    except discord.errors.Forbidden:
        print(f"[Hata] Log kanalına yazma izni yok (ID: {kanal_id})")
    except discord.errors.HTTPException as e:
        print(f"[Hata] Log kanalına mesaj gönderilemedi: {e}")
    except Exception as e:
        print(f"[KRİTİK HATA] Log kanalına yazılamadı: {e}")


async def log_hata(mesaj: str):
    config = load_config()
    kanal_id = config.get("hata_kanali_id")
    if not kanal_id:
        print("[Hata] config.json'da hata_kanali_id eksik!")
        return
    try:
        kanal = await bot.fetch_channel(int(kanal_id))
        if kanal:
            zaman = datetime.now().strftime("%Y-%m-%d %H:%M")
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Baykuş Hatası",
                description=mesaj,
                color=discord.Color.red(),
                timestamp=datetime.now(),
            )
            embed.set_footer(text=f"BaykuşBot • {zaman}")
            await kanal.send(embed=embed)
            print(f"Hata loglandı: {mesaj}")
        else:
            print(f"[Hata] Hata kanalı bulunamadı (ID: {kanal_id})")
    except discord.errors.Forbidden:
        print(f"[Hata] Hata kanalına yazma izni yok (ID: {kanal_id})")
    except discord.errors.HTTPException as e:
        print(f"[Hata] Hata kanalına mesaj gönderilemedi: {e}")
    except Exception as e:
        print(f"[KRİTİK HATA] Hata kanalına yazılamadı: {e}")


# Ticket veritabanı işlemleri
def load_ticket_data():
    try:
        with open("ticket_database.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"tickets": [], "ticket_counter": 1000}


async def save_ticket_data(data):
    with open("ticket_database.json", "w") as f:
        json.dump(data, f, indent=2)


# Komut hatası yönetimi
@tree.error
async def on_command_error(
    interaction: discord.Interaction, error: app_commands.AppCommandError
):
    if isinstance(error, app_commands.CheckFailure):
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Yetki Yok",
            description="Bu komutu kullanmak için yetkiniz yok!",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        for yetkili_id in YETKILIER:
            try:
                yetkili = await bot.fetch_user(int(yetkili_id))
                yetkili_embed = discord.Embed(
                    title=f"{EMOJI_WARNING} Yetkisiz Komut Kullanımı",
                    description=(
                        f"Kullanıcı: {interaction.user.name}#{interaction.user.discriminator}\n"
                        f"ID: {interaction.user.id}\n"
                        f"Komut: /{interaction.command.name}\n"
                        f"Tarih: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
                    ),
                    color=discord.Color.orange(),
                    timestamp=datetime.now(),
                )
                await yetkili.send(embed=yetkili_embed)
                print(f"Yetkiliye bildirim gönderildi: {yetkili_id}")
            except Exception as e:
                print(
                    f"Yetkiliye bildirim gönderilemedi (ID: {yetkili_id}): {e}")
    else:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Komut Hatası",
            description=f"Bir hata oluştu: {str(error)}",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        print(f"Komut hatası: {str(error)}")
        await log_hata(
            f"Komut hatası - Kullanıcı: {interaction.user.name}, Hata: {str(error)}"
        )


# Ticket Modal (Form)
class TicketModal(
        discord.ui.Modal,
        title=f"{EMOJI_TICKET} Destek Talebi Oluştur"):
    discord_isim = discord.ui.TextInput(
        label="Discord İsmin",
        placeholder="Örnek: KullanıcıAdı",
        required=True,
        max_length=100,
    )

    sorun = discord.ui.TextInput(
        label="Yaşadığın Sorun",
        placeholder="Yaşadığın sorunu detaylı bir şekilde açıkla...",
        style=discord.TextStyle.paragraph,
        required=True,
        max_length=1024,
    )

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=False)

        try:
            config = load_config()
            guild_id = config.get("guild_id")
            ticket_kategori_id = config.get("ticket_kategori_id")
            ticket_yetkili_rol_id = config.get("ticket_yetkili_rol_id")

            if not guild_id or not ticket_kategori_id:
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Sistem Hatası",
                    description="Ticket sistemi yapılandırılmamış! Lütfen yetkililerle iletişime geçin.",
                    color=discord.Color.red(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
                await log_hata(
                    "Ticket sistemi yapılandırma hatası - guild_id veya ticket_kategori_id eksik"
                )
                return

            guild = bot.get_guild(int(guild_id))
            if not guild:
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Sunucu Bulunamadı",
                    description="Sunucu bulunamadı!",
                    color=discord.Color.red(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
                return

            kategori = guild.get_channel(int(ticket_kategori_id))
            if not kategori or not isinstance(
                    kategori, discord.CategoryChannel):
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Kategori Bulunamadı",
                    description="Ticket kategorisi bulunamadı!",
                    color=discord.Color.red(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
                await log_hata(
                    f"Ticket kategorisi bulunamadı - ID: {ticket_kategori_id}"
                )
                return

            # Ticket numarası al
            async with ticket_lock:
                ticket_data = load_ticket_data()
                ticket_no = ticket_data["ticket_counter"]
                ticket_data["ticket_counter"] += 1

            # Kanal oluştur
            overwrites = {
                guild.default_role: discord.PermissionOverwrite(read_messages=False),
                interaction.user: discord.PermissionOverwrite(
                    read_messages=True, send_messages=True
                ),
                guild.me: discord.PermissionOverwrite(
                    read_messages=True, send_messages=True, manage_channels=True
                ),
            }

            # Yetkili rolü varsa ekle
            if ticket_yetkili_rol_id:
                yetkili_rol = guild.get_role(int(ticket_yetkili_rol_id))
                if yetkili_rol:
                    overwrites[yetkili_rol] = discord.PermissionOverwrite(
                        read_messages=True, send_messages=True
                    )

            kanal = await kategori.create_text_channel(
                name=f"baykus-ticket-{ticket_no}",
                overwrites=overwrites,
                topic=f"Ticket #{ticket_no} - {interaction.user.name} | Discord İsim: {self.discord_isim.value}",
            )

            # Ticket verisini kaydet
            ticket_data["tickets"].append(
                {
                    "ticket_id": ticket_no,
                    "user_id": str(interaction.user.id),
                    "username": interaction.user.name,
                    "discord_isim": self.discord_isim.value,
                    "sorun": self.sorun.value,
                    "kanal_id": str(kanal.id),
                    "acilis_tarihi": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "durum": "acik",
                    "kapatan": None,
                    "kapanis_tarihi": None,
                    "kapanis_sebebi": None,
                }
            )
            await save_ticket_data(ticket_data)

            # Kanal açılış mesajı
            embed = discord.Embed(
                title=f"{EMOJI_TICKET} Baykuş Ticket #{ticket_no}",
                description=f"{
                    interaction.user.mention} destek talebini oluşturdu!",
                color=0x8B4513,
                timestamp=datetime.now(),
            )
            embed.add_field(
                name=f"{EMOJI_BAYKUS} Discord İsim",
                value=self.discord_isim.value,
                inline=False,
            )
            embed.add_field(
                name=f"{EMOJI_WARNING} Sorun",
                value=self.sorun.value,
                inline=False)
            embed.add_field(
                name=f"{EMOJI_MOON} Açılış Tarihi",
                value=datetime.now().strftime("%d.%m.%Y %H:%M"),
                inline=False,
            )
            embed.set_footer(text="BaykuşBot Ticket Sistemi")

            # Butonlar
            view = TicketButtonView(ticket_no, interaction.user.id)
            ticket_msg = await kanal.send(
                content=f"{interaction.user.mention} "
                + (f"<@&{ticket_yetkili_rol_id}>" if ticket_yetkili_rol_id else ""),
                embed=embed,
                view=view,
            )

            # Mesajı sabitle
            try:
                await ticket_msg.pin()
            except BaseException:
                pass

            # Kullanıcıya DM gönder
            try:
                dm_embed = discord.Embed(
                    title=f"{EMOJI_SUCCESS} Ticket Oluşturuldu!",
                    description=(
                        f"Destek talebin başarıyla oluşturuldu.\n\n"
                        f"**Ticket Numarası:** #{ticket_no}\n"
                        f"**Kanal:** {kanal.mention}\n\n"
                        f"Yetkililerin sana yardımcı olması için lütfen kanalı takip et!"
                    ),
                    color=discord.Color.green(),
                    timestamp=datetime.now(),
                )
                dm_embed.set_footer(text="BaykuşBot Ticket Sistemi")
                await interaction.user.send(embed=dm_embed)
            except discord.errors.Forbidden:
                await log_gonder(
                    f"Ticket DM'i gönderilemedi (DM'ler kapalı) - Kullanıcı: {interaction.user.name}, Ticket: #{ticket_no}"
                )

            success_embed = discord.Embed(
                title=f"{EMOJI_SUCCESS} Ticket Oluşturuldu!",
                description=f"Ticket oluşturuldu! {
                    kanal.mention} kanalını kontrol et.",
                color=discord.Color.green(),
            )
            await interaction.followup.send(embed=success_embed, ephemeral=False)
            await log_gonder(
                f"Ticket oluşturuldu - Kullanıcı: {interaction.user.name}, ID: {interaction.user.id}, Ticket: #{ticket_no}"
            )

        except Exception as e:
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Hata Oluştu",
                description="Ticket oluşturulurken bir hata oluştu!",
                color=discord.Color.red(),
            )
            await interaction.followup.send(embed=embed, ephemeral=False)
            await log_hata(
                f"Ticket oluşturma hatası - Kullanıcı: {interaction.user.name}, Hata: {e}"
            )


# Ticket Butonları
class TicketButtonView(discord.ui.View):
    def __init__(self, ticket_no, user_id):
        super().__init__(timeout=None)
        self.ticket_no = ticket_no
        self.user_id = user_id

    @discord.ui.button(label="🔒 Kapat",
                       style=discord.ButtonStyle.red,
                       emoji=EMOJI_BAYKUS)
    async def close_ticket(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        await self.kapat_ticket(interaction, sebep=None)

    @discord.ui.button(label="📝 Sebep Vererek Kapat",
                       style=discord.ButtonStyle.secondary,
                       emoji=EMOJI_FEATHER)
    async def close_with_reason(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        modal = TicketCloseModal(self.ticket_no, self.user_id)
        await interaction.response.send_modal(modal)

    async def kapat_ticket(self, interaction: discord.Interaction, sebep=None):
        try:
            config = load_config()
            ticket_arsiv_kategori_id = config.get("ticket_arsiv_kategori_id")

            if not ticket_arsiv_kategori_id:
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Sistem Hatası",
                    description="Arşiv kategorisi yapılandırılmamış!",
                    color=discord.Color.red(),
                )
                await interaction.response.send_message(embed=embed, ephemeral=False)
                return

            guild = interaction.guild
            arsiv_kategori = guild.get_channel(int(ticket_arsiv_kategori_id))

            if not arsiv_kategori or not isinstance(
                arsiv_kategori, discord.CategoryChannel
            ):
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Kategori Bulunamadı",
                    description="Arşiv kategorisi bulunamadı!",
                    color=discord.Color.red(),
                )
                await interaction.response.send_message(embed=embed, ephemeral=False)
                return

            # Ticket verisini güncelle
            async with ticket_lock:
                ticket_data = load_ticket_data()
                ticket = next(
                    (
                        t
                        for t in ticket_data["tickets"]
                        if t["ticket_id"] == self.ticket_no
                    ),
                    None,
                )

                if ticket:
                    ticket["durum"] = "kapali"
                    ticket["kapatan"] = str(interaction.user.id)
                    ticket["kapatan_username"] = interaction.user.name
                    ticket["kapanis_tarihi"] = datetime.now().strftime(
                        "%Y-%m-%d %H:%M")
                    ticket["kapanis_sebebi"] = sebep or "Sebep belirtilmedi"
                    await save_ticket_data(ticket_data)

            # Kapatma mesajı gönder
            if not interaction.response.is_done():
                await interaction.response.defer()

            embed = discord.Embed(
                title=f"{EMOJI_BAYKUS} Ticket Kapatıldı",
                description=f"Bu ticket **{interaction.user.mention}** tarafından kapatıldı.",
                color=discord.Color.red(),
                timestamp=datetime.now(),
            )
            embed.add_field(
                name=f"{EMOJI_TICKET} Ticket ID", value=f"#{
                    self.ticket_no}", inline=True)
            embed.add_field(
                name=f"{EMOJI_BAYKUS} Kapatan",
                value=interaction.user.mention,
                inline=True,
            )
            embed.add_field(
                name=f"{EMOJI_FEATHER} Sebep",
                value=sebep or "Sebep belirtilmedi",
                inline=False,
            )
            embed.add_field(
                name=f"{EMOJI_MOON} Kapatılma Tarihi",
                value=datetime.now().strftime("%d.%m.%Y %H:%M"),
                inline=False,
            )
            embed.set_footer(text="BaykuşBot Ticket Sistemi")

            await interaction.channel.send(embed=embed)

            # Kullanıcıya DM gönder
            try:
                user = await bot.fetch_user(int(self.user_id))
                dm_embed = discord.Embed(
                    title=f"{EMOJI_BAYKUS} Ticket Kapatıldı",
                    description=f"**Ticket #{self.ticket_no}** kapatıldı.",
                    color=discord.Color.red(),
                    timestamp=datetime.now(),
                )
                dm_embed.add_field(
                    name=f"{EMOJI_BAYKUS} Kapatan",
                    value=interaction.user.name,
                    inline=True,
                )
                dm_embed.add_field(
                    name=f"{EMOJI_FEATHER} Sebep",
                    value=sebep or "Sebep belirtilmedi",
                    inline=False,
                )
                dm_embed.add_field(
                    name=f"{EMOJI_MOON} Kapatılma Tarihi",
                    value=datetime.now().strftime("%d.%m.%Y %H:%M"),
                    inline=False,
                )
                dm_embed.set_footer(text="BaykuşBot Ticket Sistemi")
                await user.send(embed=dm_embed)
            except discord.errors.Forbidden:
                await log_gonder(
                    f"Ticket kapanış DM'i gönderilemedi (DM'ler kapalı) - Kullanıcı ID: {self.user_id}, Ticket: #{self.ticket_no}"
                )

            # Kanalı arşive taşı
            await asyncio.sleep(5)
            await interaction.channel.edit(
                category=arsiv_kategori,
                name=f"kapalı-baykus-ticket-{self.ticket_no}",
                sync_permissions=True,
            )

            await log_gonder(
                f"Ticket kapatıldı - Ticket: #{self.ticket_no}, Kapatan: {interaction.user.name}, Sebep: {sebep or 'Yok'}"
            )

        except Exception as e:
            try:
                if not interaction.response.is_done():
                    embed = discord.Embed(
                        title=f"{EMOJI_ERROR} Hata Oluştu",
                        description="Ticket kapatılırken hata oluştu!",
                        color=discord.Color.red(),
                    )
                    await interaction.response.send_message(embed=embed, ephemeral=False)
                else:
                    embed = discord.Embed(
                        title=f"{EMOJI_ERROR} Hata Oluştu",
                        description="Ticket kapatılırken hata oluştu!",
                        color=discord.Color.red(),
                    )
                    await interaction.followup.send(embed=embed, ephemeral=False)
            except BaseException:
                pass
            await log_hata(
                f"Ticket kapatma hatası - Ticket: #{self.ticket_no}, Hata: {e}"
            )


# Sebep verme Modal'ı
class TicketCloseModal(
        discord.ui.Modal,
        title=f"{EMOJI_FEATHER} Kapatma Sebebi"):
    sebep = discord.ui.TextInput(
        label="Ticket'ı Neden Kapatıyorsun?",
        placeholder="Ticket'ın kapatılma sebebini açıkla...",
        style=discord.TextStyle.paragraph,
        required=True,
        max_length=500,
    )

    def __init__(self, ticket_no, user_id):
        super().__init__()
        self.ticket_no = ticket_no
        self.user_id = user_id

    async def on_submit(self, interaction: discord.Interaction):
        view = TicketButtonView(self.ticket_no, self.user_id)
        await view.kapat_ticket(interaction, sebep=self.sebep.value)


# Yanlış link için uyarı ve temizleme
async def handle_invalid_link(message, reason):
    user = message.author
    channel = message.channel

    uyari_mesaji = discord.Embed(
        title=f"{EMOJI_WARNING} **Geçersiz Link Gönderimi!** {EMOJI_WARNING}",
        description=(
            f"**Lütfen video linkleri gönderirken şu kurallara dikkat et:**\n\n"
            f"{EMOJI_STAR} **Linki yalnızca link olarak gönder, yazı yazma!**\n"
            f"{EMOJI_STAR} **Önceden gönderdiğin ya da başka birinin gönderdiği linki tekrardan atma!**\n\n"
            f"**Sebep:** {reason}\n\n"
            f"{EMOJI_TREE}---Kurallara uymazsan rolun alınır---"
        ),
        color=0x8B4513,
    )
    try:
        await user.send(embed=uyari_mesaji)
    except discord.errors.Forbidden:
        print(f"DM gönderilemedi: {user.name} DM'leri kapalı.")
        await log_gonder(
            f"DM gönderilemedi (DM'ler kapalı) - Kullanıcı: {user.name}, ID: {user.id}"
        )

    await message.delete()

    uyari_mesaji_channel = f"{
        user.mention} geçersiz link gönderdin, DM kutuna bak! {EMOJI_OWL_EYES}"
    sent_message = await channel.send(uyari_mesaji_channel)
    await asyncio.sleep(5)
    await sent_message.delete()


@bot.event
async def on_ready():
    import platform
    import time
    import shutil
    import sys
    import subprocess
    from datetime import datetime
    from importlib import metadata

    print(
        f"{EMOJI_BAYKUS} {
            bot.user.name} olarak giriş yapıldı! (ID: {
            bot.user.id})")
    print(f"{EMOJI_BAYKUS} Komutlar senkronize ediliyor...")
    print("--------------------------------------------------")

    try:
        synced = await tree.sync()
        print(f"{EMOJI_SUCCESS} {len(synced)} komut senkronize edildi.")
    except Exception as e:
        print(f"{EMOJI_ERROR} Komut senkronizasyon hatası: {e}")

    try:
        import psutil
    except ImportError:
        psutil = None

    config = load_config()
    if not config.get("log_kanali_id"):
        print(f"{EMOJI_ERROR} config.json'da log_kanali_id eksik!")
        return

    try:
        kanal = await bot.fetch_channel(int(config["log_kanali_id"]))
    except Exception as e:
        print(f"Log kanalı erişim hatası: {e}")
        await log_hata(f"Log kanalı erişim hatası: {e}")
        return

    # Sistem bilgileri
    os_info = f"{
        platform.system()} {
        platform.release()} ({
            platform.machine()})"
    python_ver = platform.python_version()
    discord_ver = getattr(discord, "__version__", "bilinmiyor")
    cpu_name = platform.processor() or "Bilinmiyor"
    bot_name = bot.user.name
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Kaynak kullanımı
    if psutil:
        cpu_use = psutil.cpu_percent()
        ram_use = psutil.virtual_memory().percent
        total_ram = psutil.virtual_memory().total / (1024**3)
        disk = shutil.disk_usage(".")
        disk_use = disk.used / (1024**3)
        disk_total = disk.total / (1024**3)
        uptime_sec = time.time() - psutil.boot_time()
        uptime = time.strftime("%H:%M:%S", time.gmtime(uptime_sec))
    else:
        cpu_use = ram_use = total_ram = disk_use = disk_total = uptime = "Bilinmiyor"

    # Bot bilgileri
    guilds = len(bot.guilds)
    users = len(bot.users)
    commands = len(tree.get_commands())
    latency = round(bot.latency * 1000, 2) if hasattr(bot, "latency") else "?"
    cogs = ", ".join(bot.cogs.keys()) if bot.cogs else "Yüklenmemiş"
    developer = "thetuncay"

    # Embed oluştur
    embed = discord.Embed(
        title=f"{EMOJI_BAYKUS} BaykuşBot Başlatıldı!",
        description=f"`{bot_name}` ormandaki yerini aldı ve aktif durumda! {EMOJI_HOOT}",
        color=0x8B4513,
        timestamp=datetime.now(
            datetime.UTC),
    )
    embed.set_author(
        name=bot.user.name,
        icon_url=bot.user.avatar.url if bot.user.avatar else discord.Embed.Empty,
    )
    embed.set_thumbnail(
        url=bot.user.avatar.url if bot.user.avatar else discord.Embed.Empty
    )

    embed.add_field(
        name=f"{EMOJI_NEST} Orman Bilgileri",
        value=(
            f"{EMOJI_BAYKUS} **Bot ID:** `{bot.user.id}`\n"
            f"{EMOJI_TREE} **Ağaçlar (Sunucular):** `{guilds}`\n"
            f"{EMOJI_OWL_EYES} **Gözlemciler (Kullanıcılar):** `{users}`\n"
            f"{EMOJI_FEATHER} **Komutlar:** `{commands}`\n"
            f"{EMOJI_BRANCH} **Cogs:** `{cogs}`\n"
            f"{EMOJI_MOON} **Ping:** `{latency} ms`"
        ),
        inline=False,
    )

    embed.add_field(
        name=f"{EMOJI_FOREST} Sistem Bilgileri",
        value=(
            f"{EMOJI_TREE} **İşletim Sistemi:** `{os_info}`\n"
            f"{EMOJI_STAR} **CPU:** `{cpu_name}` (`%{cpu_use}`)\n"
            f"{EMOJI_OWL_EYES} **RAM:** `{ram_use}%` ({total_ram:.2f} GB toplam)\n"
            f"{EMOJI_NEST} **Disk:** `{disk_use:.1f} / {disk_total:.1f} GB`\n"
            f"{EMOJI_MOON} **Sistem Uptime:** `{uptime}`"
        ),
        inline=False,
    )

    embed.add_field(
        name=f"{EMOJI_BRANCH} Yazılım Bilgileri",
        value=(
            f"{EMOJI_PARA} **Python:** `{python_ver}`\n"
            f"{EMOJI_FEATHER} **discord.py:** `{discord_ver}`\n"
            f"{EMOJI_BAYKUS} **Geliştirici:** `{developer}`"
        ),
        inline=False,
    )

    embed.set_footer(text=f"BaykuşBot Ormanı • {now}")

    # Log gönderimi
    await kanal.send(embed=embed)
    await log_gonder(f"`{bot_name}` ormanda aktif! ({now})")

    # Bot durumunu ayarla
    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.watching,
            name=f"{users} baykuşu gözetliyor {EMOJI_OWL_EYES}",
        )
    )


@bot.event
async def on_message(message):
    if (
        message.guild is None
        or message.author.bot
        or message.channel.name != "video-paylaşımları"
    ):
        return

    user_id = str(message.author.id)
    try:
        content = message.content.strip()
        username = message.author.name

        # ÖNCE: Linkin geçerli olup olmadığını kontrol et
        if not is_valid_url(content):
            await log_gonder(
                f"Geçersiz video linki - Kullanıcı: {username}, ID: {user_id}, Link: {content}"
            )
            await handle_invalid_link(
                message,
                "Geçersiz video linki (sadece YouTube, TikTok veya Instagram Reels/gönderi linkleri kabul edilir)",
            )
            return

        # YENİ: AYNI LINK DAHA ÖNCE ATILMIŞ MI KONTROL ET
        video_data = load_video_data()
        warning_data = load_warning_data()

        # Kullanıcının tüm videolarını kontrol et
        video_baykus = next(
            (b for b in video_data["baykuslar"] if b["id"] == user_id), None
        )

        if video_baykus:
            # Aynı link daha önce atılmış mı?
            for video in video_baykus.get("videolar", []):
                if video["link"] == content:
                    # Link daha önce atılmış
                    embed = discord.Embed(
                        title=f"{EMOJI_WARNING} Bu Link Zaten Kayıtlı!",
                        description=(
                            f"Bu linki daha önce **{video['tarih']}** tarihinde paylaşmışsın!\n\n"
                            f"**Link:** {content[:50]}...\n"
                            f"**Önceki Paylaşım:** {video['tarih']}\n\n"
                            f"{EMOJI_BAYKUS} Lütfen farklı bir video linki paylaş!"
                        ),
                        color=discord.Color.orange(),
                    )
                    await message.reply(embed=embed, mention_author=True)
                    await log_gonder(
                        f"Tekrarlanan link - Kullanıcı: {username}, ID: {user_id}, Link: {content}, Önceki tarih: {video['tarih']}"
                    )
                    return

        # YENİ: BAŞKA KULLANICILAR DA AYNI LINKİ ATMIŞ MI KONTROL ET
        for baykus in video_data["baykuslar"]:
            for video in baykus.get("videolar", []):
                if video["link"] == content:
                    # Başka bir kullanıcı bu linki daha önce atmış
                    embed = discord.Embed(
                        title=f"{EMOJI_ERROR} Bu Link Zaten Kullanıldı!",
                        description=(
                            f"Bu link **{baykus['username']}** tarafından **{video['tarih']}** tarihinde paylaşıldı!\n\n"
                            f"**Link:** {content[:50]}...\n"
                            f"**İlk Paylaşan:** {baykus['username']}\n"
                            f"**İlk Tarih:** {video['tarih']}\n\n"
                            f"{EMOJI_BAYKUS} Lütfen farklı ve orijinal bir video linki paylaş!"
                        ),
                        color=discord.Color.red(),
                    )
                    await message.reply(embed=embed, mention_author=True)
                    await log_gonder(
                        f"Başkasının tekrarlanan linki - Kullanıcı: {username}, Önceki kullanıcı: {baykus['username']}, Link: {content}"
                    )
                    return
    except Exception as e:
        await log_gonder(
            f"on_message kontrol hatası - Kullanıcı: {username}, ID: {user_id}, Hata: {e}"
        )
    if (
        message.guild is None
        or message.author.bot
        or message.channel.name != "video-paylaşımları"
    ):
        return

    user_id = str(message.author.id)
    try:
        content = message.content
        username = message.author.name

        if is_valid_url(content):
            # Günlük video limit kontrolü
            simdi = datetime.now()
            bugun = simdi.strftime("%Y-%m-%d")

            # Video veritabanını yükle
            video_data = load_video_data()
            warning_data = load_warning_data()
            ekonomi_data = load_economy_data()

            # Baykuşu bul veya oluştur
            video_baykus = next(
                (b for b in video_data["baykuslar"] if b["id"] == user_id), None)
            if not video_baykus:
                video_baykus = {
                    "id": user_id,
                    "username": username,
                    "videolar": [],
                    "son_video_tarihi": None,
                }
                video_data["baykuslar"].append(video_baykus)

            # Bugünkü video sayısını kontrol et
            bugunku_videolar = [
                v
                for v in video_baykus.get("videolar", [])
                if v["tarih"].startswith(bugun)
            ]
            gunluk_max_video = config.get("gunluk_max_video", 10)

            if len(bugunku_videolar) >= gunluk_max_video:
                embed = discord.Embed(
                    title=f"{EMOJI_WARNING} Günlük Limit Aşıldı!",
                    description=(
                        f"Bugün zaten {gunluk_max_video} video paylaştın!\n"
                        f"Yarın tekrar deneyebilirsin. {EMOJI_MOON}"
                    ),
                    color=discord.Color.orange(),
                )
                await message.reply(embed=embed, mention_author=True)
                await log_gonder(
                    f"Günlük limit aşıldı - Kullanıcı: {username}, Bugünkü video: {len(bugunku_videolar)}"
                )
                return

            # Video kaydet
            tarih = datetime.now().strftime("%Y-%m-%d %H:%M")
            video_baykus["videolar"].append({"link": content, "tarih": tarih})
            video_baykus["son_video_tarihi"] = tarih

            # Uyarı veritabanını güncelle
            warning_baykus = next(
                (b for b in warning_data["baykuslar"] if b["id"] == user_id), None)
            if not warning_baykus:
                warning_baykus = {
                    "id": user_id,
                    "username": username,
                    "son_video_tarihi": tarih,
                    "uyari_sayisi": 0,
                    "bildirim_sayisi": 0,
                    "uyari_tarihleri": [],
                    "bildirim_tarihleri": [],
                    "tekrar_uyari_saat": 24,
                    "son_tekrar_uyari": None,
                    "manuel_uyarilar": [],
                }
                warning_data["baykuslar"].append(warning_baykus)

            warning_baykus["son_tekrar_uyari"] = None
            warning_baykus["son_video_tarihi"] = tarih

            # Ekonomi veritabanını güncelle
            ekonomi_baykus = next(
                (b for b in ekonomi_data["baykuslar"] if b["id"] == user_id), None)
            if not ekonomi_baykus:
                ekonomi_baykus = {
                    "id": user_id,
                    "username": username,
                    "bakiye": 0,
                    "toplam_kazanc": 0,
                    "level": 1,
                    "xp": 0,
                    "son_gunluk_video_tarihi": bugun,
                    "gunluk_video_sayisi": 0,
                    "video_odeme_gecmisi": [],
                }
                ekonomi_data["baykuslar"].append(ekonomi_baykus)

            # Günlük video sayısını güncelle
            if ekonomi_baykus["son_gunluk_video_tarihi"] != bugun:
                ekonomi_baykus["gunluk_video_sayisi"] = 0
                ekonomi_baykus["son_gunluk_video_tarihi"] = bugun

            ekonomi_baykus["gunluk_video_sayisi"] += 1

            # Ödeme hesapla
            video_basina_odeme = config.get("video_basina_odeme", 5)
            odeme_miktari = video_basina_odeme

            # Level bonusu
            level = ekonomi_baykus.get("level", 1)
            if level >= 2:
                # Level 2+: %10 bonus
                bonus = odeme_miktari * 0.10
                odeme_miktari += bonus

            # Günlük 10 video bonusu
            if ekonomi_baykus["gunluk_video_sayisi"] >= 10:
                tam_bonus = odeme_miktari * 0.20  # %20 bonus
                odeme_miktari += tam_bonus

            # XP hesapla
            xp_kazanci = 10  # Her video için 10 XP
            if ekonomi_baykus["gunluk_video_sayisi"] >= 5:
                xp_kazanci += 5  # 5+ video için ekstra XP
            if ekonomi_baykus["gunluk_video_sayisi"] >= 10:
                xp_kazanci += 10  # 10 video için ekstra XP

            ekonomi_baykus["xp"] += xp_kazanci

            # Level up kontrolü
            required_xp = ekonomi_baykus["level"] * 100
            if ekonomi_baykus["xp"] >= required_xp:
                ekonomi_baykus["level"] += 1
                ekonomi_baykus["xp"] = ekonomi_baykus["xp"] - required_xp
                # Level başına 50 TL bonus
                level_up_bonus = ekonomi_baykus["level"] * 50
                odeme_miktari += level_up_bonus

                # Level up mesajı
                try:
                    user = await bot.fetch_user(int(user_id))
                    level_embed = discord.Embed(
                        title=f"{EMOJI_STAR} Level Atladın! {EMOJI_STAR}",
                        description=(
                            f"Tebrikler {username}! Level {ekonomi_baykus['level'] - 1}'dan "
                            f"Level {ekonomi_baykus['level']}'a terfi ettin!\n\n"
                            f"{EMOJI_PARA} **Level Bonusu:** +{level_up_bonus} TL\n"
                            f"{EMOJI_LEVEL} **Yeni Level:** {ekonomi_baykus['level']}\n"
                            f"{EMOJI_CHART} **XP:** {ekonomi_baykus['xp']}/{ekonomi_baykus['level'] * 100}"
                        ),
                        color=discord.Color.gold(),
                    )
                    await user.send(embed=level_embed)
                except BaseException:
                    pass

            # Bakiyeyi güncelle
            ekonomi_baykus["bakiye"] += odeme_miktari
            ekonomi_baykus["toplam_kazanc"] += odeme_miktari

            # Ödeme geçmişine ekle
            ekonomi_baykus["video_odeme_gecmisi"].append(
                {
                    "tarih": tarih,
                    "video_url": content,
                    "odeme": odeme_miktari,
                    "level": ekonomi_baykus["level"],
                    "gunluk_video_sayisi": ekonomi_baykus["gunluk_video_sayisi"],
                })

            # Veritabanlarını kaydet
            await save_video_data(video_data)
            await save_warning_data(warning_data)
            await save_economy_data(ekonomi_data)

            # Yanıt embed'i
            embed = discord.Embed(
                title=f"{EMOJI_SUCCESS} Video Kaydedildi! {EMOJI_VIDEO}",
                description="Video başarıyla kaydedildi ve bakiyen güncellendi!",
                color=discord.Color.green(),
            )
            embed.add_field(
                name=f"{EMOJI_PARA} Kazanç",
                value=f"**+{odeme_miktari:.2f} TL**",
                inline=True,
            )
            embed.add_field(
                name=f"{EMOJI_LEVEL} Level",
                value=f"**{ekonomi_baykus['level']}**",
                inline=True,
            )
            embed.add_field(
                name=f"{EMOJI_CHART} XP",
                value=f"**+{xp_kazanci} XP**",
                inline=True,
            )
            embed.add_field(
                name=f"{EMOJI_VIDEO} Günlük Video",
                value=f"**{ekonomi_baykus['gunluk_video_sayisi']}/{gunluk_max_video}**",
                inline=False,
            )
            embed.add_field(
                name=f"{EMOJI_MONEY_BAG} Toplam Bakiye",
                value=f"**{ekonomi_baykus['bakiye']:.2f} TL**",
                inline=False,
            )
            embed.set_footer(text="BaykuşBot Ekonomi Sistemi")

            await message.reply(embed=embed, mention_author=True)
            await log_gonder(
                f"Video kaydedildi - Kullanıcı: {username}, ID: {user_id}, Kazanç: {odeme_miktari:.2f} TL, Level: {ekonomi_baykus['level']}"
            )

        else:
            await log_gonder(
                f"Geçersiz video linki - Kullanıcı: {username}, ID: {user_id}, Link: {content}"
            )
            await handle_invalid_link(
                message,
                "Geçersiz video linki (sadece YouTube, TikTok veya Instagram Reels/gönderi linkleri kabul edilir)",
            )

    except Exception as e:
        await log_gonder(
            f"Video kaydetme hatası - Kullanıcı: {username}, ID: {user_id}, Hata: {e}"
        )

    await bot.process_commands(message)


# ============================================
# EKONOMİ KOMUTLARI
# ============================================

@tree.command(name="kazancım",
              description="Video kazancını ve bakiyeni gösterir")
async def kazancim(interaction: discord.Interaction):
    try:
        user_id = str(interaction.user.id)
        ekonomi_data = load_economy_data()
        video_data = load_video_data()

        ekonomi_baykus = next(
            (b for b in ekonomi_data["baykuslar"] if b["id"] == user_id), None
        )
        video_baykus = next(
            (b for b in video_data["baykuslar"] if b["id"] == user_id), None
        )

        if not ekonomi_baykus:
            embed = discord.Embed(
                title=f"{EMOJI_WARNING} Kayıt Bulunamadı",
                description="Henüz bir video paylaşmadın veya kaydın bulunamadı!",
                color=discord.Color.orange(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=False)
            return

        # İstatistikleri hesapla
        config = load_config()
        video_basina_odeme = config.get("video_basina_odeme", 5)
        gunluk_max_video = config.get("gunluk_max_video", 10)

        toplam_video = len(video_baykus["videolar"]) if video_baykus else 0
        bugun = datetime.now().strftime("%Y-%m-%d")
        bugunku_videolar = (
            [
                v
                for v in video_baykus["videolar"]
                if v["tarih"].startswith(bugun)
            ]
            if video_baykus
            else []
        )
        bugun_video_sayisi = len(bugunku_videolar)

        # Gelecek level için gerekli XP
        gerekli_xp = ekonomi_baykus["level"] * 100
        xp_yuzdesi = (ekonomi_baykus["xp"] / gerekli_xp) * 100

        # Embed oluştur
        embed = discord.Embed(
            title=f"{EMOJI_MONEY_BAG} {
                interaction.user.name}'ın Baykuş Kasası {EMOJI_MONEY_BAG}",
            color=0x8B4513,
            timestamp=datetime.now(),
        )
        embed.set_thumbnail(url=interaction.user.avatar.url)

        # Ana bilgiler
        embed.add_field(
            name=f"{EMOJI_PARA} Toplam Bakiye",
            value=f"**{ekonomi_baykus['bakiye']:.2f} TL**",
            inline=True,
        )
        embed.add_field(
            name=f"{EMOJI_LEVEL} Level",
            value=f"**{ekonomi_baykus['level']}**",
            inline=True,
        )
        embed.add_field(
            name=f"{EMOJI_CHART} XP",
            value=f"**{ekonomi_baykus['xp']}/{gerekli_xp}** ({xp_yuzdesi:.1f}%)",
            inline=True,
        )

        # Video istatistikleri
        embed.add_field(
            name=f"{EMOJI_VIDEO} Toplam Video",
            value=f"**{toplam_video}**",
            inline=True,
        )
        embed.add_field(
            name=f"{EMOJI_VIDEO} Bugünkü Video",
            value=f"**{bugun_video_sayisi}/{gunluk_max_video}**",
            inline=True,
        )
        embed.add_field(
            name=f"{EMOJI_PARA} Video Başı Kazanç",
            value=f"**{video_basina_odeme} TL**",
            inline=True,
        )

        # Level bonusları
        level_bonuslari = ""
        if ekonomi_baykus["level"] >= 2:
            level_bonuslari += f"Level 2+: %10 bonus\n"
        if ekonomi_baykus["level"] >= 3:
            level_bonuslari += f"Level 3+: %15 bonus\n"
        if ekonomi_baykus["level"] >= 5:
            level_bonuslari += f"Level 5+: %25 bonus\n"

        if level_bonuslari:
            embed.add_field(
                name=f"{EMOJI_STAR} Aktif Bonuslar",
                value=level_bonuslari,
                inline=False,
            )

        # Günlük bonus
        if bugun_video_sayisi >= 10:
            embed.add_field(
                name=f"{EMOJI_SUCCESS} Günlük Bonus",
                value="10 video tamamlandı! +%20 bonus aktif!",
                inline=False,
            )
        elif bugun_video_sayisi >= 5:
            embed.add_field(
                name=f"{EMOJI_CHART} İlerleme",
                value=f"5 video tamamlandı! +5 XP bonusu aktif!",
                inline=False,
            )

        # Son video ödemesi
        if ekonomi_baykus["video_odeme_gecmisi"]:
            son_odeme = ekonomi_baykus["video_odeme_gecmisi"][-1]
            embed.add_field(
                name=f"{EMOJI_MOON} Son Video Kazancı",
                value=f"**+{son_odeme['odeme']:.2f} TL** (Level {son_odeme['level']})",
                inline=False,
            )

        embed.set_footer(text="BaykuşBot Ekonomi Sistemi • /kazancım")

        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_gonder(
            f"Kazancım komutu kullanıldı - Kullanıcı: {interaction.user.name}, ID: {user_id}, Bakiye: {ekonomi_baykus['bakiye']:.2f} TL"
        )

    except Exception as e:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Hata Oluştu",
            description="Kazanç bilgileri yüklenirken bir hata oluştu!",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_hata(f"Kazancım komutu hatası - Kullanıcı: {interaction.user.name}, Hata: {e}")


@tree.command(name="ekonomi_durum",
              description="Baykuşların ekonomi durumunu gösterir")
@is_yetkili()
async def ekonomi_durum(
        interaction: discord.Interaction,
        baykus: discord.User = None):
    try:
        if baykus:
            # Belirli bir baykuşun durumu
            user_id = str(baykus.id)
            ekonomi_data = load_economy_data()
            ekonomi_baykus = next(
                (b for b in ekonomi_data["baykuslar"] if b["id"] == user_id), None)

            if not ekonomi_baykus:
                embed = discord.Embed(
                    title=f"{EMOJI_WARNING} Kayıt Bulunamadı",
                    description=f"{
                        baykus.mention} henüz ekonomi sistemine kayıtlı değil!",
                    color=discord.Color.orange(),
                )
                await interaction.response.send_message(embed=embed, ephemeral=False)
                return

            embed = discord.Embed(
                title=f"{EMOJI_CHART} {baykus.name} Ekonomi Durumu",
                color=0x8B4513,
                timestamp=datetime.now(),
            )
            embed.set_thumbnail(url=baykus.avatar.url)

            embed.add_field(
                name=f"{EMOJI_PARA} Bakiye",
                value=f"**{ekonomi_baykus['bakiye']:.2f} TL**",
                inline=True,
            )
            embed.add_field(
                name=f"{EMOJI_LEVEL} Level",
                value=f"**{ekonomi_baykus['level']}**",
                inline=True,
            )
            embed.add_field(
                name=f"{EMOJI_CHART} XP",
                value=f"**{ekonomi_baykus['xp']}/{ekonomi_baykus['level'] * 100}**",
                inline=True,
            )
            embed.add_field(
                name=f"{EMOJI_MONEY_BAG} Toplam Kazanç",
                value=f"**{ekonomi_baykus['toplam_kazanc']:.2f} TL**",
                inline=True,
            )
            embed.add_field(
                name=f"{EMOJI_VIDEO} Günlük Video",
                value=f"**{ekonomi_baykus['gunluk_video_sayisi']}**",
                inline=True,
            )
            embed.add_field(
                name=f"{EMOJI_MOON} Son Güncelleme",
                value=f"**{ekonomi_baykus['son_gunluk_video_tarihi']}**",
                inline=True,
            )

            await interaction.response.send_message(embed=embed, ephemeral=False)

        else:
            # Tüm baykuşların durumu
            ekonomi_data = load_economy_data()
            if not ekonomi_data["baykuslar"]:
                embed = discord.Embed(
                    title=f"{EMOJI_WARNING} Kayıt Yok",
                    description="Henüz ekonomi sistemine kayıtlı baykuş yok!",
                    color=discord.Color.orange(),
                )
                await interaction.response.send_message(embed=embed, ephemeral=False)
                return

            # İstatistikleri hesapla
            toplam_bakiye = sum(b["bakiye"] for b in ekonomi_data["baykuslar"])
            toplam_kazanc = sum(b["toplam_kazanc"]
                                for b in ekonomi_data["baykuslar"])
            ortalama_level = sum(b["level"] for b in ekonomi_data["baykuslar"]) / len(
                ekonomi_data["baykuslar"]
            )
            aktif_baykuslar = len(ekonomi_data["baykuslar"])

            # En zengin 5 baykuş
            en_zenginler = sorted(
                ekonomi_data["baykuslar"],
                key=lambda x: x["bakiye"],
                reverse=True)[
                :5]

            embed = discord.Embed(
                title=f"{EMOJI_CHART} Orman Ekonomi Durumu",
                description=f"Toplam **{aktif_baykuslar}** aktif baykuş",
                color=0x8B4513,
                timestamp=datetime.now(),
            )

            embed.add_field(
                name=f"{EMOJI_MONEY_BAG} Toplam Bakiye",
                value=f"**{toplam_bakiye:.2f} TL**",
                inline=True,
            )
            embed.add_field(
                name=f"{EMOJI_PARA} Toplam Kazanç",
                value=f"**{toplam_kazanc:.2f} TL**",
                inline=True,
            )
            embed.add_field(
                name=f"{EMOJI_LEVEL} Ortalama Level",
                value=f"**{ortalama_level:.1f}**",
                inline=True,
            )

            # Zenginler listesi
            zenginler_listesi = ""
            for i, baykus in enumerate(en_zenginler, 1):
                zenginler_listesi += (
                    f"{i}. **{baykus['username']}** - {baykus['bakiye']:.2f} TL "
                    f"(Level {baykus['level']})\n"
                )

            embed.add_field(
                name=f"{EMOJI_STAR} En Zengin 5 Baykuş",
                value=zenginler_listesi,
                inline=False,
            )

            await interaction.response.send_message(embed=embed, ephemeral=False)

        await log_gonder(
            f"Ekonomi durumu komutu kullanıldı - Yetkili: {interaction.user.name}"
        )

    except Exception as e:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Hata Oluştu",
            description="Ekonomi durumu yüklenirken bir hata oluştu!",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_hata(f"Ekonomi durumu komutu hatası - Yetkili: {interaction.user.name}, Hata: {e}")


@tree.command(name="bakiye_ekle", description="Baykuşun bakiyesine para ekler")
@is_super_yetkili()
@app_commands.describe(baykus="Bakiye eklenecek baykuş",
                       miktar="Eklenecek miktar (TL)", sebep="Ekleme sebebi")
async def bakiye_ekle(
    interaction: discord.Interaction,
    baykus: discord.User,
    miktar: float,
    sebep: str = "Manuel ekleme",
):
    try:
        if miktar <= 0:
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Geçersiz Miktar",
                description="Miktar 0'dan büyük olmalı!",
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=False)
            return

        user_id = str(baykus.id)
        ekonomi_data = load_economy_data()

        ekonomi_baykus = next(
            (b for b in ekonomi_data["baykuslar"] if b["id"] == user_id), None
        )

        if not ekonomi_baykus:
            # Yeni baykuş oluştur
            ekonomi_baykus = {
                "id": user_id,
                "username": baykus.name,
                "bakiye": miktar,
                "toplam_kazanc": miktar,
                "level": 1,
                "xp": 0,
                "son_gunluk_video_tarihi": datetime.now().strftime("%Y-%m-%d"),
                "gunluk_video_sayisi": 0,
                "video_odeme_gecmisi": [],
            }
            ekonomi_data["baykuslar"].append(ekonomi_baykus)
        else:
            ekonomi_baykus["bakiye"] += miktar
            ekonomi_baykus["toplam_kazanc"] += miktar

        # Ödeme geçmişine ekle
        ekonomi_baykus["video_odeme_gecmisi"].append(
            {
                "tarih": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "video_url": "MANUEL_EKLEME",
                "odeme": miktar,
                "level": ekonomi_baykus["level"],
                "gunluk_video_sayisi": ekonomi_baykus["gunluk_video_sayisi"],
                "aciklama": sebep,
            }
        )

        await save_economy_data(ekonomi_data)

        # Kullanıcıya bildirim
        try:
            user_embed = discord.Embed(
                title=f"{EMOJI_PARA} Bakiye Eklendi! {EMOJI_PARA}",
                description=(
                    f"Bakiyene **{miktar:.2f} TL** eklendi!\n\n"
                    f"**Sebep:** {sebep}\n"
                    f"**Yeni Bakiye:** {ekonomi_baykus['bakiye']:.2f} TL\n"
                    f"**Ekleyen:** {interaction.user.name}"
                ),
                color=discord.Color.green(),
                timestamp=datetime.now(),
            )
            await baykus.send(embed=user_embed)
        except BaseException:
            pass

        # Yanıt embed'i
        embed = discord.Embed(
            title=f"{EMOJI_SUCCESS} Bakiye Eklendi",
            description=f"{baykus.mention} bakiyesine **{miktar:.2f} TL** eklendi!",
            color=discord.Color.green(),
        )
        embed.add_field(
            name=f"{EMOJI_PARA} Yeni Bakiye",
            value=f"**{ekonomi_baykus['bakiye']:.2f} TL**",
            inline=True,
        )
        embed.add_field(
            name=f"{EMOJI_FEATHER} Sebep",
            value=sebep,
            inline=True)
        embed.add_field(
            name=f"{EMOJI_BAYKUS} Ekleyen",
            value=interaction.user.mention,
            inline=True,
        )

        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_gonder(
            f"Bakiye eklendi - Baykuş: {baykus.name}, Miktar: {miktar} TL, Sebep: {sebep}, Ekleyen: {interaction.user.name}"
        )

    except Exception as e:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Hata Oluştu",
            description="Bakiye eklenirken bir hata oluştu!",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_hata(
            f"Bakiye ekleme hatası - Baykuş: {baykus.name}, Miktar: {miktar}, Hata: {e}"
        )


@tree.command(name="bakiye_sil",
              description="Baykuşun bakiyesinden para siler")
@is_super_yetkili()
@app_commands.describe(baykus="Bakiye silinecek baykuş",
                       miktar="Silinecek miktar (TL)", sebep="Silme sebebi")
async def bakiye_sil(
    interaction: discord.Interaction,
    baykus: discord.User,
    miktar: float,
    sebep: str = "Manuel silme",
):
    try:
        if miktar <= 0:
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Geçersiz Miktar",
                description="Miktar 0'dan büyük olmalı!",
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=False)
            return

        user_id = str(baykus.id)
        ekonomi_data = load_economy_data()

        ekonomi_baykus = next(
            (b for b in ekonomi_data["baykuslar"] if b["id"] == user_id), None
        )

        if not ekonomi_baykus or ekonomi_baykus["bakiye"] < miktar:
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Yetersiz Bakiye",
                description=f"{
                    baykus.mention} bakiyesi yetersiz veya kayıtlı değil!",
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=False)
            return

        ekonomi_baykus["bakiye"] -= miktar

        # Silme geçmişine ekle
        ekonomi_baykus.setdefault("bakiye_silme_gecmisi", [])
        ekonomi_baykus["bakiye_silme_gecmisi"].append(
            {
                "tarih": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "miktar": miktar,
                "sebep": sebep,
                "silen": interaction.user.name,
                "onceki_bakiye": ekonomi_baykus["bakiye"] + miktar,
                "sonraki_bakiye": ekonomi_baykus["bakiye"],
            }
        )

        await save_economy_data(ekonomi_data)

        # Kullanıcıya bildirim
        try:
            user_embed = discord.Embed(
                title=f"{EMOJI_WARNING} Bakiye Silindi",
                description=(
                    f"Bakiyenden **{miktar:.2f} TL** silindi!\n\n"
                    f"**Sebep:** {sebep}\n"
                    f"**Yeni Bakiye:** {ekonomi_baykus['bakiye']:.2f} TL\n"
                    f"**Silen:** {interaction.user.name}"
                ),
                color=discord.Color.orange(),
                timestamp=datetime.now(),
            )
            await baykus.send(embed=user_embed)
        except BaseException:
            pass

        # Yanıt embed'i
        embed = discord.Embed(
            title=f"{EMOJI_WARNING} Bakiye Silindi",
            description=f"{baykus.mention} bakiyesinden **{miktar:.2f} TL** silindi!",
            color=discord.Color.orange(),
        )
        embed.add_field(
            name=f"{EMOJI_PARA} Yeni Bakiye",
            value=f"**{ekonomi_baykus['bakiye']:.2f} TL**",
            inline=True,
        )
        embed.add_field(
            name=f"{EMOJI_FEATHER} Sebep",
            value=sebep,
            inline=True)
        embed.add_field(
            name=f"{EMOJI_BAYKUS} Silen",
            value=interaction.user.mention,
            inline=True,
        )

        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_gonder(
            f"Bakiye silindi - Baykuş: {baykus.name}, Miktar: {miktar} TL, Sebep: {sebep}, Silen: {interaction.user.name}"
        )

    except Exception as e:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Hata Oluştu",
            description="Bakiye silinirken bir hata oluştu!",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_hata(
            f"Bakiye silme hatası - Baykuş: {baykus.name}, Miktar: {miktar}, Hata: {e}"
        )


@tree.command(name="ekonomi_sifirla",
              description="Baykuşun ekonomi verilerini sıfırlar")
@is_super_yetkili()
@app_commands.describe(baykus="Ekonomisi sıfırlanacak baykuş")
async def ekonomi_sifirla(
        interaction: discord.Interaction,
        baykus: discord.User):
    try:
        user_id = str(baykus.id)
        ekonomi_data = load_economy_data()

        ekonomi_baykus = next(
            (b for b in ekonomi_data["baykuslar"] if b["id"] == user_id), None
        )

        if not ekonomi_baykus:
            embed = discord.Embed(
                title=f"{EMOJI_WARNING} Kayıt Bulunamadı",
                description=f"{
                    baykus.mention} ekonomi sistemine kayıtlı değil!",
                color=discord.Color.orange(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=False)
            return

        # Onay iste
        embed = discord.Embed(
            title=f"{EMOJI_WARNING} Emin misin?",
            description=(
                f"{baykus.mention} ekonomisi tamamen sıfırlanacak!\n\n"
                f"**Mevcut Bakiye:** {ekonomi_baykus['bakiye']:.2f} TL\n"
                f"**Mevcut Level:** {ekonomi_baykus['level']}\n"
                f"**Toplam Kazanç:** {ekonomi_baykus['toplam_kazanc']:.2f} TL\n\n"
                f"Devam etmek için **EVET** yazın."
            ),
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)

        def check(m):
            return (
                m.author.id == interaction.user.id
                and m.channel.id == interaction.channel.id
                and m.content.lower() == "evet"
            )

        try:
            await bot.wait_for("message", check=check, timeout=30.0)
        except asyncio.TimeoutError:
            embed = discord.Embed(
                title=f"{EMOJI_MOON} İşlem İptal",
                description="Zaman aşımı! İşlem iptal edildi.",
                color=discord.Color.blue(),
            )
            await interaction.followup.send(embed=embed, ephemeral=False)
            return

        # Ekonomiyi sıfırla
        ekonomi_baykus["bakiye"] = 0
        ekonomi_baykus["toplam_kazanc"] = 0
        ekonomi_baykus["level"] = 1
        ekonomi_baykus["xp"] = 0
        ekonomi_baykus["gunluk_video_sayisi"] = 0
        ekonomi_baykus["son_gunluk_video_tarihi"] = datetime.now().strftime(
            "%Y-%m-%d")
        ekonomi_baykus["video_odeme_gecmisi"] = []
        ekonomi_baykus.setdefault("bakiye_silme_gecmisi", [])

        # Silme geçmişine ekle
        ekonomi_baykus["bakiye_silme_gecmisi"].append(
            {
                "tarih": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "miktar": "TÜM_BAKIYE",
                "sebep": "EKONOMI_SIFIRLAMA",
                "silen": interaction.user.name,
                "onceki_bakiye": ekonomi_baykus["bakiye"],
                "sonraki_bakiye": 0,
            }
        )

        await save_economy_data(ekonomi_data)

        # Kullanıcıya bildirim
        try:
            user_embed = discord.Embed(
                title=f"{EMOJI_WARNING} Ekonomi Sıfırlandı",
                description=(
                    f"Ekonomi verilerin tamamen sıfırlandı!\n\n"
                    f"**Sebep:** Manuel sıfırlama\n"
                    f"**Sıfırlayan:** {interaction.user.name}\n"
                    f"**Tarih:** {datetime.now().strftime('%d.%m.%Y %H:%M')}"
                ),
                color=discord.Color.red(),
                timestamp=datetime.now(),
            )
            await baykus.send(embed=user_embed)
        except BaseException:
            pass

        # Yanıt embed'i
        embed = discord.Embed(
            title=f"{EMOJI_SUCCESS} Ekonomi Sıfırlandı",
            description=f"{baykus.mention} ekonomisi başarıyla sıfırlandı!",
            color=discord.Color.green(),
        )
        embed.add_field(
            name=f"{EMOJI_PARA} Yeni Bakiye",
            value=f"**0.00 TL**",
            inline=True,
        )
        embed.add_field(
            name=f"{EMOJI_LEVEL} Yeni Level",
            value=f"**1**",
            inline=True,
        )
        embed.add_field(
            name=f"{EMOJI_BAYKUS} Sıfırlayan",
            value=interaction.user.mention,
            inline=True,
        )

        await interaction.followup.send(embed=embed, ephemeral=False)
        await log_gonder(
            f"Ekonomi sıfırlandı - Baykuş: {baykus.name}, Sıfırlayan: {interaction.user.name}"
        )

    except Exception as e:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Hata Oluştu",
            description="Ekonomi sıfırlanırken bir hata oluştu!",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_hata(f"Ekonomi sıfırlama hatası - Baykuş: {baykus.name}, Hata: {e}")


@tree.command(name="ekonomi_rapor", description="Ekonomi raporu oluşturur")
@is_yetkili()
async def ekonomi_rapor(interaction: discord.Interaction):
    try:
        await interaction.response.defer(ephemeral=False)

        ekonomi_data = load_economy_data()
        video_data = load_video_data()

        if not ekonomi_data["baykuslar"]:
            embed = discord.Embed(
                title=f"{EMOJI_WARNING} Rapor Yok",
                description="Henüz ekonomi sistemine kayıtlı baykuş yok!",
                color=discord.Color.orange(),
            )
            await interaction.followup.send(embed=embed, ephemeral=False)
            return

        # Rapor başlığı
        simdi = datetime.now()
        rapor = f"{'=' * 60}\n"
        rapor += f"{EMOJI_CHART} BAYKUŞ EKONOMİ RAPORU - {
            simdi.strftime('%d.%m.%Y %H:%M')}\n"
        rapor += f"{'=' * 60}\n\n"

        # İstatistikler
        toplam_baykus = len(ekonomi_data["baykuslar"])
        toplam_bakiye = sum(b["bakiye"] for b in ekonomi_data["baykuslar"])
        toplam_kazanc = sum(b["toplam_kazanc"]
                            for b in ekonomi_data["baykuslar"])
        ortalama_level = sum(b["level"]
                             for b in ekonomi_data["baykuslar"]) / toplam_baykus
        ortalama_bakiye = toplam_bakiye / toplam_baykus

        rapor += f"{EMOJI_BAYKUS} GENEL İSTATİSTİKLER:\n"
        rapor += f"{'-' * 40}\n"
        rapor += f"Toplam Baykuş Sayısı: {toplam_baykus}\n"
        rapor += f"Toplam Bakiye: {toplam_bakiye:.2f} TL\n"
        rapor += f"Toplam Kazanç: {toplam_kazanc:.2f} TL\n"
        rapor += f"Ortalama Level: {ortalama_level:.1f}\n"
        rapor += f"Ortalama Bakiye: {ortalama_bakiye:.2f} TL\n\n"

        # En zengin 10 baykuş
        en_zenginler = sorted(
            ekonomi_data["baykuslar"], key=lambda x: x["bakiye"], reverse=True
        )[:10]

        rapor += f"{EMOJI_STAR} EN ZENGİN 10 BAYKUŞ:\n"
        rapor += f"{'-' * 40}\n"
        for i, baykus in enumerate(en_zenginler, 1):
            video_sayisi = len(
                next(
                    (v for v in video_data["baykuslar"] if v["id"] == baykus["id"]), {
                        "videolar": []}, )["videolar"])
            rapor += f"{i}. {baykus['username']} (ID: {baykus['id']})\n"
            rapor += f"   Bakiye: {
                baykus['bakiye']:.2f} TL | Level: {
                baykus['level']} | XP: {
                baykus['xp']}\n"
            rapor += f"   Toplam Video: {video_sayisi} | Toplam Kazanç: {
                baykus['toplam_kazanc']:.2f} TL\n"
            rapor += f"   Günlük Video: {baykus['gunluk_video_sayisi']}\n\n"

        # Level dağılımı
        level_dagilimi = {}
        for baykus in ekonomi_data["baykuslar"]:
            level = baykus["level"]
            level_dagilimi[level] = level_dagilimi.get(level, 0) + 1

        rapor += f"{EMOJI_LEVEL} LEVEL DAĞILIMI:\n"
        rapor += f"{'-' * 40}\n"
        for level in sorted(level_dagilimi.keys()):
            rapor += f"Level {level}: {level_dagilimi[level]} baykuş\n"

        # Günlük aktivite
        bugun = simdi.strftime("%Y-%m-%d")
        bugun_video_atanlar = []
        for baykus in ekonomi_data["baykuslar"]:
            if baykus["son_gunluk_video_tarihi"] == bugun and baykus["gunluk_video_sayisi"] > 0:
                bugun_video_atanlar.append(baykus)

        rapor += f"\n{EMOJI_VIDEO} BUGÜN AKTİVİTE:\n"
        rapor += f"{'-' * 40}\n"
        rapor += f"Bugün Video Atan: {len(bugun_video_atanlar)} baykuş\n"
        if bugun_video_atanlar:
            for baykus in sorted(
                    bugun_video_atanlar,
                    key=lambda x: x["gunluk_video_sayisi"],
                    reverse=True)[
                    :5]:
                rapor += f"- {
                    baykus['username']}: {
                    baykus['gunluk_video_sayisi']} video\n"

        rapor += f"\n{'=' * 60}\n"
        rapor += f"Rapor Sonu - {simdi.strftime('%d.%m.%Y %H:%M')}\n"
        rapor += f"{'=' * 60}"

        # Dosya oluştur
        dosya_adi = f"Ekonomi_Raporu_{simdi.strftime('%Y-%m-%d_%H-%M')}.txt"
        dosya_content = io.BytesIO(rapor.encode("utf-8"))
        discord_dosya = discord.File(dosya_content, filename=dosya_adi)

        # Yetkililere gönder
        for yetkili_id in YETKILIER:
            try:
                yetkili = await bot.fetch_user(int(yetkili_id))
                await yetkili.send(
                    f"{EMOJI_CHART} Ekonomi Raporu - {simdi.strftime('%d.%m.%Y %H:%M')}",
                    file=discord_dosya,
                )
            except BaseException:
                pass

        # Log kanalına gönder
        config = load_config()
        log_kanali_id = config.get("log_kanali_id")
        if log_kanali_id:
            try:
                kanal = await bot.fetch_channel(int(log_kanali_id))
                if kanal:
                    dosya_content.seek(0)
                    discord_dosya = discord.File(
                        dosya_content, filename=dosya_adi)
                    await kanal.send(
                        f"{EMOJI_CHART} **Ekonomi Raporu** - {simdi.strftime('%d.%m.%Y %H:%M')}",
                        file=discord_dosya,
                    )
            except BaseException:
                pass

        embed = discord.Embed(
            title=f"{EMOJI_SUCCESS} Rapor Oluşturuldu",
            description="Ekonomi raporu başarıyla oluşturuldu ve yetkililere gönderildi!",
            color=discord.Color.green(),
        )
        await interaction.followup.send(embed=embed, ephemeral=False)
        await log_gonder(
            f"Ekonomi raporu oluşturuldu - Yetkili: {interaction.user.name}"
        )

    except Exception as e:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Hata Oluştu",
            description="Ekonomi raporu oluşturulurken bir hata oluştu!",
            color=discord.Color.red(),
        )
        await interaction.followup.send(embed=embed, ephemeral=False)
        await log_hata(f"Ekonomi raporu hatası - Yetkili: {interaction.user.name}, Hata: {e}")


# ============================================
# BAYKUŞ YÖNETİM KOMUTLARI (ORİJİNAL KOMUTLARIN TEMALANMIŞ HALLERİ)
# ============================================

@tree.command(name="ekle_baykus",
              description="Yeni bir baykuş ekler (interaktif mod)")
@is_yetkili()
async def ekle_baykus(interaction: discord.Interaction):
    try:
        # DM kontrolü
        if interaction.guild is None:
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} DM'de Kullanılamaz",
                description="Bu komutu DM'de kullanamazsın!\nLütfen sunucudaki bir kanalda dene.",
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=False)
            return

        # İlk yanıt
        embed = discord.Embed(
            title=f"{EMOJI_EYES} Dinliyorum...",
            description=(
                "Şu formatta kullanıcı bilgisi gönder:\n"
                "```\nkullanıcı_adı user_id```\n"
                "Örnek:\n"
                "```\nthetuncay 1110219662509224006```\n\n"
                "*30 saniye içinde yanıt ver!*"
            ),
            color=0x8B4513,
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)

        # Kullanıcıdan mesaj bekle
        def check(m):
            return (
                m.author.id == interaction.user.id
                and m.channel.id == interaction.channel.id
            )

        try:
            msg = await bot.wait_for("message", check=check, timeout=30.0)

            # Mesajı parse et
            parts = msg.content.strip().split()

            if len(parts) != 2:
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Hatalı Format!",
                    description=(
                        "Doğru format: `kullanıcı_adı user_id`\n"
                        "Örnek: `thetuncay 1110219662509224006`"
                    ),
                    color=discord.Color.red(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
                await msg.delete()
                return

            username = parts[0]
            user_id = parts[1]

            # ID validasyonu
            try:
                int(user_id)
                if not (17 <= len(user_id) <= 20):
                    raise ValueError
            except ValueError:
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Geçersiz Kullanıcı ID'si!",
                    description=(
                        "Discord ID'si 17-20 karakter arası rakamlardan oluşmalı."
                    ),
                    color=discord.Color.red(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
                await msg.delete()
                await log_gonder(
                    f"Geçersiz ID ile baykuş ekleme denendi - Yetkili: {interaction.user.name}, ID: {user_id}"
                )
                return

            # Kullanıcının mesajını sil
            await msg.delete()

            # Veritabanı kontrolü
            warning_data = load_warning_data()
            video_data = load_video_data()
            ekonomi_data = load_economy_data()

            if any(b["id"] == user_id for b in warning_data["baykuslar"]):
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Baykuş Zaten Mevcut!",
                    description=f"Bu baykuş ({username}, ID: {user_id}) zaten mevcut!",
                    color=discord.Color.red(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
                await log_gonder(
                    f"Zaten mevcut baykuş ekleme denendi - Kullanıcı: {username}, ID: {user_id}"
                )
                return

            # Sunucudan kullanıcıyı al
            config = load_config()
            guild_id = config.get("guild_id")
            baykus_rolu_adi = config.get("baykus_rolu", "Baykuş")

            if not guild_id:
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Sistem Hatası",
                    description="config.json'da guild_id eksik!",
                    color=discord.Color.red(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
                return

            guild = bot.get_guild(int(guild_id))
            if not guild:
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Sunucu Bulunamadı",
                    description=f"Sunucu bulunamadı (ID: {guild_id})!",
                    color=discord.Color.red(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
                return

            # Üyeyi kontrol et
            try:
                member = await guild.fetch_member(int(user_id))
            except discord.errors.NotFound:
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Üye Bulunamadı",
                    description=(
                        f"Bu ID'ye sahip üye sunucuda bulunamadı!\n"
                        f"Kullanıcı adı: {username}\n"
                        f"ID: {user_id}"
                    ),
                    color=discord.Color.red(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
                await log_gonder(
                    f"Sunucuda olmayan kullanıcı eklenmeye çalışıldı - Kullanıcı: {username}, ID: {user_id}"
                )
                return

            # Rolü bul
            baykus_rolu = discord.utils.get(guild.roles, name=baykus_rolu_adi)
            if not baykus_rolu:
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Rol Bulunamadı",
                    description=f"'{baykus_rolu_adi}' rolü sunucuda bulunamadı!",
                    color=discord.Color.red(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
                await log_hata(f"{baykus_rolu_adi} rolü sunucuda bulunamadı!")
                return

            # Veritabanına ekle
            simdi = datetime.now().strftime("%Y-%m-%d %H:%M")

            # Uyarı veritabanı
            warning_data["baykuslar"].append(
                {
                    "id": user_id,
                    "username": username,
                    "son_video_tarihi": None,
                    "ekleme_tarihi": simdi,
                    "hic_video_yok_uyari": False,
                    "uyari_sayisi": 0,
                    "bildirim_sayisi": 0,
                    "uyari_tarihleri": [],
                    "bildirim_tarihleri": [],
                    "tekrar_uyari_saat": 24,
                    "son_tekrar_uyari": None,
                    "manuel_uyarilar": [],
                }
            )

            # Video veritabanı
            video_data["baykuslar"].append(
                {
                    "id": user_id,
                    "username": username,
                    "videolar": [],
                    "son_video_tarihi": None,
                }
            )

            # Ekonomi veritabanı
            ekonomi_data["baykuslar"].append(
                {
                    "id": user_id,
                    "username": username,
                    "bakiye": 0,
                    "toplam_kazanc": 0,
                    "level": 1,
                    "xp": 0,
                    "son_gunluk_video_tarihi": simdi.split()[0],
                    "gunluk_video_sayisi": 0,
                    "video_odeme_gecmisi": [],
                }
            )

            try:
                # Rolü ver
                await member.add_roles(baykus_rolu)

                # Veritabanlarını kaydet
                await save_warning_data(warning_data)
                await save_video_data(video_data)
                await save_economy_data(ekonomi_data)

                # Başarı mesajı
                embed = discord.Embed(
                    title=f"{EMOJI_SUCCESS} Baykuş Başarıyla Eklendi!",
                    description=(
                        f"👤 **Kullanıcı:** {username}\n"
                        f"🆔 **ID:** {user_id}\n"
                        f"🎭 **Rol:** {baykus_rolu_adi} verildi\n"
                        f"📅 **Tarih:** {simdi}\n\n"
                        f"Hoş geldin DM'i gönderildi! {EMOJI_BELL}"
                    ),
                    color=discord.Color.green(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)

                await log_gonder(
                    f"Baykuş eklendi - Kullanıcı: {username}, ID: {user_id}, "
                    f"Yetkili: {interaction.user.name}, Rol verildi: Evet"
                )

                # Hoş geldin mesajı gönder
                await hosgeldin_dm_gonder(user_id, username)

            except discord.errors.Forbidden:
                embed = discord.Embed(
                    title=f"{EMOJI_WARNING} Kısmi Başarı",
                    description=(
                        f"Baykuş eklendi ama rol verilemedi!\n"
                        f"Botun '{baykus_rolu_adi}' rolünü verme yetkisi yok."
                    ),
                    color=discord.Color.orange(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
                await log_hata(
                    f"Rol verme hatası - Kullanıcı: {username}, ID: {user_id}"
                )
            except Exception as e:
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Hata Oluştu",
                    description="Baykuş eklenirken bir hata oluştu!",
                    color=discord.Color.red(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
                await log_hata(
                    f"Baykuş ekleme hatası - Kullanıcı: {username}, ID: {user_id}, Hata: {e}"
                )

        except asyncio.TimeoutError:
            embed = discord.Embed(
                title=f"{EMOJI_CLOCK} Zaman Aşımı!",
                description="30 saniye içinde yanıt vermedin.",
                color=discord.Color.blue(),
            )
            await interaction.followup.send(embed=embed, ephemeral=False)

    except Exception as e:
        try:
            if not interaction.response.is_done():
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Hata Oluştu",
                    description="Bir hata oluştu, lütfen tekrar dene.",
                    color=discord.Color.red(),
                )
                await interaction.response.send_message(embed=embed, ephemeral=False)
            else:
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Hata Oluştu",
                    description="Bir hata oluştu, lütfen tekrar dene.",
                    color=discord.Color.red(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
        except BaseException:
            pass
        await log_hata(
            f"ekle_baykus komutu hatası - Yetkili: {interaction.user.name}, Hata: {e}"
        )


async def hosgeldin_dm_gonder(user_id, username):
    """Yeni baykuşa hoş geldin mesajı gönderir"""
    try:
        user = await bot.fetch_user(int(user_id))
        embed = discord.Embed(
            title=f"{EMOJI_BAYKUS} Baykuş Ormanına Hoş Geldin! {EMOJI_FOREST}",
            description=(
                f"Merhaba **{username}**, BaykuşBot seni aramızda görmekten mutluluk duyuyor! {EMOJI_HOOT}\n\n"
                f"Şimdi yapman gerekenleri dikkatlice oku ve hemen aksiyona geç! 👇"
            ),
            color=discord.Color.green(),
            timestamp=datetime.now(),
        )

        embed.add_field(
            name=f"{EMOJI_SUCCESS} **NE YAPMAN GEREK?**",
            value=(
                "1️⃣ **Videoyu indir:**\n"
                "**https://discord.com/channels/1206330841328914524/1345510001124442162** kanalına git, oradaki videolardan birini indir.\n\n"
                "2️⃣ **Kendi hesabında paylaş:**\n"
                "Videoyu YouTube / TikTok / Instagram hesabına yükle.\n\n"
                "3️⃣ **Linkini paylaş:**\n"
                "Paylaştığın videonun linkini **video-paylaşımları** kanalına at. "
                "Botun sana `✅ Video kaydedildi` dediğinden emin ol.\n"),
            inline=False,
        )

        embed.add_field(
            name=f"{EMOJI_WARNING} **KURALLAR**",
            value=(
                "- Sadece **YouTube, TikTok, Instagram** linkleri kabul edilir.\n"
                "- **Aktiflik:** 2 gün video paylaşmazsan uyarı alırsın.\n"
                "- **Uyarı sonrası:** Uyarı aldıktan sonra 3 gün video paylaşmazsan *Baykuş* rolün kaldırılır.\n"
                f"- **Günlük Limit:** Günde maksimum 10 video paylaşabilirsin.\n"
                f"- **Kazanç:** Her video için {config.get('video_basina_odeme', 5)} TL kazanırsın.\n"
                f"- **Bonuslar:** Level atladıkça ve günlük limiti doldurdukça bonus kazanırsın."
            ),
            inline=False,
        )

        embed.add_field(
            name=f"{EMOJI_TICKET} **DESTEK LAZIM MI?**",
            value=(
                "Herhangi bir sorunda **/destek** komutunu kullanarak destek talebi oluşturabilirsin!\n"
                "Bu komutu hem **DM'den** hem de **sunucudan** kullanabilirsin."),
            inline=False,
        )

        embed.add_field(
            name=f"{EMOJI_MONEY_BAG} **KOMUTLAR**",
            value=(
                "**/kazancım** - Kazanç ve bakiye bilgilerini gösterir\n"
                "**/destek** - Destek talebi oluşturur\n"
                "**/katil** - Kendini sisteme ekler (eğer eklenmediysen)"
            ),
            inline=False,
        )

        embed.set_footer(text="BaykuşBot | TheTuncay tarafından yapıldı.")
        await user.send(embed=embed)
        await log_gonder(
            f"Hoş geldin DM'i gönderildi - Kullanıcı: {username}, ID: {user_id}"
        )
    except discord.errors.Forbidden:
        await log_gonder(
            f"Hoş geldin DM'i gönderilemedi (DM'ler kapalı) - Kullanıcı: {username}, ID: {user_id}"
        )
    except Exception as e:
        await log_hata(
            f"Hoş geldin DM'i gönderme hatası - Kullanıcı: {username}, ID: {user_id}, Hata: {e}"
        )


@tree.command(name="sil_baykus", description="Bir baykuşu listeden siler")
@is_yetkili()
@app_commands.describe(baykus="Silmek istediğiniz kullanıcı")
async def sil_baykus(interaction: discord.Interaction, baykus: discord.User):
    user_id = str(baykus.id)

    try:
        # Onay mesajı gönder
        embed = discord.Embed(
            title=f"{EMOJI_WARNING} Emin misin?",
            description=(
                f"{baykus.mention} adlı baykuşu silmek istediğinize emin misiniz?\n"
                f"(Evet/Hayır, 30 saniye içinde yanıt verin)"
            ),
            color=discord.Color.orange(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)

        # Kullanıcıdan onay bekle
        def check(m):
            return (
                m.author.id == interaction.user.id
                and m.channel.id == interaction.channel.id
            )

        try:
            msg = await bot.wait_for("message", check=check, timeout=30.0)

            # Kullanıcının mesajını sil
            try:
                await msg.delete()
            except BaseException:
                pass

            # "Evet" değilse iptal et
            if msg.content.lower() != "evet":
                embed = discord.Embed(
                    title=f"{EMOJI_MOON} İşlem İptal",
                    description="Silme işlemi iptal edildi!",
                    color=discord.Color.blue(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
                return

        except asyncio.TimeoutError:
            embed = discord.Embed(
                title=f"{EMOJI_CLOCK} Zaman Aşımı",
                description="Zaman aşımı! Silme işlemi iptal edildi!",
                color=discord.Color.blue(),
            )
            await interaction.followup.send(embed=embed, ephemeral=False)
            return

        # Buradan sonra sadece "Evet" dendiğinde devam eder
        warning_data = load_warning_data()
        video_data = load_video_data()
        ekonomi_data = load_economy_data()

        # Veritabanlarında baykuşu bul
        warning_baykus = next(
            (b for b in warning_data["baykuslar"] if b["id"] == user_id), None
        )
        video_baykus = next(
            (b for b in video_data["baykuslar"] if b["id"] == user_id), None
        )
        ekonomi_baykus = next(
            (b for b in ekonomi_data["baykuslar"] if b["id"] == user_id), None
        )

        # Hiçbir veritabanında yoksa hata ver
        if not warning_baykus and not video_baykus and not ekonomi_baykus:
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Baykuş Bulunamadı",
                description=f"{baykus.mention} baykuş listede bulunamadı!",
                color=discord.Color.red(),
            )
            await interaction.followup.send(embed=embed, ephemeral=False)
            await log_gonder(
                f"Baykuş silme başarısız - Kullanıcı: {baykus.name}, ID: {user_id} (listede yok)"
            )
            return

        # Rolü kaldır (veritabanından silmeden önce)
        config = load_config()
        guild_id = config.get("guild_id")
        baykus_rolu_adi = config.get("baykus_rolu", "Baykuş")
        rol_kaldirildi = False

        if guild_id:
            guild = bot.get_guild(int(guild_id))
            if guild:
                try:
                    member = await guild.fetch_member(int(user_id))
                    baykus_rolu = discord.utils.get(
                        guild.roles, name=baykus_rolu_adi)

                    if baykus_rolu and baykus_rolu in member.roles:
                        await member.remove_roles(baykus_rolu)
                        rol_kaldirildi = True
                        await log_gonder(
                            f"Rol kaldırıldı - Kullanıcı: {baykus.name}, Rol: {baykus_rolu_adi}"
                        )
                    else:
                        await log_gonder(
                            f"Kullanıcıda '{baykus_rolu_adi}' rolü zaten yok - Kullanıcı: {baykus.name}"
                        )

                except discord.errors.NotFound:
                    await log_gonder(
                        f"Kullanıcı sunucuda bulunamadı - ID: {user_id}"
                    )
                except discord.errors.Forbidden:
                    await log_hata(
                        f"Rol kaldırma yetkisi yok - Kullanıcı: {baykus.name}, Rol: {baykus_rolu_adi}"
                    )
                except Exception as e:
                    await log_hata(
                        f"Rol kaldırma hatası - Kullanıcı: {baykus.name}, Hata: {e}"
                    )

        # Veritabanlarından sil
        warning_silindi = False
        video_silindi = False
        ekonomi_silindi = False

        if warning_baykus:
            warning_data["baykuslar"].remove(warning_baykus)
            warning_silindi = True

        if video_baykus:
            video_data["baykuslar"].remove(video_baykus)
            video_silindi = True

        if ekonomi_baykus:
            ekonomi_data["baykuslar"].remove(ekonomi_baykus)
            ekonomi_silindi = True

        # Değişiklikleri kaydet
        await save_warning_data(warning_data)
        await save_video_data(video_data)
        await save_economy_data(ekonomi_data)

        # Sonuç mesajı oluştur
        mesaj_parts = [f"✅ {baykus.mention} baykuş listeden silindi!"]

        if rol_kaldirildi:
            mesaj_parts.append(f"🎭 '{baykus_rolu_adi}' rolü kaldırıldı.")
        elif guild_id and guild:
            mesaj_parts.append(
                f"ℹ️ '{baykus_rolu_adi}' rolü zaten yoktu veya kaldırılamadı."
            )

        mesaj = "\n".join(mesaj_parts)

        # Log mesajı oluştur
        db_bilgi = []
        if warning_silindi:
            db_bilgi.append("uyari_database")
        if video_silindi:
            db_bilgi.append("video_database")
        if ekonomi_silindi:
            db_bilgi.append("ekonomi_database")

        log_mesaj = (
            f"Baykuş silindi - Kullanıcı: {baykus.name}, ID: {user_id} "
            f"({', '.join(db_bilgi)}, "
            f"{'rol kaldırıldı' if rol_kaldirildi else 'rol bulunamadı'})"
        )

        # Sonuçları gönder
        embed = discord.Embed(
            title=f"{EMOJI_SUCCESS} Baykuş Silindi",
            description=mesaj,
            color=discord.Color.green(),
        )
        await interaction.followup.send(embed=embed, ephemeral=False)
        await log_gonder(log_mesaj)

    except Exception as e:
        error_msg = f"Baykuş silme hatası - Kullanıcı: {
            baykus.name}, ID: {user_id}, Hata: {e}"
        print(error_msg)
        await log_hata(error_msg)

        # Kullanıcıya hata mesajı gönder
        try:
            if not interaction.response.is_done():
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Hata Oluştu",
                    description="Baykuş silme hatası!",
                    color=discord.Color.red(),
                )
                await interaction.response.send_message(embed=embed, ephemeral=False)
            else:
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Hata Oluştu",
                    description="Baykuş silme hatası!",
                    color=discord.Color.red(),
                )
                await interaction.followup.send(embed=embed, ephemeral=False)
        except BaseException:
            pass


@tree.command(name="guncelle_baykus",
              description="Bir baykuşun kullanıcı adını günceller")
@is_yetkili()
@app_commands.describe(
    user_id="Güncellemek istediğiniz kullanıcının ID'si",
    yeni_username="Yeni kullanıcı adı",
)
async def guncelle_baykus(
    interaction: discord.Interaction, user_id: str, yeni_username: str
):
    warning_data = load_warning_data()
    video_data = load_video_data()
    ekonomi_data = load_economy_data()

    warning_baykus = next(
        (b for b in warning_data["baykuslar"] if b["id"] == user_id), None
    )
    video_baykus = next(
        (b for b in video_data["baykuslar"] if b["id"] == user_id), None
    )
    ekonomi_baykus = next(
        (b for b in ekonomi_data["baykuslar"] if b["id"] == user_id), None
    )

    if not warning_baykus and not video_baykus and not ekonomi_baykus:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Baykuş Bulunamadı",
            description=f"Bu ID'ye sahip bir baykuş bulunamadı: {user_id}",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        return

    if warning_baykus:
        warning_baykus["username"] = yeni_username
    if video_baykus:
        video_baykus["username"] = yeni_username
    if ekonomi_baykus:
        ekonomi_baykus["username"] = yeni_username

    try:
        await save_warning_data(warning_data)
        await save_video_data(video_data)
        await save_economy_data(ekonomi_data)

        embed = discord.Embed(
            title=f"{EMOJI_SUCCESS} Baykuş Güncellendi",
            description=f"Baykuş {user_id} kullanıcı adı {yeni_username} olarak güncellendi!",
            color=discord.Color.green(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_gonder(
            f"Baykuş güncellendi - ID: {user_id}, Yeni Kullanıcı Adı: {yeni_username}"
        )
    except Exception as e:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Hata Oluştu",
            description="Baykuş güncellenirken bir hata oluştu!",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_hata(f"Baykuş güncelleme hatası - ID: {user_id}, Hata: {e}")


@tree.command(name="uyari_ver",
              description="Baykuşa seviyeli manuel uyarı gönderir")
@is_yetkili()
@app_commands.describe(baykus_id="Kullanıcı ID'si",
                       seviye="Uyarı seviyesi (1-5)")
async def uyari_ver(
        interaction: discord.Interaction,
        baykus_id: str,
        seviye: int):
    try:
        if seviye not in range(1, 6):
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Geçersiz Seviye",
                description="Seviye 1-5 arasında olmalı!",
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=False)
            return

        video_data = load_video_data()
        warning_data = load_warning_data()

        baykus = next(
            (b for b in video_data["baykuslar"] if b["id"] == baykus_id), None
        )
        warn_baykus = next(
            (b for b in warning_data["baykuslar"] if b["id"] == baykus_id), None)

        if not baykus:
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Baykuş Bulunamadı",
                description=f"ID: {baykus_id} olan baykuş bulunamadı!",
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=False)
            return

        if not warn_baykus:
            warn_baykus = {
                "id": baykus_id,
                "username": baykus["username"],
                "uyari_sayisi": 0,
                "manuel_uyarilar": [],
            }
            warning_data["baykuslar"].append(warn_baykus)

        # Video bilgilerini hesapla
        son_video = baykus.get("videolar",
                               [])[-1] if baykus.get("videolar") else None
        son_gun = (
            (datetime.now() -
             datetime.strptime(
                son_video["tarih"],
                "%Y-%m-%d %H:%M")).days if son_video else "Hiç video yok")
        toplam_video = len(baykus.get("videolar", []))
        haftalik_video = sum(
            1
            for v in baykus.get("videolar", [])
            if datetime.strptime(v["tarih"], "%Y-%m-%d %H:%M")
            > datetime.now() - timedelta(days=7)
        )

        # Uyarı mesajları (Baykuş temasına uygun)
        uyari_mesajlari = {
            1: f"Baykuşum, n'aptın? {EMOJI_OWL_EYES} Ormanda biraz sessizsin sanki… {son_gun}'den beri video göremedik, umarım böyle devam etmez.. Toplam {toplam_video} videon var, son 7 günde {haftalik_video} video attın. Umarım daha aktif olursun {EMOJI_BAYKUS}",
            2: f"Ey {baykus['username']}, baykuşluk bu mu? {EMOJI_TREE} {son_gun}'den beri video yok, kalbimizi kırıyorsun! Toplam {toplam_video} videon var, ama son 7 günde sadece {haftalik_video} video attın. Daha aktif olman dileği ile..",
            3: f"{baykus['username']}, ormana ihanet mi ediyorsun? {EMOJI_WARNING} {son_gun}'den beri video atmıyorsun, bu iş böyle gitmez.. Toplam {toplam_video} videonla iyi bir baykuşsun, ama son 7 günde {haftalik_video} video. Bizi hayal kırıklığına uğratma..",
            4: f"{baykus['username']}, bu ne ya? {EMOJI_ERROR} {son_gun}'den beri video yok, güvenimizi boşa mı çıkarıyorsun? Toplam {toplam_video} videonla süper bir baykuşsun, ama son 7 günde sadece {haftalik_video} video var. Umarım aktif olmaya devam edersin..",
            5: f"{baykus['username']}, baykuşluk bu değil! {EMOJI_TRASH} {son_gun}'den beri video atmıyorsun, bu Baykuşluğun ruhuna ters! Toplam {toplam_video} videon var, ama son 7 günde {haftalik_video} video ile bizi resmen yarı yolda bıraktın. Son şans, baykuş: Umarım tekrar aktif olursun yoksa baykuşluğun biter :(",
        }

        # Uyarıyı kaydet
        warn_baykus["manuel_uyarilar"] = warn_baykus.get("manuel_uyarilar", [])
        warn_baykus["manuel_uyarilar"].append(
            {
                "seviye": seviye,
                "tarih": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "mesaj": uyari_mesajlari[seviye],
            }
        )
        warn_baykus["uyari_sayisi"] = warn_baykus.get("uyari_sayisi", 0) + 1
        await save_warning_data(warning_data)

        # DM gönder
        try:
            user = await bot.fetch_user(int(baykus_id))
            embed = discord.Embed(
                title=f"{EMOJI_WARNING} Baykuşluk Uyarısı {EMOJI_WARNING}",
                description=uyari_mesajlari[seviye],
                color=discord.Color.from_rgb(
                    255, 69 - (seviye * 40), 0
                ),  # Hafiften serte renk değişimi
                timestamp=datetime.now(),
            )
            embed.set_footer(text="BaykuşBot | Hadi, toparlan!")
            await user.send(embed=embed)
        except discord.errors.Forbidden:
            await log_gonder(
                f"Uyarı DM'i gönderilemedi (DM'ler kapalı) - Kullanıcı: {baykus['username']}, ID: {baykus_id}"
            )

        # Log kanalına duyuru
        config = load_config()
        if config.get("log_kanali_id"):
            kanal = await bot.fetch_channel(int(config["log_kanali_id"]))
            log_embed = discord.Embed(
                title=f"{EMOJI_WARNING} Manuel Uyarı Gönderildi - Seviye {seviye}",
                description=(
                    f"Kullanıcı: {baykus['username']}\n"
                    f"ID: {baykus_id}\n"
                    f"Mesaj: {uyari_mesajlari[seviye]}"
                ),
                color=discord.Color.from_rgb(255, 69 - (seviye * 40), 0),
                timestamp=datetime.now(),
            )
            await kanal.send(embed=log_embed)

        embed = discord.Embed(
            title=f"{EMOJI_SUCCESS} Uyarı Gönderildi",
            description=f"{
                baykus['username']}'a seviye {seviye} uyarı gönderildi!",
            color=discord.Color.green(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_gonder(
            f"Manuel uyarı gönderildi - Kullanıcı: {baykus['username']}, ID: {baykus_id}, Seviye: {seviye}"
        )
    except Exception as e:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Hata Oluştu",
            description="Uyarı gönderilirken hata!",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_hata(
            f"Uyarı verme hatası - ID: {baykus_id}, Seviye: {seviye}, Hata: {e}"
        )


@tree.command(name="uyari_gonder", description="Baykuşa özel uyarı gönderir")
@is_yetkili()
@app_commands.describe(baykus_id="Kullanıcı ID'si", mesaj="Uyarı mesajı")
async def uyari_gonder(
        interaction: discord.Interaction,
        baykus_id: str,
        mesaj: str):
    try:
        warning_data = load_warning_data()
        baykus = next(
            (b for b in warning_data["baykuslar"] if b["id"] == baykus_id),
            None)
        if not baykus:
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Baykuş Bulunamadı",
                description=f"ID: {baykus_id} olan baykuş bulunamadı!",
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=False)
            return

        embed = discord.Embed(
            title=f"{EMOJI_WARNING} Özel Uyarı",
            description=mesaj,
            color=discord.Color.red(),
            timestamp=datetime.now(),
        )
        embed.set_footer(text="BaykuşBot Uyarı Sistemi")

        user = await bot.fetch_user(int(baykus_id))
        await user.send(embed=embed)

        baykus["uyari_sayisi"] = baykus.get("uyari_sayisi", 0) + 1
        baykus["uyari_tarihleri"].append(
            datetime.now().strftime("%Y-%m-%d %H:%M"))
        await save_warning_data(warning_data)

        embed = discord.Embed(
            title=f"{EMOJI_SUCCESS} Uyarı Gönderildi",
            description=f"Uyarı gönderildi: {
                baykus['username']} (ID: {baykus_id})",
            color=discord.Color.green(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_gonder(
            f"Özel uyarı gönderildi - Kullanıcı: {baykus['username']}, ID: {baykus_id}, Mesaj: {mesaj}"
        )
    except discord.errors.Forbidden:
        embed = discord.Embed(
            title=f"{EMOJI_WARNING} DM Gönderilemedi",
            description=f"DM gönderilemedi, {
                baykus['username']} DM'leri kapalı!",
            color=discord.Color.orange(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_gonder(
            f"DM gönderilemedi (DM'ler kapalı) - Kullanıcı: {baykus['username']}, ID: {baykus_id}"
        )
    except Exception as e:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Hata Oluştu",
            description="Uyarı gönderilirken hata oluştu!",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_hata(f"Uyarı gönderme hatası - ID: {baykus_id}, Hata: {e}")


@tree.command(name="durum",
              description="Bir baykuşun genel performansını gösterir")
@is_yetkili()
@app_commands.describe(baykus_id="Kullanıcı ID'si")
async def durum(interaction: discord.Interaction, baykus_id: str):
    try:
        # Veritabanlarını yükle
        video_data = load_video_data()
        warning_data = load_warning_data()
        ekonomi_data = load_economy_data()

        # Baykuşları bul
        video_baykus = next(
            (b for b in video_data["baykuslar"] if b["id"] == baykus_id), None
        )
        warning_baykus = next(
            (b for b in warning_data["baykuslar"] if b["id"] == baykus_id), None)
        ekonomi_baykus = next(
            (b for b in ekonomi_data["baykuslar"] if b["id"] == baykus_id), None)

        if not video_baykus and not warning_baykus and not ekonomi_baykus:
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Baykuş Bulunamadı",
                description=f"ID: {baykus_id} olan baykuş bulunamadı!",
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=False)
            await log_gonder(
                f"Durum kontrolü başarısız - ID: {baykus_id} (baykuş bulunamadı)"
            )
            return

        # Embed oluştur
        embed = discord.Embed(
            title=f"{EMOJI_CHART} Baykuş Durum Raporu",
            color=0x8B4513,
            timestamp=datetime.now(),
        )

        # Kullanıcı bilgileri
        username = (
            warning_baykus["username"]
            if warning_baykus
            else video_baykus["username"] if video_baykus
            else ekonomi_baykus["username"] if ekonomi_baykus
            else "Bilinmeyen Kullanıcı"
        )

        embed.add_field(
            name=f"{EMOJI_BAYKUS} Kullanıcı",
            value=f"{username} (ID: {baykus_id})",
            inline=False
        )

        # Ekonomi bilgileri
        if ekonomi_baykus:
            embed.add_field(
                name=f"{EMOJI_PARA} Bakiye",
                value=f"{ekonomi_baykus['bakiye']:.2f} TL",
                inline=True,
            )
            embed.add_field(
                name=f"{EMOJI_LEVEL} Level",
                value=f"{ekonomi_baykus['level']}",
                inline=True,
            )
            embed.add_field(
                name=f"{EMOJI_CHART} XP",
                value=f"{ekonomi_baykus['xp']}/{ekonomi_baykus['level'] * 100}",
                inline=True,
            )

        # Son video tarihi
        son_video_tarihi = "Video yok"
        if video_baykus and video_baykus.get("son_video_tarihi"):
            son_video_tarihi = video_baykus["son_video_tarihi"]
        elif (
            warning_baykus
            and warning_baykus.get("son_video_tarihi")
            and warning_baykus["son_video_tarihi"] != "Video yok"
        ):
            son_video_tarihi = warning_baykus["son_video_tarihi"]

        embed.add_field(
            name=f"{EMOJI_VIDEO} Son Video Tarihi",
            value=son_video_tarihi,
            inline=True
        )

        # Toplam video sayısı
        toplam_video = (
            len(video_baykus["videolar"])
            if video_baykus and video_baykus.get("videolar")
            else 0
        )
        embed.add_field(
            name=f"{EMOJI_VIDEO} Toplam Video",
            value=str(toplam_video),
            inline=True
        )

        # Son 7 gün video sayısı
        son_7_gun = 0
        if video_baykus and video_baykus.get("videolar"):
            son_7_gun = sum(
                1
                for v in video_baykus["videolar"]
                if datetime.strptime(v["tarih"], "%Y-%m-%d %H:%M")
                > datetime.now() - timedelta(days=7)
            )
        embed.add_field(
            name=f"{EMOJI_CLOCK} Son 7 Gün Video",
            value=str(son_7_gun),
            inline=True
        )

        # Uyarı bilgileri
        uyari_sayisi = warning_baykus.get(
            "uyari_sayisi", 0) if warning_baykus else 0
        son_uyari = (
            warning_baykus["uyari_tarihleri"][-1]
            if warning_baykus and warning_baykus.get("uyari_tarihleri")
            else "Uyarı yok"
        )
        embed.add_field(
            name=f"{EMOJI_WARNING} Uyarı Sayısı",
            value=f"{uyari_sayisi} (Son: {son_uyari})",
            inline=True
        )

        # Bildirim bilgileri (varsa)
        bildirim_sayisi = (
            warning_baykus.get("bildirim_sayisi", 0) if warning_baykus else 0
        )
        son_bildirim = (
            warning_baykus["bildirim_tarihleri"][-1]
            if warning_baykus and warning_baykus.get("bildirim_tarihleri")
            else "Bildirim yok"
        )
        embed.add_field(
            name=f"{EMOJI_BELL} Bildirim Sayısı",
            value=f"{bildirim_sayisi} (Son: {son_bildirim})",
            inline=True,
        )

        # Genel durum
        durum = "Bilinmiyor"
        if son_video_tarihi != "Video yok":
            gecen_zaman = datetime.now() - datetime.strptime(
                son_video_tarihi, "%Y-%m-%d %H:%M"
            )
            if gecen_zaman.days == 0:
                durum = f"Aktif (bugün video paylaşmış) {EMOJI_SUCCESS}"
            elif gecen_zaman.days == 1:
                durum = f"Pasif (1 gündür video yok) {EMOJI_CLOCK}"
            elif gecen_zaman.days == 2:
                durum = f"Uyarı aşamasında (2 gündür video yok) {EMOJI_WARNING}"
            elif gecen_zaman.days >= 3:
                durum = f"Rol kaldırılmış (3+ gündür video yok) {EMOJI_ERROR}"

        embed.add_field(
            name=f"{EMOJI_EYES} Genel Durum",
            value=durum,
            inline=False
        )

        # Embed'i gönder
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_gonder(
            f"Durum raporu görüntülendi - Kullanıcı: {username}, ID: {baykus_id}, Yetkili: {interaction.user.name}"
        )
    except Exception as e:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Hata Oluştu",
            description="Durum raporu oluşturulurken hata oluştu!",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_hata(f"Durum raporu hatası - ID: {baykus_id}, Hata: {e}")


@tree.command(name="rapor", description="Tüm baykuşların raporunu gösterir")
@is_yetkili()
async def rapor(interaction: discord.Interaction):
    try:
        await log_gonder(
            f"Rapor komutu çalıştırıldı - Yetkili: {interaction.user.name}, ID: {interaction.user.id}"
        )
        await interaction.response.defer(ephemeral=False)

        warning_data = load_warning_data()
        video_data = load_video_data()
        ekonomi_data = load_economy_data()

        simdi = datetime.now()
        rapor = f"{'=' * 60}\n"
        rapor += f"📊 BAYKUŞ RAPORU - {simdi.strftime('%d.%m.%Y %H:%M')}\n"
        rapor += f"{'=' * 60}\n\n"

        if not warning_data["baykuslar"]:
            rapor += "Hiçbir baykuş bulunamadı.\n"
        else:
            for warning_baykus in warning_data["baykuslar"]:
                video_baykus = next(
                    (b for b in video_data["baykuslar"] if b["id"] == warning_baykus["id"]),
                    None,
                )
                ekonomi_baykus = next(
                    (b for b in ekonomi_data["baykuslar"] if b["id"] == warning_baykus["id"]),
                    None,
                )

                rapor += f"👤 Kullanıcı: {warning_baykus['username']} (ID: {warning_baykus['id']})\n"
                
                # Ekonomi bilgileri
                if ekonomi_baykus:
                    rapor += f"💰 Bakiye: {ekonomi_baykus['bakiye']:.2f} TL | Level: {ekonomi_baykus['level']}\n"
                
                # Video bilgileri
                toplam_video = len(video_baykus["videolar"]) if video_baykus else 0
                rapor += f"🎥 Toplam Video: {toplam_video}\n"
                
                # Son video
                if video_baykus and video_baykus.get("videolar"):
                    son_video = video_baykus["videolar"][-1]
                    rapor += f"📅 Son Video: {son_video['tarih']}\n"
                else:
                    rapor += f"📅 Son Video: Hiç video yok\n"
                
                # Uyarı bilgileri
                uyari_sayisi = warning_baykus.get("uyari_sayisi", 0)
                rapor += f"⚠️ Uyarı: {uyari_sayisi}\n"
                rapor += f"{'-' * 60}\n\n"

        rapor += f"{'=' * 60}\n"

        # Dosya oluştur ve gönder
        dosya_adi = f"Rapor_{simdi.strftime('%Y-%m-%d_%H-%M')}.txt"
        dosya_content = io.BytesIO(rapor.encode("utf-8"))
        discord_dosya = discord.File(dosya_content, filename=dosya_adi)

        await interaction.followup.send(
            f"📊 **Baykuş Raporu** - {simdi.strftime('%d.%m.%Y %H:%M')}",
            file=discord_dosya,
            ephemeral=False
        )
        
        await log_gonder(f"Rapor gönderildi - Yetkili: {interaction.user.name}")

    except Exception as e:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Hata Oluştu",
            description="Rapor oluşturulurken bir hata oluştu!",
            color=discord.Color.red(),
        )
        await interaction.followup.send(embed=embed, ephemeral=False)
        await log_hata(f"Rapor komutu hatası - Yetkili: {interaction.user.name}, Hata: {e}")


@tree.command(name="kullanim", description="Bot kullanım kılavuzunu gösterir")
@is_yetkili()
async def kullanim(interaction: discord.Interaction):
    try:
        embed = discord.Embed(
            title=f"{EMOJI_BAYKUS} BaykuşBot Kullanım Kılavuzu",
            description="Bu bot, baykuşların video paylaşımlarını takip eder, uyarılar gönderir ve raporlar oluşturur. Aşağıda tüm komutlar listelenmiştir:",
            color=0x8B4513,
            timestamp=datetime.now(),
        )

        # Yönetim komutları
        embed.add_field(
            name=f"{EMOJI_BAYKUS} YÖNETİM KOMUTLARI",
            value=(
                f"**/ekle_baykus** - Yeni bir baykuş ekler\n"
                f"**/sil_baykus** - Bir baykuşu listeden siler\n"
                f"**/guncelle_baykus** - Baykuşun kullanıcı adını günceller\n"
                f"**/uyari_ver** - Baykuşa seviyeli uyarı gönderir\n"
                f"**/uyari_gonder** - Baykuşa özel uyarı gönderir\n"
                f"**/durum** - Baykuşun durumunu gösterir\n"
                f"**/rapor** - Tüm baykuşların raporunu oluşturur"
            ),
            inline=False,
        )

        # Ekonomi komutları
        embed.add_field(
            name=f"{EMOJI_PARA} EKONOMİ KOMUTLARI",
            value=(
                f"**/kazancım** - Video kazancını ve bakiyeni gösterir\n"
                f"**/ekonomi_durum** - Baykuşların ekonomi durumunu gösterir\n"
                f"**/ekonomi_rapor** - Ekonomi raporu oluşturur\n"
                f"**/bakiye_ekle** - Baykuş bakiyesine para ekler (Süper Yetkili)\n"
                f"**/bakiye_sil** - Baykuş bakiyesinden para siler (Süper Yetkili)\n"
                f"**/ekonomi_sifirla** - Baykuş ekonomisini sıfırlar (Süper Yetkili)"
            ),
            inline=False,
        )

        # Sistem komutları
        embed.add_field(
            name=f"{EMOJI_TICKET} SİSTEM KOMUTLARI",
            value=(
                f"**/destek** - Destek talebi oluşturur\n"
                f"**/yardim** - Yardım almak için ticket oluşturur\n"
                f"**/katil** - Baykuşluğa katıl\n"
                f"**/test_gunluk_kontrol** - Günlük kontrolü manuel çalıştırır\n"
                f"**/kullanim** - Bu kılavuzu gösterir"
            ),
            inline=False,
        )

        embed.add_field(
            name=f"{EMOJI_WARNING} NOT",
            value="Tüm komutlar sadece yetkililer tarafından kullanılabilir. Video-paylaşımları kanalına sadece geçerli YouTube/TikTok/Instagram linkleri atılmalı!",
            inline=False,
        )

        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_gonder(
            f"Kullanım kılavuzu gönderildi - Yetkili: {interaction.user.name}"
        )
    except Exception as e:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Hata Oluştu",
            description="Kılavuz gönderilemedi, lütfen tekrar deneyin.",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_hata(f"Kılavuz gönderme hatası: {e}")


@tree.command(name="yardim", description="Destek talebi oluşturur")
async def yardim(interaction: discord.Interaction):
    try:
        modal = TicketModal()
        await interaction.response.send_modal(modal)
        await log_gonder(
            f"Yardım komutu kullanıldı - Kullanıcı: {interaction.user.name}, ID: {interaction.user.id}"
        )
    except Exception as e:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Hata Oluştu",
            description="Bir hata oluştu, lütfen tekrar dene.",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_hata(
            f"Yardım komutu hatası - Kullanıcı: {interaction.user.name}, Hata: {e}"
        )

    """Kullanıcı kendini sisteme ekler"""
    try:
        user_id = str(interaction.user.id)
        username = interaction.user.name

        # Veritabanı kontrolü
        warning_data = load_warning_data()
        video_data = load_video_data()
        ekonomi_data = load_economy_data()

        # Zaten kayıtlı mı kontrol et
        if any(b["id"] == user_id for b in warning_data["baykuslar"]):
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Zaten Baykuşsun!",
                description="Zaten baykuşsun! Sistemde kayıtlısın.",
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            await log_gonder(
                f"Zaten kayıtlı kullanıcı katılma denedi - Kullanıcı: {username}, ID: {user_id}"
            )
            return

        # Config bilgilerini al
        config = load_config()
        guild_id = config.get("guild_id")
        baykus_rolu_adi = config.get("baykus_rolu", "Baykuş")

        if not guild_id:
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Sistem Hatası",
                description="Sistem yapılandırılmamış! Lütfen yetkililerle iletişime geç.",
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        guild = bot.get_guild(int(guild_id))
        if not guild:
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Sunucu Bulunamadı",
                description="Sunucu bulunamadı!",
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        # Rolü bul
        baykus_rolu = discord.utils.get(guild.roles, name=baykus_rolu_adi)
        if not baykus_rolu:
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Rol Bulunamadı",
                description=f"'{baykus_rolu_adi}' rolü sunucuda bulunamadı!",
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            await log_hata(f"{baykus_rolu_adi} rolü sunucuda bulunamadı!")
            return

        # 🚨 ÖNEMLİ DÜZELTME: interaction.user -> guild'den member al
        try:
            member = await guild.fetch_member(int(user_id))
        except discord.errors.NotFound:
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Üye Bulunamadı",
                description="Sunucuda üye bulunamadı! Lütfen sunucuda olduğundan emin ol.",
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        # Kullanıcıyı veritabanına ekle
        simdi = datetime.now().strftime("%Y-%m-%d %H:%M")
        bugun = simdi.split()[0]

        warning_data["baykuslar"].append({
            "id": user_id,
            "username": username,
            "son_video_tarihi": None,
            "ekleme_tarihi": simdi,
            "hic_video_yok_uyari": False,
            "uyari_sayisi": 0,
            "bildirim_sayisi": 0,
            "uyari_tarihleri": [],
            "bildirim_tarihleri": [],
            "tekrar_uyari_saat": 24,
            "son_tekrar_uyari": None,
            "manuel_uyarilar": [],
        })

        video_data["baykuslar"].append({
            "id": user_id,
            "username": username,
            "videolar": [],
            "son_video_tarihi": None,
        })

        ekonomi_data["baykuslar"].append({
            "id": user_id,
            "username": username,
            "bakiye": 0,
            "toplam_kazanc": 0,
            "level": 1,
            "xp": 0,
            "son_gunluk_video_tarihi": bugun,
            "gunluk_video_sayisi": 0,
            "video_odeme_gecmisi": [],
        })

        try:
            # ✅ DÜZELTME: Member nesnesi üzerinden rol ekle
            await member.add_roles(baykus_rolu)

            # Veritabanını kaydet
            await save_warning_data(warning_data)
            await save_video_data(video_data)
            await save_economy_data(ekonomi_data)

            # Başarı mesajı
            embed = discord.Embed(
                title=f"{EMOJI_SUCCESS} Baykuşluğa Hoş Geldin!",
                description=(
                    f"🎭 **'{baykus_rolu_adi}'** rolün verildi!\n"
                    f"📅 **Kayıt tarihi:** {simdi}\n\n"
                    f"📬 Şimdi atacağım mesajı detaylı oku!"
                ),
                color=discord.Color.green(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=False)

            await log_gonder(
                f"Yeni baykuş katıldı - Kullanıcı: {username}, ID: {user_id}, Tarih: {simdi}"
            )

            # Hoş geldin mesajı gönder
            await hosgeldin_dm_gonder(user_id, username)

        except discord.errors.Forbidden:
            embed = discord.Embed(
                title=f"{EMOJI_WARNING} Kısmi Başarı",
                description=(
                    f"Sisteme eklendim ama rol verilemedi!\n"
                    f"Botun '{baykus_rolu_adi}' rolünü verme yetkisi yok. Yetkililerle iletişime geç."
                ),
                color=discord.Color.orange(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            await log_hata(
                f"Rol verme hatası - Kullanıcı: {username}, ID: {user_id}"
            )
        except Exception as e:
            embed = discord.Embed(
                title=f"{EMOJI_ERROR} Hata Oluştu",
                description=(
                    f"Sisteme eklenirken bir hata oluştu!\n"
                    f"Hata: {type(e).__name__}: {str(e)[:100]}"
                ),
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            await log_hata(
                f"Baykuş ekleme hatası - Kullanıcı: {username}, ID: {user_id}, Hata: {type(e).__name__}: {e}"
            )

    except Exception as e:
        try:
            if not interaction.response.is_done():
                embed = discord.Embed(
                    title=f"{EMOJI_ERROR} Hata Oluştu",
                    description=f"Bir hata oluştu: {type(e).__name__}",
                    color=discord.Color.red(),
                )
                await interaction.response.send_message(embed=embed, ephemeral=True)
        except BaseException:
            pass
        await log_hata(
            f"/katıl komutu hatası - Kullanıcı: {interaction.user.name}, Hata: {type(e).__name__}: {e}"
        )


@tree.command(name="destek", description="Destek talebi oluştur")
async def destek(interaction: discord.Interaction):
    """Kullanıcı /destek yazdığında ticket formu açar"""
    try:
        modal = TicketModal()
        await interaction.response.send_modal(modal)
        await log_gonder(
            f"Destek komutu kullanıldı - Kullanıcı: {interaction.user.name}, ID: {interaction.user.id}"
        )
    except Exception as e:
        embed = discord.Embed(
            title=f"{EMOJI_ERROR} Hata Oluştu",
            description="Bir hata oluştu, lütfen tekrar dene.",
            color=discord.Color.red(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=False)
        await log_hata(
            f"Yardım komutu hatası - Kullanıcı: {interaction.user.name}, Hata: {e}"
        )


# ============================================
# GÜNLÜK KONTROL FONKSİYONLARI
# ============================================

# Günlük kontrol - DÜZELTİLMİŞ VERSİYON (Baykuş temasına uygun)
async def gunluk_kontrol():
    print("Günlük kontrol başlatılıyor...")
    simdi = datetime.now()
    warning_data = load_warning_data()
    video_data = load_video_data()
    config = load_config()
    guild_id = config.get("guild_id")
    baykus_rolu_adi = config.get("baykus_rolu", "Baykuş")

    if not bot.is_ready():
        print("Bot Discord'a bağlı değil, günlük kontrol atlanıyor.")
        await log_hata("❌ Bot Discord'a bağlı değil, günlük kontrol atlanıyor.")
        return

    if not guild_id:
        print("config.json'da guild_id eksik!")
        await log_hata("❌ config.json'da guild_id eksik!")
        return

    guild = bot.get_guild(int(guild_id))
    if not guild:
        print(f"Sunucu bulunamadı (ID: {guild_id})!")
        await log_hata(f"❌ Sunucu bulunamadı (ID: {guild_id})!")
        return

    baykus_rolu = discord.utils.get(guild.roles, name=baykus_rolu_adi)
    if not baykus_rolu:
        print(f"{baykus_rolu_adi} rolü sunucuda bulunamadı!")
        await log_hata(f"❌ {baykus_rolu_adi} rolü sunucuda bulunamadı!")
        return

    for baykus in warning_data["baykuslar"][:]:
        try:
            son_video_tarihi = None
            video_baykus = next(
                (b for b in video_data["baykuslar"] if b["id"] == baykus["id"]), None)

            # İlk önce database.json'dan kontrol et
            if video_baykus and video_baykus.get("son_video_tarihi"):
                try:
                    son_video_tarihi = datetime.strptime(
                        video_baykus["son_video_tarihi"], "%Y-%m-%d %H:%M"
                    )
                except (ValueError, TypeError) as e:
                    print(
                        f"Geçersiz tarih formatı (database.json) - Kullanıcı: {
                            baykus['username']}, ID: {
                            baykus['id']}, Hata: {e}")
                    await log_hata(
                        f"❌ Geçersiz tarih formatı (database.json) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}, Hata: {e}"
                    )
                    continue

            # Eğer hala None ise uyari_database.json'dan kontrol et
            if (
                not son_video_tarihi
                and baykus.get("son_video_tarihi")
                and baykus["son_video_tarihi"] != "Video yok"
            ):
                try:
                    son_video_tarihi = datetime.strptime(
                        baykus["son_video_tarihi"], "%Y-%m-%d %H:%M"
                    )
                except (ValueError, TypeError) as e:
                    print(
                        f"Geçersiz tarih formatı (uyari_database.json) - Kullanıcı: {
                            baykus['username']}, ID: {
                            baykus['id']}, Hata: {e}")
                    await log_hata(
                        f"❌ Geçersiz tarih formatı (uyari_database.json) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}, Hata: {e}"
                    )
                    continue

            # Eğer hala son_video_tarihi None ise, hiç video atmamış demektir
            if not son_video_tarihi:
                # Baykuş hiç video atmamış
                ekleme_tarihi = baykus.get("ekleme_tarihi")
                if not ekleme_tarihi:
                    # İlk kez kontrol ediliyor, tarihi kaydet
                    baykus["ekleme_tarihi"] = simdi.strftime("%Y-%m-%d %H:%M")
                    baykus["hic_video_yok_uyari"] = False
                    await save_warning_data(warning_data)
                    print(
                        f"Kullanıcının eklenme tarihi kaydedildi - Kullanıcı: {
                            baykus['username']}, ID: {
                            baykus['id']}")
                    await log_gonder(
                        f"ℹ️ Kullanıcının eklenme tarihi kaydedildi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                    )
                    continue

                try:
                    ekleme_zamani = datetime.strptime(
                        ekleme_tarihi, "%Y-%m-%d %H:%M")
                    gecen_zaman = simdi - ekleme_zamani
                    gecen_gun_sayisi = gecen_zaman.days

                    print(
                        f"Hiç video yok kontrol - Kullanıcı: {
                            baykus['username']}, Eklenme: {ekleme_tarihi}, Geçen gün: {gecen_gun_sayisi}")

                    # 2 gün geçmişse rolü al
                    if gecen_gun_sayisi >= 2:
                        try:
                            user = await bot.fetch_user(int(baykus["id"]))
                            embed = discord.Embed(
                                title=f"{EMOJI_TRASH} Rol Kaldırıldı",
                                description=(
                                    f"Eklendiğinden beri hiç video paylaşmadın! "
                                    f"'{baykus_rolu_adi}' rolün kaldırıldı.\n\n"
                                    f"**Eklenme tarihin:** {ekleme_zamani.strftime('%d.%m.%Y %H:%M')}\n"
                                    f"**Geçen süre:** {gecen_gun_sayisi} gün\n\n"
                                    f"Tekrar Baykuş olmak için yetkililerle iletişime geç ve video paylaş!"
                                ),
                                color=discord.Color.red(),
                                timestamp=datetime.now(),
                            )
                            await user.send(embed=embed)
                            print(
                                f"Hiç video yok - Rol kaldırma DM'i gönderildi - Kullanıcı: {
                                    baykus['username']}, ID: {
                                    baykus['id']}")
                            await log_gonder(
                                f"🛑 Hiç video yok - Rol kaldırma DM'i gönderildi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                            )
                        except discord.errors.Forbidden:
                            print(
                                f"DM gönderilemedi (DM'ler kapalı) - Kullanıcı: {
                                    baykus['username']}, ID: {
                                    baykus['id']}")
                            await log_gonder(
                                f"❌ DM gönderilemedi (DM'ler kapalı) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                            )

                        await asyncio.sleep(1)

                        try:
                            member = await guild.fetch_member(int(baykus["id"]))
                            if not member:
                                print(
                                    f"Üye sunucuda değil - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                                )
                                await log_gonder(
                                    f"❌ Üye sunucuda değil - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                                )
                                warning_data["baykuslar"].remove(baykus)
                                if video_baykus:
                                    video_data["baykuslar"].remove(
                                        video_baykus)
                                print(
                                    f"Sunucuda olmayan kullanıcı veritabanından silindi - Kullanıcı: {
                                        baykus['username']}, ID: {
                                        baykus['id']}")
                                await log_gonder(
                                    f"🗑️ Sunucuda olmayan kullanıcı veritabanından silindi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                                )
                                continue

                            if baykus_rolu in member.roles:
                                await member.remove_roles(baykus_rolu)
                                print(
                                    f"Hiç video yok - {baykus_rolu_adi} rolü kaldırıldı - Kullanıcı: {
                                        baykus['username']}, ID: {
                                        baykus['id']}")
                                await log_gonder(
                                    f"🛑 Hiç video yok - {baykus_rolu_adi} rolü kaldırıldı - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                                )
                                warning_data["baykuslar"].remove(baykus)
                                if video_baykus:
                                    video_data["baykuslar"].remove(
                                        video_baykus)
                                print(
                                    f"Kullanıcı veritabanlarından silindi - Kullanıcı: {
                                        baykus['username']}, ID: {
                                        baykus['id']}")
                                await log_gonder(
                                    f"🗑️ Kullanıcı veritabanlarından silindi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                                )
                            else:
                                print(
                                    f"Kullanıcıda {baykus_rolu_adi} rolü zaten yok - Kullanıcı: {
                                        baykus['username']}, ID: {
                                        baykus['id']}")
                                await log_gonder(
                                    f"ℹ️ Kullanıcıda {baykus_rolu_adi} rolü zaten yok - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                                )
                                warning_data["baykuslar"].remove(baykus)
                                if video_baykus:
                                    video_data["baykuslar"].remove(
                                        video_baykus)
                        except discord.errors.NotFound:
                            print(
                                f"Üye sunucuda değil (API doğrulaması) - Kullanıcı: {
                                    baykus['username']}, ID: {
                                    baykus['id']}")
                            await log_gonder(
                                f"❌ Üye sunucuda değil (API doğrulaması) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                            )
                            warning_data["baykuslar"].remove(baykus)
                            if video_baykus:
                                video_data["baykuslar"].remove(video_baykus)
                        except Exception as e:
                            print(
                                f"Rol kaldırma hatası - Kullanıcı: {
                                    baykus['username']}, ID: {
                                    baykus['id']}, Hata: {e}")
                            await log_hata(
                                f"❌ Rol kaldırma hatası - Kullanıcı: {baykus['username']}, ID: {baykus['id']}, Hata: {e}"
                            )

                    # 1 gün geçmişse ve henüz uyarı almamışsa uyarı gönder
                    elif gecen_gun_sayisi >= 1 and not baykus.get(
                        "hic_video_yok_uyari", False
                    ):
                        try:
                            user = await bot.fetch_user(int(baykus["id"]))
                            embed = discord.Embed(
                                title=f"{EMOJI_WARNING} Uyarı",
                                description=(
                                    f"Eklendiğinden beri hiç video paylaşmadın! "
                                    f"Eğer yarın video paylaşmazsan '{baykus_rolu_adi}' rolün kaldırılacak.\n\n"
                                    f"**Eklenme tarihin:** {ekleme_zamani.strftime('%d.%m.%Y %H:%M')}\n"
                                    f"**Geçen süre:** {gecen_gun_sayisi} gün\n\n"
                                    f"Hadi, ilk videonu paylaş! {EMOJI_VIDEO}"
                                ),
                                color=discord.Color.orange(),
                                timestamp=datetime.now(),
                            )
                            await user.send(embed=embed)
                            baykus["hic_video_yok_uyari"] = True
                            baykus["uyari_tarihleri"] = baykus.get(
                                "uyari_tarihleri", []
                            )
                            baykus["uyari_tarihleri"].append(
                                simdi.strftime("%Y-%m-%d %H:%M")
                            )
                            baykus["uyari_sayisi"] = baykus.get(
                                "uyari_sayisi", 0) + 1
                            await save_warning_data(warning_data)
                            print(
                                f"Hiç video yok uyarısı gönderildi - Kullanıcı: {
                                    baykus['username']}, ID: {
                                    baykus['id']}")
                            await log_gonder(
                                f"⚠️ Hiç video yok uyarısı gönderildi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                            )
                        except discord.errors.Forbidden:
                            print(
                                f"DM gönderilemedi (DM'ler kapalı) - Kullanıcı: {
                                    baykus['username']}, ID: {
                                    baykus['id']}")
                            await log_gonder(
                                f"❌ DM gönderilemedi (DM'ler kapalı) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                            )

                    continue
                except (ValueError, TypeError) as e:
                    print(
                        f"Geçersiz ekleme tarihi - Kullanıcı: {
                            baykus['username']}, ID: {
                            baykus['id']}, Hata: {e}")
                    await log_hata(
                        f"❌ Geçersiz ekleme tarihi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}, Hata: {e}"
                    )
                    continue

            # Son video tarihi varsa, normal kontrollere devam et
            if son_video_tarihi:
                gecen_zaman = simdi - son_video_tarihi
                gecen_gun_sayisi = gecen_zaman.days
                print(
                    f"Kontrol - Kullanıcı: {
                        baykus['username']}, Son video: {
                        son_video_tarihi.strftime('%d.%m.%Y %H:%M')}, Geçen gün: {gecen_gun_sayisi}")
                await log_gonder(
                    f"📊 Kontrol - Kullanıcı: {baykus['username']}, Son video: {son_video_tarihi.strftime('%d.%m.%Y %H:%M')}, Geçen gün: {gecen_gun_sayisi}"
                )

                if gecen_gun_sayisi == 2:
                    son_uyari_tarihi = None
                    if baykus.get("uyari_tarihleri"):
                        try:
                            son_uyari_tarihi = datetime.strptime(
                                baykus["uyari_tarihleri"][-1], "%Y-%m-%d %H:%M"
                            )
                        except (ValueError, TypeError):
                            pass

                    bugun_str = simdi.strftime("%Y-%m-%d")
                    uyari_verildi_mi = (
                        son_uyari_tarihi
                        and son_uyari_tarihi.strftime("%Y-%m-%d") == bugun_str
                    )

                    if not uyari_verildi_mi:
                        try:
                            user = await bot.fetch_user(int(baykus["id"]))
                            embed = discord.Embed(
                                title=f"{EMOJI_WARNING} Uyarı",
                                description=(
                                    f"2 gündür video paylaşmadın! "
                                    f"Eğer yarın video paylaşmazsan '{baykus_rolu_adi}' rolün kaldırılacak.\n\n"
                                    f"**Son video tarihin:** {son_video_tarihi.strftime('%d.%m.%Y %H:%M')}\n"
                                    f"**Geçen süre:** {gecen_gun_sayisi} gün"
                                ),
                                color=discord.Color.orange(),
                                timestamp=datetime.now(),
                            )
                            await user.send(embed=embed)
                            baykus["uyari_tarihleri"].append(
                                simdi.strftime("%Y-%m-%d %H:%M")
                            )
                            baykus["uyari_sayisi"] = baykus.get(
                                "uyari_sayisi", 0) + 1
                            print(
                                f"2 günlük uyarı DM'i gönderildi - Kullanıcı: {
                                    baykus['username']}, ID: {
                                    baykus['id']}")
                            await log_gonder(
                                f"⚠️ 2 günlük uyarı DM'i gönderildi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                            )
                        except discord.errors.Forbidden:
                            print(
                                f"DM gönderilemedi (DM'ler kapalı) - Kullanıcı: {
                                    baykus['username']}, ID: {
                                    baykus['id']}")
                            await log_gonder(
                                f"❌ DM gönderilemedi (DM'ler kapalı) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                            )
                        except Exception as e:
                            print(
                                f"Uyarı DM'i gönderilemedi - Kullanıcı: {
                                    baykus['username']}, ID: {
                                    baykus['id']}, Hata: {e}")
                            await log_hata(
                                f"❌ Uyarı DM'i gönderilemedi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}, Hata: {e}"
                            )

            elif gecen_gun_sayisi >= 3:
                try:
                    user = await bot.fetch_user(int(baykus["id"]))
                    embed = discord.Embed(
                        title=f"{EMOJI_TRASH} Rol Kaldırıldı",
                        description=(
                            f"3 gündür video paylaşmadığın için "
                            f"'{baykus_rolu_adi}' rolün kaldırıldı.\n\n"
                            f"**Son video tarihin:** {son_video_tarihi.strftime('%d.%m.%Y %H:%M')}\n"
                            f"**Geçen süre:** {gecen_gun_sayisi} gün\n\n"
                            f"Tekrar Baykuş olmak için yetkililerle iletişime geç!"
                        ),
                        color=discord.Color.red(),
                        timestamp=datetime.now(),
                    )
                    await user.send(embed=embed)
                    print(
                        f"Rol kaldırma DM'i gönderildi - Kullanıcı: {
                            baykus['username']}, ID: {
                            baykus['id']}")
                    await log_gonder(
                        f"🛑 Rol kaldırma DM'i gönderildi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                    )
                except discord.errors.Forbidden:
                    print(
                        f"DM gönderilemedi (DM'ler kapalı) - Kullanıcı: {
                            baykus['username']}, ID: {
                            baykus['id']}")
                    await log_gonder(
                        f"❌ DM gönderilemedi (DM'ler kapalı) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                    )
                except Exception as e:
                    print(
                        f"Rol kaldırma DM'i gönderilemedi - Kullanıcı: {
                            baykus['username']}, ID: {
                            baykus['id']}, Hata: {e}")
                    await log_hata(
                        f"❌ Rol kaldırma DM'i gönderilemedi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}, Hata: {e}"
                    )

                await asyncio.sleep(1)

                try:
                    member = await guild.fetch_member(int(baykus["id"]))
                    if not member:
                        print(
                            f"Üye sunucuda değil - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                        )
                        await log_gonder(
                            f"❌ Üye sunucuda değil - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                        )
                        warning_data["baykuslar"].remove(baykus)
                        if video_baykus:
                            video_data["baykuslar"].remove(video_baykus)
                        print(
                            f"Sunucuda olmayan kullanıcı veritabanından silindi - Kullanıcı: {
                                baykus['username']}, ID: {
                                baykus['id']}")
                        await log_gonder(
                            f"🗑️ Sunucuda olmayan kullanıcı veritabanından silindi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                        )
                        continue

                    # ✅ DEĞİŞİKLİK: Rolü kontrol et ama log mesajını düzelt
                    if baykus_rolu in member.roles:
                        await member.remove_roles(baykus_rolu)
                        print(
                            f"{baykus_rolu_adi} rolü kaldırıldı - Kullanıcı: {
                                baykus['username']}, ID: {
                                baykus['id']}")
                        await log_gonder(
                            f"🛑 {baykus_rolu_adi} rolü kaldırıldı - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                        )
                    else:
                        # ✅ DEĞİŞİKLİK: Log kanalına mesaj atma, sadece console'a yaz
                        print(
                            f"Kullanıcıda {baykus_rolu_adi} rolü zaten yok (muhtemelen manuel kaldırıldı) - Kullanıcı: {
                                baykus['username']}, ID: {
                                baykus['id']}")

                    # ✅ DEĞİŞİKLİK: Rolü olsun veya olmasın, HER DURUMDA veritabanından sil
                    warning_data["baykuslar"].remove(baykus)
                    if video_baykus:
                        video_data["baykuslar"].remove(video_baykus)
                    print(
                        f"Kullanıcı veritabanlarından silindi - Kullanıcı: {
                            baykus['username']}, ID: {
                            baykus['id']}")
                    await log_gonder(
                        f"🗑️ Kullanıcı veritabanlarından silindi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                    )
                except discord.errors.NotFound:
                    print(
                        f"Üye sunucuda değil (API doğrulması) - Kullanıcı: {
                            baykus['username']}, ID: {
                            baykus['id']}")
                    await log_gonder(
                        f"❌ Üye sunucuda değil (API doğrulması) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                    )
                    warning_data["baykuslar"].remove(baykus)
                    if video_baykus:
                        video_data["baykuslar"].remove(video_baykus)
                    print(
                        f"Sunucuda olmayan kullanıcı veritabanından silindi - Kullanıcı: {
                            baykus['username']}, ID: {
                            baykus['id']}")
                    await log_gonder(
                        f"🗑️ Sunucuda olmayan kullanıcı veritabanından silindi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                    )
                except discord.errors.HTTPException as e:
                    print(
                        f"Rol kaldırma hatası (HTTP) - Kullanıcı: {
                            baykus['username']}, ID: {
                            baykus['id']}, Hata: {e}")
                    await log_hata(
                        f"❌ Rol kaldırma hatası (HTTP) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}, Hata: {e}"
                    )
                except Exception as e:
                    print(
                        f"Rol kaldırma hatası - Kullanıcı: {
                            baykus['username']}, ID: {
                            baykus['id']}, Hata: {e}")
                    await log_hata(
                        f"❌ Rol kaldırma hatası - Kullanıcı: {baykus['username']}, ID: {baykus['id']}, Hata: {e}"
                    )

            elif gecen_gun_sayisi == 1:
                print(
                    f"1 gündür video yok (henüz uyarı zamanı değil) - Kullanıcı: {
                        baykus['username']}, ID: {
                        baykus['id']}")
                await log_gonder(
                    f"ℹ️ 1 gündür video yok (henüz uyarı zamanı değil) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                )

        except Exception as e:
            print(f"Kullanıcı kontrol hatası - ID: {baykus['id']}, Hata: {e}")
            await log_hata(
                f"❌ Kullanıcı kontrol hatası - ID: {baykus['id']}, Hata: {e}"
            )

    try:
        await save_warning_data(warning_data)
        await save_video_data(video_data)
        print("Günlük kontrol tamamlandı.")
        await log_gonder("✅ Günlük kontrol tamamlandı.")
    except Exception as e:
        print(f"Günlük kontrol JSON güncelleme hatası: {e}")
        await log_hata(f"❌ Günlük kontrol JSON güncelleme hatası: {e}")


# Günlük kontrol test komutu
@tree.command(
    name="test_gunluk_kontrol", description="Günlük kontrolü manuel çalıştırır"
)
@is_yetkili()
async def test_gunluk_kontrol(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=False)
    await gunluk_kontrol()
    embed = discord.Embed(
        title=f"{EMOJI_SUCCESS} Kontrol Çalıştırıldı",
        description="Günlük kontrol manuel olarak çalıştırıldı, log kanalını kontrol et!",
        color=discord.Color.green(),
    )
    await interaction.followup.send(embed=embed, ephemeral=False)
    await log_gonder(
        f"📋 Günlük kontrol manuel çalıştırıldı - Yetkili: {interaction.user.name}, ID: {interaction.user.id}"
    )


# Günlük ekonomi sıfırlama
async def gunluk_ekonomi_sifirla():
    """Günlük video sayılarını sıfırlar"""
    try:
        ekonomi_data = load_economy_data()
        bugun = datetime.now().strftime("%Y-%m-%d")

        for baykus in ekonomi_data["baykuslar"]:
            if baykus["son_gunluk_video_tarihi"] != bugun:
                baykus["gunluk_video_sayisi"] = 0
                baykus["son_gunluk_video_tarihi"] = bugun

        await save_economy_data(ekonomi_data)
        await log_gonder("Günlük ekonomi verileri sıfırlandı.")
    except Exception as e:
        await log_hata(f"Günlük ekonomi sıfırlama hatası: {e}")


# Günlük rapor gönderimi
async def gonder_gunluk_rapor():
    print("Otomatik günlük rapor gönderiliyor...")
    simdi = datetime.now()
    bugun_str = simdi.strftime("%Y-%m-%d")

    try:
        if not bot.is_ready():
            print("[Hata] Bot Discord'a bağlı değil, rapor gönderimi atlanıyor.")
            await log_hata("❌ Bot Discord'a bağlı değil, günlük rapor gönderilemedi.")
            return

        warning_data = load_warning_data()
        video_data = load_video_data()
        ekonomi_data = load_economy_data()

        # Rapor başlığı
        rapor = f"{'=' * 60}\n"
        rapor += f"📊 GÜNLÜK BAYKUŞ RAPORU - {
            simdi.strftime('%d.%m.%Y %H:%M')}\n"
        rapor += f"{'=' * 60}\n\n"

        if not warning_data["baykuslar"]:
            rapor += "❌ Hiçbir baykuş bulunamadı.\n"
        else:
            # İstatistikler
            toplam_baykus = len(warning_data["baykuslar"])
            bugun_video_atanlar = 0
            uyari_alanlar = 0
            risk_altindakiler = 0

            rapor += f"👥 Toplam Baykuş Sayısı: {toplam_baykus}\n"
            rapor += f"{'─' * 60}\n\n"

            for warning_baykus in warning_data["baykuslar"]:
                video_baykus = next(
                    (
                        b
                        for b in video_data["baykuslar"]
                        if b["id"] == warning_baykus["id"]
                    ),
                    None,
                )
                ekonomi_baykus = next(
                    (
                        b
                        for b in ekonomi_data["baykuslar"]
                        if b["id"] == warning_baykus["id"]
                    ),
                    None,
                )

                # Kullanıcı başlığı
                rapor += f"👤 Kullanıcı: {warning_baykus['username']}\n"
                rapor += f"🆔 ID: {warning_baykus['id']}\n"

                # Ekonomi bilgileri
                if ekonomi_baykus:
                    rapor += f"💰 Bakiye: {
                        ekonomi_baykus['bakiye']:.2f} TL | Level: {
                        ekonomi_baykus['level']} | XP: {
                        ekonomi_baykus['xp']}\n"

                # Son video tarihi hesapla
                son_video_tarihi = None
                if video_baykus and video_baykus.get("videolar"):
                    son_video = video_baykus["videolar"][-1]
                    son_video_tarihi = son_video["tarih"]
                    try:
                        son_video_dt = datetime.strptime(
                            son_video_tarihi, "%Y-%m-%d %H:%M"
                        )
                        gecen_gun = (simdi - son_video_dt).days
                    except BaseException:
                        gecen_gun = None
                else:
                    gecen_gun = None

                # Bugün video kontrolü
                bugun_video_var = False
                if video_baykus and video_baykus.get("videolar"):
                    for video in reversed(video_baykus["videolar"][-5:]):
                        if video["tarih"].startswith(bugun_str):
                            bugun_video_var = True
                            bugun_video_atanlar += 1
                            rapor += f"✅ Bugün Video: EVET ({
                                video['tarih'].split(' ')[1]})\n"
                            break

                if not bugun_video_var:
                    rapor += f"❌ Bugün Video: HAYIR\n"

                # Son video bilgisi
                if son_video_tarihi:
                    if gecen_gun is not None:
                        rapor += (
                            f"📅 Son Video: {son_video_tarihi} ({gecen_gun} gün önce)\n")
                    else:
                        rapor += f"📅 Son Video: {son_video_tarihi}\n"
                else:
                    rapor += f"📅 Son Video: ❌ Hiç video yok\n"

                # Toplam video sayısı
                toplam_video = (
                    len(video_baykus["videolar"])
                    if video_baykus and video_baykus.get("videolar")
                    else 0
                )
                rapor += f"🎥 Toplam Video: {toplam_video}\n"

                # Uyarı bilgileri
                uyari_sayisi = warning_baykus.get("uyari_sayisi", 0)
                if uyari_sayisi > 0:
                    uyari_alanlar += 1
                    son_uyari = (
                        warning_baykus.get("uyari_tarihleri", [])[-1]
                        if warning_baykus.get("uyari_tarihleri")
                        else "Bilinmiyor"
                    )
                    rapor += f"⚠️ Uyarı: {uyari_sayisi} kez (Son: {son_uyari})\n"
                else:
                    rapor += f"✅ Uyarı: Yok\n"

                # Risk durumu
                if gecen_gun is not None:
                    if gecen_gun >= 3:
                        rapor += f"🚨 DURUM: KRİTİK - Rol kaldırılma riski!\n"
                        risk_altindakiler += 1
                    elif gecen_gun == 2:
                        rapor += f"⚠️ DURUM: RİSKLİ - Uyarı verildi\n"
                        risk_altindakiler += 1
                    elif gecen_gun == 1:
                        rapor += f"⏰ DURUM: DİKKAT - 1 gün video yok\n"
                    else:
                        rapor += f"✅ DURUM: AKTİF\n"
                elif toplam_video == 0:
                    ekleme_tarihi = warning_baykus.get("ekleme_tarihi")
                    if ekleme_tarihi:
                        try:
                            ekleme_dt = datetime.strptime(
                                ekleme_tarihi, "%Y-%m-%d %H:%M"
                            )
                            gecen_gun_ekleme = (simdi - ekleme_dt).days
                            rapor += f"⏳ DURUM: YENİ ÜYE - {gecen_gun_ekleme} gündür hiç video yok\n"
                            if gecen_gun_ekleme >= 1:
                                risk_altindakiler += 1
                        except BaseException:
                            rapor += f"❓ DURUM: BİLİNMİYOR\n"
                    else:
                        rapor += f"❓ DURUM: BİLİNMİYOR\n"

                rapor += f"{'-' * 60}\n\n"

            # Özet istatistikler
            toplam_bakiye = sum(b.get("bakiye", 0)
                                for b in ekonomi_data["baykuslar"])
            toplam_level = sum(b.get("level", 0)
                               for b in ekonomi_data["baykuslar"])
            ortalama_level = toplam_level / \
                len(ekonomi_data["baykuslar"]) if ekonomi_data["baykuslar"] else 0

            rapor += f"{'=' * 60}\n"
            rapor += f"📈 ÖZET İSTATİSTİKLER\n"
            rapor += f"{'=' * 60}\n"
            rapor += f"👥 Toplam Baykuş: {toplam_baykus}\n"
            rapor += f"💰 Toplam Bakiye: {toplam_bakiye:.2f} TL\n"
            rapor += f"📊 Ortalama Level: {ortalama_level:.1f}\n"
            rapor += f"✅ Bugün Video Atanlar: {bugun_video_atanlar}\n"
            rapor += f"⚠️ Uyarı Alanlar: {uyari_alanlar}\n"
            rapor += f"🚨 Risk Altındakiler: {risk_altindakiler}\n"
            rapor += f"{'=' * 60}\n"

        print("RAPOR İÇERİĞİ:")
        print(rapor)

        # Dosya oluştur ve gönder
        dosya_adi = f"Gunluk_Rapor_{simdi.strftime('%Y-%m-%d_%H-%M')}.txt"
        dosya_content = io.BytesIO(rapor.encode("utf-8"))

        # Log kanalına gönder
        config = load_config()
        log_kanali_id = config.get("log_kanali_id")
        if log_kanali_id:
            try:
                kanal = await bot.fetch_channel(int(log_kanali_id))
                if kanal:
                    dosya_content.seek(0)
                    discord_dosya = discord.File(
                        dosya_content, filename=dosya_adi)
                    await kanal.send(
                        f"📊 **Günlük Rapor** - {simdi.strftime('%d.%m.%Y %H:%M')}",
                        file=discord_dosya,
                    )
                    print(
                        f"Günlük rapor log kanalına gönderildi (ID: {log_kanali_id})")
                    await log_gonder("📊 Günlük rapor log kanalına gönderildi.")
                else:
                    print(
                        f"[Hata] Log kanalı bulunamadı (ID: {log_kanali_id})")
            except Exception as e:
                print(f"Log kanalına rapor gönderilemedi: {e}")
                await log_hata(f"❌ Log kanalına rapor gönderilemedi: {e}")

        # Yetkililere gönder
        for yetkili_id in YETKILIER:
            try:
                yetkili = await bot.fetch_user(int(yetkili_id))
                dosya_content.seek(0)
                discord_dosya = discord.File(dosya_content, filename=dosya_adi)
                await yetkili.send(
                    f"📊 **Günlük Rapor** - {simdi.strftime('%d.%m.%Y %H:%M')}",
                    file=discord_dosya,
                )
                print(f"Günlük rapor gönderildi - Yetkili: {yetkili.name}")
                await log_gonder(
                    f"📬 Günlük rapor gönderildi - Yetkili: {yetkili.name}, ID: {yetkili_id}"
                )
            except Exception as e:
                print(
                    f"Günlük rapor gönderilemedi - Yetkili ID: {yetkili_id}, Hata: {e}")
                await log_hata(
                    f"❌ Günlük rapor gönderilemedi - Yetkili ID: {yetkili_id}, Hata: {e}"
                )

    except Exception as e:
        print(f"Günlük rapor hatası: {e}")
        await log_hata(f"❌ Günlük rapor hatası: {e}")


# Dinamik zamanlayıcı kontrol
# Dinamik zamanlayıcı kontrol
async def dinamik_zamanlayici_kontrol():
    try:
        simdi = datetime.now()
        video_data = load_video_data()
        warning_data = load_warning_data()
        config = load_config()
        uyari_suresi = timedelta(days=config.get("uyari_suresi", 2))
        rol_kaldirma_suresi = timedelta(days=3)
        baykus_rolu_adi = config.get("baykus_rolu", "Baykuş")
        guild = (
            bot.get_guild(int(config["guild_id"])) if config.get("guild_id") else None
        )

        if not guild:
            await log_hata(f"❌ Sunucu bulunamadı (ID: {config.get('guild_id')})")
            return

        for baykus in warning_data.get("baykuslar", [])[:]:
            try:
                video_baykus = next(
                    (v for v in video_data["baykuslar"] if v["id"] == baykus["id"]),
                    None,
                )
                son_video_tarihi = None
                if video_baykus and video_baykus.get("videolar"):
                    son_video_tarihi = datetime.strptime(
                        video_baykus["videolar"][-1]["tarih"], "%Y-%m-%d %H:%M"
                    )
                elif (
                    baykus.get("son_video_tarihi")
                    and baykus["son_video_tarihi"] != "Video yok"
                ):
                    son_video_tarihi = datetime.strptime(
                        baykus["son_video_tarihi"], "%Y-%m-%d %H:%M"
                    )

                tekrar_uyari_saat = baykus.get("tekrar_uyari_saat", 24)
                son_tekrar_uyari = baykus.get("son_tekrar_uyari")
                son_tekrar_uyari_tarihi = (
                    datetime.strptime(son_tekrar_uyari, "%Y-%m-%d %H:%M")
                    if son_tekrar_uyari
                    else None
                )

                # Tekrar hatırlatma kontrolü
                if son_video_tarihi and tekrar_uyari_saat > 0:
                    gecen_zaman = simdi - son_video_tarihi
                    if (
                        gecen_zaman >= timedelta(hours=tekrar_uyari_saat)
                        and gecen_zaman < uyari_suresi
                        and (
                            not son_tekrar_uyari_tarihi
                            or (simdi - son_tekrar_uyari_tarihi)
                            >= timedelta(hours=tekrar_uyari_saat)
                        )
                    ):
                        try:
                            user = await bot.fetch_user(int(baykus["id"]))
                            embed = discord.Embed(
                                title=f"{EMOJI_BELL} Nazik Hatırlatma!",
                                description=(
                                    f"{baykus['username']}, son videodan beri {tekrar_uyari_saat} saat geçti. "
                                    f"Yeni video zamanı! {EMOJI_VIDEO}\n"
                                    f"**Son aktivite:** {son_video_tarihi.strftime('%d.%m.%Y %H:%M')}"
                                ),
                                color=discord.Color.blue(),
                                timestamp=simdi,
                            )
                            embed.set_footer(
                                text="BaykuşBot | Hadi, baykuşlar seni bekliyor!"
                            )
                            await user.send(embed=embed)

                            # Bildirim sayısını ve tarihlerini güncelle
                            baykus["bildirim_sayisi"] = (
                                baykus.get("bildirim_sayisi", 0) + 1
                            )
                            baykus["bildirim_tarihleri"] = baykus.get(
                                "bildirim_tarihleri", []
                            ) + [simdi.strftime("%Y-%m-%d %H:%M")]
                            baykus["son_tekrar_uyari"] = simdi.strftime(
                                "%Y-%m-%d %H:%M"
                            )

                            # Log kanalına duyuru
                            if config.get("log_kanali_id"):
                                kanal = await bot.fetch_channel(
                                    int(config["log_kanali_id"])
                                )
                                log_embed = discord.Embed(
                                    title=f"{EMOJI_BELL} Tekrar Hatırlatma Gönderildi",
                                    description=(
                                        f"Kullanıcı: {baykus['username']}\n"
                                        f"ID: {baykus['id']}\n"
                                        f"Son aktivite: {son_video_tarihi.strftime('%d.%m.%Y %H:%M')}"
                                    ),
                                    color=discord.Color.blue(),
                                    timestamp=simdi,
                                )
                                await kanal.send(embed=log_embed)

                            await save_warning_data(warning_data)
                            await log_gonder(
                                f"🔔 Tekrar hatırlatma gönderildi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                            )
                        except discord.errors.Forbidden:
                            await log_gonder(
                                f"❌ Tekrar hatırlatma DM'i gönderilemedi (DM'ler kapalı) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                            )

                # Otomatik uyarı kontrolü (2 gün)
                if son_video_tarihi and (simdi - son_video_tarihi) >= uyari_suresi:
                    son_uyari_tarihi = None
                    if baykus.get("uyari_tarihleri"):
                        son_uyari_tarihi = datetime.strptime(
                            baykus["uyari_tarihleri"][-1], "%Y-%m-%d %H:%M"
                        )
                    
                    # ✅ DEĞİŞİKLİK: Aynı gün içinde sadece bir kez uyarı gönder
                    bugun_str = simdi.strftime("%Y-%m-%d")
                    uyari_bugun_verildi_mi = (
                        son_uyari_tarihi and 
                        son_uyari_tarihi.strftime("%Y-%m-%d") == bugun_str
                    )
                    
                    if not uyari_bugun_verildi_mi:
                        try:
                            user = await bot.fetch_user(int(baykus["id"]))
                            baykus["uyari_sayisi"] = baykus.get("uyari_sayisi", 0) + 1
                            baykus["uyari_tarihleri"] = baykus.get(
                                "uyari_tarihleri", []
                            ) + [simdi.strftime("%Y-%m-%d %H:%M")]
                            embed = discord.Embed(
                                title=f"{EMOJI_WARNING} Baykuşluk Uyarısı!",
                                description=(
                                    f"{baykus['username']}, {uyari_suresi.days} gündür video paylaşmadın! "
                                    f"Hadi, baykuşluk ruhunu göster! {EMOJI_VIDEO}\n\n"
                                    f"**Son aktivite:** {son_video_tarihi.strftime('%d.%m.%Y %H:%M')}\n"
                                    f"**Uyarı sayısı:** {baykus['uyari_sayisi']}"
                                ),
                                color=discord.Color.orange(),
                                timestamp=simdi,
                            )
                            embed.set_footer(text="BaykuşBot | Toparlan, kanka!")
                            await user.send(embed=embed)

                            # Log kanalına duyuru
                            if config.get("log_kanali_id"):
                                kanal = await bot.fetch_channel(
                                    int(config["log_kanali_id"])
                                )
                                log_embed = discord.Embed(
                                    title=f"{EMOJI_WARNING} Otomatik Uyarı Gönderildi",
                                    description=(
                                        f"Kullanıcı: {baykus['username']}\n"
                                        f"ID: {baykus['id']}\n"
                                        f"Son aktivite: {son_video_tarihi.strftime('%d.%m.%Y %H:%M')}\n"
                                        f"Uyarı sayısı: {baykus['uyari_sayisi']}"
                                    ),
                                    color=discord.Color.orange(),
                                    timestamp=simdi,
                                )
                                await kanal.send(embed=log_embed)

                            await save_warning_data(warning_data)
                            await log_gonder(
                                f"⚠️ Otomatik uyarı gönderildi - Kullanıcı: {baykus['username']}, ID: {baykus['id']}, Uyarı sayısı: {baykus['uyari_sayisi']}"
                            )
                        except discord.errors.Forbidden:
                            await log_gonder(
                                f"❌ Otomatik uyarı DM'i gönderilemedi (DM'ler kapalı) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                            )

                # Rol kaldırma kontrolü (3 gün)
                if son_video_tarihi and (simdi - son_video_tarihi) >= rol_kaldirma_suresi:
                    try:
                        user = await bot.fetch_user(int(baykus["id"]))
                        member = await guild.fetch_member(int(baykus["id"]))
                        role = discord.utils.get(guild.roles, name=baykus_rolu_adi)
                        if role and role in member.roles:
                            await member.remove_roles(role)
                            embed = discord.Embed(
                                title=f"{EMOJI_TRASH} Baykuş Rolü Kaldırıldı",
                                description=(
                                    f"{baykus['username']}, {rol_kaldirma_suresi.days} gündür video paylaşmadığın için "
                                    f"'{baykus_rolu_adi}' rolün kaldırıldı. Hadi, geri dön! {EMOJI_VIDEO}\n\n"
                                    f"**Son aktivite:** {son_video_tarihi.strftime('%d.%m.%Y %H:%M')}"
                                ),
                                color=discord.Color.red(),
                                timestamp=simdi,
                            )
                            embed.set_footer(text="BaykuşBot | Baykuşluk bitmez, hadi!")
                            await user.send(embed=embed)

                            # Log kanalına duyuru
                            if config.get("log_kanali_id"):
                                kanal = await bot.fetch_channel(
                                    int(config["log_kanali_id"])
                                )
                                log_embed = discord.Embed(
                                    title=f"{EMOJI_TRASH} Baykuş Rolü Kaldırıldı",
                                    description=(
                                        f"Kullanıcı: {baykus['username']}\n"
                                        f"ID: {baykus['id']}\n"
                                        f"Son aktivite: {son_video_tarihi.strftime('%d.%m.%Y %H:%M')}"
                                    ),
                                    color=discord.Color.red(),
                                    timestamp=simdi,
                                )
                                await kanal.send(embed=log_embed)

                            await log_gonder(
                                f"🛑 Rol kaldırıldı (dinamik) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                            )
                        else:
                            # ✅ DEĞİŞİKLİK: Log kanalına mesaj atma
                            print(
                                f"Kullanıcıda {baykus_rolu_adi} rolü zaten yok (muhtemelen manuel kaldırıldı) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                            )

                        # ✅ DEĞİŞİKLİK: Rolü olsun veya olmasın, HER DURUMDA veritabanından sil
                        warning_data["baykuslar"].remove(baykus)
                        if video_baykus:
                            video_data["baykuslar"].remove(video_baykus)
                        await save_warning_data(warning_data)
                        await save_video_data(video_data)
                        await log_gonder(
                            f"🗑️ Kullanıcı veritabanlarından silindi (dinamik) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                        )
                        
                    except discord.errors.NotFound:
                        await log_gonder(
                            f"❌ Üye sunucuda değil (dinamik) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                        )
                        warning_data["baykuslar"].remove(baykus)
                        if video_baykus:
                            video_data["baykuslar"].remove(video_baykus)
                        await save_warning_data(warning_data)
                        await save_video_data(video_data)
                        await log_gonder(
                            f"🗑️ Sunucuda olmayan kullanıcı veritabanından silindi (dinamik) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                        )
                    except discord.errors.Forbidden:
                        await log_gonder(
                            f"❌ Rol kaldırma DM'i gönderilemedi (DM'ler kapalı) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}"
                        )
                    except discord.errors.HTTPException as e:
                        await log_gonder(
                            f"❌ Rol kaldırma hatası (dinamik) - Kullanıcı: {baykus['username']}, ID: {baykus['id']}, Hata: {e}"
                        )
            except Exception as e:
                await log_hata(f"❌ Kontrol hatası - ID: {baykus['id']}, Hata: {e}")
    except Exception as e:
        await log_hata(f"❌ Dinamik zamanlayıcı hatası: {e}")
# ============================================
# ZAMANLAYICI AYARLARI
# ============================================

scheduler = AsyncIOScheduler()
scheduler.add_job(
    gunluk_kontrol,
    "cron",
    hour=0,
    minute=0,
    misfire_grace_time=3600)
scheduler.add_job(dinamik_zamanlayici_kontrol, "interval", hours=2)
scheduler.add_job(
    gonder_gunluk_rapor, "cron", hour=9, minute=0, misfire_grace_time=3600
)
scheduler.add_job(
    gunluk_ekonomi_sifirla,
    "cron",
    hour=0,
    minute=1,
    misfire_grace_time=3600)


# Botu çalıştır
async def main():
    scheduler.start()
    print(f"{EMOJI_SUCCESS} Zamanlayıcı başlatıldı: {scheduler.running}")
    try:
        await bot.start(TOKEN)
    except KeyboardInterrupt:
        pass
    finally:
        scheduler.shutdown(wait=False)
        await bot.close()


if __name__ == "__main__":
    asyncio.run(main())
