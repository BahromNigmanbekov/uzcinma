import base64,hashlib,importlib.util,sqlite3,tempfile,unittest
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
bot=load('local_bot',BASE.parent/'bot.py')
exporter=load('catalog_exporter',BASE/'scripts/sync-bot-videos.py')
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
class BannerUploads(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='uzcinma-banner-');self.root=Path(self.temp.name);self.cache=self.root/'cache';self.cache.mkdir();self.project=self.root/'project';self.database=self.root/'test.sqlite'
  self.db=sqlite3.connect(self.database)
  self.db.execute("CREATE TABLE movies(id INTEGER PRIMARY KEY,file_unique_id TEXT,file_id TEXT,title TEXT,description TEXT,file_name TEXT,mime_type TEXT,file_size INTEGER,duration INTEGER,deleted INTEGER,poster_file_id TEXT,poster_unique_id TEXT,banner_file_id TEXT,banner_unique_id TEXT)")
  self.db.execute("INSERT INTO movies(id,file_unique_id,file_id,title,description,file_name,mime_type,file_size,duration,deleted) VALUES(4,'video-unique','private-video','Hero','','film.mp4','video/mp4',1,660,0)");self.db.commit()
  (self.cache/hashlib.sha256(b'video-unique').hexdigest()).write_bytes(b'x')
 def tearDown(self):
  self.db.close();self.temp.cleanup()
 def image(self,unique):
  (self.cache/hashlib.sha256(unique.encode()).hexdigest()).write_bytes(PNG)
 def snapshot(self):
  return exporter.export(self.database,self.cache,self.project)['movies'][0]
 def test_banner_changes_backdrop_and_preserves_poster_and_video(self):
  before=self.snapshot();bot.store_artwork(self.db,4,'banner',{'file_id':'private-banner','file_unique_id':'banner-unique'});self.image('banner-unique');after=self.snapshot()
  self.assertEqual(before['poster'],after['poster']);self.assertEqual(before['sources'],after['sources'])
  self.assertTrue(after['backdrop'].startswith('/media/banner-'));self.assertTrue((self.project/'public'/after['backdrop'].lstrip('/')).is_file())
  self.assertNotIn('private-banner',str(after))
 def test_poster_and_banner_remain_independent(self):
  bot.store_artwork(self.db,4,'banner',{'file_id':'private-banner','file_unique_id':'banner-unique'});self.image('banner-unique');before=self.snapshot()
  bot.store_artwork(self.db,4,'poster',{'file_id':'private-poster','file_unique_id':'poster-unique'});self.image('poster-unique');after=self.snapshot()
  self.assertEqual(before['backdrop'],after['backdrop']);self.assertTrue(after['poster'].startswith('/media/poster-'));self.assertNotEqual(after['poster'],after['backdrop'])
 def test_pending_download_uses_independent_default_artwork(self):
  bot.store_artwork(self.db,4,'banner',{'file_id':'pending','file_unique_id':'pending'})
  item=self.snapshot();self.assertEqual(item['backdrop'],'/assets/uzcinma-banner.png');self.assertEqual(item['poster'],'/assets/uzcinma-poster.png')
if __name__=='__main__':unittest.main()
