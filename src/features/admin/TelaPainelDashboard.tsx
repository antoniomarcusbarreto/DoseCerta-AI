import { useEffect, useState, type FormEvent } from 'react';
import { SheetCard } from '@/components/SheetCard';
import { StatBig } from '@/components/StatBig';
import { Field } from '@/components/Field';
import { Alerta } from '@/components/Alerta';
import { adminEnviarBroadcast, adminMetricas } from './api';

/*
 * Palavra que destrava o envio global. Um `window.confirm` seco é clicado no
 * automático; digitar obriga a ler o que vai acontecer — e "notificar a base
 * inteira" é irreversível de um jeito que uma escrita no Firestore não é.
 *
 * O envio direcionado (para um usuário ou uma seleção) vive só na aba
 * Usuários, onde o contexto de dispositivos de cada conta está à vista. Aqui
 * fica exclusivamente o comunicado global, que não tem outro lugar.
 */
const CONFIRMACAO_GLOBAL = 'ENVIAR';

export function TelaPainelDashboard() {
  const [metricas, setMetricas] = useState<{ totalUsuarios: number; totalAssinantes: number } | null>(
    null,
  );
  const [carregandoMetricas, setCarregandoMetricas] = useState(true);

  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    adminMetricas()
      .then(setMetricas)
      .catch(() => setErro('Não foi possível carregar as métricas.'))
      .finally(() => setCarregandoMetricas(false));
  }, []);

  const destravado = confirmacao.trim() === CONFIRMACAO_GLOBAL;

  async function enviarBroadcast(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setResultado(null);
    setEnviando(true);
    try {
      const resposta = await adminEnviarBroadcast(titulo, corpo);
      setResultado(`Enviado para ${resposta.enviados} dispositivo(s) de ${resposta.totalUsuarios} usuário(s).`);
      setTitulo('');
      setCorpo('');
      setConfirmacao('');
    } catch {
      setErro('Não foi possível enviar a notificação. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="t-title text-ink">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SheetCard>
          <StatBig
            sobre="card"
            escala="stat"
            rotulo="Usuários cadastrados"
            valor={carregandoMetricas ? '—' : metricas?.totalUsuarios ?? 0}
          />
        </SheetCard>
        <SheetCard>
          <StatBig
            sobre="card"
            escala="stat"
            rotulo="Assinantes ativos"
            valor={carregandoMetricas ? '—' : metricas?.totalAssinantes ?? 0}
          />
        </SheetCard>
      </div>

      <SheetCard
        titulo="Notificação push global"
        subtitulo="Envia para TODOS os usuários com notificações habilitadas. Para testar, use “Enviar teste” na aba Usuários."
      >
        <form onSubmit={enviarBroadcast} className="space-y-4">
          {erro ? <Alerta tom="danger" titulo={erro} /> : null}
          {resultado ? <Alerta tom="ok" titulo={resultado} /> : null}

          <Field
            rotulo="Título"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={80}
          />
          <div className="flex flex-col">
            <label htmlFor="corpo-broadcast" className="t-caption text-ink-muted">
              Mensagem
            </label>
            <textarea
              id="corpo-broadcast"
              required
              rows={3}
              maxLength={200}
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              className="mt-1.5 block w-full border px-4 py-2.5 t-body text-ink outline-none"
              style={{
                borderRadius: 'var(--r-field)',
                background: 'var(--surface-sunken)',
                borderColor: 'var(--border-hair)',
              }}
            />
          </div>

          <div
            className="rounded-2xl border px-4 py-3"
            style={{ borderColor: 'var(--danger)', background: 'var(--danger-soft)' }}
          >
            <p className="t-label" style={{ color: 'var(--danger)' }}>
              Isto notifica a base inteira ({carregandoMetricas ? '—' : metricas?.totalUsuarios ?? 0}{' '}
              conta(s) cadastradas).
            </p>
            <Field
              rotulo={`Digite ${CONFIRMACAO_GLOBAL} para liberar o envio`}
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={enviando || !destravado}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 t-label font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-45 disabled:pointer-events-none"
          >
            {enviando ? 'Enviando…' : 'Enviar para TODOS'}
          </button>
        </form>
      </SheetCard>
    </div>
  );
}
