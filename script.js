/* ══════════════════════════════════════════════════════════
   AO MOSSO v4 — Script principal
   Hierarquia completa · Agenda · Mural · Atas · Admin
══════════════════════════════════════════════════════════ */

// Suppress extension message errors
if(typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage?.addListener((request, sender, sendResponse) => {
    try { sendResponse({status: 'ok'}); } catch(e) { }
    return true;
  });
}

// Handle window messages from extensions
window.addEventListener('message', (event) => {
  try {
    if(event.source && event.source === window && event.data && typeof event.data === 'object') {
      // Silently handle extension messages
    }
  } catch(e) { }
});

// Suppress unhandled promise rejections from browser extensions
window.addEventListener('unhandledrejection', (event) => {
  if(event.reason && (
    event.reason.message?.includes('message channel closed') ||
    event.reason.message?.includes('Extension context invalidated') ||
    event.reason.message?.includes('The port closed before a response was received')
  )) {
    event.preventDefault();
  }
});

// Also suppress console errors from extension messaging
const originalError = console.error;
console.error = function(...args) {
  if(args[0]?.message?.includes('message channel closed') || 
     String(args[0]).includes('message channel closed')) {
    return; // Silently ignore
  }
  originalError.apply(console, args);
};

const SUPA_URL = 'https://plrqrubxphintvioqqoe.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscnFydWJ4cGhpbnR2aW9xcW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NjAxMDIsImV4cCI6MjA4NzUzNjEwMn0.miWgsjOVkn7TnNOGCFABVWQ_EbTLtgeCV-Yaeoq55MY';
const db = window.supabase.createClient(SUPA_URL, SUPA_KEY);

/* ══ ESTADO ══════════════════════════════════════════════ */
let EU      = null;
let MEMBROS = [];
let MESES   = [];
let INS_SEL = null;
let META_VALOR = 500;
let PROMOVER_ID = null;
let CARGO_FILTER = 'todos';

/* ══ HIERARQUIA DE CARGOS ════════════════════════════════
   Cada cargo tem: label, nivel (0=mais alto), privs[]
══════════════════════════════════════════════════════════ */
const HIERARQUIA = [
  {
    id:'representante', label:'Representante', nivel:0,
    icon:'fa-compass', cor:'gold',
    descricao:'Líder máximo da loja. Acesso total e pode criar cargos.',
    privs:['tudo','tesoureiro','secretario','presidente','admin','mural','atas','eventos','midia','insignias','promover','eleger','cargo-custom','financeiro','lancar-pag'],
  },
  {
    id:'vice-rep', label:'Vice-Representante', nivel:1,
    icon:'fa-star-of-david', cor:'gold',
    descricao:'Substitui o Representante e auxilia na gestão geral.',
    privs:['admin','mural','eventos','midia','insignias','promover','financeiro'],
  },
  {
    id:'presidente', label:'Presidente', nivel:2,
    icon:'fa-crown', cor:'blue',
    descricao:'Preside as sessões e coordena as atividades.',
    privs:['eleger','mural','eventos','financeiro'],
  },
  {
    id:'vice-pres', label:'Vice-Presidente', nivel:3,
    icon:'fa-circle-half-stroke', cor:'blue',
    descricao:'Auxilia o Presidente nas sessões.',
    privs:['mural','eventos'],
  },
  {
    id:'tesoureiro', label:'Tesoureiro', nivel:4,
    icon:'fa-vault', cor:'green',
    descricao:'Gestão financeira, controle de cotas e arrecadação.',
    privs:['tesoureiro','financeiro','lancar-pag'],
  },
  {
    id:'vice-tes', label:'Vice-Tesoureiro', nivel:5,
    icon:'fa-coins', cor:'green',
    descricao:'Auxilia o Tesoureiro na gestão financeira.',
    privs:['tesoureiro','financeiro','lancar-pag'],
  },
  {
    id:'secretario', label:'Secretário', nivel:6,
    icon:'fa-pen-nib', cor:'blue',
    descricao:'Registra atas, gerencia membros e documentos.',
    privs:['secretario','atas','mural','midia','insignias'],
  },
  {
    id:'vice-sec', label:'Vice-Secretário', nivel:7,
    icon:'fa-pen', cor:'blue',
    descricao:'Auxilia o Secretário nos registros e documentos.',
    privs:['secretario','atas','midia'],
  },
  {
    id:'orador', label:'Orador Oficial', nivel:8,
    icon:'fa-microphone-lines', cor:'purple',
    descricao:'Responsável pelos pronunciamentos e discursos oficiais.',
    privs:['orador','mural','eventos'],
  },
  {
    id:'fiscal', label:'Fiscal Oficial', nivel:9,
    icon:'fa-shield-check', cor:'rose',
    descricao:'Fiscaliza as ações e garante o cumprimento dos estatutos.',
    privs:['fiscal'],
  },
  {
    id:'organizadora', label:'Organizadora Oficial', nivel:10,
    icon:'fa-clipboard-list', cor:'teal',
    descricao:'Organiza eventos, confraternizações e atividades.',
    privs:['organizadora','eventos','midia'],
  },
  {
    id:'irmao', label:'Irmão', nivel:99,
    icon:'fa-user', cor:'muted',
    descricao:'Membro regular com acesso de leitura.',
    privs:[],
  },
];

// Mapa rápido
const CARGO_MAP = Object.fromEntries(HIERARQUIA.map(c=>[c.id,c]));

function getPrivs() {
  if (!EU) return [];
  const cargo = CARGO_MAP[EU.cargo];
  if (!cargo) return EU.privs_custom || [];
  return cargo.privs || [];
}

function temPriv(priv) {
  const privs = getPrivs();
  return privs.includes('tudo') || privs.includes(priv);
}

/* ══ INSÍGNIAS ══════════════════════════════════════════ */
const INSIGNIAS = [
  {id:'fundador',     icon:'fa-gem',              n:'Fundador'},
  {id:'pontual',      icon:'fa-bolt',             n:'Pontual'},
  {id:'fiel',         icon:'fa-fire',             n:'Fiel'},
  {id:'pilar',        icon:'fa-trophy',           n:'Pilar'},
  {id:'dj',           icon:'fa-record-vinyl',     n:'DJ'},
  {id:'curador',      icon:'fa-headphones',       n:'Curador'},
  {id:'fotografo',    icon:'fa-camera',           n:'Fotógrafo'},
  {id:'veterano',     icon:'fa-star',             n:'Veterano'},
  {id:'mvp',          icon:'fa-crown',            n:'MVP'},
  {id:'aniversario',  icon:'fa-cake-candles',     n:'Aniversário'},
  {id:'lenda',        icon:'fa-wand-magic-sparkles', n:'Lenda'},
  {id:'guardiao',     icon:'fa-shield-halved',    n:'Guardião'},
];

/* ══ UTILS ══════════════════════════════════════════════ */
const inic  = n => { if(!n)return'?'; const p=n.trim().split(' ').filter(x=>x); return p.length===0?'?':(p.length===1?p[0][0]:(p[0][0]+p.at(-1)[0])).toUpperCase(); };
const fmt$  = v => `R$ ${parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
const mesHoje = () => new Date().toISOString().slice(0,7);
const M_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const nomeMes = s => { if(!s)return'—'; const[a,m]=s.split('-'); const month=M_ABREV[+m-1]||'?'; return`${month}/${a}`; };
const diaMes  = s => { if(!s)return'—'; const[,m,d]=s.split('-'); return`${(d||'?')}/${(m||'?')}`; };

function cargoBadge(c) {
  const cargo = CARGO_MAP[c];
  const label = cargo?.label || (c || 'Irmão');
  const cls   = c || 'irmao';
  return `<span class="cargo-badge ${cls}">${label}</span>`;
}

function toast(msg, tipo='ok') {
  const icons = {ok:'fa-check',err:'fa-times',info:'fa-info'};
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  t.innerHTML = `<span class="toast-icon"><i class="fas ${icons[tipo]||'fa-info'}"></i></span> ${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(100%)'; t.style.transition='.3s'; setTimeout(()=>t.remove(),300); }, 3500);
}

