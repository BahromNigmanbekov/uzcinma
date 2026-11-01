# uzcinma film bot

Python 3.12; qo‘shimcha paket kerak emas.

1. .env faylida BOT_TOKEN ga BotFather tokenini kiriting. Tokenni chatga yoki Gitga yubormang.
2. Terminalda: python bot.py
3. Botga shaxsiy xabarda /id yuboring.
4. Botni Ctrl+C bilan to‘xtating, olingan ID ni .env dagi ADMIN_USER_ID ga kiriting.
5. python bot.py orqali yana ishga tushiring.
6. Filmni video yoki document sifatida yuboring. Caption birinchi qatori nomi, keyingi qatorlari tavsif bo‘ladi.
7. /list orqali so‘nggi 20 filmni tekshiring.

Admin belgilanmaguncha yuklash yopiq. Tokeni bir xil bot uchun faqat bitta jarayon ishlating. Oldin webhook o‘rnatilgan bo‘lsa, pollingdan avval uni olib tashlash zarur.

Hozir film fayli Telegramda, katalog movies.sqlite3 bazasida saqlanadi. Takror fayl yangi yozuv yaratmaydi. Bazani zaxiralashda botni to‘xtatib, SQLite faylini nusxalang. Film manbasidagi xabarlarni o‘chirmang; muhim videolarni alohida zaxiralang.

Hozirgi bosqich: admin yuklash va katalog. Sayt pleyeri, video yuklab olish va serverga joylash hali qo‘shilmagan. Oddiy Bot API katta filmlarni saytga yetkazishga yetmaydi: keyingi bosqichda Local Bot API va video tarqatish qatlami kerak. BOT_API_BASE o‘zgartirishning o‘zi serverni o‘rnatmaydi.

Terminal ochiq turganda bot ishlaydi. 24/7 ishlash uchun doimiy server va xizmat boshqaruvchisi kerak.

## Filmni o?chirish

/list orqali ID ni oling, /delete 3 yuboring (3 o?rniga film ID). Bu katalogdan yashiradi, Telegram xabarini o?chirmaydi. /restore 3 bilan tiklanadi. Buyruqlar faqat admin uchun. Sayt qo?shilganda deleted=0 filtrlash talab qilinadi. Yangilashdan keyin botni qayta ishga tushiring.

## Nom, tavsif va poster

/title 3 Yangi film nomi

/description 3 Yangi tavsif

/description 3 - yangi matnsiz yuborilsa tavsif tozalanadi.

Rasmni photo sifatida yuboring; caption: /poster 3. Poster Telegram file_id sifatida bazada saqlanadi.

/show 3 - nom, tavsif, holat va posterni tekshiradi.

3 orniga film ID ishlating. /help barcha buyruqlarni korsatadi. Botni qayta ishga tushiring. Bazaga yangi ustunlar avtomatik qoshiladi, mavjud filmlar saqlanadi.
\n## Saytga ulanish\n\nBot qayta ishga tushirilgach, katalog, poster, video, tahrir va yashirish/tiklash avtomatik sinxronlanadi. /sync ham yangilashni boshlaydi. python site_sync.py --once bir marta yuboradi, python site_sync.py doimiy sinxronlaydi. Sayt sozlamalari .env da saqlanadi, ularni oshkor qilmang. Avval yuborilgan videolar saytda bot ochiq bolmasa ham ishlaydi. Yangi filmlar uchun bot yoki sinxronizator ishlashi kerak. 20 MB dan katta videolar uchun Local Bot API ornatish kerak. Video formati brauzerga mos bolishi kerak, transkodlash hali yoq.\n