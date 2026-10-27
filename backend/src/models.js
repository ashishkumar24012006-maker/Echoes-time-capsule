import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 80 },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_]{3,24}$/ },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  avatarUrl: String,
  emailVerified: { type: Boolean, default: false },
  notificationPreferences: { reveal: { type: Boolean, default: true }, product: { type: Boolean, default: false } }
}, { timestamps: true });

const capsuleSchema = new mongoose.Schema({
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  message: { type: String, required: true, maxlength: 10000 },
  media: [{ url: String, type: String, name: String, content: String }],
  mood: { type: String, enum: ['wonder', 'hope', 'love', 'courage', 'nostalgia', 'joy'], default: 'wonder' },
  tags: [{ type: String, lowercase: true, trim: true, maxlength: 32 }],
  visibility: { type: String, enum: ['private', 'public', 'recipient'], default: 'private' },
  status: { type: String, enum: ['draft', 'sealed', 'archived'], default: 'draft' },
  revealAt: { type: Date, required: true, index: true },
  timezone: { type: String, default: 'UTC' },
  sealedAt: Date
}, { timestamps: true });
capsuleSchema.index({ visibility: 1, status: 1, revealAt: 1 });

const notificationSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, capsuleId: mongoose.Schema.Types.ObjectId, type: String, message: String, isRead: { type: Boolean, default: false } }, { timestamps: true });
const tokenSchema = new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId, tokenHash: String, expiresAt: Date, usedAt: Date }, { timestamps: true });
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const User = mongoose.model('User', userSchema);
export const Capsule = mongoose.model('Capsule', capsuleSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const EmailVerificationToken = mongoose.model('EmailVerificationToken', tokenSchema);
export const PasswordResetToken = mongoose.model('PasswordResetToken', tokenSchema);
