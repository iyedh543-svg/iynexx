'use strict';
/**
 * إدارة جلسات الشكوبة: التحديات المعلّقة (بانتظار "مواجهة") واللعبات
 * الجارية. كل هذا منفصل تماماً عن أنظمة البوت الأخرى.
 */

const { ChkobbaGame, TURN_TIMEOUT_MS } = require('./gameEngine');

class GameManager {
  constructor() {
    /** @type {Map<string, {hostId:string, channelId:string, timeout:NodeJS.Timeout}>} messageId -> pending challenge */
    this.pendingChallenges = new Map();
    /** @type {Map<string, ChkobbaGame>} messageId -> جلسة لعب جارية */
    this.activeGames = new Map();
    /** @type {Map<string, string>} userId -> messageId (لمنع اللاعب من فتح أكثر من لعبة بنفس الوقت) */
    this.userToGame = new Map();
  }

  createChallenge(hostId, channelId, messageId) {
    this.pendingChallenges.set(messageId, { hostId, channelId, createdAt: Date.now() });
  }

  getChallenge(messageId) {
    return this.pendingChallenges.get(messageId);
  }

  removeChallenge(messageId) {
    this.pendingChallenges.delete(messageId);
  }

  isUserBusy(userId) {
    return this.userToGame.has(userId);
  }

  startGame(messageId, hostId, opponentId) {
    const game = new ChkobbaGame(hostId, opponentId);
    this.activeGames.set(messageId, game);
    this.userToGame.set(hostId, messageId);
    this.userToGame.set(opponentId, messageId);
    return game;
  }

  getGame(messageId) {
    return this.activeGames.get(messageId);
  }

  getGameByUser(userId) {
    const messageId = this.userToGame.get(userId);
    if (!messageId) return null;
    return { messageId, game: this.activeGames.get(messageId) };
  }

  endGame(messageId) {
    const game = this.activeGames.get(messageId);
    if (game) {
      for (const pid of game.order) this.userToGame.delete(pid);
    }
    this.activeGames.delete(messageId);
  }
}

module.exports = { GameManager, TURN_TIMEOUT_MS };
