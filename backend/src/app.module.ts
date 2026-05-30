import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameGateway } from './game/game.gateway';
import { GameService } from './game/game.service';
import { RoomRepository } from './game/room.repository';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  providers: [GameGateway, GameService, RoomRepository],
})
export class AppModule {}
