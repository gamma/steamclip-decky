# SteamClip

Decky Loader plugin for sending Steam Game Recording clips or existing MP4 files to **any eligible Tailscale device** from Game Mode. Pick a clip and target, then follow the transfer progress in the sidebar.

## Requirements (on the Steam Deck)

- Decky Loader and `ffmpeg` (included with SteamOS).
- A separately installed **Tailscale CLI and running `tailscaled` service**. SteamOS does not ship Tailscale. Follow the [Tailscale's Steam Deck article](https://tailscale.com/blog/steam-deck) or your own SteamOS-compatible installation. The plugin finds `tailscale` on `PATH`, `/opt/tailscale/tailscale` or `/usr/local/bin/tailscale`.
- Log in on the Deck **and on the destination device with the same Tailscale account**. In the [Tailscale admin console](https://login.tailscale.com/admin/settings/general), enable **Send Files / Taildrop** for your tailnet. Keep Tailscale active on the receiver.
- Check availability on the Deck before opening the plugin: `tailscale status` and `tailscale file cp --targets`. If `--targets` prints no devices, the plugin cannot offer a target. Tagged devices, other users' devices and the Deck itself are not eligible Taildrop targets.

The plugin never installs Tailscale, asks for credentials, or enables Taildrop automatically. If the CLI is missing, not logged in, or Taildrop is disabled, the sidebar displays an explanation rather than an empty, unexplained picker.

## Features

- Lists saved Steam clips (`session.mpd`) plus MP4 files in `~/Videos` and `~/Downloads`, newest first, **with file sizes**.
- Lists Taildrop-capable destinations with online/offline indication and saves the selected target in a local config file.
- Losslessly remuxes Steam clips to MP4 using `ffmpeg -c copy`; existing MP4s are sent unchanged.
- Shows percentage and ETA from the `tailscale file cp` terminal progress output, plus completion or error status.

## Build and install

Use Node.js 20+ and pnpm 9 (the same major version as the Decky store builder):

```sh
pnpm i --frozen-lockfile
pnpm run build
pnpm run smoke
python3 test-worker.py
```

The Decky store builder copies the plugin's root files, including `worker.py`, to the installed plugin directory. **No separate worker installation is required.** If manually installing, copy `main.py`, `worker.py`, `plugin.json`, `package.json` and `dist/index.js` into one plugin directory under `~/homebrew/plugins/`. `package.json` must include `"type": "module"` to load `dist/index.js` as an ES module. Install and restart Decky via its supported procedures.

`main.py` starts the **bundled** `worker.py` from `DECKY_PLUGIN_DIR`/the directory containing `main.py`. The background worker uses the Deck user home from `DECKY_USER_HOME`. State and logs live under `~/.local/state/steamclip-taildrop/` (`config.json`, `progress.json`, `worker.log`, `transfer.log`, `ffmpeg.log`). The selected Taildrop device is local-only and is not embedded in the repository.

## Implementation notes

- `tailscale file cp --targets` provides eligible target names and online/offline state. A missing command or nonzero exit code is reported to the user; a successful but empty list comes with Taildrop setup guidance.
- `tailscale file cp` displays progress only when stderr is a terminal. The worker uses a PTY, parses its human-readable percentage/ETA lines, and waits for **exit status 0** before reporting success. Because the output is not a stable machine API, the intermediate bar may stop updating after future Tailscale CLI changes; the exit status still determines success/failure.
- `ffmpeg` conversion is a remux of Steam's `session.mpd` and may not perfectly preserve a user-selected clip trim if Steam's format changes. If you need an exact trim, export the MP4 in Steam first and choose that file.
- The frontend is in English so it is usable for Decky reviewers and international users. Contributions for localized translations are welcome.
- This project was developed with substantial generative-AI assistance; this was explicitly disclosed in the [Decky store PR](https://github.com/SteamDeckHomebrew/decky-plugin-database/pull/1150).
