/**
 * main.js — Ponto de entrada do app Tropinha
 *
 * CORREÇÕES APLICADAS (ver tropinha-tech-review.md):
 *  #1  – Comentários aninhados: renderização em árvore recursiva
 *  #2  – Label "Apelido" → "Login" na tela de acesso
 *  #4  – Média geral via RPC calcular_media_usuario (fim do hardcode 0%)
 *  #5  – Realtime de comentários re-renderiza árvore em vez de appendar
 *  #6  – salvarParcial com indicador de status + retry automático
 *  #7  – Monitoramento: mousemove + timeout 3 min + aviso prévio 30s
 *  #8  – abrirEditorSimulado redireciona para quiz-editor-v2.html?sim=ID
 *  #8.3– filtro status='publicado' nas queries de simulados (dashboard + listagem)
 *  #9  – Comentário documental sobre o soft delete de materiais
 *  #11 – app-state.js extraído; main.js importa de lá
 *
 * #3 (search_path fixo) e #10 (painel admin) estão no schema.sql e ADMIN.md.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
import { initBackgroundCarousel } from './carousel-bg.js';
import {
  SUPABASE_URL, SUPABASE_ANON,
  CLOUDINARY_CLOUD, CLOUDINARY_PRESET, EMAIL_DOMAIN,
  app, esc, iniciais, tempoRelativo, emojiPorValor, tipoIcone,
  toast, confirmar,
} from './app-state.js';

initBackgroundCarousel();
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ── CLOUDINARY ── */
async function uploadCloudinary(file) {
  if (!file) return null;
  if (file.size > 6 * 1024 * 1024) { toast('Imagem excede 6 MB', 'error'); return null; }
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  try {
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    return data.secure_url || null;
  } catch { toast('Falha no upload de imagem', 'error'); return null; }
}

/* ── LIGHTBOX ── */
function abrirLightbox(src) { document.getElementById('lightbox-img').src = src; document.getElementById('lightbox').classList.remove('hidden'); }
function fecharLightbox()   { document.getElementById('lightbox').classList.add('hidden'); }
document.getElementById('lightbox-close').addEventListener('click', fecharLightbox);
document.getElementById('lightbox').addEventListener('click', e => { if (e.target === e.currentTarget) fecharLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharLightbox(); });
document.addEventListener('click',   e => { if (e.target.matches('.post-images img, .bloco-images img, .questao-images img')) abrirLightbox(e.target.src); });

/* ── LOGS ── */
async function registrarLog(acao, detalhes = {}) {
  if (!app.usuario) return;
  try { await sb.from('logs').insert({ usuario_id: app.usuario.id, acao, detalhes }); } catch {}
}

/* ── MODAL CONFIRMACAO wiring ── */
document.getElementById('btn-confirmar-cancel').addEventListener('click', () => { document.getElementById('modal-confirmar').classList.add('hidden'); app.confirmCallback = null; });
document.getElementById('btn-confirmar-ok').addEventListener('click',     () => { document.getElementById('modal-confirmar').classList.add('hidden'); if (app.confirmCallback) app.confirmCallback(); app.confirmCallback = null; });

/* ── NAVEGACAO ── */
function navegarPara(sec) {
  document.getElementById('main-app').classList.remove('hidden');
  document.getElementById('tela-simulado').classList.add('hidden');
  document.getElementById('tela-editor-simulado').classList.add('hidden');
  document.getElementById('feed-mural').style.display = '';
  document.getElementById('tela-thread').classList.remove('active');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelector(`.section[data-section="${sec}"]`)?.classList.add('active');
  document.querySelectorAll('.nav-btn, .mnav-btn').forEach(b => b.classList.toggle('active', b.dataset.section === sec));
  app.abaAtiva = sec;
  if (sec === 'inicio')    carregarInicio();
  if (sec === 'mural')     carregarMural();
  if (sec === 'conteudo')  carregarConteudo();
  if (sec === 'simulados') carregarSimulados();
  if (sec === 'materiais') carregarMateriais();
}

/* ══════════════════════════════════════════════════════════
   AUTENTICACAO
══════════════════════════════════════════════════════════ */
async function iniciar() {
  const hash = window.location.hash;
  if (hash.includes('access_token') && hash.includes('type=recovery')) {
    document.getElementById('banner-reset').classList.remove('hidden');
    document.getElementById('form-nova-senha').classList.remove('hidden');
    document.getElementById('inp-apelido').closest('.form-group').classList.add('hidden');
    document.getElementById('inp-senha').closest('.form-group').classList.add('hidden');
    document.getElementById('btn-entrar').classList.add('hidden');
    document.getElementById('btn-esqueci').classList.add('hidden');
    return;
  }
  const { data: { session } } = await Promise.race([
    sb.auth.getSession(),
    new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
  ]).catch(() => ({ data: { session: null } }));
  if (!session) return;
  app.usuario = session.user;
  const { data: perfil } = await sb.from('usuarios').select('*').eq('id', session.user.id).single();
  if (!perfil) { await sb.auth.signOut(); return; }
  app.perfil = perfil;
  mostrarApp();
}

function mostrarApp() {
  document.getElementById('tela-login').classList.add('hidden');
  document.getElementById('header').classList.remove('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  document.getElementById('mobile-nav').classList.remove('hidden');
  const nome = app.perfil.nome || app.perfil.apelido;
  document.getElementById('header-nome').textContent     = nome;
  document.getElementById('header-initials').textContent = iniciais(nome);
  document.getElementById('dd-nome').textContent         = nome;
  const roleMap = { admin: 'tag-admin', professor: 'tag-prof', aluno: 'tag-aluno' };
  document.getElementById('dd-role').innerHTML = `<span class="tag-role ${roleMap[app.perfil.role] || 'tag-aluno'}">${esc(app.perfil.role)}</span>`;
  if (app.perfil.foto_url) document.getElementById('header-avatar').innerHTML = `<img src="${esc(app.perfil.foto_url)}" alt="${esc(nome)}" />`;
  if (app.perfil.role !== 'aluno') {
    ['mural-compose-area','btn-novo-bloco','btn-novo-simulado','btn-novo-material']
      .forEach(id => document.getElementById(id)?.classList.remove('hidden'));
  }
  iniciarRealtime();
  navegarPara('inicio');
}

/* FIX #2: label renomeado no HTML de "Apelido" para "Login". O JS permanece igual pois
 * a concatenacao com EMAIL_DOMAIN era e continua sendo a lógica correta.
 */
document.getElementById('btn-entrar').addEventListener('click', async () => {
  const login = document.getElementById('inp-apelido').value.trim();
  const senha = document.getElementById('inp-senha').value;
  if (!login || !senha) { document.getElementById('login-erro').textContent = 'Preencha login e senha.'; return; }
  const btn = document.getElementById('btn-entrar');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  document.getElementById('login-erro').textContent = '';
  const { data, error } = await sb.auth.signInWithPassword({ email: login + EMAIL_DOMAIN, password: senha });
  btn.disabled = false; btn.innerHTML = 'Entrar';
  if (error) { document.getElementById('login-erro').textContent = 'Login ou senha incorretos.'; return; }
  app.usuario = data.user;
  const { data: perfil } = await sb.from('usuarios').select('*').eq('id', data.user.id).single();
  if (!perfil) { document.getElementById('login-erro').textContent = 'Perfil não encontrado. Contate o admin.'; return; }
  app.perfil = perfil;
  await registrarLog('login');
  mostrarApp();
});
document.getElementById('inp-senha').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('btn-entrar').click(); });

document.getElementById('btn-esqueci').addEventListener('click', async () => {
  const login = document.getElementById('inp-apelido').value.trim();
  if (!login) { document.getElementById('login-erro').textContent = 'Digite seu login primeiro.'; return; }
  await sb.auth.resetPasswordForEmail(login + EMAIL_DOMAIN);
  document.getElementById('login-erro').style.color = 'var(--success)';
  document.getElementById('login-erro').textContent = 'Link de redefinição enviado (se o e-mail existir).';
});

