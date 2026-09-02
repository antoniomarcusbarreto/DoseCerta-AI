import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

type Theme = 'menta-claro' | 'lavanda-clara' | 'oceano-escuro';

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  carregandoTema: boolean;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

const CHAVE_TEMA_CACHE = 'tema_preferido';

const TEMAS_VALIDOS: Theme[] = ['menta-claro', 'lavanda-clara', 'oceano-escuro'];

function lerTemaCache(): Theme | null {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA_CACHE);
    return TEMAS_VALIDOS.includes(salvo as Theme) ? (salvo as Theme) : null;
  } catch {
    return null;
  }
}

function gravarTemaCache(theme: Theme): void {
  try {
    localStorage.setItem(CHAVE_TEMA_CACHE, theme);
  } catch {
    // Storage indisponível (modo privado, cota cheia) — o tema ainda funciona
    // na sessão atual, só não sobrevive a um reload sem o Firestore.
  }
}

/**
 * O tema mora no Firestore (sincroniza entre dispositivos), mas essa leitura
 * é assíncrona e o reload que atualiza o app (`ReloadPrompt` → skip-waiting)
 * pode acontecer bem perto de uma troca de tema recém-feita, cortando a
 * gravação no meio do caminho — sem cache local, o próximo boot volta pro
 * padrão em vez do que a pessoa escolheu por último. `localStorage` guarda o
 * último tema aplicado com sucesso e serve tanto de pintura inicial (sem o
 * flash pro padrão enquanto o Firestore não responde) quanto de rede de
 * segurança se aquela gravação específica não tiver completado a tempo.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => lerTemaCache() ?? 'oceano-escuro');
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
            const temaDoServidor = data.preferences.theme as Theme;
            setThemeState(temaDoServidor);
            gravarTemaCache(temaDoServidor);
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
    // Sem isso, navegar do app de paciente pro /painel (SPA, sem reload)
    // deixaria o atributo do último tema escolhido grudado no <html>,
    // vazando cor de paciente pro painel administrativo.
    return () => document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    // Grava no cache local antes mesmo da escrita no Firestore terminar: se um
    // reload cortar essa escrita (ex.: clicar em "Atualizar agora" logo depois
    // de trocar o tema), o próximo boot ainda lê o tema certo daqui.
    gravarTemaCache(newTheme);
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
