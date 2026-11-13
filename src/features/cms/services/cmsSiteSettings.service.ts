import { requestCmsJson } from "./cmsApi.service";

export interface HorarioFuncionamentoDto {
  dias_semana: number[]; // 0 = dom, ..., 6 = sab
  abre: string; // "HH:MM"
  fecha: string; // "HH:MM"
}

export interface CmsSiteSettings {
  lojaNome: string;
  razaoSocial?: string | null;
  cnpj?: string | null;
  whatsappNumero: string;
  telefoneExibicao?: string | null;
  endereco: string;
  bairroCidade: string;
  referenciaEndereco?: string | null;
  mapsUrl?: string | null;
  horarios: HorarioFuncionamentoDto[];
  horarioObs?: string | null;
  pagamento: string;
  chavePix?: string | null;
  bairrosEntrega: string[];
  prazoSeparacao?: string | null;
  instagramUrl?: string | null;
  articlesEnabled: boolean;
  guidesEnabled: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CmsSiteSettingsUpdate {
  loja_nome?: string;
  razao_social?: string | null;
  cnpj?: string | null;
  whatsapp_numero?: string;
  telefone_exibicao?: string | null;
  endereco?: string;
  bairro_cidade?: string;
  referencia_endereco?: string | null;
  maps_url?: string | null;
  horarios?: HorarioFuncionamentoDto[];
  horario_obs?: string | null;
  pagamento?: string;
  chave_pix?: string | null;
  bairros_entrega?: string[];
  prazo_separacao?: string | null;
  instagram_url?: string | null;
  articles_enabled?: boolean | { falcao?: boolean };
  guides_enabled?: boolean;
}

interface CmsSiteSettingsResponse {
  loja_nome?: string;
  razao_social?: string | null;
  cnpj?: string | null;
  whatsapp_numero?: string;
  telefone_exibicao?: string | null;
  endereco?: string;
  bairro_cidade?: string;
  referencia_endereco?: string | null;
  maps_url?: string | null;
  horarios?: HorarioFuncionamentoDto[];
  horario_obs?: string | null;
  pagamento?: string;
  chave_pix?: string | null;
  bairros_entrega?: string[];
  prazo_separacao?: string | null;
  instagram_url?: string | null;
  articles_enabled?: boolean | { falcao?: boolean };
  guides_enabled?: boolean;
  updated_at?: string;
  updated_by?: string;
}

export async function getCmsSiteSettings(): Promise<CmsSiteSettings> {
  const response = await requestCmsJson<CmsSiteSettingsResponse>("/api/cms/site-settings");
  return toCmsSiteSettings(response);
}

export async function updateCmsSiteSettings(
  payload: CmsSiteSettingsUpdate,
): Promise<CmsSiteSettings> {
  const response = await requestCmsJson<CmsSiteSettingsResponse>("/api/cms/site-settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return toCmsSiteSettings(response);
}

function toCmsSiteSettings(response: CmsSiteSettingsResponse): CmsSiteSettings {
  const articlesBool =
    typeof response.articles_enabled === "object"
      ? Boolean(response.articles_enabled?.falcao ?? true)
      : Boolean(response.articles_enabled ?? true);

  return {
    lojaNome: response.loja_nome || "Falcão Limpeza",
    razaoSocial: response.razao_social || "",
    cnpj: response.cnpj || "",
    whatsappNumero: response.whatsapp_numero || "5521999999999",
    telefoneExibicao: response.telefone_exibicao || "(21) 99999-9999",
    endereco: response.endereco || "Estrada de Jacarepaguá, 5171",
    bairroCidade: response.bairro_cidade || "Anil, Rio de Janeiro - RJ",
    referenciaEndereco: response.referencia_endereco || "pertinho de Rio das Pedras",
    mapsUrl: response.maps_url || "",
    horarios: response.horarios || [],
    horarioObs: response.horario_obs || "",
    pagamento: response.pagamento || "Dinheiro, Pix, cartões de débito e crédito",
    chavePix: response.chave_pix || "",
    bairrosEntrega: response.bairros_entrega || [],
    prazoSeparacao: response.prazo_separacao || "Separado em ~30 min",
    instagramUrl: response.instagram_url || "",
    articlesEnabled: articlesBool,
    guidesEnabled: response.guides_enabled ?? true,
    updatedAt: response.updated_at,
    updatedBy: response.updated_by,
  };
}
