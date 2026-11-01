"""Export the local Telegram catalog and cached videos as deployable public files."""
import argparse,hashlib,json,shutil,sqlite3,sys,os,uuid
from datetime import datetime,timezone
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
MAX_BYTES=75*1024*1024
def export(database,cache,project):
 database=database.resolve();cache=cache.resolve();project=project.resolve()
 connection=sqlite3.connect(database.as_uri()+'?mode=ro',uri=True)
 connection.row_factory=sqlite3.Row
 try:
  rows=[dict(row) for row in connection.execute('SELECT * FROM movies WHERE deleted=0 ORDER BY id DESC')]
  home={}
  try:
   for key,value in connection.execute('SELECT key,value FROM site_settings'):
    if key in ('hero_ids','recommendation_ids'):home[key]=json.loads(value)
  except sqlite3.OperationalError:pass
 finally:connection.close()
 media=project/'public/media';media.mkdir(parents=True,exist_ok=True)
 metadata=project/'server/bot-catalog.json';metadata.parent.mkdir(parents=True,exist_ok=True)
 prepared={}
 try:prepared=json.loads((project/'server/media-sources.json').read_text(encoding='utf8')).get('movies',{})
 except FileNotFoundError:pass
 movies=[];used=set();total=0;ready=0
 for row in rows:
  movie_id=str(row['id']);unique=row.get('file_unique_id') or ''
  cached=cache/hashlib.sha256(unique.encode()).hexdigest()
  source=None
  cache_key=hashlib.sha256(unique.encode()).hexdigest()
  extension=Path(row.get('file_name') or 'movie.mp4').suffix.lower()
  supported=extension in ('.mp4','.webm','.m4v','.mov')
  prepared_media={}
  if supported and cached.is_file() and (not row.get('file_size') or cached.stat().st_size==row['file_size']):
   size=cached.stat().st_size
   item=prepared.get(movie_id,{})
   url=item.get('url','') if isinstance(item,dict) else ''
   filename=Path(url).name
   if item.get('cache_key')==cache_key and item.get('source_bytes')==size and url=='/media/'+filename and filename.startswith('hls-') and filename.endswith('-master.m3u8') and (media/filename).is_file():
    source={'quality':'hls','url':url};ready+=1;prepared_media=item
   else:
    digest=hashlib.sha256()
    with cached.open('rb') as stream:
     for chunk in iter(lambda:stream.read(1024*1024),b''):digest.update(chunk)
    fingerprint=digest.hexdigest()
    name='video-'+fingerprint+extension
    size=cached.stat().st_size
    if name in used or total+size<=MAX_BYTES:
     destination=media/name
     if not destination.is_file() or destination.stat().st_size!=size:
      partial=destination.with_suffix(destination.suffix+'.part')
      shutil.copyfile(cached,partial);partial.replace(destination)
     if name not in used:total+=size;used.add(name)
     source={'quality':'original','url':'/media/'+name};ready+=1
    else:
     source={'quality':'original','url':'/api/local-media?id='+movie_id};ready+=1
  title=str(row.get('title') or 'Video '+movie_id)[:200]
  def uploaded_artwork(kind):
   unique=row.get(kind+'_unique_id') or row.get(kind+'_file_id')
   if not unique:return None
   image=cache/hashlib.sha256(unique.encode()).hexdigest()
   if not image.is_file():return None
   with image.open('rb') as stream:header=stream.read(16)
   if header.startswith(b'\xff\xd8\xff'):suffix='.jpg'
   elif header.startswith(b'\x89PNG\r\n\x1a\n'):suffix='.png'
   elif header[:4]==b'RIFF' and header[8:12]==b'WEBP':suffix='.webp'
   else:return None
   digest=hashlib.sha256(image.read_bytes()).hexdigest()
   name=kind+'-'+digest+suffix
   if not (media/name).is_file():shutil.copyfile(image,media/name)
   return '/media/'+name
  poster_url=uploaded_artwork('poster') or '/assets/uzcinma-poster.png'
  banner_url=uploaded_artwork('banner') or '/assets/uzcinma-banner.png'
  genres=[]
  try:genres=json.loads(row.get('genres') or '[]')
  except (TypeError,ValueError):pass
  movie={'id':movie_id,'title':title,'description':str(row.get('description') or '')[:3000],
   'genres':genres if isinstance(genres,list) else [],'year':row.get('year'),'rating':float(row.get('rating') or 0),
   'duration':int(row.get('duration') or prepared_media.get('duration') or 0),'type':row.get('type') or 'movie',
   'poster':poster_url,'backdrop':banner_url,'available':bool(source),'is_demo':False,
   'origin':'telegram','cache_key':cache_key,'media_type':row.get('mime_type') or 'video/mp4','sources':[source] if source else []}
  movies.append(movie)
  if not source:print('Film '+movie_id+': video file is not available yet.',file=sys.stderr)
 snapshot={'version':1,'generated_at':datetime.now(timezone.utc).isoformat(),'movies':movies,'home':home}
 temporary=metadata.with_suffix('.'+str(os.getpid())+'.'+uuid.uuid4().hex+'.part');temporary.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2),encoding='utf-8');temporary.replace(metadata)
 print(str(len(movies))+' catalog entries, '+str(ready)+' playable, '+str(len(used))+' unique media files, '+str(total)+' bytes.')
 return snapshot
if __name__=='__main__':
 parser=argparse.ArgumentParser()
 parser.add_argument('--database',type=Path,default=BASE.parent/'movies.sqlite3')
 parser.add_argument('--cache',type=Path,default=BASE.parent/'.site-cache')
 parser.add_argument('--project',type=Path,default=BASE)
 args=parser.parse_args()
 try:export(args.database,args.cache,args.project)
 except Exception as error:
  print('Bot export failed ('+type(error).__name__+'). Check the database/cache paths.',file=sys.stderr);sys.exit(1)
