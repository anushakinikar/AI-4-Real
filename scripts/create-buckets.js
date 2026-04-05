/**
 * TODO: Add implementation for scripts/create-buckets.js.
 */

import { Client } from "minio";
import dotenv from "dotenv";
dotenv.config();
// Initialize MinIO client using environment variables
const minioClient = new Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT || "9000"),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
});
async function createBuckets() {
    const buckets = ["vaanisetu-raw", "vaanisetu-parsed"];
    for (const bucket of buckets) {
        try {
            const exists = await minioClient.bucketExists(bucket);
            if (!exists) {
                await minioClient.makeBucket(bucket);
                console.log(`Bucket "${bucket}" created successfully.`);
            } else {
                console.log(`Bucket "${bucket}" already exists.`);
            }
        } catch (error) {
            console.error(`Error creating bucket "${bucket}":`, error);
        }
    }
}
createBuckets();