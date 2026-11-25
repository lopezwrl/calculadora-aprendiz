import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import {
  AvisoCalculo,
  formatarCentavos,
  LinhaResultado,
  ModoCalculo,
  ResultadoCalculo,
} from '../calc';
import { ANO_VIGENTE, DATA_ULTIMA_CONFERENCIA } from '../config/parametros';

export type CampoDependenciaHolerite =
  | 'salario'
  | 'inss'
  | 'datas'
  | 'vt'
  | 'dependentes'
  | 'descontos'
  | 'regime'
  | 'verbas';

export interface LinhaHoleriteProcessada {
  id: string;
  rotuloLimpo: string;
  memoria: string;
  valorCentavos: number;
  natureza: LinhaResultado['natureza'];
  dependsOn: CampoDependenciaHolerite[];
}

export function separarDetalheRotuloEMemoria(
  linha: LinhaResultado
): { rotuloLimpo: string; memoria: string } {
  let rotulo = linha.rotulo.trim();
  const detalhesExtraidos: string[] = [];

  rotulo = rotulo
    .replace(/\(([^)]+)\)/g, (_match, conteudo: string) => {
      const limpo = conteudo.trim();
      if (limpo) {
        detalhesExtraidos.push(limpo);
      }
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\+/g, ' +')
    .trim();

  const formulaBase = linha.formula.trim();
  const prefixoDetalhe = detalhesExtraidos
    .filter((d) => !formulaBase.toLowerCase().includes(d.toLowerCase()))
    .join(' · ');

  const memoria = prefixoDetalhe ? `${prefixoDetalhe} · ${formulaBase}` : formulaBase;
  return { rotuloLimpo: rotulo, memoria };
}

function inferirDependenciasLinha(
  id: string,
  natureza: LinhaResultado['natureza']
): CampoDependenciaHolerite[] {
  if (id.includes('vt')) return ['salario', 'datas', 'vt'];
  if (id.includes('irrf')) return ['salario', 'inss', 'datas', 'dependentes'];
  if (id.includes('inss')) return ['salario', 'inss', 'datas'];
  if (id.includes('outro-desconto')) return ['descontos'];
  if (id.includes('fgts') || natureza === 'encargo') {
    return ['salario', 'datas', 'regime', 'verbas'];
  }
  if (id.includes('aviso') || id.includes('ferias') || id.includes('479')) {
    return ['salario', 'datas', 'verbas'];
  }
  return ['salario', 'datas'];
}

export function resumirAvisoHolerite(aviso: AvisoCalculo): string {
  if (aviso.codigo === 'SALARIO_ABAIXO_DO_PISO') {
    return 'Salário abaixo do piso de referência; confirme a proporcionalidade por jornada.';
  }
  if (aviso.codigo === 'BASE_INSS_PERSONALIZADA') {
    return 'INSS apurado sobre base informada distinta do salário bruto.';
  }
  return aviso.titulo;
}

export function useHoleriteLinhas(
  resultado: ResultadoCalculo,
  modo: ModoCalculo
): {
  proventos: LinhaHoleriteProcessada[];
  descontos: LinhaHoleriteProcessada[];
  parcelas13: LinhaHoleriteProcessada[];
  encargos: LinhaHoleriteProcessada[];
} {
  return useMemo(() => {
    const mapear = (linhas: LinhaResultado[] = []): LinhaHoleriteProcessada[] =>
      linhas.map((l) => {
        const { rotuloLimpo, memoria } = separarDetalheRotuloEMemoria(l);
        return {
          id: `${modo}-${l.id}`,
          rotuloLimpo,
          memoria,
          valorCentavos: l.valorCentavos,
          natureza: l.natureza,
          dependsOn: inferirDependenciasLinha(l.id, l.natureza),
        };
      });

    return {
      proventos: mapear(resultado.linhasProventos),
      descontos: mapear(resultado.linhasDescontos),
      parcelas13: mapear(resultado.parcelasDecimoTerceiro ?? []),
      encargos: mapear(resultado.linhasEncargos),
    };
  }, [resultado, modo]);
}

