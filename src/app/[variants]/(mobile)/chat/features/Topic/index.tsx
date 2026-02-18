import { Flexbox } from '@lobehub/ui';

import TopicListContent from '@/app/[variants]/(main)/agent/_layout/Sidebar/Topic/TopicListContent';
import TopicSearchBar from '@/app/[variants]/(main)/agent/_layout/Sidebar/Topic/TopicSearchBar';

import AgentConfig from './features/AgentConfig';
import TopicModal from './features/TopicModal';

const Topic = () => {
  return (
    <TopicModal>
      <Flexbox gap={8} height={'100%'} padding={'8px 8px 0'} style={{ overflow: 'hidden' }}>
        <AgentConfig />
        <TopicSearchBar />
        <Flexbox
          flex={1}
          style={{ marginInline: -8, overflowX: 'hidden', overflowY: 'auto', position: 'relative' }}
          width={'calc(100% + 16px)'}
        >
          <TopicListContent />
        </Flexbox>
      </Flexbox>
    </TopicModal>
  );
};

export default Topic;
