(() => {
  const mounted = new WeakSet();
  function init(scope = document) {
    const roots = [...scope.querySelectorAll('[data-day-journey]')];
    if (scope.matches?.('[data-day-journey]')) roots.unshift(scope);
    roots.forEach(root => {
      if (mounted.has(root)) return;
      mounted.add(root);
      const reduced = matchMedia('(prefers-reduced-motion: reduce)');
      const copies = [...root.querySelectorAll('[data-day-copy]')];
      const buttons = [...root.querySelectorAll('[data-day-go]')];
      const hint = root.querySelector('[data-day-hint]');
      const abort = new AbortController();
      let frame = 0, stage = -1;
      const clamp = n => Math.max(0, Math.min(1, n));
      const smooth = n => n*n*(3-2*n);
      function paint() {
        frame = 0;
        const range = root.offsetHeight - root.querySelector('section').offsetHeight;
        document.body.classList.toggle('tessilo-in-hero', root.getBoundingClientRect().bottom > 100);
        const p = reduced.matches ? 0 : clamp(-root.getBoundingClientRect().top / Math.max(1, range));
        root.style.setProperty('--day-night', smooth(clamp((p - .48) / .42)));
        root.style.setProperty('--day-warm', Math.sin(p * Math.PI) * .38);
        root.style.setProperty('--day-progress', p);
        root.style.setProperty('--day-zoom', 1 + p * .035);
        const next = p < .3 ? 0 : p < .68 ? 1 : 2;
        if (next !== stage) {
          stage = next;
          copies.forEach((copy, i) => { copy.hidden = i !== stage; });
          buttons.forEach((button,i) => button.setAttribute('aria-pressed', String(i === stage)));
        }
        hint.textContent = p > .94 ? 'Your evening starts here. Keep exploring ↓' : 'Scroll to spend the day with us ↓';
      }
      const request = () => { if (!frame) frame = requestAnimationFrame(paint); };
      root.dataset.enhanced = 'true';
      buttons.forEach((button, i) => button.addEventListener('click', () => {
        if (reduced.matches) {
          copies.forEach((copy,j) => { copy.hidden = i !== j; });
          buttons.forEach((b,j) => b.setAttribute('aria-pressed', String(i === j)));
          root.style.setProperty('--day-night', i === 2 ? 1 : 0);
          root.style.setProperty('--day-warm', i === 1 ? .38 : 0);
          return;
        }
        const top = scrollY + root.getBoundingClientRect().top;
        const range = root.offsetHeight - root.querySelector('section').offsetHeight;
        window.scrollTo({top:top + range * Number(button.dataset.dayGo),behavior:'smooth'});
      }, {signal:abort.signal}));
      window.addEventListener('scroll', request, {passive:true,signal:abort.signal});
      window.addEventListener('resize', request, {signal:abort.signal});
      reduced.addEventListener('change', request, {signal:abort.signal});
      document.addEventListener('shopify:section:unload', event => {
        if (event.target.contains(root)) {abort.abort();cancelAnimationFrame(frame);}
      }, {signal:abort.signal});
      paint();
    });
  }
  init();
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {if(node.nodeType === 1 && (node.matches('[data-day-journey]') || node.querySelector('[data-day-journey]'))) init(node);}))).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('shopify:section:load', event => init(event.target));
})();
