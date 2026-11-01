
import {database,parseId,telegram,send,fail,query} from '../server/core.js';
export default async function handler(req,res){
 if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
 try{
  const params=query(req),id=parseId(params.id);const column=params.kind==='banner'?'banner_file_id':'poster_file_id';
  const result=await database().execute({sql:'SELECT '+column+' AS image_file_id FROM movies WHERE id=? AND deleted=0',args:[id]});
  const fileId=result.rows[0]?.image_file_id;if(!fileId)return send(res,404,{error:'Poster topilmadi'});
  const file=await telegram('getFile',{file_id:fileId});
  if(file.file_size>2*1024*1024)return send(res,413,{error:'Poster juda katta'});
  if(!/^[a-zA-Z0-9_\/.-]+$/.test(file.file_path)||file.file_path.includes('..'))throw Error('Invalid file path');
  const upstream=await fetch('https://api.telegram.org/file/bot'+process.env.BOT_TOKEN+'/'+file.file_path,{signal:AbortSignal.timeout(8000)});
  if(!upstream.ok)throw Error('Poster unavailable');
  if(Number(upstream.headers.get('content-length'))>2*1024*1024)return send(res,413,{error:'Poster juda katta'});
  const body=Buffer.from(await upstream.arrayBuffer());if(body.length>2*1024*1024)return send(res,413,{error:'Poster juda katta'});
  res.setHeader('Content-Type','image/jpeg');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');res.end(body);
 }catch(error){fail(res,error);}
}
