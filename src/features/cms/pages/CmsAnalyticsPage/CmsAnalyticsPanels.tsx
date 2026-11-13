import type { AnalyticsCampaign, AnalyticsCreative, AnalyticsPoint, AnalyticsRow, ContactSiteScope } from "../../types/cms.types";
import styles from "./CmsAnalyticsPage.module.css";
import { CHANNEL_META, formatNumber, formatPageLabel, shareRows, siteCountRows, sitePairRows, stackSiteCounts, weeklyFromSeries } from "./CmsAnalyticsPage.utils";
import { ChannelTip, SplitPairTip } from "./CmsAnalyticsTips";

export function RankingCard({ title, unit, rows, showCampaigns = false }: { title: string; unit: string; rows: AnalyticsRow[]; showCampaigns?: boolean }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <section className={styles.card}>
      <h2>{title}</h2>
      {rows.length ? (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.label} className={styles.rankItem}>
              <div className={`${styles.rankRow} ${styles.tipHost}`}>
                <div className={styles.rankFill} style={{ width: `${(row.count / max) * 100}%` }} />
                <span title={row.label}>{row.label}</span>
                <span><strong>{formatNumber(row.count)}</strong> <em>{unit}</em></span>
                <div className={styles.tip} style={{ minWidth: showCampaigns ? 250 : 188 }}>
                  <RankingTip row={row} showCampaigns={showCampaigns} />
                </div>
              </div>
              {showCampaigns && row.campaigns?.length ? (
                <details className={styles.sourceDetails}>
                  <summary>Ver campanhas e criativos</summary>
                  <div className={styles.sourceDetailsPanel}>
                    <CampaignBreakdown campaigns={row.campaigns} />
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className={styles.empty}>Ainda não há dados para este período.</p>}
    </section>
  );
}

function RankingTip({ row, showCampaigns }: { row: AnalyticsRow; showCampaigns: boolean }) {
  return (
    <>
      <div className={styles.tipRow}><span>{row.label}</span><strong>{formatNumber(row.count)}</strong></div>
      <div className={styles.tipRule} />
      <ChannelTip rows={siteCountRows(row.bySite)} />
      {row.rawLabels?.length ? (
        <>
          <div className={styles.tipRule} />
          <div className={styles.tipHint}>Valores capturados</div>
          {row.rawLabels.map((raw) => (
            <div key={raw.label} className={styles.tipRow}>
              <span title={raw.label}>{raw.label}</span><strong>{formatNumber(raw.count)}</strong>
            </div>
          ))}
        </>
      ) : null}
      {showCampaigns && row.campaigns?.length ? (
        <>
          <div className={styles.tipRule} />
          <div className={styles.tipHint}>Campanhas</div>
          {row.campaigns.slice(0, 3).map((campaign) => (
            <div key={campaign.label}>
              <div className={styles.tipRow}>
                <span title={campaign.label}>{campaign.label}</span><strong>{formatNumber(campaign.count)}</strong>
              </div>
              {campaign.creatives.slice(0, 2).map((creative) => (
                <div key={`${campaign.label}-${creative.label}-${creative.placement}`} className={`${styles.tipRow} ${styles.tipCreative}`}>
                  <span title={creative.link?.title || creative.label}>↳ {creative.label}{creative.link ? ` · ${creative.link.title}` : ""}</span><strong>{formatNumber(creative.count)}</strong>
                </div>
              ))}
            </div>
          ))}
          {row.campaigns.length > 3 ? <div className={styles.tipHint}>Veja todos nos detalhes da linha.</div> : null}
        </>
      ) : null}
    </>
  );
}

function CampaignBreakdown({ campaigns }: { campaigns: AnalyticsCampaign[] }) {
  return (
    <div className={styles.campaignBreakdown}>
      {campaigns.map((campaign) => (
        <section key={campaign.label} className={styles.campaignGroup}>
          <div className={styles.detailRow}>
            <strong title={campaign.label}>{campaign.label}</strong>
            <span>{formatNumber(campaign.count)} sess.</span>
          </div>
          <div className={styles.creativeList}>
            {campaign.creatives.map((creative) => <CreativeDetail key={`${creative.label}-${creative.placement}`} creative={creative} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function CreativeDetail({ creative }: { creative: AnalyticsCreative }) {
  return (
    <div className={styles.creativeDetail}>
      <span title={creative.label}>{creative.label}</span>
      {creative.placement ? <em>{creative.placement}</em> : null}
      <strong>{formatNumber(creative.count)}</strong>
      {creative.link ? (
        <a href={creative.link.sourceUrl} target="_blank" rel="noopener noreferrer">Abrir link</a>
      ) : <small>link não cadastrado</small>}
    </div>
  );
}

export function PagesCard({ rows }: { rows: AnalyticsRow[] }) {
  return (
    <section className={styles.card} aria-label="Páginas mais vistas">
      <div className={styles.cardHead}><h2>Páginas mais vistas</h2><span>barra = participação por canal</span></div>
      {rows.length ? (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.label} className={`${styles.pageRow} ${styles.tipHost}`}>
              <span title={row.label}>{formatPageLabel(row.label)}</span>
              <span className={styles.stack}>
                {stackSiteCounts(row.bySite).map((segment) => <i key={segment.label} style={{ width: `${segment.width}%`, background: segment.color }} />)}
              </span>
              <strong>{formatNumber(row.count)}</strong>
              <div className={styles.tip} style={{ minWidth: 190 }}>
                <div className={styles.tipMono}>{row.label}</div>
                <ChannelTip rows={siteCountRows(row.bySite)} />
              </div>
            </li>
          ))}
        </ul>
      ) : <p className={styles.empty}>Ainda não há dados para este período.</p>}
    </section>
  );
}

export function CtaCard({ rows }: { rows: AnalyticsRow[] }) {
  return (
    <section className={styles.card} aria-label="Cliques por CTA">
      <div className={styles.cardHead}><h2>Cliques por CTA</h2><span>ponto = onde o clique cai</span></div>
      {rows.length ? (
        <ul className={`${styles.list} ${styles.ctaList}`}>
          {rows.map((row) => (
            <li key={row.label} className={`${styles.ctaRow} ${styles.tipHost}`}>
              <span className={styles.ctaHit}><i style={{ left: `${row.posX ?? 50}%`, top: `${row.posY ?? 50}%` }} /></span>
              <span>{row.label}</span>
              <strong>{formatNumber(row.count)}</strong>
              <div className={styles.tip} style={{ minWidth: 190 }}>
                <div className={styles.tipRow}><span>{row.label}</span><strong>{formatNumber(row.count)}</strong></div>
                <div className={styles.tipHint}>clique médio em x {row.posX ?? 0}% · y {row.posY ?? 0}%</div>
                <div className={styles.tipRule} />
                <ChannelTip rows={siteCountRows(row.bySite)} />
              </div>
            </li>
          ))}
        </ul>
      ) : <p className={styles.empty}>Ainda não há dados para este período.</p>}
    </section>
  );
}

export function WeeklyCard({ points, pagesPerSession }: { points: AnalyticsPoint[]; pagesPerSession: number }) {
  if (!points.length) return <section className={styles.card}><h2>Ritmo semanal</h2><p className={styles.empty}>Ainda não há dados para este período.</p></section>;
  const { rows, max, peak } = weeklyFromSeries(points);
  return (
    <section className={styles.card} aria-label="Ritmo semanal">
      <div className={styles.cardHead}><h2>Ritmo semanal</h2><span>média por dia · pico {peak.label}</span></div>
      <div className={styles.weekly}>
        {rows.map((row) => {
          const isPeak = row.label === peak.label && row.visitors > 0;
          return (
            <div key={row.label} className={`${styles.weekday} ${styles.tipHost}`}>
              <span>
                <i style={{
                  height: `${Math.max(5, (row.visitors / max) * 100)}%`,
                  background: isPeak ? "linear-gradient(180deg,#fd9800,#ec4e22)" : "var(--accent-soft)",
                }} />
              </span>
              <b style={{ color: isPeak ? "var(--accent)" : "var(--ink-3)" }}>{row.label}</b>
              <div className={styles.tip} style={{ bottom: "calc(100% - 16px)", minWidth: 196 }}>
                <div className={styles.tipPairHead}>
                  <span className={styles.tipTitle}>{row.full}</span>
                  <span className={styles.tipPair}>
                    <strong>{formatNumber(row.visitors)}</strong>
                    <strong className={styles.tipViews}>{formatNumber(row.pageviews)}</strong>
                  </span>
                </div>
                <div className={styles.tipRule} />
                <SplitPairTip rows={sitePairRows(row.bySite)} />
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.weeklyFoot}><span>Páginas por sessão</span><strong>{pagesPerSession.toFixed(2).replace(".", ",")}</strong></div>
    </section>
  );
}

export function CompositionCard({
  channels,
  sources,
  devices,
}: {
  channels: Array<{ site: ContactSiteScope; visitors: number }>;
  sources: AnalyticsRow[];
  devices: AnalyticsRow[];
}) {
  const groups = [
    ...(channels.length > 1
      ? [{ title: "Por canal", rows: shareRows(channels.map((channel) => ({ label: CHANNEL_META[channel.site]?.short || channel.site, count: channel.visitors }))) }]
      : []),
    { title: "Por origem", rows: shareRows(sources.map((row) => ({ label: row.label, count: row.count }))) },
    { title: "Por dispositivo", rows: shareRows(devices.map((row) => ({ label: row.label, count: row.count }))) },
  ];
  return (
    <section className={styles.card} aria-label="Composição das sessões">
      <h2>Composição das sessões</h2>
      {groups.map((group) => (
        <div key={group.title} className={styles.shareGroup}>
          <span>{group.title}</span>
          <div className={styles.shareBar}>
            {group.rows.map((row) => <span key={row.label} title={`${row.label}: ${row.pct}`} style={{ width: `${row.width}%`, background: row.color }} />)}
          </div>
          <div className={styles.shareLegend}>
            {group.rows.map((row) => (
              <span key={row.label}><i className={styles.dot} style={{ background: row.color }} />{row.label} <em>{row.pct}</em></span>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
