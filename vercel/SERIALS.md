# Seriallar, fasllar va qismlar

Barcha amallar jonli bazada saqlanadi. Yangi videolar Telegram botga yuboriladi; admin panelda video yuklash talab qilinmaydi.

## Admin panel orqali

1. https://uzcinma.uz/admin/ sahifasida odatdagi parolingiz bilan kiring.
2. **+ Serial / ko‘p qismli asar** tugmasini bosing. Nomini va turini tanlang: serial, anime yoki multfilm.
3. Tahrirlash oynasida asar tavsifi, yili, reytingi va janrlarini yozing. Katta banner, poster va **film nomi yozilgan alohida logo**ni yuklab, saqlang.
4. Pastdagi **Fasl va qismlar** bo‘limida fasl raqami va ixtiyoriy nomini kiriting.
5. Videoni botga yuboring. Bot qaytargan ID yoki paneldagi video tanlovidan foydalanib, **Botdan yuklangan video**, **Fasl raqami**, **Qism raqami**ni to‘ldiring. **Qismni biriktirish**ni bosing.
6. Keyingi qismlar uchun shu amalni takrorlang. Raqamlar bo‘yicha avtomatik tartiblanadi.

Qismni tahrirlash, boshqa fasl/raqamga ko‘chirish, yashirish, tiklash yoki serialdan ajratish mumkin. Ajratish video faylini o‘chirmaydi: u katalogda alohida qoladi. Faqat bo‘sh fasl o‘chiriladi. Butun serialni yashirish uning qismlarini ham sayt orqali tomosha qilishdan yashiradi.

Bir fasl va qism raqamiga ikkita faol video biriktirilmaydi. Masalan, 2-fasl 3-qism band bo‘lsa, avval mavjud qismni ajrating yoki boshqa raqamga o‘tkazing.

Hozir katalogdagi eski videolar avtomatik ravishda 1-fasl 1-qism deb belgilanmaydi. Ularni haqiqiy fasl/qism raqami bilan serialga biriktiring. Nomlar va fasllar haqiqiy yuklangan materialdan olinadi; namunaviy qismlar saytda yaratilmaydi.

## Bot orqali

Asar yarating:

    /series Stranger Things
    /series anime Anime nomi
    /series animation Multfilm nomi

Bot yangi serialning ID raqamini qaytaradi. Quyidagi buyruqlarda SERIAL_ID, VIDEO_ID va raqamlarni o‘zingizdagi qiymatga almashtiring:

    /season SERIAL_ID 2 Ikkinchi fasl
    /episode SERIAL_ID 2 1 VIDEO_ID
    /episodes SERIAL_ID 2
    /unepisode VIDEO_ID
    /seasondelete SERIAL_ID 2

Yangi videoni to‘g‘ridan-to‘g‘ri qism qilib yuborish uchun videoning izohiga yozing:

    /episode SERIAL_ID 2 1 Qismning nomi

Raqam band bo‘lsa, video alohida saqlanadi va bot uning IDsi bilan tuzatish yo‘lini yozadi.

Rasmlarni **fayl/hujjat** sifatida yuborib, izohiga yozing:

    /banner SERIAL_ID
    /poster SERIAL_ID
    /logo SERIAL_ID

Logo film nomi yozilgan alohida rasm: shaffof fonli PNG yoki WebP qulay. U oddiy kinolarda ham ishlaydi. Banner va poster logodan alohida saqlanadi. Logo yuklanmagan yoki ochilmagan bo‘lsa, film nomi matn bilan ko‘rsatiladi.

    /logooff SERIAL_ID
    /title SERIAL_ID Yangi nom
    /description SERIAL_ID To‘liq tavsif
    /genre SERIAL_ID drama,fantasy
    /meta SERIAL_ID 2026 8.5 series
    /delete SERIAL_ID
    /restore SERIAL_ID

Bu buyruqlar qismning VIDEO_ID raqami bilan ham ishlaydi. /help barcha asosiy buyruqlarni chiqaradi.

## Tomoshabin qanday ko‘radi

Qidiruv natijasida poster, asarning nomi yozilgan logo, yil va turi ko‘rinadi. Natija yoki kartochka bosilganda **/title/ID** manzilidagi alohida sahifa ochiladi. Fasl tanlanganda faqat o‘sha fasl qismlari chiqadi. Sahifada 100 tadan ko‘p qism bo‘lsa, **Yana qismlar** orqali qolganlari ochiladi.

Pleyer ostidagi **Oldingi qism / Keyingi qism** tugmalari fasllar orasida ham ishlaydi. Qism tugaganda keyingi qismning rasmi va nomi chiqadi; tomoshabin bosib davom ettiradi. Oxirgi qismda keyingi qism tugmasi faol bo‘lmaydi.

Telefonda videoga bir bosish pauza/ijroni almashtiradi; o‘ng yoki chap tomonga ikki bosish 10 soniya suradi. Boshqaruv tugmalari 10 soniya ishlatilmasa yashirinadi.

Film tanlashda qisqa, mayin original ovoz chiqadi. Tomoshabin telefon menyusi yoki sayt haqidagi oynadan uni o‘chira oladi; tanlov brauzerda eslab qolinadi. Administrator **Bosh sahifa → Tanlash ovozi** orqali hammaga yoqishi/o‘chirishi mumkin. Botda: **/sound on** yoki **/sound off**.

## Tekshiruv

    npm test
    npm run test:series

Brauzer tekshiruvi alohida xotira bazasi va sinov Telegram transportidan foydalanadi; haqiqiy katalogni o‘zgartirmaydi va botga sinov xabari yubormaydi.
