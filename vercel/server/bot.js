
import {GENRES,QUALITIES,parseId,publicURL} from './core.js';
const now=()=>Math.floor(Date.now()/1000);
export async function processMessage(db,msg){
 const chat=msg.chat;if(chat?.type!=='private'||String(msg.from?.id)!==process.env.ADMIN_USER_ID)return null;
 const text=msg.text||(msg.photo?msg.caption:'')||'';const [cmd0,...parts]=text.trim().split(/\s+/);const cmd=cmd0?.split('@')[0];
 if(cmd==='/start'||cmd==='/help')return "Film yuboring. /list; /title ID yangi nom; /description ID tavsif; /genre ID action,drama; /source ID hls URL yoki /source ID 480 URL; /delete ID; /restore ID. /unsource ID 720; /backdrop ID HTTPS_URL; /posterurl ID HTTPS_URL. Banner rasmining captioni: /banner ID. Poster rasmining captioni: /poster ID. /meta ID 2018 6.5 movie";
 if(cmd==='/list'){const rows=await db.execute('SELECT id,title FROM movies WHERE deleted=0 ORDER BY id DESC LIMIT 20');return rows.rows.map(r=>r.id+'. '+r.title.slice(0,150)).join('\n')||'Hali film yoq.';}
 if(msg.video||msg.document){
  const media=msg.video||msg.document;const name=media.file_name||'Film';
  if(!msg.video&&!String(media.mime_type||'').startsWith('video/')&&!/\.(mp4|mkv|webm|mov|avi)$/i.test(name))return 'Video fayl yuboring.';
  const lines=(msg.caption||'').split('\n');const title=(lines.shift()||name).trim().slice(0,200);const description=lines.join('\n').slice(0,3000);
  const t=now();await db.execute({sql:'INSERT INTO movies(file_unique_id,file_id,title,description,duration,file_size,source_chat_id,source_message_id,mime_type,file_name,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(file_unique_id) DO UPDATE SET file_id=excluded.file_id,source_chat_id=excluded.source_chat_id,source_message_id=excluded.source_message_id,mime_type=excluded.mime_type,file_name=excluded.file_name,updated_at=excluded.updated_at',args:[media.file_unique_id,media.file_id,title,description,media.duration||0,media.file_size||0,String(msg.chat.id),Number(msg.message_id)||null,media.mime_type||'video/mp4',name,t,t]});
  const row=await db.execute({sql:'SELECT id FROM movies WHERE file_unique_id=?',args:[media.file_unique_id]});
  return 'Film katalogga saqlandi. ID: '+row.rows[0].id+'\nSaytda kino kartochkasini tanlab tomosha qilishingiz mumkin.';
 }
 if(!['/title','/description','/genre','/source','/delete','/restore','/poster','/banner','/posterurl','/backdrop','/unsource','/meta'].includes(cmd))return 'Buyruqlar: /help';
 let id;try{id=parseId(parts.shift());}catch{return 'Film ID kerak. Masalan: /title 3 Yangi nom';}
 const found=await db.execute({sql:'SELECT id FROM movies WHERE id=?',args:[id]});if(!found.rows.length)return 'Film topilmadi.';
 const updated=now();
 if(cmd==='/delete'||cmd==='/restore'){await db.execute({sql:'UPDATE movies SET deleted=?,updated_at=? WHERE id=?',args:[cmd==='/delete'?1:0,updated,id]});return cmd==='/delete'?'Film katalogdan yashirildi. Tiklash: /restore '+id:'Film tiklandi.';}
 if(cmd==='/poster'||cmd==='/banner'){
  const file=msg.photo?.filter(p=>(p.file_size||0)<=2*1024*1024).at(-1);if(!file)return 'Rasm yuboring, caption: '+cmd+' '+id;
  const column=cmd==='/banner'?'banner_file_id':'poster_file_id',urlColumn=cmd==='/banner'?'backdrop_url':'poster_url';
  await db.execute({sql:'UPDATE movies SET '+column+'=?,'+urlColumn+'=NULL,updated_at=? WHERE id=?',args:[file.file_id,updated,id]});return cmd==='/banner'?'Banner saqlandi.':'Poster saqlandi.';
 }
 if(cmd==='/posterurl'||cmd==='/backdrop'){
  const url=publicURL(parts[0]);if(!url)return 'Ochiq HTTPS rasm manzili kerak.';
  const column=cmd==='/posterurl'?'poster_url':'backdrop_url';
  await db.execute({sql:'UPDATE movies SET '+column+'=?,updated_at=? WHERE id=?',args:[url,updated,id]});return 'Rasm manzili saqlandi.';
 }
 if(cmd==='/unsource'){
  const quality=parts[0];if(!QUALITIES.includes(quality))return 'Sifatni kiriting: hls, 480, 720, 1080, original.';
  await db.execute({sql:'DELETE FROM sources WHERE movie_id=? AND quality=?',args:[id,quality]});return 'Video manbasi olib tashlandi.';
 }
 if(cmd==='/source'){
  const quality=parts.shift(),url=publicURL(parts.shift());if(!QUALITIES.includes(quality)||!url)return 'Namuna: /source '+id+' 720 https://video-manzili/film.mp4. Sifatlar: hls, 480, 720, 1080, original.';
  await db.execute({sql:'INSERT INTO sources(movie_id,quality,url) VALUES(?,?,?) ON CONFLICT(movie_id,quality) DO UPDATE SET url=excluded.url',args:[id,quality,url]});return 'Haqiqiy '+quality+' video manbasi saqlandi.';
 }
 if(cmd==='/genre'){
  const genres=[...new Set(parts.join('').split(',').filter(Boolean))];if(!genres.length||genres.some(g=>!GENRES.includes(g)))return 'Janrlar: '+GENRES.join(', ');
  const type=genres.includes('anime')?'anime':genres.includes('animation')?'animation':'movie';
  await db.execute({sql:'UPDATE movies SET genres=?,type=?,updated_at=? WHERE id=?',args:[JSON.stringify(genres),type,updated,id]});return 'Janrlar saqlandi.';
 }
 if(cmd==='/meta'){
  const year=Number(parts[0]),rating=Number(parts[1]),type=parts[2]||'movie';
  if(!Number.isInteger(year)||year<1888||year>2100||!Number.isFinite(rating)||rating<0||rating>10||!['movie','series','animation','anime'].includes(type))return 'Namuna: /meta '+id+' 2018 6.5 movie';
  await db.execute({sql:'UPDATE movies SET year=?,rating=?,type=?,updated_at=? WHERE id=?',args:[year,rating,type,updated,id]});return 'Film malumotlari saqlandi.';
 }
 const value=parts.join(' ');const column=cmd==='/title'?'title':'description';
 if((column==='title'&&!value)||value.length>(column==='title'?200:3000))return 'Nom 1-200, tavsif 0-3000 belgi.';
 await db.execute({sql:'UPDATE movies SET '+column+'=?,updated_at=? WHERE id=?',args:[value,updated,id]});return 'Saqlandi.';
}
export async function processUpdate(db,update){
 if(!Number.isSafeInteger(update.update_id))return null;
 const t=now();await db.execute({sql:'INSERT INTO telegram_updates(id) VALUES(?) ON CONFLICT(id) DO NOTHING',args:[update.update_id]});
 const claimed=await db.execute({sql:"UPDATE telegram_updates SET status='processing',lease_until=? WHERE id=? AND status!='done' AND lease_until<?",args:[t+60,update.update_id,t]});
 if(!claimed.rowsAffected){
  const existing=await db.execute({sql:'SELECT status FROM telegram_updates WHERE id=?',args:[update.update_id]});
  if(existing.rows[0]?.status==='done')return null;
  throw Object.assign(Error('Update is already processing'),{status:503});
 }
 try{
  const reply=await processMessage(db,update.message||{});
  await db.execute({sql:"UPDATE telegram_updates SET status='done',completed_at=?,lease_until=0 WHERE id=?",args:[now(),update.update_id]});
  return reply;
 }catch(error){
  await db.execute({sql:"UPDATE telegram_updates SET status='pending',lease_until=0 WHERE id=?",args:[update.update_id]});
  throw error;
 }
}
