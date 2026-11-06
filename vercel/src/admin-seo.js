import './admin-seo.css';
export function installAdminSEO({api,toast}){
 const section=document.createElement('section');section.id='page-seo';section.hidden=true;
 section.innerHTML='<div class="page-heading"><div><p class="eyebrow">QIDIRUV TIZIMLARI</p><h1>SEO va Google</h1><p>Kino sahifalari va sitemap bazadan avtomatik yangilanadi.</p></div></div><section class="panel form-panel seo-admin"><h2>Google Search Console</h2><ol><li><a href="https://search.google.com/search-console" target="_blank" rel="noopener">Search Console’ni oching</a> va <strong>URL prefix</strong> orqali <strong>https://uzcinma.uz/</strong> saytini qo‘shing.</li><li><strong>HTML tag</strong> tasdiqlash usulini tanlang. Berilgan kodni pastga kiriting va saqlang.</li><li>Tasdiqlagach, <strong>Sitemaps</strong> bo‘limiga <strong>sitemap.xml</strong> yuboring. Spider-Man sahifasi uchun URL Inspection → Request indexing bosing.</li></ol><form id="seo-form"><label for="seo-google">Google tasdiqlash kodi</label><input id="seo-google" autocomplete="off" maxlength="400" placeholder="google-site-verification kodi yoki meta teg"><p class="field-help">Bu kod sayt sizga tegishli ekanini tasdiqlaydi.</p><label for="seo-bing">Bing tasdiqlash kodi (ixtiyoriy)</label><input id="seo-bing" autocomplete="off" maxlength="400" placeholder="msvalidate.01 kodi"><label for="seo-language">Saytdagi videolar tili</label><select id="seo-language"><option value="uz">Barchasi o‘zbek tilida</option><option value="">Aralash tillarda</option></select><p class="field-help">“O‘zbek tilida” sarlavhasi faqat shu holat tanlanganda qo‘shiladi.</p><button type="submit" class="primary">SEO sozlamalarini saqlash</button><p id="seo-status" role="status"></p></form></section><section class="panel form-panel seo-admin"><h2>Tayyor havolalar</h2><p><a href="/sitemap.xml" target="_blank" rel="noopener">Sitemap.xml</a> · <a href="/robots.txt" target="_blank" rel="noopener">Robots.txt</a></p><p>Yangi kino va o‘zgarishlar saytda avtomatik chiqadi. Google ularni o‘z vaqti bilan indekslaydi; yuqori o‘rin kafolatlanmaydi.</p></section>';
 document.querySelector('.page-content').append(section);
 const nav=document.querySelector('.sidebar nav'),button=document.createElement('button');button.type='button';button.dataset.page='seo';button.textContent='SEO va Google';nav.append(button);
 let loaded=false;
 async function load(){
  try{const data=await api('/seo');document.getElementById('seo-google').value=data.settings.google_verification;document.getElementById('seo-bing').value=data.settings.bing_verification;const language=document.getElementById('seo-language');language.value=data.settings.audio_language;language.dispatchEvent(new Event('change',{bubbles:true}));loaded=true;}
  catch(error){toast(error.message);}
 }
 document.getElementById('seo-form').onsubmit=async event=>{
  event.preventDefault();if(!loaded)return;const submit=section.querySelector('[type=submit]');submit.disabled=true;
  try{await api('/seo',{method:'PATCH',body:{google_verification:document.getElementById('seo-google').value,bing_verification:document.getElementById('seo-bing').value,audio_language:document.getElementById('seo-language').value}});document.getElementById('seo-status').textContent='Saqlandi. Google tasdiqlashini 1 daqiqadan keyin tekshiring.';toast('SEO sozlamalari saqlandi.');}
  catch(error){toast(error.message);}finally{submit.disabled=false;}
 };
 return {load,button};
}
