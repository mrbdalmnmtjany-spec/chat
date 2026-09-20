const mongoose = require("mongoose");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const uploadToCloudinary = require("../utils/uploadToCloudinary");
const { escapeRegex } = require("../utils/chatAccess");

// @desc    بحث عن مستخدمين بالاسم أو الإيميل
// @route   GET /api/users/search?q=...
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    // بنهرب الحروف الخاصة عشان مدخل المستخدم ميتحولش لـ regex خطير
    const safeQuery = escapeRegex(q.trim());
    if (!safeQuery) return res.json([]);

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { name: { $regex: safeQuery, $options: "i" } },
        { email: { $regex: safeQuery, $options: "i" } },
      ],
    })
      .select("-password")
      .limit(20);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "حصل خطأ في السيرفر", error: error.message });
  }
};

// @desc    إضافة مستخدم لجهات الاتصال
// @route   PUT /api/users/contacts/:userId
const addContact = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "مستخدم غير صالح" });
    }
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: "مينفعش تضيف نفسك" });
    }

    const target = await User.findById(userId);
    if (!target) return res.status(404).json({ message: "المستخدم غير موجود" });

    const me = await User.findById(req.user._id);
    if (!me.contacts.includes(userId)) {
      me.contacts.push(userId);
      await me.save();
    }
    res.json({ message: "تمت الإضافة لجهات الاتصال" });
  } catch (error) {
    res.status(500).json({ message: "حصل خطأ في السيرفر", error: error.message });
  }
};

// @desc    تحديث بيانات البروفايل (الاسم/البايو/الصورة)
// @route   PUT /api/users/profile
const updateProfile = async (req, res) => {
  try {
    const { name, bio } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;

    if (req.file) {
      // نحتفظ بـ public_id القديم قبل ما نستبدله، عشان نمسحه من Cloudinary
      // بعد ما الرفع الجديد ينجح — كده مفيش صور يتيمة (orphaned) تتراكم في
      // التخزين وتكلّف فلوس من غير أي استخدام فعلي
      const oldPublicId = user.avatarPublicId;

      const result = await uploadToCloudinary(req.file.buffer, {
        resource_type: "image",
        folder: "moaaz-chat/avatars",
      });
      user.avatar = result.secure_url;
      user.avatarPublicId = result.public_id;

      if (oldPublicId) {
        try {
          await cloudinary.uploader.destroy(oldPublicId, { resource_type: "image" });
        } catch (cleanupError) {
          // مينفعش نفشّل تحديث البروفايل بسبب فشل مسح الصورة القديمة —
          // الأفاتار الجديد اتسجل صح، بس نسجّل الخطأ عشان نراجعه لو تكرر
          console.error("فشل مسح الأفاتار القديم من Cloudinary:", cleanupError.message);
        }
      }
    }

    await user.save();
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
    });
  } catch (error) {
    res.status(500).json({ message: "حصل خطأ في السيرفر", error: error.message });
  }
};

module.exports = { searchUsers, addContact, updateProfile };
