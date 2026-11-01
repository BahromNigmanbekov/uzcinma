export const MAX_ADMIN_IMAGE_BYTES=2*1024*1024;
const prepared=new WeakMap();
export async function prepareAdminImage(file,kind){
 if(file.size<=MAX_ADMIN_IMAGE_BYTES)return file;
 let values=prepared.get(file);if(!values){values=new Map();prepared.set(file,values);}
 if(!values.has(kind))values.set(kind,compressAdminImage(file,kind));
 return values.get(kind);
}
async function compressAdminImage(file,kind){
 if(file.size<=MAX_ADMIN_IMAGE_BYTES)return file;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('JPG, PNG yoki WebP rasm tanlang.');
 let bitmap,url;
 try{
  if(typeof createImageBitmap==='function')bitmap=await createImageBitmap(file);
  else{url=URL.createObjectURL(file);bitmap=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Rasm ochilmadi.'));img.src=url;});}
  const width=kind==='banner'?1920:1000,height=kind==='banner'?1080:1500;
  let scale=Math.min(1,width/bitmap.width,height/bitmap.height);
  const canvas=document.createElement('canvas');
  for(let round=0;round<3;round++){
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const context=canvas.getContext('2d');context.fillStyle='#08080b';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   for(const quality of [.9,.8,.65]){
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
    if(blob&&blob.size<=MAX_ADMIN_IMAGE_BYTES)return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
   }
   scale*=.75;
  }
  throw Error('Rasmni kichikroq variantda tanlang.');
 }finally{bitmap?.close?.();if(url)URL.revokeObjectURL(url);}
}
