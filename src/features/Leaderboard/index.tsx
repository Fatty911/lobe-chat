'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { Skeleton } from 'antd';
import { createStaticStyles } from 'antd-style';
import { type CSSProperties, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getLeaderboardData, type LeaderboardEntry } from '@/services/leaderboardService';

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    overflow-y: auto;
    max-height: 100vh;
    padding: 24px;

    @media (max-width: 767px) {
      overflow-y: visible;
      max-height: none;
      padding: 16px 12px 24px;
    }
  `,
  header: css`
    flex-wrap: wrap;
    margin-block-end: 16px;
  `,
  tableWrapper: css`
    overflow-x: auto;
  `,
  table: css`
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;

    @media (max-width: 767px) {
      table-layout: fixed;
      font-size: 12px;
    }
  `,
  th: css`
    position: sticky;
    z-index: 1;
    inset-block-start: 0;

    padding-block: 8px;
    padding-inline: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
    text-align: start;

    background: ${cssVar.colorBgContainer};

    @media (max-width: 767px) {
      padding-inline: 6px;
    }
  `,
  td: css`
    padding-block: 6px;
    padding-inline: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    @media (max-width: 767px) {
      padding-inline: 6px;
    }
  `,
  rankColumn: css`
    width: 52px;

    @media (max-width: 767px) {
      width: 38px;
    }
  `,
  modelCell: css`
    overflow-wrap: anywhere;
  `,
  organizationColumn: css`
    width: 168px;

    @media (max-width: 767px) {
      display: none;
    }
  `,
  mobileOrganization: css`
    display: none;

    @media (max-width: 767px) {
      display: block;
      margin-block-start: 2px;
      font-size: 10px;
      color: ${cssVar.colorTextTertiary};
    }
  `,
  rankBadge: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    width: 24px;
    height: 24px;
    border-radius: 50%;

    font-size: 12px;
    font-weight: 700;
  `,
  scoreCell: css`
    font-family: monospace;
    color: ${cssVar.colorPrimary};
    text-align: end;
  `,
  cnBadge: css`
    margin-inline-start: 4px;
    padding-block: 0;
    padding-inline: 4px;
    border-radius: 4px;

    font-size: 10px;
    color: ${cssVar.colorWhite};

    background: ${cssVar.colorError};
  `,
  skeleton: css`
    margin-block-end: 8px;
  `,
  empty: css`
    padding-block: 32px;
    color: ${cssVar.colorTextTertiary};
    text-align: center;
  `,
}));

export const LeaderboardPanel = () => {
  const { t } = useTranslation('auth');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [fallbackDate, setFallbackDate] = useState<string>();

  const rankStyle = (rank: number): CSSProperties => {
    if (rank === 1) return { background: 'var(--ant-color-warning, #f59e0b)', color: 'var(--ant-color-white, #fff)' };
    if (rank === 2) return { background: 'var(--ant-color-text-tertiary, #94a3b8)', color: 'var(--ant-color-white, #fff)' };
    if (rank === 3) return { background: 'var(--ant-orange-7, #d97706)', color: 'var(--ant-color-white, #fff)' };
    return { color: 'var(--ant-color-text-tertiary, #94a3b8)' };
  };

  const organizationLabel = (organization: string) => {
    if (organization === 'SpaceXAI / xAI') return t('leaderboard.provider.muskFamily');
    if (organization === 'Z.ai / Zhipu') return t('leaderboard.provider.zhipu');
    return organization;
  };

  useEffect(() => {
    let active = true;
    getLeaderboardData().then((result) => {
      if (!active) return;
      setData(result.data);
      setIsLive(result.isLive);
      setFallbackDate(result.fallbackDate);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={styles.container}>
      <Flexbox align={'center'} className={styles.header} gap={4}>
        <Text style={{ fontSize: 16, fontWeight: 700 }}>{t('leaderboard.title')}</Text>
        <Text style={{ fontSize: 11 }} type={'secondary'}>
          {t('leaderboard.source')}
        </Text>
        {loading ? (
          <Text style={{ fontSize: 11 }} type={'warning'}>
            {t('leaderboard.loading')}
          </Text>
        ) : isLive ? (
          <Text style={{ fontSize: 11, color: 'var(--ant-color-success, #22c55e)' }}>
            {t('leaderboard.status.live')}
          </Text>
        ) : (
          <Text style={{ fontSize: 11 }} type={'warning'}>
            {t('leaderboard.status.cached')}
            {fallbackDate ? ` (${fallbackDate})` : ''}
          </Text>
        )}
        {!loading && (
          <Text style={{ fontSize: 11 }} type={'secondary'}>
            {t('leaderboard.count', { count: data.length })}
          </Text>
        )}
      </Flexbox>

      {loading ? (
        <Flexbox gap={8}>
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton.Input
              active
              block
              className={styles.skeleton}
              key={`sk-${i}`}
              size="small"
            />
          ))}
        </Flexbox>
      ) : (
        <div className={styles.tableWrapper}>
          <table aria-label={t('leaderboard.title')} className={styles.table}>
            <thead>
              <tr>
                <th className={`${styles.th} ${styles.rankColumn}`} scope="col">
                  {t('leaderboard.columns.rank')}
                </th>
                <th className={styles.th} scope="col">
                  {t('leaderboard.columns.model')}
                </th>
                <th className={`${styles.th} ${styles.organizationColumn}`} scope="col">
                  {t('leaderboard.columns.organization')}
                </th>
                <th className={styles.th} scope="col" style={{ textAlign: 'right' }}>
                  {t('leaderboard.columns.score')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => (
                <tr key={`${entry.rank}-${entry.model}`}>
                  <td className={styles.td}>
                    <span className={styles.rankBadge} style={rankStyle(entry.rank)}>
                      {entry.rank}
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.modelCell}`}>
                    {entry.model}
                    {entry.is_chinese && (
                      <span className={styles.cnBadge}>{t('leaderboard.tag.cn')}</span>
                    )}
                    <span className={styles.mobileOrganization}>
                      {organizationLabel(entry.organization)}
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.organizationColumn}`}>
                    {organizationLabel(entry.organization)}
                  </td>
                  <td className={`${styles.td} ${styles.scoreCell}`}>
                    {entry.arena_score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && <div className={styles.empty}>{t('leaderboard.empty')}</div>}
        </div>
      )}
    </div>
  );
};
