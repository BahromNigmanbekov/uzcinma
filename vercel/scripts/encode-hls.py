"""Prepare real HLS renditions offline. Requires ffmpeg and ffprobe on PATH."""
import argparse,json,shutil,subprocess
from pathlib import Path
parser=argparse.ArgumentParser(description='Encode 480/720/1080 HLS without upscaling.')
parser.add_argument('input',type=Path)
parser.add_argument('output',type=Path)
parser.add_argument('--dry-run',action='store_true')
args=parser.parse_args()
source=args.input.resolve()
target=args.output.resolve()
if not source.is_file():parser.error('Input movie not found.')
if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):parser.error('Install ffmpeg + ffprobe and add both to PATH.')
if target.exists() and (not target.is_dir() or any(target.iterdir())):parser.error('Output must be a new or empty directory. Existing files are not overwritten.')
probe=subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',str(source)],capture_output=True,text=True,check=True)
stream=json.loads(probe.stdout)['streams'][0]
width,height=int(stream['width']),int(stream['height'])
variants=[(h,rate) for h,rate in [(480,1200000),(720,2800000),(1080,5000000)] if height>=h]
if not variants:
 actual=height-height%2
 if actual<2:parser.error('Invalid source height.')
 variants=[(actual,800000)]
plans=[]
for h,rate in variants:
 folder=target/str(h)
 command=['ffmpeg','-hide_banner','-nostdin','-i',str(source),'-map','0:v:0','-map','0:a:0?','-vf','scale=-2:'+str(h),'-c:v','libx264','-preset','medium','-crf','21','-maxrate',str(rate),'-bufsize',str(rate*2),'-pix_fmt','yuv420p','-force_key_frames','expr:gte(t,n_forced*6)','-c:a','aac','-b:a','128k','-ac','2','-f','hls','-hls_time','6','-hls_playlist_type','vod','-hls_flags','independent_segments','-hls_segment_filename',str(folder/'segment_%05d.ts'),str(folder/'index.m3u8')]
 plans.append((h,rate,folder,command))
if args.dry_run:
 print(json.dumps({'source_size':[width,height],'renditions':[h for h,_,_,_ in plans],'commands':[command for _,_,_,command in plans]},indent=2))
 raise SystemExit()
target.mkdir(parents=True,exist_ok=True)
master=['#EXTM3U','#EXT-X-VERSION:3','#EXT-X-INDEPENDENT-SEGMENTS']
for h,rate,folder,command in plans:
 folder.mkdir()
 subprocess.run(command,check=True)
 # ffmpeg rounds scale=-2 to an even output width; measure the actual segment.
 first=folder/'segment_00000.ts'
 measured=subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',str(first)],capture_output=True,text=True,check=True)
 actual=json.loads(measured.stdout)['streams'][0]
 master.extend(['#EXT-X-STREAM-INF:BANDWIDTH='+str(rate+128000)+',RESOLUTION='+str(actual['width'])+'x'+str(actual['height']),str(h)+'/index.m3u8'])
(target/'master.m3u8').write_text('\n'.join(master)+'\n',encoding='ascii')
print('HLS prepared at '+str(target)+'. Upload the whole folder to an HTTPS media origin with CORS.')
