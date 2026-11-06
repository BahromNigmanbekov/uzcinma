import {homeSEO,movieSEO,DEFAULT_SEO} from '../shared/seo.js';
let initial;try{initial=JSON.parse(document.getElementById('initial-data')?.textContent||'null');}catch{}
let usedTitle=false,usedCatalog=false;
export const initialData=initial;
export const seoSettings=initial?.settings||DEFAULT_SEO;
function meta(name,content,property=false){let n=document.head.querySelector('meta['+(property?'property':'name')+'="'+name+'"]');if(!n){n=document.createElement('meta');n.setAttribute(property?'property':'name',name);document.head.append(n);}n.content=content;}
export function setSEO(data,{noindex=false}={}){
 document.title=data.title;meta('description',data.description);meta('robots',noindex?'noindex,follow':'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
 let link=document.head.querySelector('link[rel=canonical]');if(!link){link=document.createElement('link');link.rel='canonical';document.head.append(link);}link.href=data.canonical;
 for(const [key,value]of Object.entries({'og:title':data.title,'og:description':data.description,'og:url':data.canonical,'og:image':data.image,'og:image:alt':data.imageAlt,'og:type':data.type,'og:site_name':'UZCINMA','og:locale':'uz_UZ'}))meta(key,value,true);
 for(const [key,value]of Object.entries({'twitter:card':'summary_large_image','twitter:title':data.title,'twitter:description':data.description,'twitter:image':data.image,'twitter:image:alt':data.imageAlt}))meta(key,value);
 let schema=document.getElementById('seo-schema');if(!schema){schema=document.createElement('script');schema.id='seo-schema';schema.type='application/ld+json';document.head.append(schema);}schema.textContent=JSON.stringify({'@context':'https://schema.org','@graph':data.graph});
}
let homeItems=[];
export function updateHomeSEO(movies){if(movies)homeItems=movies;setSEO(homeSEO({page:catalogPage(),movies:homeItems,settings:seoSettings}));}
export function updateTitleSEO(data){setSEO(movieSEO(data.movie,{credits:data.credits,modified:data.modified,settings:seoSettings}));}
export function catalogPage(){const n=Number(new URLSearchParams(location.search).get('page')||1);return location.pathname==='/'&&Number.isInteger(n)&&n>0?Math.min(n,100000):1;}
export function takeInitialCatalog(params){
 if(usedCatalog||!initial?.catalog||Number(params.get('offset')||0)!==initial.offset||params.get('q')||params.get('genre')||params.get('type')||Number(params.get('rating')||0)||params.get('sort')!=='latest'||params.has('ids'))return null;
 usedCatalog=true;return {...initial.catalog,movies:initial.catalog.movies.slice(0,12),has_more:initial.offset+12<initial.catalog.total};
}
export function takeInitialTitle(id,params){
 if(usedTitle||!initial?.title||String(id)!==String(initial.requested_id))return null;
 for(const key of ['season','episode'])if(String(params[key]||'')!==String(initial.params?.[key]||''))return null;
 usedTitle=true;return initial.title;
}
export function finishServerRender(){
 const content=document.getElementById('server-content');content?.remove();document.body.classList.remove('server-rendered');document.getElementById('initial-data')?.remove();
}
export function ordinaryClick(event){return event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey;}