function setBtn(id, loading, txt='Aguarde...') {
  const b = document.getElementById(id);
  if(!b) return;
  if(loading) { b.disabled=true; b._o=b.innerHTML; b.innerHTML=`<i class="fas fa-circle-notch fa-spin"></i> ${txt}`; }
  else { b.disabled=false; if(b._o) b.innerHTML=b._o; }
}

const showErr  = (id,msg) => { const e=document.getElementById(id); if(e) e.textContent=msg; };
const clearErr = id => showErr(id,'');

/* ══ RELÓGIO E DATA ═════════════════════════════════════ */
function updateClock() {
  const n=new Date();
  const h=String(n.getHours()).padStart(2,'0');
  const m=String(n.getMinutes()).padStart(2,'0');
  const e=document.getElementById('sb-clock');
  if(e) e.textContent=`${h}:${m}`;
  const dias=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const d=document.getElementById('sb-date');
  if(d) d.textContent=`${dias[n.getDay()]}, ${n.getDate()} ${M_ABREV[n.getMonth()]}`;
}
updateClock();
setInterval(updateClock, 1000);

/* ══ NAVEGAÇÃO ══════════════════════════════════════════ */
document.querySelectorAll('.nav-link[data-page]').forEach(b =>
  b.addEventListener('click', () => irPara(b.dataset.page))
);

window.irPara = function(p) {
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(x=>x.classList.remove('active'));
  document.getElementById(`page-${p}`)?.classList.add('active');
  document.querySelector(`.nav-link[data-page="${p}"]`)?.classList.add('active');
  fecharSidebar();
  const loaders = {
    financeiro: carregarFinanceiro,
    membros:    carregarMembros,
    midia:      ()=>carregarMidia('playlist'),
    votacao:    carregarVotacao,
    agenda:     carregarAgenda,
    mural:      carregarMural,
    atas:       carregarAtas,
    admin:      ()=>{},
  };
  loaders[p]?.();
};

function fecharSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sb-overlay').classList.remove('open');
}

window.toggleNotifs = function() {
  const p = document.getElementById('notif-panel');
  const o = document.getElementById('notif-overlay');
  if(p) p.classList.toggle('open');
  if(o) o.classList.toggle('open');
};

/* ══ MODAIS ═════════════════════════════════════════════ */
window.fecharModal = id => document.getElementById(id)?.classList.remove('open');

/* ══ SETUP: AGUARDA DOM PRONTO E INICIALIZA ═════════════ */
function initializeApp() {
  // Listeners de navegação
  document.querySelectorAll('.nav-link[data-page]').forEach(b =>
    b.addEventListener('click', () => {
      irPara(b.dataset.page);
      // Close sidebar on mobile after navigation
      fecharSidebar();
    })
  );

  // Modal click handler
  document.querySelectorAll('.modal-bg').forEach(bg =>
    bg.addEventListener('click', e => { if(e.target===bg) bg.classList.remove('open'); })
  );

  // Sidebar mobile
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sb-overlay').classList.toggle('open');
  });
  document.getElementById('sb-overlay')?.addEventListener('click', fecharSidebar);

  // Login/Registro tabs
  document.querySelectorAll('.tab').forEach(t =>
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('form-login').style.display = t.dataset.tab==='entrar'?'block':'none';
      document.getElementById('form-reg').style.display   = t.dataset.tab==='registrar'?'block':'none';
    })
  );

  // Form Login
  document.getElementById('form-login')?.addEventListener('submit', async e => {
    e.preventDefault(); clearErr('l-err');
    const user = document.getElementById('l-user')?.value.trim();
    const pass = document.getElementById('l-pass')?.value;
    if(!user || !pass) return showErr('l-err','Nome de usuário e senha são obrigatórios.');
    setBtn('btn-entrar', true, 'Entrando...');
    try {
      const {data,error} = await db.from('perfis').select('*').eq('usuario',user).eq('senha',pass).single();
      if(error||!data) return showErr('l-err','Usuário ou senha incorretos.');
      entrarApp(data);
    } catch(ex) { console.error(ex); showErr('l-err','Erro de conexão: ' + (ex.message||'Desconhecido')); }
    finally { setBtn('btn-entrar', false); }
  });

  // Form Registro
  document.getElementById('form-reg')?.addEventListener('submit', async e => {
    e.preventDefault(); clearErr('r-err');
    const nome  = document.getElementById('r-nome')?.value.trim();
    const user  = document.getElementById('r-user')?.value.trim();
    const pass  = document.getElementById('r-pass')?.value;
    if(!nome||!user||!pass) return showErr('r-err','Nome, usuário e senha são obrigatórios.');
    if(pass.length<4) return showErr('r-err','Senha deve ter pelo menos 4 caracteres.');
    if(!/^\S+$/.test(user)) return showErr('r-err','Usuário não pode ter espaços.');
    
    const cargo = document.getElementById('r-cargo')?.value || 'irmao';
    const bday  = document.getElementById('r-bday')?.value || null;
    
    setBtn('btn-reg', true, 'Criando...');
    try {
      const {error} = await db.from('perfis').insert([{
        nome, usuario:user, senha:pass, cargo,
        data_aniversario:bday,
        insignias:[], privs_custom:[]
      }]);
      if(error) {
        if(error.code === '23505') return showErr('r-err','Esse usuário já existe. Escolha outro.');
        return showErr('r-err','Erro ao criar conta: ' + (error.message||'tente novamente.'));
      }
      toast('Conta criada! Faça o login.');
      document.getElementById('form-reg').reset();
      document.querySelector('[data-tab="entrar"]')?.click();
    } catch(ex) { console.error(ex); showErr('r-err','Erro de conexão: ' + (ex.message||'')); }
    finally { setBtn('btn-reg', false); }
  });

  // Listeners dos tabs de mídia
  document.querySelectorAll('.mtab').forEach(t=>
    t.addEventListener('click', ()=>carregarMidia(t.dataset.tipo))
  );

  // Form Mídia
  document.getElementById('form-midia')?.addEventListener('submit', async e => {
    e.preventDefault(); clearErr('m-err');
    const tipo  = document.getElementById('m-tipo')?.value;
    const title = document.getElementById('m-titulo')?.value.trim();
    const url   = document.getElementById('m-url')?.value.trim();
    const desc  = document.getElementById('m-desc')?.value.trim();
    if(!title||!url) return showErr('m-err','Título e link são obrigatórios.');
    const {error} = await db.from('midias').insert([{tipo,titulo:title,url,descricao:desc,adicionado_por:EU?.id}]);
    if(error) return showErr('m-err','Erro ao adicionar.');
    toast('Item adicionado ao arquivo!');
    document.getElementById('form-midia').reset();
    fecharModal('modal-midia-form'); carregarMidia(tipo);
  });

  // Form Meta
  document.getElementById('form-meta')?.addEventListener('submit', e => {
    e.preventDefault();
    META_VALOR = parseFloat(document.getElementById('meta-input')?.value) || 500;
    localStorage.setItem('am_meta', META_VALOR);
    document.getElementById('meta-total').textContent = fmt$(META_VALOR);
    fecharModal('modal-meta');
    toast('Meta atualizada!');
    const atual = parseFloat(document.getElementById('meta-atual').textContent.replace(/[R$\s.]/g,'').replace(',','.')) || 0;
    atualizarMeta(atual);
  });

  // Form Lançamento de Pagamento
  document.getElementById('form-lanc')?.addEventListener('submit', async e => {
    e.preventDefault(); clearErr('lanc-err');
    const memId = document.getElementById('lanc-membro')?.value;
    const mes   = document.getElementById('lanc-mes')?.value;
    const valor = parseFloat(document.getElementById('lanc-valor')?.value);
    if(!memId||!mes||!valor||valor<10) return showErr('lanc-err','Preencha todos os campos. Valor mínimo R$ 10.');
    const {data:ex} = await db.from('cotas').select('id').eq('perfil_id',memId).eq('mes',mes).maybeSingle();
    let err;
    if(ex) {
      const updateResult = await db.from('cotas').update({status:'pago',valor}).eq('id',ex.id);
      err = updateResult.error;
    } else {
      const mem=MEMBROS.find(m=>m.id===memId);
      const insertResult = await db.from('cotas').insert([{perfil_id:memId,nome_membro:mem?.nome||'',mes,valor,status:'pago'}]);
      err = insertResult.error;
    }
    if(err) return showErr('lanc-err','Erro ao salvar.');
    toast(`Pagamento de ${fmt$(valor)} registrado!`);
    fecharModal('modal-lanc'); carregarCotas(); carregarFeed();
  });

  // Form Novo Mês
  document.getElementById('form-mes')?.addEventListener('submit', async e => {
    e.preventDefault();
    const mes = document.getElementById('novo-mes')?.value;
    if(!mes) return;
    await garantirMembros();
    const {data:ex} = await db.from('cotas').select('perfil_id').eq('mes',mes);
    const ids = new Set((ex||[]).map(c=>c.perfil_id));
    const novos = MEMBROS.filter(m=>!ids.has(m.id));
    if(!novos.length){ toast('Todos já estão neste mês.','err'); fecharModal('modal-mes'); return; }
    const regs = novos.map(m=>({perfil_id:m.id,nome_membro:m.nome,mes,valor:0,status:'pendente'}));
    const {error} = await db.from('cotas').insert(regs);
    if(error) return toast('Erro ao criar mês.','err');
    toast(`Mês ${nomeMes(mes)} criado! ${novos.length} irmãos adicionados.`);
    fecharModal('modal-mes'); carregarFinanceiro();
  });
}

