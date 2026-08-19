import { useNavigate } from 'react-router-dom';
import { ConteudoPrivacidade } from './conteudoLegal';

const IconeVoltar = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
    <path
      d="M14.5 5.5L8 12l6.5 6.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function TelaPrivacidade() {
  const navegar = useNavigate();

  return (
    <div
      className="min-h-dvh px-0 md:px-6 pb-16"
      style={{
        background: 'linear-gradient(180deg, #3b4c5e 0%, #6c8496 100%)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
      }}
    >
      <div className="mx-auto w-full px-4 md:max-w-2xl md:p-10 md:bg-white/5 md:backdrop-blur-md md:border md:border-white/10 md:shadow-2xl md:rounded-2xl">
        <button
          type="button"
          onClick={() => navegar(-1)}
          aria-label="Voltar"
          className="inline-flex size-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white backdrop-blur-md hover:opacity-85 transition-opacity"
        >
          <IconeVoltar />
        </button>

        <h1 className="mt-6 text-2xl md:text-3xl font-extrabold text-white">Política de Privacidade</h1>
        <p className="t-label mt-1 text-slate-400">Última atualização: [data]</p>

        <div className="mt-6">
          <ConteudoPrivacidade />
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={() => navegar(-1)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 transition-opacity hover:opacity-85 bg-teal-600 hover:bg-teal-700 text-white font-bold h-12"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
