import { useEffect, useId, useRef, useState } from "react";

interface MermaidDiagramProps {
  readonly code: string;
}

let mermaidInitialized = false;
let mermaidRenderSequence = 0;

/**
 * Renderiza um bloco ```mermaid``` como diagrama SVG. O mermaid e carregado
 * sob demanda (import dinamico) para nao pesar no bundle de quem nao usa.
 */
export function MermaidDiagram({ code }: MermaidDiagramProps) {
  // Hooks precisam ser chamados incondicionalmente (Regras dos Hooks) e a marcacao
  // precisa ser identica no servidor e no cliente para nao quebrar a hidratacao.
  // O <div> sai vazio no SSR/primeiro render e o efeito (so roda no browser) injeta
  // o SVG depois de montar.
  const containerRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const renderAttemptRef = useRef(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const renderAttempt = renderAttemptRef.current + 1;
    renderAttemptRef.current = renderAttempt;
    let isActive = true;
    containerRef.current?.replaceChildren();

    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        if (!mermaidInitialized) {
          mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
          mermaidInitialized = true;
        }
        // O id do mermaid nao pode conter ":" (gerado pelo useId) e precisa ser
        // unico por render para evitar colisao quando effects concorrentes terminam fora de ordem.
        mermaidRenderSequence += 1;
        const safeReactId = reactId.replace(/[^a-zA-Z0-9]/g, "");
        const renderId = `mermaid-${safeReactId}-${renderAttempt}-${mermaidRenderSequence}`;
        const { svg } = await mermaid.render(renderId, code);
        const isCurrentRender = renderAttemptRef.current === renderAttempt;
        if (isActive && isCurrentRender && containerRef.current) {
          const svgContainer = document.createElement("div");
          svgContainer.innerHTML = svg;
          containerRef.current.replaceChildren(...Array.from(svgContainer.childNodes));
          setError(null);
        }
      } catch (err) {
        const isCurrentRender = renderAttemptRef.current === renderAttempt;
        if (isActive && isCurrentRender) {
          containerRef.current?.replaceChildren();
          setError(err instanceof Error ? err.message : "Erro ao renderizar o diagrama.");
        }
      }
    })();

    return () => {
      isActive = false;
      containerRef.current?.replaceChildren();
    };
  }, [code, reactId]);

  if (error) {
    return <pre>{`Diagrama Mermaid invalido: ${error}\n\n${code}`}</pre>;
  }

  return <div ref={containerRef} />;
}
