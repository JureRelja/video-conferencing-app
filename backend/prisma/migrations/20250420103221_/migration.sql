/*
  Warnings:

  - A unique constraint covering the columns `[socketId]` on the table `Participant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Participant_socketId_key" ON "Participant"("socketId");
