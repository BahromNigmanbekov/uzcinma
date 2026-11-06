# UZCINMA qidiruv sozlamalari

Asosiy domen: https://uzcinma.uz/

Oldingi holat: sitemap.xml va robots.txt yo‘q edi; barcha kino manzillarida bir xil SPA HTML kelardi. Endi bosh sahifa va /title/:id Google va oddiy brauzerga bir xil, bazadan tayyorlangan HTML qaytaradi. JavaScript mavjud dizayn va pleyerni ishga tushiradi.

- /sitemap.xml — avtomatik sitemap indeksi.
- /sitemaps/pages.xml — katalog sahifalari (12 ta film/sahifa).
- /sitemaps/titles-1.xml va keyingilari — 1000 tadan kino/serial, rasmlar va haqiqiy yangilanish sanasi.
- Faqat faol asosiy filmlar/seriallar kiritiladi; qismlar ota serialga bog‘lanadi.
- Har bir film: o‘ziga xos title/description, canonical, Open Graph, Twitter, Movie/TVSeries va BreadcrumbList JSON-LD.
- O‘zbekcha tarjima borligi egasi tomonidan tasdiqlangan. Til sozlamasi o‘zgarsa sarlavhalar ham moslashadi.
- Soxta sharh, reyting soni yoki noma’lum video nashr sanasi yaratilmaydi.
- Yo‘q/o‘chirilgan kino: 404; vaqtinchalik server muammosi: 503 + Retry-After.
- Admin va JSON API indekslanmaydi. Google ko‘rinishga kerak bo‘lgan katalog, title va poster API’larini robots orqali o‘qiy oladi.
- Telegram webhook va API manzillari domen yo‘naltirishlaridan mustasno.
- HTML umumiy CDN keshida 30 soniya saqlanadi; sitemap 60 soniya. Yangi kino uchun qayta deploy kerak emas.

## Google’ga ulash

1. Admin → SEO va Google.
2. Google Search Console’da URL prefix sifatida https://uzcinma.uz/ qo‘shing.
3. HTML tag usulini tanlang, kodni admin panelga kiriting va saqlang.
4. Bir daqiqadan so‘ng Verify bosing.
5. Sitemaps bo‘limida sitemap.xml yuboring.
6. URL Inspection’da https://uzcinma.uz/title/7 ni tekshirib, Request indexing bosing.

Bing uchun Bing Webmaster Tools tasdiqlash kodini xuddi shu bo‘limga kiritish mumkin. Kodlar ochiq tasdiqlash teglaridir; ular parol yoki API kaliti emas.

Texnik tekshiruv Google sahifani indekslagani yoki yuqoriga chiqarganini isbotlamaydi. Buni Search Console’ning URL Inspection, Pages va Performance hisobotlarida tekshirish kerak. Kalit so‘zlarni takrorlash, yashirin matn, soxta havola yoki Indexing API’ni oddiy film sahifalari uchun ishlatish qo‘shilmagan.

Rasmiy qo‘llanmalar:
- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls

Tekshiruv: npm test; npm run build; node tests/seo.browser.mjs; node tests/series.browser.mjs.
