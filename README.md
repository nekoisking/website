# Concrete Hoops — Storefront + Printify Connector

A responsive, cinematic Concrete Hoops storefront built with HTML, CSS, and browser JavaScript, plus a small Node.js server that keeps the Printify API token private.

## What is included

- Cinematic, responsive home page, animated hero, scrolling ticker, story, lookbook, newsletter interaction.
- Product grid and shopping bag with size/variant selection, quantity controls, and subtotal.
- Printify storefront feed: reads visible products, mockup images, available variants, and variant prices from your connected Printify shop.
- Private `/admin.html` control room with an admin key, Printify connection check, shop IDs, and a Sync Products action.
- Printify custom API-store publish confirmation for locked products after the storefront has added them.
- Separate checkout preview page. It does **not** take payment or submit a fulfillment order yet.
- Starter products remain as a preview when Printify is not configured.

## Run it on your computer

You need Node.js 20 or newer.

1. Open this folder in Visual Studio Code.
2. Make a copy of `.env.example` and name the copy `.env`.
3. Add your own values for `PRINTIFY_API_TOKEN` and `ADMIN_KEY` in `.env`. Do not send these secrets in chat or commit `.env` to GitHub.
4. In the terminal, run:

   ```bash
   npm start
   ```

5. Open `http://localhost:3000` for the storefront and `http://localhost:3000/admin.html` for the admin page.

To preview the site without connecting Printify, you can leave the token blank; the four sample products will be displayed.

## Connect Printify

1. In Printify, open **My Profile → Connections** and generate a Personal Access Token.
2. Select these token scopes:
   - `shops.read`
   - `products.read`
   - `products.write`
3. Copy the token when Printify shows it and keep it private. The token is only shown once and expires after one year.
4. In Printify, open **My Stores → Add a new store → API** and create/connect the API store for this custom website.
5. Put the token in the server environment variable `PRINTIFY_API_TOKEN`.
6. If your Printify account has more than one shop, open `/admin.html`, connect with your `ADMIN_KEY`, find the ID for the API shop, then set that ID in `PRINTIFY_SHOP_ID` on your host. If you have one shop, the server can select it automatically.
7. Create your shirt, shorts, hoodie, or other item in Printify's Product Creator. Upload your artwork, select the product and variants, set your retail prices, review the mockups, and publish it to the API store.
8. Return to `/admin.html`, press **Sync Products**, and refresh the public storefront. Products marked visible and with available variants will appear in the shop.

The Printify token is used only in `server.js` on the server. Do not put it in `app.js`, `index.html`, a public configuration file, or any code that runs in a customer's browser.

## Publish it as a public link with Render

Because the Printify connector uses a server, deploy this as a **Node Web Service**, not as a static-only site.

1. Extract the ZIP on your computer.
2. Create a new **private** GitHub repository for Concrete Hoops.
3. Upload the contents of this folder to the top level of that repository. Include `server.js`, `package.json`, all HTML/CSS/JS files, and the `assets` folder. Do **not** upload `.env`; upload `.env.example` instead.
4. In Render, choose **New → Web Service**, connect the repository, and use:
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `npm start`
5. Deploy. Render will give your site a public address ending in `onrender.com`. That is the link you can share.
6. In your Render service, open **Environment** and add:
   - `ADMIN_KEY` — a long, unique admin password you create.
   - `PRINTIFY_API_TOKEN` — your private Printify token.
   - `PRINTIFY_SHOP_ID` — optional when your account has only one shop; otherwise use the API shop ID.
   - `PUBLIC_SITE_URL` — your full Render website address, for example `https://your-site.onrender.com`.
7. Save the variables and redeploy. Open `https://your-site.onrender.com/admin.html`, enter your `ADMIN_KEY`, connect, and sync.
8. Later, you can add a custom domain in your Render service settings. Your Render link works before you buy a domain.

If the site is in a GitHub repository, future pushes to the connected branch can trigger automatic redeploys in Render.

## Important before taking real orders

- The checkout page is still a demo. It does not charge cards, create a customer order, or send an order to Printify.
- Before selling, connect a secure hosted payment provider and a backend payment-success webhook. Only after a payment is confirmed should the server create the corresponding Printify fulfillment order. Do not collect or store card numbers in this starter site.
- The product prices shown on the website come from the prices on the Printify variants. Set and review those prices in Printify before publishing.
- Check shipping charges, delivery regions, product quality, return/refund terms, taxes, privacy wording, and customer support details before launch.
- A parent or guardian should oversee the ecommerce, Printify, hosting, and payment-account setup and any real-money sales.
- Replace all sample brand contact details and sample product artwork with your actual brand information and artwork you have permission to use.

## Main files

- `index.html` — public storefront
- `styles.css` — storefront styles
- `app.js` — product feed, variant selection, cart, and interactions
- `checkout.html`, `checkout.css`, `checkout.js` — checkout preview (no real payment)
- `admin.html`, `admin.css`, `admin.js` — private Printify control room
- `server.js` — Node server and secure Printify API connector
- `package.json` — start command
- `.env.example` — template for environment variables (not secrets)
- `assets/` — starter vector product mockups
