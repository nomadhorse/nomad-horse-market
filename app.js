
const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => [...el.querySelectorAll(q)];

const DB = {
  leads: JSON.parse(localStorage.getItem('nhm_leads') || '[]'),
  listings: JSON.parse(localStorage.getItem('nhm_listings') || '[]'),
  save(){
    localStorage.setItem('nhm_leads', JSON.stringify(this.leads));
    localStorage.setItem('nhm_listings', JSON.stringify(this.listings));
  }
};

const seedListings = [
  {id:'demo1',type:'Trailer',title:'Trailer para cavalos personalizado',price:85000,city:'Palhoça - SC',year:2026,tag:'Nomad Horse • Novo',status:'Ativo'},
  {id:'demo2',type:'Kombi Home',title:'Projeto Kombi Home sob medida',price:0,city:'Palhoça - SC',year:2026,tag:'Projeto personalizado',status:'Ativo'},
  {id:'demo3',type:'Motorhome',title:'Motorhome personalizado',price:0,city:'Santa Catarina',year:2026,tag:'Sob encomenda',status:'Ativo'},
];
if(!DB.listings.length){ DB.listings = seedListings; DB.save(); }

let currentView='home';

function showView(name){
  currentView=name;
  $$('.view').forEach(v => v.classList.add('hidden'));
  const el = $('#view-'+name);
  if(el) el.classList.remove('hidden');
  $$('.nav button').forEach(b => b.classList.toggle('active', b.dataset.view===name));
  window.scrollTo({top:0,behavior:'smooth'});
  if(name==='market') renderListings();
  if(name==='admin') renderAdmin();
}

function lead(kind, data){
  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    kind,
    createdAt:new Date().toISOString(),
    status:'Novo',
    ...data
  };
  DB.leads.unshift(item); DB.save();
  return item;
}

function money(v){
  const n=Number(v||0);
  return n ? n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : 'Sob consulta';
}

function renderListings(){
  const type = $('#filterType')?.value || '';
  const city = ($('#filterCity')?.value || '').toLowerCase();
  const max = Number($('#filterPrice')?.value || 0);
  let rows=DB.listings.filter(x => x.status!=='Oculto');
  if(type) rows=rows.filter(x => x.type===type);
  if(city) rows=rows.filter(x => (x.city||'').toLowerCase().includes(city));
  if(max) rows=rows.filter(x => !x.price || Number(x.price)<=max);
  const wrap=$('#listingGrid'); if(!wrap) return;
  wrap.innerHTML = rows.map(x => `
    <article class="listing">
      <div class="listing-photo">${x.type.toUpperCase()}</div>
      <div class="listing-body">
        <span class="badge">${x.tag||x.type}</span>
        <h3>${x.title}</h3>
        <div class="muted">${x.year||''} • ${x.city||''}</div>
        <div class="price">${money(x.price)}</div>
        <div class="btn-row">
          <button class="btn" onclick="interest('${x.id}')">Tenho interesse</button>
          <button class="btn ghost" onclick="shareListing('${x.id}')">Compartilhar</button>
        </div>
      </div>
    </article>`).join('') || '<div class="notice">Nenhum anúncio encontrado com esses filtros.</div>';
}

function interest(id){
  const x=DB.listings.find(a=>a.id===id); if(!x) return;
  showView('buy');
  $('#buyInterest').value = x.title;
  $('#buyType').value = x.type;
  $('#buyMessage').value = `Tenho interesse no anúncio: ${x.title}.`;
}

function shareListing(id){
  const x=DB.listings.find(a=>a.id===id); if(!x) return;
  const text=`Nomad Horse Market — ${x.title} — ${money(x.price)} — ${x.city}`;
  if(navigator.share) navigator.share({title:'Nomad Horse Market',text});
  else navigator.clipboard?.writeText(text).then(()=>alert('Texto do anúncio copiado.'));
}