export function useDigitacao(
  texto: string,
  opcoes: {
    velocidade?: number;
    ativo: boolean;
    atrasoMs?: number;
    cicloId: number;
  }
): { textoExibido: string; escrevendo: boolean; concluido: boolean } {
  const { velocidade = 14, ativo, atrasoMs = 0, cicloId } = opcoes;
  const [indice, setIndice] = useState<number>(texto.length);
  const [escrevendo, setEscrevendo] = useState<boolean>(false);

  useEffect(() => {
    if (!ativo || cicloId === 0 || texto.length === 0) {
      setIndice(texto.length);
      setEscrevendo(false);
      return;
    }

    let cancelado = false;
    let intervaloId: ReturnType<typeof setInterval> | null = null;
    const duracaoAlvo = Math.min(450, texto.length * velocidade);
    const passoCaracteres = Math.max(
      1,
      Math.ceil(texto.length / Math.max(1, Math.floor(duracaoAlvo / 14)))
    );

    setIndice(0);
    setEscrevendo(true);

    const timeoutInicio = setTimeout(() => {
      if (cancelado) return;
      intervaloId = setInterval(() => {
        setIndice((atual) => {
          const proximo = atual + passoCaracteres;
          if (proximo >= texto.length) {
            if (intervaloId) clearInterval(intervaloId);
            setEscrevendo(false);
            return texto.length;
          }
          return proximo;
        });
      }, 14);
    }, atrasoMs);

    return () => {
      cancelado = true;
      clearTimeout(timeoutInicio);
      if (intervaloId) clearInterval(intervaloId);
      setIndice(texto.length);
      setEscrevendo(false);
    };
  }, [texto, velocidade, ativo, atrasoMs, cicloId]);

  const textoExibido = ativo && escrevendo ? texto.slice(0, indice) : texto;
  return {
    textoExibido,
    escrevendo: ativo && escrevendo,
    concluido: !ativo || !escrevendo,
  };
}

interface LinhaQuadradoHoleriteProps {
  linha: LinhaHoleriteProcessada;
  indiceOrdem: number;
  sinal?: '+' | '-' | '';
  corValor?: string;
  animarDigitacao: boolean;
  cicloDigitacao: number;
  atrasoDigitacaoMs: number;
  reduzirMovimento: boolean;
}

