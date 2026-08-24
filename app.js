const SUPABASE_URL = 'https://ndbekzgxdfuhjlocipiv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_H0DQ1mF0BW8bTysshtTJuw_Ulglk1_Z';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => [...el.querySelectorAll(q)];
let currentView='home';
let currentInterestListingId=null;
let deferredPrompt=null;
let currentLeadId=null;
let currentLeadPhone='';
let currentLeadDealId=null;
let leadFilter='all';
let followUpFilter='all';
let priorityFilter='all';
let financePeriod='all';

function money(v){ const n=Number(v||0); return n?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Sob consulta'; }
function esc(v=''){ return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function setResult(form,text,type='success'){ const box=form.querySelector('.form-result'); if(!box)return; box.className='full form-result notice '+type; box.textContent=text; setTimeout(()=>box.classList.add('hidden'),8000); }
function toggleBusy(form,busy){ const btn=form.querySelector('button[type="submit"]'); if(btn){ btn.disabled=busy; btn.dataset.old=btn.dataset.old||btn.textContent; btn.textContent=busy?'Enviando...':btn.dataset.old; } }

async function showView(name){
  currentView=name;
  $$('.view').forEach(v=>v.classList.add('hidden'));
  $('#view-'+name)?.classList.remove('hidden');
  $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  $('.nav')?.classList.remove('open');
  $('.menu-toggle')?.setAttribute('aria-expanded','false');
  window.scrollTo({top:0,behavior:'smooth'});
  $('#installPrompt')?.classList.toggle('hidden', name!=='home' || localStorage.getItem('nhm_install_dismissed')==='1');
  if(name==='market') await renderListings();
  if(name==='admin') await renderAdminGate();
}

async function renderListings(){
  const wrap=$('#listingGrid'); if(!wrap)return;
  wrap.innerHTML='<div class="loader">Carregando anúncios...</div>';
  let q=sb.from('listings').select('id,vehicle_type,title,description,price,year,city,state,tag,featured,image_url,created_at').eq('status','active').order('featured',{ascending:false}).order('created_at',{ascending:false});
  const type=$('#filterType')?.value||'';
  const city=($('#filterCity')?.value||'').trim();
  const max=Number($('#filterPrice')?.value||0);
  if(type) q=q.eq('vehicle_type',type);
  if(city) q=q.ilike('city',`%${city}%`);
  if(max) q=q.lte('price',max);
  const {data,error}=await q;
  if(error){ wrap.innerHTML='<div class="notice error">Não foi possível carregar os anúncios agora.</div>'; return; }
  wrap.innerHTML=(data||[]).map(x=>`
    <article class="listing">
      <div class="listing-photo">${x.image_url ? `<img src="${esc(x.image_url)}" alt="${esc(x.title)}" loading="lazy">` : esc((x.vehicle_type||'ANÚNCIO').toUpperCase())}</div>
      <div class="listing-body">
        <span class="badge">${esc(x.tag||x.vehicle_type)}</span>
        <h3>${esc(x.title)}</h3>
        <div class="muted">${x.year||''}${x.year&&x.city?' • ':''}${esc(x.city||'')}${x.state?' - '+esc(x.state):''}</div>
        <div class="price">${money(x.price)}</div>
        <div class="btn-row">
          <button class="btn" onclick="interest('${x.id}','${encodeURIComponent(x.title)}','${encodeURIComponent(x.vehicle_type||'')}')">Tenho interesse</button>
          <button class="btn ghost" onclick="shareListing('${x.id}','${encodeURIComponent(x.title)}',${Number(x.price||0)})">Compartilhar</button>
        </div>
      </div>
    </article>`).join('') || '<div class="notice">Nenhum anúncio encontrado com esses filtros.</div>';
}

function interest(id,title,vehicleType){
  currentInterestListingId=id;
  showView('buy');
  const selectedType=decodeURIComponent(vehicleType||'');
  const typeField=$('#buyType');
  if(typeField && selectedType){
    const exists=[...typeField.options].some(o=>o.value===selectedType);
    if(exists) typeField.value=selectedType;
  }
  $('#buyInterest').value=decodeURIComponent(title||'');
  $('#buyMessage').value='Tenho interesse neste anúncio e gostaria de receber mais informações.';
}
function shareListing(id,title,price){
  const text=`Nomad Horse Market — ${decodeURIComponent(title||'Anúncio')} — ${money(price)}`;
  if(navigator.share) navigator.share({title:'Nomad Horse Market',text,url:location.href});
  else navigator.clipboard?.writeText(text+' '+location.href).then(()=>alert('Anúncio copiado.'));
}

async function submitBuy(form){
  toggleBusy(form,true);
  const d=Object.fromEntries(new FormData(form).entries());
  let error;
  if(currentInterestListingId){
    ({error}=await sb.rpc('submit_listing_interest',{
      p_listing_id:currentInterestListingId,p_name:d.name,p_phone:d.phone,p_email:d.email||null,
      p_city:d.city||null,p_state:null,p_message:d.message||null,p_source:'nomad_horse_market'
    }));
  }else{
    ({error}=await sb.rpc('submit_lead',{
      p_lead_type:'compra',p_name:d.name,p_phone:d.phone,p_email:d.email||null,p_city:d.city||null,p_state:null,
      p_vehicle_type:d.type||null,p_budget:d.budget?Number(d.budget):null,p_timeline:d.timeline||null,
      p_interest:d.interest||null,p_message:d.message||null,p_listing_id:null,p_source:'nomad_horse_market'
    }));
  }
  toggleBusy(form,false);
  if(error) return setResult(form,'Não foi possível enviar. Confira os dados e tente novamente.','error');
  form.reset(); currentInterestListingId=null;
  setResult(form,'Recebemos seu interesse. A Nomad Horse vai analisar e entrar em contato.');
}

async function submitSeller(form){
  toggleBusy(form,true);
  const d=Object.fromEntries(new FormData(form).entries());
  const {error}=await sb.rpc('submit_listing',{
    p_name:d.name,p_phone:d.phone,p_vehicle_type:d.type,p_year:d.year?Number(d.year):null,
    p_price:d.price?Number(d.price):null,p_city:d.city||null,p_state:null,p_title:d.title||null,
    p_description:d.message||null,p_email:d.email||null,p_source:'nomad_horse_market'
  });
  toggleBusy(form,false);
  if(error) return setResult(form,'Não foi possível enviar o anúncio. Confira os dados.','error');
  form.reset(); setResult(form,'Cadastro recebido. O anúncio ficará aguardando aprovação da Nomad Horse.');
}

async function submitSimpleLead(form,kind){
  toggleBusy(form,true);
  const d=Object.fromEntries(new FormData(form).entries());
  const map={'Fabricação':'fabricacao','Serviço':'servico'};
  const {error}=await sb.rpc('submit_lead',{
    p_lead_type:map[kind],p_name:d.name,p_phone:d.phone,p_email:d.email||null,p_city:d.city||null,p_state:null,
    p_vehicle_type:d.type||null,p_budget:d.budget?Number(d.budget):null,p_timeline:d.timeline||null,
    p_interest:d.interest||null,p_message:d.message||null,p_listing_id:null,p_source:'nomad_horse_market'
  });
  toggleBusy(form,false);
  if(error) return setResult(form,'Não foi possível enviar agora. Tente novamente.','error');
  form.reset(); setResult(form,'Recebemos seus dados. A Nomad Horse vai analisar e entrar em contato.');
}

async function adminSignIn(form){
  toggleBusy(form,true);
  const d=Object.fromEntries(new FormData(form).entries());
  const {error}=await sb.auth.signInWithPassword({email:d.email,password:d.password});
  toggleBusy(form,false);
  if(error) return setResult(form,'E-mail ou senha inválidos.','error');
  await renderAdminGate();
}
async function adminSignUp(){
  const email=$('#adminEmail').value.trim(), password=$('#adminPassword').value;
  if(!email||password.length<6){ alert('Informe e-mail e uma senha com pelo menos 6 caracteres.'); return; }
  const {error}=await sb.auth.signUp({email,password});
  if(error){ alert('Não foi possível criar o acesso: '+error.message); return; }
  alert('Acesso criado. Agora este e-mail precisa ser liberado como administrador da Nomad Horse.');
}
async function adminLogout(){ await sb.auth.signOut(); await renderAdminGate(); }

async function renderAdminGate(){
  const login=$('#adminLogin'), content=$('#adminContent');
  login.classList.add('hidden'); content.classList.add('hidden');
  const {data:{session}}=await sb.auth.getSession();
  if(!session){ login.classList.remove('hidden'); return; }
  const {data:isAdmin,error}=await sb.rpc('is_admin');
  if(error||!isAdmin){
    login.classList.remove('hidden');
    $('#adminGateMsg').className='notice error';
    $('#adminGateMsg').textContent='Sua conta está conectada, mas ainda não foi liberada como administradora.';
    $('#adminGateMsg').classList.remove('hidden');
    return;
  }
  content.classList.remove('hidden'); await loadAdmin();
}

function listingStatusLabel(status){ return ({pending:'Aguardando',active:'Ativo',paused:'Pausado',sold:'Vendido',rejected:'Rejeitado'})[status]||status; }
function listingStatusClass(status){ return 'listing-status status-'+esc(status||''); }
function storageObjectPath(url=''){
  const token='/storage/v1/object/public/listing-images/';
  const i=String(url).indexOf(token);
  return i>=0?decodeURIComponent(String(url).slice(i+token.length)):null;
}
async function removeStoredListingImage(url){
  const path=storageObjectPath(url); if(!path)return;
  await sb.storage.from('listing-images').remove([path]);
}
async function setListingStatus(id,status){
  const tags={active:'Anúncio aprovado',paused:'Pausado',sold:'Vendido',rejected:'Rejeitado'};
  const {error}=await sb.from('listings').update({status,tag:tags[status]||undefined,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return alert('Não foi possível atualizar o anúncio.');
  await loadAdmin();
  if(currentView==='market') await renderListings();
}
async function pauseListing(id){ if(confirm('Pausar este anúncio? Ele deixará de aparecer para os compradores.')) await setListingStatus(id,'paused'); }
async function activateListing(id){ await setListingStatus(id,'active'); }
async function markListingSold(id){ if(confirm('Marcar este anúncio como VENDIDO? Ele sairá da área pública.')) await setListingStatus(id,'sold'); }
async function deleteListing(id){
  if(!confirm('Excluir este anúncio definitivamente? Esta ação não pode ser desfeita.'))return;
  const {data}=await sb.from('listings').select('image_url').eq('id',id).maybeSingle();
  const {error}=await sb.from('listings').delete().eq('id',id);
  if(error)return alert('Não foi possível excluir o anúncio.');
  if(data?.image_url) await removeStoredListingImage(data.image_url);
  await loadAdmin();
}
function closeListingEditor(){ $('#listingEditor')?.classList.add('hidden'); document.body.classList.remove('modal-open'); }
async function openListingEditor(id,focusPhoto=false){
  const {data,error}=await sb.from('listings').select('*').eq('id',id).single();
  if(error||!data)return alert('Não foi possível abrir este anúncio.');
  const form=$('#listingEditForm');
  form.elements.id.value=data.id;
  form.elements.title.value=data.title||'';
  form.elements.type.value=data.vehicle_type||'Motorhome';
  form.elements.price.value=data.price??'';
  form.elements.year.value=data.year??'';
  form.elements.city.value=data.city||'';
  form.elements.state.value=data.state||'';
  form.elements.tag.value=data.tag||'';
  form.elements.description.value=data.description||'';
  form.elements.current_image.value=data.image_url||'';
  form.elements.photo.value='';
  $('#editImagePreview').innerHTML=data.image_url?`<img src="${esc(data.image_url)}" alt="Foto atual">`:'<span class="muted">Sem foto</span>';
  $('#listingEditor').classList.remove('hidden'); document.body.classList.add('modal-open');
  if(focusPhoto) setTimeout(()=>form.elements.photo.scrollIntoView({behavior:'smooth',block:'center'}),150);
}
async function saveListingEdit(form){
  const btn=form.querySelector('button[type="submit"]'); const old=btn.textContent; btn.disabled=true; btn.textContent='SALVANDO...';
  const d=Object.fromEntries(new FormData(form).entries());
  let imageUrl=d.current_image||null;
  const file=form.elements.photo.files?.[0];
  if(file){
    if(file.size>10*1024*1024){ btn.disabled=false; btn.textContent=old; return alert('A foto deve ter no máximo 10 MB.'); }
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
    const path=`${d.id}/${Date.now()}.${ext||'jpg'}`;
    const {error:upErr}=await sb.storage.from('listing-images').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||undefined});
    if(upErr){ btn.disabled=false; btn.textContent=old; return alert('Não foi possível enviar a foto.'); }
    const {data:pub}=sb.storage.from('listing-images').getPublicUrl(path);
    const previous=imageUrl; imageUrl=pub.publicUrl;
    if(previous) await removeStoredListingImage(previous);
  }
  const payload={
    title:d.title.trim(),vehicle_type:d.type,price:d.price?Number(d.price):null,year:d.year?Number(d.year):null,
    city:d.city.trim()||null,state:d.state.trim()||null,tag:d.tag.trim()||null,description:d.description.trim()||null,
    image_url:imageUrl,updated_at:new Date().toISOString()
  };
  const {error}=await sb.from('listings').update(payload).eq('id',d.id);
  btn.disabled=false; btn.textContent=old;
  if(error)return alert('Não foi possível salvar as alterações.');
  closeListingEditor(); await loadAdmin(); if(currentView==='market') await renderListings();
}


function leadTypeLabel(v){
  return ({compra:'Compra',venda:'Venda',fabricacao:'Fabricação',servico:'Serviço',interesse_anuncio:'Interesse em anúncio'})[v]||v||'Lead';
}
function leadStatusLabel(v){
  return ({novo:'Novo',contato_feito:'Contato feito',negociacao:'Negociação',proposta_enviada:'Proposta enviada',fechado:'Fechado',perdido:'Perdido'})[v]||v||'';
}
function dealStageLabel(v){
  return ({lead:'Lead',qualificado:'Qualificado',proposta:'Proposta',vistoria:'Vistoria',documentacao:'Documentação',fechado:'Fechado',cancelado:'Cancelado'})[v]||v||'';
}
function setLeadFilter(status='all'){
  leadFilter=status||'all';
  followUpFilter='all';
  loadAdmin();
}
function renderSalesFunnel(leads,deals){
  const stages=[
    ['novo','Novo'],['contato_feito','Contato feito'],['negociacao','Negociação'],
    ['proposta_enviada','Proposta'],['fechado','Fechado'],['perdido','Perdido']
  ];
  const counts=Object.fromEntries(stages.map(([k])=>[k,leads.filter(x=>x.status===k).length]));
  const openCount=leads.filter(x=>!['fechado','perdido'].includes(x.status)).length;
  const closedDeals=deals.filter(x=>x.stage==='fechado');
  const closedValue=closedDeals.reduce((sum,x)=>sum+Number(x.agreed_price||0),0);
  const commissions=closedDeals.reduce((sum,x)=>sum+Number(x.commission_amount||0),0);
  const funnel=$('#salesFunnel');
  if(funnel) funnel.innerHTML=stages.map(([key,label],i)=>`
    <button type="button" class="funnel-step funnel-${key} ${leadFilter===key?'active':''}" onclick="setLeadFilter('${key}')">
      <span class="funnel-index">${i+1}</span>
      <strong>${counts[key]||0}</strong>
      <span>${label}</span>
    </button>`).join('');
  const summary=$('#funnelSummary');
  if(summary) summary.innerHTML=`
    <div><span>Em aberto</span><strong>${openCount}</strong></div>
    <div><span>Fechados</span><strong>${counts.fechado||0}</strong></div>
    <div><span>Valor fechado</span><strong>${closedValue?money(closedValue):'R$ 0,00'}</strong></div>
    <div><span>Comissão gerada</span><strong>${commissions?money(commissions):'R$ 0,00'}</strong></div>`;
  const clear=$('#funnelClear');
  if(clear) clear.classList.toggle('hidden',leadFilter==='all');
}

function financeCurrency(v){
  return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
function financePeriodLabel(){
  return ({all:'Todo o período',month:'Este mês','30d':'Últimos 30 dias'})[financePeriod]||'Todo o período';
}
function setFinancePeriod(value='all'){
  financePeriod=value||'all';
  loadAdmin();
}
function dealClosedDate(deal){
  const raw=deal.closed_at||deal.updated_at||deal.created_at;
  const d=raw?new Date(raw):null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}
function dealMatchesFinancePeriod(deal,now=new Date()){
  if(financePeriod==='all') return true;
  const d=dealClosedDate(deal); if(!d) return false;
  if(financePeriod==='month') return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
  if(financePeriod==='30d') return d >= new Date(now.getTime()-30*24*60*60*1000) && d <= now;
  return true;
}
function renderCommercialResults(deals,leads,listingMap){
  const leadMap=new Map(leads.map(x=>[x.id,x]));
  const closed=deals.filter(x=>x.stage==='fechado' && dealMatchesFinancePeriod(x));
  const cancelled=deals.filter(x=>x.stage==='cancelado' && dealMatchesFinancePeriod(x));
  const finalCount=closed.length+cancelled.length;
  const closedValue=closed.reduce((sum,x)=>sum+Number(x.agreed_price||0),0);
  const commissions=closed.reduce((sum,x)=>sum+Number(x.commission_amount||0),0);
  const avgTicket=closed.length?closedValue/closed.length:0;
  const closeRate=finalCount?closed.length/finalCount*100:0;
  const openDeals=deals.filter(x=>!['fechado','cancelado'].includes(x.stage));
  const pipeline=openDeals.reduce((sum,x)=>sum+Number(x.offered_price||x.asking_price||0),0);
  const box=$('#commercialResults');
  if(box) box.innerHTML=`
    <div class="result-card"><span>Negócios fechados</span><strong>${closed.length}</strong><small>${esc(financePeriodLabel())}</small></div>
    <div class="result-card money"><span>Valor fechado</span><strong>${financeCurrency(closedValue)}</strong><small>Volume negociado</small></div>
    <div class="result-card money"><span>Comissão gerada</span><strong>${financeCurrency(commissions)}</strong><small>Receita de comissão</small></div>
    <div class="result-card money"><span>Ticket médio</span><strong>${financeCurrency(avgTicket)}</strong><small>Por negócio fechado</small></div>
    <div class="result-card"><span>Taxa de fechamento</span><strong>${closeRate.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</strong><small>Fechados ÷ decisões finais</small></div>
    <div class="result-card money pipeline"><span>Pipeline aberto</span><strong>${financeCurrency(pipeline)}</strong><small>${openDeals.length} negociação${openDeals.length===1?'':'ões'} em aberto</small></div>`;
  $$('#resultsPeriod [data-finance-period]').forEach(b=>b.classList.toggle('active',b.dataset.financePeriod===financePeriod));
  const list=$('#closedDealsList'); if(!list)return;
  const rows=[...closed].sort((a,b)=>(dealClosedDate(b)?.getTime()||0)-(dealClosedDate(a)?.getTime()||0));
  list.innerHTML=rows.length?`<div class="closed-deals-title"><strong>Fechamentos</strong><span>${rows.length} registro${rows.length===1?'':'s'}</span></div>${rows.map(x=>{
    const lead=leadMap.get(x.buyer_lead_id)||leadMap.get(x.seller_lead_id);
    const listing=listingMap.get(x.listing_id);
    const d=dealClosedDate(x);
    return `<article class="closed-deal-row">
      <div class="closed-deal-main"><strong>${esc(lead?.name||'Cliente')}</strong><span>${esc(listing?.title||'Negociação')}</span><small>${d?d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</small></div>
      <div class="closed-deal-values"><span>Fechado <strong>${financeCurrency(x.agreed_price)}</strong></span><span>Comissão <strong>${financeCurrency(x.commission_amount)}</strong></span></div>
      ${lead?`<button class="btn ghost small" onclick="openLeadEditor('${lead.id}')">Abrir</button>`:''}
    </article>`;
  }).join('')}`:'<div class="panel muted results-empty">Nenhum fechamento neste período.</div>';
}


function monthStartKey(date=new Date()){
  const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0');
  return `${y}-${m}-01`;
}
function sameLocalMonth(date,now=new Date()){
  return date && date.getFullYear()===now.getFullYear() && date.getMonth()===now.getMonth();
}
function monthlyGoalPercent(value,target){
  return Number(target||0)>0 ? Number(value||0)/Number(target)*100 : 0;
}
function monthlyGoalStatus(projection,target){
  if(!Number(target||0)) return 'Defina uma meta para acompanhar o ritmo';
  if(Number(projection||0)>=Number(target||0)) return 'Ritmo atual indica meta alcançável';
  return `Projeção abaixo da meta em ${financeCurrency(Number(target)-Number(projection||0))}`;
}
function renderMonthlyGoals(deals,goal){
  const now=new Date();
  const monthDeals=deals.filter(x=>x.stage==='fechado' && sameLocalMonth(dealClosedDate(x),now));
  const sales=monthDeals.reduce((sum,x)=>sum+Number(x.agreed_price||0),0);
  const commission=monthDeals.reduce((sum,x)=>sum+Number(x.commission_amount||0),0);
  const salesTarget=Number(goal?.sales_target||0);
  const commissionTarget=Number(goal?.commission_target||0);
  const salesPct=monthlyGoalPercent(sales,salesTarget);
  const commissionPct=monthlyGoalPercent(commission,commissionTarget);
  const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const elapsed=Math.max(1,now.getDate());
  const projectedSales=sales/elapsed*daysInMonth;
  const projectedCommission=commission/elapsed*daysInMonth;
  const salesRemaining=Math.max(0,salesTarget-sales);
  const commissionRemaining=Math.max(0,commissionTarget-commission);
  const box=$('#monthlyGoals');
  if(box) box.innerHTML=`
    <div class="goal-card">
      <div class="goal-card-head"><span>Meta de vendas</span><strong>${salesTarget?financeCurrency(salesTarget):'Não definida'}</strong></div>
      <div class="goal-progress"><i style="width:${Math.min(100,Math.max(0,salesPct))}%"></i></div>
      <div class="goal-line"><span>Atingido</span><strong>${financeCurrency(sales)}${salesTarget?` • ${salesPct.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`:''}</strong></div>
      <div class="goal-line muted-goal"><span>Falta</span><strong>${salesTarget?financeCurrency(salesRemaining):'—'}</strong></div>
    </div>
    <div class="goal-card">
      <div class="goal-card-head"><span>Meta de comissão</span><strong>${commissionTarget?financeCurrency(commissionTarget):'Não definida'}</strong></div>
      <div class="goal-progress"><i style="width:${Math.min(100,Math.max(0,commissionPct))}%"></i></div>
      <div class="goal-line"><span>Atingido</span><strong>${financeCurrency(commission)}${commissionTarget?` • ${commissionPct.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`:''}</strong></div>
      <div class="goal-line muted-goal"><span>Falta</span><strong>${commissionTarget?financeCurrency(commissionRemaining):'—'}</strong></div>
    </div>
    <div class="projection-card">
      <div><span>Projeção de vendas no mês</span><strong>${financeCurrency(projectedSales)}</strong><small>${monthlyGoalStatus(projectedSales,salesTarget)}</small></div>
      <div><span>Projeção de comissão no mês</span><strong>${financeCurrency(projectedCommission)}</strong><small>${monthlyGoalStatus(projectedCommission,commissionTarget)}</small></div>
      <p>Projeção baseada no resultado acumulado até o dia ${elapsed} de ${daysInMonth}.</p>
    </div>`;
  const form=$('#monthlyGoalForm');
  if(form){
    form.elements.sales_target.value=salesTarget||'';
    form.elements.commission_target.value=commissionTarget||'';
  }
  const label=$('#goalMonthLabel');
  if(label) label.textContent=now.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
}
async function saveMonthlyGoals(form){
  const btn=form.querySelector('button[type="submit"]');
  const old=btn.textContent;
  btn.disabled=true; btn.textContent='SALVANDO...';
  const sales=Math.max(0,Number(form.elements.sales_target.value||0));
  const commission=Math.max(0,Number(form.elements.commission_target.value||0));
  const payload={
    month_start:monthStartKey(),
    sales_target:sales,
    commission_target:commission,
    updated_at:new Date().toISOString()
  };
  const {error}=await sb.from('commercial_goals').upsert(payload,{onConflict:'month_start'});
  btn.disabled=false; btn.textContent=old;
  if(error){
    const box=form.querySelector('.form-result');
    box.className='form-result notice error';
    box.textContent='Não foi possível salvar as metas.';
    return;
  }
  await loadAdmin();
  const box=$('#monthlyGoalForm .form-result');
  if(box){
    box.className='form-result notice success';
    box.textContent='Metas do mês salvas com sucesso.';
    setTimeout(()=>box.classList.add('hidden'),6000);
  }
}

function localDateTimeValue(iso){
  if(!iso) return '';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime())) return '';
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatDateTime(iso){
  if(!iso) return '—';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function followUpState(lead,now=new Date()){
  if(['fechado','perdido'].includes(lead.status)) return 'closed';
  if(!lead.next_follow_up_at) return 'none';
  const d=new Date(lead.next_follow_up_at);
  if(Number.isNaN(d.getTime())) return 'none';
  const start=new Date(now); start.setHours(0,0,0,0);
  const end=new Date(now); end.setHours(23,59,59,999);
  const week=new Date(end); week.setDate(week.getDate()+7);
  if(d<now) return 'overdue';
  if(d<=end) return 'today';
  if(d<=week) return 'week';
  return 'later';
}
function followUpLabel(lead){
  const state=followUpState(lead);
  if(state==='overdue') return `⚠️ Atrasado • ${formatDateTime(lead.next_follow_up_at)}`;
  if(state==='today') return `📅 Hoje • ${formatDateTime(lead.next_follow_up_at)}`;
  if(state==='week') return `🗓️ Próximo • ${formatDateTime(lead.next_follow_up_at)}`;
  if(state==='later') return `🗓️ ${formatDateTime(lead.next_follow_up_at)}`;
  return '';
}
function setFollowUpFilter(value='all'){
  followUpFilter=value||'all';
  leadFilter='all';
  loadAdmin();
}
function renderFollowUps(leads){
  const open=leads.filter(x=>!['fechado','perdido'].includes(x.status));
  const counts={
    overdue:open.filter(x=>followUpState(x)==='overdue').length,
    today:open.filter(x=>followUpState(x)==='today').length,
    week:open.filter(x=>followUpState(x)==='week').length,
    none:open.filter(x=>followUpState(x)==='none').length
  };
  const el=$('#followUpSummary');
  if(el) el.innerHTML=`
    <button class="follow-card overdue ${followUpFilter==='overdue'?'active':''}" onclick="setFollowUpFilter('overdue')"><span>Atrasados</span><strong>${counts.overdue}</strong><small>Contato vencido</small></button>
    <button class="follow-card today ${followUpFilter==='today'?'active':''}" onclick="setFollowUpFilter('today')"><span>Hoje</span><strong>${counts.today}</strong><small>Retornos de hoje</small></button>
    <button class="follow-card week ${followUpFilter==='week'?'active':''}" onclick="setFollowUpFilter('week')"><span>Próximos 7 dias</span><strong>${counts.week}</strong><small>Agenda próxima</small></button>
    <button class="follow-card none ${followUpFilter==='none'?'active':''}" onclick="setFollowUpFilter('none')"><span>Sem retorno</span><strong>${counts.none}</strong><small>Precisa agendar</small></button>`;
  const clear=$('#followClear');
  if(clear) clear.classList.toggle('hidden',followUpFilter==='all');
}
function setPriorityFilter(value='all'){
  priorityFilter=value||'all';
  loadAdmin();
}
function priorityKinds(lead,deal){
  if(['fechado','perdido'].includes(lead.status)) return [];
  const kinds=[];
  const f=followUpState(lead);
  if(f==='overdue') kinds.push('overdue');
  if(f==='today') kinds.push('today');
  if(lead.status==='novo') kinds.push('new');
  if(lead.status==='proposta_enviada' || deal?.stage==='proposta') kinds.push('proposal');
  return kinds;
}
function priorityState(lead,deal){
  const kinds=priorityKinds(lead,deal);
  const order=['overdue','today','new','proposal'];
  return order.find(k=>kinds.includes(k))||null;
}
function priorityLabel(kind){
  return ({overdue:'Retorno atrasado',today:'Retorno hoje',new:'Novo sem contato',proposal:'Proposta em andamento'})[kind]||kind;
}
function priorityIcon(kind){
  return ({overdue:'⚠️',today:'📅',new:'🆕',proposal:'💼'})[kind]||'•';
}
function renderPriorityCenter(leads,deals,listingMap,dealByLead){
  const open=leads.filter(x=>!['fechado','perdido'].includes(x.status));
  const entries=open.map(lead=>{
    const deal=dealByLead.get(lead.id)||null;
    const kind=priorityState(lead,deal);
    return kind?{lead,deal,kind,listing:listingMap.get(lead.listing_id)||null}:null;
  }).filter(Boolean);
  const order={overdue:0,today:1,new:2,proposal:3};
  entries.sort((a,b)=>{
    const d=(order[a.kind]??9)-(order[b.kind]??9);
    if(d) return d;
    const ad=a.lead.next_follow_up_at?new Date(a.lead.next_follow_up_at).getTime():new Date(a.lead.created_at).getTime();
    const bd=b.lead.next_follow_up_at?new Date(b.lead.next_follow_up_at).getTime():new Date(b.lead.created_at).getTime();
    return ad-bd;
  });
  const counts={overdue:0,today:0,new:0,proposal:0};
  open.forEach(lead=>{
    const deal=dealByLead.get(lead.id)||null;
    priorityKinds(lead,deal).forEach(kind=>counts[kind]++);
  });
  const summary=$('#prioritySummary');
  if(summary) summary.innerHTML=`
    <button class="priority-stat priority-overdue ${priorityFilter==='overdue'?'active':''}" onclick="setPriorityFilter('overdue')"><span>⚠️ Atrasados</span><strong>${counts.overdue}</strong></button>
    <button class="priority-stat priority-today ${priorityFilter==='today'?'active':''}" onclick="setPriorityFilter('today')"><span>📅 Hoje</span><strong>${counts.today}</strong></button>
    <button class="priority-stat priority-new ${priorityFilter==='new'?'active':''}" onclick="setPriorityFilter('new')"><span>🆕 Novos</span><strong>${counts.new}</strong></button>
    <button class="priority-stat priority-proposal ${priorityFilter==='proposal'?'active':''}" onclick="setPriorityFilter('proposal')"><span>💼 Propostas</span><strong>${counts.proposal}</strong></button>`;
  const filtered=priorityFilter==='all'?entries:open.map(lead=>{
    const deal=dealByLead.get(lead.id)||null;
    const kinds=priorityKinds(lead,deal);
    if(!kinds.includes(priorityFilter)) return null;
    return {lead,deal,kind:priorityFilter,listing:listingMap.get(lead.listing_id)||null};
  }).filter(Boolean);
  const list=$('#priorityList');
  if(list) list.innerHTML=filtered.length?filtered.map(({lead,deal,kind,listing})=>{
    const detail=kind==='overdue'||kind==='today'
      ? followUpLabel(lead)
      : kind==='proposal'
        ? `${deal?.offered_price?'Oferta '+money(deal.offered_price):deal?.asking_price?'Pedido '+money(deal.asking_price):'Proposta em acompanhamento'}`
        : `Entrou em ${formatDateTime(lead.created_at)}`;
    const interest=listing?.title||lead.vehicle_type||lead.interest||'Interesse não informado';
    return `<article class="priority-item priority-item-${kind}">
      <div class="priority-item-main">
        <div class="priority-reason"><span>${priorityIcon(kind)}</span><strong>${priorityLabel(kind)}</strong></div>
        <h4>${esc(lead.name)}</h4>
        <div class="priority-detail">${esc(detail)}</div>
        <div class="priority-interest">${esc(interest)}</div>
      </div>
      <div class="priority-actions">
        <div class="priority-actions-main">
          <button class="btn small" onclick="openLeadEditor('${lead.id}')">Abrir cliente</button>
          <button class="btn whatsapp small" onclick="openWhatsApp('${esc(lead.phone)}','${encodeURIComponent(lead.name)}')">WhatsApp</button>
        </div>
        <div class="priority-actions-quick">
          <button class="btn ghost small" onclick="priorityMarkContact('${lead.id}')">✓ Registrar contato</button>
          <button class="btn ghost small" onclick="togglePrioritySchedule('${lead.id}')">🗓 Reagendar</button>
          ${lead.next_follow_up_at?`<button class="btn ghost small priority-complete" onclick="priorityCompleteFollowUp('${lead.id}')">✓ Concluir retorno</button>`:''}
        </div>
        <div id="priority-schedule-${lead.id}" class="priority-schedule hidden">
          <span>Novo retorno:</span>
          <button class="btn ghost small" onclick="priorityReschedule('${lead.id}','tomorrow')">Amanhã 9h</button>
          <button class="btn ghost small" onclick="priorityReschedule('${lead.id}','3days')">+3 dias</button>
          <button class="btn ghost small" onclick="priorityReschedule('${lead.id}','7days')">+7 dias</button>
        </div>
      </div>
    </article>`;
  }).join(''):`<div class="priority-empty">✅ ${priorityFilter==='all'?'Nenhuma prioridade pendente agora.':'Nenhum cliente nesta prioridade.'}</div>`;
  const clear=$('#priorityClear');
  if(clear) clear.classList.toggle('hidden',priorityFilter==='all');
}

function togglePrioritySchedule(id){
  const target=document.getElementById(`priority-schedule-${id}`);
  if(!target) return;
  $$('.priority-schedule').forEach(el=>{ if(el!==target) el.classList.add('hidden'); });
  target.classList.toggle('hidden');
}
function priorityFollowUpIso(kind){
  const d=new Date();
  if(kind==='tomorrow'){ d.setDate(d.getDate()+1); d.setHours(9,0,0,0); }
  else if(kind==='3days'){ d.setDate(d.getDate()+3); d.setHours(9,0,0,0); }
  else if(kind==='7days'){ d.setDate(d.getDate()+7); d.setHours(9,0,0,0); }
  else { d.setDate(d.getDate()+1); d.setHours(9,0,0,0); }
  return d.toISOString();
}
async function priorityMarkContact(id){
  const {data:lead,error:readError}=await sb.from('leads').select('id,status').eq('id',id).maybeSingle();
  if(readError||!lead) return alert('Não foi possível carregar este cliente.');
  const status=lead.status==='novo'?'contato_feito':lead.status;
  const {error}=await sb.from('leads').update({
    last_contact_at:new Date().toISOString(),
    status,
    updated_at:new Date().toISOString()
  }).eq('id',id);
  if(error) return alert('Não foi possível registrar o contato.');
  await loadAdmin();
  alert('Contato registrado. O retorno agendado foi mantido.');
}
async function priorityReschedule(id,kind){
  const next=priorityFollowUpIso(kind);
  const {error}=await sb.from('leads').update({
    next_follow_up_at:next,
    updated_at:new Date().toISOString()
  }).eq('id',id);
  if(error) return alert('Não foi possível reagendar o retorno.');
  await loadAdmin();
  alert(`Retorno reagendado para ${formatDateTime(next)}.`);
}
async function priorityCompleteFollowUp(id){
  if(!confirm('Concluir este retorno? O contato será registrado agora e o agendamento atual será removido.')) return;
  const {data:lead,error:readError}=await sb.from('leads').select('id,status').eq('id',id).maybeSingle();
  if(readError||!lead) return alert('Não foi possível carregar este cliente.');
  const status=lead.status==='novo'?'contato_feito':lead.status;
  const now=new Date().toISOString();
  const {error}=await sb.from('leads').update({
    last_contact_at:now,
    next_follow_up_at:null,
    status,
    updated_at:now
  }).eq('id',id);
  if(error) return alert('Não foi possível concluir o retorno.');
  await loadAdmin();
  alert('Retorno concluído. Se precisar, você pode agendar um novo retorno depois.');
}

function scheduleFollowUpPreset(kind){
  const form=$('#leadAdminForm'); if(!form) return;
  const d=new Date();
  if(kind==='today'){ d.setHours(17,0,0,0); if(d<new Date()) d.setDate(d.getDate()+1); }
  if(kind==='tomorrow'){ d.setDate(d.getDate()+1); d.setHours(9,0,0,0); }
  if(kind==='3days'){ d.setDate(d.getDate()+3); d.setHours(9,0,0,0); }
  form.elements.next_follow_up_at.value=localDateTimeValue(d.toISOString());
}
async function markContactNow(){
  if(!currentLeadId) return;
  const form=$('#leadAdminForm');
  const status=form?.elements.status?.value==='novo'?'contato_feito':form?.elements.status?.value;
  const {error}=await sb.from('leads').update({
    last_contact_at:new Date().toISOString(),
    status:status||'contato_feito',
    updated_at:new Date().toISOString()
  }).eq('id',currentLeadId);
  if(error) return alert('Não foi possível registrar o contato.');
  if(form && form.elements.status.value==='novo') form.elements.status.value='contato_feito';
  await openLeadEditor(currentLeadId);
  await loadAdmin();
  alert('Contato registrado agora.');
}

function waNumber(phone=''){
  let d=String(phone).replace(/\D/g,'');
  if(d.length===10||d.length===11) d='55'+d;
  return d;
}
function openWhatsApp(phone,name=''){
  const d=waNumber(phone);
  if(!d) return alert('WhatsApp não informado.');
  try{name=decodeURIComponent(name||'')}catch(e){} const msg=encodeURIComponent(`Olá ${name||''}, aqui é da Nomad Horse. Recebemos seu contato pelo Nomad Horse Market.`);
  window.open(`https://wa.me/${d}?text=${msg}`,'_blank','noopener');
}
function historyEventPresentation(type){
  const map={
    lead_created:['🆕','Lead recebido','history-lead'],history_started:['🕘','Histórico ativado','history-system'],status_snapshot:['📌','Situação atual','history-status'],
    status_changed:['🔄','Status alterado','history-status'],contact_recorded:['📞','Contato registrado','history-contact'],
    follow_up_scheduled:['📅','Retorno agendado','history-follow'],follow_up_rescheduled:['🗓️','Retorno reagendado','history-follow'],follow_up_completed:['✅','Retorno concluído','history-contact'],
    internal_note_updated:['📝','Observação interna atualizada','history-note'],deal_created:['💼','Negociação criada','history-deal'],deal_snapshot:['📌','Situação da negociação','history-deal'],
    deal_stage_changed:['📈','Etapa da negociação alterada','history-deal'],asking_price_updated:['💰','Preço pedido atualizado','history-money'],offer_updated:['🤝','Oferta atualizada','history-money'],
    agreed_price_updated:['🏁','Preço fechado atualizado','history-money'],commission_updated:['💵','Comissão atualizada','history-money'],deal_note_updated:['📝','Observação da negociação atualizada','history-note']
  };
  return map[type]||['•','Atualização','history-system'];
}
function historyMoney(v){ return v==null||v===''?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function historyDetail(event){
  const d=event.details||{};
  switch(event.event_type){
    case 'status_changed': return `${leadStatusLabel(d.from)||d.from||'—'} → ${leadStatusLabel(d.to)||d.to||'—'}`;
    case 'status_snapshot': return leadStatusLabel(d.to)||d.to||event.description||'';
    case 'follow_up_scheduled': return d.to?`Agendado para ${formatDateTime(d.to)}`:(event.description||'');
    case 'follow_up_rescheduled': return `${d.from?formatDateTime(d.from):'—'} → ${d.to?formatDateTime(d.to):'—'}`;
    case 'follow_up_completed': return d.from?`Retorno de ${formatDateTime(d.from)} concluído.`:(event.description||'');
    case 'contact_recorded': return d.at?`Contato em ${formatDateTime(d.at)}`:(event.description||'');
    case 'deal_stage_changed': return `${dealStageLabel(d.from)||d.from||'—'} → ${dealStageLabel(d.to)||d.to||'—'}`;
    case 'deal_snapshot': {
      const parts=[]; if(d.stage)parts.push(`Etapa: ${dealStageLabel(d.stage)||d.stage}`); if(d.offered_price!=null)parts.push(`Oferta: ${historyMoney(d.offered_price)}`); if(d.agreed_price!=null)parts.push(`Fechado: ${historyMoney(d.agreed_price)}`); return parts.join(' • ')||event.description||'';
    }
    case 'asking_price_updated': return `${historyMoney(d.from)} → ${historyMoney(d.to)}`;
    case 'offer_updated': return `${historyMoney(d.from)} → ${historyMoney(d.to)}`;
    case 'agreed_price_updated': return `${historyMoney(d.from)} → ${historyMoney(d.to)}`;
    case 'commission_updated': return d.amount!=null?`Comissão calculada: ${historyMoney(d.amount)}`:(event.description||'');
    case 'deal_created': return d.asking_price!=null?`Preço pedido inicial: ${historyMoney(d.asking_price)}`:(event.description||'');
    default: return event.description||'';
  }
}
async function renderLeadHistory(leadId){
  const box=$('#leadHistory'); if(!box)return;
  box.innerHTML='<div class="history-loading">Carregando histórico...</div>';
  const {data,error}=await sb.from('client_history').select('id,event_type,title,description,details,created_at').eq('lead_id',leadId).order('created_at',{ascending:false}).limit(100);
  if(error){ box.innerHTML='<div class="notice error">Não foi possível carregar o histórico.</div>'; return; }
  const items=data||[];
  box.innerHTML=items.length?items.map(ev=>{
    const [icon,fallback,cls]=historyEventPresentation(ev.event_type);
    const detail=historyDetail(ev);
    return `<article class="history-item ${cls}">
      <div class="history-marker">${icon}</div>
      <div class="history-content"><div class="history-top"><strong>${esc(ev.title||fallback)}</strong><time>${esc(formatDateTime(ev.created_at))}</time></div>${detail?`<p>${esc(detail)}</p>`:''}</div>
    </article>`;
  }).join(''):'<div class="history-empty">Nenhum evento registrado ainda.</div>';
}

function closeLeadEditor(){
  $('#leadEditor')?.classList.add('hidden');
  document.body.classList.remove('modal-open');
  currentLeadId=null; currentLeadPhone=''; currentLeadDealId=null;
}
async function openLeadEditor(id){
  const {data:lead,error}=await sb.from('leads').select('*').eq('id',id).single();
  if(error||!lead) return alert('Não foi possível abrir este cliente.');
  currentLeadId=id; currentLeadPhone=lead.phone||'';
  let listing=null;
  if(lead.listing_id){
    const r=await sb.from('listings').select('id,title,price,vehicle_type,city,state').eq('id',lead.listing_id).maybeSingle();
    listing=r.data||null;
  }
  let deal=null;
  let r=await sb.from('deals').select('*').eq('buyer_lead_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle();
  deal=r.data||null;
  if(!deal){
    r=await sb.from('deals').select('*').eq('seller_lead_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle();
    deal=r.data||null;
  }
  currentLeadDealId=deal?.id||null;
  $('#leadEditorName').textContent=lead.name||'Cliente';
  $('#leadEditorType').textContent=leadTypeLabel(lead.lead_type);
  $('#leadEditorMeta').innerHTML=`
    <div><span>WhatsApp</span><strong>${esc(lead.phone||'—')}</strong></div>
    <div><span>E-mail</span><strong>${esc(lead.email||'—')}</strong></div>
    <div><span>Cidade</span><strong>${esc([lead.city,lead.state].filter(Boolean).join(' - ')||'—')}</strong></div>
    <div><span>Interesse</span><strong>${esc(lead.vehicle_type||lead.interest||listing?.vehicle_type||'—')}</strong></div>
    <div><span>Orçamento</span><strong>${lead.budget?money(lead.budget):'—'}</strong></div>
    <div><span>Prazo</span><strong>${esc(lead.timeline||'—')}</strong></div>
    <div><span>Último contato</span><strong>${esc(formatDateTime(lead.last_contact_at))}</strong></div>
    <div><span>Próximo retorno</span><strong>${esc(formatDateTime(lead.next_follow_up_at))}</strong></div>`;
  $('#leadListingInfo').innerHTML=listing
    ? `<strong>${esc(listing.title)}</strong><span>${money(listing.price)}${listing.city?' • '+esc(listing.city):''}${listing.state?' - '+esc(listing.state):''}</span>`
    : '<span class="muted">Sem anúncio vinculado.</span>';
  $('#leadMessageText').textContent=lead.message||'Nenhuma mensagem enviada.';
  const form=$('#leadAdminForm');
  form.elements.id.value=lead.id;
  form.elements.status.value=lead.status||'novo';
  form.elements.next_follow_up_at.value=localDateTimeValue(lead.next_follow_up_at);
  form.elements.admin_notes.value=lead.admin_notes||'';
  $('#leadWhatsBtn').onclick=()=>openWhatsApp(lead.phone,lead.name);
  renderLeadDeal(deal,lead,listing);
  $('#leadEditor').classList.remove('hidden'); document.body.classList.add('modal-open');
  renderLeadHistory(id);
}
function renderLeadDeal(deal,lead,listing){
  const box=$('#leadDealArea');
  if(!box)return;
  const canCreate=['compra','interesse_anuncio','venda'].includes(lead.lead_type);
  if(!deal){
    box.innerHTML=canCreate?`
      <div class="deal-empty">
        <strong>Ainda não há negociação criada.</strong>
        <p class="muted">Crie uma negociação para acompanhar proposta, preço e comissão.</p>
        <button class="btn" type="button" onclick="createDealFromLead()">CRIAR NEGOCIAÇÃO</button>
      </div>`:`<div class="notice">Este tipo de lead é acompanhado pelo status e pelas observações.</div>`;
    return;
  }
  box.innerHTML=`
    <form id="dealAdminForm" onsubmit="saveDeal(this);return false">
      <input type="hidden" name="id" value="${esc(deal.id)}">
      <div class="form-grid">
        <div><label>Etapa</label><select class="field" name="stage">
          ${['lead','qualificado','proposta','vistoria','documentacao','fechado','cancelado'].map(v=>`<option value="${v}" ${deal.stage===v?'selected':''}>${dealStageLabel(v)}</option>`).join('')}
        </select></div>
        <div><label>Preço pedido</label><input class="field" type="number" step="0.01" min="0" name="asking_price" value="${deal.asking_price??listing?.price??''}"></div>
        <div><label>Oferta</label><input class="field" type="number" step="0.01" min="0" name="offered_price" value="${deal.offered_price??''}"></div>
        <div><label>Preço fechado</label><input class="field" type="number" step="0.01" min="0" name="agreed_price" value="${deal.agreed_price??''}"></div>
        <div><label>Comissão</label><select class="field" name="commission_type">
          <option value="">Não definida</option>
          <option value="percent" ${deal.commission_type==='percent'?'selected':''}>Percentual (%)</option>
          <option value="fixed" ${deal.commission_type==='fixed'?'selected':''}>Valor fixo (R$)</option>
        </select></div>
        <div><label>Valor / % da comissão</label><input class="field" type="number" step="0.01" min="0" name="commission_value" value="${deal.commission_value??''}"></div>
        <div class="full"><label>Observações da negociação</label><textarea class="field" name="notes">${esc(deal.notes||'')}</textarea></div>
        <div class="full deal-total"><span>Comissão calculada</span><strong>${deal.commission_amount?money(deal.commission_amount):'—'}</strong></div>
        <div class="full"><button class="btn" type="submit">SALVAR NEGOCIAÇÃO</button></div>
      </div>
    </form>`;
}
async function saveLeadAdmin(form){
  const d=Object.fromEntries(new FormData(form).entries());
  const nextFollow=d.next_follow_up_at?new Date(d.next_follow_up_at).toISOString():null;
  const {error}=await sb.from('leads').update({
    status:d.status,admin_notes:d.admin_notes.trim()||null,next_follow_up_at:nextFollow,updated_at:new Date().toISOString()
  }).eq('id',d.id);
  if(error)return alert('Não foi possível salvar os dados do cliente.');
  await openLeadEditor(d.id);
  await loadAdmin();
  alert('Cliente atualizado.');
}
async function createDealFromLead(){
  if(!currentLeadId)return;
  const {data:lead,error}=await sb.from('leads').select('*').eq('id',currentLeadId).single();
  if(error||!lead)return alert('Não foi possível carregar o cliente.');
  let listing=null;
  if(lead.listing_id){
    const r=await sb.from('listings').select('id,price').eq('id',lead.listing_id).maybeSingle();
    listing=r.data||null;
  }
  const payload={
    listing_id:lead.listing_id||null,
    buyer_lead_id:['compra','interesse_anuncio'].includes(lead.lead_type)?lead.id:null,
    seller_lead_id:lead.lead_type==='venda'?lead.id:null,
    stage:'lead',
    asking_price:listing?.price||null,
    notes:lead.admin_notes||null,
    updated_at:new Date().toISOString()
  };
  const {error:insErr}=await sb.from('deals').insert(payload);
  if(insErr)return alert('Não foi possível criar a negociação.');
  await openLeadEditor(currentLeadId);
  await loadAdmin();
}
async function saveDeal(form){
  const d=Object.fromEntries(new FormData(form).entries());
  const asking=d.asking_price?Number(d.asking_price):null;
  const offered=d.offered_price?Number(d.offered_price):null;
  const agreed=d.agreed_price?Number(d.agreed_price):null;
  const ctype=d.commission_type||null;
  const cvalue=d.commission_value?Number(d.commission_value):null;
  let amount=null;
  if(ctype==='fixed'&&cvalue!=null) amount=cvalue;
  if(ctype==='percent'&&cvalue!=null){
    const base=agreed??offered??asking;
    if(base!=null) amount=base*cvalue/100;
  }
  const {error}=await sb.from('deals').update({
    stage:d.stage,asking_price:asking,offered_price:offered,agreed_price:agreed,
    commission_type:ctype,commission_value:cvalue,commission_amount:amount,
    notes:d.notes.trim()||null,updated_at:new Date().toISOString()
  }).eq('id',d.id);
  if(error)return alert('Não foi possível salvar a negociação.');
  if(currentLeadId) await openLeadEditor(currentLeadId);
  await loadAdmin();
  alert('Negociação atualizada.');
}

async function loadAdmin(){
  const goalMonth=monthStartKey();
  const [lr,lisr,dr,gr]=await Promise.all([
    sb.from('leads').select('*').order('created_at',{ascending:false}),
    sb.from('listings').select('*').order('created_at',{ascending:false}),
    sb.from('deals').select('*').order('created_at',{ascending:false}),
    sb.from('commercial_goals').select('*').eq('month_start',goalMonth).maybeSingle()
  ]);
  if(lr.error||lisr.error||dr.error||gr.error){ $('#adminError').textContent='Não foi possível carregar o painel.'; $('#adminError').classList.remove('hidden'); return; }
  const leads=lr.data||[], listings=lisr.data||[], deals=dr.data||[], monthlyGoal=gr.data||null;
  $('#sLeads').textContent=leads.length;
  $('#sBuy').textContent=leads.filter(x=>['compra','interesse_anuncio'].includes(x.lead_type)).length;
  $('#sSell').textContent=leads.filter(x=>x.lead_type==='venda').length;
  $('#sService').textContent=leads.filter(x=>['fabricacao','servico'].includes(x.lead_type)).length;
  $('#sDeals').textContent=deals.length;
  $('#pendingListings').innerHTML=listings.filter(x=>x.status==='pending').map(x=>`
    <div class="pending-card"><strong>${esc(x.title)}</strong> — ${esc(x.city||'')} — ${money(x.price)}
      <div class="btn-row"><button class="btn" onclick="approveListing('${x.id}')">Aprovar</button><button class="btn red" onclick="rejectListing('${x.id}')">Rejeitar</button><button class="btn ghost" onclick="openListingEditor('${x.id}')">Editar antes</button></div>
    </div>`).join('') || '<div class="muted">Nenhum anúncio aguardando aprovação.</div>';

  $('#manageListings').innerHTML=listings.map(x=>`
    <article class="admin-listing-card">
      <div class="admin-listing-photo">${x.image_url?`<img src="${esc(x.image_url)}" alt="${esc(x.title)}">`:`<span>${esc((x.vehicle_type||'Anúncio').toUpperCase())}</span>`}</div>
      <div class="admin-listing-info">
        <div class="admin-listing-head"><span class="${listingStatusClass(x.status)}">${listingStatusLabel(x.status)}</span><small>${esc(x.vehicle_type)}</small></div>
        <strong>${esc(x.title)}</strong>
        <div class="muted">${x.year||''}${x.year&&x.city?' • ':''}${esc(x.city||'')}${x.state?' - '+esc(x.state):''}</div>
        <div class="admin-price">${money(x.price)}</div>
        <div class="admin-actions">
          <button class="btn small" onclick="openListingEditor('${x.id}')">Editar</button>
          <button class="btn ghost small" onclick="openListingEditor('${x.id}',true)">Trocar foto</button>
          ${x.status==='active'?`<button class="btn ghost small" onclick="pauseListing('${x.id}')">Pausar</button>`:`<button class="btn ghost small" onclick="activateListing('${x.id}')">Ativar</button>`}
          ${x.status!=='sold'?`<button class="btn ghost small" onclick="markListingSold('${x.id}')">Vendido</button>`:''}
          <button class="btn red small" onclick="deleteListing('${x.id}')">Excluir</button>
        </div>
      </div>
    </article>`).join('') || '<div class="muted">Nenhum anúncio cadastrado.</div>';

  const listingMap=new Map(listings.map(x=>[x.id,x]));
  const leadMap=new Map(leads.map(x=>[x.id,x]));
  const dealByLead=new Map();
  deals.forEach(d=>{ if(d.buyer_lead_id)dealByLead.set(d.buyer_lead_id,d); if(d.seller_lead_id)dealByLead.set(d.seller_lead_id,d); });
  renderCommercialResults(deals,leads,listingMap);
  renderMonthlyGoals(deals,monthlyGoal);
  renderPriorityCenter(leads,deals,listingMap,dealByLead);
  renderSalesFunnel(leads,deals);
  renderFollowUps(leads);
  let visibleLeads=leadFilter==='all'?leads:leads.filter(x=>x.status===leadFilter);
  if(followUpFilter!=='all') visibleLeads=visibleLeads.filter(x=>followUpState(x)===followUpFilter);

  $('#leadCards').innerHTML=visibleLeads.map(x=>{
    const listing=listingMap.get(x.listing_id);
    const deal=dealByLead.get(x.id);
    return `<article class="lead-card">
      <div class="lead-card-top">
        <div><span class="lead-kind">${leadTypeLabel(x.lead_type)}</span><h4>${esc(x.name)}</h4></div>
        <span class="lead-status lead-${esc(x.status)}">${leadStatusLabel(x.status)}</span>
      </div>
      <div class="lead-quick">
        <span>📱 ${esc(x.phone)}</span>
        <span>📍 ${esc([x.city,x.state].filter(Boolean).join(' - ')||'Não informado')}</span>
        <span>🎯 ${esc(x.vehicle_type||x.interest||listing?.title||'Sem interesse informado')}</span>
      </div>
      ${x.next_follow_up_at && !['fechado','perdido'].includes(x.status)?`<div class="follow-mini follow-${followUpState(x)}">${esc(followUpLabel(x))}</div>`:''}
      ${deal?`<div class="deal-mini">Negociação: <strong>${dealStageLabel(deal.stage)}</strong>${deal.agreed_price?' • '+money(deal.agreed_price):''}</div>`:''}
      <div class="btn-row">
        <button class="btn small" onclick="openLeadEditor('${x.id}')">Abrir cliente</button>
        <button class="btn whatsapp small" onclick="openWhatsApp('${esc(x.phone)}','${encodeURIComponent(x.name)}')">WhatsApp</button>
      </div>
    </article>`}).join('') || `<div class="panel muted">${followUpFilter!=='all'?'Nenhum cliente neste filtro de retorno.':leadFilter==='all'?'Nenhum cliente/lead ainda.':'Nenhum cliente nesta etapa do funil.'}</div>`;

  $('#dealCards').innerHTML=deals.map(x=>{
    const buyer=leadMap.get(x.buyer_lead_id), seller=leadMap.get(x.seller_lead_id), listing=listingMap.get(x.listing_id);
    const lead=buyer||seller;
    return `<article class="deal-card">
      <div class="deal-card-head"><span class="badge">${dealStageLabel(x.stage)}</span><strong>${esc(listing?.title||'Negociação')}</strong></div>
      <div class="deal-card-grid">
        <div><span>Cliente</span><strong>${esc(lead?.name||'—')}</strong></div>
        <div><span>Preço pedido</span><strong>${x.asking_price?money(x.asking_price):'—'}</strong></div>
        <div><span>Oferta</span><strong>${x.offered_price?money(x.offered_price):'—'}</strong></div>
        <div><span>Fechado</span><strong>${x.agreed_price?money(x.agreed_price):'—'}</strong></div>
        <div><span>Comissão</span><strong>${x.commission_amount?money(x.commission_amount):'—'}</strong></div>
      </div>
      ${lead?`<button class="btn ghost small" onclick="openLeadEditor('${lead.id}')">Abrir negociação</button>`:''}
    </article>`}).join('') || '<div class="panel muted">Nenhuma negociação ainda.</div>';
}
async function approveListing(id){ await setListingStatus(id,'active'); }
async function rejectListing(id){ if(confirm('Rejeitar este anúncio?')) await setListingStatus(id,'rejected'); }
async function updateLeadStatus(id,status){ const {error}=await sb.from('leads').update({status}).eq('id',id); if(error)alert('Não foi possível atualizar o status.'); }
async function exportData(){
  const [l,a,d,h,g]=await Promise.all([sb.from('leads').select('*'),sb.from('listings').select('*'),sb.from('deals').select('*'),sb.from('client_history').select('*').order('created_at',{ascending:false}),sb.from('commercial_goals').select('*').order('month_start',{ascending:false})]);
  const blob=new Blob([JSON.stringify({leads:l.data||[],listings:a.data||[],deals:d.data||[],client_history:h.data||[],commercial_goals:g.data||[]},null,2)],{type:'application/json'});
  const el=document.createElement('a'); el.href=URL.createObjectURL(blob); el.download='nomad-horse-market-backup.json'; el.click(); URL.revokeObjectURL(el.href);
}

$$('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$('.menu-toggle')?.addEventListener('click',()=>{ const nav=$('.nav'); const open=nav.classList.toggle('open'); $('.menu-toggle').setAttribute('aria-expanded',open?'true':'false'); });
$('#filterType')?.addEventListener('change',renderListings); $('#filterCity')?.addEventListener('input',renderListings); $('#filterPrice')?.addEventListener('input',renderListings);
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredPrompt=e; if(currentView==='home'&&localStorage.getItem('nhm_install_dismissed')!=='1')$('#installPrompt')?.classList.remove('hidden'); });
$('#installBtn')?.addEventListener('click',async()=>{ if(!deferredPrompt)return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $('#installPrompt')?.classList.add('hidden'); });
$('#installClose')?.addEventListener('click',()=>{ localStorage.setItem('nhm_install_dismissed','1'); $('#installPrompt')?.classList.add('hidden'); });
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
renderListings();
