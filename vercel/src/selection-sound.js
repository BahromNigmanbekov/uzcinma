let context,globallyEnabled=true,enabled=true;
try{enabled=localStorage.getItem('uzcinma-selection-sound')!=='off';}catch{}
export const soundEnabled=()=>enabled;
export function configureSound(value){globallyEnabled=value!==false;}
export function toggleSound(){enabled=!enabled;try{localStorage.setItem('uzcinma-selection-sound',enabled?'on':'off');}catch{}return enabled;}
export function selectionSound(){
 if(!enabled||!globallyEnabled)return;
 try{
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  context??=new Audio();if(context.state==='suspended')context.resume().catch(()=>{});
  const start=context.currentTime;
  [523.25,659.25,783.99].forEach((frequency,i)=>{
   const oscillator=context.createOscillator(),gain=context.createGain(),time=start+i*.055;
   oscillator.type='sine';oscillator.frequency.value=frequency;
   gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.025,time+.018);gain.gain.exponentialRampToValueAtTime(.0001,time+.32);
   oscillator.connect(gain);gain.connect(context.destination);oscillator.start(time);oscillator.stop(time+.34);
  });
 }catch{}
}