function submitLead(form, kind){
  const data=Object.fromEntries(new FormData(form).entries());
  lead(kind,data);
  form.reset();
  const box=form.querySelector('.form-result');
  box.classList.remove('hidden');
  box.textContent='Recebemos seus dados. A Nomad Horse vai analisar e entrar em contato.';
  setTimeout(()=>box.classList.add('hidden'),7000);
  return false;
}

function submitSeller(form){
  const data=Object.fromEntries(new FormData(form).entries());
  const l=lead('Venda',data);
  DB.listings.unshift({
    id:'listing-'+l.id,
    type:data.type,
    title:data.title || `${data.type} para venda`,
    price:Number(data.price||0),
    city:data.city||'',
    year:data.year||'',
    tag:'Aguardando aprovação',
    status:'Oculto',
    ownerLeadId:l.id
  });
  DB.save();
  form.reset();
  const box=form.querySelector('.form-result');
  box.classList.remove('hidden');
  box.textContent='Cadastro recebido. O anúncio fica aguardando aprovação da Nomad Horse.';
  return false;
}

function renderAdmin(){
  const leads=DB.leads;
  const listings=DB.listings;
  $('#sLeads').textContent=leads.length;
  $('#sBuy').textContent=leads.filter(x=>x.kind==='Compra').length;
  $('#sSell').textContent=leads.filter(x=>x.kind==='Venda').length;
  $('#sService').textContent=leads.filter(x=>['Serviço','Fabricação'].includes(x.kind)).length;

  const tbody=$('#adminRows');
  tbody.innerHTML=leads.map(x=>`
    <tr>
      <td>${new Date(x.createdAt).toLocaleString('pt-BR')}</td>
      <td>${x.kind}</td>
      <td>${x.name||''}</td>
      <td>${x.phone||''}</td>
      <td>${x.type||x.interest||''}</td>
      <td>${x.city||''}</td>
      <td>
        <select class="status" onchange="updateStatus('${x.id}',this.value)">
          ${['Novo','Contato feito','Negociação','Proposta enviada','Fechado','Perdido'].map(s=>`<option ${x.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
    </tr>`).join('') || '<tr><td colspan="7">Nenhum lead ainda.</td></tr>';

  const pending=$('#pendingListings');
  pending.innerHTML=listings.filter(x=>x.status==='Oculto').map(x=>`
    <div class="notice" style="margin-bottom:10px">
      <strong>${x.title}</strong> — ${x.city} — ${money(x.price)}
      <div class="btn-row">
        <button class="btn" onclick="approveListing('${x.id}')">Aprovar</button>
        <button class="btn ghost" onclick="removeListing('${x.id}')">Excluir</button>
      </div>
    </div>`).join('') || '<div class="muted">Nenhum anúncio aguardando aprovação.</div>';
}

function updateStatus(id,status){
  const x=DB.leads.find(a=>a.id===id); if(x){x.status=status;DB.save();}
}
function approveListing(id){
  const x=DB.listings.find(a=>a.id===id);
  if(x){x.status='Ativo';x.tag='Anúncio aprovado';DB.save();renderAdmin();}
}
function removeListing(id){
  DB.listings=DB.listings.filter(a=>a.id!==id);DB.save();renderAdmin();
}
function exportData(){
  const blob=new Blob([JSON.stringify({leads:DB.leads,listings:DB.listings},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='nomad-horse-market-backup.json';a.click();URL.revokeObjectURL(a.href);
}
function resetDemo(){
  if(confirm('Apagar todos os leads deste aparelho e restaurar anúncios de demonstração?')){
    DB.leads=[];DB.listings=[...seedListings];DB.save();renderAdmin();
  }
}

$$('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$('#filterType')?.addEventListener('change',renderListings);
$('#filterCity')?.addEventListener('input',renderListings);
$('#filterPrice')?.addEventListener('input',renderListings);

let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault(); deferredPrompt=e;
  $('#installPrompt')?.classList.remove('hidden');
});
$('#installBtn')?.addEventListener('click',async()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice;
  deferredPrompt=null; $('#installPrompt')?.classList.add('hidden');
});
$('#installClose')?.addEventListener('click',()=>$('#installPrompt')?.classList.add('hidden'));

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
renderListings();
