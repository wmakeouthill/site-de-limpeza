import React, { useState } from "react";
import "./NeighborhoodChecker.css";
import { buildGreeting } from "@/features/list/utils/whatsappFormatter";
import { normalizeText } from "@/features/catalog/utils/productSearch";
import { trackWhatsAppClick } from "@/features/analytics/services/trackEvent";

export interface NeighborhoodCheckerProps {
  bairros: string[];
  lojaNome?: string;
  whatsappNumero?: string;
}

export interface NeighborhoodResult {
  status: "short" | "found" | "not_found";
  query: string;
  matchedBairro?: string;
}

export function NeighborhoodChecker({
  bairros,
  lojaNome = "Falcão Limpeza",
  whatsappNumero = "5521999999999",
}: NeighborhoodCheckerProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<NeighborhoodResult | null>(null);

  function handleCheck(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = query.trim();

    if (trimmed.length < 3) {
      setResult({ status: "short", query: trimmed });
      return;
    }

    const normQuery = normalizeText(trimmed);
    const hit = bairros.find((b) => {
      const normB = normalizeText(b);
      return normB.includes(normQuery) || normQuery.includes(normB);
    });

    if (hit) {
      setResult({
        status: "found",
        query: trimmed,
        matchedBairro: hit,
      });
    } else {
      setResult({
        status: "not_found",
        query: trimmed,
      });
    }
  }

  const cleanNumber = whatsappNumero.replace(/\D/g, "");
  const greeting = buildGreeting(lojaNome);

  let waUrl = "";
  if (result?.status === "found" && result.matchedBairro) {
    const text = `${greeting} Moro em ${result.matchedBairro}. Como funciona a entrega?`;
    waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
  } else if (result?.status === "not_found") {
    const text = `${greeting} Vocês entregam em ${result.query}?`;
    waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="bairro-checker">
      <form className="bairro-form" onSubmit={handleCheck} noValidate>
        <div className="bairro-input-row">
          <input
            id="bairro-query-input"
            type="text"
            className="bairro-in"
            placeholder="Ex.: Freguesia, Anil, Rio das Pedras..."
            aria-label="Digite seu bairro para verificar entrega"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (result) setResult(null);
            }}
            maxLength={60}
          />
          <button type="submit" className="bairro-btn">
            Consultar
          </button>
        </div>
      </form>

      <div id="bairro-res" className="bairro-res" aria-live="polite">
        {result?.status === "short" && (
          <div className="res-box res-short">
            <p>Digite pelo menos 3 letras do bairro.</p>
          </div>
        )}

        {result?.status === "found" && result.matchedBairro && (
          <div className="res-box res-found">
            <p>
              <b>{result.matchedBairro}</b> está na nossa rota de entrega. Combine dia e
              horário pelo WhatsApp.
            </p>
            <div className="res-actions">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-bairro-wa btn-bairro-found"
                onClick={() => trackWhatsAppClick("bairro")}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                Combinar entrega
              </a>
            </div>
          </div>
        )}

        {result?.status === "not_found" && (
          <div className="res-box res-not-found">
            <p>
              <b>{result.query}</b> ainda não está na lista, mas vale perguntar: dependendo do
              pedido, a gente leva.
            </p>
            <div className="res-actions">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-bairro-wa btn-bairro-ask"
                onClick={() => trackWhatsAppClick("bairro")}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                Perguntar no WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>

      {bairros.length > 0 && (
        <div className="bairros-default-wrap">
          <p className="bairros-default-label">Bairros que costumamos atender:</p>
          <ul className="bairros-chips-list">
            {bairros.map((b) => (
              <li key={b} className="bairro-chip">
                <button
                  type="button"
                  className="bairro-chip-btn"
                  onClick={() => {
                    setQuery(b);
                    const normQuery = normalizeText(b);
                    const hit = bairros.find((item) => {
                      const normB = normalizeText(item);
                      return normB.includes(normQuery) || normQuery.includes(normB);
                    });
                    setResult({
                      status: "found",
                      query: b,
                      matchedBairro: hit || b,
                    });
                  }}
                >
                  {b}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
