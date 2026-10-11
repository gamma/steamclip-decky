import { ButtonItem, Dropdown, PanelSection, PanelSectionRow, staticClasses } from '@decky/ui';
import { callable, definePlugin } from '@decky/api';
import { useEffect, useState } from 'react';
import { FaVideo } from 'react-icons/fa';

type Clip = { id: string; kind: string; label: string; size: number; size_label: string };
type Target = { name: string; online: boolean; detail: string };
type Config = { target: string; targets: Target[] };
type Progress = { stage: string; percent: number; message: string; file?: string };
const listClips = callable<[], Clip[]>('list_clips');
const getConfig = callable<[], Config>('get_config');
const setTarget = callable<[name: string], { target: string }>('set_target');
const getProgress = callable<[], Progress>('get_progress');
const sendClip = callable<[clipId: string], Progress>('send_clip');

function Content() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [target, setTargetName] = useState('');
  const [selected, setSelected] = useState('');
  const [progress, setProgress] = useState<Progress>({ stage: 'idle', percent: 0, message: 'Bereit' });
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      const [found, cfg] = await Promise.all([listClips(), getConfig()]);
      setClips(found);
      setSelected(old => found.some(c => c.id === old) ? old : (found[0]?.id ?? ''));
      setTargets(cfg.targets);
      setTargetName(cfg.target);
      setError('');
    } catch (e) { setError(String(e)); }
  };

  useEffect(() => {
    void refresh();
    let mounted = true;
    const tick = async () => {
      try { const value = await getProgress(); if (mounted) setProgress(value); }
      catch (e) { if (mounted) setError(String(e)); }
    };
    void tick();
    const progressTimer = window.setInterval(() => void tick(), 1000);
    const targetTimer = window.setInterval(() => {
      void listClips().then(setClips).catch(() => {});
      void getConfig().then(cfg => setTargets(cfg.targets)).catch(() => {});
    }, 15000);
    return () => { mounted = false; window.clearInterval(progressTimer); window.clearInterval(targetTimer); };
  }, []);

  const busy = ['queued', 'converting', 'sending'].includes(progress.stage);
  const changeTarget = async (name: string) => {
    try { setTargetName(name); await setTarget(name); setError(''); }
    catch (e) { setError(String(e)); }
  };
  const sendClipSel = async () => {
    if (!selected || !target || busy) return;
    try { setError(''); setProgress(await sendClip(selected)); }
    catch (e) { setError(String(e)); }
  };
  const value = Math.min(100, Math.max(0, progress.percent || 0));
  return <PanelSection title="Steam-Clip ans iPhone">
    <PanelSectionRow>
      <Dropdown
        menuLabel="Zielgerät wählen"
        strDefaultLabel="Zielgerät"
        rgOptions={targets.map(t => ({ data: t.name, label: `${t.online ? '●' : '○'} ${t.name}${t.online ? '' : ' (offline)'}` }))}
        selectedOption={target}
        onChange={item => void changeTarget(item.data)}
        disabled={busy}
      />
    </PanelSectionRow>
    <PanelSectionRow>
      <Dropdown
        menuLabel="Clip oder MP4 wählen"
        strDefaultLabel="Clip wählen"
        rgOptions={clips.map(c => ({ data: c.id, label: c.label }))}
        selectedOption={selected}
        onChange={item => setSelected(item.data)}
        disabled={busy}
      />
    </PanelSectionRow>
    <PanelSectionRow><ButtonItem layout="below" onClick={() => void refresh()} disabled={busy}>Dateiliste aktualisieren</ButtonItem></PanelSectionRow>
    <PanelSectionRow><ButtonItem layout="below" onClick={() => void sendClipSel()} disabled={!selected || !target || busy}>Clip als MP4 senden</ButtonItem></PanelSectionRow>
    <PanelSectionRow>
      <div style={{ width: '100%', fontSize: 'small' }}>
        <div>{progress.file || ''}</div>
        <div style={{ background: '#343b48', borderRadius: 4, height: 13, overflow: 'hidden', marginTop: 5 }}>
          <div style={{ width: `${value}%`, background: progress.stage === 'error' ? '#cf5656' : '#69a9ea', height: '100%', transition: 'width .5s' }} />
        </div>
        <div style={{ marginTop: 5 }}>{progress.message} {progress.stage === 'sending' ? `(${value.toFixed(1)} %)` : ''}</div>
        {!target && <div style={{ color: '#e0b25a' }}>Bitte zuerst ein Zielgerät wählen.</div>}
        {!clips.length && <div>Kein gespeicherter Clip gefunden. In Steam zuerst einen Clip speichern.</div>}
        {error && <div style={{ color: '#e27b7b' }}>{error}</div>}
      </div>
    </PanelSectionRow>
  </PanelSection>;
}
export default definePlugin(() => ({
  name: 'SteamClip ans iPhone',
  titleView: <div className={staticClasses.Title}>SteamClip ans iPhone</div>,
  content: <Content />,
  icon: <FaVideo />,
}));
