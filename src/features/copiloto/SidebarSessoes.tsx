import { useConfirm } from '@/contexts/ConfirmContext';
import type { SessaoChat } from '@/domain/tipos';

type Props = {
  sessoes: SessaoChat[];
  sessaoAtivaId: string | null;
  onNovaConversa: () => void;
  onSelecionar: (sessaoId: string) => void;
  onExcluir: (sessaoId: string) => Promise<void>;
};

const IconeMais = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

const IconeLixeira = () => (
  <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
    <path
      d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0 1 12a1 1 0 001 1h6a1 1 0 001-1l1-12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Lista de sessões de chat, usada tanto no painel fixo do desktop quanto
 * dentro do drawer mobile — a mesma marcação, só muda quem a posiciona.
 */
export function SidebarSessoes({ sessoes, sessaoAtivaId, onNovaConversa, onSelecionar, onExcluir }: Props) {
  const { askConfirm } = useConfirm();

  function pedirExclusao(sessao: SessaoChat) {
    askConfirm({
      title: 'Apagar conversa',
      message: 'Tem certeza que deseja apagar esta conversa? Essa ação não pode ser desfeita.',
      confirmText: 'Apagar',
      onConfirm: () => void onExcluir(sessao.id),
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-3">
        <button
          type="button"
          onClick={onNovaConversa}
          className="flex w-full items-center gap-2 rounded-[var(--r-field)] bg-blue-600 px-4 py-2.5 t-label text-white transition-opacity hover:bg-blue-700"
        >
          <IconeMais />
          Nova conversa
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {sessoes.length === 0 ? (
          <p className="t-label px-2 py-3 text-ink-faint">Suas conversas aparecem aqui.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sessoes.map((sessao) => {
              const ativa = sessao.id === sessaoAtivaId;
              return (
                <li key={sessao.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelecionar(sessao.id)}
                    className={`block w-full truncate rounded-[var(--r-field)] py-2.5 pl-3 pr-11 text-left t-label transition-colors ${
                      ativa ? 'bg-sunken text-ink' : 'text-ink-muted hover:bg-sunken'
                    }`}
                  >
                    {sessao.titulo || 'Nova conversa'}
                  </button>
                  <button
                    type="button"
                    onClick={() => pedirExclusao(sessao)}
                    aria-label={`Apagar conversa "${sessao.titulo || 'Nova conversa'}"`}
                    className="absolute right-0.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-ink-faint transition-colors hover:bg-card hover:text-danger"
                  >
                    <IconeLixeira />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
