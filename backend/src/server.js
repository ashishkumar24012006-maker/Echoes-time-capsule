
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';

const port = process.env.PORT || 4000;
mongoose.set('bufferCommands', false);
const server = app.listen(port, () => console.log(`ECHOES API listening on ${port}`));
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/echoes';
try {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  console.log('MongoDB connected');
} catch (error) {
  console.error(`MongoDB connection failed: ${error.message}`);
  console.error('Set MONGODB_URI in backend/.env and make sure MongoDB is running, then restart the API.');
}
const shutdown = async signal => {
  console.log(`${signal}: shutting down ECHOES API`);
  await mongoose.disconnect();
  server.close(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
