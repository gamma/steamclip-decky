# SteamClip

Decky-Loader-Plugin für das Steam Deck: **Steam-Clips als MP4 an ein beliebiges
Tailscale-Gerät senden** – direkt aus dem Gaming-Modus über die ⋯-Sidebar.

## Funktionen

- **Dateiauswahl**: neueste gespeicherte Steam-Clips (`session.mpd`) und vorhandene
  MP4-Dateien aus `Videos`/`Downloads`, inklusive Dateigröße.
- **Zielgerät-Auswahl**: Liste aller Taildrop-fähigen Tailscale-Geräte mit
  Online-Status (● online / ○ offline). Die Auswahl wird gespeichert.
- **Echter Fortschritt**: Prozent + ETA, ausgelesen aus `tailscale file cp`.
- **Verlustfreies MP4**: Steam-Clips werden per `ffmpeg -c copy` remuxt
  (keine Neukodierung), MP4-Dateien werden unverändert gesendet.

## Aufbau

| Datei | Zweck |
| --- | --- |
| `main.py` | Decky-Backend: `list_clips`, `list_targets`, `get_config`, `set_target`, `get_progress`, `send_clip`, `send_file` |
| `worker.py` | Hintergrund-Job: ffmpeg-Remux + `tailscale file cp` in PTY, schreibt `progress.json` |
| `src/index.tsx` | React-Frontend (Auswahllisten, Fortschrittsbalken, Polling) |
| `shims/` | Map `@decky/ui`/`react`/`react/jsx-runtime` auf Deckys injizierte Globals (`DFL`, `SP_REACT`, `SP_JSX`) |

Der Fortschritt (`worker.py`) wird unter
`~/.local/state/steamclip-taildrop/` abgelegt: `progress.json`,
`transfer.log`, `worker.log`, `ffmpeg.log`, `config.json` (gespeichertes
Zielgerät).

## Bauen

```bash
npm install
npm run build     # erzeugt dist/index.js (ES-Modul)
npm run smoke     # optionaler Frontend-Smoke-Test in Node
```

Der Build nutzt **esbuild** (statt Rollup), damit er auch auf ARM64/iSH läuft.
`@decky/ui`, `react` und `react/jsx-runtime` werden auf Deckys Globals gemappt
(dasselbe wie `@decky/rollup` mit `externalGlobals`); `@decky/api` und
`react-icons` werden gebündelt.

## Installieren

1. **`package.json` muss `"type": "module"` enthalten** – sonst lädt Decky das
   Bundle als `LEGACY_EVAL_IIFE` und bricht mit
   `SyntaxError: Unexpected token 'export'` ab.
2. Plugin-Ordner als ZIP packen und per Decky-Loader installieren, oder den
   Ordner nach `/home/deck/homebrew/plugins/` kopieren:
   - `main.py`, `plugin.json`, `package.json`, `dist/index.js`
3. `worker.py` nach `/home/deck/.local/bin/steamclip-worker.py` kopieren
   (`chmod 700`). `main.py` startet ihn als `/usr/bin/python3`.
4. Voraussetzungen auf dem Deck: **Decky Loader**, **Tailscale**
   (`/opt/tailscale/tailscale`) und **ffmpeg** (`/usr/bin/ffmpeg`, bei SteamOS
   vorhanden). Taildrop muss im Tailnet aktiviert sein.

## Ablauf beim Senden

1. `send_clip`/`send_file` legt `progress.json` mit `stage: queued` an und
   startet `worker.py` als abgekoppelten Hintergrundprozess.
2. Der Worker remuxt bei Steam-Clips nach `~/Videos/Steam-Clips/<clip>.mp4`,
   sendet dann `tailscale file cp --update-interval=1s <datei> <ziel>:` in einem
   PTY und parst die `%`/`ETA`-Zeilen.
3. Das Frontend pollt `get_progress` im 1-Sekunden-Takt und zeigt den Balken.

## Hinweise

- `tailscale file cp --targets` liefert die gültigen Taildrop-Ziele; getaggte
  Nodes und das eigene Gerät werden dadurch automatisch ausgeschlossen.
- Die Prozentanzeige basiert auf der PTY-Ausgabe der Tailscale-CLI und ist
  damit versionsabhängig. Fällt sie aus, schlägt der Versand trotzdem fehl —
  der Balken springt dann von „Verbinde …“ auf „gesendet“ (Exitcode 0).
- `plugin_loader.service` startet nur beim Boot mit Root-Rechten; ohne Root
  kann der Dienst vorübergehend als Benutzerdienst gestartet werden
  (`systemd-run --user --unit=decky-recovery … PluginLoader`).
