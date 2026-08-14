import { useNavigate } from 'react-router-dom';

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

        <div className="space-y-6 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-2">1. Coleta de Dados Pessoais e Sensíveis</h2>
            <p>Para fornecer nossos serviços, coletamos informações de cadastro (nome, e-mail) e dados classificados pela LGPD (Lei Geral de Proteção de Dados) como sensíveis relativos à sua rotina de bem-estar: histórico de peso, registro de sintomas, fotos de refeições e horários de aplicações.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">2. Uso e Finalidade</h2>
            <p>Seus dados são utilizados exclusivamente para o funcionamento do aplicativo, personalização do Co-piloto de Inteligência Artificial, envio de lembretes e geração de gráficos de evolução do seu próprio uso.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">3. Armazenamento e Processamento Externo</h2>
            <p>O Dose Certa-AI utiliza infraestrutura de nuvem segura. Os textos inseridos no chat e os registros de sintomas são processados por serviços de Inteligência Artificial de terceiros estritamente para a formulação das respostas do assistente, sem que sejam utilizados para treinar modelos públicos que exponham sua identidade.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">4. Seus Direitos (LGPD)</h2>
            <p>Você tem total controle sobre suas informações. A qualquer momento, através do menu de Ajustes, você pode solicitar a exportação de seus registros ou a exclusão permanente e irreversível de sua conta, o que apagará todos os seus dados, fotos e histórico de nossos servidores.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">5. Contato e Dúvidas</h2>
            <p>Para exercer seus direitos previstos na LGPD ou para tirar qualquer dúvida sobre como seus dados são tratados, entre em contato conosco através do e-mail: <strong className="text-white">suporte@dosecerta.com</strong>.</p>
          </section>
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
