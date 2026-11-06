import {DEFAULT_SEO} from '../shared/seo.js';
export async function getSEOSettings(db){
 const row=(await db.execute("SELECT value FROM site_settings WHERE key='seo'")).rows[0];let saved={};try{saved=JSON.parse(row?.value||'{}');}catch{}
 return {...DEFAULT_SEO,google_verification:saved.google_verification||'',bing_verification:saved.bing_verification||'',audio_language:saved.audio_language===undefined?'uz':saved.audio_language==='uz'?'uz':''};
}
export function validateSEOSettings(input){
 const result={};for(const key of ['google_verification','bing_verification']){
  let value=String(input[key]||'').trim();if(value.startsWith('<meta'))value=/content\s*=\s*["']([^"']+)["']/i.exec(value)?.[1]||'!';
  if(value&&!/^[a-zA-Z0-9_-]{8,200}$/.test(value))throw Object.assign(Error('Tasdiqlash kodini yoki to‘liq meta tegini kiriting.'),{status:400});result[key]=value;
 }
 if(!['uz',''].includes(input.audio_language))throw Object.assign(Error('Video tilini tanlang.'),{status:400});result.audio_language=input.audio_language;
 return result;
}
export async function saveSEOSettings(db,input){
 const settings=validateSEOSettings(input);await db.execute({sql:"INSERT INTO site_settings(key,value) VALUES('seo',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",args:[JSON.stringify(settings)]});return settings;
}
