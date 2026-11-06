-- GIPHY GIFs and stickers in chat. Their attachment `path` is "giphy:<id>/<file>"
-- (a link to GIPHY's media, rebuilt into a URL on read), not a gnw-chat storage path.
ALTER TYPE "ChatAttachmentKind" ADD VALUE 'gif';
ALTER TYPE "ChatAttachmentKind" ADD VALUE 'sticker';
