import { Injectable } from '@nestjs/common';
import { RoomRepository } from './room.repository';
import {
  Room,
  Player,
  NightActions,
  GamePhase,
} from './interfaces/room.interface';
import { CHARACTERS, getCharacterById } from '../characters/characters.data';

@Injectable()
export class GameService {
  constructor(private readonly roomRepo: RoomRepository) {}

  // ── Kod üretimi ──────────────────────────────────────────────────────────
  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  private async uniqueCode(): Promise<string> {
    let code = this.generateCode();
    let tries = 0;
    while ((await this.roomRepo.exists(code)) && tries < 20) {
      code = this.generateCode();
      tries++;
    }
    return code;
  }

  // ── Oda işlemleri ────────────────────────────────────────────────────────
  async createRoom(hostId: string, nickname: string): Promise<Room> {
    const code = await this.uniqueCode();
    const host: Player = {
      id: hostId,
      nickname,
      characterId: null,
      isAlive: true,
      isHost: true,
      connectedAt: Date.now(),
    };
    const room: Room = {
      code,
      hostId,
      players: { [hostId]: host },
      phase: 'lobby',
      round: 0,
      selectedCharacters: ['vampire', 'villager', 'villager', 'detective'],
      dayDurationSeconds: 120,
      nightDurationSeconds: 40,
      votes: null,
      nightActions: this.emptyNightActions(),
      eliminatedThisRound: [],
      winner: null,
      winnerPlayerId: null,
      phaseDeadline: null,
      detectiveResults: {},
    };
    await this.roomRepo.save(room);
    return room;
  }

  async joinRoom(
    code: string,
    playerId: string,
    nickname: string,
  ): Promise<Room | { error: string }> {
    const room = await this.roomRepo.findByCode(code.toUpperCase());
    if (!room) return { error: 'Oda bulunamadı.' };
    if (room.phase !== 'lobby') return { error: 'Oyun zaten başladı.' };
    if (Object.keys(room.players).length >= 20)
      return { error: 'Oda dolu (maks 20 oyuncu).' };

    // Nickname çakışması kontrolü
    const taken = Object.values(room.players).some(
      (p) => p.nickname.toLowerCase() === nickname.toLowerCase(),
    );
    if (taken) return { error: 'Bu isim zaten alınmış.' };

    room.players[playerId] = {
      id: playerId,
      nickname,
      characterId: null,
      isAlive: true,
      isHost: false,
      connectedAt: Date.now(),
    };
    await this.roomRepo.save(room);
    return room;
  }

  async removePlayer(code: string, playerId: string): Promise<Room | null> {
    const room = await this.roomRepo.findByCode(code);
    if (!room) return null;
    delete room.players[playerId];

    // Eğer host ayrıldıysa başka birine devret
    if (room.hostId === playerId) {
      const remaining = Object.values(room.players);
      if (remaining.length === 0) {
        await this.roomRepo.delete(code);
        return null;
      }
      const newHost = remaining[0];
      newHost.isHost = true;
      room.hostId = newHost.id;
    }
    await this.roomRepo.save(room);
    return room;
  }

  async rejoinLobbyRoom(
    code: string,
    nextPlayerId: string,
    nickname: string,
  ): Promise<{ room: Room; previousPlayerId: string } | { error: string }> {
    const room = await this.roomRepo.findByCode(code.toUpperCase());
    if (!room) return { error: 'Oda bulunamadı.' };
    if (room.phase !== 'lobby') {
      return { error: 'Lobi dışında yeniden bağlanma henüz desteklenmiyor.' };
    }

    const existingPlayer = Object.values(room.players).find(
      (player) => player.nickname.toLowerCase() === nickname.toLowerCase(),
    );

    if (!existingPlayer) {
      return { error: 'Oyuncu bulunamadı. Odaya yeniden katıl.' };
    }

    const previousPlayerId = existingPlayer.id;
    if (previousPlayerId !== nextPlayerId) {
      delete room.players[previousPlayerId];
      room.players[nextPlayerId] = {
        ...existingPlayer,
        id: nextPlayerId,
        connectedAt: Date.now(),
      };

      if (room.hostId === previousPlayerId || existingPlayer.isHost) {
        room.hostId = nextPlayerId;
      }
    } else {
      room.players[nextPlayerId] = {
        ...existingPlayer,
        connectedAt: Date.now(),
      };
    }

    await this.roomRepo.save(room);
    return { room, previousPlayerId };
  }

