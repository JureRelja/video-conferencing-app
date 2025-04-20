/*
  Warnings:

  - You are about to drop the column `roomId` on the `Participant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[socketId,roomUUID]` on the table `Participant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `roomUUID` to the `Participant` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Participant" DROP CONSTRAINT "Participant_roomId_fkey";

-- DropIndex
DROP INDEX "Participant_socketId_roomId_key";

-- AlterTable
ALTER TABLE "Participant" DROP COLUMN "roomId",
ADD COLUMN     "roomUUID" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Participant_socketId_roomUUID_key" ON "Participant"("socketId", "roomUUID");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_roomUUID_fkey" FOREIGN KEY ("roomUUID") REFERENCES "Room"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
