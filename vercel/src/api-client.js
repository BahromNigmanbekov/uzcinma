export const API_BASE=(import.meta.env.VITE_API_BASE||'').replace(/\/$/,'');
export function apiURL(path){return API_BASE+path;}
export function normalizeMovie(movie){
 if(!API_BASE||!movie)return movie;
 const absolute=value=>(typeof value==='string'&&value.startsWith('/'))?API_BASE+value:value;
 return {...movie,poster:absolute(movie.poster),backdrop:absolute(movie.backdrop)};
}
export function normalizeCatalog(data){
 if(!Array.isArray(data?.movies))return data;
 return {...data,movies:data.movies.map(normalizeMovie),home:data.home?{hero:data.home.hero?.map(normalizeMovie)??null,recommendations:data.home.recommendations?.map(normalizeMovie)??null}:null};
}
