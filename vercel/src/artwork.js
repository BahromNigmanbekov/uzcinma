export const DEFAULT_POSTER='/assets/uzcinma-poster.png';
export const DEFAULT_BANNER='/assets/uzcinma-banner.png';

export function setImage(image,source,kind='poster'){
 const fallback=kind==='banner'?DEFAULT_BANNER:DEFAULT_POSTER;
 image.onerror=()=>{image.onerror=null;image.src=fallback;};
 image.src=source||fallback;
 return image;
}

export function setHeroBackground(node,source){
 const images=[...new Set([source||DEFAULT_BANNER,DEFAULT_BANNER])];
 node.style.backgroundImage=images.map(url=>'url('+JSON.stringify(url)+')').join(',');
 node.style.backgroundSize=images.map(url=>url===DEFAULT_BANNER?'var(--hero-default-size, cover)':'cover').join(',');
 node.style.backgroundRepeat='no-repeat';
 node.style.backgroundPosition=images.map(url=>url===DEFAULT_BANNER?'var(--hero-default-position, center)':'center 30%').join(',');
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
