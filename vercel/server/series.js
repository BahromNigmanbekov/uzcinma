import {movieDTO,parseId,telegramMediaReady} from './core.js';
import {validateMovie} from './movie-validation.js';
const initialized=new WeakMap();
const fault=(message,status=400)=>Object.assign(Error(message),{status});
export function ensureSeriesSchema(db){
 if(!initialized.has(db))initialized.set(db,(async()=>{
  const columns=new Set((await db.execute('PRAGMA table_info(movies)')).rows.map(row=>row.name));
  for(const [name,type]of Object.entries({collection_id:'INTEGER',season_number:'INTEGER',episode_number:'INTEGER',is_collection:'INTEGER NOT NULL DEFAULT 0',logo_file_id:'TEXT',logo_url:'TEXT'})){
   if(!columns.has(name))try{await db.execute('ALTER TABLE movies ADD COLUMN '+name+' '+type);}catch(error){if(!/duplicate column/i.test(error.message))throw error;}
  }
  await db.batch([
   "CREATE TABLE IF NOT EXISTS seasons (series_id INTEGER NOT NULL REFERENCES movies(id),number INTEGER NOT NULL,title TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',PRIMARY KEY(series_id,number))",
   'CREATE UNIQUE INDEX IF NOT EXISTS episode_position ON movies(collection_id,season_number,episode_number) WHERE collection_id IS NOT NULL AND deleted=0',
   'CREATE INDEX IF NOT EXISTS episode_lookup ON movies(collection_id,deleted,season_number,episode_number)'
  ],'write');
 })().catch(error=>{initialized.delete(db);throw error;}));
 return initialized.get(db);
}
export function availabilitySQL(alias='m'){
 const direct=name=>'EXISTS(SELECT 1 FROM sources source WHERE source.movie_id='+name+'.id)'+(telegramMediaReady()?' OR ('+name+'.source_message_id>0 AND '+name+'.file_size>0)':'');
 return '('+direct(alias)+' OR EXISTS(SELECT 1 FROM movies child WHERE child.collection_id='+alias+'.id AND child.deleted=0 AND ('+direct('child')+')))';
}
export const visibleSQL=alias=>alias+'.deleted=0 AND ('+alias+'.collection_id IS NULL OR EXISTS(SELECT 1 FROM movies parent WHERE parent.id='+alias+'.collection_id AND parent.deleted=0))';
export async function titleRow(db,id){
 const row=(await db.execute({sql:'SELECT m.*,'+availabilitySQL()+' AS available FROM movies m WHERE m.id=?',args:[parseId(id)]})).rows[0];
 if(!row)throw fault('Film topilmadi.',404);return row;
}
export async function collectionRow(db,id){
 const row=await titleRow(db,id);if(!row.is_collection||row.collection_id||row.deleted)throw fault('Serial topilmadi.',404);return row;
}
export async function createCollection(db,input){
 await ensureSeriesSchema(db);
 const meta=validateMovie({...input,type:input.type||'series'}),time=Date.now(),created=Math.floor(time/1000);
 const result=await db.execute({sql:'INSERT INTO movies(title,description,type,genres,year,rating,is_collection,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)',args:[meta.title,meta.description,meta.type,JSON.stringify(meta.genres),meta.year,meta.rating,created,time]});
 return movieDTO(await titleRow(db,Number(result.lastInsertRowid)));
}
function positive(value,label,max){const number=Number(value);if(!Number.isSafeInteger(number)||number<1||number>max)throw fault(label+' raqami notogri.');return number;}
export async function saveSeason(db,id,input){
 await ensureSeriesSchema(db);await collectionRow(db,id);
 const number=positive(input.number,'Fasl',1000),title=String(input.title||'').trim(),description=String(input.description||'');
 if(title.length>120||description.length>1000)throw fault('Fasl nomi 120, tavsifi 1000 belgidan oshmasin.');
 await db.batch([
  {sql:'INSERT INTO seasons(series_id,number,title,description) VALUES(?,?,?,?) ON CONFLICT(series_id,number) DO UPDATE SET title=excluded.title,description=excluded.description',args:[parseId(id),number,title,description]},
  {sql:'UPDATE movies SET updated_at=? WHERE id=?',args:[Date.now(),parseId(id)]}
 ],'write');return {number,title,description};
}
export async function removeSeason(db,id,number){
 await ensureSeriesSchema(db);await collectionRow(db,id);number=positive(number,'Fasl',1000);
 const children=await db.execute({sql:'SELECT id FROM movies WHERE collection_id=? AND season_number=? LIMIT 1',args:[parseId(id),number]});
 if(children.rows.length)throw fault('Avval bu fasldagi qismlarni ajrating.',409);
 const removed=await db.execute({sql:'DELETE FROM seasons WHERE series_id=? AND number=? AND NOT EXISTS(SELECT 1 FROM movies WHERE collection_id=? AND season_number=?)',args:[parseId(id),number,parseId(id),number]});if(!removed.rowsAffected)throw fault('Fasl topilmadi yoki unga qism biriktirilgan.',409);return {ok:true};
}
export async function attachEpisode(db,id,input){
 await ensureSeriesSchema(db);
 const root=await collectionRow(db,id),child=await titleRow(db,input.movie_id),season=positive(input.season,'Fasl',1000),episode=positive(input.episode,'Qism',10000);
 if(child.id===root.id||child.is_collection)throw fault('Serialning ozini qism qilib biriktirib bolmaydi.');
 const duplicate=await db.execute({sql:'SELECT id FROM movies WHERE collection_id=? AND season_number=? AND episode_number=? AND deleted=0 AND id!=?',args:[root.id,season,episode,child.id]});
 if(duplicate.rows.length)throw fault('Bu fasl va qism raqami band.',409);
 const name=input.title===undefined?child.title:String(input.title).trim();
 if(!name||name.length>200)throw fault('Qism nomi 1-200 belgi bolsin.');
 const homeResult=await db.execute("SELECT value FROM site_settings WHERE key='home'");let home;try{home=JSON.parse(homeResult.rows[0]?.value||'null');}catch{}
 const updates=[
  {sql:"INSERT INTO seasons(series_id,number,title) VALUES(?,?,'') ON CONFLICT(series_id,number) DO NOTHING",args:[root.id,season]},
  {sql:'UPDATE movies SET collection_id=?,season_number=?,episode_number=?,title=?,updated_at=? WHERE id=?',args:[root.id,season,episode,name,Date.now(),child.id]},
  {sql:'UPDATE movies SET updated_at=? WHERE id=?',args:[Date.now(),root.id]}
 ];
 if(home){for(const key of ['hero_ids','recommendation_ids'])if(Array.isArray(home[key]))home[key]=[...new Set(home[key].map(value=>String(value)===String(child.id)?String(root.id):String(value)))];updates.push({sql:"UPDATE site_settings SET value=? WHERE key='home'",args:[JSON.stringify(home)]});}
 try{await db.batch(updates,'write');}catch(error){if(/unique|constraint/i.test(error.message))throw fault('Bu fasl va qism raqami band.',409);throw error;}
 return {ok:true,id:String(child.id)};
}
export async function detachEpisode(db,id){
 await ensureSeriesSchema(db);const row=await titleRow(db,id);await db.execute({sql:'UPDATE movies SET collection_id=NULL,season_number=NULL,episode_number=NULL,updated_at=? WHERE id=?',args:[Date.now(),row.id]});return {ok:true};
}
export async function restoreTitle(db,id,deleted){
 const row=await titleRow(db,id);
 if(!deleted&&row.collection_id){
  const duplicate=await db.execute({sql:'SELECT id FROM movies WHERE collection_id=? AND season_number=? AND episode_number=? AND deleted=0 AND id!=?',args:[row.collection_id,row.season_number,row.episode_number,row.id]});
  if(duplicate.rows.length)throw fault('Bu qism joyiga boshqa video biriktirilgan. Avval uni ajrating.',409);
 }
 try{await db.execute({sql:'UPDATE movies SET deleted=?,updated_at=? WHERE id=?',args:[deleted?1:0,Date.now(),row.id]});}catch(error){if(/unique|constraint/i.test(error.message))throw fault('Bu fasl va qism raqami band.',409);throw error;}
}
function episodeDTO(row,root,admin){
 const dto=movieDTO(row),parent=movieDTO(root);
 if(!row.poster_file_id&&!row.poster_url)dto.poster=parent.poster;
 if(!row.banner_file_id&&!row.backdrop_url)dto.backdrop=parent.backdrop;
 if(!dto.logo)dto.logo=parent.logo;
 if(admin)dto.deleted=Boolean(row.deleted);
 return dto;
}
export async function titleDetails(db,id,{season,episode,offset=0,limit=100,admin=false}={}){
 await ensureSeriesSchema(db);let root=await titleRow(db,id),requestedEpisode;
 if(root.collection_id){requestedEpisode=root;root=await titleRow(db,root.collection_id);}
 if(!admin&&root.deleted)throw fault('Film topilmadi.',404);
 const summary=await db.execute({sql:'SELECT s.number,s.title,s.description,COUNT(e.id) AS episode_count FROM seasons s LEFT JOIN movies e ON e.collection_id=s.series_id AND e.season_number=s.number'+(admin?'':' AND e.deleted=0')+' WHERE s.series_id=? GROUP BY s.number ORDER BY s.number',args:[root.id]});
 const seasons=summary.rows.map(row=>({...row,number:Number(row.number),episode_count:Number(row.episode_count)}));
 const selected=season===undefined?(requestedEpisode?.season_number||seasons[0]?.number||null):positive(season,'Fasl',1000);
 if(selected!==null&&!seasons.some(s=>s.number===selected))throw fault('Fasl topilmadi.',404);
 offset=Math.max(0,Math.min(100000,Math.floor(Number(offset)||0)));limit=Math.max(1,Math.min(100,Math.floor(Number(limit)||100)));
 const rows=selected===null?{rows:[]} :await db.execute({sql:'SELECT m.*,'+availabilitySQL()+' AS available FROM movies m WHERE m.collection_id=? AND m.season_number=?'+(admin?'':' AND m.deleted=0')+' ORDER BY m.episode_number,m.id LIMIT ? OFFSET ?',args:[root.id,selected,limit,offset]});
 const first=(await db.execute({sql:'SELECT m.*,'+availabilitySQL()+' AS available FROM movies m WHERE m.collection_id=? AND m.deleted=0 ORDER BY available DESC,m.season_number,m.episode_number LIMIT 1',args:[root.id]})).rows[0];
 let current=requestedEpisode;
 if(episode!==undefined)current=await titleRow(db,episode);
 if(current&&(Number(current.collection_id)!==Number(root.id)||(!admin&&current.deleted)))throw fault('Qism topilmadi.',404);
 const neighbor=async direction=>{
  if(!current)return null;const op=direction==='next'?'>':'<',order=direction==='next'?'ASC':'DESC';
  const row=(await db.execute({sql:'SELECT m.*,'+availabilitySQL()+' AS available FROM movies m WHERE m.collection_id=? AND m.deleted=0 AND (m.season_number'+op+'? OR (m.season_number=? AND m.episode_number'+op+'?)) ORDER BY m.season_number '+order+',m.episode_number '+order+' LIMIT 1',args:[root.id,current.season_number,current.season_number,current.episode_number]})).rows[0];
  return row?episodeDTO(row,root,admin):null;
 };
 const [previous,next]=await Promise.all([neighbor('previous'),neighbor('next')]);
 const dto=movieDTO(root),direct=Boolean((await db.execute({sql:'SELECT '+(telegramMediaReady()?'(m.source_message_id>0 AND m.file_size>0) OR ':'')+'EXISTS(SELECT 1 FROM sources WHERE movie_id=m.id) AS ready FROM movies m WHERE id=?',args:[root.id]})).rows[0]?.ready);
 return {movie:dto,seasons,selected_season:selected,episodes:rows.rows.map(row=>episodeDTO(row,root,admin)),total:seasons.find(s=>s.number===selected)?.episode_count||0,has_more:offset+limit<(seasons.find(s=>s.number===selected)?.episode_count||0),entry_episode:first?episodeDTO(first,root,admin):null,direct_available:direct,current_episode:current?episodeDTO(current,root,admin):null,navigation:{previous,next}};
}
