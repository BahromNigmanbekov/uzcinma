import {apiURL,normalizeCatalog} from './api-client.js';
import {setImage} from './artwork.js';
import {wordmark} from './title-page.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
export function installSearch({open,onQuery,demoMovies}){
 const input=document.getElementById('search'),panel=document.getElementById('search-panel'),toggle=document.getElementById('search-toggle');
 const results=el('div','search-results');results.id='search-results';results.hidden=true;results.setAttribute('role','listbox');results.setAttribute('aria-label','Qidiruv natijalari');panel.append(results);
 input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls','search-results');input.setAttribute('aria-expanded','false');input.autocomplete='off';
 let timer,controller,rows=[],selected=-1,version=0;
 const hide=()=>{results.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
 function choose(movie){hide();panel.hidden=true;toggle.setAttribute('aria-expanded','false');open(movie);}
 function active(index){selected=index;[...results.querySelectorAll('.search-result')].forEach((node,i)=>node.setAttribute('aria-selected',String(i===selected)));const node=results.querySelectorAll('.search-result')[selected];if(node){input.setAttribute('aria-activedescendant',node.id);node.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');}
 function render(){
  selected=-1;results.replaceChildren();results.hidden=false;input.setAttribute('aria-expanded','true');
  if(!rows.length){results.append(el('p','search-result-message','Film topilmadi. Boshqa nom bilan qidiring.'));return;}
  rows.forEach((movie,i)=>{
   const button=el('button','search-result');button.type='button';button.id='search-result-'+i;button.setAttribute('role','option');button.setAttribute('aria-selected','false');
   const poster=el('img');setImage(poster,movie.poster);poster.alt='';poster.width=48;poster.height=72;
   const copy=el('span','search-result-copy'),logo=el('img');wordmark(logo,movie.logo,movie.title);copy.append(logo,el('strong','',movie.title),el('small','',[movie.year,{series:'Serial',anime:'Anime',animation:'Multfilm',movie:'Kino'}[movie.type]].filter(Boolean).join(' · ')));
   button.append(poster,copy,el('span','search-result-arrow','\u203a'));button.onclick=()=>choose(movie);results.append(button);
  });
 }
 async function search(){
  const q=input.value.trim(),current=++version;controller?.abort();if(!q){rows=[];hide();return;}controller=new AbortController();
  try{
   const local=demoMovies();if(local){rows=local.filter(m=>(m.title+' '+m.description).toLowerCase().includes(q.toLowerCase())).slice(0,8);}
   else{const response=await fetch(apiURL('/api/catalog?'+new URLSearchParams({q,limit:8})),{signal:controller.signal});const data=normalizeCatalog(await response.json());if(!response.ok)throw Error(data.error||'Qidiruv ochilmadi.');if(current!==version)return;rows=data.movies;}
   if(!panel.hidden&&input.value.trim()===q)render();
  }catch(error){if(error.name==='AbortError'||current!==version)return;results.replaceChildren(el('p','search-result-message',error.message));results.hidden=false;}
 }
 input.oninput=()=>{clearTimeout(timer);rows=[];selected=-1;input.removeAttribute('aria-activedescendant');onQuery(input.value.trim());version++;controller?.abort();if(!input.value.trim()){hide();return;}results.replaceChildren(el('p','search-result-message','Qidirilmoqda...'));results.hidden=false;timer=setTimeout(search,220);};
 input.onfocus=()=>{if(input.value.trim())search();};
 input.onkeydown=e=>{
  if(e.key==='Escape'){hide();panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();return;}
  if(e.key==='ArrowDown'&&!results.hidden&&rows.length){e.preventDefault();active((selected+1)%rows.length);}
  if(e.key==='ArrowUp'&&!results.hidden&&rows.length){e.preventDefault();active((selected-1+rows.length)%rows.length);}
  if(e.key==='Enter'&&!results.hidden&&rows.length){e.preventDefault();choose(rows[selected<0?0:selected]);}
 };
 document.addEventListener('pointerdown',event=>{if(!panel.contains(event.target)&&!toggle.contains(event.target))hide();});
 toggle.setAttribute('aria-controls','search-panel');toggle.setAttribute('aria-expanded','false');
 return {hide};
}
