/* Nomad Horse Market — módulo financeiro de projetos
   Registra sinal/parcelas no Supabase e acompanha saldo automaticamente.
   Projeto: ndbekzgxdfuhjlocipiv
*/
(() => {
  'use strict';

  const SUPABASE_URL = 'https://ndbekzgxdfuhjlocipiv.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_H0DQ1mF0BW8bTysshtTJuw_Ulglk1_Z';
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

  let db = null;
  let dealsCache = [];

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

  const dateOnlyBR = (value) => {
    if (!value) return '—';
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return dateBR(value);
    return `${match[3]}/${match[2]}/${match[1]}`;
  };

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
      @media(max-width:620px){.nh-money-row{grid-template-columns:1fr}.nh-finance-summary{grid-template-columns:1fr}.nh-overview{grid-template-columns:1fr 1fr}.nh-form-grid{grid-template-columns:1fr}.nh-form-grid .full{grid-column:auto}.nh-schedule-row{grid-template-columns:1fr auto}.nh-schedule-money{grid-column:1/-1;text-align:left}}
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
        .select('id,buyer_lead_id,seller_lead_id,stage,project_value,agreed_price,installment_count,payment_status,created_at')
        .order('created_at', { ascending: false });
      if (dealsError) throw dealsError;

      if (!deals?.length) {
        dealsCache = [];
        body.innerHTML = '<div class="nh-empty">Nenhum projeto financeiro cadastrado.</div>';
        return;
      }

      const leadIds = [...new Set(deals.flatMap(d => [d.buyer_lead_id, d.seller_lead_id]).filter(Boolean))];
      const dealIds = deals.map(d => d.id);

      const [leadResult, paymentResult, scheduleResult] = await Promise.all([
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
          .order('installment_number', { ascending: true })
      ]);

      if (leadResult.error) throw leadResult.error;
      if (paymentResult.error) throw paymentResult.error;
      if (scheduleResult.error) throw scheduleResult.error;

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

      dealsCache = deals.map(d => {
        const customer = leads.get(d.buyer_lead_id) || leads.get(d.seller_lead_id) || {};
        const payments = paymentsByDeal.get(d.id) || [];
        const schedule = scheduleByDeal.get(d.id) || [];
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
              return `<div class="nh-schedule-row">
                <div class="nh-schedule-main"><strong>${esc(label)} #${esc(item.installment_number)}</strong><small>Vencimento: ${esc(due)}${paidInfo}</small></div>
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
      const nextDueCard = nextDue
        ? `<div class="nh-summary-card ${nextDueStatus === 'atrasado' ? 'overdue' : 'next'}"><small>${nextDueStatus === 'atrasado' ? 'Pagamento atrasado' : 'Próximo vencimento'}</small><strong>${dateOnlyBR(nextDue.due_date)} • ${money(nextDue.outstanding_amount ?? nextDue.amount)}</strong><span>${esc(labelPaymentType(nextDue.kind))} #${esc(nextDue.installment_number)}${nextDueStatus === 'atrasado' ? ' • regularizar' : ''}</span></div>`
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

    body.innerHTML = `${overview}<div class="nh-finance-grid">${html}</div>`;

    body.querySelectorAll('[data-register-payment]').forEach(btn => {
      btn.addEventListener('click', () => openPaymentModal(btn.dataset.registerPayment));
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
        wrap.innerHTML = `<button type="button" class="nh-mini-btn secondary" style="width:100%">ABRIR / EDITAR FINANCEIRO</button>`;
        wrap.querySelector('button').addEventListener('click', async () => {
          try {
            if (!dealsCache.some(d => d.id === deal.id)) await loadFinance();
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
              <input name="paid_at" type="date" required value="${new Date().toISOString().slice(0,10)}">
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
      const { error } = await db.from('deal_payments').insert(payload);
      if (error) throw error;
      closePaymentModal();
      await loadFinance();
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
      window.nomadHorseFinance = { reload: loadFinance, client: db, editSchedule: openScheduleModal, newProject: openProjectSetupModal };
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
