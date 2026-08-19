# Ultra Teb Dashboard

## الفكرة

نظام داخلي (internal dashboard) لإدارة العمليات المحاسبية والتجارية لشركة Ultra Teb، مبني بـ Next.js
ومتصل بـ Supabase، ومنشور على Vercel. مش مجرد جدول عرض — النظام بيغطي دورة عمل كاملة بصلاحيات
مستخدمين مختلفة (admin / user) لكل موديول.

### الموديولات الموجودة

- **العملاء (customers)** — بيانات العملاء وربطهم بمندوبي المبيعات
- **المبيعات (sales)** — فواتير، إشعارات دائن/مدين (CR/DR notes)
- **التحصيل (collections)** والشيكات (cheques) — تتبع حالة الشيكات وتخصيصها للفواتير
- **الضريبة المخصومة (wht)** وتقرير ضريبة القيمة المضافة (vat-report)
- **قائمة الدخل (income-statement-data)** وتكلفة البضاعة المباعة (cogs)
- **مندوبي المبيعات وفرق المبيعات (sales-reps / sales-teams)** — بما فيها الحوافز والخصومات
- **إدارة المستخدمين (users)** والصلاحيات (authorization) — كل موديول له صلاحية عرض/تعديل منفصلة
- **سجل النشاط (activity-log)** — تسجيل كل العمليات الحساسة (تسجيل دخول، تعديلات، إلخ)
- **مزامنة تلقائية يومية** من Google Sheets عبر Vercel Cron (`/api/google-sheets-sync`)

## التقنيات المستخدمة

- **Next.js 14** (App Router) + TypeScript
- **Supabase** (Postgres + service role access من السيرفر فقط)
- **Vercel** للاستضافة و الـ Cron jobs
- تصدير بيانات بصيغة Excel (`exceljs`) و PDF (`jspdf`)، واستيراد CSV (`papaparse`)

## الصلاحيات وتسجيل الدخول

- الدخول بجلسة موقّعة (signed session cookie) صالحة لمدة 8 ساعات، بدون تخزين session في الداتابيز.
- فيه حساب admin أساسي بيتحدد من متغيرات البيئة (`DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`) —
  أول تسجيل دخول بيه بينشئ صف مطابق في جدول `dashboard_users` تلقائيًا.
- باقي المستخدمين بيتضافوا وتتحدد صلاحياتهم (view/edit لكل موديول) من صفحة `/users` (admin فقط).
- كل صفحة وكل API route محميين على مستوى الـ middleware حسب دور وصلاحيات المستخدم.

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
قبل ما تدوس Deploy، في نفس صفحة الإعداد دوس على **Environment Variables** وضيف كل القيم
الموضّحة في ملف [`.env.local.example`](./.env.local.example) — الملف فيه شرح مختصر جوه كل متغير
ولإيه محتاجينه.

⚠️ **متضيفش أي مفتاح من دول في أي مكان تاني غير هنا (Vercel Environment Variables)** — لو
حطيتهم في كود ظاهر للمتصفح هيبقوا مكشوفين لأي حد.

### 4) دوس Deploy
هياخد دقيقة أو اتنين، وبعدها هتاخد لينك زي:
`https://ultra-teb-dashboard.vercel.app`

## التشغيل محليًا (اختياري)
```bash
npm install
cp .env.local.example .env.local
# املى القيم في .env.local
npm run dev
```
افتح http://localhost:3000
