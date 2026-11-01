import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAdminService} from '../server/admin-service.js';
import {servePublicMedia,streamMediaFile} from '../server/serve-media.js';
const project=fileURLToPath(new URL('../',import.meta.url));process.chdir(project);
if(existsSync('.env'))process.loadEnvFile('.env');
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||5182);
if(!['127.0.0.1','localhost','::1'].includes(host)&&!process.env.ADMIN_PASSWORD&&!existsSync('.private/admin/auth.json'))throw Error('Internet admin service requires ADMIN_PASSWORD before startup.');
let service;const admin=()=>service??=createAdminService({allowedOrigins:['http://127.0.0.1:'+port,'http://localhost:'+port]});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/manage/'))return (await admin()).handle(req,res);
  if(url.pathname.startsWith('/media/')){res.setHeader('Access-Control-Allow-Origin','*');return servePublicMedia(req,res,resolve(project,'public/media'));}
  if(url.pathname.startsWith('/api/')){
   const name=url.pathname.slice(5);if(!['catalog','playback','poster','telegram','admin','stream','local-media'].includes(name)){res.statusCode=404;return res.end();}
   if(['GET','HEAD'].includes(req.method))res.setHeader('Access-Control-Allow-Origin','*');
   req.query=Object.fromEntries(url.searchParams);let size=0;const chunks=[];
   for await(const chunk of req){size+=chunk.length;if(size>1024*1024){res.statusCode=413;return res.end();}chunks.push(chunk);}
   const text=Buffer.concat(chunks).toString();req.body=text?JSON.parse(text):{};
   const module=await import('../api/'+name+'.js');return module.default(req,res);
  }
  const root=resolve(project,'dist');let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/admin'){res.statusCode=308;res.setHeader('Location','/admin/');return res.end();}
  if(pathname.endsWith('/'))pathname+='index.html';
  const path=resolve(root,'.'+pathname);
  if(!path.startsWith(root+sep)||!mime[extname(path)]){res.statusCode=404;return res.end();}
  return streamMediaFile(req,res,path,mime[extname(path)]);
 }catch{if(!res.headersSent){res.statusCode=500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Server sorovni bajara olmadi.'}));}else res.destroy();}
});
server.requestTimeout=0;server.listen(port,host,()=>console.log('Uzcinma uploader: http://'+host+':'+port+'/admin/'));
async function close(){server.close();if(service)(await service).close();}
process.on('SIGINT',close);process.on('SIGTERM',close);
