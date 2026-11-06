export function wikidataFixtureFetch({count=18}={}){
 const item=(id,name,properties={})=>({id,labels:{en:{value:name}},descriptions:{en:{value:'A test film or person'}},claims:properties});
 const claim=(value,qualifiers)=>({rank:'normal',mainsnak:{snaktype:'value',datavalue:{value}},...(qualifiers?{qualifiers}:{})});
 const people=Array.from({length:count},(_,i)=>'Q'+(100+i));
 const rows={
  Q10:item('Q10','Fixture Adventure',{P31:[claim({id:'Q11424'})],P577:[claim({time:'+2024-02-03T00:00:00Z'})],P161:people.map((id,i)=>claim({id},{P1545:[{datavalue:{value:String(i+1)}}],P453:[{datavalue:{value:{id:'Q500'}}}]})),P57:[claim({id:'Q200'})]}),
  Q500:item('Q500','Main Character'),Q200:item('Q200','Fixture Director',{P18:[claim('Director.jpg')]}),
  Q999:item('Q999','Unrelated person'),Q900:item('Q900','Film poster',{P31:[claim({id:'Q374821'})],P161:[claim({id:'Q100'})]}),
  ...Object.fromEntries(people.map((id,i)=>[id,item(id,i===0?'A Very Long Actor Name That Must Stay Readable':'Actor '+(i+1),{P18:[claim(i===1?'Unknown-license.jpg':'Actor-'+i+'.jpg')]})]))
 };
 const calls=[];
 const fetchImpl=async url=>{
  calls.push(url.href);if(!['www.wikidata.org','commons.wikimedia.org'].includes(url.hostname))throw Error('Unexpected host');
  if(url.searchParams.get('action')==='wbsearchentities')return Response.json({search:[{id:'Q10'},{id:'Q999'},{id:'Q900'}]});
  if(url.searchParams.get('action')==='wbgetentities')return Response.json({entities:Object.fromEntries(url.searchParams.get('ids').split('|').map(id=>[id,rows[id]||{id,missing:''}]))});
  if(url.hostname==='commons.wikimedia.org'){
   const titles=url.searchParams.get('titles').split('|');
   return Response.json({query:{pages:Object.fromEntries(titles.map((title,i)=>[String(i+1),{title,imageinfo:[{url:'https://upload.wikimedia.org/wikipedia/commons/a/ab/'+encodeURIComponent(title.slice(5)),thumburl:'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/'+encodeURIComponent(title.slice(5))+'/185px-'+encodeURIComponent(title.slice(5)),descriptionurl:'https://commons.wikimedia.org/wiki/'+encodeURIComponent(title),extmetadata:{Artist:{value:'<a href="/user">Fixture Photographer</a>'},LicenseShortName:{value:title.includes('Unknown-license')?'Unknown':'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'}}}]}]))}});
  }
  return new Response('{}',{status:404});
 };
 return {fetchImpl,calls,rows};
}
