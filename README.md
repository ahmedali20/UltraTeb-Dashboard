# Customers Dashboard

## الفكرة
واجهة بسيطة بتعرض جدول العملاء من Supabase، جاهزة للنشر على Vercel.

## خطوات النشر (المرة الأولى)

### 1) ارفع المشروع على GitHub
- اعمل repository جديد فاضي على GitHub
- ارفع كل الملفات دي جواه (بدون تعديل)

### 2) وصّل المشروع بـ Vercel
1. روح على https://vercel.com وسجل دخول (تقدر تستخدم حساب GitHub مباشرة)
2. دوس **Add New → Project**
3. اختار الـ repository اللي رفعته
4. Vercel هيتعرف إنه مشروع Next.js أوتوماتيك

### 3) ضيف متغيرات البيئة (Environment Variables)
قبل ما تدوس Deploy، في نفس صفحة الإعداد:
- دوس على **Environment Variables**
- ضيف الاتنين دول (القيم موجودة في Supabase → Project Settings → API):

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL بتاعك |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |

⚠️ **متضيفهمش في أي مكان تاني غير هنا** — لو حطيتهم في كود ظاهر للمتصفح هيبقوا مكشوفين لأي حد.

### 4) دوس Deploy
هياخد دقيقة أو اتنين، وبعدها هتاخد لينك زي:
`https://customers-dashboard-xxxx.vercel.app`

افتحه وهتشوف جدول العملاء كامل.

## التشغيل محليًا (اختياري)
```bash
npm install
cp .env.local.example .env.local
# املى القيم في .env.local
npm run dev
```
افتح http://localhost:3000