document.getElementById('btn-salvar-nova-senha').addEventListener('click', async () => {
  const novaSenha = document.getElementById('inp-nova-senha').value;
  if (novaSenha.length < 6) { toast('Senha deve ter ao menos 6 caracteres', 'warn'); return; }
  const { error } = await sb.auth.updateUser({ password: novaSenha });
  if (error) { toast('Erro ao salvar senha', 'error'); return; }
  toast('Senha atualizada! Faça login.', 'success');
  window.location.hash = ''; window.location.reload();
});

document.getElementById('dd-logout').addEventListener('click', async () => {
  await registrarLog('logout');
  if (app.realtimeCanal)      sb.removeChannel(app.realtimeCanal);
  if (app.salvamentoInterval) clearInterval(app.salvamentoInterval);
  await sb.auth.signOut();
  window.location.reload();
});

document.getElementById('account-trigger').addEventListener('click', e => { e.stopPropagation(); document.getElementById('account-dropdown').classList.toggle('hidden'); });
document.addEventListener('click', () => document.getElementById('account-dropdown').classList.add('hidden'));
document.getElementById('dd-perfil').addEventListener('click', abrirModalPerfil);
document.getElementById('dd-senha').addEventListener('click', () => { document.getElementById('account-dropdown').classList.add('hidden'); document.getElementById('modal-senha').classList.remove('hidden'); });
document.getElementById('btn-senha-cancelar').addEventListener('click', () => document.getElementById('modal-senha').classList.add('hidden'));
document.getElementById('btn-senha-enviar').addEventListener('click', async () => { await sb.auth.resetPasswordForEmail(app.perfil.apelido + EMAIL_DOMAIN); toast('Link de redefinição enviado!', 'success'); document.getElementById('modal-senha').classList.add('hidden'); });

function abrirModalPerfil() {
  document.getElementById('account-dropdown').classList.add('hidden');
  const pv = document.getElementById('perfil-avatar-preview');
  if (app.perfil.foto_url) pv.innerHTML = `<img src="${esc(app.perfil.foto_url)}" alt="avatar" />`;
  else pv.textContent = iniciais(app.perfil.nome || app.perfil.apelido);
  document.getElementById('perfil-nome').value = app.perfil.nome || '';
  document.getElementById('modal-perfil').classList.remove('hidden');
}
document.getElementById('btn-perfil-fechar').addEventListener('click', () => document.getElementById('modal-perfil').classList.add('hidden'));
document.getElementById('btn-trocar-avatar').addEventListener('click', () => document.getElementById('file-avatar').click());
document.getElementById('file-avatar').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  app.avatarPendente = file;
  document.getElementById('perfil-avatar-preview').innerHTML = `<img src="${URL.createObjectURL(file)}" alt="preview" />`;
});
document.getElementById('btn-perfil-salvar').addEventListener('click', async () => {
  const nome = document.getElementById('perfil-nome').value.trim();
  let foto_url = app.perfil.foto_url;
  if (app.avatarPendente) { const url = await uploadCloudinary(app.avatarPendente); if (url) foto_url = url; app.avatarPendente = null; }
  const { error } = await sb.from('usuarios').update({ nome, foto_url }).eq('id', app.usuario.id);
  if (error) { toast('Erro ao salvar perfil', 'error'); return; }
  app.perfil = { ...app.perfil, nome, foto_url };
  document.getElementById('header-nome').textContent = nome;
  document.getElementById('dd-nome').textContent     = nome;
  if (foto_url) document.getElementById('header-avatar').innerHTML = `<img src="${esc(foto_url)}" alt="${esc(nome)}" />`;
  else document.getElementById('header-initials').textContent = iniciais(nome);
  toast('Perfil salvo!', 'success');
  document.getElementById('modal-perfil').classList.add('hidden');
});

/* ══════════════════════════════════════════════════════════
   REALTIME — FIX #5: comentários re-renderizam árvore inteira
══════════════════════════════════════════════════════════ */
function iniciarRealtime() {
  if (app.realtimeCanal) sb.removeChannel(app.realtimeCanal);
  app.realtimeCanal = sb.channel('tropinha-realtime')
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'publicacoes' }, async payload => {
      const { data: post } = await sb.from('publicacoes').select('*, usuarios(nome, foto_url), reacoes(id, usuario_id)').eq('id', payload.new.id).single();
      if (post) prependPostCard(post);
    })
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'reacoes' }, payload => {
      const card = document.querySelector(`[data-pub-id="${payload.new.publicacao_id}"]`);
      if (card) { const cnt = card.querySelector('.reaction-count'); if (cnt) cnt.textContent = parseInt(cnt.textContent||0)+1; }
    })
    .on('postgres_changes', { event:'DELETE', schema:'public', table:'reacoes' }, payload => {
      const card = document.querySelector(`[data-pub-id="${payload.old?.publicacao_id}"]`);
      if (card) { const cnt = card.querySelector('.reaction-count'); if (cnt) cnt.textContent = Math.max(0, parseInt(cnt.textContent||0)-1); }
    })
    /* FIX #1 + #5: re-renderiza a árvore inteira ao receber novo comentário */
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'comentarios' }, async payload => {
      if (app.threadPubId && payload.new.publicacao_id === app.threadPubId) {
        await carregarThread(app.threadPubId);
      }
    })
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'curtidas_comentario' }, payload => {
      const el = document.querySelector(`[data-com-id="${payload.new.comentario_id}"] .com-like-count`);
      if (el) el.textContent = parseInt(el.textContent||0)+1;
    })
    .on('postgres_changes', { event:'DELETE', schema:'public', table:'curtidas_comentario' }, payload => {
      const el = document.querySelector(`[data-com-id="${payload.old?.comentario_id}"] .com-like-count`);
      if (el) el.textContent = Math.max(0, parseInt(el.textContent||0)-1);
    })
    .subscribe();
}

document.querySelectorAll('.nav-btn, .mnav-btn').forEach(btn => btn.addEventListener('click', () => navegarPara(btn.dataset.section)));

/* ══════════════════════════════════════════════════════════
   INÍCIO — DASHBOARD
══════════════════════════════════════════════════════════ */
async function carregarInicio() { await carregarStats(); await carregarLogsRecentes(); await carregarSimuladosQuick(); }

async function carregarStats() {
  const uid = app.usuario.id;
  const { data: tentativas } = await sb.from('tentativas_simulado').select('id, advertencias, simulado_id, status').eq('usuario_id', uid).eq('status', 'concluido');
  const totalFeitos = tentativas?.length || 0;

  /* FIX #4: RPC calcula a média no banco (gabarito nunca vai ao cliente) */
  const { data: mediaData } = await sb.rpc('calcular_media_usuario', { uid });
  const mediaGeral = mediaData ?? 0;

  const totalAdv = tentativas?.reduce((acc, t) => acc+(t.advertencias||0), 0) || 0;
  const maxAdv   = totalFeitos*5 || 1;
  const advPct   = Math.min(100, Math.round((totalAdv/maxAdv)*100));

  /* FIX #8.3: filtro status='publicado' */
  const { count: totalSims } = await sb.from('simulados').select('*', { count:'exact', head:true }).eq('ativo', true).eq('status', 'publicado');
  const feitosPct = totalSims ? Math.min(100, Math.round((totalFeitos/totalSims)*100)) : 0;

  const statsGrid = document.getElementById('stats-grid');
  statsGrid.innerHTML = '';
  const statsData = [
    { label:'Simulados Feitos', valor: totalFeitos,      pct: feitosPct, cor:'var(--accent)' },
    { label:'Média Geral',      valor: `${mediaGeral}%`, pct: mediaGeral, cor:'var(--success)' },
    { label:'Advertências',     valor: totalAdv,         pct: advPct,    cor: advPct>60?'var(--danger)':'var(--warn)' },
  ];
  statsData.forEach(({ label, valor, pct, cor }) => {
    const card = document.createElement('div'); card.className = 'stat-card';
    const canvasId = `canvas-${Math.random().toString(36).slice(2)}`;
    card.innerHTML = `<div class="stat-card-glow"></div><div class="stat-label">${esc(label)}</div><div class="stat-body"><div class="stat-value">${esc(String(valor))}</div><canvas class="stat-canvas" id="${canvasId}" width="56" height="56" title="Clique para comemorar!"></canvas></div>`;
    statsGrid.appendChild(card);
    card.querySelector('.stat-card-glow').style.opacity = (pct/100)*0.5;
    if (pct > 20) gerarParticulasGlitter(card, pct);
    const ctx = document.getElementById(canvasId).getContext('2d');
    desenharPizza(ctx, pct, cor);
    document.getElementById(canvasId).addEventListener('click', e => lancarEmojis(e, pct));
  });
}

