export const MAX_IMAGE_BYTES=2*1024*1024;
export const IMAGE_MIMES=['image/jpeg','image/png','image/webp'];
export function imageType(body){
 if(body.length>=8&&body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(body.length>=3&&body[0]===255&&body[1]===216&&body[2]===255)return 'image/jpeg';
 if(body.length>=12&&body.subarray(0,4).toString()==='RIFF'&&body.subarray(8,12).toString()==='WEBP')return 'image/webp';
 throw Object.assign(Error('JPG, PNG yoki WebP rasm tanlang.'),{status:400});
}
export function telegramImage(message){
 const document=message.document;
 if(document?.file_id&&IMAGE_MIMES.includes(document.mime_type))return document;
 return message.photo?.at(-1);
}
