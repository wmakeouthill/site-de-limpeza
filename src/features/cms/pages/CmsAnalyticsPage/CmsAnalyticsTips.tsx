import { Fragment } from "react";
import styles from "./CmsAnalyticsPage.module.css";

export interface ChannelTipRow {
  label: string;
  value: string;
  pct: string;
  color: string;
}

export interface PairTipRow {
  label: string;
  a: string;
  b: string;
  color: string;
}

export function ChannelTip({ rows }: { rows: ChannelTipRow[] }) {
  if (!rows.length) return null;
  return (
    <div className={styles.tipList}>
      {rows.map((row) => (
        <div key={row.label} className={styles.tipRow}>
          <i className={styles.dot} style={{ background: row.color }} />
          <span>{row.label}</span>
          <strong>{row.value}</strong>
          <em>{row.pct}</em>
        </div>
      ))}
    </div>
  );
}

export function SplitPairTip({ rows }: { rows: PairTipRow[] }) {
  if (!rows.length) return null;
  return (
    <div className={styles.tipGrid}>
      <span />
      <span className={styles.tipGridHead}>visit.</span>
      <span className={styles.tipGridHead}>views</span>
      {rows.map((row) => (
        <Fragment key={row.label}>
          <span className={styles.tipChannel}>
            <i className={styles.dot} style={{ background: row.color }} />
            {row.label}
          </span>
          <strong>{row.a}</strong>
          <strong className={styles.tipViews}>{row.b}</strong>
        </Fragment>
      ))}
    </div>
  );
}
