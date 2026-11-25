import { useEffect } from 'react';
import { X } from 'lucide-react';
import { formatarCentavos } from '../calc';
import { ItemHistoricoCalculo } from '../utils/historico';

interface PainelHistoricoProps {
  aberto: boolean;
  itens: ItemHistoricoCalculo[];
  onFechar: () => void;
  onRestaurar: (item: ItemHistoricoCalculo) => void;
  onRemover: (id: string) => void;
  onLimparTudo: () => void;
}

export function PainelHistorico({
  aberto,
  itens,
  onFechar,
  onRestaurar,
  onRemover,
  onLimparTudo,
}: PainelHistoricoProps) {
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, onFechar]);

  const formatarDataHora = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-tinta/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-historico"
    >
      <div className="flex-1" onClick={onFechar} aria-hidden="true" />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 id="titulo-historico" className="text-base font-bold text-fg">
              Histórico salvo neste dispositivo
            </h2>
            <p className="text-xs text-fg-muted">
              Até 20 cálculos recentes gravados no navegador.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar painel de histórico"
            className="cursor-pointer rounded border border-border p-1.5 text-fg-muted hover:border-border-strong hover:text-fg"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {itens.length === 0 ? (
            <div className="rounded border border-border bg-surface-subtle p-6 text-sm text-fg-muted">
              Nenhum cálculo registrado até o momento.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded border border-border">
              {itens.map((item) => (
                <li key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="block text-xs font-bold text-brand">
                        {item.descricaoModo}
                      </span>
                      {item.nomeTrabalhador && (
                        <p className="mt-0.5 text-sm font-semibold text-fg">
                          {item.nomeTrabalhador}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-fg-muted">
                        {formatarDataHora(item.criadoEmIso)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs text-fg-muted">Líquido</span>
                      <span className="tabular-nums text-base font-bold text-fg">
                        {formatarCentavos(item.valorLiquidoCentavos)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onRestaurar(item)}
                      className="cursor-pointer rounded border border-border-strong bg-surface px-3 py-1 text-xs font-semibold text-fg hover:border-brand"
                    >
                      Abrir cálculo
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemover(item.id)}
                      aria-label={`Apagar cálculo de ${formatarDataHora(item.criadoEmIso)}`}
                      className="cursor-pointer rounded border border-border px-2.5 py-1 text-xs font-medium text-fg-muted hover:border-status-error hover:text-status-error"
                    >
                      Apagar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {itens.length > 0 && (
          <div className="border-t border-border bg-surface-subtle p-4">
            <button
              type="button"
              onClick={onLimparTudo}
              className="w-full cursor-pointer rounded border border-border-strong bg-surface px-4 py-2 text-xs font-bold text-fg hover:border-status-error hover:text-status-error"
            >
              Limpar histórico
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
