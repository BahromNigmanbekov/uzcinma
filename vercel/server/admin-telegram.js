import http from 'node:http';
import https from 'node:https';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
export async function uploadToTelegram({base,token,chatId,kind,path,data,filename,mime,caption,progress=()=>{},signal}){
 const video=kind==='video'&&/\.(mp4|m4v)$/i.test(filename);
 const method=kind==='video'?(video?'sendVideo':'sendDocument'):'sendPhoto',field=kind==='video'?(video?'video':'document'):'photo';
 const boundary='uzcinma-'+randomBytes(18).toString('hex');
 const fields={chat_id:String(chatId),caption:caption.slice(0,1024),...(video?{supports_streaming:'true'}:{})};
 const lead=Object.entries(fields).map(([key,value])=>'--'+boundary+'\r\nContent-Disposition: form-data; name="'+key+'"\r\n\r\n'+value+'\r\n').join('');
 const safeName=filename.replace(/[\r\n"\\]/g,'_').slice(0,150)||'upload.bin';
 const before=Buffer.from(lead+'--'+boundary+'\r\nContent-Disposition: form-data; name="'+field+'"; filename="'+safeName+'"\r\nContent-Type: '+mime+'\r\n\r\n');
 const after=Buffer.from('\r\n--'+boundary+'--\r\n');const size=data?data.length:(await stat(path)).size;
 const url=new URL(base.replace(/\/$/,'')+'/bot'+token+'/'+method);
 if(!['https:','http:'].includes(url.protocol))throw Error('Bot API manzili notogri.');
 return new Promise((resolve,reject)=>{
  const transport=url.protocol==='https:'?https:http;
  const request=transport.request(url,{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary='+boundary,'Content-Length':before.length+size+after.length},signal},response=>{
   const chunks=[];let bytes=0;
   response.on('data',chunk=>{bytes+=chunk.length;if(bytes>1024*1024){response.destroy();return reject(Error('Telegram javobi juda katta.'));}chunks.push(chunk);});
   response.on('error',()=>reject(Error('Telegram javobi uzildi. Qayta urinib koring.')));
   response.on('end',()=>{
    let data;try{data=JSON.parse(Buffer.concat(chunks).toString());}catch{return reject(Error('Telegram javobini oqib bolmadi.'));}
    if(!data.ok){const description=String(data.description||'Telegram faylni qabul qilmadi.').replaceAll(token,'[hidden]').slice(0,250);
    const hint=/file is too big/i.test(description)?'Telegram ushbu fayl hajmini qabul qilmadi. ':/too many requests/i.test(description)?'Telegram kutishni soradi. Keyinroq qayta urinib koring. ':/forbidden/i.test(description)?'Botga yozishga ruxsat yoq. Telegramda botni ochib /start yuboring. ':'';
    const error=Error(hint+description);error.retryAfter=data.parameters?.retry_after;reject(error);request.destroy();return;}
    resolve(data.result);
   });
  });
  request.setTimeout(15*60*1000,()=>request.destroy(Error('Telegramga yuborish vaqti tugadi.')));
  request.on('error',error=>reject(Error(error.name==='AbortError'?'Yuklash toxtatildi.':'Telegram bilan ulanish uzildi. Qayta urinib koring.')));
  async function* body(){
   yield before;let sent=0;
   for await(const chunk of (data?Readable.from((function*(){for(let offset=0;offset<data.length;offset+=65536)yield data.subarray(offset,offset+65536);})()):createReadStream(path))){sent+=chunk.length;progress(sent,size);yield chunk;}
   yield after;
  }
  pipeline(Readable.from(body()),request,{signal}).catch(()=>reject(Error('Faylni Telegramga uzatib bolmadi.')));

 });
}
