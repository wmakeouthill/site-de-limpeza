import { useEffect, useMemo, useState } from "react";
import type { PublicDepartamento, PublicProduto } from "@/lib/server/publicCatalog";
import { ProductCard } from "./ProductCard";
import { ProductFilters } from "./ProductFilters";
import { filterAndSortProducts, type FilterProductsParams } from "../utils/productSearch";
import { trackBusca } from "@/features/analytics/services/trackEvent";

export interface ProductCatalogProps {
  initialProdutos: PublicProduto[];
  departamentos: PublicDepartamento[];
  initialDept?: string;
  initialQuery?: string;
  initialOferta?: boolean;
}

export function ProductCatalog({
  initialProdutos,
  departamentos,
  initialDept = "",
  initialQuery = "",
  initialOferta = false,
}: ProductCatalogProps) {
  // Estado dos filtros
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [selectedDept, setSelectedDept] = useState(initialDept);
  const [selectedPreco, setSelectedPreco] = useState<"" | "10" | "30" | "30+">("");
  const [soOfertas, setSoOfertas] = useState(initialOferta);
  const [embalagemGrande, setEmbalagemGrande] = useState(false);
  const [selectedMarcas, setSelectedMarcas] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<"pop" | "menor" | "desc" | "az">("pop");

  // Lê parâmetros da URL no cliente (se houver hidratação)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const qParam = urlParams.get("q");
    const deptParam = urlParams.get("departamento");
    const ofertaParam = urlParams.get("oferta");
    const grandeParam = urlParams.get("grande");
    const precoParam = urlParams.get("preco");
    const ordemParam = urlParams.get("ordem");

    if (qParam) setSearchTerm(qParam);
    if (deptParam) setSelectedDept(deptParam);
    if (ofertaParam === "true" || ofertaParam === "1") setSoOfertas(true);
    if (grandeParam === "true" || grandeParam === "1") setEmbalagemGrande(true);
    if (precoParam === "10" || precoParam === "30" || precoParam === "30+") {
      setSelectedPreco(precoParam);
    }
    if (ordemParam === "menor" || ordemParam === "desc" || ordemParam === "az") {
      setOrdem(ordemParam);
    }
  }, []);

  // Sincroniza a URL sem recarregar a página
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    if (selectedDept && selectedDept !== "todos") params.set("departamento", selectedDept);
    if (selectedPreco) params.set("preco", selectedPreco);
    if (soOfertas) params.set("oferta", "true");
    if (embalagemGrande) params.set("grande", "true");
    if (ordem && ordem !== "pop") params.set("ordem", ordem);
    if (selectedMarcas.length > 0) params.set("marcas", selectedMarcas.join(","));

    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, [searchTerm, selectedDept, selectedPreco, soOfertas, embalagemGrande, selectedMarcas, ordem]);

  // Telemetria de busca com debounce (CA-23)
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed || trimmed.length < 2) return;
    const timer = setTimeout(() => {
      trackBusca(trimmed);
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Lista de marcas disponíveis no catálogo
  const marcasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    initialProdutos.forEach((p) => {
      if (p.marca && p.marca.trim()) {
        set.add(p.marca.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [initialProdutos]);

  // Aplica filtros e ordenação
  const filteredProdutos = useMemo(() => {
    const filterParams: FilterProductsParams = {
      q: searchTerm,
      departamento: selectedDept,
      precoRange: selectedPreco,
      soOfertas,
      embalagemGrande,
      marcas: selectedMarcas,
      ordem,
    };
    return filterAndSortProducts(initialProdutos, filterParams);
  }, [
    initialProdutos,
    searchTerm,
    selectedDept,
    selectedPreco,
    soOfertas,
    embalagemGrande,
    selectedMarcas,
    ordem,
  ]);

  function handleToggleMarca(marca: string) {
    setSelectedMarcas((prev) =>
      prev.includes(marca) ? prev.filter((m) => m !== marca) : [...prev, marca]
    );
  }

  function handleClearAll() {
    setSearchTerm("");
    setSelectedDept("todos");
    setSelectedPreco("");
    setSoOfertas(false);
    setEmbalagemGrande(false);
    setSelectedMarcas([]);
    setOrdem("pop");
  }

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      (selectedDept && selectedDept !== "todos") ||
      selectedPreco ||
      soOfertas ||
      embalagemGrande ||
      selectedMarcas.length > 0
  );

  return (
    <div className="catalog-layout">
      {/* Barra de Filtros Lateral */}
      <ProductFilters
        departamentos={departamentos}
        marcasDisponiveis={marcasDisponiveis}
        selectedDept={selectedDept}
        onSelectDept={setSelectedDept}
        selectedPreco={selectedPreco}
        onSelectPreco={setSelectedPreco}
        soOfertas={soOfertas}
        onToggleOfertas={setSoOfertas}
        embalagemGrande={embalagemGrande}
        onToggleGrande={setEmbalagemGrande}
        selectedMarcas={selectedMarcas}
        onToggleMarca={handleToggleMarca}
        onClearAll={handleClearAll}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Conteúdo Principal do Catálogo */}
      <div className="catalog-main">
        {/* Barra Superior com Contador, Busca e Ordenação */}
        <div className="catalog-toolbar">
          <div className="toolbar-search">
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
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Buscar por nome, marca ou uso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="toolbar-input"
              aria-label="Buscar produtos no catálogo"
            />
            {searchTerm && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={() => setSearchTerm("")}
                aria-label="Limpar termo de busca"
              >
                ×
              </button>
            )}
          </div>

          <div className="toolbar-controls">
            <span className="results-count" aria-live="polite">
              {filteredProdutos.length === 1
                ? "1 produto encontrado"
                : `${filteredProdutos.length} produtos encontrados`}
            </span>

            <label className="sort-label">
              <span>Ordenar:</span>
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as any)}
                className="sort-select"
              >
                <option value="pop">Mais procurados</option>
                <option value="menor">Menor preço</option>
                <option value="desc">Maior desconto</option>
                <option value="az">Nome (A a Z)</option>
              </select>
            </label>
          </div>
        </div>

        {/* Chips de Filtros Ativos */}
        {hasActiveFilters && (
          <div className="active-chips">
            {searchTerm.trim() && (
              <span className="filter-chip">
                Busca: "{searchTerm}"
                <button type="button" onClick={() => setSearchTerm("")}>
                  ×
                </button>
              </span>
            )}
            {selectedDept && selectedDept !== "todos" && (
              <span className="filter-chip">
                {departamentos.find((d) => d.slug === selectedDept)?.nome || selectedDept}
                <button type="button" onClick={() => setSelectedDept("todos")}>
                  ×
                </button>
              </span>
            )}
            {selectedPreco && (
              <span className="filter-chip">
                {selectedPreco === "10"
                  ? "Até R$ 10"
                  : selectedPreco === "30"
                  ? "De R$ 10 a R$ 30"
                  : "Acima de R$ 30"}
                <button type="button" onClick={() => setSelectedPreco("")}>
                  ×
                </button>
              </span>
            )}
            {soOfertas && (
              <span className="filter-chip">
                Só ofertas
                <button type="button" onClick={() => setSoOfertas(false)}>
                  ×
                </button>
              </span>
            )}
            {embalagemGrande && (
              <span className="filter-chip">
                Embalagem grande
                <button type="button" onClick={() => setEmbalagemGrande(false)}>
                  ×
                </button>
              </span>
            )}
            {selectedMarcas.map((marca) => (
              <span key={marca} className="filter-chip">
                {marca}
                <button type="button" onClick={() => handleToggleMarca(marca)}>
                  ×
                </button>
              </span>
            ))}
            <button type="button" className="btn-chip-clear" onClick={handleClearAll}>
              Limpar todos
            </button>
          </div>
        )}

        {/* Grid de Produtos */}
        {filteredProdutos.length > 0 ? (
          <div className="products-grid">
            {filteredProdutos.map((produto) => (
              <ProductCard key={produto.id} produto={produto} />
            ))}
          </div>
        ) : (
          <div className="catalog-empty">
            <svg
              viewBox="0 0 24 24"
              width="44"
              height="44"
              fill="none"
              stroke="var(--ink-3)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
              <path d="M8 8l6 6M14 8l-6 6" />
            </svg>
            <h3>Nenhum produto encontrado</h3>
            <p>
              Tente buscar por termos mais genéricos, verificar a digitação ou limpar os filtros
              ativos.
            </p>
            <button type="button" className="btn-reset-filters" onClick={handleClearAll}>
              Ver todos os produtos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
