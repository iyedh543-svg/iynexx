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

// =================== الإعدادات ===================
require('dotenv').config();
const TOKEN = process.env.TOKEN;
const VOICE_CHANNEL_ID = '1516181488020750406';
const IMAGE_URL        = 'https://media.discordapp.net/attachments/1514645648010379376/1516078712553209957/worldcup_panel.png?ex=6a31fe94&is=6a30ad14&hm=2b1e5abff1618823004c5a7f4a56165260a7a5abc17ee111c5544472c45a573f&=&format=webp&quality=lossless';

const MONEY_PER_MESSAGE    = 0.01;
const MONEY_PER_VOICE_HOUR = 0.02;
const MONEY_PER_INVITE     = 1.00;
const MSG_MONEY_CD_MS      = 60_000;

// =================== Caches ===================
const msgCooldowns = new Map();
const inviteCache  = new Map(); // guildId → Map(code → uses)

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
      { name: '💰 السعر',   value: fmt(product.price),                              inline: true },
      { name: '📦 المتوفر', value: soldOut ? '❌ نفد المخزون' : `${remaining} حساب`, inline: true },
    )
    .setFooter({ text: 'IYNexx DOLLAR Store' });
}

// =================== أخطاء ===================
client.on('error', err => console.error('❌ كلاينت:', err.message));
process.on('unhandledRejection', err => console.error('❌ غير معالج:', err?.message ?? err));

// =================== جاهز ===================
client.once('ready', async () => {
  console.log(`✅ البوت شغال: ${client.user.tag}`);

  // تحميل الدعوات لكل سيرفر
  for (const guild of client.guilds.cache.values()) {
    try {
      const invites = await guild.invites.fetch();
      const map = new Map();
      invites.forEach(inv => map.set(inv.code, inv.uses));
      inviteCache.set(guild.id, map);
    } catch {}
  }
});

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

