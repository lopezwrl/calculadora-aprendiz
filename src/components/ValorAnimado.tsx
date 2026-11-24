import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { formatarCentavos } from '../calc';

interface ValorAnimadoProps {
  centavos: number;
  duracaoSegundos?: number;
  className?: string;
}

/**
 * Interpola suavemente do valor anterior até o novo valor em centavos,
 * mantendo os números vivos a cada alteração do formulário.
 */
export function ValorAnimado({
  centavos,
  duracaoSegundos = 0.55,
  className = '',
}: ValorAnimadoProps) {
  const prefereMenosMovimento = useReducedMotion();
  const [exibido, setExibido] = useState<number>(prefereMenosMovimento ? centavos : 0);
  const anteriorRef = useRef<number>(prefereMenosMovimento ? centavos : 0);

  useEffect(() => {
    if (prefereMenosMovimento) {
      setExibido(centavos);
      anteriorRef.current = centavos;
      return;
    }

    const origem = anteriorRef.current;
    const controles = animate(origem, centavos, {
      duration: duracaoSegundos,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (atual) => {
        const arred = Math.round(atual);
        anteriorRef.current = arred;
        setExibido(arred);
      },
    });

    return () => controles.stop();
  }, [centavos, duracaoSegundos, prefereMenosMovimento]);

  return <span className={`tabular-nums ${className}`}>{formatarCentavos(exibido)}</span>;
}
