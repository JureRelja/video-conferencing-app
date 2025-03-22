import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./db/prisma.module";
import { SocketModule } from "./socket/socket.module";

@Module({
    imports: [PrismaModule, SocketModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
