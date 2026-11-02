import {database,demoEnabled,demoMovies,send,query} from '../server/core.js';
import {bundledCatalog,publicBundledMovie} from '../server/bundled.js';
import {titleDetails} from '../server/series.js';
export default async function handler(req,res){
 if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
 try{
  const p=query(req),bundled=bundledCatalog();
  if(bundled||demoEnabled()){
   const row=(bundled||demoMovies()).find(m=>String(m.id)===String(p.id));
   if(!row)return send(res,404,{error:'Film topilmadi.'});
   const movie=bundled?publicBundledMovie(row):row;
   return send(res,200,{movie,seasons:[],episodes:[],total:0,has_more:false,direct_available:movie.available,entry_episode:null,navigation:{previous:null,next:null}});
  }
  return send(res,200,await titleDetails(database(),p.id,p),5);
 }catch(error){return send(res,error.status||500,{error:error.status?error.message:'Film ma\u2019lumotlarini ochib bo\u2018lmadi.'});}
}
