import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve,dirname,posix} from 'node:path';
const output=resolve('dist'),index=resolve(output,'index.html'),html=readFileSync(index,'utf8');
const source=readFileSync(resolve('index.html'),'utf8').replace('src="/src/main.js"','src="/app-client.js"').replace('</head>','<link rel="stylesheet" href="/app-client.css"></head>');
writeFileSync(resolve('server/seo-shell.js'),'// Generated from index.html by scripts/seo-assets.mjs.\nexport const seoShell='+JSON.stringify(source)+';\n');
const scripts=[...html.matchAll(/<script\b[^>]*type="module"[^>]*src="([^"]+)"[^>]*>/g)].map(m=>m[1]);
const styles=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map(m=>m[1]);
if(!scripts.length||!styles.length)throw Error('Vite client entries were not found');
const localFile=path=>{const file=resolve(output,'.'+path);if(!file.startsWith(output+posix.sep)&&!file.startsWith(output+'\\'))throw Error('Invalid client entry');return file;};
writeFileSync(resolve(output,'app-client.js'),scripts.map(src=>'import '+JSON.stringify(src)+';').join('\n')+'\n');
const css=styles.map(path=>{
 const content=readFileSync(localFile(path),'utf8');
 return content.replace(/url\((['"]?)([^)'"]+)\1\)/g,(all,quote,url)=>{
  if(/^(?:[a-z]+:|\/|#)/i.test(url))return all;return 'url('+JSON.stringify(posix.join(posix.dirname(path),url))+')';
 });
}).join('\n');
writeFileSync(resolve(output,'app-client.css'),css);
// The source index.html is bundled with the HTML function. Removing the deployed
// static index lets Vercel route / through that function instead of filesystem priority.
if(process.env.VERCEL==='1'){if(dirname(index)!==output)throw Error('Invalid output path');unlinkSync(index);}
console.log('Prepared stable client entries for SEO HTML');
