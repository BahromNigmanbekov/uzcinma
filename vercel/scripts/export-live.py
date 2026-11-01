"""Export private bot metadata for the authenticated cloud initializer. No video copies."""
import datetime,json,sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PROJECT=ROOT/'vercel'
snapshot=json.loads((PROJECT/'server/bot-catalog.json').read_text(encoding='utf-8-sig'))
exported={int(row['id']):row for row in snapshot.get('movies',[])}
db=sqlite3.connect('file:'+(ROOT/'movies.sqlite3').as_posix()+'?mode=ro',uri=True)
db.row_factory=sqlite3.Row
movies=[]
for row in db.execute('SELECT * FROM movies ORDER BY id'):
 movie=dict(row);public=exported.get(movie['id'],{})
 for name in ['title','description','genres','type','year','rating','duration']:
  if name in public:movie[name]=public[name]
 if isinstance(movie.get('genres'),str):
  try:movie['genres']=json.loads(movie['genres'])
  except ValueError:movie['genres']=[]
 movie['poster_url']=public.get('poster') if str(public.get('poster','')).startswith('/media/') else None
 movie['backdrop_url']=public.get('backdrop') if str(public.get('backdrop','')).startswith('/media/') else None
 movie['sources']=[source for source in public.get('sources',[]) if str(source.get('url','')).startswith(('/media/','https://'))]
 try:movie['created_at']=int(datetime.datetime.fromisoformat(str(movie['created_at'])).replace(tzinfo=datetime.timezone.utc).timestamp())
 except (ValueError,TypeError):movie['created_at']=0
 movies.append(movie)
db.close()
target=PROJECT/'.private/cloud-import.json';target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps({'operation':'initialize','movies':movies,'home':snapshot.get('home',{})},ensure_ascii=True),encoding='utf-8')
print(json.dumps({'exported_metadata_records':len(movies),'video_files_copied':0}))
