import {TelegramClient,Api} from 'teleproto';
import {telegramMediaReady} from './core.js';
import {StringSession} from 'teleproto/sessions';
import {Logger} from 'teleproto/extensions';
let connection;
const documents=new Map(),chunks=new Map(),pending=new Map();
const CACHE_BYTES=32*1024*1024;
let cachedBytes=0;
export const telegramMediaConfigured=telegramMediaReady;
async function client(){
 if(!telegramMediaConfigured())throw Object.assign(Error('Telegram media is not configured'),{status:503});
 if(!connection)connection=(async()=>{
  const value=new TelegramClient(new StringSession(''),Number(process.env.API_ID),process.env.API_HASH,{
   baseLogger:new Logger('none'),connectionRetries:2,requestRetries:1,floodSleepThreshold:0,
   maxConcurrentDownloads:8,downloadPool:{poolSize:2,workers:4,requestDeadlineMs:15000}
  });
  try{await value.start({botAuthToken:process.env.BOT_TOKEN});return value;}
  catch(error){await value.destroy().catch(()=>{});throw error;}
 })().catch(error=>{connection=undefined;throw error;});
 return connection;
}
async function documentFor(row,refresh=false){
 const key=String(row.file_unique_id||row.id),cached=documents.get(key);
 if(!refresh&&cached&&cached.until>Date.now())return cached.document;
 const api=await client();
 const result=await api.invoke(new Api.messages.GetMessages({id:[new Api.InputMessageID({id:Number(row.source_message_id)})]}));
 const document=result.messages.find(message=>message.id===Number(row.source_message_id))?.media?.document;
 if(!document||document.className!=='Document')throw Object.assign(Error('Telegram source message is unavailable'),{status:404});
 if(Number(document.size)!==Number(row.file_size))throw Object.assign(Error('Telegram file metadata changed'),{status:409});
 documents.delete(key);documents.set(key,{document,until:Date.now()+5*60*1000});
 if(documents.size>256)documents.delete(documents.keys().next().value);
 return document;
}
export async function readTelegramRange(row,start,length){
 const key=[row.file_unique_id,row.source_message_id,start,length].join(':');
 const cached=chunks.get(key);
 if(cached){chunks.delete(key);chunks.set(key,cached);return cached;}
 if(pending.has(key))return pending.get(key);
 const task=(async()=>{
  const api=await client();
  for(let attempt=0;attempt<2;attempt++){
   try{
    const document=await documentFor(row,attempt>0),parts=[];
    let size=0;
    for await(const chunk of api.iterDownload(document,{offset:start,limit:length,requestSize:512*1024})){
     const part=Buffer.from(chunk).subarray(0,length-size);parts.push(part);size+=part.length;
     if(size>=length)break;
    }
    if(size!==length)throw Error('Incomplete Telegram range');
    const body=Buffer.concat(parts,size);
    chunks.set(key,body);cachedBytes+=body.length;
    while(cachedBytes>CACHE_BYTES&&chunks.size){const oldest=chunks.keys().next().value;cachedBytes-=chunks.get(oldest).length;chunks.delete(oldest);}
    return body;
   }catch(error){if(attempt===0&&/FILE_REFERENCE/.test(error.errorMessage||''))continue;throw error;}
  }
 })();
 pending.set(key,task);
 try{return await task;}finally{pending.delete(key);}
}
