# Tailscale und Taildrop einrichten (Steam Deck → Handy/PC)

SteamClip installiert **Tailscale nicht selbst**. Auf SteamOS ist es nicht vorinstalliert. Voraussetzung sind ein laufender Tailscale-Client auf Deck und Empfänger sowie **derselbe Tailscale-Benutzer** als Besitzer beider Geräte. Zwei verschiedene Benutzer im gleichen Tailnet genügen für Taildrop nicht.

## 1. Tailscale auf SteamOS installieren

Wechsle in den Desktop-Modus und orientiere dich an [Tailscales Steam-Deck-Artikel](https://tailscale.com/blog/steam-deck). Er verlinkt das Deck-spezifische Installationsprojekt [tailscale-dev/deck-tailscale](https://github.com/tailscale-dev/deck-tailscale). **Lies dessen README und Installationsskript vor dem Ausführen.** Es ist nicht Teil von SteamClip; die Ersteinrichtung benötigt normalerweise `sudo`. SteamOS nur für `pacman -S tailscale` beschreibbar zu machen, ist keine dauerhafte Lösung – Systemupdates ersetzen die veränderte Partition. Verwende eine Installation, die Updates übersteht und `tailscaled` beim Start lädt.

Das Deck-Installationsprojekt legt die CLI üblicherweise unter `/opt/tailscale/tailscale` ab. SteamClip sucht außerdem im `PATH` und unter `/usr/local/bin`. Eine isolierte Flatpak-App ohne zugängliche `tailscale`-CLI und laufenden Daemon reicht nicht.

Nachdem du die [aktuelle Installationsanleitung](https://github.com/tailscale-dev/deck-tailscale/blob/main/readme.md) und `tailscale.sh` geprüft hast, lauten die dort beschriebenen Schritte in **Desktop-Modus → Konsole**:

```sh
git clone https://github.com/tailscale-dev/deck-tailscale.git ~/deck-tailscale
sudo -i
cd ~deck/deck-tailscale
bash tailscale.sh
source /etc/profile.d/tailscale.sh
tailscale up --qr --operator=deck
exit
```

Falls `sudo` nach einem Passwort fragt und noch keines eingerichtet ist, zuerst ein Passwort für den Benutzer `deck` setzen. Die Projektanleitung enthält zusätzlich `--ssh`; **für Taildrop weglassen**, wenn du Tailscale SSH nicht ausdrücklich benötigst. Die Ersteinrichtung braucht Rootrechte für den Daemon, aber SteamClip führt diese Befehle nie automatisch aus. Eine Aktualisierung nicht über die einzige aktive Tailscale-SSH-Verbindung starten (Abbruch kann dich aussperren).

## 2. Anmelden und Dateien senden aktivieren

1. Falls die Anmeldung nicht bereits bei der Installation abgeschlossen wurde, in **Desktop-Modus → Konsole** z. B. `sudo /opt/tailscale/tailscale up --operator=deck --qr` ausführen. Den QR-Code scannen und die Anmeldung abschließen. `--ssh` ist für Taildrop nicht nötig – nur verwenden, wenn du Tailscale SSH ausdrücklich willst.
2. Auf Handy oder PC die [Tailscale-App](https://tailscale.com/download) installieren, **denselben Tailscale-Benutzer** anmelden und verbinden. Beim iPhone die App zum Testen ggf. im Vordergrund öffnen.
3. In der [Tailnet-Verwaltung → Settings → General](https://login.tailscale.com/admin/settings/general) **Send Files / Dateien senden** einschalten. Taildrop ist eine Opt-in-Funktion; siehe [Taildrop-Dokumentation](https://tailscale.com/docs/features/taildrop). Getaggte Geräte sind keine Taildrop-Ziele.

## 3. Vor SteamClip prüfen

In der Konsole (Pfad bei anderer Installation anpassen):

```sh
systemctl status tailscaled --no-pager
/opt/tailscale/tailscale status
/opt/tailscale/tailscale file cp --targets
```

Der Empfänger muss in `file cp --targets` erscheinen. **Der Name aus dieser Liste** gilt für SteamClip; `HostName` aus `status --json` kann abweichen. Wenn das Gerät offline ist: Tailscale-App öffnen und `tailscale ping ZIELNAME` versuchen.

Einen kleinen, unkritischen Test mit einer **vorhandenen Datei** durchführen:

```sh
/opt/tailscale/tailscale file cp ~/Videos/test.mp4 ZIELNAME:
```

Der **Doppelpunkt hinter dem Zielnamen** ist wichtig. Nimm den Zielnamen aus `--targets`. Auf dem Empfangsgerät die Tailscale-App bzw. Benachrichtigung öffnen und die Datei sichern. Erst wenn der CLI-Test funktioniert: Gaming-Modus → ⋯ → Decky → SteamClip → Ziel und Clip wählen → Senden.

## Fehlerbehebung

| Symptom | Prüfung |
| --- | --- |
| „Tailscale nicht installiert“ | Gibt es die CLI (`ls -l /opt/tailscale/tailscale`)? Auch `tailscaled` muss laufen. |
| „Taildrop nicht verfügbar“ | `systemctl status tailscaled`; Anmeldung prüfen; Fehlermeldung der CLI in SteamClip beachten. |
| Keine Zielgeräte | **Send Files** aktiviert? Auf beiden Geräten **derselbe Benutzer** angemeldet? Getaggte Geräte und Geräte anderer Tailnet-Benutzer sind ausgeschlossen. |
| Ziel offline | Tailscale-App am Ziel aktivieren; `tailscale ping ZIELNAME` ausprobieren. |
| Fortschritt hängt / Versand fehlgeschlagen | Zielgerät wach halten; `~/.local/state/steamclip-taildrop/transfer.log` und `journalctl -u tailscaled -b --no-pager -n 80` prüfen. |
| Keine Clips | Clip in Steam speichern oder MP4 nach `~/Videos`/`~/Downloads` exportieren und die Liste aktualisieren. |

**Datenschutz:** Authentifizierungslinks, Schlüssel, Tailnet-IP-Adressen und private Gerätenamen vor öffentlichen Fehlerberichten aus Logs/Screenshots entfernen.
