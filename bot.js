const {
  Client, GatewayIntentBits,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  EmbedBuilder, PermissionFlagsBits
} = require('discord.js');

const money = require('./Money');
const { randomUUID } = require('crypto');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
  ]
});

require('dotenv').config();
const TOKEN            = process.env.TOKEN;
const VOICE_CHANNEL_ID = '1516181488020750406';
const IMAGE_URL        = 'https://media.discordapp.net/attachments/1466549247779537118/1518663767225794883/file_00000000264471f4b2808307e37574a9.png?ex=6a3abd59&is=6a396bd9&hm=a4b0aaf0e6d2d5c911ff1210fc388dee5f1eaf1511854ce7b18a4f9ba7d23ebe&=&format=webp&quality=lossless&width=1867&height=747';

const MONEY_PER_MESSAGE    = 0.01;
const MONEY_PER_VOICE_HOUR = 0.02;
const MONEY_PER_INVITE     = 1.00;
const MSG_MONEY_CD_MS      = 60_000;

const LEVEL_CHANNEL_ID = '1518729801613971608';
const LEVEL_UP_IMAGE   = 'https://scontent.ftun10-1.fna.fbcdn.net/v/t1.15752-9/728152174_3363735797129093_3349106481751440168_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=fc17b8&_nc_ohc=CvvfrrjF4HsQ7kNvwFE9yp2&_nc_oc=AdrKjEU8-8dgxku9wlQcASbjpcmw7O-pv2v1z8uvDTS0kND9fr_6dkt6baG-Wg5BbSA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent.ftun10-1.fna&_nc_ss=7a22e&oh=03_Q7cD5gHndULZyOQGMJoBenq7BB4aj2aO6fqE4d4ciMlPg2eCdg&oe=6A636377';
const XP_PER_MESSAGE   = 15;
const XP_PER_VOICE_MIN = 2;
const XP_MSG_CD_MS     = 60_000;

// =================== Slot إعدادات ===================
const SLOT_BET         = 1;
const SLOT_PRIZE       = 7;
const SLOT_WIN_PCT     = 0.20;   // 20% فرصة فوز
const SLOT_MAX_DAILY   = 5;      // أقصى محاولات في اليوم

// =================== GG إعدادات ===================
const GG_PRIZE         = 4;      // مكسب GG
// مرتين في اليوم: بين 4-6 ساعات عشوائياً بين كل إرسال
const GG_MIN_INTERVAL  = 4 * 60 * 60 * 1000;
const GG_MAX_INTERVAL  = 6 * 60 * 60 * 1000;

// =================== Anti-Spam إعدادات ===================
const SPAM_MSG_COUNT   = 5;      // عدد الرسائل المتتالية
const SPAM_WINDOW_MS   = 5_000;  // خلال 5 ثواني
const SPAM_MUTE_MS     = 60 * 60 * 1000; // مدة المنع ساعة

const xpMsgCooldowns = new Map();
let voiceXpInterval  = null;

const msgCooldowns   = new Map();
const inviteCache    = new Map();

// Anti-spam tracking
const spamTracker    = new Map(); // userId → { count, firstMsg }
const mutedUsers     = new Map(); // userId → unmuteTime

// Slot daily attempts: userId_guildId → { count, resetAt }
const slotDailyAttempts = new Map();

// GG tracking
const ggWinners      = new Set(); // userId كسبوا اليوم
let   ggActiveUntil  = 0;         // وقت انتهاء نافذة GG الحالية
let   ggGuildIds     = new Set(); // الجيلدات التي تم الإرسال فيها

