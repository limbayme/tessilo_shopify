if (!customElements.get('tessilo-media-switch')) customElements.define('tessilo-media-switch', class extends HTMLElement {
  connectedCallback() {
    if(this.bound) return; this.bound = true;
    this.epoch = 0; this.controller = new AbortController(); const signal = this.controller.signal;
    this.photo = this.querySelector('[data-photo-panel]'); this.model = this.querySelector('[data-model-panel]');
    this.tabs = this.querySelector('[role=tablist]'); this.photoTab = this.querySelector('[data-media-photo]'); this.modelTab = this.querySelector('[data-media-model]');
    this.status = this.querySelector('[data-media-status]'); this.widget = this.querySelector('tessilo-dimensions-3d');
    this.photoTab.addEventListener('click', () => this.showPhoto(), {signal});
    this.modelTab.addEventListener('click', () => this.showModel(), {signal});
    this.tabs.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const target = event.key === 'Home' ? this.photoTab : event.key === 'End' ? this.modelTab : event.target === this.photoTab ? this.modelTab : this.photoTab;
      target.focus();
      // Manual activation: Enter/Space switches; arrows move focus without downloading 3D.
    }, {signal});
    this.widget.addEventListener('tessilo:3d-closed', () => this.selectPhoto(), {signal});
    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      this.unsubscribeVariant = subscribe(PUB_SUB_EVENTS.variantChange, ({data}) => {
        if (data.sectionId !== this.dataset.section) return;
        this.showPhoto(); this.tabs.hidden = true; this.available = false;
        this.dataset.sku = data.variant?.sku || ''; this.widget.dataset.sku = this.dataset.sku;
        this.checkAvailability();
      });
    }
    this.checkAvailability();
  }
  async checkAvailability() {
    const sku = this.dataset.sku;
    try {
      const response = await fetch(this.dataset.source, {signal:this.controller.signal}); if(!response.ok) return;
      const data = await response.json(); if (sku !== this.dataset.sku) return; const item = data.products.find(p => p.sku === sku);
      // Only individually approved models. Estimated silhouette height is not a source measurement.
      // The renderer labels that distinction and independently enforces approval.
      this.available = item?.verified === true && item.width > 0 && item.depth > 0 && (item.height > 0 || item.shapeHeightEstimate > 0);
      if (!this.available || !this.isConnected) return;
      this.tabs.hidden = false;
      this.photo.setAttribute('role','tabpanel'); this.photo.setAttribute('aria-labelledby',this.photoTab.id);
      this.model.setAttribute('role','tabpanel'); this.model.setAttribute('aria-labelledby',this.modelTab.id);
    } catch (_) { /* Photography remains fully usable when dimension metadata is unavailable. */ }
  }
  selectPhoto() {
    this.photo.hidden = false; this.model.hidden = true;
    this.photoTab.setAttribute('aria-selected','true'); this.modelTab.setAttribute('aria-selected','false');
    this.photoTab.tabIndex = 0; this.modelTab.tabIndex = -1; this.removeAttribute('aria-busy');
  }
  showPhoto() {
    this.epoch++; this.widget.close?.(); this.selectPhoto(); this.status.hidden = true;
  }
  async showModel() {
    if(!this.available || this.getAttribute('aria-busy') === 'true' || this.modelTab.getAttribute('aria-selected') === 'true') return;
    const epoch = ++this.epoch;
    this.setAttribute('aria-busy','true'); this.status.hidden = false; this.status.textContent = 'Preparing the 3D view. Your photograph stays here while it loads.';
    await customElements.whenDefined('tessilo-dimensions-3d');
    if(epoch !== this.epoch || !this.isConnected) return;
    // The canvas needs a measurable container while mounting. Keep it covered by the photograph.
    this.model.hidden = false; this.model.classList.add('is-preparing');
    let ready = false;
    try { ready = await this.widget.open(); } catch (_) { ready = false; }
    this.model.classList.remove('is-preparing');
    if(epoch !== this.epoch || !this.isConnected) return;
    this.removeAttribute('aria-busy');
    if(!ready) {
      this.selectPhoto(); this.status.hidden = false;
      this.status.textContent = 'The 3D view is not available right now. You can keep exploring the photos and dimension drawing.';
      return;
    }
    this.photo.hidden = true; this.model.hidden = false; this.status.hidden = true;
    this.photoTab.setAttribute('aria-selected','false'); this.modelTab.setAttribute('aria-selected','true');
    this.photoTab.tabIndex = -1; this.modelTab.tabIndex = 0;
  }
  disconnectedCallback() { this.epoch++; this.controller?.abort(); this.unsubscribeVariant?.(); this.widget?.close?.(); this.bound = false; }
});
