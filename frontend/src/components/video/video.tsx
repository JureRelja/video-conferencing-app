'use client';

import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import * as mediasoup from 'mediasoup-client';
import { AppData, RtpCapabilities, RtpParameters, TransportOptions } from 'mediasoup-client/types';
import socket from '@/socket/socket-io';

export default function Video({
  deviceData,
  roomId,
  socketId,
  isModerator,
  isThisUser,
  name,
  total,
}: {
  deviceData: { rtpCapabilities: RtpCapabilities; producerTransport: TransportOptions<AppData>; consumerTransport: TransportOptions<AppData> };
  isThisUser?: boolean;
  isModerator?: boolean;
  socketId: string;
  roomId: string;
  name: string;
  total: number;
}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [element, setElement] = useState<HTMLVideoElement | null>(null);
  const [device, setDevice] = useState<mediasoup.types.Device | null>(null);
  const [consumerTransport, setConsumerTransport] = useState<mediasoup.types.Transport<mediasoup.types.AppData> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [consumer, setConsumer] = useState<mediasoup.types.Consumer<mediasoup.types.AppData> | null>(null);
  const [producerTransport, setProducerTransport] = useState<mediasoup.types.Transport<mediasoup.types.AppData> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [producer, setProducer] = useState<mediasoup.types.Producer<mediasoup.types.AppData> | null>(null);

  const handleStream = (stream: MediaStream) => {
    if (element) {
      element.srcObject = stream;
      element.muted = true;
      const tracks = stream.getVideoTracks();

      if (tracks.length === 0) {
        console.error('No video track found');
        return;
      }
    }
    setStream(stream);
  };

  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      handleStream(stream);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      alert('Please allow camera and microphone access to join the room.');
    }
  };

  const createDevice = async () => {
    if (device) {
      return;
    }

    const deviceLocal = new mediasoup.Device();
    await deviceLocal.load({ routerRtpCapabilities: deviceData.rtpCapabilities });

    setDevice(deviceLocal);
    console.log(deviceData);
  };

  useEffect(() => {
    if (device) {
      if (isThisUser) {
        if (producerTransport) {
          return;
        }
        void createProducer();
      } else {
        if (consumerTransport) {
          return;
        }
        createConsumer();
      }
    }
  }, [device]);

  const createProducer = async () => {
    try {
      const producerTransport = device!.createSendTransport({
        id: deviceData.producerTransport.id,
        iceParameters: deviceData.producerTransport.iceParameters,
        iceCandidates: deviceData.producerTransport.iceCandidates,
        dtlsParameters: deviceData.producerTransport.dtlsParameters,
      });

      setProducerTransport(producerTransport);

      producerTransport.on('connect', ({ dtlsParameters }, callback) => {
        try {
          socket.emit('connect-transport', { roomId, dtlsParameters });
          callback();
        } catch (error) {
          console.error('Error while connecting producer transport', error);
        }
      });

      producerTransport.on('produce', ({ kind, rtpParameters }, callback) => {
        try {
          socket.emit('produce-transport', { roomId, kind, rtpParameters }, (data: { id: string | undefined }) => {
            if (!data.id) {
              console.error('Error while producing stream');
            } else {
              callback({ id: data.id });
            }
          });
        } catch (error) {
          console.error('Error while producing stream', error);
        }
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];

      const producer = await producerTransport.produce({
        track: videoTrack,
        encodings: [{ maxBitrate: 100000 }, { maxBitrate: 300000 }, { maxBitrate: 900000 }],
        codecOptions: {
          videoGoogleStartBitrate: 1000,
        },
      });

      console.log('Producer:', producer);

      setProducer(producer);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      console.log('Error consuming transport');
    }
  };

  const createConsumer = () => {
    try {
      const consumerTransport = device!.createRecvTransport({
        id: deviceData.consumerTransport.id,
        iceParameters: deviceData.consumerTransport.iceParameters,
        iceCandidates: deviceData.consumerTransport.iceCandidates,
        dtlsParameters: deviceData.consumerTransport.dtlsParameters,
      });

      setConsumerTransport(consumerTransport);

      consumerTransport.on('connect', ({ dtlsParameters }, callback) => {
        console.log('Connecting consumer transport');
        try {
          socket.emit('connect-consumer-transport', { roomId, dtlsParameters });
          callback();
        } catch (error) {
          console.error('Error while connecting producer transport', error);
        }
      });

      consumerTransport.on('connectionstatechange', (state) => {
        if (state === 'connected') {
          console.log('Consumer transport connected');
          socket.emit(
            'consume-transport',
            { roomId: roomId, rtpCapabilities: device!.rtpCapabilities, producerSocketId: socketId },
            async (data: {
              producerId: string | undefined;
              id: string | undefined;
              rtpParameters: RtpParameters;
              kind: 'audio' | 'video' | undefined;
            }) => {
              if (!data.id || !data.producerId || !data.kind || !data.rtpParameters) {
                console.error('Error while consuming stream');
              } else {
                const consumer = await consumerTransport.consume({
                  id: data.id,
                  producerId: data.producerId,
                  rtpParameters: data.rtpParameters,
                  kind: data.kind,
                });

                console.log('Consumer:', consumer);

                setConsumer(consumer);

                const stream = new MediaStream();
                stream.addTrack(consumer.track);

                handleStream(stream);

                socket.emit('consumer-resume', { roomId, consumerId: consumer.id });
              }
            },
          );
        } else if (state === 'failed') {
          console.error('Consumer transport failed');
        }
      });
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    void createDevice();

    if (isThisUser) {
      void getLocalStream();
    }
  }, [isThisUser, element]);

  return (
    <div className="flex flex-col gap-5 justify-center items-center">
      {isModerator && <Badge>Moderator</Badge>}

      <div className="flex gap-2">
        {!stream ? (
          <div>
            <p>Čekam video stream...</p>
          </div>
        ) : total < 5 ? (
          <video ref={setElement} autoPlay={true} controls={false} width="300px" />
        ) : total < 9 ? (
          <video ref={setElement} autoPlay={true} controls={false} width="280px" />
        ) : total < 19 ? (
          <video ref={setElement} autoPlay={true} controls={false} width="220px" />
        ) : (
          <video ref={setElement} autoPlay={true} controls={false} width="180px" />
        )}
      </div>

      <p>{name}</p>
    </div>
  );
}
