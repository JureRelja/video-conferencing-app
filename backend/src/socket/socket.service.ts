import { forwardRef, Inject, Injectable } from '@nestjs/common';
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
import { RoomService } from 'src/room.service';
import * as mediasoup from 'mediasoup';

interface Room {
  router: Router;
  peers: string[];
}

interface PeerDetails {
  name: string;
  isAdmin: boolean;
}

interface Peer {
  socket: Socket;
  roomName: string;
  transports: string[];
  producers: string[];
  consumers: string[];
  peerDetails: PeerDetails;
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

@Injectable()
export class SocketService {
  constructor(
    @Inject(forwardRef(() => RoomService))
    private readonly roomService: RoomService,
  ) {}

  private worker: Worker<AppData> | null = null;

  private rooms: Record<string, Room> = {};

  private peers: Record<string, Peer> = {};

  private transports: TransportData[] = [];

  private producers: ProducerData[] = [];

  private consumers: ConsumerData[] = [];

  private mediaCodecs: RtpCodecCapability[] = [
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

  handleConnection(socket: Socket): void {
    const clientId = socket.id;
    console.log('Client connected', clientId);

    if (!this.worker) {
      this.createWorker();
    }

    socket.emit('connection-success', {
      socketId: socket.id,
    });

    const removeItems = <T extends { socketId: string; [key: string]: any }>(items: T[], socketId: string, type: keyof T): T[] => {
      items.forEach((item) => {
        if (item.socketId === socketId) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          item[type]?.close?.();
        }
      });
      return items.filter((item) => item.socketId !== socketId);
    };

    socket.on('disconnect', () => {
      console.log('peer disconnected');
      this.consumers = removeItems(this.consumers, socket.id, 'consumer');
      this.producers = removeItems(this.producers, socket.id, 'producer');
      this.transports = removeItems(this.transports, socket.id, 'transport');

      const peer = this.peers[socket.id];
      if (peer) {
        const { roomName } = peer;
        delete this.peers[socket.id];

        if (this.rooms[roomName]) {
          this.rooms[roomName].peers = this.rooms[roomName].peers.filter((id) => id !== socket.id);
        }
      }
    });

    socket.on('joinRoom', async ({ roomName }: { roomName: string }, callback: (data: { rtpCapabilities: RtpCapabilities }) => void) => {
      const router = await this.createRoom(roomName, socket.id);

      this.peers[socket.id] = {
        socket,
        roomName,
        transports: [],
        producers: [],
        consumers: [],
        peerDetails: {
          name: '',
          isAdmin: false,
        },
      };

      callback({ rtpCapabilities: router.rtpCapabilities });
    });

    socket.on('createWebRtcTransport', async ({ consumer }: { consumer: boolean }, callback: (data: { params: any }) => void) => {
      const peer = this.peers[socket.id];
      if (!peer) return;

      const roomName = peer.roomName;
      const room = this.rooms[roomName];
      if (!room) return;

      const router = room.router;

      try {
        const transport = await this.createWebRtcTransport(router);
        callback({
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          },
        });

        this.addTransport(transport, roomName, consumer, socket.id);
      } catch (error) {
        console.error(error);
      }
    });

    socket.on('getProducers', (callback: (producerList: string[]) => void) => {
      const peer = this.peers[socket.id];
      if (!peer) return;

      const { roomName } = peer;

      const producerList = this.producers
        .filter((producerData) => producerData.socketId !== socket.id && producerData.roomName === roomName)
        .map((producerData) => producerData.producer.id);

      callback(producerList);
    });

    socket.on('transport-connect', ({ dtlsParameters }: { dtlsParameters: DtlsParameters }) => {
      const transport = this.getTransport(socket.id);
      if (transport) {
        transport.connect({ dtlsParameters });
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

        const peer = this.peers[socket.id];
        if (!peer) return;

        const { roomName } = peer;

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
      'transport-recv-connect',
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
        try {
          const peer = this.peers[socket.id];
          if (!peer) return;

          const { roomName } = peer;
          const room = this.rooms[roomName];
          if (!room) return;

          const router = room.router;

          const consumerTransport = this.transports.find(
            (transportData) => transportData.consumer && transportData.transport.id === serverConsumerTransportId,
          )?.transport;

          if (!consumerTransport) return;

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
              console.log('producer of consumer closed');
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
        } catch (error) {
          console.error(error);
          callback({
            params: {
              // @ts-ignore
              error: error.message as string,
            },
          });
        }
      },
    );

    socket.on('consumer-resume', async ({ serverConsumerId }: { serverConsumerId: string }) => {
      const consumerData = this.consumers.find((consumerData) => consumerData.consumer.id === serverConsumerId);
      if (consumerData) {
        await consumerData.consumer.resume();
      }
    });
  }

  async createWorker(): Promise<Worker<AppData>> {
    this.worker = await mediasoup.createWorker({
      rtcMinPort: 2000,
      rtcMaxPort: 2020,
    });
    console.log(`worker pid ${this.worker.pid}`);

    this.worker.on('died', () => {
      console.error('mediasoup worker has died');
      setTimeout(() => process.exit(1), 2000);
    });

    return this.worker;
  }

  async createRoom(roomName: string, socketId: string): Promise<Router> {
    let router: Router;
    if (this.rooms[roomName]) {
      router = this.rooms[roomName].router;
    } else {
      if (!this.worker) {
        throw new Error('Worker not created');
      }
      router = await this.worker.createRouter({ mediaCodecs: this.mediaCodecs });
      this.rooms[roomName] = {
        router,
        peers: [],
      };
    }

    this.rooms[roomName].peers.push(socketId);

    return router;
  }

  addTransport(transport: WebRtcTransport, roomName: string, consumer: boolean, socketId: string): void {
    this.transports.push({ socketId, transport, roomName, consumer });

    const peer = this.peers[socketId];
    if (peer) {
      peer.transports.push(transport.id);
    }
  }

  addProducer(producer: Producer, roomName: string, socketId: string): void {
    this.producers.push({ socketId, producer, roomName });

    const peer = this.peers[socketId];
    if (peer) {
      peer.producers.push(producer.id);
    }
  }

  addConsumer(consumer: Consumer, roomName: string, socketId: string): void {
    this.consumers.push({ socketId, consumer, roomName });

    const peer = this.peers[socketId];
    if (peer) {
      peer.consumers.push(consumer.id);
    }
  }

  async createWebRtcTransport(router: Router): Promise<WebRtcTransport> {
    const webRtcTransportOptions = {
      listenIps: [
        {
          ip: '127.0.0.1',
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
    console.log(`just joined, id ${producerId} ${roomName}, ${socketId}`);
    this.producers.forEach((producerData) => {
      if (producerData.socketId !== socketId && producerData.roomName === roomName) {
        const producerSocket = this.peers[producerData.socketId]?.socket;
        if (producerSocket) {
          producerSocket.emit('new-producer', { producerId });
        }
      }
    });
  }

  getTransport(socketId: string): WebRtcTransport | undefined {
    const transportData = this.transports.find((transport) => transport.socketId === socketId && !transport.consumer);
    return transportData?.transport;
  }
}
