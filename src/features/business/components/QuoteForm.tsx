import React, { useRef, useState } from "react";
import "./QuoteForm.css";
import { buildGreeting } from "@/features/list/utils/whatsappFormatter";
import { trackWhatsAppClick } from "@/features/analytics/services/trackEvent";

export interface QuoteFormProps {
  lojaNome?: string;
  whatsappNumero?: string;
}

export interface QuoteFormData {
  empresa: string;
  cnpj: string;
  segmento: string;
  bairro: string;
  frequencia: string;
  itens: string;
}

export function formatQuoteWhatsAppMessage(
  data: QuoteFormData,
  lojaNome = "Falcão Limpeza"
): string {
  const greeting = buildGreeting(lojaNome);
  const lines: string[] = [
    `${greeting} Quero uma cotação para empresa.`,
    "",
    `Empresa: ${data.empresa.trim()}`,
  ];

  if (data.cnpj.trim()) {
    lines.push(`CNPJ: ${data.cnpj.trim()}`);
  }

  lines.push(`Segmento: ${data.segmento.trim()}`);

  if (data.bairro.trim()) {
    lines.push(`Bairro: ${data.bairro.trim()}`);
  }

  lines.push(`Frequência: ${data.frequencia.trim()}`);

  if (data.itens.trim()) {
    lines.push("");
    lines.push("Preciso de:");
    lines.push(data.itens.trim());
  }

  return lines.join("\n");
}

export function QuoteForm({
  lojaNome = "Falcão Limpeza",
  whatsappNumero = "5521999999999",
}: QuoteFormProps) {
  const empresaInputRef = useRef<HTMLInputElement>(null);

  const [empresa, setEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [segmento, setSegmento] = useState("Condomínio");
  const [bairro, setBairro] = useState("");
  const [frequencia, setFrequencia] = useState("Compra única");
  const [itens, setItens] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [readyMessage, setReadyMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!empresa.trim()) {
      setErrorMessage("Diga o nome da empresa pra gente saber com quem fala.");
      setReadyMessage(null);
      if (empresaInputRef.current) {
        empresaInputRef.current.focus();
      }
      return;
    }

    setErrorMessage("");

    const msg = formatQuoteWhatsAppMessage(
      { empresa, cnpj, segmento, bairro, frequencia, itens },
      lojaNome
    );
    setReadyMessage(msg);
  }

  function handleSendWhatsApp() {
    if (!readyMessage) return;

    // Dispara analytics com target canônico (CA-23 / LGPD)
    trackWhatsAppClick("cotacao");

    const cleanNumber = whatsappNumero.replace(/\D/g, "");
    const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(readyMessage)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  async function handleCopy() {
    if (!readyMessage) return;
    try {
      await navigator.clipboard.writeText(readyMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  }

  return (
    <form className="cot-form" onSubmit={handleSubmit} noValidate>
      <div className="cot-stack">
        <p className="eyebrow">Cotação</p>
        <h2 className="cot-title">Peça uma cotação pelo WhatsApp</h2>
        <p className="cot-muted">
          Preencha o básico; a mensagem fica pronta pra você enviar sem compromisso.
        </p>
      </div>

      <div className="cot-grid">
        <div className="cot-field">
          <label htmlFor="quote-empresa">Empresa *</label>
          <input
            ref={empresaInputRef}
            id="quote-empresa"
            name="empresa"
            className="cot-in"
            type="text"
            maxLength={80}
            autoComplete="organization"
            placeholder="Nome fantasia ou razão social"
            value={empresa}
            onChange={(e) => {
              setEmpresa(e.target.value);
              if (errorMessage) setErrorMessage("");
            }}
            aria-invalid={!!errorMessage}
            aria-describedby={errorMessage ? "quote-empresa-error" : undefined}
          />
        </div>

        <div className="cot-field">
          <label htmlFor="quote-cnpj">
            CNPJ <small>(opcional)</small>
          </label>
          <input
            id="quote-cnpj"
            name="cnpj"
            className="cot-in"
            type="text"
            maxLength={20}
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
          />
        </div>

        <div className="cot-field">
          <label htmlFor="quote-segmento">Segmento</label>
          <select
            id="quote-segmento"
            name="segmento"
            className="cot-in"
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
          >
            <option value="Condomínio">Condomínio</option>
            <option value="Restaurante ou lanchonete">Restaurante ou lanchonete</option>
            <option value="Salão ou clínica">Salão ou clínica</option>
            <option value="Escritório">Escritório</option>
            <option value="Comércio">Comércio</option>
            <option value="Outro">Outro</option>
          </select>
        </div>

        <div className="cot-field">
          <label htmlFor="quote-bairro">
            Bairro <small>(opcional)</small>
          </label>
          <input
            id="quote-bairro"
            name="bairro"
            className="cot-in"
            type="text"
            maxLength={60}
            placeholder="Ex.: Anil, Barra, Freguesia..."
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
          />
        </div>

        <div className="cot-field">
          <label htmlFor="quote-frequencia">Frequência</label>
          <select
            id="quote-frequencia"
            name="frequencia"
            className="cot-in"
            value={frequencia}
            onChange={(e) => setFrequencia(e.target.value)}
          >
            <option value="Compra única">Compra única</option>
            <option value="Toda semana">Toda semana</option>
            <option value="A cada 15 dias">A cada 15 dias</option>
            <option value="Todo mês">Todo mês</option>
          </select>
        </div>

        <div className="cot-field cot-field-full">
          <label htmlFor="quote-itens">
            Do que você precisa? <small>(opcional)</small>
          </label>
          <textarea
            id="quote-itens"
            name="itens"
            className="cot-in cot-textarea"
            maxLength={800}
            placeholder="Ex.: 4 galões de hipoclorito, 2 de desinfetante, 2 rodos G..."
            value={itens}
            onChange={(e) => setItens(e.target.value)}
          />
        </div>
      </div>

      {errorMessage && (
        <p id="quote-empresa-error" className="cot-err" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="cot-actions">
        <button type="submit" className="btn-montar-msg">
          Montar mensagem
        </button>
      </div>

      {readyMessage && (
        <div className="cot-preview-box" aria-live="polite">
          <p className="cot-preview-heading">
            <b>Mensagem pronta.</b> Confira o texto que será enviado:
          </p>
          <pre className="cot-preview-text">{readyMessage}</pre>
          <div className="cot-preview-actions">
            <button
              type="button"
              className="btn-send-quote-wa"
              onClick={handleSendWhatsApp}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              Enviar no WhatsApp
            </button>
            <button
              type="button"
              className="btn-copy-quote-msg"
              onClick={handleCopy}
            >
              {copied ? "Copiado!" : "Copiar mensagem"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