// =================== صوت ===================
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId  = newState.id || oldState.id;
  const guildId = (newState.guild || oldState.guild)?.id;
  if (!userId || !guildId) return;

  const joined = !oldState.channelId && newState.channelId;
  const left   =  oldState.channelId && !newState.channelId;

  if (joined) {
    money.startVoiceSession(userId, guildId);
  } else if (left) {
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

  // مال تلقائي من الرسائل (كل دقيقة)
  const cdKey = `${guildId}-${userId}`;
  const last  = msgCooldowns.get(cdKey) || 0;
  if (now - last >= MSG_MONEY_CD_MS) {
    msgCooldowns.set(cdKey, now);
    money.addBalance(userId, guildId, MONEY_PER_MESSAGE);
  }

  // ── /$ ── عرض الرصيد (للجميع)
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

  // ── /$:@mention مبلغ ── إضافة مال (أدمن/قائد)
  if (content.startsWith('/$:')) {
    if (!isAdmin(message.member))
      return message.reply({ content: '❌ هذا الأمر للأدمن والقائد فقط!' });

    const mentioned = message.mentions.users.first();
    if (!mentioned)
      return message.reply({ content: '⚠️ مثال: `/$:@اسم 5`' });

    const parts  = content.split(/\s+/);
    const amount = parseFloat(parts[parts.length - 1]);
    if (isNaN(amount) || amount <= 0)
      return message.reply({ content: '⚠️ أدخل مبلغاً صحيحاً!' });

    money.addBalance(mentioned.id, guildId, amount);
    const newBal = money.getBalance(mentioned.id, guildId);
    await message.delete().catch(() => {});
    return message.channel.send({
      embeds: [new EmbedBuilder().setColor(0x2ecc71)
        .setDescription(`✅ تمت إضافة **${fmt(amount)}** لـ <@${mentioned.id}>\nرصيده الآن: **${fmt(newBal)}**`)]
    });
  }

  // ── /-$:@mention مبلغ ── سحب مال (أدمن/قائد)
  if (content.startsWith('/-$:')) {
    if (!isAdmin(message.member))
      return message.reply({ content: '❌ هذا الأمر للأدمن والقائد فقط!' });

    const mentioned = message.mentions.users.first();
    if (!mentioned)
      return message.reply({ content: '⚠️ مثال: `/-$:@اسم 5`' });

    const parts  = content.split(/\s+/);
    const amount = parseFloat(parts[parts.length - 1]);
    if (isNaN(amount) || amount <= 0)
      return message.reply({ content: '⚠️ أدخل مبلغاً صحيحاً!' });

    const ok = money.deductBalance(mentioned.id, guildId, amount);
    if (!ok)
      return message.reply({ content: `❌ رصيد <@${mentioned.id}> لا يكفي!` });

    const newBal = money.getBalance(mentioned.id, guildId);
    await message.delete().catch(() => {});
    return message.channel.send({
      embeds: [new EmbedBuilder().setColor(0xe74c3c)
        .setDescription(`✅ تم سحب **${fmt(amount)}** من <@${mentioned.id}>\nرصيده الآن: **${fmt(newBal)}**`)]
    });
  }

  // ── /TR: ── إنشاء منتج في المتجر (أدمن/قائد)
  if (content.startsWith('/TR:')) {
    if (!isAdmin(message.member))
      return message.reply({ content: '❌ هذا الأمر للأدمن والقائد فقط!' });

    // استخراج الحسابات من آخر ( ... )
    const accMatch  = content.match(/\(([^)]*)\)\s*$/);
    const accStr    = accMatch ? accMatch[1] : '';
    const mainPart  = accMatch ? content.slice(0, accMatch.index).trim() : content;

    const titleMatch = mainPart.match(/\/TR:"([^"]+)"/);
    const dsMatch    = mainPart.match(/DS:"([^"]+)"/);
    const imgMatch   = mainPart.match(/IMG:"([^"]+)"/);
    const smMatch    = mainPart.match(/SM:"([^"]+)"/);

    if (!titleMatch || !dsMatch || !smMatch) {
      return message.reply({
        content:
          '⚠️ الصيغة الصحيحة:\n' +
          '`/TR:"العنوان"-DS:"الوصف"-IMG:"رابط"-SM:"السعر"(name:01/psw:123,name:02/psw:456)`\n' +
          'ملاحظة: IMG اختياري'
      });
    }

    const title    = titleMatch[1];
    const desc     = dsMatch[1];
    const imageUrl = imgMatch ? imgMatch[1] : '';
    const price    = parseFloat(smMatch[1]);
    const accounts = parseAccounts(accStr);

    if (isNaN(price) || price <= 0)
      return message.reply({ content: '⚠️ السعر يجب أن يكون رقماً موجباً!' });
    if (accounts.length === 0)
      return message.reply({ content: '⚠️ أضف حسابات بين ( ) بصيغة `name:01/psw:123,name:02/psw:456`' });

    const productId = randomUUID();
    money.createProduct(productId, guildId, { title, description: desc, imageUrl, price, accounts });

    const product = money.getProduct(productId);
    const embed   = buildShopEmbed(product, false);
    const buyBtn  = new ButtonBuilder()
      .setCustomId(`buy_${productId}`)
      .setLabel(`🛒 شراء — ${fmt(price)}`)
      .setStyle(ButtonStyle.Success);

    const row  = new ActionRowBuilder().addComponents(buyBtn);
    const sent = await message.channel.send({ embeds: [embed], components: [row] });
    money.updateProductMessage(productId, sent.id, sent.channelId);
    await message.delete().catch(() => {});
    return;
  }

  // ── /BN ──
  if (content === '/BN') {
    const btn = new ButtonBuilder()
      .setCustomId('join_voice')
      .setLabel('⚽ • بث المباراة هنا • ⚽')
      .setStyle(ButtonStyle.Success);
    await message.channel.send({ content: '||@everyone||', components: [new ActionRowBuilder().addComponents(btn)] });
    await message.delete().catch(() => {});
  }

  // ── /your.country ──
  if (content === '/your.country') {
    const embed = new EmbedBuilder()
      .setColor(0x1a56db)
      .setImage(IMAGE_URL)
      .setTitle('🏆 كأس العالم 2026')
      .setDescription('**اضغط على الزر أدناه واختر منتخبك**\n\n*اختر نفس المنتخب مرة ثانية لإزالة الرتبة*');
    const btn = new ButtonBuilder().setCustomId('open_country_select').setLabel('🌍 اختر دولتك').setStyle(ButtonStyle.Primary);
    await message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
    await message.delete().catch(() => {});
  }

  // ── /Tn: ──
  if (content.startsWith('/Tn:')) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply({ content: '❌ هذا الأمر للأدمن فقط!' });
    const mentioned = message.mentions.users.first();
    if (!mentioned)
      return message.reply({ content: '⚠️ لازم تذكر شخص! مثال: `/Tn: @iyed`' });
    await message.delete().catch(() => {});
    await message.channel.send({
      content:
        `||@everyone|| | <@${mentioned.id}>\n\n` +
        `⚠️ **تحذير رسمي** ⚠️\n\n` +
        `> 🚨 <@${mentioned.id}> **أنت تخالف قوانين السيرفر**\n` +
        `> ⚡ هذا تحذير رسمي، الاستمرار يعرضك للطرد!`
    });
  }

  // ── /help ──
  if (content === '/help') {
    if (!message.member.permissions.has('Administrator'))
      return message.reply({ content: '❌ هذا الأمر للأدمن فقط!' });
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🤖 أوامر البوت')
      .setDescription('━━━━━━━━━━━━━━━━━━━━━━')
      .addFields(
        { name: '⚽ `/BN`',           value: 'يرسل زر بث المباراة مع @everyone' },
        { name: '🏆 `/your.country`', value: 'يرسل زر اختيار المنتخب' },
        { name: '⚠️ `/Tn: @شخص`',    value: 'يرسل تحذير رسمي (أدمن)' },
        { name: '🔧 `/help`',         value: 'يعرض هذه القائمة (أدمن)' },
        { name: '💰 `/$`',            value: 'عرض رصيدك — للجميع' },
        { name: '➕ `/$:@شخص مبلغ`', value: 'إضافة مال (أدمن/قائد)' },
        { name: '➖ `/-$:@شخص مبلغ`','value': 'سحب مال (أدمن/قائد)' },
        { name: '🛒 `/TR:"عنوان"-DS:"وصف"-IMG:"رابط"-SM:"سعر"(حسابات)`',
          value: 'إنشاء منتج — (أدمن/قائد)\nمثال: `(name:01/psw:123,name:02/psw:456)`' },
      );
    await message.channel.send({ embeds: [embed] });
    await message.delete().catch(() => {});
  }
});

