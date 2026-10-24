// Keep Shopify's focus trap, scroll lock and drawer animation as the single owner.
document.addEventListener('click', event => {
  const link = event.target.closest('.tessilo-drawer a');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const drawer = link.closest('header-drawer, menu-drawer');
  if (typeof drawer?.closeMenuDrawer !== 'function') return;
  const url = new URL(link.href), samePage = url.pathname === location.pathname && url.search === location.search && url.hash;
  drawer.closeMenuDrawer(event);
  drawer.querySelector('summary')?.setAttribute('aria-expanded', 'false');
  if (samePage) {
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (target) {
      event.preventDefault(); history.pushState(null, '', url.hash);
      target.setAttribute('tabindex', '-1'); target.focus({preventScroll:true});
      target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    }
  }
});
function initSpaceMenus(scope = document) {
  scope.querySelectorAll('[data-space-menu]').forEach(menu => {
    if (menu.dataset.ready) return; menu.dataset.ready = 'true';
    const summary = menu.querySelector('summary');
    let timer;
    menu.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse') return;
      clearTimeout(timer); menu.open = true;
    });
    menu.addEventListener('pointerleave', event => {
      if (event.pointerType !== 'mouse') return;
      timer = setTimeout(() => { if (!menu.contains(document.activeElement)) menu.open = false; }, 140);
    });
    menu.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.open = false; summary.focus(); event.preventDefault(); } });
    menu.addEventListener('focusout', () => queueMicrotask(() => { if (!menu.contains(document.activeElement)) menu.open = false; }));
    document.addEventListener('click', event => { if (!menu.contains(event.target)) menu.open = false; });
  });
}
initSpaceMenus();
document.addEventListener('shopify:section:load', event => initSpaceMenus(event.target));
document.addEventListener('click', event => {
  const link = event.target.closest('[data-tessilo-enlarge]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || typeof HTMLDialogElement === 'undefined') return;
  event.preventDefault();
  const dialog = document.createElement('dialog'); dialog.className = 'tessilo-image-viewer'; dialog.setAttribute('aria-label', link.getAttribute('aria-label') || 'Full-size product image');
  const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Close image';
  const img = document.createElement('img'); img.src = link.href; img.alt = link.querySelector('img')?.alt || 'Product image';
  dialog.append(button, img); document.body.append(dialog); dialog.showModal(); button.focus();
  button.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if(e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { dialog.remove(); link.focus({preventScroll:true}); }, {once:true});
});
// Publish only a channel + placement to Shopify's consent-aware pixel event bus.
// This is an outbound click, never a purchase or a confirmed enquiry.
document.addEventListener('click', event => {
  const link=event.target.closest('a[data-social-platform]');
  if(!link || !window.Shopify?.analytics?.publish) return;
  try { const result=window.Shopify.analytics.publish('tessilo:social_link_clicked',{platform:link.dataset.socialPlatform,placement:link.closest('[data-social-placement]')?.dataset.socialPlacement||'unknown'});result?.catch?.(()=>{}); } catch { /* Analytics must never block the destination. */ }
});

(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let queued = false;
  const clamp = n => Math.max(0,Math.min(1,n));
  function paintConsultation() {
    queued = false;
    document.querySelectorAll('.tessilo-story-preview').forEach(story => {
      const r=story.getBoundingClientRect();
      const home = document.body.classList.contains('tessilo-home');
      const p=motion.matches ? 0 : home ? clamp((innerHeight*.65-r.top)/Math.max(1,innerHeight*.65-100)) : clamp((innerHeight*.7-r.top)/(r.height*.65));
      const mix=(a,b)=>Math.round(a+(b-a)*p);
      story.setAttribute('data-story-light','');
      const bg = home ? [mix(240,23),mix(240,47),mix(238,70)] : [mix(240,20),mix(240,44),mix(238,67)];
      story.style.setProperty('--story-surface',`rgb(${bg.join(',')})`);
      // Choose a readable text polarity throughout the colour interpolation.

      const lum=bg.map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0);
      story.style.setProperty('--story-reading',lum>.24?'#071a2d':'#ffffff');
      story.style.setProperty('--story-zoom',String(1+p*.055));
    });
    document.querySelectorAll('[data-consultation-journey]').forEach(track => {
      const panel = track.querySelector('.tessilo-consultation');
      const rect = track.getBoundingClientRect();
      // Natural document flow: no spacer or sticky scroll distance.
      const progress = motion.matches ? 1 : clamp((innerHeight*.85-rect.top)/(innerHeight*.75));
      const mix = (a,b) => Math.round(a+(b-a)*progress);
      panel.style.background = `linear-gradient(115deg,rgb(${mix(218,226)},${mix(223,175)},${mix(228,73)}),rgb(${mix(241,249)},${mix(242,225)},${mix(242,157)}))`;
      panel.setAttribute('data-scroll-ad','');
      const stage = Math.min(2,Math.floor(progress*3));
      if(panel.dataset.adStage !== String(stage)) {
        panel.dataset.adStage = String(stage);
        for(const selector of ['[data-ad-heading]','[data-ad-copy]']) panel.querySelectorAll(selector).forEach((copy,i) => {
          copy.hidden = i !== stage;
          if(i === stage && !motion.matches) {
            copy.getAnimations().forEach(a=>a.cancel());
            copy.animate([{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:450,easing:'cubic-bezier(.16,1,.3,1)'});
          }
        });
      }
    });
  }
  function requestPaint() { if(!queued) { queued=true;requestAnimationFrame(paintConsultation); } }
  addEventListener('scroll',requestPaint,{passive:true});
  addEventListener('resize',requestPaint,{passive:true});
  motion.addEventListener('change',requestPaint);
  document.addEventListener('shopify:section:load',requestPaint);
  requestPaint();
})();

/* The rooms share the warmth of a passing day. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  const clamp = value => Math.max(0, Math.min(1, value));
  function paintRooms() {
    frame = 0;
    const section = document.querySelector('.tessilo-home .tessilo-scenes--concepts');
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const progress = reduced.matches ? .4 : clamp((innerHeight * .8 - rect.top) / (innerHeight * .8 + rect.height * .3));
    const stops = [[245,242,235],[235,210,161],[23,47,70]];
    const half = progress < .5 ? 0 : 1;
    const t = (progress - half * .5) * 2;
    const eased = t*t*(3-2*t);
    const color = stops[half].map((v,i) => Math.round(v+(stops[half+1][i]-v)*eased));
    const luminance = color.map(v => {v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
    section.style.setProperty('--rooms-background',`rgb(${color.join(',')})`);
    section.style.setProperty('--rooms-ink',luminance>.24?'#152a3b':'#fff7e9');
    section.style.setProperty('--rooms-accent',luminance>.24?'#66502f':'#f0d6a4');
  }
  function request(){if(!frame) frame=requestAnimationFrame(paintRooms);}
  window.addEventListener('scroll',request,{passive:true});
  window.addEventListener('resize',request);
  reduced.addEventListener('change',request);
  document.addEventListener('shopify:section:load',request);
  request();
})();
