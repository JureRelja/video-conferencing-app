import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import {
  AppData,
  Consumer,
  DtlsParameters,
  MediaKind,
  Producer,
  Router,
  RtpCapabilities,
  RtpCodecCapability,
  RtpParameters,
  WebRtcTransport,
  Worker,
} from 'mediasoup/types';
import * as mediasoup from 'mediasoup';

interface Room {
  router: Router;
  peers: Record<string, {
    socket: Socket;
    transports: string[];
    producers: string[];
    consumers: string[];
    peerDetails: {
      name: string;
      isAdmin: boolean;
    };
  }>;
}

interface TransportData {
  socketId: string;
  roomName: string;
  transport: WebRtcTransport;
  consumer?: boolean;
}

interface ProducerData {
  socketId: string;
  roomName: string;
  producer: Producer;
}

interface ConsumerData {
  socketId: string;
  roomName: string;
  consumer: Consumer;
}

const mediaCodecs: RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
];

const iceServers = [
  { urls: 'stun:stun.ekiga.net' },
  { urls: 'stun:stun.schlund.de' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.voipbuster.com' },
  { urls: 'stun:stun.voipstunt.com' },
  { urls: 'stun:stun.xten.com' },
  { urls: 'turn:relay1.expressturn.com:3478', username: 'efKQFKTVZ46CD0JGNE', credential: 'CbUyVUAn6AAc595o' },
];

@Injectable()
export class SocketService {
  constructor() {}

  private worker: Worker<AppData> | null = null;

  private rooms: Record<string, Room> = {};

  private transports: TransportData[] = [];

  private producers: ProducerData[] = [];

  private consumers: ConsumerData[] = [];

  async createWorker(): Promise<void> {
    this.worker = await mediasoup.createWorker({
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
    });

    console.log(`worker pid ${this.worker.pid}`);

    this.worker.on('died', () => {
      console.error('mediasoup worker has died');
      setTimeout(() => process.exit(1), 2000);
    });
  }

  async handleConnection(socket: Socket) {
    if (!this.worker) {
      try {
        await this.createWorker();
      } catch (error) {
        console.error('Error creating worker:', error);
        return;
      }
    }

    socket.on('join-room', async ({ roomName }: { roomName: string }, 
      callback: (data: { rtpCapabilities: RtpCapabilities }) => void) => {
        
      const router = await this.joinRoom(roomName, socket.id, socket);

      callback({ rtpCapabilities: router.rtpCapabilities });
    });

    socket.on('create-transport', async ({ consumer }: { consumer: boolean }, 
      callback: (data: { params: any }) => void) => {

      const { router, roomName } = this.extractRouterAndRoomNameForSocket(socket);
      if (!router || !roomName) return;

      try {
        const transport = await this.createWebRtcTransport(router);
        callback({
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            iceServers: iceServers,
          },
        });

        this.addTransport(transport, roomName, consumer, socket.id);
      } catch (error) {
        console.error(error);
      }
    });

    socket.on('get-all-producers', (callback: (producerList: string[]) => void) => {
      const producerList = this.getProducerList(socket);

      callback(producerList);
    });

    socket.on('producer-transport-connect', async ({ dtlsParameters }: { dtlsParameters: DtlsParameters }) => {
      const transport = this.getTransport(socket.id);

      if (transport) {
        try {
          await transport.connect({ dtlsParameters });
        } catch (error) {
          console.error('Error connecting transport:', error);
        }
      }
    });

    socket.on(
      'transport-produce',
      async (
        { kind, rtpParameters }: { kind: MediaKind; rtpParameters: RtpParameters },
        callback: (data: { id: string; producersExist: boolean }) => void,
      ) => {
        const transport = this.getTransport(socket.id);
        if (!transport) return;

        const producer = await transport.produce({ kind, rtpParameters });

        const { router, roomName } = this.extractRouterAndRoomNameForSocket(socket);
        if (!router || !roomName) return;

        this.addProducer(producer, roomName, socket.id);

        this.informConsumers(roomName, socket.id, producer.id);

        producer.on('transportclose', () => {
          console.log('transport for this producer closed');
          producer.close();
        });

        callback({
          id: producer.id,
          producersExist: this.producers.length > 1,
        });
      },
    );

    socket.on(
      'consumer-transport-connect',
      async ({ dtlsParameters, serverConsumerTransportId }: { dtlsParameters: DtlsParameters; serverConsumerTransportId: string }) => {
        const consumerTransport = this.transports.find(
          (transportData) => transportData.consumer && transportData.transport.id === serverConsumerTransportId,
        )?.transport;

        if (consumerTransport) {
          await consumerTransport.connect({ dtlsParameters });
        }
      },
    );

    socket.on(
      'consume',
      async (
        {
          rtpCapabilities,
          remoteProducerId,
          serverConsumerTransportId,
        }: { rtpCapabilities: RtpCapabilities; remoteProducerId: string; serverConsumerTransportId: string },
        callback: (data: { params: any }) => void,
      ) => {
        await this.startConsumingMedia(socket, rtpCapabilities, remoteProducerId, serverConsumerTransportId, callback);
      },
    );

    socket.on('consumer-resume', async ({ serverConsumerId }: { serverConsumerId: string }) => {
      const consumerData = this.consumers.find((consumerData) => consumerData.consumer.id === serverConsumerId);
      if (consumerData) {
        await consumerData.consumer.resume();
      }
    });

    socket.on('disconnect', () => {
      this.removePeerFromRoom(socket);
    });
  }

  extractRouterAndRoomNameForSocket(socket: Socket) {
    for (const [roomName, room] of Object.entries(this.rooms)) {
      if (room.peers[socket.id]) {
        return { router: room.router, roomName };
      }
    }
    return { router: null, roomName: null };
  }

  async startConsumingMedia(
    socket: Socket,
    rtpCapabilities: RtpCapabilities,
    remoteProducerId: string,
    serverConsumerTransportId: string,
    callback: (data: { params: any }) => void,
  ) {
    try {
      const { router, roomName } = this.extractRouterAndRoomNameForSocket(socket);
      if (!router || !roomName) return;

      const consumerTransport = this.transports.find(
        (transportData) => transportData.consumer && transportData.transport.id === serverConsumerTransportId,
      )?.transport;

      if (!consumerTransport) return;

      await this.consumeMedia(socket, router, rtpCapabilities, remoteProducerId, consumerTransport, roomName, callback);

    } catch (error) {
      console.error(error);
      callback({ params: { error: String(error) } });
    }
  }

  async consumeMedia(
    socket: Socket,
    router: Router,
    rtpCapabilities: RtpCapabilities,
    remoteProducerId: string,
    consumerTransport: WebRtcTransport,
    roomName: string,
    callback: (data: { params: any }) => void,
  ) {
    if (router.canConsume({ producerId: remoteProducerId, rtpCapabilities })) {
      const consumer = await consumerTransport.consume({
        producerId: remoteProducerId,
        rtpCapabilities,
        paused: true,
      });

      consumer.on('transportclose', () => {
        console.log('transport close from consumer');
      });

      consumer.on('producerclose', () => {
        socket.emit('producer-closed', { remoteProducerId });

        this.transports = this.transports.filter((transportData) => transportData.transport.id !== consumerTransport.id);
        this.consumers = this.consumers.filter((consumerData) => consumerData.consumer.id !== consumer.id);
        consumer.close();
      });

      this.addConsumer(consumer, roomName, socket.id);

      callback({
        params: {
          id: consumer.id,
          producerId: remoteProducerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          serverConsumerId: consumer.id,
        },
      });
    }
  }

  getProducerList(socket: Socket): string[] {
    const { router, roomName } = this.extractRouterAndRoomNameForSocket(socket);
    if (!router || !roomName) return [];

    const producerList = this.producers
      .filter((producerData) => producerData.socketId !== socket.id && producerData.roomName === roomName)
      .map((producerData) => producerData.producer.id);

    return producerList;
  }

  removePeerFromRoom(socket: Socket) {
    this.consumers = this.removeItems(this.consumers, socket.id, 'consumer');
    this.producers = this.removeItems(this.producers, socket.id, 'producer');
    this.transports = this.removeItems(this.transports, socket.id, 'transport');

    // Remove peer from rooms
    for (const [roomName, room] of Object.entries(this.rooms)) {
      if (room.peers[socket.id]) {
        delete room.peers[socket.id];
        
        // If room is empty, remove it
        if (Object.keys(room.peers).length === 0) {
          delete this.rooms[roomName];
        }
        break;
      }
    }
  }

  async joinRoom(roomName: string, socketId: string, socket: Socket): Promise<Router> {
    let router: Router;

    if (this.rooms[roomName]) {
      router = this.rooms[roomName].router;
    } else {
      if (!this.worker) {
        throw new Error('Worker not created');
      }
      router = await this.worker.createRouter({ mediaCodecs: mediaCodecs });
      this.rooms[roomName] = {
        router,
        peers: {},
      };
    }

    this.rooms[roomName].peers[socketId] = {
      socket,
      transports: [],
      producers: [],
      consumers: [],
      peerDetails: {
        name: '',
        isAdmin: false,
      },
    };

    return router;
  }

  addTransport(transport: WebRtcTransport, roomName: string, consumer: boolean, socketId: string): void {
    this.transports.push({ socketId, transport, roomName, consumer });

    const room = this.rooms[roomName];
    if (room?.peers[socketId]) {
      room.peers[socketId].transports.push(transport.id);
    }
  }

  addProducer(producer: Producer, roomName: string, socketId: string): void {
    this.producers.push({ socketId, producer, roomName });

    const room = this.rooms[roomName];
    if (room?.peers[socketId]) {
      room.peers[socketId].producers.push(producer.id);
    }
  }

  addConsumer(consumer: Consumer, roomName: string, socketId: string): void {
    this.consumers.push({ socketId, consumer, roomName });

    const room = this.rooms[roomName];
    if (room?.peers[socketId]) {
      room.peers[socketId].consumers.push(consumer.id);
    }
  }

  async createWebRtcTransport(router: Router): Promise<WebRtcTransport> {
    const webRtcTransportOptions = {
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: process.env.BACKEND_IP,
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    };

    const transport = await router.createWebRtcTransport(webRtcTransportOptions);

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        transport.close();
      }
    });

    transport.on('@close', () => {
      console.log('transport closed');
    });

    return transport;
  }

  informConsumers(roomName: string, socketId: string, producerId: string): void {
    const room = this.rooms[roomName];
    if (!room) return;

    Object.entries(room.peers).forEach(([peerId, peer]) => {
      if (peerId !== socketId) {
        peer.socket.emit('new-user-joinned', { producerId });
      }
    });
  }

  getTransport(socketId: string): WebRtcTransport | undefined {
    const transportData = this.transports.find((transport) => transport.socketId === socketId && !transport.consumer);

    return transportData?.transport;
  }

  removeItems = <T extends { socketId: string; [key: string]: any }>(items: T[], socketId: string, type: keyof T): T[] => {
    items.forEach((item) => {
      if (item.socketId === socketId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        item[type]?.close?.();
      }
    });
    return items.filter((item) => item.socketId !== socketId);
  };
}