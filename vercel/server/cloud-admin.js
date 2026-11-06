import {ensureSchema} from './schema.js';
const integer=(value,min=0)=>Number.isSafeInteger(Number(value))&&Number(value)>=min;
const sourceURL=value=>typeof value==='string'&&(/^\/media\/[a-zA-Z0-9_.-]+$/.test(value)||/^https:\/\//.test(value));
export async function cloudStatus(db){
 const rows=await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
 const names=new Set(rows.rows.map(row=>row.name));
 return {database_connected:true,schema_ready:['movies','sources','telegram_updates','site_settings'].every(name=>names.has(name))};
}
export async function initializeCatalog(db,body){
 if(!Array.isArray(body.movies)||body.movies.length>100)throw Object.assign(Error('Import accepts up to 100 films'),{status:400});
 const seen=new Set();
 for(const row of body.movies){
  if(!integer(row.id,1)||seen.has(Number(row.id))||typeof row.file_unique_id!=='string'||!row.file_unique_id||typeof row.file_id!=='string'||!row.file_id||typeof row.title!=='string'||!row.title.trim()||row.title.length>200||!integer(row.file_size,1)||!integer(row.source_message_id,1))throw Object.assign(Error('Invalid movie metadata'),{status:400});
  seen.add(Number(row.id));
 }
 const schema=await ensureSchema(db);
 for(const row of body.movies){
  const existing=await db.execute({sql:'SELECT id,file_unique_id FROM movies WHERE id=? OR file_unique_id=?',args:[Number(row.id),row.file_unique_id]});
  if(existing.rows.some(old=>Number(old.id)!==Number(row.id)||old.file_unique_id!==row.file_unique_id))throw Object.assign(Error('Existing catalog IDs conflict; no movies were replaced'),{status:409});
 }
 const t=Math.floor(Date.now()/1000),statements=[];
 for(const row of body.movies){
  statements.push({sql:'INSERT INTO movies(id,file_unique_id,file_id,title,description,duration,file_size,poster_file_id,banner_file_id,poster_url,backdrop_url,genres,type,year,rating,deleted,source_chat_id,source_message_id,mime_type,file_name,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(file_unique_id) DO UPDATE SET file_id=excluded.file_id,source_chat_id=excluded.source_chat_id,source_message_id=excluded.source_message_id,mime_type=excluded.mime_type,file_name=excluded.file_name',
   args:[Number(row.id),row.file_unique_id,row.file_id,row.title,(row.description||'').slice(0,3000),Number(row.duration)||0,Number(row.file_size),row.poster_file_id||null,row.banner_file_id||null,row.poster_url||null,row.backdrop_url||null,JSON.stringify(row.genres||[]),row.type||'movie',Number(row.year)||null,Number(row.rating)||0,row.deleted?1:0,String(row.source_chat_id||''),Number(row.source_message_id),row.mime_type||'video/mp4',row.file_name||'',Number(row.created_at)||t,t]});
  for(const source of row.sources||[]){
   if(!['original','480','720','1080','hls'].includes(source.quality)||!sourceURL(source.url))continue;
   statements.push({sql:'INSERT INTO sources(movie_id,quality,url) VALUES(?,?,?) ON CONFLICT(movie_id,quality) DO NOTHING',args:[Number(row.id),source.quality,source.url]});
  }
 }
 if(body.home&&typeof body.home==='object')statements.push({sql:"INSERT INTO site_settings(key,value) VALUES('home',?) ON CONFLICT(key) DO NOTHING",args:[JSON.stringify(body.home)]});
 if(statements.length)await db.batch(statements,'write');
 return {ok:true,imported:body.movies.length,branding_updated:schema.branding_updated};
}
