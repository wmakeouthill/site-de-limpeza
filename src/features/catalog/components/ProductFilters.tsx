import { useState } from "react";
import type { PublicDepartamento } from "@/lib/server/publicCatalog";

export interface ProductFiltersProps {
  departamentos: PublicDepartamento[];
  marcasDisponiveis: string[];
  selectedDept: string;
  onSelectDept: (dept: string) => void;
  selectedPreco: "" | "10" | "30" | "30+";
  onSelectPreco: (range: "" | "10" | "30" | "30+") => void;
  soOfertas: boolean;
  onToggleOfertas: (checked: boolean) => void;
  embalagemGrande: boolean;
  onToggleGrande: (checked: boolean) => void;
  selectedMarcas: string[];
  onToggleMarca: (marca: string) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
}

export function ProductFilters({
  departamentos,
  marcasDisponiveis,
  selectedDept,
  onSelectDept,
  selectedPreco,
  onSelectPreco,
  soOfertas,
  onToggleOfertas,
  embalagemGrande,
  onToggleGrande,
  selectedMarcas,
  onToggleMarca,
  onClearAll,
  hasActiveFilters,
}: ProductFiltersProps) {
  // No mobile os filtros ficam acima da grade e começam recolhidos; no desktop o botão some (CSS).
  const [aberto, setAberto] = useState(false);

  return (
    <aside className={aberto ? "cat-filters is-open" : "cat-filters"}>
      <div className="filters-header">
        <span className="filters-title">
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
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filtros
        </span>
        {hasActiveFilters && (
          <button type="button" className="btn-clear-filters" onClick={onClearAll}>
            Limpar
          </button>
        )}
        <button
          type="button"
          className="filters-toggle"
          aria-expanded={aberto}
          aria-controls="filters-body"
          onClick={() => setAberto((v) => !v)}
        >
          {aberto ? "Ocultar" : "Mostrar"}
        </button>
      </div>

      <div className="filters-body" id="filters-body">
        {/* Departamento */}
        <fieldset className="filter-group">
          <legend className="filter-legend">Departamento</legend>
          <div className="filter-options">
            <label className="filter-radio">
              <input
                type="radio"
                name="f_dept"
                checked={!selectedDept || selectedDept === "todos"}
                onChange={() => onSelectDept("todos")}
              />
              <span>Todos os departamentos</span>
            </label>
            {departamentos.map((d) => (
              <label key={d.id} className="filter-radio">
                <input
                  type="radio"
                  name="f_dept"
                  checked={selectedDept === d.slug}
                  onChange={() => onSelectDept(d.slug)}
                />
                <span>{d.nome}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Faixa de Preço */}
        <fieldset className="filter-group">
          <legend className="filter-legend">Preço</legend>
          <div className="filter-options">
            <label className="filter-radio">
              <input
                type="radio"
                name="f_preco"
                checked={selectedPreco === ""}
                onChange={() => onSelectPreco("")}
              />
              <span>Qualquer preço</span>
            </label>
            <label className="filter-radio">
              <input
                type="radio"
                name="f_preco"
                checked={selectedPreco === "10"}
                onChange={() => onSelectPreco("10")}
              />
              <span>Até R$ 10</span>
            </label>
            <label className="filter-radio">
              <input
                type="radio"
                name="f_preco"
                checked={selectedPreco === "30"}
                onChange={() => onSelectPreco("30")}
              />
              <span>De R$ 10 a R$ 30</span>
            </label>
            <label className="filter-radio">
              <input
                type="radio"
                name="f_preco"
                checked={selectedPreco === "30+"}
                onChange={() => onSelectPreco("30+")}
              />
              <span>Acima de R$ 30</span>
            </label>
          </div>
        </fieldset>

        {/* Filtros Rápidos */}
        <fieldset className="filter-group">
          <legend className="filter-legend">Destaques</legend>
          <div className="filter-options">
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={soOfertas}
                onChange={(e) => onToggleOfertas(e.target.checked)}
              />
              <span>Só ofertas ativas</span>
            </label>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={embalagemGrande}
                onChange={(e) => onToggleGrande(e.target.checked)}
              />
              <span>Embalagem grande / Galão</span>
            </label>
          </div>
        </fieldset>

        {/* Marcas */}
        {marcasDisponiveis.length > 0 && (
          <fieldset className="filter-group">
            <legend className="filter-legend">Marca</legend>
            <div className="filter-options">
              {marcasDisponiveis.map((marca) => {
                const isChecked = selectedMarcas.includes(marca);
                return (
                  <label key={marca} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleMarca(marca)}
                    />
                    <span>{marca}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
      </div>
    </aside>
  );
}
