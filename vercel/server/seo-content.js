import {database,demoEnabled,demoMovies,movieDTO} from './core.js';
import {bundledCatalog,publicBundledMovie,bundledHome} from './bundled.js';
import {ensureSeriesSchema,availabilitySQL,titleDetails} from './series.js';
import {ensureCreditsSchema,emptyCredits} from './credits.js';
import {liveHome} from './live-catalog.js';
import {getSEOSettings} from './seo-settings.js';
import {DEFAULT_SEO,dateISO} from '../shared/seo.js';
const seconds=column=>'CASE WHEN '+column+'>100000000000 THEN '+column+'/1000 ELSE '+column+' END';
const modifiedSQL='MAX(COALESCE('+seconds('m.updated_at')+',0),COALESCE((SELECT MAX('+seconds('c.updated_at')+') FROM movies c WHERE c.collection_id=m.id AND c.deleted=0),0),COALESCE((SELECT '+seconds('tc.updated_at')+' FROM title_credits tc WHERE tc.movie_id=m.id),0))';
export function createSEORepository({db,config=process.env,bundled}={}){
 const snapshot=bundled===undefined?bundledCatalog():bundled,local=snapshot||(demoEnabled()?demoMovies():null);let ready;
 const connection=()=>db||database();
 const init=()=>ready??=(async()=>{await ensureSeriesSchema(connection());await ensureCreditsSchema(connection());})().catch(e=>{ready=undefined;throw e;});
 return {mode:local&&!snapshot?'demo':'live',provider:local?(snapshot?'bot-export':'demo'):'telegram-live',
  async settings(){return local?{...DEFAULT_SEO}:getSEOSettings(connection());},
  async count(){if(local)return local.filter(m=>!m.collection_id&&!m.deleted).length;await init();return Number((await connection().execute('SELECT COUNT(*) AS n FROM movies WHERE deleted=0 AND collection_id IS NULL')).rows[0].n);},
  async roots(offset=0,limit=1000){
   if(local)return local.filter(m=>!m.collection_id&&!m.deleted).sort((a,b)=>Number(b.id)-Number(a.id)).slice(offset,offset+limit).map(m=>({movie:publicBundledMovie(m),modified:dateISO(m.updated_at)}));
   await init();const rows=await connection().execute({sql:'SELECT m.*,'+availabilitySQL()+' AS available,'+modifiedSQL+' AS seo_modified FROM movies m WHERE m.deleted=0 AND m.collection_id IS NULL ORDER BY m.created_at DESC,m.id DESC LIMIT ? OFFSET ?',args:[limit,offset]});
   return rows.rows.map(row=>({movie:movieDTO(row),modified:dateISO(row.seo_modified)}));
  },
  async home(){if(local)return bundledHome(local);await init();return liveHome(connection());},
  async title(id,params={}){
   if(local){const row=local.find(m=>String(m.id)===String(id)&&!m.deleted);if(!row)throw Object.assign(Error('Film topilmadi.'),{status:404});return {movie:publicBundledMovie(row),modified:dateISO(row.updated_at),credits:emptyCredits(),seasons:[],episodes:[],total:0,has_more:false,direct_available:row.available,entry_episode:null,navigation:{previous:null,next:null}};}
   await init();const detail=await titleDetails(connection(),id,params);const row=(await connection().execute({sql:'SELECT '+modifiedSQL+' AS changed FROM movies m WHERE m.id=?',args:[Number(detail.movie.id)]})).rows[0];return {...detail,modified:dateISO(row?.changed)};
  }
 };
}
