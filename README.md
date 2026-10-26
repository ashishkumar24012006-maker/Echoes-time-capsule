# ECHOES — The Internet Time Capsule

ECHOES is a MERN application for sealing private, public, or recipient-specific memories until a future reveal date.

## Structure

- `frontend/` — Vite React client with the Cosmic Nostalgia design system.
- `backend/` — Express API with Mongoose models, cookie authentication, validation, and server-authoritative time locks.

## Local setup

1. Install Node.js 20+ and MongoDB (local or Atlas).
2. Copy `backend/.env.example` to `backend/.env` and fill in `MONGODB_URI` and a strong `JWT_SECRET`.
   On Windows PowerShell: `Copy-Item backend/.env.example backend/.env`.
3. Make sure MongoDB is running before testing login or signup. For local MongoDB, the default URI is `mongodb://127.0.0.1:27017/echoes`.
4. Run `npm run install:all`.
5. Run `npm run dev`.

The frontend runs on `http://localhost:5173`; the API runs on `http://localhost:4000`.
If MongoDB is unavailable, the API still starts and `/health` remains available, while database-backed requests return a clear `503` response instead of hanging.

## Production checklist

- Set `NODE_ENV=production`, HTTPS, a strict `CLIENT_URL`, and secure cookie settings.
- Configure Cloudinary signed uploads and an email provider before enabling media/email flows.
- Configure MongoDB Atlas network access and backups.
- Review the editable legal drafts in the frontend supporting pages before launch.
- Deploy the frontend to Vercel and the backend to Render with the variables in both `.env.example` files.
