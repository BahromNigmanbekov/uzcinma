# Uzcinma: Vercel uchun sayt va bot webhooki

Telefon orqali tayyor kinoni hozir korish: [qisqa deploy tartibi](TELEFONDA-KORISH.md).

**Admin panel:** http://localhost:5176/admin/ - botdan yuklangan filmlarning nomi, rasmlari, kategoriyalari, bosh sahifa tanlovi va saytdan ochirish/tiklash. Video bevosita botga yuboriladi.

Admin API hozir mahalliy Node xizmatida ishlaydi. Verceldagi /api/manage hali ulanmagan; frontendni deploy qilishning ozi bot sinxronizatsiyasi va video oqimini internetda ishga tushirmaydi.
Birinchi kirishda parolni o'zingiz belgilang. [Admin qo'llanmasi](ADMIN.md).

## Botdagi mavjud videolar hozir ulangan

Sayt bot bazasidagi videolarni chiqaradi. 4-yozuv: hero envella. Avvalgi uchta yozuv bitta videoning nusxalari.
Yangi database yoki bot tokenini brauzerga berish kerak emas. Standart manba: server/bot-catalog.json va public/media/.
Vercelga deploy qilayotganda shu ikki joyni ham repoga qo'shing.

~~~powershell
cd C:\Users\User\Desktop\uzcinma\vercel
npm run dev
~~~

Brauzer: http://localhost:5176. Videoni tanlang va **Tomosha qilish** ni bosing.

Yangi yuklamalar uchun bot ham ishlashi kerak. Alohida terminalda:

~~~powershell
cd C:\Users\User\Desktop\uzcinma
python bot.py
~~~

Lokal dev server bot bazasini kuzatadi va yangi metadata/manbalarni avtomatik yangilaydi.
Brauzer katalogni har 5 soniyada tekshiradi; hozirgi video davom etadi.
Asl video aynan o'sha nom bilan Downloads papkasida bo'lsa shu nusxa ishlatiladi; aks holda Telegram API media manzili so'raladi.
Qo'lda eksport/build kerak bo'lsa:

~~~powershell
npm run bot:sync
npm run build
~~~

So'ng Vercelda yangilangan fayllarni redeploy qiling. Ushbu eksport yangi uploadlarni internetdagi saytga o'z-o'zidan deploy qilmaydi.
MP4/WebM/M4V/MOV bilan ishlaydi. Kichik fayllar deployga qo'shiladi; bundlega sig'magan mavjud video lokal /api/local-media endpointidan HTTP Range bilan oqim qilinadi. Bu pleyerga qo'yilgan hajm chegarasi emas. Lokal media endpointi Vercelda ishlamaydi; katta filmlar uchun tashqi ijro manbasi kerak.
Hozir videoning asl nusxasi mavjud; qo'shimcha 480/720/1080 variantlar uydirilmaydi.
Turso bazasini ishlatish uchun TURSO_DATABASE_URL bilan birga CATALOG_MODE=database ni ham sozlang. Oddiy deploy botdan eksport qilingan katalogdan foydalanadi. Eski dizayn demosini alohida ochish uchun CATALOG_MODE=demo ishlating.


HTML, Tailwind CSS, oddiy JavaScript, Swiper va hls.js. React kerak emas.
Sayt va botning webhooki Vercelda; katalog Turso/libSQL bazasida; kino fayllari alohida media manbasida.

## Tayyor imkoniyatlar

- Rasmdagiga yaqin qora-qizil UI, katta Rampage banneri, hero va poster swiperlari, olti ustunli desktop katalog.
- 320px telefon, telefon, planshet va desktop uchun moslashuv.
- Qidiruv, 14 janr, kino/serial/anime filtrlari, yil, A-Z, reyting, sahifalash.
- Shu qurilmada saqlangan filmlar va tomosha vaqtini eslab qolish.
- Qizil pleyer: play/pause, seek, ovoz, tezlik, fullscreen, qurilma qo'llasa PiP.
- Video ijrosida 10 soniya harakat bo'lmasa boshqaruv paneli yashirinadi. Sichqoncha, klaviatura yoki teginish uni qaytaradi; slider ushlab turilganda yashirinmaydi.
- Telefonda o'ng/chapga ikki marta bosish: +10/-10 soniya.
- Haqiqiy HLS manifestidagi sifatlar yoki alohida 480/720/1080 MP4 manbalari.
- Admin bot buyruqlari, katta fayl metadata saqlash, webhook autentifikatsiyasi va takroriy update himoyasi.
- Eski Python bot bazasini ko'chirish vositalari. Avvalgi bot va web papkalari saqlangan.