  async updateSettings(
    code: string,
    hostId: string,
    settings: { selectedCharacters?: string[]; dayDurationSeconds?: number; nightDurationSeconds?: number },
  ): Promise<Room | { error: string }> {
    const room = await this.roomRepo.findByCode(code);
    if (!room) return { error: 'Oda bulunamadı.' };
    if (room.hostId !== hostId) return { error: 'Sadece oda sahibi ayarları değiştirebilir.' };

    if (settings.selectedCharacters !== undefined)
      room.selectedCharacters = settings.selectedCharacters;
    if (settings.dayDurationSeconds !== undefined)
      room.dayDurationSeconds = settings.dayDurationSeconds;
    if (settings.nightDurationSeconds !== undefined)
      room.nightDurationSeconds = settings.nightDurationSeconds;

    await this.roomRepo.save(room);
    return room;
  }

  // ── Oyun başlatma ─────────────────────────────────────────────────────────
  async startGame(code: string, hostId: string): Promise<Room | { error: string }> {
    const room = await this.roomRepo.findByCode(code);
    if (!room) return { error: 'Oda bulunamadı.' };
    if (room.hostId !== hostId) return { error: 'Sadece oda sahibi oyunu başlatabilir.' };

    const playerList = Object.values(room.players);
    if (playerList.length < 4) return { error: 'En az 4 oyuncu gerekli.' };

    const charPool = [...room.selectedCharacters];
    if (charPool.length !== playerList.length)
      return { error: `Karakter sayısı (${charPool.length}) oyuncu sayısıyla (${playerList.length}) eşleşmiyor.` };

    // Karıştır ve ata
    const shuffled = this.shuffle(charPool);
    const shuffledPlayers = this.shuffle(playerList);
    shuffledPlayers.forEach((p, i) => {
      p.characterId = shuffled[i];
      // Cadı için iksir durumu
      if (shuffled[i] === 'witch') {
        p.hasKillPotion = true;
        p.hasSavePotion = true;
      }
      if (shuffled[i] === 'hunter') {
        p.hasShot = true;
      }
      room.players[p.id] = p;
    });

    room.phase = 'role_reveal';
    room.round = 1;
    await this.roomRepo.save(room);
    return room;
  }

  // ── Gündüz ──────────────────────────────────────────────────────────────
  async startDay(code: string): Promise<Room | null> {
    const room = await this.roomRepo.findByCode(code);
    if (!room) return null;
    room.phase = 'day_discussion';
    room.eliminatedThisRound = [];
    room.phaseDeadline = Date.now() + room.dayDurationSeconds * 1000;
    await this.roomRepo.save(room);
    return room;
  }

  async startVoting(code: string): Promise<Room | null> {
    const room = await this.roomRepo.findByCode(code);
    if (!room) return null;
    room.phase = 'day_vote';
    room.votes = {
      votes: {},
      deadline: Date.now() + 60_000, // 60 sn oy süresi
    };
    room.phaseDeadline = room.votes.deadline;
    await this.roomRepo.save(room);
    return room;
  }

  async castVote(
    code: string,
    voterId: string,
    targetId: string,
  ): Promise<Room | { error: string }> {
    const room = await this.roomRepo.findByCode(code);
    if (!room) return { error: 'Oda bulunamadı.' };
    if (room.phase !== 'day_vote') return { error: 'Şu an oy zamanı değil.' };
    const voter = room.players[voterId];
    const target = room.players[targetId];
    if (!voter || !voter.isAlive) return { error: 'Oy veremezsin.' };
    if (!target || !target.isAlive) return { error: 'Bu oyuncu zaten elinde.' };

    room.votes!.votes[voterId] = targetId;
    await this.roomRepo.save(room);
    return room;
  }

