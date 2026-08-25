import { useEffect, useState, type FormEvent } from 'react';
import { SheetCard } from '@/components/SheetCard';
import { StatBig } from '@/components/StatBig';
import { Field } from '@/components/Field';
import { Alerta } from '@/components/Alerta';
import {
  adminEnviarBroadcast,
  adminEnviarPushTeste,
  adminMetricas,
  type ResultadoEnvioTeste,
} from './api';

type Destino = 'usuario' | 'todos';

/*
 * Palavra que destrava o envio global. Um `window.confirm` seco é clicado no
 * automático; digitar obriga a ler o que vai acontecer — e "notificar a base
 * inteira" é irreversível de um jeito que uma escrita no Firestore não é.
 */
const CONFIRMACAO_GLOBAL = 'ENVIAR';

export function TelaPainelDashboard() {
  const [metricas, setMetricas] = useState<{ totalUsuarios: number; totalAssinantes: number } | null>(
    null,
  );
  const [carregandoMetricas, setCarregandoMetricas] = useState(true);

  // Padrão é o envio direcionado: o global agora é a exceção, não o caminho fácil.
  const [destino, setDestino] = useState<Destino>('usuario');
  const [email, setEmail] = useState('');
  const [confirmacao, setConfirmacao] = useState('');

  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [resultadosTeste, setResultadosTeste] = useState<ResultadoEnvioTeste[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    adminMetricas()
      .then(setMetricas)
      .catch(() => setErro('Não foi possível carregar as métricas.'))
      .finally(() => setCarregandoMetricas(false));
  }, []);

  const globalDestravado = confirmacao.trim() === CONFIRMACAO_GLOBAL;

  function trocarDestino(novo: Destino) {
    setDestino(novo);
    setConfirmacao('');
    setResultado(null);
    setResultadosTeste(null);
    setErro(null);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setResultado(null);
    setResultadosTeste(null);
    setEnviando(true);
    try {
      if (destino === 'todos') {
        const resposta = await adminEnviarBroadcast(titulo, corpo);
        setResultado(
          `Enviado para ${resposta.enviados} dispositivo(s) de ${resposta.totalUsuarios} usuário(s).`,
        );
        setConfirmacao('');
      } else {
        const resposta = await adminEnviarPushTeste({ titulo, corpo, email: email.trim() });
        setResultadosTeste(resposta.resultados);
      }
      setTitulo('');
      setCorpo('');
    } catch (falha) {
      /*
       * O servidor distingue "e-mail não cadastrado" de falha genérica — vale
       * repassar a mensagem dele, senão o admin não sabe se errou o e-mail ou
       * se o envio quebrou.
       */
      const mensagem = falha instanceof Error ? falha.message : '';
      setErro(
        mensagem.includes('Nenhuma conta')
          ? 'Nenhuma conta encontrada com esse e-mail.'
          : 'Não foi possível enviar a notificação. Tente novamente.',
      );
    } finally {
      setEnviando(false);
    }
  }

  const estiloCampo = {
    borderRadius: 'var(--r-field)',
    background: 'var(--surface-sunken)',
    borderColor: 'var(--border-hair)',
  };

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
        titulo="Notificação push"
        subtitulo={
          destino === 'todos'
            ? 'Envia para TODOS os usuários com notificações habilitadas'
            : 'Envia só para a conta do e-mail informado'
        }
      >
        <form onSubmit={enviar} className="space-y-4">
          {erro ? <Alerta tom="danger" titulo={erro} /> : null}
          {resultado ? <Alerta tom="ok" titulo={resultado} /> : null}

          {resultadosTeste ? (
            <div>
              <p className="t-label text-ink">Resultado</p>
              <ul className="mt-1 space-y-1">
                {resultadosTeste.map((item) => (
                  <li
                    key={item.uid}
                    className="t-label"
                    style={{ color: item.enviados > 0 ? 'var(--ok)' : 'var(--danger)' }}
                  >
                    {item.email ?? item.uid} — {item.erro ?? `${item.enviados} dispositivo(s)`}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col">
            <label htmlFor="destino-push" className="t-caption text-ink-muted">
              Destino
            </label>
            <select
              id="destino-push"
              value={destino}
              onChange={(e) => trocarDestino(e.target.value as Destino)}
              className="mt-1.5 block w-full border px-4 py-2.5 t-body text-ink outline-none"
              style={estiloCampo}
            >
              <option value="usuario">Usuário específico (e-mail)</option>
              <option value="todos">Todos os usuários</option>
            </select>
          </div>

          {destino === 'usuario' ? (
            <Field
              rotulo="E-mail do destinatário"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          ) : null}

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
              style={estiloCampo}
            />
          </div>

          {destino === 'todos' ? (
            <div
              className="rounded-2xl border px-4 py-3"
              style={{ borderColor: 'var(--danger)', background: 'var(--danger-soft)' }}
            >
              <p className="t-label" style={{ color: 'var(--danger)' }}>
                Isto notifica a base inteira ({carregandoMetricas ? '—' : metricas?.totalUsuarios ?? 0}{' '}
                conta(s) cadastradas). Para testar, use o destino por e-mail.
              </p>
              <Field
                rotulo={`Digite ${CONFIRMACAO_GLOBAL} para liberar o envio`}
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
              />
            </div>
          ) : null}

          <button
            type="submit"
            disabled={enviando || (destino === 'todos' && !globalDestravado)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 t-label font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-45 disabled:pointer-events-none"
          >
            {enviando ? 'Enviando…' : destino === 'todos' ? 'Enviar para TODOS' : 'Enviar teste'}
          </button>
        </form>
      </SheetCard>
    </div>
  );
}