// =================== قائمة المنتخبات ===================
const teams = [
  { label: 'السعودية',       emoji: '🇸🇦', role: 'السعودية 🇸🇦' },
  { label: 'المغرب',         emoji: '🇲🇦', role: 'المغرب 🇲🇦' },
  { label: 'تونس',           emoji: '🇹🇳', role: 'تونس 🇹🇳' },
  { label: 'الجزائر',        emoji: '🇩🇿', role: 'الجزائر 🇩🇿' },
  { label: 'مصر',            emoji: '🇪🇬', role: 'مصر 🇪🇬' },
  { label: 'الأردن',         emoji: '🇯🇴', role: 'الأردن 🇯🇴' },
  { label: 'قطر',            emoji: '🇶🇦', role: 'قطر 🇶🇦' },
  { label: 'العراق',         emoji: '🇮🇶', role: 'العراق 🇮🇶' },
  { label: 'إيران',          emoji: '🇮🇷', role: 'إيران 🇮🇷' },
  { label: 'أوزبكستان',      emoji: '🇺🇿', role: 'أوزبكستان 🇺🇿' },
  { label: 'الأرجنتين',      emoji: '🇦🇷', role: 'الأرجنتين 🇦🇷' },
  { label: 'البرازيل',       emoji: '🇧🇷', role: 'البرازيل 🇧🇷' },
  { label: 'أوروغواي',       emoji: '🇺🇾', role: 'أوروغواي 🇺🇾' },
  { label: 'كولومبيا',       emoji: '🇨🇴', role: 'كولومبيا 🇨🇴' },
  { label: 'الإكوادور',      emoji: '🇪🇨', role: 'الإكوادور 🇪🇨' },
  { label: 'باراغواي',       emoji: '🇵🇾', role: 'باراغواي 🇵🇾' },
  { label: 'فرنسا',          emoji: '🇫🇷', role: 'فرنسا 🇫🇷' },
  { label: 'إسبانيا',        emoji: '🇪🇸', role: 'إسبانيا 🇪🇸' },
  { label: 'البرتغال',       emoji: '🇵🇹', role: 'البرتغال 🇵🇹' },
  { label: 'إنجلترا',        emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', role: 'إنجلترا 🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { label: 'ألمانيا',        emoji: '🇩🇪', role: 'ألمانيا 🇩🇪' },
  { label: 'هولندا',         emoji: '🇳🇱', role: 'هولندا 🇳🇱' },
  { label: 'بلجيكا',         emoji: '🇧🇪', role: 'بلجيكا 🇧🇪' },
  { label: 'كرواتيا',        emoji: '🇭🇷', role: 'كرواتيا 🇭🇷' },
  { label: 'سويسرا',         emoji: '🇨🇭', role: 'سويسرا 🇨🇭' },
  { label: 'النمسا',         emoji: '🇦🇹', role: 'النمسا 🇦🇹' },
  { label: 'اسكتلندا',       emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', role: 'اسكتلندا 🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { label: 'النرويج',        emoji: '🇳🇴', role: 'النرويج 🇳🇴' },
  { label: 'البوسنة',        emoji: '🇧🇦', role: 'البوسنة 🇧🇦' },
  { label: 'السويد',         emoji: '🇸🇪', role: 'السويد 🇸🇪' },
  { label: 'تركيا',          emoji: '🇹🇷', role: 'تركيا 🇹🇷' },
  { label: 'التشيك',         emoji: '🇨🇿', role: 'التشيك 🇨🇿' },
  { label: 'اليابان',        emoji: '🇯🇵', role: 'اليابان 🇯🇵' },
  { label: 'كوريا الجنوبية', emoji: '🇰🇷', role: 'كوريا الجنوبية 🇰🇷' },
  { label: 'أستراليا',       emoji: '🇦🇺', role: 'أستراليا 🇦🇺' },
  { label: 'السنغال',        emoji: '🇸🇳', role: 'السنغال 🇸🇳' },
  { label: 'جنوب أفريقيا',   emoji: '🇿🇦', role: 'جنوب أفريقيا 🇿🇦' },
  { label: 'كوت ديفوار',     emoji: '🇨🇮', role: 'كوت ديفوار 🇨🇮' },
  { label: 'غانا',           emoji: '🇬🇭', role: 'غانا 🇬🇭' },
  { label: 'الرأس الأخضر',   emoji: '🇨🇻', role: 'الرأس الأخضر 🇨🇻' },
  { label: 'الكونغو',        emoji: '🇨🇩', role: 'الكونغو 🇨🇩' },
  { label: 'أمريكا',         emoji: '🇺🇸', role: 'أمريكا 🇺🇸' },
  { label: 'المكسيك',        emoji: '🇲🇽', role: 'المكسيك 🇲🇽' },
  { label: 'كندا',           emoji: '🇨🇦', role: 'كندا 🇨🇦' },
  { label: 'بنما',           emoji: '🇵🇦', role: 'بنما 🇵🇦' },
  { label: 'هايتي',          emoji: '🇭🇹', role: 'هايتي 🇭🇹' },
  { label: 'كوراساو',        emoji: '🇨🇼', role: 'كوراساو 🇨🇼' },
  { label: 'نيوزيلندا',      emoji: '🇳🇿', role: 'نيوزيلندا 🇳🇿' },
];

// =================== مساعدات ===================
const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size));

function fmt(amount) {
  return `${Number(amount).toFixed(2)} IND`;
}

function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator) ||
         member.id === member.guild.ownerId;
}

function parseAccounts(str) {
  if (!str || !str.trim()) return [];
  return str.split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const nameMatch = s.match(/name:([^/\s,]+)/);
      const pswMatch  = s.match(/psw:([^,\s]+)/);
      return {
        name: nameMatch ? nameMatch[1].trim() : null,
        psw:  pswMatch  ? pswMatch[1].trim()  : null,
      };
    })
    .filter(a => a.name && a.psw);
}

function buildShopEmbed(product, soldOut) {
  const remaining = product.accounts.filter(a => !a.sold).length;
  return new EmbedBuilder()
    .setColor(soldOut ? 0x808080 : 0xf1c40f)
    .setTitle(`🛒 ${product.title}`)
    .setDescription(product.description)
    .setImage(product.imageUrl || null)
    .addFields(
      { name: '💰 السعر',   value: fmt(product.price),                               inline: true },
      { name: '📦 المتوفر', value: soldOut ? '❌ نفد المخزون' : `${remaining} حساب`, inline: true },
    )
    .setFooter({ text: 'IYNexx DOLLAR Store' });
}

function fmtTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}س ${m}د ${s}ث`;
}

// =================== Slot: عدد المحاولات اليومية ===================
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function getSlotAttempts(userId, guildId) {
  const key     = `${userId}-${guildId}`;
  const todayKey = getTodayKey();
  const data    = slotDailyAttempts.get(key);
  if (!data || data.day !== todayKey) return 0;
  return data.count;
}

function incrementSlotAttempts(userId, guildId) {
  const key      = `${userId}-${guildId}`;
  const todayKey = getTodayKey();
  const data     = slotDailyAttempts.get(key);
  if (!data || data.day !== todayKey) {
    slotDailyAttempts.set(key, { day: todayKey, count: 1 });
  } else {
    data.count++;
  }
}

// =================== GG نافذة ===================
function scheduleNextGG() {
  const delay = GG_MIN_INTERVAL + Math.random() * (GG_MAX_INTERVAL - GG_MIN_INTERVAL);
  setTimeout(async () => {
    const now = Date.now();
    ggActiveUntil = now + 5 * 60 * 1000; // نافذة 5 دقائق
    ggWinners.clear();

    for (const [guildId, guild] of client.guilds.cache) {
      // أرسل في أول قناة نصية عامة يقدر البوت يكتب فيها
      const channel = guild.channels.cache.find(
        c => c.isTextBased() && c.permissionsFor(guild.members.me)?.has('SendMessages')
      );
      if (channel) {
        try {
          await channel.send({
            embeds: [new EmbedBuilder()
              .setColor(0xf39c12)
              .setTitle('🏆 تحدي GG!')
              .setDescription(
                `> أول شخص يكتب **GG** يربح **${fmt(GG_PRIZE)}** 💰\n` +
                `> عندك **5 دقائق** — يلا!`
              )
              .setFooter({ text: 'IYNexx • GG Challenge' })
              .setTimestamp()]
          });
        } catch {}
      }
    }
    scheduleNextGG();
  }, delay);
}

// =================== أخطاء ===================
client.on('error', err => console.error('❌ كلاينت:', err.message));
process.on('unhandledRejection', err => console.error('❌ غير معالج:', err?.message ?? err));

// =================== جاهز ===================
client.once('ready', async () => {
  console.log(`✅ البوت شغال: ${client.user.tag}`);
  startVoiceXpInterval();
  scheduleNextGG(); // ابدأ نظام GG

  for (const guild of client.guilds.cache.values()) {
    try {
      const invites = await guild.invites.fetch();
      const map = new Map();
      invites.forEach(inv => map.set(inv.code, inv.uses));
      inviteCache.set(guild.id, map);
    } catch {}
  }
});

// =================== إشعار اللفل أب ===================
async function sendLevelUp(guild, userId, newLevel) {
  try {
    const channel = await guild.channels.fetch(LEVEL_CHANNEL_ID);
    if (!channel) return;
    await channel.send({
      content: `🎉 مبروك <@${userId}>! وصلت للفل **${newLevel}** 🚀`,
      files: [{ attachment: LEVEL_UP_IMAGE, name: 'levelup.jpg' }]
    });
  } catch {}
}

// =================== XP الصوت ===================
function startVoiceXpInterval() {
  if (voiceXpInterval) return;
  voiceXpInterval = setInterval(async () => {
    for (const [guildId, guild] of client.guilds.cache) {
      for (const [, member] of guild.members.cache) {
        if (!member.voice.channelId) continue;
        const result = money.addXp(member.id, guildId, XP_PER_VOICE_MIN);
        if (result?.leveledUp) await sendLevelUp(guild, member.id, result.newLevel);
      }
    }
  }, 60_000);
}

// =================== دعوة جديدة ===================
client.on('inviteCreate', inv => {
  const map = inviteCache.get(inv.guild.id) || new Map();
  map.set(inv.code, inv.uses);
  inviteCache.set(inv.guild.id, map);
});

// =================== عضو جديد ===================
client.on('guildMemberAdd', async member => {
  try {
    const newInvites = await member.guild.invites.fetch();
    const oldMap     = inviteCache.get(member.guild.id) || new Map();

    let usedInvite = null;
    for (const [code, inv] of newInvites) {
      if ((inv.uses ?? 0) > (oldMap.get(code) ?? 0)) { usedInvite = inv; break; }
    }

    const newMap = new Map();
    newInvites.forEach(inv => newMap.set(inv.code, inv.uses));
    inviteCache.set(member.guild.id, newMap);

    if (usedInvite?.inviter) {
      money.addBalance(usedInvite.inviter.id, member.guild.id, MONEY_PER_INVITE);
      usedInvite.inviter.send(
        `🎉 دعوت **${member.user.username}** للسيرفر! حصلت على **${fmt(MONEY_PER_INVITE)}** 💰`
      ).catch(() => {});
    }
  } catch {}
});

// =================== مكافأة البوست — كل boost يعطي 3 ===================
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const oldBoostCount = oldMember.premiumSinceTimestamp ? 1 : 0; // Discord لا يعطي العدد مباشرة
    const isBoosting    = !!newMember.premiumSince;
    const wasBoosting   = !!oldMember.premiumSince;

    // كل مرة يبدأ يبوست (سواء أول مرة أو بعد انتهاء سابقة)
    if (!wasBoosting && isBoosting) {
      money.addBalance(newMember.id, newMember.guild.id, 3);
      // أرسل في الشات
      const channel = newMember.guild.channels.cache.find(
        c => c.isTextBased() && c.permissionsFor(newMember.guild.members.me)?.has('SendMessages')
      );
      if (channel) {
        await channel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xff73fa)
            .setTitle('💎 شكراً على البوست!')
            .setDescription(
              `<@${newMember.id}> 🚀 ضاف Boost للسيرفر!\n` +
              `حصل على **3.00 IND** كمكافأة 💰\n\n` +
              `شكراً لدعمك للسيرفر! ❤️`
            )
            .setThumbnail(newMember.user.displayAvatarURL({ extension: 'png' }))
            .setFooter({ text: 'IYNexx DOLLAR • Boost Reward' })
            .setTimestamp()]
        }).catch(() => {});
      }
      newMember.send(`🚀 شكراً على البوست! حصلت على **3.00 IND** 💰`).catch(() => {});
    }
  } catch {}
});

// =================== صوت ===================
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId  = newState.id || oldState.id;
  const guildId = (newState.guild || oldState.guild)?.id;
  if (!userId || !guildId) return;

  if (!oldState.channelId && newState.channelId) {
    money.startVoiceSession(userId, guildId);
  } else if (oldState.channelId && !newState.channelId) {
    const hours = money.endVoiceSession(userId, guildId);
    if (hours > 0) money.addBalance(userId, guildId, hours * MONEY_PER_VOICE_HOUR);
  }
});

// =================== رسائل ===================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const userId  = message.author.id;
  const guildId = message.guild.id;
  const now     = Date.now();
  const content = message.content.trim();

  // ── Anti-Spam: فحص قبل أي شيء ──
  const muteUntil = mutedUsers.get(userId);
  if (muteUntil) {
    if (now < muteUntil) {
      // ممنوع من الكتابة — احذف رسالته
      await message.delete().catch(() => {});
      return;
    } else {
      mutedUsers.delete(userId);
    }
  }

  // تتبع السبام
  const spam = spamTracker.get(userId) || { count: 0, firstMsg: now };
  if (now - spam.firstMsg > SPAM_WINDOW_MS) {
    spam.count    = 1;
    spam.firstMsg = now;
  } else {
    spam.count++;
  }
  spamTracker.set(userId, spam);

  if (spam.count >= SPAM_MSG_COUNT) {
    spamTracker.delete(userId);
    mutedUsers.set(userId, now + SPAM_MUTE_MS);
    await message.delete().catch(() => {});
    try {
      await message.channel.send({
        content: `<@${userId}>`,
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🔇 تم كتمك لساعة!')
          .setDescription(
            `> ⚠️ <@${userId}> تم اكتشاف **سبام**!\n` +
            `> 🔇 لن تستطيع إرسال رسائل لمدة **ساعة كاملة**.\n\n` +
            `*تجنب إرسال رسائل كثيرة بشكل متتالي.*`
          )
          .setFooter({ text: 'IYNexx Anti-Spam System' })
          .setTimestamp()]
      });
    } catch {}
    return;
  }

  // مال تلقائي من الرسائل
  const cdKey = `${guildId}-${userId}`;
  const last  = msgCooldowns.get(cdKey) || 0;
  if (now - last >= MSG_MONEY_CD_MS) {
    msgCooldowns.set(cdKey, now);
    money.addBalance(userId, guildId, MONEY_PER_MESSAGE);
  }

  // XP من الرسائل
  const xpKey  = `xp-${guildId}-${userId}`;
  const lastXp = xpMsgCooldowns.get(xpKey) || 0;
  if (now - lastXp >= XP_MSG_CD_MS) {
    xpMsgCooldowns.set(xpKey, now);
    const xpResult = money.addXp(userId, guildId, XP_PER_MESSAGE);
    if (xpResult?.leveledUp) await sendLevelUp(message.guild, userId, xpResult.newLevel);
  }

  // ── GG تحدي ──
  if (content.toUpperCase() === 'GG') {
    if (now < ggActiveUntil && !ggWinners.has(userId)) {
      ggWinners.add(userId);
      money.addBalance(userId, guildId, GG_PRIZE);
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('🏆 GG! فزت!')
          .setDescription(`<@${userId}> كان الأسرع! ربح **${fmt(GG_PRIZE)}** 💰 🎉`)
          .setFooter({ text: 'IYNexx • GG Challenge' })
          .setTimestamp()]
      });
    }
  }

  // ── /level ──
  if (content.startsWith('/level')) {
    const target = message.mentions.users.first() || message.author;
    const data   = money.getLevelData(target.id, guildId);
    const filled = Math.floor((data.xp / data.xpNeeded) * 10);
    const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);
    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`⭐ لفل ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ extension: 'png' }))
        .addFields(
          { name: '🏆 اللفل الحالي', value: `**${data.level}**`,                            inline: true },
          { name: '✨ XP',           value: `**${Math.floor(data.xp)} / ${data.xpNeeded}**`, inline: true },
          { name: '📊 التقدم',       value: `\`${bar}\``,                                    inline: false },
        )
        .setFooter({ text: 'IYNexx Level System' })]
    });
  }

  // ── /$ ──
  if (content === '/$') {
    const bal = money.getBalance(userId, guildId);
    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('💰 رصيدك')
        .setDescription(`**${fmt(bal)}**`)
        .setThumbnail(message.author.displayAvatarURL({ extension: 'png' }))
        .setFooter({ text: 'IYNexx DOLLAR' })]
    });
  }

  // ── /daily — يعمل تلقائياً كل 24 ساعة ──
  if (content === '/daily') {
    const result = money.claimDaily(userId, guildId);

    if (!result.ok) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('⏳ المكافأة اليومية')
          .setDescription(`خذت مكافأتك اليوم! تنجم ترجع بعد:\n**${fmtTime(result.nextIn)}**`)
          .setFooter({ text: 'IYNexx Daily Reward • تلقائية كل 24 ساعة' })]
      });
    }

    const streakMsg = result.streak >= 7
      ? `🔥 سلسلة ${result.streak} يوم — استمر!`
      : result.streak > 1
        ? `⚡ ${result.streak} أيام متتالية`
        : '📅 أول يوم — ارجع باكر!';

    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('🎁 مكافأة يومية!')
        .setDescription(`حصلت على **${fmt(result.amount)}** 💰\n${streakMsg}`)
        .addFields(
          { name: '💼 رصيدك الآن', value: `**${fmt(money.getBalance(userId, guildId))}**`, inline: true },
          { name: '🔥 السلسلة',    value: `**${result.streak} يوم**`,                      inline: true },
        )
        .setFooter({ text: 'IYNexx Daily Reward • تتجدد كل 24 ساعة تلقائياً' })
        .setTimestamp()]
    });
  }

  // ── /transfer ──
  if (content.startsWith('/transfer')) {
    const mentioned = message.mentions.users.first();
    if (!mentioned) return message.reply({ content: '⚠️ مثال: `/transfer @iyed 5`' });
    if (mentioned.id === userId) return message.reply({ content: '❌ ما تقدر تحول لنفسك!' });

    const parts  = content.split(/\s+/);
    const amount = parseFloat(parts[parts.length - 1]);
    if (isNaN(amount) || amount < 0.01)
      return message.reply({ content: '⚠️ أدخل مبلغاً صحيحاً (الحد الأدنى 0.01)!' });

    const result = money.transferBalance(userId, mentioned.id, guildId, amount);
    if (!result.ok) {
      const reasons = {
        self:           '❌ ما تقدر تحول لنفسك!',
        invalid_amount: '⚠️ المبلغ غير صحيح!',
        insufficient:   `❌ رصيدك ما يكفي! رصيدك: **${fmt(money.getBalance(userId, guildId))}**`,
        error:          '❌ صار خطأ، حاول مرة ثانية.',
      };
      return message.reply({ content: reasons[result.reason] || '❌ فشل التحويل.' });
    }

    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('💸 تم التحويل بنجاح!')
        .addFields(
          { name: '📤 أرسلت إلى',  value: `<@${mentioned.id}>`,           inline: true },
          { name: '💰 المبلغ',      value: `**${fmt(amount)}**`,            inline: true },
          { name: '👤 رصيدك الآن', value: `**${fmt(result.newFromBal)}**`, inline: true },
        )
        .setFooter({ text: 'IYNexx DOLLAR Transfer' })
        .setTimestamp()]
    });
  }

  // ── /$:@mention ──
  if (content.startsWith('/$:')) {
    if (!isAdmin(message.member)) return message.reply({ content: '❌ هذا الأمر للأدمن والقائد فقط!' });
    const mentioned = message.mentions.users.first();
    if (!mentioned) return message.reply({ content: '⚠️ مثال: `/$:@اسم 5`' });
    const parts  = content.split(/\s+/);
    const amount = parseFloat(parts[parts.length - 1]);
    if (isNaN(amount) || amount <= 0) return message.reply({ content: '⚠️ أدخل مبلغاً صحيحاً!' });
    money.addBalance(mentioned.id, guildId, amount);
    const newBal = money.getBalance(mentioned.id, guildId);
    await message.delete().catch(() => {});
    return message.channel.send({
      embeds: [new EmbedBuilder().setColor(0x2ecc71)
        .setDescription(`✅ تمت إضافة **${fmt(amount)}** لـ <@${mentioned.id}>\nرصيده الآن: **${fmt(newBal)}**`)]
    });
  }

  // ── /-$:@mention ──
  if (content.startsWith('/-$:')) {
    if (!isAdmin(message.member)) return message.reply({ content: '❌ هذا الأمر للأدمن والقائد فقط!' });
    const mentioned = message.mentions.users.first();
    if (!mentioned) return message.reply({ content: '⚠️ مثال: `/-$:@اسم 5`' });
    const parts  = content.split(/\s+/);
    const amount = parseFloat(parts[parts.length - 1]);
    if (isNaN(amount) || amount <= 0) return message.reply({ content: '⚠️ أدخل مبلغاً صحيحاً!' });
    const ok = money.deductBalance(mentioned.id, guildId, amount);
    if (!ok) return message.reply({ content: `❌ رصيد <@${mentioned.id}> لا يكفي!` });
    const newBal = money.getBalance(mentioned.id, guildId);
    await message.delete().catch(() => {});
    return message.channel.send({
      embeds: [new EmbedBuilder().setColor(0xe74c3c)
        .setDescription(`✅ تم سحب **${fmt(amount)}** من <@${mentioned.id}>\nرصيده الآن: **${fmt(newBal)}**`)]
    });
  }

  // ── /TR: ──
  if (content.startsWith('/TR:')) {
    if (!isAdmin(message.member)) return message.reply({ content: '❌ هذا الأمر للأدمن والقائد فقط!' });

    const accMatch  = content.match(/\(([^)]*)\)\s*$/);
    const accStr    = accMatch ? accMatch[1] : '';
    const mainPart  = accMatch ? content.slice(0, accMatch.index).trim() : content;
    const titleMatch = mainPart.match(/\/TR:"([^"]+)"/);
    const dsMatch    = mainPart.match(/DS:"([^"]+)"/);
    const imgMatch   = mainPart.match(/IMG:"([^"]+)"/);
    const smMatch    = mainPart.match(/SM:"([^"]+)"/);

    if (!titleMatch || !dsMatch || !smMatch)
      return message.reply({ content: '⚠️ `/TR:"العنوان"-DS:"الوصف"-SM:"السعر"(name:01/psw:123)`' });

    const title    = titleMatch[1];
    const desc     = dsMatch[1];
    const imageUrl = imgMatch ? imgMatch[1] : '';
    const price    = parseFloat(smMatch[1]);
    const accounts = parseAccounts(accStr);

    if (isNaN(price) || price <= 0) return message.reply({ content: '⚠️ السعر يجب أن يكون رقماً موجباً!' });
    if (accounts.length === 0) return message.reply({ content: '⚠️ أضف حسابات بالصيغة الصحيحة!' });

    const productId = randomUUID();
    money.createProduct(productId, guildId, { title, description: desc, imageUrl, price, accounts });
    const product = money.getProduct(productId);
    const buyBtn  = new ButtonBuilder().setCustomId(`buy_${productId}`).setLabel(`🛒 شراء — ${fmt(price)}`).setStyle(ButtonStyle.Success);
    const sent    = await message.channel.send({ embeds: [buildShopEmbed(product, false)], components: [new ActionRowBuilder().addComponents(buyBtn)] });
    money.updateProductMessage(productId, sent.id, sent.channelId);
    await message.delete().catch(() => {});
    return;
  }

  // ── /$$top ──
  if (content === '/$$top') {
    const top = money.getAllBalances(guildId);
    if (top.length === 0) return message.reply({ content: '❌ لا يوجد بيانات بعد!' });
    const medals = ['🥇', '🥈', '🥉'];
    const lines  = top.map((row, i) => `${medals[i] || `**${i + 1}.**`} <@${row.userId}> — **${fmt(row.balance)}**`);
    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('💰 أغنى 10 أعضاء في السيرفر')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'IYNexx DOLLAR Leaderboard' })
        .setTimestamp()]
    });
  }

  // ── /slot — يعرض زر "ابدأ" ──
  if (content === '/slot') {
    const attempts = getSlotAttempts(userId, guildId);
    const remaining = SLOT_MAX_DAILY - attempts;

    if (remaining <= 0) {
      // انتهت المحاولات
      const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 0);
      const msLeft   = tomorrow - Date.now();
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🎰 Slot Machine')
          .setDescription(
            `> ⛔ **انتهت محاولاتك اليومية!**\n\n` +
            `تنجم تلعب مرة ثانية بعد **${fmtTime(msLeft)}**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `> ⚠️ **تذكير مهم:**\n` +
            `> هذه لعبة ترفيهية داخل السيرفر فقط.\n` +
            `> **القمار الحقيقي حرام** — ابتعد عنه واحرص على دينك! 🙏`
          )
          .setFooter({ text: 'IYNexx Slot Machine • استمتع بالحدود المسموحة' })]
      });
    }

    const bal = money.getBalance(userId, guildId);
    const startBtn = new ButtonBuilder()
      .setCustomId(`slot_start_${userId}`)
      .setLabel(`🎰 ابدأ اللعب — ${fmt(SLOT_BET)}`)
      .setStyle(ButtonStyle.Primary);

    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('🎰 Slot Machine')
        .setDescription(
          `╔══════════════════╗\n` +
          `║  🍒  ❓  ❓  ❓  🍒  ║\n` +
          `╚══════════════════╝\n\n` +
          `> 💰 **التكلفة:** ${fmt(SLOT_BET)} لكل لعبة\n` +
          `> 🏆 **الجائزة:** ${fmt(SLOT_PRIZE)} عند التطابق\n` +
          `> 🎯 **فرصة الفوز:** 20%\n` +
          `> 🎮 **محاولاتك المتبقية اليوم:** ${remaining}/${SLOT_MAX_DAILY}\n` +
          `> 💼 **رصيدك:** ${fmt(bal)}`
        )
        .setFooter({ text: 'IYNexx Slot Machine • اضغط ابدأ للعب' })],
      components: [new ActionRowBuilder().addComponents(startBtn)]
    });
  }

  // ── /BN ──
  if (content === '/BN') {
    const btn = new ButtonBuilder().setCustomId('join_voice').setLabel('⚽ • بث المباراة هنا • ⚽').setStyle(ButtonStyle.Success);
    await message.channel.send({ content: '||@everyone||', components: [new ActionRowBuilder().addComponents(btn)] });
    await message.delete().catch(() => {});
  }

  // ── /your.country ──
  if (content === '/your.country') {
    const embed = new EmbedBuilder()
      .setColor(0x1a56db).setImage(IMAGE_URL)
      .setTitle('🏆 كأس العالم 2026')
      .setDescription('**اضغط على الزر أدناه واختر منتخبك**\n\n*اختر نفس المنتخب مرة ثانية لإزالة الرتبة*');
    const btn = new ButtonBuilder().setCustomId('open_country_select').setLabel('🌍 اختر دولتك').setStyle(ButtonStyle.Primary);
    await message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
    await message.delete().catch(() => {});
  }

  // ── /Tn: ──
  if (content.startsWith('/Tn:')) {
    if (!message.member.permissions.has('Administrator')) return message.reply({ content: '❌ هذا الأمر للأدمن فقط!' });
    const mentioned = message.mentions.users.first();
    if (!mentioned) return message.reply({ content: '⚠️ مثال: `/Tn: @iyed`' });
    await message.delete().catch(() => {});
    await message.channel.send({
      content: `||@everyone|| | <@${mentioned.id}>\n\n⚠️ **تحذير رسمي** ⚠️\n\n> 🚨 <@${mentioned.id}> **أنت تخالف قوانين السيرفر**\n> ⚡ هذا تحذير رسمي، الاستمرار يعرضك للطرد!`
    });
  }

  // ── /BOT: ──
  if (content.startsWith('/BOT:')) {
    if (!isAdmin(message.member)) return message.reply({ content: '❌ هذا الأمر للأدمن والقائد فقط!' });
    const text = content.slice(5).trim();
    if (!text) return message.reply({ content: '⚠️ اكتب رسالة بعد `/BOT:`' });
    await message.delete().catch(() => {});
    await message.channel.send({ content: text });
    return;
  }

  // ── /help ──
  if (content === '/help') {
    if (!message.member.permissions.has('Administrator')) return message.reply({ content: '❌ هذا الأمر للأدمن فقط!' });
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🤖 أوامر البوت')
      .setDescription('━━━━━━━━━━━━━━━━━━━━━━')
      .addFields(
        { name: '⚽ `/BN`',                   value: 'يرسل زر بث المباراة مع @everyone' },
        { name: '🏆 `/your.country`',         value: 'يرسل زر اختيار المنتخب' },
        { name: '⚠️ `/Tn: @شخص`',            value: 'يرسل تحذير رسمي (أدمن)' },
        { name: '📢 `/BOT: رسالة`',          value: 'البوت يرسل الرسالة بدلك (أدمن/قائد)' },
        { name: '🔧 `/help`',                 value: 'يعرض هذه القائمة (أدمن)' },
        { name: '💰 `/$`',                    value: 'عرض رصيدك — للجميع' },
        { name: '🎁 `/daily`',               value: 'مكافأة يومية 0.01 IND تلقائية كل 24 ساعة — للجميع' },
        { name: '💸 `/transfer @شخص مبلغ`', value: 'تحويل مال لعضو آخر — للجميع' },
        { name: '⭐ `/level`',                value: 'عرض لفلك أو لفل شخص آخر — للجميع' },
        { name: '🏆 `/$$top`',               value: 'أغنى 10 أعضاء في السيرفر — للجميع' },
        { name: '🎰 `/slot`',                value: `السلوت! ${fmt(SLOT_BET)} للعب، اربح ${fmt(SLOT_PRIZE)} — 20% فوز — ${SLOT_MAX_DAILY} محاولات/يوم` },
        { name: '🏆 `GG`',                   value: `اكتبها أول واحد عند التحدي وتربح ${fmt(GG_PRIZE)} — مرتين يومياً` },
        { name: '➕ `/$:@شخص مبلغ`',         value: 'إضافة مال (أدمن/قائد)' },
        { name: '➖ `/-$:@شخص مبلغ`',        value: 'سحب مال (أدمن/قائد)' },
        { name: '🛒 `/TR:"عنوان"-DS:"وصف"-SM:"سعر"(حسابات)`', value: 'إنشاء منتج (أدمن/قائد)' },
      );
    await message.channel.send({ embeds: [embed] });
    await message.delete().catch(() => {});
  }
});

// =================== التفاعلات ===================
client.on('interactionCreate', async (interaction) => {

  // ── زر slot_start ──
  if (interaction.isButton() && interaction.customId.startsWith('slot_start_')) {
    const ownerId = interaction.customId.split('_')[2];
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;
    const now     = Date.now();

    // فقط صاحب الرسالة يقدر يضغط
    if (userId !== ownerId) {
      return interaction.reply({ content: '❌ هذا الزر مو لك!', ephemeral: true });
    }

    await interaction.deferUpdate();

    const attempts  = getSlotAttempts(userId, guildId);
    const remaining = SLOT_MAX_DAILY - attempts;

    if (remaining <= 0) {
      const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 0);
      const msLeft   = tomorrow - Date.now();
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🎰 Slot Machine')
          .setDescription(
            `> ⛔ **انتهت محاولاتك اليومية!**\n\n` +
            `تنجم تلعب مرة ثانية بعد **${fmtTime(msLeft)}**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `> ⚠️ **تذكير مهم:**\n` +
            `> هذه لعبة ترفيهية داخل السيرفر فقط.\n` +
            `> **القمار الحقيقي حرام** — ابتعد عنه واحرص على دينك! 🙏`
          )
          .setFooter({ text: 'IYNexx Slot Machine' })],
        components: []
      });
    }

    const bal = money.getBalance(userId, guildId);
    if (bal < SLOT_BET) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🎰 Slot Machine')
          .setDescription(`❌ رصيدك ما يكفي!\nتحتاج **${fmt(SLOT_BET)}** للعب.\nرصيدك: **${fmt(bal)}**`)
          .setFooter({ text: 'IYNexx Slot Machine' })],
        components: []
      });
    }

    // خصم وسجل المحاولة
    money.deductBalance(userId, guildId, SLOT_BET);
    incrementSlotAttempts(userId, guildId);

    const SYMBOLS = ['🍒', '🍋', '🍇', '💎', '⭐', '🔔', '7️⃣'];
    const isWin   = Math.random() < SLOT_WIN_PCT;
    let reels;

    if (isWin) {
      const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      reels = [sym, sym, sym];
    } else {
      do {
        reels = Array.from({ length: 3 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
      } while (reels[0] === reels[1] && reels[1] === reels[2]);
    }

    const newAttempts   = getSlotAttempts(userId, guildId);
    const newRemaining  = SLOT_MAX_DAILY - newAttempts;

    // زر للعب مرة ثانية (إذا في محاولات)
    const components = [];
    if (newRemaining > 0) {
      const again = new ButtonBuilder()
        .setCustomId(`slot_start_${userId}`)
        .setLabel(`🎰 العب مرة ثانية (${newRemaining} متبقية)`)
        .setStyle(ButtonStyle.Secondary);
      components.push(new ActionRowBuilder().addComponents(again));
    }

    if (isWin) {
      money.addBalance(userId, guildId, SLOT_PRIZE);
      const newBal = money.getBalance(userId, guildId);

      let resultEmbed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🎰 Slot Machine — 🎉 فزت!')
        .setDescription(
          `╔══════════════════╗\n` +
          `║  ${reels[0]}  ║  ${reels[1]}  ║  ${reels[2]}  ║\n` +
          `╚══════════════════╝\n\n` +
          `✨ **ثلاثة متطابقة! جاكبوت!**\n` +
          `💰 ربحت **${fmt(SLOT_PRIZE)}**`
        )
        .addFields(
          { name: '💼 رصيدك الآن',       value: `**${fmt(newBal)}**`,              inline: true },
          { name: '📈 صافي الربح',        value: `**+${fmt(SLOT_PRIZE - SLOT_BET)}**`, inline: true },
          { name: '🎮 محاولات متبقية',    value: `**${newRemaining}/${SLOT_MAX_DAILY}**`, inline: true },
        )
        .setFooter({ text: 'IYNexx Slot Machine • فرصة الفوز 20%' })
        .setTimestamp();

      await interaction.editReply({ embeds: [resultEmbed], components });

    } else {
      const newBal = money.getBalance(userId, guildId);

      // تذكير إذا انتهت المحاولات
      let footerText = 'IYNexx Slot Machine • فرصة الفوز 20%';
      let warningField = null;
      if (newRemaining <= 0) {
        warningField = {
          name: '⚠️ تذكير مهم',
          value: 'يكفيك هذا اليوم! 🛑\n**القمار الحقيقي حرام** — هذا مجرد ترفيه. 🙏',
          inline: false
        };
      }

      let resultEmbed = new EmbedBuilder()
        .setColor(newRemaining <= 0 ? 0xe74c3c : 0x95a5a6)
        .setTitle('🎰 Slot Machine — 😔 خسرت')
        .setDescription(
          `╔══════════════════╗\n` +
          `║  ${reels[0]}  ║  ${reels[1]}  ║  ${reels[2]}  ║\n` +
          `╚══════════════════╝\n\n` +
          `💨 **حظاً أوفر!**`
        )
        .addFields(
          { name: '💼 رصيدك الآن',     value: `**${fmt(newBal)}**`, inline: true },
          { name: '📉 الخسارة',         value: `**-${fmt(SLOT_BET)}**`, inline: true },
          { name: '🎮 محاولات متبقية', value: `**${newRemaining}/${SLOT_MAX_DAILY}**`, inline: true },
          ...(warningField ? [warningField] : [])
        )
        .setFooter({ text: footerText })
        .setTimestamp();

      await interaction.editReply({ embeds: [resultEmbed], components });
    }
    return;
  }

  // ── زر شراء ──
  if (interaction.isButton() && interaction.customId.startsWith('buy_')) {
    const productId = interaction.customId.slice(4);
    const userId    = interaction.user.id;
    const guildId   = interaction.guildId;
    await interaction.deferReply({ ephemeral: true });
    const product = money.getProduct(productId);
    if (!product) return interaction.editReply({ content: '❌ المنتج غير موجود!' });
    if (product.soldOut || product.accounts.every(a => a.sold)) {
      await _markSoldOut(interaction.client, product, productId);
      return interaction.editReply({ content: '❌ عذراً، نفد المخزون!' });
    }
    const bal = money.getBalance(userId, guildId);
    if (bal < product.price)
      return interaction.editReply({ content: `❌ رصيدك غير كافٍ!\nرصيدك: **${fmt(bal)}** | السعر: **${fmt(product.price)}**` });
    money.deductBalance(userId, guildId, product.price);
    const account = money.purchaseProduct(productId);
    if (!account) {
      money.addBalance(userId, guildId, product.price);
      await _markSoldOut(interaction.client, product, productId);
      return interaction.editReply({ content: '❌ نفد المخزون للتو، تم إعادة رصيدك!' });
    }
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x2ecc71).setTitle('✅ تم الشراء بنجاح!')
        .setDescription(`شكراً لشرائك **${product.title}**\n\nمعلومات حسابك:`)
        .addFields(
          { name: '👤 اسم المستخدم', value: `\`${account.name}\``, inline: true },
          { name: '🔑 كلمة المرور',  value: `\`${account.psw}\``,  inline: true },
        )
        .setFooter({ text: `خُصم ${fmt(product.price)} من رصيدك` })]
    });
    await _refreshShopMessage(interaction.client, money.getProduct(productId), productId);
    return;
  }

  // ── زر المباراة ──
  if (interaction.isButton() && interaction.customId === 'join_voice') {
    const member = interaction.member;
    if (!member.voice.channel) return interaction.reply({ content: '⚠️ لازم تكون داخل Voice Channel أول!', ephemeral: true });
    try {
      const ch = interaction.guild.channels.cache.get(VOICE_CHANNEL_ID);
      await member.voice.setChannel(ch);
      await interaction.reply({ content: `✅ تم نقلك لـ **${ch.name}**!`, ephemeral: true });
    } catch {
      await interaction.reply({ content: '❌ ما قدرت أنقلك.', ephemeral: true });
    }
  }

  // ── زر اختيار الدولة ──
  if (interaction.isButton() && interaction.customId === 'open_country_select') {
    const rows = chunk(teams, 25).map((ch, i) => {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`select_team_${i}`).setPlaceholder('🌍 اختر دولتك')
        .addOptions(ch.map(t => new StringSelectMenuOptionBuilder().setLabel(t.label).setValue(t.label).setEmoji(t.emoji)));
      return new ActionRowBuilder().addComponents(menu);
    });
    await interaction.reply({ content: '👇 اختر منتخبك:', components: rows, ephemeral: true });
  }

  // ── اختيار المنتخب ──
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_team')) {
    await interaction.deferReply({ ephemeral: true });
    const selected = interaction.values[0];
    const team     = teams.find(t => t.label === selected);
    const member   = interaction.member;
    const guild    = interaction.guild;
    try {
      await member.fetch();
      let role = guild.roles.cache.find(r => r.name === team.role);
      if (!role) role = await guild.roles.create({ name: team.role, reason: 'كأس العالم 2026' });
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        return interaction.editReply({ content: `❌ تمت إزالة رتبة **${team.role}**` });
      }
      for (const t of teams) {
        const old = guild.roles.cache.find(r => r.name === t.role);
        if (old && member.roles.cache.has(old.id)) await member.roles.remove(old).catch(() => {});
      }
      await member.roles.add(role);
      await interaction.editReply({ content: `${team.emoji} تم تعيين رتبة **${team.role}** لك!` });
    } catch (err) {
      await interaction.editReply({ content: '❌ صار خطأ، حاول مرة ثانية.' });
    }
  }
});

