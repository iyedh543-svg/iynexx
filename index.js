'use strict';
/**
 * كل ما يخص بناء الـ Embeds والأزرار وقوائم الاختيار الخاصة بالشكوبة.
 * لا يحتوي هذا الملف على أي منطق لعبة، فقط "واجهة عرض".
 */

const path = require('path');
const {
  EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, AttachmentBuilder,
} = require('discord.js');

const { SUIT_LABELS_AR, SUIT_EMOJI } = require('./cards');

const CARDS_DIR = path.join(__dirname, '..', 'assets', 'cards');
const COLOR_MAIN = 0x1abc9c;
const COLOR_TURN = 0x3498db;
const COLOR_END = 0xf1c40f;
const COLOR_ABORT = 0xe74c3c;

function cardAttachment(card) {
  const filePath = path.join(CARDS_DIR, card.imageName);
  return new AttachmentBuilder(filePath, { name: card.imageName });
}

/** بطاقة "ابدأ تحدياً" الأولية */
function buildLobbyEmbed(hostId) {
  return new EmbedBuilder()
    .setColor(COLOR_MAIN)
    .setTitle('🃏 تحدي الشكوبة التونسية')
    .setDescription(
      `<@${hostId}> يبحث عن خصم!\n\n` +
      `> اضغط الزر أدناه لقبول المواجهة.\n` +
      `> اللعبة بين لاعبين فقط، ولا يمكن لأي شخص ثالث المشاركة.`
    )
    .setFooter({ text: 'IYNexx • Chkobba Tunisienne' })
    .setTimestamp();
}

function buildJoinRow(hostId) {
  const btn = new ButtonBuilder()
    .setCustomId(`chkobba_join_${hostId}`)
    .setLabel('⚔️ مواجهة')
    .setStyle(ButtonStyle.Success);
  return new ActionRowBuilder().addComponents(btn);
}

/**
 * يبني الحالة العامة للعبة (اللوحة العامة التي يراها الجميع): معلومات
 * الدور، النقاط الحالية، سجل آخر الأحداث، وصور أوراق الطاولة.
 */
function buildPublicGameView(game, messageId) {
  const embeds = [];
  const files = [];

  const p1 = game.order[0];
  const p2 = game.order[1];
  const s1 = game.players[p1];
  const s2 = game.players[p2];

  const main = new EmbedBuilder()
    .setColor(COLOR_TURN)
    .setTitle('🃏 الشكوبة التونسية — اللعبة جارية')
    .addFields(
      { name: '👤 اللاعبون', value: `<@${p1}> ⚔️ <@${p2}>`, inline: false },
      {
        name: '📊 النقاط الحالية',
        value:
          `<@${p1}> — 🧹 شكوبة: **${s1.scope}** | 🎴 أوراق: **${s1.captured.length}**\n` +
          `<@${p2}> — 🧹 شكوبة: **${s2.scope}** | 🎴 أوراق: **${s2.captured.length}**`,
        inline: false,
      },
      { name: '🀄 الدور الحالي', value: `<@${game.currentPlayerId}>`, inline: true },
      { name: '📦 الرزمة المتبقية', value: `${game.deck.length} ورقة`, inline: true },
    )
    .setDescription(
      game.table.length > 0
        ? `**🪑 أوراق الطاولة (${game.table.length}):**\n` + game.table.map(c => `\`${c.shortLabel}\``).join('  ')
        : '**🪑 الطاولة فارغة حالياً**'
    )
    .setFooter({ text: 'IYNexx • Chkobba Tunisienne' })
    .setTimestamp();

  if (game.log.length > 0) {
    main.addFields({ name: '📜 آخر الأحداث', value: game.log.slice(-4).join('\n') });
  }

  embeds.push(main);

  // صورة كل ورقة على الطاولة كـ Embed مصغّر منفصل (ليعرض الصورة الفعلية)
  for (const card of game.table.slice(0, 8)) {
    const att = cardAttachment(card);
    files.push(att);
    embeds.push(
      new EmbedBuilder()
        .setColor(COLOR_MAIN)
        .setTitle(`${SUIT_EMOJI[card.suit]} ${card.shortLabel}`)
        .setThumbnail(`attachment://${card.imageName}`)
    );
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`chkobba_hand_${messageId}`)
      .setLabel('🃏 عرض يدي واللعب')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`chkobba_quit_${messageId}`)
      .setLabel('🚪 الانسحاب من اللعبة')
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds, files, components: [row] };
}

