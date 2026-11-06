import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {query} from '../server/core.js';
import {createSEORepository} from '../server/seo-content.js';
import {renderDocument,homeBody,titleBody,errorBody,sitemapIndex,pagesSitemap,titleSitemap} from '../server/seo-render.js';
import {homeSEO,movieSEO,SITE_ORIGIN} from '../shared/seo.js';
let shell;
export function template(){return shell??=readFileSync(join(process.cwd(),'index.html'),'utf8').replace('src="/src/main.js"','src="/app-client.js"').replace('</head>','<link rel="stylesheet" href="/app-client.css"></head>');}
export function createSEOHandler({repo=createSEORepository(),getTemplate=template}={}){
 return async function handler(req,res){
  const p=query(req),view=p.view||'home';
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');res.statusCode=405;return res.end();}
  const finish=(status,type,body,cache=60)=>{res.statusCode=status;res.setHeader('Content-Type',type+'; charset=utf-8');res.setHeader('Cache-Control',status===200?'public, s-maxage='+cache+', stale-while-revalidate=300':'no-store');return res.end(req.method==='HEAD'?undefined:body);};
  try{
   if(view==='sitemap')return finish(200,'application/xml',sitemapIndex(await repo.count()));
   if(view==='pages')return finish(200,'application/xml',pagesSitemap(await repo.count()));
   if(view==='titles'){
    const page=Number(p.page);if(!Number.isInteger(page)||page<1||page>100000)throw Object.assign(Error('Not found'),{status:404});
    const rows=await repo.roots((page-1)*1000,1000);if(!rows.length)throw Object.assign(Error('Not found'),{status:404});
    return finish(200,'application/xml',titleSitemap(rows));
   }
   const settings=await repo.settings();
   if(view==='title'){
    if(!/^[1-9]\d{0,14}$/.test(String(p.id)))throw Object.assign(Error('Not found'),{status:404});
    const params={};for(const key of ['season','episode'])if(p[key]!==undefined)params[key]=p[key];
    const data=await repo.title(p.id,params);
    if(String(data.movie.id)!==String(p.id)){
     const q=new URLSearchParams();if(data.current_episode){q.set('season',data.current_episode.season_number);q.set('episode',data.current_episode.id);}
     res.statusCode=308;res.setHeader('Location',SITE_ORIGIN+'/title/'+data.movie.id+(q.size?'?'+q:''));res.setHeader('Cache-Control','no-store');return res.end();
    }
    const meta=movieSEO(data.movie,{settings,credits:data.credits,modified:data.modified});
    return finish(200,'text/html',renderDocument(getTemplate(),{meta,settings,body:titleBody(data,{settings}),preload:meta.image,bootstrap:{settings,title:data,requested_id:p.id,params}}),30);
   }
   if(view!=='home')throw Object.assign(Error('Not found'),{status:404});
   const page=Number(p.page||1);if(!Number.isInteger(page)||page<1||page>100000)throw Object.assign(Error('Not found'),{status:404});
   const total=await repo.count();if(page>1&&(page-1)*12>=total)throw Object.assign(Error('Not found'),{status:404});
   const offset=(page-1)*12,[rows,home]=await Promise.all([repo.roots(offset,60),repo.home()]),movies=rows.map(r=>r.movie),first=movies.slice(0,12);
   const catalog={mode:repo.mode||'live',provider:repo.provider||'telegram-live',movies,total,home,has_more:offset+60<total};
   const meta=homeSEO({page,movies:first,settings}),featured=home?.hero?.[0]||first[0];
   return finish(200,'text/html',renderDocument(getTemplate(),{meta,settings,body:homeBody(first,{page,total,featured,settings}),preload:featured?.backdrop,bootstrap:{catalog,offset,settings}}),30);
  }catch(error){
   const status=error.status===404||error.status===400?404:503;res.setHeader('X-Uzcinma-SEO-Error',String(error.code||error.name||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,50));res.setHeader('X-Robots-Tag','noindex');if(status===503)res.setHeader('Retry-After','60');
   const meta={title:(status===404?'Sahifa topilmadi':'Vaqtincha mavjud emas')+' | UZCINMA',description:'UZCINMA kino katalogi',canonical:SITE_ORIGIN+'/',type:'website',image:SITE_ORIGIN+'/assets/uzcinma-banner-v2.png',imageAlt:'UZCINMA',graph:[]};
   try{return finish(status,'text/html',renderDocument(getTemplate(),{meta,body:errorBody(status),noindex:true,error:true}));}catch{return finish(503,'text/plain','Sahifani hozir ochib bo‘lmadi.');}
  }
 };
}
export default createSEOHandler();
