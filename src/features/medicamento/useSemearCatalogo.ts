import { useEffect } from 'react';
import { getDoc } from 'firebase/firestore';
import { CATALOGO_VERSAO } from '@/domain/catalogo';
import { refSementeCatalogo } from '@/lib/firestore';
import { semearMedicamentos } from '@/features/dados/repositorio';

/**
 * Contas já checadas nesta carga da página.
 *
 * Vive no módulo, não numa ref: o StrictMode monta e desmonta o provider duas
 * vezes em desenvolvimento, e uma ref não sobreviveria a isso.
 */
const checados = new Set<string>();

/**
 * Semeia o catálogo de medicamentos na primeira abertura da conta.
 *
 * Roda no `DadosProvider` porque é o único ponto que monta uma vez por sessão
 * autenticada e já tem o uid: no `Onboarding` deixaria sem catálogo quem já
 * tem protocolo, e na tela de Medicamentos deixaria o seletor do onboarding
 * vazio justamente na primeira vez.
 */
export function useSemearCatalogo(uid: string | null): void {
  useEffect(() => {
    if (!uid || checados.has(uid)) return;
    checados.add(uid);

    void (async () => {
      try {
        const marcador = await getDoc(refSementeCatalogo(uid));

        // Offline num aparelho que nunca viu este marcador: não dá para saber
        // se o usuário já excluiu algum item lá atrás. Semear aqui traria de
        // volta o que ele apagou — melhor pular e tentar na próxima abertura.
        if (!marcador.exists() && marcador.metadata.fromCache) {
          checados.delete(uid);
          return;
        }

        const versaoAplicada = marcador.data()?.versao ?? 0;
        if (versaoAplicada >= CATALOGO_VERSAO) return;

        // Sem await bloqueante: offline o commit só resolve ao reconectar, mas
        // o cache local já reflete os documentos e a lista aparece na hora.
        void semearMedicamentos(uid, versaoAplicada).catch((falha) => {
          console.warn('[DoseCerta] catálogo será semeado depois:', falha);
          checados.delete(uid);
        });
      } catch (falha) {
        console.warn('[DoseCerta] não foi possível checar o catálogo agora:', falha);
        checados.delete(uid);
      }
    })();
  }, [uid]);
}
