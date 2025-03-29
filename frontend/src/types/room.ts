import { Participant } from './participant';

export type Room = {
  id: number;
  uuid: string;
  sdp: string | null;
  sdpType: string | null;
  participants: Participant[];
};
