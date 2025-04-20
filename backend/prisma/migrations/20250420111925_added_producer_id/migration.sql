/*
  Warnings:

  - Added the required column `producerId` to the `Participant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "producerId" TEXT NOT NULL;
