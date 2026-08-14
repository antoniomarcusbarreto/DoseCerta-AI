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

export function TelaTermos() {
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

        <h1 className="mt-6 text-2xl md:text-3xl font-extrabold text-white">Termos de Uso</h1>
        <p className="t-label mt-1 text-slate-400">Última atualização: [data]</p>

        <div className="space-y-6 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-2">1. Aceitação e Natureza do Serviço</h2>
            <p>Ao utilizar o Dose Certa-AI, você concorda com estes Termos de Uso. O aplicativo é uma ferramenta de tecnologia desenvolvida para auxiliar na organização pessoal, registro de hábitos e acompanhamento de rotinas.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">2. Aviso Médico Importante (Isenção de Responsabilidade)</h2>
            <p className="font-medium text-red-400">O Dose Certa-AI e seu Co-piloto de Inteligência Artificial NÃO são serviços médicos.</p>
            <p className="mt-2">As informações, dicas de bem-estar e análises de refeições fornecidas não substituem, em hipótese alguma, diagnósticos, prescrições, consultas ou orientações de médicos, nutricionistas e profissionais de saúde qualificados. Nunca altere seu tratamento ou medicação com base nas interações com o aplicativo. Em caso de sintomas graves, procure atendimento médico imediatamente.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">3. Responsabilidade do Usuário</h2>
            <p>Você é inteiramente responsável pela veracidade dos dados inseridos (como peso, sintomas e fotos) e por manter a confidencialidade de suas credenciais de acesso.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">4. Propriedade Intelectual</h2>
            <p>Todo o design, código e tecnologia empregados no aplicativo são de propriedade exclusiva de seus criadores, sendo proibida a reprodução ou engenharia reversa sem autorização.</p>
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
