import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('worker', str(Path(__file__).parent / 'worker.py'))
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)

with tempfile.TemporaryDirectory() as d:
    w.BASE = pathlib.Path(d)
    w.STATUS = w.BASE / 'progress.json'
    f = w.BASE / 'test.mp4'
    f.write_bytes(b'fake')

    real = subprocess.Popen

    def fake(cmd, **kwargs):
        code = ('import sys,time;'
                '[(sys.stderr.write("test.mp4    1MiB  25.00%   ETA 00:00:03\\r"),sys.stderr.flush(),time.sleep(.5)) for _ in range(2)];'
                'sys.stderr.write("test.mp4 100.00%\\n")')
        return real([sys.executable, '-c', code], **kwargs)

    w.subprocess.Popen = fake
    w.transfer(f, 'test', 'iphone-15-pro')
    p = json.loads(w.STATUS.read_text())
    assert p['stage'] == 'done' and p['percent'] == 100, p
    print('worker progress parser: OK')
