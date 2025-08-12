// Simple React state alternative to external state management

// Simple React state alternative to jotai
let founderModeState = false;
let founderModeListeners: ((state: boolean) => void)[] = [];

export const founderModeAtom = {
  get: () => founderModeState,
  set: (newState: boolean) => {
    founderModeState = newState;
    founderModeListeners.forEach(listener => listener(newState));
  },
  subscribe: (listener: (state: boolean) => void) => {
    founderModeListeners.push(listener);
    return () => {
      founderModeListeners = founderModeListeners.filter(l => l !== listener);
    };
  }
};