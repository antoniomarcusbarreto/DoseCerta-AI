import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Button } from '@/components/Button';
import { CircleButton } from '@/components/CircleButton';
import { Hero } from '@/components/Hero';
import { Pagina } from '@/components/Pagina';
import { Select } from '@/components/Select';
import { SheetCard } from '@/components/SheetCard';
import { useConfirm } from '@/contexts/ConfirmContext';
import type { AnguloFoto, RegistroFoto } from '@/domain/tipos';
import { useDados } from '@/features/dados/DadosProvider';
import {
  consultaFotosProgresso,
  excluirFotoProgresso,
  uploadFotoProgresso,
} from '@/features/dados/repositorio';
import { useColecao } from '@/lib/useConsulta';

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

const IconeLixeira = () => (
  <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
    <path
      d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const OPCOES_ANGULO: { valor: AnguloFoto; rotulo: string }[] = [
  { valor: 'Frente', rotulo: 'Frente' },
  { valor: 'Perfil', rotulo: 'Perfil' },
  { valor: 'Costas', rotulo: 'Costas' },
];

/**
 * Galeria de fotos de progresso: upload para o Storage, grid com exclusão e
 * um modo de comparação antes/depois entre duas fotos escolhidas no grid.
 */
export function TelaGaleria() {
  const navegar = useNavigate();
  const { uid } = useDados();
  const { askConfirm } = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);

  const consulta = uid ? consultaFotosProgresso(uid) : null;
  const { dados: fotos, carregando } = useColecao(
    consulta,
    uid ? `${uid}/progress_photos` : null,
  );

  const [angulo, setAngulo] = useState<AnguloFoto>('Frente');
  const [isUploading, setIsUploading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [avisoSelecao, setAvisoSelecao] = useState<string | null>(null);
  const avisoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (avisoTimeoutRef.current) clearTimeout(avisoTimeoutRef.current);
    },
    [],
  );

  if (!uid) return null;

  async function aoSelecionarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0] ?? null;
    evento.target.value = '';
    if (!arquivo || !uid) return;

    setErro(null);
    setIsUploading(true);
    try {
      await uploadFotoProgresso(uid, arquivo, angulo);
    } catch (falha) {
      console.error('[DoseCerta] falha ao subir foto de progresso', falha);
      setErro('Não foi possível enviar a foto. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  }

  function aoExcluir(foto: RegistroFoto) {
    if (!uid) return;
    askConfirm({
      title: 'Excluir Foto',
      message:
        'Tem certeza que deseja excluir este registro de evolução? Essa ação não pode ser desfeita.',
      confirmText: 'Excluir',
      onConfirm: async () => {
        try {
          await excluirFotoProgresso(uid, foto);
          setSelectedPhotos((atual) => atual.filter((id) => id !== foto.id));
        } catch (falha) {
          console.error('[DoseCerta] falha ao excluir foto de progresso', falha);
          setErro('Não foi possível excluir a foto. Tente novamente.');
        }
      },
    });
  }

  function alternarComparacao() {
    setCompareMode((atual) => !atual);
    setSelectedPhotos([]);
    setAiAnalysis(null);
  }

  function exibirAvisoLimite() {
    setAvisoSelecao('Selecione apenas 2 fotos para a comparação de Antes e Depois');
    if (avisoTimeoutRef.current) clearTimeout(avisoTimeoutRef.current);
    avisoTimeoutRef.current = setTimeout(() => setAvisoSelecao(null), 2500);
  }

  function aoClicarNoGrid(fotoId: string) {
    if (!compareMode) return;
    setAiAnalysis(null);
    setSelectedPhotos((atual) => {
      if (atual.includes(fotoId)) return atual.filter((id) => id !== fotoId);
      if (atual.length >= 2) {
        exibirAvisoLimite();
        return atual;
      }
      return [...atual, fotoId];
    });
  }

  async function handleGenerateAIAnalysis() {
    setIsAnalyzing(true);
    // TODO: Substituir por chamada ao Firebase Functions (Gemini Vision)
    setTimeout(() => {
      setAiAnalysis(
        '✨ Análise Concluída: É possível notar uma redução clara no inchaço abdominal e uma melhora significativa na sua postura entre as duas fotos. O caimento das roupas está visivelmente mais solto. O processo está funcionando perfeitamente, continue firme na sua jornada!',
      );
      setIsAnalyzing(false);
    }, 3000);
  }

  const fotosComparadas = selectedPhotos
    .map((id) => fotos.find((f) => f.id === id))
    .filter((f): f is RegistroFoto => f !== undefined);

  return (
    <Pagina
      layout="foco"
      hero={
        <Hero
          titulo="Galeria de Progresso"
          esquerda={
            <CircleButton rotulo="Voltar" onClick={() => navegar('/evolucao')}>
              <IconeVoltar />
            </CircleButton>
          }
        >
          <div className="mt-6">
            <p className="t-caption text-on-hero-muted">Registros de Saúde</p>
            <h2 className="t-stat mt-1.5 text-on-hero">Fotos</h2>
          </div>
        </Hero>
      }
    >
      <SheetCard titulo="Adicionar foto">
        <div className="flex flex-col gap-4">
          <Select
            rotulo="Ângulo"
            opcoes={OPCOES_ANGULO.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
            value={angulo}
            onChange={(e) => setAngulo(e.target.value as AnguloFoto)}
          />

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={aoSelecionarArquivo}
          />

          <Button
            type="button"
            larguraTotal
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? 'Enviando…' : 'Adicionar Foto'}
          </Button>

          {erro ? <Alerta tom="danger" titulo={erro} /> : null}
        </div>
      </SheetCard>

      {fotosComparadas.length === 2 ? (
        <SheetCard titulo="Antes e Depois">
          <div className="grid grid-cols-2 gap-4">
            {fotosComparadas.map((foto) => (
              <div key={foto.id} className="flex flex-col gap-2">
                <img
                  src={foto.imageUrl}
                  alt={`Foto de progresso — ${foto.angle}`}
                  className="aspect-square w-full rounded-xl object-cover"
                />
                <p className="t-caption text-center text-ink-muted">
                  {foto.recordedAt.toLocaleDateString('pt-BR')}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            {aiAnalysis ? (
              <div className="flex flex-col gap-2">
                <Alerta tom="ok" titulo="Análise da IA">
                  {aiAnalysis}
                </Alerta>
                <Button type="button" variante="fantasma" onClick={handleGenerateAIAnalysis}>
                  Refazer Análise
                </Button>
              </div>
            ) : isAnalyzing ? (
              <div className="flex flex-col gap-2">
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-sunken" />
                <div className="h-4 w-full animate-pulse rounded-full bg-sunken" />
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-sunken" />
                <p className="t-label mt-1 text-ink-muted">
                  A Inteligência Artificial está analisando suas fotos…
                </p>
              </div>
            ) : (
              <Button
                type="button"
                variante="secundaria"
                larguraTotal
                disabled={isAnalyzing}
                onClick={handleGenerateAIAnalysis}
              >
                ✨ Gerar Análise Motivacional (IA)
              </Button>
            )}
          </div>
        </SheetCard>
      ) : null}

      <SheetCard
        titulo="Fotos"
        acao={
          <Button type="button" variante="secundaria" onClick={alternarComparacao}>
            {compareMode ? 'Cancelar comparação' : 'Comparar Fotos'}
          </Button>
        }
      >
        {carregando ? (
          <p className="t-label text-ink-muted">Carregando…</p>
        ) : fotos.length === 0 ? (
          <p className="t-label text-ink-muted">Nenhuma foto ainda.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {fotos.map((foto) => {
              const indiceSelecao = selectedPhotos.indexOf(foto.id);
              const selecionada = indiceSelecao !== -1;
              return (
                <div
                  key={foto.id}
                  className={`flex flex-col gap-2 rounded-xl p-1.5 transition-shadow ${
                    compareMode ? 'cursor-pointer' : ''
                  }`}
                  style={
                    selecionada
                      ? { boxShadow: '0 0 0 3px var(--ok)' }
                      : undefined
                  }
                  onClick={() => aoClicarNoGrid(foto.id)}
                >
                  <div className="relative">
                    <img
                      src={foto.imageUrl}
                      alt={`Foto de progresso — ${foto.angle}`}
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                    {selecionada ? (
                      <span
                        className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: 'var(--ok)' }}
                      >
                        {indiceSelecao + 1}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="t-label truncate text-ink">{foto.angle}</p>
                      <p className="t-caption text-ink-muted">
                        {foto.recordedAt.toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    {!compareMode ? (
                      <button
                        type="button"
                        aria-label="Excluir foto"
                        className="shrink-0 rounded-full p-1.5"
                        style={{ color: 'var(--danger)' }}
                        onClick={(evento) => {
                          evento.stopPropagation();
                          aoExcluir(foto);
                        }}
                      >
                        <IconeLixeira />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SheetCard>

      {avisoSelecao ? (
        <div
          className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm rounded-full px-4 py-3 text-center shadow-lg"
          style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
        >
          <p className="t-label">{avisoSelecao}</p>
        </div>
      ) : null}
    </Pagina>
  );
}
