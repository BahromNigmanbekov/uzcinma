import {availabilitySQL} from './series.js';
import {movieDTO} from './core.js';
export async function liveHome(db){
 const settings=await db.execute("SELECT value FROM site_settings WHERE key='home'");
 let value={};try{value=JSON.parse(settings.rows[0]?.value||'{}');}catch{}
 const ids=[...new Set([...(value.hero_ids||[]),...(value.recommendation_ids||[])])].filter(id=>/^[1-9]\d{0,14}$/.test(String(id))).slice(0,60);
 let rows=[];
 if(ids.length)rows=(await db.execute({sql:'SELECT m.*,'+availabilitySQL()+' AS available FROM movies m WHERE m.deleted=0 AND m.collection_id IS NULL AND m.id IN ('+ids.map(()=>'?').join(',')+')',args:ids.map(Number)})).rows;
 const byId=new Map(rows.map(row=>[String(row.id),movieDTO(row)]));
 const pick=key=>Array.isArray(value[key])?value[key].map(id=>byId.get(String(id))).filter(Boolean):null;
 return {hero:pick('hero_ids'),recommendations:pick('recommendation_ids'),selection_sound_enabled:value.selection_sound_enabled!==false};
}
