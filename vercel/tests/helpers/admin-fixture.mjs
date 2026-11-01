import {createClient} from '@libsql/client';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {createAdminService} from '../../server/admin-service.js';
export async function adminFixture({uploadDelay=0,failUploads=0,failRefreshes=0}={}){
 const directory=await mkdtemp(join(tmpdir(),'uzcinma-admin-test-')),project=join(directory,'project'),root=join(directory,'bot');
 await mkdir(join(project,'server'),{recursive:true});await mkdir(root,{recursive:true});
 const db=createClient({url:'file::memory:'});
 await db.execute("CREATE TABLE movies(id INTEGER PRIMARY KEY AUTOINCREMENT,file_unique_id TEXT UNIQUE NOT NULL,file_id TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,file_name TEXT,mime_type TEXT,file_size INTEGER,duration INTEGER,source_chat_id INTEGER NOT NULL,source_message_id INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,deleted INTEGER NOT NULL DEFAULT 0,poster_file_id TEXT,poster_unique_id TEXT,banner_file_id TEXT,banner_unique_id TEXT)");
 await db.execute("INSERT INTO movies(id,file_unique_id,file_id,title,description,file_name,mime_type,file_size,duration,source_chat_id,source_message_id) VALUES(1,'existing-unique','private-existing','Mavjud film','','existing.mp4','video/mp4',1000,12,123,1)");
 const calls=[];let uploadsFailed=0,refreshesFailed=0;
 const telegram=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,result:{username:'uzcinma_test_bot'}}));});
 await new Promise(resolve=>telegram.listen(0,'127.0.0.1',resolve));
 let service;const server=createServer((req,res)=>service.handle(req,res));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const refresh=async()=>{
  if(calls.length&&refreshesFailed<failRefreshes){refreshesFailed++;throw Error('Catalog refresh test failure');}
  const rows=(await db.execute('SELECT * FROM movies WHERE deleted=0 ORDER BY id DESC')).rows;
  const settings={};for(const r of (await db.execute("SELECT key,value FROM site_settings")).rows)settings[r.key]=JSON.parse(r.value);
  await writeFile(join(project,'server/bot-catalog.json'),JSON.stringify({version:1,home:settings,movies:rows.map(r=>({id:String(r.id),title:r.title,description:r.description,genres:JSON.parse(r.genres||'[]'),type:r.type,poster:'/assets/placeholder.svg',backdrop:'/assets/placeholder.svg',available:true,sources:[],is_demo:false}))}));
 };
 service=await createAdminService({project,botRoot:root,dataDirectory:join(directory,'private'),cache:join(directory,'cache'),db,allowedOrigins:[origin],config:{BOT_TOKEN:'test-token-not-real',ADMIN_USER_ID:'123',BOT_API_BASE:'http://127.0.0.1:'+telegram.address().port},transport:async options=>{
  const transferSize=(await stat(options.path)).size;calls.push({kind:options.kind,size:transferSize,caption:options.caption});
  if(uploadsFailed<failUploads){uploadsFailed++;throw Error('Telegram test rejection');}
  for(let step=1;step<=8;step++){if(uploadDelay)await new Promise(r=>setTimeout(r,uploadDelay));if(options.signal?.aborted)throw Error('Yuklash toxtatildi.');options.progress(Math.floor(transferSize*step/8),transferSize);}
  const media={file_id:'private-'+options.kind+'-'+calls.length,file_unique_id:'unique-'+options.kind+'-'+(options.kind==='video'?'same':'image'),duration:12};
  return {message_id:100+calls.length,chat:{id:123},...(options.kind==='video'?{video:media}:{photo:[media]})};
 },refresh});
 // Seed available statuses without consuming the configured refresh failure.
 const currentFailures=refreshesFailed;refreshesFailed=failRefreshes;await refresh();refreshesFailed=currentFailures;
 let cookie='',csrf='';
 async function request(path,{method='GET',body,raw,authenticated=true,withCsrf=true,requestOrigin=origin}={}){
  const headers={Origin:requestOrigin};if(authenticated&&cookie)headers.Cookie=cookie;if(withCsrf&&csrf)headers['X-CSRF-Token']=csrf;
  if(body)headers['Content-Type']='application/json';if(raw)headers['Content-Type']='application/octet-stream';
  const response=await fetch(origin+'/api/manage'+path,{method,headers,body:raw|| (body?JSON.stringify(body):undefined)});
  const data=await response.json();const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];if(data.csrf)csrf=data.csrf;
  return {status:response.status,data};
 }
 async function login(){return request('/setup',{method:'POST',body:{password:'test-password-123'}});}
 async function waitJob(jobId){
  for(let i=0;i<200;i++){const result=await request('/jobs/'+jobId);if(['done','error'].includes(result.data.job.stage)){await service.idle();return result.data.job;}await new Promise(r=>setTimeout(r,20));}
  throw Error('Test job timed out');
 }
 return {directory,project,root,db,origin,service,calls,request,login,waitJob,close:async()=>{
  await service.idle();service.close();db.close();await new Promise(r=>server.close(r));await new Promise(r=>telegram.close(r));
  if(dirname(directory)===tmpdir()&&basename(directory).startsWith('uzcinma-admin-test-'))await rm(directory,{recursive:true,force:true});
 }};
}
