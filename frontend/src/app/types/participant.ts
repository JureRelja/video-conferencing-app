export type Participant = {
  id: number;
  name: string;
  socketId: string;
  role: 'USER' | 'MODERATOR';
  roomId: number;
};
