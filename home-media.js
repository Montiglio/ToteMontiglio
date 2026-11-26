(() => {
  "use strict";
  if (new URLSearchParams(location.search).get('view') === 'sections') {
    document.body.removeAttribute('data-playlist-intro');
  }
  const stage = document.querySelector('.promotional-media');
  const fallback = document.querySelector('#promotional-fallback');
  const controls = document.querySelector('.media-controls');
  if (!stage || !fallback || !controls) return;
  document.querySelector('.playlist-touch')?.addEventListener('click', () => {
    document.body.removeAttribute('data-playlist-intro');
    document.querySelector('main')?.focus({preventScroll:true});
  });
  const directory = new URL('assethome/video/', document.currentScript.src);
  const manifestURL = new URL('home-media-playlist.js', document.currentScript.src);
  const images = new Set(['jpeg','jpg','gif','png','webp']);
  const videos = new Set(['mp4','m4v','webm','ogv','ogg','mov','mkv','avi','wmv']);
  const order = new Intl.Collator('it', {numeric:true,sensitivity:'base'});
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const IMAGE_MS = 10000, REFRESH_MS = 30000, STALL_MS = 30000, AUTO_RESUME_MS = 60000;
  let playlist = normalise(window.TOTEM_HOME_MEDIA?.files || []);
  let currentName = '', current = null, generation = 0;
  let slideTimer, loadTimer, watchdog, refreshTimer, request, requestDeadline;
  let disposed = false, listingWarning = false, remaining = IMAGE_MS, slideStarted = 0;
  let paused = reducedMotion.matches;
  let autoResumeTimer, autoResumeAt = 0;
  const failed = new Set();
  const en = () => document.documentElement.lang === 'en';
  const pauseButton = controls.querySelector('[data-media=pause]');

  function normalise(names) {
    return [...new Set(names)].filter(name => typeof name === 'string' && !/[\\/]/.test(name))
      .map(name => ({name, extension:name.split('.').pop().toLowerCase()}))
      .filter(item => images.has(item.extension) || videos.has(item.extension))
      .sort((a,b) => order.compare(a.name,b.name) || a.name.localeCompare(b.name))
      .map(item => ({...item,url:new URL(encodeURIComponent(item.name),directory).href}));
  }
  function updateLabel() {
    stage.setAttribute('aria-label', en() ? 'Promotional multimedia' : 'Contenuti multimediali promozionali');
    controls.setAttribute('aria-label', en() ? 'Multimedia controls' : 'Controlli dei contenuti multimediali');
    pauseButton.textContent = paused ? (en() ? 'Resume' : 'Riprendi') : (en() ? 'Pause' : 'Pausa');
    pauseButton.setAttribute('aria-pressed', String(paused));
    stage.dataset.mediaPaused = String(paused);
    if (current?.tagName === 'IMG') {
      current.alt = currentName === '02-NataleAlMuseo.jpeg'
        ? (en() ? 'Poster for Christmas at the Museum of Time 2026.' : 'Locandina del Natale al Museo del Tempo 2026.')
        : (en() ? 'Promotional image: ' : 'Immagine promozionale: ') + currentName.replace(/\.[^.]+$/, '').replace(/^\d+[-_ ]*/, '').replace(/_/g,' ');
    }
  }
  function pausePlayback() {
    if (slideStarted) remaining = Math.max(0, remaining - (performance.now() - slideStarted));
    slideStarted = 0;
    clearTimeout(slideTimer);
    current?.tagName === 'VIDEO' && current.pause();
  }
  function resumePlayback() {
    if (!current || paused || disposed || document.hidden) return;
    if (current.tagName === 'VIDEO') {
      const element = current;
      element.play().catch(() => { if (current === element) setPaused(true); });
    } else if (stage.dataset.mediaState === 'image') {
      clearTimeout(slideTimer);
      slideStarted = performance.now();
      slideTimer = setTimeout(() => { slideStarted = 0; advance(); }, remaining);
    }
  }
  function scheduleAutoResume() {
    clearTimeout(autoResumeTimer);
    if (!paused || !autoResumeAt || disposed) return;
    autoResumeTimer = setTimeout(() => setPaused(false), Math.max(0, autoResumeAt - Date.now()));
  }
  function setPaused(value, resumeAutomatically = false) {
    paused = value;
    // Only pauses requested through the media controls expire automatically.
    autoResumeAt = paused && resumeAutomatically ? Date.now() + AUTO_RESUME_MS : 0;
    scheduleAutoResume();
    if (paused) pausePlayback(); else resumePlayback();
    updateLabel();
  }
  function clearCurrent() {
    generation++;
    clearTimeout(slideTimer); clearTimeout(loadTimer); clearInterval(watchdog);
    slideStarted = 0; remaining = IMAGE_MS;
    if (current) {
      current.onload = current.onerror = current.onended = current.onplaying = current.ontimeupdate = current.onloadeddata = null;
      if (current.tagName === 'VIDEO') { current.pause(); current.removeAttribute('src'); current.load(); }
      current.remove(); current = null;
    }
    fallback.hidden = false;
  }
  function advance(direction = 1) {
    if (disposed || document.hidden) return;
    const previous = playlist.findIndex(item => item.name === currentName);
    let start = previous >= 0 ? (previous + direction + playlist.length) % playlist.length : 0;
    for (let offset=0; offset<playlist.length; offset++) {
      const item = playlist[(start + direction*offset + playlist.length) % playlist.length];
      if (!failed.has(item.name)) { play(item); return; }
    }
    clearCurrent(); stage.dataset.mediaState = playlist.length ? 'unavailable' : 'empty';
  }
  function play(item) {
    clearCurrent(); currentName = item.name;
    const token = generation, isImage = images.has(item.extension);
    const element = document.createElement(isImage ? 'img' : 'video');
    current = element; element.className = 'promotional-slide'; element.hidden = true;
    stage.dataset.mediaFile = item.name; stage.dataset.mediaState = 'loading';
    const active = () => !disposed && generation === token;
    const fail = () => {
      if (!active()) return;
      failed.add(item.name); console.warn('Contenuto multimediale non riproducibile: ' + item.name); advance();
    };
    const ready = () => {
      if (!active()) return;
      clearTimeout(loadTimer); fallback.hidden = true; element.hidden = false;
      stage.dataset.mediaState = isImage ? 'image' : 'video'; updateLabel();
    };
    element.onerror = fail; loadTimer = setTimeout(fail,STALL_MS); stage.append(element);
    if (isImage) {
      element.onload = () => { ready(); if (active()) resumePlayback(); };
      element.src = item.url;
    } else {
      element.id = 'promotional-video'; element.muted = element.defaultMuted = true;
      element.autoplay = false; element.playsInline = true; element.preload = 'auto';
      element.tabIndex = -1; element.setAttribute('aria-hidden','true');
      let lastProgress = Date.now();
      element.ontimeupdate = () => { lastProgress = Date.now(); };
      element.onloadeddata = () => { ready(); if (active()) resumePlayback(); };
      element.onplaying = () => { lastProgress = Date.now(); };
      watchdog = setInterval(() => {
        if (paused || document.hidden || element.paused) { lastProgress = Date.now(); return; }
        if (Date.now()-lastProgress > STALL_MS) fail();
      },5000);
      element.onended = () => { if (active() && !paused) advance(); };
      element.src = item.url;
    }
    updateLabel();
  }
  function refresh() {
    if (disposed || request) return;
    const script = document.createElement('script'), url = new URL(manifestURL);
    url.searchParams.set('v',Date.now()); script.src=url.href; request=script;
    const finish = () => { clearTimeout(requestDeadline); script.onload=script.onerror=null; script.remove(); if(request===script)request=null; };
    const fail = () => {
      if(request!==script)return;
      if(!disposed && !listingWarning) { console.warn("Elenco multimediale non aggiornabile. Resta attiva l'ultima sequenza disponibile."); listingWarning=true; }
      finish();
    };
    script.onload = () => {
      if(disposed || request!==script)return;
      if(!Array.isArray(window.TOTEM_HOME_MEDIA?.files)){fail();return;}
      playlist=normalise(window.TOTEM_HOME_MEDIA.files); listingWarning=false; finish();
      if(!current && !document.hidden){failed.clear();advance();}
    };
    script.onerror=fail; requestDeadline=setTimeout(fail,8000); document.head.append(script);
  }
  function start() {
    disposed=false;
    if(!current && !document.hidden){failed.clear();advance();}
    scheduleAutoResume();
    clearInterval(refreshTimer);refreshTimer=setInterval(refresh,REFRESH_MS);
  }
  controls.addEventListener('click',event=>{
    const button=event.target.closest('[data-media]'); if(!button)return;
    if(button.dataset.media==='pause')setPaused(!paused,true);
    else {setPaused(true,true);advance(button.dataset.media==='previous'?-1:1);}
  });
  reducedMotion.addEventListener('change',event=>{if(event.matches)setPaused(true);});
  document.addEventListener('totem-language',updateLabel);
  document.addEventListener('totem-reading',event=>{if(event.detail==='playing')setPaused(true);});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)pausePlayback();
    else {scheduleAutoResume();resumePlayback();}
  });
  stage.addEventListener('contextmenu',event=>event.preventDefault());
  window.addEventListener('pagehide',()=>{
    disposed=true;clearInterval(refreshTimer);clearTimeout(requestDeadline);clearTimeout(autoResumeTimer);
    if(request){request.onload=request.onerror=null;request.remove();request=null;}
    clearCurrent();
  });
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  updateLabel();start();
})();
