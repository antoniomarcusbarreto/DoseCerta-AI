import { createContext, useContext, useState, type ReactNode } from 'react';
import { Button } from '@/components/Button';
import { useDialogoModal } from '@/lib/useDialogoModal';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

type ConfirmContextType = {
  askConfirm: (options: ConfirmOptions) => void;
};

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<ConfirmOptions | null>(null);

  function askConfirm(options: ConfirmOptions) {
    setPedido(options);
  }

  function fechar() {
    setPedido(null);
  }

  function confirmar() {
    pedido?.onConfirm();
    fechar();
  }

  function cancelar() {
    pedido?.onCancel?.();
    fechar();
  }

  const dialogoRef = useDialogoModal<HTMLDivElement>(cancelar, pedido !== null);

  return (
    <ConfirmContext.Provider value={{ askConfirm }}>
      {children}

      {pedido ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={pedido.title}
        >
          <div aria-hidden="true" onClick={cancelar} className="absolute inset-0" />

          <div ref={dialogoRef} className="relative w-full max-w-sm rounded-2xl bg-card p-5">
            <h2 className="t-title text-ink">{pedido.title}</h2>
            <p className="t-label mt-2 text-ink-muted">{pedido.message}</p>

            <div className="mt-5 flex justify-end gap-2">
              <Button variante="fantasma" onClick={cancelar}>
                {pedido.cancelText ?? 'Cancelar'}
              </Button>
              <Button
                variante="primaria"
                onClick={confirmar}
                style={{ background: 'var(--danger)' }}
              >
                {pedido.confirmText ?? 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
