// Money.js — IYNexx DOLLAR System
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'money.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS money (
    userId  TEXT NOT NULL,
    guildId TEXT NOT NULL,
    balance REAL DEFAULT 0,
    PRIMARY KEY (userId, guildId)
  );
  CREATE TABLE IF NOT EXISTS voice_sessions (
    userId   TEXT NOT NULL,
    guildId  TEXT NOT NULL,
    joinedAt INTEGER NOT NULL,
    PRIMARY KEY (userId, guildId)
  );
  CREATE TABLE IF NOT EXISTS shop_products (
    productId   TEXT PRIMARY KEY,
    guildId     TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    imageUrl    TEXT DEFAULT '',
    price       REAL NOT NULL,
    accounts    TEXT NOT NULL,
    soldOut     INTEGER DEFAULT 0,
    messageId   TEXT DEFAULT '',
    channelId   TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS levels (
    userId  TEXT NOT NULL,
    guildId TEXT NOT NULL,
    xp      REAL DEFAULT 0,
    level   INTEGER DEFAULT 0,
    PRIMARY KEY (userId, guildId)
  );
`);

// ===== رصيد =====
function getBalance(userId, guildId) {
  try {
    const row = db.prepare('SELECT balance FROM money WHERE userId=? AND guildId=?').get(userId, guildId);
    if (!row) {
      db.prepare('INSERT OR IGNORE INTO money (userId,guildId,balance) VALUES (?,?,0)').run(userId, guildId);
      return 0;
    }
    return row.balance;
  } catch { return 0; }
}

function addBalance(userId, guildId, amount) {
  try {
    db.prepare(`
      INSERT INTO money (userId,guildId,balance) VALUES (?,?,?)
      ON CONFLICT(userId,guildId) DO UPDATE SET balance = balance + excluded.balance
    `).run(userId, guildId, amount);
  } catch {}
}

function setBalance(userId, guildId, amount) {
  try {
    db.prepare(`
      INSERT INTO money (userId,guildId,balance) VALUES (?,?,?)
      ON CONFLICT(userId,guildId) DO UPDATE SET balance = excluded.balance
    `).run(userId, guildId, amount);
  } catch {}
}

function deductBalance(userId, guildId, amount) {
  try {
    const bal = getBalance(userId, guildId);
    if (bal < amount) return false;
    setBalance(userId, guildId, bal - amount);
    return true;
  } catch { return false; }
}

// ===== جلسات الصوت =====
function startVoiceSession(userId, guildId) {
  try {
    db.prepare('INSERT OR REPLACE INTO voice_sessions (userId,guildId,joinedAt) VALUES (?,?,?)').run(userId, guildId, Date.now());
  } catch {}
}

function endVoiceSession(userId, guildId) {
  try {
    const row = db.prepare('SELECT joinedAt FROM voice_sessions WHERE userId=? AND guildId=?').get(userId, guildId);
    if (!row) return 0;
    db.prepare('DELETE FROM voice_sessions WHERE userId=? AND guildId=?').run(userId, guildId);
    return (Date.now() - row.joinedAt) / 3_600_000;
  } catch { return 0; }
}

// ===== المتجر =====
function createProduct(productId, guildId, { title, description, imageUrl, price, accounts }) {
  try {
    const parsed = accounts.map(a => ({ ...a, sold: false }));
    db.prepare(`
      INSERT INTO shop_products (productId,guildId,title,description,imageUrl,price,accounts,soldOut)
      VALUES (?,?,?,?,?,?,?,0)
    `).run(productId, guildId, title, description, imageUrl || '', price, JSON.stringify(parsed));
  } catch {}
}

function getProduct(productId) {
  try {
    const row = db.prepare('SELECT * FROM shop_products WHERE productId=?').get(productId);
    if (!row) return null;
    row.accounts = JSON.parse(row.accounts);
    return row;
  } catch { return null; }
}

function purchaseProduct(productId) {
  try {
    const row = db.prepare('SELECT * FROM shop_products WHERE productId=?').get(productId);
    if (!row) return null;
    const accounts = JSON.parse(row.accounts);
    const idx = accounts.findIndex(a => !a.sold);
    if (idx === -1) {
      db.prepare('UPDATE shop_products SET soldOut=1 WHERE productId=?').run(productId);
      return null;
    }
    accounts[idx].sold = true;
    const remaining = accounts.filter(a => !a.sold).length;
    db.prepare('UPDATE shop_products SET accounts=?, soldOut=? WHERE productId=?')
      .run(JSON.stringify(accounts), remaining === 0 ? 1 : 0, productId);
    return accounts[idx];
  } catch { return null; }
}

function updateProductMessage(productId, messageId, channelId) {
  try {
    db.prepare('UPDATE shop_products SET messageId=?, channelId=? WHERE productId=?').run(messageId, channelId, productId);
  } catch {}
}

function getAllBalances(guildId) {
  try {
    return db.prepare(
      'SELECT userId, balance FROM money WHERE guildId = ? ORDER BY balance DESC LIMIT 10'
    ).all(guildId);
  } catch { return []; }
}

// ===== نظام اللفلات =====

// XP المطلوب للفل التالي: 100 * (level + 1)^1.5
function xpForNextLevel(level) {
  return Math.floor(100 * Math.pow(level + 1, 1.5));
}

// إضافة XP وإرجاع { leveledUp, oldLevel, newLevel } إذا رُفع اللفل
function addXp(userId, guildId, xpAmount) {
  try {
    db.prepare(`
      INSERT INTO levels (userId,guildId,xp,level) VALUES (?,?,0,0)
      ON CONFLICT(userId,guildId) DO NOTHING
    `).run(userId, guildId);

    let row = db.prepare('SELECT xp, level FROM levels WHERE userId=? AND guildId=?').get(userId, guildId);
    let xp    = (row?.xp    ?? 0) + xpAmount;
    let level = (row?.level ?? 0);
    const oldLevel = level;

    while (xp >= xpForNextLevel(level)) {
      xp -= xpForNextLevel(level);
      level++;
    }

    db.prepare('UPDATE levels SET xp=?, level=? WHERE userId=? AND guildId=?').run(xp, level, userId, guildId);

    if (level > oldLevel) return { leveledUp: true, oldLevel, newLevel: level };
    return { leveledUp: false };
  } catch { return { leveledUp: false }; }
}

function getLevelData(userId, guildId) {
  try {
    const row = db.prepare('SELECT xp, level FROM levels WHERE userId=? AND guildId=?').get(userId, guildId);
    if (!row) return { xp: 0, level: 0, xpNeeded: xpForNextLevel(0) };
    return { xp: row.xp, level: row.level, xpNeeded: xpForNextLevel(row.level) };
  } catch { return { xp: 0, level: 0, xpNeeded: xpForNextLevel(0) }; }
}

module.exports = {
  getBalance, addBalance, setBalance, deductBalance,
  startVoiceSession, endVoiceSession,
  createProduct, getProduct, purchaseProduct, updateProductMessage,
  getAllBalances,
  addXp, getLevelData, xpForNextLevel,
};
