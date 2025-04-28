/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Device } from 'mediasoup-client';
import * as mediasoup from 'mediasoup-client';
import socket from '@/socket/socket-io';

type TransportParams = {
  id: string;
  iceParameters: any;
  iceCandidates: any;
  dtlsParameters: any;
  iceServers: any;
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

  const deviceRef = useRef<Device | null>(null);
  const videoContainer = useRef<HTMLDivElement | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);

  const rtpCapabilitiesRef = useRef<any>(null);
  const producerTransportRef = useRef<mediasoup.types.Transport<mediasoup.types.AppData> | null>(null);
  const consumerTransportsRef = useRef<ConsumerTransportData[]>([]);
  const consumingTransportsRef = useRef<string[]>([]);

  const audioParamsRef = useRef<any>(null);
  const videoParamsRef = useRef<any>({ params });

  const getLocalStream = () => {
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { width: { min: 300, max: 300 }, height: { min: 200, max: 200 } },
      })
      .then((stream) => {
        if (localVideo.current) {
          localVideo.current.srcObject = stream;
        }

        audioParamsRef.current = { track: stream.getAudioTracks()[0], ...audioParamsRef.current };
        videoParamsRef.current = { track: stream.getVideoTracks()[0], ...videoParamsRef.current };

        joinRoom();
      })
      .catch(() => {
        console.error('Error accessing media devices:');
      });
  };

  const joinRoom = () => {
    socket.emit('joinRoom', { roomName: id }, (data: { rtpCapabilities: any }) => {
      console.log(`Router RTP Capabilities: ${data.rtpCapabilities}`);
      rtpCapabilitiesRef.current = data.rtpCapabilities;
      createDevice(data.rtpCapabilities);
    });
  };

  const createDevice = async (rtpCapabilitiesLocal: mediasoup.types.RtpCapabilities) => {
    try {
      const newDevice = new Device();
      await newDevice.load({ routerRtpCapabilities: rtpCapabilitiesLocal });
      console.log('Device RTP Capabilities:', newDevice.rtpCapabilities);

      deviceRef.current = newDevice;
      createSendTransport();
    } catch (error: any) {
      console.error('Error creating device:', error);
      if (error.name === 'UnsupportedError') {
        console.warn('Browser not supported');
      }
    }
  };

  const createSendTransport = () => {
    socket.emit('createWebRtcTransport', { consumer: false }, ({ params }: { params: TransportParams }) => {
      if (!params) {
        console.error('Error creating transport:');
        return;
      }

      if (!deviceRef.current) return;

      console.log('Creating send transport...');

      const transport = deviceRef.current.createSendTransport(params);
      producerTransportRef.current = transport;

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

      connectSendTransport();
    });
  };

  const connectSendTransport = async () => {
    if (!producerTransportRef.current) return;

    console.log('Creating audio and video producers...');

    console.log('Audio params:', audioParamsRef.current);
    console.log('Video params:', videoParamsRef.current);

    if (!audioParamsRef.current) {
      console.log('No audio params available');
      return;
    }
    if (!videoParamsRef.current) {
      console.log('No video params available');
      return;
    }

    const audioProducer = await producerTransportRef.current.produce(audioParamsRef.current);
    const videoProducer = await producerTransportRef.current.produce(videoParamsRef.current);

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
    if (consumingTransportsRef.current.includes(remoteProducerId)) return;

    consumingTransportsRef.current.push(remoteProducerId);

    socket.emit('createWebRtcTransport', { consumer: true }, ({ params }: { params: TransportParams }) => {
      if (!params) {
        console.error('Error creating consumer transport:');
        return;
      }

      const currentDevice = deviceRef.current;
      if (!currentDevice) {
        console.error('Device is not ready');
        return;
      }

      const transport = currentDevice.createRecvTransport(params);

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
    if (!deviceRef.current) return;

    console.log('Creating consumer...');

    socket.emit(
      'consume',
      { rtpCapabilities: deviceRef.current.rtpCapabilities, remoteProducerId, serverConsumerTransportId },
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

        consumerTransportsRef.current.push({
          consumerTransport: transport,
          serverConsumerTransportId: params.id,
          producerId: remoteProducerId,
          consumer,
        });

        if (!videoContainer.current) return;

        const newElem = document.createElement('div');
        newElem.setAttribute('id', `td-${remoteProducerId}`);

        if (params.kind === 'audio') {
          const audioElem = document.createElement('video');
          audioElem.setAttribute('id', remoteProducerId);
          audioElem.setAttribute('autoplay', '');
          newElem.appendChild(audioElem);
        } else {
          newElem.className = 'w-[300px] max-h-[200px] object-contain relative bg-black'; // Apply class directly here

          const videoElem = document.createElement('video');
          videoElem.setAttribute('id', remoteProducerId);
          videoElem.setAttribute('autoplay', '');
          videoElem.className = 'w-full h-full object-contain bg-black'; // Apply class directly here
          newElem.appendChild(videoElem);
        }

        videoContainer.current.appendChild(newElem);

        const { track } = consumer;
        const mediaElement = document.getElementById(remoteProducerId) as HTMLMediaElement;
        if (mediaElement) {
          mediaElement.srcObject = new MediaStream([track]);
        }

        socket.emit('consumer-resume', { serverConsumerId: params.serverConsumerId });

        console.log('Consumer resume');
      },
    );
  };

  useEffect(() => {
    if (!localVideo.current?.srcObject) {
      getLocalStream();
    }

    socket.on('producer-closed', ({ remoteProducerId }: { remoteProducerId: string }) => {
      const consumerTransportData = consumerTransportsRef.current.find((data) => data.producerId === remoteProducerId);
      if (consumerTransportData) {
        consumerTransportData.consumerTransport.close();
        consumerTransportData.consumer.close();
        consumerTransportsRef.current = consumerTransportsRef.current.filter((data) => data.producerId !== remoteProducerId);

        const videoElement = document.getElementById(`td-${remoteProducerId}`);
        if (videoElement) {
          videoElement.remove();
        }
      }
    });

    socket.on('new-producer', ({ producerId }: { producerId: string }) => signalNewConsumerTransport(producerId));

    return () => {
      socket.off('producer-closed');
      socket.off('new-producer');
    };
  }, []);

  return (
    <div className="flex flex-col gap-14 justify-center items-center w-full p-4">
      <div className="flex flex-wrap gap-4 justify-center w-full" ref={videoContainer}>
        <div className="w-[300px] max-h-[200px] object-contain relative bg-black">
          <video ref={localVideo} autoPlay muted className="w-full h-full object-contain bg-black"></video>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-center w-fit">
        <Input value={`${process.env.NEXT_PUBLIC_FRONTEND_URL}/rooms/${id}`} readOnly className="border-gray-400 border-2 bg-white p-2" />
        <Button
          onClick={() => {
            navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_FRONTEND_URL}/rooms/${id}`);
          }}>
          Kopiraj link
        </Button>
      </div>
    </div>
  );
}
