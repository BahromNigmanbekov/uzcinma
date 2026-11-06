import './select-menu.css';
const controls=new WeakMap(),instances=new Set();let current,sequence=0,installed=false;
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
export function hasOpenSelect(root){return Boolean(current&&(!root||root.contains(current.select)));}
export function closeSelectMenus(root){if(current&&(!root||root.contains(current.select)))current.close();}
export function refreshSelect(select){controls.get(select)?.sync();}
function labelOf(select){return select.getAttribute('aria-label')||[...(select.labels||[])].map(l=>{const copy=l.cloneNode(true);copy.querySelectorAll('select,.ui-select,button').forEach(n=>n.remove());return copy.textContent.replace(/\s+/g,' ').trim();}).filter(Boolean)[0]||'Tanlash';}
class SelectMenu{
 constructor(select){
  this.select=select;this.id='select-menu-'+(++sequence);this.wrapper=node('span','ui-select');this.wrapper.dataset.selectFor=select.id||this.id;
  select.before(this.wrapper);this.wrapper.append(select);select.classList.add('ui-select-source');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  this.button=node('button','ui-select-trigger');this.button.type='button';this.button.setAttribute('role','combobox');this.button.setAttribute('aria-haspopup','listbox');this.button.setAttribute('aria-controls',this.id);this.button.setAttribute('aria-expanded','false');
  this.text=node('span','ui-select-value');this.button.append(this.text,node('span','ui-select-chevron'));this.wrapper.append(this.button);
  this.menu=node('div','ui-select-menu');this.menu.id=this.id;this.menu.setAttribute('role','listbox');this.menu.hidden=true;this.menu.setAttribute('aria-label',labelOf(select));
  this.button.onclick=e=>{e.preventDefault();this.opened?this.close():this.open();};this.button.onkeydown=e=>this.key(e);
  this.menu.onpointerdown=e=>e.preventDefault();this.menu.onclick=e=>{const option=e.target.closest('[data-option-index]');if(option)this.choose(Number(option.dataset.optionIndex));};
  select.addEventListener('change',()=>this.sync());select.addEventListener('input',()=>this.sync());this.sync();
 }
 options(){return [...this.select.options].map((o,index)=>({value:o.value,text:o.label||o.textContent,disabled:o.disabled||Boolean(o.parentElement?.disabled),index,group:o.parentElement?.tagName==='OPTGROUP'?o.parentElement.label:null}));}
 sync(){
  if(!this.select.isConnected){this.close();instances.delete(this);return;}
  const selected=this.select.selectedOptions[0],text=selected?.label||selected?.textContent||'Tanlang';
  if(this.text.textContent!==text)this.text.textContent=text;
  this.button.disabled=this.select.disabled;this.button.title=text;this.button.setAttribute('aria-label',labelOf(this.select)+': '+text);
  this.wrapper.classList.toggle('is-disabled',this.select.disabled);
  const signature=JSON.stringify(this.options())+'|'+this.select.selectedIndex;
  if(signature!==this.signature){this.signature=signature;if(this.opened){this.render();this.position();}}
  if(this.opened&&this.select.disabled)this.close();
 }
 render(){
  this.items=this.options();this.menu.replaceChildren();let group;
  for(const item of this.items){
   if(item.group&&item.group!==group){this.menu.append(node('div','ui-select-group',item.group));group=item.group;}
   const option=node('div','ui-select-option',item.text);option.id=this.id+'-'+item.index;option.dataset.optionIndex=item.index;option.setAttribute('role','option');option.setAttribute('aria-selected',String(item.index===this.select.selectedIndex));option.setAttribute('aria-disabled',String(item.disabled));option.title=item.text;this.menu.append(option);
  }
  const selected=this.select.selectedIndex;this.highlight=selected>=0&&!this.items[selected]?.disabled?selected:this.items.findIndex(o=>!o.disabled);this.activate(this.highlight);
 }
 activate(index){
  if(index<0)return;this.highlight=index;
  for(const option of this.menu.querySelectorAll('[role=option]'))option.classList.toggle('is-highlighted',Number(option.dataset.optionIndex)===index);
  const option=this.menu.querySelector('[data-option-index="'+index+'"]');if(option){this.button.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}
 }
 position(){
  if(!this.opened)return;const anchor=this.button.getBoundingClientRect(),width=innerWidth,height=innerHeight;
  if(!anchor.width||!anchor.height||anchor.bottom<0||anchor.top>height){this.close();return;}
  const margin=12,above=anchor.top-margin-6,below=height-anchor.bottom-margin-6,desired=Math.min(document.body.classList.contains('tv-mode')?480:320,Math.max(60,this.items.length*(document.body.classList.contains('tv-mode')?60:44)+16));
  const up=below<desired&&above>below,space=Math.max(50,up?above:below),menuWidth=Math.min(width-margin*2,Math.max(anchor.width,180));
  this.menu.style.width=menuWidth+'px';this.menu.style.maxHeight=Math.min(desired,space)+'px';this.menu.style.left=Math.max(margin,Math.min(width-margin-menuWidth,anchor.left))+'px';
  this.menu.dataset.placement=up?'above':'below';this.menu.style.top=up?'auto':(anchor.bottom+6)+'px';this.menu.style.bottom=up?(height-anchor.top+6)+'px':'auto';
 }
 open(){
  if(this.select.disabled)return;const rect=this.button.getBoundingClientRect();if(rect.top<0||rect.bottom>innerHeight)this.button.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});current?.close();current=this;this.opened=true;this.sync();this.render();
  const host=(document.fullscreenElement?.contains(this.select)?document.fullscreenElement:null)||this.select.closest('dialog[open],.player.is-fullscreen')||document.body;
  host.append(this.menu);this.menu.hidden=false;this.button.setAttribute('aria-expanded','true');this.wrapper.classList.add('is-open');this.position();if(this.opened)this.activate(this.highlight);
  document.dispatchEvent(new CustomEvent('selectmenu:toggle',{detail:{select:this.select,open:true}}));
 }
 close({focus=false}={}){
  if(!this.opened)return;this.opened=false;this.menu.hidden=true;this.menu.remove();this.button.setAttribute('aria-expanded','false');this.button.removeAttribute('aria-activedescendant');this.wrapper.classList.remove('is-open');if(current===this)current=null;
  if(focus&&this.button.isConnected)this.button.focus({preventScroll:true});
  document.dispatchEvent(new CustomEvent('selectmenu:toggle',{detail:{select:this.select,open:false}}));
 }
 choose(index){
  const item=this.items?.[index];if(!item||item.disabled)return;this.select.selectedIndex=index;this.sync();this.close({focus:true});
  this.select.dispatchEvent(new Event('input',{bubbles:true}));this.select.dispatchEvent(new Event('change',{bubbles:true}));
 }
 key(e){
  const key=e.key;if(['ArrowDown','ArrowUp','Home','End','Enter',' ','Escape'].includes(key)){
   e.preventDefault();e.stopPropagation();if(key==='Escape'){this.close({focus:true});return;}
   if(key==='Enter'||key===' '){if(this.opened)this.choose(this.highlight);else this.open();return;}
   if(!this.opened)this.open();const enabled=this.items.filter(o=>!o.disabled).map(o=>o.index);if(!enabled.length)return;
   let position=enabled.indexOf(this.highlight);position=key==='Home'?0:key==='End'?enabled.length-1:(position+(key==='ArrowDown'?1:-1)+enabled.length)%enabled.length;this.activate(enabled[position]);return;
  }
  if(key==='Tab'){this.close();return;}
  if(this.opened&&(key==='ArrowLeft'||key==='ArrowRight')){e.preventDefault();e.stopPropagation();return;}
  if(key.length===1&&!e.ctrlKey&&!e.altKey&&!e.metaKey){
   e.preventDefault();e.stopPropagation();if(!this.opened)this.open();clearTimeout(this.typeTimer);this.typed=(this.typed||'')+key.toLocaleLowerCase();this.typeTimer=setTimeout(()=>this.typed='',650);
   const found=this.items.find(o=>!o.disabled&&o.text.toLocaleLowerCase().startsWith(this.typed));if(found)this.activate(found.index);
  }
 }
}
export function installSelectMenus(root=document){
 function scan(scope){if(scope.matches?.('select')&&!controls.has(scope)){const control=new SelectMenu(scope);controls.set(scope,control);instances.add(control);}for(const select of scope.querySelectorAll?.('select')||[])if(!controls.has(select)){const control=new SelectMenu(select);controls.set(select,control);instances.add(control);}}
 scan(root);if(installed)return;installed=true;
 const observer=new MutationObserver(records=>{const updated=new Set();for(const record of records){const target=record.target.nodeType===1?record.target:record.target.parentElement,select=target?.closest?.('select');if(select)updated.add(select);for(const added of record.addedNodes)if(added.nodeType===1)scan(added);}for(const select of updated)controls.get(select)?.sync();if(current&&!current.select.isConnected)current.close();});
 observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','selected','label','aria-label']});
 document.addEventListener('change',()=>queueMicrotask(()=>{for(const control of instances)control.sync();}),true);
 document.addEventListener('reset',()=>queueMicrotask(()=>{for(const control of instances)control.sync();}),true);
 document.addEventListener('pointerdown',e=>{if(current&&!current.wrapper.contains(e.target)&&!current.menu.contains(e.target))current.close();},true);
 document.addEventListener('focusin',e=>{if(current&&!current.wrapper.contains(e.target)&&!current.menu.contains(e.target))current.close();});
 document.addEventListener('click',e=>{const label=e.target.closest('label');if(label?.control?.tagName==='SELECT'&&controls.has(label.control)&&!e.target.closest('button')){e.preventDefault();const control=controls.get(label.control);control.button.focus();control.open();}});
 document.addEventListener('close',()=>closeSelectMenus(),true);document.addEventListener('fullscreenchange',()=>closeSelectMenus());
 window.addEventListener('scroll',()=>current?.position(),true);window.addEventListener('resize',()=>current?.position());window.addEventListener('popstate',()=>closeSelectMenus());
}
