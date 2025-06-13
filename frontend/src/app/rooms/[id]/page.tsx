/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable react-hooks/exhaustive-deps */
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

  // State for fullscreen video
  const [fullscreenVideo, setFullscreenVideo] = useState<string | null>(null);
  // State for muted participants
  const [mutedParticipants, setMutedParticipants] = useState<Set<string>>(new Set());

  const deviceRef = useRef<Device | null>(null);
  const gridContainer = useRef<HTMLDivElement | null>(null);
  const thumbnailContainer = useRef<HTMLDivElement | null>(null);
  const audioContainer = useRef<HTMLDivElement | null>(null);

  const localVideo = useRef<HTMLVideoElement | null>(null);

  const rtpCapabilitiesRef = useRef<any>(null);
  const producerTransportRef = useRef<mediasoup.types.Transport<mediasoup.types.AppData> | null>(null);
  const consumerTransportsRef = useRef<ConsumerTransportData[]>([]);
  const consumingTransportsRef = useRef<string[]>([]);

  const audioParamsRef = useRef<any>(null);
  const videoParamsRef = useRef<any>({ params });

  // Handle fullscreen video toggle
  const toggleFullscreen = (videoId: string) => {
    const newFullscreenVideo = fullscreenVideo === videoId ? null : videoId;
    setFullscreenVideo(newFullscreenVideo);

    if (newFullscreenVideo) {
      // Adjust layout for fullscreen mode
      if (gridContainer.current) {
        gridContainer.current.style.display = 'none';
      }
      if (thumbnailContainer.current) {
        thumbnailContainer.current.style.display = 'flex';
        thumbnailContainer.current.style.flexDirection = 'column';
        thumbnailContainer.current.style.width = '30%';
      }
    } else {
      // Reset layout to grid mode
      if (gridContainer.current) {
        gridContainer.current.style.display = 'flex';
      }
      if (thumbnailContainer.current) {
        thumbnailContainer.current.style.display = 'none';
      }
    }
  };

  // Create video element for both grid and thumbnail containers
  const createVideoElement = (participantId: string, track: MediaStreamTrack, container: HTMLDivElement, isGrid: boolean = true) => {
    const newElem = document.createElement('div');
    const containerId = isGrid ? 'grid' : 'thumbnail';
    newElem.setAttribute('id', `${containerId}-${participantId}`);

    if (isGrid) {
      newElem.className = 'w-[530px] max-h-[400px] object-contain relative bg-black cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all';
    } else {
      newElem.className =
        'w-full aspect-video bg-black cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all overflow-hidden relative rounded';
    }

    const videoElem = document.createElement('video');
    videoElem.setAttribute('id', `${containerId}-video-${participantId}`);
    videoElem.setAttribute('autoplay', 'true');
    videoElem.setAttribute('playsinline', 'true');
    videoElem.muted = mutedParticipants.has(participantId);
    videoElem.className = isGrid ? 'w-full h-full object-contain bg-black' : 'w-full h-full object-cover bg-black';
    videoElem.srcObject = new MediaStream([track]);

    // Create mute button overlay
    const muteButton = document.createElement('button');
    muteButton.setAttribute('id', `mute-btn-${containerId}-${participantId}`);
    muteButton.className = isGrid
      ? 'absolute top-2 right-2 bg-black bg-opacity-70 text-white p-2 rounded-full hover:bg-opacity-90 transition-all z-10'
      : 'absolute top-1 right-1 bg-black bg-opacity-70 text-white p-1 rounded-full hover:bg-opacity-90 transition-all z-10';

    const updateMuteButton = () => {
      const isMuted = mutedParticipants.has(participantId);
      const iconSize = isGrid ? '20' : '16';
      muteButton.innerHTML = isMuted
        ? `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="currentColor">
             <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
           </svg>`
        : `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="currentColor">
             <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
           </svg>`;
    };

    updateMuteButton();

    // Add click handler for mute toggle
    muteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleParticipantMute(participantId);
    });

    // Add click handler for fullscreen toggle
    newElem.addEventListener('click', () => toggleFullscreen(participantId));

    newElem.appendChild(videoElem);
    newElem.appendChild(muteButton);
    container.appendChild(newElem);

    // Try to play video
    videoElem.play().catch((error) => {
      console.log('Autoplay prevented, user interaction required:', error);
    });
  };

  // Handle participant mute toggle
  const toggleParticipantMute = (participantId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation(); // Prevent fullscreen toggle when clicking mute button
    }

    const newMutedParticipants = new Set(mutedParticipants);
    if (mutedParticipants.has(participantId)) {
      newMutedParticipants.delete(participantId);
    } else {
      newMutedParticipants.add(participantId);
    }
    setMutedParticipants(newMutedParticipants);

    const isMuted = newMutedParticipants.has(participantId);

    // Apply mute state to all video elements for this participant
    const gridVideo = document.getElementById(`grid-video-${participantId}`) as HTMLVideoElement | null;
    const thumbnailVideo = document.getElementById(`thumbnail-video-${participantId}`) as HTMLVideoElement | null;
    const fullscreenVideo = document.getElementById(`fullscreen-${participantId}`) as HTMLVideoElement | null;

    [gridVideo, thumbnailVideo, fullscreenVideo].forEach((video) => {
      if (video) {
        video.muted = isMuted;
      }
    });

    // Update all mute buttons for this participant
    const gridMuteBtn = document.getElementById(`mute-btn-grid-${participantId}`) as HTMLButtonElement | null;
    const thumbnailMuteBtn = document.getElementById(`mute-btn-thumbnail-${participantId}`) as HTMLButtonElement | null;

    [gridMuteBtn, thumbnailMuteBtn].forEach((btn) => {
      if (btn) {
        const isGrid = btn.id.includes('grid');
        const iconSize = isGrid ? '20' : '16';
        btn.innerHTML = isMuted
          ? `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="currentColor">
               <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
             </svg>`
          : `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="currentColor">
               <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
             </svg>`;
      }
    });
  };

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
          width: { ideal: 530 },
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
      void createDevice(data.rtpCapabilities);
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

      void connectSendTransport();
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

        if (!gridContainer.current || !audioContainer.current) return;

        if (params.kind === 'audio') {
          const newElem = document.createElement('div');
          newElem.setAttribute('id', `audio-${remoteProducerId}`);

          const audioElem = document.createElement('audio');
          audioElem.setAttribute('id', remoteProducerId);
          audioElem.setAttribute('autoplay', 'true');
          audioElem.muted = false; // Don't mute remote audio - users want to hear other participants
          newElem.appendChild(audioElem);
          audioContainer.current.appendChild(newElem);
        } else {
          const { track } = consumer;

          // Create video element in grid container
          if (gridContainer.current) {
            createVideoElement(remoteProducerId, track, gridContainer.current, true);
          }

          // Create video element in thumbnail container
          if (thumbnailContainer.current) {
            createVideoElement(remoteProducerId, track, thumbnailContainer.current, false);
          }
        }

        const { track } = consumer;

        // Set up audio element
        if (params.kind === 'audio') {
          const mediaElement = document.getElementById(remoteProducerId) as HTMLMediaElement;
          if (mediaElement) {
            mediaElement.srcObject = new MediaStream([track]);
            mediaElement.play().catch((error) => {
              console.log('Autoplay prevented, user interaction required:', error);
            });
          }
        }

        // Set up fullscreen video source if this is the fullscreen video
        const fullscreenElement = document.getElementById(`fullscreen-${remoteProducerId}`) as HTMLMediaElement;
        if (fullscreenElement) {
          fullscreenElement.srcObject = new MediaStream([track]);
          fullscreenElement.play().catch((error) => {
            console.log('Fullscreen autoplay prevented:', error);
          });
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

        // Remove elements from both containers
        const gridElement = document.getElementById(`grid-${remoteProducerId}`);
        const thumbnailElement = document.getElementById(`thumbnail-${remoteProducerId}`);
        const audioElement = document.getElementById(`audio-${remoteProducerId}`);

        if (gridElement) gridElement.remove();
        if (thumbnailElement) thumbnailElement.remove();
        if (audioElement) audioElement.remove();
      }
    });

    socket.on('new-producer', ({ producerId }: { producerId: string }) => signalNewConsumerTransport(producerId));

    return () => {
      socket.off('producer-closed');
      socket.off('new-producer');
    };
  }, []);

  return (
    <>
      <div ref={audioContainer}></div>

      <div className="flex flex-col gap-14 justify-center items-center w-full p-4">
        {fullscreenVideo ? (
          <div className="flex gap-4 w-full h-[80vh]">
            <div className="flex-[0.7] relative bg-black rounded-lg overflow-hidden">
              <video
                ref={fullscreenVideo === 'local' ? localVideo : undefined}
                id={fullscreenVideo === 'local' ? 'local-video' : `fullscreen-${fullscreenVideo}`}
                className="w-full h-full object-contain"
                onClick={() => setFullscreenVideo(null)}
                style={{ cursor: 'pointer' }}
                autoPlay
                playsInline
                muted={fullscreenVideo === 'local' || (fullscreenVideo !== null && mutedParticipants.has(fullscreenVideo))}
              />
            </div>

            <div className="flex-[0.3] flex flex-col gap-3 overflow-y-auto">
              {fullscreenVideo !== 'local' && (
                <div
                  className="w-full aspect-video bg-black rounded cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all overflow-hidden relative"
                  onClick={() => toggleFullscreen('local')}>
                  <video ref={localVideo} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
              )}

              <div ref={thumbnailContainer} className="flex flex-col gap-3"></div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 justify-center w-full" ref={gridContainer}>
            <div
              className="w-[530px] max-h-[300px] object-contain relative bg-black cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
              onClick={() => toggleFullscreen('local')}>
              <video ref={localVideo} autoPlay playsInline muted className="w-full h-full object-contain bg-black"></video>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 justify-center w-fit">
          <Input value={`${process.env.NEXT_PUBLIC_FRONTEND_URL}/rooms/${id}`} readOnly className="border-gray-400 border-2 bg-white p-2" />
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_FRONTEND_URL}/rooms/${id}`);
            }}>
            Kopiraj link
          </Button>
        </div>
      </div>
    </>
  );
}
