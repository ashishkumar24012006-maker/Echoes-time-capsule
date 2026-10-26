import app from '../src/app.js';
import mongoose from 'mongoose';

let connectionPromise;

export default async function handler(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      if (!connectionPromise) {
        connectionPromise = mongoose.connect(process.env.MONGODB_URI)
          .catch((error) => {
            connectionPromise = null;
            throw error;
          });
      }

      await connectionPromise;
    }

    return app(req, res);
  } catch (error) {
    console.error('Backend initialization failed:', error.message);
    return res.status(503).json({
      error: 'Service temporarily unavailable'
    });
  }
}