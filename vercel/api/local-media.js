import {streamMediaFile} from '../server/serve-media.js';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {bundledCatalog} from '../server/bundled.js';
import {parseId,query,send} from '../server/core.js';
export default async function handler(req,res){
 if(process.env.VERCEL)return send(res,503,{error:'Bu video uchun tashqi media manbasi hali ulanmagan.'});
 if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Method not allowed'});
 try{
  const id=String(parseId(query(req).id));const movie=bundledCatalog()?.find(m=>m.id===id);
  if(!movie||!movie.available||!/^[a-f0-9]{64}$/.test(movie.cache_key||''))return send(res,404,{error:'Video topilmadi.'});
  const root=fileURLToPath(new URL('../../.site-cache/',import.meta.url));const path=join(root,movie.cache_key);
  const mime=['video/mp4','video/webm','video/quicktime'].includes(movie.media_type)?movie.media_type:'video/mp4';
  return streamMediaFile(req,res,path,mime);
 }catch(error){if(!res.headersSent)return send(res,error.status||404,{error:'Video topilmadi.'});res.destroy();}
}
