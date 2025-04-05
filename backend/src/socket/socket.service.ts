import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { WorkerService } from './worker.service';
import { AppData, DtlsParameters, MediaKind, Router, RtpParameters, WebRtcTransport } from 'mediasoup/types';

@Injectable()
export class SocketService {
  constructor() {}

  private readonly activeRooms: Map<string, Router<AppData>> = new Map();
  private readonly connectedClients: Map<
    Router<AppData>,
    { producerTransport: null | WebRtcTransport<AppData>; consumerTransport: null | WebRtcTransport<AppData>; socketId: string }[]
  > = new Map();

  handleConnection(socket: Socket) {
    const clientId = socket.id;
    console.log('Client connected', clientId);

    socket.on('disconnect', () => {
      console.log('Client disconected', clientId);
    });

    // Handle other events and messages from the client
    socket.on('connect-transport', async ({ dtlsParameters, roomId }: { dtlsParameters: DtlsParameters; roomId: string }) => {
      await this.connectTransport(socket, dtlsParameters, roomId);
    });
    socket.on('produce-transport', async ({ roomId, kind, rtpParameters }) => {
      const producerId = await this.produceTransport(socket, roomId, kind, rtpParameters);

      return { id: producerId };
    });
  }

  async produceTransport(socket: Socket, roomId: string, kind: MediaKind, rtpParameters: RtpParameters) {
    const router = this.activeRooms.get(roomId);

    if (!router) {
      console.error('Router not found for room:', roomId);
      return;
    }

    const existingClients = this.connectedClients.get(router);

    if (!existingClients) {
      console.error('No clients connected to the router');
      return;
    }

    const client = existingClients.find((client) => client.socketId === socket.id);

    if (!client) {
      console.error('Client not found in the connected clients');
      return;
    }

    const transport = client.producerTransport;

    if (!transport) {
      console.error('Transport not found for the client');
      return;
    }

    try {
      const producer = await transport.produce({ kind, rtpParameters });
      console.log('Producer created:', producer.id);
      return producer.id;
    } catch (error) {
      console.error('Error while producing stream:', error);
      return null;
    }
  }

  async connectTransport(socket: Socket, dtlsParameters: DtlsParameters, roomId: string) {
    const router = this.activeRooms.get(roomId);

    if (!router) {
      console.error('Router not found for room:', roomId);
      return;
    }

    const existingClients = this.connectedClients.get(router);

    if (!existingClients) {
      console.error('No clients connected to the router');
      return;
    }

    const client = existingClients.find((client) => client.socketId === socket.id);

    if (!client) {
      console.error('Client not found in the connected clients');
      return;
    }

    const transport = client.producerTransport;

    if (!transport) {
      console.error('Transport not found for the client');
      return;
    }

    try {
      await transport.connect({ dtlsParameters });
      console.log('Transport connected:', transport.id);
    } catch (error) {
      console.error('Error while connecting transport:', error);
    }
  }

  async createRouter(roomId: string, socketId: string) {
    if (!WorkerService.worker) {
      console.error('Worker is not initialized, initializing...');
      await WorkerService.createWorker();
    }

    const router = await WorkerService.worker!.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
          parameters: {},
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {},
        },
      ],
    });

    this.activeRooms.set(roomId, router);
    const existingClients = this.connectedClients.get(router);

    if (existingClients) {
      existingClients.push({ producerTransport: null, consumerTransport: null, socketId });
    } else {
      this.connectedClients.set(router, [{ producerTransport: null, consumerTransport: null, socketId }]);
    }
  }

  addTransports(router: Router<AppData>, socketId: string, producerTransport: WebRtcTransport<AppData>, consumerTransport: WebRtcTransport<AppData>) {
    const existingClients = this.connectedClients.get(router);

    if (!existingClients) return;

    const client = existingClients.find((client) => client.socketId === socketId);

    if (client) {
      client.producerTransport = producerTransport;
      client.consumerTransport = consumerTransport;
    }
  }

  public getRouter(roomId: string) {
    const router = this.activeRooms.get(roomId);
    return router;
  }

  // Add more methods for handling events, messages, etc.
}
