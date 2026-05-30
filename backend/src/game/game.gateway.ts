import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { Room } from './interfaces/room.interface';

// Hangi socket hangi odada?
const socketRoom = new Map<string, string>(); // socketId -> roomCode

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Gece/gündüz zamanlayıcıları
  private phaseTimers = new Map<string, NodeJS.Timeout>();
  private lobbyDisconnectTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly gameService: GameService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const code = socketRoom.get(client.id);
    if (!code) return;
    socketRoom.delete(client.id);

    const room = await this.gameService.getRoom(code);
    if (!room) return;

    if (room.phase === 'lobby' && room.players[client.id]) {
      const timer = setTimeout(async () => {
        this.lobbyDisconnectTimers.delete(client.id);

        const updatedRoom = await this.gameService.removePlayer(code, client.id);
        if (!updatedRoom) return;

        this.server.to(code).emit('player-left', {
          playerId: client.id,
          players: updatedRoom.players,
          hostId: updatedRoom.hostId,
        });
      }, 15_000);

      this.lobbyDisconnectTimers.set(client.id, timer);
      return;
    }

    const updatedRoom = await this.gameService.removePlayer(code, client.id);
    if (!updatedRoom) return;

    client.to(code).emit('player-left', {
      playerId: client.id,
      players: updatedRoom.players,
      hostId: updatedRoom.hostId,
    });

    // Oyun sırasında ayrılma — gece aksiyonu gerekli mi kontrol et
    if (updatedRoom.phase === 'night') {
      await this.checkNightComplete(code, updatedRoom);
    }
  }

  // ── Oda oluştur ─────────────────────────────────────────────────────────
  @SubscribeMessage('create-room')
  async handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { nickname: string },
  ) {
    const room = await this.gameService.createRoom(client.id, data.nickname);
    socketRoom.set(client.id, room.code);
    client.join(room.code);
    client.emit('room-created', { room, playerId: client.id });
    client.emit('characters-list', this.gameService.getCharacterList());
  }

  // ── Odaya katıl ─────────────────────────────────────────────────────────
  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { code: string; nickname: string },
  ) {
    const result = await this.gameService.joinRoom(data.code, client.id, data.nickname);
    if ('error' in result) {
      client.emit('error', { message: result.error });
      return;
    }
    socketRoom.set(client.id, result.code);
    client.join(result.code);
    client.emit('room-joined', { room: result, playerId: client.id });
    client.emit('characters-list', this.gameService.getCharacterList());
    client.to(result.code).emit('player-joined', {
      player: result.players[client.id],
      players: result.players,
      hostId: result.hostId,
    });
  }

  // ── Lobi'ye geri dön (reconnect) ────────────────────────────────────────
  @SubscribeMessage('rejoin-room')
  async handleRejoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { code: string; nickname: string },
  ) {
    const result = await this.gameService.rejoinLobbyRoom(
      data.code.toUpperCase(),
      client.id,
      data.nickname,
    );

    if ('error' in result) {
      client.emit('error', { message: result.error });
      return;
    }

    const pendingRemoval = this.lobbyDisconnectTimers.get(result.previousPlayerId);
    if (pendingRemoval) {
      clearTimeout(pendingRemoval);
      this.lobbyDisconnectTimers.delete(result.previousPlayerId);
    }

    socketRoom.set(client.id, result.room.code);
    client.join(result.room.code);
    client.emit('room-state', { room: result.room, playerId: client.id });
    client.emit('characters-list', this.gameService.getCharacterList());
    client.to(result.room.code).emit('player-joined', {
      player: result.room.players[client.id],
      players: result.room.players,
      hostId: result.room.hostId,
    });
  }

  // ── Ayarları güncelle ───────────────────────────────────────────────────
  @SubscribeMessage('update-settings')
  async handleUpdateSettings(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      selectedCharacters?: string[];
      dayDurationSeconds?: number;
      nightDurationSeconds?: number;
    },
  ) {
    const code = socketRoom.get(client.id);
    if (!code) return;
    const result = await this.gameService.updateSettings(code, client.id, data);
    if ('error' in result) {
      client.emit('error', { message: result.error });
      return;
    }
    this.server.to(code).emit('settings-updated', { room: result });
  }

  // ── Oyunu başlat ────────────────────────────────────────────────────────
  @SubscribeMessage('start-game')
  async handleStartGame(@ConnectedSocket() client: Socket) {
    const code = socketRoom.get(client.id);
    if (!code) {
      client.emit('error', { message: 'Bağlantın koptu. Odaya yeniden bağlanılıyor.' });
      return;
    }
    const result = await this.gameService.startGame(code, client.id);
    if ('error' in result) {
      client.emit('error', { message: result.error });
      return;
    }

    // Her oyuncuya kendi rolünü gönder
    this.server.to(code).emit('game-started', { room: this.publicRoom(result) });

    for (const player of Object.values(result.players)) {
      // Vampirler birbirini bilsin
      if (player.characterId === 'vampire' || player.characterId === 'familiar') {
        const vampires = Object.values(result.players)
          .filter((p) => p.characterId === 'vampire' || p.characterId === 'familiar')
          .map((p) => ({ id: p.id, nickname: p.nickname, characterId: p.characterId }));
        this.server.to(player.id).emit('role-assigned', {
          characterId: player.characterId,
          allies: vampires,
        });
      } else {
        this.server.to(player.id).emit('role-assigned', {
          characterId: player.characterId,
          allies: [],
        });
      }
    }

    // 5 saniye rol reveal sonrası güne geç
    setTimeout(() => this.startDay(code), 8000);
  }

  // ── Gündüz ──────────────────────────────────────────────────────────────
  private async startDay(code: string) {
    const room = await this.gameService.startDay(code);
    if (!room) return;
    this.server.to(code).emit('phase-change', {
      phase: 'day_discussion',
      deadline: room.phaseDeadline,
      round: room.round,
    });

    // Tartışma süresi bitince oylamaya geç
    this.schedulePhase(code, room.dayDurationSeconds * 1000, () =>
      this.startVoting(code),
    );
  }

  private async startVoting(code: string) {
    const room = await this.gameService.startVoting(code);
    if (!room) return;
    this.server.to(code).emit('phase-change', {
      phase: 'day_vote',
      deadline: room.phaseDeadline,
    });

    // 60 saniye sonra oyları say
    this.schedulePhase(code, 60_000, () => this.resolveVotes(code));
  }

  @SubscribeMessage('cast-vote')
  async handleVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string },
  ) {
    const code = socketRoom.get(client.id);
    if (!code) return;
    const result = await this.gameService.castVote(code, client.id, data.targetId);
    if ('error' in result) {
      client.emit('error', { message: result.error });
      return;
    }
    this.server.to(code).emit('vote-cast', {
      voterId: client.id,
      votes: result.votes?.votes,
    });

    // Herkes oy verdiyse hemen say
    const alive = Object.values(result.players).filter((p) => p.isAlive);
    const voteCount = Object.keys(result.votes?.votes || {}).length;
    if (voteCount >= alive.length) {
      this.clearPhase(code);
      await this.resolveVotes(code);
    }
  }

  private async resolveVotes(code: string) {
    const { room, eliminated } = await this.gameService.resolveVotes(code);
    if (!room) return;

    this.server.to(code).emit('vote-resolved', {
      eliminated: eliminated
        ? {
            id: eliminated.id,
            nickname: eliminated.nickname,
            characterId: eliminated.characterId,
          }
        : null,
      phase: room.phase,
      winner: room.winner,
      players: room.players,
    });

    if (room.phase === 'game_over') {
      this.server.to(code).emit('game-over', {
        winner: room.winner,
        winnerPlayerId: room.winnerPlayerId,
        players: room.players,
      });
      return;
    }

    // Avcı ölürse hunter-shot eventi
    if (eliminated?.characterId === 'hunter') {
      this.server.to(eliminated.id).emit('hunter-must-shoot', {});
    }

    // Geceye geç
    setTimeout(() => this.startNight(code), 3000);
  }

  // ── Gece ────────────────────────────────────────────────────────────────
  private async startNight(code: string) {
    const room = await this.gameService.getRoom(code);
    if (!room) return;

    this.server.to(code).emit('phase-change', {
      phase: 'night',
      deadline: Date.now() + room.nightDurationSeconds * 1000,
      round: room.round,
    });

    this.schedulePhase(code, room.nightDurationSeconds * 1000, () =>
      this.resolveNight(code),
    );
  }

  @SubscribeMessage('night-action')
  async handleNightAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      type: 'vampire_kill' | 'doctor_save' | 'detective_query' | 'witch_kill' | 'witch_save' | 'pass';
      targetId?: string;
    },
  ) {
    const code = socketRoom.get(client.id);
    if (!code) return;
    const result = await this.gameService.submitNightAction(code, client.id, data);
    if ('error' in result) {
      client.emit('error', { message: result.error });
      return;
    }
    client.emit('night-action-submitted', { ok: true });

    await this.checkNightComplete(code, result);
  }

  @SubscribeMessage('hunter-shoot')
  async handleHunterShoot(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string },
  ) {
    const code = socketRoom.get(client.id);
    if (!code) return;
    const room = await this.gameService.getRoom(code);
    if (!room) return;

    const target = room.players[data.targetId];
    if (target && target.isAlive) {
      target.isAlive = false;
      room.players[data.targetId] = target;

      const win = this.gameService.checkWinCondition(room);
      if (win) {
        room.winner = win;
        room.phase = 'game_over';
      }

      this.server.to(code).emit('hunter-shot', {
        hunterId: client.id,
        targetId: data.targetId,
        targetNickname: target.nickname,
        characterId: target.characterId,
        players: room.players,
      });

      if (room.winner) {
        this.server.to(code).emit('game-over', {
          winner: room.winner,
          players: room.players,
        });
      }
    }
  }

  private async checkNightComplete(code: string, room: Room) {
    // Gece aksiyonu gereken canlı oyuncuları bul
    const alive = Object.values(room.players).filter((p) => p.isAlive);
    const needAction = alive.filter((p) => {
      const charDef = this.gameService.getCharacterList().find((c) => c.id === p.characterId);
      return charDef?.hasNightAction;
    });

    const submitted = room.nightActions.submitted;
    const allSubmitted = needAction.every((p) => submitted.includes(p.id));

    if (allSubmitted && needAction.length > 0) {
      this.clearPhase(code);
      await this.resolveNight(code);
    }
  }

  private async resolveNight(code: string) {
    const { room, killed, detectiveResult } = await this.gameService.resolveNight(code);
    if (!room) return;

    this.server.to(code).emit('morning', {
      killed: killed
        ? { id: killed.id, nickname: killed.nickname, characterId: killed.characterId }
        : null,
      players: room.players,
      phase: room.phase,
    });

    // Dedektif sonucunu sadece dedektife gönder
    if (detectiveResult) {
      const detective = Object.values(room.players).find(
        (p) => p.characterId === 'detective',
      );
      if (detective) {
        this.server.to(detective.id).emit('detective-result', {
          result: detectiveResult,
        });
      }
    }

    if (room.phase === 'game_over') {
      this.server.to(code).emit('game-over', {
        winner: room.winner,
        players: room.players,
      });
      return;
    }

    // Avcı öldürüldüyse
    if (killed?.characterId === 'hunter') {
      this.server.to(killed.id).emit('hunter-must-shoot', {});
      return; // Hunter ateş edene kadar bekle
    }

    // 4 saniye sonra güne geç
    setTimeout(() => this.startDay(code), 4000);
  }

  // ── Sohbet ──────────────────────────────────────────────────────────────
  @SubscribeMessage('chat-message')
  async handleChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string },
  ) {
    const code = socketRoom.get(client.id);
    if (!code) return;
    const room = await this.gameService.getRoom(code);
    if (!room) return;
    const player = room.players[client.id];
    if (!player || !player.isAlive) return;
    if (room.phase !== 'day_discussion') return;

    this.server.to(code).emit('chat-message', {
      playerId: client.id,
      nickname: player.nickname,
      message: data.message.slice(0, 300),
      timestamp: Date.now(),
    });
  }

  // ── Zamanlayıcı yönetimi ─────────────────────────────────────────────────
  private schedulePhase(code: string, ms: number, fn: () => void) {
    this.clearPhase(code);
    const timer = setTimeout(fn, ms);
    this.phaseTimers.set(code, timer);
  }

  private clearPhase(code: string) {
    const t = this.phaseTimers.get(code);
    if (t) {
      clearTimeout(t);
      this.phaseTimers.delete(code);
    }
  }

  // Sadece genel bilgileri içeren room objesi (rolleri gizler)
  private publicRoom(room: Room) {
    const players: any = {};
    for (const [id, p] of Object.entries(room.players)) {
      players[id] = {
        id: p.id,
        nickname: p.nickname,
        isAlive: p.isAlive,
        isHost: p.isHost,
        characterId: null, // gizli
      };
    }
    return { ...room, players };
  }
}
