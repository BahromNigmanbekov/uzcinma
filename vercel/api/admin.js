
import {authorize,database,parseId,publicURL,QUALITIES,send,fail} from '../server/core.js';
export default async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 if(!authorize(req.headers.authorization,'Bearer '+(process.env.ADMIN_API_SECRET||''))||!process.env.ADMIN_API_SECRET)return send(res,401,{error:'Unauthorized'});
 try{
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  const id=parseId(body.movie_id),quality=body.quality,url=publicURL(body.url);
  if(!QUALITIES.includes(quality)||!url)return send(res,400,{error:'Invalid source'});
  const db=database();const found=await db.execute({sql:'SELECT id FROM movies WHERE id=?',args:[id]});if(!found.rows.length)return send(res,404,{error:'Movie not found'});
  await db.execute({sql:'INSERT INTO sources(movie_id,quality,url) VALUES(?,?,?) ON CONFLICT(movie_id,quality) DO UPDATE SET url=excluded.url',args:[id,quality,url]});send(res,200,{ok:true});
 }catch(error){fail(res,error);}
}
