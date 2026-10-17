import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

import decky

HOME = Path(getattr(decky, 'DECKY_USER_HOME', '') or Path.home())
PLUGIN_DIR = Path(__file__).resolve().parent
STATE_DIR = HOME / '.local/state/steamclip-taildrop'
STATE = STATE_DIR / 'progress.json'
CONFIG = STATE_DIR / 'config.json'
WORKER = PLUGIN_DIR / 'worker.py'
DEFAULT_TARGET = ''


def _tailscale_binary():
    return shutil.which('tailscale') or next((p for p in ('/opt/tailscale/tailscale', '/usr/local/bin/tailscale') if os.access(p, os.X_OK)), None)


def _human_size(n):
    value = float(n)
    for unit in ('B', 'KB', 'MB', 'GB', 'TB'):
        if value < 1024 or unit == 'TB':
            return f'{int(value)} {unit}' if unit == 'B' else f'{value:.1f} {unit}'
        value /= 1024.0
    return f'{n} B'


def _dir_size(path):
    total = 0
    try:
        for entry in path.rglob('*'):
            if entry.is_file():
                total += entry.stat().st_size
    except OSError:
        pass
    return total


def _targets():
    binary = _tailscale_binary()
    if not binary:
        return [], 'tailscaleMissing', ''
    try:
        proc = subprocess.run([binary, 'file', 'cp', '--targets'],
                              capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return [], 'tailscaleUnavailable', str(exc)[:250]
    if proc.returncode:
        return [], 'taildropUnavailable', (proc.stderr or proc.stdout).strip()[:250]
    result = []
    for line in proc.stdout.splitlines():
        parts = line.split('\t')
        if len(parts) < 2:
            continue
        name = parts[1].strip()
        if not name:
            continue
        detail = parts[2].strip() if len(parts) > 2 else ''
        online = detail == ''
        result.append({'name': name, 'online': online, 'detail': detail})
    result.sort(key=lambda x: (not x['online'], x['name'].lower()))
    return result, '', ''


def _load_config():
    try:
        return json.loads(CONFIG.read_text())
    except (OSError, ValueError):
        return {}


def candidates():
    result = []
    for p in (HOME / '.local/share/Steam/userdata').glob('*/gamerecordings/clips/*/video/*/session.mpd'):
        if p.is_file():
            result.append((p, 'Steam-Clip'))
    for root in (HOME / 'Videos', HOME / 'Downloads'):
        if root.exists():
            for p in root.rglob('*.mp4'):
                if p.is_file() and len(p.parts) - len(root.parts) <= 3:
                    result.append((p, 'MP4'))
    result.sort(key=lambda x: x[0].stat().st_mtime, reverse=True)
    out = {}
    for p, kind in result[:80]:
        key = hashlib.sha256(str(p).encode()).hexdigest()[:20]
        if kind == 'Steam-Clip':
            name = p.parents[2].name
            size = _dir_size(p.parent)
        else:
            name = p.name
            size = p.stat().st_size
        stamp = time.strftime('%d.%m. %H:%M', time.localtime(p.stat().st_mtime))
        out[key] = {'id': key, 'path': str(p), 'kind': kind, 'size': size,
                    'size_label': _human_size(size),
                    'label': f'{stamp} · {name} · {_human_size(size)}'}
    return out


class Plugin:
    async def _main(self):
        decky.logger.info('SteamClip file chooser ready')

    async def list_clips(self):
        return [{k: v for k, v in item.items() if k != 'path'} for item in candidates().values()]

    async def list_targets(self):
        return _targets()[0]

    async def get_config(self):
        cfg = _load_config()
        targets, diagnostic_code, diagnostic_detail = _targets()
        target = cfg.get('target', DEFAULT_TARGET)
        return {'target': target, 'locale': cfg.get('locale', ''), 'targets': targets,
                'diagnostic_code': diagnostic_code or ('noTargets' if not targets else ''),
                'diagnostic_detail': diagnostic_detail}

    async def set_locale(self, locale: str):
        if locale not in ('de', 'en'):
            raise ValueError('invalidLocale')
        cfg = _load_config()
        cfg['locale'] = locale
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = CONFIG.with_suffix('.tmp')
        tmp.write_text(json.dumps(cfg, ensure_ascii=False))
        os.replace(tmp, CONFIG)
        return {'locale': locale}

    async def set_target(self, name: str):
        if not isinstance(name, str) or name not in [t['name'] for t in _targets()[0]]:
            raise ValueError('targetInvalid')
        cfg = _load_config()
        cfg['target'] = name.strip()
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = CONFIG.with_suffix('.tmp')
        tmp.write_text(json.dumps(cfg, ensure_ascii=False))
        os.replace(tmp, CONFIG)
        return {'target': cfg['target']}

    async def get_progress(self):
        try:
            return json.loads(STATE.read_text())
        except (OSError, ValueError):
            return {'stage': 'idle', 'percent': 0, 'code': 'ready', 'message': 'Ready'}

    async def send_clip(self, clip_id: str):
        item = candidates().get(clip_id)
        if not item:
            raise ValueError('fileMissing')
        return await self._start(item)

    async def send_file(self, file_path: str):
        path = Path(file_path).resolve()
        if not path.is_relative_to(HOME) or path.suffix.lower() != '.mp4' or not path.is_file():
            raise ValueError('fileInvalid')
        if path.stat().st_size > 20 * 1024**3:
            raise ValueError('fileTooLarge')
        return await self._start({'path': str(path), 'kind': 'MP4', 'label': path.name})

    async def _start(self, item):
        current = await self.get_progress()
        if current.get('stage') in ('queued', 'converting', 'sending') and time.time() - current.get('updated', 0) < 120:
            raise RuntimeError('busy')
        target = _load_config().get('target', DEFAULT_TARGET)
        if not target:
            raise ValueError('noTarget')
        targets, diagnostic_code, diagnostic_detail = _targets()
        if diagnostic_code:
            raise RuntimeError(diagnostic_code + (': ' + diagnostic_detail if diagnostic_detail else ''))
        if target not in [t['name'] for t in targets]:
            raise ValueError('targetUnavailable')
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        job = str(time.time_ns())
        initial = {'job': job, 'stage': 'queued', 'percent': 0, 'code': 'queued',
                   'message': f'Starting transfer to {target}…', 'file': item['label'],
                   'target': target, 'updated': time.time()}
        tmp = STATE.with_suffix('.tmp')
        tmp.write_text(json.dumps(initial, ensure_ascii=False))
        os.replace(tmp, STATE)
        env = os.environ.copy()
        env.pop('LD_LIBRARY_PATH', None)
        env.pop('LD_PRELOAD', None)
        env['STEAMCLIP_HOME'] = str(HOME)
        env['STEAMCLIP_TAILSCALE'] = _tailscale_binary() or ''
        logfile = STATE_DIR / 'worker.log'
        with logfile.open('ab') as log:
            subprocess.Popen(['/usr/bin/python3', str(WORKER),
                              item['path'], item['kind'], job, target],
                             env=env, cwd=str(HOME), stdin=subprocess.DEVNULL,
                             stdout=log, stderr=subprocess.STDOUT,
                             start_new_session=True)
        return initial
