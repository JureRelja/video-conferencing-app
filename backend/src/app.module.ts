import { Module } from '@nestjs/common';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { SocketModule } from './socket/socket.module';

@Module({
  imports: [SocketModule],
  controllers: [RoomController],
  providers: [RoomService],
  exports: [RoomService],
})
export class AppModule {}
