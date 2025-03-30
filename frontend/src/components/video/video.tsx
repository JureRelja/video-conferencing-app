'use client';

import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import * as mediasoup from 'mediasoup-client';
import { RtpCapabilities } from 'mediasoup-client/types';
import { Socket } from 'socket.io-client';

export default function Video({
  isModerator,
  isThisUser,
  name,
  total,
  socket,
}: {
  isThisUser?: boolean;
  isModerator?: boolean;
  name: string;
  total: number;
  socket: Socket;
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
      const response = await fetch(`${process.env.BACKEND_URL}/rooms/router/${socket.id}`);
      const routerRtpCapabilities = (await response.json()) as RtpCapabilities;
      console.log(routerRtpCapabilities);
      await device.load({ routerRtpCapabilities });
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
