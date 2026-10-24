/* Storefront GA4. Checkout ecommerce tracking belongs to Google & YouTube. */
(() => {
  const id = 'G-7LPFPC1GWD';
  let started = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  function syncConsent() {
    const allowed = window.Shopify?.customerPrivacy?.analyticsProcessingAllowed() === true;
    window['ga-disable-' + id] = !allowed;
    window.gtag('consent', 'update', {analytics_storage:allowed?'granted':'denied'});
    if (!allowed || started) return;
    started = true;
    window.gtag('js', new Date());
    window.gtag('config', id, {allow_google_signals:false,allow_ad_personalization_signals:false});
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.append(script);
  }
  document.addEventListener('visitorConsentCollected', syncConsent);
  if (window.Shopify?.customerPrivacy) syncConsent();
  else window.Shopify?.loadFeatures?.([{name:'consent-tracking-api',version:'0.1'}], error => {if (!error) syncConsent();});
})();
