import { ModelTag } from '@lobehub/icons';
import { Flexbox } from '@lobehub/ui';
import React, { memo, useMemo, useState } from 'react';
import { shallow } from 'zustand/shallow';

import { DEFAULT_AVATAR } from '@/const/meta';
import { INBOX_SESSION_ID } from '@/const/session';
import { isDesktop } from '@/const/version';
import { useChatStore } from '@/store/chat';
import { operationSelectors } from '@/store/chat/selectors';
import { useGlobalStore } from '@/store/global';
import { useSessionStore } from '@/store/session';
import { sessionHelpers } from '@/store/session/helpers';
import { sessionMetaSelectors, sessionSelectors } from '@/store/session/selectors';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';
import { type LobeGroupSession } from '@/types/session';

import ListItem from '../../ListItem';
import CreateGroupModal from '../../Modals/CreateGroupModal';
import RenameAgentModal from '../../Modals/RenameAgentModal';
import Actions from './Actions';

interface SessionItemProps {
  id: string;
}

const SessionItem = memo<SessionItemProps>(({ id }) => {
  const [open, setOpen] = useState(false);
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [renameAgentModalOpen, setRenameAgentModalOpen] = useState(false);

  const openAgentInNewWindow = useGlobalStore((s) => s.openAgentInNewWindow);

  const [active] = useSessionStore((s) => [s.activeId === id]);
  const [loading] = useChatStore((s) => [
    operationSelectors.isAgentRuntimeRunning(s) && id === s.activeAgentId,
  ]);

  const [pin, title, avatar, avatarBackground, updateAt, members, model, group, sessionType, agentId] =
    useSessionStore((s) => {
      const session = sessionSelectors.getSessionById(id)(s);
      const meta = session.meta;

      return [
        sessionHelpers.getSessionPinned(session),
        sessionMetaSelectors.getTitle(meta),
        sessionMetaSelectors.getAvatar(meta),
        meta.backgroundColor,
        session?.updatedAt,
        (session as LobeGroupSession).members,
        session.type === 'agent' ? (session as any).model : undefined,
        session?.group,
        session.type,
        session.type === 'agent' ? (session as any).config?.id : undefined,
      ];
    });

  // Only hide the model tag for the inbox session itself (Lobe AI)
  const showModel = sessionType === 'agent' && model && id !== INBOX_SESSION_ID;

  const handleDoubleClick = () => {
    if (isDesktop) {
      openAgentInNewWindow(id);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    // Set drag data to identify the session being dragged
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // If drag ends without being dropped in a valid target, open in new window
    if (isDesktop && e.dataTransfer.dropEffect === 'none') {
      openAgentInNewWindow(id);
    }
  };

  const actions = useMemo(
    () => (
      <Actions
        group={group}
        id={id}
        openCreateGroupModal={() => setCreateGroupModalOpen(true)}
        openRenameModal={
          sessionType === 'agent' ? () => setRenameAgentModalOpen(true) : undefined
        }
        parentType={sessionType}
        setOpen={setOpen}
      />
    ),
    [group, id, sessionType],
  );

  const addon = useMemo(
    () =>
      !showModel ? undefined : (
        <Flexbox horizontal gap={4} style={{ flexWrap: 'wrap' }}>
          <ModelTag model={model} />
        </Flexbox>
      ),
    [showModel, model],
  );

  const currentUser = useUserStore((s) => ({
    avatar: userProfileSelectors.userAvatar(s),
    name: userProfileSelectors.displayUserName(s) || userProfileSelectors.nickName(s) || 'You',
  }));

  const sessionAvatar: string | { avatar: string; background?: string }[] =
    sessionType === 'group'
      ? [
          {
            avatar: currentUser.avatar || DEFAULT_AVATAR,
            background: undefined,
          },
          ...(members?.map((member) => ({
            avatar: member.avatar || DEFAULT_AVATAR,
            background: member.backgroundColor || undefined,
          })) || []),
        ]
      : avatar;

  return (
    <>
      <ListItem
        actions={actions}
        active={active}
        addon={addon}
        avatar={sessionAvatar as any} // Fix: Bypass complex intersection type ReactNode & avatar type
        avatarBackground={avatarBackground}
        date={updateAt?.valueOf()}
        draggable={isDesktop}
        key={id}
        loading={loading}
        pin={pin}
        showAction={open}
        title={title}
        type={sessionType}
        styles={{
          container: {
            gap: 12,
          },
          content: {
            gap: 6,
            maskImage: `linear-gradient(90deg, #000 90%, transparent)`,
          },
        }}
        onDoubleClick={handleDoubleClick}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
      />
      <CreateGroupModal
        id={id}
        open={createGroupModalOpen}
        onCancel={() => setCreateGroupModalOpen(false)}
      />
      {sessionType === 'agent' && agentId && (
        <RenameAgentModal
          id={agentId}
          open={renameAgentModalOpen}
          onCancel={() => setRenameAgentModalOpen(false)}
        />
      )}
    </>
  );
}, shallow);

export default SessionItem;