// =================== التفاعلات ===================
client.on('interactionCreate', async (interaction) => {

  // ── زر شراء ──
  if (interaction.isButton() && interaction.customId.startsWith('buy_')) {
    const productId = interaction.customId.slice(4);
    const userId    = interaction.user.id;
    const guildId   = interaction.guildId;

    await interaction.deferReply({ ephemeral: true });

    const product = money.getProduct(productId);
    if (!product)
      return interaction.editReply({ content: '❌ المنتج غير موجود!' });

    // نفد المخزون
    if (product.soldOut || product.accounts.every(a => a.sold)) {
      await _markSoldOut(interaction.client, product, productId);
      return interaction.editReply({ content: '❌ عذراً، نفد المخزون من هذا المنتج!' });
    }

    // رصيد غير كافٍ
    const bal = money.getBalance(userId, guildId);
    if (bal < product.price) {
      return interaction.editReply({
        content: `❌ رصيدك غير كافٍ!\nرصيدك: **${fmt(bal)}** | السعر: **${fmt(product.price)}**`
      });
    }

    // خصم وإعطاء حساب
    money.deductBalance(userId, guildId, product.price);
    const account = money.purchaseProduct(productId);

    if (!account) {
      // نفد بالتزامن — أعد الفلوس
      money.addBalance(userId, guildId, product.price);
      await _markSoldOut(interaction.client, product, productId);
      return interaction.editReply({ content: '❌ نفد المخزون للتو، تم إعادة رصيدك!' });
    }

    // أرسل الحساب للمشتري
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ تم الشراء بنجاح!')
        .setDescription(`شكراً لشرائك **${product.title}**\n\nمعلومات حسابك:`)
        .addFields(
          { name: '👤 اسم المستخدم', value: `\`${account.name}\``, inline: true },
          { name: '🔑 كلمة المرور',  value: `\`${account.psw}\``,  inline: true },
        )
        .setFooter({ text: `خُصم ${fmt(product.price)} من رصيدك` })]
    });

    // تحديث رسالة المتجر
    const updated = money.getProduct(productId);
    await _refreshShopMessage(interaction.client, updated, productId);
    return;
  }

  // ── زر المباراة ──
  if (interaction.isButton() && interaction.customId === 'join_voice') {
    const member = interaction.member;
    if (!member.voice.channel)
      return interaction.reply({ content: '⚠️ لازم تكون داخل أي Voice Channel أول!', ephemeral: true });
    try {
      const ch = interaction.guild.channels.cache.get(VOICE_CHANNEL_ID);
      await member.voice.setChannel(ch);
      await interaction.reply({ content: `✅ تم نقلك لـ **${ch.name}**!`, ephemeral: true });
    } catch {
      await interaction.reply({ content: '❌ ما قدرت أنقلك، تأكد من صلاحيات البوت.', ephemeral: true });
    }
  }

  // ── زر اختيار الدولة ──
  if (interaction.isButton() && interaction.customId === 'open_country_select') {
    const rows = chunk(teams, 25).map((ch, i) => {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`select_team_${i}`)
        .setPlaceholder('🌍 اختر دولتك من هنا')
        .addOptions(ch.map(t =>
          new StringSelectMenuOptionBuilder().setLabel(t.label).setValue(t.label).setEmoji(t.emoji)
        ));
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
      if (!role) role = await guild.roles.create({ name: team.role, reason: 'رتبة منتخب كأس العالم 2026' });

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
      console.error('❌ اختيار المنتخب:', err.message);
      await interaction.editReply({ content: '❌ صار خطأ، حاول مرة ثانية.' });
    }
  }
});

