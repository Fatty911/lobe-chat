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

    @media (max-width: 767px) {
      display: block;
    }
  `,
  left: css`
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;

    padding: 32px;

    @media (max-width: 767px) {
      min-height: 100svh;
      padding: 24px 16px;
    }
  `,
  right: css`
    display: flex;
    flex-direction: column;

    width: min(620px, 45vw);
    min-width: 480px;
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorBgContainer};

    @media (max-width: 767px) {
      width: 100%;
      min-width: 0;
      border-block-start: 1px solid ${cssVar.colorBorderSecondary};
      border-inline-start: 0;
    }
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
