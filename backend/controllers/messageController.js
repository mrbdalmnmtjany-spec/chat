const Message = require("../models/Message");
const Chat = require("../models/Chat");
const cloudinary = require("../config/cloudinary");
const uploadToCloudinary = require("../utils/uploadToCloudinary");
const { getChatIfMember } = require("../utils/chatAccess");

/**
 * بيبعت الرسالة لكل أعضاء المحادثة لحظيًا من السيرفر نفسه،
 * مش معتمدين على الفرونت إند إنه يعمل relay (ده كان بيضيّع رسائل).
 */
const emitToChat = (req, chatId, event, payload) => {
  const io = req.app.get("io");
  io?.to(chatId.toString()).emit(event, payload);
};

// @desc    إرسال رسالة (نص)
// @route   POST /api/messages
const sendMessage = async (req, res) => {
  try {
    const { chatId, content, replyTo } = req.body;
    if (!chatId || !content?.trim()) {
      return res.status(400).json({ message: "لازم تحدد المحادثة ومحتوى الرسالة" });
    }

    const chat = await getChatIfMember(chatId, req.user._id);
    if (!chat) {
      return res.status(403).json({ message: "مش عضو في المحادثة دي" });
    }

    let message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      type: "text",
      content: content.trim(),
      replyTo: replyTo || null,
      deliveredTo: [req.user._id],
      seenBy: [req.user._id],
    });

    message = await message.populate("sender", "-password");
    if (replyTo) message = await message.populate("replyTo");

    await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });

    emitToChat(req, chatId, "new-message", message);

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: "حصل خطأ في السيرفر", error: error.message });
  }
};

// @desc    إرسال رسالة وسائط (صوت/صورة/فيديو)
// @route   POST /api/messages/media
const sendMediaMessage = async (req, res) => {
  try {
    const { chatId, type, duration, replyTo } = req.body; // type: audio | image | video
    if (!chatId || !req.file) {
      return res.status(400).json({ message: "لازم ترفع ملف وتحدد المحادثة" });
    }

    const chat = await getChatIfMember(chatId, req.user._id);
    if (!chat) {
      return res.status(403).json({ message: "مش عضو في المحادثة دي" });
    }

    // ملحوظة: Cloudinary بيتعامل مع الصوت كـ resource_type "video"
    const resourceType = type === "video" || type === "audio" ? "video" : "image";

    const result = await uploadToCloudinary(req.file.buffer, {
      resource_type: resourceType,
      folder: `moaaz-chat/${type || "files"}`,
    });

    // متصفحات كل جهاز بتسجّل الصوت بصيغة مختلفة (Safari: mp4/aac، Chrome/Firefox: webm/opus)
    // و Safari مش بيشغّل webm خالص. بدل ما نسيب اللينك بصيغة المسجِّل الأصلية،
    // بنجبر Cloudinary يحوّل التسليم دايمًا لـ m4a (AAC) — مدعومة في كل المتصفحات والأجهزة.
    const mediaUrl =
      type === "audio"
        ? cloudinary.url(result.public_id, {
            resource_type: "video",
            format: "m4a",
            secure: true,
          })
        : result.secure_url;

    let message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      type: type || "file",
      mediaUrl,
      duration: Number(duration) || result.duration || 0,
      replyTo: replyTo || null,
      deliveredTo: [req.user._id],
      seenBy: [req.user._id],
    });

    message = await message.populate("sender", "-password");
    if (replyTo) message = await message.populate("replyTo");
    await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });

    emitToChat(req, chatId, "new-message", message);

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: "فشل رفع الملف", error: error.message });
  }
};

// @desc    جلب رسائل محادثة معينة
// @route   GET /api/messages/:chatId
const getMessages = async (req, res) => {
  try {
    const chat = await getChatIfMember(req.params.chatId, req.user._id);
    if (!chat) {
      return res.status(403).json({ message: "مش عضو في المحادثة دي" });
    }

    // الرسايل المحذوفة بترجع برضه عشان تتعرض كـ "تم حذف هذه الرسالة"
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "-password")
      .populate("replyTo")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "حصل خطأ في السيرفر", error: error.message });
  }
};

// @desc    تعليم الرسائل كمقروءة
// @route   PUT /api/messages/:chatId/seen
const markAsSeen = async (req, res) => {
  try {
    const chat = await getChatIfMember(req.params.chatId, req.user._id);
    if (!chat) {
      return res.status(403).json({ message: "مش عضو في المحادثة دي" });
    }

    await Message.updateMany(
      { chat: req.params.chatId, seenBy: { $ne: req.user._id } },
      { $addToSet: { seenBy: req.user._id, deliveredTo: req.user._id } }
    );

    // نبلّغ الباقيين إن الرسايل اتقرت عشان علامة ✓✓ تتحدث فورًا
    emitToChat(req, req.params.chatId, "messages-seen", {
      chatId: req.params.chatId,
      userId: req.user._id,
    });

    res.json({ message: "تم التحديث" });
  } catch (error) {
    res.status(500).json({ message: "حصل خطأ في السيرفر", error: error.message });
  }
};

// @desc    حذف رسالة (soft delete)
// @route   DELETE /api/messages/:id
const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "الرسالة غير موجودة" });
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "مينفعش تمسح رسالة مش بتاعتك" });
    }

    message.isDeleted = true;
    message.content = "";
    message.mediaUrl = "";
    message.duration = 0;
    await message.save();

    emitToChat(req, message.chat, "message-deleted", { messageId: message._id });

    res.json({ message: "تم حذف الرسالة", messageId: message._id });
  } catch (error) {
    res.status(500).json({ message: "حصل خطأ في السيرفر", error: error.message });
  }
};

module.exports = { sendMessage, sendMediaMessage, getMessages, markAsSeen, deleteMessage };
