'use client';

import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';

export default function Video({
  isModerator,
  isThisUser,
  name,
  total,
}: {
  isThisUser?: boolean;
  isModerator?: boolean;
  name: string;
  total: number;
}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [element, setElement] = useState<HTMLVideoElement | null>(null);

  const handleStream = (stream: MediaStream) => {
    if (element) {
      element.srcObject = stream;
    }
    setStream(stream);
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

  useEffect(() => {
    if (isThisUser) {
      void getLocalStream();
    } else {
      // Handle remote stream
      // Assuming you have a function to handle remote streams
      // handleRemoteStream();s
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
