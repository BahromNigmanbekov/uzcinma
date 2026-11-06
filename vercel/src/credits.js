import './credits.css';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
export function createCreditsView(){
 const root=el('section','credits-section');root.hidden=true;root.setAttribute('aria-labelledby','credits-heading');
 root.innerHTML='<div class="credits-heading"><h2 id="credits-heading">Aktyorlar va ijodkorlar</h2><div class="credits-scroll-buttons"><button type="button" class="icon-button credits-prev" aria-label="Oldingi aktyorlar">\u2039</button><button type="button" class="icon-button credits-next" aria-label="Keyingi aktyorlar">\u203a</button></div></div><div class="credits-tabs" role="tablist" aria-label="Ijodkorlar"><button type="button" id="cast-tab" role="tab" aria-controls="cast-panel" aria-selected="true">Aktyorlar</button><button type="button" id="directors-tab" role="tab" aria-controls="directors-panel" aria-selected="false" tabindex="-1">Rejissyor</button></div><div class="credits-track" id="cast-panel" role="tabpanel" aria-labelledby="cast-tab" tabindex="0"></div><div class="credits-track" id="directors-panel" role="tabpanel" aria-labelledby="directors-tab" tabindex="0" hidden></div><p class="credits-empty" hidden></p><div class="tmdb-attribution" hidden><a href="https://www.themoviedb.org" target="_blank" rel="noopener"><img src="/assets/tmdb-logo.svg" width="64" height="46" alt="TMDB"></a><div><p>Aktyorlar va suratlar manbasi: <a class="credits-source" target="_blank" rel="noopener">TMDB</a>.</p><p lang="en">This product uses the TMDB API but is not endorsed or certified by TMDB.</p></div></div>';
 const wikiSource=el('div','wikidata-attribution');wikiSource.hidden=true;root.append(wikiSource);
 let data,signature,active='cast',drag;
 const find=q=>root.querySelector(q),track=()=>find('#'+active+'-panel');
 function arrows(){const node=track();find('.credits-prev').disabled=node.scrollLeft<=2;find('.credits-next').disabled=node.scrollLeft+node.clientWidth>=node.scrollWidth-2;}
 function select(kind){active=kind;for(const key of ['cast','directors']){const tab=find('#'+key+'-tab');tab.setAttribute('aria-selected',String(key===active));tab.tabIndex=key===active?0:-1;find('#'+key+'-panel').hidden=key!==active;}
  const empty=!data?.[active]?.length;find('.credits-empty').hidden=!empty;find('.credits-empty').textContent=active==='cast'?'Aktyorlar hali kiritilmagan.':'Rejissyor ma\u2019lumoti hali kiritilmagan.';requestAnimationFrame(arrows);
 }
 for(const key of ['cast','directors']){
  const tab=find('#'+key+'-tab');tab.onclick=()=>select(key);
  tab.onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'cast':event.key==='End'?'directors':active==='cast'?'directors':'cast';select(next);find('#'+next+'-tab').focus();}};
  const node=find('#'+key+'-panel');node.addEventListener('scroll',arrows,{passive:true});
  node.onpointerdown=event=>{if(event.pointerType==='mouse'&&event.button===0)drag={id:event.pointerId,start:event.clientX,scroll:node.scrollLeft,node};};
  node.onpointermove=event=>{if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.start;if(Math.abs(dx)>5){node.setPointerCapture(event.pointerId);node.classList.add('is-dragging');node.scrollLeft=drag.scroll-dx;}};
  const release=()=>{node.classList.remove('is-dragging');drag=null;};node.onpointerup=release;node.onpointercancel=release;node.onlostpointercapture=release;
 }
 for(const [selector,direction]of [['.credits-prev',-1],['.credits-next',1]])find(selector).onclick=()=>track().scrollBy({left:direction*track().clientWidth*.75,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
 const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(arrows):null;observer?.observe(root);
 return {root,render(next){
  const nextSignature=JSON.stringify(next||{});if(signature===nextSignature)return;signature=nextSignature;data=next||{cast:[],directors:[]};
  root.hidden=!(data.cast?.length||data.directors?.length);if(root.hidden)return;
  active=data.cast?.length?'cast':'directors';
  for(const kind of ['cast','directors']){
   const holder=find('#'+kind+'-panel');holder.replaceChildren();
   find('#'+kind+'-tab').textContent=(kind==='cast'?'Aktyorlar':'Rejissyor')+' ('+(data[kind]?.length||0)+')';
   for(const person of data[kind]||[]){
    const card=el('article','person-card'),portrait=el('div','person-portrait'),initials=el('span','person-initials',person.name.split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join(''));initials.setAttribute('aria-hidden','true');portrait.append(initials);
    if(person.photo){const image=el('img');image.alt='';image.width=96;image.height=96;image.loading='lazy';image.decoding='async';image.draggable=false;image.onload=()=>portrait.classList.add('has-photo');image.onerror=()=>{image.remove();portrait.classList.remove('has-photo');};image.src=person.photo;portrait.append(image);}
    const name=el('h3','person-name',person.name);name.title=person.name;const role=el('p','person-role',person.role||'');role.title=person.role||'';card.append(portrait,name,role);if(person.photo&&person.photo_credit){const credit=el('div','person-photo-credit'),author=el('a','',person.photo_credit.author),license=el('a','',person.photo_credit.license);author.href=person.photo_credit.url;license.href=person.photo_credit.license_url||person.photo_credit.url;for(const link of [author,license]){link.target='_blank';link.rel='noopener';}credit.title=person.photo_credit.author+' \u00b7 '+person.photo_credit.license+' \u00b7 '+(person.photo_credit.changes||'');credit.append(author,document.createTextNode(' \u00b7 '),license);card.append(credit);}holder.append(card);
   }
   holder.scrollLeft=0;
  }
  wikiSource.hidden=!data.wikidata;wikiSource.replaceChildren();if(data.wikidata){const link=el('a','','Ma\u2019lumotlar: Wikidata (CC0)');link.href=data.wikidata.url;link.target='_blank';link.rel='noopener';wikiSource.append(link,el('p','','Suratlar: Wikimedia Commons. Muallif va litsenziya portret ostidagi havolada ko\u2018rsatilgan.'));}
  find('.tmdb-attribution').hidden=!data.attribution;find('.credits-source').href=data.tmdb?.url||'https://www.themoviedb.org';select(active);
 }};
}
