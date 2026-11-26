'use strict';

// Concrete Hoops site + Printify connector.
// Printify credentials stay on this server and are never sent to browser code.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

let productCache = { expiresAt: 0, value: null };

function loadLocalEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith('#') || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}
loadLocalEnv();
const PORT = Number(process.env.PORT || 3000);

function send(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isAdmin(req) {
  const configuredKey = process.env.ADMIN_KEY;
  const suppliedKey = req.headers['x-admin-key'];
  return Boolean(configuredKey && safeEqual(String(suppliedKey || ''), configuredKey));
}

async function readBody(req, limit = 20_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Request body must be valid JSON.')); }
    });
    req.on('error', reject);
  });
}

async function printifyRequest(endpoint, options = {}) {
  const token = process.env.PRINTIFY_API_TOKEN;
  if (!token) {
    const error = new Error('Printify is not connected yet. Add PRINTIFY_API_TOKEN in your server environment variables.');
    error.status = 503;
    throw error;
  }

  const response = await fetch(`https://api.printify.com/v1/${endpoint.replace(/^\//, '')}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'ConcreteHoopsWebsite/1.0 (Node.js)',
      'Content-Type': 'application/json; charset=utf-8',
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(20_000)
  });
  const text = await response.text();
  let result = {};
  if (text) {
    try { result = JSON.parse(text); }
    catch { result = { message: text.slice(0, 500) }; }
  }
  if (!response.ok) {
    const error = new Error(result.error_description || result.message || `Printify returned HTTP ${response.status}.`);
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  return result;
}

async function getShops() {
  const response = await printifyRequest('shops.json');
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  return [];
}

async function resolveShop() {
  const shops = await getShops();
  const configuredId = String(process.env.PRINTIFY_SHOP_ID || '').trim();
  if (configuredId) {
    const found = shops.find(shop => String(shop.id) === configuredId);
    if (!found) {
      const error = new Error('PRINTIFY_SHOP_ID did not match a shop returned by your Printify account. Check the shop ID in /admin.html.');
      error.status = 400;
      throw error;
    }
    return { shop: found, shops };
  }

  const apiShops = shops.filter(shop => String(shop.sales_channel || '').toLowerCase() === 'api');
  if (apiShops.length === 1) return { shop: apiShops[0], shops };
  if (shops.length === 1) return { shop: shops[0], shops };

  const error = new Error('Your Printify account has more than one shop. Copy the ID of your API-connected shop from /admin.html into the PRINTIFY_SHOP_ID environment variable, then redeploy.');
  error.status = 409;
  throw error;
}

async function getAllProducts(shopId) {
  const all = [];
  let page = 1;
  let lastPage = 1;
  do {
    const result = await printifyRequest(`shops/${encodeURIComponent(shopId)}/products.json?limit=50&page=${page}`);
    if (Array.isArray(result.data)) all.push(...result.data);
    lastPage = Math.max(1, Number(result.last_page || result.lastPage || page));
    page += 1;
  } while (page <= lastPage && page <= 50);
  return all;
}

function safeHttpsUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch { return ''; }
}

function mapPrintifyProduct(product) {
  const variants = (Array.isArray(product.variants) ? product.variants : [])
    .filter(variant => variant && variant.is_enabled !== false && variant.is_available !== false && Number.isFinite(Number(variant.price)))
    .map(variant => ({
      id: String(variant.id),
      name: String(variant.title || `Variant ${variant.id}`),
      price: Number(variant.price) / 100
    }));
  if (!variants.length) return null;

  const images = Array.isArray(product.images) ? product.images : [];
  const preferredImage = images.find(image => image && image.is_default) || images[0];
  const image = safeHttpsUrl(preferredImage && preferredImage.src);
  const lowestPrice = Math.min(...variants.map(variant => variant.price));
  return {
    id: `printify-${String(product.id)}`,
    printifyId: String(product.id),
    name: String(product.title || 'Concrete Hoops Product').slice(0, 140),
    description: String(product.description || '').slice(0, 1200),
    category: (Array.isArray(product.tags) ? product.tags : []).slice(0, 3).map(String).join(' / ') || 'PRINTIFY DROP',
    price: lowestPrice,
    tag: 'PRINTIFY DROP',
    art: image || 'assets/tee-black.svg',
    sizes: variants.map(variant => variant.name),
    variants,
    source: 'printify'
  };
}

async function getStorefrontProducts(forceRefresh = false) {
  if (!forceRefresh && productCache.value && productCache.expiresAt > Date.now()) return productCache.value;
  const { shop } = await resolveShop();
  const rawProducts = await getAllProducts(shop.id);
  const products = rawProducts
    .filter(product => product && product.visible !== false)
    .map(mapPrintifyProduct)
    .filter(Boolean);
  const value = { shop: { id: String(shop.id), title: String(shop.title || 'Printify shop') }, products };
  productCache = { value, expiresAt: Date.now() + 60_000 };
  return value;
}

function absoluteProductUrl(req, productId) {
  const base = String(process.env.PUBLIC_SITE_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'localhost'}`).replace(/\/$/, '');
  return `${base}/?product=${encodeURIComponent(productId)}#shop`;
}

