// Smoke test: import the built ES module bundle in Node with mocked Decky globals.
import { readFileSync } from 'node:fs';

const component = () => null;
globalThis.window = {
  DFL: {
    ButtonItem: component,
    Dropdown: component,
    PanelSection: component,
    PanelSectionRow: component,
    staticClasses: { Title: 'Title' },
  },
  SP_REACT: { useEffect: () => {}, useState: (v) => [v, () => {}], createElement: () => null },
  SP_JSX: { jsx: () => null, jsxs: () => null },
  __DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit: {
    connect: () => ({
      _version: 2,
      callable: () => async () => null,
      call: () => null,
      addEventListener: () => {},
      removeEventListener: () => {},
      routerHook: {},
      toaster: {},
      openFilePicker: () => {},
      executeInTab: () => {},
      injectCssIntoTab: () => {},
      removeCssFromTab: () => {},
      fetchNoCors: () => {},
      getExternalResourceURL: () => {},
      useQuickAccessVisible: () => {},
    }),
  },
};

const code = readFileSync(new URL('./dist/index.js', import.meta.url), 'utf8');
const imported = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const plugin = imported.default();
if (plugin.name !== 'SteamClip ans iPhone') throw new Error('invalid plugin');
console.log('frontend module valid:', plugin.name);
