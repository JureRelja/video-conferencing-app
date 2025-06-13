import { Module } from '@nestjs/common';
import { RoomService } from './room.service';
import { SocketModule } from './socket/socket.module';

@Module({
  imports: [SocketModule],
  providers: [RoomService],
  exports: [RoomService],
})
export class AppModule {}
