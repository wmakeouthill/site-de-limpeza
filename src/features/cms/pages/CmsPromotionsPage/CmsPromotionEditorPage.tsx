import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Monitor, Save, Smartphone, Sparkles } from "lucide-react";
import { CmsShell } from "../../components/CmsShell";
import {
  createCmsPromocao,
  getCmsPromocao,
  updateCmsPromocao,
} from "../../services/cmsPromotions.service";
import type {
  CmsPromocaoPayload,
  PromocaoFrequencia,
  PromocaoPublico,
  PromocaoTipoAcao,
} from "../../types/cms.types";
import { CmsPromotionPreview } from "./CmsPromotionPreview";
import styles from "./CmsPromotionsPage.module.css";

function toDatetimeLocal(isoOrDateString?: string): string {
  if (!isoOrDateString) return "";
  try {
    const d = new Date(isoOrDateString);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  } catch {
    return "";
  }
}

export function CmsPromotionEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id && id !== "novo");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [tipoAcao, setTipoAcao] = useState<PromocaoTipoAcao>("aviso");
  const [ctaTexto, setCtaTexto] = useState("");
  const [ctaCaminho, setCtaCaminho] = useState("");
  const [codigoCupom, setCodigoCupom] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [whatsappMensagem, setWhatsappMensagem] = useState("");
  const [publico, setPublico] = useState<PromocaoPublico>("todos");
  const [frequencia, setFrequencia] = useState<PromocaoFrequencia>("uma_vez");
  const [dataInicio, setDataInicio] = useState(() => {
    const now = new Date();
    return toDatetimeLocal(now.toISOString());
  });
  const [dataFim, setDataFim] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return toDatetimeLocal(nextWeek.toISOString());
  });
  const [prioridade, setPrioridade] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Preview state
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    if (!isEditing || !id) return;
    async function load() {
      try {
        setLoading(true);
        const data = await getCmsPromocao(id!);
        setTitulo(data.titulo);
        setTexto(data.texto || "");
        setImagemUrl(data.imagem_url || "");
        setTipoAcao(data.tipo_acao);
        setCtaTexto(data.cta_texto || "");
        setCtaCaminho(data.cta_caminho || "");
        setCodigoCupom(data.codigo_cupom || "");
        setProdutoId(data.produto_id || "");
        setWhatsappMensagem(data.whatsapp_mensagem || "");
        setPublico(data.publico);
        setFrequencia(data.frequencia);
        setDataInicio(toDatetimeLocal(data.data_inicio));
        setDataFim(toDatetimeLocal(data.data_fim));
        setPrioridade(data.prioridade ?? 0);
        setIsActive(data.is_active);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Erro ao carregar promoção");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, isEditing]);

  function validate(): string | null {
    if (!titulo.trim()) {
      return "O título da promoção é obrigatório.";
    }
    if (titulo.length > 120) {
      return "O título deve ter no máximo 120 caracteres.";
    }
    if (!dataInicio) {
      return "Informe a data de início da promoção.";
    }
    if (!dataFim) {
      return "Informe a data de término da promoção.";
    }
    if (new Date(dataFim) < new Date(dataInicio)) {
      return "A data de término deve ser igual ou posterior à data de início.";
    }

    if (tipoAcao === "link") {
      const c = ctaCaminho.trim();
      if (!c) {
        return "Informe o caminho interno do link.";
      }
      // Validação estrita CA-17
      if (!c.startsWith("/") || c.startsWith("//") || c.includes("\\") || c.includes(":")) {
        return "O caminho do link deve ser relativo interno iniciando com '/' (sem URLs externas como http:// ou //).";
      }
    }

    if (tipoAcao === "cupom") {
      const cup = codigoCupom.trim();
      if (!cup) {
        return "Informe o código do cupom.";
      }
      if (cup.includes(" ")) {
        return "O código do cupom não pode conter espaços.";
      }
    }

    if (tipoAcao === "produto") {
      if (!produtoId.trim()) {
        return "Informe o identificador do produto.";
      }
    }

    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const error = validate();
    if (error) {
      setErrorMsg(error);
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    const payload: CmsPromocaoPayload = {
      titulo: titulo.trim(),
      texto: texto.trim() || null,
      imagem_url: imagemUrl.trim() || null,
      tipo_acao: tipoAcao,
      cta_texto: ctaTexto.trim() || null,
      cta_caminho: tipoAcao === "link" ? ctaCaminho.trim() : null,
      codigo_cupom: tipoAcao === "cupom" ? codigoCupom.trim() : null,
      produto_id: tipoAcao === "produto" ? produtoId.trim() : null,
      whatsapp_mensagem: whatsappMensagem.trim() || null,
      publico,
      frequencia,
      data_inicio: new Date(dataInicio).toISOString(),
      data_fim: new Date(dataFim).toISOString(),
      prioridade: Number(prioridade) || 0,
      is_active: isActive,
    };

    try {
      if (isEditing && id) {
        await updateCmsPromocao(id, payload);
      } else {
        await createCmsPromocao(payload);
      }
      navigate("/cms/promocoes");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao salvar promoção");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CmsShell
      title={isEditing ? "Editar Promoção" : "Nova Promoção"}
      crumb={isEditing ? "Promoções / Editar" : "Promoções / Nova"}
    >
      <div className={styles.container}>
        <div className={styles.topBar}>
          <Link to="/cms/promocoes" className={styles.backLink}>
            <ArrowLeft size={16} /> Voltar para promoções
          </Link>
        </div>

        {errorMsg && (
          <div className={styles.errorAlert} role="alert" data-testid="error-alert">
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div className={styles.loadingBox}>Carregando promoção...</div>
        ) : (
          <div className={styles.editorLayout}>
            {/* Formulário */}
            <form onSubmit={handleSubmit} className={styles.editorForm} noValidate>
              <div className={styles.card}>
                <h3 className={styles.sectionTitle}>Conteúdo do Popup</h3>

                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label htmlFor="promo-titulo">
                      Título da Promoção <span className={styles.required}>*</span>
                    </label>
                    <input
                      id="promo-titulo"
                      type="text"
                      className={styles.input}
                      maxLength={120}
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ex: 10% OFF na Primeira Compra"
                      required
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="promo-texto">Texto / Descrição</label>
                    <textarea
                      id="promo-texto"
                      className={styles.textarea}
                      maxLength={500}
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder="Apresente os detalhes do aviso ou da oferta..."
                      rows={3}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="promo-imagem">URL da Imagem de Destaque (opcional)</label>
                    <input
                      id="promo-imagem"
                      type="text"
                      className={styles.input}
                      value={imagemUrl}
                      onChange={(e) => setImagemUrl(e.target.value)}
                      placeholder="https://... ou /assets/..."
                    />
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <h3 className={styles.sectionTitle}>Ação e CTA</h3>

                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label htmlFor="promo-tipo-acao">Tipo de Ação</label>
                    <select
                      id="promo-tipo-acao"
                      className={styles.select}
                      value={tipoAcao}
                      onChange={(e) => setTipoAcao(e.target.value as PromocaoTipoAcao)}
                    >
                      <option value="aviso">Apenas Aviso (Informativo)</option>
                      <option value="link">Link Interno (Redirecionamento)</option>
                      <option value="cupom">Cupom de Desconto</option>
                      <option value="produto">Destacar Produto</option>
                    </select>
                  </div>

                  {tipoAcao === "link" && (
                    <div className={styles.field}>
                      <label htmlFor="promo-caminho">
                        Caminho Interno <span className={styles.required}>*</span>
                      </label>
                      <input
                        id="promo-caminho"
                        type="text"
                        className={styles.input}
                        value={ctaCaminho}
                        onChange={(e) => setCtaCaminho(e.target.value)}
                        placeholder="Ex: /produtos ou /empresas"
                        required
                      />
                      <span className={styles.helperText}>
                        Deve ser relativo e iniciar com barra (ex: /produtos). Links externos são proibidos por segurança.
                      </span>
                    </div>
                  )}

                  {tipoAcao === "cupom" && (
                    <div className={styles.field}>
                      <label htmlFor="promo-cupom">
                        Código do Cupom <span className={styles.required}>*</span>
                      </label>
                      <input
                        id="promo-cupom"
                        type="text"
                        className={styles.input}
                        value={codigoCupom}
                        onChange={(e) => setCodigoCupom(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                        placeholder="Ex: BEMVINDO10"
                        required
                      />
                    </div>
                  )}

                  {tipoAcao === "produto" && (
                    <div className={styles.field}>
                      <label htmlFor="promo-produto-id">
                        ID ou Slug do Produto <span className={styles.required}>*</span>
                      </label>
                      <input
                        id="promo-produto-id"
                        type="text"
                        className={styles.input}
                        value={produtoId}
                        onChange={(e) => setProdutoId(e.target.value)}
                        placeholder="Ex: detergente-neutro-5l"
                        required
                      />
                    </div>
                  )}

                  <div className={styles.formRow}>
                    <div className={styles.field}>
                      <label htmlFor="promo-cta-texto">Texto do Botão (CTA)</label>
                      <input
                        id="promo-cta-texto"
                        type="text"
                        className={styles.input}
                        maxLength={60}
                        value={ctaTexto}
                        onChange={(e) => setCtaTexto(e.target.value)}
                        placeholder="Ex: Aproveitar oferta"
                      />
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="promo-whatsapp">Mensagem WhatsApp (opcional)</label>
                      <input
                        id="promo-whatsapp"
                        type="text"
                        className={styles.input}
                        maxLength={300}
                        value={whatsappMensagem}
                        onChange={(e) => setWhatsappMensagem(e.target.value)}
                        placeholder="Ex: Quero usar o cupom no meu pedido"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <h3 className={styles.sectionTitle}>Regras de Exibição e Público</h3>

                <div className={styles.formGrid}>
                  <div className={styles.formRow}>
                    <div className={styles.field}>
                      <label htmlFor="promo-publico">Público-Alvo</label>
                      <select
                        id="promo-publico"
                        className={styles.select}
                        value={publico}
                        onChange={(e) => setPublico(e.target.value as PromocaoPublico)}
                      >
                        <option value="todos">Todos os Visitantes</option>
                        <option value="casa">Apenas Casa</option>
                        <option value="empresa">Apenas Empresa</option>
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="promo-frequencia">Frequência de Exibição</label>
                      <select
                        id="promo-frequencia"
                        className={styles.select}
                        value={frequencia}
                        onChange={(e) => setFrequencia(e.target.value as PromocaoFrequencia)}
                      >
                        <option value="uma_vez">Uma vez (nunca mais após fechar)</option>
                        <option value="diaria">Diária (no máximo uma vez por dia)</option>
                        <option value="sempre">Toda nova sessão</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.field}>
                      <label htmlFor="promo-inicio">
                        Data e Hora de Início <span className={styles.required}>*</span>
                      </label>
                      <input
                        id="promo-inicio"
                        type="datetime-local"
                        className={styles.input}
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        required
                      />
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="promo-fim">
                        Data e Hora de Término <span className={styles.required}>*</span>
                      </label>
                      <input
                        id="promo-fim"
                        type="datetime-local"
                        className={styles.input}
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.field}>
                      <label htmlFor="promo-prioridade">
                        Prioridade de Desempate (quanto maior, mais prioritário)
                      </label>
                      <input
                        id="promo-prioridade"
                        type="number"
                        className={styles.input}
                        value={prioridade}
                        onChange={(e) => setPrioridade(parseInt(e.target.value, 10) || 0)}
                      />
                    </div>

                    <div className={`${styles.field} ${styles.checkboxField}`}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                        />
                        <span>Promoção Ativa</span>
                      </label>
                      <span className={styles.helperText}>
                        Desmarque para suspender a exibição imediatamente.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.formActions}>
                <Link to="/cms/promocoes" className={styles.cancelBtn}>
                  Cancelar
                </Link>
                <button
                  type="submit"
                  className={styles.saveBtn}
                  disabled={submitting}
                >
                  <Save size={16} />
                  <span>{submitting ? "Salvando..." : "Salvar Promoção"}</span>
                </button>
              </div>
            </form>

            {/* Painel de Prévia */}
            <div className={styles.previewPanel}>
              <div className={styles.previewHeader}>
                <div className={styles.previewTitle}>
                  <Sparkles size={16} />
                  <span>Prévia em Tempo Real</span>
                </div>
                <div className={styles.deviceSwitch}>
                  <button
                    type="button"
                    className={`${styles.deviceBtn} ${
                      previewDevice === "desktop" ? styles.deviceActive : ""
                    }`}
                    onClick={() => setPreviewDevice("desktop")}
                    title="Visualizar em Desktop"
                  >
                    <Monitor size={16} /> Desktop
                  </button>
                  <button
                    type="button"
                    className={`${styles.deviceBtn} ${
                      previewDevice === "mobile" ? styles.deviceActive : ""
                    }`}
                    onClick={() => setPreviewDevice("mobile")}
                    title="Visualizar em Celular"
                  >
                    <Smartphone size={16} /> Mobile
                  </button>
                </div>
              </div>

              <div className={styles.previewBox}>
                <CmsPromotionPreview
                  titulo={titulo}
                  texto={texto}
                  imagem_url={imagemUrl}
                  tipo_acao={tipoAcao}
                  cta_texto={ctaTexto}
                  cta_caminho={ctaCaminho}
                  codigo_cupom={codigoCupom}
                  publico={publico}
                  device={previewDevice}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </CmsShell>
  );
}
