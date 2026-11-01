import {readFileSync} from 'node:fs';
export async function ensureSchema(db){
 const sql=readFileSync(new URL('./schema.sql',import.meta.url),'utf8').split(';').map(s=>s.trim()).filter(Boolean);
 await db.batch(sql,'write');
 const columns=await db.execute('PRAGMA table_info(movies)');
 if(!columns.rows.some(row=>row.name==='banner_file_id'))await db.execute('ALTER TABLE movies ADD COLUMN banner_file_id TEXT');
}
