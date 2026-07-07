'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { Skeleton } from 'antd';
import { createStaticStyles } from 'antd-style';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getLeaderboardData, type LeaderboardEntry } from '@/services/leaderboardService';

const useStyles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    padding: 24px;
    max-height: 100vh;
    overflow-y: auto;
  `,
  table: css`
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  `,
  th: css`
    text-align: left;
    padding: 8px 12px;
    color: ${cssVar.colorTextSecondary};
    font-weight: 600;
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
    position: sticky;
    top: 0;
    background: ${cssVar.colorBgContainer};
    z-index: 1;
  `,
  td: css`
    padding: 6px 12px;
    border-bottom: 1px solid ${cssVar.colorBorderSecondary};
  `,
  rankBadge: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-weight: 700;
    font-size: 12px;
  `,
  scoreCell: css`
    text-align: right;
    font-family: monospace;
    color: ${cssVar.colorPrimary};
  `,
  cnBadge: css`
    font-size: 10px;
    background: ${cssVar.colorError};
    color: ${cssVar.colorWhite};
    padding: 0 4px;
    border-radius: 4px;
    margin-left: 4px;
  `,
  skeleton: css`
    margin-bottom: 8px;
  `,
}));

export const LeaderboardPanel = () => {
  const { styles } = useStyles();
  const { t } = useTranslation('auth');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [fallbackDate, setFallbackDate] = useState<string>();

  const rankStyle = (rank: number): React.CSSProperties => {
    if (rank === 1) return { background: 'var(--ant-color-warning, #f59e0b)', color: 'var(--ant-color-white, #fff)' };
    if (rank === 2) return { background: 'var(--ant-color-text-tertiary, #94a3b8)', color: 'var(--ant-color-white, #fff)' };
    if (rank === 3) return { background: 'var(--ant-orange-7, #d97706)', color: 'var(--ant-color-white, #fff)' };
    return { color: 'var(--ant-color-text-tertiary, #94a3b8)' };
  };

  useEffect(() => {
    getLeaderboardData().then((result) => {
      setData(result.data);
      setIsLive(result.isLive);
      setFallbackDate(result.fallbackDate);
      setLoading(false);
    });
  }, []);

  return (
    <div className={styles.container}>
      <Flexbox align={'center'} gap={4} style={{ marginBottom: 16 }}>
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
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>{t('leaderboard.columns.rank')}</th>
              <th className={styles.th}>{t('leaderboard.columns.model')}</th>
              <th className={styles.th} style={{ textAlign: 'right' }}>
                {t('leaderboard.columns.score')}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 30).map((entry) => (
              <tr key={entry.model}>
                <td className={styles.td}>
                  <span className={styles.rankBadge} style={rankStyle(entry.rank)}>
                    {entry.rank}
                  </span>
                </td>
                <td className={styles.td}>
                  {entry.model}
                  {entry.is_chinese && <span className={styles.cnBadge}>{t('leaderboard.tag.cn')}</span>}
                </td>
                <td className={`${styles.td} ${styles.scoreCell}`}>
                  {entry.arena_score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};