CATALOG_MODE=demo bo'lgandagina tijoriy filmlar UI namunasi va Big Buck Bunny sinov videosi ko'rsatiladi. Standart holatda botdan eksport qilingan videolar chiqadi.
Demo reytinglar namuna rasmdagi ko'rinish uchun, tekshirilgan film baholari emas.

## Kompyuterda ko'rish

Node.js 22 yoki yangiroq kerak. PowerShell:

~~~powershell
cd C:\Users\User\Desktop\uzcinma\vercel
npm install
npm run dev
~~~

Brauzer: http://localhost:5176

Agar bu kompyuterda npm shimi ishlamasa:

~~~powershell
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run dev
~~~

Bu lokal ko'rish uchun. Vercelga deploy qilingach noutbuk yoqilgan bo'lishi shart emas.

## Vercelga joylash

1. Shu papkani GitHub reposiga qo'ying; node_modules, .env va .private fayllarini yubormang.
2. Vercelda Import Project. Repo ildizi uzcinma bo'lsa **Root Directory: vercel**; repo faqat shu loyiha bo'lsa ildizning o'zi.
3. Framework: **Vite**. Build: **npm run build**. Output: **dist**. Node: **22.x**.
4. Mavjud bot videolari uchun public/media va server/bot-catalog.json ni qo'shib deploy qiling. Turso talab qilinmaydi.
5. Production domenini keyingi sozlashda APP_ORIGIN sifatida ishlating.

api/*.js Vercel Node Functions. Ularga katta videolar yuklanmaydi va ular video oqimini proksi qilmaydi.

## Haqiqiy bot va katalog

[Turso](https://turso.tech/pricing?frequency=monthly) hisobida bepul database yarating.
Turso katalog ma'lumotlari uchun; kino fayllari uchun emas.

.env.example ni lokal .env ga nusxalang. Sirlarni chatga yoki GitHubga yozmang.
Vercel Project -> Settings -> Environment Variables bo'limiga ham kiriting:

| O'zgaruvchi | Qiymat |
|---|---|
| TURSO_DATABASE_URL | Turso bergan libsql URL |
| TURSO_AUTH_TOKEN | Database token |
| BOT_TOKEN | BotFather bergan @uzcinma_file_bot tokeni |
| ADMIN_USER_ID | Sizning Telegram raqamli user IDingiz |
| TELEGRAM_WEBHOOK_SECRET | 32-256 belgili tasodifiy sir; harf/raqam/underscore/tire |
| ADMIN_API_SECRET | Alohida tasodifiy sir; ixtiyoriy admin integratsiyasi uchun |
| APP_ORIGIN | Vercel production HTTPS domeni |
| DEMO_MODE | Haqiqiy katalog uchun **0** |

Sirga VITE_ prefiksi bermang. Tasodifiy sir yaratish:

~~~powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
~~~

Bazani yaratish:

~~~powershell
npm run db:migrate
~~~

Avvalgi uchta film metadata sini ko'chirish:

~~~powershell
python scripts/export-legacy.py
node scripts/import-legacy.mjs
~~~

Bu kino fayllarini uzatmaydi. Mavjud video manbalarni keyin /source bilan ulang.
Yangi bazada ID to'qnashuvi bo'lsa import xato beradi; boshqa filmlar ustiga yozmaydi.

Vercelda env o'zgargach **Redeploy** qiling.
Eski python bot.py jarayonini to'xtating, keyin:

~~~powershell
npm run bot:connect
~~~

Bu botni pollingdan Vercel webhookiga o'tkazadi. Hozir webhook avtomatik almashtirilmagan.
Ulangach noutbuk o'chirilsa ham Telegram metadata xabarlari Vercelga boradi.

## Bot buyruqlari

Video/document yuboring. Captionning birinchi qatori nom, qolgan qatorlari tavsif.

~~~text
/list
/title 3 Film nomi
/description 3 Film haqida
/genre 3 fantasy,action,drama
/meta 3 2024 7.5 movie
/source 3 hls https://MEDIA-DOMEN/film/master.m3u8
/source 3 480 https://MEDIA-DOMEN/film/480.mp4
/source 3 720 https://MEDIA-DOMEN/film/720.mp4
/source 3 1080 https://MEDIA-DOMEN/film/1080.mp4
/unsource 3 720
/backdrop 3 https://RASM-DOMEN/fon.webp
/posterurl 3 https://RASM-DOMEN/poster.webp
/delete 3
/restore 3
~~~

Katta banner uchun rasmni photo sifatida yuborib, captionga **/banner 4** yozing. 4 - film ID. Tavsiya: gorizontal 1920x1080 rasm.
Kino kartochkasi uchun **/poster 4** ishlatiladi. Banner va poster alohida saqlanadi.
Janrlar: action, adventure, animation, anime, fantasy, drama, horror, comedy, crime, thriller, romance, family, documentary, biography.
Turlar: movie, series, animation, anime.

