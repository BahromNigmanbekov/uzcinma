export function zoomBounds(width,height,videoWidth,videoHeight,scale){
 if(!width||!height)return {x:0,y:0};
 const fit=videoWidth>0&&videoHeight>0?Math.min(width/videoWidth,height/videoHeight):1;
 const mediaWidth=videoWidth>0?videoWidth*fit:width,mediaHeight=videoHeight>0?videoHeight*fit:height;
 return {x:Math.max(0,(mediaWidth*scale-width)/2),y:Math.max(0,(mediaHeight*scale-height)/2)};
}
