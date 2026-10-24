# Tessilo Shopify theme

Production theme source for Tessilo. Shopify theme directories live at the repository root.

## Development

```sh
shopify theme dev --store tessilo-erkcvxa8.myshopify.com
shopify theme check
```

## Release status

Published to live theme 180815298753 on 2026-10-24 (UTC). Includes scroll-driven homepage, social links, compact RFQ forms and collection-card enquiry dialogs. 3D is not exposed in the storefront.

Grow receives enquiries only when its public form service and verification configuration are ready. Storefront GA4 G-7LPFPC1GWD is consent-gated through Shopify Customer Privacy. Checkout ecommerce events require the Google & YouTube integration; remove the theme GA4 loader when migrating to that channel to avoid duplicates. Never store credentials in this repository.
