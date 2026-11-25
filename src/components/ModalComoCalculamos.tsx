import { useEffect } from 'react';
import { X } from 'lucide-react';
import { obterParametros } from '../config/parametros';
import { formatarCentavos, formatarPercentual } from '../calc';

interface ModalComoCalculamosProps {
  aberto: boolean;
  onFechar: () => void;
}

export function ModalComoCalculamos({ aberto, onFechar }: ModalComoCalculamosProps) {
  const parametros = obterParametros();

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-azul-profundo/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-como-calculamos"
    >
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded border-2 border-azul bg-surface">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-azul px-6 py-4 text-branco">
          <div>
            <h2 id="titulo-como-calculamos" className="text-lg font-bold text-branco">
              Critérios e fórmulas de cálculo
            </h2>
            <p className="mt-0.5 text-xs text-branco/75">
              Apuração em centavos inteiros conforme legislação trabalhista e previdenciária de{' '}
              {parametros.ano}.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar critérios de cálculo"
            className="cursor-pointer rounded border border-branco/30 p-1.5 text-branco hover:border-branco"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="divide-y divide-border px-6 text-sm leading-relaxed text-fg-muted">
          <section className="py-4">
            <h3 className="text-sm font-bold text-fg">Saldo de salário e aviso prévio</h3>
            <p className="mt-1.5">
              O saldo de salário considera o divisor comercial de 30 dias multiplicado pelos dias
              trabalhados no mês do desligamento, limitados a 30. O aviso prévio indenizado aplica a
              Lei nº 12.506/2011: 30 dias mais 3 dias por ano completo na empresa, até 90 dias,
              projetando o contrato para avos de férias e 13º salário.
            </p>
          </section>

          <section className="py-4">
            <h3 className="text-sm font-bold text-fg">Décimo terceiro e férias</h3>
            <p className="mt-1.5">
              Cada mês com 15 dias ou mais trabalhados computa 1/12 avo. No 13º anual, a 1ª parcela
              (até 30/11) paga metade do bruto sem descontos e a 2ª parcela (até 20/12) retém INSS e
              IRRF sobre o total. Férias indenizadas na rescisão somam 1/3 constitucional sem
              incidência de INSS ou IRRF.
            </p>
          </section>

          <section className="py-4">
            <h3 className="text-sm font-bold text-fg">INSS progressivo ({parametros.ano})</h3>
            <p className="mt-1.5">
              Apurado por faixas progressivas até o teto de{' '}
              <span className="tabular-nums font-semibold text-fg">
                {formatarCentavos(parametros.tetoInssCentavos)}
              </span>
              . No caso real de salário R$ 712,00 com Base INSS de R$ 710,00 no holerite, 7,5% gera
              R$ 53,25 (líquido R$ 658,75), diferença de R$ 0,15 em relação a 7,5% sobre R$ 712,00
              (R$ 53,40).
            </p>
            <div className="mt-3 grid grid-cols-2 divide-x divide-border rounded border border-border bg-surface-subtle text-xs sm:grid-cols-4">
              {parametros.faixasInss.map((f, idx) => (
                <div key={f.ateCentavos} className="p-2.5">
                  <span className="block font-bold text-fg">
                    {formatarPercentual(f.aliquota)} (Faixa {idx + 1})
                  </span>
                  <span className="tabular-nums text-fg-muted">
                    Até {formatarCentavos(f.ateCentavos)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="py-4">
            <h3 className="text-sm font-bold text-fg">IRRF, FGTS, piso salarial e vale-transporte</h3>
            <p className="mt-1.5">
              O IRRF adota a maior dedução entre as legais (INSS mais{' '}
              <span className="tabular-nums">
                {formatarCentavos(parametros.deducaoDependenteCentavos)}
              </span>{' '}
              por dependente) e o desconto simplificado ({' '}
              <span className="tabular-nums">
                {formatarCentavos(parametros.descontoSimplificadoIrrfCentavos)}
              </span>
              ), aplicando em seguida o redutor mensal. O FGTS (8% CLT, 2% aprendiz) é encargo
              patronal e nunca desconta do líquido. O vale-transporte limita-se a 6% do salário
              proporcional ou ao benefício fornecido.
            </p>
            <p className="mt-2">
              Quando o salário informado está abaixo do salário mínimo vigente de {parametros.ano} (
              <span className="tabular-nums">
                {formatarCentavos(parametros.salarioMinimoCentavos)}
              </span>
              ) ou do piso da categoria informado, a calculadora emite alerta informativo: em
              contratos de jornada reduzida ou aprendizagem, confirme a proporcionalidade por hora.
              Estimativa para fins informativos. Confirme os valores com o RH ou assessoria
              jurídica.
            </p>
          </section>
        </div>

        <div className="flex justify-end border-t border-border bg-surface-subtle px-6 py-3.5">
          <button
            type="button"
            onClick={onFechar}
            className="cursor-pointer rounded bg-azul px-4 py-2 text-xs font-bold text-branco hover:bg-azul-escuro"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
