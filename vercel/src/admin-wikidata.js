const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
export function installWikidataEditor({panel,api,toast,getMovie,getData,isDirty,isBusy,setBusy,onData}){
 const root=el('section','wikidata-editor');
 root.innerHTML='<div class="credits-list-heading"><h3>Bepul ma\u2019lumot topish</h3><span class="credit-source-badge">Kalitsiz · Wikidata</span></div><p class="field-help">Filmni nomi va yili bo\u2018yicha toping. Mavjud aktyorlar, rejissyorlar va ruxsatli suratlar olinadi. Yetishmaganlarini pastda to\u2018ldirishingiz mumkin.</p><form class="wikidata-search-form tmdb-search-form"><div><label for="wikidata-query">Film yoki serial nomi</label><input id="wikidata-query" required minlength="2" maxlength="120" placeholder="Masalan, Stranger Things"></div><button type="submit" class="secondary wikidata-search-button">Bepul qidirish</button></form><p class="wikidata-status" role="status"></p><div class="wikidata-results tmdb-search-results"></div><div class="wikidata-linked tmdb-linked" hidden></div>';
 panel.querySelector('.tmdb-setup').before(root);let generation=0;
 const find=q=>root.querySelector(q),message=text=>find('.wikidata-status').textContent=text;
 function render(data){
  const box=find('.wikidata-linked');box.replaceChildren();box.hidden=!data.wikidata;if(!data.wikidata)return;
  const copy=el('div');copy.append(el('strong','','Bog\u2018langan: '+data.wikidata.title+(data.wikidata.year?' ('+data.wikidata.year+')':'')),el('small','','Wikidata · bepul ma\u2019lumotlar'));
  const link=el('a','small-button','Manbani ko\u2018rish \u2197');link.href=data.wikidata.url;link.target='_blank';link.rel='noopener';
  const remove=el('button','small-button danger','Wikidata ro\u2018yxatini olib tashlash');remove.type='button';remove.onclick=async()=>{
   if(isDirty()){message('Avval qo\u2018lda qilingan tahrirlarni saqlang.');return;}if(isBusy())return;setBusy(true);const id=getMovie().id,version=generation;remove.disabled=true;
   try{const result=await api('/movies/'+id+'/credits/wikidata',{method:'DELETE',body:{revision:getData().revision}});if(version!==generation)return;onData(result.credits);message('Wikidata yozuvlari olib tashlandi. Qo\u2018lda qo\u2018shilganlar saqlandi.');}catch(error){if(version===generation)message(error.message);}finally{setBusy(false);remove.disabled=false;}
  };box.append(copy,link,remove);
 }
 find('form').onsubmit=async event=>{
  event.preventDefault();if(isBusy())return;setBusy(true);const version=++generation,id=getMovie().id,submit=find('.wikidata-search-button');submit.disabled=true;message('Wikidatadan qidirilmoqda...');
  try{
   const result=await api('/wikidata/search?'+new URLSearchParams({q:find('#wikidata-query').value.trim()}));if(version!==generation||getMovie()?.id!==id)return;
   const holder=find('.wikidata-results');holder.replaceChildren();
   for(const item of result.results){
    const card=el('article','tmdb-result wikidata-result'),copy=el('div','tmdb-result-copy');copy.append(el('strong','',item.title+(item.year?' ('+item.year+')':'')),el('small','',item.description||'Wikidata'));
    const importButton=el('button','small-button wikidata-import','Aktyorlarni olish');importButton.type='button';importButton.onclick=async()=>{
     if(isDirty()){message('Avval qo\u2018lda qilingan tahrirlarni saqlang.');return;}if(isBusy())return;setBusy(true);importButton.disabled=true;message('Aktyorlar va suratlar olinmoqda...');
     try{const response=await api('/movies/'+id+'/credits/wikidata',{method:'POST',body:{wikidata_id:item.wikidata_id,revision:getData().revision}});if(version!==generation||getMovie()?.id!==id)return;onData(response.credits);holder.replaceChildren();message(response.credits.cast.length+' aktyor va '+response.credits.directors.length+' rejissyor saqlandi.');toast('Ijodkorlar bepul manbadan qo\u2018shildi.');}
     catch(error){if(version===generation)message(error.message);}finally{setBusy(false);importButton.disabled=false;}
    };card.append(copy,importButton);holder.append(card);
   }
   message(result.results.length?'Nomi va yilini tekshirib, kerakli asarni tanlang.':'Ma\u2019lumot topilmadi. Original nom bilan qidiring yoki qo\u2018lda kiriting.');
  }catch(error){if(version===generation)message(error.message);}finally{setBusy(false);submit.disabled=false;}
 };
 return {render,open(movie){generation++;find('#wikidata-query').value=movie.title;find('.wikidata-results').replaceChildren();find('.wikidata-search-button').disabled=false;message('');}};
}
