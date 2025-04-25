import { forwardRef, Module } from '@nestjs/common';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { PrismaModule } from './db/prisma.module';
import { SocketModule } from './socket/socket.module';

@Module({
  imports: [PrismaModule, forwardRef(() => SocketModule)],
  controllers: [RoomController],
  providers: [RoomService],
  exports: [RoomService],
})
export class AppModule {}
