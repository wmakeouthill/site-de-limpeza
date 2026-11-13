import { RotateCcw } from "lucide-react";
import type { ChangeEvent } from "react";
import styles from "./ImagePositionControl.module.css";
import type { ImagePositionControlProps } from "./ImagePositionControl.types";

const CENTER_POSITION = 50;
const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 100;
const MAX_ZOOM = 300;

export function ImagePositionControl({ value, onChange }: ImagePositionControlProps) {
  const zoom = Math.max(value.zoom ?? DEFAULT_ZOOM, MIN_ZOOM);

  return (
    <div className={styles.control}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.title}>Enquadramento no card</span>
          <p className={styles.hint}>
            Em 100% a imagem fica inteira. Aumente o zoom para aproximar e use
            horizontal/vertical para escolher o foco.
          </p>
        </div>
        <button type="button" className={styles.reset} onClick={handleReset}>
          <RotateCcw size={16} />
          Centralizar
        </button>
      </div>

      <label className={styles.row}>
        <span className={styles.label}>Horizontal</span>
        <input
          type="range"
          min="0"
          max="100"
          value={value.x}
          onChange={handleAxisChange("x")}
        />
        <span className={styles.value}>{value.x}%</span>
      </label>

      <label className={styles.row}>
        <span className={styles.label}>Vertical</span>
        <input
          type="range"
          min="0"
          max="100"
          value={value.y}
          onChange={handleAxisChange("y")}
        />
        <span className={styles.value}>{value.y}%</span>
      </label>

      <label className={styles.row}>
        <span className={styles.label}>Zoom</span>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step="5"
          value={zoom}
          onChange={handleAxisChange("zoom")}
        />
        <span className={styles.value}>{zoom}%</span>
      </label>
    </div>
  );

  function handleAxisChange(axis: "x" | "y" | "zoom") {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = Number(event.target.value);
      onChange({
        ...value,
        zoom,
        [axis]: axis === "zoom" ? Math.max(nextValue, MIN_ZOOM) : nextValue,
      });
    };
  }

  function handleReset() {
    onChange({ x: CENTER_POSITION, y: CENTER_POSITION, zoom: DEFAULT_ZOOM });
  }
}
