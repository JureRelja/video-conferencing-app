'use client';
import socket from '@/socket/socket-io';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { startCall, joinCall } from '@/actions';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  const joinCallWithId = async (formData: FormData) => {
    console.log('Socket:', socket);
    const room = await joinCall(socket.id as string, formData);

    console.log('Room:', room);

    const response = await fetch(`${process.env.BACKEND_URL}/rooms/router/${socket.id}`);
    const routerRtpCapabilities = (await response.json()) as RtpCapabilities;
    console.log(routerRtpCapabilities);

    if (room) {
      socket.emit('join-room', room.uuid, socket.id);
      void router.push(`/rooms/${room.uuid}`);
    } else {
      alert('Poziv nije pronađen. Proverite kod poziva i pokušajte ponovo.');
    }
  };

  const startCallWithId = async (formData: FormData) => {
    console.log('Socket:', socket);
    const room = await startCall(socket.id as string, formData);

    console.log('Room:', room);

    const response = await fetch(`${process.env.BACKEND_URL}/rooms/router/${socket.id}`);
    const routerRtpCapabilities = (await response.json()) as RtpCapabilities;
    console.log(routerRtpCapabilities);

    if (room) {
      socket.emit('join-room', room.uuid, socket.id);
      void router.push(`/rooms/${room.uuid}`);
    } else {
      alert('Nije bilo moguće započeti novi poziv. Molimo pokušajte ponovo.');
    }
  };

  return (
    <div className="flex flex-col gap-12 w-full">
      <div className="flex flex-col gap-5 justify-center items-center">
        <h2 className="text-2xl text-center">Novi poziv</h2>

        <form action={startCallWithId}>
          <div className="flex flex-col gap-5 justify-center items-center">
            <Input
              className="border-2 rounded-sm px-3 py-2 border-gray-400 w-[400px]"
              type="text"
              name="name"
              placeholder="Unesite svoje ime, npr. Marko"
            />
            <Button size={'default'} onClick={() => startCall}>
              Novi poziv
            </Button>
          </div>
        </form>
      </div>

      <div className="flex flex-col gap-5 justify-center items-center">
        <h2 className="text-2xl text-center">Pridruži se postojećem pozivu</h2>

        <form action={joinCallWithId}>
          <div className="flex flex-col gap-5 justify-center items-center">
            <Input
              className="border-2 rounded-sm px-3 py-2 border-gray-400 w-[400px]"
              type="text"
              name="name"
              placeholder="Unesite svoje ime, npr. Marko"
            />
            <Input
              className="border-2 rounded-sm px-3 py-2 border-gray-400 w-[400px]"
              type="text"
              name="roomCode"
              placeholder="Unesite kod poziva, npr. f20jf04j043f0344fj0"
            />
            <Button onClick={() => joinCall}>Pridruži se</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
