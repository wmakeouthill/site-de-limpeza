import { X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import {
  ZOOM_MAX,
  ZOOM_MIN,
  fotoStyle,
  gravarPosicao,
  lerPosicao,
} from "@/features/catalog/utils/productPhoto";
import styles from "./CmsProductEditorPage.module.css";

export interface Enquadramento {
  posicao: string;
  zoom: number;
}

interface Props {
  src: string;
  cor: string;
  nome: string;
  inicial: Enquadramento;
  salvando: boolean;
  erro: string | null;
  onCancelar: () => void;
  onSalvar: (enquadramento: Enquadramento) => void;
}

const limitar = (v: number) => Math.min(Math.max(v, 0), 100);

export function ProductPhotoDialog({ src, cor, nome, inicial, salvando, erro, onCancelar, onSalvar }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const quadroRef = useRef<HTMLDivElement>(null);
  const arraste = useRef<{ x: number; y: number; origem: [number, number] } | null>(null);
  const [origem, setOrigem] = useState<[number, number]>(() => lerPosicao(inicial.posicao));
  const [zoom, setZoom] = useState(inicial.zoom || 100);

  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, []);

  const posicao = gravarPosicao(origem[0], origem[1]);
  const estilo = fotoStyle(posicao, zoom);
  const tinta = { "--c": cor } as React.CSSProperties;

  // Arrastar a foto = mover a origem do zoom no sentido contrário. Em 100% a foto inteira já cabe.
  function mover(dx: number, dy: number, base: [number, number]) {
    const lado = quadroRef.current?.clientWidth || 1;
    const fator = zoom / 100 - 1;
    if (Math.abs(fator) < 0.01) return;
    setOrigem([limitar(base[0] - (dx / (fator * lado)) * 100), limitar(base[1] - (dy / (fator * lado)) * 100)]);
  }

  function teclas(e: React.KeyboardEvent) {
    const passo = (quadroRef.current?.clientWidth || 300) * 0.03;
    const setas: Record<string, [number, number]> = {
      ArrowLeft: [-passo, 0],
      ArrowRight: [passo, 0],
      ArrowUp: [0, -passo],
      ArrowDown: [0, passo],
    };
    if (setas[e.key]) mover(setas[e.key][0], setas[e.key][1], origem);
    else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 10, ZOOM_MAX));
    else if (e.key === "-") setZoom((z) => Math.max(z - 10, ZOOM_MIN));
    else return;
    e.preventDefault();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="foto-produto-titulo"
      onCancel={(e) => {
        e.preventDefault();
        if (!salvando) onCancelar();
      }}
    >
      <header className={styles.dialogHeader}>
        <h2 id="foto-produto-titulo">Foto do produto</h2>
        <button type="button" className={styles.close} onClick={onCancelar} disabled={salvando} aria-label="Fechar">
          <X size={16} />
        </button>
      </header>

      <div className={styles.dialogBody}>
        <div className={styles.cropCol}>
          <div
            ref={quadroRef}
            className={styles.quadro}
            style={tinta}
            tabIndex={0}
            aria-label="Enquadramento da foto: arraste ou use as setas para mover; + e − mudam o zoom"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              arraste.current = { x: e.clientX, y: e.clientY, origem };
            }}
            onPointerMove={(e) => {
              const a = arraste.current;
              if (a) mover(e.clientX - a.x, e.clientY - a.y, a.origem);
            }}
            onPointerUp={() => (arraste.current = null)}
            onPointerCancel={() => (arraste.current = null)}
            onKeyDown={teclas}
          >
            <img src={src} alt="" draggable={false} style={estilo} />
          </div>

          <label className={styles.zoomRow}>
            <span>Zoom</span>
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
            <output>{zoom}%</output>
          </label>

          <div className={styles.cropFooter}>
            <p className={styles.hint}>
              Em 100% a foto aparece inteira. Aumente o zoom e arraste para destacar o produto.
            </p>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                setOrigem([50, 50]);
                setZoom(100);
              }}
            >
              Foto inteira
            </button>
          </div>
        </div>

        <div className={styles.previewCol}>
          <span className={styles.previewLabel}>Como fica no site</span>

          <figure className={styles.miniFigure}>
            <div className={styles.miniTile} style={tinta}>
              <span className={styles.fotoQuadrada}>
                <img src={src} alt="" style={estilo} />
              </span>
            </div>
            <figcaption>Ofertas da semana</figcaption>
          </figure>

          <figure className={styles.miniFigure}>
            <div className={styles.miniCard}>
              <div className={styles.miniThumb} style={{ backgroundColor: `${cor}15` }}>
                <span className={styles.fotoQuadrada}>
                  <img src={src} alt="" style={estilo} />
                </span>
              </div>
              <span className={styles.miniName}>{nome || "Nome do produto"}</span>
            </div>
            <figcaption>Catálogo</figcaption>
          </figure>
        </div>
      </div>

      {erro && <div className={`${styles.errorBanner} ${styles.dialogError}`}>{erro}</div>}

      <footer className={styles.dialogActions}>
        <button type="button" className={styles.btnSecondary} onClick={onCancelar} disabled={salvando}>
          Cancelar
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => onSalvar({ posicao, zoom })}
          disabled={salvando}
        >
          {salvando ? "Salvando..." : "Salvar foto"}
        </button>
      </footer>
    </dialog>
  );
}
