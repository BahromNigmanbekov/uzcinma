import {authorize,database,parseId,publicURL,QUALITIES,send,fail} from '../server/core.js';
import {cloudStatus,initializeCatalog} from '../server/cloud-admin.js';
export default async function handler(req,res){
 if(!authorize(req.headers.authorization,'Bearer '+(process.env.ADMIN_API_SECRET||''))||!process.env.ADMIN_API_SECRET)return send(res,401,{error:'Unauthorized'});
 try{
  if(req.method==='GET')return send(res,200,{...await cloudStatus(database()),telegram_configured:Boolean(process.env.BOT_TOKEN&&process.env.API_ID&&process.env.API_HASH),webhook_configured:Boolean(process.env.TELEGRAM_WEBHOOK_SECRET)});
  if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(body.operation==='initialize')return send(res,200,await initializeCatalog(database(),body));
  const id=parseId(body.movie_id),quality=body.quality,url=publicURL(body.url);
  if(!QUALITIES.includes(quality)||!url)return send(res,400,{error:'Invalid source'});
  const db=database();const found=await db.execute({sql:'SELECT id FROM movies WHERE id=?',args:[id]});if(!found.rows.length)return send(res,404,{error:'Movie not found'});
  await db.execute({sql:'INSERT INTO sources(movie_id,quality,url) VALUES(?,?,?) ON CONFLICT(movie_id,quality) DO UPDATE SET url=excluded.url',args:[id,quality,url]});send(res,200,{ok:true});
 }catch(error){
  const code=String(error.code||error.name||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60);
  res.setHeader('X-Uzcinma-Error',code);
  send(res,error.status||503,{error:error.status&&[400,409].includes(error.status)?error.message:'Cloud database is not ready.',code});
 }
}