function desenharPizza(ctx, pct, cor) {
  const cx=28,cy=28,r=24,stroke=5;
  ctx.clearRect(0,0,56,56);
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.strokeStyle='var(--bg-4)'; ctx.lineWidth=stroke; ctx.stroke();
  if (pct>0) { const end=-Math.PI/2+(pct/100)*Math.PI*2; ctx.beginPath(); ctx.arc(cx,cy,r,-Math.PI/2,end); ctx.strokeStyle=cor; ctx.lineWidth=stroke; ctx.lineCap='round'; ctx.stroke(); }
}
function gerarParticulasGlitter(card, pct) {
  const count=Math.floor(pct/20);
  for (let i=0;i<count;i++) { const p=document.createElement('span'); p.className='glitter-particle'; const size=Math.random()*3+1; p.style.cssText=`width:${size}px;height:${size}px;left:${Math.random()*100}%;top:${Math.random()*100}%;background:${Math.random()>0.5?'var(--accent)':'var(--accent-2)'};--op:${0.3+Math.random()*0.4};--dur:${1.5+Math.random()*2}s;--gx:${(Math.random()-0.5)*20}px;--gy:${(Math.random()-0.5)*20}px;animation-delay:${Math.random()*2}s;`; card.appendChild(p); }
}
function lancarEmojis(e, pct) {
  const emoji=emojiPorValor(pct);
  for (let i=0;i<6;i++) { const el=document.createElement('div'); el.className='emoji-launch'; el.textContent=emoji; el.style.cssText=`left:${e.clientX}px;top:${e.clientY}px;--dx:${(Math.random()-0.5)*80}px;animation-delay:${i*0.07}s;`; document.body.appendChild(el); el.addEventListener('animationend',()=>el.remove()); }
}

async function carregarLogsRecentes() {
  const { data: logs } = await sb.from('logs').select('*').eq('usuario_id', app.usuario.id).order('criado_em',{ascending:false}).limit(5);
  const container = document.getElementById('panel-logs'); if (!logs?.length) return;
  const acaoMap={login:'🔑',logout:'🚪',abriu_simulado:'🎯',concluiu_simulado:'✅',advertencia:'⚠️',expulso:'🚫',reagiu:'❤️',publicacao_criada:'📋',comentou:'💬',curtiu_comentario:'👍',compartilhou:'🔗',importou_questoes:'📥'};
  container.innerHTML=logs.map(l=>`<div class="log-item"><span class="log-icon">${acaoMap[l.acao]||'📌'}</span><div><div class="log-text">${esc(l.acao.replace(/_/g,' '))}</div><div class="log-time">${tempoRelativo(l.criado_em)}</div></div></div>`).join('');
}

async function carregarSimuladosQuick() {
  /* FIX #8.3: filtro status='publicado' */
  const { data: sims } = await sb.from('simulados').select('*').eq('ativo', true).eq('status','publicado').order('criado_em',{ascending:false}).limit(5);
  const container = document.getElementById('panel-sims'); if (!sims?.length) return;
  container.innerHTML=sims.map(s=>`<div class="sim-quick-item"><div><div class="sim-quick-name">${esc(s.nome)}</div><div class="sim-quick-meta">${s.total_questoes||0} questões · <span class="badge badge-${s.tipo}">${esc(s.tipo)}</span></div></div><button class="btn-primary btn-sm" onclick="window._iniciarSimulado('${esc(s.id)}')">Iniciar</button></div>`).join('');
}
window._iniciarSimulado = id => abrirSimulado(id);

/* ══════════════════════════════════════════════════════════
   MURAL
══════════════════════════════════════════════════════════ */
async function carregarMural() {
  const feed=document.getElementById('feed-mural');
  feed.innerHTML='<div class="empty-state"><div class="spinner" style="width:24px;height:24px;margin:auto"></div></div>';
  const { data: posts }=await sb.from('publicacoes').select('*, usuarios(nome, foto_url), reacoes(id, usuario_id)').order('fixado',{ascending:false}).order('criado_em',{ascending:false});
  feed.innerHTML='';
  if (!posts?.length) { feed.innerHTML='<div class="empty-state"><div class="empty-icon">📋</div><p>Nenhuma publicação ainda.</p></div>'; return; }
  posts.forEach(p=>feed.appendChild(criarPostCard(p)));
  const av=document.getElementById('compose-avatar');
  if (app.perfil.foto_url) av.innerHTML=`<img src="${esc(app.perfil.foto_url)}" alt="" />`;
  else document.getElementById('compose-initials').textContent=iniciais(app.perfil.nome||app.perfil.apelido);
}

function criarPostCard(post) {
  const card=document.createElement('div'); card.className=`post-card${post.fixado?' fixado':''}`; card.dataset.pubId=post.id;
  const nome=post.usuarios?.nome||'Usuário', temReacao=post.reacoes?.some(r=>r.usuario_id===app.usuario?.id), numReacoes=post.reacoes?.length||0;
  const imgsHtml=(post.imagens||[]).map(u=>`<img src="${esc(u)}" alt="imagem do post" loading="lazy" />`).join('');
  const linksHtml=(post.links||[]).map(l=>`<a class="post-link-chip" href="${esc(l.url)}" target="_blank" rel="noopener">🔗 ${esc(l.texto||l.url)}</a>`).join('');
  const manageHtml=app.perfil.role!=='aluno'?`<div class="post-manage"><button class="post-manage-btn danger" onclick="excluirPost('${esc(post.id)}',event)">🗑️</button><button class="post-manage-btn" onclick="toggleFixado('${esc(post.id)}',${post.fixado},event)">${post.fixado?'📌 Desafixar':'📌 Fixar'}</button></div>`:'';
  card.innerHTML=`<div class="post-header"><div class="avatar-sm">${post.usuarios?.foto_url?`<img src="${esc(post.usuarios.foto_url)}" alt="" />`:iniciais(nome)}</div><span class="post-author-name">${esc(nome)}</span><span class="post-time">${tempoRelativo(post.criado_em)}</span></div>${post.texto?`<div class="post-text">${esc(post.texto)}</div>`:''} ${imgsHtml?`<div class="post-images">${imgsHtml}</div>`:''} ${linksHtml?`<div class="post-links">${linksHtml}</div>`:''}<div class="post-footer"><button class="reaction-btn${temReacao?' ativo':''}" data-pub="${esc(post.id)}">❤️ <span class="reaction-count">${numReacoes}</span></button><button class="reaction-btn" onclick="abrirThread('${esc(post.id)}',event)">💬</button><button class="reaction-btn" onclick="compartilharPost('${esc(post.id)}',event)">🔗</button>${manageHtml}</div>`;
  card.addEventListener('click',e=>{ if(e.target.closest('button')||e.target.closest('a')||e.target.closest('img')) return; abrirThread(post.id); });
  card.querySelector('.reaction-btn[data-pub]').addEventListener('click',async e=>{ e.stopPropagation(); await toggleReacao(post.id,e.currentTarget); });
  return card;
}

function prependPostCard(post) { const feed=document.getElementById('feed-mural'); const emptyEl=feed.querySelector('.empty-state'); if(emptyEl)emptyEl.remove(); feed.prepend(criarPostCard(post)); }

