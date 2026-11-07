const multer = require('multer');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { mkdir, open, rename, unlink } = require('node:fs/promises');

const MAX_IMAGE_BYTES = 10_000_000;
const directory = path.join(__dirname, '../public/uploads');
const formats = {
    png: { mime: 'image/png', extensions: ['.png'] },
    jpg: { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'] },
    webp: { mime: 'image/webp', extensions: ['.webp'] }
};

// Signatures identify a container, not whether the complete image decodes safely.
function imageFormat(bytes, size) {
    if (size >= 33 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
        bytes.readUInt32BE(8) === 13 && bytes.toString('ascii', 12, 16) === 'IHDR') return 'png';
    if (size >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
    if (size >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.readUInt32LE(4) + 8 === size && bytes.toString('ascii', 8, 12) === 'WEBP' &&
        ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))) return 'webp';
    return null;
}

async function cleanupUpload(req) {
    // Multer removes files and clears their paths when parsing fails.
    if (!req.file?.path) { delete req.file; return; }
    try { await unlink(req.file.path); }
    catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    delete req.file;
}

const receive = multer({
    storage: multer.diskStorage({
        destination(req, file, callback) {
            mkdir(directory, { recursive: true }).then(() => callback(null, directory), callback);
        },
        filename(req, file, callback) { callback(null, `${randomUUID()}.upload`); }
    }),
    // Bound the entire multipart shape as well as individual image bytes.
    // Multer rejects at its threshold; the extra byte makes our public limit inclusive.
    limits: { fileSize: MAX_IMAGE_BYTES + 1, files: 1, fields: 8, parts: 9, fieldSize: 16_384 }
}).single('image');

function imageUpload(req, res, next) {
    receive(req, res, async error => {
        let status = 400;
        let message = 'Invalid image upload.';
        try {
            if (error) {
                if (error.storageErrors?.length) throw error.storageErrors[0];
                if (!(error instanceof multer.MulterError)) throw error;
                if (error.code === 'LIMIT_FILE_SIZE') {
                    status = 413;
                    message = 'Image must be no larger than 10 MB (10,000,000 bytes).';
                }
            } else if (!req.file) {
                message = 'No image uploaded.';
            } else if (req.file.size > MAX_IMAGE_BYTES) {
                status = 413;
                message = 'Image must be no larger than 10 MB (10,000,000 bytes).';
            } else {
                const handle = await open(req.file.path, 'r');
                const bytes = Buffer.alloc(32);
                try { await handle.read(bytes, 0, bytes.length, 0); }
                finally { await handle.close(); }
                const format = imageFormat(bytes, req.file.size);
                const declared = req.file.mimetype;
                const ext = path.extname(req.file.originalname).toLowerCase();
                if (format && formats[format].extensions.includes(ext) &&
                    (!declared || declared === 'application/octet-stream' || declared === formats[format].mime)) {
                    const filename = `${path.basename(req.file.filename, '.upload')}.${format}`;
                    const destination = path.join(directory, filename);
                    await rename(req.file.path, destination);
                    req.file.path = destination;
                    req.file.filename = filename;
                    req.file.mimetype = formats[format].mime;
                    return next();
                }
                status = 415;
                message = 'Use a JPEG, PNG or WebP image with matching file extension and content.';
            }
            await cleanupUpload(req);
            return res.status(status).json({ error: message });
        } catch (failure) {
            try { await cleanupUpload(req); }
            catch (cleanupError) { console.error('Upload cleanup failed:', cleanupError.code); }
            console.error('Upload processing failed:', failure.code || failure.name);
            return res.status(500).json({ error: 'Unable to process image upload.' });
        }
    });
}

module.exports = { imageUpload, cleanupUpload, imageFormat, MAX_IMAGE_BYTES };
