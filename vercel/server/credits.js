import {createHash,randomBytes,randomUUID,createCipheriv,createDecipheriv} from 'node:crypto';
import {parseId,publicURL} from './core.js';
const initialized=new WeakMap(),fault=(message,status=400)=>Object.assign(Error(message),{status});
export const CREDIT_LIMITS={cast:80,directors:30};
export const creditsStatements=[
 "CREATE TABLE IF NOT EXISTS title_credits (movie_id INTEGER PRIMARY KEY REFERENCES movies(id),tmdb_id INTEGER,tmdb_type TEXT,tmdb_title TEXT,tmdb_year TEXT,cast_json TEXT NOT NULL DEFAULT '[]',directors_json TEXT NOT NULL DEFAULT '[]',provider_json TEXT,revision INTEGER NOT NULL DEFAULT 1,updated_at INTEGER NOT NULL)",
 "CREATE TABLE IF NOT EXISTS tmdb_lookup_cache (key TEXT PRIMARY KEY,payload TEXT NOT NULL,expires INTEGER NOT NULL)"
];
export function ensureCreditsSchema(db){
 if(!initialized.has(db))initialized.set(db,(async()=>{await db.batch(creditsStatements,'write');const columns=(await db.execute('PRAGMA table_info(title_credits)')).rows;if(!columns.some(c=>c.name==='provider_json'))try{await db.execute('ALTER TABLE title_credits ADD COLUMN provider_json TEXT');}catch(error){if(!/duplicate column/i.test(error.message))throw error;}})().catch(error=>{initialized.delete(db);throw error;}));
 return initialized.get(db);
}
const readArray=value=>{try{const data=JSON.parse(value||'[]');return Array.isArray(data)?data:[];}catch{return [];}};
export function emptyCredits(){return {cast:[],directors:[],tmdb:null,wikidata:null,attribution:false,revision:0,updated_at:null};}
export async function getCredits(db,id){
 await ensureCreditsSchema(db);const row=(await db.execute({sql:'SELECT * FROM title_credits WHERE movie_id=?',args:[parseId(id)]})).rows[0];
 if(!row)return emptyCredits();
 const cast=readArray(row.cast_json),directors=readArray(row.directors_json);let provider;try{provider=JSON.parse(row.provider_json||'null');}catch{}

 return {cast,directors,wikidata:provider?.provider==='wikidata'?provider:null,tmdb:row.tmdb_id?{id:Number(row.tmdb_id),type:row.tmdb_type,title:row.tmdb_title,year:row.tmdb_year,url:'https://www.themoviedb.org/'+row.tmdb_type+'/'+row.tmdb_id}:null,attribution:[...cast,...directors].some(p=>p.source==='tmdb'),revision:Number(row.revision),updated_at:Number(row.updated_at)};
}
async function editable(db,id){
 const row=(await db.execute({sql:'SELECT id,collection_id FROM movies WHERE id=?',args:[parseId(id)]})).rows[0];
 if(!row)throw fault('Film topilmadi.',404);
 if(row.collection_id)throw fault('Aktyorlarni asosiy serial sahifasida tahrirlang.');
}
const expectedRevision=value=>{const n=Number(value);if(value===undefined||value===null||!Number.isSafeInteger(n)||n<0)throw fault('Sahifani yangilab qayta saqlang.',409);return n;};
export async function writeCredits(db,id,data,revision){
 await editable(db,id);revision=expectedRevision(revision);const link=data.tmdb;
 const result=await db.execute({sql:"INSERT INTO title_credits(movie_id,tmdb_id,tmdb_type,tmdb_title,tmdb_year,cast_json,directors_json,provider_json,revision,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?) ON CONFLICT(movie_id) DO UPDATE SET tmdb_id=excluded.tmdb_id,tmdb_type=excluded.tmdb_type,tmdb_title=excluded.tmdb_title,tmdb_year=excluded.tmdb_year,cast_json=excluded.cast_json,directors_json=excluded.directors_json,provider_json=excluded.provider_json,revision=title_credits.revision+1,updated_at=excluded.updated_at WHERE title_credits.revision=? RETURNING revision",args:[parseId(id),link?.id||null,link?.type||null,link?.title||null,link?.year||null,JSON.stringify(data.cast),JSON.stringify(data.directors),data.wikidata?JSON.stringify(data.wikidata):null,Date.now(),revision]});
 if(!result.rows.length)throw fault('Bu ma\u2019lumot boshqa oynada o\u2018zgardi. Yangilab qayta tahrirlang.',409);
 return getCredits(db,id);
}
export async function saveManualCredits(db,id,input){
 await ensureCreditsSchema(db);await editable(db,id);const current=await getCredits(db,id),revision=expectedRevision(input.revision);
 if(revision!==current.revision)throw fault('Ma\u2019lumot yangilangan. Avval qayta oching.',409);
 const previous=new Map([...current.cast,...current.directors].map(p=>[p.id,p])),used=new Set(),data={tmdb:current.tmdb,wikidata:current.wikidata};
 for(const kind of ['cast','directors']){
  if(!Array.isArray(input[kind])||input[kind].length>CREDIT_LIMITS[kind])throw fault(kind==='cast'?'80 tagacha aktyor qo\u2018shing.':'30 tagacha rejissyor qo\u2018shing.');
  data[kind]=input[kind].map(person=>{
   if(!person||typeof person!=='object')throw fault('Aktyor ma\u2019lumoti noto\u2018g\u2018ri.');
   const name=String(person.name||'').trim(),role=String(person.role||'').trim(),rawPhoto=String(person.photo||'').trim(),photo=rawPhoto?publicURL(rawPhoto):null;
   if(!name||name.length>120||role.length>240||(rawPhoto&&!photo)||rawPhoto.length>1500)throw fault('Ism 1–120, rol 240 belgigacha bo\u2018lsin. Surat uchun ochiq HTTPS havola kiriting.');
   const existing=previous.get(person.id),key=existing?.id||randomUUID();if(used.has(key))throw fault('Bir kishi takroran kiritilgan.');used.add(key);
   const overrides={...(existing?.overrides||{})};if(existing&&existing.source!=='manual')for(const [field,value]of Object.entries({name,role,photo}))if(value!==existing[field]){overrides[field]=value;if(field==='photo')overrides.photo_credit=null;}
   return {id:key,name,role,photo,source:existing?.source||'manual',tmdb_id:existing?.tmdb_id||null,wikidata_id:existing?.wikidata_id||null,photo_credit:existing?.photo===photo?existing?.photo_credit||null:null,...(existing&&existing.source!=='manual'?{overrides}:{})};
  });
 }
 return writeCredits(db,id,data,revision);
}
export async function removeTMDBCredits(db,id,revision){
 const current=await getCredits(db,id);if(expectedRevision(revision)!==current.revision)throw fault('Ma\u2019lumot yangilangan. Qayta oching.',409);
 return writeCredits(db,id,{cast:current.cast.filter(p=>p.source!=='tmdb'),directors:current.directors.filter(p=>p.source!=='tmdb'),tmdb:null,wikidata:current.wikidata},revision);
}
export function tmdbImage(path,size='w185'){
 return typeof path==='string'&&/^\/[a-zA-Z0-9_-]+\.(jpe?g|png|webp)$/i.test(path)?'https://image.tmdb.org/t/p/'+size+path:null;
}
const encryptionKey=config=>{const secret=config.ADMIN_API_SECRET||config.ADMIN_PASSWORD_HASH;if(!secret)return null;return createHash('sha256').update('uzcinma-tmdb-credential-v1\0'+secret).digest();};
function encryptCredential(value,config){const key=encryptionKey(config);if(!key)throw fault('Serverda maxfiy kalitni saqlash sozlanmagan.',503);const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});}
function decryptCredential(value,config){try{const saved=JSON.parse(value),decipher=createDecipheriv('aes-256-gcm',encryptionKey(config),Buffer.from(saved.iv,'base64'));decipher.setAuthTag(Buffer.from(saved.tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(saved.data,'base64')),decipher.final()]).toString('utf8');}catch{return null;}}
export function createTMDBService({db,config=process.env,fetchImpl=fetch,now=()=>Date.now()}){
 async function credential(){
  const row=(await db.execute("SELECT value FROM site_settings WHERE key='tmdb_credentials_v1'")).rows[0];
  const stored=row&&decryptCredential(row.value,config);
  if(stored)return {value:stored,source:'panel'};
  const value=(config.TMDB_READ_ACCESS_TOKEN||config.TMDB_API_KEY||'').trim();return {value,source:value?'environment':null};
 }
 async function status(){const value=await credential();return {configured:Boolean(value.value),source:value.source,can_save:Boolean(encryptionKey(config))};}
 async function remote(path,params={},override){
  const auth=override||(await credential()).value;if(!auth)throw fault('Avval TMDB akkauntingizdan API kalitini olib, panelga ulang.',503);
  const url=new URL('https://api.themoviedb.org/3/'+path);for(const [key,value]of Object.entries(params))url.searchParams.set(key,String(value));
  const headers={Accept:'application/json'};if(/^[a-f0-9]{32}$/i.test(auth))url.searchParams.set('api_key',auth);else headers.Authorization='Bearer '+auth;
  try{
   const response=await fetchImpl(url,{headers,signal:AbortSignal.timeout(10000),redirect:'error'});
   if([401,403].includes(response.status))throw fault('TMDB API kaliti qabul qilinmadi. Kalitni tekshiring.',422);
   if(response.status===429)throw fault('TMDB hozir ko\u2018p so\u2018rov qabul qilmoqda. Birozdan keyin qayta urining.',429);
   if(response.status===404)throw fault('TMDBda bu film yoki serial topilmadi.',404);
   if(!response.ok)throw fault('TMDB bilan aloqa amalga oshmadi. Qayta urinib ko\u2018ring.',503);
   if(Number(response.headers.get('content-length'))>5*1024*1024)throw fault('TMDB javobi juda katta.',502);
   const raw=await response.text();if(raw.length>5*1024*1024)throw fault('TMDB javobi juda katta.',502);
   const result=JSON.parse(raw);if(!result||typeof result!=='object')throw Error('Bad result');return result;
  }catch(error){if(error.status)throw error;throw fault('TMDB bilan ulanish uzildi. Keyinroq qayta urining.',503);}
 }
 async function cached(path,params={},ttl=600000){
  if(!(await credential()).value)throw fault('TMDB hali ulanmagan. Avval API kalitini kiriting.',503);
  await ensureCreditsSchema(db);const key=path+'?'+new URLSearchParams(params),hit=(await db.execute({sql:'SELECT payload FROM tmdb_lookup_cache WHERE key=? AND expires>?',args:[key,now()]})).rows[0];
  if(hit){try{return JSON.parse(hit.payload);}catch{}}
  const result=await remote(path,params);
  await db.batch([{sql:'DELETE FROM tmdb_lookup_cache WHERE expires<=?',args:[now()]},{sql:'INSERT INTO tmdb_lookup_cache(key,payload,expires) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,expires=excluded.expires',args:[key,JSON.stringify(result),now()+ttl]}],'write');
  return result;
 }
 async function connect(raw){
  if(typeof raw!=='string')throw fault('TMDB API kalitini kiriting.');const token=raw.trim().replace(/^Bearer\s+/i,'');
  if(token.length<20||token.length>4096||!/^[a-zA-Z0-9._~-]+$/.test(token))throw fault('API kaliti yoki API Read Access Token kiriting.');
  await remote('configuration',{},token);
  await db.execute({sql:"INSERT INTO site_settings(key,value) VALUES('tmdb_credentials_v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",args:[encryptCredential(token,config)]});return status();
 }
 async function disconnect(){await db.execute("DELETE FROM site_settings WHERE key='tmdb_credentials_v1'");return status();}
 async function search(query,type='all',page=1){
  const q=String(query||'').trim().slice(0,120);if(q.length<2)throw fault('Film nomidan kamida 2 belgi kiriting.');
  if(!['all','movie','tv'].includes(type))throw fault('Film yoki serial turini tanlang.');page=Math.max(1,Math.min(20,Math.floor(Number(page)||1)));
  const data=await cached('search/'+(type==='all'?'multi':type),{query:q,include_adult:false,language:'en-US',page});
  return {results:(data.results||[]).filter(m=>!m.adult&&(type!=='all'||['movie','tv'].includes(m.media_type))).slice(0,20).map(m=>({tmdb_id:Number(m.id),type:type==='all'?m.media_type:type,title:m.title||m.name||'',original_title:m.original_title||m.original_name||'',year:(m.release_date||m.first_air_date||'').slice(0,4),poster:tmdbImage(m.poster_path,'w185'),overview:String(m.overview||'').slice(0,600)})).filter(m=>Number.isSafeInteger(m.tmdb_id)&&m.tmdb_id>0),page,total_pages:Math.min(20,Number(data.total_pages)||0)};
 }
 async function importTitle(id,input){
  await editable(db,id);const current=await getCredits(db,id),revision=input.revision===undefined?current.revision:expectedRevision(input.revision);
  if(revision!==current.revision)throw fault('Ma\u2019lumot yangilangan. Qayta oching.',409);
  const tmdbId=parseId(input.tmdb_id),type=input.type;if(!['movie','tv'].includes(type))throw fault('TMDB film turi noto\u2018g\u2018ri.');
  const [detail,credits]=await Promise.all([cached(type+'/'+tmdbId,{language:'en-US'},21600000),cached(type+'/'+tmdbId+(type==='tv'?'/aggregate_credits':'/credits'),{language:'en-US'},21600000)]);
  if(detail.adult||Number(detail.id)!==tmdbId)throw fault('Bu TMDB yozuvini ulab bo\u2018lmaydi.');
  const name=String(detail.title||detail.name||'').slice(0,200);if(!name)throw fault('TMDB film ma\u2019lumotlari to\u2018liq kelmadi.',502);
  const prior=new Map(current.tmdb?.id===tmdbId&&current.tmdb?.type===type?[...current.cast,...current.directors].map(p=>[p.id,p]):[]);
  const convert=(p,kind)=>{
   const roles=type==='tv'?(p.roles||[]).map(r=>r.character):[p.character];
   const key='tmdb-'+kind+'-'+p.id,overrides=prior.get(key)?.overrides||{};
   return {id:key,name:String(p.name||p.original_name||'').slice(0,120),role:kind==='director'?'Rejissyor':[...new Set(roles.filter(Boolean))].slice(0,6).join(' / ').slice(0,240),photo:tmdbImage(p.profile_path),tmdb_id:Number(p.id),source:'tmdb',...overrides,overrides};
  };
  const unique=rows=>[...new Map(rows.filter(p=>p.name&&Number.isSafeInteger(p.tmdb_id)&&p.tmdb_id>0).map(p=>[p.id,p])).values()];
  const cast=unique([...(credits.cast||[])].sort((a,b)=>(a.order??9999)-(b.order??9999)).map(p=>convert(p,'actor'))).slice(0,60);
  const directors=unique((credits.crew||[]).filter(p=>type==='tv'?(p.jobs||[]).some(j=>j.job==='Director'):p.job==='Director').map(p=>convert(p,'director'))).slice(0,20);
  const manualCast=current.cast.filter(p=>p.source==='manual'),manualDirectors=current.directors.filter(p=>p.source==='manual');
  if(manualCast.length+cast.length>CREDIT_LIMITS.cast||manualDirectors.length+directors.length>CREDIT_LIMITS.directors)throw fault('Ro\u2018yxatda joy yetmayapti. Ortiqcha qo\u2018lda kiritilgan yozuvlarni olib tashlang.');
  return writeCredits(db,id,{cast:[...cast,...manualCast],directors:[...directors,...manualDirectors],tmdb:{id:tmdbId,type,title:name,year:(detail.release_date||detail.first_air_date||'').slice(0,4)}},revision);
 }
 return {status,connect,disconnect,search,importTitle};
}
