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
  const audioContainer = useRef<HTMLDivElement | null>(null);

  const localVideo = useRef<HTMLVideoElement | null>(null);

  const rtpCapabilitiesRef = useRef<any>(null);
  const producerTransportRef = useRef<mediasoup.types.Transport<mediasoup.types.AppData> | null>(null);
  const consumerTransportsRef = useRef<ConsumerTransportData[]>([]);
  const consumingTransportsRef = useRef<string[]>([]);

  const audioParamsRef = useRef<any>(null);
  const videoParamsRef = useRef<any>({ params });

  const [consumers, setConsumers] = useState<{ id: string; track: MediaStreamTrack }[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const getLocalStream = () => {
    // Check if mediaDevices is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('getUserMedia not supported on this browser');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: {
          width: { ideal: 400 },
          height: { ideal: 300 },
          facingMode: 'user',
        },
      })
      .then((stream) => {
        if (localVideo.current) {
          localVideo.current.srcObject = stream;
        }

        // Check if tracks are available
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();

        if (audioTracks.length > 0) {
          audioParamsRef.current = { track: audioTracks[0], ...audioParamsRef.current };
        } else {
          console.warn('No audio track available');
        }

        if (videoTracks.length > 0) {
          videoParamsRef.current = { track: videoTracks[0], ...videoParamsRef.current };
        } else {
          console.warn('No video track available');
        }

        joinRoom();
      })
      .catch((error) => {
        console.error('Error accessing media devices:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);

        // Handle specific error types
        if (error.name === 'NotAllowedError') {
          console.error('Permission denied. Please allow camera and microphone access.');
        } else if (error.name === 'NotFoundError') {
          console.error('No camera or microphone found.');
        } else if (error.name === 'NotReadableError') {
          console.error('Camera or microphone is already in use.');
        } else if (error.name === 'OverconstrainedError') {
          console.error('Camera constraints cannot be satisfied.');
        } else if (error.name === 'SecurityError') {
          console.error('Security error. Make sure you are using HTTPS.');
        }
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

        addConsumer(remoteProducerId, consumer.track);

        const mediaElement = document.getElementById(remoteProducerId) as HTMLMediaElement;
        if (mediaElement) {
          mediaElement.srcObject = new MediaStream([consumer.track]);
        }

        socket.emit('consumer-resume', { serverConsumerId: params.serverConsumerId });
      },
    );
  };

  const addConsumer = (id: string, track: MediaStreamTrack) => {
    setConsumers((prev) => [...prev, { id, track }]);
  };

  const toggleActiveVideo = (id: string) => {
    setActiveVideoId((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    if (!localVideo.current?.srcObject) {
      getLocalStream();
    }

    socket.on('producer-closed', ({ remoteProducerId }: { remoteProducerId: string }) => {
      // Remove consumer from state
      setConsumers((prev) => prev.filter((consumer) => consumer.id !== remoteProducerId));

      // If the active video is the one being closed, reset active video
      setActiveVideoId((prev) => (prev === remoteProducerId ? null : prev));
    });

    socket.on('new-producer', ({ producerId }: { producerId: string }) => signalNewConsumerTransport(producerId));

    return () => {
      socket.off('producer-closed');
      socket.off('new-producer');
    };
  }, []);

  return (
    <div className="flex flex-col gap-14 justify-center items-center w-full p-4">
      <div ref={audioContainer}></div>

      {activeVideoId ? (
        <div className="flex gap-4 w-full h-[80vh]">
          {/* Active video - 70% width */}
          <div className="flex-[0.7] relative bg-black rounded-lg overflow-hidden">
            <video
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
              ref={(video) => {
                if (video) {
                  const track = consumers.find((c) => c.id === activeVideoId)?.track;
                  if (track) {
                    video.srcObject = new MediaStream([track]);
                  }
                }
              }}></video>
          </div>

          {/* Sidebar with other videos - 30% width */}
          <div className="flex-[0.3] flex flex-col gap-3 overflow-y-auto">
            {consumers
              .filter((c) => c.id !== activeVideoId)
              .map((consumer) => (
                <div
                  key={consumer.id}
                  className="w-full aspect-video bg-black rounded cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all overflow-hidden relative"
                  onClick={() => toggleActiveVideo(consumer.id)}>
                  <video
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    ref={(video) => {
                      if (video) {
                        video.srcObject = new MediaStream([consumer.track]);
                      }
                    }}></video>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center w-full">
          {consumers.map((consumer) => (
            <div
              key={consumer.id}
              className="w-[530px] max-h-[300px] object-contain relative bg-black cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
              onClick={() => toggleActiveVideo(consumer.id)}>
              <video
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
                ref={(video) => {
                  if (video) {
                    video.srcObject = new MediaStream([consumer.track]);
                  }
                }}></video>
            </div>
          ))}
        </div>
      )}

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
