/**
 * app-state.js — Estado global e helpers compartilhados
 *
 * FIX #11 (modularização parcial): Extraído de main.js para que
 * auth.js e outros módulos futuros possam importar sem duplicar.
 */

/* ── CONFIGURAÇÃO CENTRALIZADA ── */
export const SUPABASE_URL      = 'https://mxiimxjfmzrucbpxpzfp.supabase.co';
export const SUPABASE_ANON     = 'sb_publishable_tjnWY72wHtjrxE8mJ44qdQ_dShpIzPF';
export const CLOUDINARY_CLOUD  = 'dnq9s0g7v';
export const CLOUDINARY_PRESET = 'Siteplanejadoentreaspas';
export const EMAIL_DOMAIN      = '@tropinha.local';

/* ── ESTADO GLOBAL ──
 * Objeto único que percorre toda a sessão. Cada módulo importa
 * este objeto e lê/escreve diretamente — sem setter/getter por
 * enquanto, pois a app ainda não exige reatividade.
 */
export const app = {
  usuario:            null,
  perfil:             null,
  simuladoAtual:      null,
  tentativaId:        null,
  respostas:          {},
  advertencias:       0,
  realtimeCanal:      null,
  salvamentoInterval: null,
  pendingImages:      [],
  pendingLinks:       [],
  avatarPendente:     null,
  inativoTimer:       null,
  inativoAvisoTimer:  null,    // FIX #7: aviso 30s antes da advertência
  advModalAberto:     false,
  abaAtiva:           'inicio',
  threadPubId:        null,
  editorSimuladoId:   null,
  editorQuestaoId:    null,
  editorQuestaoImgs:  [],
  blocoPendingImgs:   [],
  blocoPendingLinks:  [],
  blocoEditandoId:    null,
  matEditandoId:      null,
  simEditandoId:      null,
  confirmCallback:    null,
  materiaSelecionadaId: null,
  _linkTarget:        null,
  _blocoExistingImgs: [],
  _questaoExistingImgs: [],
};

/* ── HELPERS ── */

/** Escapa HTML para evitar XSS ao inserir strings no DOM via innerHTML */
export function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/** Retorna as iniciais (até 2) de um nome completo */
export function iniciais(nome) {
  if (!nome) return '?';
  return nome.trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

/** Converte um timestamp ISO em texto relativo ("agora", "5 min", "2h", "3d") */
export function tempoRelativo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const seg  = Math.floor(diff / 1000);
  if (seg < 60)  return 'agora';
  const min = Math.floor(seg / 60);
  if (min < 60)  return `${min} min`;
  const h   = Math.floor(min / 60);
  if (h < 24)    return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Emoji representativo de desempenho (0-100) */
export function emojiPorValor(pct) {
  if (pct <= 10) return '😞';
  if (pct <= 25) return '😢';
  if (pct <= 40) return '🤡';
  if (pct <= 55) return '💪';
  if (pct <= 65) return '🎯';
  if (pct <= 80) return '⚡';
  if (pct <= 90) return '😄';
  return '😎';
}

/** Ícone por tipo de material */
export function tipoIcone(tipo) {
  const map = {
    edital: '📜', pdf: '📄', video: '🎬',
    ppt: '📊', doc: '📝', site: '🌐',
    assunto: '📚', outro: '📎',
  };
  return map[tipo] || '📎';
}

/* ── TOAST ── */
export function toast(msg, tipo = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  const icons = { success: '✅', error: '❌', warn: '⚠️' };
  el.innerHTML = `<span>${icons[tipo] || 'ℹ️'}</span> <span>${esc(msg)}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4400);
}

/* ── MODAL DE CONFIRMAÇÃO ── */
export function confirmar(titulo, texto, onOk, btnLabel = 'Confirmar') {
  document.getElementById('modal-confirmar-titulo').textContent = titulo;
  document.getElementById('modal-confirmar-texto').textContent  = texto;
  document.getElementById('btn-confirmar-ok').textContent       = btnLabel;
  app.confirmCallback = onOk;
  document.getElementById('modal-confirmar').classList.remove('hidden');
}
