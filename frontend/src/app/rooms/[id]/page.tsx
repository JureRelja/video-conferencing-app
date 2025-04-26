/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Device } from 'mediasoup-client';
import * as mediasoup from 'mediasoup-client';
import socket from '@/socket/socket-io';

type TransportParams = {
  id: string;
  iceParameters: any;
  iceCandidates: any;
  dtlsParameters: any;
};

type ConsumerTransportData = {
  consumerTransport: mediasoup.types.Transport<mediasoup.types.AppData>;
  serverConsumerTransportId: string;
  producerId: string;
  consumer: mediasoup.types.Consumer<mediasoup.types.AppData>;
};

const params = {
  encodings: [
    { rid: 'r0', maxBitrate: 100000, scalabilityMode: 'S1T3' },
    { rid: 'r1', maxBitrate: 300000, scalabilityMode: 'S1T3' },
    { rid: 'r2', maxBitrate: 900000, scalabilityMode: 'S1T3' },
  ],
  codecOptions: { videoGoogleStartBitrate: 1000 },
};

export default function Home() {
  const { id } = useParams<{ id: string }>();
  // const searchParams = useSearchParams();
  // const [participants, setParticipants] = useState<Participant[]>([]);
  // const [total, setTotal] = useState<number>(20);

  const videoContainer = useRef<HTMLDivElement | null>(null);
  const [localVideo, setLocalVideo] = useState<HTMLVideoElement | null>(null);

  const [device, setDevice] = useState<Device | null>(null);
  const [rtpCapabilities, setRtpCapabilities] = useState<any>(null);
  const [producerTransport, setProducerTransport] = useState<mediasoup.types.Transport<mediasoup.types.AppData> | null>(null);
  const [consumerTransports, setConsumerTransports] = useState<ConsumerTransportData[]>([]);
  const [consumingTransports, setConsumingTransports] = useState<string[]>([]);

  const [audioParams, setAudioParams] = useState<any>(null);
  const [videoParams, setVideoParams] = useState<any>({ params });

  const getLocalStream = () => {
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { width: { min: 640, max: 1920 }, height: { min: 400, max: 1080 } },
      })
      .then((stream) => {
        if (localVideo) {
          localVideo.srcObject = stream;
        }

        setAudioParams({ track: stream.getAudioTracks()[0], ...audioParams });
        setVideoParams({ track: stream.getVideoTracks()[0], ...videoParams });

        joinRoom();
      })
      .catch(() => {
        console.error('Error accessing media devices:');
      });
  };

  const joinRoom = () => {
    socket.emit('joinRoom', { roomName: id }, (data: { rtpCapabilities: any }) => {
      console.log(`Router RTP Capabilities: ${data.rtpCapabilities}`);
      setRtpCapabilities(data.rtpCapabilities);
      void createDevice(data.rtpCapabilities);
    });
  };

  const createDevice = async (rtpCapabilitiesLocal: mediasoup.types.RtpCapabilities) => {
    try {
      const newDevice = new Device();
      await newDevice.load({ routerRtpCapabilities: rtpCapabilitiesLocal });
      console.log('Device RTP Capabilities:', newDevice.rtpCapabilities);

      setDevice(newDevice);
    } catch (error: any) {
      console.error('Error creating device:', error);
      if (error.name === 'UnsupportedError') {
        console.warn('Browser not supported');
      }
    }
  };

  //just to start the create
  useEffect(() => {
    if (!device) return;

    createSendTransport();
  }, [device]);

  const createSendTransport = () => {
    socket.emit('createWebRtcTransport', { consumer: false }, ({ params }: { params: TransportParams }) => {
      if (!params) {
        console.error('Error creating transport:');
        return;
      }

      if (!device) return;

      console.log('Creating send transport...');

      const transport = device.createSendTransport(params);
      setProducerTransport(transport);

      transport.on('connect', ({ dtlsParameters }, callback) => {
        try {
          socket.emit('transport-connect', { dtlsParameters });
          callback();
        } catch (error) {
          console.error('Error while connecting transport:', error);
        }
      });

      transport.on('produce', (parameters, callback) => {
        try {
          socket.emit(
            'transport-produce',
            { kind: parameters.kind, rtpParameters: parameters.rtpParameters, appData: parameters.appData },
            ({ id, producersExist }: { id: string; producersExist: boolean }) => {
              callback({ id });
              if (producersExist) getProducers();
            },
          );
        } catch (error) {
          console.error('Error while producing:', error);
        }
      });

      connectSendTransport(transport);
    });
  };

  const connectSendTransport = async (producerTransportLocal: mediasoup.types.Transport<mediasoup.types.AppData> | null) => {
    if (!producerTransportLocal) return;

    console.log('Creating audio and video producers...');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const audioProducer = await producerTransportLocal.produce(audioParams);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const videoProducer = await producerTransportLocal.produce(videoParams);

    audioProducer.on('trackended', () => console.log('Audio track ended'));
    audioProducer.on('transportclose', () => console.log('Audio transport closed'));

    videoProducer.on('trackended', () => console.log('Video track ended'));
    videoProducer.on('transportclose', () => console.log('Video transport closed'));
  };

  const getProducers = () => {
    socket.emit('getProducers', (producerIds: string[]) => {
      producerIds.forEach(signalNewConsumerTransport);
    });
  };

  const signalNewConsumerTransport = (remoteProducerId: string) => {
    if (consumingTransports.includes(remoteProducerId)) return;
    setConsumingTransports((prev) => [...prev, remoteProducerId]);

    socket.emit('createWebRtcTransport', { consumer: true }, ({ params }: { params: TransportParams }) => {
      if (!params) {
        console.error('Error creating consumer transport:');
        return;
      }

      if (!device) return;

      const transport = device.createRecvTransport(params);

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      transport.on('connect', ({ dtlsParameters }, callback) => {
        try {
          socket.emit('transport-recv-connect', { dtlsParameters, serverConsumerTransportId: params.id });
          callback();
        } catch (error) {
          console.error('Error while connecting transport:', error);
        }
      });

      connectRecvTransport(transport, remoteProducerId, params.id);
    });
  };

  const connectRecvTransport = (
    transport: mediasoup.types.Transport<mediasoup.types.AppData>,
    remoteProducerId: string,
    serverConsumerTransportId: string,
  ) => {
    if (!device) return;

    socket.emit(
      'consume',
      { rtpCapabilities: device.rtpCapabilities, remoteProducerId, serverConsumerTransportId },
      async ({ params }: { params: any }) => {
        if (params.error) {
          console.error('Cannot consume:', params.error);
          return;
        }

        const consumer = await transport.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters,
        });

        setConsumerTransports((prev) => [
          ...prev,
          {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            consumerTransport: transport,
            serverConsumerTransportId: params.id,
            producerId: remoteProducerId,
            consumer,
          },
        ]);

        if (!videoContainer) return;

        const newElem = document.createElement('div');
        newElem.setAttribute('id', `td-${remoteProducerId}`);

        if (params.kind === 'audio') {
          newElem.innerHTML = `<audio id="${remoteProducerId}" autoplay></audio>`;
        } else {
          newElem.setAttribute('class', 'remoteVideo');
          newElem.innerHTML = `<video id="${remoteProducerId}" autoplay class="video"></video>`;
        }

        videoContainer.current?.appendChild(newElem);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { track } = consumer;
        const mediaElement = document.getElementById(remoteProducerId) as HTMLMediaElement;
        if (mediaElement) {
          mediaElement.srcObject = new MediaStream([track]);
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        socket.emit('consumer-resume', { serverConsumerId: params.serverConsumerId });
      },
    );
  };

  useEffect(() => {
    getLocalStream();

    socket.on('producer-closed', ({ remoteProducerId }: { remoteProducerId: string }) => {
      const consumerTransportData = consumerTransports.find((data) => data.producerId === remoteProducerId);
      if (consumerTransportData) {
        consumerTransportData.consumerTransport.close();
        consumerTransportData.consumer.close();
        setConsumerTransports((prev) => prev.filter((data) => data.producerId !== remoteProducerId));

        if (videoContainer) {
          const videoElement = document.getElementById(`td-${remoteProducerId}`);
          if (videoElement) {
            videoContainer.current?.removeChild(videoElement);
          }
        }
      }
    });

    socket.on('new-producer', ({ producerId }: { producerId: string }) => signalNewConsumerTransport(producerId));

    return () => {
      socket.off('producer-closed');
      socket.off('new-producer');
      socket.off('connection-success');
    };
  }, []);

  return (
    <div className="flex flex-col gap-14 justify-center items-center w-full p-4">
      <div className="flex flex-wrap gap-4 justify-around w-full" ref={videoContainer}>
        <video ref={setLocalVideo} autoPlay muted></video>
      </div>

      <div className="flex items-center gap-2 justify-center w-fit">
        <Input value={`${process.env.FRONTEND_URL}/?roomId=${id}`} readOnly className="border-gray-400 border-2 bg-white p-2" />
        <Button
          onClick={() => {
            navigator.clipboard.writeText(`${process.env.FRONTEND_URL}/?roomId=${id}`);
          }}>
          Kopiraj link
        </Button>
      </div>
    </div>
  );
}
