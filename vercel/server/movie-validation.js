import {GENRES} from './core.js';
const fault=(message,status=400)=>Object.assign(Error(message),{status});
const types=['movie','series','animation','anime'];
export function validateMovie(input){
 const title=String(input.title||'').trim(),description=String(input.description||'');
 const genres=[...new Set(Array.isArray(input.genres)?input.genres:[])],type=input.type||'movie';
 const year=input.year===''||input.year===null||input.year===undefined?null:Number(input.year),rating=Number(input.rating||0);
 if(!title||title.length>200||description.length>3000)throw fault('Film nomi 1-200, tavsifi 0-3000 belgi bolishi kerak.');
 if(genres.some(g=>!GENRES.includes(g))||!types.includes(type))throw fault('Kategoriya yoki film turi notogri.');
 if(year!==null&&(!Number.isInteger(year)||year<1888||year>2100))throw fault('Yil notogri.');
 if(!Number.isFinite(rating)||rating<0||rating>10)throw fault('Reyting 0-10 oraligida bolishi kerak.');
 return {title,description,genres,type,year,rating};
}
