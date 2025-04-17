'use client';

import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import * as mediasoup from 'mediasoup-client';
import { AppData, RtpCapabilities, RtpParameters, TransportOptions } from 'mediasoup-client/types';
import socket from '@/socket/socket-io';

export default function Video({
  deviceData,
  roomId,
  isModerator,
  isThisUser,
  name,
  total,
}: {
  deviceData: { rtpCapabilities: RtpCapabilities; producerTransport: TransportOptions<AppData>; consumerTransport: TransportOptions<AppData> };
  isThisUser?: boolean;
  isModerator?: boolean;
  roomId: string;
  name: string;
  total: number;
}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [element, setElement] = useState<HTMLVideoElement | null>(null);
  const [consumerTransports, setConsumerTransports] = useState<mediasoup.types.Transport<mediasoup.types.AppData>[]>([]);
  const [consumer, setConsumer] = useState<mediasoup.types.Consumer<mediasoup.types.AppData> | null>(null);
  const [producerTransport, setProducerTransport] = useState<mediasoup.types.Transport<mediasoup.types.AppData> | null>(null);
  const [producer, setProducer] = useState<mediasoup.types.Producer<mediasoup.types.AppData> | null>(null);

  const handleStream = (stream: MediaStream) => {
    if (element) {
      element.srcObject = stream;
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
    } catch (error) {
      alert('Please allow camera and microphone access to join the room.');
    }
  };

  const createDevice = async () => {
    try {
      const device = new mediasoup.Device();
      await device.load({ routerRtpCapabilities: deviceData.rtpCapabilities });

      const producerTransport = device.createSendTransport({
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

      setProducer(producer);

      const consumerTransport = device.createRecvTransport({
        id: deviceData.producerTransport.id,
        iceParameters: deviceData.producerTransport.iceParameters,
        iceCandidates: deviceData.producerTransport.iceCandidates,
        dtlsParameters: deviceData.producerTransport.dtlsParameters,
      });

      setConsumerTransports((prev) => [...prev, consumerTransport]);

      consumerTransport.on('connect', ({ dtlsParameters }, callback) => {
        try {
          socket.emit('connect-consumer-transport', { roomId, dtlsParameters });
          callback();
        } catch (error) {
          console.error('Error while connecting producer transport', error);
        }
      });

      socket.emit(
        'consume-transport',
        { rtpCapabilities: device.rtpCapabilities },
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

            setConsumer(consumer);

            const track = consumer.track;

            // socket.emit('consumer-resume', { roomId });
          }
        },
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      console.log('Error consuming transport');
    }
  };

  useEffect(() => {
    if (isThisUser) {
      void getLocalStream();
    } else {
      // Handle remote stream
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
