export const parseCSV = (text) => {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i], next = clean[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== '');
};

export const splitNomeKanino = (raw) => {
  if (!raw) return { cognome: '', nome: '' };
  let s = raw.trim().replace(/[A-Z]\d{4}$/, '').trim();
  const parts = s.split(/\s+/);
  if (parts.length < 2) return { cognome: s, nome: '' };
  const nome = parts[parts.length - 1];
  const cognome = parts.slice(0, -1).join(' ');
  const cap = (s) => s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return { cognome: cap(cognome), nome: cap(nome) };
};

export const cleanTelefono = (raw) => {
  if (!raw) return '';
  let t = raw.trim();
  const matches = t.match(/\+?39[\s\d]{8,}/g);
  if (matches && matches.length > 0) t = matches[0];
  return t.replace(/\s+/g, ' ').trim();
};
