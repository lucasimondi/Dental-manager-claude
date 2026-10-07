import { ITALIAN_DOMAIN_SYNONYMS } from './poliedron-language-data.js';
const clean=(v='')=>String(v).normalize('NFC').trim().replace(/\s+/g,' ');
export function normalizeItalianOperational(text=''){let q=clean(text).toLocaleLowerCase('it-IT').replace(/[’‘]/g,"'").replace(/\b(?:una?\s+)?pulizia\b/g,'igiene').replace(/\bseduta\s+di\s+igiene\b/g,'igiene').replace(/\bprenot(?:a|ami|are)\b/g,'fissa').replace(/\bmetti\b/g,'fissa').replace(/\bvisita\b/g,'appuntamento').replace(/\balle\s+tre\b/g,'alle 15');return clean(q)}
export function domainVocabulary(){return Object.fromEntries(Object.entries(ITALIAN_DOMAIN_SYNONYMS).map(([k,v])=>[k,[...v]]))}
