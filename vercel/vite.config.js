import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({plugins:[tailwindcss()],server:{host:'127.0.0.1',port:5176,watch:{ignored:['**/server/**','**/public/media/**','**/.private/**']},proxy:{'/api':'http://127.0.0.1:5177','/media':'http://127.0.0.1:5177'}},build:{target:'es2020',cssCodeSplit:true,rollupOptions:{input:{main:fileURLToPath(new URL('./index.html',import.meta.url)),admin:fileURLToPath(new URL('./admin/index.html',import.meta.url))},output:{manualChunks(id){if(id.includes('hls.js'))return 'player-hls';if(id.includes('swiper'))return 'swiper';}}}}});
