import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sanitizePhoneNumber } from "../utils/phone.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
      maxlength: [100, "Name can not be more than 100 characters"],
    },
    firstName: {
      type: String,
      trim: true,
      default: '',
    },
    lastName: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    avatar: {
      type: String,
      default: '',
    },
    displayName: {
      type: String,
      trim: true,
      default: '',
    },
    jobTitle: {
      type: String,
      trim: true,
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      default: '',
    },
    dateOfBirth: {
      type: String,
      default: '',
    },
    settings: {
      language: { type: String, default: 'English (US)' },
      currency: { type: String, default: 'USD ($)' },
      timezone: { type: String, default: 'Africa/Addis_Ababa' },
      notifications: {
        orderUpdates: { type: Boolean, default: true },
        deliveryUpdates: { type: Boolean, default: true },
        reviewUpdates: { type: Boolean, default: true },
        promotionalEmails: { type: Boolean, default: false },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'deactivated', 'blocked', 'invited', 'inactive'],
      default: 'active',
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
    internalNotes: {
      type: String,
      default: '',
      trim: true,
    },
    marketingConsent: {
      type: Boolean,
      default: false,
    },
    isInvited: {
      type: Boolean,
      default: false,
    },
    inviteToken: String,
    inviteExpires: Date,
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Prevents password hash from being leaked in GET queries
    },
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
    },
    adminRole: {
      type: String,
      enum: ["owner", "admin", "manager", "support", "viewer"],
      default: null,
      index: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastLoginDevice: {
      type: String,
      default: '',
    },
    lastLoginIp: {
      type: String,
      default: '',
    },
    sessions: [
      {
        tokenHash: { type: String, select: false },
        device: { type: String, default: 'Desktop Browser' },
        browser: { type: String, default: 'Chrome' },
        os: { type: String, default: 'Linux' },
        ip: { type: String, default: '127.0.0.1' },
        location: { type: String, default: 'Addis Ababa, ET' },
        lastActive: { type: Date, default: Date.now },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationTokenExpires: Date,

    passwordResetToken: String,
    passwordResetExpires: Date,
    adminResetOtp: { type: String, select: false },
    adminResetOtpExpires: Date,

    refreshToken: {
      type: String,
      default: null, // Initialize refreshToken as null for new users
    },
    adminRefreshToken: {
      type: String,
      default: null, // Distinct administrator refresh token
    },
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt}
  },
);

// Mongoose Pre-Save Hook: Normalize names, phone, and hash password if modified
userSchema.pre("save", async function () {
  // Sync names accurately based on what was modified
  if (this.isModified("name")) {
    const parts = (this.name || '').trim().split(' ').filter(Boolean);
    this.firstName = parts[0] || '';
    this.lastName = parts.slice(1).join(' ') || '';
  } else if (this.isModified("firstName") || this.isModified("lastName")) {
    this.name = `${this.firstName || ''} ${this.lastName || ''}`.trim() || this.name;
  } else if (!this.firstName && !this.lastName && this.name) {
    const parts = (this.name || '').trim().split(' ').filter(Boolean);
    this.firstName = parts[0] || '';
    this.lastName = parts.slice(1).join(' ') || '';
  }

  // Sanitize phone
  if (this.phone) {
    this.phone = sanitizePhoneNumber(this.phone);
  }

  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance method to generate and hash a Password Reset Token
userSchema.methods.createPasswordResetToken = function (expiresInMs = 60 * 60 * 1000) {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = new Date(Date.now() + expiresInMs);

  return resetToken;
};

// Instance method to generate and hash an Email Verification Token
userSchema.methods.createEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  this.emailVerificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return verificationToken;
};

// Instance Method: Compare user entered password with database hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(String(enteredPassword), this.password);
};

// Auth Tokens (Instant token validation for reset/verify routes)
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

const User = mongoose.model("User", userSchema);

export default User;
