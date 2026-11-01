# Telefon orqali hozir kino korish

GitHubga C:\Users\User\Desktop\uzcinma\vercel papkasining ichidagi loyihani push qiling.
package.json repozitoriy ildizida tursin.

Vercel -> Add New -> Project -> GitHub repozitoriyingizni Import qiling.

- Framework Preset: Vite
- Root Directory: ./
- Build Command: npm run build
- Output Directory: dist
- Node.js: 22.x
- Environment Variables: bu telefon sinovi uchun hech narsa kerak emas.
- Deploy ni bosing.

Production .vercel.app havolasini telefonda oching.
Heros of Envell kartochkasini bosing va Tomosha qilish tugmasini bosing.

public/media va server/bot-catalog.json fayllari GitHubda bolishi kerak.
node_modules, dist, .env va .private yuklanmaydi; .gitignore ularni ajratadi.

Vercelda faqat sayt bilan birga joylanadigan yoki HTTPS video manbasi bor filmlar chiqadi.
Noutbukdagi /api/local-media ga bogliq filmlar bu onlayn katalogda korsatilmaydi.
Bu tayyor video nusxalarini korish uchun versiya. Yangi bot yuklashlarining avtomatik internet sinxronizatsiyasi va onlayn admin hali ulanmagan.

Agar butun uzcinma papkasini repoga joylasangiz, Root Directory ni vercel deb tanlang.
