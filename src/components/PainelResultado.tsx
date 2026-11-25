import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatarCentavos, LinhaResultado, ResultadoCalculo } from '../calc';

interface PainelResultadoProps {
  resultado: ResultadoCalculo;
  descricaoModo: string;
  nomeTrabalhador?: string;
  onBaixarPdf: () => void;
  onImprimir: () => void;
  onNovoCalculo: () => void;
}

function LinhaExpansivelTabela({ linha }: { linha: LinhaResultado }) {
  const [aberta, setAberta] = useState(false);

  const categoriaTexto =
    linha.natureza === 'desconto'
      ? 'Desconto'
      : linha.natureza === 'encargo'
        ? 'Encargo da empresa'
        : linha.natureza === 'parcela'
          ? 'Parcela'
          : 'Provento';

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="grid w-full cursor-pointer grid-cols-1 gap-1.5 py-3.5 text-left transition-colors hover:bg-surface-subtle sm:grid-cols-[1.6fr_0.9fr_1.4fr_0.9fr_auto] sm:items-center sm:gap-3"
      >
        <div>
          <span className="block text-sm font-bold text-fg">{linha.rotulo}</span>
          <span className="text-xs text-fg-muted">
            {categoriaTexto}
            {linha.aliquotaTexto ? ` · ${linha.aliquotaTexto}` : ''}
            {linha.estimativa ? ' · Estimativa' : ''}
          </span>
        </div>

        <div className="text-xs sm:text-sm">
          <span className="text-fg-muted sm:hidden">Base: </span>
          <span className="tabular-nums text-fg-muted">
            {formatarCentavos(linha.baseCentavos)}
          </span>
        </div>

        <div className="text-xs text-fg-muted">
          <span className="sm:hidden">Fórmula: </span>
          <span>{linha.formula}</span>
        </div>

        <div className="tabular-nums text-sm font-bold text-fg sm:text-right">
          {formatarCentavos(linha.valorCentavos)}
        </div>

        <div className="hidden sm:flex sm:justify-end">
          <ChevronDown
            className={`h-4 w-4 text-fg-muted transition-transform duration-150 ${
              aberta ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </div>
      </button>

      {aberta && (
        <div className="border-t border-border bg-surface-subtle px-4 py-3">
          <ul className="space-y-1.5 text-xs text-fg-muted">
            {linha.passos.map((passo, idx) => (
              <li key={idx} className="list-inside list-disc">
                {passo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function PainelResultado({
  resultado,
  descricaoModo,
  nomeTrabalhador,
  onBaixarPdf,
  onImprimir,
  onNovoCalculo,
}: PainelResultadoProps) {
  const todasLinhasDetalhadas: LinhaResultado[] = [
    ...resultado.linhasProventos,
    ...resultado.linhasDescontos,
    ...(resultado.parcelasDecimoTerceiro ?? []),
    ...resultado.linhasEncargos,
  ];

  return (
    <div className="print-only-full space-y-12">
      <section aria-labelledby="titulo-detalhamento-verbas">
        <div className="border-b border-border pb-3">
          <h2 id="titulo-detalhamento-verbas" className="text-lg font-bold text-fg">
            Detalhamento por rubrica
          </h2>
          <p className="mt-0.5 text-xs text-fg-muted">
            {descricaoModo}
            {nomeTrabalhador ? ` · Trabalhador: ${nomeTrabalhador}` : ''} · Toque em qualquer linha
            para ver o passo a passo
          </p>
        </div>

        <div className="hidden border-b border-border py-2.5 text-xs font-bold text-fg-muted sm:grid sm:grid-cols-[1.6fr_0.9fr_1.4fr_0.9fr_auto] sm:gap-3">
          <span>Verba</span>
          <span>Base de cálculo</span>
          <span>Fórmula</span>
          <span className="text-right">Valor</span>
          <span className="w-4" aria-hidden="true" />
        </div>

        <div>
          {todasLinhasDetalhadas.map((linha) => (
            <LinhaExpansivelTabela key={linha.id} linha={linha} />
          ))}
        </div>
      </section>

      <div className="space-y-4 border-t border-border pt-6">
        <div className="no-print flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBaixarPdf}
            className="cursor-pointer rounded bg-laranja px-6 py-2.5 text-sm font-bold text-tinta hover:bg-laranja-hover"
          >
            Baixar PDF
          </button>

          <button
            type="button"
            onClick={onImprimir}
            className="cursor-pointer rounded border border-border-strong bg-surface px-5 py-2.5 text-sm font-bold text-fg hover:border-brand"
          >
            Imprimir
          </button>

          <button
            type="button"
            onClick={onNovoCalculo}
            className="cursor-pointer rounded border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-fg hover:border-brand"
          >
            Novo cálculo
          </button>
        </div>

        <p className="text-xs text-fg-muted">
          Estimativa para fins informativos. Confirme os valores com o RH ou assessoria jurídica.
        </p>
      </div>
    </div>
  );
}
