// Brand-owned RFQ surface. Grow owns persistence and validates the public form schema.
export function buildRFQPayload(config, values, page) {
  const fields = {};
  for (const definition of config.schema.fields) {
    const key = definition.key;
    let value = String(values[key === 'notes' ? 'body' : key] ?? '').trim();
    if (key === 'notes') {
      const context = [values.buyer_role && `Choosing for: ${values.buyer_role}`, values.product_title && `Piece: ${values.product_title}`, values.variant_title && values.variant_title !== 'Default Title' && `Variant: ${values.variant_title}`].filter(Boolean).join('\n');
      value = [value, context].filter(Boolean).join('\n');
    }
    if (key === 'product_url' && value) { const url = new URL(value); if(url.protocol !== 'https:') throw Error('Product link must use HTTPS.'); value = url.origin + url.pathname; }
    if (key === 'country') value = value.toUpperCase();
    if (definition.required && !value) throw Error(`Please complete ${definition.label}.`);
    if (!value) continue;
    if (key === 'quantity') { const count = Number(value); if(!Number.isSafeInteger(count) || count < 1 || count > 1000000000) throw Error('Quantity must be a whole number of at least 1.'); fields[key] = count; }
    else {
      if (key === 'country' && !/^[A-Z]{2}$/.test(value)) throw Error('Please choose a delivery country.');
      if (definition.options?.length && !definition.options.some(option => option.value === value)) throw Error(`Please review ${definition.label}.`);
      if (value.length > (['notes','customization'].includes(key) ? 4000 : 500)) throw Error(`Please shorten ${definition.label}.`);
      fields[key] = value;
    }
  }
  const url = new URL(page), utm = {};
  for(const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content']) if(url.searchParams.get(key)) utm[key] = url.searchParams.get(key).slice(0,200);
  return {schema_version: config.schema_version, fields, context: {source_url: url.origin + url.pathname, scenario: fields.product_sku ? 'product_rfq' : 'trade_rfq', utm}, privacy: {version: config.schema.privacy.version, accepted: true}, website: ''};
}
let turnstilePromise;
function loadTurnstile() {
  if(window.turnstile) return Promise.resolve();
  if(!turnstilePromise) turnstilePromise = new Promise((resolve,reject) => {
    const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload = resolve; script.onerror = () => { turnstilePromise = null; script.remove(); reject(Error('Verification could not load.')); }; document.head.append(script);
  });
  return turnstilePromise;
}
async function jsonFetch(url, options = {}) { const response = await fetch(url,{...options, credentials:'omit', signal:AbortSignal.timeout(20000)}); let data; try { data = await response.json(); } catch { data = {}; } return {response,data}; }
const boundForms = new WeakSet();
function setup(root) {
  if(boundForms.has(root)) return; boundForms.add(root); root.dataset.growBound = 'true';
  const form = root.querySelector('[data-rfq-form]'), button = form.querySelector('[type=submit]'), status = root.querySelector('[data-grow-status]');
  const endpoint = `https://grow.jiumiqqt.com/api/public/inquiry-forms/${encodeURIComponent(root.dataset.growFormId)}`;
  const say = message => { status.textContent = message; };
  root.querySelector('.tessilo-rfq__grid')?.before(status);
  const retry = document.createElement('button'); retry.type='button'; retry.className='tessilo-rfq__retry'; retry.textContent='Check availability again'; retry.hidden=true; status.after(retry);
  const consentLabel = document.createElement('label'); consentLabel.className='tessilo-rfq__consent';
  const consent=document.createElement('input'); consent.type='checkbox'; consent.required=true;
  const privacy=document.createElement('span'); consentLabel.append(consent,privacy); button.before(consentLabel);
  const challenge = document.createElement('div'); button.before(challenge);
  const trap = document.createElement('input'); trap.name='website'; trap.tabIndex=-1; trap.autocomplete='off'; trap.setAttribute('aria-hidden','true'); trap.className='tessilo-rfq__trap'; form.append(trap);
  let config, widget, token='', pending, key, busy=false, nextAttempt=0;
  function lockFields(locked) { form.querySelectorAll('input:not([name=website]),textarea,select').forEach(input => input.disabled = locked); }
  async function initialise() {
    button.disabled=true; retry.hidden=true; consentLabel.hidden=true; say('Connecting to our enquiry team…');
    try {
      const result = await jsonFetch(endpoint); config = result.data;
      if(!result.response.ok || !config.submission_ready || config.bot?.provider !== 'turnstile' || !config.bot.site_key) throw Error('unavailable');
      // Never silently discard new required fields after an administrator changes the schema.
      for(const f of config.schema.fields) { const control=form.elements.namedItem(`contact[${f.key === 'notes' ? 'body' : f.key}]`); if(f.required && !control) throw Error('unsupported schema'); if(control) control.required=!!f.required; }
      privacy.textContent=config.schema.privacy.text; consentLabel.hidden=false;
      await loadTurnstile(); if(widget!==undefined) window.turnstile.remove(widget);
      widget=window.turnstile.render(challenge,{sitekey:config.bot.site_key,action:config.bot.action,cData:config.bot.cdata,callback:value=>{token=value;},'expired-callback':()=>{token='';},'error-callback':()=>{token='';say('Verification failed. Please try the check again.');}});
      button.disabled=false; say('Your request goes directly to the Tessilo enquiry team.');
    } catch { config=null; say('Enquiries are temporarily unavailable. Your details have not been sent.'); retry.hidden=false; }
  }
  retry.addEventListener('click',initialise);
  form.addEventListener('submit',async event => {
    event.preventDefault(); if(busy || button.disabled || !config) return;
    if(Date.now()<nextAttempt) { say('Please wait a moment before retrying. Your details are still here.'); return; }
    if(!pending && !form.reportValidity()) return;
    if(!token) { say('Please complete the verification before sending.'); return; }
    if(!pending) {
      if(!consent.checked) { consent.reportValidity(); return; }
      try { const values={}; new FormData(form).forEach((value,name)=>{const match=/^contact\[(.+)\]$/.exec(name); if(match) values[match[1]]=value;}); pending=buildRFQPayload(config,values,location.href); pending.website=trap.value; key=crypto.randomUUID(); }
      catch(error) { say(error.message); return; }
    }
    busy=true; button.disabled=true; lockFields(true); button.textContent='Sending request…'; say('Sending your request securely…');
    let saved=false;
    try {
      const {response,data}=await jsonFetch(endpoint+'/submissions',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({...pending,bot_token:token})});
      if([200,201].includes(response.status) && data.inquiry_id && data.reference) { saved=true; say(`Your request has been received. Reference: ${data.reference}. Our team will reply using the contact details you provided.`); button.textContent='Request received'; consentLabel.hidden=true; challenge.hidden=true; }
      else if(response.status===422 || response.status===413) { pending=null; key=null; lockFields(false); say(Object.values(data.field_errors||{}).join(' ') || 'Please review your details and shorten the message if needed.'); }
      else if(response.status===409) { say(data.error==='schema_changed'?'The enquiry form has changed. Your details are preserved. Check availability again, review the fields, and resubmit.':'This submission reference could not be reused. Your details are preserved; please contact Tessilo before resubmitting.'); if(data.error==='schema_changed'){pending=null;key=null;lockFields(false);config=null;retry.hidden=false;} else config=null; }
      else if(response.status===429) { const delay=response.headers.get('Retry-After'); const seconds=Number(delay); nextAttempt=Number.isFinite(seconds)&&seconds>0?Date.now()+seconds*1000:Math.max(Date.now()+60000,Date.parse(delay)||0); say('Too many attempts. Please wait before retrying the same request.'); }
      else if(response.status===403) say('Please complete a fresh verification, then retry the same request.');
      else say('We could not confirm receipt. Your request is preserved. Retry safely with the same reference.');
    } catch { say('Connection interrupted. Your request may have arrived. Retry safely to avoid sending it twice.'); }
    finally { busy=false; if(!saved){button.disabled=!config;button.textContent=pending?'Retry same request':'Send enquiry'; token='';if(widget!==undefined)window.turnstile.reset(widget);} }
  });
  initialise();
}
if(typeof document !== 'undefined') {
  const mount = scope => { if(scope.matches?.('[data-grow-form-id]')) setup(scope); scope.querySelectorAll('[data-grow-form-id]').forEach(setup); };
  mount(document); document.addEventListener('shopify:section:load', event => mount(event.target));
  new MutationObserver(records => { for(const record of records) for(const node of record.addedNodes) if(node.nodeType === 1 && (node.matches('[data-grow-form-id]') || node.querySelector('[data-grow-form-id]'))) mount(node); }).observe(document.body,{childList:true,subtree:true});
}
