"""Keep the local site catalog synchronized with incoming bot metadata."""
import contextlib,hashlib,importlib.util,io,json,os,shutil,sqlite3,time,urllib.request,urllib.error
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
ROOT=BASE.parent
spec=importlib.util.spec_from_file_location('bot_video_export',BASE/'scripts/sync-bot-videos.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
env={}
if (ROOT/'.env').exists():
 for line in (ROOT/'.env').read_text(encoding='utf-8-sig').splitlines():
  key,sep,value=line.partition('=')
  if sep and not key.lstrip().startswith('#'):env[key.strip()]=value.strip().strip('"').strip("'")
token=env.get('BOT_TOKEN','');api=env.get('BOT_API_BASE','https://api.telegram.org').rstrip('/')
cache=ROOT/'.site-cache';cache.mkdir(exist_ok=True)
attempts={};last_signature=None
def download(row,destination):
 filename=Path(row.get('file_name') or '').name
 # Use the exact named original when it is already on this computer.
 if filename and filename not in ('.','..'):
  for folder in [Path.home()/'Downloads',Path.home()/'Downloads/Telegram Desktop',Path.home()/'Videos',Path.home()/'Desktop']:
   candidate=folder/filename
   if candidate.is_file() and candidate.stat().st_size==row.get('file_size'):
    partial=destination.with_suffix('.local.part');shutil.copyfile(candidate,partial);partial.replace(destination);return True
 if not token:return False
 request=urllib.request.Request(api+'/bot'+token+'/getFile',data=json.dumps({'file_id':row['file_id']}).encode(),headers={'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(request,timeout=20) as response:value=json.load(response)
  if not value.get('ok'):return False
  path=value['result']['file_path']
  if Path(path).is_absolute():
   origin=Path(path)
   if not origin.is_file():return False
   partial=destination.with_suffix('.local.part');shutil.copyfile(origin,partial);partial.replace(destination);return True
  from urllib.parse import quote
  request=urllib.request.Request(api+'/file/bot'+token+'/'+quote(path,safe='/'))
  partial=destination.with_suffix('.local.part')
  with urllib.request.urlopen(request,timeout=60) as response,partial.open('wb') as out:
   shutil.copyfileobj(response,out,length=1024*1024)
  if row.get('file_size') and partial.stat().st_size!=row['file_size']:partial.unlink(missing_ok=True);return False
  partial.replace(destination);return True
 except urllib.error.HTTPError as error:
  try:description=json.loads(error.read()).get('description','Telegram media error')
  except Exception:description='Telegram media error'
  # Telegram JSON descriptions do not contain our credential-bearing URL.
  print('Video '+str(row['id'])+': '+description[:160],flush=True);return False
 except Exception as error:
  print('Video '+str(row['id'])+': media request failed ('+type(error).__name__+').',flush=True);return False
while True:
 try:
  db=sqlite3.connect((ROOT/'movies.sqlite3').as_uri()+'?mode=ro',uri=True);db.row_factory=sqlite3.Row
  try:rows=[dict(row) for row in db.execute('SELECT * FROM movies ORDER BY id DESC')]
  finally:db.close()
  for row in rows:
   if row.get('deleted'):continue
   assets=[(row,row['file_unique_id'])]
   for kind in ('poster','banner'):
    if row.get(kind+'_file_id'):
     image={'id':str(row['id'])+' '+kind,'file_id':row[kind+'_file_id'],'file_name':'','file_size':None}
     assets.append((image,row.get(kind+'_unique_id') or row[kind+'_file_id']))
   for asset,unique in assets:
    key=hashlib.sha256(unique.encode()).hexdigest();target=cache/key
    if target.is_file() and (not asset.get('file_size') or target.stat().st_size==asset['file_size']):continue
    if time.monotonic()-attempts.get(key,-120)<60:continue
    attempts[key]=time.monotonic()
    download(asset,target)
  signatures=[]
  for row in rows:
   target=cache/hashlib.sha256(row['file_unique_id'].encode()).hexdigest()
   images=[]
   for kind in ('poster','banner'):
    unique=row.get(kind+'_unique_id') or row.get(kind+'_file_id')
    image=cache/hashlib.sha256(unique.encode()).hexdigest() if unique else None
    images.append(image.stat().st_size if image and image.is_file() else 0)
   signatures.append((row,target.stat().st_size if target.is_file() else 0,images))
  signature=json.dumps(signatures,sort_keys=True,default=str)
  if signature!=last_signature:
   with contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
    result=module.export(ROOT/'movies.sqlite3',cache,BASE)
   last_signature=signature
   print('Site catalog updated: '+str(len(result['movies']))+' videos.',flush=True)
 except KeyboardInterrupt:break
 except Exception as error:print('Site sync retry ('+type(error).__name__+').',flush=True)
 time.sleep(4)