function LinhaQuadradoHolerite({
  linha,
  indiceOrdem,
  sinal = '',
  corValor = 'text-branco',
  animarDigitacao,
  cicloDigitacao,
  atrasoDigitacaoMs,
  reduzirMovimento,
}: LinhaQuadradoHoleriteProps) {
  const { textoExibido, escrevendo, concluido } = useDigitacao(linha.memoria, {
    velocidade: 14,
    ativo: animarDigitacao && !reduzirMovimento,
    atrasoMs: atrasoDigitacaoMs,
    cicloId: cicloDigitacao,
  });

  return (
    <motion.li
      initial={
        reduzirMovimento
          ? { opacity: 0 }
          : { opacity: 0, y: 10, clipPath: 'inset(0 0 100% 0)' }
      }
      animate={
        reduzirMovimento
          ? { opacity: 1 }
          : { opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' }
      }
      transition={{
        duration: reduzirMovimento ? 0.12 : 0.28,
        delay: reduzirMovimento ? 0 : Math.min(0.25, indiceOrdem * 0.04),
        ease: [0.16, 1, 0.3, 1],
      }}
      className="box-border grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1 border-b border-azul/50 pb-2.5 last:border-b-0 last:pb-0"
    >
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="min-w-0 break-words font-sans text-[15px] font-bold leading-[1.35] text-branco [overflow-wrap:anywhere]">
          {linha.rotuloLimpo}
        </span>
        <span
          aria-hidden="true"
          className="min-w-0 flex-1 border-b border-dotted border-azul-claro/40"
        />
      </div>

      <motion.span
        initial={false}
        animate={{ opacity: concluido ? 1 : 0.35, scale: concluido ? 1 : 0.98 }}
        transition={{ duration: 0.15 }}
        className={`tabular-nums shrink-0 whitespace-nowrap text-right font-mono text-[15px] font-extrabold leading-[1.35] ${corValor}`}
      >
        {sinal ? `${sinal} ` : ''}
        {formatarCentavos(linha.valorCentavos)}
      </motion.span>

      <div className="col-span-full min-w-0 font-mono text-[13px] leading-[1.4] text-azul-claro [overflow-wrap:anywhere]">
        <span>{textoExibido}</span>
        {escrevendo && (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block h-[13px] w-[2px] translate-y-[2px] bg-laranja"
          />
        )}
      </div>
    </motion.li>
  );
}

interface ResumoCalculoAoVivoProps {
  resultado: ResultadoCalculo;
  modo: ModoCalculo;
  subtituloHolerite: string;
  salarioVazio: boolean;
  etapa: 'editando' | 'concluido';
  camposAlterados: CampoDependenciaHolerite[];
  cicloDigitacao: number;
  trocandoModo?: boolean;
  ladoAtual?: 'left' | 'right';
}

export function ResumoCalculoAoVivo({
  resultado,
  modo,
  subtituloHolerite,
  salarioVazio,
  etapa,
  camposAlterados,
  cicloDigitacao,
  trocandoModo = false,
  ladoAtual = 'left',
}: ResumoCalculoAoVivoProps) {
  const prefereMenosMovimento = Boolean(useReducedMotion());
  const [gavetaCelularAberta, setGavetaCelularAberta] = useState(false);

  const { proventos, descontos, parcelas13, encargos } = useHoleriteLinhas(resultado, modo);

  const brutoRef = Math.max(1, resultado.totalBrutoCentavos);
  const pctLiquido = resultado.valido
    ? Math.min(100, Math.max(0, Math.round((resultado.valorLiquidoCentavos / brutoRef) * 100)))
    : 0;
  const pctDesconto = resultado.valido ? Math.max(0, 100 - pctLiquido) : 0;

  const concluido = etapa === 'concluido';
  const VALOR_VAZIO = `R$ ${String.fromCharCode(8212)}`;

  const estaAfetada = (linha: LinhaHoleriteProcessada): boolean => {
    if (concluido || cicloDigitacao === 0 || camposAlterados.length === 0) return false;
    return linha.dependsOn.some((dep) => camposAlterados.includes(dep));
  };

  let contadorAfetadas = 0;
  const proximoAtraso = (afetada: boolean): number => {
    if (!afetada) return 0;
    const atraso = Math.min(350, contadorAfetadas * 60);
    contadorAfetadas += 1;
    return atraso;
  };

  const renderizarQuadradoHolerite = (emGavetaMobile = false) => (
    <motion.div
      layout={!prefereMenosMovimento}
      animate={
        trocandoModo && !prefereMenosMovimento
          ? {
              scale: [1, 1.025, 1],
              rotateZ: ladoAtual === 'left' ? [-1.4, 0.5, 0] : [1.4, -0.5, 0],
            }
          : { scale: 1, rotateZ: 0 }
      }
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className={`box-border flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border-2 border-tinta bg-azul text-branco shadow-[0_18px_38px_-10px_rgba(0,40,147,0.55),0_5px_0_0_#08122E] ${
        emGavetaMobile ? 'max-h-[88dvh] w-full overflow-y-auto' : 'h-full w-full'
      }`}
    >
      <div>
        {/* Faixa superior Laranja Solar */}
        <div className="h-2.5 w-full bg-laranja" aria-hidden="true" />

        {/* Topo do Quadrado: Título + Visor Branco/Laranja do Líquido */}
        <div className="border-b-2 border-azul-escuro px-6 pt-5 pb-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-extrabold text-branco">
                Holerite estimado
              </h2>
              <p className="mt-1 break-words font-mono text-xs text-azul-claro [overflow-wrap:anywhere]">
                {subtituloHolerite}
              </p>
            </div>

            {emGavetaMobile && (
              <button
                type="button"
                onClick={() => setGavetaCelularAberta(false)}
                aria-label="Fechar holerite"
                className="shrink-0 cursor-pointer rounded-lg border-2 border-tinta bg-branco p-1.5 text-tinta"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Visor Branco de Alto Contraste com Marca-Texto Laranja Solar */}
          <motion.div
            layout="position"
            className="mt-4 rounded-xl border-2 border-tinta bg-branco p-4 text-tinta shadow-[0_4px_0_0_#FD701C]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-azul">
                Líquido a receber
              </span>
              {resultado.valido && !salarioVazio && (
                <span className="rounded-md border border-tinta bg-laranja px-2 py-0.5 font-mono text-xs font-extrabold text-tinta">
                  {pctLiquido}% do bruto
                </span>
              )}
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-2">
              <div className="relative inline-block">
                <motion.span
                  key={concluido ? 'marca-concluido' : `marca-${modo}`}
                  initial={concluido && !prefereMenosMovimento ? { scaleX: 0 } : { scaleX: 1 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: prefereMenosMovimento ? 0 : 0.45, ease: 'easeOut' }}
                  style={{ transformOrigin: 'left center' }}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-[2px] h-[38%] rounded-xs bg-laranja/55"
                />
                <motion.span
                  key={resultado.valorLiquidoCentavos}
                  initial={prefereMenosMovimento ? false : { opacity: 0.4, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  aria-live="polite"
                  className="tabular-nums relative z-10 inline-block whitespace-nowrap px-1 font-mono text-2xl font-extrabold tracking-tight text-tinta"
                >
                  {resultado.valido && !salarioVazio
                    ? formatarCentavos(resultado.valorLiquidoCentavos)
                    : VALOR_VAZIO}
                </motion.span>
              </div>
            </div>

            {resultado.valido && !salarioVazio && (
              <div className="mt-3">
                <div className="flex justify-between text-xs font-bold text-azul">
                  <span>Líquido ({pctLiquido}%)</span>
                  <span>
                    Descontos: {formatarCentavos(resultado.totalDescontosCentavos)} ({pctDesconto}%)
                  </span>
                </div>
                <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full border border-tinta bg-azul-profundo p-0.5">
                  <motion.div
                    initial={false}
                    animate={{ width: `${pctLiquido}%` }}
                    transition={{ duration: prefereMenosMovimento ? 0 : 0.4, ease: 'easeOut' }}
                    className="h-full rounded-l-full bg-azul"
                  />
                  <motion.div
                    initial={false}
                    animate={{ width: `${pctDesconto}%` }}
                    transition={{ duration: prefereMenosMovimento ? 0 : 0.4, ease: 'easeOut' }}
                    className="h-full rounded-r-full bg-laranja"
                  />
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Corpo inteiro sem rolagem interna (acompanha a altura da coluna ao lado) */}
        <div className="min-w-0 px-6 py-5">
          <AnimatePresence initial={false}>
            {salarioVazio || !resultado.valido ? (
              <motion.div
                key="estado-vazio"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-4 rounded-xl border-2 border-laranja bg-azul-profundo p-5"
              >
                <p className="font-sans text-sm font-extrabold text-branco">
                  {salarioVazio
                    ? 'Digite o salário para começar'
                    : (resultado.erroBloqueante ?? 'Digite o salário para começar')}
                </p>

                <ul className="space-y-3" aria-hidden="true">
                  {['Salário base', 'INSS', 'FGTS do mês'].map((item) => (
                    <li
                      key={item}
                      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2"
                    >
                      <div className="flex min-w-0 items-baseline gap-1.5">
                        <span className="font-sans text-[14px] text-azul-claro">{item}</span>
                        <span className="min-w-0 flex-1 border-b border-dotted border-azul-claro/30" />
                      </div>
                      <span className="tabular-nums whitespace-nowrap font-mono text-[14px] text-azul-claro">
                        {VALOR_VAZIO}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ) : (
              <motion.div
                key={`conteudo-${modo}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Resumo Bruto vs Descontos em 2 cartões */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0 rounded-xl border border-azul-claro/30 bg-azul-escuro p-3.5">
                    <span className="block truncate text-xs font-bold text-azul-claro">
                      {resultado.rotuloBruto}
                    </span>
                    <span className="tabular-nums mt-0.5 block whitespace-nowrap font-mono text-base font-extrabold text-branco">
                      {formatarCentavos(resultado.totalBrutoCentavos)}
                    </span>
                  </div>
                  <div className="min-w-0 rounded-xl border border-laranja/50 bg-azul-profundo p-3.5">
                    <span className="block truncate text-xs font-bold text-laranja-borda">
                      Total de descontos
                    </span>
                    <span className="tabular-nums mt-0.5 block whitespace-nowrap font-mono text-base font-extrabold text-laranja">
                      {formatarCentavos(resultado.totalDescontosCentavos)}
                    </span>
                  </div>
                </div>

                {/* Bloco 1: O que você recebe (Proventos) */}
                <div className="rounded-xl border border-azul-claro/25 bg-azul-escuro p-4">
                  <h3 className="flex items-center gap-1.5 font-sans text-xs font-extrabold uppercase tracking-wider text-azul-claro">
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-laranja" aria-hidden="true" />
                    <span>O que você recebe</span>
                  </h3>
                  <ul className="mt-3 space-y-3">
                    {proventos.map((linha, idx) => {
                      const afetada = estaAfetada(linha);
                      return (
                        <LinhaQuadradoHolerite
                          key={linha.id}
                          linha={linha}
                          indiceOrdem={idx}
                          sinal="+"
                          corValor="text-branco"
                          animarDigitacao={afetada}
                          cicloDigitacao={cicloDigitacao}
                          atrasoDigitacaoMs={proximoAtraso(afetada)}
                          reduzirMovimento={prefereMenosMovimento}
                        />
                      );
                    })}
                  </ul>
                </div>

                {/* Bloco 2: Descontos */}
                <div className="rounded-xl border border-laranja/40 bg-azul-profundo p-4">
                  <h3 className="flex items-center gap-1.5 font-sans text-xs font-extrabold uppercase tracking-wider text-laranja">
                    <ArrowDownRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Descontos</span>
                  </h3>
                  {descontos.length > 0 ? (
                    <ul className="mt-3 space-y-3">
                      {descontos.map((d, idx) => {
                        const afetada = estaAfetada(d);
                        return (
                          <LinhaQuadradoHolerite
                            key={d.id}
                            linha={d}
                            indiceOrdem={proventos.length + idx}
                            sinal="-"
                            corValor="text-laranja"
                            animarDigitacao={afetada}
                            cicloDigitacao={cicloDigitacao}
                            atrasoDigitacaoMs={proximoAtraso(afetada)}
                            reduzirMovimento={prefereMenosMovimento}
                          />
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-1.5 font-mono text-[13px] text-azul-claro">
                      Sem descontos apurados.
                    </p>
                  )}
                </div>

                {/* Bloco 3: Parcelas do 13º quando aplicável */}
                {parcelas13.length > 0 && (
                  <div className="rounded-xl border border-branco/30 bg-azul-escuro p-4">
                    <h3 className="flex items-center gap-1.5 font-sans text-xs font-extrabold uppercase tracking-wider text-branco">
                      <CalendarClock
                        className="h-4 w-4 shrink-0 text-laranja"
                        aria-hidden="true"
                      />
                      <span>Parcelas do 13º</span>
                    </h3>
                    <ul className="mt-3 space-y-3">
                      {parcelas13.map((p, idx) => {
                        const afetada = estaAfetada(p);
                        return (
                          <LinhaQuadradoHolerite
                            key={p.id}
                            linha={p}
                            indiceOrdem={proventos.length + descontos.length + idx}
                            corValor="text-laranja-borda"
                            animarDigitacao={afetada}
                            cicloDigitacao={cicloDigitacao}
                            atrasoDigitacaoMs={proximoAtraso(afetada)}
                            reduzirMovimento={prefereMenosMovimento}
                          />
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Bloco 4: Encargo da empresa (FGTS) */}
                {encargos.length > 0 && (
                  <div className="rounded-xl border-2 border-laranja bg-azul-profundo p-4">
                    <h3 className="flex items-center gap-1.5 font-sans text-xs font-extrabold text-laranja">
                      <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Encargo da empresa (não desconta)</span>
                    </h3>
                    <ul className="mt-2.5 space-y-2.5">
                      {encargos.map((enc, idx) => {
                        const afetada = estaAfetada(enc);
                        return (
                          <LinhaQuadradoHolerite
                            key={enc.id}
                            linha={enc}
                            indiceOrdem={
                              proventos.length + descontos.length + parcelas13.length + idx
                            }
                            corValor="text-branco"
                            animarDigitacao={afetada}
                            cicloDigitacao={cicloDigitacao}
                            atrasoDigitacaoMs={proximoAtraso(afetada)}
                            reduzirMovimento={prefereMenosMovimento}
                          />
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Observações */}
                {resultado.avisos.length > 0 && (
                  <div className="space-y-2">
                    {resultado.avisos.map((av) => (
                      <div
                        key={av.codigo}
                        className="rounded-xl border-2 border-laranja bg-branco p-3.5 text-xs text-tinta"
                      >
                        <p className="leading-snug [overflow-wrap:anywhere]">
                          <AlertTriangle
                            className="mr-1 inline h-3.5 w-3.5 text-laranja"
                            aria-hidden="true"
                          />
                          <strong className="font-extrabold text-azul">Atenção:</strong>{' '}
                          {resumirAvisoHolerite(av)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Rodapé do Quadrado com o Carimbo Inclinado (-2°) */}
      <div className="border-t-2 border-azul-escuro bg-azul-profundo px-6 py-4">
        <motion.div
          initial={
            concluido && !prefereMenosMovimento
              ? { opacity: 0, scale: 1.25, rotate: -8 }
              : false
          }
          animate={{ opacity: 1, scale: 1, rotate: -2 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="inline-block -rotate-2 rounded-md border border-laranja bg-azul-escuro px-2.5 py-1 font-mono text-xs font-bold text-branco"
        >
          Parâmetros {ANO_VIGENTE} · conferido em {DATA_ULTIMA_CONFERENCIA}
        </motion.div>
      </div>
    </motion.div>
  );

  return (
    <>
      <aside
        id="holerite-estimado"
        aria-label="Holerite estimado"
        className={`no-print box-border flex min-w-0 flex-col ${
          concluido ? 'mx-auto w-full max-w-[640px]' : 'h-full w-full'
        }`}
      >
        {renderizarQuadradoHolerite(false)}
      </aside>

      {/* Barra fixa no celular (< 900px) */}
      {!concluido && (
        <>
          <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t-4 border-laranja bg-azul text-branco shadow-2xl min-[900px]:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="block text-xs font-bold text-azul-claro">Líquido a receber</span>
                <strong className="tabular-nums font-display text-lg font-extrabold text-branco">
                  {resultado.valido && !salarioVazio
                    ? formatarCentavos(resultado.valorLiquidoCentavos)
                    : VALOR_VAZIO}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setGavetaCelularAberta((v) => !v)}
                className="btn-laranja-tactile !min-h-[40px] !px-3.5 !py-2 text-xs"
              >
                <span>{gavetaCelularAberta ? 'Ocultar holerite' : 'Ver holerite'}</span>
                {gavetaCelularAberta ? (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {gavetaCelularAberta && (
              <div
                className="no-print fixed inset-0 z-50 flex flex-col justify-end bg-azul-profundo/80 min-[900px]:hidden"
                role="dialog"
                aria-modal="true"
                aria-label="Holerite estimado no celular"
              >
                <div
                  className="flex-1"
                  onClick={() => setGavetaCelularAberta(false)}
                  aria-hidden="true"
                />
                <motion.div
                  initial={prefereMenosMovimento ? { opacity: 0 } : { y: '100%' }}
                  animate={prefereMenosMovimento ? { opacity: 1 } : { y: 0 }}
                  exit={prefereMenosMovimento ? { opacity: 0 } : { y: '100%' }}
                  transition={
                    prefereMenosMovimento
                      ? { duration: 0.12 }
                      : { type: 'spring', stiffness: 260, damping: 28 }
                  }
                  className="max-h-[90dvh] w-full overflow-hidden px-2 pb-2"
                >
                  {renderizarQuadradoHolerite(true)}
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </>
  );
}
