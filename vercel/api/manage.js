import {database} from '../server/core.js';
import {createCloudManage} from '../server/cloud-manage.js';
let service;
export default async function handler(req,res){
 try{return await (service??=createCloudManage({db:database()})).handle(req,res);}
 catch{res.statusCode=503;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error:'Admin bazasiga ulanib bolmadi. Bir ozdan qayta urinib koring.'}));}
}
