
const paths={
 play:'<path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none"/>',pause:'<path d="M7 5h3v14H7zm7 0h3v14h-3z" fill="currentColor" stroke="none"/>',
 heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 trend:'<path d="m3 17 6-6 4 3 8-10M15 4h6v6"/>',fire:'<path d="M12 2c4 5-1 6 4 10 1-2 2-3 2-3 5 7 1 13-6 13-7 0-10-5-6-12 0 4 4 6 4 3-1-3-1-7 2-11z"/>',
 star:'<path d="m12 2 3 6.5 7 .9-5.1 5 1.3 7.1-6.2-3.4-6.2 3.4 1.3-7.1-5.1-5 7-.9z"/>',
 film:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="m3 10 18-5M6 4l3 5m3-6 3 5m3-6 3 5"/>',
 series:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 22h8m-4-3v3"/>',
 check:'<path d="m5 12 4 4L19 6"/>',left:'<path d="m15 5-7 7 7 7"/>',right:'<path d="m9 5 7 7-7 7"/>',
 volume:'<path d="M11 4 6 8H3v8h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 muted:'<path d="M11 4 6 8H3v8h3l5 4zM16 9l5 6m0-6-5 6"/>',
 settings:'<path d="m9 3 1 3h4l1-3 3 2-1 3 2 3 3-1v4l-3 1-2 3 1 3-3 2-1-3h-4l-1 3-3-2 1-3-2-3-3-1v-4l3 1 2-3-1-3z"/><circle cx="12" cy="12" r="3"/>',
 full:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
 pip:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 11h8v7h-8z" fill="currentColor" stroke="none"/>',
 captions:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M10 10a3 3 0 1 0 0 4m8-4a3 3 0 1 0 0 4"/>',
 rewind:'<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/><text x="8" y="16" fill="currentColor" stroke="none" font-size="8">10</text>',
 forward:'<path d="M20 10a8 8 0 1 0-1 7M20 4v6h-6"/><text x="8" y="16" fill="currentColor" stroke="none" font-size="8">10</text>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
};
export const icon=(name)=>'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.play)+'</svg>';
export function putIcon(id,name){document.getElementById(id).innerHTML=icon(name);}
