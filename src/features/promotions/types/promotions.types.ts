export interface PublicPromocaoRead {
  id: string;
  titulo: string;
  texto?: string | null;
  imagem_url?: string | null;
  tipo_acao: "cupom" | "link" | "aviso" | "produto";
  produto_id?: string | null;
  cta_texto?: string | null;
  cta_caminho?: string | null;
  codigo_cupom?: string | null;
  whatsapp_mensagem?: string | null;
  publico: "todos" | "casa" | "empresa";
  frequencia: "uma_vez" | "diaria" | "sempre";
  prioridade: number;
  data_inicio: string;
  data_fim: string;
}
