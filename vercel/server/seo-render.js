import {SITE_ORIGIN,homeSEO,movieSEO,cleanText,shorten,publicImage,dateISO,GENRE_NAMES,paginationHTML} from '../shared/seo.js';
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const jsonScript=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const e=escapeHTML;
const htmlImage=value=>{const url=publicImage(value);return url?.startsWith(SITE_ORIGIN+'/')?url.slice(SITE_ORIGIN.length):url;};
const pageURL=page=>SITE_ORIGIN+'/' +(page>1?'?page='+page:'');

export function seoHead(meta,settings,{noindex=false}={}){
 const tags=[
  '<title>'+e(meta.title)+'</title>','<meta name="description" content="'+e(meta.description)+'">',
  '<link rel="canonical" href="'+e(meta.canonical)+'">',
  '<meta name="robots" content="'+(noindex?'noindex,follow':'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1')+'">',
  ...Object.entries({'og:title':meta.title,'og:description':meta.description,'og:url':meta.canonical,'og:site_name':'UZCINMA','og:type':meta.type,'og:locale':'uz_UZ','og:image':meta.image,'og:image:alt':meta.imageAlt}).map(([k,v])=>'<meta property="'+k+'" content="'+e(v)+'">'),
  ...Object.entries({'twitter:card':'summary_large_image','twitter:title':meta.title,'twitter:description':meta.description,'twitter:image':meta.image,'twitter:image:alt':meta.imageAlt}).map(([k,v])=>'<meta name="'+k+'" content="'+e(v)+'">')
 ];
 for(const [key,name]of [['google_verification','google-site-verification'],['bing_verification','msvalidate.01']])if(settings[key])tags.push('<meta name="'+name+'" content="'+e(settings[key])+'">');
 if(meta.graph?.length)tags.push('<script type="application/ld+json" id="seo-schema">'+jsonScript({'@context':'https://schema.org','@graph':meta.graph})+'</script>');
 return tags.join('');
}
export function renderDocument(template,{meta,settings={},body,bootstrap,noindex=false,error=false,preload}){
 let html=template.replace(/<title>[\s\S]*?<\/title>/i,'').replace(/<meta\s+(?:name=["'](?:description|robots|twitter:[^"']+)["']|property=["']og:[^"']+["'])[^>]*>/gi,'').replace(/<link\s+rel=["']canonical["'][^>]*>/gi,'').replace(/<script\b[^>]*id=["']seo-schema["'][^>]*>[\s\S]*?<\/script>/gi,'');
 html=html.replace('</head>',seoHead(meta,settings,{noindex})+(preload?'<link rel="preload" as="image" href="'+e(htmlImage(preload))+'" fetchpriority="high">':'')+'</head>');
 html=html.replace('<body>','<body class="server-rendered">').replace('<main>','<main><section id="server-content" aria-label="Kino katalogi">'+body+'</section>');
 if(bootstrap)html=html.replace('</body>','<script type="application/json" id="initial-data">'+jsonScript(bootstrap)+'</script></body>');
 if(error)html=html.replace(/<script\b[^>]*type=["']module["'][^>]*>[\s\S]*?<\/script>/gi,'');
 return html;
}
export function homeBody(movies,{page,total,featured,settings}){
 const first=featured||movies[0],uz=settings.audio_language==='uz';
 const hero=page===1?'<section class="seo-home-hero">'+(first?'<img src="'+e(htmlImage(first.backdrop)||SITE_ORIGIN+'/assets/uzcinma-banner-v2.png')+'" alt="" width="1672" height="941" fetchpriority="high">':'')+'<div class="seo-home-copy"><p>Kino, serial, anime va multfilmlar</p><h1>'+(uz?'O‘zbek tilida kinolar va seriallar':'UZCINMA kino katalogi')+'</h1>'+(first?'<h2>'+e(first.title)+'</h2><p>'+e(shorten(first.description,340))+'</p><a class="primary" href="/title/'+e(first.id)+'">Film haqida va tomosha qilish</a>':'<p>Yangi filmlar qo‘shilishi bilan shu yerda ko‘rinadi.</p>')+'</div></section>':'';
 return hero+'<section class="seo-catalog"><h2>'+(page>1?'Katalog — '+page+'-sahifa':'Kinolar va seriallar katalogi')+'</h2><div class="seo-movie-grid">'+movies.map(m=>'<article class="seo-movie-card"><a href="/title/'+e(m.id)+'"><img src="'+e(htmlImage(m.poster)||SITE_ORIGIN+'/assets/uzcinma-poster-v2.png')+'" alt="'+e(m.title)+' — poster" width="342" height="513" loading="lazy"><h3>'+e(m.title)+'</h3></a><p>'+e([m.year,uz?'O‘zbek tilida':''].filter(Boolean).join(' · '))+'</p></article>').join('')+'</div>'+paginationHTML(page,total)+'</section>';
}
export function titleBody(data,{settings}){
 const m=data.movie,canonical='/title/'+encodeURIComponent(m.id),uz=settings.audio_language==='uz',genres=(m.genres||[]).map(g=>GENRE_NAMES[g]||g).join(' · ');
 const meta=[m.year,uz?'O‘zbek tilida':'',genres].filter(Boolean).join(' · '),logo=htmlImage(m.logo),image=htmlImage(m.backdrop)||SITE_ORIGIN+'/assets/uzcinma-banner-v2.png';
 const seasons=data.seasons.map(s=>'<li><a href="'+canonical+'?season='+s.number+'">'+s.number+'-fasl'+(s.title?' — '+e(s.title):'')+' ('+s.episode_count+' qism)</a></li>').join('');
 const episodes=data.episodes.map(ep=>'<li><a href="'+canonical+'?season='+ep.season_number+'&amp;episode='+e(ep.id)+'">'+ep.episode_number+'-qism: '+e(ep.title)+'</a></li>').join('');
 const people=(list,label)=>!list?.length?'':'<section class="seo-cast"><h2>'+label+'</h2><ul>'+list.map(p=>'<li>'+e(p.name)+(p.role?' — '+e(p.role):'')+'</li>').join('')+'</ul></section>';
 return '<article class="seo-title"><div class="seo-title-art" style="background-image:url('+e(JSON.stringify(image))+')"></div><div class="title-shell"><div class="seo-intro"><nav class="seo-breadcrumbs" aria-label="Sahifa yo‘li"><a href="/">← Bosh sahifa</a><span>'+e(m.title)+'</span></nav><div class="seo-overview"><img class="seo-poster" src="'+e(htmlImage(m.poster)||SITE_ORIGIN+'/assets/uzcinma-poster-v2.png')+'" alt="'+e(m.title)+' — poster" width="300" height="450"><div class="seo-copy">'+(logo?'<img class="seo-logo" src="'+e(logo)+'" alt="'+e(m.title)+'">':'')+'<h1'+(logo?' class="sr-only"':'')+'>'+e(m.title)+'</h1><p class="seo-title-meta">'+e(meta)+'</p><p class="seo-summary">'+e(shorten(m.description||'Film haqida ma’lumot.',700))+'</p>'+(m.description?'<details class="seo-details"><summary>To‘liq tavsif</summary><p>'+e(m.description)+'</p></details>':'')+'<a class="primary" href="'+canonical+'?play=1">▶ '+(m.is_collection?'Qismlarni tomosha qilish':'Tomosha qilish')+'</a><noscript><p>Videoni ijro qilish uchun brauzerda JavaScriptni yoqing.</p></noscript></div></div></div>'+people(data.credits?.cast,'Aktyorlar')+people(data.credits?.directors,'Rejissyorlar')+(seasons?'<section class="seo-seasons"><h2>Fasllar</h2><ol>'+seasons+'</ol><h3>Qismlar</h3><ol>'+episodes+'</ol></section>':'')+'</div></article>';
}
export function errorBody(status){return '<section class="seo-error"><h1>'+(status===404?'Sahifa topilmadi':'Sahifani hozir ochib bo‘lmadi')+'</h1><p>'+(status===404?'Bu film mavjud emas yoki katalogdan olib tashlangan.':'Birozdan keyin qayta urinib ko‘ring.')+'</p><a class="primary" href="/">Katalogga qaytish</a></section>';}
export function sitemapIndex(count){
 const files=['/sitemaps/pages.xml',...Array.from({length:Math.ceil(count/1000)},(_,i)=>'/sitemaps/titles-'+(i+1)+'.xml')];
 return '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+files.map(path=>'<sitemap><loc>'+e(SITE_ORIGIN+path)+'</loc></sitemap>').join('')+'</sitemapindex>';
}
export function pagesSitemap(count){return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+Array.from({length:Math.max(1,Math.ceil(count/12))},(_,i)=>'<url><loc>'+e(pageURL(i+1))+'</loc></url>').join('')+'</urlset>';}
export function titleSitemap(rows){
 return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'+rows.map(({movie:m,modified})=>{
  const images=[...new Set([publicImage(m.poster),publicImage(m.backdrop)].filter(Boolean))];
  return '<url><loc>'+e(SITE_ORIGIN+'/title/'+encodeURIComponent(m.id))+'</loc>'+(dateISO(Date.parse(modified))?'<lastmod>'+e(dateISO(Date.parse(modified)))+'</lastmod>':'')+images.map(url=>'<image:image><image:loc>'+e(url)+'</image:loc></image:image>').join('')+'</url>';
 }).join('')+'</urlset>';
}
