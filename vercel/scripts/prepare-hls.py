"""Prepare an existing cached bot video as HLS without re-encoding its video stream."""
import argparse,json,math,os,re,shutil,subprocess
from pathlib import Path

BASE=Path(__file__).resolve().parents[1]

def prepare(movie_id,ffmpeg,project=BASE):
 project=project.resolve()
 snapshot=json.loads((project/'server/bot-catalog.json').read_text(encoding='utf8'))
 movie=next((m for m in snapshot['movies'] if m['id']==str(movie_id)),None)
 if not movie:raise RuntimeError('Movie not found in the bot catalog.')
 cache_key=movie.get('cache_key','')
 if not re.fullmatch('[a-f0-9]{64}',cache_key):raise RuntimeError('Invalid cache key.')
 source=project.parent/'.site-cache'/cache_key
 if not source.is_file():raise RuntimeError('Original cached video is missing.')
 if shutil.disk_usage(project).free<source.stat().st_size*3+500*1024*1024:raise RuntimeError('Not enough free disk space for preparation and deployment.')
 hidden={'creationflags':subprocess.CREATE_NO_WINDOW} if os.name=='nt' else {}
 probe=subprocess.run([ffmpeg,'-hide_banner','-i',str(source),'-t','0','-f','null','-'],capture_output=True,text=True,**hidden)
 video=next((line for line in probe.stderr.splitlines() if 'Video: h264 ' in line),'')
 if not video:raise RuntimeError('This preparation path requires an H.264 video stream.')
 dimensions=re.search(r',\s*(\d{2,5})x(\d{2,5})[\s,]',video)
 duration_match=re.search(r'Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)',probe.stderr)
 if not dimensions or not duration_match:raise RuntimeError('Video metadata is incomplete.')
 width,height=map(int,dimensions.groups())
 hours,minutes,seconds=map(float,duration_match.groups());duration=hours*3600+minutes*60+seconds
 audio=next((line for line in probe.stderr.splitlines() if 'Audio:' in line),'')
 copy_audio='Audio: aac ' in audio
 media=project/'public/media';media.mkdir(parents=True,exist_ok=True)
 prefix='hls-'+cache_key
 index=media/(prefix+'-index.m3u8');master=media/(prefix+'-master.m3u8')
 audio_options=['-c:a','copy'] if copy_audio else ['-c:a','aac','-b:a','128k','-ar','44100']
 command=[ffmpeg,'-nostdin','-hide_banner','-loglevel','error','-y','-i',str(source),
  '-map','0:v:0','-map','0:a:0?','-c:v','copy',*audio_options,
  '-f','hls','-hls_time','12','-hls_list_size','0','-hls_playlist_type','vod',
  '-hls_flags','independent_segments','-hls_segment_filename',str(media/(prefix+'-%05d.ts')),
  '-progress','pipe:1','-nostats',str(index)]
 print('Preparing movie '+str(movie_id)+': original H.264 video stream; '+str(width)+'x'+str(height)+'.',flush=True)
 if not copy_audio:print('Preserving the first (Uzbek) audio track and converting it to browser-compatible AAC.',flush=True)
 process=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,**hidden)
 milestone=0;last=[]
 for line in process.stdout:
  last.append(line.strip());last=last[-20:]
  if line.startswith('out_time_us='):
   try:percent=min(100,int(int(line.split('=',1)[1])/1000000/duration*100))
   except ValueError:continue
   if percent>=milestone:print('HLS preparation: '+str(percent)+'%',flush=True);milestone=percent+20
 if process.wait()!=0:raise RuntimeError('FFmpeg preparation failed: '+' '.join(last[-8:]))
 playlist=index.read_text(encoding='utf8')
 if '#EXT-X-ENDLIST' not in playlist:raise RuntimeError('Incomplete HLS playlist.')
 segments=[media/line.strip() for line in playlist.splitlines() if line.strip() and not line.startswith('#')]
 if not segments or any(not item.is_file() or item.stat().st_size==0 for item in segments):raise RuntimeError('An HLS segment is missing.')
 if any(item.stat().st_size>=50*1024*1024 for item in segments):raise RuntimeError('Unexpectedly large HLS segment.')
 total=sum(item.stat().st_size for item in segments)
 bandwidth=math.ceil(total*8/duration*1.2)
 master.write_text('#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-STREAM-INF:BANDWIDTH='+str(bandwidth)+',RESOLUTION='+str(width)+'x'+str(height)+'\n'+index.name+'\n',encoding='utf8',newline='\n')
 mapping=project/'server/media-sources.json'
 data=json.loads(mapping.read_text(encoding='utf8')) if mapping.exists() else {'version':1,'movies':{}}
 data['movies'][str(movie_id)]={'cache_key':cache_key,'source_bytes':source.stat().st_size,'duration':duration,'width':width,'height':height,'kind':'hls','url':'/media/'+master.name}
 temporary=mapping.with_suffix('.json.part');temporary.write_text(json.dumps(data,indent=2),encoding='utf8');temporary.replace(mapping)
 print('Prepared '+str(len(segments))+' HLS segments; total bytes '+str(total)+'.',flush=True)
 return data['movies'][str(movie_id)]

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('movie_id',type=int);parser.add_argument('--ffmpeg',default=os.environ.get('FFMPEG') or shutil.which('ffmpeg'))
 args=parser.parse_args()
 if not args.ffmpeg:
  saved=BASE/'.private/ffmpeg-path.txt'
  if saved.exists():args.ffmpeg=saved.read_text(encoding='utf8').strip()
 if not args.ffmpeg:parser.error('Use --ffmpeg to specify the FFmpeg executable.')
 prepare(args.movie_id,args.ffmpeg)
