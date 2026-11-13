export interface CaseShowcaseMetric {
  prefix?: string;
  value: string;
  label: string;
}

export interface CaseShowcaseCardProps {
  title: string;
  tags: string[];
  metrics?: CaseShowcaseMetric[];
  screenshot?: string;
  screenshotAlt?: string;
  imagePosition?: {
    x: number;
    y: number;
    zoom?: number;
  };
  href?: string;
  className?: string;
}
