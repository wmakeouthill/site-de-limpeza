import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Boxes,
  FileText,
  FolderTree,
  LogOut,
  Menu,
  MessageSquareQuote,
  Moon,
  Package,
  PanelLeft,
  Settings,
  Sparkles,
  Sun,
  Tag,
} from "lucide-react";

import { useCmsAuth } from "../../context/CmsAuthContext";
import { updateCmsProfilePhoto } from "../../services/cmsAuth.service";
import { uploadCmsImage } from "../../services/cmsUpload.service";
import styles from "./CmsShell.module.css";

interface CmsShellProps {
  children: ReactNode;
  title?: string;
  crumb?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  primaryAction?: { label: string; href: string } | null;
}

const navigation = [
  {
    label: "Catálogo",
    items: [
      { label: "Produtos", to: "/cms/produtos", icon: Package },
      { label: "Ofertas", to: "/cms/ofertas", icon: Tag },
      { label: "Departamentos", to: "/cms/departamentos", icon: FolderTree },
      { label: "Kits", to: "/cms/kits", icon: Boxes },
    ],
  },
  {
    label: "Divulgação & Conteúdo",
    items: [
      { label: "Promoções", to: "/cms/promocoes", icon: Sparkles },
      { label: "Artigos", to: "/cms", icon: FileText },
      { label: "Guias de limpeza", to: "/cms/guias", icon: BookOpen },
      { label: "Depoimentos", to: "/cms/depoimentos", icon: MessageSquareQuote },
    ],
  },
  {
    label: "Painel & Sistema",
    items: [
      { label: "Métricas", to: "/cms/metricas", icon: BarChart3 },
      { label: "Dados da loja", to: "/cms/configuracoes", icon: Settings },
    ],
  },
];

export function CmsShell({
  children,
  title,
  crumb,
  searchPlaceholder = "Buscar",
  searchValue,
  onSearchChange,
  primaryAction,
}: Readonly<CmsShellProps>) {
  const { session, logout } = useCmsAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState(session.photoUrl ?? "");
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof window !== "undefined" && (window.localStorage.getItem("cms-theme") === "dark" ||
      (!window.localStorage.getItem("cms-theme") && window.matchMedia?.("(prefers-color-scheme: dark)").matches)) ? "dark" : "light",
  );
  const displayName = session.name || session.email;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!isMobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setIsMobileOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMobileOpen]);

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsPhotoUploading(true);
    try {
      const upload = await uploadCmsImage(file);
      const updatedSession = await updateCmsProfilePhoto(upload.url);
      setPhotoUrl(updatedSession.photoUrl ?? upload.url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível trocar a foto.");
    } finally {
      setIsPhotoUploading(false);
      event.target.value = "";
    }
  }

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    window.localStorage.setItem("cms-theme", nextTheme);
  }

  return (
    <div className={styles.shell} data-theme={theme} data-collapsed={isCollapsed} data-mobile-open={isMobileOpen}>
      <button type="button" className={styles.backdrop} aria-label="Fechar navegação" onClick={() => setIsMobileOpen(false)} />
      <aside className={styles.sidebar} aria-label="Navegação do CMS">
        <div className={styles.brandRow}>
          <a className={styles.brand} href="/cms" aria-label="Falcão Limpeza CMS">
            <img src="/brand/simbolo-40.webp" alt="" width="22" height="22" className={styles.brandLogo} />
            <span className={styles.brandTitle}>FALCÃO</span>
            <span className={styles.brandMark}>· CMS</span>
          </a>
          <button
            type="button"
            className={styles.collapseButton}
            onClick={() => setIsCollapsed((value) => !value)}
            aria-label={isCollapsed ? "Expandir navegação" : "Recolher navegação"}
          >
            <PanelLeft size={14} />
          </button>
        </div>
        <nav className={styles.nav} aria-label="Seções do CMS">
          {navigation.map((group) => (
            <div className={styles.navGroup} key={group.label}>
              <span className={styles.navGroupLabel}>{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    className={styles.navLink}
                    key={item.to}
                    to={item.to}
                    end={item.to === "/cms"}
                    title={isCollapsed ? item.label : undefined}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <span className={styles.tile}><Icon size={14} aria-hidden="true" /></span>
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <button
            type="button"
            className={styles.avatar}
            title="Trocar foto"
            aria-label={isPhotoUploading ? "Enviando foto" : "Trocar foto"}
            onClick={() => fileInputRef.current?.click()}
          >
            {photoUrl ? <img src={photoUrl} alt="" /> : initials(displayName)}
          </button>
          <div className={styles.userCopy}>
            <div className={styles.userName}>{displayName}</div>
            <div className={styles.userEmail}>{session.email}</div>
          </div>
          <button className={styles.logoutButton} type="button" title="Sair" aria-label="Sair" onClick={() => void logout()}>
            <LogOut size={14} />
          </button>
        </div>
      </aside>
      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>CMS <span className={styles.slash}>/</span> {crumb ?? title ?? "Conteúdo"}</span>
            {title ? <h1 className={styles.title}>{title}</h1> : null}
          </div>
          <div className={styles.search}>
            <label className={styles.searchLabel}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={onSearchChange ? (searchValue ?? "") : undefined}
                defaultValue={onSearchChange ? undefined : ""}
                placeholder={searchPlaceholder}
                onChange={(event) => onSearchChange?.(event.target.value)}
              />
            </label>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.mobileOpen} onClick={() => setIsMobileOpen(true)} aria-label="Abrir navegação">
              <Menu size={16} />
            </button>
            <button type="button" className={styles.iconButton} onClick={toggleTheme} aria-label="Alternar tema" title="Alternar tema">
              {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            {primaryAction ? (
              <a className={styles.primaryAction} href={primaryAction.href}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                {primaryAction.label}
              </a>
            ) : null}
            <input ref={fileInputRef} className={styles.photoInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} disabled={isPhotoUploading} />
          </div>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}

function initials(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "F"}${parts[1]?.[0] ?? "L"}`.toUpperCase();
}
