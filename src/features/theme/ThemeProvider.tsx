import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

type Theme = 'menta-claro' | 'lavanda-clara' | 'oceano-escuro';

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  carregandoTema: boolean;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('oceano-escuro');
  const [carregandoTema, setCarregandoTema] = useState(true);
  const { usuario } = useAuth();

  useEffect(() => {
    async function loadTheme() {
      if (!usuario) {
        setCarregandoTema(false);
        return;
      }
      try {
        const userDocRef = doc(getDb(), 'users', usuario.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data?.preferences?.theme) {
            setThemeState(data.preferences.theme as Theme);
          }
        }
      } catch (error) {
        console.error('Failed to load theme preferences:', error);
      } finally {
        setCarregandoTema(false);
      }
    }
    loadTheme();
  }, [usuario]);

  useEffect(() => {
    // Aplica o tema na raiz do documento
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    if (!usuario) return;
    try {
      const userDocRef = doc(getDb(), 'users', usuario.uid);
      await setDoc(userDocRef, { preferences: { theme: newTheme } }, { merge: true });
    } catch (error) {
      console.error('Failed to save theme preferences:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, carregandoTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
