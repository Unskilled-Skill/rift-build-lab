"""Windows entry point and explicit current-user protocol registration."""
import os
from pathlib import Path
import shutil
import sys

SCHEME='riftbuildlab'
OWNER='RiftBuildLabCompanion-v1'

def install_plan(executable,local_app_data):
    root=(Path(local_app_data)/'RiftBuildLab'/'Companion').resolve()
    target=(root/'RiftBuildLabCompanion.exe').resolve()
    if target.parent!=root:raise ValueError('Invalid install location.')
    return target, f'"{target}" "%1"'

def register_handler(executable=None,local_app_data=None,registry=None):
    if os.name!='nt' and registry is None:raise RuntimeError('Website handoff setup requires Windows.')
    if registry is None:import winreg as registry
    executable=Path(executable or sys.executable).resolve()
    if executable.suffix.lower()!='.exe':raise RuntimeError('Use the packaged Windows companion for installation.')
    local_app_data=local_app_data or os.environ.get('LOCALAPPDATA')
    if not local_app_data:raise RuntimeError('Windows local application folder is unavailable.')
    target,command=install_plan(executable,local_app_data)
    key_path=r'Software\Classes\riftbuildlab'
    try:key=registry.OpenKey(registry.HKEY_CURRENT_USER,key_path)
    except FileNotFoundError:key=None
    if key is not None:
        with key:
            try:marker,_=registry.QueryValueEx(key,'RiftBuildLabOwner')
            except FileNotFoundError:marker=None
            if marker!=OWNER:raise RuntimeError('A different application owns this link handler. Setup did not replace it.')
    target.parent.mkdir(parents=True,exist_ok=True)
    if executable!=target:shutil.copy2(executable,target)
    with registry.CreateKey(registry.HKEY_CURRENT_USER,key_path) as key:
        registry.SetValueEx(key,'',0,registry.REG_SZ,'URL:Rift Build Lab build import')
        registry.SetValueEx(key,'URL Protocol',0,registry.REG_SZ,'')
        registry.SetValueEx(key,'RiftBuildLabOwner',0,registry.REG_SZ,OWNER)
    with registry.CreateKey(registry.HKEY_CURRENT_USER,key_path+r'\shell\open\command') as key:
        registry.SetValueEx(key,'',0,registry.REG_SZ,command)
    return target

def unregister_handler(registry=None):
    if os.name!='nt' and registry is None:raise RuntimeError('Windows is required.')
    if registry is None:import winreg as registry
    key_path=r'Software\Classes\riftbuildlab'
    try:key=registry.OpenKey(registry.HKEY_CURRENT_USER,key_path)
    except FileNotFoundError:return
    with key:
        try:marker,_=registry.QueryValueEx(key,'RiftBuildLabOwner')
        except FileNotFoundError:marker=None
        if marker!=OWNER:raise RuntimeError('The registered handler is not owned by Rift Build Lab.')
    # Remove only our known protocol registry keys. Keep backups and imported data.
    for suffix in [r'\shell\open\command',r'\shell\open',r'\shell','']:
        try:registry.DeleteKey(registry.HKEY_CURRENT_USER,key_path+suffix)
        except FileNotFoundError:pass

def main():
    if '--install' in sys.argv:
        try:
            if not getattr(sys,'frozen',False):raise RuntimeError('Build or download the packaged Windows companion first.')
            target=register_handler()
            print(f'Installed website handoff for this Windows user: {target}')
            print('Return to Rift Build Lab and choose Open companion. No League settings were changed.')
            return 0
        except (OSError,RuntimeError,ValueError) as error:
            print(f'Setup could not finish: {error}')
            return 1
    if '--uninstall' in sys.argv:
        try:
            unregister_handler();print('Website handoff removed. Backups and the companion executable were kept.');return 0
        except (OSError,RuntimeError) as error:
            print(f'Uninstall could not finish: {error}');return 1
    from companion.app import main as run
    return run()

if __name__=='__main__':sys.exit(main())
