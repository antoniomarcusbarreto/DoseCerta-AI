import type { ReactNode } from 'react';

export type HeroTom = 'padrao' | 'alerta';

type HeroProps = {
  /** Botão à esquerda do título (normalmente voltar). */
  esquerda?: ReactNode;
  /** Botão à direita do título (normalmente menu). */
  direita?: ReactNode;
  titulo?: ReactNode | string;
  /**
   * O gradiente muda de humor conforme o status: frio quando em dia,
   * deslocado para o quente quando há aplicação atrasada. É o feedback mais
   * visível do app sem introduzir uma cor de marca nova.
   */
  tom?: HeroTom;
  /**
   * Segunda coluna da faixa a partir do desktop — tipicamente o gráfico.
   * Abaixo de `lg` entra empilhado logo depois de `children`, que é
   * exatamente a ordem visual do celular.
   *
   * Existe por um motivo concreto além do estético: o HairlineChart desenha
   * barras de 1,5px FIXOS dentro de wrappers `flex-1`, então largura livre
   * não engrossa a barra, só multiplica o vão — o gráfico vira uma cerca de
   * fios soltos. Este slot é capado, e é o que mantém a densidade do celular.
   */
  aside?: ReactNode;
  /**
   * Ações do herói (o botão de registrar, por exemplo).
   *
   * Existe separado de `children` só por causa da ordem: no celular a leitura
   * é número → gráfico → ação, e se a ação viesse dentro de `children` o
   * gráfico cairia depois dela. No desktop número e ação ficam na coluna da
   * esquerda, uma sob a outra, com o gráfico à direita.
   */
  acoes?: ReactNode;
  children: ReactNode;
};

/**
 * Faixa de gradiente do topo das telas.
 *
 * O fundo sangra na largura toda (no desktop, na área ao lado da navegação
 * lateral), mas o conteúdo fica no trilho `.faixa` — o mesmo do <main> logo
 * abaixo, senão o texto do herói não alinha com os cards.
 *
 * O `pb-16` daqui é o que o `-mt-8` do <main> consome para os cards subirem
 * por cima do gradiente; mexer num sem o outro descola os dois. E o `isolate`
 * cria o contexto de empilhamento que obriga o `relative z-10` lá.
 */
export function Hero({
  esquerda,
  direita,
  titulo,
  tom = 'padrao',
  aside,
  acoes,
  children,
}: HeroProps) {
  return (
    <header
      className="relative isolate pb-16"
      style={{ background: tom === 'alerta' ? 'var(--grad-hero-alerta)' : 'var(--grad-hero)' }}
    >
      <div className="faixa faixa-hero">
        {/*
         * No celular o título é centralizado entre dois espaçadores de 44px,
         * como manda a convenção de app. No desktop os espaçadores VAZIOS
         * somem e o título alinha à esquerda, na mesma vertical do número e
         * dos cards — centralizado numa faixa de 1120px ele ficaria solto no
         * meio do nada.
         */}
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div
            className={`flex w-11 shrink-0 justify-start ${esquerda ? '' : 'lg:hidden'}`}
            aria-hidden={esquerda ? undefined : true}
          >
            {esquerda}
          </div>
          {titulo ? (
            <h1 className="t-title flex-1 truncate text-center text-on-hero lg:text-left">
              {titulo}
            </h1>
          ) : (
            <div className="flex-1" />
          )}
          <div
            className={`flex w-11 shrink-0 justify-end ${direita ? '' : 'lg:hidden'}`}
            aria-hidden={direita ? undefined : true}
          >
            {direita}
          </div>
        </div>

        {/*
         * Sem `lg:` a div é um bloco comum e os filhos empilham na ordem do
         * DOM com as próprias margens — por isso o celular fica intacto. Só
         * no desktop ela vira grade, e as coordenadas explícitas de linha e
         * coluna é que colocam a ação embaixo do número, e não embaixo do
         * gráfico.
         */}
        {aside || acoes ? (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:items-end lg:gap-x-10">
            <div className="lg:col-start-1 lg:row-start-1">{children}</div>
            {aside ? (
              <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-end">{aside}</div>
            ) : null}
            {acoes ? <div className="lg:col-start-1 lg:row-start-2">{acoes}</div> : null}
          </div>
        ) : (
          children
        )}
      </div>
    </header>
  );
}
