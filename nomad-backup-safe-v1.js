/* Nomad Horse Market — Backup Seguro isolado v1
   Não altera o módulo financeiro nem intercepta cliques globais do app.
*/
(() => {
  'use strict';

  const PANEL_ID = 'nhSafeBackupPanel';
  const STYLE_ID = 'nhSafeBackupStyles';
  const INPUT_ID = 'nhSafeBackupFile';
  const STATUS_ID = 'nhSafeBackupStatus';
  const LAST_KEY = 'nomadHorseSafeBackupLastAt';

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[ch]));

  const dtBR = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', {
      day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
    });
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .nh-safe-backup{margin:18px 0;padding:18px;border:1px solid rgba(200,156,74,.28);border-radius:18px;background:rgba(200,156,74,.055)}
      .nh-safe-backup h3{margin:0 0 4px}
      .nh-safe-backup p{margin:0;opacity:.72}
      .nh-safe-backup-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
      .nh-safe-backup-btn{border:0;border-radius:12px;padding:12px 15px;font-weight:900;cursor:pointer;background:#c89c4a;color:#111}
      .nh-safe-backup-btn.secondary{background:rgba(255,255,255,.08);color:inherit;border:1px solid rgba(255,255,255,.12)}
      .nh-safe-backup-btn:disabled{opacity:.55;cursor:wait}
      .nh-safe-backup-status{margin-top:12px;padding:11px 12px;border-radius:12px;background:rgba(255,255,255,.045);font-size:.9rem}
      .nh-safe-backup-status.ok{border:1px solid rgba(80,200,120,.28);background:rgba(80,200,120,.08)}
      .nh-safe-backup-status.err{border:1px solid rgba(240,90,90,.30);background:rgba(190,50,50,.12);color:#ffd4d4}
      .nh-safe-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.76);z-index:100000;display:flex;align-items:flex-end;justify-content:center;padding:12px}
      .nh-safe-modal{width:min(620px,100%);max-height:90vh;overflow:auto;background:#171717;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.55)}
      .nh-safe-modal h3{margin:0 0 6px}
      .nh-safe-modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}
      .nh-safe-modal-card{padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.05)}
      .nh-safe-modal-card small{display:block;opacity:.65;margin-bottom:3px}
      .nh-safe-modal-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
      @media(max-width:620px){.nh-safe-backup-actions,.nh-safe-modal-actions{display:grid;grid-template-columns:1fr}.nh-safe-backup-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function setStatus(message, type='') {
    const el = document.getElementById(STATUS_ID);
    if (!el) return;
    el.className = `nh-safe-backup-status ${type}`.trim();
    el.textContent = message;
  }

  async function getClient() {
    for (let i=0; i<30; i++) {
      const client = window.nomadHorseFinance?.client;
      if (client) return client;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('O módulo financeiro ainda não terminou de carregar. Feche e abra o painel e tente novamente.');
  }

  function validateBackup(data) {
    if (!data || typeof data !== 'object') throw new Error('Arquivo de backup inválido.');
    if (data.app !== 'Nomad Horse Market') throw new Error('Este arquivo não é um backup do Nomad Horse Market.');
    if (Number(data.format_version) !== 1) throw new Error('Versão de backup não suportada.');
    if (data.project_ref !== 'ndbekzgxdfuhjlocipiv') throw new Error('Este backup pertence a outro projeto.');
    if (!data.tables || typeof data.tables !== 'object') throw new Error('Backup sem tabelas válidas.');
    return data;
  }

  function counts(data) {
    const t = data.tables || {};
    return {
      leads: Array.isArray(t.leads) ? t.leads.length : 0,
      deals: Array.isArray(t.deals) ? t.deals.length : 0,
      payments: Array.isArray(t.deal_payments) ? t.deal_payments.length : 0,
      installments: Array.isArray(t.deal_installments) ? t.deal_installments.length : 0,
      history: Array.isArray(t.client_history) ? t.client_history.length : 0,
      collections: Array.isArray(t.deal_collection_log) ? t.deal_collection_log.length : 0
    };
  }

  function filenameNow() {
    const d = new Date();
    const p = n => String(n).padStart(2,'0');
    return `nomad-horse-backup-${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}.json`;
  }

  async function exportSafeBackup() {
    const btn = document.getElementById('nhSafeExport');
    try {
      if (btn) { btn.disabled = true; btn.textContent = 'PREPARANDO…'; }
      setStatus('Preparando backup seguro…');
      const client = await getClient();
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData?.session) throw new Error('Sessão administrativa não encontrada. Entre novamente no painel.');

      const { data, error } = await client.rpc('export_nomad_backup');
      if (error) throw error;
      validateBackup(data);

      const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenameNow();
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2500);

      const now = new Date().toISOString();
      localStorage.setItem(LAST_KEY, now);
      const c = counts(data);
      setStatus(`Backup criado com sucesso • ${c.leads} lead(s), ${c.deals} negociação(ões), ${c.installments} parcela(s).`, 'ok');
    } catch (err) {
      console.error('[Nomad Horse Backup Seguro] exportação', err);
      setStatus(`Não foi possível criar o backup: ${String(err?.message || err)}`, 'err');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'BAIXAR BACKUP SEGURO'; }
    }
  }

  function closeModal() {
    document.getElementById('nhSafeRestoreModal')?.remove();
  }

  function openRestoreConfirm(data, fileName) {
    closeModal();
    const c = counts(data);
    const wrap = document.createElement('div');
    wrap.id = 'nhSafeRestoreModal';
    wrap.className = 'nh-safe-modal-backdrop';
    wrap.innerHTML = `
      <div class="nh-safe-modal" role="dialog" aria-modal="true">
        <h3>Confirmar restauração segura</h3>
        <p style="margin:0;opacity:.75">O sistema vai <strong>somente recuperar registros que estiverem faltando</strong>. Dados que já existem no sistema não serão substituídos.</p>
        <div class="nh-safe-modal-grid">
          <div class="nh-safe-modal-card"><small>Arquivo</small><strong>${esc(fileName)}</strong></div>
          <div class="nh-safe-modal-card"><small>Backup gerado em</small><strong>${esc(dtBR(data.exported_at))}</strong></div>
          <div class="nh-safe-modal-card"><small>Leads</small><strong>${c.leads}</strong></div>
          <div class="nh-safe-modal-card"><small>Negociações</small><strong>${c.deals}</strong></div>
          <div class="nh-safe-modal-card"><small>Parcelas</small><strong>${c.installments}</strong></div>
          <div class="nh-safe-modal-card"><small>Pagamentos</small><strong>${c.payments}</strong></div>
        </div>
        <div class="nh-safe-modal-actions">
          <button type="button" class="nh-safe-backup-btn secondary" id="nhSafeCancelRestore">CANCELAR</button>
          <button type="button" class="nh-safe-backup-btn" id="nhSafeConfirmRestore">RESTAURAR O QUE ESTIVER FALTANDO</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    document.getElementById('nhSafeCancelRestore')?.addEventListener('click', closeModal, { once:true });
    document.getElementById('nhSafeConfirmRestore')?.addEventListener('click', async () => {
      const btn = document.getElementById('nhSafeConfirmRestore');
      try {
        if (btn) { btn.disabled = true; btn.textContent = 'RESTAURANDO…'; }
        const client = await getClient();
        const { data: result, error } = await client.rpc('restore_nomad_backup_missing_only', { p_backup: data });
        if (error) throw error;
        closeModal();
        setStatus('Restauração segura concluída. Registros existentes foram preservados.', 'ok');
        try { await window.nomadHorseFinance?.reload?.(); } catch (_) {}
        console.info('[Nomad Horse Backup Seguro] restauração', result);
      } catch (err) {
        console.error('[Nomad Horse Backup Seguro] restauração', err);
        if (btn) { btn.disabled = false; btn.textContent = 'RESTAURAR O QUE ESTIVER FALTANDO'; }
        setStatus(`Não foi possível restaurar: ${String(err?.message || err)}`, 'err');
      }
    }, { once:true });
  }

  async function onFileSelected(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      setStatus('Validando arquivo de backup…');
      const text = await file.text();
      const data = validateBackup(JSON.parse(text));
      setStatus('Arquivo válido. Revise os dados antes de confirmar.', 'ok');
      openRestoreConfirm(data, file.name);
    } catch (err) {
      console.error('[Nomad Horse Backup Seguro] arquivo', err);
      setStatus(`Arquivo recusado: ${String(err?.message || err)}`, 'err');
    } finally {
      input.value = '';
    }
  }

  function injectPanel() {
    const admin = document.getElementById('view-admin');
    if (!admin || document.getElementById(PANEL_ID)) return;

    const finance = document.getElementById('nhFinancePanel');
    const shell = admin.querySelector('.shell') || admin;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'nh-safe-backup';
    const last = localStorage.getItem(LAST_KEY);
    panel.innerHTML = `
      <h3>Backup seguro</h3>
      <p>Módulo isolado do financeiro. A restauração apenas recupera registros ausentes e não substitui dados atuais.</p>
      <div class="nh-safe-backup-actions">
        <button type="button" class="nh-safe-backup-btn" id="nhSafeExport">BAIXAR BACKUP SEGURO</button>
        <button type="button" class="nh-safe-backup-btn secondary" id="nhSafeRestore">RESTAURAR BACKUP SEGURO</button>
      </div>
      <input id="${INPUT_ID}" type="file" accept=".json,application/json" hidden>
      <div id="${STATUS_ID}" class="nh-safe-backup-status">${last ? `Último backup seguro neste aparelho: ${esc(dtBR(last))}` : 'Nenhum backup seguro criado por este módulo neste aparelho.'}</div>`;

    if (finance) finance.insertAdjacentElement('afterend', panel);
    else {
      const stats = shell.querySelector('.stats');
      if (stats) stats.insertAdjacentElement('afterend', panel);
      else shell.prepend(panel);
    }

    document.getElementById('nhSafeExport')?.addEventListener('click', exportSafeBackup);
    document.getElementById('nhSafeRestore')?.addEventListener('click', () => {
      const input = document.getElementById(INPUT_ID);
      if (input) input.click();
    });
    document.getElementById(INPUT_ID)?.addEventListener('change', onFileSelected);
  }

  function init() {
    injectStyles();
    // Tentativas finitas; não observa a página e não intercepta navegação.
    setTimeout(injectPanel, 250);
    setTimeout(injectPanel, 900);
    setTimeout(injectPanel, 1800);

    document.addEventListener('click', (e) => {
      const adminButton = e.target.closest?.('[data-view="admin"]');
      if (adminButton) setTimeout(injectPanel, 250);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
