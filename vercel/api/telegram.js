
import {authorize,database,telegram,send} from '../server/core.js';
import {processUpdate} from '../server/bot.js';
export default async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 if(!authorize(req.headers['x-telegram-bot-api-secret-token'],process.env.TELEGRAM_WEBHOOK_SECRET))return send(res,401,{error:'Unauthorized'});
 try{
  const update=typeof req.body==='string'?JSON.parse(req.body):req.body;
  const reply=await processUpdate(database(),update||{});
  if(reply){try{await telegram('sendMessage',{chat_id:update.message.chat.id,text:reply});}catch{/* Catalog remains committed; avoid duplicate updates. */}}
  send(res,200,{ok:true});
 }catch{return send(res,503,{error:'Retry later'});}
}