async function toggleReacao(pubId,btn) {
  const jaCurtiu=btn.classList.contains('ativo'), cnt=btn.querySelector('.reaction-count');
  if(jaCurtiu) { btn.classList.remove('ativo'); cnt.textContent=Math.max(0,parseInt(cnt.textContent||0)-1); await sb.from('reacoes').delete().eq('publicacao_id',pubId).eq('usuario_id',app.usuario.id); }
  else { btn.classList.add('ativo'); cnt.textContent=parseInt(cnt.textContent||0)+1; await sb.from('reacoes').insert({publicacao_id:pubId,usuario_id:app.usuario.id}); }
  await registrarLog('reagiu',{publicacao_id:pubId});
}

window.excluirPost  = async(id,e)=>{ e.stopPropagation(); confirmar('Excluir publicação','Esta ação não pode ser desfeita.',async()=>{ await sb.from('publicacoes').delete().eq('id',id); document.querySelector(`[data-pub-id="${id}"]`)?.remove(); toast('Publicação excluída','success'); },'Excluir'); };
window.toggleFixado = async(id,atual,e)=>{ e.stopPropagation(); await sb.from('publicacoes').update({fixado:!atual}).eq('id',id); carregarMural(); };

document.getElementById('btn-publicar').addEventListener('click', async()=>{
  const texto=document.getElementById('compose-texto').value.trim();
  if(!texto&&!app.pendingImages.length&&!app.pendingLinks.length){toast('Escreva algo antes de publicar.','warn');return;}
  const btn=document.getElementById('btn-publicar'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
  const urls=[];
  for(const {file} of app.pendingImages){const url=await uploadCloudinary(file);if(url)urls.push(url);}
  const fixado=document.getElementById('chk-fixado').checked;
  const{data,error}=await sb.from('publicacoes').insert({autor_id:app.usuario.id,texto:texto||null,imagens:urls,links:app.pendingLinks,fixado}).select('*, usuarios(nome, foto_url), reacoes(id, usuario_id)').single();
  btn.disabled=false; btn.textContent='Publicar';
  if(error){toast('Erro ao publicar','error');return;}
  document.getElementById('compose-texto').value=''; document.getElementById('chk-fixado').checked=false;
  app.pendingImages=[]; app.pendingLinks=[];
  document.getElementById('pending-images-preview').innerHTML=''; document.getElementById('pending-links-list').innerHTML='';
  await registrarLog('publicacao_criada',{publicacao_id:data.id}); toast('Publicado!','success');
});

document.getElementById('btn-add-imagem').addEventListener('click',()=>document.getElementById('file-compose-img').click());
document.getElementById('file-compose-img').addEventListener('change',e=>{
  Array.from(e.target.files).forEach(file=>{ if(app.pendingImages.length>=6){toast('Máximo 6 imagens','warn');return;} const previewUrl=URL.createObjectURL(file); app.pendingImages.push({file,previewUrl}); const wrap=document.createElement('div'); wrap.className='pending-img-wrap'; const idx=app.pendingImages.length-1; wrap.innerHTML=`<img src="${previewUrl}" alt="" /><button class="pending-img-remove" onclick="removerPendingImg(${idx})">✕</button>`; document.getElementById('pending-images-preview').appendChild(wrap); }); e.target.value='';
});
window.removerPendingImg=idx=>{app.pendingImages.splice(idx,1);renderPendingImages();};
function renderPendingImages(){const c=document.getElementById('pending-images-preview');c.innerHTML='';app.pendingImages.forEach(({previewUrl},i)=>{const wrap=document.createElement('div');wrap.className='pending-img-wrap';wrap.innerHTML=`<img src="${previewUrl}" alt="" /><button class="pending-img-remove" onclick="removerPendingImg(${i})">✕</button>`;c.appendChild(wrap);});}

document.getElementById('btn-add-link').addEventListener('click',()=>{app._linkTarget='compose';document.getElementById('modal-link').classList.remove('hidden');});
document.getElementById('btn-link-cancelar').addEventListener('click',()=>document.getElementById('modal-link').classList.add('hidden'));
document.getElementById('btn-link-confirmar').addEventListener('click',()=>{
  const texto=document.getElementById('inp-link-texto').value.trim(),url=document.getElementById('inp-link-url').value.trim();
  if(!url){toast('URL obrigatória','warn');return;}
  if(app._linkTarget==='compose'){app.pendingLinks.push({texto:texto||url,url});renderPendingLinks();}
  else if(app._linkTarget==='bloco'){app.blocoPendingLinks.push({texto:texto||url,url});renderBlocoLinks();}
  document.getElementById('inp-link-texto').value=''; document.getElementById('inp-link-url').value='';
  document.getElementById('modal-link').classList.add('hidden');
});
function renderPendingLinks(){const c=document.getElementById('pending-links-list');c.innerHTML='';app.pendingLinks.forEach((l,i)=>{const div=document.createElement('div');div.className='pending-link-item';div.innerHTML=`<span>🔗 ${esc(l.texto)}</span><button onclick="removerPendingLink(${i})">✕</button>`;c.appendChild(div);});}
window.removerPendingLink=i=>{app.pendingLinks.splice(i,1);renderPendingLinks();};

/* ══════════════════════════════════════════════════════════
   THREAD / COMENTÁRIOS  —  FIX #1: árvore recursiva
══════════════════════════════════════════════════════════ */
window.abrirThread=async(pubId,e)=>{
  if(e)e.stopPropagation();
  app.threadPubId=pubId;
  document.getElementById('feed-mural').style.display='none';
  document.getElementById('tela-thread').classList.add('active');
  const av=document.getElementById('thread-compose-avatar');
  if(app.perfil.foto_url)av.innerHTML=`<img src="${esc(app.perfil.foto_url)}" alt="" />`;
  else document.getElementById('thread-compose-initials').textContent=iniciais(app.perfil.nome||app.perfil.apelido);
  await carregarThread(pubId);
};

async function carregarThread(pubId) {
  const{data:post}=await sb.from('publicacoes').select('*, usuarios(nome, foto_url), reacoes(id, usuario_id)').eq('id',pubId).single();
  const container=document.getElementById('thread-post-container');
  if(post){
    const nome=post.usuarios?.nome||'Usuário',temReacao=post.reacoes?.some(r=>r.usuario_id===app.usuario?.id),numReacoes=post.reacoes?.length||0;
    const imgsHtml=(post.imagens||[]).map(u=>`<img src="${esc(u)}" style="max-width:100%;border-radius:10px;margin-bottom:8px;" />`).join('');
    const linksHtml=(post.links||[]).map(l=>`<a class="post-link-chip" href="${esc(l.url)}" target="_blank" rel="noopener">🔗 ${esc(l.texto||l.url)}</a>`).join('');
    container.innerHTML=`<div class="thread-post-full"><div class="post-header"><div class="avatar-sm">${post.usuarios?.foto_url?`<img src="${esc(post.usuarios.foto_url)}" alt="" />`:iniciais(nome)}</div><span class="post-author-name">${esc(nome)}</span><span class="post-time">${tempoRelativo(post.criado_em)}</span></div>${post.texto?`<div class="post-text" style="font-size:16px;">${esc(post.texto)}</div>`:''} ${imgsHtml} ${linksHtml?`<div class="post-links">${linksHtml}</div>`:''}<div class="post-footer"><button class="reaction-btn${temReacao?' ativo':''}" id="thread-reacao-btn" data-pub="${esc(pubId)}">❤️ <span class="reaction-count">${numReacoes}</span></button><button class="reaction-btn" onclick="compartilharPost('${esc(pubId)}')">🔗 Compartilhar</button></div></div>`;
    document.getElementById('thread-reacao-btn').addEventListener('click',async e=>{e.stopPropagation();await toggleReacao(pubId,e.currentTarget);});
  }

  /* FIX #1: busca todos os comentários e monta árvore */
  const{data:comentarios}=await sb.from('comentarios').select('*, usuarios(nome, foto_url), curtidas_comentario(id, usuario_id)').eq('publicacao_id',pubId).order('criado_em');
  const lista=document.getElementById('comments-list'); lista.innerHTML='';
  if(!comentarios?.length){lista.innerHTML='<div class="empty-state"><p>Nenhum comentário ainda.</p></div>';return;}

  // Mapa id → nó com filhos vazios
  const mapa={};
  comentarios.forEach(c=>{ mapa[c.id]={...c,filhos:[]}; });

  // Liga cada comentário ao seu pai
  const raizes=[];
  comentarios.forEach(c=>{
    if(c.parent_id && mapa[c.parent_id]) mapa[c.parent_id].filhos.push(mapa[c.id]);
    else raizes.push(mapa[c.id]);
  });

  // Renderiza recursivamente
  raizes.forEach(r=>lista.appendChild(renderArvoreComentario(r,0)));
}

function renderArvoreComentario(no, profundidade) {
  const recuoVisual=Math.min(profundidade,4);
  const wrapper=document.createElement('div');
  wrapper.style.marginLeft=`${recuoVisual*20}px`;
  wrapper.appendChild(criarCommentCard(no, profundidade>0));
  no.filhos.forEach(filho=>wrapper.appendChild(renderArvoreComentario(filho,profundidade+1)));
  return wrapper;
}

function criarCommentCard(com, isReply=false) {
  const div=document.createElement('div'); div.className=`comment-card${isReply?' reply':''}`; div.dataset.comId=com.id;
  const nome=com.usuarios?.nome||'Usuário', jaCurtiu=com.curtidas_comentario?.some(c=>c.usuario_id===app.usuario?.id), numCurtidas=com.curtidas_comentario?.length||0;
  const podeExcluir=app.usuario?.id===com.autor_id||app.perfil.role!=='aluno';
  div.innerHTML=`<div class="comment-header"><div class="avatar-sm" style="width:26px;height:26px;font-size:11px;">${com.usuarios?.foto_url?`<img src="${esc(com.usuarios.foto_url)}" alt="" />`:iniciais(nome)}</div><span class="comment-name">${esc(nome)}</span><span class="comment-time">${tempoRelativo(com.criado_em)}</span></div><div class="comment-text">${esc(com.texto)}</div><div class="comment-footer"><button class="reaction-btn${jaCurtiu?' ativo':''}" onclick="toggleCurtidaComentario('${esc(com.id)}',this)">❤️ <span class="com-like-count">${numCurtidas}</span></button><button class="reaction-btn" onclick="abrirReplyCompose('${esc(com.id)}')">↩️ Responder</button>${podeExcluir?`<button class="reaction-btn danger-text" onclick="excluirComentario('${esc(com.id)}')">🗑️</button>`:''}</div><div id="reply-compose-${com.id}" class="hidden"></div>`;
  return div;
}

window.abrirReplyCompose=parentId=>{
  const area=document.getElementById(`reply-compose-${parentId}`); if(!area)return;
  if(!area.classList.contains('hidden')){area.classList.add('hidden');return;}
  area.classList.remove('hidden');
  area.innerHTML=`<div class="reply-compose"><textarea class="compose-textarea" id="reply-text-${parentId}" rows="2" placeholder="Escreva uma resposta…"></textarea><div style="display:flex;justify-content:flex-end;margin-top:8px;gap:8px;"><button class="btn-ghost btn-sm" onclick="document.getElementById('reply-compose-${parentId}').classList.add('hidden')">Cancelar</button><button class="btn-primary btn-sm" onclick="enviarResposta('${parentId}')">Responder</button></div></div>`;
};

window.enviarResposta=async parentId=>{
  const texto=document.getElementById(`reply-text-${parentId}`)?.value.trim(); if(!texto)return;
  await sb.from('comentarios').insert({publicacao_id:app.threadPubId,autor_id:app.usuario.id,parent_id:parentId,texto});
  document.getElementById(`reply-compose-${parentId}`).classList.add('hidden');
  await registrarLog('comentou',{publicacao_id:app.threadPubId});
  // Realtime dispara carregarThread automaticamente (FIX #5)
};

window.excluirComentario=async id=>{confirmar('Excluir comentário','Esta ação não pode ser desfeita.',async()=>{await sb.from('comentarios').delete().eq('id',id);document.querySelector(`[data-com-id="${id}"]`)?.remove();toast('Comentário excluído','success');},'Excluir');};

window.toggleCurtidaComentario=async(comId,btn)=>{
  const jaCurtiu=btn.classList.contains('ativo'),cnt=btn.querySelector('.com-like-count');
  if(jaCurtiu){btn.classList.remove('ativo');cnt.textContent=Math.max(0,parseInt(cnt.textContent||0)-1);await sb.from('curtidas_comentario').delete().eq('comentario_id',comId).eq('usuario_id',app.usuario.id);}
  else{btn.classList.add('ativo');cnt.textContent=parseInt(cnt.textContent||0)+1;await sb.from('curtidas_comentario').insert({comentario_id:comId,usuario_id:app.usuario.id});}
  await registrarLog('curtiu_comentario',{comentario_id:comId});
};

document.getElementById('btn-comentar').addEventListener('click',async()=>{
  const texto=document.getElementById('thread-compose-texto').value.trim(); if(!texto)return;
  const btn=document.getElementById('btn-comentar'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
  await sb.from('comentarios').insert({publicacao_id:app.threadPubId,autor_id:app.usuario.id,parent_id:null,texto});
  btn.disabled=false; btn.textContent='Comentar';
  document.getElementById('thread-compose-texto').value='';
  await registrarLog('comentou',{publicacao_id:app.threadPubId});
});

document.getElementById('btn-thread-back').addEventListener('click',()=>{ app.threadPubId=null; document.getElementById('feed-mural').style.display=''; document.getElementById('tela-thread').classList.remove('active'); });

window.compartilharPost=async(pubId,e)=>{ if(e)e.stopPropagation(); const url=`${location.href.split('#')[0]}#pub-${pubId}`; await navigator.clipboard.writeText(url).catch(()=>{}); await sb.from('compartilhamentos').insert({publicacao_id:pubId,usuario_id:app.usuario.id}).catch(()=>{}); await registrarLog('compartilhou',{publicacao_id:pubId}); toast('Link copiado!','success'); };

/* ══════════════════════════════════════════════════════════
   CONTEÚDO
══════════════════════════════════════════════════════════ */
async function carregarConteudo(){
  const{data:blocos}=await sb.from('conteudo_abas').select('*').order('ordem');
  const containers={'edital':document.getElementById('blocos-edital'),'assuntos':document.getElementById('blocos-assuntos'),'videos':document.getElementById('blocos-videos'),'materiais-aba':document.getElementById('blocos-materiais-aba')};
  Object.values(containers).forEach(c=>c.innerHTML='');
  (blocos||[]).forEach(b=>{const c=containers[b.aba];if(c)c.appendChild(criarBlocoCard(b));});
  Object.entries(containers).forEach(([,c])=>{if(!c.children.length)c.innerHTML='<div class="empty-state"><div class="empty-icon">📄</div><p>Nenhum conteúdo ainda.</p></div>';});
}
function criarBlocoCard(bloco){
  const div=document.createElement('div');div.className='bloco-card';
  const imgsHtml=(bloco.imagens||[]).map(u=>`<img src="${esc(u)}" alt="" loading="lazy" />`).join('');
  const linksHtml=(bloco.links||[]).map(l=>`<a class="post-link-chip" href="${esc(l.url)}" target="_blank" rel="noopener">🔗 ${esc(l.texto||l.url)}</a>`).join('');
  const manageHtml=app.perfil.role!=='aluno'?`<div class="bloco-manage"><button class="btn-ghost btn-sm" onclick="editarBloco('${esc(bloco.id)}')">✏️ Editar</button><button class="btn-danger btn-sm" onclick="excluirBloco('${esc(bloco.id)}')">🗑️</button></div>`:'';
  div.innerHTML=`<div class="bloco-header"><div class="bloco-titulo">${esc(bloco.titulo)}</div>${manageHtml}</div>${bloco.corpo?`<div class="bloco-corpo">${esc(bloco.corpo)}</div>`:''}${imgsHtml?`<div class="bloco-images">${imgsHtml}</div>`:''}${linksHtml?`<div class="bloco-links">${linksHtml}</div>`:''}`;
  return div;
}
document.querySelectorAll('.aba-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.aba-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.aba-content').forEach(c=>c.classList.remove('active'));btn.classList.add('active');document.querySelector(`[data-aba-content="${btn.dataset.aba}"]`)?.classList.add('active');});});
document.getElementById('btn-novo-bloco').addEventListener('click',()=>{app.blocoEditandoId=null;app.blocoPendingImgs=[];app.blocoPendingLinks=[];document.getElementById('modal-bloco-titulo').textContent='Novo bloco';document.getElementById('bloco-titulo-inp').value='';document.getElementById('bloco-corpo-inp').value='';document.getElementById('bloco-images-preview').innerHTML='';document.getElementById('bloco-links-preview').innerHTML='';const abaAtiva=document.querySelector('.aba-btn.active')?.dataset.aba;if(abaAtiva)document.getElementById('bloco-aba').value=abaAtiva;document.getElementById('modal-bloco').classList.remove('hidden');});
window.editarBloco=async id=>{const{data:b}=await sb.from('conteudo_abas').select('*').eq('id',id).single();if(!b)return;app.blocoEditandoId=id;app.blocoPendingImgs=[];app.blocoPendingLinks=[...(b.links||[])];document.getElementById('modal-bloco-titulo').textContent='Editar bloco';document.getElementById('bloco-aba').value=b.aba;document.getElementById('bloco-titulo-inp').value=b.titulo||'';document.getElementById('bloco-corpo-inp').value=b.corpo||'';document.getElementById('bloco-images-preview').innerHTML=(b.imagens||[]).map((u,i)=>`<div class="pending-img-wrap"><img src="${esc(u)}" alt="" /><button class="pending-img-remove" onclick="removerBlocoImgExist(${i})">✕</button></div>`).join('');app._blocoExistingImgs=[...(b.imagens||[])];renderBlocoLinks();document.getElementById('modal-bloco').classList.remove('hidden');};
window.removerBlocoImgExist=i=>{app._blocoExistingImgs?.splice(i,1);};
document.getElementById('btn-bloco-add-img').addEventListener('click',()=>document.getElementById('file-bloco-img').click());
document.getElementById('file-bloco-img').addEventListener('change',e=>{Array.from(e.target.files).forEach(file=>{const previewUrl=URL.createObjectURL(file);app.blocoPendingImgs.push({file,previewUrl});const wrap=document.createElement('div');wrap.className='pending-img-wrap';wrap.innerHTML=`<img src="${previewUrl}" alt="" /><button class="pending-img-remove">✕</button>`;wrap.querySelector('button').addEventListener('click',()=>{const i=app.blocoPendingImgs.findIndex(p=>p.previewUrl===previewUrl);if(i>=0)app.blocoPendingImgs.splice(i,1);wrap.remove();});document.getElementById('bloco-images-preview').appendChild(wrap);});e.target.value='';});
document.getElementById('btn-bloco-add-link').addEventListener('click',()=>{app._linkTarget='bloco';document.getElementById('modal-link').classList.remove('hidden');});
function renderBlocoLinks(){const c=document.getElementById('bloco-links-preview');c.innerHTML='';(app.blocoPendingLinks||[]).forEach((l,i)=>{const div=document.createElement('div');div.className='pending-link-item';div.innerHTML=`<span>🔗 ${esc(l.texto)}</span><button onclick="removerBlocoLink(${i})">✕</button>`;c.appendChild(div);});}
window.removerBlocoLink=i=>{app.blocoPendingLinks.splice(i,1);renderBlocoLinks();};
document.getElementById('btn-bloco-cancelar').addEventListener('click',()=>document.getElementById('modal-bloco').classList.add('hidden'));
document.getElementById('btn-bloco-salvar').addEventListener('click',async()=>{
  const aba=document.getElementById('bloco-aba').value,titulo=document.getElementById('bloco-titulo-inp').value.trim(),corpo=document.getElementById('bloco-corpo-inp').value.trim();
  if(!titulo){toast('Título obrigatório','warn');return;}
  const btn=document.getElementById('btn-bloco-salvar');btn.disabled=true;btn.innerHTML='<span class="spinner"></span>';
  const novasUrls=[];for(const{file}of app.blocoPendingImgs){const url=await uploadCloudinary(file);if(url)novasUrls.push(url);}
  const imagens=[...(app._blocoExistingImgs||[]),...novasUrls];
  const payload={aba,titulo,corpo,imagens,links:app.blocoPendingLinks};let error;
  if(app.blocoEditandoId){({error}=await sb.from('conteudo_abas').update(payload).eq('id',app.blocoEditandoId));}
  else{const{data:ord}=await sb.from('conteudo_abas').select('ordem').order('ordem',{ascending:false}).limit(1).single();payload.ordem=(ord?.ordem||0)+1;({error}=await sb.from('conteudo_abas').insert(payload));}
  btn.disabled=false;btn.textContent='Salvar bloco';
  document.getElementById('modal-bloco').classList.add('hidden');
  if(error){toast('Erro ao salvar bloco','error');return;}
  toast('Bloco salvo!','success');carregarConteudo();
});
window.excluirBloco=id=>{confirmar('Excluir bloco','Esta ação não pode ser desfeita.',async()=>{await sb.from('conteudo_abas').delete().eq('id',id);toast('Bloco excluído','success');carregarConteudo();},'Excluir');};

