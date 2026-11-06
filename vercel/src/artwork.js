export const DEFAULT_POSTER='/assets/uzcinma-poster-v2.png';
export const DEFAULT_BANNER='/assets/uzcinma-banner-v2.png';

export function setImage(image,source,kind='poster'){
 const fallback=kind==='banner'?DEFAULT_BANNER:DEFAULT_POSTER;
 image.onerror=()=>{image.onerror=null;image.src=fallback;};
 image.src=source||fallback;
 return image;
}

export function setHeroBackground(node,source){
 const apply=url=>{
  node.style.backgroundImage='url('+JSON.stringify(url)+')';
  node.style.backgroundSize=url===DEFAULT_BANNER?'var(--hero-default-size, cover)':'var(--hero-image-size, cover)';
  node.style.backgroundPosition=url===DEFAULT_BANNER?'var(--hero-default-position, center)':'var(--hero-image-position, center 30%)';
  node.style.backgroundRepeat='no-repeat';
 };
 apply(source||DEFAULT_BANNER);
 if(source&&source!==DEFAULT_BANNER){const probe=new Image();probe.onerror=()=>apply(DEFAULT_BANNER);probe.src=source;}
}

const posterRequests=new WeakMap();
export function setVideoPoster(video,source){
 const request=Symbol();posterRequests.set(video,request);
 if(source&&video.getAttribute('poster')===source)return;
 video.poster=DEFAULT_BANNER;
 if(!source||source===DEFAULT_BANNER)return;
 const probe=new Image();
 probe.onload=()=>{if(posterRequests.get(video)===request)video.poster=source;};
 probe.src=source;
}
