# Uzcinma Studio admin panel

## Hozir ochish

Sayt ishlayotgan kompyuterda: http://localhost:5176/admin/

Birinchi ochilganda o'zingiz parol yarating. Parol kamida 8 belgi.
Bot tokenini yoki parolni chatga yuborish kerak emas.
Parol scrypt bilan xeshlanadi; browserga bot tokeni berilmaydi.

Ishga tushirish:

~~~powershell
cd C:\Users\User\Desktop\uzcinma\vercel
node scripts/dev.mjs
~~~

## Kino yuklash va rasmlarni boshqarish

Kinoni bevosita Telegram botga yuboring. Paneldagi **Botni ochish** shu botga olib boradi.
Botga kelgan filmlar panelning Filmlar royxatida korinadi. Royxat ochiq turganda har 5 soniyada yangilanadi.

1. Film qatorida **Tahrirlash** ni bosing.
2. Nom, tavsif, turi, yil, reyting va kategoriyalarni ozgartiring.
3. Xohlasangiz banner va kartochka rasmini tanlang.
4. **Ozgarishlarni saqlash** ni bosing.

Admin panelda video yuklash va almashtirish yoq. Backend ham yangi video yuklash sorovini rad etadi.
Banner va poster botga yuboriladi; qabul qilish va Telegramga uzatish foizlari korinadi.
Rasm tanlanmasa yoki ochilmasa, standart Uzcinma banneri va kartochkasi korinadi.
Telegram tasdiqlagan fayl qayta urinishda takror yuborilmaydi.

## Tahrirlash va bosh sahifa

**Filmlar -> Tahrirlash**: nom, tavsif, kategoriya va rasmlarni o'zgartiring.
Videoni paneldan almashtirish mumkin emas.

**Ochirish** filmni saytdagi katalogdan olib tashlaydi. **Ochirilgan -> Tiklash** bilan qaytariladi.
Bu Telegramdagi xabarni yoki oldin berilgan media manzilini o'chirmaydi.

**Bosh sahifa**: avtomatik tanlovni o'chiring, filmlarni tanlang, yuqori/past tugmalari bilan tartiblang va saqlang.
Katta banner va tavsiyalar alohida boshqariladi. Tanlov bo'sh qoldirilsa tegishli bo'lim yashiriladi.

## Xatolar va qayta urinish

Yuklash xatosi foydalanuvchiga ko'rsatiladi. To'liq qabul qilingan fayl qayta urinish uchun saqlanadi.
Telegram qabul qilgan javob diskda qoladi; katalog saqlashda xato chiqsa o'sha fayl yana Telegramga yuborilmaydi.
Bir sahifadagi banner va poster yuklashda **Qayta urinish** qolgan banner/posterni ham davom ettiradi.
Brauzer yopilsa, to'liq qabul qilingan fayllar yuklanish tarixida qoladi; qisman kelgan faylni qayta tanlash talab etilishi mumkin.
Tashqi Telegram/tarmoq xatolari umuman bo'lmasligini kafolatlash mumkin emas.

## Internetga joylash arxitekturasi

Vercelda statik sayt va admin interfeysi quriladi. Katta fayllar Vercel Function orqali o'tkazilmaydi.
Yuklash, Telegram uzatish va doimiy fayl/baza uchun alohida Node xizmati kerak.
Quyidagi buyruq tayyor buildni, API va adminni bitta Node xizmatida ochadi:

~~~powershell
npm run build
npm run admin:server
~~~

Lokal manzil: http://localhost:5182/admin/

Production muhitida:

~~~dotenv
HOST=0.0.0.0
PORT=5182
ADMIN_ORIGIN=https://sizning-backend-domeningiz
ADMIN_PASSWORD=uzun-maxfiy-parol
~~~

Internetga ochishdan oldin ADMIN_PASSWORD yoki mavjud xeshlangan parol bo'lishi shart.
HTTPS, doimiy disk va serverning ishlashi hosting tomonidan ta'minlanishi kerak.
Bu repo yangi hosting hisobini yaratmagan va serverga avtomatik joylamagan.
Hozir ushbu uploader botning movies.sqlite3 bazasi bilan ishlaydi; bu rejimda TURSO_DATABASE_URL bo'sh bo'lsin.

Vercel frontend buildida quyidagi faqat ochiq URL sozlanadi:

~~~dotenv
VITE_API_BASE=https://sizning-backend-domeningiz
~~~

Public katalog va video manzillari shu backenddan olinadi. Admin havolasi backendning o'z admin sahifasiga o'tadi; login cookie o'sha yerda qoladi.
BOT_TOKEN, ADMIN_PASSWORD va boshqa sirlar VITE_ prefiksiga ega bo'lmasin.

## Haqiqiy xizmat chegaralari

Videolar paneldan yuklanmaydi; ular bevosita Telegram botga yuboriladi.
Telegram serverining haqiqiy upload cheklovlari amal qiladi. Standart Bot API sendVideo/sendDocument hozir 50MB; 2GB+ ni bu usul bilan kafolatlab bo'lmaydi.
Telegram Premium standart bot upload API limitini almashtirmaydi.
Telegram rad etsa panel sababni ko'rsatadi va uni muvaffaqiyat deb belgilamaydi.
Local Bot API boshqa imkoniyatlarga ega, ammo alohida doimiy server talab qiladi.

Manbalar: [Telegram sendVideo](https://core.telegram.org/bots/api#sendvideo), [sendDocument](https://core.telegram.org/bots/api#senddocument), [Vercel Function limits](https://vercel.com/docs/functions/limitations).

## Tekshiruv

~~~powershell
npm test
node tests/admin.browser.mjs
$env:TEST_ADMIN_RETRY='1'
node tests/admin.browser.mjs
Remove-Item Env:TEST_ADMIN_RETRY
~~~

Testlar ajratilgan baza va test Telegram adapteri bilan bajariladi; haqiqiy botga sinov xabarlari yuborilmaydi.
Haqiqiy botga Node orqali getMe tekshiruvi o'tkazilgan.
