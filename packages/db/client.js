/**
 * TODO: Add implementation for packages/db/client.js.
 */
import postgres from 'postgres';

// Ensure you have DATABASE_URL in your root .env file
// Example: DATABASE_URL=postgres://user:password@localhost:5432/vaanisetudb
const sql = postgres(process.env.DATABASE_URL, {
    max: 10,             // Max number of connections
    idle_timeout: 20,    // Idle connection timeout in seconds
});

export default sql;
