/* Nomad Horse Market — restauração do módulo financeiro estável (v21)
   Registra sinal/parcelas no Supabase e acompanha saldo automaticamente.
   Projeto: ndbekzgxdfuhjlocipiv
*/
(() => {
  'use strict';

  const SUPABASE_URL = 'https://ndbekzgxdfuhjlocipiv.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_H0DQ1mF0BW8bTysshtTJuw_Ulglk1_Z';
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

  let db = null;
  let dealsCache = [];
  let collectionLogCache = [];

  const money = (value) => Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));

  const dateBR = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
  };

  const localDateISO = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const dateOnlyBR = (value) => {
    if (!value) return '—';
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return dateBR(value);
    return `${match[3]}/${match[2]}/${match[1]}`;
  };

  const dateTimeBR = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const collectionChannelLabel = (value) => ({
    whatsapp_personal: 'WhatsApp pessoal',
    whatsapp_business: 'WhatsApp Business',
    copiar_mensagem: 'Mensagem copiada'
  }[String(value || '')] || 'Cobrança');

  function injectStyles() {
    if (document.getElementById('nh-finance-styles')) return;
    const style = document.createElement('style');
    style.id = 'nh-finance-styles';
    style.textContent = `
      .nh-finance{margin:18px 0}
      .nh-finance-head{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:14px}
      .nh-finance-head h3{margin:0}
      .nh-finance-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
      .nh-deal-card{border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:16px;background:rgba(255,255,255,.035)}
      .nh-deal-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .nh-deal-name{font-weight:800;font-size:1rem}
      .nh-deal-phone{opacity:.7;font-size:.88rem;margin-top:3px}
      .nh-badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:.74rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;background:rgba(255,255,255,.08)}
      .nh-money-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}
      .nh-money-box{padding:10px;border-radius:12px;background:rgba(255,255,255,.05)}
      .nh-money-box small{display:block;opacity:.68;margin-bottom:4px}
      .nh-money-box strong{font-size:.93rem}
      .nh-progress{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin:4px 0 13px}
      .nh-progress>span{display:block;height:100%;background:linear-gradient(90deg,#b98a35,#f0c66a);border-radius:99px}
      .nh-deal-actions{display:flex;gap:8px;flex-wrap:wrap}
      .nh-mini-btn{border:0;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer;background:#c89c4a;color:#111}
      .nh-mini-btn.secondary{background:rgba(255,255,255,.08);color:inherit;border:1px solid rgba(255,255,255,.10)}
      .nh-history{margin-top:12px;border-top:1px solid rgba(255,255,255,.08);padding-top:10px}
      .nh-history-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;font-size:.86rem;border-bottom:1px dashed rgba(255,255,255,.07)}
      .nh-history-row:last-child{border-bottom:0}
      .nh-empty{padding:18px;border-radius:14px;background:rgba(255,255,255,.04);opacity:.8}
      .nh-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;z-index:99999;padding:12px}
      .nh-modal{width:min(620px,100%);max-height:92vh;overflow:auto;border-radius:20px 20px 14px 14px;background:#161616;border:1px solid rgba(255,255,255,.12);padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.55)}
      .nh-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}
      .nh-modal-head h3{margin:0}
      .nh-close{border:0;background:rgba(255,255,255,.08);color:inherit;width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer}
      .nh-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .nh-form-grid .full{grid-column:1/-1}
      .nh-form-grid label{display:block;font-size:.83rem;margin-bottom:5px;opacity:.8}
      .nh-form-grid input,.nh-form-grid select,.nh-form-grid textarea{width:100%;box-sizing:border-box;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#222;color:#fff;padding:11px}
      .nh-form-grid textarea{min-height:78px;resize:vertical}
      .nh-submit{width:100%;border:0;border-radius:12px;padding:13px;font-weight:900;background:#c89c4a;color:#111;cursor:pointer}
      .nh-submit:disabled{opacity:.55;cursor:wait}
      .nh-form-note{font-size:.82rem;opacity:.72}
      .nh-error{padding:12px;border-radius:10px;background:rgba(180,50,50,.17);border:1px solid rgba(220,80,80,.30);margin-top:10px}
      .nh-alert{margin:12px 0;padding:12px 13px;border-radius:12px;font-weight:800}
      .nh-alert.overdue{background:rgba(190,50,50,.18);border:1px solid rgba(240,90,90,.34)}
      .nh-finance-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0 4px}
      .nh-overview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 16px}
      .nh-overview-card{padding:13px;border-radius:14px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08)}
      .nh-overview-card small{display:block;opacity:.68;margin-bottom:5px}
      .nh-overview-card strong{display:block;font-size:1.05rem}
      .nh-overview-card.overdue{background:rgba(190,50,50,.12);border-color:rgba(240,90,90,.28)}
      .nh-summary-card{padding:12px 13px;border-radius:13px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08)}
      .nh-summary-card small{display:block;opacity:.68;margin-bottom:5px;font-weight:700}
      .nh-summary-card strong{display:block;font-size:1rem}
      .nh-summary-card span{display:block;margin-top:4px;font-size:.82rem;opacity:.75}
      .nh-summary-card.next{border-color:rgba(200,156,74,.34);background:rgba(200,156,74,.08)}
      .nh-summary-card.overdue{border-color:rgba(240,90,90,.40);background:rgba(190,50,50,.20)}
      .nh-summary-card.overdue strong,.nh-summary-card.overdue span{color:#ffd4d4}
      .nh-schedule{margin-top:14px;border-top:1px solid rgba(255,255,255,.09);padding-top:12px}
      .nh-schedule-title{font-weight:900;margin-bottom:8px}
      .nh-schedule-row{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(110px,.8fr) minmax(105px,.7fr);gap:8px;align-items:center;padding:10px 0;border-bottom:1px dashed rgba(255,255,255,.08)}
      .nh-schedule-row:last-child{border-bottom:0}
      .nh-schedule-main strong{display:block}
      .nh-schedule-main small{display:block;opacity:.7;margin-top:2px}
      .nh-charge-btn{margin-top:8px;border:1px solid rgba(200,156,74,.34);background:rgba(200,156,74,.10);color:#f0c66a;border-radius:9px;padding:7px 10px;font-size:.76rem;font-weight:900;cursor:pointer}
      .nh-charge-btn.overdue{border-color:rgba(240,90,90,.38);background:rgba(190,50,50,.16);color:#ffd4d4}
      .nh-charge-meta{display:block;margin-top:7px;font-size:.72rem;opacity:.72;line-height:1.35}
      .nh-charge-meta.never{opacity:.58}
      .nh-due-alert{display:inline-flex;align-items:center;margin-top:7px;border-radius:999px;padding:5px 9px;font-size:.72rem;font-weight:900;line-height:1.2;border:1px solid transparent}
      .nh-due-alert.soon{background:rgba(200,156,74,.10);border-color:rgba(200,156,74,.30);color:#f0c66a}
      .nh-due-alert.warning{background:rgba(221,153,35,.16);border-color:rgba(240,177,66,.34);color:#ffd58a}
      .nh-due-alert.urgent{background:rgba(190,75,40,.18);border-color:rgba(240,120,75,.38);color:#ffd0b5}
      .nh-due-alert.overdue{background:rgba(190,50,50,.22);border-color:rgba(240,90,90,.42);color:#ffd4d4}
      .nh-collection-group.alerts{border-color:rgba(200,156,74,.22);background:rgba(200,156,74,.045)}
      .nh-collection-group.alerts.critical{border-color:rgba(240,90,90,.30);background:rgba(190,50,50,.08)}
      .nh-collection-center{margin:0 0 18px;padding:15px;border-radius:16px;background:rgba(200,156,74,.055);border:1px solid rgba(200,156,74,.20)}
      .nh-collection-center-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px}
      .nh-collection-center-head h4{margin:0;font-size:1.05rem}
      .nh-collection-center-head span{display:block;margin-top:3px;font-size:.82rem;opacity:.7}
      .nh-collection-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:12px}
      .nh-collection-stat{padding:11px;border-radius:12px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08)}
      .nh-collection-stat small{display:block;opacity:.68;margin-bottom:4px}
      .nh-collection-stat strong{display:block;font-size:1rem}
      .nh-collection-stat.overdue{background:rgba(190,50,50,.13);border-color:rgba(240,90,90,.28)}
      .nh-collection-groups{display:grid;gap:10px}
      .nh-collection-group{padding:11px 12px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}
      .nh-collection-group h5{margin:0 0 7px;font-size:.9rem}
      .nh-collection-list{display:grid;gap:7px}
      .nh-collection-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 0;border-bottom:1px dashed rgba(255,255,255,.07)}
      .nh-collection-row:last-child{border-bottom:0}
      .nh-collection-row strong{display:block;font-size:.84rem}
      .nh-collection-row small{display:block;opacity:.68;margin-top:2px;font-size:.76rem;line-height:1.35}
      .nh-collection-empty{font-size:.8rem;opacity:.58}
      .nh-collection-action{border:1px solid rgba(200,156,74,.34);background:rgba(200,156,74,.10);color:#f0c66a;border-radius:8px;padding:7px 9px;font-size:.72rem;font-weight:900;cursor:pointer}
      .nh-collection-action.overdue{border-color:rgba(240,90,90,.38);background:rgba(190,50,50,.16);color:#ffd4d4}
      .nh-schedule-money{text-align:right}
      .nh-status{display:inline-flex;justify-self:start;border-radius:999px;padding:5px 9px;font-size:.72rem;font-weight:900;text-transform:uppercase;background:rgba(255,255,255,.08)}
      .nh-status.atrasado{background:rgba(190,50,50,.25)}
      .nh-status.pago{background:rgba(45,150,85,.22)}
      .nh-status.parcial{background:rgba(190,140,35,.22)}
      .nh-schedule-editor{display:grid;gap:12px;margin:12px 0}
      .nh-schedule-edit-row{padding:13px;border-radius:14px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09)}
      .nh-schedule-edit-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}
      .nh-schedule-edit-head strong{font-size:.95rem}
      .nh-remove-row{border:1px solid rgba(240,90,90,.28);background:rgba(190,50,50,.12);color:#ffd4d4;border-radius:9px;padding:7px 10px;font-weight:800;cursor:pointer}
      .nh-remove-row:hover{background:rgba(190,50,50,.22)}
      .nh-add-row{width:100%;margin-top:2px;border:1px dashed rgba(200,156,74,.42);background:rgba(200,156,74,.08);color:inherit;border-radius:12px;padding:12px;font-weight:900;cursor:pointer}
      .nh-schedule-count{font-size:.82rem;opacity:.72;margin-top:8px}
      .nh-schedule-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .nh-schedule-edit-grid .full{grid-column:1/-1}
      .nh-schedule-edit-grid label{display:block;font-size:.78rem;opacity:.72;margin-bottom:4px}
      .nh-schedule-edit-grid input,.nh-schedule-edit-grid select{width:100%;box-sizing:border-box;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#222;color:#fff;padding:10px}
      .nh-schedule-total{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}
      .nh-schedule-total>div{padding:12px;border-radius:12px;background:rgba(255,255,255,.05)}
      .nh-schedule-total small{display:block;opacity:.68;margin-bottom:4px}
      .nh-schedule-total strong{font-size:1rem}
      .nh-ok{padding:12px;border-radius:10px;background:rgba(45,150,85,.16);border:1px solid rgba(70,190,110,.28);margin-top:10px}
      .nh-project-head-actions{display:flex;gap:8px;flex-wrap:wrap}
      .nh-project-preview{display:grid;gap:8px;margin-top:8px}
      .nh-project-preview-row{display:grid;grid-template-columns:1fr auto;gap:10px;padding:9px 10px;border-radius:10px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07)}
      .nh-project-preview-row small{display:block;opacity:.68;margin-top:2px}
      .nh-project-preview-total{display:flex;justify-content:space-between;gap:12px;padding:11px 12px;border-radius:11px;background:rgba(200,156,74,.08);border:1px solid rgba(200,156,74,.25);font-weight:900}
      .nh-project-setup-action{margin-top:12px}
      .nh-project-note{padding:11px 12px;border-radius:11px;background:rgba(200,156,74,.08);border:1px solid rgba(200,156,74,.22);font-size:.86rem}
      @media(max-width:620px){.nh-collection-stats{grid-template-columns:1fr 1fr}.nh-collection-row{grid-template-columns:1fr}.nh-collection-action{justify-self:start}.nh-money-row{grid-template-columns:1fr}.nh-finance-summary{grid-template-columns:1fr}.nh-overview{grid-template-columns:1fr 1fr}.nh-form-grid{grid-template-columns:1fr}.nh-form-grid .full{grid-column:auto}.nh-schedule-row{grid-template-columns:1fr auto}.nh-schedule-money{grid-column:1/-1;text-align:left}}
    `;
    document.head.appendChild(style);
  }

  function loadSdk() {
    return new Promise((resolve, reject) => {
      if (window.supabase?.createClient) return resolve();
      const existing = document.querySelector(`script[src="${SDK_URL}"]`);
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Não foi possível carregar a biblioteca do Supabase.'));
      document.head.appendChild(script);
    });
  }

  function getAdminSection() {
    return document.getElementById('view-admin');
  }

  function injectPanel() {
    const admin = getAdminSection();
    if (!admin || document.getElementById('nhFinancePanel')) return;

    const shell = admin.querySelector('.shell') || admin;
    const panel = document.createElement('div');
    panel.id = 'nhFinancePanel';
    panel.className = 'panel nh-finance';
    panel.innerHTML = `
      <div class="nh-finance-head">
        <div>
          <h3>Financeiro dos projetos</h3>
          <div class="muted">Sinal, parcelas, total pago e saldo restante.</div>
        </div>
        <div class="nh-project-head-actions">
          <button type="button" class="nh-mini-btn" id="nhNewProject">Novo projeto</button>
          <button type="button" class="nh-mini-btn secondary" id="nhRefreshFinance">Atualizar</button>
        </div>
      </div>
      <div id="nhFinanceBody"><div class="nh-empty">Carregando financeiro…</div></div>
    `;

    const stats = shell.querySelector('.stats');
    if (stats) stats.insertAdjacentElement('afterend', panel);
    else shell.prepend(panel);

    document.getElementById('nhRefreshFinance')?.addEventListener('click', loadFinance);
    document.getElementById('nhNewProject')?.addEventListener('click', () => openProjectSetupModal());
  }

  async function loadFinance() {
    const body = document.getElementById('nhFinanceBody');
    if (!body || !db) return;
    body.innerHTML = '<div class="nh-empty">Carregando financeiro…</div>';

    try {
      const { data: sessionData } = await db.auth.getSession();
      if (!sessionData?.session) {
        body.innerHTML = '<div class="nh-empty">Entre no painel como administrador para visualizar e registrar pagamentos.</div>';
        return;
      }

      const { data: deals, error: dealsError } = await db
        .from('deals')
        .select('id,buyer_lead_id,seller_lead_id,stage,project_value,agreed_price,installment_count,payment_status,notes,created_at')
        .order('created_at', { ascending: false });
      if (dealsError) throw dealsError;

      if (!deals?.length) {
        dealsCache = [];
        body.innerHTML = '<div class="nh-empty">Nenhum projeto financeiro cadastrado.</div>';
        return;
      }

      const leadIds = [...new Set(deals.flatMap(d => [d.buyer_lead_id, d.seller_lead_id]).filter(Boolean))];
      const dealIds = deals.map(d => d.id);

      const [leadResult, paymentResult, scheduleResult, collectionResult] = await Promise.all([
        leadIds.length
          ? db.from('leads').select('id,name,phone,interest,vehicle_type,lead_type').in('id', leadIds)
          : Promise.resolve({ data: [], error: null }),
        db.from('deal_payments')
          .select('id,deal_id,payment_type,amount,installment_number,paid_at,payment_method,notes,created_at')
          .in('deal_id', dealIds)
          .order('paid_at', { ascending: false }),
        db.from('deal_installment_schedule')
          .select('id,deal_id,installment_number,kind,amount,due_date,due_label,paid_amount,outstanding_amount,effective_status,last_paid_at,notes')
          .in('deal_id', dealIds)
          .order('installment_number', { ascending: true }),
        db.from('deal_collection_log')
          .select('deal_id,installment_number,channel,charged_at')
          .in('deal_id', dealIds)
          .order('charged_at', { ascending: false })
      ]);

      if (leadResult.error) throw leadResult.error;
      if (paymentResult.error) throw paymentResult.error;
      if (scheduleResult.error) throw scheduleResult.error;
      if (collectionResult.error) throw collectionResult.error;

      collectionLogCache = collectionResult.data || [];

      const leads = new Map((leadResult.data || []).map(l => [l.id, l]));
      const paymentsByDeal = new Map();
      (paymentResult.data || []).forEach(p => {
        if (!paymentsByDeal.has(p.deal_id)) paymentsByDeal.set(p.deal_id, []);
        paymentsByDeal.get(p.deal_id).push(p);
      });

      const scheduleByDeal = new Map();
      (scheduleResult.data || []).forEach(item => {
        if (!scheduleByDeal.has(item.deal_id)) scheduleByDeal.set(item.deal_id, []);
        scheduleByDeal.get(item.deal_id).push(item);
      });

      const collectionByKey = new Map();
      (collectionResult.data || []).forEach(row => {
        const key = `${row.deal_id}:${row.installment_number}`;
        const current = collectionByKey.get(key);
        if (!current) {
          collectionByKey.set(key, {
            channel: row.channel,
            charged_at: row.charged_at,
            count: 1
          });
        } else {
          current.count += 1;
        }
      });

      dealsCache = deals.map(d => {
        const customer = leads.get(d.buyer_lead_id) || leads.get(d.seller_lead_id) || {};
        const payments = paymentsByDeal.get(d.id) || [];
        const schedule = (scheduleByDeal.get(d.id) || []).map(item => ({
          ...item,
          collection: collectionByKey.get(`${d.id}:${item.installment_number}`) || null
        }));
        const total = Number(d.project_value ?? d.agreed_price ?? 0);
        const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const balance = Math.max(total - paid, 0);
        const overdue = schedule.filter(i => i.effective_status === 'atrasado');
        const overdueAmount = overdue.reduce((sum, i) => sum + Number(i.outstanding_amount || 0), 0);
        return { ...d, customer, payments, schedule, overdue, overdueAmount, total, paid, balance };
      });

      renderFinance();
    } catch (err) {
      console.error('[Nomad Horse Finance]', err);
      const msg = String(err?.message || err || 'Erro ao carregar financeiro.');
      body.innerHTML = `<div class="nh-error">Não foi possível carregar o financeiro: ${esc(msg)}</div>`;
    }
  }

  function localDateFromTimestamp(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return localDateISO(d);
  }

  function dateOnlyAsLocalDate(value) {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  }

  function daysUntilDue(value) {
    const due = dateOnlyAsLocalDate(value);
    if (!due) return null;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / 86400000);
  }

  function dueAlertInfo(item) {
    const status = String(item?.effective_status || 'pendente').toLowerCase();
    const days = daysUntilDue(item?.due_date);
    if (status === 'atrasado' || (days !== null && days < 0)) {
      const late = days === null ? null : Math.abs(days);
      return { level: 'overdue', days, label: late === null ? '⚠ Pagamento atrasado' : `⚠ Atrasado há ${late} ${late === 1 ? 'dia' : 'dias'}` };
    }
    if (days === null || days > 7) return null;
    if (days <= 0) return { level: 'urgent', days, label: '⚠ Vence hoje' };
    if (days <= 1) return { level: 'urgent', days, label: '⚠ Vence amanhã' };
    if (days <= 3) return { level: 'warning', days, label: `⚠ Vence em ${days} dias` };
    return { level: 'soon', days, label: `Atenção: vence em ${days} dias` };
  }

  function buildCollectionDashboard() {
    const today = new Date();
    today.setHours(12,0,0,0);
    const todayISO = localDateISO(today);
    const upcomingLimit = new Date(today);
    upcomingLimit.setDate(upcomingLimit.getDate() + 15);

    const todayActions = collectionLogCache
      .filter(row => localDateFromTimestamp(row.charged_at) === todayISO)
      .map(row => {
        const deal = dealsCache.find(d => String(d.id) === String(row.deal_id));
        const item = deal?.schedule?.find(i => Number(i.installment_number) === Number(row.installment_number));
        return deal && item ? { deal, item, row } : null;
      }).filter(Boolean);

    const upcoming = [];
    const dueAlerts = [];
    const overdue = [];
    const neverChargedClients = [];

    dealsCache.forEach(deal => {
      const unpaid = (deal.schedule || []).filter(item => {
        const status = String(item.effective_status || 'pendente').toLowerCase();
        return ['pendente','parcial','atrasado'].includes(status) && Number(item.outstanding_amount ?? item.amount) > 0;
      });

      if (unpaid.length && !unpaid.some(item => item.collection)) {
        const first = unpaid.find(item => item.due_date) || unpaid[0];
        neverChargedClients.push({ deal, item: first });
      }

      unpaid.forEach(item => {
        const status = String(item.effective_status || '').toLowerCase();
        const alert = dueAlertInfo(item);
        if (status === 'atrasado') {
          overdue.push({ deal, item });
          return;
        }
        if (!item.due_date) return;
        const due = dateOnlyAsLocalDate(item.due_date);
        if (alert && alert.days !== null && alert.days >= 0 && alert.days <= 7) dueAlerts.push({ deal, item, due, alert });
        if (due && due >= today && due <= upcomingLimit) upcoming.push({ deal, item, due });
      });
    });

    upcoming.sort((a,b) => a.due - b.due);
    dueAlerts.sort((a,b) => (a.alert.days ?? 999) - (b.alert.days ?? 999));
    overdue.sort((a,b) => String(a.item.due_date || '').localeCompare(String(b.item.due_date || '')));
    neverChargedClients.sort((a,b) => String(a.deal.customer?.name || '').localeCompare(String(b.deal.customer?.name || '')));

    const upcomingAmount = upcoming.reduce((sum, x) => sum + Number(x.item.outstanding_amount ?? x.item.amount ?? 0), 0);
    const overdueAmount = overdue.reduce((sum, x) => sum + Number(x.item.outstanding_amount ?? x.item.amount ?? 0), 0);

    const todayRows = todayActions.length
      ? todayActions.slice(0,6).map(({deal,item,row}) => `
          <div class="nh-collection-row">
            <div><strong>${esc(deal.customer?.name || 'Cliente')} • ${esc(labelPaymentType(item.kind))} #${esc(item.installment_number)}</strong><small>${esc(dateTimeBR(row.charged_at))} • ${esc(collectionChannelLabel(row.channel))}</small></div>
          </div>`).join('')
      : '<div class="nh-collection-empty">Nenhuma ação de cobrança registrada hoje.</div>';

    const dueAlertRows = dueAlerts.length
      ? dueAlerts.slice(0,8).map(({deal,item,alert}) => `
          <div class="nh-collection-row">
            <div><strong>${esc(deal.customer?.name || 'Cliente')} • ${money(item.outstanding_amount ?? item.amount)}</strong><small>${esc(labelPaymentType(item.kind))} #${esc(item.installment_number)} • ${esc(alert.label)} • ${esc(dateOnlyBR(item.due_date))}</small></div>
            <button type="button" class="nh-collection-action ${alert.level === 'urgent' ? 'overdue' : ''}" data-collection-charge="${esc(deal.id)}" data-installment="${esc(item.installment_number)}">Cobrar</button>
          </div>`).join('')
      : '<div class="nh-collection-empty">Nenhum alerta de vencimento nos próximos 7 dias.</div>';

    const upcomingRows = upcoming.length
      ? upcoming.slice(0,6).map(({deal,item}) => `
          <div class="nh-collection-row">
            <div><strong>${esc(deal.customer?.name || 'Cliente')} • ${money(item.outstanding_amount ?? item.amount)}</strong><small>${esc(labelPaymentType(item.kind))} #${esc(item.installment_number)} • vence ${esc(dateOnlyBR(item.due_date))}</small></div>
            <button type="button" class="nh-collection-action" data-collection-charge="${esc(deal.id)}" data-installment="${esc(item.installment_number)}">Cobrar</button>
          </div>`).join('')
      : '<div class="nh-collection-empty">Nenhum vencimento nos próximos 15 dias.</div>';

    const overdueRows = overdue.length
      ? overdue.slice(0,6).map(({deal,item}) => `
          <div class="nh-collection-row">
            <div><strong>${esc(deal.customer?.name || 'Cliente')} • ${money(item.outstanding_amount ?? item.amount)}</strong><small>${esc(labelPaymentType(item.kind))} #${esc(item.installment_number)} • venceu ${esc(dateOnlyBR(item.due_date))}</small></div>
            <button type="button" class="nh-collection-action overdue" data-collection-charge="${esc(deal.id)}" data-installment="${esc(item.installment_number)}">Cobrar agora</button>
          </div>`).join('')
      : '<div class="nh-collection-empty">Nenhuma parcela em atraso.</div>';

    const neverRows = neverChargedClients.length
      ? neverChargedClients.slice(0,6).map(({deal,item}) => `
          <div class="nh-collection-row">
            <div><strong>${esc(deal.customer?.name || 'Cliente')}</strong><small>Nenhuma cobrança registrada neste projeto.</small></div>
            <button type="button" class="nh-collection-action" data-collection-charge="${esc(deal.id)}" data-installment="${esc(item.installment_number)}">Fazer 1ª cobrança</button>
          </div>`).join('')
      : '<div class="nh-collection-empty">Todos os projetos em aberto já possuem ao menos uma ação de cobrança.</div>';

    return `
      <section class="nh-collection-center">
        <div class="nh-collection-center-head">
          <div><h4>Central de cobranças</h4><span>Acompanhe ações, vencimentos e pendências sem abrir cliente por cliente.</span></div>
        </div>
        <div class="nh-collection-stats">
          <div class="nh-collection-stat"><small>Cobranças hoje</small><strong>${esc(todayActions.length)}</strong></div>
          <div class="nh-collection-stat ${dueAlerts.some(x => x.alert.level === 'urgent') ? 'overdue' : ''}"><small>Alertas 7 dias</small><strong>${esc(dueAlerts.length)}</strong></div>
          <div class="nh-collection-stat"><small>Próximos 15 dias</small><strong>${esc(upcoming.length)} • ${money(upcomingAmount)}</strong></div>
          <div class="nh-collection-stat ${overdue.length ? 'overdue' : ''}"><small>Em atraso</small><strong>${esc(overdue.length)} • ${money(overdueAmount)}</strong></div>
          <div class="nh-collection-stat"><small>Clientes nunca cobrados</small><strong>${esc(neverChargedClients.length)}</strong></div>
        </div>
        <div class="nh-collection-groups">
          <div class="nh-collection-group"><h5>Cobranças feitas hoje</h5><div class="nh-collection-list">${todayRows}</div></div>
          <div class="nh-collection-group alerts ${dueAlerts.some(x => x.alert.level === 'urgent') ? 'critical' : ''}"><h5>Alertas de vencimento • 7 / 3 / 1 dia</h5><div class="nh-collection-list">${dueAlertRows}</div></div>
          <div class="nh-collection-group"><h5>Parcelas próximas do vencimento</h5><div class="nh-collection-list">${upcomingRows}</div></div>
          <div class="nh-collection-group"><h5>Parcelas atrasadas</h5><div class="nh-collection-list">${overdueRows}</div></div>
          <div class="nh-collection-group"><h5>Clientes ainda nunca cobrados</h5><div class="nh-collection-list">${neverRows}</div></div>
        </div>
      </section>`;
  }

  function renderFinance() {
    const body = document.getElementById('nhFinanceBody');
    if (!body) return;

    const html = dealsCache.map(deal => {
      const pct = deal.total > 0 ? Math.min(100, Math.round((deal.paid / deal.total) * 100)) : 0;
      const displayStatus = deal.balance <= 0 && deal.total > 0
        ? 'Quitado'
        : deal.paid > 0 ? 'Parcial' : 'Aguardando sinal';
      const paymentHistory = deal.payments.length
        ? `<div class="nh-history"><strong>Pagamentos</strong>${deal.payments.map(p => `
            <div class="nh-history-row">
              <span>${esc(labelPaymentType(p.payment_type))}${p.installment_number ? ` #${esc(p.installment_number)}` : ''} • ${dateBR(p.paid_at)}${p.payment_method ? ` • ${esc(p.payment_method)}` : ''}</span>
              <strong>${money(p.amount)}</strong>
            </div>`).join('')}</div>`
        : '<div class="nh-history"><span class="muted">Nenhum pagamento registrado.</span></div>';

      const scheduleHtml = deal.schedule.length
        ? `<div class="nh-schedule">
            <div class="nh-schedule-title">Cronograma de pagamentos</div>
            ${deal.schedule.map(item => {
              const status = String(item.effective_status || 'pendente').toLowerCase();
              const due = item.due_date ? dateOnlyBR(item.due_date) : (item.due_label || 'Sem data');
              const label = labelPaymentType(item.kind);
              const paidInfo = Number(item.paid_amount || 0) > 0 ? ` • pago ${money(item.paid_amount)}` : '';
              const dueAlert = dueAlertInfo(item);
              const dueAlertHtml = dueAlert ? `<span class="nh-due-alert ${esc(dueAlert.level)}">${esc(dueAlert.label)}</span>` : '';
              const canCharge = ['pendente','parcial','atrasado'].includes(status) && Number(item.outstanding_amount ?? item.amount) > 0;
              const collection = item.collection || null;
              const chargeMeta = canCharge
                ? collection
                  ? `<span class="nh-charge-meta">Última ação de cobrança: ${esc(dateTimeBR(collection.charged_at))} • ${esc(collectionChannelLabel(collection.channel))}${Number(collection.count || 0) > 1 ? ` • ${esc(collection.count)} ações` : ''}</span>`
                  : `<span class="nh-charge-meta never">Cobrança ainda não feita</span>`
                : '';
              const chargeButton = canCharge
                ? `<button type="button" class="nh-charge-btn ${status === 'atrasado' ? 'overdue' : ''}" data-charge-whatsapp="${esc(deal.id)}" data-installment="${esc(item.installment_number)}">${collection ? 'Cobrar novamente' : 'Cobrar no WhatsApp'}</button>`
                : '';
              return `<div class="nh-schedule-row">
                <div class="nh-schedule-main"><strong>${esc(label)} #${esc(item.installment_number)}</strong><small>Vencimento: ${esc(due)}${paidInfo}</small>${dueAlertHtml}${chargeMeta}${chargeButton}</div>
                <span class="nh-status ${esc(status)}">${esc(status)}</span>
                <strong class="nh-schedule-money">${money(item.outstanding_amount ?? item.amount)}</strong>
              </div>`;
            }).join('')}
          </div>`
        : '<div class="nh-schedule"><span class="muted">Cronograma ainda não cadastrado.</span></div>';

      const overdueAlert = deal.overdue.length
        ? `<div class="nh-alert overdue">⚠ ${deal.overdue.length} pagamento(s) em atraso • ${money(deal.overdueAmount)} pendente</div>`
        : '';

      const unpaid = deal.schedule.filter(i => ['pendente','parcial','atrasado'].includes(String(i.effective_status || '').toLowerCase()));
      const deposit = unpaid.find(i => String(i.kind || '').toLowerCase() === 'sinal');
      const dated = unpaid
        .filter(i => i.due_date)
        .sort((a,b) => String(a.due_date).localeCompare(String(b.due_date)));
      const nextDue = deal.overdue.length
        ? [...deal.overdue].filter(i => i.due_date).sort((a,b) => String(a.due_date).localeCompare(String(b.due_date)))[0] || dated[0]
        : dated[0];

      const depositCard = deposit
        ? `<div class="nh-summary-card"><small>Sinal pendente</small><strong>${money(deposit.outstanding_amount ?? deposit.amount)}</strong><span>${esc(deposit.due_label || 'Aguardando pagamento')}</span></div>`
        : '';

      const nextDueStatus = nextDue ? String(nextDue.effective_status || 'pendente').toLowerCase() : '';
      const nextDueAlert = nextDue ? dueAlertInfo(nextDue) : null;
      const nextDueCard = nextDue
        ? `<div class="nh-summary-card ${nextDueStatus === 'atrasado' ? 'overdue' : 'next'}"><small>${nextDueStatus === 'atrasado' ? 'Pagamento atrasado' : 'Próximo vencimento'}</small><strong>${dateOnlyBR(nextDue.due_date)} • ${money(nextDue.outstanding_amount ?? nextDue.amount)}</strong><span>${esc(labelPaymentType(nextDue.kind))} #${esc(nextDue.installment_number)}${nextDueStatus === 'atrasado' ? ' • regularizar' : nextDueAlert ? ` • ${esc(nextDueAlert.label.replace('⚠ ', ''))}` : ''}</span></div>`
        : '';

      const financeSummary = (depositCard || nextDueCard)
        ? `<div class="nh-finance-summary">${depositCard}${nextDueCard}</div>`
        : '';

      return `
        <article class="nh-deal-card" data-deal-id="${esc(deal.id)}">
          <div class="nh-deal-top">
            <div>
              <div class="nh-deal-name">${esc(deal.customer?.name || 'Cliente sem nome')}</div>
              <div class="nh-deal-phone">${esc(deal.customer?.phone || '')}</div>
            </div>
            <span class="nh-badge">${esc(displayStatus)}</span>
          </div>
          <div class="nh-money-row">
            <div class="nh-money-box"><small>Projeto</small><strong>${money(deal.total)}</strong></div>
            <div class="nh-money-box"><small>Pago</small><strong>${money(deal.paid)}</strong></div>
            <div class="nh-money-box"><small>Saldo</small><strong>${money(deal.balance)}</strong></div>
          </div>
          <div class="nh-progress"><span style="width:${pct}%"></span></div>
          ${financeSummary}
          ${overdueAlert}
          ${scheduleHtml}
          <div class="nh-deal-actions" style="margin-top:14px">
            ${deal.balance > 0 ? `<button type="button" class="nh-mini-btn" data-register-payment="${esc(deal.id)}">Registrar pagamento</button>` : ''}
            <button type="button" class="nh-mini-btn secondary" data-edit-schedule="${esc(deal.id)}">Editar cronograma</button>
            <button type="button" class="nh-mini-btn secondary" data-toggle-history="${esc(deal.id)}">Ver pagamentos</button>
          </div>
          <div id="nhHistory-${esc(deal.id)}" style="display:none">${paymentHistory}</div>
        </article>`;
    }).join('');

    const totals = dealsCache.reduce((acc, deal) => {
      acc.total += Number(deal.total || 0);
      acc.paid += Number(deal.paid || 0);
      acc.balance += Number(deal.balance || 0);
      acc.overdue += Number(deal.overdueAmount || 0);
      return acc;
    }, { total: 0, paid: 0, balance: 0, overdue: 0 });

    const overview = `
      <div class="nh-overview">
        <div class="nh-overview-card"><small>Total contratado</small><strong>${money(totals.total)}</strong></div>
        <div class="nh-overview-card"><small>Recebido</small><strong>${money(totals.paid)}</strong></div>
        <div class="nh-overview-card"><small>A receber</small><strong>${money(totals.balance)}</strong></div>
        <div class="nh-overview-card ${totals.overdue > 0 ? 'overdue' : ''}"><small>Em atraso</small><strong>${money(totals.overdue)}</strong></div>
      </div>`;

    const collectionDashboard = buildCollectionDashboard();
    body.innerHTML = `${collectionDashboard}${overview}<div class="nh-finance-grid">${html}</div>`;

    body.querySelectorAll('[data-collection-charge]').forEach(btn => {
      btn.addEventListener('click', () => openChargeWhatsApp(btn.dataset.collectionCharge, Number(btn.dataset.installment)));
    });
    body.querySelectorAll('[data-register-payment]').forEach(btn => {
      btn.addEventListener('click', () => openPaymentModal(btn.dataset.registerPayment));
    });
    body.querySelectorAll('[data-charge-whatsapp]').forEach(btn => {
      btn.addEventListener('click', () => openChargeWhatsApp(btn.dataset.chargeWhatsapp, Number(btn.dataset.installment)));
    });
    body.querySelectorAll('[data-edit-schedule]').forEach(btn => {
      btn.addEventListener('click', () => openScheduleModal(btn.dataset.editSchedule));
    });
    body.querySelectorAll('[data-toggle-history]').forEach(btn => {
      btn.addEventListener('click', () => {
        const el = document.getElementById(`nhHistory-${btn.dataset.toggleHistory}`);
        if (!el) return;
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
      });
    });
  }

  function scheduleEditRowHtml(item) {
    const paid = Number(item.paid_amount || 0);
    const min = Math.max(paid, 0.01);
    const dueDate = item.due_date ? String(item.due_date).slice(0,10) : '';
    const dueLabel = item.due_date ? '' : String(item.due_label || '');
    const id = item.id || '';
    const number = Number(item.installment_number || 0);
    const removable = paid <= 0;

    return `
      <div class="nh-schedule-edit-row" data-schedule-row data-id="${esc(id)}" data-number="${esc(number)}" data-paid="${esc(paid)}">
        <div class="nh-schedule-edit-head">
          <strong class="nh-schedule-edit-title">${esc(labelPaymentType(item.kind || 'parcela'))} #${esc(number)}</strong>
          ${paid > 0
            ? `<span class="nh-badge">Pago ${money(paid)}</span>`
            : `<button type="button" class="nh-remove-row" data-remove-schedule-row aria-label="Remover parcela">Remover</button>`}
        </div>
        <div class="nh-schedule-edit-grid">
          <div>
            <label>Tipo</label>
            <select name="kind">
              <option value="sinal" ${item.kind === 'sinal' ? 'selected' : ''}>Sinal</option>
              <option value="parcela" ${!item.kind || item.kind === 'parcela' ? 'selected' : ''}>Parcela</option>
              <option value="saldo" ${item.kind === 'saldo' ? 'selected' : ''}>Saldo</option>
            </select>
          </div>
          <div>
            <label>Valor (R$)</label>
            <input name="amount" type="number" min="${min.toFixed(2)}" step="0.01" value="${Number(item.amount || 0).toFixed(2)}" inputmode="decimal" required>
          </div>
          <div>
            <label>Data de vencimento</label>
            <input name="due_date" type="date" value="${esc(dueDate)}">
          </div>
          <div>
            <label>Ou referência</label>
            <input name="due_label" type="text" value="${esc(dueLabel)}" placeholder="Ex.: Na entrega">
          </div>
        </div>
      </div>`;
  }

  function openScheduleModal(dealId) {
    const deal = dealsCache.find(d => d.id === dealId);
    if (!deal) return;
    if (!deal.schedule?.length) {
      alert('Este projeto ainda não possui cronograma cadastrado.');
      return;
    }

    closeScheduleModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'nh-modal-backdrop';
    backdrop.id = 'nhScheduleModal';

    const rows = deal.schedule.map(item => scheduleEditRowHtml(item)).join('');

    backdrop.innerHTML = `
      <div class="nh-modal" role="dialog" aria-modal="true" aria-label="Editar cronograma">
        <div class="nh-modal-head">
          <div>
            <h3>Editar cronograma</h3>
            <div class="muted">${esc(deal.customer?.name || 'Cliente')} • projeto ${money(deal.total)}</div>
          </div>
          <button type="button" class="nh-close" id="nhCloseSchedule" aria-label="Fechar">×</button>
        </div>
        <form id="nhScheduleForm">
          <div class="nh-form-note">Altere valores e vencimentos. Você pode adicionar ou remover parcelas sem pagamento. Parcelas que já receberam valor ficam protegidas. A soma precisa continuar igual ao total do projeto.</div>
          <div class="nh-schedule-editor" id="nhScheduleEditor">${rows}</div>
          <button type="button" class="nh-add-row" id="nhAddInstallment">+ ADICIONAR PARCELA</button>
          <div class="nh-schedule-count" id="nhScheduleCount"></div>
          <div class="nh-schedule-total">
            <div><small>Total do projeto</small><strong>${money(deal.total)}</strong></div>
            <div><small>Total do cronograma</small><strong id="nhScheduleTotal">${money(deal.schedule.reduce((s,i)=>s+Number(i.amount||0),0))}</strong></div>
          </div>
          <div id="nhScheduleError"></div>
          <button class="nh-submit" type="submit">SALVAR CRONOGRAMA</button>
        </form>
      </div>`;
    document.body.appendChild(backdrop);

    document.getElementById('nhCloseSchedule')?.addEventListener('click', closeScheduleModal);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeScheduleModal(); });

    const form = document.getElementById('nhScheduleForm');
    const editor = document.getElementById('nhScheduleEditor');

    function bindRow(row) {
      row.querySelector('input[name="amount"]')?.addEventListener('input', () => updateScheduleTotal(deal));
      row.querySelector('input[name="due_date"]')?.addEventListener('change', (e) => {
        const label = row.querySelector('input[name="due_label"]');
        if (e.currentTarget.value && label) label.value = '';
      });
      row.querySelector('input[name="due_label"]')?.addEventListener('input', (e) => {
        const date = row.querySelector('input[name="due_date"]');
        if (e.currentTarget.value.trim() && date) date.value = '';
      });
      row.querySelector('select[name="kind"]')?.addEventListener('change', (e) => {
        const title = row.querySelector('.nh-schedule-edit-title');
        if (title) title.textContent = `${labelPaymentType(e.currentTarget.value)} #${row.dataset.number}`;
      });
      row.querySelector('[data-remove-schedule-row]')?.addEventListener('click', () => {
        if (Number(row.dataset.paid || 0) > 0) return;
        const rowsNow = form.querySelectorAll('[data-schedule-row]');
        if (rowsNow.length <= 1) {
          document.getElementById('nhScheduleError').innerHTML = '<div class="nh-error">O cronograma precisa ter pelo menos uma parcela.</div>';
          return;
        }
        row.remove();
        updateScheduleTotal(deal);
      });
    }

    editor?.querySelectorAll('[data-schedule-row]').forEach(bindRow);

    document.getElementById('nhAddInstallment')?.addEventListener('click', () => {
      const currentRows = [...form.querySelectorAll('[data-schedule-row]')];
      const nextNumber = Math.max(0, ...currentRows.map(r => Number(r.dataset.number || 0))) + 1;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = scheduleEditRowHtml({
        id: null,
        installment_number: nextNumber,
        kind: 'parcela',
        amount: 0,
        due_date: null,
        due_label: '',
        paid_amount: 0
      }).trim();
      const row = wrapper.firstElementChild;
      editor.appendChild(row);
      bindRow(row);
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      updateScheduleTotal(deal);
    });

    form?.addEventListener('submit', (e) => saveSchedule(e, deal));
    updateScheduleTotal(deal);
  }

  function closeScheduleModal() {
    document.getElementById('nhScheduleModal')?.remove();
  }

  function scheduleRowsFromForm() {
    return [...document.querySelectorAll('#nhScheduleForm [data-schedule-row]')].map(row => ({
      id: row.dataset.id || null,
      installment_number: Number(row.dataset.number),
      paid_amount: Number(row.dataset.paid || 0),
      kind: row.querySelector('[name="kind"]')?.value || 'parcela',
      amount: Number(row.querySelector('[name="amount"]')?.value || 0),
      due_date: row.querySelector('[name="due_date"]')?.value || null,
      due_label: row.querySelector('[name="due_label"]')?.value?.trim() || null
    }));
  }

  function updateScheduleTotal(deal) {
    const rows = scheduleRowsFromForm();
    const totalEl = document.getElementById('nhScheduleTotal');
    const countEl = document.getElementById('nhScheduleCount');
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    if (totalEl) {
      totalEl.textContent = money(total);
      totalEl.style.opacity = Math.abs(total - Number(deal.total || 0)) <= 0.01 ? '1' : '.72';
    }
    if (countEl) countEl.textContent = `${rows.length} item(ns) no cronograma`;
  }

  async function saveSchedule(event, deal) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const errorBox = document.getElementById('nhScheduleError');
    const rows = scheduleRowsFromForm();
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const projectTotal = Number(deal.total || 0);

    if (!rows.length) {
      errorBox.innerHTML = '<div class="nh-error">O cronograma precisa ter pelo menos uma parcela.</div>';
      return;
    }
    if (rows.some(row => !(row.amount > 0))) {
      errorBox.innerHTML = '<div class="nh-error">Todos os valores precisam ser maiores que zero.</div>';
      return;
    }
    const belowPaid = rows.find(row => row.amount + 0.009 < row.paid_amount);
    if (belowPaid) {
      errorBox.innerHTML = `<div class="nh-error">A parcela #${esc(belowPaid.installment_number)} já recebeu ${money(belowPaid.paid_amount)} e não pode ficar abaixo desse valor.</div>`;
      return;
    }
    const missingDue = rows.find(row => !row.due_date && !row.due_label);
    if (missingDue) {
      errorBox.innerHTML = `<div class="nh-error">Informe uma data ou referência de vencimento para a parcela #${esc(missingDue.installment_number)}.</div>`;
      return;
    }
    if (Math.abs(total - projectTotal) > 0.01) {
      errorBox.innerHTML = `<div class="nh-error">O cronograma soma ${money(total)}, mas o projeto é ${money(projectTotal)}. Ajuste os valores antes de salvar.</div>`;
      return;
    }

    try {
      button.disabled = true;
      button.textContent = 'SALVANDO…';
      errorBox.innerHTML = '';

      const payloadRows = rows.map(row => ({
        id: row.id,
        installment_number: row.installment_number,
        kind: row.kind,
        amount: row.amount,
        due_date: row.due_date,
        due_label: row.due_date ? null : row.due_label
      }));

      const { error } = await db.rpc('save_deal_installment_schedule', {
        p_deal_id: deal.id,
        p_rows: payloadRows
      });
      if (error) throw error;

      closeScheduleModal();
      await loadFinance();
    } catch (err) {
      console.error('[Nomad Horse Finance] erro ao editar cronograma', err);
      errorBox.innerHTML = `<div class="nh-error">Não foi possível salvar o cronograma: ${esc(err?.message || err)}</div>`;
      button.disabled = false;
      button.textContent = 'SALVAR CRONOGRAMA';
    }
  }

  const projectDateInput = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };

  const addProjectDays = (dateString, days) => {
    const parts = String(dateString || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!parts) return '';
    const d = new Date(Number(parts[1]), Number(parts[2])-1, Number(parts[3]));
    d.setDate(d.getDate() + Number(days || 0));
    return projectDateInput(d);
  };

  async function projectContext() {
    const [leadRes, dealRes] = await Promise.all([
      db.from('leads').select('id,name,phone,lead_type,status,interest,vehicle_type,budget').order('created_at',{ascending:false}),
      db.from('deals').select('id,buyer_lead_id,seller_lead_id,project_value,agreed_price,created_at').order('created_at',{ascending:false})
    ]);
    if (leadRes.error) throw leadRes.error;
    if (dealRes.error) throw dealRes.error;
    const deals = dealRes.data || [];
    const dealIds = deals.map(x => x.id);
    const scheduleRes = dealIds.length
      ? await db.from('deal_installments').select('deal_id').in('deal_id', dealIds)
      : { data: [], error: null };
    if (scheduleRes.error) throw scheduleRes.error;
    const scheduled = new Set((scheduleRes.data || []).map(x => x.deal_id));
    const dealByLead = new Map();
    deals.forEach(d => {
      [d.buyer_lead_id, d.seller_lead_id].filter(Boolean).forEach(id => {
        if (!dealByLead.has(id)) dealByLead.set(id,d);
      });
    });
    const candidates = (leadRes.data || []).filter(l => {
      if (['fechado','perdido'].includes(String(l.status||''))) return false;
      const deal = dealByLead.get(l.id);
      return !deal || !scheduled.has(deal.id);
    });
    return { leads: leadRes.data || [], deals, dealByLead, scheduled, candidates };
  }

  function closeProjectSetupModal() {
    document.getElementById('nhProjectSetupModal')?.remove();
  }

  function projectLeadOption(lead, selectedId) {
    const extra = lead.interest || lead.vehicle_type || lead.lead_type || '';
    return `<option value="${esc(lead.id)}" ${String(lead.id)===String(selectedId||'')?'selected':''}>${esc(lead.name || 'Cliente')}${extra?` • ${esc(extra)}`:''}</option>`;
  }

  function projectRowsFromForm(form) {
    const total = Math.max(0, Number(form.elements.project_value.value || 0));
    const deposit = Math.max(0, Number(form.elements.deposit.value || 0));
    const count = Math.max(0, Math.floor(Number(form.elements.installments.value || 0)));
    const firstDue = String(form.elements.first_due.value || '');
    const interval = Math.max(1, Math.floor(Number(form.elements.interval_days.value || 30)));
    const lastOnDelivery = !!form.elements.last_on_delivery.checked;
    const rows = [];
    let no = 1;
    if (deposit > 0) rows.push({ no:no++, kind:'Sinal', amount:deposit, due:'Aguardando pagamento' });
    const remaining = Math.max(0, Math.round((total-deposit)*100)/100);
    if (count > 0) {
      const base = Math.floor((remaining/count)*100)/100;
      let allocated = 0;
      for (let i=1;i<=count;i++) {
        const amount = i===count ? Math.round((remaining-allocated)*100)/100 : base;
        if (i<count) allocated = Math.round((allocated+amount)*100)/100;
        const isLastDelivery = lastOnDelivery && i===count;
        rows.push({
          no:no++,
          kind:isLastDelivery?'Saldo':'Parcela',
          amount,
          due:isLastDelivery?'Na entrega':(firstDue ? dateOnlyBR(addProjectDays(firstDue,(i-1)*interval)) : 'Sem data')
        });
      }
    }
    return { total, deposit, count, firstDue, interval, lastOnDelivery, rows };
  }

  function renderProjectPreview() {
    const form = document.getElementById('nhProjectSetupForm');
    const box = document.getElementById('nhProjectPreview');
    const err = document.getElementById('nhProjectSetupError');
    if (!form || !box) return;
    const p = projectRowsFromForm(form);
    let problem = '';
    if (!(p.total > 0)) problem = 'Informe o valor total do projeto.';
    else if (p.deposit > p.total) problem = 'O sinal não pode ser maior que o projeto.';
    else if (p.total-p.deposit > 0 && p.count < 1) problem = 'Informe ao menos uma parcela para o saldo.';
    else if (p.total-p.deposit > 0 && !p.firstDue && !(p.lastOnDelivery && p.count===1)) problem = 'Informe o primeiro vencimento.';
    if (err) err.innerHTML = problem ? `<div class="nh-error">${esc(problem)}</div>` : '';
    box.innerHTML = p.rows.length
      ? `<div class="nh-project-preview">${p.rows.map(r=>`<div class="nh-project-preview-row"><div><strong>${esc(r.kind)} #${r.no}</strong><small>${esc(r.due)}</small></div><strong>${money(r.amount)}</strong></div>`).join('')}<div class="nh-project-preview-total"><span>Total</span><strong>${money(p.rows.reduce((s,r)=>s+r.amount,0))}</strong></div></div>`
      : '<div class="nh-empty">O cronograma aparecerá aqui.</div>';
  }

  async function openProjectSetupModal(preselectedLeadId = null) {
    closeProjectSetupModal();
    try {
      const ctx = await projectContext();
      let candidates = ctx.candidates;
      if (preselectedLeadId) {
        const chosen = ctx.leads.find(l => String(l.id)===String(preselectedLeadId));
        const deal = ctx.dealByLead.get(preselectedLeadId);
        if (chosen && (!deal || !ctx.scheduled.has(deal.id))) candidates = [chosen, ...candidates.filter(x=>x.id!==chosen.id)];
      }
      const selected = candidates.find(x=>String(x.id)===String(preselectedLeadId||'')) || candidates[0] || null;
      const existingDeal = selected ? ctx.dealByLead.get(selected.id) : null;
      const suggestedTotal = Number(existingDeal?.agreed_price || existingDeal?.project_value || selected?.budget || 0) || '';
      const next = new Date(); next.setDate(next.getDate()+30);
      const backdrop = document.createElement('div');
      backdrop.className = 'nh-modal-backdrop';
      backdrop.id = 'nhProjectSetupModal';
      backdrop.innerHTML = `
        <div class="nh-modal" role="dialog" aria-modal="true" aria-label="Criar projeto financeiro">
          <div class="nh-modal-head"><div><h3>Novo projeto financeiro</h3><div class="muted">Cria a negociação e o cronograma em uma única etapa.</div></div><button type="button" class="nh-close" id="nhCloseProjectSetup">×</button></div>
          ${candidates.length ? `<form id="nhProjectSetupForm"><div class="nh-form-grid">
            <div class="full"><label>Cliente</label><select name="lead_id" required>${candidates.map(l=>projectLeadOption(l,selected?.id)).join('')}</select></div>
            <div><label>Valor total do projeto (R$)</label><input name="project_value" type="number" min="0.01" step="0.01" required value="${esc(suggestedTotal)}" inputmode="decimal"></div>
            <div><label>Sinal (R$)</label><input name="deposit" type="number" min="0" step="0.01" value="0" inputmode="decimal"></div>
            <div><label>Parcelas após o sinal</label><input name="installments" type="number" min="0" max="24" step="1" value="3" inputmode="numeric"></div>
            <div><label>Primeiro vencimento</label><input name="first_due" type="date" value="${projectDateInput(next)}"></div>
            <div><label>Intervalo entre parcelas</label><select name="interval_days"><option value="7">7 dias</option><option value="15">15 dias</option><option value="30" selected>30 dias</option><option value="45">45 dias</option><option value="60">60 dias</option></select></div>
            <div><label>Última cobrança</label><label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input name="last_on_delivery" type="checkbox" checked style="width:auto"> Saldo na entrega</label></div>
            <div class="full nh-project-note">Depois de criar, você ainda poderá usar <strong>Editar cronograma</strong> para ajustar qualquer valor ou vencimento.</div>
            <div class="full"><strong>Prévia do cronograma</strong><div id="nhProjectPreview"></div></div>
            <div class="full" id="nhProjectSetupError"></div>
            <div class="full"><button class="nh-submit" type="submit">CRIAR PROJETO E FINANCEIRO</button></div>
          </div></form>` : `<div class="nh-empty">Todos os clientes em aberto já possuem um cronograma financeiro. Para alterar um projeto existente, use <strong>Editar cronograma</strong>.</div>`}
        </div>`;
      document.body.appendChild(backdrop);
      document.getElementById('nhCloseProjectSetup')?.addEventListener('click', closeProjectSetupModal);
      backdrop.addEventListener('click', e => { if (e.target===backdrop) closeProjectSetupModal(); });
      const form = document.getElementById('nhProjectSetupForm');
      if (form) {
        form.addEventListener('input', renderProjectPreview);
        form.addEventListener('change', renderProjectPreview);
        form.addEventListener('submit', saveProjectSetup);
        form.elements.lead_id.addEventListener('change', () => {
          const lead = ctx.candidates.find(x=>x.id===form.elements.lead_id.value);
          const deal = lead ? ctx.dealByLead.get(lead.id) : null;
          const val = Number(deal?.agreed_price || deal?.project_value || lead?.budget || 0);
          if (val > 0) form.elements.project_value.value = val;
          renderProjectPreview();
        });
        renderProjectPreview();
      }
    } catch (err) {
      console.error('[Nomad Horse Finance] novo projeto', err);
      alert('Não foi possível abrir a criação do projeto agora.');
    }
  }

  async function saveProjectSetup(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const errorBox = document.getElementById('nhProjectSetupError');
    const p = projectRowsFromForm(form);
    if (!(p.total > 0) || p.deposit > p.total || (p.total-p.deposit>0 && p.count<1) || (p.total-p.deposit>0 && !p.firstDue && !(p.lastOnDelivery && p.count===1))) {
      renderProjectPreview(); return;
    }
    try {
      button.disabled = true; button.textContent = 'CRIANDO…';
      const { data, error } = await db.rpc('create_project_finance_from_lead', {
        p_lead_id: form.elements.lead_id.value,
        p_project_value: p.total,
        p_deposit: p.deposit,
        p_installments: p.count,
        p_first_due_date: p.firstDue || null,
        p_interval_days: p.interval,
        p_last_on_delivery: p.lastOnDelivery
      });
      if (error) throw error;
      const leadId = form.elements.lead_id.value;
      closeProjectSetupModal();
      await loadFinance();
      if (typeof window.loadAdmin === 'function') await window.loadAdmin();
      if (typeof window.openLeadEditor === 'function' && document.getElementById('leadEditor') && !document.getElementById('leadEditor').classList.contains('hidden')) {
        await window.openLeadEditor(leadId);
      }
      alert('Projeto financeiro criado com sucesso.');
      return data;
    } catch (err) {
      console.error('[Nomad Horse Finance] criar projeto', err);
      errorBox.innerHTML = `<div class="nh-error">Não foi possível criar o projeto: ${esc(err?.message || err)}</div>`;
      button.disabled = false; button.textContent = 'CRIAR PROJETO E FINANCEIRO';
    }
  }

  let leadProjectTimer = null;
  async function injectLeadProjectAction() {
    const editor = document.getElementById('leadEditor');
    const box = document.getElementById('leadDealArea');
    const form = document.getElementById('leadAdminForm');
    if (!editor || editor.classList.contains('hidden') || !box || !form) return;
    const leadId = form.elements?.id?.value;
    if (!leadId || box.querySelector('.nh-project-setup-action')) return;
    try {
      const { data: deals, error } = await db.from('deals').select('id,project_value,agreed_price').or(`buyer_lead_id.eq.${leadId},seller_lead_id.eq.${leadId}`).order('created_at',{ascending:false}).limit(1);
      if (error) return;
      const deal = deals?.[0] || null;
      let hasSchedule = false;
      if (deal) {
        const r = await db.from('deal_installments').select('id').eq('deal_id',deal.id).limit(1);
        hasSchedule = !!r.data?.length;
      }
      if (box.querySelector('.nh-project-setup-action')) return;
      const wrap = document.createElement('div');
      wrap.className = 'nh-project-setup-action';
      if (hasSchedule && deal) {
        wrap.innerHTML = `
          <div style="display:grid;gap:10px">
            <button type="button" class="nh-mini-btn" data-lead-register-payment style="width:100%">REGISTRAR PAGAMENTO</button>
            <button type="button" class="nh-mini-btn secondary" data-lead-payment-history style="width:100%">VER PAGAMENTOS</button>
            <button type="button" class="nh-mini-btn secondary" data-lead-edit-finance style="width:100%">ABRIR / EDITAR FINANCEIRO</button>
          </div>`;

        const ensureDealLoaded = async () => {
          if (!dealsCache.some(d => d.id === deal.id)) await loadFinance();
          return dealsCache.find(d => d.id === deal.id) || null;
        };

        wrap.querySelector('[data-lead-register-payment]')?.addEventListener('click', async () => {
          try {
            const loaded = await ensureDealLoaded();
            if (!loaded) throw new Error('Projeto financeiro não encontrado.');
            if (Number(loaded.balance || 0) <= 0) {
              alert('Este projeto já está quitado.');
              return;
            }
            openPaymentModal(deal.id);
          } catch (e) {
            console.error('[Nomad Horse Finance] registrar pagamento do cliente', e);
            alert('Não foi possível abrir o registro de pagamento agora.');
          }
        });

        wrap.querySelector('[data-lead-payment-history]')?.addEventListener('click', async () => {
          try {
            const loaded = await ensureDealLoaded();
            if (!loaded) throw new Error('Projeto financeiro não encontrado.');
            openPaymentHistoryModal(deal.id);
          } catch (e) {
            console.error('[Nomad Horse Finance] histórico financeiro do cliente', e);
            alert('Não foi possível abrir os pagamentos deste cliente agora.');
          }
        });

        wrap.querySelector('[data-lead-edit-finance]')?.addEventListener('click', async () => {
          try {
            const loaded = await ensureDealLoaded();
            if (!loaded) throw new Error('Projeto financeiro não encontrado.');
            openScheduleModal(deal.id);
          } catch (e) {
            console.error('[Nomad Horse Finance] abrir financeiro do cliente', e);
            alert('Não foi possível abrir o financeiro deste cliente agora.');
          }
        });
      } else {
        wrap.innerHTML = `<button type="button" class="nh-mini-btn" style="width:100%">${deal?'CONFIGURAR FINANCEIRO':'CRIAR PROJETO + FINANCEIRO'}</button>`;
        wrap.querySelector('button').addEventListener('click',()=>openProjectSetupModal(leadId));
      }
      box.appendChild(wrap);
    } catch(e) {}
  }

  function scheduleLeadProjectAction() {
    clearTimeout(leadProjectTimer);
    leadProjectTimer = setTimeout(injectLeadProjectAction, 180);
  }

  function labelPaymentType(type) {
    const labels = {
      sinal: 'Sinal',
      parcela: 'Parcela',
      saldo: 'Saldo',
      complemento: 'Complemento',
      quitacao: 'Quitação',
      quitação: 'Quitação'
    };
    return labels[String(type || '').toLowerCase()] || type || 'Pagamento';
  }

  function loadPdfSdk() {
    return new Promise((resolve, reject) => {
      if (window.jspdf?.jsPDF) return resolve();
      const existing = document.querySelector(`script[src="${JSPDF_URL}"]`);
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error('Não foi possível carregar o gerador de PDF.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = JSPDF_URL;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Não foi possível carregar o gerador de PDF.'));
      document.head.appendChild(script);
    });
  }

  function cleanFilePart(value) {
    return String(value || 'cliente')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'cliente';
  }

  function receiptContext(deal, payment) {
    const payments = [...(deal.payments || [])].sort((a, b) => {
      const aDate = String(a.paid_at || a.created_at || '');
      const bDate = String(b.paid_at || b.created_at || '');
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return String(a.created_at || a.id || '').localeCompare(String(b.created_at || b.id || ''));
    });
    let receivedAfter = 0;
    let found = false;
    for (const item of payments) {
      receivedAfter += Number(item.amount || 0);
      if (String(item.id) === String(payment.id)) { found = true; break; }
    }
    if (!found) receivedAfter = Math.min(Number(deal.total || 0), Number(deal.paid || 0));
    const balanceAfter = Math.max(Number(deal.total || 0) - receivedAfter, 0);
    const paymentRef = `${labelPaymentType(payment.payment_type)}${payment.installment_number ? ` #${payment.installment_number}` : ''}`;
    const rawDate = String(payment.paid_at || '').slice(0, 10) || localDateISO();
    const receiptNo = `NH-${rawDate.replace(/-/g, '')}-${String(payment.id || 'RECIBO').replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    return { receivedAfter, balanceAfter, paymentRef, rawDate, receiptNo };
  }

  async function generateReceiptPdf(deal, payment, options = {}) {
    await loadPdfSdk();
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) throw new Error('Gerador de PDF indisponível.');

    const ctx = receiptContext(deal, payment);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 18;
    const contentW = pageW - margin * 2;
    const gold = [200, 156, 74];
    const dark = [17, 17, 17];
    const gray = [95, 95, 95];

    doc.setFillColor(...dark);
    doc.rect(0, 0, pageW, 38, 'F');
    doc.setTextColor(...gold);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('NOMAD HORSE MARKET', margin, 17);
    doc.setTextColor(245, 245, 245);
    doc.setFontSize(11);
    doc.text('RECIBO DE PAGAMENTO', margin, 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Recibo ${ctx.receiptNo}`, pageW - margin, 26, { align: 'right' });

    let y = 52;
    doc.setTextColor(...gray);
    doc.setFontSize(9);
    doc.text('CLIENTE', margin, y);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(String(deal.customer?.name || 'Cliente'), margin, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    if (deal.customer?.phone) doc.text(`Telefone: ${String(deal.customer.phone)}`, margin, y + 13);

    y += 28;
    doc.setFillColor(248, 245, 238);
    doc.roundedRect(margin, y, contentW, 30, 3, 3, 'F');
    doc.setTextColor(...gray);
    doc.setFontSize(9);
    doc.text('VALOR RECEBIDO', margin + 7, y + 9);
    doc.setTextColor(25, 25, 25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(money(payment.amount), margin + 7, y + 21);
    doc.setTextColor(...gold);
    doc.setFontSize(10);
    doc.text(ctx.paymentRef, pageW - margin - 7, y + 19, { align: 'right' });

    y += 43;
    const rows = [
      ['Data do pagamento', dateOnlyBR(ctx.rawDate)],
      ['Forma de pagamento', payment.payment_method || 'Não informada'],
      ['Valor do projeto', money(deal.total)],
      ['Total recebido após este pagamento', money(ctx.receivedAfter)],
      ['Saldo restante após este pagamento', money(ctx.balanceAfter)]
    ];
    doc.setFontSize(10);
    rows.forEach(([label, value]) => {
      doc.setTextColor(...gray);
      doc.setFont('helvetica', 'normal');
      doc.text(label, margin, y);
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      doc.text(String(value), pageW - margin, y, { align: 'right' });
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, y + 4, pageW - margin, y + 4);
      y += 12;
    });

    if (payment.notes) {
      y += 3;
      doc.setTextColor(...gray);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('OBSERVAÇÃO', margin, y);
      y += 6;
      doc.setTextColor(35, 35, 35);
      doc.setFontSize(10);
      const noteLines = doc.splitTextToSize(String(payment.notes), contentW);
      doc.text(noteLines, margin, y);
      y += noteLines.length * 5 + 5;
    }

    y = Math.max(y + 10, 210);
    doc.setDrawColor(160, 160, 160);
    doc.line(margin, y, 90, y);
    doc.line(120, y, pageW - margin, y);
    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Nomad Horse', 54, y + 5, { align: 'center' });
    doc.text('Cliente', 156, y + 5, { align: 'center' });

    doc.setTextColor(120, 120, 120);
    doc.setFontSize(7.5);
    doc.text('Comprovante gerado pelo sistema Nomad Horse Market.', margin, 282);
    doc.text(ctx.receiptNo, pageW - margin, 282, { align: 'right' });

    const filename = `recibo-nomad-horse-${cleanFilePart(deal.customer?.name)}-${ctx.rawDate}.pdf`;
    if (options.returnBlob) return { blob: doc.output('blob'), filename, receiptNo: ctx.receiptNo };
    doc.save(filename);
    return { filename, receiptNo: ctx.receiptNo };
  }

  function receiptShareText(deal, payment) {
    const ctx = receiptContext(deal, payment);
    return [
      `Olá, ${deal.customer?.name || 'cliente'}.`,
      `Segue o recibo Nomad Horse referente a ${ctx.paymentRef}.`,
      `Valor recebido: ${money(payment.amount)}.`,
      `Data: ${dateOnlyBR(ctx.rawDate)}.`,
      `Forma de pagamento: ${payment.payment_method || 'não informada'}.`,
      `Saldo restante do projeto: ${money(ctx.balanceAfter)}.`,
      `Recibo: ${ctx.receiptNo}.`
    ].join('\n');
  }

  function downloadReceiptBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  async function shareReceipt(deal, payment) {
    const result = await generateReceiptPdf(deal, payment, { returnBlob: true });
    const text = receiptShareText(deal, payment);
    let file = null;
    try {
      file = new File([result.blob], result.filename, { type: 'application/pdf' });
    } catch (_) {}

    if (navigator.share && file) {
      const shareData = {
        title: `Recibo Nomad Horse — ${deal.customer?.name || 'Cliente'}`,
        text,
        files: [file]
      };
      const canShareFiles = !navigator.canShare || navigator.canShare({ files: [file] });
      if (canShareFiles) {
        try {
          await navigator.share(shareData);
          return { mode: 'native' };
        } catch (err) {
          if (err?.name === 'AbortError') return { mode: 'cancelled' };
          console.warn('[Nomad Horse Finance] compartilhamento nativo indisponível', err);
        }
      }
    }

    downloadReceiptBlob(result.blob, result.filename);
    const whatsappText = `${text}\n\nO recibo PDF foi baixado no aparelho. Anexe o arquivo nesta conversa do WhatsApp.`;
    const url = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
    window.location.href = url;
    return { mode: 'whatsapp-fallback' };
  }

  function closeReceiptModal() {
    document.getElementById('nhReceiptModal')?.remove();
  }

  function openReceiptReadyModal(dealId, paymentId) {
    const deal = dealsCache.find(d => String(d.id) === String(dealId));
    const payment = deal?.payments?.find(p => String(p.id) === String(paymentId));
    if (!deal || !payment) return;
    closeReceiptModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'nh-modal-backdrop';
    backdrop.id = 'nhReceiptModal';
    backdrop.innerHTML = `
      <div class="nh-modal" role="dialog" aria-modal="true" aria-label="Pagamento salvo">
        <div class="nh-modal-head">
          <div>
            <h3>Pagamento registrado</h3>
            <div class="muted">${esc(deal.customer?.name || 'Cliente')} • ${money(payment.amount)}</div>
          </div>
          <button type="button" class="nh-close" id="nhCloseReceipt" aria-label="Fechar">×</button>
        </div>
        <div class="nh-ok">Pagamento salvo com sucesso. Você pode baixar o recibo em PDF ou compartilhar pelo WhatsApp.</div>
        <div class="nh-deal-actions" style="margin-top:16px">
          <button type="button" class="nh-mini-btn" id="nhDownloadReceipt">BAIXAR RECIBO PDF</button>
          <button type="button" class="nh-mini-btn" id="nhShareReceipt">COMPARTILHAR / WHATSAPP</button>
          <button type="button" class="nh-mini-btn secondary" id="nhReceiptHistory">VER PAGAMENTOS</button>
        </div>
        <div id="nhReceiptError"></div>
      </div>`;
    document.body.appendChild(backdrop);
    document.getElementById('nhCloseReceipt')?.addEventListener('click', closeReceiptModal);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeReceiptModal(); });
    document.getElementById('nhDownloadReceipt')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const errorBox = document.getElementById('nhReceiptError');
      try {
        btn.disabled = true;
        btn.textContent = 'GERANDO PDF…';
        if (errorBox) errorBox.innerHTML = '';
        await generateReceiptPdf(deal, payment);
        btn.textContent = 'RECIBO PDF BAIXADO';
      } catch (err) {
        console.error('[Nomad Horse Finance] recibo PDF', err);
        if (errorBox) errorBox.innerHTML = `<div class="nh-error">O pagamento está salvo, mas o PDF não pôde ser gerado agora: ${esc(err?.message || err)}</div>`;
        btn.disabled = false;
        btn.textContent = 'TENTAR RECIBO PDF';
      }
    });
    document.getElementById('nhShareReceipt')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const errorBox = document.getElementById('nhReceiptError');
      try {
        btn.disabled = true;
        btn.textContent = 'PREPARANDO…';
        if (errorBox) errorBox.innerHTML = '';
        const result = await shareReceipt(deal, payment);
        if (result?.mode === 'cancelled') {
          btn.disabled = false;
          btn.textContent = 'COMPARTILHAR / WHATSAPP';
          return;
        }
        btn.textContent = result?.mode === 'native' ? 'COMPARTILHADO' : 'ABRINDO WHATSAPP…';
        if (result?.mode === 'native') setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = 'COMPARTILHAR / WHATSAPP'; } }, 1600);
      } catch (err) {
        console.error('[Nomad Horse Finance] compartilhar recibo', err);
        if (errorBox) errorBox.innerHTML = `<div class="nh-error">Não foi possível compartilhar o recibo agora: ${esc(err?.message || err)}</div>`;
        btn.disabled = false;
        btn.textContent = 'TENTAR COMPARTILHAR';
      }
    });
    document.getElementById('nhReceiptHistory')?.addEventListener('click', () => {
      closeReceiptModal();
      openPaymentHistoryModal(deal.id);
    });
  }

  function whatsappPhone(value) {
    let digits = String(value || '').replace(/\D/g, '');
    digits = digits.replace(/^0+/, '');
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) digits = `55${digits}`;
    return digits;
  }

  function customerFirstName(value) {
    return String(value || '').trim().split(/\s+/)[0] || 'cliente';
  }

  function projectLabel(deal) {
    const notes = String(deal?.notes || '').trim();
    const match = notes.match(/^(Projeto[^.]{1,120})/i);
    if (match) return match[1].trim();
    return 'Projeto Nomad Horse';
  }

  function closeChargeChooser() {
    document.getElementById('nhChargeChooserModal')?.remove();
  }

  function openWhatsAppPackage(packageName, phone, text) {
    const encodedText = encodeURIComponent(text);
    const intent = `intent://send?phone=${encodeURIComponent(phone)}&text=${encodedText}#Intent;scheme=whatsapp;package=${packageName};end`;
    window.location.href = intent;
  }

  async function copyChargeMessage(text, button) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      if (button) {
        const original = button.textContent;
        button.textContent = 'MENSAGEM COPIADA';
        setTimeout(() => { if (button) button.textContent = original; }, 1500);
      }
    } catch (err) {
      console.error('[Nomad Horse Finance] copiar cobrança', err);
      alert('Não foi possível copiar automaticamente. Selecione e copie a mensagem exibida.');
    }
  }

  async function registerCollectionAttempt(dealId, installmentNumber, channel) {
    const { data, error } = await db
      .from('deal_collection_log')
      .insert({
        deal_id: dealId,
        installment_number: Number(installmentNumber),
        channel
      })
      .select('deal_id,installment_number,channel,charged_at')
      .single();
    if (error) throw error;

    collectionLogCache.unshift(data);

    const deal = dealsCache.find(d => String(d.id) === String(dealId));
    const item = deal?.schedule?.find(i => Number(i.installment_number) === Number(installmentNumber));
    if (item) {
      item.collection = {
        channel: data.channel,
        charged_at: data.charged_at,
        count: Number(item.collection?.count || 0) + 1
      };
    }
    return data;
  }

  function openChargeWhatsApp(dealId, installmentNumber) {
    const deal = dealsCache.find(d => String(d.id) === String(dealId));
    if (!deal) return;
    const item = (deal.schedule || []).find(i => Number(i.installment_number) === Number(installmentNumber));
    if (!item) return;

    const phone = whatsappPhone(deal.customer?.phone);
    if (!phone) {
      alert('Este cliente não possui telefone cadastrado para cobrança pelo WhatsApp.');
      return;
    }

    const name = customerFirstName(deal.customer?.name);
    const label = `${labelPaymentType(item.kind)} #${item.installment_number}`;
    const amount = money(item.outstanding_amount ?? item.amount);
    const due = item.due_date ? dateOnlyBR(item.due_date) : (item.due_label || 'A combinar');
    const status = String(item.effective_status || 'pendente').toLowerCase();
    const intro = status === 'atrasado'
      ? 'Passando para lembrar que há um pagamento em aberto referente ao seu projeto.'
      : 'Passando para lembrar do próximo pagamento referente ao seu projeto.';

    const text = `Olá, ${name}. Tudo bem?\n\n${intro}\n\n*${projectLabel(deal)}*\n${label}\nValor: ${amount}\nVencimento: ${due}\n\nSe o pagamento já foi realizado, por favor desconsidere esta mensagem.\n\nNomad Horse`;

    closeChargeChooser();
    const backdrop = document.createElement('div');
    backdrop.className = 'nh-modal-backdrop';
    backdrop.id = 'nhChargeChooserModal';
    backdrop.innerHTML = `
      <div class="nh-modal" role="dialog" aria-modal="true" aria-label="Escolher WhatsApp">
        <div class="nh-modal-head">
          <div>
            <h3>Enviar cobrança</h3>
            <div class="muted">${esc(deal.customer?.name || 'Cliente')} • ${esc(label)} • ${esc(amount)}</div>
          </div>
          <button type="button" class="nh-close" id="nhCloseChargeChooser" aria-label="Fechar">×</button>
        </div>
        <div class="nh-form-note">Escolha qual aplicativo deve enviar esta cobrança. A ação ficará registrada no controle de cobranças, mas o sistema não consegue confirmar se você realmente tocou em Enviar dentro do WhatsApp. Nenhum pagamento será registrado.</div>
        <div class="nh-deal-actions" style="display:grid;grid-template-columns:1fr;gap:10px;margin-top:14px">
          <button type="button" class="nh-submit" id="nhChargePersonal" style="margin:0">WHATSAPP PESSOAL</button>
          <button type="button" class="nh-mini-btn" id="nhChargeBusiness" style="width:100%;padding:14px 16px">WHATSAPP BUSINESS</button>
          <button type="button" class="nh-mini-btn secondary" id="nhChargeCopy" style="width:100%;padding:14px 16px">COPIAR MENSAGEM</button>
        </div>
        <div style="margin-top:14px;padding:14px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);white-space:pre-wrap;font-size:14px;line-height:1.45">${esc(text)}</div>
      </div>`;
    document.body.appendChild(backdrop);

    document.getElementById('nhCloseChargeChooser')?.addEventListener('click', closeChargeChooser);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeChargeChooser(); });

    const runChargeAction = async (channel, action) => {
      const buttons = [
        document.getElementById('nhChargePersonal'),
        document.getElementById('nhChargeBusiness'),
        document.getElementById('nhChargeCopy')
      ].filter(Boolean);
      try {
        buttons.forEach(b => { b.disabled = true; });
        await registerCollectionAttempt(deal.id, item.installment_number, channel);
        renderFinance();
        closeChargeChooser();
        await action();
      } catch (err) {
        console.error('[Nomad Horse Finance] registrar cobrança', err);
        alert(`Não foi possível registrar esta ação de cobrança: ${err?.message || err}`);
        buttons.forEach(b => { b.disabled = false; });
      }
    };

    document.getElementById('nhChargePersonal')?.addEventListener('click', () => {
      runChargeAction('whatsapp_personal', () => openWhatsAppPackage('com.whatsapp', phone, text));
    });
    document.getElementById('nhChargeBusiness')?.addEventListener('click', () => {
      runChargeAction('whatsapp_business', () => openWhatsAppPackage('com.whatsapp.w4b', phone, text));
    });
    document.getElementById('nhChargeCopy')?.addEventListener('click', () => {
      runChargeAction('copiar_mensagem', () => copyChargeMessage(text));
    });
  }

  function openPaymentModal(dealId) {
    const deal = dealsCache.find(d => d.id === dealId);
    if (!deal) return;

    closePaymentModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'nh-modal-backdrop';
    backdrop.id = 'nhPaymentModal';
    backdrop.innerHTML = `
      <div class="nh-modal" role="dialog" aria-modal="true" aria-label="Registrar pagamento">
        <div class="nh-modal-head">
          <div>
            <h3>Registrar pagamento</h3>
            <div class="muted">${esc(deal.customer?.name || 'Cliente')} • saldo ${money(deal.balance)}</div>
          </div>
          <button type="button" class="nh-close" id="nhClosePayment" aria-label="Fechar">×</button>
        </div>
        <form id="nhPaymentForm">
          <div class="nh-form-grid">
            <div class="full">
              <label>Pagamento referente a</label>
              <select name="installment_number" id="nhInstallmentSelect">
                ${(deal.schedule || []).filter(i => Number(i.outstanding_amount || 0) > 0).map(i => {
                  const due = i.due_date ? dateOnlyBR(i.due_date) : (i.due_label || 'sem data');
                  return `<option value="${esc(i.installment_number)}" data-kind="${esc(i.kind)}" data-outstanding="${esc(i.outstanding_amount)}">${esc(labelPaymentType(i.kind))} #${esc(i.installment_number)} • ${money(i.outstanding_amount)} • ${esc(due)}</option>`;
                }).join('')}
                <option value="" data-kind="complemento">Outro / complemento</option>
              </select>
            </div>
            <div>
              <label>Tipo de pagamento</label>
              <select name="payment_type" id="nhPaymentType" required>
                <option value="sinal">Sinal</option>
                <option value="parcela">Parcela</option>
                <option value="saldo">Saldo</option>
                <option value="complemento">Complemento</option>
                <option value="quitacao">Quitação</option>
              </select>
            </div>
            <div>
              <label>Valor recebido (R$)</label>
              <input id="nhPaymentAmount" name="amount" type="number" min="0.01" step="0.01" max="${deal.balance || ''}" required inputmode="decimal">
            </div>
            <div>
              <label>Data do pagamento</label>
              <input name="paid_at" type="date" required value="${localDateISO()}">
            </div>
            <div>
              <label>Forma de pagamento</label>
              <select name="payment_method">
                <option value="Pix">Pix</option>
                <option value="Transferência">Transferência</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Cartão">Cartão</option>
                <option value="Boleto">Boleto</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div class="full">
              <label>Observação</label>
              <textarea name="notes" placeholder="Ex.: sinal do projeto, parcela 1/4, comprovante recebido…"></textarea>
            </div>
            <div class="full nh-form-note">Após salvar, o saldo e o status do projeto são recalculados automaticamente pelo Supabase.</div>
            <div class="full" id="nhPaymentError"></div>
            <div class="full"><button class="nh-submit" type="submit">SALVAR PAGAMENTO</button></div>
          </div>
        </form>
      </div>`;
    document.body.appendChild(backdrop);

    document.getElementById('nhClosePayment')?.addEventListener('click', closePaymentModal);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePaymentModal(); });

    const typeSelect = document.getElementById('nhPaymentType');
    const installmentSelect = document.getElementById('nhInstallmentSelect');
    const amountInput = document.getElementById('nhPaymentAmount');

    const syncScheduleChoice = () => {
      const option = installmentSelect?.selectedOptions?.[0];
      if (!option) return;
      const kind = option.dataset.kind || 'complemento';
      const outstanding = Number(option.dataset.outstanding || 0);
      if (typeSelect && [...typeSelect.options].some(o => o.value === kind)) typeSelect.value = kind;
      if (amountInput && outstanding > 0) amountInput.value = outstanding.toFixed(2);
    };
    installmentSelect?.addEventListener('change', syncScheduleChoice);
    syncScheduleChoice();

    document.getElementById('nhPaymentForm')?.addEventListener('submit', (e) => savePayment(e, deal));
  }

  function closePaymentModal() {
    document.getElementById('nhPaymentModal')?.remove();
  }

  function openPaymentHistoryModal(dealId) {
    const deal = dealsCache.find(d => d.id === dealId);
    if (!deal) return;

    closePaymentHistoryModal();
    const payments = [...(deal.payments || [])].sort((a,b) => String(b.paid_at || b.created_at || '').localeCompare(String(a.paid_at || a.created_at || '')));
    const rows = payments.length
      ? payments.map(p => `
          <div class="nh-history-row" style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.08);align-items:flex-start">
            <span style="display:flex;flex-direction:column;gap:4px;min-width:0">
              <strong>${esc(labelPaymentType(p.payment_type))}${p.installment_number ? ` #${esc(p.installment_number)}` : ''}</strong>
              <small>${dateBR(p.paid_at)}${p.payment_method ? ` • ${esc(p.payment_method)}` : ''}</small>
              ${p.notes ? `<small>${esc(p.notes)}</small>` : ''}
              <span style="display:flex;gap:6px;flex-wrap:wrap;margin-top:5px">
                <button type="button" class="nh-mini-btn secondary" data-receipt-pdf="${esc(p.id)}" style="padding:7px 10px">RECIBO PDF</button>
                <button type="button" class="nh-mini-btn secondary" data-share-receipt="${esc(p.id)}" style="padding:7px 10px">WHATSAPP</button>
              </span>
            </span>
            <strong>${money(p.amount)}</strong>
          </div>`).join('')
      : '<div class="nh-empty">Nenhum pagamento registrado para este projeto.</div>';

    const backdrop = document.createElement('div');
    backdrop.className = 'nh-modal-backdrop';
    backdrop.id = 'nhPaymentHistoryModal';
    backdrop.innerHTML = `
      <div class="nh-modal" role="dialog" aria-modal="true" aria-label="Pagamentos do cliente">
        <div class="nh-modal-head">
          <div>
            <h3>Pagamentos do cliente</h3>
            <div class="muted">${esc(deal.customer?.name || 'Cliente')} • recebido ${money(deal.paid)} • saldo ${money(deal.balance)}</div>
          </div>
          <button type="button" class="nh-close" id="nhClosePaymentHistory" aria-label="Fechar">×</button>
        </div>
        <div class="nh-history" style="display:block;margin-top:8px">${rows}</div>
        <div class="nh-deal-actions" style="margin-top:18px">
          ${deal.balance > 0 ? `<button type="button" class="nh-mini-btn" id="nhHistoryRegisterPayment">Registrar pagamento</button>` : ''}
          <button type="button" class="nh-mini-btn secondary" id="nhHistoryEditSchedule">Editar cronograma</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    document.getElementById('nhClosePaymentHistory')?.addEventListener('click', closePaymentHistoryModal);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePaymentHistoryModal(); });
    document.getElementById('nhHistoryRegisterPayment')?.addEventListener('click', () => {
      closePaymentHistoryModal();
      openPaymentModal(dealId);
    });
    document.getElementById('nhHistoryEditSchedule')?.addEventListener('click', () => {
      closePaymentHistoryModal();
      openScheduleModal(dealId);
    });
    backdrop.querySelectorAll('[data-receipt-pdf]').forEach(btn => btn.addEventListener('click', async (e) => {
      const payment = deal.payments.find(p => String(p.id) === String(e.currentTarget.dataset.receiptPdf));
      if (!payment) return;
      const original = e.currentTarget.textContent;
      try {
        e.currentTarget.disabled = true;
        e.currentTarget.textContent = 'GERANDO…';
        await generateReceiptPdf(deal, payment);
        e.currentTarget.textContent = 'BAIXADO';
        setTimeout(() => { if (e.currentTarget) { e.currentTarget.disabled = false; e.currentTarget.textContent = original; } }, 1400);
      } catch (err) {
        console.error('[Nomad Horse Finance] recibo histórico', err);
        alert(`Não foi possível gerar o recibo agora. ${err?.message || ''}`);
        e.currentTarget.disabled = false;
        e.currentTarget.textContent = original;
      }
    }));
    backdrop.querySelectorAll('[data-share-receipt]').forEach(btn => btn.addEventListener('click', async (e) => {
      const payment = deal.payments.find(p => String(p.id) === String(e.currentTarget.dataset.shareReceipt));
      if (!payment) return;
      const original = e.currentTarget.textContent;
      try {
        e.currentTarget.disabled = true;
        e.currentTarget.textContent = 'PREPARANDO…';
        const result = await shareReceipt(deal, payment);
        if (result?.mode === 'cancelled') {
          e.currentTarget.disabled = false;
          e.currentTarget.textContent = original;
          return;
        }
        e.currentTarget.textContent = result?.mode === 'native' ? 'COMPARTILHADO' : 'ABRINDO…';
        if (result?.mode === 'native') setTimeout(() => { if (e.currentTarget) { e.currentTarget.disabled = false; e.currentTarget.textContent = original; } }, 1400);
      } catch (err) {
        console.error('[Nomad Horse Finance] compartilhar recibo histórico', err);
        alert(`Não foi possível compartilhar o recibo agora. ${err?.message || ''}`);
        e.currentTarget.disabled = false;
        e.currentTarget.textContent = original;
      }
    }));
  }

  function closePaymentHistoryModal() {
    document.getElementById('nhPaymentHistoryModal')?.remove();
  }

  async function savePayment(event, deal) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const errorBox = document.getElementById('nhPaymentError');
    const fd = new FormData(form);

    const amount = Number(fd.get('amount') || 0);
    if (!(amount > 0)) return;
    if (deal.balance > 0 && amount > deal.balance + 0.009) {
      errorBox.innerHTML = `<div class="nh-error">O valor informado é maior que o saldo atual (${money(deal.balance)}).</div>`;
      return;
    }

    const paymentType = String(fd.get('payment_type') || 'parcela');
    const installmentNumber = fd.get('installment_number')
      ? Number(fd.get('installment_number'))
      : null;
    const paidDate = String(fd.get('paid_at') || '');
    const paidAt = paidDate ? new Date(`${paidDate}T12:00:00`).toISOString() : new Date().toISOString();

    const payload = {
      deal_id: deal.id,
      payment_type: paymentType,
      amount,
      installment_number: installmentNumber,
      paid_at: paidAt,
      payment_method: String(fd.get('payment_method') || '') || null,
      notes: String(fd.get('notes') || '').trim() || null
    };

    try {
      button.disabled = true;
      button.textContent = 'SALVANDO…';
      errorBox.innerHTML = '';
      const { data: savedPayment, error } = await db
        .from('deal_payments')
        .insert(payload)
        .select('id,deal_id,payment_type,amount,installment_number,paid_at,payment_method,notes,created_at')
        .single();
      if (error) throw error;
      closePaymentModal();
      await loadFinance();
      const refreshedDeal = dealsCache.find(d => String(d.id) === String(deal.id));
      const refreshedPayment = refreshedDeal?.payments?.find(p => String(p.id) === String(savedPayment?.id));
      if (refreshedDeal && refreshedPayment) openReceiptReadyModal(refreshedDeal.id, refreshedPayment.id);
    } catch (err) {
      console.error('[Nomad Horse Finance] erro ao salvar', err);
      errorBox.innerHTML = `<div class="nh-error">Não foi possível salvar: ${esc(err?.message || err)}</div>`;
      button.disabled = false;
      button.textContent = 'SALVAR PAGAMENTO';
    }
  }

  async function init() {
    try {
      injectStyles();
      injectPanel();
      await loadSdk();
      db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      window.nomadHorseFinance = { reload: loadFinance, client: db, editSchedule: openScheduleModal, newProject: openProjectSetupModal, registerPayment: openPaymentModal, paymentHistory: openPaymentHistoryModal, receiptPdf: generateReceiptPdf, shareReceipt, collectionDashboard: buildCollectionDashboard };
      await loadFinance();

      // Recarrega ao entrar no painel, inclusive em navegação SPA.
      document.addEventListener('click', (e) => {
        const el = e.target.closest?.('[data-view="admin"]');
        if (el) setTimeout(loadFinance, 120);
      });
      const projectObserver = new MutationObserver(scheduleLeadProjectAction);
      projectObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
      document.addEventListener('click', (e) => { if (e.target.closest?.('[onclick*="openLeadEditor"]')) setTimeout(scheduleLeadProjectAction,220); });
      scheduleLeadProjectAction();
    } catch (err) {
      console.error('[Nomad Horse Finance] falha de inicialização', err);
      const body = document.getElementById('nhFinanceBody');
      if (body) body.innerHTML = `<div class="nh-error">Falha ao iniciar o financeiro: ${esc(err?.message || err)}</div>`;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
