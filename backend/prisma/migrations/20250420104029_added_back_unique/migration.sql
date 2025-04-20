/*
  Warnings:

  - A unique constraint covering the columns `[socketId,roomId]` on the table `Participant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Participant_socketId_roomId_key" ON "Participant"("socketId", "roomId");
