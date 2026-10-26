import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import mongoose from 'mongoose';
import { User, Capsule, Notification } from './models.js';

const app = express();
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'development-only-secret-change-me');
const isProd = process.env.NODE_ENV === 'production';
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: true }));
// Avoid Mongoose command buffering making auth requests hang when MongoDB is unavailable.
app.use('/api/v1', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database unavailable. Start MongoDB or configure MONGODB_URI.' });
  }
  next();
});

const publicUser = user => ({ id: user._id, fullName: user.fullName, username: user.username, email: user.email, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified });
const safeCapsule = (c, reveal = false) => ({ id: c._id, title: c.title, mood: c.mood, tags: c.tags, visibility: c.visibility, status: c.status, revealAt: c.revealAt, timezone: c.timezone, sealedAt: c.sealedAt, createdAt: c.createdAt, unlocked: reveal && new Date() >= c.revealAt, ...(reveal ? { message: c.message, media: c.media } : {}) });
const tokenFor = id => new SignJWT({ sub: id.toString() }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(secret);
const setAuth = async (res, id) => res.cookie('echoes_session', await tokenFor(id), { httpOnly: true, sameSite: isProd ? 'none' : 'lax', secure: isProd, domain: process.env.COOKIE_DOMAIN || undefined, maxAge: 7 * 24 * 3600 * 1000 });
const requireAuth = async (req, res, next) => { try { const token = req.cookies.echoes_session; if (!token) return res.status(401).json({ error: 'Authentication required' }); const { payload } = await jwtVerify(token, secret); const user = await User.findById(payload.sub); if (!user) return res.status(401).json({ error: 'Session expired' }); req.user = user; next(); } catch { res.status(401).json({ error: 'Authentication required' }); } };
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const registerSchema = z.object({ fullName: z.string().min(2).max(80), username: z.string().regex(/^[a-zA-Z0-9_]{3,24}$/), email: z.string().email(), password: z.string().min(8).max(128) });
const capsuleSchema = z.object({ title: z.string().min(1).max(140), message: z.string().min(1).max(10000), revealAt: z.coerce.date(), timezone: z.string().max(80).default('UTC'), mood: z.enum(['wonder', 'hope', 'love', 'courage', 'nostalgia', 'joy']).default('wonder'), tags: z.array(z.string().max(32)).max(10).default([]), visibility: z.enum(['private', 'public', 'recipient']).default('private'), recipientId: z.string().optional() });

app.get('/health', (_req, res) => res.json({ ok: true, service: 'echoes-api' }));
app.post('/api/v1/auth/register', asyncRoute(async (req, res) => { const data = registerSchema.parse(req.body); const exists = await User.findOne({ $or: [{ email: data.email.toLowerCase() }, { username: data.username.toLowerCase() }] }); if (exists) return res.status(409).json({ error: 'Email or username is already in use' }); const user = await User.create({ ...data, email: data.email.toLowerCase(), username: data.username.toLowerCase(), passwordHash: await argon2.hash(data.password) }); await setAuth(res, user._id); res.status(201).json({ user: publicUser(user) }); }));
app.post('/api/v1/auth/login', asyncRoute(async (req, res) => { const identity = String(req.body.identity || '').toLowerCase(); const user = await User.findOne({ $or: [{ email: identity }, { username: identity }] }).select('+passwordHash'); if (!user || !(await argon2.verify(user.passwordHash, req.body.password || ''))) return res.status(401).json({ error: 'Invalid credentials' }); await setAuth(res, user._id); res.json({ user: publicUser(user) }); }));
app.post('/api/v1/auth/logout', (_req, res) => res.clearCookie('echoes_session').json({ ok: true }));
app.get('/api/v1/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

app.get('/api/v1/capsules', requireAuth, asyncRoute(async (req, res) => { const capsules = await Capsule.find({ creatorId: req.user._id, status: { $ne: 'archived' } }).sort({ revealAt: 1 }); res.json({ capsules: capsules.map(c => safeCapsule(c, new Date() >= c.revealAt)) }); }));
app.get('/api/v1/capsules/timeline', requireAuth, asyncRoute(async (req, res) => { const capsules = await Capsule.find({ creatorId: req.user._id }).sort({ revealAt: 1 }); res.json({ capsules: capsules.map(c => safeCapsule(c, new Date() >= c.revealAt)) }); }));
app.get('/api/v1/capsules/:id', requireAuth, asyncRoute(async (req, res) => { const c = await Capsule.findById(req.params.id); if (!c) return res.status(404).json({ error: 'Capsule not found' }); const owner = c.creatorId.equals(req.user._id); const recipient = c.recipientId?.equals(req.user._id); if (!owner && !recipient && c.visibility !== 'public') return res.status(403).json({ error: 'You cannot access this capsule' }); const unlocked = new Date() >= c.revealAt; res.json({ capsule: safeCapsule(c, unlocked && (owner || recipient || c.visibility === 'public')) }); }));
app.post('/api/v1/capsules', requireAuth, asyncRoute(async (req, res) => { const data = capsuleSchema.parse(req.body); if (data.revealAt <= new Date()) return res.status(422).json({ error: 'Reveal time must be in the future' }); const c = await Capsule.create({ ...data, creatorId: req.user._id }); res.status(201).json({ capsule: safeCapsule(c) }); }));
app.post('/api/v1/capsules/:id/seal', requireAuth, asyncRoute(async (req, res) => { const c = await Capsule.findOne({ _id: req.params.id, creatorId: req.user._id }); if (!c) return res.status(404).json({ error: 'Capsule not found' }); if (c.status !== 'draft') return res.status(409).json({ error: 'Capsule is already sealed' }); if (c.revealAt <= new Date()) return res.status(422).json({ error: 'Reveal time must be in the future' }); c.status = 'sealed'; c.sealedAt = new Date(); await c.save(); res.json({ capsule: safeCapsule(c) }); }));
app.delete('/api/v1/capsules/:id', requireAuth, asyncRoute(async (req, res) => { const result = await Capsule.deleteOne({ _id: req.params.id, creatorId: req.user._id }); res.status(result.deletedCount ? 204 : 404).end(); }));
app.get('/api/v1/explore', asyncRoute(async (req, res) => { const q = String(req.query.q || ''); const filter = { visibility: 'public', status: 'sealed', revealAt: { $lte: new Date() }, ...(q ? { $or: [{ title: new RegExp(q, 'i') }, { tags: new RegExp(q, 'i') }] } : {}) }; const capsules = await Capsule.find(filter).sort({ createdAt: -1 }).limit(30); res.json({ capsules: capsules.map(c => safeCapsule(c, true)) }); }));
app.get('/api/v1/notifications', requireAuth, asyncRoute(async (req, res) => res.json({ notifications: await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50) })));
app.use((err, _req, res, _next) => { if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.flatten() }); if (err.code === 11000) return res.status(409).json({ error: 'A unique field is already in use' }); console.error(err); res.status(500).json({ error: 'Something went wrong' }); });
export default app;
