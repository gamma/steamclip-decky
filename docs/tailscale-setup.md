# Tailscale + Taildrop setup (Steam Deck → phone / computer)

SteamClip is **not a Tailscale installer**. SteamOS does not ship Tailscale; configure it separately before trying the plugin. You need a running Tailscale client on the Deck and receiving device, with the **same Tailscale user** owning both devices. Being merely in the same tailnet under different users is not enough for Taildrop.

## 1. Install Tailscale on SteamOS

In Desktop Mode, follow the approach in [Tailscale's Steam Deck article](https://tailscale.com/blog/steam-deck), which links to the Deck-specific installer [tailscale-dev/deck-tailscale](https://github.com/tailscale-dev/deck-tailscale). **Read the installer's README and script before running it.** This is a separate project, not bundled or executed by SteamClip; it normally requires administrator (`sudo`) access for first-time setup. Avoid disabling SteamOS read-only mode just to `pacman -S tailscale`: OS partition updates can erase those modifications. Choose an installation that persists across SteamOS updates and starts `tailscaled` at boot.

The Deck-specific installer typically places the CLI at `/opt/tailscale/tailscale`. SteamClip also looks for `tailscale` on the process `PATH` and in `/usr/local/bin`. Tailscale installed solely as an isolated Flatpak, without an accessible `tailscale` CLI and daemon, will not work with this plugin.

After reviewing the [installer's current README](https://github.com/tailscale-dev/deck-tailscale/blob/main/readme.md) and `tailscale.sh`, its documented installation sequence in Desktop Mode → Konsole is:

```sh
git clone https://github.com/tailscale-dev/deck-tailscale.git ~/deck-tailscale
sudo -i
cd ~deck/deck-tailscale
bash tailscale.sh
source /etc/profile.d/tailscale.sh
tailscale up --qr --operator=deck
exit
```

Set a password for the `deck` account first if `sudo` asks for one and none is configured. The upstream README includes an optional `--ssh` flag; **omit it** for Taildrop unless you deliberately want Tailscale SSH. The installer needs root once to configure `tailscaled`, but SteamClip itself never executes these setup commands. Avoid running this over your only Tailscale SSH connection (an interrupted update could disconnect you).

## 2. Sign in and enable Taildrop

1. If sign-in was not completed during installation, sign in from **Desktop Mode → Konsole** using your installation's documented command, e.g. `sudo /opt/tailscale/tailscale up --operator=deck --qr`. Scan the QR code and finish sign-in in your browser. **Do not add `--ssh` unless you intentionally want Tailscale SSH.**
2. Install the [Tailscale app](https://tailscale.com/download) on the phone/computer, sign in as **the same Tailscale user**, and switch Tailscale on. On iPhone, keep the app connected; bring it to the foreground if transfers appear stuck.
3. In the [tailnet admin console → Settings → General](https://login.tailscale.com/admin/settings/general), enable **Send Files** (Taildrop). This is a tailnet-wide opt-in; see the [Taildrop documentation](https://tailscale.com/docs/features/taildrop). A tagged node cannot be a Taildrop target.

## 3. Check before opening SteamClip

In Konsole, run the binary from your installation (replace `/opt/tailscale/tailscale` if it is elsewhere):

```sh
systemctl status tailscaled --no-pager
/opt/tailscale/tailscale status
/opt/tailscale/tailscale file cp --targets
```

`file cp --targets` must list the receiver. The name **in that output** is the name SteamClip uses; a different `HostName` from `tailscale status --json` may not be a valid Taildrop target. If the receiver is listed as offline, wake/unlock it and enable the Tailscale app. Try `tailscale ping TARGET_NAME` (use your actual name from `--targets`).

For a direct test, transfer a **small non-sensitive test file** from Konsole:

```sh
/opt/tailscale/tailscale file cp ~/Videos/test.mp4 TARGET_NAME:
```

The **colon after the target name is required**. Use a file you actually have and select a target from `--targets`. On the receiving device, open the Tailscale app or its notification and save/share the file. Once the CLI test works, open Game Mode → ⋯ → Decky → SteamClip, select that target and a saved clip, then press Send.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| “Tailscale is not installed” | Ensure the CLI exists, e.g. `ls -l /opt/tailscale/tailscale`. CLI-only installation without the daemon is not enough. |
| “Taildrop is unavailable” | `systemctl status tailscaled`; sign in again if necessary; read the actual CLI error displayed in the plugin. |
| Target list is empty | Enable **Send Files** in tailnet settings. Both devices must belong to the same Tailscale **user**, have Tailscale installed and be signed in; tagged nodes and other users' devices are excluded. |
| Receiver shown offline | Activate its Tailscale app and check `tailscale ping TARGET_NAME`. Firewall / relay and network may affect transfer speed. |
| Progress stops at 0% or transfer fails | Leave the receiver awake, read `~/.local/state/steamclip-taildrop/transfer.log`, and check `journalctl -u tailscaled -b --no-pager -n 80`. Tailscale's CLI progress is terminal-only and not a stable machine API. |
| Plugin shows no clips | Save a Steam Game Recording clip, or export an MP4 into `~/Videos` or `~/Downloads`, then refresh files. |

Do **not** post Tailscale login links, auth keys, personal IPs or screenshots of private device names in public PR comments or issues. When reporting a problem, redact logs first.
