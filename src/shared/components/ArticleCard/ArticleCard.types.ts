export interface ArticleCardProps {
  area: string;
  readingTime: string;
  title: string;
  thumbnail: string;
  thumbnailAlt?: string;
  imagePosition?: {
    x: number;
    y: number;
    zoom?: number;
  };
  href: string;
  className?: string;
}
