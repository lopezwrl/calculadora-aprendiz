import { motion, useReducedMotion } from 'framer-motion';

interface CabecalhoProps {
  tema: 'light' | 'dark';
  onAlternarTema: () => void;
  onAbrirComoCalculamos: () => void;
  onAbrirHistorico: () => void;
  quantidadeHistorico: number;
}

export function Cabecalho({
  tema,
  onAlternarTema,
  onAbrirComoCalculamos,
  onAbrirHistorico,
  quantidadeHistorico,
}: CabecalhoProps) {
  const prefereMenosMovimento = useReducedMotion();

  return (
    <header className="no-print sticky top-0 z-30 border-b-2 border-azul-escuro bg-azul text-branco shadow-md">
      <div className="h-1.5 w-full bg-laranja" aria-hidden="true" />
      <div className="mx-auto flex max-w-layout flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-branco font-display text-sm font-bold tracking-tight text-azul shadow-xs"
          >
            CLT
          </div>
          <div>
            <span className="block font-display text-base font-bold tracking-tight text-branco sm:text-lg">
              Calculadora CLT Teresina
            </span>
            <span className="block text-xs text-branco/75">
              Folha, décimo terceiro e rescisão no Piauí
            </span>
          </div>
        </div>

        <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-2">
          <motion.button
            type="button"
            whileHover={prefereMenosMovimento ? undefined : { y: -1 }}
            whileTap={prefereMenosMovimento ? undefined : { scale: 0.97 }}
            onClick={onAbrirComoCalculamos}
            className="rounded-lg border border-branco/25 bg-branco/10 px-3.5 py-2 text-xs font-semibold text-branco transition-colors duration-150 hover:border-branco/60 hover:bg-branco/20 sm:text-sm"
          >
            Como calculamos
          </motion.button>

          <motion.button
            type="button"
            whileHover={prefereMenosMovimento ? undefined : { y: -1 }}
            whileTap={prefereMenosMovimento ? undefined : { scale: 0.97 }}
            onClick={onAbrirHistorico}
            className="inline-flex items-center gap-2 rounded-lg border border-branco/25 bg-branco/10 px-3.5 py-2 text-xs font-semibold text-branco transition-colors duration-150 hover:border-branco/60 hover:bg-branco/20 sm:text-sm"
          >
            <span>Histórico</span>
            {quantidadeHistorico > 0 && (
              <span className="tabular-nums rounded-md bg-laranja px-2 py-0.5 text-xs font-bold leading-none text-tinta">
                {quantidadeHistorico}
              </span>
            )}
          </motion.button>

          <motion.button
            type="button"
            whileHover={prefereMenosMovimento ? undefined : { y: -1 }}
            whileTap={prefereMenosMovimento ? undefined : { scale: 0.97 }}
            onClick={onAlternarTema}
            aria-label={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="rounded-lg bg-laranja px-3.5 py-2 text-xs font-bold text-tinta transition-colors duration-150 hover:bg-laranja-hover sm:text-sm"
          >
            {tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </motion.button>
        </nav>
      </div>
    </header>
  );
}
