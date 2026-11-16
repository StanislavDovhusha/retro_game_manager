/** Import right after `env.ts`: tiny upload limits so the limit checks can be tested with small files. */
process.env.MAX_IMAGE_BYTES = '2048';
process.env.MAX_GAME_UPLOAD_BYTES = '4096';
