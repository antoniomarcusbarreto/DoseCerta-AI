import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { SheetCard } from '@/components/SheetCard';
import { formatarHorario, nomeDiaSemana } from '@/domain/datas';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDados } from '@/features/dados/DadosProvider';
import { useTheme } from '@/features/theme/ThemeProvider';

type Item = {
  para?: string;
  titulo: string;
  descricao: string;
  /** Seções ainda não construídas aparecem, mas desabilitadas. */
  emBreve?: boolean;
};

const IconeSeta = () => (
  <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
    <path
      d="M9.5 5.5L16 12l-6.5 6.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Lista das seções que não são de uso diário.
 *
 * É aqui que as funcionalidades novas entram — a barra de abas continua com
 * quatro itens por mais coisas que o app ganhe.
 */
export function TelaAjustes() {
  const { usuario, sair } = useAuth();
  const { protocolo, medicamentos } = useDados();
  const { theme, setTheme } = useTheme();

  const itens: Item[] = [
    {
      para: '/ajustes/tratamento',
      titulo: 'Tratamento',
      descricao: protocolo
        ? `${protocolo.medicamento} ${protocolo.doseAtualMg.toLocaleString('pt-BR')} mg · ${
            protocolo.frequencia === 'semanal' && protocolo.diaSemana !== null
              ? nomeDiaSemana(protocolo.diaSemana)
              : 'diária'
          } às ${formatarHorario(protocolo.horarioMin)}`
        : 'Nenhum protocolo cadastrado',
    },
    {
      para: '/ajustes/medicamentos',
      titulo: 'Medicamentos',
      descricao:
        medicamentos.length > 0
          ? `${medicamentos.length} no seu catálogo`
          : 'Catálogo de canetas, doses e validade',
    },
    {
      para: '/ajustes/suporte',
      titulo: 'Suporte e Feedback',
      descricao: 'Dúvidas, bugs ou sugestões',
    },
    {
      para: '/ajustes/lembretes',
      titulo: 'Lembretes',
      descricao: 'Notificação no dia da aplicação',
    },
    {
      para: '/ajustes/meus-dados',
      titulo: 'Meus dados',
      descricao: 'Senha, assinatura e exclusão de conta',
    },
  ];

  return (
    <Pagina
      hero={
        <Hero
          titulo="Ajustes"
          direita={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTheme('menta-claro')}
                className={`size-6 rounded-full bg-[#14b8a6] border-2 transition-transform ${
                  theme === 'menta-claro' ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'
                }`}
                aria-label="Menta Claro"
              />
              <button
                type="button"
                onClick={() => setTheme('lavanda-clara')}
                className={`size-6 rounded-full bg-[#a855f7] border-2 transition-transform ${
                  theme === 'lavanda-clara' ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'
                }`}
                aria-label="Lavanda Clara"
              />
              <button
                type="button"
                onClick={() => setTheme('oceano-escuro')}
                className={`size-6 rounded-full bg-[#3b4c5e] border-2 transition-transform ${
                  theme === 'oceano-escuro' ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'
                }`}
                aria-label="Oceano Escuro"
              />
            </div>
          }
        >
          <div className="mt-6">
            <p className="t-caption text-on-hero-muted">Conta</p>
            <p className="t-stat mt-1.5 text-on-hero">
              {usuario?.displayName || usuario?.email || '—'}
            </p>
          </div>
        </Hero>
      }
      /* "Sair" e o aviso já eram os dois últimos blocos da tela, então no
         celular o empilhamento continua idêntico; no desktop eles saem da
         frente e a lista de seções fica com a coluna principal inteira. */
      lateral={
        <>
          <SheetCard>
            <Button variante="primaria" larguraTotal onClick={() => void sair()}>
              Sair da conta
            </Button>
          </SheetCard>

          <SheetCard>
            <p className="t-label text-ink-muted">
              O DoseCerta organiza e registra o seu tratamento. Ele não prescreve e não substitui a
              orientação de quem acompanha você.
            </p>
          </SheetCard>
        </>
      }
    >
      <SheetCard>
        <ul className="divide-y" style={{ borderColor: 'var(--border-hair)' }}>
          {itens.map((item) => {
            const conteudo = (
              <>
                <div className="min-w-0">
                  <p className="t-label text-ink">{item.titulo}</p>
                  <p className="t-label mt-0.5 text-ink-muted">{item.descricao}</p>
                </div>
                {item.emBreve ? (
                  <span className="t-caption shrink-0 text-ink-faint">em breve</span>
                ) : (
                  <span className="text-ink-muted">
                    <IconeSeta />
                  </span>
                )}
              </>
            );

            return (
              <li key={item.titulo}>
                {item.para ? (
                  <Link
                    to={item.para}
                    /* O realce de mouse acompanha exatamente a largura do
                       divisor: com recuo negativo ele passaria por fora da
                       linha e o alinhamento ficaria torto. */
                    className="flex min-h-14 items-center justify-between gap-3 transition-colors hover:bg-sunken lg:min-h-16"
                  >
                    {conteudo}
                  </Link>
                ) : (
                  <div
                    className="flex min-h-14 items-center justify-between gap-3 py-3 opacity-60"
                    aria-disabled="true"
                  >
                    {conteudo}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </SheetCard>
    </Pagina>
  );
}
