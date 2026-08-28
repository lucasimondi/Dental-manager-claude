import React from 'react';

export default function MobilePageShell({ children, specialized = false, className = '', as: Element = 'div', ...props }) {
  const mode = specialized ? 'specialized' : 'normal';
  return (
    <Element
      {...props}
      className={['pol-mobile-page-shell', `pol-mobile-page-shell--${mode}`, className].filter(Boolean).join(' ')}
    >
      {children}
    </Element>
  );
}
