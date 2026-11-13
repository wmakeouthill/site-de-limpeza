import { Eye, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { fotoStyle, gravarPosicao, lerPosicao } from "@/features/catalog/utils/productPhoto";
import { CmsShell } from "../../components/CmsShell";
import {
  createCmsProduto,
  getCmsProduto,
  listCmsDepartamentos,
  updateCmsProduto,
} from "../../services/cmsCatalog.service";
import { uploadCmsImage } from "../../services/cmsUpload.service";
import type { CmsDepartamento, CmsProdutoPayload } from "../../types/cms.types";
import styles from "./CmsProductEditorPage.module.css";
import { type Enquadramento, ProductPhotoDialog } from "./ProductPhotoDialog";

const SEM_ENQUADRAMENTO: Enquadramento = { posicao: "50% 50%", zoom: 100 };
const LIMITE_UPLOAD = 5 * 1024 * 1024;

// O upload aceita até 5 MB e foto de celular costuma passar disso: reduz no navegador
// (o backend ainda converte para WebP de 1080 px).
async function caberNoLimite(file: File): Promise<File> {
  if (file.size <= LIMITE_UPLOAD) return file;
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível reduzir a foto. Use uma imagem de até 5 MB.");
  ctx.fillStyle = "#fff"; // PNG transparente não vira fundo preto no JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.9));
  if (!blob) throw new Error("Não foi possível reduzir a foto. Use uma imagem de até 5 MB.");
  return new File([blob], `${file.name.replace(/\.\w+$/, "")}.jpg`, { type: "image/jpeg" });
}

const FORMAS = [
  { value: "garrafa", label: "Garrafa" },
  { value: "galao", label: "Galão" },
  { value: "spray", label: "Spray" },
  { value: "deterg", label: "Detergente" },
  { value: "esponja", label: "Esponja" },
  { value: "caixa", label: "Caixa" },
  { value: "rolo", label: "Rolo" },
  { value: "saco", label: "Saco" },
  { value: "pano", label: "Pano" },
  { value: "rodo", label: "Rodo" },
  { value: "balde", label: "Balde" },
];

export function CmsProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id && id !== "novo");
  const navigate = useNavigate();

  const [departamentos, setDepartamentos] = useState<CmsDepartamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [deptId, setDeptId] = useState("");
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [marca, setMarca] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [precoDe, setPrecoDe] = useState("");
  const [precoPor, setPrecoPor] = useState("");
  const [promoInicio, setPromoInicio] = useState("");
  const [promoFim, setPromoFim] = useState("");
  const [forma, setForma] = useState("garrafa");
  const [cor, setCor] = useState("#003399");
  const [embalagemGrande, setEmbalagemGrande] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [comoUsar, setComoUsar] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Foto: a URL publicada + enquadramento. Arquivo novo só sobe ao salvar no modal.
  const [imagemUrl, setImagemUrl] = useState("");
  const [enquadramento, setEnquadramento] = useState<Enquadramento>(SEM_ENQUADRAMENTO);
  const [arquivo, setArquivo] = useState<{ file: File; url: string } | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvandoFoto, setSalvandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [avisoFoto, setAvisoFoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Libera o object URL do arquivo descartado (ou ao sair da tela).
  useEffect(() => () => {
    if (arquivo) URL.revokeObjectURL(arquivo.url);
  }, [arquivo]);

  useEffect(() => {
    async function init() {
      try {
        const depts = await listCmsDepartamentos();
        setDepartamentos(depts);
        if (!isEditing && depts.length > 0) {
          setDeptId(depts[0].id);
        }

        if (isEditing && id) {
          const prod = await getCmsProduto(id);
          setDeptId(prod.departamento_id);
          setNome(prod.nome);
          setSlug(prod.slug);
          setMarca(prod.marca || "");
          setTamanho(prod.tamanho || "");
          setPrecoDe(prod.preco_de);
          setPrecoPor(prod.preco_por || "");
          setPromoInicio(prod.promo_inicio || "");
          setPromoFim(prod.promo_fim || "");
          setForma(prod.forma || "garrafa");
          setCor(prod.cor || "#003399");
          setEmbalagemGrande(prod.embalagem_grande);
          setDescricao(prod.descricao || "");
          setComoUsar(prod.como_usar || "");
          setIsActive(prod.is_active);
          setImagemUrl(prod.imagem_url || "");
          setEnquadramento({
            posicao: gravarPosicao(...lerPosicao(prod.imagem_posicao)),
            zoom: prod.imagem_zoom || 100,
          });
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [id, isEditing]);

  // Cálculos dinâmicos para live preview
  const numDe = parseFloat(precoDe.replace(",", ".")) || 0;
  const numPor = parseFloat(precoPor.replace(",", ".")) || 0;
  const hasPromo = numPor > 0 && numPor < numDe;
  const discountPct = hasPromo ? Math.floor(((numDe - numPor) / numDe) * 100) : 0;
  const promoInvalid = numPor > 0 && numPor >= numDe;
  const missingPromoEnd = numPor > 0 && !promoFim;

  const currentDept = departamentos.find((d) => d.id === deptId);
  const tinta = { "--c": cor } as React.CSSProperties;
  const estiloFoto = fotoStyle(enquadramento.posicao, enquadramento.zoom);

  function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setArquivo({ file, url: URL.createObjectURL(file) });
    setErroFoto(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setArquivo(null);
    setErroFoto(null);
  }

  async function salvarFoto(novo: Enquadramento) {
    setSalvandoFoto(true);
    setErroFoto(null);
    try {
      const url = arquivo ? (await uploadCmsImage(await caberNoLimite(arquivo.file))).url : imagemUrl;
      if (isEditing && id) {
        await updateCmsProduto(id, { imagem_url: url, imagem_posicao: novo.posicao, imagem_zoom: novo.zoom });
      }
      setImagemUrl(url);
      setEnquadramento(novo);
      setAvisoFoto(isEditing ? "Foto salva no site." : "Foto pronta: salve o produto para publicar.");
      fecharModal();
    } catch (err) {
      setErroFoto(err instanceof Error ? err.message : "Falha ao salvar a foto.");
    } finally {
      setSalvandoFoto(false);
    }
  }

  async function removerFoto() {
    if (!window.confirm("Remover a foto? O site volta a mostrar o ícone do produto.")) return;
    try {
      if (isEditing && id) await updateCmsProduto(id, { imagem_url: null });
      setImagemUrl("");
      setEnquadramento(SEM_ENQUADRAMENTO);
      setAvisoFoto(isEditing ? "Foto removida do site." : null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao remover a foto.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deptId) {
      setErrorMsg("Selecione um departamento.");
      return;
    }
    if (promoInvalid) {
      setErrorMsg("O preço promocional deve ser menor que o original.");
      return;
    }
    if (missingPromoEnd) {
      setErrorMsg("Data de término da oferta é obrigatória.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const payload: CmsProdutoPayload = {
      departamento_id: deptId,
      nome,
      slug: slug || undefined,
      marca,
      tamanho,
      forma,
      cor,
      imagem_url: imagemUrl || null,
      imagem_posicao: enquadramento.posicao,
      imagem_zoom: enquadramento.zoom,
      descricao,
      como_usar: comoUsar,
      preco_de: precoDe.replace(",", "."),
      preco_por: numPor > 0 ? precoPor.replace(",", ".") : null,
      promo_inicio: promoInicio || null,
      promo_fim: promoFim || null,
      embalagem_grande: embalagemGrande,
      is_active: isActive,
    };

    try {
      if (isEditing && id) {
        await updateCmsProduto(id, payload);
      } else {
        await createCmsProduto(payload);
      }
      navigate("/cms/produtos");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao salvar produto.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <CmsShell
        title={isEditing ? "Carregando..." : "Novo Produto"}
        crumb="Catálogo / Produtos / Editar"
      >
        <div className={styles.container} style={{ textAlign: "center", padding: "40px", color: "var(--cms-muted, #888)" }}>
          Carregando dados...
        </div>
      </CmsShell>
    );
  }

  return (
    <CmsShell
      title={isEditing ? `Editar: ${nome || "Produto"}` : "Novo Produto"}
      crumb="Catálogo / Produtos / Editar"
    >
      <div className={styles.container}>
        {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

        <form onSubmit={handleSubmit} className={styles.layout}>
          <div className={styles.card}>
            <div className={styles.sectionTitle}>Dados Básicos</div>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="dept">Departamento *</label>
                <select
                  id="dept"
                  className={styles.select}
                  value={deptId}
                  onChange={(e) => setDeptId(e.target.value)}
                  required
                >
                  <option value="">Selecione...</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label htmlFor="nome">Nome do Produto *</label>
                  <input
                    id="nome"
                    type="text"
                    className={styles.input}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Desinfetante Lavanda"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="marca">Marca</label>
                  <input
                    id="marca"
                    type="text"
                    className={styles.input}
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    placeholder="Ex: Brisanil"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label htmlFor="tamanho">Tamanho / Volume</label>
                  <input
                    id="tamanho"
                    type="text"
                    className={styles.input}
                    value={tamanho}
                    onChange={(e) => setTamanho(e.target.value)}
                    placeholder="Ex: 500 ml, 2 L, 5 L, c/ 4"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="forma">
                    Forma / Ícone <span className={styles.hintInline}>(quando não há foto)</span>
                  </label>
                  <select
                    id="forma"
                    className={styles.select}
                    value={forma}
                    onChange={(e) => setForma(e.target.value)}
                  >
                    {FORMAS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label htmlFor="cor">Cor do Selo</label>
                  <div className={styles.colorPickerGroup}>
                    <input
                      id="cor"
                      type="color"
                      className={styles.colorInput}
                      value={cor}
                      onChange={(e) => setCor(e.target.value)}
                    />
                    <span style={{ fontSize: 12 }}>{cor}</span>
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="foto">Foto do produto</label>
                  <div className={styles.fotoGroup}>
                    <span className={styles.fotoThumb} style={tinta}>
                      {imagemUrl ? (
                        <span className={styles.fotoQuadrada}>
                          <img src={imagemUrl} alt="" style={estiloFoto} />
                        </span>
                      ) : (
                        <ImagePlus size={18} aria-hidden />
                      )}
                    </span>
                    <button type="button" className={styles.iconBtn} onClick={() => fileRef.current?.click()}>
                      <ImagePlus size={15} aria-hidden />
                      {imagemUrl ? "Trocar" : "Enviar foto"}
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => {
                        setErroFoto(null);
                        setModalAberto(true);
                      }}
                      disabled={!imagemUrl}
                      aria-label="Ver e ajustar enquadramento"
                      title="Ver e ajustar enquadramento"
                    >
                      <Eye size={16} />
                    </button>
                    {imagemUrl && (
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={removerFoto}
                        aria-label="Remover foto"
                        title="Remover foto"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    <input
                      id="foto"
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className={styles.fileInput}
                      onChange={escolherArquivo}
                    />
                  </div>
                  {avisoFoto && (
                    <output className={styles.fieldNote}>
                      {avisoFoto}
                    </output>
                  )}
                </div>
              </div>

              <div className={styles.sectionTitle} style={{ marginTop: 16 }}>
                Preços e Ofertas
              </div>

              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label htmlFor="precoDe">Preço de Balcão (R$) *</label>
                  <input
                    id="precoDe"
                    type="text"
                    className={styles.input}
                    value={precoDe}
                    onChange={(e) => setPrecoDe(e.target.value)}
                    placeholder="Ex: 12,90"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="precoPor">Preço Promocional (R$)</label>
                  <input
                    id="precoPor"
                    type="text"
                    className={styles.input}
                    value={precoPor}
                    onChange={(e) => setPrecoPor(e.target.value)}
                    placeholder="Ex: 9,90"
                  />
                </div>
              </div>

              {numPor > 0 && (
                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label htmlFor="promoInicio">Início da Oferta</label>
                    <input
                      id="promoInicio"
                      type="date"
                      className={styles.input}
                      value={promoInicio}
                      onChange={(e) => setPromoInicio(e.target.value)}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="promoFim">Término da Oferta *</label>
                    <input
                      id="promoFim"
                      type="date"
                      className={styles.input}
                      value={promoFim}
                      onChange={(e) => setPromoFim(e.target.value)}
                      required={numPor > 0}
                    />
                  </div>
                </div>
              )}

              <div className={styles.sectionTitle} style={{ marginTop: 16 }}>
                Detalhes & Informações
              </div>

              <div className={styles.field}>
                <label htmlFor="desc">Descrição curta</label>
                <textarea
                  id="desc"
                  className={styles.textarea}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Perfume suave que dura no ambiente. Rende até 100 litros diluído."
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="comoUsar">Como Usar (Instruções)</label>
                <textarea
                  id="comoUsar"
                  className={styles.textarea}
                  value={comoUsar}
                  onChange={(e) => setComoUsar(e.target.value)}
                  placeholder="Ex: Dilua 1 tampa para 5 litros de água..."
                />
              </div>

              <div className={styles.formRow} style={{ marginTop: 8 }}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={embalagemGrande}
                    onChange={(e) => setEmbalagemGrande(e.target.checked)}
                  />
                  <span>Embalagem Grande (fardos, galões 5L, caixas)</span>
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span>Produto Ativo no Catálogo</span>
                </label>
              </div>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => navigate("/cms/produtos")}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar Produto"}
              </button>
            </div>
          </div>

          {/* COLUNA DE PREVIEW AO VIVO */}
          <div className={styles.previewBox}>
            <div className={styles.sectionTitle}>Pré-visualização do Cartão</div>
            <div className={styles.previewCard}>
              {imagemUrl ? (
                <div className={`${styles.previewArt} ${styles.previewArtFoto}`} style={tinta}>
                  <span className={styles.fotoQuadrada}>
                    <img src={imagemUrl} alt="" style={estiloFoto} />
                  </span>
                </div>
              ) : (
                <div className={styles.previewArt} style={{ backgroundColor: cor }}>
                  {forma[0].toUpperCase()}
                </div>
              )}

              <div className={styles.previewDept}>
                {currentDept ? currentDept.nome : "Departamento"}
              </div>

              <div className={styles.previewName}>{nome || "Nome do Produto"}</div>

              <div className={styles.previewMeta}>
                {marca ? `${marca} · ` : ""}
                {tamanho || "Tamanho"}
              </div>

              <div className={styles.previewPricing}>
                {hasPromo ? (
                  <>
                    <span className={styles.previewPromoBadge}>-{discountPct}%</span>
                    <span className={styles.previewFrom}>de R$ {numDe.toFixed(2)}</span>
                    <span className={styles.previewTo}>por R$ {numPor.toFixed(2)}</span>
                    {promoFim && (
                      <span className={styles.previewValidity}>
                        válido até {promoFim.split("-").reverse().slice(0, 2).join("/")}
                      </span>
                    )}
                  </>
                ) : (
                  <span className={styles.previewOriginal}>
                    R$ {numDe > 0 ? numDe.toFixed(2) : "0,00"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </form>

        {modalAberto && (arquivo || imagemUrl) && (
          <ProductPhotoDialog
            src={arquivo?.url || imagemUrl}
            cor={cor}
            nome={nome}
            inicial={arquivo ? SEM_ENQUADRAMENTO : enquadramento}
            salvando={salvandoFoto}
            erro={erroFoto}
            onCancelar={fecharModal}
            onSalvar={salvarFoto}
          />
        )}
      </div>
    </CmsShell>
  );
}

export default CmsProductEditorPage;
