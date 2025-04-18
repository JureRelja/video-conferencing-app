import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { WorkerService } from './worker.service';
import { AppData, Consumer, DtlsParameters, MediaKind, Producer, Router, RtpCapabilities, RtpParameters, WebRtcTransport } from 'mediasoup/types';

@Injectable()
export class SocketService {
  constructor() {}

  private readonly activeRooms: Map<string, Router<AppData>> = new Map();
  private readonly connectedClients: Map<
    Router<AppData>,
    {
      producerTransport: null | WebRtcTransport<AppData>;
      producer: null | Producer<AppData>;
      consumer: null | Consumer<AppData>;
      consumerTransport: null | WebRtcTransport<AppData>;
      socketId: string;
    }[]
  > = new Map();

  handleConnection(socket: Socket) {
    const clientId = socket.id;
    console.log('Client connected', clientId);

    socket.on('disconnect', () => {
      console.log('Client disconected', clientId);
    });

    // Handle other events and messages from the client

    //Produce transports
    socket.on('connect-transport', async ({ dtlsParameters, roomId }: { dtlsParameters: DtlsParameters; roomId: string }) => {
      await this.connectTransport(socket, dtlsParameters, roomId, 'producer');
    });

    socket.on('produce-transport', async ({ roomId, kind, rtpParameters }) => {
      const producerId = await this.produceTransport(socket, roomId, kind, rtpParameters, 'producer');

      return { id: producerId };
    });

    //Consume transports
    socket.on('connect-consumer-transport', async ({ dtlsParameters, roomId }: { dtlsParameters: DtlsParameters; roomId: string }) => {
      await this.connectTransport(socket, dtlsParameters, roomId, 'consumer');
    });

    socket.on('consume-transport', async ({ roomId, rtpCapabilities }) => {
      const data = await this.consumeTransport(socket, roomId, rtpCapabilities);

      return data;
    });

    socket.on('consumer-resume', async ({ roomId }) => {
      const data = await this.resumeConsumer(socket, roomId);

      return data;
    });
  }

  async resumeConsumer(socket: Socket, roomId: string) {
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

    const consumer = client.consumer;

    if (!consumer) {
      console.error('Consumer not found for the client');
      return;
    }

    await consumer.resume();
  }

  async consumeTransport(socket: Socket, roomId: string, rtpCapabilities: RtpCapabilities) {
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

    const producerId = existingClients[0].producerTransport?.id;

    if (!producerId) {
      console.log('No producer is connected');
      return;
    }

    if (
      !router.canConsume({
        producerId: producerId,
        rtpCapabilities: rtpCapabilities,
      })
    ) {
      console.log("Can't consume transport");
      return;
    }

    const client = existingClients.find((client) => client.socketId === socket.id);

    if (!client) {
      console.error('Client not found in the connected clients');
      return;
    }

    const transport = client.consumerTransport;

    if (!transport) {
      console.error('Transport not found for the client');
      return;
    }

    try {
      const consumer = await transport.consume({
        producerId: producerId,
        rtpCapabilities,
        paused: true,
      });

      //data that's going back to the consumer
      const data = {
        id: consumer.id,
        producerId: producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      };

      client.consumer = consumer;

      return data;
    } catch (error) {
      console.error('Error while consuming stream:', error);
      return null;
    }
  }

  async produceTransport(socket: Socket, roomId: string, kind: MediaKind, rtpParameters: RtpParameters, transportType: 'producer' | 'consumer') {
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

    let transport: WebRtcTransport<AppData> | null = null;

    if (transportType === 'producer') {
      transport = client.producerTransport;
    } else if (transportType === 'consumer') {
      transport = client.consumerTransport;
    } else {
      console.error('Invalid transport type:', transportType);
      return;
    }

    if (!transport) {
      console.error('Transport not found for the client');
      return;
    }

    try {
      const producer = await transport.produce({ kind, rtpParameters });
      client.producer = producer;

      console.log('Producer created:', producer.id);
      return producer.id;
    } catch (error) {
      console.error('Error while producing stream:', error);
      return null;
    }
  }

  async connectTransport(socket: Socket, dtlsParameters: DtlsParameters, roomId: string, transportType: 'producer' | 'consumer') {
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

    let transport: WebRtcTransport<AppData> | null = null;

    if (transportType === 'producer') {
      transport = client.producerTransport;
    } else if (transportType === 'consumer') {
      transport = client.consumerTransport;
    } else {
      console.error('Invalid transport type:', transportType);
      return;
    }

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
      existingClients.push({ producerTransport: null, consumer: null, producer: null, consumerTransport: null, socketId });
    } else {
      this.connectedClients.set(router, [{ producerTransport: null, consumer: null, producer: null, consumerTransport: null, socketId }]);
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
