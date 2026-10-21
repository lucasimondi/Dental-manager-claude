import React from 'react';
export default function EmbeddedForm({ title, children }) {
  return <section className="appointment-embedded-form" aria-label={title}><h3>{title}</h3>{children}</section>;
}
