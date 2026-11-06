// Upgrade only the previous site-owned artwork; uploaded film images are independent.
const REVISION='2026-11-06';
const paths=[
 ['poster_url','/assets/uzcinma-poster.png','/assets/uzcinma-poster-v2.png'],
 ['backdrop_url','/assets/uzcinma-banner.png','/assets/uzcinma-banner-v2.png'],
 ['logo_url','/assets/uzcinma-logo-v2.png','/assets/uzcinma-logo.png']
];
export async function migrateBrandArtwork(db){
 const state=await db.execute("SELECT value FROM site_settings WHERE key='brand_artwork_revision'");
 if(state.rows[0]?.value===REVISION)return 0;
 const statements=[];
 for(const [column,old,next]of paths)for(const origin of ['', 'https://uzcinma.uz','https://www.uzcinma.uz','https://uzcinma.vercel.app']){
  const previous=origin+old;
  statements.push({sql:'UPDATE movies SET '+column+'=?,updated_at=unixepoch() WHERE '+column+'=? OR '+column+' LIKE ?',args:[next,previous,previous+'?%']});
 }
 statements.push({sql:"INSERT INTO site_settings(key,value) VALUES('brand_artwork_revision',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",args:[REVISION]});
 const result=await db.batch(statements,'write');return result.slice(0,-1).reduce((sum,row)=>sum+row.rowsAffected,0);
}
