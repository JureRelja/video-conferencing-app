'use client';

import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import * as mediasoup from 'mediasoup-client';
import { AppData, RtpCapabilities, TransportOptions } from 'mediasoup-client/types';
import socket from '@/socket/socket-io';

const params = {
  encoding: [
    {
      rid: 'r0',
      maxBitrate: 100000,
      scalabilityMode: 'S1T3',
    },
    {
      rid: 'r1',
      maxBitrate: 300000,
      scalabilityMode: 'S1T3',
    },
    {
      rid: 'r2',
      maxBitrate: 900000,
      scalabilityMode: 'S1T3',
    },
  ],
  codecOptions: {
    videoGoogleStartBitrate: 1000,
  },
};

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

  const handleStream = async (stream: MediaStream) => {
    if (element) {
      element.srcObject = stream;
    }
    setStream(stream);
    await createDevice();
  };

  const getLocalStream = () => {
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        handleStream(stream);
      })
      .catch((error) => {
        console.error('Error while accesing camera and microphone.', error);
      });
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
          socket.emit('produce-transport', { roomId, kind, rtpParameters }, (id: string | undefined) => {
            if (!id) {
              console.error('Error while producing stream');
            } else {
              callback({ id });
            }
          });
        } catch (error) {
          console.error('Error while producing stream', error);
        }
      });

      await producerTransport.produce(params);
    } catch (error) {
      console.error('Error while creating device', error);
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