/* ══════════════════════════════════════════════════════════
   SIMULADOS — FIX #8.3: filtro status='publicado'
══════════════════════════════════════════════════════════ */
async function carregarSimulados(){
  const{data:materias}=await sb.from('materias').select('*, simulados(id,nome,ativo,tipo,total_questoes,status)').order('ordem');
  const materiasGrid=document.getElementById('materias-grid'); materiasGrid.innerHTML='';
  const isProf=app.perfil.role!=='aluno';
  (materias||[]).forEach(m=>{
    const div=document.createElement('div');div.className='materia-card';
    const count=m.simulados?.filter(s=>isProf?true:(s.ativo&&s.status==='publicado')).length||0;
    div.innerHTML=`<span class="materia-icon">${esc(m.icone||'📚')}</span><div><div class="materia-name">${esc(m.nome)}</div><div class="materia-count">${count} simulado${count!==1?'s':''}</div></div>`;
    div.style.borderColor=app.materiaSelecionadaId===m.id?(m.cor||'var(--accent)'):(m.cor||'');
    div.addEventListener('click',()=>{
      if(app.materiaSelecionadaId===m.id){app.materiaSelecionadaId=null;document.getElementById('materia-sims-panel').classList.add('hidden');document.querySelectorAll('.materia-card').forEach(c=>c.style.outline='');}
      else{app.materiaSelecionadaId=m.id;abrirPainelSimuladosMateria(m);document.querySelectorAll('.materia-card').forEach(c=>c.style.outline='');div.style.outline=`2px solid ${m.cor||'var(--accent)'}`;}
    });
    materiasGrid.appendChild(div);
  });
  if(!materias?.length)materiasGrid.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📚</div><p>Nenhuma matéria cadastrada.</p></div>';
  const{data:gerais}=await sb.from('simulados').select('*').eq('tipo','geral').eq('ativo',true).eq('status','publicado').order('criado_em',{ascending:false});
  const lista=document.getElementById('simulados-geral-lista');lista.innerHTML='';
  (gerais||[]).forEach(s=>lista.appendChild(criarSimCard(s)));
  if(!gerais?.length)lista.innerHTML='<div class="empty-state"><div class="empty-icon">🎯</div><p>Nenhum simulado geral disponível.</p></div>';
  const sel=document.getElementById('sim-materia-inp');sel.innerHTML='<option value="">— Nenhuma —</option>';
  (materias||[]).forEach(m=>{const opt=document.createElement('option');opt.value=m.id;opt.textContent=m.nome;sel.appendChild(opt);});
  if(app.materiaSelecionadaId){const m=(materias||[]).find(m=>m.id===app.materiaSelecionadaId);if(m)abrirPainelSimuladosMateria(m);}
}

