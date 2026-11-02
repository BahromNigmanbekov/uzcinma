# Uzcinma Studio admin panel

## Internetdagi panel

https://uzcinma.uz/admin/

Avvalgi admin parolingiz bilan kiring. Bot tokeni yoki parolni chatga yuborish kerak emas.
Panel jonli Turso bazasiga ulanadi. Noutbuk yoqilgan bo'lishi shart emas.

## Filmlar va rasmlar

Kinoni bevosita Telegram botga yuboring. **Botni ochish** shu botga olib boradi.
Webhook yangi filmlarni jonli bazaga yozadi. Panel ro'yxati har 5 soniyada yangilanadi.

1. Film qatorida **Tahrirlash** ni bosing.
2. Nom, tavsif, turi, yil, reyting va kategoriyalarni o'zgartiring.
3. Xohlasangiz banner va kartochka rasmini tanlang.
4. **O'zgarishlarni saqlash** ni bosing.

Banner va poster Telegramga hujjat (sendDocument) sifatida yuboriladi: Telegram foto sifatida qayta siqmaydi. File_id jonli katalogda saqlanadi.
Rasmning serverga yuborilishi va Telegramga uzatilishi panelda ko'rinadi.
JPG, PNG va WebP qabul qilinadi. 2 MB gacha fayllar ozgartirilmaydi. Katta rasmlar avval asl olchamida yuqori sifatli WebP qilib tayyorlanadi; zarur bolsa olchami kamayadi.
Bu faqat banner/posterga tegishli, video ozgartirilmaydi.
Banner uchun 2560 x 1440 yoki kamida 1920 x 1080 manba tavsiya etiladi. Oldin kichraytirilgan rasmlar avtomatik tiklanmaydi; asl faylni qayta yuklash kerak.
Rasm tanlanmasa yoki ochilmasa, standart Uzcinma rasmi chiqadi.
Videoni paneldan yuklash yoki almashtirish yo'q.

## Bosh sahifa va o'chirish

**O'chirish** filmni saytdagi katalogdan yashiradi. **O'chirilgan -> Tiklash** bilan qaytariladi.
Bu Telegramdagi asl xabarni yoki oldin berilgan media manzilini o'chirmaydi.

**Bosh sahifa** bo'limida avtomatik tanlovni o'chirib, filmlarni tanlang va tartiblang.
Katta banner va tavsiyalar alohida saqlanadi. Bo'sh tanlov tegishli bo'limni yashiradi.
Sayt keyingi katalog yangilanishida o'zgarishlarni oladi.

## Xato bo'lsa

Rasm fayli va yuklash holati vaqtincha jonli bazada turadi; yakunlangach fayl baytlari tozalanadi.
Telegram tasdig'i saqlangan bo'lsa, katalogni saqlashdagi xatodan keyin **Qayta urinish**
o'sha rasmni Telegramga takror yubormaydi. Telegram javobi olinmagan tarmoq uzilishida
tasdiq noma'lum bo'lishi mumkin. Yuklash to'liq kelmagan bo'lsa, rasmni qayta tanlang.
Server jarayoni uzilganda keyingi so'rov yuklashni qayta urinish mumkin bo'lgan holatga o'tkazadi.

## Vercel sozlamalari

README.md dagi jonli bot/baza sozlamalariga qo'shimcha `ADMIN_PASSWORD_HASH` kerak.
Qiymat mavjud lokal `.private/admin/auth.json` dagi `{salt,hash}` JSONidir.
Parol scrypt bilan tekshiriladi. Bu qiymatni faqat server Environment Variables ichiga joylang;
GitHubga yoki `VITE_` o'zgaruvchilariga yozmang.
Parol sozlanmaguncha internetdagi API yopiq qoladi; ochiq saytdan yangi parol yaratib bo'lmaydi.
Yangi o'rnatishda parolni avval lokal panelda yarating, so'ng uning xeshini serverga o'tkazing.

Kirish sessiyalari 8 soat davom etadi, Turso bazasida saqlanadi va server qayta ishga
 tushganda yo'qolmaydi. Parol xeshi almashtirilsa oldingi sessiyalar bekor bo'ladi.
Yozish so'rovlari sessiya, CSRF va `APP_ORIGIN` orqali tekshiriladi.
Ketma-ket noto'g'ri kirish urinishlari vaqtincha cheklanadi.
Hosting va Telegramning amaldagi xizmat limitlari saqlanadi.

## Lokal ko'rish

~~~powershell
npm install
npm run dev
~~~

http://localhost:5176/admin/ lokal `movies.sqlite3` bilan ishlaydi.
Birinchi marta lokal panelda kamida 8 belgili parol yaratiladi.
Lokal va internet bazalari alohida: internetdagi katalog uchun internetdagi paneldan foydalaning.

## Tekshiruv

~~~powershell
npm test
npm run build
~~~

Avtomatik testlar ajratilgan baza va test Telegram adapteri bilan bajariladi;
haqiqiy botga sinov xabarlari yuborilmaydi.
