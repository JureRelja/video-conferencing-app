import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateParticipantDto } from './dto/create-participant.dto';

@Controller('/rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get('room/:roomId')
  async getRoom(@Param('roomId') roomUUID: string) {
    // return await this.roomService.getRoom(roomUUID);
  }

  @Get('/:roomId')
  async getRoomParticipants(@Param('roomId') roomUUID: string) {
    // return await this.roomService.getRoomParticipants(roomUUID);
  }

  @Post('/router/:roomId')
  createStream(@Param('roomId') roomId: string, @Body() body: { socketId: string }) {
    // return this.roomService.createStream(roomId, body.socketId);
  }

  @Post('/')
  async createRoom() {
    return await this.roomService.createRoom();
  }

  @Post('/:roomUUID')
  async joinRoom(@Param('roomUUID') roomUUID: string, @Body() createParticipantDto: CreateParticipantDto) {
    // return await this.roomService.joinRoom(roomUUID, createParticipantDto);
  }
}