function abrirPainelSimuladosMateria(materia){
  const panel=document.getElementById('materia-sims-panel');
  const isProf=app.perfil.role!=='aluno';
  const simulados=(materia.simulados||[]).filter(s=>isProf?true:(s.ativo&&s.status==='publicado'));
  panel.innerHTML=`<div class="materia-sims-header"><div class="materia-sims-title"><span>${esc(materia.icone||'📚')}</span><span>${esc(materia.nome)}</span><span class="badge badge-materia">${simulados.length} simulado${simulados.length!==1?'s':''}</span></div><button class="btn-ghost btn-sm" onclick="fecharPainelMateria()">✕ Fechar</button></div><div class="materia-sims-lista" id="materia-sims-lista">${simulados.length?'':`<div class="empty-state" style="padding:30px 0;"><div class="empty-icon">📝</div><p>Nenhum simulado nesta matéria.</p></div>`}</div>`;
  const listEl=panel.querySelector('#materia-sims-lista');
  simulados.forEach(s=>listEl.appendChild(criarSimCard(s)));
  panel.classList.remove('hidden');
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}

window.fecharPainelMateria=()=>{app.materiaSelecionadaId=null;document.getElementById('materia-sims-panel').classList.add('hidden');document.querySelectorAll('.materia-card').forEach(c=>c.style.outline='');};

