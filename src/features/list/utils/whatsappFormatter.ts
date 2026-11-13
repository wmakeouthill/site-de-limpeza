export interface WhatsAppListItem {
  id: string;
  nome: string;
  tamanho: string;
  precoAtual: number; // Em reais (ex: 10.50)
  quantidade: number;
}

export interface FormatWhatsAppListOptions {
  lojaNome: string;
  whatsappNumero: string;
  itens: WhatsAppListItem[];
  modalidade: "retirada" | "entrega";
  bairro?: string;
  nomeCliente?: string;
  isEmpresa?: boolean;
}

// Aceita o decimal em texto que vem da API ("9.90") além de número.
export function formatBrl(valor: number | string): string {
  const n = typeof valor === "number" ? valor : Number.parseFloat(valor.replace(",", "."));
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function buildGreeting(lojaNome: string): string {
  const clean = lojaNome.trim();
  const punct = clean.endsWith("!") ? "" : "!";
  return `Olá, ${clean}${punct}`;
}

export function formatWhatsAppListMessage(options: FormatWhatsAppListOptions): string {
  const {
    lojaNome,
    itens,
    modalidade,
    bairro,
    nomeCliente,
    isEmpresa,
  } = options;

  const lines: string[] = [
    `${buildGreeting(lojaNome)} Montei esta lista no site:`,
    "",
  ];

  let totalGeral = 0;

  for (const item of itens) {
    const subtotal = item.precoAtual * item.quantidade;
    totalGeral += subtotal;
    const tamanhoStr = item.tamanho ? ` ${item.tamanho}` : "";
    lines.push(
      `• ${item.quantidade}x ${item.nome}${tamanhoStr} - ${formatBrl(item.precoAtual)} un. = ${formatBrl(subtotal)}`
    );
  }

  lines.push("");
  lines.push(`Total estimado: ${formatBrl(totalGeral)}`);
  lines.push("");

  if (modalidade === "entrega") {
    const bairroFinal = bairro && bairro.trim() ? bairro.trim() : "(meu bairro)";
    lines.push(`Vocês entregam em: ${bairroFinal}?`);
  } else {
    lines.push("Quero retirar na loja. Podem separar?");
  }

  // Nome e/ou compra para empresa
  const hasNome = Boolean(nomeCliente && nomeCliente.trim());
  if (hasNome || isEmpresa) {
    lines.push("");
    if (hasNome && isEmpresa) {
      lines.push(`Nome: ${nomeCliente?.trim()} (Compra para empresa)`);
    } else if (hasNome) {
      lines.push(`Nome: ${nomeCliente?.trim()}`);
    } else if (isEmpresa) {
      lines.push("(Compra para empresa)");
    }
  }

  return lines.join("\n");
}

export function buildWhatsAppLink(whatsappNumero: string, message: string): string {
  const cleanNumber = whatsappNumero.replace(/\D/g, "");
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}
