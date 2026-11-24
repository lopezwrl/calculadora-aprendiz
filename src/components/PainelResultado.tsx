import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { formatarCentavos, LinhaResultado, ResultadoCalculo } from '../calc';
import { ValorAnimado } from './ValorAnimado';

interface PainelResultadoProps {
  resultado: ResultadoCalculo;
  descricaoModo: string;
  nomeTrabalhador?: string;
  onBaixarPdf: () => void;
  onImprimir: () => void;
  onNovoCalculo: () => void;
}

function LinhaExpansivelTabela({
  linha,
  indice,
  prefereMenosMovimento,
}: {
  linha: LinhaResultado;
  indice: number;
  prefereMenosMovimento: boolean | null;
}) {
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
    <motion.div
      initial={prefereMenosMovimento ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: prefereMenosMovimento ? 0 : 0.22,
        delay: prefereMenosMovimento ? 0 : indice * 0.04,
      }}
      className="border-b border-border last:border-b-0"
    >
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="grid w-full grid-cols-1 gap-1.5 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-surface-subtle/70 sm:grid-cols-[1.6fr_0.9fr_1.4fr_0.9fr_auto] sm:items-center sm:gap-3"
      >
        <div>
          <span className="block text-sm font-semibold text-fg">{linha.rotulo}</span>
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

        <div className="tabular-nums font-display text-sm font-bold text-fg sm:text-right">
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

      <AnimatePresence initial={false}>
        {aberta && (
          <motion.div
            initial={prefereMenosMovimento ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefereMenosMovimento ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: prefereMenosMovimento ? 0 : 0.22, ease: 'easeOut' }}
            className="overflow-hidden border-t border-border bg-surface-subtle"
          >
            <ul className="space-y-1.5 px-6 py-3.5 text-xs text-fg-muted">
              {linha.passos.map((passo, idx) => (
                <li key={idx} className="list-inside list-disc">
                  {passo}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
  const prefereMenosMovimento = useReducedMotion();

  const referenciaGrafico = Math.max(1, resultado.totalBrutoCentavos);
  const pctDescontos = Math.min(
    100,
    Math.round((resultado.totalDescontosCentavos / referenciaGrafico) * 100)
  );
  const pctLiquido = Math.min(
    100,
    Math.round((resultado.valorLiquidoCentavos / referenciaGrafico) * 100)
  );

  const todasLinhasDetalhadas: LinhaResultado[] = [
    ...resultado.linhasProventos,
    ...resultado.linhasDescontos,
    ...(resultado.parcelasDecimoTerceiro ?? []),
    ...resultado.linhasEncargos,
  ];

  return (
    <div className="print-only-full space-y-6">
      {/* Cabeçalho azul (#002893) com destaque laranja (#FD701C) */}
      <div className="overflow-hidden rounded-2xl border-2 border-azul-escuro bg-azul text-branco shadow-lg">
        <div className="h-2 w-full bg-laranja" aria-hidden="true" />
        <div className="p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-md bg-branco/15 px-3 py-1 text-xs font-semibold text-branco">
              {descricaoModo}
            </span>
            {nomeTrabalhador && (
              <span className="text-xs font-medium text-branco/85">
                Trabalhador: {nomeTrabalhador}
              </span>
            )}
          </div>

          <div className="mt-5">
            <span className="inline-block rounded-md bg-laranja px-2.5 py-0.5 text-xs font-bold text-tinta">
              Valor líquido a receber
            </span>
            <ValorAnimado
              centavos={resultado.valorLiquidoCentavos}
              duracaoSegundos={0.7}
              className="mt-2 block font-display text-2xl font-bold tracking-tight text-branco"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 border-t border-branco/20 pt-5 sm:grid-cols-3">
            <div className="rounded-xl bg-branco/10 p-4">
              <span className="block text-xs text-branco/80">{resultado.rotuloBruto}</span>
              <span className="tabular-nums mt-1 block font-display text-lg font-bold text-branco">
                {formatarCentavos(resultado.totalBrutoCentavos)}
              </span>
            </div>

            <div className="rounded-xl bg-branco/10 p-4">
              <span className="block text-xs text-branco/80">Descontos</span>
              <span className="tabular-nums mt-1 block font-display text-lg font-bold text-laranja">
                {formatarCentavos(resultado.totalDescontosCentavos)}
              </span>
            </div>

            <div className="rounded-xl bg-branco/10 p-4">
              <span className="block text-xs text-branco/80">Valor líquido</span>
              <span className="tabular-nums mt-1 block font-display text-lg font-bold text-branco">
                {formatarCentavos(resultado.valorLiquidoCentavos)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {resultado.avisos.length > 0 && (
        <div className="space-y-2">
          {resultado.avisos.map((av) => (
            <div
              key={av.codigo}
              role="status"
              aria-live="polite"
              className={`rounded-xl border-2 p-4 text-xs ${
                av.nivel === 'aviso'
                  ? 'border-laranja bg-status-warning-bg text-status-warning'
                  : 'border-border bg-surface text-fg'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                {av.nivel === 'aviso' && (
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span>{av.titulo}</span>
              </div>
              <p className="mt-1 text-fg">{av.mensagem}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabela expansível */}
      <section
        aria-labelledby="titulo-detalhamento-verbas"
        className="overflow-hidden rounded-2xl border-2 border-border bg-surface shadow-xs"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
          <h3 id="titulo-detalhamento-verbas" className="font-display text-base font-bold text-fg">
            Detalhamento por rubrica
          </h3>
          <span className="text-xs text-fg-muted">
            Toque em qualquer linha para ver o cálculo passo a passo
          </span>
        </div>

        <div className="hidden border-b border-border bg-surface-subtle px-5 py-2.5 text-xs font-bold text-fg-muted sm:grid sm:grid-cols-[1.6fr_0.9fr_1.4fr_0.9fr_auto] sm:gap-3">
          <span>Verba</span>
          <span>Base de cálculo</span>
          <span>Fórmula</span>
          <span className="text-right">Valor</span>
          <span className="w-4" aria-hidden="true" />
        </div>

        <div>
          {todasLinhasDetalhadas.map((linha, idx) => (
            <LinhaExpansivelTabela
              key={linha.id}
              linha={linha}
              indice={idx}
              prefereMenosMovimento={prefereMenosMovimento}
            />
          ))}
        </div>
      </section>

      {/* Gráfico de barras comparativo */}
      <section
        aria-labelledby="titulo-comparativo-barras"
        className="rounded-2xl border-2 border-border bg-surface p-5 shadow-xs"
      >
        <h3 id="titulo-comparativo-barras" className="font-display text-base font-bold text-fg">
          Comparativo entre bruto, descontos e líquido
        </h3>

        <div className="mt-4 space-y-4">
          <div>
            <div className="flex justify-between text-xs font-semibold text-fg">
              <span>{resultado.rotuloBruto} (100%)</span>
              <span className="tabular-nums">{formatarCentavos(resultado.totalBrutoCentavos)}</span>
            </div>
            <div
              role="progressbar"
              aria-label={resultado.rotuloBruto}
              aria-valuenow={100}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-surface-subtle"
            >
              <div className="h-full w-full rounded-full bg-azul" />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-fg">
              <span>Descontos ({pctDescontos}%)</span>
              <span className="tabular-nums">
                {formatarCentavos(resultado.totalDescontosCentavos)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Proporção de descontos sobre o bruto"
              aria-valuenow={pctDescontos}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-surface-subtle"
            >
              <motion.div
                initial={false}
                animate={{ width: `${pctDescontos}%` }}
                transition={{ duration: prefereMenosMovimento ? 0 : 0.4, ease: 'easeOut' }}
                className="h-full rounded-full bg-laranja"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-fg">
              <span>Valor líquido ({pctLiquido}%)</span>
              <span className="tabular-nums">
                {formatarCentavos(resultado.valorLiquidoCentavos)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Proporção do valor líquido sobre o bruto"
              aria-valuenow={pctLiquido}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-surface-subtle"
            >
              <motion.div
                initial={false}
                animate={{ width: `${pctLiquido}%` }}
                transition={{ duration: prefereMenosMovimento ? 0 : 0.4, ease: 'easeOut' }}
                className="h-full rounded-full bg-azul"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Ações e aviso legal único */}
      <div className="space-y-4 rounded-2xl border-2 border-border bg-surface p-5">
        <div className="no-print flex flex-wrap items-center gap-3">
          <motion.button
            type="button"
            whileHover={prefereMenosMovimento ? undefined : { y: -1 }}
            whileTap={prefereMenosMovimento ? undefined : { scale: 0.98 }}
            onClick={onBaixarPdf}
            className="rounded-xl bg-laranja px-6 py-3 text-sm font-bold text-tinta shadow-sm transition-colors duration-150 hover:bg-laranja-hover"
          >
            Baixar PDF
          </motion.button>

          <motion.button
            type="button"
            whileHover={prefereMenosMovimento ? undefined : { y: -1 }}
            whileTap={prefereMenosMovimento ? undefined : { scale: 0.98 }}
            onClick={onImprimir}
            className="rounded-xl border-2 border-azul bg-surface px-5 py-2.5 text-sm font-bold text-brand transition-colors duration-150 hover:bg-surface-subtle"
          >
            Imprimir
          </motion.button>

          <motion.button
            type="button"
            whileHover={prefereMenosMovimento ? undefined : { y: -1 }}
            whileTap={prefereMenosMovimento ? undefined : { scale: 0.98 }}
            onClick={onNovoCalculo}
            className="rounded-xl border-2 border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-fg transition-colors duration-150 hover:border-brand"
          >
            Novo cálculo
          </motion.button>
        </div>

        <p className="text-xs text-fg-muted">
          Estimativa para fins informativos. Confirme os valores com o RH ou assessoria jurídica.
        </p>
      </div>
    </div>
  );
}
