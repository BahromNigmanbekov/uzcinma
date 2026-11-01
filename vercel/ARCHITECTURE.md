# Uzcinma arxitekturasi

~~~mermaid
flowchart LR
  Admin[Admin Telegram] --> TG[Telegram Bot API]
  TG --> Hook[Vercel maxfiy webhook]
  Hook --> DB[Turso katalog va manbalar]
  Browser[Brauzer telefon] --> Static[Vercel CDN HTML CSS JS poster]
  Browser --> API[Vercel catalog va playback]
  API --> DB
  Browser --> Media[HTTPS media storage CDN]
  Encode[Transkodlash hali ulanmagan] --> Media
~~~

## Trafik

Frontend statik Vite build. hls.js faqat video boshlanganda olinadi.
WebP posterlar lazy loading va aniq o'lchamlar bilan, hero responsiv preload bilan olinadi.
Catalog CDNda 60 soniya, stale-while-revalidate 300 soniya keshlanadi.
Filmlar 12 tadan sahifalanadi; filtrlar parametrlashtirilgan SQL bilan ishlaydi.
Playback endpoint URL qaytaradi; video to'g'ridan-to'g'ri media CDNdan brauzerga keladi.

Playback keshlanmaydi. Yashirilgan film yangi playback so'rovida 404 qaytaradi.
Katalog o'zgarishlari CDN keshi sabab darhol ko'rinmasligi mumkin.
Allaqachon berilgan ochiq media URLlarini /delete bekor qilmaydi; media qatlamida signed URL kerak.
Telegram posterlari 2MB bilan cheklangan; token brauzerga uzatilmaydi.

## Pleyer

HLS Auto tarmoq va bufferga qarab haqiqiy variantni tanlaydi.
MP4 sifatlari faqat berilgan source ro'yxatidan chiqadi; almashtirishda vaqt saqlanadi.
MSE/HLS.js bo'lmagan native HLS brauzer sifatni o'zi tanlaydi; soxta sifatlar ko'rsatilmaydi.
Subtitr tugmasi faqat haqiqiy caption/subtitle track bo'lganda faol.
Fullscreen va PiP qurilma imkoniyatiga bog'liq.
UI optimallashtirilishi filmning asl sifatini o'zgartirmaydi. Avtomatik transkodlash ulanmagan.

## Bot

Faqat ADMIN_USER_ID bilan mos private chat metadata yozadi.
Webhook secret Telegram headerida tekshiriladi; bo'sh sir ruxsat bermaydi.
Update ID va lease takroriy uploadlarni cheklaydi; vaqtinchalik xatolar 503 bilan retry qilinadi.
Film file_unique_id bo'yicha deduplikatsiya qilinadi. /delete yashiradi, /restore tiklaydi.
Telegram javobi yuborilmasa katalog saqlanib qoladi; /list orqali IDni ko'rish mumkin.
>2GB faylning metadata si saqlanadi. Kino byteslari databasega yozilmaydi.
Vercel diskiga production SQLite yozilmaydi.

## Hali zarur

1. Vercel deploy va production domeni.
2. Turso URL/token, bot tokeni, admin ID va webhook secret; migratsiya va webhookni ulash.
3. Katta media storage/CDN: Range, CORS, trafik kvotasi.
4. Haqiqiy 480/720/1080 manbalarini yaratish va ulash.
5. Telegramdan katta faylni avtomatik olish uchun doimiy media-ingest/Local Bot API serveri.
6. Haqiqiy media domenida ruxsat etilgan 200 parallel tomoshabin yuk sinovi va monitoring.

Vercel Hobby personal/non-commercial shartlari va xizmat kvotalarini hisobga olish kerak.
Turso free katta kino storage o'rnini bosmaydi.

## Rasmga moslik

Ranglar, banner, posterlar, grid va pleyer joylashuvi namuna asosida.
Matnlar Uzcinma/o'zbek interfeysiga moslangan; ayrim poster variantlari farq qiladi.
Figma, asl font va o'lchamlar berilmagan; piksel darajasida 1:1 moslik tasdiqlanmagan.
Ikki rasm yuborilgan; uchinchi rasm olinmagan.

## Rasmiy manbalar

- [Vercel Functions](https://vercel.com/docs/functions/limitations)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Telegram getFile](https://core.telegram.org/bots/api#getfile)
- [Telegram Local Bot API](https://core.telegram.org/bots/features#local-bot-api)
- [Telegram Premium](https://telegram.org/faq_premium/?setln=en)
- [Telegram webhook](https://core.telegram.org/bots/api#setwebhook)
- [Turso free](https://turso.tech/pricing?frequency=monthly)
- [Swiper](https://swiperjs.com/get-started)
- [hls.js demo](https://github.com/video-dev/hls.js/blob/master/demo/basic-usage.html)
