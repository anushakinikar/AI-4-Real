/**
 * TODO: Add implementation for apps/api/src/server.js.
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { uploadToMinio } from 'storage'
import { getUserByEmail } from 'db'; // Imports from your packages/db

const fastify = Fastify({ logger: true });

// Register CORS so frontend can talk to backend
fastify.register(cors, {
    origin: 'http://localhost:3000', // Your Next.js frontend URL
    credentials: true
});

// Configure JWT (make sure JWT_SECRET is in your .env)
fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'super-secret-fallback-key'
});

// Login Endpoint
fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body;

    try {
        // 1. Fetch user from Postgres
        const user = await getUserByEmail(email);

        if (!user) {
            return reply.status(401).send({ error: 'Invalid email or password' });
        }

        // 2. Compare passwords using bcrypt
        if (password !== user.password) {
            return reply.status(401).send({ error: 'Invalid email or password' });
        }



        // 3. Generate JWT Token
        const token = fastify.jwt.sign({
            id: user.id,
            email: user.email,
            name: user.full_name
        });

        // 4. Send token back to frontend
        return reply.send({
            success: true,
            token,
            user: { id: user.id, name: user.full_name }
        });



    } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Internal Server Error' });
    }
});


// ... (after your CORS and JWT registrations)
fastify.register(multipart);

fastify.post('/api/upload', async (request, reply) => {
    try {
        // Parse the incoming file from the frontend request
        const data = await request.file();

        if (!data) {
            return reply.status(400).send({ error: 'No file uploaded' });
        }

        // Upload the file stream to MinIO in the "raw" bucket
        // We add a timestamp to the filename to avoid overriding files with the exact same name
        const uniqueFileName = `${Date.now()}-${data.filename}`;
        await uploadToMinio('vaanisetu-raw', uniqueFileName, data.file);

        return reply.send({ success: true, fileName: uniqueFileName });
    } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to process file upload' });
    }
});


// Start the server
const start = async () => {
    try {
        await fastify.listen({ port: 8080, host: '0.0.0.0' });
        console.log('API running on http://localhost:8080');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
