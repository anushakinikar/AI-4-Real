/**
 * TODO: Add implementation for packages/db/index.js.
 */
import sql from './client.js';

export async function getUserByEmail(email) {
    // Queries the database to find a user securely
    const users = await sql`
    SELECT id, email, password, name 
    FROM users 
    WHERE email = ${email}
    LIMIT 1
  `;

    // If a user is found, return the first result, otherwise return null
    return users.length > 0 ? users[0] : null;
}

export { createStyleProfile } from './repositories/style-profile.repo.js';
export { createDocument } from './repositories/document-review.repo.js';