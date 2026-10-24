(() => {
  function setup(root = document) {
    root.querySelectorAll('[data-tessilo-scenes]').forEach(section => {
      if (section.classList.contains('is-enhanced')) return;
      const links = [...section.querySelectorAll('[data-scene-link]')];
      const panels = [...section.querySelectorAll('.tessilo-scene')];
      if (!links.length) return;
      function select(link) {
        links.forEach(item => item.setAttribute('aria-current', String(item === link)));
        panels.forEach(panel => { panel.hidden = `#${panel.id}` !== link.hash; });
      }
      links.forEach(link => link.addEventListener('click', event => { event.preventDefault(); select(link); }));
      select(links.find(link => link.hash === location.hash) || links[0]);
      section.classList.add('is-enhanced');
    });
  }
  setup();
  document.addEventListener('shopify:section:load', event => setup(event.target));
})();
