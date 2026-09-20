require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const { initSocket } = require("./socket/socketHandler");

const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const storyRoutes = require("./routes/storyRoutes");
const userRoutes = require("./routes/userRoutes");

// ── التأكد من المتغيرات المطلوبة قبل ما نشغّل أي حاجة ─────────────────
const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET", "CLIENT_URL"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missing.length) {
  console.error("❌ ناقص متغيرات في ملف .env:", missing.join(", "));
  console.error("   انسخ backend/.env.example إلى backend/.env واملأ القيم.");
  process.exit(1);
}

connectDB();

const app = express();
const server = http.createServer(app);

// خلف أي reverse proxy (Render/Railway/Nginx) لازم نثق في هيدر X-Forwarded-For
// وإلا req.ip هيرجع IP البروكسي نفسه لكل المستخدمين، فالـ rate limiter هيتعامل
// مع كل زوار الموقع كأنهم شخص واحد ويقفل عليهم بسرعة
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// أوريجن صريح — مينفعش "*" مع credentials، المتصفح بيرفض
const allowedOrigins = process.env.CLIENT_URL.split(",").map((o) => o.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // بنسمح بالطلبات اللي من غير origin (Postman / السيرفر نفسه)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    const corsError = new Error("Origin غير مسموح به بواسطة CORS");
    corsError.status = 403;
    callback(corsError);
  },
  credentials: true,
};

const io = new Server(server, { cors: corsOptions });

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// السوكت متاح للكنترولرز عشان نبعت أحداث لحظية من السيرفر مباشرة
app.set("io", io);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/users", userRoutes);

app.get("/", (req, res) => {
  res.json({ status: "Moaaz Chat API is running 🚀" });
});

app.use((req, res) => {
  res.status(404).json({ message: "المسار غير موجود" });
});

// Error handler عام
app.use((err, req, res, next) => {
  // أخطاء رفع الملفات من multer (الحجم مثلاً) لازم ترجع رسالة مفهومة مش 500
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "حجم الملف كبير جداً، الحد الأقصى 25 ميجابايت"
        : "فشل رفع الملف";
    return res.status(400).json({ message });
  }

  // خطأ نوع الملف الجاي من fileFilter في uploadMiddleware.js مش MulterError رسمي
  if (err.message === "نوع الملف غير مسموح به") {
    return res.status(400).json({ message: err.message });
  }

  if (err.status === 403) {
    return res.status(403).json({ message: err.message });
  }

  console.error(err.stack);
  res.status(500).json({ message: "حصل خطأ غير متوقع في السيرفر" });
});

initSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