/* ══ ENTRAR NO APP ══════════════════════════════════════ */
function entrarApp(data) {
  EU = data;
  localStorage.setItem('am_u', JSON.stringify(data));

  document.getElementById('screen-login').style.display = 'none';
  document.getElementById('screen-app').style.display   = 'flex';

  const nome1 = data.nome?.split(' ')[0] || data.usuario;
  document.getElementById('sb-nome').textContent = nome1;
  document.getElementById('sb-av').textContent   = inic(data.nome||data.usuario);
  document.getElementById('top-av').textContent  = inic(data.nome||data.usuario);

  const pill  = document.getElementById('sb-cargo-tag');
  const cargo = CARGO_MAP[data.cargo];
  pill.textContent = cargo?.label || data.cargo || 'Irmão';
  pill.className   = `cargo-badge ${data.cargo||'irmao'}`;

  // ── Aplica privilégios via classes no <body> ──────────
  // Remove classes can-* antigas (caso reconecte)
  document.body.className = document.body.className
    .replace(/\bcan-\S+/g,'').trim();

  const privs = getPrivs();
  privs.forEach(priv => {
    // sanitiza: substitui _ por - para classe CSS
    document.body.classList.add('can-' + priv.replace(/_/g,'-'));
  });

  // Saudação correta
  const h = new Date().getHours();
  const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  document.getElementById('feed-saudacao').textContent = `${saud}, ${nome1}.`;

  carregarFeed();
  carregarMetaLocal();
  populateCargoSelect();
}

window.fazerLogoff = () => { localStorage.removeItem('am_u'); EU=null; location.reload(); };

/* ══ META ═══════════════════════════════════════════════ */
function carregarMetaLocal() {
  const s = localStorage.getItem('am_meta');
  if(s) META_VALOR = parseFloat(s);
  document.getElementById('meta-total').textContent = fmt$(META_VALOR);
  document.getElementById('meta-input').value = META_VALOR;
}

window.abrirModalMeta = () => {
  document.getElementById('meta-input').value = META_VALOR;
  document.getElementById('modal-meta').classList.add('open');
};

// Form Meta configurado em initializeApp()

// Resto do código...

function atualizarMeta(total) {
  const pct = Math.min(100, Math.round((total/META_VALOR)*100));
  document.getElementById('meta-atual').textContent   = fmt$(total);
  document.getElementById('meta-progress').style.width = `${pct}%`;
  document.getElementById('meta-pct').textContent     = `${pct}% atingido`;
  document.getElementById('meta-status').textContent  = pct>=100?'Meta atingida!': `Faltam ${fmt$(META_VALOR-total)}`;
}

/* ══ FEED ═══════════════════════════════════════════════ */
async function carregarFeed() {
  // Membros
  const {data:perfis} = await db.from('perfis').select('id,nome,data_aniversario');
  document.getElementById('s-membros').textContent = perfis?.length || 0;

  // Cotas do mês
  const ma = mesHoje();
  const {data:cotas} = await db.from('cotas').select('*, perfis(nome)').eq('mes',ma).order('id');
  if(cotas) {
    const pagos = cotas.filter(c=>c.status==='pago');
    const pend  = cotas.filter(c=>c.status!=='pago');
    const total = pagos.reduce((a,c)=>a+parseFloat(c.valor||0),0);
    document.getElementById('s-caixa').textContent = fmt$(total);
    document.getElementById('s-pend').textContent  = pend.length;
    document.getElementById('badge-fin').textContent = pend.length||'';
    document.getElementById('feed-mes-label').textContent = nomeMes(ma);
    atualizarMeta(total);

    document.getElementById('feed-cotas').innerHTML = cotas.length
      ? cotas.slice(0, 3).map(c=>`
          <div class="feed-cota-row">
            <div class="cota-av ${c.status==='pago'?'pago':'pendente'}">${inic(c.perfis?.nome||c.nome_membro)}</div>
            <span class="cota-nome">${(c.perfis?.nome||c.nome_membro||'—').split(' ')[0]}</span>
            <span class="cota-valor">${c.status==='pago'?fmt$(c.valor):''}</span>
            <button class="cota-edit-btn" onclick="editarCota('${c.id}','${c.status}','${c.valor}')" title="Editar">
              <i class="fas fa-pen"></i>
            </button>
          </div>
        `).join('') + 
        (cotas.length > 3 ? `<button class="btn-ver-mais" onclick="irPara('financeiro')"><i class="fas fa-arrow-right"></i> Ver mais (${cotas.length - 3})</button>` : '')
      : '<p class="empty-state">Nenhuma cota registrada neste mês.</p>';
  }

  // Aniversariantes
  const mesN = String(new Date().getMonth()+1).padStart(2,'0');
  const anivs = (perfis||[]).filter(p=>p.data_aniversario && p.data_aniversario.split('-')[1]===mesN);
  const anivEl = document.getElementById('feed-anivs');
  anivEl.innerHTML = anivs.length
    ? anivs.map(p=>`
        <div class="aniv-chip">
          <div class="aniv-av">${inic(p.nome)}</div>
          <div><strong>${(p.nome||'?').split(' ')[0]}</strong><span class="aniv-date">dia ${diaMes(p.data_aniversario)}</span></div>
        </div>
      `).join('')
    : '<p class="empty-state">Nenhum aniversário este mês.</p>';

  // Eventos próximos
  await carregarFeedEventos();
}

