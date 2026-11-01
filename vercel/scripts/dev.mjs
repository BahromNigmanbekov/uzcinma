import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {servePublicMedia} from '../server/serve-media.js';
import {createAdminService} from '../server/admin-service.js';
let adminService;
const admin=()=>adminService??=createAdminService();
if(existsSync('.env'))process.loadEnvFile('.env');
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:5177');
  if(url.pathname.startsWith('/api/manage/'))return (await admin()).handle(req,res);
  // Resolve new uploads dynamically, independently of Vite's startup public-file cache.
  if(url.pathname.startsWith('/media/'))return servePublicMedia(req,res,fileURLToPath(new URL('../public/media/',import.meta.url)));
  const allowed=['catalog','playback','telegram','poster','admin','stream','local-media'];
  const name=url.pathname.slice(5);
  if(!allowed.includes(name)){res.writeHead(404);return res.end();}
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1024*1024){res.writeHead(413);return res.end();}chunks.push(chunk);}
  req.query=Object.fromEntries(url.searchParams);
  const raw=Buffer.concat(chunks).toString();req.body=raw?JSON.parse(raw):{};
  res.status=code=>{res.statusCode=code;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
  const module=await import('../api/'+name+'.js');
  await module.default(req,res);
 }catch{res.writeHead(500);res.end(JSON.stringify({error:'Local API error'}));}
});
server.requestTimeout=0;
server.listen(5177,'127.0.0.1',()=>console.log('Local API http://127.0.0.1:5177'));
const python=process.env.PYTHON||(process.platform==='win32'?'python':'python3');
const sync=spawn(python,['scripts/watch-bot-videos.py'],{stdio:'inherit',windowsHide:true});
sync.on('error',()=>console.log('Local bot synchronization could not start.'));
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js'],{stdio:'inherit'});
function close(){server.close();child.kill();sync.kill();}
process.on('SIGINT',close);process.on('SIGTERM',close);child.on('exit',()=>server.close());
