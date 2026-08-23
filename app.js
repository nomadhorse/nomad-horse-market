const SUPABASE_URL = 'https://ndbekzgxdfuhjlocipiv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_H0DQ1mF0BW8bTysshtTJuw_Ulglk1_Z';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => [...el.querySelectorAll(q)];
let currentView='home';
let currentInterestListingId=null;
let deferredPrompt=null;

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

async function loadAdmin(){
  const [lr,lisr,dr]=await Promise.all([
    sb.from('leads').select('*').order('created_at',{ascending:false}),
    sb.from('listings').select('*').order('created_at',{ascending:false}),
    sb.from('deals').select('*').order('created_at',{ascending:false})
  ]);
  if(lr.error||lisr.error||dr.error){ $('#adminError').textContent='Não foi possível carregar o painel.'; $('#adminError').classList.remove('hidden'); return; }
  const leads=lr.data||[], listings=lisr.data||[], deals=dr.data||[];
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

  $('#adminRows').innerHTML=leads.map(x=>`
    <tr><td>${new Date(x.created_at).toLocaleString('pt-BR')}</td><td>${esc(x.lead_type)}</td><td>${esc(x.name)}</td><td>${esc(x.phone)}</td>
    <td>${esc(x.vehicle_type||x.interest||'')}</td><td>${esc(x.city||'')}</td><td><select class="status" onchange="updateLeadStatus('${x.id}',this.value)">
    ${['novo','contato_feito','negociacao','proposta_enviada','fechado','perdido'].map(s=>`<option value="${s}" ${x.status===s?'selected':''}>${s.replaceAll('_',' ')}</option>`).join('')}
    </select></td></tr>`).join('') || '<tr><td colspan="7">Nenhum lead ainda.</td></tr>';
  $('#dealRows').innerHTML=deals.map(x=>`
    <tr><td>${new Date(x.created_at).toLocaleString('pt-BR')}</td><td>${esc(x.stage)}</td><td>${money(x.asking_price)}</td><td>${money(x.offered_price)}</td><td>${money(x.agreed_price)}</td><td>${money(x.commission_amount)}</td></tr>`).join('') || '<tr><td colspan="6">Nenhuma negociação ainda.</td></tr>';
}
async function approveListing(id){ await setListingStatus(id,'active'); }
async function rejectListing(id){ if(confirm('Rejeitar este anúncio?')) await setListingStatus(id,'rejected'); }
async function updateLeadStatus(id,status){ const {error}=await sb.from('leads').update({status}).eq('id',id); if(error)alert('Não foi possível atualizar o status.'); }
async function exportData(){
  const [l,a,d]=await Promise.all([sb.from('leads').select('*'),sb.from('listings').select('*'),sb.from('deals').select('*')]);
  const blob=new Blob([JSON.stringify({leads:l.data||[],listings:a.data||[],deals:d.data||[]},null,2)],{type:'application/json'});
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
