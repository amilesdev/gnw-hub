-- PDFs in chat: a third attachment kind, plus the original file name to show on its card.
-- AlterEnum
ALTER TYPE "ChatAttachmentKind" ADD VALUE 'file';

-- AlterTable
ALTER TABLE "ChatAttachment" ADD COLUMN     "name" TEXT;
