import {readFileSync} from 'node:fs';
export function bundledCatalog(){
 if(process.env.TURSO_DATABASE_URL||process.env.CATALOG_MODE==='demo')return null;
 try{
  const data=JSON.parse(readFileSync(new URL('./bot-catalog.json',import.meta.url),'utf8'));
  if(data.version!==1||!Array.isArray(data.movies))throw Error('Invalid exported bot catalog');
  // A hosted build can serve bundled public files and HTTPS media, without the notebook cache.
  if(process.env.VERCEL)return data.movies.map(movie=>{
   const sources=(movie.sources||[]).filter(source=>typeof source.url==='string'&&(source.url.startsWith('/media/')||source.url.startsWith('https://')));
   return {...movie,sources,available:Boolean(sources.length)};
  }).filter(movie=>movie.available);
  return data.movies;
 }catch(error){if(error.code==='ENOENT')return null;throw error;}
}
export function publicBundledMovie(row){const {sources,cache_key,media_type,...movie}=row;return movie;}

export function bundledHome(movies){
 if(!movies)return null;
 let settings={};try{settings=JSON.parse(readFileSync(new URL('./bot-catalog.json',import.meta.url),'utf8')).home||{};}catch{}
 const pick=key=>Array.isArray(settings[key])?settings[key].map(id=>movies.find(m=>String(m.id)===String(id))).filter(Boolean).map(publicBundledMovie):null;
 return {hero:pick('hero_ids'),recommendations:pick('recommendation_ids')};
}
