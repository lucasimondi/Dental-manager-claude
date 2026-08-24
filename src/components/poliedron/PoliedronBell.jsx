import React from 'react';

/* POL-UI-015 §7/§8 — the Poliedron notification bell.

   POL-CHAT-001 merge (PR #53 into the merged PR #51): PR #51 could only
   ship this as a UI-ONLY PLACEHOLDER — `unreadCount` had no producer
   anywhere (every caller passed 0) and the click reopened the quick
   Poliedron panel, because no persistent Chat existed yet. PR #53 supplies
   both halves of the contract the placeholder documented: a real unread
   count, produced by `usePoliedronConversation()` from the persisted
   conversation, and a real destination, the persistent Chat page.

   What is deliberately UNCHANGED from PR #51, because the Product Owner
   approved it: the component's look, and its mobile/desktop positioning
   (see `.poliedron-bell--mobile` / `--desktop` in PremiumVisualSystem.css —
   mobile sits entirely above the floating dock's top edge, desktop sits
   top-right, clear of the Edge Dock and the sidebar).

   Still ONE Poliedron: the Chat page is a portal host that the single
   Poliedron instance renders into (see App.jsx's `poliedronChatHost` and
   Poliedron.jsx's `chatHost`), so this is one more entry point into the
   same agent and the same conversation — never a second agent, a second
   open state, or a second route to a different assistant. */
export default function PoliedronBell({ variant = 'mobile', unreadCount = 0, onOpenChat }) {
  const hasUnread = unreadCount > 0;
  return (
    <button
      type="button"
      className={`poliedron-bell poliedron-bell--${variant}${hasUnread ? ' has-unread' : ''}`}
      aria-label={hasUnread
        ? `Chat Poliedron: ${unreadCount} ${unreadCount === 1 ? 'messaggio non letto' : 'messaggi non letti'}`
        : 'Apri la Chat Poliedron'}
      onClick={onOpenChat}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3a6 6 0 0 0-6 6v3.09c0 .5-.16.99-.46 1.4L4 15.5a1 1 0 0 0 .8 1.6h14.4a1 1 0 0 0 .8-1.6l-1.54-2.01a2.4 2.4 0 0 1-.46-1.4V9a6 6 0 0 0-6-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      {hasUnread && (
        <span className="poliedron-bell__badge" aria-hidden="true">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
