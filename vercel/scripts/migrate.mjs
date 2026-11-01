import {existsSync,readFileSync} from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
const {database}=await import('../server/core.js');
const {ensureSchema}=await import('../server/schema.js');
const db=database();await ensureSchema(db);db.close();console.log('Catalog schema ready. No credentials printed.');
