import mongoose from 'mongoose';
import crypto from 'crypto';

const adminInviteSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'manager', 'support', 'viewer'],
      default: 'support',
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'revoked'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

adminInviteSchema.methods.generateToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.token = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours validity
  return rawToken;
};

const AdminInvite = mongoose.model('AdminInvite', adminInviteSchema);
export default AdminInvite;
