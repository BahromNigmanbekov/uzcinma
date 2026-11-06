import './video-zoom.css';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
import {zoomBounds} from './zoom-math.js';
export class VideoZoom{
 constructor({root,video,onGesture=()=>{},onChange=()=>{}}){
  Object.assign(this,{root,video,onGesture,onChange});this.scale=1;this.x=0;this.y=0;
  const settings=root.querySelector('#settings-panel');
  this.tools=document.createElement('div');this.tools.className='video-view-tools';
  this.tools.innerHTML='<span class="video-view-label">Ekran ko\u2018rinishi</span><div class="video-fit-buttons"><button type="button" class="zoom-fit">Sig\u2018dirish</button><button type="button" class="zoom-fill">To\u2018ldirish</button></div><label class="video-zoom-label" for="video-zoom-range">Yaqinlashtirish <output id="video-zoom-value">1.0\u00d7</output></label><input id="video-zoom-range" type="range" min="1" max="4" step=".1" value="1" aria-label="Videoni yaqinlashtirish">';
  settings.append(this.tools);this.slider=this.tools.querySelector('input');this.output=this.tools.querySelector('output');this.fitButton=this.tools.querySelector('.zoom-fit');this.fillButton=this.tools.querySelector('.zoom-fill');
  this.fitButton.onclick=()=>this.reset();this.fillButton.onclick=()=>this.fill();this.slider.oninput=()=>{this.mode='custom';this.set(Number(this.slider.value),this.x,this.y);};
  this.resetButton=document.createElement('button');this.resetButton.type='button';this.resetButton.className='video-zoom-reset';this.resetButton.hidden=true;this.resetButton.setAttribute('aria-label','Videoni asl ko\u2018rinishga qaytarish');this.resetButton.onclick=()=>this.reset();root.append(this.resetButton);
  root.addEventListener('touchstart',e=>this.start(e),{passive:false});
  root.addEventListener('touchmove',e=>this.move(e),{passive:false});
  root.addEventListener('touchend',e=>this.end(e),{passive:false});root.addEventListener('touchcancel',()=>this.cancel(),{passive:true});
  root.addEventListener('click',e=>{if(this.suppressTap&&!e.target.closest('.player-controls,.video-zoom-reset,.next-episode-overlay')){e.preventDefault();e.stopImmediatePropagation();}},true);
  video.addEventListener('loadedmetadata',()=>this.resize());
  this.observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>this.resize()):null;this.observer?.observe(root);this.render();
 }
 get suppressTap(){return Boolean(this.pinching||this.pan?.moved||performance.now()<(this.suppressUntil||0));}
 eligible(touch){return this.root.contains(touch.target)&&!touch.target.closest('.player-controls,.video-zoom-reset,.next-episode-overlay');}
 touches(event){return [...event.touches].filter(t=>this.eligible(t));}
 point(touch){const box=this.root.getBoundingClientRect();return {x:touch.clientX-box.left-box.width/2,y:touch.clientY-box.top-box.height/2};}
 metrics(touches){const a=this.point(touches[0]),b=this.point(touches[1]);return {distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
 start(event){
  const touches=this.touches(event);if(touches.length>=2){event.preventDefault();this.onGesture();const m=this.metrics(touches);this.pinching={...m,scale:this.scale,panX:this.x,panY:this.y};this.pan=null;this.suppressUntil=performance.now()+450;}
  else if(touches.length===1&&this.scale>1.01){const p=this.point(touches[0]);this.pan={...p,startX:this.x,startY:this.y,moved:false};}
 }
 move(event){
  const touches=this.touches(event);
  if(touches.length>=2){
   event.preventDefault();if(!this.pinching){this.start(event);return;}const m=this.metrics(touches),start=this.pinching,scale=clamp(start.scale*m.distance/start.distance,1,4),ratio=scale/start.scale;
   this.set(scale,m.x-(start.x-start.panX)*ratio,m.y-(start.y-start.panY)*ratio);this.mode='custom';this.suppressUntil=performance.now()+450;
  }else if(touches.length===1&&this.pan&&this.scale>1.01){
   const p=this.point(touches[0]),dx=p.x-this.pan.x,dy=p.y-this.pan.y;if(!this.pan.moved&&Math.hypot(dx,dy)<9)return;
   event.preventDefault();if(!this.pan.moved)this.onGesture();this.pan.moved=true;this.set(this.scale,this.pan.startX+dx,this.pan.startY+dy);this.suppressUntil=performance.now()+450;
  }
 }
 end(event){
  const wasGesture=Boolean(this.pinching||this.pan?.moved);if(wasGesture){event.preventDefault();this.suppressUntil=performance.now()+450;this.onGesture();}
  this.pinching=null;this.pan=null;const touches=this.touches(event);if(touches.length===1&&this.scale>1.01){const p=this.point(touches[0]);this.pan={...p,startX:this.x,startY:this.y,moved:false};}
 }
 cancel(){if(this.pinching||this.pan?.moved)this.suppressUntil=performance.now()+450;this.pinching=null;this.pan=null;}
 fill(){
  const box=this.root.getBoundingClientRect(),w=this.video.videoWidth,h=this.video.videoHeight;if(!box.width||!box.height)return;
  const contain=w&&h?Math.min(box.width/w,box.height/h):1,scale=w&&h?Math.max(box.width/(w*contain),box.height/(h*contain)):1;
  this.mode='fill';this.set(scale,0,0);
 }
 resize(){if(!this.root.clientWidth||!this.root.clientHeight)return;if(this.mode==='fill')this.fill();else this.set(this.scale,this.x,this.y,false);}
 set(scale,x=0,y=0,announce=true){
  this.scale=clamp(Number(scale)||1,1,4);if(this.scale<1.035)this.scale=1;
  const limits=zoomBounds(this.root.clientWidth,this.root.clientHeight,this.video.videoWidth,this.video.videoHeight,this.scale);
  this.x=clamp(x,-limits.x,limits.x);this.y=clamp(y,-limits.y,limits.y);this.render();if(announce)this.onChange();
 }
 render(){
  this.video.style.transform='translate3d('+this.x+'px,'+this.y+'px,0) scale('+this.scale+')';this.video.style.transformOrigin='center center';
  this.root.classList.toggle('is-zoomed',this.scale>1.01);this.root.dataset.videoScale=this.scale.toFixed(3);this.slider.value=this.scale;this.output.value=this.scale.toFixed(1)+'\u00d7';this.output.textContent=this.output.value;this.resetButton.textContent=this.scale.toFixed(1)+'\u00d7 · Tiklash';this.resetButton.hidden=this.scale<=1.01;
  this.fitButton.setAttribute('aria-pressed',String(this.scale===1));this.fillButton.setAttribute('aria-pressed',String(this.mode==='fill'&&this.scale>1.01));
 }
 reset(){this.cancel();this.mode='fit';this.set(1,0,0);}
}
