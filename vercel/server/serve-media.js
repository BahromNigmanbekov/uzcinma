import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {join} from 'node:path';
function unavailable(res,status,message){
 res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error:message}));
}
export async function streamMediaFile(req,res,path,mime){
 if(!['GET','HEAD'].includes(req.method))return unavailable(res,405,'Method not allowed');
 let info;
 try{info=await stat(path);}catch{return unavailable(res,404,'Media topilmadi.');}
 if(!info.isFile())return unavailable(res,404,'Media topilmadi.');
 const size=info.size;let start=0,end=size-1,partial=false;
 const invalid=()=>{res.statusCode=416;res.setHeader('Content-Range','bytes */'+size);res.end();};
 if(req.headers.range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if(!match||(!match[1]&&!match[2]))return invalid();
  if(match[1]){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;}
  else{const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return invalid();start=Math.max(0,size-suffix);}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size)return invalid();
  partial=true;
 }
 res.statusCode=partial?206:200;res.setHeader('Content-Type',mime);res.setHeader('Accept-Ranges','bytes');
 res.setHeader('Content-Length',String(partial?end-start+1:size));res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(partial)res.setHeader('Content-Range','bytes '+start+'-'+end+'/'+size);
 if(req.method==='HEAD'||!size)return res.end();
 const stream=createReadStream(path,{start,end});res.on('close',()=>stream.destroy());stream.on('error',()=>res.destroy());stream.pipe(res);
}
const mimeTypes={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',svg:'image/svg+xml',mp4:'video/mp4',m4v:'video/mp4',webm:'video/webm',mov:'video/quicktime',m3u8:'application/vnd.apple.mpegurl',ts:'video/mp2t'};
export async function servePublicMedia(req,res,directory){
 let name;
 try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice('/media/'.length));}
 catch{return unavailable(res,400,'Invalid media name');}
 const match=/^[a-z0-9-]+\.(jpg|jpeg|png|webp|svg|mp4|m4v|webm|mov|m3u8|ts)$/.exec(name);
 if(!match)return unavailable(res,404,'Media topilmadi.');
 return streamMediaFile(req,res,join(directory,name),mimeTypes[match[1]]);
}
