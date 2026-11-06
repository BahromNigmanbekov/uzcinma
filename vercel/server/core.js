
import {createClient} from '@libsql/client';
import {timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
export function telegramMediaReady(){return Boolean(process.env.BOT_TOKEN&&/^[1-9]\d*$/.test(process.env.API_ID||'')&&/^[a-f0-9]{32}$/i.test(process.env.API_HASH||''));}
export const GENRES=['action','adventure','animation','anime','fantasy','drama','horror','comedy','crime','thriller','romance','family','documentary','biography'];
export const QUALITIES=['hls','480','720','1080','original'];
let client;
export function database(){
 if(!process.env.TURSO_DATABASE_URL)throw Object.assign(Error('Database not configured'),{status:503});
 return client??=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
}
export const demoEnabled=()=>process.env.DEMO_MODE==='1'||(!process.env.TURSO_DATABASE_URL&&process.env.DEMO_MODE!=='0');
export function demoMovies(){
 const rows=JSON.parse(readFileSync(new URL('./demo.json',import.meta.url),'utf8'));
 rows.push({id:'demo-bunny',title:'Big Buck Bunny',year:2008,rating:0,genres:['animation','family'],type:'animation',poster:'/assets/bunny.webp',backdrop:'/assets/bunny-landscape.webp',description:'Sifatlarni va pleyerni tekshirish uchun ochiq HLS sinov videosi. Bu namuna, yuklangan kino emas.',duration:635,is_demo:true,available:true});
 return rows;
}
export function authorize(actual,expected){if(!actual||!expected)return false;const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
export function parseId(value){const text=String(value??'');if(!/^[1-9]\d{0,14}$/.test(text))throw Object.assign(Error('Invalid movie ID'),{status:400});return Number(text);}
export function publicURL(value){
 try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||['localhost','api.telegram.org'].includes(url.hostname)||/^(127\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname))return null;return url.href;}catch{return null;}
}
export function send(res,status,data,cache=false){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control',cache?'public, s-maxage='+(typeof cache==='number'?cache:60)+', stale-while-revalidate='+(typeof cache==='number'?cache:300):'no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data));}
export function fail(res,error){send(res,error.status||500,{error:error.status===400?error.message:error.status===503?'Katalog bazasi sozlanmagan.':'Sorovni bajarib bolmadi.'});}
export function query(req){return req.query||Object.fromEntries(new URL(req.url,'http://localhost').searchParams);}
export function movieDTO(row){
 let genres;try{genres=JSON.parse(row.genres);}catch{genres=[];}
 return {id:String(row.id),title:row.title,description:row.description,genres,year:row.year,rating:row.rating,duration:row.duration,type:row.type,poster:row.poster_url||(row.poster_file_id?'/api/poster?id='+row.id+'&v='+row.updated_at:'/assets/uzcinma-poster-v2.png'),backdrop:row.backdrop_url||(row.banner_file_id?'/api/poster?id='+row.id+'&kind=banner&v='+row.updated_at:'/assets/uzcinma-banner-v2.png'),available:Boolean(row.available||(telegramMediaReady()&&row.source_message_id&&Number(row.file_size)>0)),is_demo:false,logo:row.logo_url||(row.logo_file_id?'/api/poster?id='+row.id+'&kind=logo&v='+row.updated_at:null),is_collection:Boolean(row.is_collection),collection_id:row.collection_id?String(row.collection_id):null,season_number:row.season_number?Number(row.season_number):null,episode_number:row.episode_number?Number(row.episode_number):null};
}
export async function telegram(method,data){
 if(!process.env.BOT_TOKEN)throw Error('Bot token not configured');
 const response=await fetch('https://api.telegram.org/bot'+process.env.BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(8000)});
 const value=await response.json();if(!response.ok||!value.ok)throw Error('Telegram request failed');return value.result;
}
