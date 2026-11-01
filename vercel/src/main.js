import './style.css';
import './branding.css';
import {setImage,setHeroBackground,setVideoPoster,DEFAULT_BANNER} from './artwork.js';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';
import Swiper from 'swiper';
import {Navigation,Pagination,A11y,Keyboard,EffectFade,Autoplay} from 'swiper/modules';
import {icon,putIcon} from './icons.js';
import {MoviePlayer} from './player.js';
import {apiURL,normalizeCatalog} from './api-client.js';
import {formatTime} from './player-utils.js';
const $=id=>document.getElementById(id);
const genres={action:'Jangari',adventure:'Sarguzasht',animation:'Multfilm',biography:'Biografiya',crime:'Kriminal',comedy:'Komediya',documentary:'Hujjatli',drama:'Drama',anime:'Anime',fantasy:'Fantastika',horror:'Horror',thriller:'Triller',romance:'Romantika',family:'Oilaviy'};
const types={movie:'Kino',series:'Serial',anime:'Anime',animation:'Multfilm'};
const state={q:'',genre:'',type:'',rating:0,sort:'latest',saved:false,offset:0,more:false,mode:'demo',trend:'popular',trendGenre:''};
const pool=new Map();let boot=[],request,fetchVersion=0,trendSwiper,heroSwiper,detailMovie,toastTimer;
let saved;try{saved=new Set(JSON.parse(localStorage.getItem('uzcinma-saved')||'[]'));}catch{saved=new Set();}
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
function svg(name){const n=el('span','svg-icon');n.innerHTML=icon(name);return n;}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}
function button(cls,text,name,action){const n=el('button',cls);if(name)n.append(svg(name));if(text)n.append(document.createTextNode(text));n.onclick=action;return n;}
function updateSaved(){
 document.querySelectorAll('[data-save]').forEach(node=>{const selected=saved.has(node.dataset.save);node.classList.toggle('saved',selected);node.setAttribute('aria-pressed',String(selected));node.setAttribute('aria-label',selected?"Ro'yxatdan olib tashlash":"Ro'yxatga qo'shish");});
 const selected=saved.has(player.movie.id);$('watch-save').classList.toggle('saved',selected);$('watch-save').setAttribute('aria-pressed',String(selected));
 if(detailMovie){const selected=saved.has(detailMovie.id);$('detail-save').replaceChildren(svg(selected?'check':'plus'),document.createTextNode(selected?'Saqlandi':"Ro'yxatga"));}
}
function toggleSave(movie){
 if(saved.has(movie.id))saved.delete(movie.id);else saved.add(movie.id);
 try{localStorage.setItem('uzcinma-saved',JSON.stringify([...saved]));}catch{toast('Brauzer saqlashga ruxsat bermadi.');}
 updateSaved();if(state.saved)loadCatalog();return saved.has(movie.id);
}
function card(movie){
 const n=el('article','movie-card'),poster=el('div','poster-wrap');
 const open=button('poster-button',null,null,()=>details(movie));open.setAttribute('aria-label',movie.title+' haqida');
 const img=el('img');setImage(img,movie.poster);img.alt=movie.title;img.draggable=false;img.width=342;img.height=513;img.loading='lazy';img.decoding='async';
 const overlay=el('span','poster-overlay');overlay.innerHTML=icon('play');open.append(img,overlay);poster.append(open);
 const title=el('h3','movie-title',movie.title);title.title=movie.title;
 const meta=el('div','card-meta');meta.append(el('span','year',movie.year||''));
 const save=button('save-button',null,'heart',()=>toggleSave(movie));save.dataset.save=movie.id;meta.append(save);
 const seen=el('span','seen-icon');seen.innerHTML=icon('eye');seen.setAttribute('aria-hidden','true');meta.append(seen);
 if(movie.rating>0){const rating=el('span','card-rating','\u2605 '+Number(movie.rating).toFixed(1));rating.setAttribute('aria-label','Reyting '+movie.rating);meta.append(rating);}
 n.append(poster,title,meta);return n;
}
function details(movie){
 detailMovie=movie;setImage($('detail-poster'),movie.poster);$('detail-poster').alt=movie.title;
 $('detail-type').textContent=types[movie.type]||'Kino';$('detail-title').textContent=movie.title;
 $('detail-meta').textContent=[movie.year,movie.rating?'\u2605 '+movie.rating:null,...(movie.genres||[]).map(g=>genres[g]||g)].filter(Boolean).join(' \u00b7 ');
 $('detail-description').textContent=movie.description||'Tavsif hali kiritilmagan.';
 $('detail-message').textContent=movie.available?'':"Video manbasi hali ulanmagan. Pleyerni pastdagi sinov videosida tekshirishingiz mumkin.";
 $('detail-play').replaceChildren(svg('play'),document.createTextNode('Tomosha qilish'));
 $('detail-play').onclick=()=>{$('details-dialog').close();watch(movie);};
 $('detail-save').onclick=()=>toggleSave(movie);updateSaved();$('details-dialog').showModal();
}
function heading(movie){
 $('watch-title').textContent=movie.title+(movie.year?' ('+movie.year+')':'');
 $('watch-subtitle').textContent=movie.id==='demo-bunny'?'Ochiq HLS sinov videosi':movie.available?(movie.origin==='telegram'?'Botdan yuklangan video':'Tomosha qilish'):"Video manbasi hali ulanmagan";
 updateSaved();
}
const player=new MoviePlayer({onMovie:heading,onError:toast});
function watch(movie){$('watch-section').scrollIntoView({behavior:'smooth',block:'center'});player.load(movie);}
async function demo(){
 let movie=pool.get('demo-bunny');
 if(!movie)movie={id:'demo-bunny',title:'Big Buck Bunny',year:2008,available:true,poster:'/assets/bunny.webp',backdrop:'/assets/bunny-landscape.webp'};
 if(state.mode==='live'){toast('Sinov videosi demo rejimida mavjud.');return;}
 watch(movie);
}
$('watch-save').onclick=()=>toggleSave(player.movie);
for(const id of ['demo-player','info-demo'])$(id).onclick=()=>{$('info-dialog').close();demo();};
for(const [id,name]of Object.entries({'search-toggle':'search','search-close':'close','info-toggle':'bell','menu-toggle':'menu','details-close':'close','info-close':'close','trend-prev':'left','trend-next':'right'}))putIcon(id,name);
$('trends-title').append(svg('trend'),document.createTextNode('Hozir trendda'));$('movies-title').append(svg('film'),document.createTextNode('Kinolar'));
for(const node of document.querySelectorAll('[data-trend]')){const value=node.dataset.trend;node.append(svg({popular:'fire',premieres:'star',recent:'plus'}[value]),document.createTextNode({popular:'Mashhur',premieres:'Premyeralar',recent:"Yangi qo'shilgan"}[value]));node.setAttribute('aria-label',node.textContent);node.onclick=()=>{state.trend=value;document.querySelectorAll('[data-trend]').forEach(b=>b.classList.toggle('active',b===node));renderTrends();};}
$('section-search').append(svg('search'),document.createTextNode('Qidirish'));
function searchPanel(open=true){$('search-panel').hidden=!open;if(open)$('search').focus();}
$('search-toggle').onclick=()=>searchPanel($('search-panel').hidden);$('search-close').onclick=()=>searchPanel(false);$('section-search').onclick=()=>searchPanel(true);
$('info-toggle').onclick=()=>$('info-dialog').showModal();$('info-close').onclick=()=>$('info-dialog').close();$('details-close').onclick=()=>$('details-dialog').close();
for(const dlg of [$('details-dialog'),$('info-dialog')])dlg.addEventListener('click',e=>{if(e.target===dlg){const r=dlg.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dlg.close();}});
$('menu-toggle').onclick=()=>{const open=$('mobile-nav').hidden;$('mobile-nav').hidden=!open;$('menu-toggle').setAttribute('aria-expanded',String(open));};
function nav(which){
 state.saved=which==='saved';state.type=which==='series'?'series':'';state.genre='';state.q='';$('search').value='';
 document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===which));document.querySelectorAll('[data-type]').forEach(b=>b.classList.toggle('active',b.dataset.type===(state.type||'all')));
 $('movies-title').replaceChildren(svg(state.saved?'heart':state.type==='series'?'series':'film'),document.createTextNode(state.saved?"Mening ro'yxatim":state.type==='series'?'Seriallar':'Kinolar'));
 renderGenres();loadCatalog();$('mobile-nav').hidden=true;$('menu-toggle').setAttribute('aria-expanded','false');
 (which==='home'?$('hero'):$('movies')).scrollIntoView({behavior:'smooth'});
}
document.querySelectorAll('[data-nav]').forEach(node=>node.onclick=()=>nav(node.dataset.nav));$('profile-toggle').onclick=()=>nav('saved');
document.querySelectorAll('[data-type]').forEach(node=>node.onclick=()=>{state.type=node.dataset.type==='all'?'':node.dataset.type;state.saved=false;document.querySelectorAll('[data-type]').forEach(b=>b.classList.toggle('active',b===node));loadCatalog();});
function genreRow(id,selected,change){
 const row=$(id);row.replaceChildren();
 for(const [key,label]of [['','Barchasi'],...Object.entries(genres)]){
  const b=button('pill'+(selected===key?' active':''),label,null,()=>change(key));b.setAttribute('aria-pressed',String(selected===key));row.append(b);
 }
}
function renderGenres(){
 genreRow('movie-genres',state.genre,key=>{state.genre=key;renderGenres();loadCatalog();});
 genreRow('trend-genres',state.trendGenre,key=>{state.trendGenre=key;renderGenres();renderTrends();});
}
function sort(value){state.sort=value;$('latest').classList.toggle('active',value==='latest');loadCatalog();}
$('latest').onclick=()=>{$('year-sort').value='';$('name-sort').value='';sort('latest');};
$('year-sort').onchange=e=>{$('name-sort').value='';sort(e.target.value==='old'?'year_asc':e.target.value==='new'?'year':'latest');};
$('name-sort').onchange=e=>{$('year-sort').value='';sort(e.target.value==='za'?'title_desc':e.target.value==='az'?'title':'latest');};
let debounce;function delayed(){clearTimeout(debounce);debounce=setTimeout(()=>loadCatalog(),250);}
$('search').oninput=e=>{state.q=e.target.value.trim();delayed();$('movies').scrollIntoView({behavior:'smooth'});};
$('search').onkeydown=e=>{if(e.key==='Escape')searchPanel(false);};
$('rating').oninput=e=>{state.rating=Number(e.target.value);$('rating-value').textContent=state.rating.toFixed(1);delayed();};
function heroSlide(movie){
 const slide=el('article','swiper-slide hero-slide');let backdrop=movie.backdrop||DEFAULT_BANNER;if(backdrop==='/assets/hero.webp'&&innerWidth*devicePixelRatio<=850)backdrop='/assets/hero-small.webp';setHeroBackground(slide,backdrop);
 const content=el('div','hero-content');const duration=Number(movie.duration)||0;
 content.append(el('p','hero-duration',duration?'Davomiyligi: '+formatTime(duration):types[movie.type]||'Kino'));
 const rating=el('div','hero-rating');if(movie.rating){rating.append(el('span','star','\u2605'),el('strong','',Number(movie.rating).toFixed(1)));}
 rating.append(el('span','hero-genres',(movie.genres||[]).map(g=>genres[g]||g).join(' | ')));content.append(rating,el('h1','',movie.title));
 let description=movie.description||'Yangi filmlar, sevimli hikoyalar va katta sarguzashtlar.';
 if(movie.id==='demo-rampage')description="Uchta hayvon xavfli tajriba ta'sirida ulkan maxluqlarga aylanadi. Davis Okoye Chikagoni qutqarish uchun kurashadi.";
 content.append(el('p','hero-description',description));
 const buttons=el('div','hero-buttons');buttons.append(button('primary','Tomosha','play',()=>watch(movie)),button('secondary',"Ro'yxatga",'plus',()=>{toggleSave(movie);toast(saved.has(movie.id)?"Ro'yxatga qo'shildi.":"Ro'yxatdan olindi.");}));content.append(buttons);slide.append(content);
 if(movie.id==='demo-rampage'){
  const wordmark=el('div','hero-wordmark','BIGGER MEETS BIGGER');wordmark.setAttribute('aria-hidden','true');wordmark.append(el('span','','DWAYNE JOHNSON'));slide.append(wordmark);
 }
 return slide;
}
// Allow dragging from poster buttons while keeping normal taps and keyboard activation.
const swipeOptions={grabCursor:true,threshold:5,longSwipesRatio:.1,focusableElements:'input, select, option, textarea, video, label'};
function renderHero(){
 const preferred=['demo-rampage','demo-jurassic','demo-bunny'];
 const films=Array.isArray(state.home?.hero)?state.home.hero:state.mode==='demo'?preferred.map(id=>pool.get(id)).filter(Boolean):[...boot].sort((a,b)=>Number(b.available)-Number(a.available)).slice(0,3);
 $('hero').hidden=Array.isArray(state.home?.hero)&&!films.length;document.body.classList.toggle('without-hero',$('hero').hidden);
 const holder=$('hero-slides');holder.replaceChildren(...films.map(heroSlide));
 if(!films.length)holder.append(heroSlide({title:'Kino olami',description:'Filmlar katalogga qo\'shilgach shu yerda chiqadi.',backdrop:DEFAULT_BANNER,id:'empty',available:false,genres:[]}));
 heroSwiper?.destroy();heroSwiper=new Swiper('#hero',{modules:[Pagination,A11y,Keyboard,EffectFade,Autoplay],...swipeOptions,autoplay:{delay:4000,disableOnInteraction:false,pauseOnMouseEnter:true,enabled:films.length>1},effect:'fade',fadeEffect:{crossFade:true},speed:matchMedia('(prefers-reduced-motion: reduce)').matches?0:500,loop:false,rewind:true,keyboard:{enabled:true,onlyInViewport:true},pagination:{el:'.hero-pagination',clickable:true},a11y:{enabled:true,paginationBulletMessage:'{{index}}-filmga o\'tish'}});
}
function renderTrends(){
 let films=boot.filter(m=>m.id!=='demo-bunny'&&(!state.trendGenre||m.genres.includes(state.trendGenre)));
 if(state.trend==='premieres')films=[...films].sort((a,b)=>b.year-a.year);
 if(state.trend==='recent')films=[...films].reverse();
 if(state.trend==='popular'&&state.mode!=='demo')films=[...films].sort((a,b)=>b.rating-a.rating);
 $('trending').replaceChildren(...films.slice(0,18).map(m=>{const slide=el('div','swiper-slide');slide.append(card(m));return slide;}));
 trendSwiper?.destroy();trendSwiper=new Swiper('#trend-swiper',{modules:[Navigation,A11y,Keyboard,Autoplay],...swipeOptions,rewind:true,autoplay:{delay:4000,disableOnInteraction:false,pauseOnMouseEnter:true,enabled:films.length>1},slidesPerView:2.2,spaceBetween:16,grabCursor:true,speed:350,breakpoints:{600:{slidesPerView:3.4,spaceBetween:20},850:{slidesPerView:4.4,spaceBetween:25},1100:{slidesPerView:6,spaceBetween:30}},navigation:{prevEl:'#trend-prev',nextEl:'#trend-next'},keyboard:{enabled:true,onlyInViewport:true},a11y:{enabled:true,prevSlideMessage:'Oldingi filmlar',nextSlideMessage:'Keyingi filmlar'}});
 updateSaved();
}
function demoFiltered(){
 const unfiltered=!state.q&&!state.genre&&!state.type&&!state.rating&&!state.saved&&state.sort==='latest';
 let rows=unfiltered?[...boot.slice(6,17),pool.get('demo-jurassic'),...boot.slice(17,23)].filter(Boolean):[...boot];
 rows=rows.filter(m=>(!state.q||(m.title+' '+m.description).toLowerCase().includes(state.q.toLowerCase()))&&(!state.genre||m.genres.includes(state.genre))&&(!state.type||m.type===state.type)&&m.rating>=state.rating&&(!state.saved||saved.has(m.id)));
 const comparators={rating:(a,b)=>b.rating-a.rating,year:(a,b)=>b.year-a.year,year_asc:(a,b)=>a.year-b.year,title:(a,b)=>a.title.localeCompare(b.title),title_desc:(a,b)=>b.title.localeCompare(a.title)};
 if(comparators[state.sort])rows.sort(comparators[state.sort]);return rows;
}
function renderMovies(rows,{append=false,total,has_more}){
 if(!append)$('movie-grid').replaceChildren();
 rows.forEach(m=>{pool.set(m.id,m);$('movie-grid').append(card(m));});
 $('empty').hidden=$('movie-grid').children.length>0;state.more=has_more;$('more').hidden=!has_more;
 $('catalog-status').textContent=state.saved?'Bu qurilmada saqlangan filmlar.':state.mode==='demo'?'':total===0?'':total+' ta film';
 $('more').disabled=false;updateSaved();
}
async function loadCatalog(append=false){
 const version=++fetchVersion;request?.abort();
 if(!append)state.offset=0;
 $('catalog-status').textContent='';$('more').disabled=true;
 if(state.mode==='demo'&&boot.length){const rows=demoFiltered(),slice=rows.slice(state.offset,state.offset+12);renderMovies(slice,{append,total:rows.length,has_more:state.offset+12<rows.length});state.offset+=slice.length;return;}
 request=new AbortController();
 const params=new URLSearchParams({q:state.q,genre:state.genre,type:state.type,rating:String(state.rating),sort:state.sort,offset:String(state.offset),limit:'12'});
 if(state.saved)params.set('ids',[...saved].filter(id=>/^[1-9]\d{0,14}$/.test(id)).slice(0,60).join(','));
 try{
  const response=await fetch(apiURL('/api/catalog?'+params),{signal:request.signal});const data=normalizeCatalog(await response.json());if(!response.ok)throw Error(data.error||'Katalog ochilmadi.');
  if(version!==fetchVersion)return;
  let rows=data.movies;
  if(state.saved)rows=rows.filter(m=>saved.has(m.id));
  renderMovies(rows,{append,total:data.total,has_more:data.has_more});state.offset+=data.movies.length;

 }catch(error){if(error.name==='AbortError')return;$('catalog-status').textContent=error.message;$('more').disabled=false;}
}
$('more').onclick=()=>loadCatalog(true);
async function init(){
 try{
  const response=await fetch(apiURL('/api/catalog?limit=60'));const data=normalizeCatalog(await response.json());if(!response.ok)throw Error(data.error||'Katalog ochilmadi.');
  state.mode=data.mode;state.provider=data.provider;state.home=data.home;boot=data.movies;boot.forEach(m=>pool.set(m.id,m));for(const m of [...(state.home?.hero||[]),...(state.home?.recommendations||[])])pool.set(m.id,m);
  if(state.mode==='demo'){
   $('mode-label').textContent='Dizayn namunalari \u00b7 HLS sinov pleyeri';
   $('info-mode').textContent="Hozir dizayn namunalari ko'rsatilmoqda. Katalogdagi tijoriy filmlar uchun video manbasi ulanmagan. Big Buck Bunny orqali haqiqiy video sifatlarini va boshqaruvni sinab ko'ring.";
   const movie=pool.get('demo-jurassic');if(movie){player.movie=movie;setVideoPoster($('video'),movie.backdrop);heading(movie);}
  }else{
   $('mode-label').textContent='Kino olami';$('demo-player').hidden=true;$('info-demo').hidden=true;
   $('info-mode').textContent='Filmlar mavjud sifatlari bilan tomosha qilinadi. Qidiruv va janr filtrlari orqali kerakli filmni toping.';
   if(boot[0]){player.movie=boot[0];setVideoPoster($('video'),boot[0].backdrop);heading(boot[0]);}
  }
  renderHero();renderTrends();renderGenres();
  const recommendations=Array.isArray(state.home?.recommendations)?state.home.recommendations:state.mode==='demo'?boot.slice(17,23):boot.slice(12,18);
  $('recommend-grid').replaceChildren(...recommendations.map(card));$('recommend-grid').closest('section').hidden=!recommendations.length;updateSaved();await loadCatalog();
 }catch(error){$('catalog-status').textContent=error.message;renderGenres();renderHero();}
}
let refreshing=false;
async function refreshUploadedVideos(){
 if(refreshing||state.provider!=='bot-export'||document.hidden)return;
 refreshing=true;
 try{
  const response=await fetch(apiURL('/api/catalog?limit=60'),{cache:'no-store'});if(!response.ok)return;
  const data=normalizeCatalog(await response.json());
  if(JSON.stringify(data.movies)===JSON.stringify(boot)&&JSON.stringify(data.home)===JSON.stringify(state.home))return;
  state.home=data.home;
  const added=data.movies.some(m=>!pool.has(m.id));boot=data.movies;boot.forEach(m=>pool.set(m.id,m));for(const m of [...(state.home?.hero||[]),...(state.home?.recommendations||[])])pool.set(m.id,m);
  const refreshed=pool.get(player.movie.id);
  if(refreshed){const becameReady=!player.movie.available&&refreshed.available;player.movie=refreshed;heading(refreshed);if(!player.loaded)setVideoPoster($('video'),refreshed.backdrop);if(becameReady&&!player.loaded)player.message('Video tayyor. Ijro tugmasini bosing.');}
  renderHero();renderTrends();
  const recommendations=Array.isArray(state.home?.recommendations)?state.home.recommendations:boot.slice(12,18);
  $('recommend-grid').replaceChildren(...recommendations.map(card));$('recommend-grid').closest('section').hidden=!recommendations.length;
  await loadCatalog();
  if(added)toast("Botdan yangi video qo'shildi.");
 }catch{}finally{refreshing=false;}
}
const refreshTimer=setInterval(refreshUploadedVideos,5000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshUploadedVideos();});
if(import.meta.hot)import.meta.hot.dispose(()=>clearInterval(refreshTimer));
init();
