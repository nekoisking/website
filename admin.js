let adminKey='';
const $=selector=>document.querySelector(selector);
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function setStatus(message,type=''){const element=$('#connection-status');element.textContent=message;element.className=`admin-feedback ${type}`;}
async function adminFetch(url,options={}){
  const response=await fetch(url,{...options,headers:{'Accept':'application/json','X-Admin-Key':adminKey,...(options.headers||{})}});
  const data=await response.json().catch(()=>({error:'The server returned an unreadable response.'}));
  if(!response.ok)throw new Error(data.error||`Request failed (${response.status}).`);
  return data;
}
async function connect(){
  adminKey=$('#admin-key').value.trim();
  if(!adminKey){setStatus('ENTER YOUR ADMIN_KEY FROM THE SERVER ENVIRONMENT SETTINGS.','error');return;}
  $('#connect-button').disabled=true;setStatus('CHECKING THE PRINTIFY CONNECTION…');
  try{
    const data=await adminFetch('/api/admin/printify/shops');
    const holder=$('#shop-details');
    if(!data.shops.length){holder.innerHTML='<div class="shop-empty">NO SHOPS WERE FOUND. CREATE AN API STORE IN PRINTIFY, THEN CHECK AGAIN.</div>';}
    else{
      holder.innerHTML=data.shops.map(shop=>`<article class="shop-card"><strong>${escapeHTML(shop.title)}</strong><span>SHOP ID: ${escapeHTML(shop.id)}</span><span>SALES CHANNEL: ${escapeHTML(shop.salesChannel)}</span>${data.selectedShopId===shop.id?'<span style="color:var(--lime)">SELECTED BY SERVER</span>':''}</article>`).join('');
    }
    $('#sync-button').disabled=false;
    setStatus(`ADMIN VERIFIED / PRINTIFY REPLIED WITH ${data.shops.length} SHOP${data.shops.length===1?'':'S'}.`,'connected');
  }catch(error){$('#sync-button').disabled=true;setStatus(error.message,'error');}
  finally{$('#connect-button').disabled=false;}
}
async function syncProducts(){
  $('#sync-button').disabled=true;$('#sync-results').classList.add('visible');$('#sync-results').textContent='SYNCING YOUR PRINTIFY PRODUCTS…';
  try{
    const data=await adminFetch('/api/admin/printify/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
    const errors=Array.isArray(data.publishErrors)?data.publishErrors:[];
    $('#sync-results').innerHTML=`<strong>SYNC COMPLETE.</strong><br>SHOP: ${escapeHTML(data.shop.title)}<br>VISIBLE IN PRINTIFY: ${Number(data.visibleProducts)||0}<br>PRODUCTS READY FOR THE CONCRETE HOOPS SHOP: ${Number(data.storefrontProducts)||0}<br>PRINTIFY PUBLISH CONFIRMATIONS SENT: ${Number(data.confirmedPublished)||0}${errors.length?`<br><br>ITEMS NEEDING ATTENTION: ${errors.map(item=>`${escapeHTML(item.product)} — ${escapeHTML(item.message)}`).join('<br>')}`:''}<br><br>Refresh the public storefront to see the latest products.`;
    setStatus('PRINTIFY IS CONNECTED / YOUR STOREFRONT PRODUCT FEED HAS BEEN REFRESHED.','connected');
  }catch(error){$('#sync-results').textContent=error.message;setStatus(error.message,'error');}
  finally{$('#sync-button').disabled=false;}
}
document.addEventListener('DOMContentLoaded',()=>{
  $('#connect-button').addEventListener('click',connect);
  $('#sync-button').addEventListener('click',syncProducts);
  $('#admin-key').addEventListener('keydown',event=>{if(event.key==='Enter')connect()});
});
