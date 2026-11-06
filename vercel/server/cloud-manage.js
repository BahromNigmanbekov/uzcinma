import {createWikidataService} from './wikidata-credits.js';
import {ensureCreditsSchema,getCredits,saveManualCredits,removeTMDBCredits,createTMDBService} from './credits.js';
import {ensureSeriesSchema,availabilitySQL,createCollection,saveSeason,removeSeason,attachEpisode,detachEpisode,restoreTitle,titleDetails,titleRow} from './series.js';
import {imageType,telegramImage,MAX_IMAGE_BYTES} from './image-media.js';
import {randomBytes,randomUUID,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {GENRES,movieDTO,send,authorize} from './core.js';
import {validateMovie} from './movie-validation.js';
import {uploadToTelegram} from './admin-telegram.js';
const derive=promisify(scrypt),MAX_IMAGE=MAX_IMAGE_BYTES,SESSION_MS=8*3600*1000;
const fault=(message,status=400)=>Object.assign(Error(message),{status});
const sha=value=>createHash('sha256').update(value).digest('hex');
const movieId=value=>{if(!/^[1-9]\d{0,14}$/.test(String(value)))throw fault('Film ID notogri.');return Number(value);};
const schema=[
 "CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires INTEGER NOT NULL,auth_version TEXT NOT NULL)",
 "CREATE TABLE IF NOT EXISTS admin_login_limits (bucket TEXT PRIMARY KEY,attempts INTEGER NOT NULL,reset_at INTEGER NOT NULL)",
 "CREATE TABLE IF NOT EXISTS admin_upload_jobs (id TEXT PRIMARY KEY,kind TEXT NOT NULL,movie_id INTEGER NOT NULL,filename TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,received INTEGER NOT NULL DEFAULT 0,sent INTEGER NOT NULL DEFAULT 0,stage TEXT NOT NULL DEFAULT 'created',error TEXT,file_data BLOB,telegram_result TEXT,lease_until INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL,updated INTEGER NOT NULL)"
];
function passwordConfig(value){
 try{const auth=JSON.parse(value);if(/^[a-f0-9]{32}$/i.test(auth.salt)&&/^[a-f0-9]{128}$/i.test(auth.hash))return auth;}catch{}
 return null;
}
async function rawBody(req,limit){
 let body=req.body;
 if(body!==undefined){
  if(typeof body==='string')body=Buffer.from(body);else if(!Buffer.isBuffer(body)&&!(body instanceof Uint8Array))body=Buffer.from(JSON.stringify(body));
  if(body.length>limit)throw fault('Sorov hajmi juda katta.',413);return Buffer.from(body);
 }
 const chunks=[];let size=0;
 for await(const chunk of req){const part=Buffer.from(chunk);size+=part.length;if(size>limit)throw fault('Sorov hajmi juda katta.',413);chunks.push(part);}
 return Buffer.concat(chunks,size);
}
async function jsonBody(req){try{return JSON.parse((await rawBody(req,65536)).toString()||'{}');}catch(error){if(error.status)throw error;throw fault('JSON notogri.');}}
function pathOf(req){
 const url=new URL(req.url||'/','http://localhost');
 const route=req.query?.route??url.searchParams.get('route');
 if(typeof route==='string')return '/'+route.replace(/^\/+/,'').replace(/\/+$/,'');
 return url.pathname.replace(/^\/api\/manage/,'').replace(/\/+$/,'')||'/';
}
function jobDTO(row){
 return {id:row.id,kind:row.kind,filename:row.filename,mime:row.mime,size:Number(row.size),received:Number(row.received),sent:Number(row.sent),stage:row.stage,error:row.error||null,movie_id:String(row.movie_id),title:'',created:Number(row.created),accepted_by_telegram:Boolean(row.telegram_result),can_retry:row.stage==='error'&&(Boolean(row.telegram_result)||Number(row.received)===Number(row.size))};
}
export function createCloudManage({db,config=process.env,transport=uploadToTelegram,telegramCheck,tmdbFetch=fetch,wikidataFetch=fetch,now=()=>Date.now()}){
 const wikidata=createWikidataService({db,fetchImpl:wikidataFetch,now});
 const tmdb=createTMDBService({db,config,fetchImpl:tmdbFetch,now});
 let ready;
 const init=()=>ready??=(async()=>{await db.batch(schema,'write');await ensureSeriesSchema(db);await ensureCreditsSchema(db);})().catch(error=>{ready=undefined;throw error;});
 const auth=()=>passwordConfig(config.ADMIN_PASSWORD_HASH);
 const authVersion=()=>sha(config.ADMIN_PASSWORD_HASH||'');
 function origin(req){
  const allowed=new Set([config.APP_ORIGIN,...(config.ADMIN_ALLOWED_ORIGINS||'').split(',')].filter(Boolean).map(value=>value.replace(/\/$/,'')));
  if(!allowed.has(req.headers?.origin))throw fault('Bu manbadan sorovga ruxsat yoq.',403);
 }
 async function current(req){
  const token=String(req.headers?.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith('uzcinma_admin='))?.slice(14);
  if(!token||!/^[a-f0-9]{64}$/i.test(token))return null;
  const result=await db.execute({sql:'SELECT token_hash,csrf,expires FROM admin_sessions WHERE token_hash=? AND expires>? AND auth_version=?',args:[sha(token),now(),authVersion()]});
  return result.rows[0]||null;
 }
 async function session(req,write=false){
  const value=await current(req);if(!value)throw fault('Admin panelga kiring.',401);
  if(write){origin(req);if(!authorize(req.headers?.['x-csrf-token'],value.csrf))throw fault('Sahifani yangilab qayta urinib koring.',403);}
  return value;
 }
 async function issue(req,res){
  const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
  await db.batch([
   {sql:'DELETE FROM admin_sessions WHERE expires<=?',args:[now()]},
   {sql:'INSERT INTO admin_sessions(token_hash,csrf,expires,auth_version) VALUES(?,?,?,?)',args:[sha(token),csrf,now()+SESSION_MS,authVersion()]}
  ],'write');
  const secure=String(config.APP_ORIGIN||'').startsWith('https://');
  res.setHeader('Set-Cookie','uzcinma_admin='+token+'; HttpOnly; SameSite=Strict; Path=/api/manage; Max-Age=28800'+(secure?'; Secure':''));
  return csrf;
 }
 async function attempts(req){
  const ip=String(req.headers?.['x-real-ip']||req.headers?.['x-forwarded-for']||'unknown').split(',')[0].trim().slice(0,100);
  const rows=await db.batch(['ip:'+sha(ip),'global'].map(bucket=>({
   sql:'INSERT INTO admin_login_limits(bucket,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING attempts,reset_at',
   args:[bucket,now()+15*60000,now(),now()]
  })),'write');
  if(Number(rows[0].rows[0].attempts)>8||Number(rows[1].rows[0].attempts)>50)throw fault('Kop urinish. 15 daqiqadan keyin qayta kiring.',429);
 }
 async function movie(id){
  const row=(await db.execute({sql:'SELECT * FROM movies WHERE id=?',args:[movieId(id)]})).rows[0];if(!row)throw fault('Film topilmadi.',404);return row;
 }
 async function settings(){const result=await db.execute("SELECT value FROM site_settings WHERE key='home'");let value={};try{value=JSON.parse(result.rows[0]?.value||'{}');}catch{}return {hero_ids:value.hero_ids??null,recommendation_ids:value.recommendation_ids??null,selection_sound_enabled:value.selection_sound_enabled!==false};}
 const jobColumns='id,kind,movie_id,filename,mime,size,received,sent,stage,error,telegram_result,lease_until,created,updated';
 async function getJob(id,withData=false){
  const row=(await db.execute({sql:'SELECT '+jobColumns+(withData?',file_data':'')+' FROM admin_upload_jobs WHERE id=?',args:[id]})).rows[0];if(!row)throw fault('Yuklash topilmadi.',404);
  if(!['created','done','error'].includes(row.stage)&&Number(row.lease_until)<now()){
   await db.execute({sql:"UPDATE admin_upload_jobs SET stage='error',error=?,updated=? WHERE id=? AND lease_until<? AND stage NOT IN ('done','error','created')",args:['Jarayon uzilgan. Qayta urinishingiz mumkin.',now(),id,now()]});
   row.stage='error';row.error='Jarayon uzilgan. Qayta urinishingiz mumkin.';
  }
  return row;
 }
 async function processPhoto(id){
  let row=await getJob(id,true);
  if(row.stage==='done')return row;
  if(!row.telegram_result&&(!row.file_data||Number(row.received)!==Number(row.size)))throw fault('Rasmni qayta tanlab yuboring.',409);
  const claimed=await db.execute({sql:"UPDATE admin_upload_jobs SET stage='telegram',error=NULL,lease_until=?,updated=? WHERE id=? AND stage IN ('created','queued','error') AND lease_until<=?",args:[now()+55000,now(),id,now()]});
  if(!claimed.rowsAffected)throw fault('Rasm allaqachon yuborilmoqda.',409);
  let progress=Promise.resolve(),last=-1;
  try{
   if(!row.telegram_result){
    const result=await transport({
     base:config.BOT_API_BASE||'https://api.telegram.org',token:config.BOT_TOKEN,chatId:config.ADMIN_USER_ID,
     kind:row.kind,data:Buffer.from(row.file_data),filename:row.filename,mime:row.mime,
     caption:({banner:'Banner',poster:'Poster',logo:'Logo'}[row.kind])+' | Film ID: '+row.movie_id,
     signal:AbortSignal.timeout(40000),
     progress:sent=>{
      const step=Math.floor(sent/Number(row.size)*4);if(step===last)return;last=step;
      progress=progress.then(()=>db.execute({sql:'UPDATE admin_upload_jobs SET sent=?,updated=? WHERE id=?',args:[Math.min(sent,Number(row.size)),now(),id]})).catch(()=>{});
     }
    });
    await progress;
    const photo=telegramImage(result);
    if(!photo?.file_id)throw Error('Telegram rasm tasdigini qaytarmadi.');
    row.telegram_result=JSON.stringify({file_id:photo.file_id});
    await db.execute({sql:"UPDATE admin_upload_jobs SET telegram_result=?,sent=size,stage='saving',updated=? WHERE id=?",args:[row.telegram_result,now(),id]});
   }
   const accepted=JSON.parse(row.telegram_result),column=row.kind==='logo'?'logo_file_id':row.kind==='banner'?'banner_file_id':'poster_file_id',urlColumn=row.kind==='logo'?'logo_url':row.kind==='banner'?'backdrop_url':'poster_url';
   await db.batch([
    {sql:'UPDATE movies SET '+column+'=?,'+urlColumn+'=NULL,updated_at=? WHERE id=?',args:[accepted.file_id,now(),Number(row.movie_id)]},
    {sql:"UPDATE admin_upload_jobs SET stage='done',error=NULL,sent=size,file_data=NULL,lease_until=0,updated=? WHERE id=?",args:[now(),id]}
   ],'write');
  }catch(error){
   await progress;
   const message=String(error.message||'Rasm yuklanmadi. Qayta urinib koring.').replaceAll(config.BOT_TOKEN||'\0','[hidden]').slice(0,250);
   await db.execute({sql:"UPDATE admin_upload_jobs SET stage='error',error=?,lease_until=0,updated=? WHERE id=?",args:[message,now(),id]});
  }
  return getJob(id);
 }
 async function handle(req,res){
  try{
   const path=pathOf(req),method=req.method||'GET';
   if(!auth())return send(res,503,{error:'Admin paroli serverda hali sozlanmagan. Administratorga murojaat qiling.'});
   await init();
   if(path==='/session'&&method==='GET'){const value=await current(req);return send(res,200,{setup_required:false,authenticated:Boolean(value),csrf:value?.csrf||null,cloud:true,max_image_bytes:MAX_IMAGE});}
   if(path==='/setup'&&method==='POST')return send(res,409,{error:'Admin paroli allaqachon belgilangan.'});
   if(path==='/login'&&method==='POST'){
    origin(req);await attempts(req);
    const body=await jsonBody(req),password=body.password;
    if(typeof password!=='string'||password.length>128)throw fault('Parol notogri.',401);
    const saved=auth(),computed=await derive(password,saved.salt,64);
    if(!timingSafeEqual(computed,Buffer.from(saved.hash,'hex')))throw fault('Parol notogri.',401);
    return send(res,200,{ok:true,csrf:await issue(req,res)});
   }
   const value=await session(req,!['GET','HEAD'].includes(method));
   if(path==='/logout'&&method==='POST'){
    await db.execute({sql:'DELETE FROM admin_sessions WHERE token_hash=?',args:[value.token_hash]});
    res.setHeader('Set-Cookie','uzcinma_admin=; HttpOnly; SameSite=Strict; Path=/api/manage; Max-Age=0'+(String(config.APP_ORIGIN||'').startsWith('https://')?'; Secure':''));
    return send(res,200,{ok:true});
   }
   if(path==='/movies'&&method==='GET'){
    const result=await db.execute('SELECT m.*,'+availabilitySQL()+' AS available FROM movies m WHERE m.collection_id IS NULL ORDER BY m.id DESC');
    const movies=result.rows.map(row=>({...movieDTO(row),size:Number(row.file_size)||0,deleted:Boolean(row.deleted),has_banner:Boolean(row.banner_file_id||row.backdrop_url),has_poster:Boolean(row.poster_file_id||row.poster_url)}));
    return send(res,200,{movies,home:await settings(),genres:GENRES});
   }
   if(path==='/collections'&&method==='POST')return send(res,201,{movie:await createCollection(db,await jsonBody(req))});
   const collectionRoute=/^\/collections\/([1-9]\d{0,14})(?:\/(seasons|episodes)(?:\/([1-9]\d*))?)?$/.exec(path);
   if(collectionRoute){
    const [,id,action,number]=collectionRoute;
    if(!action&&method==='GET')return send(res,200,await titleDetails(db,id,{...Object.fromEntries(new URL(req.url,'http://localhost').searchParams),admin:true}));
    if(action==='seasons'&&method==='POST')return send(res,200,await saveSeason(db,id,await jsonBody(req)));
    if(action==='seasons'&&number&&method==='DELETE')return send(res,200,await removeSeason(db,id,number));
    if(action==='episodes'&&method==='POST')return send(res,200,await attachEpisode(db,id,await jsonBody(req)));
   }
   const detachRoute=/^\/episodes\/([1-9]\d{0,14})\/detach$/.exec(path);
   if(detachRoute&&method==='POST')return send(res,200,await detachEpisode(db,detachRoute[1]));
   if(path==='/wikidata/search'&&method==='GET'){const params={...Object.fromEntries(new URL(req.url,'http://localhost').searchParams),...req.query};return send(res,200,await wikidata.search(params.q));}
   if(path==='/tmdb/connection'){
    if(method==='GET')return send(res,200,await tmdb.status());
    if(method==='POST')return send(res,200,await tmdb.connect((await jsonBody(req)).credential));
    if(method==='DELETE')return send(res,200,await tmdb.disconnect());
   }
   if(path==='/tmdb/search'&&method==='GET'){
    const params={...Object.fromEntries(new URL(req.url,'http://localhost').searchParams),...req.query};
    return send(res,200,await tmdb.search(params.q,params.type||'all',params.page));
   }
   const creditsRoute=/^\/movies\/([1-9]\d{0,14})\/credits(?:\/(tmdb|wikidata))?$/.exec(path);
   if(creditsRoute){
    const [,id,action]=creditsRoute;await movie(id);
    if(!action&&method==='GET')return send(res,200,{credits:await getCredits(db,id),tmdb:await tmdb.status()});
    if(!action&&method==='PATCH')return send(res,200,{credits:await saveManualCredits(db,id,await jsonBody(req))});
    if(action==='wikidata'&&method==='POST')return send(res,200,{credits:await wikidata.importTitle(id,await jsonBody(req))});
    if(action==='wikidata'&&method==='DELETE')return send(res,200,{credits:await wikidata.disconnect(id,(await jsonBody(req)).revision)});
    if(action==='tmdb'&&method==='POST')return send(res,200,{credits:await tmdb.importTitle(id,await jsonBody(req))});
    if(action==='tmdb'&&method==='DELETE')return send(res,200,{credits:await removeTMDBCredits(db,id,(await jsonBody(req)).revision)});
   }
   const movieRoute=/^\/movies\/([1-9]\d{0,14})$/.exec(path);
   if(movieRoute&&method==='GET'){
    const row=await titleRow(db,movieRoute[1]);
    return send(res,200,{movie:{...movieDTO(row),deleted:Boolean(row.deleted),has_banner:Boolean(row.banner_file_id||row.backdrop_url),has_poster:Boolean(row.poster_file_id||row.poster_url)}});
   }
   if(movieRoute&&method==='PATCH'){
    const row=await movie(movieRoute[1]),body=await jsonBody(req);
    if('deleted' in body){if(typeof body.deleted!=='boolean')throw fault('Holat notogri.');await restoreTitle(db,row.id,body.deleted);}
    else if(body.clear_logo===true)await db.execute({sql:'UPDATE movies SET logo_file_id=NULL,logo_url=NULL,updated_at=? WHERE id=?',args:[now(),row.id]});
    else{const meta=validateMovie(body);await db.execute({sql:'UPDATE movies SET title=?,description=?,genres=?,type=?,year=?,rating=?,updated_at=? WHERE id=?',args:[meta.title,meta.description,JSON.stringify(meta.genres),meta.type,meta.year,meta.rating,now(),row.id]});}
    return send(res,200,{ok:true});
   }
   if(path==='/home'&&method==='POST'){
    const body=await jsonBody(req),home={};
    for(const key of ['hero_ids','recommendation_ids']){
     if(body[key]===null){home[key]=null;continue;}
     if(!Array.isArray(body[key])||body[key].length>12)throw fault('Bosh sahifa royxati notogri.');
     home[key]=[...new Set(body[key].map(id=>String(movieId(id))))];
     for(const id of home[key]){const row=await movie(id);if(row.deleted||row.collection_id)throw fault('Bosh sahifaga faol film yoki serialning ozini tanlang.');}
    }
    home.selection_sound_enabled=typeof body.selection_sound_enabled==='boolean'?body.selection_sound_enabled:(await settings()).selection_sound_enabled;
    await db.execute({sql:"INSERT INTO site_settings(key,value) VALUES('home',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",args:[JSON.stringify(home)]});
    return send(res,200,{ok:true});
   }
   if(path==='/connection'&&method==='GET'){
    if(!config.BOT_TOKEN||!config.ADMIN_USER_ID)return send(res,200,{ok:false,message:'Bot sozlamalari yetishmayapti.'});
    try{
     const result=telegramCheck?await telegramCheck():await(await fetch('https://api.telegram.org/bot'+config.BOT_TOKEN+'/getMe',{signal:AbortSignal.timeout(8000)})).json();
     return send(res,200,{ok:Boolean(result.ok),username:result.result?.username||null});
    }catch{return send(res,200,{ok:false,message:'Telegramga ulanib bolmadi.'});}
   }
   if(path==='/jobs'&&method==='GET'){
    await db.execute({sql:"UPDATE admin_upload_jobs SET stage='error',error=?,updated=? WHERE lease_until<? AND stage NOT IN ('created','done','error')",args:['Jarayon uzilgan. Qayta urinishingiz mumkin.',now(),now()]});
    const rows=await db.execute('SELECT '+jobColumns+' FROM admin_upload_jobs ORDER BY created DESC LIMIT 40');
    const jobs=rows.rows.map(jobDTO);
    return send(res,200,{jobs});
   }
   if(path==='/jobs'&&method==='POST'){
    const body=await jsonBody(req);
    if(!['banner','poster','logo'].includes(body.kind))throw fault('Videoni bevosita Telegram botga yuboring.');
    if(!config.BOT_TOKEN||!config.ADMIN_USER_ID)throw fault('Bot sozlamalari yetishmayapti.',503);
    const size=Number(body.size);
    if(!Number.isSafeInteger(size)||size<1||size>MAX_IMAGE)throw fault('Rasm 2 MB dan oshmasin.',413);
    await movie(body.movie_id);
    const filename=String(body.filename||'image.jpg').replace(/[\\/\r\n"]/g,'_').slice(0,160);
    if(!/\.(png|jpe?g|webp)$/i.test(filename))throw fault('JPG, PNG yoki WebP rasm tanlang.');
    const id=randomUUID();
    await db.execute({sql:"INSERT INTO admin_upload_jobs(id,kind,movie_id,filename,mime,size,created,updated) VALUES(?,?,?,?,?,?,?,?)",args:[id,body.kind,movieId(body.movie_id),filename,String(body.mime||'image/jpeg'),size,now(),now()]});
    return send(res,201,{job:jobDTO(await getJob(id))});
   }
   const jobRoute=/^\/jobs\/([a-f0-9-]{36})(?:\/(file|retry|cancel))?$/.exec(path);
   if(jobRoute){
    const id=jobRoute[1],action=jobRoute[2],row=await getJob(id);
    if(!action&&method==='GET')return send(res,200,{job:jobDTO(row)});
    if(action==='file'&&method==='PUT'){
     if(!['created','error'].includes(row.stage)||row.telegram_result)throw fault('Bu fayl qayta yuborilmaydi.',409);
     const body=await rawBody(req,MAX_IMAGE);
     if(body.length!==Number(row.size))throw fault('Rasm toliq kelmadi. Qayta yuboring.');
     const mime=imageType(body);
     const claimed=await db.execute({sql:"UPDATE admin_upload_jobs SET file_data=?,mime=?,received=?,stage='queued',error=NULL,updated=? WHERE id=? AND stage IN ('created','error') AND telegram_result IS NULL AND lease_until<=?",args:[body,mime,body.length,now(),id,now()]});
     if(!claimed.rowsAffected)throw fault('Rasm allaqachon yuborilmoqda.',409);
     return send(res,202,{job:jobDTO(await processPhoto(id))});
    }
    if(action==='retry'&&method==='POST')return send(res,202,{job:jobDTO(await processPhoto(id))});
    if(action==='cancel'&&method==='POST'){
     if(!['created','error'].includes(row.stage)||row.telegram_result)throw fault('Rasm qabul qilingan yoki yuborilmoqda.',409);
     await db.execute({sql:"UPDATE admin_upload_jobs SET stage='error',error='Yuklash toxtatildi.',file_data=NULL,received=0,updated=? WHERE id=?",args:[now(),id]});
     return send(res,200,{job:jobDTO(await getJob(id))});
    }
   }
   return send(res,404,{error:'Sorov topilmadi.'});
  }catch(error){return send(res,error.status||500,{error:error.status?error.message:'Sorovni bajarib bolmadi. Qayta urinib koring.'});}
 }
 return {handle};
}
