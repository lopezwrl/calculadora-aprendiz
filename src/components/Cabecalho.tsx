import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, History, Moon, Sun } from 'lucide-react';

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
    <header className="no-print sticky top-0 z-30 border-b-2 border-tinta bg-azul text-branco shadow-lg">
      <div className="h-2 w-full bg-laranja" aria-hidden="true" />
      <div className="mx-auto flex max-w-layout flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-3.5">
          <motion.div
            whileHover={prefereMenosMovimento ? undefined : { rotate: -6, scale: 1.06 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            aria-hidden="true"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-tinta bg-branco font-display text-sm font-extrabold tracking-tight text-azul shadow-[0_3px_0_0_#FD701C]"
          >
            <span>CLT</span>
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-tinta bg-laranja text-[9px] font-black text-tinta">
              PI
            </span>
          </motion.div>
          <div>
            <span className="block font-display text-base font-extrabold tracking-tight text-branco sm:text-lg">
              Calculadora CLT Teresina
            </span>
            <span className="block text-xs font-medium text-azul-claro">
              Folha, 13º e rescisão ao centavo, com os parâmetros de 2026
            </span>
          </div>
        </div>

        <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-2.5">
          <motion.button
            type="button"
            whileHover={prefereMenosMovimento ? undefined : { y: -2 }}
            whileTap={prefereMenosMovimento ? undefined : { y: 1, scale: 0.97 }}
            onClick={onAbrirComoCalculamos}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border-2 border-tinta bg-branco px-3.5 py-2 text-xs font-bold text-tinta shadow-[0_3px_0_0_#08122E] transition-colors hover:bg-laranja-suave sm:text-sm"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-azul" aria-hidden="true" />
            <span>Como calculamos</span>
          </motion.button>

          <motion.button
            type="button"
            whileHover={prefereMenosMovimento ? undefined : { y: -2 }}
            whileTap={prefereMenosMovimento ? undefined : { y: 1, scale: 0.97 }}
            onClick={onAbrirHistorico}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border-2 border-tinta bg-branco px-3.5 py-2 text-xs font-bold text-tinta shadow-[0_3px_0_0_#08122E] transition-colors hover:bg-laranja-suave sm:text-sm"
          >
            <History className="h-4 w-4 shrink-0 text-azul" aria-hidden="true" />
            <span>Histórico</span>
            {quantidadeHistorico > 0 && (
              <span className="tabular-nums rounded-md border border-tinta bg-laranja px-2 py-0.5 text-xs font-extrabold leading-none text-tinta">
                {quantidadeHistorico}
              </span>
            )}
          </motion.button>

          <motion.button
            type="button"
            whileHover={prefereMenosMovimento ? undefined : { y: -2 }}
            whileTap={prefereMenosMovimento ? undefined : { y: 1, scale: 0.97 }}
            onClick={onAlternarTema}
            aria-label={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border-2 border-tinta bg-laranja px-4 py-2 text-xs font-extrabold text-tinta shadow-[0_3px_0_0_#08122E] transition-colors hover:bg-laranja-vivo sm:text-sm"
          >
            {tema === 'dark' ? (
              <Sun className="h-4 w-4 shrink-0 text-tinta" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4 shrink-0 text-tinta" aria-hidden="true" />
            )}
            <span>{tema === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
          </motion.button>
        </nav>
      </div>
    </header>
  );
}