// =================== مساعدات المتجر ===================
async function _markSoldOut(client, product, productId) {
  try {
    const ch  = await client.channels.fetch(product.channelId);
    const msg = await ch.messages.fetch(product.messageId);
    const btn = new ButtonBuilder().setCustomId(`buy_${productId}`).setLabel('❌ نفد المخزون').setStyle(ButtonStyle.Danger).setDisabled(true);
    await msg.edit({ embeds: [buildShopEmbed(money.getProduct(productId), true)], components: [new ActionRowBuilder().addComponents(btn)] });
  } catch {}
}

async function _refreshShopMessage(client, product, productId) {
  try {
    const ch  = await client.channels.fetch(product.channelId);
    const msg = await ch.messages.fetch(product.messageId);
    if (product.soldOut) {
      const btn = new ButtonBuilder().setCustomId(`buy_${productId}`).setLabel('❌ نفد المخزون').setStyle(ButtonStyle.Danger).setDisabled(true);
      await msg.edit({ embeds: [buildShopEmbed(product, true)], components: [new ActionRowBuilder().addComponents(btn)] });
    } else {
      const btn = new ButtonBuilder().setCustomId(`buy_${productId}`).setLabel(`🛒 شراء — ${fmt(product.price)}`).setStyle(ButtonStyle.Success);
      await msg.edit({ embeds: [buildShopEmbed(product, false)], components: [new ActionRowBuilder().addComponents(btn)] });
    }
  } catch {}
}

client.login(TOKEN);
