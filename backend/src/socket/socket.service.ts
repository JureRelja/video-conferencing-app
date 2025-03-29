import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { WorkerService } from './worker.service';

@Injectable()
export class SocketService {
  constructor() {}

  private readonly connectedClients: Map<string, Socket> = new Map();

  async handleConnection(socket: Socket) {
    const clientId = socket.id;
    this.connectedClients.set(clientId, socket);
    console.log('Client connected', clientId);

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

    socket.on('disconnect', () => {
      this.connectedClients.delete(clientId);
      console.log('Client disconected', clientId);
    });

    // Handle other events and messages from the client
  }

  // Add more methods for handling events, messages, etc.
}
