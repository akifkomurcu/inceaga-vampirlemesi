import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { Room } from './interfaces/room.interface';

const ROOM_TTL = 86400; // 24 saat (saniye)

@Injectable()
export class RoomRepository implements OnModuleInit {
  private client: Redis;

  onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
  }

  private key(code: string) {
    return `room:${code}`;
  }

  async save(room: Room): Promise<void> {
    await this.client.set(this.key(room.code), JSON.stringify(room), 'EX', ROOM_TTL);
  }

  async findByCode(code: string): Promise<Room | null> {
    const data = await this.client.get(this.key(code));
    if (!data) return null;
    return JSON.parse(data) as Room;
  }

  async delete(code: string): Promise<void> {
    await this.client.del(this.key(code));
  }

  async exists(code: string): Promise<boolean> {
    return (await this.client.exists(this.key(code))) === 1;
  }
}
