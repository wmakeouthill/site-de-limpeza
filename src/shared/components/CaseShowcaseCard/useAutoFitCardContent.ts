import { useLayoutEffect, useRef } from "react";

/**
 * Escalas progressivas: valor do KPI, gap entre linhas de KPIs e gap do
 * cardBody (entre intro / métricas / link). O fit tenta a maior primeiro.
 */
const METRIC_FIT_STEPS = [
  { value: 36, gap: 20, bodyGap: 24 },
  { value: 32, gap: 16, bodyGap: 24 },
  { value: 28, gap: 14, bodyGap: 20 },
  { value: 24, gap: 12, bodyGap: 16 },
  { value: 20, gap: 10, bodyGap: 14 },
  { value: 18, gap: 8, bodyGap: 12 },
] as const;

/**
 * Redução moderada do título quando ele (ou o card) está apertado.
 * Mantém o clamp em 3 linhas — assim a fonte menor realmente libera altura
 * para os KPIs (antes o clamp subia e a altura do título ficava igual).
 * Em 22px base: 22 → 20 → 18.
 */
const TITLE_SPACE_SHRINKS = [0, 2, 4] as const;

/** Piso tipográfico do título (não encolher além disso). */
const TITLE_MIN_SIZE = 18;

/** Altura máxima preferida do título em linhas. */
const TITLE_MAX_LINES = 3;

/** Tolerância em px para arredondamentos de layout ao comparar alturas. */
const SLACK = 1;

/**
 * Mantém título e KPIs do case dentro da altura fixa do card sem nunca
 * empurrar o botão "Ler case completo".
 *
 * Título: começa no tamanho base com até 3 linhas. Se o texto truncar ou os
 * KPIs não couberem, a fonte cai com moderação (ex.: 22→20→18) mantendo o
 * clamp em 3 linhas — isso encurta o bloco do título e libera espaço. Só se
 * ainda truncar no piso tipográfico o clamp sobe para 4 linhas.
 *
 * KPIs: cada um usa o maior número que mantém seu próprio label em até duas
 * linhas. O limite de todos só diminui quando o bloco completo estoura a
 * altura disponível. Se ainda assim não couber, o label cai para 1 linha.
 *
 * `signature` deve mudar sempre que título/métricas mudarem, para refazer a
 * medição (ex.: troca de case no carrossel).
 */
export function useAutoFitCardContent(signature: string) {
  const containerRef = useRef<HTMLElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const metrics = metricsRef.current;
    const container = containerRef.current;
    if (!metrics || !container) {
      return;
    }

    const cardBody = metrics.parentElement;
    const metricItems = Array.from(
      metrics.querySelectorAll<HTMLElement>("[data-metric]"),
    );

    const setLabelLines = (lines: 1 | 2) => {
      for (const metric of metricItems) {
        const label = metric.querySelector<HTMLElement>("[data-metric-label]");
        if (!label) {
          continue;
        }
        if (lines === 2) {
          label.style.removeProperty("--metric-label-lines");
        } else {
          label.style.setProperty("--metric-label-lines", "1");
        }
      }
    };

    const labelIsTruncated = (metric: HTMLElement) => {
      const label = metric.querySelector<HTMLElement>("[data-metric-label]");
      return Boolean(label && label.scrollHeight > label.clientHeight + SLACK);
    };

    const fitMetricLabels = (maximumValue: number) => {
      for (const metric of metricItems) {
        for (const step of METRIC_FIT_STEPS) {
          if (step.value > maximumValue) {
            continue;
          }
          metric.style.setProperty("--metric-value-size", `${step.value}px`);
          if (!labelIsTruncated(metric)) {
            break;
          }
        }
      }
    };

    const applyMetricStep = (step: (typeof METRIC_FIT_STEPS)[number]) => {
      if (cardBody) {
        cardBody.style.setProperty("--body-gap", `${step.bodyGap}px`);
      }
      metrics.style.setProperty("--metric-gap", `${step.gap}px`);
      fitMetricLabels(step.value);
    };

    const metricsFit = () =>
      metrics.scrollHeight <= metrics.clientHeight + SLACK;

    const fit = () => {
      const title = container.querySelector<HTMLElement>("[data-card-title]");
      if (!title) {
        return;
      }

      title.style.removeProperty("--title-size");
      title.style.removeProperty("--title-lines");
      const computed = getComputedStyle(title);
      const baseSize = Number.parseFloat(computed.fontSize);
      const lineHeight = Number.parseFloat(computed.lineHeight);

      const applyTitle = (shrink: number, lines: number) => {
        const size = Math.max(baseSize - shrink, TITLE_MIN_SIZE);
        title.style.setProperty("--title-size", `${size}px`);
        title.style.setProperty("--title-lines", String(lines));
      };

      const titleFits = () =>
        title.scrollHeight <= title.clientHeight + SLACK;

      const tryMetrics = () => {
        setLabelLines(2);
        for (const step of METRIC_FIT_STEPS) {
          applyMetricStep(step);
          if (metricsFit()) {
            return true;
          }
        }
        return false;
      };

      // Detecta título "grande demais": já usa as 3 linhas no tamanho base.
      // Nesses casos começa em -2px (ex. 22→20) em vez de ficar no máximo.
      applyTitle(0, TITLE_MAX_LINES);
      const isLongTitle =
        titleFits() &&
        title.scrollHeight >= TITLE_MAX_LINES * lineHeight - SLACK;
      const titleShrinks = isLongTitle
        ? TITLE_SPACE_SHRINKS.filter((shrink) => shrink > 0)
        : TITLE_SPACE_SHRINKS;

      // 1) Shrink moderado do título (3 linhas fixas) + KPIs.
      //    Fonte menor com o mesmo clamp libera altura de verdade.
      for (const shrink of titleShrinks) {
        applyTitle(shrink, TITLE_MAX_LINES);
        if (!titleFits()) {
          continue;
        }
        if (tryMetrics()) {
          return;
        }
      }

      // 2) Título ainda não cabe em 3 linhas no piso: permite 4 linhas.
      applyTitle(TITLE_SPACE_SHRINKS[TITLE_SPACE_SHRINKS.length - 1], 4);
      if (titleFits() && tryMetrics()) {
        return;
      }

      // 3) Último recurso: labels em 1 linha + menor escala tipográfica.
      setLabelLines(1);
      applyMetricStep(METRIC_FIT_STEPS[METRIC_FIT_STEPS.length - 1]);
    };

    fit();

    // Fontes (gradiente/web fonts) podem mudar a métrica depois do 1º paint.
    document.fonts?.ready.then(fit).catch(() => {});

    // Refaz ao mudar a largura do card (responsivo). O card tem altura fixa no
    // desktop, então mutar título/métricas aqui dentro não realimenta o
    // observer; no mobile (altura auto) o fit é idempotente e estabiliza.
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [signature]);

  return { containerRef, metricsRef };
}
