import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CmsAuthGuard } from "../../components/CmsAuthGuard";
import { CampaignSourceLinksSettings } from "../../components/CampaignSourceLinksSettings/CampaignSourceLinksSettings";
import { CmsShell } from "../../components/CmsShell";
import { useCmsSiteSettings } from "../../hooks/useCmsSiteSettings";
import styles from "./CmsSettingsPage.module.css";

export function CmsSettingsPage() {
  return (
    <CmsAuthGuard>
      <CmsSettingsView />
    </CmsAuthGuard>
  );
}

function CmsSettingsView() {
  const { settings, isLoading, isSaving, errorMessage, save } = useCmsSiteSettings();

  const [lojaNome, setLojaNome] = useState("Falcão Limpeza");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [whatsappNumero, setWhatsappNumero] = useState("5521999999999");
  const [telefoneExibicao, setTelefoneExibicao] = useState("(21) 99999-9999");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [endereco, setEndereco] = useState("Estrada de Jacarepaguá, 5171");
  const [bairroCidade, setBairroCidade] = useState("Anil, Rio de Janeiro - RJ");
  const [referenciaEndereco, setReferenciaEndereco] = useState("pertinho de Rio das Pedras");
  const [mapsUrl, setMapsUrl] = useState("");
  const [horarioObs, setHorarioObs] = useState("");
  const [pagamento, setPagamento] = useState("Dinheiro, Pix, cartões de débito e crédito");
  const [chavePix, setChavePix] = useState("");
  const [prazoSeparacao, setPrazoSeparacao] = useState("Separado em ~30 min");
  const [bairrosEntrega, setBairrosEntrega] = useState<string[]>([]);
  const [novoBairro, setNovoBairro] = useState("");
  const [articlesEnabled, setArticlesEnabled] = useState(true);
  const [guidesEnabled, setGuidesEnabled] = useState(true);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) {
      return;
    }
    setLojaNome(settings.lojaNome ?? "Falcão Limpeza");
    setRazaoSocial(settings.razaoSocial ?? "");
    setCnpj(settings.cnpj ?? "");
    setWhatsappNumero(settings.whatsappNumero ?? "5521999999999");
    setTelefoneExibicao(settings.telefoneExibicao ?? "(21) 99999-9999");
    setInstagramUrl(settings.instagramUrl ?? "");
    setEndereco(settings.endereco ?? "Estrada de Jacarepaguá, 5171");
    setBairroCidade(settings.bairroCidade ?? "Anil, Rio de Janeiro - RJ");
    setReferenciaEndereco(settings.referenciaEndereco ?? "pertinho de Rio das Pedras");
    setMapsUrl(settings.mapsUrl ?? "");
    setHorarioObs(settings.horarioObs ?? "");
    setPagamento(settings.pagamento ?? "Dinheiro, Pix, cartões de débito e crédito");
    setChavePix(settings.chavePix ?? "");
    setPrazoSeparacao(settings.prazoSeparacao ?? "Separado em ~30 min");
    setBairrosEntrega(settings.bairrosEntrega ?? []);
    setArticlesEnabled(settings.articlesEnabled ?? true);
    setGuidesEnabled(settings.guidesEnabled ?? true);
  }, [settings]);

  function handleAddBairro() {
    const trimmed = novoBairro.trim();
    if (!trimmed) return;
    if (bairrosEntrega.some((b) => b.toLowerCase() === trimmed.toLowerCase())) {
      setValidationError(`O bairro "${trimmed}" já está na lista.`);
      return;
    }
    if (trimmed.length > 40) {
      setValidationError("O nome do bairro pode ter no máximo 40 caracteres.");
      return;
    }
    if (bairrosEntrega.length >= 60) {
      setValidationError("Limite de 60 bairros atingido.");
      return;
    }
    setValidationError(null);
    setBairrosEntrega([...bairrosEntrega, trimmed]);
    setNovoBairro("");
  }

  function handleRemoveBairro(index: number) {
    setBairrosEntrega(bairrosEntrega.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    setValidationError(null);

    const waDigits = whatsappNumero.replace(/\D/g, "");
    if (!waDigits.startsWith("55") || waDigits.length < 12 || waDigits.length > 13) {
      setValidationError("WhatsApp deve conter DDI 55 e ter 12 ou 13 dígitos (ex: 5521999999999).");
      return;
    }

    if (mapsUrl && !mapsUrl.trim().startsWith("https://")) {
      setValidationError("O link do Google Maps deve começar com https://");
      return;
    }

    if (instagramUrl && !instagramUrl.trim().startsWith("https://")) {
      setValidationError("O link do Instagram deve começar com https://");
      return;
    }

    const ok = await save({
      loja_nome: lojaNome.trim(),
      razao_social: razaoSocial.trim() || null,
      cnpj: cnpj.trim() || null,
      whatsapp_numero: waDigits,
      telefone_exibicao: telefoneExibicao.trim() || null,
      instagram_url: instagramUrl.trim() || null,
      endereco: endereco.trim(),
      bairro_cidade: bairroCidade.trim(),
      referencia_endereco: referenciaEndereco.trim() || null,
      maps_url: mapsUrl.trim() || null,
      horario_obs: horarioObs.trim() || null,
      pagamento: pagamento.trim(),
      chave_pix: chavePix.trim() || null,
      prazo_separacao: prazoSeparacao.trim() || null,
      bairros_entrega: bairrosEntrega,
      articles_enabled: articlesEnabled,
      guides_enabled: guidesEnabled,
    });

    if (ok) {
      setFeedback("Configurações da loja salvas com sucesso.");
    }
  }

  if (isLoading) {
    return (
      <CmsShell title="Dados da Loja" crumb="Configurações" searchPlaceholder="Buscar configuração">
        <main className={styles.page}>
          <p className={styles.state}>Carregando dados da loja...</p>
        </main>
      </CmsShell>
    );
  }

  return (
    <CmsShell title="Dados da Loja" crumb="Configurações" searchPlaceholder="Buscar configuração">
      <main className={styles.page}>
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Seção 1: Identificação */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2>Identificação da Loja</h2>
              <p>Nome de marca exibido no cabeçalho, rodapé e títulos do site.</p>
            </div>
            <div className={styles.fieldGrid}>
              <div className={styles.fieldGroup}>
                <label htmlFor="lojaNome">Nome da loja *</label>
                <input
                  id="lojaNome"
                  className={styles.input}
                  value={lojaNome}
                  maxLength={40}
                  onChange={(e) => setLojaNome(e.target.value)}
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="razaoSocial">Razão social</label>
                <input
                  id="razaoSocial"
                  className={styles.input}
                  value={razaoSocial}
                  maxLength={120}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="cnpj">CNPJ</label>
                <input
                  id="cnpj"
                  className={styles.input}
                  value={cnpj}
                  maxLength={20}
                  onChange={(e) => setCnpj(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Seção 2: Contato & WhatsApp */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2>Contato & WhatsApp</h2>
              <p>O número de WhatsApp recebe as listas e cotações dos clientes diretamente.</p>
            </div>
            <div className={styles.fieldGrid}>
              <div className={styles.fieldGroup}>
                <label htmlFor="whatsappNumero">WhatsApp (só dígitos com DDI 55) *</label>
                <input
                  id="whatsappNumero"
                  className={styles.input}
                  value={whatsappNumero}
                  placeholder="5521999999999"
                  maxLength={20}
                  onChange={(e) => setWhatsappNumero(e.target.value)}
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="telefoneExibicao">Telefone de exibição no site</label>
                <input
                  id="telefoneExibicao"
                  className={styles.input}
                  value={telefoneExibicao}
                  placeholder="(21) 99999-9999"
                  maxLength={20}
                  onChange={(e) => setTelefoneExibicao(e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="instagramUrl">Instagram (link completo https://)</label>
                <input
                  id="instagramUrl"
                  type="url"
                  className={styles.input}
                  value={instagramUrl}
                  placeholder="https://instagram.com/falcaolimpeza"
                  maxLength={500}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Seção 3: Endereço & Localização */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2>Endereço & Atendimento Físico</h2>
              <p>Informações de localização da loja física em Jacarepaguá / Anil.</p>
            </div>
            <div className={styles.fieldGrid}>
              <div className={styles.fieldGroup}>
                <label htmlFor="endereco">Endereço completo *</label>
                <input
                  id="endereco"
                  className={styles.input}
                  value={endereco}
                  maxLength={120}
                  onChange={(e) => setEndereco(e.target.value)}
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="bairroCidade">Bairro e Cidade *</label>
                <input
                  id="bairroCidade"
                  className={styles.input}
                  value={bairroCidade}
                  maxLength={60}
                  onChange={(e) => setBairroCidade(e.target.value)}
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="referenciaEndereco">Ponto de referência</label>
                <input
                  id="referenciaEndereco"
                  className={styles.input}
                  value={referenciaEndereco}
                  maxLength={80}
                  onChange={(e) => setReferenciaEndereco(e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="mapsUrl">Google Maps link (https://)</label>
                <input
                  id="mapsUrl"
                  type="url"
                  className={styles.input}
                  value={mapsUrl}
                  placeholder="https://maps.google.com/?q=..."
                  maxLength={500}
                  onChange={(e) => setMapsUrl(e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="horarioObs">Observação de horário (ex: feriados)</label>
                <input
                  id="horarioObs"
                  className={styles.input}
                  value={horarioObs}
                  placeholder="Feriados: 8h às 13h"
                  maxLength={80}
                  onChange={(e) => setHorarioObs(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Seção 4: Pagamento & Separação */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2>Pagamento & Separação</h2>
              <p>Formas de pagamento e prazo estimado para retirada ou envio.</p>
            </div>
            <div className={styles.fieldGrid}>
              <div className={styles.fieldGroup}>
                <label htmlFor="pagamento">Formas de pagamento *</label>
                <input
                  id="pagamento"
                  className={styles.input}
                  value={pagamento}
                  maxLength={160}
                  onChange={(e) => setPagamento(e.target.value)}
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="chavePix">Chave Pix da loja</label>
                <input
                  id="chavePix"
                  className={styles.input}
                  value={chavePix}
                  maxLength={100}
                  onChange={(e) => setChavePix(e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="prazoSeparacao">Prazo de separação (vazio esconde)</label>
                <input
                  id="prazoSeparacao"
                  className={styles.input}
                  value={prazoSeparacao}
                  placeholder="Separado em ~30 min"
                  maxLength={40}
                  onChange={(e) => setPrazoSeparacao(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Seção 5: Bairros de Entrega */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2>Bairros de Entrega e Rota</h2>
              <p>Bairros atendidos pela rota de entregas da loja (usados no verificador de CEP/Bairro).</p>
            </div>
            <div className={styles.bairroInputRow}>
              <input
                type="text"
                className={styles.input}
                placeholder="Ex: Rio das Pedras, Freguesia, Anil..."
                value={novoBairro}
                maxLength={40}
                onChange={(e) => setNovoBairro(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddBairro();
                  }
                }}
              />
              <button type="button" className={styles.addButton} onClick={handleAddBairro}>
                <Plus size={16} />
                Adicionar bairro
              </button>
            </div>
            <div className={styles.tagsContainer}>
              {bairrosEntrega.map((bairro, idx) => (
                <span key={idx} className={styles.tagBadge}>
                  {bairro}
                  <button
                    type="button"
                    className={styles.tagRemoveBtn}
                    onClick={() => handleRemoveBairro(idx)}
                    aria-label={`Remover ${bairro}`}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              {bairrosEntrega.length === 0 && (
                <p className={styles.state}>Nenhum bairro cadastrado ainda.</p>
              )}
            </div>
          </section>

          {/* Seção 6: Módulos do Site */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2>Módulos do Site</h2>
              <p>Ativação das seções de conteúdo editorial no site público.</p>
            </div>
            <label className={styles.toggleRow}>
              <span className={styles.toggleLabel}>
                Dicas e Artigos de Limpeza — {articlesEnabled ? "ativados" : "desativados"}
              </span>
              <span className={styles.switch}>
                <input
                  type="checkbox"
                  checked={articlesEnabled}
                  onChange={(e) => setArticlesEnabled(e.target.checked)}
                />
                <span className={styles.slider} aria-hidden="true" />
              </span>
            </label>
            <label className={styles.toggleRow}>
              <span className={styles.toggleLabel}>
                Guias Práticos de Limpeza — {guidesEnabled ? "ativados" : "desativados"}
              </span>
              <span className={styles.switch}>
                <input
                  type="checkbox"
                  checked={guidesEnabled}
                  onChange={(e) => setGuidesEnabled(e.target.checked)}
                />
                <span className={styles.slider} aria-hidden="true" />
              </span>
            </label>
          </section>

          <CampaignSourceLinksSettings />

          {validationError ? <p className={styles.error}>{validationError}</p> : null}
          {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
          {feedback ? <p className={styles.success}>{feedback}</p> : null}

          <div className={styles.actions}>
            <button type="submit" className={styles.saveButton} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar configurações"}
            </button>
          </div>
        </form>
      </main>
    </CmsShell>
  );
}
