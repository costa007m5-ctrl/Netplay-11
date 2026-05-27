import { createContext, useContext } from 'react';

export const ThemeContext = createContext<{
  theme: string;
  setTheme: (t: string) => void;
  providerData: any;
}>({
  theme: 'default',
  setTheme: () => {},
  providerData: null,
});

export const useAppTheme = () => useContext(ThemeContext);
