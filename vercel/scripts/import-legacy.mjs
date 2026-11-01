import {existsSync,readFileSync} from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
const {database}=await import('../server/core.js');const db=database();
const rows=JSON.parse(readFileSync(process.argv[2]||'.private/legacy.json','utf8'));
const {ensureSchema}=await import('../server/schema.js');
await ensureSchema(db);
for(let start=0;start<rows.length;start+=50){
 const statements=rows.slice(start,start+50).map(row=>({
  sql:'INSERT INTO movies(id,file_unique_id,file_id,title,description,duration,file_size,poster_file_id,banner_file_id,deleted,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(file_unique_id) DO UPDATE SET file_id=excluded.file_id,updated_at=excluded.updated_at',
  args:[Number(row.id),row.file_unique_id,row.file_id,row.title,row.description||'',Number(row.duration)||0,Number(row.file_size)||0,row.poster_file_id||null,row.banner_file_id||null,Number(row.deleted)||0,Number(row.created_at)||Math.floor(Date.now()/1000),Math.floor(Date.now()/1000)]
 }));
 await db.batch(statements,'write');
}
db.close();console.log(rows.length+' movie metadata imported. Attach real video sources with /source.');
