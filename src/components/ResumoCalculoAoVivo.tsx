import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatarCentavos, ResultadoCalculo } from '../calc';
import { ValorAnimado } from './ValorAnimado';

interface ResumoCalculoAoVivoProps {
  resultado: ResultadoCalculo;
  descricaoModo: string;
}

export function ResumoCalculoAoVivo({ resultado, descricaoModo }: ResumoCalculoAoVivoProps) {
  const [expandidoMobile, setExpandidoMobile] = useState(false);
  const prefereMenosMovimento = useReducedMotion();

  const brutoRef = Math.max(1, resultado.totalBrutoCentavos);
  const pctLiquido = resultado.valido
    ? Math.min(100, Math.max(0, Math.round((resultado.valorLiquidoCentavos / brutoRef) * 100)))
    : 0;
  const pctDesconto = resultado.valido ? Math.max(0, 100 - pctLiquido) : 0;

  return (
    <>
      {/* Console azul cobalto (#002893) fixo à direita com contagem viva */}
      <aside
        aria-label="Resumo ao vivo do cálculo"
        className="no-print hidden lg:block lg:sticky lg:top-24 lg:self-start"
      >
        <motion.div
          layout={!prefereMenosMovimento}
          className="overflow-hidden rounded-2xl border-2 border-azul-escuro bg-azul text-branco shadow-xl"
        >
          <div className="h-2 w-full bg-laranja" aria-hidden="true" />

          <div className="p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-block rounded-md bg-branco/15 px-2.5 py-1 text-xs font-semibold text-branco">
                {descricaoModo}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-branco/80">
                <span className="h-2 w-2 rounded-full bg-laranja" aria-hidden="true" />
                <span>Ao vivo</span>
              </span>
            </div>

            <div className="mt-5">
              <span className="block text-xs font-medium text-branco/80">
                Valor líquido estimado
              </span>
              {resultado.valido ? (
                <ValorAnimado
                  centavos={resultado.valorLiquidoCentavos}
                  duracaoSegundos={0.45}
                  className="mt-1 block font-display text-2xl font-bold tracking-tight text-branco"
                />
              ) : (
                <span className="tabular-nums mt-1 block font-display text-2xl font-bold text-branco/50">
                  R$ 0,00
                </span>
              )}
            </div>

            {/* Barra de proporção viva entre líquido e descontos */}
            {resultado.valido && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-branco/80">
                  <span>Líquido ({pctLiquido}%)</span>
                  <span>Descontos ({pctDesconto}%)</span>
                </div>
                <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-azul-profundo p-0.5">
                  <motion.div
                    initial={false}
                    animate={{ width: `${pctLiquido}%` }}
                    transition={{ duration: prefereMenosMovimento ? 0 : 0.35, ease: 'easeOut' }}
                    className="h-full rounded-l-full bg-branco"
                  />
                  <motion.div
                    initial={false}
                    animate={{ width: `${pctDesconto}%` }}
                    transition={{ duration: prefereMenosMovimento ? 0 : 0.35, ease: 'easeOut' }}
                    className="h-full rounded-r-full bg-laranja"
                  />
                </div>
              </div>
            )}

            {!resultado.valido ? (
              <p className="mt-5 rounded-xl bg-branco/10 p-4 text-xs leading-relaxed text-branco/90">
                {resultado.erroBloqueante ??
                  'Preencha os campos de data e salário ao lado para calcular automaticamente.'}
              </p>
            ) : (
              <div className="mt-6 space-y-4 border-t border-branco/20 pt-5 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-branco/10 p-3">
                    <span className="block text-xs text-branco/75">{resultado.rotuloBruto}</span>
                    <ValorAnimado
                      centavos={resultado.totalBrutoCentavos}
                      duracaoSegundos={0.4}
                      className="mt-0.5 block font-display text-base font-bold text-branco"
                    />
                  </div>
                  <div className="rounded-xl bg-branco/10 p-3">
                    <span className="block text-xs text-branco/75">Descontos</span>
                    <ValorAnimado
                      centavos={resultado.totalDescontosCentavos}
                      duracaoSegundos={0.4}
                      className="mt-0.5 block font-display text-base font-bold text-laranja"
                    />
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {resultado.linhasDescontos.length > 0 && (
                    <motion.div
                      initial={prefereMenosMovimento ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 border-t border-branco/15 pt-3.5 text-xs"
                    >
                      <span className="block font-semibold text-branco/80">
                        Composição dos descontos
                      </span>
                      <ul className="space-y-1.5">
                        {resultado.linhasDescontos.map((d) => (
                          <motion.li
                            key={d.id}
                            layout={!prefereMenosMovimento}
                            className="flex items-center justify-between gap-2 text-branco/90"
                          >
                            <span>
                              {d.rotulo}
                              {d.aliquotaTexto ? ` (${d.aliquotaTexto})` : ''}
                            </span>
                            <span className="tabular-nums font-semibold text-branco">
                              {formatarCentavos(d.valorCentavos)}
                            </span>
                          </motion.li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>

                {resultado.parcelasDecimoTerceiro && (
                  <div className="space-y-1.5 border-t border-branco/15 pt-3.5 text-xs">
                    <span className="block font-semibold text-branco/80">Parcelas do 13º</span>
                    {resultado.parcelasDecimoTerceiro.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-branco/90">
                        <span>{p.rotulo}</span>
                        <span className="tabular-nums font-bold text-branco">
                          {formatarCentavos(p.valorCentavos)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {resultado.linhasEncargos.length > 0 && (
                  <div className="rounded-xl bg-azul-profundo/60 p-3.5 text-xs">
                    <span className="block font-semibold text-laranja">
                      Encargo da empresa (sem desconto)
                    </span>
                    <div className="mt-1.5 space-y-1">
                      {resultado.linhasEncargos.map((enc) => (
                        <div
                          key={enc.id}
                          className="flex items-center justify-between text-branco/85"
                        >
                          <span>{enc.rotulo}</span>
                          <span className="tabular-nums font-semibold text-branco">
                            {formatarCentavos(enc.valorCentavos)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {resultado.avisos.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {resultado.avisos.map((av) => (
                      <div
                        key={av.codigo}
                        role="status"
                        aria-live="polite"
                        className="rounded-xl border border-laranja/50 bg-azul-profundo/80 p-3 text-xs text-branco"
                      >
                        <div className="flex items-center gap-1.5 font-bold text-laranja">
                          {av.nivel === 'aviso' && (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          )}
                          <span>{av.titulo}</span>
                        </div>
                        <p className="mt-1 leading-relaxed text-branco/90">{av.mensagem}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </aside>

      {/* Barra recolhível no celular */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t-2 border-laranja bg-azul text-branco shadow-2xl lg:hidden">
        {expandidoMobile && resultado.valido && (
          <div className="space-y-1.5 border-b border-branco/20 bg-azul-escuro px-4 py-3 text-xs">
            <div className="flex justify-between">
              <span className="text-branco/80">{resultado.rotuloBruto}</span>
              <span className="tabular-nums font-semibold text-branco">
                {formatarCentavos(resultado.totalBrutoCentavos)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-branco/80">Descontos</span>
              <span className="tabular-nums font-semibold text-laranja">
                {formatarCentavos(resultado.totalDescontosCentavos)}
              </span>
            </div>
            {resultado.linhasEncargos[0] && (
              <div className="flex justify-between text-branco/80">
                <span>{resultado.linhasEncargos[0].rotulo}</span>
                <span className="tabular-nums font-medium text-branco">
                  {formatarCentavos(resultado.linhasEncargos[0].valorCentavos)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <span className="block text-xs text-branco/80">Valor líquido estimado</span>
            <span className="tabular-nums font-display text-lg font-bold text-branco">
              {resultado.valido ? formatarCentavos(resultado.valorLiquidoCentavos) : 'R$ 0,00'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExpandidoMobile((v) => !v)}
            aria-expanded={expandidoMobile}
            className="inline-flex items-center gap-1.5 rounded-lg bg-laranja px-3.5 py-2 text-xs font-bold text-tinta"
          >
            <span>{expandidoMobile ? 'Ocultar resumo' : 'Ver detalhes'}</span>
            {expandidoMobile ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </>
  );
}