// =================== مساعدات المتجر ===================
async function _markSoldOut(client, product, productId) {
  try {
    const ch  = await client.channels.fetch(product.channelId);
    const msg = await ch.messages.fetch(product.messageId);
    const btn = new ButtonBuilder()
      .setCustomId(`buy_${productId}`)
      .setLabel('❌ نفد المخزون')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true);
    const p = money.getProduct(productId);
    await msg.edit({ embeds: [buildShopEmbed(p, true)], components: [new ActionRowBuilder().addComponents(btn)] });
  } catch {}
}

async function _refreshShopMessage(client, product, productId) {
  try {
    const ch  = await client.channels.fetch(product.channelId);
    const msg = await ch.messages.fetch(product.messageId);
    if (product.soldOut) {
      const btn = new ButtonBuilder()
        .setCustomId(`buy_${productId}`)
        .setLabel('❌ نفد المخزون')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true);
      await msg.edit({ embeds: [buildShopEmbed(product, true)], components: [new ActionRowBuilder().addComponents(btn)] });
    } else {
      const btn = new ButtonBuilder()
        .setCustomId(`buy_${productId}`)
        .setLabel(`🛒 شراء — ${fmt(product.price)}`)
        .setStyle(ButtonStyle.Success);
      await msg.edit({ embeds: [buildShopEmbed(product, false)], components: [new ActionRowBuilder().addComponents(btn)] });
    }
  } catch {}
}

client.login(TOKEN);
