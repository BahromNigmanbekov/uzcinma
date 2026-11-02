import {ensureSeriesSchema} from './series.js';
import * as schemaModule from './schema-statements.json' with {type:'json'};
const statements=schemaModule.default||schemaModule;
export async function ensureSchema(db){
 await db.batch(statements,'write');
 const result=await db.execute('PRAGMA table_info(movies)');
 const columns=new Set(result.rows.map(row=>row.name));
 for(const [name,type] of Object.entries({banner_file_id:'TEXT',source_chat_id:'TEXT',source_message_id:'INTEGER',mime_type:'TEXT',file_name:'TEXT'})){
  if(!columns.has(name))await db.execute('ALTER TABLE movies ADD COLUMN '+name+' '+type);
 }
 await ensureSeriesSchema(db);
}
