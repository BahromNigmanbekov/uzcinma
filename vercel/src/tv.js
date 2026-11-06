import './tv.css';
import {closeSelectMenus,hasOpenSelect} from './select-menu.js';
const TV_UA=/SmartTV|Smart-TV|HbbTV|Tizen|Web0S|WebOS|NetCast|Viera|BRAVIA|AFT[A-Z0-9]|GoogleTV|Android[ /_-]?TV|CrKey/i;
export function installTV({player,titlePage}){
 let setting;try{setting=localStorage.getItem('uzcinma-tv');}catch{}
 let enabled=setting==='on'||(setting!=='off'&&TV_UA.test(navigator.userAgent));
 const buttons=[];
 for(const host of [document.getElementById('info-dialog'),document.getElementById('mobile-nav')]){
  if(!host)continue;const button=document.createElement('button');button.type='button';button.className=host.id==='mobile-nav'?'nav-link':'secondary tv-setting';button.onclick=()=>apply(!enabled,true);host.append(button);buttons.push(button);
 }
 const hint=document.createElement('p');hint.className='tv-help';hint.textContent='Pult: yo‘nalish tugmalari bilan tanlang, OK bilan oching, Orqaga bilan qayting.';document.getElementById('info-dialog')?.append(hint);
 function apply(value,save=false){enabled=value;document.body.classList.toggle('tv-mode',value);for(const b of buttons){b.textContent='Televizor rejimi: '+(value?'yoqilgan':'o‘chirilgan');b.setAttribute('aria-pressed',String(value));}hint.hidden=!value;if(save)try{localStorage.setItem('uzcinma-tv',value?'on':'off');}catch{}window.dispatchEvent(new Event('resize'));}
 apply(enabled);
 function visible(n){
  if(n.disabled||n.hidden||n.closest('[hidden],.controls-hidden .player-controls,.controls-hidden .video-zoom-reset'))return false;
  if(n.closest('.hero-slide')&&!n.closest('.swiper-slide-active'))return false;
  const r=n.getBoundingClientRect(),s=getComputedStyle(n);if(!r.width||!r.height||s.visibility==='hidden'||s.display==='none')return false;
  return true;
 }
 function candidates(){
  const scope=document.querySelector('dialog[open]')||document.fullscreenElement||document.querySelector('.player.is-fullscreen')||document;
  return [...scope.querySelectorAll('button,a[href],input:not([type=hidden]),[tabindex="0"]')].filter(n=>n.tabIndex>=0&&visible(n)&&!n.closest('#search-results[hidden]'));
 }
 function move(key){
  const all=candidates(),active=document.activeElement;
  if(!all.length)return;
  if(!all.includes(active)){(all.find(n=>n.matches('.title-play,.hero .primary'))||all[0]).focus();return;}
  const a=active.getBoundingClientRect(),ax=a.x+a.width/2,ay=a.y+a.height/2,horizontal=/Left|Right/.test(key),sign=/Right|Down/.test(key)?1:-1;
  let best,score=Infinity;
  for(const n of all){
   if(n===active)continue;const b=n.getBoundingClientRect(),bx=b.x+b.width/2,by=b.y+b.height/2,primary=(horizontal?bx-ax:by-ay)*sign,secondary=Math.abs(horizontal?by-ay:bx-ax);
   if(primary<=4)continue;
   const overlap=horizontal?Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top):Math.min(a.right,b.right)-Math.max(a.left,b.left);
   const cost=primary+secondary*3+(overlap>0?0:Math.max(innerWidth,innerHeight));
   if(cost<score){best=n;score=cost;}
  }
  if(best){
   const slide=best.closest('.swiper-slide'),swiper=slide?.parentElement?.parentElement?.swiper;if(swiper&&!slide.classList.contains('hero-slide'))swiper.slideTo([...slide.parentElement.children].indexOf(slide));
   best.focus({preventScroll:true});best.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});
  }
 }
 function back(){
  if(hasOpenSelect()){closeSelectMenus();return true;}
  const dialog=document.querySelector('dialog[open]');if(dialog){dialog.close();return true;}
  if(!document.getElementById('settings-panel').hidden){player.settings(false);document.getElementById('settings-toggle').focus();return true;}
  if(document.fullscreenElement||player.root.classList.contains('is-fullscreen')){player.exitFullscreen();return true;}
  if(!document.getElementById('search-panel').hidden){document.getElementById('search-toggle').click();return true;}
  if(!document.getElementById('mobile-nav').hidden){document.getElementById('menu-toggle').click();return true;}
  if(titlePage.active){titlePage.close({navigate:true});return true;}return false;
 }
 document.addEventListener('keydown',e=>{
  if(!enabled)return;
  const target=e.target,edit=target.matches('input:not([type=range]),textarea,[contenteditable=true]');
  if(['Escape','BrowserBack','GoBack','Backspace'].includes(e.key)||[10009,461].includes(e.keyCode)){if(edit&&e.key==='Backspace')return;if(back()){e.preventDefault();e.stopImmediatePropagation();}return;}
  if(edit)return;
  if(player.root.contains(target))player.showControls();
  if(e.key==='Enter'&&target===player.root){e.preventDefault();e.stopImmediatePropagation();player.toggle();return;}
  const media={'MediaPlayPause':()=>player.toggle(),'MediaPlay':()=>player.play(),'MediaPause':()=>player.video.pause(),'MediaRewind':()=>player.seek(-10),'MediaFastForward':()=>player.seek(10)}[e.key];
  if(media){e.preventDefault();e.stopImmediatePropagation();media();return;}
  if(!/^Arrow/.test(e.key)||target.matches('input[type=range]')||hasOpenSelect())return;
  if(target===player.root&&['ArrowLeft','ArrowRight'].includes(e.key))return;
  if(target.matches('[role=combobox]')&&['ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();e.stopImmediatePropagation();move(e.key);
 },true);
 const hero=document.getElementById('hero');hero?.addEventListener('focusin',()=>{if(enabled)hero.swiper?.autoplay?.stop();});hero?.addEventListener('focusout',()=>setTimeout(()=>{if(!hero.contains(document.activeElement))hero.swiper?.autoplay?.start();},0));
 document.addEventListener('cinema:scene',()=>{if(enabled)setTimeout(()=>document.querySelector('.title-play:not(:disabled)')?.focus({preventScroll:true}),50);});
}
