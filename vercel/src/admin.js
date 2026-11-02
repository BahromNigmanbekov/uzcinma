import {prepareAdminImage} from './admin-images.js';
import './admin.css';
import './branding.css';
import {setImage} from './artwork.js';
import {API_BASE} from './api-client.js';
import {icon} from './icons.js';
const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const labels={action:'Jangari',adventure:'Sarguzasht',animation:'Multfilm',anime:'Anime',fantasy:'Fantastika',drama:'Drama',horror:'Horror',comedy:'Komediya',crime:'Kriminal',thriller:'Triller',romance:'Romantika',family:'Oilaviy',documentary:'Hujjatli',biography:'Biografiya'};
const typeLabels={movie:'Kino',series:'Serial',animation:'Multfilm',anime:'Anime'};
let pendingBatch=null,homeDirty=false;
let csrf='',setup=false,movies=[],home={},editing=null,busy=false,polling=false,toastTimer,jobTimer,connectionTimer,catalogTimer,catalogVersion=0;
const jobs=new Map(),xhrUploads=new Map(),previews=new Map();let heroIds=[],recommendIds=[];
const bytes=n=>{if(!n)return '0 B';const i=Math.min(3,Math.floor(Math.log(n)/Math.log(1024)));return (n/1024**i).toFixed(i>0?1:0)+' '+['B','KB','MB','GB'][i];};
const percent=(value,size)=>size?Math.min(100,Math.floor(value/size*100)):0;
function toast(message){$('admin-toast').textContent=message;$('admin-toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('admin-toast').hidden=true,4500);}
function svg(name){const span=el('span');span.innerHTML=icon(name);return span;}
document.querySelectorAll('[data-icon]').forEach(node=>{node.innerHTML=icon(node.dataset.icon);});
function button(text,action,cls='small-button'){const b=el('button',cls,text);b.type='button';b.onclick=action;return b;}
async function api(path,{method='GET',body}={}){
 const response=await fetch('/api/manage'+path,{method,credentials:'same-origin',headers:{...(body?{'Content-Type':'application/json'}:{}),...(!['GET','HEAD'].includes(method)?{'X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});
 let data;try{data=await response.json();}catch{throw Error('Server bilan aloqa amalga oshmadi.');}
 if(!response.ok){if(response.status===401&&path!=='/login')showAuth(false);throw Error(data.error||'Sorov bajarilmadi.');}
 return data;
}
function showAuth(required){
 clearInterval(jobTimer);clearInterval(connectionTimer);clearInterval(catalogTimer);setup=required;
 $('app').hidden=true;$('auth-screen').hidden=false;$('confirm-wrap').hidden=!required;$('confirm-password').required=required;
 $('auth-title').textContent=required?'Admin parolini belgilang':'Admin panelga kirish';
 $('auth-description').textContent=required?'Birinchi kirish. Panel uchun kamida 8 belgili shaxsiy parol yarating.':'Filmlar, rasmlar va bosh sahifani bir joydan boshqaring.';
 $('auth-submit').textContent=required?'Parolni saqlash va kirish':'Kirish';$('password').autocomplete=required?'new-password':'current-password';
}
$('auth-form').onsubmit=async event=>{
 event.preventDefault();$('auth-error').textContent='';
 if(setup&&$('password').value!==$('confirm-password').value){$('auth-error').textContent='Parollar bir xil emas.';return;}
 $('auth-submit').disabled=true;
 try{const result=await api(setup?'/setup':'/login',{method:'POST',body:{password:$('password').value}});csrf=result.csrf;$('auth-form').reset();await enter();}
 catch(error){$('auth-error').textContent=error.message;}finally{$('auth-submit').disabled=false;}
};
async function logout(){if(busy){toast('Yuklash tugashini kuting yoki uni toxtating.');return;}try{await api('/logout',{method:'POST'});}catch{}csrf='';showAuth(false);}
$('logout').onclick=logout;$('logout-mobile').onclick=logout;
function page(name){
 document.querySelectorAll('section[id^="page-"]').forEach(n=>n.hidden=n.id!=='page-'+name);
 document.querySelectorAll('[data-page]').forEach(n=>n.classList.toggle('active',n.dataset.page===name));
 $('page-name').textContent={library:'Filmlar',editor:'Filmni tahrirlash',home:'Bosh sahifa',uploads:'Yuklanishlar'}[name];
 window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-page]').forEach(n=>n.onclick=()=>page(n.dataset.page));
$('editor-back').onclick=()=>page('library');$('reset-editor').onclick=()=>openEditor(editing);
function selectedGenres(){return [...document.querySelectorAll('#genre-options input:checked')].map(n=>n.value);}
function renderGenres(selected=[]){$('genre-options').replaceChildren(...Object.entries(labels).map(([key,label])=>{const wrap=el('label','genre-choice'),input=el('input');input.type='checkbox';input.value=key;input.checked=selected.includes(key);wrap.append(input,el('span','',label));return wrap;}));}
function setPreview(kind,url){
 const img=$(kind+'-preview'),help=$(kind+'-quality');img.hidden=false;
 const normal=kind==='banner'?'Gorizontal rasm: 2560 × 1440 tavsiya etiladi.':'Vertikal rasm: 2:3 nisbat tavsiya etiladi.';
 help.textContent=normal;help.classList.remove('low-quality');
 img.onload=()=>{
  const file=$(kind+'-file').files[0];if(!file||!url?.startsWith('blob:'))return;
  const width=img.naturalWidth,height=img.naturalHeight;
  const low=kind==='banner'&&(width<1600||height<800),portrait=kind==='banner'&&width/height<1.4;
  help.classList.toggle('low-quality',low||portrait);
  help.textContent=width+' × '+height+' ? '+bytes(file.size)+'. '+(portrait?'Banner uchun gorizontal rasm tanlang.':low?'Katta ekranda tiniq ko‘rinishi uchun kamida 1920 × 1080 rasm tanlang.':file.size<=2*1024*1024?'Asl fayl sifati saqlanadi.':'Katta rasm yuqori sifatli formatda tayyorlanadi.');
 };
 setImage(img,url,kind);
}
function openEditor(movieId=null){
 if(busy){toast('Joriy yuklash tugashini kuting.');return;}
 pendingBatch=null;editing=movieId?String(movieId):null;const movie=movies.find(m=>m.id===editing);
 if(!movie){page('library');toast('Royxatdan tahrirlanadigan filmni tanlang.');return;}
 $('movie-form').reset();$('editor-title').textContent='Filmni tahrirlash';
 $('movie-title').value=movie?.title||'';$('movie-description').value=movie?.description||'';$('movie-type').value=movie?.type||'movie';$('movie-year').value=movie?.year||'';$('movie-rating').value=movie?.rating||0;
 renderGenres(movie?.genres||[]);
 $('banner-label').textContent='Banner rasmini tanlang';$('poster-label').textContent='Poster rasmini tanlang';
 setPreview('banner',movie?.has_banner?movie.backdrop:null);setPreview('poster',movie?.poster||null);
 $('save-movie').textContent='Ozgarishlarni saqlash';$('editor-status').textContent='Malumotlar tayyor bolgach saqlang.';
 page('editor');
}
for(const kind of ['banner','poster']){
 const input=$(kind+'-file'),zone=input.closest('.file-zone');
 input.onchange=()=>{
  const file=input.files[0];
  $(kind+'-label').textContent=file?file.name+' ('+bytes(file.size)+')':kind==='banner'?'Banner rasmini tanlang':'Poster rasmini tanlang';
  {if(previews.has(kind))URL.revokeObjectURL(previews.get(kind));if(file){const url=URL.createObjectURL(file);previews.set(kind,url);setPreview(kind,url);}else{const movie=movies.find(m=>m.id===editing);setPreview(kind,kind==='banner'?(movie?.has_banner?movie.backdrop:null):movie?.poster);}}
 };
 zone.ondragover=e=>{e.preventDefault();zone.classList.add('dragging');};zone.ondragleave=()=>zone.classList.remove('dragging');
 zone.ondrop=e=>{e.preventDefault();zone.classList.remove('dragging');if(e.dataTransfer.files.length){const transfer=new DataTransfer();transfer.items.add(e.dataTransfer.files[0]);input.files=transfer.files;input.dispatchEvent(new Event('change'));}};
}
$('movie-type').onchange=()=>{
 const key={anime:'anime',animation:'animation'}[$('movie-type').value];
 if(key){const input=document.querySelector('#genre-options input[value="'+key+'"]');if(input)input.checked=true;}
};
function renderLibrary(){
 $('nav-count').textContent=movies.filter(m=>!m.deleted).length;$('stat-total').textContent=movies.filter(m=>!m.deleted).length;$('stat-ready').textContent=movies.filter(m=>!m.deleted&&m.available).length;$('stat-hero').textContent=home.hero_ids===null?'Avto':(home.hero_ids||[]).length;
 const q=$('library-search').value.toLowerCase(),filter=$('visibility-filter').value;
 const visible=movies.filter(m=>m.title.toLowerCase().includes(q)&&(filter==='all'||(filter==='active'?!m.deleted:m.deleted)));
 $('movie-list').replaceChildren(...visible.map(movie=>{
  const row=el('tr'),film=el('td'),cell=el('div','film-cell'),image=el('img');setImage(image,movie.poster);image.alt='';image.loading='lazy';image.decoding='async';
  const text=el('div');text.append(el('strong','',movie.title),el('small','','ID '+movie.id+' / '+(typeLabels[movie.type]||'Kino')+(movie.year?' / '+movie.year:'')));cell.append(image,text);film.append(cell);
  const category=el('td');if(movie.genres.length)movie.genres.slice(0,3).forEach(g=>category.append(el('span','genre-tag',labels[g]||g)));else category.append(el('span','genre-tag','Tanlanmagan'));
  const status=el('td');status.append(el('span','badge'+(movie.deleted?' hidden':!movie.available?' waiting':''),movie.deleted?"O'chirilgan":movie.available?'Tayyor':'Video kutilmoqda'));
  const actions=el('td'),buttons=el('div','table-actions');buttons.append(button('Tahrirlash',()=>openEditor(movie.id)),button(movie.deleted?'Tiklash':"O'chirish",async()=>{
   try{await api('/movies/'+movie.id,{method:'PATCH',body:{deleted:!movie.deleted}});toast(movie.deleted?'Film tiklandi.':'Film saytdan olib tashlandi. Tiklash mumkin.');await loadData();}catch(error){toast(error.message);}
  },'small-button'+(movie.deleted?'':' danger')));actions.append(buttons);
  row.append(film,category,status,el('td','',bytes(movie.size)),actions);return row;
 }));
 $('library-empty').hidden=visible.length>0;
}
$('library-search').oninput=renderLibrary;$('visibility-filter').onchange=renderLibrary;$('refresh-library').onclick=()=>loadData().catch(error=>toast(error.message));
function renderHome(){
 for(const kind of ['hero','recommend']){
  const auto=$(kind+'-auto').checked;$(kind+'-manual').hidden=auto;
  const ids=kind==='hero'?heroIds:recommendIds,selected=$(kind+'-selected'),candidates=$(kind+'-candidates');
  selected.replaceChildren(...ids.map((id,index)=>{
   const movie=movies.find(m=>m.id===id),row=el('div','selected-item');row.append(el('small','',index+1),el('span','',movie?.title||'ID '+id));
   const up=button('\u2191',()=>{if(index>0){homeDirty=true;[ids[index-1],ids[index]]=[ids[index],ids[index-1]];renderHome();}});up.setAttribute('aria-label','Yuqoriga: '+(movie?.title||id));up.disabled=index===0;
   const down=button('\u2193',()=>{if(index<ids.length-1){homeDirty=true;[ids[index+1],ids[index]]=[ids[index],ids[index+1]];renderHome();}});down.setAttribute('aria-label','Pastga: '+(movie?.title||id));down.disabled=index===ids.length-1;
   row.append(up,down);return row;
  }));
  candidates.replaceChildren(...movies.filter(m=>!m.deleted).map(movie=>{
   const label=el('label'),input=el('input'),image=el('img');input.type='checkbox';input.checked=ids.includes(movie.id);input.setAttribute('aria-label',movie.title);
   input.onchange=()=>{homeDirty=true;if(input.checked){if(ids.length>=12){input.checked=false;toast('12 tagacha film tanlang.');return;}ids.push(movie.id);}else ids.splice(ids.indexOf(movie.id),1);renderHome();};
   setImage(image,movie.poster);image.alt='';image.loading='lazy';label.append(input,image,el('span','',movie.title));return label;
  }));
 }
}
$('hero-auto').onchange=$('recommend-auto').onchange=()=>{homeDirty=true;renderHome();};
$('save-home').onclick=async()=>{
 $('save-home').disabled=true;
 try{await api('/home',{method:'POST',body:{hero_ids:$('hero-auto').checked?null:heroIds,recommendation_ids:$('recommend-auto').checked?null:recommendIds}});homeDirty=false;await loadData();toast('Bosh sahifa tanlovi saqlandi.');}
 catch(error){toast(error.message);}finally{$('save-home').disabled=false;}
};
async function loadData({libraryOnly=false}={}){
 const version=++catalogVersion,data=await api('/movies');if(version!==catalogVersion||(libraryOnly&&$('page-library').hidden))return;movies=data.movies;home=data.home;
 if(!homeDirty){const active=new Set(movies.filter(m=>!m.deleted).map(m=>m.id));heroIds=[...(home.hero_ids||[])].filter(id=>active.has(id));recommendIds=[...(home.recommendation_ids||[])].filter(id=>active.has(id));$('hero-auto').checked=home.hero_ids===null;$('recommend-auto').checked=home.recommendation_ids===null;}
 renderLibrary();renderHome();
}
const stageText={created:'Fayl kutilmoqda',receiving:'Kompyuterdan qabul qilinmoqda',queued:'Navbatda',telegram:'Telegramga yuborilmoqda',saving:'Katalogga saqlanmoqda',done:'Yakunlandi',error:'Yuklash bajarilmadi'};
function renderJob(job){
 let card=document.getElementById('upload-'+job.id);
 if(!card){
  card=el('article','upload-card');card.id='upload-'+job.id;
  const head=el('div','upload-head'),text=el('div');text.append(el('strong','job-name'),el('small','job-meta'));head.append(text,el('span','upload-stage'));
  card.append(head);
  for(const phase of ['receive','telegram']){
   const line=el('div','progress-label');line.append(el('span','',phase==='receive'?'Kompyuterdan qabul qilish':'Telegramga yuborish'),el('span',phase+'-percent','0%'));
   const track=el('div','progress-track'+(phase==='telegram'?' telegram':''));track.setAttribute('role','progressbar');track.setAttribute('aria-label',phase==='receive'?'Qabul qilish':'Telegramga yuborish');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.append(el('span',phase+'-bar'));card.append(line,track);
  }
  const error=el('p','upload-error'),bottom=el('div','upload-bottom');bottom.append(el('span','job-detail'),button('Qayta urinish',async()=>{if(pendingBatch?.failedJobId===job.id){await runBatch(pendingBatch);return;}try{await api('/jobs/'+job.id+'/retry',{method:'POST'});await pollJobs();}catch(error){toast(error.message);}},'secondary retry-job'));
  card.append(error,bottom);$('upload-list').prepend(card);
 }
 card.querySelector('.job-name').textContent=job.title||job.filename;
 card.querySelector('.job-meta').textContent={video:'Video',banner:'Banner',poster:'Kartochka rasmi'}[job.kind]+' / '+job.filename+' / '+bytes(job.size);
 const status=card.querySelector('.upload-stage');status.textContent=stageText[job.stage]||job.stage;status.className='upload-stage '+job.stage;
 const local=xhrUploads.get(job.id),received=Math.max(job.received||0,local?.loaded||0);
 for(const [phase,value]of [['receive',received],['telegram',job.sent||0]]){
  const n=percent(value,job.size);card.querySelector('.'+phase+'-percent').textContent=n+'%';card.querySelector('.'+phase+'-bar').style.width=n+'%';card.querySelector('.'+phase+'-bar').parentNode.setAttribute('aria-valuenow',String(n));
 }
 card.querySelector('.upload-error').textContent=job.error||'';
 card.querySelector('.retry-job').hidden=!job.can_retry&&pendingBatch?.failedJobId!==job.id;
 card.querySelector('.job-detail').textContent=job.stage==='done'?'Bot tasdiqladi. Film ID: '+job.movie_id:job.stage==='saving'?'Bot qabul qildi. Sayt katalogi yangilanmoqda.':job.stage==='telegram'&&job.sent>=job.size?'Telegram javobi kutilmoqda...':'Yuklash vaqtida sahifani ochiq qoldiring.';
 $('uploads-empty').hidden=true;
}
async function pollJobs(){
 if(polling||!csrf)return;polling=true;
 try{
  const data=await api('/jobs');let changed=false;
  for(const job of [...data.jobs].reverse()){const previous=jobs.get(job.id);if(previous&&previous.stage!=='done'&&job.stage==='done')changed=true;jobs.set(job.id,job);renderJob(job);}
  $('upload-count').textContent=data.jobs.filter(j=>!['done','error','created'].includes(j.stage)).length;
  if(changed)await loadData();
 }catch{}finally{polling=false;}
}
async function waitJob(jobId){
 while(true){
  const {job}=await api('/jobs/'+jobId);jobs.set(job.id,job);renderJob(job);
  if(job.stage==='done')return job;if(job.stage==='error'){const error=Error(job.error||'Yuklash bajarilmadi.');error.jobId=job.id;throw error;}
  await new Promise(resolve=>setTimeout(resolve,700));
 }
}

async function sendFile(job,file){
 file=await prepareAdminImage(file,job.kind);
 await new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest(),live={xhr,loaded:0};xhrUploads.set(job.id,live);
  xhr.open('PUT','/api/manage/jobs/'+job.id+'/file');xhr.withCredentials=true;xhr.setRequestHeader('X-CSRF-Token',csrf);xhr.setRequestHeader('Content-Type','application/octet-stream');
  xhr.upload.onprogress=e=>{live.loaded=e.loaded;renderJob({...job,stage:'receiving',received:e.loaded});};
  xhr.onload=()=>{xhrUploads.delete(job.id);if(xhr.status>=200&&xhr.status<300)resolve();else{let message='Fayl qabul qilinmadi.';try{message=JSON.parse(xhr.responseText).error||message;}catch{}reject(Error(message));}};
  xhr.onerror=()=>{xhrUploads.delete(job.id);reject(Error('Fayl uzatish uzildi. Yuklanish holatini tekshiring.'));};xhr.onabort=()=>{xhrUploads.delete(job.id);reject(Error('Yuklash toxtatildi.'));};xhr.send(file);
 });
}
async function uploadFile(kind,file,movieId,metadata){
 file=await prepareAdminImage(file,kind);
 const {job}=await api('/jobs',{method:'POST',body:{kind,filename:file.name,size:file.size,mime:file.type,movie_id:movieId,metadata}});
 jobs.set(job.id,job);renderJob(job);page('uploads');
 try{await sendFile(job,file);return await waitJob(job.id);}
 catch(error){error.jobId=job.id;throw error;}
}
async function runBatch(batch){
 if(busy)return;
 busy=true;$('save-movie').disabled=true;$('reset-editor').disabled=true;
 try{
  if(batch.needsMetadata&&!batch.metadataSaved){await api('/movies/'+batch.movieId,{method:'PATCH',body:batch.metadata});batch.metadataSaved=true;}
  for(;batch.index<batch.steps.length;batch.index++){
   const step=batch.steps[batch.index];let result;
   if(batch.failedJobId){
    const {job}=await api('/jobs/'+batch.failedJobId);
    if(job.stage==='error'){
     if(job.can_retry)await api('/jobs/'+job.id+'/retry',{method:'POST'});
     else await sendFile(job,step.file);
    }
    result=await waitJob(job.id);batch.failedJobId=null;
   }else result=await uploadFile(step.kind,step.file,batch.movieId,undefined);
  }
  await loadData();editing=batch.movieId;pendingBatch=null;
  for(const kind of ['banner','poster'])$(kind+'-file').value='';
  $('save-movie').textContent='Ozgarishlarni saqlash';$('editor-status').textContent='Saqlandi. Film ID: '+batch.movieId;toast('Film va tanlangan rasmlar saqlandi.');
  if(!batch.steps.length)page('library');
 }catch(error){
  batch.failedJobId=error.jobId||batch.failedJobId;
  if(!batch.failedJobId)pendingBatch=null;
  $('editor-status').textContent=error.message;$('save-movie').textContent=batch.failedJobId?'Yuklashni davom ettirish':'Saqlash';toast(error.message);await pollJobs();
 }finally{busy=false;$('save-movie').disabled=false;$('reset-editor').disabled=false;}
}
$('movie-form').onsubmit=async event=>{
 event.preventDefault();if(busy)return;
 if(pendingBatch?.failedJobId){await runBatch(pendingBatch);return;}
 const banner=$('banner-file').files[0],poster=$('poster-file').files[0],target=editing;
 if(!target){toast('Avval botdan yuklangan filmni tanlang.');return;}
 const metadata={title:$('movie-title').value,description:$('movie-description').value,type:$('movie-type').value,year:$('movie-year').value,rating:$('movie-rating').value,genres:selectedGenres()};
 const steps=[];if(banner)steps.push({kind:'banner',file:banner});if(poster)steps.push({kind:'poster',file:poster});
 pendingBatch={metadata,steps,index:0,movieId:target,needsMetadata:true,metadataSaved:false};
 $('editor-status').textContent='Yuklash boshlandi. Sahifani ochiq qoldiring.';await runBatch(pendingBatch);
};
async function connection(){
 try{const data=await api('/connection');$('connection').textContent=data.ok?'@'+data.username+' ulangan':data.message||'Botga ulanib bolmadi';$('connection').className='connection '+(data.ok?'ok':'error');if(data.ok&&/^[a-zA-Z0-9_]+$/.test(data.username))$('open-bot').href='https://t.me/'+data.username;}
 catch{$('connection').textContent='Ulanish tekshirilmoqda';}
}
async function enter(){
 homeDirty=false;
 $('auth-screen').hidden=true;$('app').hidden=false;
 await loadData();page('library');await pollJobs();connection();clearInterval(jobTimer);clearInterval(connectionTimer);jobTimer=setInterval(pollJobs,1000);connectionTimer=setInterval(connection,30000);
 clearInterval(catalogTimer);catalogTimer=setInterval(()=>{if(!busy&&!$('page-library').hidden&&document.visibilityState==='visible')loadData({libraryOnly:true}).catch(()=>{});},5000);
}
async function init(){
 try{const session=await api('/session');if(session.authenticated){csrf=session.csrf;await enter();}else showAuth(session.setup_required);}
 catch(error){showAuth(false);$('auth-error').textContent=error.message;}
}
window.addEventListener('beforeunload',()=>{for(const url of previews.values())URL.revokeObjectURL(url);});
if(API_BASE&&new URL(API_BASE).origin!==location.origin)location.replace(API_BASE+'/admin/');else init();
