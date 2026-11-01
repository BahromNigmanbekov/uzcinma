import {liveHome} from '../server/live-catalog.js';
import {bundledCatalog,publicBundledMovie,bundledHome} from '../server/bundled.js';

import {database,demoEnabled,demoMovies,GENRES,movieDTO,send,fail,query} from '../server/core.js';
export default async function handler(req,res){
 res.setHeader('X-Uzcinma-API','bundle-default-v3');
 res.setHeader('X-Uzcinma-Catalog-Mode',process.env.CATALOG_MODE==='database'?'database':process.env.CATALOG_MODE==='demo'?'demo':'bundle');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return send(res,405,{error:'Method not allowed'});}
 try{
  const p=query(req);const q=String(p.q||'').trim().slice(0,100);const genre=GENRES.includes(p.genre)?p.genre:null;
  const type=['movie','series','animation','anime'].includes(p.type)?p.type:null;
  const rating=Math.max(0,Math.min(10,Number(p.rating)||0));
  const offset=Math.max(0,Math.min(100000,Math.floor(Number(p.offset)||0)));
  const limit=Math.max(1,Math.min(60,Math.floor(Number(p.limit)||24)));
  const sort=['latest','rating','year','year_asc','title','title_desc'].includes(p.sort)?p.sort:'latest';
  const bundled=bundledCatalog();
  if(bundled||demoEnabled()){
   let rows=(bundled||demoMovies()).filter(m=>(!q||(m.title+' '+m.description).toLowerCase().includes(q.toLowerCase()))&&(!genre||m.genres.includes(genre))&&(!type||m.type===type)&&m.rating>=rating);
   if(p.ids!==undefined){const ids=new Set(String(p.ids).split(',').slice(0,60));rows=rows.filter(m=>ids.has(String(m.id)));}
   if(bundled&&sort==='latest')rows.sort((a,b)=>Number(b.id)-Number(a.id));
   if(sort==='rating')rows.sort((a,b)=>b.rating-a.rating);if(sort==='year')rows.sort((a,b)=>b.year-a.year);if(sort==='year_asc')rows.sort((a,b)=>a.year-b.year);if(sort==='title')rows.sort((a,b)=>a.title.localeCompare(b.title));if(sort==='title_desc')rows.sort((a,b)=>b.title.localeCompare(a.title));
   return send(res,200,{mode:bundled?'live':'demo',provider:bundled?'bot-export':'demo',home:bundledHome(bundled),movies:rows.slice(offset,offset+limit).map(publicBundledMovie),total:rows.length,has_more:offset+limit<rows.length},true);
  }
  const clauses=['m.deleted=0'];const args=[];
  const ids=p.ids===undefined?null:String(p.ids).split(',').filter(id=>/^[1-9]\d{0,14}$/.test(id)).slice(0,60).map(Number);
  if(ids){if(!ids.length)return send(res,200,{mode:'live',movies:[],total:0,has_more:false},true);clauses.push('m.id IN ('+ids.map(()=>'?').join(',')+')');args.push(...ids);}
  if(q){clauses.push('(m.title LIKE ? OR m.description LIKE ?)');args.push('%'+q+'%','%'+q+'%');}
  if(genre){clauses.push('EXISTS(SELECT 1 FROM json_each(m.genres) WHERE value=?)');args.push(genre);}
  if(type){clauses.push('m.type=?');args.push(type);}
  if(rating){clauses.push('m.rating>=?');args.push(rating);}
  const where=clauses.join(' AND ');
  const order={latest:'m.created_at DESC,m.id DESC',rating:'m.rating DESC,m.id DESC',year:'m.year DESC,m.id DESC',year_asc:'m.year ASC,m.id ASC',title_desc:'m.title DESC,m.id DESC',title:'m.title ASC,m.id ASC'}[sort];
  const db=database();
  const [rows,count]=await db.batch([{sql:'SELECT m.*,EXISTS(SELECT 1 FROM sources s WHERE s.movie_id=m.id) AS available FROM movies m WHERE '+where+' ORDER BY '+order+' LIMIT ? OFFSET ?',args:[...args,limit,offset]},{sql:'SELECT COUNT(*) AS count FROM movies m WHERE '+where,args}], 'read');
  const total=Number(count.rows[0].count);send(res,200,{mode:'live',provider:'telegram-live',home:await liveHome(db),movies:rows.rows.map(movieDTO),total,has_more:offset+limit<total},5);
 }catch(error){res.setHeader('X-Uzcinma-Error',String(error.code||error.name||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60));fail(res,error);}
}
