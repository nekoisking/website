const STARTER_PRODUCTS = [
  {id:'tee-01',name:'Blacktop Heavy Tee',category:'HEAVYWEIGHT COTTON / 001',price:38,tag:'FIRST RUN',art:'assets/tee-black.svg',tone:'',sizes:['S','M','L','XL','XXL']},
  {id:'short-01',name:'Baseline Mesh Short',category:'COURT MESH / 002',price:46,tag:'COURT TESTED',art:'assets/shorts.svg',tone:'orange',sizes:['S','M','L','XL','XXL']},
  {id:'hoodie-01',name:'After Hours Hoodie',category:'MIDWEIGHT FLEECE / 003',price:72,tag:'LIMITED RUN',art:'assets/hoodie.svg',tone:'dark',sizes:['S','M','L','XL','XXL']},
  {id:'cap-01',name:'CH Five Panel',category:'EVERYDAY HEADWEAR / 004',price:32,tag:'NEW',art:'assets/cap.svg',tone:'lime',sizes:['S/M','L/XL']}
];
let PRODUCTS = [...STARTER_PRODUCTS];
const CART_KEY='concrete-hoops-cart-v1';
let cart=readCart();
const $=(selector,root=document)=>root.querySelector(selector);
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value)||0);
const escapeHTML=value=>String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function readCart(){try{const value=JSON.parse(localStorage.getItem(CART_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return []}}
function saveCart(){localStorage.setItem(CART_KEY,JSON.stringify(cart));renderCart()}
function productById(id){return PRODUCTS.find(product=>product.id===id)||STARTER_PRODUCTS.find(product=>product.id===id)}
function variantById(product,id){return product?.variants?.find(variant=>String(variant.id)===String(id))}
function displayPrice(product){return product?.variants?.length?Math.min(...product.variants.map(variant=>Number(variant.price)||0)):Number(product?.price)||0}
function linePrice(item){if(Number.isFinite(Number(item.price))&&item.price!==undefined)return Number(item.price);const product=productById(item.id);return variantById(product,item.variantId)?.price??product?.price??0}

async function loadStorefrontProducts(){
  const status=$('#printify-status');
  try{
    const response=await fetch('/api/storefront/products',{headers:{'Accept':'application/json'}});
    const data=await response.json();
    if(response.ok&&data.configured){
      PRODUCTS=(Array.isArray(data.products)?data.products:[]).map(product=>({...product,tone:'',sizes:Array.isArray(product.sizes)?product.sizes:[]}));
      if(status)status.textContent=PRODUCTS.length?`PRINTIFY CONNECTED / ${PRODUCTS.length} AVAILABLE PRODUCTS — LIVE FROM YOUR SHOP`:'PRINTIFY CONNECTED / NO VISIBLE PRODUCTS YET — CREATE AND PUBLISH A PRODUCT IN PRINTIFY, THEN SYNC FROM /ADMIN.';
      return;
    }
    if(status)status.textContent='STARTER COLLECTION / CONNECT PRINTIFY FROM THE ADMIN PAGE TO SHOW YOUR OWN PRODUCTS.';
  }catch(error){
    if(status)status.textContent='SHOWING STARTER MOCKUPS / PRINTIFY COULD NOT BE REACHED. CHECK THE SERVER CONNECTION.';
  }
  PRODUCTS=[...STARTER_PRODUCTS];
}

function renderProducts(){
  const grid=$('#product-grid');if(!grid)return;
  if(!PRODUCTS.length){grid.innerHTML='<div class="store-empty">YOUR NEXT DROP STARTS HERE.<br>ADD AND PUBLISH PRODUCTS IN PRINTIFY, THEN RUN A SYNC FROM <a href="/admin.html">THE ADMIN PAGE ↗</a>.</div>';return;}
  grid.innerHTML=PRODUCTS.map((product,index)=>{
    const hasVariants=Array.isArray(product.variants)&&product.variants.length>0;
    const selectOptions=hasVariants
      ? product.variants.map(variant=>`<option value="${escapeHTML(variant.id)}">${escapeHTML(variant.name)} — ${money(variant.price)}</option>`).join('')
      : (product.sizes||['One size']).map(size=>`<option value="${escapeHTML(size)}">${escapeHTML(size)}</option>`).join('');
    const productId=escapeHTML(product.id);
    return `<article class="product-card reveal is-visible" id="product-${productId}">
      <div class="product-art ${escapeHTML(product.tone||'')}"><span class="product-index">CH / ${String(index+1).padStart(2,'0')}</span><span class="product-tag">${escapeHTML(product.tag||'THE DROP')}</span><img src="${escapeHTML(product.art||'assets/tee-black.svg')}" alt="${escapeHTML(product.name)}" loading="lazy"></div>
      <div class="product-info"><div><div class="product-name">${escapeHTML(product.name)}</div><div class="product-category">${escapeHTML(product.category||'CONCRETE HOOPS / NEW DROP')}</div></div><div class="product-price">${hasVariants?'FROM ':''}${money(displayPrice(product))}</div></div>
      <div class="product-buy-row"><label class="sr-only" for="size-${productId}">${hasVariants?'Select product option':'Select size'} for ${escapeHTML(product.name)}</label><select class="size-select" id="size-${productId}" data-product-option="${productId}" aria-label="${hasVariants?'Select variant':'Select size'} for ${escapeHTML(product.name)}">${selectOptions}</select><button class="add-button" data-add="${productId}">ADD TO BAG <span>＋</span></button></div>
    </article>`;
  }).join('');
}

function addToCart(id,selection){
  const product=productById(id);if(!product)return;
  const variant=variantById(product,selection);
  const size=variant?variant.name:selection;
  const price=variant?Number(variant.price):Number(product.price);
  const existing=cart.find(item=>item.id===id&&item.size===size&&String(item.variantId||'')===String(variant?.id||''));
  if(existing)existing.qty+=1;
  else cart.push({id,size,variantId:variant?.id||null,qty:1,name:product.name,price,art:product.art});
  saveCart();showToast(`${product.name} ADDED TO YOUR BAG`);
}
function changeQty(id,size,delta,variantId=''){const item=cart.find(entry=>entry.id===id&&entry.size===size&&String(entry.variantId||'')===String(variantId||''));if(!item)return;item.qty+=delta;if(item.qty<=0)cart=cart.filter(entry=>entry!==item);saveCart()}
function removeItem(id,size,variantId=''){cart=cart.filter(item=>!(item.id===id&&item.size===size&&String(item.variantId||'')===String(variantId||'')));saveCart()}
function cartCount(){return cart.reduce((sum,item)=>sum+(Number(item.qty)||0),0)}
function cartSubtotal(){return cart.reduce((sum,item)=>sum+linePrice(item)*(Number(item.qty)||0),0)}
function renderCart(){
  const count=cartCount();const countText=String(count).padStart(2,'0');
  if($('#bag-count'))$('#bag-count').textContent=countText;
  if($('#cart-head-count'))$('#cart-head-count').textContent=countText;
  if($('#cart-subtotal'))$('#cart-subtotal').textContent=money(cartSubtotal());
  const items=$('#cart-items');if(!items)return;
  const empty=count===0;$('#cart-empty').classList.toggle('visible',empty);$('#cart-footer').classList.toggle('hidden',empty);
  items.innerHTML=empty?'':cart.map(item=>{
    const product=productById(item.id);const name=product?.name||item.name||'Concrete Hoops item';const art=product?.art||item.art||'assets/tee-black.svg';
    return `<div class="cart-item"><div class="cart-thumb"><img src="${escapeHTML(art)}" alt=""></div><div><div class="cart-item-name">${escapeHTML(name)}</div><div class="cart-item-meta">OPTION ${escapeHTML(item.size||'')}</div><div class="cart-qty"><button data-qty="-1" data-id="${escapeHTML(item.id)}" data-size="${escapeHTML(item.size)}" data-variant="${escapeHTML(item.variantId||'')}" aria-label="Decrease quantity">−</button><span>${Number(item.qty)||0}</span><button data-qty="1" data-id="${escapeHTML(item.id)}" data-size="${escapeHTML(item.size)}" data-variant="${escapeHTML(item.variantId||'')}" aria-label="Increase quantity">＋</button></div></div><div><div class="cart-item-price">${money(linePrice(item)*(Number(item.qty)||0))}</div><button class="remove-item" data-remove="${escapeHTML(item.id)}" data-size="${escapeHTML(item.size)}" data-variant="${escapeHTML(item.variantId||'')}">REMOVE</button></div></div>`;
  }).join('');
}
function openCart(){$('#cart-drawer').classList.add('open');$('#cart-drawer').setAttribute('aria-hidden','false');$('#cart-scrim').classList.add('active');document.body.classList.add('no-scroll');$('#close-cart').focus()}
function closeCart(){$('#cart-drawer').classList.remove('open');$('#cart-drawer').setAttribute('aria-hidden','true');$('#cart-scrim').classList.remove('active');document.body.classList.remove('no-scroll')}
let toastTimer;function showToast(message){const toast=$('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2300)}
function setupReveal(){if(!('IntersectionObserver'in window)){document.querySelectorAll('.reveal').forEach(element=>element.classList.add('is-visible'));return}const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.12});document.querySelectorAll('.reveal:not(.is-visible)').forEach(element=>observer.observe(element))}
async function setupPage(){
  await loadStorefrontProducts();renderProducts();renderCart();setupReveal();$('#year').textContent=new Date().getFullYear();
  const productFromLink=new URLSearchParams(window.location.search).get('product');
  if(productFromLink){const target=$(`#product-${CSS.escape(`printify-${productFromLink}`)}`);if(target)setTimeout(()=>target.scrollIntoView({behavior:'smooth',block:'center'}),250)}
  $('#open-cart').addEventListener('click',openCart);$('#close-cart').addEventListener('click',closeCart);$('#cart-scrim').addEventListener('click',closeCart);$('#empty-shop').addEventListener('click',()=>{closeCart();document.querySelector('#shop').scrollIntoView({behavior:'smooth'})});
  $('#product-grid').addEventListener('click',event=>{const button=event.target.closest('[data-add]');if(!button)return;const id=button.dataset.add;const select=$(`[data-product-option="${CSS.escape(id)}"]`);addToCart(id,select?.value||'One size')});
  $('#cart-items').addEventListener('click',event=>{const qty=event.target.closest('[data-qty]');const remove=event.target.closest('[data-remove]');if(qty)changeQty(qty.dataset.id,qty.dataset.size,Number(qty.dataset.qty),qty.dataset.variant);if(remove)removeItem(remove.dataset.remove,remove.dataset.size,remove.dataset.variant)});
  $('#menu-toggle').addEventListener('click',()=>{const open=$('#mobile-menu').classList.toggle('open');$('#menu-toggle').setAttribute('aria-expanded',String(open))});
  $('#mobile-menu').addEventListener('click',event=>{if(event.target.closest('a')){$('#mobile-menu').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false')}});
  $('#newsletter-form').addEventListener('submit',event=>{event.preventDefault();const email=$('#newsletter-email').value.trim();if(!email)return;$('#newsletter-feedback').textContent='YOU’RE ON THE LIST — CONNECT AN EMAIL SERVICE TO SAVE SIGN-UPS.';$('#newsletter-form').reset()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeCart()});
}
document.addEventListener('DOMContentLoaded',setupPage);
