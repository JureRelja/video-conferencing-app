import { Injectable } from '@nestjs/common';
import { PrismaService } from './db/prisma.service';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { SocketService } from './socket/socket.service';
import { AppData, Router } from 'mediasoup/types';

@Injectable()
export class RoomService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly socketService: SocketService,
  ) {}

  async getRoom(roomUUID: string) {
    const room = await this.prismaService.room.findUnique({
      where: {
        uuid: roomUUID,
      },
    });
    return room;
  }

  async getRoomParticipants(roomUUID: string) {
    const participants = await this.prismaService.participant.findMany({
      where: {
        room: {
          uuid: roomUUID,
        },
      },
    });
    return participants;
  }

  async deleteParticipant(socketId: string, roomUUID: string) {
    try {
      const participant = await this.prismaService.participant.delete({
        where: {
          socketId_roomUUID: {
            socketId: socketId,
            roomUUID: roomUUID,
          },
        },
      });
      return participant;
    } catch (error) {
      console.error('Error deleting participant:', error);
    }
  }

  async createStream(roomUUID: string, socketId: string) {
    const router = this.socketService.getRouter(roomUUID);

    if (!router) {
      return null;
    }
    const transports = await this.createWebRTCTransports(router, socketId);

    return {
      rtpCapabilities: router.rtpCapabilities,
      producerTransport: {
        id: transports.producerTransport.id,
        iceParameters: transports.producerTransport.iceParameters,
        iceCandidates: transports.producerTransport.iceCandidates,
        dtlsParameters: transports.producerTransport.dtlsParameters,
      },
      consumerTransport: {
        id: transports.consumerTransport.id,
        iceParameters: transports.consumerTransport.iceParameters,
        iceCandidates: transports.consumerTransport.iceCandidates,
        dtlsParameters: transports.consumerTransport.dtlsParameters,
      },
    };
  }

  async createWebRTCTransports(router: Router<AppData>, socketId: string) {
    const isTransportCreated = this.socketService.checkTransports(router, socketId);

    if (isTransportCreated) {
      return isTransportCreated;
    }

    const webRTCTrasportOptions = {
      listenIps: [
        {
          ip: '127.0.0.1',
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    };

    const consumerTransport = await router.createWebRtcTransport(webRTCTrasportOptions);

    consumerTransport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        consumerTransport.close();
      }
    });
    consumerTransport.on('@close', () => {
      console.log('Transport closed');
    });

    //

    const producerTransport = await router.createWebRtcTransport(webRTCTrasportOptions);
    producerTransport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        producerTransport.close();
      }
    });
    producerTransport.on('@close', () => {
      console.log('Transport closed');
    });

    //

    this.socketService.addTransports(router, socketId, producerTransport, consumerTransport);

    return { producerTransport, consumerTransport };
  }

  async createRoom() {
    const newRoom = await this.prismaService.room.create({
      data: {
        participants: {
          create: [],
        },
      },
    });

    await this.socketService.createRouter(newRoom.uuid);

    return newRoom;
  }

  // async updateRoomSdp(roomUUID: string, updateRoomDto: UpdateRoomDto): Promise<RoomEntity | null> {
  //   return await this.roomRepository.updateRoomSdp(roomUUID, { sdp: updateRoomDto.sdpOffer, type: updateRoomDto.sdpType as RTCSdpType });
  // }

  async joinRoom(roomUUID: string, createParticipantDto: CreateParticipantDto) {
    const participant = await this.prismaService.participant.findUnique({
      where: {
        socketId_roomUUID: {
          socketId: createParticipantDto.socketId,
          roomUUID: roomUUID,
        },
      },
    });

    if (participant) {
      return participant;
    }

    const updatedRoom = await this.prismaService.participant.create({
      data: {
        name: createParticipantDto.name,
        socketId: createParticipantDto.socketId,
        room: {
          connect: {
            uuid: roomUUID,
          },
        },
      },
    });

    return updatedRoom;
  }
}
