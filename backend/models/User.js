const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false }, // مش إلزامي لو داخل بجيميل
    avatar: { type: String, default: "" },
    // public_id بتاع الصورة على Cloudinary — بنحتاجه عشان نمسح الصورة القديمة
    // من التخزين لما المستخدم يغيّر الأفاتار. بيفضل فاضي لو الصورة جاية من
    // جوجل (مش مرفوعة على Cloudinary بتاعنا) عشان منمسحش ملف مش بتاعنا
    avatarPublicId: { type: String, default: "" },
    bio: { type: String, default: "" },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    googleId: { type: String, default: null },

    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, select: false },
    verificationTokenExpires: { type: Date, select: false },

    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },

    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    socketId: { type: String, default: null },

    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
