import * as mediasoup from 'mediasoup';

export class WorkerService {
  static worker: mediasoup.types.Worker<mediasoup.types.AppData> | null = null;

  private constructor() {}

  static async createWorker() {
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    });

    worker.on('died', () => {
      console.error('Mediasoup worker has died');
      process.exit(1);
    });

    this.worker = worker;
    console.log('Mediasoup worker created');
  }
}
