import test from 'node:test';
import assert from 'node:assert/strict';
import {videoRange,MAX_VIDEO_RANGE,createTelegramStreamHandler} from '../server/telegram-stream.js';
test('video ranges support open, bounded, suffix and files larger than 4GB',()=>{
 const size=6*1024**3;
 assert.deepEqual(videoRange('bytes=4294967296-',size),{start:4294967296,end:4294967296+MAX_VIDEO_RANGE-1});
 assert.deepEqual(videoRange('bytes=0-1',size),{start:0,end:1});
 assert.deepEqual(videoRange('bytes=-99',size),{start:size-99,end:size-1});
 assert.deepEqual(videoRange(undefined,100),{start:0,end:99});
 assert.deepEqual(videoRange('bytes=95-999',100),{start:95,end:99});
 for(const header of ['bytes=100-','bytes=9-2','bytes=1-2,4-5','bytes=-0','garbage','bytes=9007199254740999-'])assert.throws(()=>videoRange(header,100),error=>error.status===416);
});
async function request(handler,{method='GET',range,id='6'}={}){
 let body;const headers={};const res={setHeader:(key,value)=>headers[key]=value,end:value=>body=value};
 await handler({method,query:{id},headers:{range}},res);
 return {status:res.statusCode,headers,body};
}
test('Telegram endpoint reads only requested bytes; HEAD and hidden films do not download',async()=>{
 const reads=[],row={id:6,file_unique_id:'private-id',file_size:10000,source_message_id:40,mime_type:'video/mp4'};
 const handler=createTelegramStreamHandler({configured:()=>true,findMovie:async id=>id===6?row:null,readRange:async(row,start,length)=>{reads.push({start,length});return Buffer.alloc(length,42);}});
 const part=await request(handler,{range:'bytes=120-219'});
 assert.equal(part.status,206);assert.equal(part.headers['Content-Range'],'bytes 120-219/10000');assert.equal(part.body.length,100);
 assert.deepEqual(reads,[{start:120,length:100}]);assert.equal(part.headers['Content-Type'],'video/mp4');
 const head=await request(handler,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers['Content-Length'],10000);assert.equal(reads.length,1);
 const missing=await request(handler,{id:'7'});assert.equal(missing.status,404);assert.equal(reads.length,1);
 const invalid=await request(handler,{range:'bytes=10000-'});assert.equal(invalid.status,416);assert.equal(invalid.headers['Content-Range'],'bytes */10000');
});
test('an unavailable Telegram connection returns a retryable response with no credentials',async()=>{
 const handler=createTelegramStreamHandler({configured:()=>true,findMovie:async()=>({file_size:100,source_message_id:1}),readRange:async()=>{throw Error('never show sensitive upstream errors');}});
 const response=await request(handler);
 assert.equal(response.status,503);assert.equal(response.headers['Retry-After'],'3');assert.equal(response.body.includes('sensitive'),false);
});
