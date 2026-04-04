import * as Minio from 'minio';

// Configuration comes from your .env
export const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || '127.0.0.1',
    port: parseInt(process.env.MINIO_PORT) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'vaanisetu',
    secretKey: process.env.MINIO_SECRET_KEY || 'vaanisetu123'
});

export async function uploadToMinio(bucketName, fileName, fileStream) {
    // 1. Check if the bucket exists, if not, create it
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
        await minioClient.makeBucket(bucketName, 'us-east-1');
    }

    // 2. Upload the file stream directly into the bucket
    await minioClient.putObject(bucketName, fileName, fileStream);
    return `Successfully uploaded ${fileName} to ${bucketName}`;
}
