// Maps `react` to Steam's injected SP_REACT global.
export default window.SP_REACT;
export const useState = window.SP_REACT.useState;
export const useEffect = window.SP_REACT.useEffect;
