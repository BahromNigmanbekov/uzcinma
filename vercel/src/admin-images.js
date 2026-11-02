export const MAX_ADMIN_IMAGE_BYTES=2*1024*1024;
const prepared=new WeakMap();
export async function prepareAdminImage(file,kind){
 if(file.size<=MAX_ADMIN_IMAGE_BYTES)return file;
 let values=prepared.get(file);if(!values){values=new Map();prepared.set(file,values);}
 if(!values.has(kind))values.set(kind,compressAdminImage(file,kind));
 return values.get(kind);
}
async function compressAdminImage(file,kind){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('JPG, PNG yoki WebP rasm tanlang.');
 let bitmap,url;
 try{
  if(typeof createImageBitmap==='function')bitmap=await createImageBitmap(file);
  else{url=URL.createObjectURL(file);bitmap=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Rasm ochilmadi.'));img.src=url;});}
  // Start at the original resolution; only very large images need resizing.
  let scale=Math.min(1,4096/bitmap.width,4096/bitmap.height);
  const canvas=document.createElement('canvas');
  for(let round=0;round<4;round++){
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const context=canvas.getContext('2d');context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   for(const quality of [.96,.92,.88]){
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
    if(blob&&blob.size<=MAX_ADMIN_IMAGE_BYTES){
     const extension={'image/webp':'webp','image/png':'png','image/jpeg':'jpg'}[blob.type];
     if(extension)return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.'+extension,{type:blob.type});
    }
   }
   scale*=.85;
  }
  throw Error('Rasm juda katta. Sifatli JPG yoki WebP variantini tanlang.');
 }finally{bitmap?.close?.();if(url)URL.revokeObjectURL(url);}
}
