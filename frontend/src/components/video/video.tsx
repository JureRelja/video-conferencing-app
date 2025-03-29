'use client';

import { Badge } from '@/components/ui/badge';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const handleStream = useCallback(
    (stream: MediaStream) => {
      console.log(videoRef.current);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStream(stream);
    },
    [videoRef],
  );

  const getLocalStream = useCallback(() => {
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
  }, [handleStream]);

  useEffect(() => {
    if (isThisUser) {
      void getLocalStream();
    } else {
      // Handle remote stream
      // Assuming you have a function to handle remote streams
      // handleRemoteStream();s
    }
  }, [isThisUser, getLocalStream]);

  return (
    <div className="flex flex-col gap-5 justify-center items-center">
      {isModerator && <Badge>Moderator</Badge>}

      <div className="flex gap-2">
        {!stream ? (
          <div>
            <p>Čekam video stream...</p>
          </div>
        ) : total < 5 ? (
          <video ref={getLocalStream} autoPlay={true} controls={false} width="300px" height="500px" />
        ) : total < 9 ? (
          <video ref={getLocalStream} autoPlay={true} controls={false} width="150px" height="300px" />
        ) : total < 19 ? (
          <video ref={videoRef} autoPlay={true} controls={false} width="100px" height="150px" />
        ) : (
          <video ref={videoRef} autoPlay={true} controls={false} width="50px" height="80px" />
        )}
      </div>

      <p>{name}</p>
    </div>
  );
}
