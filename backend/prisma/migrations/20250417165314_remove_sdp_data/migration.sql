/*
  Warnings:

  - You are about to drop the column `sdp` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `sdpType` on the `Room` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Room" DROP COLUMN "sdp",
DROP COLUMN "sdpType";
