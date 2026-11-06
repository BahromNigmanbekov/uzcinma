import {installWikidataEditor} from './admin-wikidata.js';
import './admin-credits.css';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const blank=()=>({cast:[],directors:[],revision:0,tmdb:null});
export function installAdminCredits({api,toast,openEditor}){
 const panel=el('section','panel form-panel credits-management');panel.hidden=true;const editor=document.getElementById('page-editor');editor.insertBefore(panel,editor.querySelector('.series-management'));
 panel.innerHTML='<div class="credits-admin-heading"><div><p class="eyebrow">FILM IJODKORLARI</p><h2>Aktyorlar va rejissyor</h2></div><span class="tmdb-connection-status"></span></div><div class="credits-child-note" hidden><p>Bu qismning aktyorlari asosiy serial sahifasidan olinadi.</p><button type="button" class="secondary credits-parent">Serialga qaytish</button></div><div class="credits-admin-body"><p class="field-help">Bepul manbadan kerakli asarni toping yoki ma\u2019lumotlarni qo\u2018lda kiriting. Kinoning nomi, videosi va yuklangan rasmlari alohida boshqariladi.</p><details class="tmdb-setup"><summary>TMDB ulanishini sozlash</summary><p class="field-help">Akkauntingizdagi API Read Access Token yoki API Key qiymatini kiriting. Kalit saqlangach qayta ko\u2018rsatilmaydi.</p><a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener" class="tmdb-settings-link">TMDB API sozlamalarini ochish \u2197</a><form class="tmdb-connection-form"><label for="tmdb-credential">TMDB API kaliti yoki tokeni</label><input id="tmdb-credential" type="password" autocomplete="off" maxlength="4096" required spellcheck="false"><div class="credits-admin-actions"><button class="secondary tmdb-connect-button" type="submit">Tekshirish va ulash</button><button class="small-button tmdb-disconnect" type="button" hidden>Paneldagi kalitni olib tashlash</button></div></form><p class="tmdb-setup-status" role="status"></p></details><form class="tmdb-search-form"><div><label for="tmdb-query">Film yoki serial nomi</label><input id="tmdb-query" maxlength="120" minlength="2" required placeholder="Masalan, Stranger Things"></div><div><label for="tmdb-type">Qidiruv turi</label><select id="tmdb-type"><option value="all">Kino va serial</option><option value="movie">Kino</option><option value="tv">Serial / ko\u2018p qismli asar</option></select></div><button class="secondary tmdb-search-button" type="submit">Film ma\u2019lumotlarini topish</button></form><p class="credits-admin-status" role="status"></p><div class="tmdb-search-results"></div><button class="small-button tmdb-results-more" type="button" hidden>Yana natijalar</button><div class="tmdb-linked" hidden></div><div class="credits-admin-lists"><section><div class="credits-list-heading"><h3>Aktyorlar</h3><button type="button" class="small-button add-actor">+ Aktyor</button></div><div class="admin-cast-list"></div></section><section><div class="credits-list-heading"><h3>Rejissyorlar</h3><button type="button" class="small-button add-director">+ Rejissyor</button></div><div class="admin-directors-list"></div></section></div><div class="credits-admin-actions"><button class="primary save-credits" type="button">Aktyorlar va rejissyorlarni saqlash</button><button class="secondary reset-credits" type="button">Saqlangan holatni qaytarish</button></div></div>';
 let movie,data=blank(),generation=0,dirty=false,pending=false,connection={configured:false},searchPage=1,searchResults=[],searchType,searchQuery;
 const find=q=>q.startsWith('.tmdb-')?[...panel.querySelectorAll(q)].find(n=>!n.closest('.wikidata-editor')):panel.querySelector(q),message=text=>find('.credits-admin-status').textContent=text;
 function markDirty(){dirty=true;message('O\u2018zgarishlar hali saqlanmagan.');for(const button of panel.querySelectorAll('.tmdb-import-button'))button.disabled=true;}
 function refreshConnection(){
  const status=find('.tmdb-connection-status');status.textContent=connection.configured?'TMDB ulangan':'TMDB ulanmagan';status.hidden=!connection.configured;status.className='tmdb-connection-status '+(connection.configured?'connected':'');
  find('.tmdb-search-button').disabled=!connection.configured||pending;find('.tmdb-disconnect').hidden=connection.source!=='panel';find('.tmdb-connect-button').disabled=connection.can_save===false;
  if(!connection.configured)find('.tmdb-setup').open=true;
 }
 function renderLinked(){
  const box=find('.tmdb-linked');box.replaceChildren();box.hidden=!data.tmdb;if(!data.tmdb)return;
  const text=el('div');text.append(el('strong','','Bog\u2018langan: '+data.tmdb.title+(data.tmdb.year?' ('+data.tmdb.year+')':'')),el('small','',data.tmdb.type==='tv'?'Serial':'Kino'));
  const link=el('a','small-button','TMDBda ko\u2018rish \u2197');link.href=data.tmdb.url;link.target='_blank';link.rel='noopener';
  const remove=el('button','small-button danger','TMDB ma\u2019lumotlarini olib tashlash');remove.type='button';remove.onclick=async()=>{
   if(dirty){message('Avval o\u2018zgarishlarni saqlang yoki saqlangan holatni qaytaring.');return;}
   if(pending)return;pending=true;remove.disabled=true;const version=generation;
   try{const result=await api('/movies/'+movie.id+'/credits/tmdb',{method:'DELETE',body:{revision:data.revision}});if(version!==generation)return;data=result.credits;dirty=false;render();message('TMDBdan olingan yozuvlar olib tashlandi. Qo\u2018lda qo\u2018shilganlar saqlandi.');}
   catch(error){message(error.message);}finally{pending=false;remove.disabled=false;refreshConnection();}
  };
  box.append(text,link,remove);
 }
 function renderPeople(kind){
  const holder=find(kind==='cast'?'.admin-cast-list':'.admin-directors-list');holder.replaceChildren();
  if(!data[kind].length){holder.append(el('p','field-help',kind==='cast'?'Aktyorlar hali kiritilmagan.':'Rejissyor hali kiritilmagan.'));return;}
  data[kind].forEach((person,index)=>{
   const row=el('article','admin-person-row'),header=el('div','admin-person-heading'),photo=el('img');photo.alt='';photo.width=48;photo.height=48;photo.loading='lazy';photo.onerror=()=>photo.hidden=true;
   if(person.photo){photo.src=person.photo;}else photo.hidden=true;
   header.append(photo,el('strong','',(index+1)+'. '+(person.name||'Yangi yozuv')),el('span','credit-source-badge',person.source==='tmdb'?'TMDB':person.source==='wikidata'?'Wikidata':'Qo\u2018lda'));
   const controls=el('div','credits-row-actions');
   for(const [label,action,disabled]of [['\u2191',()=>{[data[kind][index-1],data[kind][index]]=[data[kind][index],data[kind][index-1]];markDirty();renderPeople(kind);},index===0],['\u2193',()=>{[data[kind][index+1],data[kind][index]]=[data[kind][index],data[kind][index+1]];markDirty();renderPeople(kind);},index===data[kind].length-1],['Olib tashlash',()=>{data[kind].splice(index,1);markDirty();renderPeople(kind);},false]]){
    const button=el('button','small-button',label);button.type='button';button.disabled=disabled;button.setAttribute('aria-label',(label==='\u2191'?'Yuqoriga':label==='\u2193'?'Pastga':label)+': '+(person.name||'yangi yozuv'));button.onclick=action;controls.append(button);
   }
   header.append(controls);row.append(header);
   const fields=el('div','admin-person-fields');
   for(const [key,label,type,max]of [['name','Ism','text',120],['role',kind==='cast'?'Filmdagi roli':'Vazifasi','text',240],['photo','Suratning HTTPS havolasi','url',1500]]){
    const wrap=el('label','',label),input=el('input');input.type=type;input.maxLength=max;input.value=person[key]||'';input.dataset.field=key;input.required=key==='name';input.setAttribute('aria-label',label+' '+(index+1));input.oninput=()=>{person[key]=input.value;markDirty();};
    if(key==='name')input.onchange=()=>header.querySelector('strong').textContent=(index+1)+'. '+(person.name||'Yangi yozuv');
    if(key==='photo')input.onchange=()=>{photo.hidden=!/^https:\/\//.test(input.value);if(!photo.hidden)photo.src=input.value;};
    wrap.append(input);fields.append(wrap);
   }
   row.append(fields);holder.append(row);
  });
 }
 function render(){wiki.render(data);renderLinked();renderPeople('cast');renderPeople('directors');refreshConnection();}
 function renderResults(){
  const holder=find('.tmdb-search-results');holder.replaceChildren();
  if(!searchResults.length){holder.append(el('p','field-help','Natija topilmadi. Asarning original nomi bilan qidiring.'));return;}
  for(const result of searchResults){
   const card=el('article','tmdb-result'),image=el('img');image.alt='';image.width=60;image.height=90;image.loading='lazy';if(result.poster)image.src=result.poster;else image.hidden=true;image.onerror=()=>image.hidden=true;
   const copy=el('div','tmdb-result-copy');copy.append(el('strong','',result.title),el('small','',[result.year,result.type==='tv'?'Serial':'Kino',result.original_title!==result.title?result.original_title:null].filter(Boolean).join(' · ')));
   if(result.overview)copy.append(el('p','',result.overview));
   const button=el('button','small-button tmdb-import-button','Aktyorlarni olish');button.type='button';button.disabled=dirty;button.onclick=async()=>{
    if(pending||dirty)return;pending=true;button.disabled=true;message('Aktyorlar va rejissyorlar olinmoqda...');const version=generation,id=movie.id;
    try{const response=await api('/movies/'+id+'/credits/tmdb',{method:'POST',body:{tmdb_id:result.tmdb_id,type:result.type,revision:data.revision}});if(version!==generation)return;data=response.credits;dirty=false;searchResults=[];holder.replaceChildren();find('.tmdb-results-more').hidden=true;render();message(data.cast.length+' aktyor va '+data.directors.length+' rejissyor saqlandi.');toast('Aktyorlar film sahifasiga qo\u2018shildi.');}
    catch(error){if(version===generation)message(error.message);}finally{pending=false;button.disabled=false;refreshConnection();}
   };
   card.append(image,copy,button);holder.append(card);
  }
 }
 async function search(page=1){
  if(pending)return;pending=true;refreshConnection();const version=generation;
  if(page===1){searchQuery=find('#tmdb-query').value.trim();searchType=find('#tmdb-type').value;searchResults=[];}
  message('TMDBdan qidirilmoqda...');
  try{const result=await api('/tmdb/search?'+new URLSearchParams({q:searchQuery,type:searchType,page}));if(version!==generation)return;searchResults.push(...result.results);searchPage=page;renderResults();find('.tmdb-results-more').hidden=page>=result.total_pages;message('Nomi va yilini tekshirib, to\u2018g\u2018ri asarni tanlang.');}
  catch(error){if(version===generation)message(error.message);}finally{pending=false;refreshConnection();}
 }
 find('.tmdb-search-form').onsubmit=event=>{event.preventDefault();search();};find('.tmdb-results-more').onclick=()=>search(searchPage+1);
 find('.tmdb-connection-form').onsubmit=async event=>{
  event.preventDefault();const button=find('.tmdb-connect-button'),input=find('#tmdb-credential');button.disabled=true;find('.tmdb-setup-status').textContent='Ulanish tekshirilmoqda...';
  try{connection=await api('/tmdb/connection',{method:'POST',body:{credential:input.value}});find('.tmdb-setup-status').textContent='TMDB muvaffaqiyatli ulandi. Endi film nomi bilan qidiring.';find('.tmdb-setup').open=false;toast('TMDB ulandi.');refreshConnection();}
  catch(error){find('.tmdb-setup-status').textContent=error.message;}finally{input.value='';button.disabled=false;}
 };
 find('.tmdb-disconnect').onclick=async()=>{try{connection=await api('/tmdb/connection',{method:'DELETE'});refreshConnection();find('.tmdb-setup-status').textContent='Panelga kiritilgan kalit olib tashlandi. Saqlangan aktyorlar katalogda qoldi.';}catch(error){find('.tmdb-setup-status').textContent=error.message;}};
 for(const [selector,kind]of [['.add-actor','cast'],['.add-director','directors']])find(selector).onclick=()=>{
  if(pending)return;if(data[kind].length>=(kind==='cast'?80:30)){toast('Ro\u2018yxat chegarasiga yetdingiz.');return;}
  data[kind].push({name:'',role:kind==='directors'?'Rejissyor':'',photo:'',source:'manual'});markDirty();renderPeople(kind);const input=find(kind==='cast'?'.admin-cast-list':'.admin-directors-list').lastElementChild?.querySelector('input');input?.focus();
 };
 find('.save-credits').onclick=async()=>{
  if(pending)return;const inputs=[...panel.querySelectorAll('.admin-person-fields input')];for(const input of inputs){if(!input.reportValidity())return;}
  pending=true;find('.save-credits').disabled=true;const version=generation;
  try{const result=await api('/movies/'+movie.id+'/credits',{method:'PATCH',body:{cast:data.cast,directors:data.directors,revision:data.revision}});if(version!==generation)return;data=result.credits;dirty=false;render();message('Aktyorlar va rejissyorlar saqlandi.');toast('Ijodkorlar ma\u2019lumotlari saqlandi.');}
  catch(error){if(version===generation)message(error.message);}finally{pending=false;find('.save-credits').disabled=false;refreshConnection();}
 };
 find('.reset-credits').onclick=()=>{if(movie)open(movie);};
 async function open(current){
  const version=++generation;movie=current;data=blank();dirty=false;searchResults=[];panel.hidden=false;pending=false;
  find('.credits-child-note').hidden=!movie.collection_id;find('.credits-admin-body').hidden=Boolean(movie.collection_id);find('.tmdb-search-results').replaceChildren();find('.tmdb-results-more').hidden=true;find('#tmdb-credential').value='';find('.tmdb-setup-status').textContent='';
  if(movie.collection_id){find('.credits-parent').onclick=()=>openEditor(movie.collection_id);return;}
  wiki.open(movie);find('#tmdb-query').value=movie.title;find('#tmdb-type').value=movie.is_collection||movie.type==='series'?'tv':'movie';message('Ijodkorlar ma\u2019lumotlari yuklanmoqda...');
  try{const result=await api('/movies/'+movie.id+'/credits');if(version!==generation)return;data=result.credits;connection=result.tmdb;render();message('Bepul qidiruvdan foydalaning yoki ro\u2018yxatni qo\u2018lda to\u2018ldiring.');}
  catch(error){if(version===generation)message(error.message);}
 }
 const wiki=installWikidataEditor({panel,api,toast,getMovie:()=>movie,getData:()=>data,isDirty:()=>dirty,isBusy:()=>pending,setBusy:value=>{pending=value;},onData:value=>{data=value;dirty=false;render();message('Ijodkorlar saqlandi.');}});
 const optional=el('details','optional-tmdb');const summary=el('summary','','Qo\u2018shimcha: TMDB orqali import');optional.append(summary);find('.tmdb-setup').before(optional);for(const selector of ['.tmdb-setup','.tmdb-search-form','.tmdb-search-results','.tmdb-results-more','.tmdb-linked']){const node=[...panel.querySelectorAll(selector)].find(node=>!node.closest('.wikidata-editor'));if(node)optional.append(node);}
 return {open};
}
