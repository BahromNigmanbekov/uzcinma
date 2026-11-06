export const SITE_ORIGIN='https://uzcinma.uz';
export const SITE_NAME='UZCINMA';
export const DEFAULT_SEO={google_verification:'',bing_verification:'',audio_language:'uz'};
export const GENRE_NAMES={action:'Jangari',adventure:'Sarguzasht',animation:'Multfilm',biography:'Biografiya',crime:'Kriminal',comedy:'Komediya',documentary:'Hujjatli',drama:'Drama',anime:'Anime',fantasy:'Fantastika',horror:'Horror',thriller:'Triller',romance:'Romantika',family:'Oilaviy'};
export function cleanText(value){return String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
export function shorten(value,length=160){const text=cleanText(value);if(text.length<=length)return text;const cut=text.slice(0,length-1),space=cut.lastIndexOf(' ');return cut.slice(0,space>length*.7?space:cut.length)+'…';}
export function publicImage(value){
 if(typeof value!=='string'||!value)return null;
 try{const u=new URL(value,SITE_ORIGIN);if(u.protocol!=='https:'||u.username||u.password||u.hostname==='api.telegram.org'||/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname))return null;
 if(u.origin===SITE_ORIGIN&&!/^\/(assets|media)\//.test(u.pathname)&&u.pathname!=='/api/poster')return null;
 for(const key of u.searchParams.keys())if(/token|secret|auth|signature|api.?key/i.test(key))return null;
 return u.href;}catch{return null;}
}
export function titleURL(movie){return SITE_ORIGIN+'/title/'+encodeURIComponent(movie.collection_id||movie.id);}
export function dateISO(value){
 const number=typeof value==='string'&&!/^\d+(?:\.\d+)?$/.test(value)?Date.parse(value):Number(value);if(!Number.isFinite(number)||number<=0)return null;const time=number<1e12?number*1000:number;
 try{const iso=new Date(time).toISOString();return time<=Date.now()+86400000?iso:null;}catch{return null;}
}
function baseGraph(){return [
 {'@type':'Organization','@id':SITE_ORIGIN+'/#organization',name:SITE_NAME,url:SITE_ORIGIN+'/',logo:{'@type':'ImageObject',url:SITE_ORIGIN+'/assets/uzcinma-logo.png'}},
 {'@type':'WebSite','@id':SITE_ORIGIN+'/#website',name:SITE_NAME,alternateName:'Uzcinma',url:SITE_ORIGIN+'/',inLanguage:'uz',publisher:{'@id':SITE_ORIGIN+'/#organization'}}
];}
export function homeSEO({page=1,movies=[],settings=DEFAULT_SEO}={}){
 const uz=settings.audio_language==='uz',canonical=SITE_ORIGIN+'/' +(page>1?'?page='+page:'');
 const title=SITE_NAME+' — '+(uz?'O‘zbek tilida kinolar va seriallar':'Kinolar, seriallar va multfilmlar')+(page>1?' | '+page+'-sahifa':'');
 const description=uz?'O‘zbek tilida kino, serial, anime va multfilmlarni UZCINMA’da toping. Film haqida ma’lumot, aktyorlar, fasllar va qismlar bir joyda.':'UZCINMA: kino, serial, anime va multfilmlar katalogi. Film ma’lumotlari, aktyorlar, fasllar va qismlarni toping.';
 const graph=[...baseGraph(),{'@type':'CollectionPage','@id':canonical+'#page',url:canonical,name:title,description,inLanguage:'uz',isPartOf:{'@id':SITE_ORIGIN+'/#website'},mainEntity:{'@type':'ItemList',itemListElement:movies.map((m,i)=>({'@type':'ListItem',position:(page-1)*12+i+1,url:titleURL(m),name:cleanText(m.title)}))}}];
 return {title,description,canonical,image:SITE_ORIGIN+'/assets/uzcinma-banner-v2.png',imageAlt:'UZCINMA kino va seriallar',type:'website',graph};
}
export function movieSEO(movie,{settings=DEFAULT_SEO,credits,modified}={}){
 const name=cleanText(movie.title),year=movie.year?' ('+movie.year+')':'',uz=settings.audio_language==='uz',canonical=titleURL(movie);
 const title=name+year+(uz?' o‘zbek tilida':'')+' | '+SITE_NAME;
 const description=shorten(name+year+(uz?' o‘zbek tilida. ':'. ')+(movie.description||'Film haqida ma’lumot, aktyorlar va tomosha qilish — '+SITE_NAME+'.'));
 const image=publicImage(movie.backdrop)||publicImage(movie.poster)||SITE_ORIGIN+'/assets/uzcinma-banner-v2.png';
 const entity={'@type':movie.is_collection?'TVSeries':'Movie','@id':canonical+'#title',name,url:canonical,description:cleanText(movie.description)||description,image,genre:(movie.genres||[]).map(g=>GENRE_NAMES[g]||g)};
 if(uz)entity.inLanguage='uz';
 if(!movie.is_collection&&movie.duration>0)entity.duration='PT'+Math.round(movie.duration)+'S';
 if(credits?.cast?.length)entity.actor=credits.cast.map(p=>({'@type':'Person',name:p.name,...(publicImage(p.photo)?{image:publicImage(p.photo)}:{})}));
 if(credits?.directors?.length)entity.director=credits.directors.map(p=>({'@type':'Person',name:p.name}));
 const page={'@type':'WebPage','@id':canonical+'#page',url:canonical,name:title,description,inLanguage:'uz',isPartOf:{'@id':SITE_ORIGIN+'/#website'},mainEntity:{'@id':entity['@id']}};
 if(dateISO(modified))page.dateModified=dateISO(modified);
 const graph=[...baseGraph(),page,entity,{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Bosh sahifa',item:SITE_ORIGIN+'/'},{'@type':'ListItem',position:2,name,item:canonical}]}];
 return {title,description,canonical,image,imageAlt:name,type:movie.is_collection?'video.tv_show':'video.movie',graph};
}

export function paginationHTML(page,total){const pages=Math.max(1,Math.ceil(total/12));return '<nav class="catalog-pagination" aria-label="Katalog sahifalari">'+(page>1?'<a href="'+catalogURL(page-1)+'" rel="prev">← Oldingi sahifa</a>':'')+'<span>'+page+' / '+pages+'-sahifa</span>'+(page<pages?'<a href="'+catalogURL(page+1)+'" rel="next">Keyingi sahifa →</a>':'')+'</nav>';}
function catalogURL(page){return '/' +(page>1?'?page='+page:'');}