function criarSimCard(sim){
  const div=document.createElement('div');div.className='sim-card';
  const isProf=app.perfil.role!=='aluno';
  const statusBadge=isProf&&sim.status==='rascunho'?'<span class="badge badge-rascunho">rascunho</span>':'';
  div.innerHTML=`<div class="sim-card-left"><div class="sim-card-title">${esc(sim.nome)} ${statusBadge}</div><div class="sim-card-meta">${sim.total_questoes||0} questões · <span class="badge badge-${sim.tipo}">${esc(sim.tipo)}</span></div></div><div class="sim-card-right"><button class="btn-primary btn-sm" onclick="window._iniciarSimulado('${esc(sim.id)}')">Iniciar</button>${isProf?`<button class="btn-ghost btn-sm" onclick="abrirEditorSimulado('${esc(sim.id)}')">✏️ Editar</button>`:''}</div>`;
  return div;
}

document.getElementById('btn-novo-simulado').addEventListener('click',()=>{app.simEditandoId=null;document.getElementById('modal-sim-titulo').textContent='Novo simulado';document.getElementById('sim-nome-inp').value='';document.getElementById('modal-novo-sim').classList.remove('hidden');});
document.getElementById('btn-novo-sim-cancelar').addEventListener('click',()=>document.getElementById('modal-novo-sim').classList.add('hidden'));
document.getElementById('btn-novo-sim-criar').addEventListener('click',async()=>{
  const nome=document.getElementById('sim-nome-inp').value.trim(),tipo=document.getElementById('sim-tipo-inp').value,materia_id=document.getElementById('sim-materia-inp').value||null;
  if(!nome){toast('Nome obrigatório','warn');return;}
  /* FIX #8.3: nasce como rascunho, ativo=false */
  const{error}=await sb.from('simulados').insert({nome,tipo,materia_id,ativo:false,status:'rascunho'});
  document.getElementById('modal-novo-sim').classList.add('hidden');
  if(error){toast('Erro ao criar simulado','error');return;}
  toast('Simulado criado como rascunho!','success');carregarSimulados();
});

/* ══════════════════════════════════════════════════════════
   ABRINDO SIMULADO
══════════════════════════════════════════════════════════ */
async function abrirSimulado(simId){
  const{data:sim}=await sb.from('simulados').select('*').eq('id',simId).single();
  if(!sim){toast('Simulado não encontrado','error');return;}
  let{data:tentativa}=await sb.from('tentativas_simulado').select('*').eq('simulado_id',simId).eq('usuario_id',app.usuario.id).maybeSingle();
  if(tentativa?.status==='concluido'){toast('Você já concluiu este simulado.','warn');return;}
  if(tentativa?.status==='expulso'){toast('Você foi expulso deste simulado.','error');return;}
  if(!tentativa){const{data:nova,error}=await sb.from('tentativas_simulado').insert({simulado_id:simId,usuario_id:app.usuario.id,status:'em_andamento',respostas_parciais:{},advertencias:0}).select().single();if(error){toast('Erro ao iniciar simulado','error');return;}tentativa=nova;}
  const{data:questoes}=await sb.from('questoes_sem_gabarito').select('*').eq('simulado_id',simId).order('ordem');
  if(!questoes?.length){toast('Este simulado não tem questões ainda.','warn');return;}
  app.simuladoAtual=sim;app.tentativaId=tentativa.id;app.respostas=tentativa.respostas_parciais||{};app.advertencias=tentativa.advertencias||0;
  document.getElementById('main-app').classList.add('hidden');document.getElementById('tela-simulado').classList.remove('hidden');
  document.getElementById('sim-titulo-bar').textContent=sim.nome;
  renderizarPips();renderizarQuestoes(questoes);
  app.salvamentoInterval=setInterval(()=>salvarParcial(),30000);
  ativarMonitoramento();
  await registrarLog('abriu_simulado',{simulado_id:simId});
}

function renderizarPips(){document.querySelectorAll('.adv-pip').forEach((pip,i)=>{pip.classList.remove('ativo','danger');if(i<app.advertencias)pip.classList.add(app.advertencias>=4?'danger':'ativo');});}

function renderizarQuestoes(questoes){
  const lista=document.getElementById('questoes-lista');lista.innerHTML='';
  const letras=['A','B','C','D','E'];
  questoes.forEach((q,qi)=>{
    const card=document.createElement('div');card.className='questao-card';
    const imgsHtml=(q.imagens||[]).map(u=>`<img src="${esc(u)}" alt="imagem" loading="lazy" />`).join('');
    card.innerHTML=`<div class="questao-num">Questão ${qi+1}</div><div class="questao-enunciado">${esc(q.enunciado)}</div>${imgsHtml?`<div class="questao-images">${imgsHtml}</div>`:''}<div class="alternativas-lista" data-qid="${esc(q.id)}">${(q.alternativas||[]).map((alt,ai)=>`<button class="alt-btn${app.respostas[q.id]===ai?' selecionada':''}" data-qid="${esc(q.id)}" data-idx="${ai}"><span class="alt-letra">${letras[ai]}</span><span>${esc(alt)}</span></button>`).join('')}</div>`;
    lista.appendChild(card);
  });
  lista.querySelectorAll('.alt-btn').forEach(btn=>{btn.addEventListener('click',()=>{const qid=btn.dataset.qid,idx=parseInt(btn.dataset.idx);app.respostas[qid]=idx;document.querySelectorAll(`.alt-btn[data-qid="${qid}"]`).forEach(b=>b.classList.remove('selecionada'));btn.classList.add('selecionada');const respondidas=Object.keys(app.respostas).length;document.getElementById('sim-progresso').textContent=`${respondidas} respondida${respondidas!==1?'s':''}`;});});
}

/* FIX #6: salvarParcial com indicador de status e retry */
async function salvarParcial(silencioso=true){
  if(!app.tentativaId)return;
  const indicador=document.getElementById('sim-save-status');
  try{
    const{error}=await sb.from('tentativas_simulado').update({respostas_parciais:app.respostas,advertencias:app.advertencias}).eq('id',app.tentativaId);
    if(error)throw error;
    if(indicador){indicador.textContent='✓ Salvo';indicador.className='save-ok';setTimeout(()=>{indicador.textContent='';},3000);}
  }catch(err){
    if(indicador){indicador.textContent='⚠ Falha ao salvar — tentando novamente…';indicador.className='save-error';}
    setTimeout(()=>salvarParcial(false),5000);
  }
}

