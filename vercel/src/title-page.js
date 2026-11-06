import {createCreditsView} from './credits.js';
import './title-page.css';
import {apiURL,normalizeMovie} from './api-client.js';
import {setImage,setHeroBackground,setVideoPoster} from './artwork.js';
import {selectionSound} from './selection-sound.js';
import {formatTime} from './player-utils.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const types={movie:'Kino',series:'Serial',anime:'Anime',animation:'Multfilm'};
export function wordmark(image,url,title){const show=value=>{image.hidden=!value;image.parentElement?.classList.toggle('has-wordmark',value);};image.alt=title;show(Boolean(url));image.onload=()=>show(true);image.onerror=()=>show(false);if(url)image.src=url;else image.removeAttribute('src');}
export class TitlePage{
 constructor({player,toast,toggleSave,isSaved,genres}){
  Object.assign(this,{player,toast,toggleSave,isSaved,genres});this.version=0;
  this.watch=document.getElementById('watch-section');this.originalParent=this.watch.parentNode;this.originalNext=this.watch.nextSibling;
  this.root=el('section','title-page');this.root.id='title-page';this.root.hidden=true;
  this.root.innerHTML='<div class="title-art" aria-hidden="true"></div><div class="title-shell"><button class="title-back secondary" type="button">\u2190 Katalogga qaytish</button><p class="title-status" role="status"></p><div class="title-overview" hidden><img class="title-poster" width="300" height="450" alt=""><div class="title-copy"><p class="title-type"></p><img class="title-logo" alt="" hidden><h1 class="title-name" tabindex="-1"></h1><p class="title-meta"></p><p class="title-description"></p><div class="title-buttons"><button class="primary title-play" type="button">\u25b6 Tomosha qilish</button><button class="secondary title-save" type="button">Ro\u2018yxatga</button></div></div></div><div class="title-player-mount"></div><div class="episode-navigation" hidden><button class="secondary previous-episode" type="button">\u2190 Oldingi qism</button><span class="current-episode"></span><button class="primary next-episode" type="button">Keyingi qism \u2192</button></div><section class="seasons-panel" hidden aria-labelledby="seasons-heading"><div class="seasons-heading"><h2 id="seasons-heading">Fasl va qismlar</h2><label>Faslni tanlang<select class="season-select"></select></label></div><p class="season-description"></p><p class="episode-count"></p><div class="episode-list"></div><button class="secondary episodes-more" type="button" hidden>Yana qismlar</button><p class="episodes-empty" hidden>Bu faslga hali qism qo\u2018shilmagan.</p></section></div>';
  const intro=el('div','title-intro');this.find('.title-back').before(intro);intro.append(this.find('.title-back'),this.find('.title-status'),this.find('.title-overview'));
  const summary=el('div','title-summary'),description=this.find('.title-description');description.before(summary);summary.append(description);
  this.readMore=el('button','title-read-more','To\u2018liq ma\u2019lumot');this.readMore.type='button';summary.append(this.readMore);
  this.info=el('dialog','title-info-dialog');this.info.innerHTML='<button type="button" class="dialog-close" aria-label="Yopish">\u00d7</button><h2></h2><p class="full-meta"></p><p class="full-description"></p>';document.body.append(this.info);
  this.readMore.onclick=()=>{if(!this.data)return;this.info.querySelector('h2').textContent=this.data.movie.title;this.info.querySelector('.full-meta').textContent=this.find('.title-meta').textContent;this.info.querySelector('.full-description').textContent=this.data.movie.description;this.info.showModal();};this.info.querySelector('button').onclick=()=>this.info.close();this.info.onclick=e=>{if(e.target===this.info){const r=this.info.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.info.close();}};
  this.creditView=createCreditsView();intro.after(this.creditView.root);
  document.querySelector('main').prepend(this.root);
  this.overlay=el('div','next-episode-overlay');this.overlay.hidden=true;
  this.overlay.innerHTML='<button type="button" class="next-preview"><img alt="" width="200" height="112"><span><small>KEYINGI QISM</small><strong></strong><span class="next-caption"></span></span><b aria-hidden="true">\u25b6</b></button>';
  document.getElementById('player').append(this.overlay);
  this.find('.title-back').onclick=()=>this.close({navigate:true});
  this.find('.title-save').onclick=()=>{if(this.data){this.toggleSave(this.data.movie);this.refreshSaved();}};
  this.find('.title-play').onclick=()=>{const movie=this.data.current_episode||this.data.entry_episode||(this.data.direct_available?this.data.movie:null);if(movie)this.play(movie);};
  this.find('.season-select').onchange=e=>this.loadSeason(Number(e.target.value));
  this.find('.episodes-more').onclick=()=>this.loadSeason(this.data.selected_season,true);
  this.find('.previous-episode').onclick=()=>this.play(this.data.navigation.previous);
  this.find('.next-episode').onclick=()=>this.play(this.data.navigation.next);
  this.overlay.querySelector('button').onclick=()=>this.play(this.data.navigation.next);
  player.video.addEventListener('ended',()=>{if(this.active&&this.data?.navigation?.next?.available){this.overlay.hidden=false;player.showControls();}});
  player.video.addEventListener('playing',()=>this.overlay.hidden=true);
  window.addEventListener('popstate',()=>this.route());
 }
 find(selector){return this.root.querySelector(selector);}
 async request(id,params={},signal){
  const response=await fetch(apiURL('/api/title?'+new URLSearchParams({id,...params})),{signal});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Film ochilmadi.');
  for(const key of ['movie','entry_episode','current_episode'])if(data[key])data[key]=normalizeMovie(data[key]);
  data.episodes=(data.episodes||[]).map(normalizeMovie);data.navigation??={};for(const key of ['previous','next'])if(data.navigation[key])data.navigation[key]=normalizeMovie(data.navigation[key]);
  return data;
 }
 async route(){const match=/^\/title\/([^/]+)\/?$/.exec(location.pathname);if(match){const q=new URLSearchParams(location.search);await this.open({id:decodeURIComponent(match[1])},{navigate:false,season:q.get('season')||undefined,episode:q.get('episode')||undefined});}else if(this.active)this.close();}
 async open(movie,{autoplay=false,navigate=true,season,episode}={}){
  if(navigate)selectionSound();const version=++this.version;this.controller?.abort();this.controller=new AbortController();
  this.lastFocus=document.activeElement;this.active=true;this.data=null;this.current=null;this.player.reset();this.overlay.hidden=true;
  this.root.hidden=false;document.body.classList.add('title-open');this.find('.title-overview').hidden=true;this.find('.seasons-panel').hidden=true;this.find('.episode-navigation').hidden=true;
  this.creditView.render(null);this.watch.hidden=true;this.find('.title-player-mount').append(this.watch);this.find('.title-status').textContent='Ma\u2019lumotlar yuklanmoqda...';
  if(navigate)history.pushState({},'', '/title/'+encodeURIComponent(movie.collection_id||movie.id)+(episode?'?episode='+encodeURIComponent(episode):''));
  window.scrollTo({top:0,behavior:'instant'});
  try{
   const data=await this.request(movie.id,{...(season?{season}:{}),...(episode?{episode}:{})},this.controller.signal);if(version!==this.version)return;
   this.data=data;this.render();document.title=data.movie.title+' | Uzcinma';this.find('.title-status').textContent='';this.find('.title-name').focus({preventScroll:true});document.dispatchEvent(new Event('cinema:scene'));
   if(autoplay||episode||data.current_episode){const target=data.current_episode||data.entry_episode||(data.direct_available?data.movie:null);if(target)this.play(target,{sound:false,scroll:false});}
  }catch(error){if(error.name==='AbortError')return;this.find('.title-status').textContent=error.message;this.toast(error.message);}
 }
 close({navigate=false}={}){
  if(!this.active)return;this.active=false;this.version++;this.controller?.abort();this.info.close();this.player.exitFullscreen();this.player.reset();this.overlay.hidden=true;
  this.originalParent.insertBefore(this.watch,this.originalNext);this.watch.hidden=true;this.root.hidden=true;document.body.classList.remove('title-open');
  document.title='Uzcinma — Kino olami';if(navigate)history.pushState({},'','/');window.scrollTo({top:0,behavior:'instant'});
  if(this.lastFocus?.isConnected)this.lastFocus.focus({preventScroll:true});
 }
 render(){
  this.creditView.render(this.data.credits);
  const {movie,seasons}=this.data;this.find('.title-overview').hidden=false;
  setHeroBackground(this.find('.title-art'),movie.backdrop);setImage(this.find('.title-poster'),movie.poster);this.find('.title-poster').alt=movie.title;
  wordmark(this.find('.title-logo'),movie.logo,movie.title);this.find('.title-name').textContent=movie.title;this.find('.title-type').textContent=types[movie.type]||'Kino';
  this.find('.title-meta').textContent=[movie.year,movie.rating?'\u2605 '+movie.rating:null,...(movie.genres||[]).map(g=>this.genres[g]||g)].filter(Boolean).join(' · ');
  this.find('.title-description').textContent=movie.description||'Tavsif hali kiritilmagan.';this.readMore.hidden=!movie.description;
  const target=this.data.current_episode||this.data.entry_episode||(this.data.direct_available?movie:null);
  this.find('.title-play').disabled=!target?.available;this.find('.title-play').textContent=target?.available?(target.collection_id?'\u25b6 '+target.season_number+'-fasl, '+target.episode_number+'-qism':'\u25b6 Tomosha qilish'):(movie.is_collection?'Qismlar tez orada':'Video kutilmoqda');
  this.refreshSaved();this.find('.seasons-panel').hidden=!movie.is_collection&&!seasons.length;
  const select=this.find('.season-select');select.replaceChildren(...seasons.map(s=>{const option=el('option','',s.number+'-fasl'+(s.title?' · '+s.title:''));option.value=s.number;return option;}));select.value=this.data.selected_season;select.disabled=!seasons.length;
  this.renderEpisodes();
 }
 refreshSaved(){if(!this.data)return;const chosen=this.isSaved(this.data.movie.id),button=this.find('.title-save');button.textContent=chosen?'\u2713 Saqlandi':'+ Ro\u2018yxatga';button.setAttribute('aria-pressed',String(chosen));}
 renderEpisodes(){
  const data=this.data,season=data.seasons.find(s=>s.number===data.selected_season),holder=this.find('.episode-list');holder.replaceChildren();
  this.find('.season-description').textContent=season?.description||'';
  this.find('.episode-count').textContent=data.total?data.total+' ta qism':'';
  this.find('.episodes-empty').hidden=data.episodes.length>0;this.find('.episodes-more').hidden=!data.has_more;
  for(const episode of data.episodes){
   const row=el('button','episode-card'+(this.current?.id===episode.id?' is-current':''));row.type='button';row.setAttribute('aria-label',episode.episode_number+'-qism: '+episode.title);row.setAttribute('aria-pressed',String(this.current?.id===episode.id));
   const art=el('div','episode-art'),image=el('img');setImage(image,episode.backdrop,'banner');image.alt='';image.loading='lazy';image.width=320;image.height=180;art.append(image,el('span','episode-play','\u25b6'));
   const copy=el('div','episode-copy');copy.append(el('small','',episode.episode_number+'-QISM'),el('h3','',episode.title),el('span','',episode.duration?formatTime(episode.duration):''));
   if(episode.description)copy.append(el('p','',episode.description));
   row.append(art,copy);row.disabled=!episode.available;row.onclick=()=>this.play(episode);holder.append(row);
  }
 }
 async loadSeason(number,append=false){
  const version=this.version,button=this.find('.episodes-more');button.disabled=true;this.find('.season-select').disabled=true;
  try{const data=await this.request(this.data.movie.id,{season:number,...(append?{offset:this.data.episodes.length}:{}),...(this.current?.collection_id?{episode:this.current.id}:{})},this.controller.signal);
   if(version!==this.version)return;const episodes=append?[...this.data.episodes,...data.episodes]:data.episodes;this.data={...data,episodes};this.renderEpisodes();
  }catch(error){if(error.name!=='AbortError')this.toast(error.message);this.find('.season-select').value=this.data.selected_season;}
  finally{button.disabled=false;this.find('.season-select').disabled=false;}
 }
 async play(movie,{sound=true,scroll=true}={}){
  if(!movie?.available)return;if(sound)selectionSound();this.current=movie;this.overlay.hidden=true;this.watch.hidden=false;
  this.player.load(movie);if(scroll)this.watch.scrollIntoView({behavior:'smooth',block:'start'});
  this.renderEpisodes();this.find('.episode-navigation').hidden=!movie.collection_id;
  if(!movie.collection_id)return;
  this.find('.current-episode').textContent=movie.season_number+'-fasl · '+movie.episode_number+'-qism';
  this.find('.previous-episode').disabled=this.find('.next-episode').disabled=true;
  history.replaceState({},'', '/title/'+this.data.movie.id+'?season='+movie.season_number+'&episode='+movie.id);
  const version=this.version;
  try{
   const data=await this.request(this.data.movie.id,{season:movie.season_number,episode:movie.id},this.controller.signal);
   if(version!==this.version||this.current?.id!==movie.id)return;this.data=data;this.render();this.renderNavigation();
  }catch(error){if(error.name!=='AbortError')this.toast(error.message);}
 }
 renderNavigation(){
  const {previous,next}=this.data.navigation;this.find('.previous-episode').disabled=!previous?.available;this.find('.next-episode').disabled=!next?.available;
  this.find('.next-episode').textContent=next?'Keyingi: '+next.episode_number+'-qism \u2192':'Oxirgi qism';
  if(next){const preview=this.overlay.querySelector('button');setImage(preview.querySelector('img'),next.backdrop,'banner');preview.querySelector('strong').textContent=next.title;preview.querySelector('.next-caption').textContent=next.season_number+'-fasl · '+next.episode_number+'-qism';}
 }
}
