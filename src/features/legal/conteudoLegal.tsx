export function ConteudoTermos() {
  return (
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
  );
}

export function ConteudoPrivacidade() {
  return (
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
  );
}
