# Uzcinma

Sayt: https://uzcinma.uz

Bot: https://t.me/uzcinma_file_bot

## Botdan saytga

Administrator videoni botga yuboradi. Captionning birinchi qatori film nomi, qolgan qatorlari tavsif bo'ladi. Vercel webhooki yozuvni Turso bazasiga saqlaydi; sayt katalogni har 5 soniyada tekshiradi. Foydalanuvchi kino kartochkasini tanlab saytdagi playerda tomosha qiladi.

Yangi videolar GitHubga ko'chirilmaydi va ular uchun qayta deploy kerak emas. Serverdagi /api/stream bot sifatida Telegram MTProto APIga ulanib, faqat player so'ragan baytlarni oladi. HTTP Range javoblari 2 MB dan oshmaydi; videoning umumiy hajmiga dasturiy chegara qo'yilmagan. Noutbuk va python bot.py production ishlashi uchun kerak emas.

Player asl videoni oladi. Brauzer video/audio kodeklarini qo'llashi kerak; bu xizmat transkodlash qilmaydi. Qo'shimcha 480/720/1080 variantlari faqat haqiqiy manbalar bo'lsa chiqadi. Avval joylangan MP4/HLS manbalari ham ishlaydi.

## Server sozlamalari

Vercel production Environment Variables:

- TURSO_DATABASE_URL va TURSO_AUTH_TOKEN ? mavjud katalog bazasi.
- BOT_TOKEN va ADMIN_USER_ID ? bot va uning egasi.
- API_ID va API_HASH ? my.telegram.org/apps dagi Telegram ilovasi.
- TELEGRAM_WEBHOOK_SECRET ? Telegram webhook autentifikatsiyasi.
- ADMIN_API_SECRET ? himoyalangan sozlash/import API kaliti.
- ADMIN_PASSWORD_HASH ? admin parolining scrypt xeshi, JSON ichida salt va hash. Server uchun maxfiy sozlama.
- APP_ORIGIN=https://uzcinma.uz
- CATALOG_MODE=database
- DEMO_MODE=0

Bular server sozlamalari. Maxfiy qiymatlar .env va .private ichida qoladi; GitHub yoki VITE_ o'zgaruvchilariga yozilmaydi.

Mavjud bot yozuvlarini bir marta ko'chirish uchun scripts/export-live.py va ADMIN_API_SECRET bilan himoyalangan POST /api/admin initialize amali mavjud. Import mavjud IDlar to'qnashsa to'xtaydi va tahrirlangan nomlarni almashtirmaydi. Bu bir martalik ko'chirish; keyingi yuklamalarni webhook qabul qiladi.

Bazani va production deployni tayyorlagach bot webhookini ulang:

~~~powershell
node scripts/connect-bot.mjs
~~~

Eski polling bot bir vaqtda ishlatilmaydi. Webhook holatini Telegram getWebhookInfo orqali tekshirish mumkin.

## Botdagi boshqaruv

~~~text
/list
/title 6 Yangi nom
/description 6 Film haqida
/genre 6 fantasy,drama
/meta 6 2025 8.0 movie
/delete 6
/restore 6
~~~

Asl sifat uchun rasmni Telegramda File sifatida yuboring: banner captioni /banner 6, kartochka captioni /poster 6. JPG, PNG va WebP qabul qilinadi; rasm 2 MB gacha. Oddiy Telegram foto ham ishlaydi, ammo Telegram uni qayta siqishi mumkin.
Rasm bo'lmasa Uzcinma standart rasmi chiqadi.
Mavjud tashqi sifat variantini ulash: /source 6 720 https://media.example/film.mp4.

## Lokal ko'rish va admin

~~~powershell
npm install
npm run dev
~~~

Sayt: http://localhost:5176. Lokal admin: http://localhost:5176/admin/.

Internetdagi admin: https://uzcinma.uz/admin/. U /api/manage orqali jonli Turso bazasida nom, kategoriya, banner/poster, bosh sahifa tanlovi va o'chirish/tiklashni boshqaradi. Videolar bevosita botga yuboriladi. Kirish sessiyalari va rasm yuklash holatlari bazada saqlanadi.

Lokal admin eski movies.sqlite3 bilan ishlaydi; internetdagi katalogni boshqarish uchun internetdagi panelga kiring. [Admin qo'llanmasi](ADMIN.md).

## Tekshiruv

~~~powershell
npm test
npm run build
~~~

HTML, Tailwind, JavaScript, Swiper va hls.js. Telegram transporti Teleproto orqali ishlaydi.

Hosting va Telegram xizmatlarining haqiqiy foydalanish shartlari va tarif cheklovlari amal qiladi. 200 ta bir vaqtdagi tomoshabin uchun yuk sinovi o'tkazilmagan.
