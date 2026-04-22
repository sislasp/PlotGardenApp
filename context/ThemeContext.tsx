import { Colors, ThemeName } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

type ThemeContextType = {
  themeName: ThemeName;
  theme: typeof Colors.light;
  setTheme: (name: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  themeName: 'light',
  theme: Colors.light,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('light');

  useEffect(() => {
    AsyncStorage.getItem('appTheme').then(t => {
      if (t && Colors[t as ThemeName]) setThemeName(t as ThemeName);
    });
  }, []);

  async function setTheme(name: ThemeName) {
    setThemeName(name);
    await AsyncStorage.setItem('appTheme', name);
  }

  return (
    <ThemeContext.Provider value={{ themeName, theme: Colors[themeName], setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}