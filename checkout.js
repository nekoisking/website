const CART_KEY='concrete-hoops-cart-v1';
const FALLBACK_PRODUCTS={
  'tee-01':{name:'Blacktop Heavy Tee',price:38,art:'assets/tee-black.svg'},
  'short-01':{name:'Baseline Mesh Short',price:46,art:'assets/shorts.svg'},
  'hoodie-01':{name:'After Hours Hoodie',price:72,art:'assets/hoodie.svg'},
  'cap-01':{name:'CH Five Panel',price:32,art:'assets/cap.svg'}
};
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value)||0);
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let cart=[];try{cart=JSON.parse(localStorage.getItem(CART_KEY)||'[]');if(!Array.isArray(cart))cart=[]}catch{cart=[]}
const count=cart.reduce((sum,item)=>sum+(Number(item.qty)||0),0);
const subtotal=cart.reduce((sum,item)=>{const fallback=FALLBACK_PRODUCTS[item.id]||{};const price=Number.isFinite(Number(item.price))&&item.price!==undefined?Number(item.price):Number(fallback.price)||0;return sum+price*(Number(item.qty)||0)},0);
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelector('#year').textContent=new Date().getFullYear();
  document.querySelector('#summary-count').textContent=String(count).padStart(2,'0');
  document.querySelector('#summary-subtotal').textContent=money(subtotal);
  document.querySelector('#summary-total').textContent=money(subtotal);
  const list=document.querySelector('#summary-items');
  list.innerHTML=count?cart.map(item=>{
    const fallback=FALLBACK_PRODUCTS[item.id]||{};const name=item.name||fallback.name||'Concrete Hoops item';const art=item.art||fallback.art||'assets/tee-black.svg';
    const price=Number.isFinite(Number(item.price))&&item.price!==undefined?Number(item.price):Number(fallback.price)||0;
    return `<div class="summary-item"><div class="summary-item-art"><img src="${escapeHTML(art)}" alt=""></div><div><div class="summary-item-name">${escapeHTML(name)}</div><div class="summary-item-meta">${escapeHTML(item.size||'OPTION')} / QTY ${Number(item.qty)||0}</div></div><div class="summary-item-price">${money(price*(Number(item.qty)||0))}</div></div>`;
  }).join(''):'<div class="summary-empty">YOUR BAG IS EMPTY.<br><a href="index.html#shop" style="color:var(--lime)">GO FIND YOUR GEAR ↗</a></div>';
  const form=document.querySelector('#checkout-form');
  form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const feedback=document.querySelector('#checkout-feedback');feedback.textContent='ORDER PREVIEW COMPLETE. NO PAYMENT WAS TAKEN AND NO PRINTIFY ORDER WAS PLACED. CONNECT A SECURE PAYMENT PROVIDER AND PAYMENT-SUCCESS SERVER WEBHOOK BEFORE ACCEPTING ORDERS.';document.querySelector('#place-order').textContent='DEMO PREVIEW COMPLETE';});
});
