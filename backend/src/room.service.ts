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

    await this.socketService.createRouter(newRoom.uuid, newRoom.participants[0].socketId);

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
