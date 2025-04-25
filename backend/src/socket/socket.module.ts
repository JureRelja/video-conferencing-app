import { forwardRef, Module } from '@nestjs/common';
import { SocketService } from './socket.service';
import { SocketGateway } from './socket.gateway';
import { PrismaModule } from 'src/db/prisma.module';
import { AppModule } from 'src/app.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AppModule)],
  providers: [SocketService, SocketGateway],
  exports: [SocketService],
})
export class SocketModule {}
