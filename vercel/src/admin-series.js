import './admin-series.css';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
export function installAdminSeries({api,toast,getMovies,openEditor,reload}){
 const create=el('button','secondary','+ Serial / ko\u2018p qismli asar');create.type='button';document.querySelector('#page-library .page-heading').append(create);
 const dialog=el('dialog','series-create');dialog.setAttribute('aria-labelledby','create-series-title');
 dialog.innerHTML='<form><h2 id="create-series-title">Yangi serial</h2><p>Avval asar nomini yarating. So\u2018ng botdan yuklangan videolarni fasl va qismlariga biriktiring.</p><label for="collection-name">Asar nomi</label><input id="collection-name" required maxlength="200" placeholder="Masalan, Stranger Things"><label for="collection-type">Turi</label><select id="collection-type"><option value="series">Serial</option><option value="anime">Anime</option><option value="animation">Ko\u2018p qismli multfilm</option></select><p class="collection-error" role="alert"></p><div class="series-actions"><button class="secondary collection-cancel" type="button">Bekor qilish</button><button class="primary" type="submit">Yaratish</button></div></form>';
 document.body.append(dialog);create.onclick=()=>{dialog.querySelector('form').reset();dialog.querySelector('.collection-error').textContent='';dialog.showModal();};dialog.querySelector('.collection-cancel').onclick=()=>dialog.close();
 dialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();const submit=dialog.querySelector('[type=submit]');submit.disabled=true;
  try{const type=dialog.querySelector('select').value,{movie}=await api('/collections',{method:'POST',body:{title:dialog.querySelector('input').value,type,genres:type==='series'?[]:[type]}});
   dialog.close();await reload();await openEditor(movie.id);toast('Serial yaratildi. Endi fasl va qismlarini qo\u2018shing.');
  }catch(error){dialog.querySelector('.collection-error').textContent=error.message;}finally{submit.disabled=false;}
 };
 const panel=el('section','panel form-panel series-management');panel.hidden=true;document.getElementById('page-editor').append(panel);
 panel.innerHTML='<div class="series-heading"><div><p class="eyebrow">SERIAL BOSHQARUVI</p><h2>Fasl va qismlar</h2></div><a class="secondary series-public" target="_blank" rel="noopener">Saytda ko\u2018rish \u2197</a></div><p class="field-help">Videoni botga yuboring. Keyin shu yerda video nomi yoki IDsi orqali kerakli fasl va qismga biriktiring. Bir raqamga ikkita faol video qo\u2018shilmaydi.</p><form class="season-form series-inline"><div><label for="season-number">Fasl raqami</label><input id="season-number" type="number" min="1" max="1000" required value="1"></div><div><label for="season-name">Fasl nomi (ixtiyoriy)</label><input id="season-name" maxlength="120"></div><div><label for="season-description">Fasl tavsifi</label><input id="season-description" maxlength="1000"></div><button class="secondary" type="submit">Faslni saqlash</button></form><div class="series-heading"><label for="admin-season">Faslni tanlang<select id="admin-season"></select></label><div class="series-actions"><button type="button" class="small-button season-edit">Faslni tahrirlash</button><button type="button" class="small-button danger season-delete">Bo\u2018sh faslni o\u2018chirish</button></div></div><form class="episode-form series-inline"><div><label for="episode-video">Botdan yuklangan video</label><input id="episode-video" type="number" min="1" list="episode-videos" required placeholder="Videoni tanlang yoki ID kiriting"><datalist id="episode-videos"></datalist></div><div><label for="episode-season">Fasl raqami</label><input id="episode-season" type="number" min="1" max="1000" required value="1"></div><div><label for="episode-number">Qism raqami</label><input id="episode-number" type="number" min="1" max="10000" required value="1"></div><div><label for="episode-name">Qism nomi (ixtiyoriy)</label><input id="episode-name" maxlength="200" placeholder="Video nomi saqlanadi"></div><button class="primary" type="submit">Qismni biriktirish</button></form><p class="series-status" role="status"></p><div class="admin-episodes"></div><button class="secondary admin-episodes-more" type="button" hidden>Yana qismlar</button>';
 const childPanel=el('section','panel form-panel series-management');childPanel.hidden=true;document.getElementById('page-editor').append(childPanel);
 let movie=null,data=null,generation=0;
 const find=q=>panel.querySelector(q),value=q=>find(q).value;
 const status=text=>find('.series-status').textContent=text;
 async function refresh(season,append=false){
  if(!movie?.is_collection)return;const version=++generation,id=movie.id;status('Qismlar yuklanmoqda...');
  try{const result=await api('/collections/'+id+'?'+new URLSearchParams({...(season?{season}:{}),...(append?{offset:data.episodes.length}:{})}));if(version!==generation||movie.id!==id)return;
   const episodes=append?[...data.episodes,...result.episodes]:result.episodes;data={...result,episodes};render();status(data.total+' ta qism');
  }catch(error){if(version===generation)status(error.message);}
 }
 function render(){
  find('.series-public').href='/title/'+movie.id;
  const select=find('#admin-season');select.replaceChildren(...data.seasons.map(s=>{const option=el('option','',s.number+'-fasl'+(s.title?' · '+s.title:'')+' ('+s.episode_count+' qism)');option.value=s.number;return option;}));select.value=data.selected_season;select.disabled=!data.seasons.length;
  find('#episode-season').value=data.selected_season||1;
  const next=Math.max(0,...data.episodes.map(e=>e.episode_number))+1;find('#episode-number').value=next;
  find('.season-delete').disabled=!data.selected_season||data.total>0;find('.season-edit').disabled=!data.selected_season;
  find('.admin-episodes-more').hidden=!data.has_more;
  find('#episode-videos').replaceChildren(...getMovies().filter(m=>!m.is_collection&&!m.collection_id&&!m.deleted).map(m=>{const option=el('option');option.value=m.id;option.label=m.title+' (ID '+m.id+')';return option;}));
  const holder=find('.admin-episodes');holder.replaceChildren();
  for(const episode of data.episodes){
   const row=el('article','admin-episode-row'),copy=el('div');copy.append(el('strong','',episode.episode_number+'-qism · '+episode.title),el('small','','Video ID: '+episode.id+(episode.deleted?' · Yashirilgan':'')));row.append(copy);
   const actions=el('div','series-actions');
   const action=(text,fn)=>{const b=el('button','small-button',text);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(error){toast(error.message);}finally{b.disabled=false;}};actions.append(b);};
   action('Tahrirlash',()=>openEditor(episode.id));
   action('Joyini o\u2018zgartirish',()=>{find('#episode-video').value=episode.id;find('#episode-season').value=episode.season_number;find('#episode-number').value=episode.episode_number;find('#episode-name').value=episode.title;find('#episode-video').focus();find('.episode-form').scrollIntoView({behavior:'smooth',block:'center'});});
   action(episode.deleted?'Tiklash':'Yashirish',async()=>{await api('/movies/'+episode.id,{method:'PATCH',body:{deleted:!episode.deleted}});await refresh(data.selected_season);await reload();});
   action('Serialdan ajratish',async()=>{await api('/episodes/'+episode.id+'/detach',{method:'POST'});await refresh(data.selected_season);await reload();toast('Video ajratildi. Katalogda alohida saqlandi.');});
   row.append(actions);holder.append(row);
  }
  if(!data.episodes.length)holder.append(el('p','field-help','Bu faslga hali qism biriktirilmagan.'));
 }
 find('#admin-season').onchange=e=>refresh(e.target.value);
 find('.admin-episodes-more').onclick=()=>refresh(data.selected_season,true);
 find('.season-form').onsubmit=async event=>{event.preventDefault();const submit=event.submitter;submit.disabled=true;try{const season=Number(value('#season-number'));await api('/collections/'+movie.id+'/seasons',{method:'POST',body:{number:season,title:value('#season-name'),description:value('#season-description')}});await refresh(season);toast('Fasl saqlandi.');}catch(error){toast(error.message);}finally{submit.disabled=false;}};
 find('.season-edit').onclick=()=>{const season=data.seasons.find(s=>s.number===data.selected_season);if(season){find('#season-number').value=season.number;find('#season-name').value=season.title;find('#season-description').value=season.description;find('#season-name').focus();}};
 find('.season-delete').onclick=async()=>{try{await api('/collections/'+movie.id+'/seasons/'+data.selected_season,{method:'DELETE'});await refresh();toast('Bo\u2018sh fasl o\u2018chirildi.');}catch(error){toast(error.message);}};
 find('.episode-form').onsubmit=async event=>{event.preventDefault();const submit=event.submitter;submit.disabled=true;try{
  const season=Number(value('#episode-season')),title=value('#episode-name').trim();await api('/collections/'+movie.id+'/episodes',{method:'POST',body:{movie_id:value('#episode-video'),season,episode:value('#episode-number'),...(title?{title}:{})}});
  find('#episode-video').value='';find('#episode-name').value='';await refresh(season);await reload();toast('Qism biriktirildi.');
 }catch(error){toast(error.message);}finally{submit.disabled=false;}};
 return {async open(current){generation++;movie=current;data=null;panel.hidden=!movie.is_collection;childPanel.hidden=!movie.collection_id;
  if(movie.collection_id){childPanel.replaceChildren(el('h2','','Serial qismi'),el('p','field-help',movie.season_number+'-fasl · '+movie.episode_number+'-qism'));const back=el('button','secondary','\u2190 Serial fasllariga qaytish');back.type='button';back.onclick=()=>openEditor(movie.collection_id);childPanel.append(back);}
  if(movie.is_collection)await refresh();
 }};
}
