'use client';

import { Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { Outlet } from 'react-router';

import { LeaderboardPanel } from '@/features/Leaderboard';

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    display: flex;
    min-height: 100vh;
    background: ${cssVar.colorBgLayout};
  `,
  left: css`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
  `,
  right: css`
    width: 420px;
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
    display: flex;
    flex-direction: column;
  `,
  mobile: css`
    display: none;
  `,
}));

const SignInLayout = () => {
  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <Flexbox style={{ width: '100%', maxWidth: 400 }}>
          <Outlet />
        </Flexbox>
      </div>
      <div className={styles.right}>
        <LeaderboardPanel />
      </div>
    </div>
  );
};

export default SignInLayout;