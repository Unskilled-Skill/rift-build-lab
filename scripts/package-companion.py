"""Build the Windows-only personal-test companion from reviewed local sources."""
import hashlib,json,os,shutil,subprocess,sys,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
SOURCE_NAMES=['__init__.py','app.py','app.js','style.css','index.html','core.py','launcher.py','catalog.json','riotgames.pem','Install.cmd','Uninstall.cmd','README.md']

def source_hash():
 digest=hashlib.sha256()
 for name in sorted(SOURCE_NAMES):
  digest.update(name.encode()+b'\0'+(ROOT/'companion'/name).read_bytes().replace(b'\r\n',b'\n')+b'\0')
 return digest.hexdigest()

def main():
 if os.name!='nt':raise SystemExit('Build this companion on Windows.')
 assets=ROOT/'companion'
 for name in SOURCE_NAMES:
  if not (assets/name).is_file():raise SystemExit(f'Missing companion asset: {name}')
 output=ROOT/'output'/'companion-build';output.mkdir(parents=True,exist_ok=True)
 command=[sys.executable,'-m','PyInstaller','--noconfirm','--clean','--onefile','--console','--name','RiftBuildLabCompanion','--paths',str(ROOT),'--distpath',str(output/'dist'),'--workpath',str(output/'work'),'--specpath',str(output)]
 for name in ['catalog.json','riotgames.pem','index.html','app.js','style.css']:
  command+=['--add-data',f'{assets/name};companion']
 subprocess.run(command+[str(assets/'launcher.py')],cwd=ROOT,check=True)
 executable=output/'dist'/'RiftBuildLabCompanion.exe'
 downloads=ROOT/'public'/'downloads';downloads.mkdir(parents=True,exist_ok=True)
 target=downloads/'rift-build-lab-companion-windows.zip'
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
  archive.write(executable,'RiftBuildLabCompanion.exe')
  for name in ['Install.cmd','Uninstall.cmd','README.md']:
   archive.write(assets/name,name)
 digest=hashlib.sha256(target.read_bytes()).hexdigest()
 manifest={'version':1,'patch':json.loads((assets/'catalog.json').read_text(encoding='utf-8'))['patch'],'file':target.name,'sha256':digest,'sourceSha256':source_hash(),'bytes':target.stat().st_size,'liveClientVerified':False}
 (downloads/'companion-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
 (downloads/'rift-build-lab-companion-windows.zip.sha256').write_text(f'{digest}  {target.name}\n',encoding='ascii')
 print(json.dumps(manifest))
if __name__=='__main__':main()
