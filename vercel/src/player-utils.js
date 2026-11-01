export function clampTime(time,duration) {
 if(!Number.isFinite(time))return 0;
 return Math.max(0,Math.min(time,Number.isFinite(duration)&&duration>0?duration:0));
}
export function formatTime(seconds) {
 const n=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
 const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=String(n%60).padStart(2,'0');
 return h?h+':'+String(m).padStart(2,'0')+':'+s:String(m).padStart(2,'0')+':'+s;
}
export function doubleTap(previous,current,width) {
 if(!previous||width<=0||current.time-previous.time>320||current.time-previous.time<0||Math.abs(current.x-previous.x)>45||Math.abs(current.y-previous.y)>45)return 0;
 return current.x<width/2?-10:10;
}
export function fileSources(sources) {
 return sources.filter(s=>s.quality!=='hls'&&typeof s.url==='string').sort((a,b)=>(Number(b.quality)||10000)-(Number(a.quality)||10000));
}
export function levelChoices(levels) {
 const byHeight=new Map();
 levels.forEach((level,index)=>{
  if(!level.height)return;
  const current=byHeight.get(level.height);
  if(!current||level.bitrate>current.bitrate)byHeight.set(level.height,{index,height:level.height,bitrate:level.bitrate});
 });
 return [...byHeight.values()].sort((a,b)=>b.height-a.height).map(l=>({value:String(l.index),label:l.height+'p'}));
}