  async resolveVotes(code: string): Promise<{ room: Room; eliminated: Player | null }> {
    const room = await this.roomRepo.findByCode(code);
    if (!room) return { room: null as any, eliminated: null };

    const alivePlayers = Object.values(room.players).filter((p) => p.isAlive);
    const voteCount: Record<string, number> = {};
    alivePlayers.forEach((p) => (voteCount[p.id] = 0));

    if (room.votes) {
      Object.values(room.votes.votes).forEach((targetId) => {
        if (voteCount[targetId] !== undefined) voteCount[targetId]++;
      });
    }

    // En çok oyu alan oyuncu
    let eliminated: Player | null = null;
    let maxVotes = 0;
    let tie = false;
    for (const [pid, count] of Object.entries(voteCount)) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminated = room.players[pid];
        tie = false;
      } else if (count === maxVotes && count > 0) {
        tie = true;
      }
    }

    if (tie) eliminated = null; // Beraberlikte kimse elenmez

    if (eliminated) {
      eliminated.isAlive = false;
      room.eliminatedThisRound.push(eliminated.id);
      room.players[eliminated.id] = eliminated;

      // Joker kazanma kontrolü (linç edildi mi?)
      if (eliminated.characterId === 'jester') {
        room.winner = 'neutral';
        room.winnerPlayerId = eliminated.id;
      }
    }

    room.votes = null;
    room.phase = eliminated?.characterId === 'jester' ? 'game_over' : 'night';

    // Kazanma kontrolü
    if (!room.winner) {
      const check = this.checkWinCondition(room);
      if (check) {
        room.winner = check;
        room.phase = 'game_over';
      }
    }

    if (room.phase !== 'game_over') {
      room.nightActions = this.emptyNightActions();
      room.phaseDeadline = Date.now() + room.nightDurationSeconds * 1000;
    }

    await this.roomRepo.save(room);
    return { room, eliminated };
  }

  // ── Gece ────────────────────────────────────────────────────────────────
  async submitNightAction(
    code: string,
    playerId: string,
    action: {
      type: 'vampire_kill' | 'doctor_save' | 'detective_query' | 'witch_kill' | 'witch_save' | 'pass';
      targetId?: string;
    },
  ): Promise<Room | { error: string }> {
    const room = await this.roomRepo.findByCode(code);
    if (!room) return { error: 'Oda bulunamadı.' };
    if (room.phase !== 'night') return { error: 'Şu an gece değil.' };

    const player = room.players[playerId];
    if (!player || !player.isAlive) return { error: 'Bu aksiyonu yapamazsın.' };

    switch (action.type) {
      case 'vampire_kill':
        if (player.characterId !== 'vampire') return { error: 'Sen vampir değilsin.' };
        room.nightActions.vampireTarget = action.targetId || null;
        break;
      case 'doctor_save':
        if (player.characterId !== 'doctor') return { error: 'Sen doktor değilsin.' };
        room.nightActions.doctorTarget = action.targetId || null;
        break;
      case 'detective_query':
        if (player.characterId !== 'detective') return { error: 'Sen dedektif değilsin.' };
        room.nightActions.detectiveTarget = action.targetId || null;
        break;
      case 'witch_kill':
        if (player.characterId !== 'witch') return { error: 'Sen cadı değilsin.' };
        if (!player.hasKillPotion) return { error: 'Öldürme iksirlerin kalmadı.' };
        room.nightActions.witchKillTarget = action.targetId || null;
        player.hasKillPotion = false;
        room.players[playerId] = player;
        break;
      case 'witch_save':
        if (player.characterId !== 'witch') return { error: 'Sen cadı değilsin.' };
        if (!player.hasSavePotion) return { error: 'Koruma iksirlerin kalmadı.' };
        room.nightActions.witchSaveTarget = action.targetId || null;
        player.hasSavePotion = false;
        room.players[playerId] = player;
        break;
      case 'pass':
        break;
    }

    if (!room.nightActions.submitted.includes(playerId)) {
      room.nightActions.submitted.push(playerId);
    }

    await this.roomRepo.save(room);
    return room;
  }

  async resolveNight(code: string): Promise<{ room: Room; killed: Player | null; detectiveResult: string | null }> {
    const room = await this.roomRepo.findByCode(code);
    if (!room) return { room: null as any, killed: null, detectiveResult: null };

    const na = room.nightActions;
    let killed: Player | null = null;
    let detectiveResult: string | null = null;

    // Vampir saldırısı
    if (na.vampireTarget) {
      const target = room.players[na.vampireTarget];
      const isSaved =
        na.doctorTarget === na.vampireTarget ||
        na.witchSaveTarget === na.vampireTarget;

      if (target && target.isAlive && !isSaved) {
        target.isAlive = false;
        room.players[na.vampireTarget] = target;
        room.eliminatedThisRound.push(na.vampireTarget);
        killed = target;
      }
    }

    // Cadı öldürme
    if (na.witchKillTarget && na.witchKillTarget !== na.vampireTarget) {
      const target = room.players[na.witchKillTarget];
      if (target && target.isAlive) {
        target.isAlive = false;
        room.players[na.witchKillTarget] = target;
        room.eliminatedThisRound.push(na.witchKillTarget);
        if (!killed) killed = target;
      }
    }

    // Avcı pasif yeteneği (killed ise ve avcıysa)
    if (killed?.characterId === 'hunter') {
      const hunter = killed;
      if (hunter.hasShot) {
        // Hunter hedefi gateway'de seçilecek (şimdilik null)
        hunter.hasShot = false;
        room.players[hunter.id] = hunter;
      }
    }

    // Dedektif sorgusu
    if (na.detectiveTarget) {
      const target = room.players[na.detectiveTarget];
      if (target) {
        const charDef = getCharacterById(target.characterId || '');
        const isVampireTeam = charDef?.team === 'evil';
        detectiveResult = `${target.nickname} ${isVampireTeam ? 'şüpheli görünüyor! 🩸' : 'temiz görünüyor. ✅'}`;

        // Dedektifi bul ve sonucu kaydet
        const detective = Object.values(room.players).find(
          (p) => p.characterId === 'detective' && p.isAlive,
        );
        if (detective) {
          room.detectiveResults[detective.id] = detectiveResult;
        }
      }
    }

    room.phase = 'morning';
    room.round++;
    room.nightActions = this.emptyNightActions();

    // Kazanma kontrolü
    const win = this.checkWinCondition(room);
    if (win) {
      room.winner = win;
      room.phase = 'game_over';
    }

    await this.roomRepo.save(room);
    return { room, killed, detectiveResult };
  }

  // ── Yardımcılar ──────────────────────────────────────────────────────────
  checkWinCondition(room: Room): 'good' | 'evil' | null {
    const alive = Object.values(room.players).filter((p) => p.isAlive);
    const aliveVampires = alive.filter((p) => {
      const c = getCharacterById(p.characterId || '');
      return c?.team === 'evil';
    });
    const aliveGood = alive.filter((p) => {
      const c = getCharacterById(p.characterId || '');
      return c?.team === 'good';
    });

    if (aliveVampires.length === 0) return 'good';
    if (aliveVampires.length >= aliveGood.length) return 'evil';
    return null;
  }

  private emptyNightActions(): NightActions {
    return {
      vampireTarget: null,
      doctorTarget: null,
      detectiveTarget: null,
      witchKillTarget: null,
      witchSaveTarget: null,
      submitted: [],
    };
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async getRoom(code: string): Promise<Room | null> {
    return this.roomRepo.findByCode(code);
  }

  getCharacterList() {
    return CHARACTERS;
  }
}
