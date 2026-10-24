if(!customElements.get('tessilo-dimensions-3d'))customElements.define('tessilo-dimensions-3d',class extends HTMLElement{
  connectedCallback(){if(this.bound)return;this.bound=true;this.listener=e=>{if(e.target.closest('[data-open]'))this.open();if(e.target.closest('[data-close]'))this.close();};this.addEventListener('click',this.listener);}
  emit(name){this.dispatchEvent(new CustomEvent(`tessilo:3d-${name}`,{bubbles:true}));}
  async open(){
    if(this.dispose)return true;if(this.loading)return false;this.loading=true;
    const status=this.querySelector('[data-status]'),button=this.querySelector('[data-open]');
    if(button)button.disabled=true;if(status)status.textContent='Loading dimension reference…';
    const controller=new AbortController();this.controller=controller;
    try{
      const response=await fetch(this.dataset.source,{signal:controller.signal});if(!response.ok)throw new Error('Dimensions unavailable');
      const data=await response.json(),p=data.products.find(p=>p.sku===this.dataset.sku);
      if(!p||p.verified!==true||!p.width||!p.depth||!(p.height||p.shapeHeightEstimate)){if(status)status.textContent='The 3D model is being reviewed. Please use the source dimensions image or ask us for confirmed measurements.';this.emit('failed');return false;}
      const notes=this.querySelector('[data-notes]');notes?.replaceChildren(...p.notes.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
      const module=await import(this.dataset.module);if(!this.isConnected||controller.signal.aborted)return false;
      this.querySelector('[data-viewer]').hidden=false;this.dispose=module.mount(this,p);
      if(button)button.hidden=true;if(status)status.textContent='Source-based dimension reference. Form and upholstery remain illustrative.';
      if(!this.hasAttribute('data-embed'))this.querySelector('[data-close]')?.focus({preventScroll:true});
      this.emit('ready');return true;
    }catch(error){
      if(error.name!=='AbortError'&&status)status.textContent='The 3D view is unavailable on this device. Please use the original dimensions image or contact Tessilo.';
      this.querySelector('[data-viewer]').hidden=true;this.emit('failed');return false;
    }finally{this.loading=false;if(button)button.disabled=false;}
  }
  close(){this.controller?.abort();this.dispose?.();this.dispose=null;this.querySelector('[data-viewer]').hidden=true;const button=this.querySelector('[data-open]');if(button){button.hidden=false;if(!this.hasAttribute('data-embed'))button.focus({preventScroll:true});}this.emit('closed');}
  disconnectedCallback(){this.controller?.abort();this.dispose?.();this.dispose=null;this.removeEventListener('click',this.listener);this.bound=false;}
});
