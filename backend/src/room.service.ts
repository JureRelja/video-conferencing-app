import { Injectable } from '@nestjs/common';
import { PrismaService } from './db/prisma.service';
import { CreateParticipantDto } from './dto/create-participant.dto';

@Injectable()
export class RoomService {
  constructor(private readonly prismaService: PrismaService) {}

  async getRoom(roomUUID: string) {
    const room = await this.prismaService.room.findUnique({
      where: {
        uuid: roomUUID,
      },
      include: {
        participants: true,
      },
    });
    return room;
  }

  async createRoom(createParticipantDto: CreateParticipantDto) {
    const newRoom = await this.prismaService.room.create({
      data: {
        participants: {
          create: {
            name: createParticipantDto.name,
            socketId: createParticipantDto.socketId,
          },
        },
      },
      include: {
        participants: true,
      },
    });
    return newRoom;
  }

  // async updateRoomSdp(roomUUID: string, updateRoomDto: UpdateRoomDto): Promise<RoomEntity | null> {
  //   return await this.roomRepository.updateRoomSdp(roomUUID, { sdp: updateRoomDto.sdpOffer, type: updateRoomDto.sdpType as RTCSdpType });
  // }

  async joinRoom(roomUUID: string, createParticipantDto: CreateParticipantDto) {
    const room = await this.prismaService.room.findUnique({
      where: {
        uuid: roomUUID,
      },
    });

    if (!room) {
      return null;
    }

    const updatedRoom = await this.prismaService.room.update({
      where: {
        uuid: roomUUID,
      },
      data: {
        participants: {
          create: {
            name: createParticipantDto.name,
            socketId: createParticipantDto.socketId,
          },
        },
      },
      include: {
        participants: true,
      },
    });

    return updatedRoom;
  }
}
