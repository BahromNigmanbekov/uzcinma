"""Export existing bot metadata, never movie bytes or the bot token."""
import argparse,datetime,json,sqlite3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--database',type=Path,default=root.parent/'movies.sqlite3')
parser.add_argument('--output',type=Path,default=root/'.private/legacy.json')
args=parser.parse_args()
database=sqlite3.connect(args.database.resolve().as_uri()+'?mode=ro',uri=True)
database.row_factory=sqlite3.Row
def timestamp(value):
 try:return int(value)
 except (ValueError,TypeError):
  try:return int(datetime.datetime.fromisoformat(str(value).replace('Z','+00:00')).timestamp())
  except ValueError:return int(datetime.datetime.now().timestamp())
rows=[]
for record in database.execute('SELECT * FROM movies ORDER BY id'):
 row=dict(record)
 rows.append({'id':row['id'],'file_unique_id':row['file_unique_id'],'file_id':row['file_id'],
 'title':row['title'],'description':row.get('description') or '',
 'duration':row.get('duration') or 0,'file_size':row.get('file_size') or 0,
 'poster_file_id':row.get('poster_file_id'),'banner_file_id':row.get('banner_file_id'),'deleted':row.get('deleted') or 0,
 'created_at':timestamp(row.get('created_at'))})
database.close()
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print(str(len(rows))+' film metadata exported. Keep .private files private.')
