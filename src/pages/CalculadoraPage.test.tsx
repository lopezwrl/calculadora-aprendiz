import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../App';

function luminanciaRelativa(hex: string): number {
  const limpo = hex.replace('#', '');
  const r = parseInt(limpo.slice(0, 2), 16) / 255;
  const g = parseInt(limpo.slice(2, 4), 16) / 255;
  const b = parseInt(limpo.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function razaoContraste(hexA: string, hexB: string): number {
  const l1 = luminanciaRelativa(hexA);
  const l2 = luminanciaRelativa(hexB);
  const claro = Math.max(l1, l2);
  const escuro = Math.min(l1, l2);
  return (claro + 0.05) / (escuro + 0.05);
}

describe('Interface Calculadora CLT Teresina', () => {
  it('renderiza cabeçalho com rótulos em texto, caso de referência R$ 658,75, área de importação e rodapé de parâmetros', () => {
    render(<App />);

    expect(screen.getAllByText('Calculadora CLT Teresina').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Como calculamos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Histórico/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mudar para tema escuro/i })).toHaveTextContent(
      'Tema escuro'
    );

    expect(screen.getByText('Importar holerite')).toBeInTheDocument();
    expect(screen.getByText('Seus dados ficam no seu dispositivo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preencher manualmente' })).toBeInTheDocument();

    // Resumo ao vivo exibe o líquido de referência R$ 658,75
    expect(screen.getAllByText('R$ 658,75').length).toBeGreaterThan(0);

    // Vale-transporte desativado por padrão
    const switchVt = screen.getByRole('switch', { name: /Vale-transporte/i });
    expect(switchVt).not.toBeChecked();

    // Rodapé com parâmetros e data de conferência
    expect(
      screen.getByText(/Parâmetros de 2026, conferidos em 24\/11\/2026/i)
    ).toBeInTheDocument();
  });

  it('alterna entre modos de uso e não exibe erros antes da interação do usuário', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Preencher manualmente' }));
    expect(screen.queryByText('Informe a data de admissão.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Rescisão' }));
    expect(screen.getByLabelText('Modalidade da rescisão')).toBeInTheDocument();
    expect(screen.getByLabelText('Data de saída')).toBeInTheDocument();
  });

  it('percorre o fluxo completo de 3 etapas na rescisão, expande rubrica, salva no histórico e exibe aviso único no resultado', async () => {
    window.scrollTo = () => {};
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: 'Rescisão' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar para verbas' }));

    await waitFor(() => {
      expect(screen.getByText('Verbas da modalidade selecionada')).toBeInTheDocument();
    });

    const switchSaldo = screen.getByRole('switch', { name: 'Saldo de salário' });
    expect(switchSaldo).toBeChecked();
    expect(switchSaldo).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Ver resultado' }));

    await waitFor(() => {
      expect(screen.getByText('Detalhamento por rubrica')).toBeInTheDocument();
    });

    const avisosDiscretos = screen.getAllByText(
      'Estimativa para fins informativos. Confirme os valores com o RH ou assessoria jurídica.'
    );
    expect(avisosDiscretos).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Baixar PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imprimir/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Novo cálculo/i })).toBeInTheDocument();
  });

  it('garante contraste mínimo WCAG AA (>= 4.5:1) na paleta oficial #002893, #FFFFFF e #FD701C nos temas claro e escuro', () => {
    // Identidade institucional principal (#002893, #FFFFFF, #FD701C)
    expect(razaoContraste('#FFFFFF', '#002893')).toBeGreaterThanOrEqual(4.5);
    expect(razaoContraste('#002893', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(razaoContraste('#08122E', '#FD701C')).toBeGreaterThanOrEqual(4.5);

    // Superfícies do tema claro
    expect(razaoContraste('#08122E', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(razaoContraste('#33436B', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(razaoContraste('#51628C', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);

    // Superfícies do tema escuro
    expect(razaoContraste('#FFFFFF', '#050C24')).toBeGreaterThanOrEqual(4.5);
    expect(razaoContraste('#FFFFFF', '#0A163D')).toBeGreaterThanOrEqual(4.5);
    expect(razaoContraste('#CBD6F0', '#0A163D')).toBeGreaterThanOrEqual(4.5);
    expect(razaoContraste('#98ABD6', '#0A163D')).toBeGreaterThanOrEqual(4.5);
  });
});
