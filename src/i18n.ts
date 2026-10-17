export type Locale = 'en' | 'de';
export const languageFromDevice = (): Locale =>
  (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de')) ? 'de' : 'en';

export const translations = {
  en: {
    language: 'Language', target: 'Target device', chooseTarget: 'Choose target', offline: 'offline',
    clip: 'Choose clip or MP4', chooseClip: 'Choose clip', refresh: 'Refresh files & devices',
    send: 'Send clip as MP4', chooseFirst: 'Choose a target device first.',
    noClips: 'No saved clips found. Save a clip in Steam first.',
    ready: 'Ready', queued: 'Starting transfer…', converting: 'Creating MP4 without re-encoding…',
    connecting: 'Connecting via Tailscale…', sent: 'MP4 sent to {target}',
    transferred: '{percent}% transferred{eta}',
    tailscaleMissing: 'Tailscale is not installed on this Deck. Install it, log in and enable Taildrop (Send Files). See the setup guide in the plugin README.',
    tailscaleUnavailable: 'Tailscale is unavailable: {detail}',
    taildropUnavailable: 'Taildrop is unavailable: {detail}',
    noTargets: 'No Taildrop targets. Sign in on both devices with the same Tailscale account, enable Send Files, and keep the receiver connected.',
    targetInvalid: 'Choose a device from the Taildrop targets list.',
    fileMissing: 'File not found. Refresh the file list.',
    fileInvalid: 'Only MP4 files in the Deck user directory are supported.',
    fileTooLarge: 'File exceeds the 20 GB limit.',
    busy: 'A transfer is already running.', noTarget: 'Choose a Taildrop target first.',
    targetUnavailable: 'The saved target is unavailable. Choose another device.',
    transferTimedOut: 'Transfer timed out after 30 minutes.',
    transferFailed: 'Taildrop failed. Check transfer.log and that the receiver is connected.',
    workerBusy: 'Another clip is already transferring.',
    clipMissing: 'The selected clip no longer exists.',
    mp4Empty: 'MP4 export is empty.', unknownFile: 'Unknown file type.',
  },
  de: {
    language: 'Sprache', target: 'Zielgerät', chooseTarget: 'Ziel wählen', offline: 'offline',
    clip: 'Clip oder MP4 auswählen', chooseClip: 'Clip wählen', refresh: 'Dateien & Geräte aktualisieren',
    send: 'Clip als MP4 senden', chooseFirst: 'Bitte zuerst ein Zielgerät wählen.',
    noClips: 'Keine gespeicherten Clips gefunden. Zuerst einen Clip in Steam speichern.',
    ready: 'Bereit', queued: 'Übertragung wird gestartet …', converting: 'Erstelle MP4 ohne Neukodierung …',
    connecting: 'Verbinde über Tailscale …', sent: 'MP4 an {target} gesendet',
    transferred: '{percent} % übertragen{eta}',
    tailscaleMissing: 'Tailscale ist auf dem Deck nicht installiert. Installiere es, melde dich an und aktiviere Taildrop (Dateien senden). Anleitung in der Plugin-README.',
    tailscaleUnavailable: 'Tailscale ist nicht erreichbar: {detail}',
    taildropUnavailable: 'Taildrop ist nicht verfügbar: {detail}',
    noTargets: 'Keine Taildrop-Ziele. Auf beiden Geräten mit demselben Tailscale-Konto anmelden, „Dateien senden“ aktivieren und das Zielgerät online halten.',
    targetInvalid: 'Wähle ein Gerät aus der Taildrop-Zielliste.',
    fileMissing: 'Datei nicht gefunden. Dateiliste aktualisieren.',
    fileInvalid: 'Nur MP4-Dateien im Benutzerordner des Decks werden unterstützt.',
    fileTooLarge: 'Datei ist größer als 20 GB.',
    busy: 'Eine Übertragung läuft bereits.', noTarget: 'Bitte zuerst ein Taildrop-Ziel wählen.',
    targetUnavailable: 'Das gespeicherte Ziel ist nicht verfügbar. Wähle ein anderes Gerät.',
    transferTimedOut: 'Übertragung nach 30 Minuten abgebrochen.',
    transferFailed: 'Taildrop fehlgeschlagen. Prüfe transfer.log und die Verbindung des Zielgeräts.',
    workerBusy: 'Ein anderer Clip wird bereits übertragen.',
    clipMissing: 'Der ausgewählte Clip ist nicht mehr vorhanden.',
    mp4Empty: 'MP4-Export ist leer.', unknownFile: 'Unbekannter Dateityp.',
  },
} as const;
export type Key = keyof typeof translations.en;
export function tr(locale: Locale, key: Key, vars: Record<string, string | number> = {}): string {
  const template: string = translations[locale][key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}
