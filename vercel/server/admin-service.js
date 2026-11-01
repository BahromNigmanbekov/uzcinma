import {validateMovie} from './movie-validation.js';
export {validateMovie} from './movie-validation.js';
import {createClient} from '@libsql/client';
import {randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {readFileSync,existsSync,createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile,rename,copyFile,unlink,stat} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {spawn} from 'node:child_process';
import {GENRES} from './core.js';
import {uploadToTelegram} from './admin-telegram.js';
const projectDefault=fileURLToPath(new URL('../',import.meta.url));
const fault=(message,status=400)=>Object.assign(Error(message),{status});
const id=value=>{if(!/^[1-9]\d{0,14}$/.test(String(value)))throw fault('Film ID notogri.');return Number(value);};
function environment(path){
 if(!existsSync(path))return {};
 return Object.fromEntries(readFileSync(path,'utf8').split(/\r?\n/).filter(line=>line.includes('=')&&!line.trim().startsWith('#')).map(line=>{const n=line.indexOf('=');return [line.slice(0,n).trim(),line.slice(n+1).trim().replace(/^(['"])(.*)\1$/,'$2')];}));
}
async function jsonBody(req){
 const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>65536)throw fault('Sorov juda katta.',413);chunks.push(chunk);}
 try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw fault('JSON notogri.');}
}
const send=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data));};
export async function createAdminService(options={}){
 const project=resolve(options.project||projectDefault),root=resolve(options.botRoot||join(project,'..'));
 const privateRoot=resolve(options.dataDirectory||join(project,'.private/admin'));
 const jobRoot=join(privateRoot,'uploads'),cache=resolve(options.cache||join(root,'.site-cache'));
 await mkdir(jobRoot,{recursive:true});await mkdir(cache,{recursive:true});
 const config={...environment(join(root,'.env')),...environment(join(project,'.env')),...process.env,...options.config};
 const token=config.BOT_TOKEN||'',chatId=config.ADMIN_USER_ID||'',base=config.BOT_API_BASE||'https://api.telegram.org';
 const db=options.db||createClient({url:pathToFileURL(options.database||join(root,'movies.sqlite3')).href});
 const columns=new Set((await db.execute('PRAGMA table_info(movies)')).rows.map(r=>r.name));
 if(!columns.has('id'))throw fault('Bot bazasi topilmadi. Avval botni ishga tushiring.',503);
 for(const [name,definition]of Object.entries({genres:"TEXT NOT NULL DEFAULT '[]'",type:"TEXT NOT NULL DEFAULT 'movie'",year:'INTEGER',rating:'REAL NOT NULL DEFAULT 0',updated_at:'INTEGER NOT NULL DEFAULT 0'})){
  if(!columns.has(name))await db.execute('ALTER TABLE movies ADD COLUMN '+name+' '+definition);
 }
 await db.execute('CREATE TABLE IF NOT EXISTS site_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 const authPath=join(privateRoot,'auth.json');let auth=existsSync(authPath)?JSON.parse(readFileSync(authPath,'utf8')):null;
 if(config.ADMIN_PASSWORD){
  if(String(config.ADMIN_PASSWORD).length<8)throw fault('ADMIN_PASSWORD kamida 8 belgidan iborat bolsin.',503);
  const salt=randomBytes(16).toString('hex');auth={salt,hash:scryptSync(String(config.ADMIN_PASSWORD),salt,64).toString('hex')};await atomic(authPath,auth);
 }
 const sessions=new Map(),jobs=new Map(),failures=[];let queue=Promise.resolve(),refreshQueue=Promise.resolve();
 const allowed=new Set(['http://localhost:5176','http://127.0.0.1:5176',...(options.allowedOrigins||[]),...(config.APP_ORIGIN?[config.APP_ORIGIN.replace(/\/$/,'')]:[]),...(config.ADMIN_ORIGIN?[config.ADMIN_ORIGIN.replace(/\/$/,'')]:[])]);
 const transport=options.transport||uploadToTelegram;
 async function atomic(path,data){const temporary=path+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(data,null,2));await rename(temporary,path);}
 function viewJob(job){return {accepted_by_telegram:Boolean(job.telegramResult),id:job.id,kind:job.kind,filename:job.filename,size:job.size,received:job.received||0,sent:job.sent||0,stage:job.stage,error:job.error||null,movie_id:job.movieId||null,title:job.metadata?.title||'',created:job.created,can_retry:job.stage==='error'&&job.received===job.size};}
 async function persist(job){const {controller,...data}=job;await atomic(join(jobRoot,job.id,'job.json'),data);}
 function current(req){const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('uzcinma_admin='));const key=cookie?.slice('uzcinma_admin='.length);const value=sessions.get(key);if(value&&value.expires>Date.now())return {key,...value};if(key)sessions.delete(key);return null;}
 function origin(req){if(!allowed.has(req.headers.origin))throw fault('Bu manbadan sorovga ruxsat yoq.',403);}
 function requireSession(req,write=false){const session=current(req);if(!session)throw fault('Admin panelga kiring.',401);if(write){origin(req);if(req.headers['x-csrf-token']!==session.csrf)throw fault('Sahifani yangilab qayta urinib koring.',403);}return session;}
 function issue(req,res){const key=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');sessions.set(key,{csrf,expires:Date.now()+8*3600000});const secure=req.headers['x-forwarded-proto']==='https'||String(config.ADMIN_ORIGIN||'').startsWith('https://');res.setHeader('Set-Cookie','uzcinma_admin='+key+'; HttpOnly; SameSite=Strict; Path=/api/manage; Max-Age=28800'+(secure?'; Secure':''));return csrf;}
 async function refresh(){
  if(options.refresh)return options.refresh();
  refreshQueue=refreshQueue.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{
   const child=spawn(config.PYTHON||(process.platform==='win32'?'python':'python3'),[join(project,'scripts/sync-bot-videos.py')],{cwd:project,stdio:['ignore','ignore','ignore'],windowsHide:true});
   child.on('error',()=>reject(fault('Katalogni yangilab bolmadi.',503)));child.on('exit',code=>code===0?resolve():reject(fault('Katalogni yangilab bolmadi.',503)));
  }));return refreshQueue;
 }
 async function settings(){const rows=await db.execute('SELECT key,value FROM site_settings');const result={hero_ids:null,recommendation_ids:null};for(const row of rows.rows){if(row.key in result)try{result[row.key]=JSON.parse(row.value);}catch{}}return result;}
 async function list(){
  const rows=await db.execute('SELECT id,title,description,genres,type,year,rating,duration,file_size,deleted,poster_file_id,banner_file_id FROM movies ORDER BY id DESC');
  let exported=[];try{exported=JSON.parse(await readFile(join(project,'server/bot-catalog.json'),'utf8')).movies;}catch{}
  return rows.rows.map(row=>{const snapshot=exported.find(m=>m.id===String(row.id));let genres=[];try{genres=JSON.parse(row.genres);}catch{}return {id:String(row.id),title:row.title,description:row.description||'',genres,type:row.type||'movie',year:row.year,rating:row.rating||0,duration:row.duration||0,size:row.file_size||0,deleted:Boolean(row.deleted),poster:snapshot?.poster||'/assets/uzcinma-poster.png',backdrop:snapshot?.backdrop||'/assets/uzcinma-banner.png',available:Boolean(snapshot?.available),has_banner:Boolean(row.banner_file_id),has_poster:Boolean(row.poster_file_id)};});
 }
 async function find(value){const n=id(value),rows=await db.execute({sql:'SELECT * FROM movies WHERE id=?',args:[n]});if(!rows.rows.length)throw fault('Film topilmadi.',404);return rows.rows[0];}
 async function saveMetadata(movieId,meta){await db.execute({sql:'UPDATE movies SET title=?,description=?,genres=?,type=?,year=?,rating=?,updated_at=? WHERE id=?',args:[meta.title,meta.description,JSON.stringify(meta.genres),meta.type,meta.year,meta.rating,Date.now(),movieId]});}
 async function processJob(job){
  if(job.stage==='done'||job.cancelled)return;
  try{
   if(!job.telegramResult){
    job.stage='telegram';job.error=null;job.sent=0;job.controller=new AbortController();await persist(job);
    job.telegramResult=await transport({base,token,chatId,kind:job.kind,path:join(jobRoot,job.id,'file.bin'),filename:job.filename,mime:job.mime,caption:job.kind==='video'?job.metadata.title+(job.metadata.description?'\n'+job.metadata.description:''):((job.kind==='banner'?'Banner':'Poster')+' | Film ID: '+job.movieId),signal:job.controller.signal,progress:sent=>{job.sent=sent;}});
    delete job.controller;await persist(job);
   }
   job.stage='saving';await persist(job);
   const message=job.telegramResult,media=job.kind==='video'?(message.video||message.document):message.photo?.at(-1);
   if(!media?.file_id||!media.file_unique_id||!message.chat?.id||!message.message_id)throw fault('Telegram fayl tasdigini qaytarmadi.',502);
   const cached=join(cache,createHash('sha256').update(media.file_unique_id).digest('hex'));
   await copyFile(join(jobRoot,job.id,'file.bin'),cached);
   if(job.kind==='video'){
    const existing=await db.execute({sql:'SELECT id FROM movies WHERE file_unique_id=?',args:[media.file_unique_id]});
    if(job.movieId&&existing.rows.length&&Number(existing.rows[0].id)!==Number(job.movieId))throw fault('Bu video boshqa filmda saqlangan: ID '+existing.rows[0].id,409);
    if(!job.movieId&&existing.rows.length)job.movieId=Number(existing.rows[0].id);
    const args=[media.file_unique_id,media.file_id,job.filename,job.mime,job.size,media.duration||0,message.chat.id,message.message_id];
    if(job.movieId)await db.execute({sql:'UPDATE movies SET file_unique_id=?,file_id=?,file_name=?,mime_type=?,file_size=?,duration=?,source_chat_id=?,source_message_id=? WHERE id=?',args:[...args,job.movieId]});
    else{
     const inserted=await db.execute({sql:"INSERT INTO movies(file_unique_id,file_id,file_name,mime_type,file_size,duration,source_chat_id,source_message_id,title,description) VALUES(?,?,?,?,?,?,?,?,?,'')",args:[...args,job.metadata.title]});
     job.movieId=Number(inserted.lastInsertRowid);
    }
    await saveMetadata(job.movieId,job.metadata);
   }else{
    await find(job.movieId);const column=job.kind;
    await db.execute({sql:'UPDATE movies SET '+column+'_file_id=?,'+column+'_unique_id=?,updated_at=? WHERE id=?',args:[media.file_id,media.file_unique_id,Date.now(),job.movieId]});
   }
   await persist(job);await refresh();job.stage='done';job.error=null;await persist(job);
   await unlink(join(jobRoot,job.id,'file.bin')).catch(()=>{});
  }catch(error){delete job.controller;job.stage='error';job.error=String(error.message||'Yuklashda xatolik.').replaceAll(token||'\0','[hidden]').slice(0,400);await persist(job);}
 }
 function enqueue(job){job.stage='queued';queue=queue.catch(()=>{}).then(()=>processJob(job)).catch(()=>{job.stage='error';job.error='Yuklash holatini saqlab bolmadi.';});}
 // Restore completed and interrupted jobs without resending accepted Telegram messages automatically.
 const {readdir}=await import('node:fs/promises');
 for(const name of await readdir(jobRoot)){if(!/^[a-f0-9-]{36}$/.test(name))continue;try{const job=JSON.parse(await readFile(join(jobRoot,name,'job.json'),'utf8'));if(job.stage!=='done'&&job.stage!=='error'){job.stage='error';job.error='Jarayon uzilgan. Qayta urinishingiz mumkin.';}jobs.set(job.id,job);}catch{}}
 async function handle(req,res){
  const url=new URL(req.url,'http://localhost'),path=url.pathname.replace(/^\/api\/manage/,'')||'/';
  try{
   if(path==='/session'&&req.method==='GET'){const session=current(req);return send(res,200,{setup_required:!auth,authenticated:Boolean(session),csrf:session?.csrf||null});}
   if((path==='/setup'||path==='/login')&&req.method==='POST'){
    origin(req);const body=await jsonBody(req),password=String(body.password||'');
    if(path==='/setup'){
     if(auth)throw fault('Admin paroli allaqachon belgilangan.',409);
     if(password.length<8||password.length>128)throw fault('Parol kamida 8 belgidan iborat bolsin.');
     const salt=randomBytes(16).toString('hex');auth={salt,hash:scryptSync(password,salt,64).toString('hex')};await atomic(authPath,auth);
    }else{
     if(!auth)throw fault('Avval parol belgilang.',409);
     const now=Date.now();while(failures.length&&failures[0]<now-15*60000)failures.shift();
     if(failures.length>=8)throw fault('Kop urinish. Biroz kutib qayta kiring.',429);
     const computed=scryptSync(password.slice(0,128),auth.salt,64);if(!timingSafeEqual(computed,Buffer.from(auth.hash,'hex'))){failures.push(now);throw fault('Parol notogri.',401);}
    }
    return send(res,200,{ok:true,csrf:issue(req,res)});
   }
   const session=requireSession(req,!['GET','HEAD'].includes(req.method));
   if(path==='/logout'&&req.method==='POST'){sessions.delete(session.key);res.setHeader('Set-Cookie','uzcinma_admin=; HttpOnly; SameSite=Strict; Path=/api/manage; Max-Age=0');return send(res,200,{ok:true});}
   if(path==='/movies'&&req.method==='GET')return send(res,200,{movies:await list(),home:await settings(),genres:GENRES});
   const movieRoute=/^\/movies\/([1-9]\d{0,14})$/.exec(path);
   if(movieRoute&&req.method==='PATCH'){const movie=await find(movieRoute[1]),body=await jsonBody(req);if('deleted'in body)await db.execute({sql:'UPDATE movies SET deleted=?,updated_at=? WHERE id=?',args:[body.deleted?1:0,Date.now(),movie.id]});else await saveMetadata(movie.id,validateMovie(body));await refresh();return send(res,200,{ok:true});}
   if(path==='/home'&&req.method==='POST'){
    const body=await jsonBody(req);
    const statements=[];
    for(const key of ['hero_ids','recommendation_ids']){
     if(body[key]===null){statements.push({sql:'DELETE FROM site_settings WHERE key=?',args:[key]});continue;}
     if(!Array.isArray(body[key])||body[key].length>12)throw fault('Bosh sahifa royxati notogri.');
     const ids=[...new Set(body[key].map(v=>String(id(v))))];for(const value of ids){const row=await find(value);if(row.deleted)throw fault('Yashirilgan filmni bosh sahifaga qoshmang.');}
     statements.push({sql:'INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',args:[key,JSON.stringify(ids)]});
    }
    await db.batch(statements,'write');await refresh();return send(res,200,{ok:true});
   }
   if(path==='/connection'&&req.method==='GET'){
    if(!token||!chatId)return send(res,200,{ok:false,message:'Bot sozlamalari yetishmayapti.'});
    try{const response=await fetch(base+'/bot'+token+'/getMe',{signal:AbortSignal.timeout(8000)}),data=await response.json();return send(res,200,{ok:Boolean(data.ok),username:data.result?.username||null});}
    catch{return send(res,200,{ok:false,message:'Telegramga ulanish amalga oshmadi.'});}
   }
   if(path==='/jobs'&&req.method==='GET')return send(res,200,{jobs:[...jobs.values()].sort((a,b)=>b.created-a.created).slice(0,40).map(viewJob)});
   if(path==='/jobs'&&req.method==='POST'){
    if(!token||!chatId)throw fault('Bot sozlamalari yetishmayapti.',503);
    const body=await jsonBody(req);if(body.kind==='video')throw fault('Videoni bevosita Telegram botga yuboring.');if(!['banner','poster'].includes(body.kind))throw fault('Fayl turi notogri.');
    const size=Number(body.size);if(!Number.isSafeInteger(size)||size<1)throw fault('Fayl hajmi notogri.');
    const filename=basename(String(body.filename||'file.bin')).replace(/[\r\n]/g,'_').slice(0,160);
    const mime=String(body.mime||'application/octet-stream').replace(/[\r\n]/g,'');
    if(body.kind==='video'&&!/\.(mp4|webm|m4v|mov|mkv)$/i.test(filename))throw fault('Video fayl tanlang.');
    if(body.kind!=='video'&&!/\.(jpe?g|png|webp)$/i.test(filename))throw fault('JPG, PNG yoki WebP rasm tanlang.');
    if(body.movie_id)await find(body.movie_id);else if(body.kind!=='video')throw fault('Avval filmni tanlang.');
    const job={id:randomUUID(),kind:body.kind,filename,mime,size,received:0,sent:0,stage:'created',movieId:body.movie_id?Number(body.movie_id):null,metadata:body.kind==='video'?validateMovie(body.metadata||{}):null,created:Date.now()};
    jobs.set(job.id,job);await mkdir(join(jobRoot,job.id),{recursive:true});await persist(job);return send(res,201,{job:viewJob(job)});
   }
   const jobRoute=/^\/jobs\/([a-f0-9-]{36})(?:\/(file|retry|cancel))?$/.exec(path);
   if(jobRoute){
    const job=jobs.get(jobRoute[1]);if(!job)throw fault('Yuklash topilmadi.',404);
    const action=jobRoute[2];
    if(!action&&req.method==='GET')return send(res,200,{job:viewJob(job)});
    if(action==='file'&&req.method==='PUT'){
     if(!['created','error'].includes(job.stage)||job.telegramResult)throw fault('Bu fayl qayta yuborilmaydi.',409);
     job.stage='receiving';job.error=null;job.received=0;job.cancelled=false;await persist(job);
     const target=join(jobRoot,job.id,'file.bin');
     try{
      const counter=new Transform({transform(chunk,encoding,done){job.received+=chunk.length;if(job.received>job.size)return done(fault('Fayl hajmi mos emas.'));done(null,chunk);}});
      await pipeline(req,counter,createWriteStream(target,{flags:'w'}));
      if(job.received!==job.size)throw fault('Fayl toliq kelmadi. Qayta tanlab yuboring.');
      if(job.cancelled)throw fault('Yuklash toxtatildi.');
      await persist(job);enqueue(job);return send(res,202,{job:viewJob(job)});
     }catch(error){job.stage='error';job.error=error.message||'Fayl qabul qilish uzildi.';await persist(job);if(!res.destroyed)return send(res,400,{error:job.error});return;}
    }
    if(action==='retry'&&req.method==='POST'){
     if(job.stage==='done')return send(res,200,{job:viewJob(job)});
     if(job.stage!=='error'||job.received!==job.size||!existsSync(join(jobRoot,job.id,'file.bin')))throw fault('Faylni qayta tanlab yuklang.',409);
     job.error=null;job.cancelled=false;enqueue(job);return send(res,202,{job:viewJob(job)});
    }
    if(action==='cancel'&&req.method==='POST'){
     if(job.telegramResult||job.stage==='saving'||job.stage==='done')throw fault('Fayl qabul qilingan, katalogdan yashirish mumkin.',409);
     job.cancelled=true;if(job.stage==='telegram')job.controller?.abort();
     job.stage='error';job.error='Yuklash toxtatildi.';await persist(job);return send(res,200,{job:viewJob(job)});
    }
   }
   return send(res,404,{error:'Sorov topilmadi.'});
  }catch(error){if(!res.headersSent&&!res.destroyed)send(res,error.status||500,{error:error.status?error.message:'Sorovni bajarib bolmadi. Qayta urinib koring.'});}
 }
 return {handle,db,jobs,refresh,idle:()=>queue,close:()=>{for(const job of jobs.values())job.controller?.abort();if(!options.db)db.close();}};
}
