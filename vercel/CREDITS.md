# Aktyorlar va rejissyorlar

Asosiy variant — **Wikidata + Wikimedia Commons**. API kaliti, akkaunt yoki obuna talab qilinmaydi.
Ma’lumotlar bir marta import qilinib, sayt bazasiga saqlanadi. Har bir tomoshabin uchun tashqi API qayta chaqirilmaydi.

## Bepul avtomatik to‘ldirish

1. https://uzcinma.uz/admin/ sahifasiga odatdagi parolingiz bilan kiring.
2. Film yoki asosiy serial qatorida **Tahrirlash**ni bosing.
3. **Aktyorlar va rejissyor → Bepul ma’lumot topish** bo‘limiga o‘ting.
4. Asarning nomini, yaxshisi original nomini kiriting va **Bepul qidirish**ni bosing.
5. Natijada filmning nomi, yili va tavsifini tekshiring.
6. To‘g‘ri yozuvdagi **Aktyorlarni olish**ni bosing.

Import kino nomi, tavsifi, videosi, banneri yoki posterini almashtirmaydi.
Asar Wikidatada to‘liq kiritilmagan bo‘lsa, aktyorlar yoki rollar yetishmasligi mumkin. Bunday yozuvlarni qo‘lda to‘ldiring.
Surati topilmagan odamning ism bosh harflari ko‘rsatiladi.

## Qo‘lda qo‘shish va tuzatish

**+ Aktyor** yoki **+ Rejissyor**ni bosing. Ism, roli va xohlasangiz suratning ochiq HTTPS havolasini kiriting.
**Aktyorlar va rejissyorlarni saqlash**ni bosing. Yozuvni olib tashlash yoki yuqori/pastga ko‘chirish mumkin.
Bir asarda 80 tagacha aktyor va 30 tagacha rejissyor saqlanadi.

Import qilingan ism, rol yoki suratga qo‘lda kiritilgan tuzatishlar o‘sha asar qayta import qilinganda saqlanadi.
Boshqa asarga bog‘lash import ro‘yxatini yangilaydi; alohida qo‘lda qo‘shilgan yozuvlar saqlanadi.
**Wikidata ro‘yxatini olib tashlash** import qilinganlarni tozalaydi va qo‘lda qo‘shilganlarni qoldiradi.

Serial qismlari asosiy serialning aktyorlar ro‘yxatini ko‘rsatadi. Aktyorlarni asosiy serial orqali tahrirlang.

## Saytdagi ko‘rinish

Film tavsifi ostida **Aktyorlar va ijodkorlar** bo‘limi chiqadi.
**Aktyorlar / Rejissyor** tablari, dumaloq portret, ism va rol ko‘rsatiladi.
Telefonda yon tomonga suring; kompyuterda tortish yoki o‘q tugmalaridan foydalaning.

Wikidata ma’lumotlari CC0 ostida. Commons suratlarining muallifi, manba sahifasi va litsenziyasi saqlanib, portret ostida ko‘rsatiladi.
Qo‘lda surat qo‘shganda foydalanishga ruxsat berilgan manbani tanlang.

## Telegram bot

    /credits FILM_ID
    /wikidata FILM_ID Q12345
    /credit FILM_ID actor Aktyor ismi | Filmdagi roli | HTTPS_SURAT
    /credit FILM_ID director Rejissyor ismi | Rejissyor | HTTPS_SURAT
    /uncredit FILM_ID YOZUV_ID

Q12345 o‘rniga admin panelda tanlangan Wikidata yozuvining haqiqiy raqamini yozing.
YOZUV_ID /credits javobida chiqadi. Surat havolasi ixtiyoriy: ism va rolni kiritish yetarli.

## Qo‘shimcha TMDB

TMDB asosiy variant uchun kerak emas. Undan foydalanmoqchi bo‘lsangiz, **Qo‘shimcha: TMDB orqali import**ni oching.
O‘z loyihangizga mos TMDB foydalanish ruxsatini olgach, API Read Access Token yoki API Key qiymatini shu yerdagi maxfiy maydonga kiriting.
Kalit serverda AES-256-GCM bilan shifrlanadi, sayt tomoshabinlariga yuborilmaydi va panel uni qayta ko‘rsatmaydi.
Server muhitidagi TMDB_READ_ACCESS_TOKEN yoki TMDB_API_KEY ham qo‘llanadi. VITE_ prefiksini ishlatmang.

TMDBdan import qilingan ma’lumotlar bo‘limida ularning logosi va talab qilingan manba izohi chiqadi.
TMDB shartlari: https://developer.themoviedb.org/docs/faq

## Tekshiruvlar

    npm test
    npm run test:credits

Sinovlar alohida xotira bazasidan foydalanadi; haqiqiy katalogga namunaviy aktyor yozilmaydi.

Manbalar:
- https://www.wikidata.org/wiki/Wikidata:Licensing
- https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia
