import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { WorkerService } from './worker.service';
import { AppData, Router } from 'mediasoup/types';

@Injectable()
export class SocketService {
  constructor() {}

  private readonly connectedClients: Map<string, { socket: Socket; router: Router<AppData> }> = new Map();

  async handleConnection(socket: Socket) {
    const clientId = socket.id;

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

    this.connectedClients.set(clientId, { socket, router });
    console.log('Client connected', clientId);

    socket.on('disconnect', () => {
      this.connectedClients.delete(clientId);
      console.log('Client disconected', clientId);
    });

    // Handle other events and messages from the client
  }

  public getRouter(clientId: string) {
    const client = this.connectedClients.get(clientId);
    if (client) {
      console.log(`Router found for client ${clientId}`);
      console.log('Router:', client.router.rtpCapabilities);
      return JSON.stringify(client.router.rtpCapabilities);
    }
    console.error(`No router found for client ${clientId}`);
  }

  // Add more methods for handling events, messages, etc.
}
