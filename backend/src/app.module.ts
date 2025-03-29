import { Module } from '@nestjs/common';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { PrismaModule } from './db/prisma.module';
import { SocketModule } from './socket/socket.module';

@Module({
  imports: [PrismaModule, SocketModule],
  controllers: [RoomController],
  providers: [RoomService],
})
export class AppModule {}