HLS berilsa sifatlar shu manifestdan olinadi. 480p faylga 1080 yorlig'i uni yuqori sifatga aylantirmaydi.
HLS manbasi CORS, MP4 manbasi seek uchun HTTP Range so'rovlarini qo'llashi kerak.
HTTPS ishlatiladi; bot tokeni bor Telegram download URLlarini saytga qo'ymang.

## 0 so'm, katta filmlar va 200 tomoshabin

Bepul qatlamlarda UI, katalog va webhookni boshlash mumkin.
**2GB+ filmlar, avtomatik transkodlash va 200 kishining bir vaqtda film ko'rishini 0 so'mda kafolatlaydigan media server bu loyihada yo'q.**
Lokal Chrome tekshiruvi 200 tomoshabinli production yuk sinovi emas.

[Telegram Premium](https://telegram.org/faq_premium/?setln=en) shaxsiy hisobdan 4GB yuklash imkonini beradi.
[Standart Bot API getFile](https://core.telegram.org/bots/api#getfile) 20MB dan katta faylni yuklab olmaydi.
[Local Bot API](https://core.telegram.org/bots/features#local-bot-api) alohida server talab qiladi.
[Vercel Function](https://vercel.com/docs/functions/limitations) body/response limiti 4.5MB; katta kino Vercel API orqali yuborilmaydi.

480/720/1080 uchun haqiqiy nusxalar yoki ko'p variantli HLS kerak. Transkodlash va media storage/CDN hali ulanmagan.
Noutbuk vaqtincha transkodlashi mumkin, ammo tayyor fayllar tashqi saqlashga joylanishi kerak.

200 kishi 3Mbps video ko'rsa taxminan 600Mbps uzatish talab qilinadi.
200 kishi bitta 2GB filmni to'liq ko'rsa taxminan 400GB video trafik bo'ladi.
UI keshi video trafikni bepul yoki cheksiz qilmaydi.

Batafsil: [ARCHITECTURE.md](ARCHITECTURE.md). Asset manbalari: [ASSETS.md](ASSETS.md).

## Haqiqiy sifatlarni kompyuterda tayyorlash

FFmpeg va ffprobe PATHda o'rnatilgan bo'lsin:

~~~powershell
python scripts/encode-hls.py D:\Movies\film.mp4 D:\Movies\film-hls
~~~

Noutbuk shu vaqtda ishlaydi. Script mavjud papkadagi fayllar ustiga yozmaydi va manbani o'zgartirmaydi.
Asl video 720p bo'lsa 1080p yaratilmaydi; har bir sifat haqiqiy kodlangan video.
Tayyor papkani butunligicha media storagega qo'ying, master.m3u8 manzilini /source bilan ulang.
Bu kompyuterda FFmpeg o'rnatilmagan; haqiqiy transkodlash tekshirilmagan.
Script media storagega upload qilmaydi.

## Tekshiruvlar

~~~powershell
npm test
npm run build
# npm run dev boshqa terminalda ishlayotgan bo'lsin:
npm run test:browser
~~~

Browser testi o'rnatilgan Chrome bilan ishlaydi. Boshqa yo'l uchun CHROME_PATH env.
HLS testi internet talab qiladi. Natijalar va screenshots artifacts/ papkasida.
Testlar mavjud bot tokeni bilan Telegramga xabar yubormaydi.

Yakuniy tekshiruv: 9 backend/gesture testi, 27 browser tekshiruvi o'tdi. Production previewda haqiqiy 480p va 1080p dekodlash, lazy HLS yuklash va klaviatura boshqaruvi tasdiqlandi. 200 parallel film tomoshasi va FFmpeg transkodlash tekshirilmagan.
