import {bundledCatalog} from '../server/bundled.js';

import {database,demoEnabled,parseId,send,fail,query} from '../server/core.js';
export default async function handler(req,res){
 res.setHeader('X-Uzcinma-API','embedded-catalog-v2');
 res.setHeader('X-Uzcinma-Catalog-Mode',process.env.TURSO_DATABASE_URL?'database':process.env.CATALOG_MODE==='demo'?'demo':'bundle');
 if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
 try{
  const id=query(req).id;
  const bundled=bundledCatalog();
  if(bundled){
   const n=parseId(id);const movie=bundled.find(m=>m.id===String(n));
   if(!movie)return send(res,404,{error:'Film topilmadi.'});
   if(!movie.sources?.length)return send(res,409,{error:'Bu videoning fayli hali saytga kochirilmagan.'});
   if(process.env.VERCEL&&movie.sources.some(s=>s.url.startsWith('/api/local-media')))return send(res,503,{error:'Bu video uchun tashqi media manbasi hali ulanmagan.'});
   return send(res,200,{kind:'files',variants:movie.sources,subtitles:[]});
  }
  if(demoEnabled()&&String(id).startsWith('demo-')){
   if(id==='demo-bunny')return send(res,200,{kind:'hls',url:'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',demo:true,subtitles:[]});
   return send(res,409,{error:'Bu dizayn namunasi. Filmning video manbasi hali ulanmagan.'});
  }
  const db=database();const n=parseId(id);
  const film=await db.execute({sql:'SELECT id FROM movies WHERE id=? AND deleted=0',args:[n]});if(!film.rows.length)return send(res,404,{error:'Film topilmadi.'});
  const data=await db.execute({sql:'SELECT quality,url FROM sources WHERE movie_id=?',args:[n]});
  const hls=data.rows.find(r=>r.quality==='hls');if(hls)return send(res,200,{kind:'hls',url:hls.url,subtitles:[]});
  const variants=data.rows.map(r=>({quality:r.quality,url:r.url})).sort((a,b)=>Number(a.quality)-Number(b.quality));
  if(!variants.length)return send(res,409,{error:'Film katalogda bor, lekin video manbasi hali tayyor emas.'});
  send(res,200,{kind:'files',variants,subtitles:[]});
 }catch(error){res.setHeader('X-Uzcinma-Error',String(error.code||error.name||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60));fail(res,error);}
}