async function entregarSimulado(){
  await salvarParcial();
  await sb.from('tentativas_simulado').update({status:'concluido',encerrado_em:new Date().toISOString()}).eq('id',app.tentativaId);
  clearInterval(app.salvamentoInterval);app.salvamentoInterval=null;
  removerMonitoramento();
  await registrarLog('concluiu_simulado',{tentativa_id:app.tentativaId});
  toast('Simulado entregue!','success');voltarDashboard();
}
function voltarDashboard(){document.getElementById('tela-simulado').classList.add('hidden');document.getElementById('main-app').classList.remove('hidden');app.simuladoAtual=null;app.tentativaId=null;app.respostas={};app.advertencias=0;navegarPara('inicio');}

document.getElementById('btn-entregar-sim').addEventListener('click',()=>confirmar('Entregar simulado','Tem certeza? Você não poderá alterar suas respostas depois.',entregarSimulado,'Entregar'));
document.getElementById('btn-entregar-sim-2').addEventListener('click',()=>confirmar('Entregar simulado','Tem certeza? Você não poderá alterar suas respostas depois.',entregarSimulado,'Entregar'));
document.getElementById('btn-sair-simulado').addEventListener('click',()=>confirmar('Sair do simulado','Seu progresso será salvo. Você pode retomar depois.',async()=>{await salvarParcial();await registrarLog('saiu_simulado',{tentativa_id:app.tentativaId});voltarDashboard();},'Sair'));

/* ── MONITORAMENTO DE TRAPAÇA  —  FIX #7 ── */
function ativarMonitoramento(){document.addEventListener('visibilitychange',onVisibilityChange);reiniciarTimerInatividade();}
function removerMonitoramento(){
  document.removeEventListener('visibilitychange',onVisibilityChange);
  clearTimeout(app.inativoTimer);clearTimeout(app.inativoAvisoTimer);
  app.inativoTimer=null;app.inativoAvisoTimer=null;
}
function onVisibilityChange(){if(document.hidden)emitirAdvertencia('troca_de_aba');}
function reiniciarTimerInatividade(){
  clearTimeout(app.inativoTimer);clearTimeout(app.inativoAvisoTimer);
  // Aviso 30s antes (aos 2 min 30 s)
  app.inativoAvisoTimer=setTimeout(()=>toast('⚠ Você está inativo. Interaja para não receber advertência.','warn'),150_000);
  // Advertência aos 3 minutos
  app.inativoTimer=setTimeout(()=>emitirAdvertencia('inatividade'),180_000);
}
// FIX #7: mousemove incluído como sinal de presença
document.addEventListener('click',    ()=>{if(app.simuladoAtual)reiniciarTimerInatividade();});
document.addEventListener('keydown',  ()=>{if(app.simuladoAtual)reiniciarTimerInatividade();});
document.addEventListener('mousemove',()=>{if(app.simuladoAtual)reiniciarTimerInatividade();});

async function emitirAdvertencia(motivo){
  if(app.advModalAberto||!app.simuladoAtual)return;
  app.advertencias++;renderizarPips();await salvarParcial();
  await registrarLog('advertencia',{motivo,tentativa_id:app.tentativaId,total:app.advertencias});
  if(app.advertencias>=5){await expulsarAluno();return;}
  app.advModalAberto=true;
  document.getElementById('adv-modal-icon').textContent=app.advertencias>=4?'🚨':'⚠️';
  document.getElementById('adv-modal-texto').textContent=motivo==='troca_de_aba'?`Você trocou de aba! Advertência ${app.advertencias}/5.`:`Inatividade detectada! Advertência ${app.advertencias}/5.`;
  const pipsEl=document.getElementById('adv-modal-pips');pipsEl.innerHTML='';
  for(let i=0;i<5;i++){const p=document.createElement('div');p.className=`adv-modal-pip${i<app.advertencias?(app.advertencias>=4?' danger':' ativo'):''}`;pipsEl.appendChild(p);}
  document.getElementById('modal-adv').classList.remove('hidden');
}
document.getElementById('btn-adv-ok').addEventListener('click',()=>{document.getElementById('modal-adv').classList.add('hidden');app.advModalAberto=false;});

async function expulsarAluno(){
  await sb.from('tentativas_simulado').update({status:'expulso'}).eq('id',app.tentativaId);
  await registrarLog('expulso',{tentativa_id:app.tentativaId});
  removerMonitoramento();clearInterval(app.salvamentoInterval);
  toast('Você foi expulso do simulado após 5 advertências.','error');voltarDashboard();
}

/* ══════════════════════════════════════════════════════════
   EDITOR DE SIMULADO  —  FIX #8: redireciona para v2
══════════════════════════════════════════════════════════ */
window.abrirEditorSimulado = simId => {
  window.location.href = `/dashboard-turma/src/pages/quiz-editor-v2.html?sim=${simId}`;
};

/* ══════════════════════════════════════════════════════════
   MATERIAIS  —  FIX #9 (soft delete documentado)
══════════════════════════════════════════════════════════ */
async function carregarMateriais(){
  const{data:mats}=await sb.from('materiais').select('*').eq('visivel',true).order('criado_em',{ascending:false});
  const grid=document.getElementById('materiais-grid');grid.innerHTML='';
  if(!mats?.length){grid.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📁</div><p>Nenhum material disponível.</p></div>';return;}
  mats.forEach(m=>{
    const div=document.createElement('div');
    div.innerHTML=`<a class="material-card" href="${esc(m.url)}" target="_blank" rel="noopener"><span class="material-icon">${tipoIcone(m.tipo)}</span><div><div class="material-name">${esc(m.nome)}</div>${m.descricao?`<div class="material-desc">${esc(m.descricao)}</div>`:''}</div>${app.perfil.role!=='aluno'?`<button class="btn-danger btn-sm btn-icon" style="margin-left:auto;" onclick="excluirMaterial('${esc(m.id)}',event)">🗑️</button>`:''}</a>`;
    grid.appendChild(div.firstElementChild);
  });
}

document.getElementById('btn-novo-material').addEventListener('click',()=>{app.matEditandoId=null;document.getElementById('modal-mat-titulo').textContent='Novo material';document.getElementById('mat-nome-inp').value='';document.getElementById('mat-url-inp').value='';document.getElementById('mat-desc-inp').value='';document.getElementById('modal-novo-mat').classList.remove('hidden');});
document.getElementById('btn-novo-mat-cancelar').addEventListener('click',()=>document.getElementById('modal-novo-mat').classList.add('hidden'));
document.getElementById('btn-novo-mat-salvar').addEventListener('click',async()=>{
  const nome=document.getElementById('mat-nome-inp').value.trim(),url=document.getElementById('mat-url-inp').value.trim(),descricao=document.getElementById('mat-desc-inp').value.trim(),tipo=document.getElementById('mat-tipo-inp').value;
  if(!nome||!url){toast('Nome e URL obrigatórios','warn');return;}
  const{error}=await sb.from('materiais').insert({nome,url,descricao,tipo,visivel:true});
  document.getElementById('modal-novo-mat').classList.add('hidden');
  if(error){toast('Erro ao salvar material','error');return;}
  toast('Material salvo!','success');carregarMateriais();
});

/*
 * FIX #9 — Soft Delete
 * visivel=false oculta o material sem deletar do banco.
 * Para exclusão permanente: DELETE FROM materiais WHERE visivel = false;
 * Para ver materiais ocultos: SELECT * FROM materiais_excluidos;
 */
window.excluirMaterial=(id,e)=>{e.preventDefault();e.stopPropagation();confirmar('Excluir material','O material ficará oculto (pode ser restaurado pelo banco).',async()=>{await sb.from('materiais').update({visivel:false}).eq('id',id);toast('Material removido','success');carregarMateriais();},'Excluir');};

/* ══════════════════════════════════════════════════════════
   INICIALIZAÇÃO
══════════════════════════════════════════════════════════ */
iniciar();