/**
 * يبني عرض يد اللاعب (رسالة سرّية Ephemeral) مع قائمة اختيار الورقة
 */
function buildHandView(game, playerId, messageId) {
  const player = game.players[playerId];
  const embeds = [];
  const files = [];

  const main = new EmbedBuilder()
    .setColor(COLOR_TURN)
    .setTitle('🃏 يدك الحالية')
    .setDescription('اختر ورقة من القائمة أدناه للعبها:')
    .setFooter({ text: 'هذه الرسالة تظهر لك فقط' });
  embeds.push(main);

  for (const card of player.hand) {
    const att = cardAttachment(card);
    files.push(att);
    embeds.push(
      new EmbedBuilder()
        .setColor(COLOR_MAIN)
        .setTitle(`${SUIT_EMOJI[card.suit]} ${card.shortLabel}`)
        .setThumbnail(`attachment://${card.imageName}`)
    );
  }

  const options = player.hand.map(card =>
    new StringSelectMenuOptionBuilder()
      .setLabel(card.label)
      .setValue(card.id)
      .setEmoji(SUIT_EMOJI[card.suit])
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId(`chkobba_play_${messageId}`)
    .setPlaceholder('🎴 اختر ورقة لتلعبها')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(select);
  return { embeds, files, components: [row] };
}

/**
 * يبني قائمة اختيار التوليفة عندما توجد أكثر من طريقة للأخذ
 */
function buildComboSelect(messageId, cardId, options) {
  const menuOptions = options.map((combo, idx) => {
    const label = combo.map(c => c.shortLabel).join(' + ');
    const sum = combo.reduce((s, c) => s + c.value, 0);
    return new StringSelectMenuOptionBuilder()
      .setLabel(`أخذ: ${label} (=${sum})`)
      .setValue(String(idx));
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId(`chkobba_combo_${messageId}_${cardId}`)
    .setPlaceholder('🧩 اختر التوليفة التي تريد أخذها')
    .addOptions(menuOptions);

  const embed = new EmbedBuilder()
    .setColor(COLOR_TURN)
    .setTitle('🧩 أكثر من طريقة للأخذ!')
    .setDescription('اختر التوليفة التي تريد أخذها من الطاولة:');

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] };
}

/** نتيجة نهاية اللعبة (نقاط كاملة) */
function buildFinalResultEmbed(game) {
  const { summary, winnerId, order } = game.result;
  const embed = new EmbedBuilder()
    .setColor(COLOR_END)
    .setTitle('🏁 انتهت لعبة الشكوبة!')
    .setTimestamp()
    .setFooter({ text: 'IYNexx • Chkobba Tunisienne' });

  for (const pid of order) {
    const s = summary[pid];
    const lines = [
      `🧹 شكوبة: **${s.scope}** نقطة`,
      `🎴 أكثر أوراق: ${s.wonCarte ? '✅ +1' : '—'}`,
      `🟡 أكثر ديناري: ${s.wonDenari ? '✅ +1' : '—'}`,
      `💎 سبعة ديناري: ${s.setteBello ? '✅ +1' : '—'}`,
      `🃏 البريم: ${s.wonPrimiera ? `✅ +1 (${s.primieraTotal})` : `— (${s.primieraTotal})`}`,
      `**المجموع: ${s.points} نقطة**`,
    ];
    embed.addFields({ name: `👤 <@${pid}>`, value: lines.join('\n'), inline: true });
  }

  embed.setDescription(
    winnerId ? `🏆 الفائز: <@${winnerId}>` : '🤝 تعادل!'
  );

  return embed;
}

function buildAbortEmbed(reason, byUserId) {
  const reasons = {
    timeout: '⏳ انتهت اللعبة بسبب انتهاء وقت أحد اللاعبين.',
    left: `🚪 انسحب <@${byUserId}> من اللعبة، تم إلغاء المباراة.`,
    error: '⚠️ حدث خطأ غير متوقع، تم إلغاء المباراة.',
  };
  return new EmbedBuilder()
    .setColor(COLOR_ABORT)
    .setTitle('❌ تم إلغاء اللعبة')
    .setDescription(reasons[reason] || 'تم إلغاء اللعبة.')
    .setFooter({ text: 'IYNexx • Chkobba Tunisienne' });
}

module.exports = {
  cardAttachment,
  buildLobbyEmbed,
  buildJoinRow,
  buildPublicGameView,
  buildHandView,
  buildComboSelect,
  buildFinalResultEmbed,
  buildAbortEmbed,
};
