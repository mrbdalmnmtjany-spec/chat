# Moaaz Chat 📖💬
https://backend-hci4.onrender.com
**كل حكاية تبدأ برسالة** — تطبيق شات كامل بمميزات شبيهة بالواتساب، مبني بستاك MERN.

## المميزات
- تسجيل دخول بإيميل/باسورد مع **تأكيد بالإيميل** (Nodemailer)
- **تسجيل دخول بجوجل** (Google Sign-In)
- شات شخصي (1:1) لحظي عبر **Socket.io**
- **جروبات** (إنشاء، إضافة/حذف أعضاء، أدمن)
- **رسائل صوتية** حقيقية بالمايك (MediaRecorder API)
- إرسال صور وفيديوهات
- **ستوري** (صورة/فيديو/نص) تختفي تلقائيًا بعد 24 ساعة + عداد مشاهدات
- حالة أونلاين/أوفلاين + "بيكتب..." + علامات القراءة (✓/✓✓)
- تصميم عربي أولاً (RTL) بهوية بصرية داكنة/ذهبية

## المتطلبات قبل التشغيل
1. **Node.js** v18 أو أحدث
2. حساب **MongoDB Atlas** (أو MongoDB محلي) — [mongodb.com/atlas](https://www.mongodb.com/atlas)
3. حساب **Cloudinary** مجاني لرفع الصوت/الصور/الفيديو — [cloudinary.com](https://cloudinary.com)
4. **Gmail App Password** لإرسال إيميلات التفعيل — [كيفية إنشاء App Password](https://support.google.com/accounts/answer/185833)
5. **Google OAuth Client ID** لتفعيل "تسجيل الدخول بجوجل" — من [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

## خطوات التشغيل

### 1) الباك اند
```bash
cd backend
npm install
cp .env.example .env
# افتح .env واملأ القيم الحقيقية (MONGO_URI, JWT_SECRET, EMAIL_*, GOOGLE_CLIENT_ID, CLOUDINARY_*)
npm run dev
```
السيرفر هيشتغل على `http://localhost:5000`

### 2) الفرونت اند
```bash
cd frontend
npm install
cp .env.example .env
# افتح .env وحط نفس GOOGLE_CLIENT_ID
npm run dev
```
الموقع هيشتغل على `http://localhost:5173`

> ملحوظة: الفرونت اند فيه proxy لـ `/api` **و `/socket.io` (بـ `ws: true`)** على `localhost:5000` (مضبوط في `vite.config.js`)، فمش هتحتاج تغيّر حاجة أثناء التطوير المحلي. لو شيلت الـ proxy، لازم تحط `VITE_API_URL` و `VITE_SOCKET_URL` في `.env`.

> مهم: السيرفر مش هيقوم من غير ملف `backend/.env` فيه `MONGO_URI` و `JWT_SECRET` و `CLIENT_URL` — هيقولك بالظبط الناقص إيه ويقف.

## إعداد Google OAuth
1. روح [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → أنشئ مشروع
2. APIs & Services → Credentials → Create Credentials → OAuth Client ID
3. النوع: **Web application**
4. Authorized JavaScript origins: `http://localhost:5173`
5. انسخ الـ Client ID وحطه في `.env` بتاع الباك اند والفرونت

## إعداد Cloudinary
1. سجل في [cloudinary.com](https://cloudinary.com) (مجاني)
2. من الـ Dashboard خد: `Cloud Name`, `API Key`, `API Secret`
3. حطهم في `backend/.env`

## هيكل المشروع
```
moaaz-chat/
├── backend/
│   ├── config/         # DB + Cloudinary
│   ├── controllers/    # منطق الـ auth, chats, messages, stories, users
│   ├── middleware/     # حماية الراوتس + رفع الملفات
│   ├── models/         # User, Chat, Message, Story
│   ├── routes/
│   ├── socket/         # Socket.io handlers
│   ├── utils/          # إرسال إيميل، رفع Cloudinary، توليد التوكن
│   └── server.js
└── frontend/
    └── src/
        ├── components/ # Sidebar, ChatWindow, VoiceRecorder, StoriesBar...
        ├── context/    # AuthContext
        ├── pages/      # AuthPage, VerifyEmailPage, ChatPage
        └── utils/      # api.js, socket.js
```

## النشر (Deployment)
- **الباك اند**: Render / Railway / Fly.io (لازم يدعم WebSockets لـ Socket.io)
- **الفرونت اند**: Vercel / Netlify
- لا تنسَ تحديث `CLIENT_URL` في الباك اند و `VITE_*` والـ proxy في الفرونت للدومينات الحقيقية بعد النشر

## خطوات تالية مقترحة
- إضافة "نسيت كلمة المرور"
- إشعارات Push (Web Push / FCM)
- مكالمات صوت/فيديو (WebRTC)
- بحث داخل الرسائل
- تفاعلات (❤️ 👍) على الرسائل
