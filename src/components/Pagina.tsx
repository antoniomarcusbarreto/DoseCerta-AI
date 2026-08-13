import type { ReactNode } from 'react';

type PaginaProps = {
  /** O <Hero> já montado pela tela. */
  hero: ReactNode;
  /** Coluna principal. Abaixo de `lg` é a única coluna. */
  children: ReactNode;
  /**
   * Coluna de apoio do desktop. Ausente, a página cai sozinha em coluna única
   * centrada — é o que evita um card solto à esquerda de uma área vazia nas
   * telas que têm pouco conteúdo.
   *
   * No celular estes cards NÃO somem: eles continuam empilhados no fim da
   * lista, como estavam antes de existir a coluna. Só passe para cá o que já
   * era o último bloco da tela — o que for exclusivo do desktop deve vir
   * embrulhado em `hidden lg:block` pela própria tela.
   */
  lateral?: ReactNode;
  /**
   * 'painel' usa a largura disponível; 'foco' mantém a coluna estreita em
   * qualquer tela. Formulário espalhado por 1120px não fica melhor, fica pior.
   */
  layout?: 'painel' | 'foco';
};

/**
 * Esqueleto de toda tela interna: herói em cima, conteúdo embaixo.
 *
 * Antes deste componente o par `Hero` + `<main className="relative z-10 -mt-8
 * space-y-4 px-5 pb-8">` estava copiado em sete telas, cada uma com o próprio
 * `max-w-md` — e qualquer mudança responsiva virava sete edições que divergiam.
 *
 * Cuidado ao mexer: nada aqui pode ganhar `transform`, `filter`,
 * `backdrop-filter`, `will-change` ou `contain`. Qualquer um deles cria um
 * novo bloco contedor e reancora os elementos `position: fixed` do app (a
 * navegação lateral e a folha de registro), que passariam a se posicionar
 * relativo a esta div em vez do viewport.
 */
export function Pagina({ hero, children, lateral, layout = 'painel' }: PaginaProps) {
  const foco = layout === 'foco';

  /*
   * `grid gap-4` e não `space-y-4`: space-y injeta margin-top no irmão
   * seguinte, o que desalinha as linhas quando o main vira grid de 2 colunas.
   * E `lg:items-start` é obrigatório, senão a coluna de apoio estica até a
   * altura da principal e a sombra do card fica no lugar errado.
   */
  return (
    /* `trilho-foco` aperta a variável do trilho, que o herói e o <main> leem
       juntos — por isso ele embrulha os dois, e não só o conteúdo. */
    <div className={foco ? 'trilho-foco' : undefined}>
      {hero}

      <main
        className={`faixa relative z-10 -mt-8 grid gap-4 pb-8 lg:gap-6 lg:pb-12 ${
          !foco && lateral
            ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:items-start'
            : !foco
              ? 'lg:max-w-[760px]'
              : ''
        }`}
      >
        <div className="grid gap-4 lg:gap-5">{children}</div>

        {/*
         * `contents` no celular: o wrapper desaparece da formatação e os cards
         * viram filhos diretos do <main>, herdando o mesmo gap da coluna
         * principal. Sem isso o wrapper somaria uma linha de grid e um gap
         * extra, deslocando a tela inteira no celular.
         */}
        {lateral ? <div className="contents lg:grid lg:gap-5">{lateral}</div> : null}
      </main>
    </div>
  );
}
