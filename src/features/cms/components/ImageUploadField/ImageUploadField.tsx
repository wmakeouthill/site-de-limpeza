import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { uploadCmsImage } from "../../services/cmsUpload.service";
import styles from "./ImageUploadField.module.css";

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string, assetId: string | null) => void;
  placeholder?: string;
}

/**
 * Campo de imagem do CMS: aceita colar uma URL ou enviar um arquivo na hora
 * (vai para o volume de uploads do backend e devolve a URL publica).
 */
export function ImageUploadField({ label, value, onChange, placeholder }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadCmsImage(file);
      onChange(result.url, result.asset_id ?? null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Falha no upload.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.card}>
        <div className={styles.preview}>
          {value ? (
            <img src={value} alt="" />
          ) : (
            <ImagePlus size={24} aria-hidden />
          )}
        </div>

        <div className={styles.controls}>
          <div className={styles.urlRow}>
            <input
              className={styles.url}
              value={value}
              onChange={(event) => onChange(event.target.value, null)}
              placeholder={placeholder ?? "Cole uma URL ou envie um arquivo"}
              aria-label={`${label}: URL da imagem`}
            />
            {value && (
              <button
                type="button"
                className={styles.clear}
                onClick={() => onChange("", null)}
                aria-label="Remover imagem"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.upload}
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 size={16} className={styles.spin} /> : <ImagePlus size={16} />}
              {isUploading ? "Enviando..." : "Enviar imagem"}
            </button>
            <span>PNG, JPG, WEBP, GIF ou SVG.</span>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className={styles.fileInput}
          onChange={handleFile}
        />
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
