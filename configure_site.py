import json
import sys
from pathlib import Path
print('Waiting for private site configuration on stdin.', flush=True)
values=json.loads(sys.stdin.readline())
path=Path(__file__).resolve().parent / '.env'
lines=path.read_text(encoding='utf-8-sig').splitlines()
allowed={'SITE_URL','SITE_SERVICE_TOKEN','SITE_SYNC_KEY'}
lines=[line for line in lines if line.split('=',1)[0].strip() not in allowed]
for key in sorted(allowed):
    value=values[key]
    if '\n' in value or '\r' in value:
        raise SystemExit('Invalid configuration')
    lines.append(key+'='+value)
path.write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('Site configuration saved; credentials were not printed.')