async function syncPrintify(req) {
  const { shop } = await resolveShop();
  const rawProducts = await getAllProducts(shop.id);
  const visible = rawProducts.filter(product => product && product.visible !== false);
  let published = 0;
  const publishErrors = [];

  // In Printify's custom API-store workflow, mark a product as published only
  // after its listing has been added to this storefront. Locked products are
  // the ones waiting for the connected sales channel to confirm publication.
  for (const product of visible) {
    if (product.is_locked !== true || !mapPrintifyProduct(product)) continue;
    try {
      await printifyRequest(`shops/${encodeURIComponent(shop.id)}/products/${encodeURIComponent(product.id)}/publishing_succeeded.json`, {
        method: 'POST',
        body: JSON.stringify({ external: { id: String(product.id), handle: absoluteProductUrl(req, product.id) } })
      });
      published += 1;
    } catch (error) {
      publishErrors.push({ product: String(product.title || product.id), message: error.message });
    }
  }

  const products = visible.map(mapPrintifyProduct).filter(Boolean);
  productCache = { value: { shop: { id: String(shop.id), title: String(shop.title || 'Printify shop') }, products }, expiresAt: Date.now() + 60_000 };
  return {
    shop: { id: String(shop.id), title: String(shop.title || 'Printify shop') },
    visibleProducts: visible.length,
    storefrontProducts: products.length,
    confirmedPublished: published,
    publishErrors
  };
}

function serveStatic(req, res, pathname) {
  let relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  if (relative === 'admin') relative = 'admin.html';
  const filePath = path.resolve(ROOT, relative);
  if (!filePath.startsWith(`${ROOT}${path.sep}`) && filePath !== path.join(ROOT, 'index.html')) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const contentType = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      return send(res, 200, {
        ok: true,
        printifyConfigured: Boolean(process.env.PRINTIFY_API_TOKEN),
        adminConfigured: Boolean(process.env.ADMIN_KEY)
      });
    }

    if (req.method === 'GET' && pathname === '/api/storefront/products') {
      if (!process.env.PRINTIFY_API_TOKEN) return send(res, 503, { configured: false, products: [] });
      const data = await getStorefrontProducts();
      return send(res, 200, { configured: true, ...data });
    }

    if (pathname.startsWith('/api/admin/')) {
      if (!process.env.ADMIN_KEY) return send(res, 503, { error: 'Set ADMIN_KEY on the server before using the admin page.' });
      if (!isAdmin(req)) return send(res, 401, { error: 'Admin key is missing or incorrect.' });

      if (req.method === 'GET' && pathname === '/api/admin/printify/shops') {
        const shops = await getShops();
        return send(res, 200, {
          shops: shops.map(shop => ({ id: String(shop.id), title: String(shop.title || 'Untitled shop'), salesChannel: String(shop.sales_channel || 'Unknown') })),
          selectedShopId: String(process.env.PRINTIFY_SHOP_ID || '')
        });
      }

      if (req.method === 'POST' && pathname === '/api/admin/printify/sync') {
        await readBody(req);
        const result = await syncPrintify(req);
        return send(res, 200, { ok: true, ...result });
      }

      return send(res, 404, { error: 'Admin endpoint not found.' });
    }

    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, pathname);
    return send(res, 405, { error: 'Method not allowed.' }, { Allow: 'GET, HEAD, POST' });
  } catch (error) {
    const status = Number(error.status) || 500;
    const message = status >= 500 && status !== 502 && status !== 503
      ? 'The server could not complete that request. Check the server logs and Printify connection.'
      : error.message;
    return send(res, status, { error: message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Concrete Hoops is running on port ${PORT}`);
});
