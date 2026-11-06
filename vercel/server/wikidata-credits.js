import {ensureCreditsSchema,getCredits,writeCredits,CREDIT_LIMITS} from './credits.js';
const fault=(message,status=400)=>Object.assign(Error(message),{status});
const qid=value=>{if(!/^Q[1-9]\d{0,11}$/.test(String(value)))throw fault('Wikidata yozuvi noto\u2018g\u2018ri.');return String(value);};
const claims=(entity,property)=>(entity.claims?.[property]||[]).filter(s=>s.rank!=='deprecated'&&s.mainsnak?.snaktype==='value');
const value=statement=>statement?.mainsnak?.datavalue?.value;
const label=entity=>entity?.labels?.uz?.value||entity?.labels?.en?.value||entity?.labels?.ru?.value||entity?.id||'';
const description=entity=>entity?.descriptions?.uz?.value||entity?.descriptions?.en?.value||'';
const year=entity=>{for(const property of ['P577','P580']){const time=value(claims(entity,property)[0])?.time,match=/^\+?(\d{4})-/.exec(time||'');if(match)return match[1];}return '';};
const filmTypes=new Set(['Q11424','Q5398426','Q202866','Q1259759','Q581714','Q24869','Q15416']);
const isTitle=entity=>claims(entity,'P161').length||claims(entity,'P57').length||claims(entity,'P31').some(s=>filmTypes.has(value(s)?.id));
const fileKey=name=>String(name||'').normalize('NFC').replace(/_/g,' ');
const plain=text=>String(text||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
const overrides=(before,after)=>({...after,...(before?.overrides||{}),overrides:before?.overrides||{}});
export function createWikidataService({db,fetchImpl=fetch,now=()=>Date.now()}){
 async function request(host,params,ttl=86400000){
  await ensureCreditsSchema(db);const url=new URL(host);for(const [key,data]of Object.entries({...params,format:'json',maxlag:'5'}))url.searchParams.set(key,data);
  const key='wikimedia:'+url.href,hit=(await db.execute({sql:'SELECT payload FROM tmdb_lookup_cache WHERE key=? AND expires>?',args:[key,now()]})).rows[0];if(hit){try{return JSON.parse(hit.payload);}catch{}}
  let result;try{const response=await fetchImpl(url,{headers:{Accept:'application/json','User-Agent':'Uzcinma/1.0 (https://uzcinma.uz; movie metadata import)'},signal:AbortSignal.timeout(12000),redirect:'error'});if(!response.ok)throw fault(response.status===429?'Wikimedia biroz kutishni so\u2018radi. Keyinroq qayta urining.':'Wikimedia bilan aloqa amalga oshmadi.',response.status===429?429:503);const raw=await response.text();if(raw.length>8*1024*1024)throw fault('Wikimedia javobi juda katta.',502);result=JSON.parse(raw);if(result.error)throw fault('Wikimedia hozir band. Keyinroq qayta urining.',503);}
  catch(error){if(error.status)throw error;throw fault('Wikimedia bilan ulanish uzildi. Qayta urinib ko\u2018ring.',503);}
  await db.batch([{sql:'DELETE FROM tmdb_lookup_cache WHERE expires<=?',args:[now()]},{sql:'INSERT INTO tmdb_lookup_cache(key,payload,expires) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,expires=excluded.expires',args:[key,JSON.stringify(result),now()+ttl]}],'write');return result;
 }
 async function entities(ids){
  const unique=[...new Set(ids.filter(Boolean).map(qid))],all={};
  for(let offset=0;offset<unique.length;offset+=50){const result=await request('https://www.wikidata.org/w/api.php',{action:'wbgetentities',ids:unique.slice(offset,offset+50).join('|'),props:'labels|descriptions|claims',languages:'uz|en|ru',languagefallback:'1'});Object.assign(all,result.entities||{});}
  return all;
 }
 async function search(query){
  const q=String(query||'').trim().slice(0,120);if(q.length<2)throw fault('Kamida 2 belgi yozing.');
  const result=await request('https://www.wikidata.org/w/api.php',{action:'wbsearchentities',search:q,language:'en',uselang:'uz',type:'item',limit:'15'},600000),ids=(result.search||[]).map(row=>row.id);
  if(!ids.length)return {results:[]};const rows=await entities(ids);
  return {results:ids.map(id=>rows[id]).filter(entity=>entity&&!('missing'in entity)&&isTitle(entity)).map(entity=>({wikidata_id:entity.id,title:label(entity),year:year(entity),description:description(entity),cast_count:claims(entity,'P161').length,url:'https://www.wikidata.org/wiki/'+entity.id}))};
 }
 async function photos(fileNames){
  const files=[...new Set(fileNames.filter(name=>typeof name==='string'&&name.length<300&&!/[\u0000-\u001f|]/.test(name)))],output=new Map();
  for(let offset=0;offset<files.length;offset+=50){
   const result=await request('https://commons.wikimedia.org/w/api.php',{action:'query',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'185',titles:files.slice(offset,offset+50).map(name=>'File:'+name).join('|')});
   for(const page of Object.values(result.query?.pages||{})){
    const image=page.imageinfo?.[0],meta=image?.extmetadata||{},license=plain(meta.LicenseShortName?.value),licenseURL=meta.LicenseUrl?.value||'';
    if(!image||!(/^(CC BY(?:-SA)?(?: |$)|CC0|Public domain)/i.test(license)))continue;
    const author=plain(meta.Artist?.value).slice(0,200);if(/^CC BY/i.test(license)&&!author)continue;
    const photo=image.thumburl||image.url;
    if(!/^https:\/\/upload\.wikimedia\.org\//.test(photo||'')||!/^https:\/\/commons\.wikimedia\.org\//.test(image.descriptionurl||''))continue;
    if(licenseURL&&!/^https?:\/\/(?:creativecommons\.org|commons\.wikimedia\.org)\//.test(licenseURL))continue;
    output.set(fileKey(String(page.title).replace(/^File:/,'')),{photo,photo_credit:{author:author||'Wikimedia Commons',license:license.slice(0,80),license_url:licenseURL.replace(/^http:/,'https:'),url:image.descriptionurl,changes:'Surat doira ichida kesib ko\u2018rsatilgan.'}});
   }
  }
  return output;
 }
 async function importTitle(id,input){
  await ensureCreditsSchema(db);const current=await getCredits(db,id),revision=input.revision===undefined?current.revision:Number(input.revision);if(!Number.isSafeInteger(revision)||revision!==current.revision)throw fault('Ma\u2019lumot o\u2018zgargan. Qayta oching.',409);
  const item=qid(input.wikidata_id),title=(await entities([item]))[item];if(!title||'missing'in title||!isTitle(title))throw fault('Wikidatada bu film yoki serial ma\u2019lumotlari topilmadi.',404);
  const actorClaims=claims(title,'P161').slice(0,100).sort((a,b)=>Number(a.qualifiers?.P1545?.[0]?.datavalue?.value||999)-Number(b.qualifiers?.P1545?.[0]?.datavalue?.value||999)),directors=claims(title,'P57').slice(0,20).map(s=>value(s)?.id).filter(Boolean),roles=new Map();
  for(const statement of actorClaims){const person=value(statement)?.id;if(!person)continue;if(!roles.has(person))roles.set(person,{characters:[],text:[]});const row=roles.get(person);for(const snak of statement.qualifiers?.P453||[])if(snak.datavalue?.value?.id)row.characters.push(snak.datavalue.value.id);for(const snak of statement.qualifiers?.P4633||[])if(typeof snak.datavalue?.value==='string')row.text.push(snak.datavalue.value);}
  const actors=[...roles.keys()].slice(0,60),linked=await entities([...actors,...directors,...actors.flatMap(id=>roles.get(id).characters)]),filenames=[...actors,...directors].map(id=>value(claims(linked[id]||{},'P18')[0]));let images;try{images=await photos(filenames);}catch(error){if(![429,503].includes(error.status))throw error;images=new Map();}
  const previous=new Map(current.wikidata?.id===item?[...current.cast,...current.directors].map(p=>[p.id,p]):[]);
  function person(id,kind){
   const entity=linked[id];if(!entity||'missing'in entity||/^Q\d+$/.test(label(entity)))return null;const filename=value(claims(entity,'P18')[0]),image=images.get(fileKey(filename)),key='wikidata-'+kind+'-'+id,role=roles.get(id);
   const names=kind==='director'?['Rejissyor']:[...(role?.text||[]),...(role?.characters||[]).map(q=>label(linked[q])).filter(name=>name&&!/^Q\d+$/.test(name))];
   return overrides(previous.get(key),{id:key,name:label(entity).slice(0,120),role:[...new Set(names)].slice(0,6).join(' / ').slice(0,240),photo:image?.photo||null,photo_credit:image?.photo_credit||null,wikidata_id:id,tmdb_id:null,source:'wikidata'});
  }
  const cast=actors.map(id=>person(id,'actor')).filter(Boolean),crew=[...new Set(directors)].map(id=>person(id,'director')).filter(Boolean),manualCast=current.cast.filter(p=>p.source==='manual'),manualDirectors=current.directors.filter(p=>p.source==='manual');
  if(cast.length+manualCast.length>CREDIT_LIMITS.cast||crew.length+manualDirectors.length>CREDIT_LIMITS.directors)throw fault('Ro\u2018yxatda joy yetmayapti. Ortiqcha qo\u2018lda kiritilgan yozuvlarni olib tashlang.');
  if(!cast.length&&!crew.length)throw fault('Bu asarda aktyor yoki rejissyor ro\u2018yxati hali to\u2018ldirilmagan. Qo\u2018lda qo\u2018shishingiz mumkin.');
  return writeCredits(db,id,{cast:[...cast,...manualCast],directors:[...crew,...manualDirectors],tmdb:null,wikidata:{provider:'wikidata',id:item,title:label(title),year:year(title),url:'https://www.wikidata.org/wiki/'+item}},revision);
 }
 async function disconnect(id,revision){const current=await getCredits(db,id);if(Number(revision)!==current.revision)throw fault('Ma\u2019lumot o\u2018zgargan. Qayta oching.',409);return writeCredits(db,id,{cast:current.cast.filter(p=>p.source!=='wikidata'),directors:current.directors.filter(p=>p.source!=='wikidata'),tmdb:current.tmdb,wikidata:null},revision);}
 return {search,importTitle,disconnect};
}
