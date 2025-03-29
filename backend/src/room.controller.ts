import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RoomService } from './room.service';
import { Room } from '@prisma/client';
import { CreateParticipantDto } from './dto/create-participant.dto';

@Controller('/rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get('/:roomId')
  async getRoom(@Param('roomId') roomUUID: string): Promise<Room | null> {
    return await this.roomService.getRoom(roomUUID);
  }

  @Post('/create')
  async createRoom(@Body() createParticipantDto: CreateParticipantDto) {
    return await this.roomService.createRoom(createParticipantDto);
  }

  @Post('/:roomUUID')
  async joinRoom(@Param('roomUUID') roomUUID: string, @Body() createParticipantDto: CreateParticipantDto): Promise<Room | null> {
    return await this.roomService.joinRoom(roomUUID, createParticipantDto);
  }
}
