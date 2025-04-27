'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { startCall } from '@/actions';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const router = useRouter();

  const joinCallWithId = (formData: FormData) => {
    const roomCode = formData.get('roomCode') as string;

    void router.push(`/rooms/${roomCode}?name=${formData.get('name') as string}`);
  };

  const startCallWithId = (formData: FormData) => {
    const roomCode = uuidv4();

    void router.push(`/rooms/${roomCode}?name=${formData.get('name') as string}`);
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
            <Button type="submit">Pridruži se</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
