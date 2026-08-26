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
      @media(max-width:620px){.nh-money-row{grid-template-columns:1fr}.nh-form-grid{grid-template-columns:1fr}.nh-form-grid .full{grid-column:auto}.nh-schedule-row{grid-template-columns:1fr auto}.nh-schedule-money{grid-column:1/-1;text-align:left}}
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
        <button type="button" class="nh-mini-btn secondary" id="nhRefreshFinance">Atualizar</button>
      </div>
      <div id="nhFinanceBody"><div class="nh-empty">Carregando financeiro…</div></div>
    `;

    const stats = shell.querySelector('.stats');
    if (stats) stats.insertAdjacentElement('afterend', panel);
    else shell.prepend(panel);

    document.getElementById('nhRefreshFinance')?.addEventListener('click', loadFinance);
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
          ${overdueAlert}
          ${scheduleHtml}
          <div class="nh-deal-actions" style="margin-top:14px">
            ${deal.balance > 0 ? `<button type="button" class="nh-mini-btn" data-register-payment="${esc(deal.id)}">Registrar pagamento</button>` : ''}
            <button type="button" class="nh-mini-btn secondary" data-toggle-history="${esc(deal.id)}">Ver pagamentos</button>
          </div>
          <div id="nhHistory-${esc(deal.id)}" style="display:none">${paymentHistory}</div>
        </article>`;
    }).join('');

    body.innerHTML = `<div class="nh-finance-grid">${html}</div>`;

    body.querySelectorAll('[data-register-payment]').forEach(btn => {
      btn.addEventListener('click', () => openPaymentModal(btn.dataset.registerPayment));
    });
    body.querySelectorAll('[data-toggle-history]').forEach(btn => {
      btn.addEventListener('click', () => {
        const el = document.getElementById(`nhHistory-${btn.dataset.toggleHistory}`);
        if (!el) return;
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
      });
    });
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
      window.nomadHorseFinance = { reload: loadFinance, client: db };
      await loadFinance();

      // Recarrega ao entrar no painel, inclusive em navegação SPA.
      document.addEventListener('click', (e) => {
        const el = e.target.closest?.('[data-view="admin"]');
        if (el) setTimeout(loadFinance, 120);
      });
    } catch (err) {
      console.error('[Nomad Horse Finance] falha de inicialização', err);
      const body = document.getElementById('nhFinanceBody');
      if (body) body.innerHTML = `<div class="nh-error">Falha ao iniciar o financeiro: ${esc(err?.message || err)}</div>`;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
