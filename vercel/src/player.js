import {apiURL,API_BASE} from './api-client.js';
import {setVideoPoster} from './artwork.js';
import {putIcon} from './icons.js';
import {clampTime,formatTime,doubleTap,fileSources,levelChoices} from './player-utils.js';
const $=id=>document.getElementById(id);
const CONTROLS_IDLE_MS=10_000;
export class MoviePlayer {
 constructor({onMovie=()=>{},onError=()=>{}}={}) {
  this.root=$('player');this.video=$('video');this.onMovie=onMovie;this.onError=onError;
  this.controlPointers=new Set();
  this.generation=0;this.loaded=false;this.quality='auto';this.resumeTime=0;
  this.movie={id:'demo-jurassic',title:'Jurassic World: Fallen Kingdom',year:2018,available:false,poster:'/assets/jurassic.webp'};
  for(const [id,name]of Object.entries({'play':'play','big-play':'play','rewind':'rewind','forward':'forward','mute':'volume','captions':'captions','settings-toggle':'settings','pip':'pip','fullscreen':'full','watch-full':'full','watch-save':'heart'}))putIcon(id,name);
  $('big-play').onclick=()=>this.toggle();$('play').onclick=()=>this.toggle();
  $('rewind').onclick=()=>this.seek(-10);$('forward').onclick=()=>this.seek(10);
  $('mute').onclick=()=>{this.video.muted=!this.video.muted;};
  $('volume').oninput=e=>{this.video.volume=Number(e.target.value);this.video.muted=this.video.volume===0;};
  $('quality').onchange=e=>this.changeQuality(e.target.value);
  $('speed').onchange=e=>{this.video.playbackRate=Number(e.target.value);};
  $('settings-toggle').onclick=()=>this.settings($('settings-panel').hidden);
  $('fullscreen').onclick=()=>this.fullscreen();$('watch-full').onclick=()=>this.fullscreen();
  $('pip').hidden=!document.pictureInPictureEnabled;
  $('pip').onclick=async()=>{try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else if(this.video.readyState>=1)await this.video.requestPictureInPicture();else this.message("Avval videoni boshlang.");}catch{this.message("Bu qurilmada kichik oyna ochilmadi.");}};
  $('captions').onclick=()=>this.toggleCaptions();
  const progress=$('progress');
  progress.onpointerdown=()=>{this.scrubbing=true;};
  progress.oninput=()=>{this.scrubbing=true;this.drawProgress(Number(progress.value)/10);};
  progress.onchange=()=>this.finishScrub();
  progress.onpointercancel=()=>{this.scrubbing=false;this.updateTime();this.showControls();};
  this.video.addEventListener('timeupdate',()=>{this.updateTime();this.savePosition();});
  this.video.addEventListener('durationchange',()=>this.updateTime());
  this.video.addEventListener('progress',()=>this.updateBuffer());
  this.video.addEventListener('volumechange',()=>{putIcon('mute',this.video.muted||this.video.volume===0?'muted':'volume');$('mute').setAttribute('aria-label',this.video.muted?'Ovozni yoqish':"Ovozni o'chirish");$('volume').value=this.video.muted?0:this.video.volume;});
  this.video.addEventListener('playing',()=>{const resumed=this.root.classList.contains('playing');this.root.classList.add('playing');this.root.classList.remove('loading');putIcon('play','pause');$('play').setAttribute('aria-label',"To'xtatish");this.message('');if(!resumed)this.showControls();});
  this.video.addEventListener('pause',()=>{this.root.classList.remove('playing');this.showControls();putIcon('play','play');$('play').setAttribute('aria-label','Ijro qilish');this.savePosition(true);});
  this.video.addEventListener('waiting',()=>{this.root.classList.add('loading');this.message('Video yuklanmoqda...');});
  this.video.addEventListener('canplay',()=>{this.root.classList.remove('loading');this.message('');});
  this.video.addEventListener('ended',()=>{clearTimeout(this.hideTimer);this.root.classList.remove('playing','controls-hidden');this.resumeTime=0;try{localStorage.removeItem('uzcinma-time-'+this.movie.id);}catch{}});
  this.video.addEventListener('error',()=>{if(this.loaded&&!this.hls)this.message('Videoni ochib bolmadi. Manbani tekshiring yoki boshqa sifatni tanlang.');});
  this.video.addEventListener('loadedmetadata',()=>{if(this.resumeTime>0){this.video.currentTime=clampTime(this.resumeTime,this.video.duration);this.resumeTime=0;}this.updateTime();this.updateCaptions();});
  this.video.textTracks.addEventListener?.('addtrack',()=>this.updateCaptions());
  this.root.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||e.pointerType==='pen')this.showControls();});
  this.root.addEventListener('pointerdown',e=>{
   this.showControls();
   if(e.target.closest('.player-controls'))this.controlPointers.add(e.pointerId);
  });
  const releaseControls=e=>{
   if(!this.controlPointers.delete(e.pointerId))return;
   if(e.type==='pointercancel'){this.scrubbing=false;this.updateTime();}
   else if(this.scrubbing)this.finishScrub();
   this.showControls();
  };
  window.addEventListener('pointerup',releaseControls);
  window.addEventListener('pointercancel',releaseControls);
  this.root.addEventListener('input',()=>this.showControls());
  this.root.addEventListener('change',()=>this.showControls());
  this.root.addEventListener('click',()=>this.showControls());
  this.root.addEventListener('focusin',()=>this.showControls());
  this.root.addEventListener('keydown',e=>{
   this.showControls();
   if(e.target.matches('input,select')||(e.target.closest('button')&&[' ','Enter'].includes(e.key)))return;
   const action={' ':'toggle',k:'toggle',ArrowRight:'forward',ArrowLeft:'rewind',m:'mute',f:'fullscreen'}[e.key];
   if(!action)return;e.preventDefault();
   if(action==='toggle')this.toggle();else if(action==='forward')this.seek(10);else if(action==='rewind')this.seek(-10);else if(action==='mute')this.video.muted=!this.video.muted;else this.fullscreen();
  });
  this.root.addEventListener('pointerup',e=>this.gesture(e));
  document.addEventListener('pointerdown',e=>{if(!$('settings-panel').hidden&&!e.target.closest('.settings-wrap'))this.settings(false);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.savePosition(true);});
  window.addEventListener('pagehide',()=>this.savePosition(true));
 }
 message(text){$('player-message').textContent=text;}
 settings(open){$('settings-panel').hidden=!open;$('settings-toggle').setAttribute('aria-expanded',String(open));this.showControls();}
 showControls(){
  this.root.classList.remove('controls-hidden');clearTimeout(this.hideTimer);
  if(!this.video.paused&&!this.video.ended)this.hideTimer=setTimeout(()=>this.hideControls(),CONTROLS_IDLE_MS);
 }
 hideControls(){
  clearTimeout(this.hideTimer);
  if(this.video.paused||this.video.ended||this.scrubbing||this.controlPointers.size)return;
  $('settings-panel').hidden=true;$('settings-toggle').setAttribute('aria-expanded','false');
  this.root.classList.add('controls-hidden');
 }
 finishScrub(){
  if(Number.isFinite(this.video.duration))this.video.currentTime=clampTime(Number($('progress').value)/1000*this.video.duration,this.video.duration);
  this.scrubbing=false;this.updateTime();this.showControls();
 }
 gesture(e){
  if(e.target.closest('button,input,select,.player-controls')||!e.isPrimary)return;
  const rect=this.root.getBoundingClientRect(),tap={time:performance.now(),x:e.clientX-rect.left,y:e.clientY-rect.top};
  const jump=doubleTap(this.lastTap,tap,rect.width);
  if(jump){clearTimeout(this.tapTimer);this.lastTap=null;this.seek(jump);return;}
  this.lastTap=tap;clearTimeout(this.tapTimer);
  this.tapTimer=setTimeout(()=>{this.lastTap=null;if(e.pointerType==='mouse')this.toggle();else if(this.video.paused)this.toggle();else this.showControls();},330);
 }
 seek(delta){
  if(!this.loaded||!Number.isFinite(this.video.duration))return;
  this.video.currentTime=clampTime(this.video.currentTime+delta,this.video.duration);
  $('seek-feedback').textContent=(delta>0?'+':'')+delta+' s';$('seek-feedback').classList.add('visible');
  clearTimeout(this.feedbackTimer);this.feedbackTimer=setTimeout(()=>$('seek-feedback').classList.remove('visible'),700);
  this.showControls();this.updateTime();
 }
 drawProgress(percent){$('progress').style.setProperty('--progress',Math.max(0,Math.min(100,percent))+'%');}
 updateTime(){
  const {currentTime,duration}=this.video;
  $('time').textContent=formatTime(currentTime)+' / '+formatTime(duration);
  if(!this.scrubbing){const ratio=Number.isFinite(duration)&&duration>0?currentTime/duration:0;$('progress').value=Math.round(ratio*1000);this.drawProgress(ratio*100);}
  $('progress').setAttribute('aria-valuetext',formatTime(currentTime)+' / '+formatTime(duration));
  this.updateBuffer();
 }
 updateBuffer(){
  const {buffered,duration}=this.video;let end=0;
  for(let i=0;i<buffered.length;i++)if(buffered.start(i)<=this.video.currentTime+1)end=buffered.end(i);
  const percent=(duration>0&&Number.isFinite(duration)?Math.min(100,end/duration*100):0)+'%';$('buffer-track').style.width=percent;$('progress').style.setProperty('--buffer',percent);
 }
 savePosition(force=false){
  const t=Date.now();if(!force&&t-(this.lastSaved||0)<5000)return;
  if(!this.loaded||this.video.ended||this.video.currentTime<2)return;
  this.lastSaved=t;try{localStorage.setItem('uzcinma-time-'+this.movie.id,String(Math.floor(this.video.currentTime)));}catch{}
 }
 updateCaptions(){const tracks=[...this.video.textTracks].filter(t=>['captions','subtitles'].includes(t.kind));$('captions').disabled=!tracks.length;this.tracks=tracks;}
 toggleCaptions(){for(const track of this.tracks||[])track.mode=track.mode==='showing'?'disabled':'showing';$('captions').classList.toggle('selected',this.tracks?.some(t=>t.mode==='showing'));}
 async fullscreen(){
  this.showControls();
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(this.root.requestFullscreen)await this.root.requestFullscreen();else if(this.video.webkitEnterFullscreen)this.video.webkitEnterFullscreen();else this.message("Bu qurilmada to'liq ekran qo'llanmaydi.");}catch{this.message("To'liq ekran ochilmadi.");}
 }
 reset(){
  this.controlPointers.clear();this.scrubbing=false;clearTimeout(this.hideTimer);this.savePosition(true);this.generation++;this.controller?.abort();this.hls?.destroy();this.hls=null;this.video.pause();this.video.removeAttribute('src');this.video.load();
  this.loaded=false;this.root.classList.remove('playing','loading','controls-hidden');this.message('');this.updateTime();this.settings(false);this.choices([{value:'auto',label:'Avtomatik'}]);this.recoveries=0;
 }
 choices(options,value='auto'){
  $('quality').replaceChildren(...options.map(o=>{const node=document.createElement('option');node.value=o.value;node.textContent=o.label;return node;}));
  $('quality').value=value;$('quality').disabled=options.length<=1;
 }
 async load(movie,{play=true}={}){
  this.reset();this.movie=movie;this.onMovie(movie);
  setVideoPoster(this.video,movie.backdrop);
  if(!movie.available){this.message("Bu filmga video manbasi hali ulanmagan. 'Pleyer sinovi' orqali boshqaruvni tekshiring.");this.onError('Filmning video manbasi hali ulanmagan.');return;}
  const generation=this.generation;this.controller=new AbortController();
  this.root.classList.add('loading');this.message('Video tayyorlanmoqda...');
  try{
   const response=await fetch(apiURL('/api/playback?id='+encodeURIComponent(movie.id)),{signal:this.controller.signal});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Video manbasi ochilmadi.');
   if(generation!==this.generation)return;
   this.sources=(data.sources||(data.kind==='hls'?[{quality:'hls',url:data.url}]:data.variants)||[]).map(s=>({...s,url:API_BASE&&s.url.startsWith('/')?API_BASE+s.url:s.url}));try{this.resumeTime=Number(localStorage.getItem('uzcinma-time-'+movie.id))||0;}catch{this.resumeTime=0;}
   const hls=this.sources.find(s=>s.quality==='hls');
   if(hls)await this.attachHLS(hls.url,generation,play);
   else{
    const sources=fileSources(this.sources);if(!sources.length)throw Error('Video manbasi topilmadi.');
    this.quality=sources[0].quality;this.choices(sources.map(s=>({value:s.quality,label:s.quality==='original'?'Asl sifat':s.quality+'p'})),this.quality);
    this.video.src=sources[0].url;this.loaded=true;if(play)await this.play();
   }
  }catch(error){if(generation!==this.generation||error.name==='AbortError')return;this.root.classList.remove('loading');this.message(error.message);this.onError(error.message);}
 }
 async attachHLS(url,generation,play){
  const {default:Hls}=await import('hls.js');if(generation!==this.generation)return;
  if(Hls.isSupported()){
   const hls=this.hls=new Hls({maxBufferLength:30,maxMaxBufferLength:60,backBufferLength:30,enableWorker:true});
   hls.on(Hls.Events.MANIFEST_PARSED,async()=>{
    if(generation!==this.generation)return;
    this.loaded=true;this.choices([{value:'auto',label:'Avtomatik'},...levelChoices(hls.levels)]);this.quality='auto';
    if(play)await this.play();
   });
   hls.on(Hls.Events.LEVEL_SWITCHED,(_,data)=>{
    const current=hls.levels[data.level];const auto=$('quality').querySelector('[value="auto"]');
    if(auto)auto.textContent='Avtomatik'+(current?.height?' ('+current.height+'p)':'');
   });
   hls.on(Hls.Events.ERROR,(_,data)=>{
    if(generation!==this.generation||!data.fatal)return;
    if(this.recoveries++<2&&data.type===Hls.ErrorTypes.NETWORK_ERROR){this.message('Video ulanishi tiklanmoqda...');hls.startLoad();}
    else if(this.recoveries<=2&&data.type===Hls.ErrorTypes.MEDIA_ERROR)hls.recoverMediaError();
    else{hls.destroy();this.hls=null;this.loaded=false;this.root.classList.remove('loading');this.message('Video yuklanmadi. Tarmoq yoki HLS manbasini tekshiring.');}
   });
   hls.loadSource(url);hls.attachMedia(this.video);
  }else if(this.video.canPlayType('application/vnd.apple.mpegurl')){
   this.video.src=url;this.loaded=true;this.choices([{value:'auto',label:'Avtomatik (qurilma tanlaydi)'}]);if(play)await this.play();
  }else throw Error("Bu brauzer HLS videoni qo'llamaydi.");
 }
 async changeQuality(value){
  this.showControls();
  if(this.hls){this.hls.nextLevel=value==='auto'?-1:Number(value);this.quality=value;return;}
  const source=this.sources?.find(s=>s.quality===value);if(!source)return;
  const time=this.video.currentTime,playing=!this.video.paused;
  this.quality=value;this.resumeTime=time;this.video.src=source.url;this.video.load();
  if(playing)await this.play();
 }
 async play(){
  try{await this.video.play();}catch(error){this.root.classList.remove('loading');if(error.name==='NotAllowedError')this.message('Videoni boshlash uchun ijro tugmasini bosing.');else if(error.name!=='AbortError')this.message('Videoni ijro qilib bolmadi. Manbani tekshiring.');}
 }
 async toggle(){this.showControls();if(!this.loaded)await this.load(this.movie);else if(this.video.paused)await this.play();else this.video.pause();}
}
