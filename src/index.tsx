import { ButtonItem, Dropdown, PanelSection, PanelSectionRow } from '@decky/ui';
import { callable, definePlugin } from '@decky/api';
import { useEffect, useState } from 'react';
import { FaVideo } from 'react-icons/fa';
import { languageFromDevice, tr, translations, type Locale, type Key } from './i18n';

function localizedError(locale: Locale, error: unknown): string {
  const message = String(error);
  const key = (Object.keys(translations.en) as Key[]).find(k =>
    new RegExp('(?:^|[^A-Za-z])' + k + '(?::|$|[^A-Za-z])').test(message));
  if (!key) return message;
  const detail = message.match(new RegExp(key + ':\\s*([^\\n]+)'))?.[1] || '';
  return tr(locale, key, { detail });
}

type Clip = { id: string; kind: string; label: string; size: number; size_label: string };
type Target = { name: string; online: boolean; detail: string };
type Config = { target: string; locale: string; targets: Target[]; diagnostic_code: string; diagnostic_detail: string };
type Progress = { stage: string; percent: number; message: string; code?: string; file?: string; target?: string; eta?: string };
const listClips = callable<[], Clip[]>('list_clips');
const getConfig = callable<[], Config>('get_config');
const setTarget = callable<[name: string], { target: string }>('set_target');
const setLocale = callable<[locale: Locale], { locale: Locale }>('set_locale');
const getProgress = callable<[], Progress>('get_progress');
const sendClip = callable<[clipId: string], Progress>('send_clip');

function Content() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [target, setTargetName] = useState('');
  const [selected, setSelected] = useState('');
  const [progress, setProgress] = useState<Progress>({ stage: 'idle', percent: 0, message: 'Ready' });
  const [error, setError] = useState('');
  const [locale, setLanguage] = useState<Locale>(languageFromDevice());
  const [diagnostic, setDiagnostic] = useState<{ code: string; detail: string }>({ code: '', detail: '' });

  const refresh = async () => {
    try {
      const [found, cfg] = await Promise.all([listClips(), getConfig()]);
      setClips(found);
      setSelected(old => found.some(c => c.id === old) ? old : (found[0]?.id ?? ''));
      setTargets(cfg.targets);
      setTargetName(cfg.target);
      if (cfg.locale === 'en' || cfg.locale === 'de') setLanguage(cfg.locale);
      setDiagnostic({ code: cfg.diagnostic_code || '', detail: cfg.diagnostic_detail || '' });
      setError('');
    } catch (e) { setError(localizedError(locale, e)); }
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
      void getConfig().then(cfg => { setTargets(cfg.targets); setDiagnostic({ code: cfg.diagnostic_code || '', detail: cfg.diagnostic_detail || '' }); }).catch(() => {});
    }, 15000);
    return () => { mounted = false; window.clearInterval(progressTimer); window.clearInterval(targetTimer); };
  }, []);

  const busy = ['queued', 'converting', 'sending'].includes(progress.stage);
  const changeTarget = async (name: string) => {
    try { setTargetName(name); await setTarget(name); setError(''); }
    catch (e) { setError(localizedError(locale, e)); }
  };
  const changeLocale = async (next: Locale) => {
    try { await setLocale(next); setLanguage(next); setError(''); }
    catch (e) { setError(localizedError(locale, e)); }
  };
  const sendClipSel = async () => {
    if (!selected || !target || !!diagnostic.code || busy) return;
    try { setError(''); setProgress(await sendClip(selected)); }
    catch (e) { setError(localizedError(locale, e)); }
  };
  const value = Math.min(100, Math.max(0, progress.percent || 0));
  const progressKey = progress.code && progress.code in translations.en ? progress.code as Key : null;
  const progressText = progressKey ? tr(locale, progressKey, {
    target: progress.target || target, percent: value.toFixed(1), eta: progress.eta || '', detail: progress.message,
  }) : progress.message;
  return <PanelSection title="SteamClip">
    <PanelSectionRow><Dropdown
      menuLabel={tr(locale, 'language')}
      rgOptions={[{data: 'en', label: 'English'}, {data: 'de', label: 'Deutsch'}]}
      selectedOption={locale}
      onChange={item => void changeLocale(item.data as Locale)}
    /></PanelSectionRow>
    <PanelSectionRow><Dropdown
      menuLabel={tr(locale, 'target')}
      strDefaultLabel={tr(locale, 'chooseTarget')}
      rgOptions={targets.map(t => ({ data: t.name, label: `${t.online ? '●' : '○'} ${t.name}${t.online ? '' : ` (${tr(locale, 'offline')})`}` }))}
      selectedOption={target}
      onChange={item => void changeTarget(item.data)}
      disabled={busy}
    /></PanelSectionRow>
    <PanelSectionRow><Dropdown
      menuLabel={tr(locale, 'clip')}
      strDefaultLabel={tr(locale, 'chooseClip')}
      rgOptions={clips.map(c => ({ data: c.id, label: c.label }))}
      selectedOption={selected}
      onChange={item => setSelected(item.data)}
      disabled={busy}
    /></PanelSectionRow>
    <PanelSectionRow><ButtonItem layout="below" onClick={() => void refresh()} disabled={busy}>{tr(locale, 'refresh')}</ButtonItem></PanelSectionRow>
    <PanelSectionRow><ButtonItem layout="below" onClick={() => void sendClipSel()} disabled={!selected || !target || !!diagnostic.code || busy}>{tr(locale, 'send')}</ButtonItem></PanelSectionRow>
    <PanelSectionRow>
      <div style={{ width: '100%', fontSize: 'small' }}>
        <div>{progress.file || ''}</div>
        <div style={{ background: '#343b48', borderRadius: 4, height: 13, overflow: 'hidden', marginTop: 5 }}>
          <div style={{ width: `${value}%`, background: progress.stage === 'error' ? '#cf5656' : '#69a9ea', height: '100%', transition: 'width .5s' }} />
        </div>
        <div style={{ marginTop: 5 }}>{progressText}</div>
        {!target && !diagnostic.code && <div style={{ color: '#e0b25a' }}>{tr(locale, 'chooseFirst')}</div>}
        {diagnostic.code && <div style={{ color: '#e0b25a' }}>{diagnostic.code in translations.en ? tr(locale, diagnostic.code as Key, {detail: diagnostic.detail}) : diagnostic.detail}</div>}
        {!clips.length && <div>{tr(locale, 'noClips')}</div>}
        {error && <div style={{ color: '#e27b7b' }}>{error}</div>}
      </div>
    </PanelSectionRow>
  </PanelSection>;
}
export default definePlugin(() => ({
  name: 'SteamClip',
  titleView: <div>SteamClip</div>,
  content: <Content />,
  icon: <FaVideo />,
}));
