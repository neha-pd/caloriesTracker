import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
// ── Cloudinary config (only needed when STORAGE_MODE=cloudinary) ──────────
if (process.env.STORAGE_MODE === 'cloudinary') {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
}
// ── Local storage ─────────────────────────────────────────────────────────
async function uploadLocal(file, userId) {
    const ext = (file.filename.split('.').pop() ?? 'jpg').toLowerCase();
    const filename = `${uuidv4()}.${ext}`;
    const dir = path.resolve(process.env.UPLOAD_DIR ?? './uploads', userId);
    await fs.mkdir(dir, { recursive: true });
    const buffer = await file.toBuffer();
    await fs.writeFile(path.join(dir, filename), buffer);
    // Return a URL served by Fastify static (configured in index.ts)
    const base = `http://localhost:${process.env.PORT ?? 3000}`;
    return `${base}/uploads/${userId}/${filename}`;
}
// ── Cloudinary storage ─────────────────────────────────────────────────────
async function uploadCloudinary(file, userId) {
    const buffer = await file.toBuffer();
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
            folder: `fitlens/${userId}`,
            resource_type: 'image',
            transformation: [{ width: 800, crop: 'limit', quality: 'auto' }],
        }, (error, result) => {
            if (error || !result)
                return reject(error ?? new Error('Cloudinary upload failed'));
            resolve(result.secure_url);
        });
        stream.end(buffer);
    });
}
// ── Public API ─────────────────────────────────────────────────────────────
export async function uploadImage(file, userId) {
    const mode = process.env.STORAGE_MODE ?? 'local';
    if (mode === 'cloudinary') {
        return uploadCloudinary(file, userId);
    }
    return uploadLocal(file, userId);
}
//# sourceMappingURL=storage.js.map