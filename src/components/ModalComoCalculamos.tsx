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
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-como-calculamos"
    >
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface shadow-2xl">
        <div className="h-1 w-full bg-laranja" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 id="titulo-como-calculamos" className="text-lg font-bold text-fg">
              Critérios e fórmulas de cálculo
            </h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              Apuração em centavos inteiros conforme legislação trabalhista e previdenciária de {parametros.ano}.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar critérios de cálculo"
            className="rounded-md border border-border p-1.5 text-fg-muted transition-colors duration-150 hover:border-border-strong hover:text-fg"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="divide-y divide-border px-6 text-sm leading-relaxed text-fg-muted">
          <section className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand">
              Saldo de salário e aviso prévio
            </h3>
            <p className="mt-1.5">
              O saldo de salário considera o divisor comercial de 30 dias multiplicado pelos dias trabalhados no mês
              do desligamento, limitados a 30. O aviso prévio indenizado aplica a Lei nº 12.506/2011: 30 dias mais 3
              dias por ano completo na empresa, até 90 dias, projetando o contrato para avos de férias e 13º salário.
            </p>
          </section>

          <section className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand">
              Décimo terceiro e férias
            </h3>
            <p className="mt-1.5">
              Cada mês com 15 dias ou mais trabalhados computa 1/12 avo. No 13º anual, a 1ª parcela (até 30/11) paga
              metade do bruto sem descontos e a 2ª parcela (até 20/12) retém INSS e IRRF sobre o total. Férias
              indenizadas na rescisão somam 1/3 constitucional sem incidência de INSS ou IRRF.
            </p>
          </section>

          <section className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand">
              INSS progressivo ({parametros.ano})
            </h3>
            <p className="mt-1.5">
              Apurado por faixas progressivas até o teto de{' '}
              <span className="tabular-nums font-semibold text-fg">
                {formatarCentavos(parametros.tetoInssCentavos)}
              </span>
              . No caso real de salário R$ 712,00 com Base INSS de R$ 710,00 no holerite, 7,5% gera R$ 53,25 (líquido
              R$ 658,75), diferença de R$ 0,15 em relação a 7,5% sobre R$ 712,00 (R$ 53,40).
            </p>
            <div className="mt-3 grid grid-cols-2 divide-x divide-border rounded-md border border-border bg-surface-subtle text-xs sm:grid-cols-4">
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand">
              IRRF, FGTS e vale-transporte
            </h3>
            <p className="mt-1.5">
              O IRRF adota a maior dedução entre as legais (INSS mais{' '}
              <span className="tabular-nums">{formatarCentavos(parametros.deducaoDependenteCentavos)}</span> por
              dependente) e o desconto simplificado ({' '}
              <span className="tabular-nums">{formatarCentavos(parametros.descontoSimplificadoIrrfCentavos)}</span>),
              aplicando em seguida o redutor mensal. O FGTS (8% CLT, 2% aprendiz) é encargo patronal e nunca desconta do
              líquido. O vale-transporte limita-se a 6% do salário proporcional ou ao benefício fornecido.
            </p>
          </section>
        </div>

        <div className="flex justify-end border-t border-border bg-surface-subtle px-6 py-3.5">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md bg-azul px-4 py-2 text-xs font-bold text-branco transition-colors duration-150 hover:bg-azul-escuro"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