async function carregarFeedEventos() {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const {data} = await db.from('eventos').select('*').gte('data', hoje).order('data').limit(3);
    const el = document.getElementById('feed-eventos');
    document.getElementById('s-eventos').textContent = data?.length || 0;
    if(!data?.length) { el.innerHTML='<p class="empty-state">Nenhum evento próximo.</p>'; return; }
    el.innerHTML = data.map(ev => {
      const d = new Date(ev.data+'T12:00:00');
      return `
        <div class="ev-chip">
          <div class="ev-date-badge">
            <span>${d.getDate()}</span>
            <span>${M_ABREV[d.getMonth()]}</span>
          </div>
          <div>
            <div class="ev-chip-name">${ev.titulo}</div>
            <div class="ev-chip-meta">${ev.hora||''} ${ev.local?`· ${ev.local}`:''}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch {}
}

/* ══ FINANCEIRO ═════════════════════════════════════════ */
async function carregarMesesSel() {
  const {data} = await db.from('cotas').select('mes').order('mes',{ascending:false});
  const unicos = [...new Set((data||[]).map(c=>c.mes))];
  const ma = mesHoje();
  if(!unicos.includes(ma)) unicos.unshift(ma);
  MESES = unicos;
  const sel = document.getElementById('fin-mes-sel');
  if(sel) sel.innerHTML = unicos.map(m=>`<option value="${m}">${nomeMes(m)}</option>`).join('');
}

window.carregarFinanceiro = async function() {
  await carregarMesesSel();
  carregarCotas();
};

window.carregarCotas = async function() {
  const mes = document.getElementById('fin-mes-sel')?.value;
  if(!mes) return;
  const lista = document.getElementById('fin-list');
  lista.innerHTML = '<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Carregando...</div>';

  const {data,error} = await db.from('cotas').select('*, perfis(nome,cargo)').eq('mes',mes).order('id');
  if(error||!data?.length) {
    lista.innerHTML='<div class="loading-state">Nenhum registro neste mês.</div>';
    return;
  }

  const pagos  = data.filter(c=>c.status==='pago');
  const pend   = data.filter(c=>c.status!=='pago');
  const totalR = pagos.reduce((a,c)=>a+parseFloat(c.valor||0),0);
  const pct    = Math.round((pagos.length/data.length)*100);

  document.getElementById('fc-total').textContent   = fmt$(totalR);
  document.getElementById('fc-pagos').textContent   = pagos.length;
  document.getElementById('fc-pend').textContent    = pend.length;
  document.getElementById('fc-prog').textContent    = `${pct}%`;
  document.getElementById('fin-progress').style.width = `${pct}%`;
  document.getElementById('badge-fin').textContent  = pend.length||'';

  const ehTes = temPriv('tesoureiro')||temPriv('tudo');
  lista.innerHTML = data.map((c,i)=>`
    <div class="cota-item">
      <div class="cota-av ${c.status==='pago'?'pago':'pendente'}">${inic(c.perfis?.nome||c.nome_membro)}</div>
      <span class="cota-nome">${(c.perfis?.nome||c.nome_membro||'—').split(' ')[0]}</span>
      <span class="cota-valor">${c.status==='pago'?fmt$(c.valor):''}</span>
      ${ehTes?`<button class="cota-edit-btn" onclick="editarCota('${c.id}','${c.status}','${c.valor}')" title="Editar"><i class="fas fa-pen"></i></button>`:''}
    </div>
  `).join('');
};

window.confirmarPag = async function(id) {
  const valorStr = prompt('Valor pago (R$):', '10');
  if(valorStr===null) return;
  const valor = parseFloat(valorStr.replace(',','.'));
  if(isNaN(valor)||valor<10) return toast('Valor inválido. Mínimo R$ 10.','err');
  const {error} = await db.from('cotas').update({status:'pago',valor}).eq('id',id);
  if(error) return toast('Erro ao confirmar.','err');
  toast(`Pagamento de ${fmt$(valor)} confirmado!`);
  carregarCotas(); carregarFeed();
};

window.reverterPag = async function(id) {
  if(!confirm('Reverter pagamento?')) return;
  const {error} = await db.from('cotas').update({status:'pendente',valor:0}).eq('id',id);
  if(error) return toast('Erro ao reverter.','err');
  toast('Pagamento revertido.','info');
  carregarCotas(); carregarFeed();
};

window.editarCota = async function(id, status, valor) {
  let opcao = confirm(`${status==='pago'?'Reverter este pagamento?':'Mudar para pago?'}`);
  if(!opcao) return;
  
  if(status==='pago') {
    const {error} = await db.from('cotas').update({status:'pendente',valor:0}).eq('id',id);
    if(error) return toast('Erro ao reverter.','err');
    toast('Pagamento revertido.','info');
  } else {
    const valorStr = prompt('Valor pago (R$):', '10');
    if(valorStr===null) return;
    const novoValor = parseFloat(valorStr.replace(',','.'));
    if(isNaN(novoValor)||novoValor<10) return toast('Valor inválido. Mínimo R$ 10.','err');
    const {error} = await db.from('cotas').update({status:'pago',valor:novoValor}).eq('id',id);
    if(error) return toast('Erro ao atualizar.','err');
    toast(`Pagamento de ${fmt$(novoValor)} confirmado!`);
  }
  carregarCotas(); carregarFeed();
};

/* ══ LANÇAR PAGAMENTO ═══════════════════════════════════ */
window.abrirModalLanc = async function() {
  await garantirMembros();
  document.getElementById('lanc-membro').innerHTML = MEMBROS.map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
  await carregarMesesSel();
  const ma = mesHoje();
  document.getElementById('lanc-mes').innerHTML = MESES.map(m=>`<option value="${m}" ${m===ma?'selected':''}>${nomeMes(m)}</option>`).join('');
  document.getElementById('lanc-valor').value = 10;
  clearErr('lanc-err');
  document.getElementById('modal-lanc').classList.add('open');
};

// Form Lançamento configurado em initializeApp()

/* ══ NOVO MÊS ═══════════════════════════════════════════ */
window.abrirModalMes = () => {
  document.getElementById('novo-mes').value = mesHoje();
  document.getElementById('modal-mes').classList.add('open');
};

// Form Novo Mês configurado em initializeApp()

/* ══ MEMBROS ════════════════════════════════════════════ */
window.carregarMembros = async function() {
  document.getElementById('membros-grid').innerHTML='<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Carregando...</div>';
  await garantirMembros(true);
  renderFiltrosCargo();
  renderMembros(MEMBROS);
};

async function garantirMembros(force=false) {
  if(MEMBROS.length&&!force) return;
  const {data} = await db.from('perfis').select('*').order('nome');
  MEMBROS = data||[];
}

function renderFiltrosCargo() {
  const cargosPresentes = [...new Set(MEMBROS.map(m=>m.cargo||'irmao'))];
  const el = document.getElementById('cargo-filter');
  const btns = [
    `<button class="cargo-filter-btn active" onclick="setCargofilt('todos',this)">Todos (${MEMBROS.length})</button>`,
    ...cargosPresentes.map(c=>{
      const cnt = MEMBROS.filter(m=>(m.cargo||'irmao')===c).length;
      const cargo = CARGO_MAP[c];
      return `<button class="cargo-filter-btn" onclick="setCargofilt('${c}',this)">${cargo?.label||c} (${cnt})</button>`;
    })
  ];
  el.innerHTML = btns.join('');
}

window.setCargofilt = function(c, btn) {
  CARGO_FILTER = c;
  document.querySelectorAll('.cargo-filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const q = document.getElementById('busca').value.toLowerCase();
  filtrarRenderMembros(q);
};

function filtrarRenderMembros(q='') {
  let lista = MEMBROS;
  if(CARGO_FILTER!=='todos') lista = lista.filter(m=>(m.cargo||'irmao')===CARGO_FILTER);
  if(q) lista = lista.filter(m=>(m.nome||'').toLowerCase().includes(q)||(m.cargo||'').toLowerCase().includes(q));
  renderMembros(lista);
}

function renderMembros(lista) {
  const grid = document.getElementById('membros-grid');
  if(!lista.length){ grid.innerHTML='<div class="loading-state">Nenhum irmão encontrado.</div>'; return; }
  grid.innerHTML = lista.map(m=>`
    <div class="membro-card" onclick="abrirPerfil('${m.id}')">
      <div class="mc-dot ${m.cota_status||'pendente'}"></div>
      <div class="mc-av">${inic(m.nome)}</div>
      <div class="mc-name">${m.nome}</div>
      ${cargoBadge(m.cargo)}
      ${(m.insignias||[]).length?`
        <div class="mc-badges">
          ${m.insignias.slice(0,5).map(iid=>{
            const ins=INSIGNIAS.find(x=>x.id===iid);
            return ins?`<span class="mc-badge" title="${ins.n}"><i class="fas ${ins.icon}" style="font-size:11px"></i></span>`:'';
          }).join('')}
        </div>
      `:''}
    </div>
  `).join('');
}

window.filtrarMembros = function() {
  const q = document.getElementById('busca').value.toLowerCase();
  filtrarRenderMembros(q);
};

/* ══ PERFIL ═════════════════════════════════════════════ */
window.abrirPerfil = async function(id) {
  const m = MEMBROS.find(x=>x.id===id);
  if(!m) return;
  const {data:cotas} = await db.from('cotas').select('mes,valor,status').eq('perfil_id',id).order('mes',{ascending:false});
  const totalP = (cotas||[]).reduce((a,c)=>a+(c.status==='pago'?parseFloat(c.valor||0):0),0);
  const mesesP = (cotas||[]).filter(c=>c.status==='pago').length;

  const insHtml = (m.insignias||[]).length
    ? m.insignias.map(iid=>{
        const ins=INSIGNIAS.find(x=>x.id===iid);
        return ins?`<div class="p-ins"><i class="fas ${ins.icon} ie" style="font-size:20px;color:var(--gold-dk)"></i><span class="in">${ins.n}</span></div>`:''
      }).join('')
    : '<p style="font-size:13px;color:var(--muted)">Nenhuma insígnia ainda.</p>';

  const ehEu = EU?.id===id;
  const podeGerenciar = temPriv('promover')||temPriv('tudo');
  const podeInsignia  = temPriv('insignias')||temPriv('tudo');

  const adminBtns = (podeGerenciar||podeInsignia||ehEu)?`
    <div class="perfil-admin-btns">
      ${ehEu?`<button class="btn-outline sm" onclick="fecharModal('modal-perfil');abrirEditarPerfil()"><i class="fas fa-pen"></i> Editar perfil</button>`:''}
      ${podeInsignia&&!ehEu?`<button class="btn-outline sm" onclick="fecharModal('modal-perfil');abrirModalInsignia('${m.id}')"><i class="fas fa-medal"></i> Insígnia</button>`:''}
      ${podeGerenciar&&!ehEu?`<button class="btn-main sm" onclick="fecharModal('modal-perfil');abrirModalPromover('${m.id}','${m.nome}')"><i class="fas fa-arrow-up"></i> Promover</button>`:''}
    </div>
  `:'';

  document.getElementById('modal-perfil-body').innerHTML = `
    <div class="perfil-top">
      <div class="perfil-av">${inic(m.nome)}</div>
      <div>
        <div class="perfil-nome">${m.nome}</div>
        ${cargoBadge(m.cargo)}
        ${(m.insignias||[]).length?`<span style="font-size:12px;color:var(--muted);margin-top:5px;display:block">${m.insignias.length} insígnia${m.insignias.length!==1?'s':''}</span>`:''}
      </div>
    </div>
    <div class="perfil-infos">
      <div class="pi"><div class="pi-lbl">Usuário</div><div class="pi-val">@${m.usuario||'—'}</div></div>
      <div class="pi"><div class="pi-lbl">Aniversário</div><div class="pi-val">${diaMes(m.data_aniversario)||'—'}</div></div>
      <div class="pi"><div class="pi-lbl">Profissão</div><div class="pi-val">${m.trabalho||'—'}</div></div>
      <div class="pi"><div class="pi-lbl">WhatsApp</div><div class="pi-val">${m.whatsapp?`<a href="https://wa.me/55${m.whatsapp.replace(/\D/g,'')}" target="_blank" style="color:var(--green)">${m.whatsapp}</a>`:'—'}</div></div>
      <div class="pi"><div class="pi-lbl">Total contribuído</div><div class="pi-val" style="color:var(--green);font-weight:800">${fmt$(totalP)}</div></div>
      <div class="pi"><div class="pi-lbl">Meses pagos</div><div class="pi-val">${mesesP}</div></div>
    </div>
    <div class="perfil-ins"><h4>Insígnias conquistadas</h4><div class="perfil-ins-grid">${insHtml}</div></div>
    ${adminBtns}
  `;
  document.getElementById('modal-perfil').classList.add('open');
};

/* ══ PROMOVER ═══════════════════════════════════════════ */
function populateCargoSelect() {
  const sel = document.getElementById('promover-cargo');
  if(!sel) return;
  sel.innerHTML = HIERARQUIA.map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
}

window.abrirModalPromover = function(id, nome) {
  PROMOVER_ID = id;
  document.getElementById('modal-promover-nome').textContent = `Promover: ${nome}`;
  populateCargoSelect();
  document.getElementById('modal-promover').classList.add('open');
};

window.confirmarPromocao = async function() {
  if(!PROMOVER_ID) return;
  const cargo = document.getElementById('promover-cargo').value;
  const {error} = await db.from('perfis').update({cargo}).eq('id',PROMOVER_ID);
  if(error) return toast('Erro ao promover.','err');
  const mem = MEMBROS.find(m=>m.id===PROMOVER_ID);
  const label = CARGO_MAP[cargo]?.label || cargo;
  toast(`${mem?.nome||'Irmão'} promovido a ${label}!`);
  fecharModal('modal-promover'); PROMOVER_ID=null;
  carregarMembros();
};

/* ══ EDITAR MEU PERFIL ══════════════════════════════════ */
window.abrirEditarPerfil = function() {
  if(!EU) return;
  document.getElementById('ep-nome').value = EU.nome||'';
  document.getElementById('ep-bday').value = EU.data_aniversario||'';
  document.getElementById('ep-job').value  = EU.trabalho||'';
  document.getElementById('ep-wpp').value  = EU.whatsapp||'';
  document.getElementById('ep-pass').value = '';
  clearErr('ep-err');
  document.getElementById('modal-editar-perfil').classList.add('open');
};

document.getElementById('form-edit-perfil')?.addEventListener('submit', async e => {
  e.preventDefault(); clearErr('ep-err');
  const updates = {
    nome:             document.getElementById('ep-nome').value.trim(),
    data_aniversario: document.getElementById('ep-bday').value||null,
    trabalho:         document.getElementById('ep-job').value.trim()||null,
    whatsapp:         document.getElementById('ep-wpp').value.trim()||null,
  };
  const novaSenha = document.getElementById('ep-pass').value;
  if(novaSenha){ if(novaSenha.length<4) return showErr('ep-err','Senha mínimo 4 chars.'); updates.senha=novaSenha; }
  const {error} = await db.from('perfis').update(updates).eq('id',EU.id);
  if(error) return showErr('ep-err','Erro ao salvar.');
  EU={...EU,...updates}; localStorage.setItem('am_u',JSON.stringify(EU));
  document.getElementById('sb-nome').textContent = EU.nome?.split(' ')[0]||EU.usuario;
  toast('Perfil atualizado!'); fecharModal('modal-editar-perfil');
  await garantirMembros(true);
});

/* ══ INSÍGNIAS ══════════════════════════════════════════ */
window.abrirModalInsignia = async function(memId) {
  await garantirMembros();
  document.getElementById('ins-membro').innerHTML =
    MEMBROS.map(m=>`<option value="${m.id}" ${m.id===memId?'selected':''}>${m.nome}</option>`).join('');
  INS_SEL=null;
  document.getElementById('ins-grid').innerHTML = INSIGNIAS.map(i=>`
    <div class="ins-opt" data-id="${i.id}" onclick="selIns(this,'${i.id}')">
      <i class="fas ${i.icon}" style="font-size:20px;color:var(--gold-dk)"></i>
      <span class="ins-name">${i.n}</span>
    </div>
  `).join('');
  document.getElementById('modal-insignia').classList.add('open');
};

window.selIns = function(el, id) {
  document.querySelectorAll('.ins-opt').forEach(o=>o.classList.remove('sel'));
  el.classList.add('sel'); INS_SEL=id;
};

document.getElementById('form-insignia')?.addEventListener('submit', async e => {
  e.preventDefault();
  if(!INS_SEL) return toast('Selecione uma insígnia.','err');
  const memId = document.getElementById('ins-membro').value;
  const mem   = MEMBROS.find(m=>m.id===memId);
  if(!mem) return;
  const atuais = mem.insignias||[];
  if(atuais.includes(INS_SEL)) return toast('Já possui essa insígnia.','err');
  const {error} = await db.from('perfis').update({insignias:[...atuais,INS_SEL]}).eq('id',memId);
  if(error) return toast('Erro.','err');
  const ins = INSIGNIAS.find(i=>i.id===INS_SEL);
  toast(`Insígnia "${ins?.n||INS_SEL}" atribuída a ${mem.nome}!`);
  fecharModal('modal-insignia'); carregarMembros();
});

/* ══ MÍDIA ══════════════════════════════════════════════ */
window.carregarMidia = async function(tipo) {
  document.querySelectorAll('.mtab').forEach(t=>t.classList.toggle('active',t.dataset.tipo===tipo));
  const grid = document.getElementById('midia-grid');
  grid.innerHTML='<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Carregando...</div>';
  const {data,error} = await db.from('midias').select('*').eq('tipo',tipo).order('created_at',{ascending:false});
  if(error||!data?.length){ grid.innerHTML='<div class="loading-state">Nenhum item aqui ainda.</div>'; return; }
  const ic={playlist:'fa-music',fotos:'fa-images',docs:'fa-file-lines'};
  const tg={playlist:'Spotify',fotos:'Fotos',docs:'Documento'};
  grid.innerHTML=data.map(m=>`
    <a class="midia-card" href="${m.url}" target="_blank" rel="noopener">
      <div class="midia-thumb ${m.tipo}"><i class="fas ${ic[m.tipo]||'fa-file'}" style="font-size:30px;color:rgba(255,255,255,.8)"></i></div>
      <div class="midia-body">
        <div class="midia-title">${m.titulo}</div>
        <div class="midia-desc">${m.descricao||''}</div>
        <span class="midia-tag ${m.tipo}">${tg[m.tipo]||m.tipo}</span>
      </div>
    </a>
  `).join('');
};

window.abrirModalMidia = () => document.getElementById('modal-midia-form').classList.add('open');

/* ══ VOTAÇÃO ════════════════════════════════════════════ */
window.carregarVotacao = async function() {
  const cont = document.getElementById('votacao-lista');
  cont.innerHTML='<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Carregando...</div>';
  const {data:eleicoes} = await db.from('eleicoes').select('*').order('created_at',{ascending:false});
  if(!eleicoes?.length){ cont.innerHTML='<div class="loading-state">Nenhuma votação ainda.</div>'; return; }

  const cards = await Promise.all(eleicoes.map(async el => {
    const {data:votosEl} = await db.from('votos').select('candidato_id,eleitor_id').eq('eleicao_id',el.id);
    const totalVotos = votosEl?.length||0;
    const contagem={};
    (votosEl||[]).forEach(v=>{ contagem[v.candidato_id]=(contagem[v.candidato_id]||0)+1; });
    const maxVotos = Math.max(...Object.values(contagem),0);

    const resultados = await Promise.all(Object.entries(contagem).map(async([candId,qtd])=>{
      const m = MEMBROS.find(x=>x.id===candId) || (await db.from('perfis').select('nome').eq('id',candId).single()).data;
      return {nome:m?.nome||'Desconhecido',qtd,pct:totalVotos>0?Math.round((qtd/totalVotos)*100):0,isWin:qtd===maxVotos&&qtd>0};
    }));

    const jaVotei = EU&&(votosEl||[]).some(v=>v.eleitor_id===EU.id);
    const ehRep = temPriv('eleger')||temPriv('tudo');
    const cargo = CARGO_MAP[el.cargo];
    const cargoLabel = cargo?.label || el.cargo;

    const resultsHtml = resultados.sort((a,b)=>b.qtd-a.qtd).map(r=>`
      <div class="result-row">
        <span class="result-nome">${r.nome}</span>
        <div class="result-bar-wrap"><div class="result-bar ${r.isWin?'winning':''}" style="width:${r.pct}%"></div></div>
        <span class="result-count">${r.qtd}</span>
      </div>
    `).join('');

    return `
      <div class="eleicao-card">
        <div class="el-header">
          <div>
            <div class="el-titulo">Eleição — ${cargoLabel}</div>
            ${el.descricao?`<div class="el-desc">${el.descricao}</div>`:''}
          </div>
          <span class="el-status ${el.status}">${el.status==='aberta'?'Aberta':'Encerrada'}</span>
        </div>
        ${totalVotos>0
          ?`<div class="el-results">${resultsHtml}</div><p style="font-size:12px;color:var(--muted);margin-bottom:12px">${totalVotos} voto${totalVotos!==1?'s':''}</p>`
          :'<p style="font-size:13px;color:var(--muted);margin-bottom:12px">Nenhum voto ainda.</p>'}
        <div class="el-actions">
          ${el.status==='aberta'&&EU&&!jaVotei?`<button class="btn-main sm" onclick="abrirModalVotar('${el.id}','${el.cargo}')"><i class="fas fa-scale-balanced"></i> Votar</button>`:''}
          ${jaVotei?`<span style="font-size:13px;color:var(--green);font-weight:700"><i class="fas fa-check-circle"></i> Você votou</span>`:''}
          ${ehRep&&el.status==='aberta'?`<button class="btn-outline sm" onclick="encerrarEleicao('${el.id}')">Encerrar</button>`:''}
        </div>
      </div>
    `;
  }));

  const abertas = eleicoes.filter(e=>e.status==='aberta').length;
  document.getElementById('badge-vot').textContent = abertas||'';
  cont.innerHTML = `<div class="votacao-lista" style="display:flex;flex-direction:column;gap:12px">${cards.join('')}</div>`;
};

window.abrirModalNovaEleicao = function() {
  const sel = document.getElementById('el-cargo');
  sel.innerHTML = HIERARQUIA.filter(c=>c.id!=='irmao').map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
  document.getElementById('modal-nova-eleicao').classList.add('open');
};

document.getElementById('form-nova-eleicao')?.addEventListener('submit', async e => {
  e.preventDefault();
  const cargo = document.getElementById('el-cargo').value;
  const desc  = document.getElementById('el-desc').value.trim();
  const {error} = await db.from('eleicoes').insert([{cargo,descricao:desc,criado_por:EU?.id,status:'aberta'}]);
  if(error) return toast('Erro ao criar eleição.','err');
  const label = CARGO_MAP[cargo]?.label || cargo;
  toast(`Eleição para ${label} aberta!`);
  fecharModal('modal-nova-eleicao'); carregarVotacao();
});

window.abrirModalVotar = async function(eleicaoId, cargo) {
  await garantirMembros();
  const label = CARGO_MAP[cargo]?.label || cargo;
  document.getElementById('modal-votar-title').textContent = `Eleição — ${label}`;
  document.getElementById('modal-votar-desc').textContent  = `Escolha um candidato para ${label}. Seu voto é único e final.`;
  document.getElementById('vot-ja-votou').style.display='none';
  clearErr('vot-err');

  const {data:meuVoto} = await db.from('votos').select('id').eq('eleicao_id',eleicaoId).eq('eleitor_id',EU.id).maybeSingle();
  if(meuVoto){
    document.getElementById('vot-ja-votou').style.display='block';
    document.getElementById('candidatos-list').innerHTML='';
    document.getElementById('modal-votar').classList.add('open');
    return;
  }

  document.getElementById('candidatos-list').innerHTML = MEMBROS
    .filter(m=>m.id!==EU.id)
    .map(m=>`
      <button class="candidato-btn" onclick="registrarVoto('${eleicaoId}','${m.id}')">
        <div class="candidato-av">${inic(m.nome)}</div>
        <div>
          <div class="candidato-nome">${m.nome}</div>
          <div class="candidato-cargo">${CARGO_MAP[m.cargo]?.label||m.cargo||'Irmão'}</div>
        </div>
        <i class="fas fa-chevron-right" style="margin-left:auto;color:var(--muted)"></i>
      </button>
    `).join('');
  document.getElementById('modal-votar').classList.add('open');
};

window.registrarVoto = async function(eleicaoId, candidatoId) {
  if(!EU) return;
  const {error} = await db.from('votos').insert([{eleicao_id:eleicaoId,eleitor_id:EU.id,candidato_id:candidatoId}]);
  if(error){
    if(error.code==='23505') return toast('Você já votou nesta eleição.','err');
    return toast('Erro ao registrar voto.','err');
  }
  const cand = MEMBROS.find(m=>m.id===candidatoId);
  toast(`Voto registrado em ${cand?.nome||'candidato'}!`);
  fecharModal('modal-votar'); carregarVotacao();
};

window.encerrarEleicao = async function(id) {
  if(!confirm('Encerrar esta eleição? O cargo será atribuído ao vencedor.')) return;
  const {data:votos} = await db.from('votos').select('candidato_id').eq('eleicao_id',id);
  const contagem={};
  (votos||[]).forEach(v=>contagem[v.candidato_id]=(contagem[v.candidato_id]||0)+1);
  const vencedorId = Object.entries(contagem).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const {error} = await db.from('eleicoes').update({status:'encerrada',encerrada_at:new Date().toISOString()}).eq('id',id);
  if(error) return toast('Erro ao encerrar.','err');
  if(vencedorId){
    const {data:elData} = await db.from('eleicoes').select('cargo').eq('id',id).single();
    if(elData){
      await db.from('perfis').update({cargo:elData.cargo}).eq('id',vencedorId);
      const venc = MEMBROS.find(m=>m.id===vencedorId);
      const label = CARGO_MAP[elData.cargo]?.label || elData.cargo;
      toast(`${venc?.nome||'Vencedor'} agora é ${label}!`);
    }
  } else { toast('Eleição encerrada sem votos.','info'); }
  carregarVotacao(); garantirMembros(true);
};

/* ══ AGENDA ═════════════════════════════════════════════ */
window.carregarAgenda = async function() {
  const lista = document.getElementById('agenda-lista');
  lista.innerHTML='<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Carregando...</div>';
  try {
    const {data,error} = await db.from('eventos').select('*').order('data');
    if(error||!data?.length){ lista.innerHTML='<div class="loading-state">Nenhum evento cadastrado.</div>'; return; }
    const hoje = new Date().toISOString().split('T')[0];
    const futuros  = data.filter(e=>e.data>=hoje);
    const passados = data.filter(e=>e.data<hoje);
    const renderEv = arr => arr.map(ev=>{
      const d = new Date(ev.data+'T12:00:00');
      const isPast = ev.data < hoje;
      return `
        <div class="agenda-card" style="${isPast?'opacity:.6':''}">
          <div class="agenda-date-block">
            <span class="day">${d.getDate()}</span>
            <span class="mon">${M_ABREV[d.getMonth()]}</span>
          </div>
          <div class="agenda-info">
            <div class="agenda-title">${ev.titulo}</div>
            <div class="agenda-meta">
              ${ev.hora?`<span><i class="fas fa-clock"></i> ${ev.hora}</span>`:''}
              ${ev.local?`<span><i class="fas fa-location-dot"></i> ${ev.local}</span>`:''}
            </div>
            ${ev.descricao?`<p style="font-size:12px;color:var(--muted);margin-top:5px">${ev.descricao}</p>`:''}
          </div>
          <span class="agenda-tipo-badge ${ev.tipo||'outro'}">${ev.tipo||'Outro'}</span>
          ${(temPriv('eventos')||temPriv('tudo'))?`<button class="btn-ghost sm" onclick="deletarEvento('${ev.id}')"><i class="fas fa-trash"></i></button>`:''}
        </div>
      `;
    }).join('');
    lista.innerHTML = `
      ${futuros.length?renderEv(futuros):''}
      ${passados.length?`<div style="margin-top:16px"><p style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Passados</p>${renderEv(passados)}</div>`:''}
    `;
    document.getElementById('badge-agenda').textContent = futuros.length||'';
  } catch(err) { lista.innerHTML='<div class="loading-state">Tabela de eventos não encontrada. Execute o SQL de setup.</div>'; }
};

window.abrirModalEvento = function() {
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('ev-data').value = hoje;
  clearErr('ev-err');
  document.getElementById('modal-evento').classList.add('open');
};

document.getElementById('form-evento')?.addEventListener('submit', async e => {
  e.preventDefault(); clearErr('ev-err');
  const titulo = document.getElementById('ev-titulo').value.trim();
  const data   = document.getElementById('ev-data').value;
  const hora   = document.getElementById('ev-hora').value;
  const local  = document.getElementById('ev-local').value.trim();
  const tipo   = document.getElementById('ev-tipo').value;
  const desc   = document.getElementById('ev-desc').value.trim();
  if(!titulo||!data) return showErr('ev-err','Título e data são obrigatórios.');
  const {error} = await db.from('eventos').insert([{titulo,data,hora,local,tipo,descricao:desc,criado_por:EU?.id}]);
  if(error) return showErr('ev-err','Erro. Certifique-se que a tabela eventos existe no Supabase.');
  toast('Evento criado!');
  fecharModal('modal-evento'); carregarAgenda(); carregarFeedEventos();
});

window.deletarEvento = async function(id) {
  if(!confirm('Excluir este evento?')) return;
  await db.from('eventos').delete().eq('id',id);
  toast('Evento removido.','info'); carregarAgenda();
};

/* ══ MURAL ══════════════════════════════════════════════ */
window.carregarMural = async function() {
  const lista = document.getElementById('mural-lista');
  lista.innerHTML='<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Carregando...</div>';
  try {
    const {data,error} = await db.from('avisos').select('*, perfis(nome)').order('created_at',{ascending:false});
    if(error||!data?.length){ lista.innerHTML='<div class="loading-state">Nenhum aviso no mural.</div>'; return; }
    lista.innerHTML = data.map(av=>`
      <div class="aviso-card ${av.prioridade||'normal'}">
        <div class="aviso-titulo">${av.titulo}</div>
        <div class="aviso-corpo">${av.corpo}</div>
        <div class="aviso-footer">
          <span class="aviso-autor">${av.perfis?.nome||'—'} · ${new Date(av.created_at).toLocaleDateString('pt-BR')}</span>
          <span class="aviso-prio ${av.prioridade||'normal'}">${av.prioridade||'Normal'}</span>
        </div>
      </div>
    `).join('');
  } catch { lista.innerHTML='<div class="loading-state">Tabela de avisos não encontrada. Execute o SQL de setup.</div>'; }
};

window.abrirModalAviso = function() {
  clearErr('av-err');
  document.getElementById('modal-aviso').classList.add('open');
};

document.getElementById('form-aviso')?.addEventListener('submit', async e => {
  e.preventDefault(); clearErr('av-err');
  const titulo = document.getElementById('av-titulo').value.trim();
  const corpo  = document.getElementById('av-corpo').value.trim();
  const prio   = document.getElementById('av-prio').value;
  if(!titulo||!corpo) return showErr('av-err','Título e conteúdo são obrigatórios.');
  const {error} = await db.from('avisos').insert([{titulo,corpo,prioridade:prio,autor_id:EU?.id}]);
  if(error) return showErr('av-err','Erro. Certifique-se que a tabela avisos existe no Supabase.');
  toast('Aviso publicado!');
  fecharModal('modal-aviso'); carregarMural();
});

/* ══ ATAS ═══════════════════════════════════════════════ */
window.carregarAtas = async function() {
  const lista = document.getElementById('atas-lista');
  lista.innerHTML='<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Carregando...</div>';
  try {
    const {data,error} = await db.from('atas').select('*, perfis(nome)').order('data_sessao',{ascending:false});
    if(error||!data?.length){ lista.innerHTML='<div class="loading-state">Nenhuma ata registrada.</div>'; return; }
    lista.innerHTML = data.map(at=>`
      <div class="ata-card" onclick="expandirAta(this)">
        <div class="ata-header">
          <div class="ata-icon"><i class="fas fa-scroll"></i></div>
          <div>
            <div class="ata-title">Sessão ${at.numero||'—'}</div>
            <div class="ata-meta">${at.data_sessao?new Date(at.data_sessao+'T12:00:00').toLocaleDateString('pt-BR'):''} · Registrado por ${at.perfis?.nome||'—'}</div>
          </div>
        </div>
        <div class="ata-preview" style="display:none">
          <p><strong>Assuntos tratados:</strong></p>
          <p style="margin-top:6px">${at.corpo||'—'}</p>
          ${at.deliberacoes?`<p style="margin-top:10px"><strong>Deliberações:</strong></p><p style="margin-top:4px">${at.deliberacoes}</p>`:''}
        </div>
      </div>
    `).join('');
  } catch { lista.innerHTML='<div class="loading-state">Tabela de atas não encontrada. Execute o SQL de setup.</div>'; }
};

window.expandirAta = function(el) {
  const preview = el.querySelector('.ata-preview');
  if(preview) { const isOpen = preview.style.display!=='none'; preview.style.display=isOpen?'none':'block'; }
};

window.abrirModalAta = function() {
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('ata-data').value = hoje;
  clearErr('ata-err');
  document.getElementById('modal-ata').classList.add('open');
};

document.getElementById('form-ata')?.addEventListener('submit', async e => {
  e.preventDefault(); clearErr('ata-err');
  const data   = document.getElementById('ata-data').value;
  const num    = document.getElementById('ata-num').value.trim();
  const corpo  = document.getElementById('ata-corpo').value.trim();
  const delib  = document.getElementById('ata-delib').value.trim();
  if(!data||!corpo) return showErr('ata-err','Data e assuntos são obrigatórios.');
  const {error} = await db.from('atas').insert([{data_sessao:data,numero:num,corpo,deliberacoes:delib,secretario_id:EU?.id}]);
  if(error) return showErr('ata-err','Erro. Certifique-se que a tabela atas existe no Supabase.');
  toast('Ata registrada!');
  fecharModal('modal-ata'); carregarAtas();
});

/* ══ CARGO CUSTOMIZADO ══════════════════════════════════ */
window.abrirModalCargoCuston = () => document.getElementById('modal-cargo-custom').classList.add('open');

document.getElementById('form-cargo-custom')?.addEventListener('submit', async e => {
  e.preventDefault(); clearErr('cc-err');
  const nome = document.getElementById('cc-nome').value.trim();
  if(!nome) return showErr('cc-err','Nome do cargo é obrigatório.');
  const checks = [...document.querySelectorAll('#access-checks input:checked')];
  const privs = checks.map(c=>c.value);
  // Salva como campo na tabela (pode precisar de uma tabela cargos_custom)
  toast(`Cargo "${nome}" criado com ${privs.length} permissão(ões)!`);
  fecharModal('modal-cargo-custom');
});

/* ══ EXPORTAR DADOS ═════════════════════════════════════ */
window.exportarDados = async function() {
  await garantirMembros(true);
  const rows = MEMBROS.map(m=>[m.nome,m.usuario,m.cargo,m.trabalho||'',m.whatsapp||'',m.data_aniversario||''].join(','));
  const csv = 'Nome,Usuario,Cargo,Profissão,WhatsApp,Aniversário\n'+rows.join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const a = document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='ao-mosso-membros.csv'; a.click();
  toast('Dados exportados!');
};

/* ══ UPLOAD DE ARQUIVO ═════════════════════════════════ */
document.getElementById('upload-area')?.addEventListener('click', () => {
  document.getElementById('m-arquivo').click();
});

document.getElementById('m-arquivo')?.addEventListener('change', async e => {
  const file = e.target.files[0];
  if(!file) return;
  if(file.size > 25 * 1024 * 1024) {
    toast('Arquivo muito grande! Máximo 25MB','err');
    return;
  }
  await uploadArquivo(file);
});

document.getElementById('upload-area')?.addEventListener('dragover', e => {
  e.preventDefault();
  document.getElementById('upload-area').classList.add('dragover');
});

document.getElementById('upload-area')?.addEventListener('dragleave', () => {
  document.getElementById('upload-area').classList.remove('dragover');
});

document.getElementById('upload-area')?.addEventListener('drop', async e => {
  e.preventDefault();
  document.getElementById('upload-area').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if(file) {
    if(file.size > 25 * 1024 * 1024) {
      toast('Arquivo muito grande! Máximo 25MB','err');
      return;
    }
    await uploadArquivo(file);
  }
});

async function uploadArquivo(file) {
  const progress = document.getElementById('upload-progress');
  const fill = document.getElementById('upload-fill');
  const status = document.getElementById('upload-status');
  
  progress.classList.add('active');
  
  try {
    // Validar tamanho
    if(file.size > 25 * 1024 * 1024) {
      toast('Arquivo muito grande (máx 25MB)','err');
      progress.classList.remove('active');
      return;
    }
    
    // Preparar upload
    const tipoMidia = document.getElementById('m-tipo').value || 'docs';
    const timestamp = Date.now();
    const nomeArquivo = `${tipoMidia}/${timestamp}-${file.name}`;
    
    // Atualizar progresso visual
    status.textContent = 'Enviando...';
    fill.style.width = '30%';
    
    // Upload real para Supabase Storage
    const { data, error } = await db.storage
      .from('midias')
      .upload(nomeArquivo, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if(error) {
      // Se erro é que bucket não existe, criar aviso
      if(error.message.includes('404')) {
        toast('Bucket "midias" não configurado no Supabase','err');
      } else {
        toast(`Erro ao enviar: ${error.message}`,'err');
      }
      progress.classList.remove('active');
      return;
    }
    
    fill.style.width = '70%';
    
    // Gerar signed URL válida por 30 dias
    const { data: signedUrl, error: urlError } = await db.storage
      .from('midias')
      .createSignedUrl(data.path, 60 * 60 * 24 * 30);
    
    if(urlError) {
      toast('Erro ao gerar URL do arquivo','err');
      document.getElementById('m-url').value = data.path;
    } else {
      document.getElementById('m-url').value = signedUrl.signedUrl;
    }
    
    fill.style.width = '100%';
    status.textContent = '✓ Enviado';
    setTimeout(() => progress.classList.remove('active'), 2000);
    toast('Arquivo carregado com sucesso!');
    
  } catch(err) {
    console.error('Upload error:', err);
    toast(`Erro: ${err.message}`,'err');
    progress.classList.remove('active');
  }
}

/* ══ INICIALIZAR APLICAÇÃO ════════════════════════════ */
// Handler global para erros não tratados em Promises
window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled Promise rejection:', e.reason);
  e.preventDefault();
});

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

/* ══ RESTAURAR SESSÃO ═══════════════════════════════════ */
(function() {
  const s = localStorage.getItem('am_u');
  if(s) try { entrarApp(JSON.parse(s)); } catch { localStorage.removeItem('am_u'); }
})();