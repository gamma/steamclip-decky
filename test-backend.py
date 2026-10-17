"""Offline smoke tests for the plugin backend; no Deck or Tailscale required."""
import asyncio
import importlib.util
import os
from pathlib import Path
import sys
import tempfile
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

sys.modules['decky'] = SimpleNamespace(DECKY_USER_HOME='', logger=SimpleNamespace(info=lambda *_: None))
path = Path(__file__).with_name('main.py')
spec = importlib.util.spec_from_file_location('steamclip_backend', path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
assert mod.WORKER == path.with_name('worker.py')

with tempfile.TemporaryDirectory() as temp:
    mod.HOME = Path(temp)
    mod.STATE_DIR = mod.HOME / 'state'
    mod.CONFIG = mod.STATE_DIR / 'config.json'
    mod.STATE = mod.STATE_DIR / 'progress.json'
    plugin = mod.Plugin()
    with patch.object(mod, '_tailscale_binary', return_value=None):
        config = asyncio.run(plugin.get_config())
        assert config['targets'] == []
        assert 'not installed' in config['diagnostic']

    output = '100.1.2.3\ttarget-online\n100.1.2.4\ttarget-offline\toffline; last seen 5m ago\n'
    with patch.object(mod, '_tailscale_binary', return_value='/usr/bin/tailscale'), patch.object(mod.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout=output, stderr='')):
        config = asyncio.run(plugin.get_config())
        assert [t['online'] for t in config['targets']] == [True, False]
        asyncio.run(plugin.set_target('target-online'))
        assert asyncio.run(plugin.get_config())['target'] == 'target-online'
        try:
            asyncio.run(plugin.set_target('made-up'))
        except ValueError:
            pass
        else:
            raise AssertionError('Unlisted Taildrop target was accepted')

print('backend configuration and bundled worker path: OK')
