import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { uploadToMinio } from 'storage';
import { getUserByEmail, createStyleProfile, createDocument } from 'db';
import validationRoutes, { triggerDocumentValidation } from './routes/validation.js';
import translationRoutes from './routes/translation.js';

const fastify = Fastify({ logger: true });
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://127.0.0.1:8000';

async function triggerDocumentParsing(document, data) {
    const response = await fetch(`${NLP_SERVICE_URL}/parse`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            document_id: document.id,
            s3_key: document.s3_key,
            target_lang: document.target_lang || data.target_lang,
            org_id: String(data.org_id || 'default-org'),
            raw_bucket: 'vaanisetu-raw',
            parsed_bucket: process.env.MINIO_PARSED_BUCKET || 'vaanisetu-parsed',
            source_lang: data.source_lang || 'en-US'
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Parsing service failed (${response.status}): ${errorText}`);
    }

    return response.json();
}

fastify.register(cors, {
    origin: 'http://localhost:3000',
    credentials: true
});

fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'super-secret-fallback-key'
});

fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body;

    try {
        const user = await getUserByEmail(email);

        if (!user || password !== user.password) {
            return reply.status(401).send({ error: 'Invalid email or password' });
        }

        const displayName = user.full_name || user.name || user.email;

        const token = fastify.jwt.sign({
            id: user.id,
            email: user.email,
            name: displayName
        });

        return reply.send({
            success: true,
            token,
            user: { id: user.id, name: displayName }
        });
    } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Internal Server Error' });
    }
});

fastify.register(multipart);
fastify.register(validationRoutes);
fastify.register(translationRoutes);

fastify.post('/api/upload', async (request, reply) => {
    try {
        const data = await request.file();

        if (!data) {
            return reply.status(400).send({ error: 'No file uploaded' });
        }

        const uniqueFileName = `${Date.now()}-${data.filename}`;
        await uploadToMinio('vaanisetu-raw', uniqueFileName, data.file);

        return reply.send({ success: true, fileName: uniqueFileName });
    } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to process file upload' });
    }
});

fastify.post('/api/style-profile', async (request, reply) => {
    try {
        const data = request.body;

        if (!data.target_lang) {
            return reply.status(400).send({ error: 'Target language is required' });
        }

        const generatedId = data.project_id || Math.floor(Math.random() * 2147483647);

        const newProfile = await createStyleProfile({
            id: generatedId,
            org_id: data.org_id,
            domain: data.domain,
            tone: data.tone.toUpperCase(),
            source_lang: data.source_lang,
            target_lang: data.target_lang,
            style_rules: data.style_rules,
            project_id: generatedId,
            reference_pairs: data.reference_pairs || {},
            compiled_prompt: data.compiled_prompt || '',
            created_by: data.created_by || 1
        });

        let newDocument = null;
        let parsingResult = null;
        let validationResult = null;

        if (data.document_data && data.document_data.s3_key) {
            newDocument = await createDocument({
                filename: data.document_data.filename,
                s3_key: data.document_data.s3_key,
                target_lang: data.document_data.target_lang,
                sensitivity: (data.document_data.sensitivity || 'STANDARD').toUpperCase(),
                project_id: generatedId
            });

            parsingResult = await triggerDocumentParsing(newDocument, data);

            try {
                validationResult = await triggerDocumentValidation(newDocument, data);
            } catch (validationError) {
                fastify.log.error(validationError);
                validationResult = {
                    success: false,
                    document_id: newDocument.id,
                    error: validationError.message
                };
            }
        }

        return reply.status(201).send({
            success: true,
            profile: newProfile,
            document: newDocument,
            parsing: parsingResult,
            validation: validationResult
        });
    } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to create style profile' });
    }
});

const start = async () => {
    try {
        await fastify.listen({ port: 8081, host: '0.0.0.0' });
        console.log('API running on http://localhost:8081');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();