import { useState, type FormEvent } from 'react';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { descreverLocal, PONTOS_RODIZIO, proximoLocal } from '@/domain/aplicacao';
import { registrarAplicacao } from '@/features/dados/repositorio';
import { useDialogoModal } from '@/lib/useDialogoModal';
import type { Aplicacao, LocalAplicacao, Protocolo } from '@/domain/tipos';

type Props = {
  uid: string;
  protocolo: Protocolo;
  aplicacoes: Aplicacao[];
  canetaId: string | null;
  onFechar: () => void;
};

function paraInputLocal(data: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

/**
 * Folha modal de registro de aplicação.
 *
 * O local já vem preenchido com o próximo ponto do rodízio — a sugestão é o
 * caminho de menor atrito, e continuar aplicando no mesmo ponto é justamente
 * o que se quer evitar.
 */
export function FolhaRegistro({ uid, protocolo, aplicacoes, canetaId, onFechar }: Props) {
  const [quando, setQuando] = useState(paraInputLocal(new Date()));
  const [dose, setDose] = useState(String(protocolo.doseAtualMg).replace('.', ','));
  const [local, setLocal] = useState<LocalAplicacao>(() => proximoLocal(aplicacoes));
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const doseNumero = Number(dose.replace(',', '.'));

  const formulario = useDialogoModal<HTMLFormElement>(onFechar);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await registrarAplicacao(
        uid,
        {
          protocoloId: protocolo.id,
          dataHora: new Date(quando),
          doseMg: doseNumero > 0 ? doseNumero : protocolo.doseAtualMg,
          local,
          canetaId,
          status: 'aplicada',
          observacao: observacao.trim() || null,
        },
        protocolo,
        aplicacoes,
      );
      onFechar();
    } catch (falha) {
      console.error('[DoseCerta] falha ao registrar aplicação:', falha);
      setErro('Não foi possível registrar agora. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    // No celular é uma folha que sobe do rodapé; a partir do tablet vira um
    // diálogo centralizado — grudada na base de uma janela alta ela ficaria
    // longe demais do conteúdo.
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar aplicação"
    >
      {/* Escurecimento não-focável de propósito: como <button> ele entrava na
          ordem do Tab antes do formulário, e quem navega por teclado batia num
          controle sem rótulo visível. Fechar por teclado é o Escape e o botão
          Cancelar, que já estão no fluxo. */}
      <div aria-hidden="true" onClick={onFechar} className="absolute inset-0 bg-black/45" />

      {/* A altura é limitada e o miolo rola: em notebook de tela baixa (ou com
          o teclado aberto no celular) o botão de salvar sumia para fora. */}
      <form
        ref={formulario}
        onSubmit={enviar}
        className="folha relative max-h-[92dvh] w-full max-w-md overflow-y-auto bg-card p-5 pb-8 sm:max-h-[85dvh]"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="t-title text-ink">Registrar aplicação</h2>
          <Button variante="fantasma" onClick={onFechar} className="px-0">
            Cancelar
          </Button>
        </div>

        <div className="space-y-4">
          <Field
            rotulo="Quando"
            type="datetime-local"
            value={quando}
            onChange={(e) => setQuando(e.target.value)}
            required
          />

          <Field
            rotulo="Dose aplicada (mg)"
            inputMode="decimal"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
          />

          <div>
            <p className="t-caption text-ink-muted">Local — sugerido pelo rodízio</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PONTOS_RODIZIO.map((ponto) => {
                const ativo = ponto.regiao === local.regiao && ponto.lado === local.lado;
                return (
                  <button
                    key={`${ponto.regiao}-${ponto.lado}`}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setLocal(ponto)}
                    className="t-label min-h-11 rounded-full border px-3"
                    style={{
                      borderColor: ativo ? 'var(--ink)' : 'var(--border-hair)',
                      background: ativo ? 'var(--ink)' : 'transparent',
                      color: ativo ? 'var(--surface-card)' : 'var(--ink)',
                    }}
                  >
                    {descreverLocal(ponto)}
                  </button>
                );
              })}
            </div>
          </div>

          <Field
            rotulo="Observação (opcional)"
            placeholder="Ex.: leve náusea no dia seguinte"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />

          {erro ? <Alerta tom="danger" titulo={erro} /> : null}

          <Button type="submit" larguraTotal disabled={salvando}>
            {salvando ? 'Salvando…' : 'Confirmar aplicação'}
          </Button>
        </div>
      </form>
    </div>
  );
}
