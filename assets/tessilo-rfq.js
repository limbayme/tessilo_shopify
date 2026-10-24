const countryAliases = {US:['USA','United States of America','America','美国'],GB:['UK','United Kingdom','Great Britain','England','英国'],DE:['Deutschland','德国'],FR:['France','法国'],ES:['España','西班牙'],IT:['Italia','意大利'],NL:['Holland','荷兰'],CH:['Switzerland','Schweiz','瑞士'],AT:['Österreich','奥地利'],TR:['Turkey','Türkiye','土耳其']};
export function normalizeCountryQuery(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}\s]/gu,'').trim().toLowerCase().replace(/\s+/g,' ');
}
function editDistance(a,b) {
  const rows=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++) rows[i][0]=i;
  for(let j=0;j<=b.length;j++) rows[0][j]=j;
  for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) {
    rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
  }
  return rows[a.length][b.length];
}
export function matchCountries(entries,query) {
  const q=normalizeCountryQuery(query).slice(0,80); if(!q)return entries;
  return entries.map((entry,index)=>{
    const terms=[entry.code,entry.name,...(countryAliases[entry.code]||[])].map(normalizeCountryQuery);
    let score=Infinity;
    for(const term of terms){
      if(term===q)score=Math.min(score,0);
      else if(term.startsWith(q))score=Math.min(score,1);
      else if(term.includes(q))score=Math.min(score,2);
      else if(q.length>=4){
        const distance=editDistance(q,term),limit=q.length>=6?2:1;
        if(distance<=limit)score=Math.min(score,3+distance);
      }
    }
    return {entry,index,score};
  }).filter(item=>Number.isFinite(item.score)).sort((a,b)=>a.score-b.score||a.index-b.index).map(item=>item.entry);
}
if(typeof document !== 'undefined') (() => {
  function initialiseCountry(root) {
    const host = root.querySelector('[data-country]'); if(!host) return;
    const fallback = host.querySelector('[data-country-fallback]'), input = host.querySelector('[data-country-search]'), list = host.querySelector('[data-country-options]'), status = host.querySelector('[data-country-status]');
    const entries = [...fallback.options].filter(option => option.value).map(option => ({code:option.value,name:option.dataset.countryName,label:option.textContent}));
    const value = document.createElement('input'); value.type = 'hidden'; value.name = 'contact[country]'; value.value = fallback.value; value.dataset.countryValue = '';
    fallback.removeAttribute('name'); fallback.disabled = true; fallback.hidden = true; host.append(value);
    host.querySelector('[data-country-custom]').hidden = false; input.disabled = false; host.querySelector('[data-country-label]').htmlFor = input.id;
    let filtered = entries, active = -1, chosen = entries.find(entry => entry.code === value.value);
    if(chosen) input.value = chosen.label;
    function validate() { input.setCustomValidity(value.value ? '' : 'Choose a country from the list.'); }
    function close() { list.hidden = true; input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant'); active = -1; }
    function focusOption(index) {
      active = Math.max(0,Math.min(index,filtered.length-1));
      [...list.children].forEach((item,i) => { item.classList.toggle('is-active',i === active); });
      const option = list.children[active]; if(option) { input.setAttribute('aria-activedescendant',option.id); option.scrollIntoView({block:'nearest'}); }
    }
    function choose(index) {
      chosen = filtered[index]; if(!chosen) return;
      value.value = chosen.code; input.value = chosen.label; validate(); close();
      value.dispatchEvent(new Event('change',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));
    }
    function render(query = '') {
      filtered = matchCountries(entries,query);
      list.replaceChildren(); active = -1; input.removeAttribute('aria-activedescendant');
      filtered.forEach((entry,index) => {
        const item = document.createElement('li'); item.id = `${list.id}-${entry.code}`; item.role = 'option'; item.setAttribute('aria-selected',String(value.value === entry.code)); item.textContent = entry.label;
        item.addEventListener('pointerdown',event => event.preventDefault()); item.addEventListener('click',() => choose(index)); list.append(item);
      });
      list.hidden = false; input.setAttribute('aria-expanded','true'); status.textContent = filtered.length ? `${filtered.length} ${filtered.length === 1 ? 'country' : 'countries'} available.` : 'No matching country. Try another name.';
      if(!filtered.length) { const empty = document.createElement('li'); empty.textContent = 'No matching country'; empty.setAttribute('role','presentation'); list.append(empty); }
    }
    input.addEventListener('focus',() => render()); input.addEventListener('click',() => { if(list.hidden) render(); });
    input.addEventListener('input',() => { input.value = input.value.replace(/[\u{1F1E6}-\u{1F1FF}\uFE0F]/gu,'').trimStart(); value.value = ''; chosen = null; validate(); render(input.value.trim()); });
    input.addEventListener('keydown',event => {
      if(event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if(list.hidden) render(); focusOption(active < 0 ? (event.key === 'ArrowDown' ? 0 : filtered.length - 1) : active + (event.key === 'ArrowDown' ? 1 : -1)); }
      else if(event.key === 'Enter' && !list.hidden) { event.preventDefault(); if(filtered.length) choose(active < 0 ? 0 : active); }
      else if(event.key === 'Escape') { event.preventDefault(); close(); }
      else if(event.key === 'Tab') close();
    });
    document.addEventListener('pointerdown',event => { if(!host.contains(event.target)) close(); });
    input.addEventListener('blur',() => { close(); validate(); });
    root.querySelector('form').addEventListener('reset',() => queueMicrotask(() => { value.value = ''; input.value = ''; chosen = null; close(); validate(); }));
    validate();
  }
  const bound = new WeakSet();
  const initialise = (scope = document) => [...(scope.matches?.('[data-rfq]') ? [scope] : []), ...scope.querySelectorAll('[data-rfq]')].forEach(root => {
    if(bound.has(root)) return; bound.add(root); root.dataset.ready = 'true';
    const field = key => root.querySelector(`[data-rfq-field="${key}"]`);
    const params = new URLSearchParams(location.search);
    const types = ['custom_furniture','wholesale','designer_project','general'];
    if(types.includes(params.get('type'))) root.querySelectorAll('[name="contact[inquiry_type]"]').forEach(input => { input.checked = input.value === params.get('type'); });
    initialiseCountry(root);
    const picker = root.querySelector('[data-piece-picker]');
    if(picker) {
      const details=picker.querySelector('details'),search=picker.querySelector('[data-piece-search]'),options=[...picker.querySelectorAll('[data-piece-option]')];
      const preview=picker.querySelector('[data-piece-preview]');
      function choosePiece(option,focus=true) {
        const data=option.dataset;
        for(const [key,value] of Object.entries({product_title:data.title,product_sku:data.sku,product_url:data.url,variant_id:data.variant,variant_title:data.variantTitle})) field(key).value=value||'';
        picker.querySelector('[data-piece-title]').textContent=data.title||'Choose a piece';
        picker.querySelector('[data-piece-reference]').textContent=data.title?[data.sku,data.variantTitle==='Default Title'?'':data.variantTitle].filter(Boolean).join(' · '):'Browse by image, name or SKU';
        preview.hidden=!data.image;if(data.image)preview.src=data.image;else preview.removeAttribute('src');
        options.forEach(item=>item.setAttribute('aria-pressed',String(item===option)));
        details.open=false;if(focus)details.querySelector('summary').focus();
        field('product_sku').dispatchEvent(new Event('change',{bubbles:true}));
      }
      options.forEach(option=>option.addEventListener('click',()=>choosePiece(option)));
      search.addEventListener('input',()=>{const q=normalizeCountryQuery(search.value);let matches=0;options.forEach(option=>{const match=!q||normalizeCountryQuery([option.dataset.title,option.dataset.sku,option.dataset.variantTitle].join(' ')).includes(q);option.hidden=!match;if(match)matches++;});picker.querySelector('[data-piece-empty]').hidden=matches>0;});
      search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();const visible=options.filter(option=>!option.hidden);if(visible.length===1)choosePiece(visible[0]);else visible[0]?.focus();}if(event.key==='ArrowDown'){event.preventDefault();options.find(option=>!option.hidden)?.focus();}});
      details.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();details.open=false;details.querySelector('summary').focus();}});
      document.addEventListener('pointerdown',event=>{if(!picker.contains(event.target))details.open=false;});
      const requested=options.find(option=>params.get('sku')&&option.dataset.sku.toLowerCase()===params.get('sku').toLowerCase());if(requested)choosePiece(requested,false);
      root.querySelector('form').addEventListener('reset',()=>queueMicrotask(()=>choosePiece(options[0],false)));
    }
    const dialog = root.querySelector('[data-rfq-dialog]');
    const launch = root.querySelector('[data-rfq-open]');
    function openDialog() { if(dialog && !dialog.open) { dialog.showModal(); document.documentElement.classList.add('tessilo-rfq-modal-open'); } }
    if(dialog) {
      launch.addEventListener('click',openDialog);
      dialog.querySelector('[data-rfq-close]').addEventListener('click',()=>dialog.close());
      dialog.addEventListener('click',event=>{ if(event.target===dialog) {const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close();} });
      dialog.addEventListener('close',()=>{document.documentElement.classList.remove('tessilo-rfq-modal-open');(root.rfqReturnFocus || launch).focus({preventScroll:true});});
      dialog.addEventListener('invalid',event=>{const extra=event.target.closest('details');if(extra)extra.open=true;},true);
      const role=dialog.querySelector('[data-rfq-role]');
      role.addEventListener('change',event=>{if(event.target.name!=='contact[buyer_role]')return;field('inquiry_type').value=event.target.dataset.intent;role.querySelector('[data-rfq-role-label]').textContent=event.target.value;role.open=false;role.querySelector('summary').focus();});
      role.addEventListener('keydown',event=>{if(event.key==='Escape'&&role.open){event.preventDefault();event.stopPropagation();role.open=false;role.querySelector('summary').focus();}});
      dialog.addEventListener('click',event=>{if(!role.contains(event.target))role.open=false;});
      if(params.get('type')==='wholesale'){const radio=role.querySelector('[value="Dealer / distributor"]');radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));}
    }
    function reveal() { if(location.hash === '#TessiloRFQ') openDialog(); }
    reveal(); window.addEventListener('hashchange',reveal);
    if(root.dataset.productBound === 'true' && typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      root.rfqUnsubscribe = subscribe(PUB_SUB_EVENTS.variantChange, ({data}) => {
        if(data.sectionId !== root.dataset.section || !data.variant) return;
        field('product_sku').value = data.variant.sku || '';
        field('variant_id').value = String(data.variant.id);
        field('variant_title').value = data.variant.title || '';
        const reference=root.querySelector('[data-rfq-reference]');if(reference)reference.textContent=[data.variant.sku,data.variant.title].filter(Boolean).join(' · ');
        const url = new URL(field('product_url').value); url.search = ''; url.hash = ''; field('product_url').value = url.href;
      });
    }
    // Grow adapter owns server-confirmed success/errors. This file only validates/prefills.
    root.querySelector('form').addEventListener('submit', event => {
      const input = field('quantity'); input.setCustomValidity('');
      if(!Number.isInteger(Number(input.value)) || Number(input.value) < 1 || Number(input.value) > 1000000000) { input.setCustomValidity('Please enter a whole number between 1 and 1,000,000,000.'); event.preventDefault(); input.reportValidity(); }
    });
    field('quantity').addEventListener('input', () => field('quantity').setCustomValidity(''));
    document.addEventListener('shopify:section:unload', event => { if(event.target.contains(root)) { window.removeEventListener('hashchange',reveal); root.rfqUnsubscribe?.(); } },{once:true});
  });
  // Reuse the product's server-rendered form without leaving the collection.
  const cardForms = new Map();
  let cardRequest = 0;
  document.addEventListener('click', async event => {
    const link = event.target.closest('a.tessilo-card-rfq');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    const request = ++cardRequest;
    url.hash = '';
    const label = link.textContent;
    link.setAttribute('aria-busy', 'true');
    link.textContent = 'Opening enquiry…';
    try {
      if (!cardForms.has(url.href)) {
        const loading = (async () => {
          const response = await fetch(url.href);
          if (!response.ok) throw new Error('Product enquiry unavailable');
          const page = new DOMParser().parseFromString(await response.text(), 'text/html');
          const form = page.querySelector('[data-rfq][data-product-bound="true"]');
          if (!form?.querySelector('[data-rfq-dialog]')) throw new Error('Missing enquiry form');
          const prefix = `card-rfq-${cardForms.size}-`;
          const ids = new Map([form, ...form.querySelectorAll('[id]')].filter(el => el.id).map(el => [el.id, prefix + el.id]));
          for (const el of [form, ...form.querySelectorAll('*')]) {
            if (el.id) el.id = ids.get(el.id);
            for (const attr of ['for', 'aria-controls', 'aria-labelledby', 'aria-describedby']) {
              if (el.hasAttribute(attr)) el.setAttribute(attr, el.getAttribute(attr).split(' ').map(id => ids.get(id) || id).join(' '));
            }
          }
          form.querySelector('[data-rfq-open]').hidden = true;
          document.body.append(form);
          initialise(form);
          return form;
        })();
        cardForms.set(url.href, loading);
        loading.catch(() => cardForms.delete(url.href));
      }
      const form = await cardForms.get(url.href);
      if (request !== cardRequest) return;
      form.rfqReturnFocus = link;
      form.querySelector('[data-rfq-open]').click();
    } catch {
      if (request === cardRequest) location.assign(link.href);
    } finally {
      link.removeAttribute('aria-busy');
      link.textContent = label;
    }
  });
  initialise(); document.addEventListener('shopify:section:load', event => initialise(event.target));
  new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) { if (node.nodeType === 1 && (node.matches('[data-rfq]') || node.querySelector('[data-rfq]'))) initialise(node); } }).observe(document.body, {childList:true, subtree:true});
})();
