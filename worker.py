#!/usr/bin/env python3
import errno
import fcntl
import json
import os
from pathlib import Path
import pty
import re
import select
import subprocess
import sys
import time

HOME = Path(os.environ.get('STEAMCLIP_HOME') or Path.home())
TAILSCALE = os.environ.get('STEAMCLIP_TAILSCALE') or '/opt/tailscale/tailscale'
BASE = HOME / '.local/state/steamclip-taildrop'
STATUS = BASE / 'progress.json'
ANSI = re.compile(r'\x1b\[[0-9;]*[A-Za-z]')
PERCENT = re.compile(r'(\d+(?:\.\d+)?)%')


def update(job, stage, percent, message, **extra):
    data = {'job': job, 'stage': stage, 'percent': round(float(percent), 1),
            'message': message, 'updated': time.time(), **extra}
    tmp = BASE / f'progress.{os.getpid()}.tmp'
    tmp.write_text(json.dumps(data, ensure_ascii=False))
    os.replace(tmp, STATUS)


def transfer(path, job, target):
    size = path.stat().st_size
    update(job, 'sending', 0, 'Connecting via Tailscale…', file=path.name, size=size)
    master, slave = pty.openpty()
    cmd = [TAILSCALE, 'file', 'cp', '--update-interval=1s', str(path), target + ':']
    with subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=slave,
                          stderr=slave, close_fds=True, start_new_session=True) as proc:
        os.close(slave)
        buffer = ''
        last = time.monotonic()
        deadline = last + 1800
        with (BASE / 'transfer.log').open('a') as log:
            while True:
                ready, _, _ = select.select([master], [], [], 0.5)
                if ready:
                    try:
                        piece = os.read(master, 8192)
                    except OSError as exc:
                        if exc.errno == errno.EIO:
                            break
                        raise
                    if not piece:
                        break
                    text = ANSI.sub('', piece.decode('utf-8', errors='replace'))
                    buffer += text
                    for line in re.split(r'[\r\n]+', buffer)[:-1]:
                        line = line.strip()
                        if not line:
                            continue
                        log.write(line+'\n')
                        log.flush()
                        match = PERCENT.search(line)
                        if match:
                            pct = min(99.9, float(match.group(1)))
                            eta = re.search(r'ETA\s+\S+', line)
                            label = f'{match.group(1)}% transferred'
                            if eta:
                                label += ' · '+eta.group()
                            update(job, 'sending', pct, label, file=path.name, size=size)
                            last = time.monotonic()
                        elif 'warning' in line.lower():
                            update(job, 'sending', 0, line[:200], file=path.name, size=size)
                    buffer = re.split(r'[\r\n]+', buffer)[-1][-2000:]
                if proc.poll() is not None and not ready:
                    break
                if time.monotonic() > deadline:
                    proc.kill()
                    raise TimeoutError('Transfer timed out after 30 minutes.')
        os.close(master)
        code = proc.wait(timeout=5)
        if code:
            raise RuntimeError(f'Taildrop exited with status {code}. See transfer.log.')
    update(job, 'done', 100, f'MP4 sent to {target}', file=path.name, size=size)


def main():
    source = Path(sys.argv[1])
    kind, job = sys.argv[2:4]
    target = sys.argv[4] if len(sys.argv) > 4 else ''
    BASE.mkdir(parents=True, exist_ok=True)
    with (BASE / 'worker.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            update(job, 'error', 0, 'Another clip is already transferring.')
            return
        try:
            if not source.is_file():
                raise FileNotFoundError('Selected clip no longer exists.')
            if kind == 'Steam-Clip':
                name = source.parents[2].name
                out = HOME / 'Videos/Steam-Clips' / (name + '.mp4')
                out.parent.mkdir(parents=True, exist_ok=True)
                if not out.exists() or source.stat().st_mtime > out.stat().st_mtime:
                    update(job, 'converting', 0, 'Creating MP4 without re-encoding…', file=out.name)
                    tmp = out.with_suffix('.part.mp4')
                    if tmp.exists(): tmp.unlink()
                    cmd = ['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error',
                           '-y', '-i', str(source), '-map', '0:v:0', '-map', '0:a?',
                           '-c', 'copy', '-movflags', '+faststart', str(tmp)]
                    with (BASE / 'ffmpeg.log').open('ab') as log:
                        subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT,
                                       check=True, timeout=3600)
                    if not tmp.is_file() or not tmp.stat().st_size:
                        raise RuntimeError('MP4 export is empty.')
                    os.replace(tmp, out)
                source = out
            elif kind != 'MP4':
                raise ValueError('Unknown file type.')
            transfer(source, job, target)
        except Exception as exc:
            update(job, 'error', 0, str(exc)[:220], file=source.name)
            raise

if __name__ == '__main__':
    main()
