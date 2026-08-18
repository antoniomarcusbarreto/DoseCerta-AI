import { useEffect, useState, type FormEvent } from 'react';
import { SheetCard } from '@/components/SheetCard';
import { StatBig } from '@/components/StatBig';
import { Field } from '@/components/Field';
import { Alerta } from '@/components/Alerta';
import { adminEnviarBroadcast, adminMetricas } from './api';

export function TelaPainelDashboard() {
  const [metricas, setMetricas] = useState<{ totalUsuarios: number; totalAssinantes: number } | null>(
    null,
  );
  const [carregandoMetricas, setCarregandoMetricas] = useState(true);

  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    adminMetricas()
      .then(setMetricas)
      .catch(() => setErro('Não foi possível carregar as métricas.'))
      .finally(() => setCarregandoMetricas(false));
  }, []);

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

      <SheetCard titulo="Notificação push global" subtitulo="Envia para todos os usuários com notificações habilitadas">
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

          <button
            type="submit"
            disabled={enviando}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 t-label font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-45 disabled:pointer-events-none"
          >
            {enviando ? 'Enviando…' : 'Enviar para todos'}
          </button>
        </form>
      </SheetCard>
    </div>
  );
}
