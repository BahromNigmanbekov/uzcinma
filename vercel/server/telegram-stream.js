import {createHash} from 'node:crypto';
import {parseId,query,send} from './core.js';
export const MAX_VIDEO_RANGE=2*1024*1024;
export function videoRange(header,size,maximum=MAX_VIDEO_RANGE){
 if(!Number.isSafeInteger(size)||size<1)throw Object.assign(Error('Invalid file size'),{status:409});
 if(!header)return {start:0,end:Math.min(size,maximum)-1};
 const match=/^bytes=(\d*)-(\d*)$/.exec(String(header));
 if(!match||(!match[1]&&!match[2]))throw Object.assign(Error('Invalid range'),{status:416});
 let start,end;
 if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<1)throw Object.assign(Error('Invalid suffix'),{status:416});start=Math.max(0,size-suffix);end=size-1;}
 else{start=Number(match[1]);end=match[2]?Number(match[2]):size-1;}
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)throw Object.assign(Error('Unsatisfiable range'),{status:416});
 return {start,end:Math.min(end,size-1,start+maximum-1)};
}
export function createTelegramStreamHandler({findMovie,readRange,configured}){
 return async function handler(req,res){
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return send(res,405,{error:'Method not allowed'});}
  let row;
  try{
   const id=parseId(query(req).id);row=await findMovie(id);
   if(!row||row.deleted)return send(res,404,{error:'Film topilmadi.'});
   if(!configured()||!row.source_message_id)return send(res,503,{error:'Telegram video ulanishi hali sozlanmagan.'});
   const size=Number(row.file_size);
   const range=videoRange(req.headers?.range,size);
   const length=range.end-range.start+1;
   const mime=['video/mp4','video/webm','video/quicktime','video/x-m4v'].includes(row.mime_type)?row.mime_type:'video/mp4';
   const body=req.method==='HEAD'?null:await readRange(row,range.start,length);
   if(body&&body.length!==length)throw Error('Incomplete video range');
   res.statusCode=req.method==='HEAD'&&!req.headers?.range?200:206;
   res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Type',mime);
   res.setHeader('Content-Length',req.method==='HEAD'&&!req.headers?.range?size:length);
   if(res.statusCode===206)res.setHeader('Content-Range','bytes '+range.start+'-'+range.end+'/'+size);
   res.setHeader('Cache-Control','public, max-age=3600, s-maxage=86400');
   res.setHeader('Vary','Range');
   res.setHeader('ETag','"'+createHash('sha256').update(String(row.file_unique_id||id)).digest('hex')+'"');
   res.setHeader('X-Content-Type-Options','nosniff');
   res.end(body||undefined);
  }catch(error){
   if(error.status===416){res.setHeader('Content-Range','bytes */'+Number(row?.file_size||0));return send(res,416,{error:'Video oraligi topilmadi.'});}
   if(error.status===400)return send(res,400,{error:'Film ID notogri.'});
   res.setHeader('Retry-After',String(Math.min(60,Math.max(3,Number(error.seconds)||3))));
   return send(res,error.status||503,{error:error.status===404?'Telegramdagi video xabari topilmadi.':'Videoga ulanib bolmadi. Bir ozdan qayta urinib koring.'});
  }
 };
}
