import type { PublicProduto } from "@/lib/server/publicCatalog";
import type { PublicSiteSettings } from "@/lib/server/publicSettings";

export interface BuildStoreJsonLdParams {
  settings: PublicSiteSettings;
  canonicalUrl: string;
}

export function buildStoreJsonLd({ settings, canonicalUrl }: BuildStoreJsonLdParams) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "name": settings.loja_nome,
    "description": "Produtos de limpeza para casa e empresa em Jacarepaguá, Anil e Rio das Pedras.",
    "url": canonicalUrl,
    "telephone": `+${settings.whatsapp_numero}`,
    "priceRange": "$$",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": settings.endereco,
      "addressLocality": "Rio de Janeiro",
      "addressRegion": "RJ",
      "addressCountry": "BR",
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "-22.9667",
      "longitude": "-43.3411",
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        "opens": "08:00",
        "closes": "19:00",
      },
    ],
  };
}

export interface BuildProductJsonLdParams {
  produto: PublicProduto;
  settings: PublicSiteSettings;
  canonicalUrl: string;
}

export function buildProductJsonLd({ produto, settings, canonicalUrl }: BuildProductJsonLdParams) {
  // CA-30: Se oferta ativa, price é preco_por e priceValidUntil é promo_fim
  // Se preço regular, price é preco_de sem priceValidUntil
  const isOfferActive = Boolean(produto.promo_ativa && produto.preco_por);
  const rawPrice = isOfferActive && produto.preco_por ? produto.preco_por : produto.preco_de;
  const cleanPrice = String(rawPrice || "0")
    .replace(/[^\d.,]/g, "")
    .replace(",", ".")
    .trim();

  const offer: Record<string, unknown> = {
    "@type": "Offer",
    "price": cleanPrice,
    "priceCurrency": "BRL",
    "availability": "https://schema.org/InStock",
    "url": canonicalUrl,
    "seller": {
      "@type": "Store",
      "name": settings.loja_nome,
    },
  };

  if (isOfferActive && produto.promo_fim) {
    offer.priceValidUntil = produto.promo_fim;
  }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": produto.nome,
    "description": produto.descricao || `${produto.nome} (${produto.tamanho})`,
    "image": produto.imagem_url || undefined,
    "sku": produto.id,
    "brand": produto.marca
      ? {
          "@type": "Brand",
          "name": produto.marca,
        }
      : undefined,
    "offers": offer,
  };
}

export interface BuildArticleJsonLdParams {
  title: string;
  description: string;
  canonicalUrl: string;
  publishedTime?: string | null;
  modifiedTime?: string | null;
  authorName?: string | null;
  settings: PublicSiteSettings;
}

export function buildArticleJsonLd({
  title,
  description,
  canonicalUrl,
  publishedTime,
  modifiedTime,
  authorName,
  settings,
}: BuildArticleJsonLdParams) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "url": canonicalUrl,
    ...(publishedTime ? { "datePublished": publishedTime } : {}),
    ...(modifiedTime || publishedTime ? { "dateModified": modifiedTime || publishedTime } : {}),
    ...(authorName
      ? {
          "author": {
            "@type": "Person",
            "name": authorName,
          },
        }
      : {}),
    "publisher": {
      "@type": "Organization",
      "name": settings.loja_nome,
    },
  };
}
