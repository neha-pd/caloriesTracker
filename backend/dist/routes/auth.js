import { z } from 'zod';
import { db } from '../db/client.js';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
// We'll init the client. It doesn't strictly need the Client ID here to verify if we pass audience,
// but let's read it from env if available.
const googleClient = new OAuth2Client();
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    display_name: z.string().min(1).optional(),
});
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});
export async function authRoutes(app) {
    // POST /api/auth/register
    app.post('/register', async (request, reply) => {
        const body = registerSchema.parse(request.body);
        const existing = await db `SELECT id FROM users WHERE email = ${body.email} LIMIT 1`;
        if (existing.length > 0) {
            return reply.status(409).send({ error: 'Email already registered' });
        }
        const hash = await bcrypt.hash(body.password, 12);
        const [user] = await db `
      INSERT INTO users (email, password_hash, display_name)
      VALUES (${body.email}, ${hash}, ${body.display_name ?? null})
      RETURNING id, email, display_name, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, created_at
    `;
        const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '15m' });
        const refresh = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });
        return reply.status(201).send({ user, token, refresh_token: refresh });
    });
    // POST /api/auth/login
    app.post('/login', async (request, reply) => {
        const body = loginSchema.parse(request.body);
        const [user] = await db `SELECT * FROM users WHERE email = ${body.email} LIMIT 1`;
        if (!user)
            return reply.status(401).send({ error: 'Invalid credentials' });
        const valid = await bcrypt.compare(body.password, user.password_hash);
        if (!valid)
            return reply.status(401).send({ error: 'Invalid credentials' });
        const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '15m' });
        const refresh = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });
        const { password_hash: _, ...safeUser } = user;
        return reply.send({ user: safeUser, token, refresh_token: refresh });
    });
    // POST /api/auth/refresh
    app.post('/refresh', async (request, reply) => {
        const { refresh_token } = request.body;
        try {
            const payload = app.jwt.verify(refresh_token);
            if (payload.type !== 'refresh')
                throw new Error('Not a refresh token');
            const token = app.jwt.sign({ sub: payload.sub }, { expiresIn: '15m' });
            return reply.send({ token });
        }
        catch {
            return reply.status(401).send({ error: 'Invalid or expired refresh token' });
        }
    });
    // DELETE /api/auth/logout (client simply discards tokens — stateless)
    app.delete('/logout', { onRequest: [app.authenticate] }, async (_req, reply) => {
        return reply.send({ message: 'Logged out' });
    });
    // POST /api/auth/google
    app.post('/google', async (request, reply) => {
        const { id_token } = request.body;
        if (!id_token)
            return reply.status(400).send({ error: 'id_token is required' });
        try {
            // Verify the token with Google
            const ticket = await googleClient.verifyIdToken({
                idToken: id_token,
                // audience: process.env.GOOGLE_CLIENT_ID, // Provide your Client ID here if needed
            });
            const payload = ticket.getPayload();
            if (!payload || !payload.email) {
                return reply.status(400).send({ error: 'Invalid Google token' });
            }
            const email = payload.email;
            const google_id = payload.sub;
            const display_name = payload.name;
            const avatar_url = payload.picture;
            // Ensure the table schema is altered (if not already)
            try {
                await db `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE`;
                await db `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`;
            }
            catch (err) {
                // Ignore if it fails due to permissions etc.
            }
            // Find user
            let [user] = await db `SELECT * FROM users WHERE email = ${email} LIMIT 1`;
            if (!user) {
                // Register new user
                [user] = await db `
          INSERT INTO users (email, google_id, display_name, avatar_url)
          VALUES (${email}, ${google_id}, ${display_name ?? null}, ${avatar_url ?? null})
          RETURNING id, email, display_name, avatar_url, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, created_at
        `;
            }
            else {
                // Update existing user with google_id if missing
                if (!user.google_id) {
                    [user] = await db `
            UPDATE users SET google_id = ${google_id}, avatar_url = COALESCE(avatar_url, ${avatar_url ?? null})
            WHERE email = ${email}
            RETURNING *
          `;
                }
            }
            const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '15m' });
            const refresh = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });
            const { password_hash: _, ...safeUser } = user;
            return reply.send({ user: safeUser, token, refresh_token: refresh });
        }
        catch (error) {
            console.error('Google verification error:', error.message);
            return reply.status(401).send({ error: 'Failed to authenticate with Google' });
        }
    });
}
//# sourceMappingURL=auth.js.map