import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const input=await new Promise((resolve,reject)=>{
 let value='';
 const terminal=process.stdin.isTTY;
 const finish=()=>{process.stdin.removeAllListeners('data');if(terminal)process.stdin.setRawMode(false);process.stdin.pause();resolve(value);};
 if(terminal)process.stdin.setRawMode(true);
 console.log('Ready for private site configuration (input is hidden).');
 process.stdin.setEncoding('utf8');
 process.stdin.on('data',chunk=>{value+=chunk;if(value.includes('\n')||value.includes('\r'))finish();if(value.length>65536)reject(Error('Input too large'));});
 process.stdin.once('end',finish);process.stdin.resume();
});
const values=JSON.parse(input);
const allowed=['SITE_URL','SITE_SERVICE_TOKEN','SITE_SYNC_KEY'];
const target=fileURLToPath(new URL('.env',import.meta.url));
let lines=readFileSync(target,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line && !allowed.includes(line.split('=',1)[0].trim()));
for(const key of allowed){if(typeof values[key]!=='string'||/[\r\n]/.test(values[key]))throw Error('Invalid config');lines.push(key+'='+values[key]);}
writeFileSync(target+'.tmp',lines.join('\n')+'\n');renameSync(target+'.tmp',target);
console.log('Site credentials saved without displaying them.');
