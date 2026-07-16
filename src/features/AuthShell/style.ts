import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  content: css`
    flex: 1;
    height: 100%;
    min-height: 0;

    @media (max-width: 767px) {
      flex: none;
      height: auto;
    }
  `,
  divider: css`
    height: 24px;
  `,

  innerContainer: css`
    position: relative;

    overflow: hidden;
    height: 100%;
    min-height: 0;

    @media (max-width: 767px) {
      overflow: visible;
      height: auto;
      min-height: 100%;
    }
  `,

  innerContainerDark: css`
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};

    background: ${cssVar.colorBgContainer};
  `,

  innerContainerLight: css`
    border: 1px solid ${cssVar.colorBorder};
    border-radius: ${cssVar.borderRadius};

    background: ${cssVar.colorBgContainer};
  `,

  outerContainer: css`
    position: relative;

    overflow: hidden;
    height: 100%;
    min-height: 0;

    @media (max-width: 767px) {
      overflow-y: auto;
      height: 100vh;
      height: 100dvh;
    }
  `,
}));
