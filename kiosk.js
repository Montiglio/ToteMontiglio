(() => {
  "use strict";

  const scriptURL = document.currentScript.src;
  function initialise() {
  const root = document.documentElement;
  const body = document.body;
  const page = body.dataset.kioskPage || "content";
  const readingKey = body.dataset.readingKey || "";
  const home = new URL("index.html", new URL(".", scriptURL)).href;
  const sectionsHome = new URL(home);
  sectionsHome.searchParams.set("view", "sections");
  const synth = window.speechSynthesis;
  const english = window.TOTEM_ENGLISH || { text: {}, attributes: {}, titles: {} };
  const load = (key, fallback) => {
    try { return sessionStorage.getItem(`totem-${key}`) || fallback; }
    catch { return fallback; }
  };
  const save = (key, value) => {
    try { sessionStorage.setItem(`totem-${key}`, value); }
    catch { /* Storage can be disabled in kiosk policies. */ }
  };

  let scale = Number(load("scale", "1"));
  let running = false;
  let paused = false;
  let highlighted = null;
  let continueReading = null;
  const scales = [1, 1.15, 1.3, 1.5, 1.75, 2];
  let lastActivity = Date.now();
  let lastReadProgress = Date.now();
  let visitVideoOpen = false;
  let generation = 0;
  let timer;
  let activeUtterance;
  let paolaContext;
  let paolaSource;
  let paolaAbort;
  const PAOLA_ENDPOINT = "http://127.0.0.1:8765/api/paola/speak";
  if (!scales.includes(scale)) scale = 1;
  const siteBase = new URL('.', scriptURL);
  const internal = url => url.protocol === siteBase.protocol && url.origin === siteBase.origin && url.pathname.startsWith(siteBase.pathname);
  const pageAddress = value => { const url = new URL(value, location.href); url.hash = ''; return url.href; };
  let trail = [];
  try {
    const pending = JSON.parse(load('navigation', 'null'));
    const savedTrail = history.state?.totemTrail;
    if (pending && pageAddress(pending.to) === pageAddress(location.href)) trail = pending.trail;
    else if (Array.isArray(savedTrail)) trail = savedTrail;
    trail = trail.filter(value => typeof value === 'string' && internal(new URL(value))).slice(-40);
    sessionStorage.removeItem('totem-navigation');
    history.replaceState({...history.state, totemTrail: trail}, '');
  } catch { trail = []; }
  function rememberNavigation(url, nextTrail = [...trail, location.href]) {
    if (internal(url)) save('navigation', JSON.stringify({to: url.href, trail: nextTrail.slice(-40)}));
  }

  const originalMain = document.querySelector("main");
  if (originalMain && !originalMain.id) originalMain.id = "contenuto";
  document.querySelectorAll(".skip-link").forEach((skip) => {
    skip.dataset.it ||= skip.textContent.trim();
    skip.dataset.en ||= "Skip to main content";
  });
  if (!document.querySelector(".skip-link") && originalMain) {
    const skip = document.createElement("a");
    skip.className = "skip-link";
    skip.href = `#${originalMain.id}`;
    skip.dataset.it = "Vai al contenuto principale";
    skip.dataset.en = "Skip to main content";
    skip.textContent = skip.dataset.it;
    body.prepend(skip);
  }

  const dock = document.createElement("aside");
  dock.className = "kiosk-dock";
  dock.setAttribute("aria-label", "Comandi accessibili del totem");
  dock.innerHTML = `
    <nav class="kiosk-links" aria-label="Destinazioni della pagina"></nav>
    <div class="kiosk-actions">
      <a href="${sectionsHome.href}" data-ui="home">Home</a>
      <button type="button" data-kiosk="back" data-ui="back">Indietro</button>
      <button type="button" data-kiosk="up" data-ui="up">Scorri su</button>
      <button type="button" data-kiosk="down" data-ui="down">Scorri giù</button>
      <button type="button" data-kiosk="plus" data-ui="plus">Testo +</button>
      <button type="button" data-kiosk="minus" data-ui="minus">Testo −</button>
      <button type="button" data-kiosk="contrast" data-ui="contrast" aria-pressed="false">Contrasto</button>
      <button type="button" data-kiosk="listen" data-ui="listen" aria-pressed="false">Ascolta</button>
      <button type="button" data-language="it" aria-pressed="true">IT · Italiano</button>
      <button type="button" data-language="en" aria-pressed="false">EN · English</button>
    </div>
    <div class="kiosk-summary">
      <p class="kiosk-status" role="status" aria-live="polite">Scegli una pagina o ascolta il testo.</p>
      <button type="button" data-kiosk="pause" data-ui="pause" hidden>Pausa</button>
      <button type="button" data-kiosk="help" data-ui="help" aria-expanded="false" aria-controls="kiosk-help">Aiuto</button>
      <button type="button" data-kiosk="settings" data-ui="settings" aria-expanded="false" aria-controls="kiosk-settings">Opzioni</button>
    </div>
    <section class="kiosk-settings" id="kiosk-settings" aria-labelledby="kiosk-settings-title" hidden>
      <div class="kiosk-settings-heading"><h2 id="kiosk-settings-title" data-ui="settings">Opzioni</h2><button type="button" data-kiosk="close-settings" data-ui="close">Chiudi</button></div>
      <label><span data-ui="voice">Voce</span><select aria-label="Voce di lettura"><option value="">Automatica</option></select></label>
      <label><span data-ui="speed">Velocità</span><select aria-label="Velocità di lettura"><option value="0.85" data-ui-option="slow">Lenta</option><option value="1" selected data-ui-option="normal">Normale</option><option value="1.1" data-ui-option="fast">Veloce</option></select></label>
      <label class="kiosk-section-label"><span data-ui="section">Cosa ascoltare</span><select data-reading-section></select></label>
      <button type="button" data-kiosk="read-section" data-ui="readSection">Ascolta selezione</button>
    </section>
    `;
  body.append(dock);

  const help = document.createElement("div");
  help.id = "kiosk-help";
  help.className = "kiosk-help";
  help.hidden = true;
  help.dataset.it = "Scegli IT o EN e usa Scorri per esplorare. Testo + ingrandisce fino al 200%. Ascolta legge la pagina; Pausa e Riprendi controllano la lettura. In Opzioni puoi scegliere una sezione, la voce e la velocità. Infopoint: 391 7277165. Email: infopointmontiglio@gmail.com.";
  help.dataset.en = "Choose IT or EN and use Scroll to explore. Text + enlarges text up to 200%. Listen reads the page; Pause and Resume control spoken reading. In Options you can choose a section, voice and speed. Information point: +39 391 7277165. Email: infopointmontiglio@gmail.com.";
  help.textContent = help.dataset.it;
  body.append(help);

  const links = dock.querySelector(".kiosk-links");
  const seenLinks = new Set();
  document.querySelectorAll(".site-header nav a, .main-nav a, .wheelchair-menu a").forEach((anchor) => {
    if (seenLinks.size >= 7 || seenLinks.has(anchor.href)) return;
    seenLinks.add(anchor.href);
    const copy = document.createElement("a");
    copy.href = anchor.href;
    copy.textContent = anchor.textContent.trim();
    links.append(copy);
  });
  if (!links.children.length) links.remove();
  else dock.querySelector('.kiosk-settings-heading').after(links);

  const status = dock.querySelector(".kiosk-status");
  const read = dock.querySelector("[data-kiosk=listen]");
  const [voicesSelect, rateSelect] = dock.querySelectorAll('select');
  const sectionSelect = dock.querySelector('[data-reading-section]');
  const settings = dock.querySelector('#kiosk-settings');
  const pauseRead = dock.querySelector('[data-kiosk=pause]');
  let readingSections = [];
  rateSelect.value = load("rate", "1");

  const uiText = {
    it: {
      home: "Home", back: "Indietro", up: "Scorri su", down: "Scorri giù", plus: "Testo +", minus: "Testo −",
      contrast: "Contrasto", listen: "Ascolta", stop: "Interrompi", voice: "Voce", speed: "Velocità", help: "Aiuto",
      pause: 'Pausa', resume: 'Riprendi', paused: 'Lettura in pausa.', settings: 'Opzioni', close: 'Chiudi',
      section: 'Cosa ascoltare', all: 'Tutta la pagina', intro: 'Introduzione', readSection: 'Ascolta selezione',
      slow: "Lenta", normal: "Normale", fast: "Veloce", automatic: "Automatica",
      ready: "Scegli una pagina o ascolta il testo.", noText: "Nessun testo disponibile da leggere.", finished: "Lettura conclusa.", stopped: "Lettura interrotta."
    },
    en: {
      home: "Home", back: "Back", up: "Scroll up", down: "Scroll down", plus: "Text +", minus: "Text −",
      contrast: "Contrast", listen: "Listen", stop: "Stop", voice: "Voice", speed: "Speed", help: "Help",
      pause: 'Pause', resume: 'Resume', paused: 'Reading paused.', settings: 'Options', close: 'Close',
      section: 'What to read', all: 'Whole page', intro: 'Introduction', readSection: 'Read selection',
      slow: "Slow", normal: "Normal", fast: "Fast", automatic: "Automatic",
      ready: "Choose a page or listen to the text.", noText: "There is no text available to read.", finished: "Reading complete.", stopped: "Reading stopped."
    }
  };

  const language = () => root.lang.startsWith("en") ? "en" : "it";
  const copy = (key) => uiText[language()][key];
  const measure = () => root.style.setProperty("--kiosk-dock", `${Math.ceil(dock.getBoundingClientRect().height)}px`);
  new ResizeObserver(measure).observe(dock);
  // Measure the original typography, including pages with fixed px or em sizes.
  // Apply an explicit size to text-bearing elements to avoid nested scaling.
  const textSizes = [];
  const excluded = '.kiosk-dock,.kiosk-help,.toolbar,.totem-controls,.totem-access-dock,.accessibility-dock,.voice-picker,.read-aloud-button,.sr-only,script,style';
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  const textParents = new Set();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const parent = node.parentElement;
    if (!node.textContent.trim() || parent.closest(excluded)) continue;
    textParents.add(parent);
    if (!parent.closest('[data-it][data-en]')) textNodes.push({ node, original: node.nodeValue, key: node.nodeValue.replace(/\s+/g, ' ').trim() });
  }
  // Dock destination links also keep their original addresses and translate labels.
  links.querySelectorAll('a').forEach(node => textNodes.push({node: node.firstChild, original: node.textContent, key: node.textContent}));
  const attributes = [];
  document.querySelectorAll('[alt],[aria-label],[title]').forEach(element => {
    if (element.closest(excluded)) return;
    ['alt','aria-label','title'].forEach(name => {
      if (element.hasAttribute(name)) attributes.push({element, name, original: element.getAttribute(name)});
    });
  });
  textParents.forEach(element => textSizes.push({ element, inline: element.style.fontSize, size: 0 }));
  const measureText = () => {
    body.classList.add('kiosk-scaling');
    root.style.setProperty('--kiosk-scale', 1);
    textSizes.forEach(({element,inline}) => { element.style.fontSize = inline; });
    textSizes.forEach(entry => { entry.size = parseFloat(getComputedStyle(entry.element).fontSize); });
  };
  const applyScale = () => {
    body.classList.add('kiosk-scaling');
    // Legacy CSS variables stay at 1; the common scale is applied once here.
    root.style.setProperty('--kiosk-scale', 1);
    root.style.setProperty('--kiosk-ui-scale', scale);
    textSizes.forEach(({element,size,inline}) => { element.style.fontSize = scale === 1 ? inline : (size * scale) + 'px'; });
    void body.offsetHeight;
    body.classList.remove('kiosk-scaling');
    body.dataset.textScale = String(scale);
    save('scale', scale);
    dock.querySelector('[data-kiosk=minus]').disabled = scale === scales[0];
    dock.querySelector('[data-kiosk=plus]').disabled = scale === scales[scales.length-1];
    measure();
  };
  measureText();
  window.addEventListener('resize', () => { measureText(); applyScale(); });
  applyScale();
  root.classList.toggle("high-contrast", load("contrast", "false") === "true");
  dock.querySelector("[data-kiosk=contrast]").setAttribute("aria-pressed", String(root.classList.contains("high-contrast")));

  function updateInterface() {
    const labels = uiText[language()];
    dock.querySelectorAll("[data-ui]").forEach((element) => {
      if (element === pauseRead) element.textContent = paused ? labels.resume : labels.pause;
      else if (element === read && running) element.textContent = labels.stop;
      else element.textContent = labels[element.dataset.ui];
    });
    dock.querySelectorAll("[data-ui-option]").forEach((option) => { option.textContent = labels[option.dataset.uiOption]; });
    help.textContent = help.dataset[language()];
    dock.setAttribute("aria-label", language() === "en" ? "Accessible kiosk controls" : "Comandi accessibili del totem");
    links.setAttribute('aria-label', language() === 'en' ? 'Page destinations' : 'Destinazioni della pagina');
    voicesSelect.setAttribute('aria-label', language() === 'en' ? 'Reading voice' : 'Voce di lettura');
    rateSelect.setAttribute('aria-label', language() === 'en' ? 'Reading speed' : 'Velocità di lettura');
    sectionSelect.setAttribute('aria-label', labels.section);
  }

  function setLanguage(nextLanguage, announce = true) {
    const next = nextLanguage === "en" ? "en" : "it";
    stop();
    root.lang = next;
    body.dataset.language = next;
    save("language", next);
    document.querySelectorAll("[data-it][data-en]").forEach((element) => { element.textContent = element.dataset[next]; });
    dock.querySelectorAll("[data-language]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.language === next)));
    textNodes.forEach(({node,original,key}) => {
      const translated = english.text[key];
      node.nodeValue = next === 'en' && translated ? original.match(/^\s*/)[0] + translated + original.match(/\s*$/)[0] : original;
    });
    attributes.forEach(({element,name,original}) => {
      const dynamic = name === 'alt' ? element.dataset[next === 'en' ? 'altEn' : 'altIt'] : null;
      element.setAttribute(name, dynamic || (next === 'en' ? english.attributes[original] || original : original));
    });
    document.dispatchEvent(new CustomEvent('totem-language', {detail: next}));
    updateInterface();
    refreshVoices();
    refreshSections();
    status.textContent = announce ? uiText[next].ready : uiText[next].ready;
    document.title = next === "en" && english.titles[readingKey] ? english.titles[readingKey] : (body.dataset.titleIt || document.title);
    window.scrollTo({ top: 0, behavior: "auto" });
    if (page === "home") originalMain?.scrollTo({ top: 0, behavior: "auto" });
    requestAnimationFrame(measure);
  }

  dock.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => setLanguage(button.dataset.language)));

  const score = (voice) => (/natural|neural|premium|enhanced/i.test(voice.name) ? 100 : 0) + (/google/i.test(voice.name) ? 40 : 0) + (voice.default ? 5 : 0);
  const available = () => synth ? synth.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith(language()) && voice.localService).sort((a, b) => score(b) - score(a)) : [];

  function refreshVoices() {
    if (language() === "it") {
      voicesSelect.replaceChildren(new Option("Paola · offline", ""));
      return;
    }
    const preferred = load(`voice-${language()}`, "");
    voicesSelect.replaceChildren(new Option(copy("automatic"), ""));
    available().forEach((voice) => voicesSelect.add(new Option(voice.name, voice.voiceURI)));
    voicesSelect.value = preferred;
    if (voicesSelect.selectedIndex < 0) voicesSelect.value = "";
  }

  function stop(message = "") {
    if (running) lastActivity = Date.now();
    generation += 1;
    running = false;
    paused = false;
    continueReading = null;
    highlighted?.classList.remove('kiosk-reading-current');
    highlighted = null;
    pauseRead.hidden = true;
    document.dispatchEvent(new CustomEvent('totem-reading', {detail:'stopped'}));
    clearTimeout(timer);
    synth?.cancel();
    activeUtterance = null;
    paolaAbort?.abort();
    paolaAbort = null;
    if (paolaSource) {
      paolaSource.onended = null;
      try { paolaSource.stop(); } catch { /* Already stopped. */ }
      paolaSource.disconnect();
      paolaSource = null;
    }
    if (read) {
      read.textContent = uiText[language()]?.listen || "Ascolta";
      read.setAttribute("aria-pressed", "false");
    }
    if (message && status) status.textContent = message;
  }

  function chunks(text) {
    const result = [];
    for (const sentence of text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]*\s*/g) || []) {
      let rest = sentence.trim();
      while (rest.length > 240) {
        let cut = rest.lastIndexOf(" ", 240);
        if (cut < 1) cut = 240;
        result.push(rest.slice(0, cut));
        rest = rest.slice(cut).trim();
      }
      if (rest) result.push(rest);
    }
    return result;
  }

  function readableBlocks() {
    const container = document.querySelector('#document-content') || originalMain;
    if (!container) return [];
    return [...container.querySelectorAll('h1,h2,h3,h4,p,li,figcaption,.destination-title,.destination-description')]
      .filter(element => !element.closest('[hidden],.media-controls') && element.getClientRects().length &&
        getComputedStyle(element).visibility !== 'hidden' && element.textContent.trim() &&
        !element.querySelector('h1,h2,h3,h4,p,li,figcaption'));
  }
  function refreshSections() {
    const previous = sectionSelect.value;
    const blocks = readableBlocks();
    readingSections = [];
    let section;
    blocks.forEach(element => {
      if (!section || element.matches('h1,h2')) {
        section = {heading:element.matches('h1,h2') ? element.innerText : copy('intro'),blocks:[]};
        readingSections.push(section);
      }
      section.blocks.push(element);
    });
    sectionSelect.replaceChildren(new Option(copy('all'),'all'));
    readingSections.forEach((section,index) => sectionSelect.add(new Option(section.heading,String(index))));
    sectionSelect.value = [...sectionSelect.options].some(option=>option.value===previous) ? previous : 'all';
  }
  function setSettings(open) {
    settings.hidden = !open;
    dock.querySelector('[data-kiosk=settings]').setAttribute('aria-expanded',String(open));
    if (open) { help.hidden = true; dock.querySelector('[data-kiosk=help]').setAttribute('aria-expanded','false'); }
  }
  function showReadingBlock(entry,index,total) {
    if (highlighted !== entry.element) {
      highlighted?.classList.remove('kiosk-reading-current');
      highlighted = entry.element;
      highlighted.classList.add('kiosk-reading-current');
      highlighted.scrollIntoView({block:'center',behavior:'auto'});
    }
    status.textContent = language() === 'en' ? 'Reading · ' + (index+1) + '/' + total : 'Lettura · ' + (index+1) + '/' + total;
  }
  async function togglePause() {
    if (!running) return;
    const token = generation;
    paused = !paused;
    pauseRead.textContent = copy(paused ? 'resume' : 'pause');
    lastActivity = Date.now();
    if (paused) {
      if (language() === 'it') await paolaContext?.suspend(); else synth?.pause();
      if (running && token === generation && paused) status.textContent = copy('paused');
    } else {
      if (language() === 'it') await paolaContext?.resume(); else synth?.resume();
      if (!running || token !== generation || paused) return;
      lastReadProgress = Date.now();
      status.textContent = language() === 'en' ? 'Reading resumed.' : 'Lettura ripresa.';
      if (!paolaSource && !activeUtterance) continueReading?.();
    }
  }
  function start(selected = false) {
    refreshSections();
    const chosenSection = selected && sectionSelect.value !== 'all' ? readingSections[Number(sectionSelect.value)] : null;
    const blocks = chosenSection ? chosenSection.blocks : readableBlocks();
    const queue = blocks.flatMap(element => chunks(element.innerText).map(text=>({text,element})));
    stop();
    if (!queue.length) { status.textContent = copy('noText'); return; }
    setSettings(false);
    running = true;
    lastReadProgress = Date.now();
    const token = generation;
    const isItalian = language() === 'it';
    let index = 0, preparing = false, pending = null;
    const rate = Number(rateSelect.value) || 1;
    read.textContent = copy('stop'); read.setAttribute('aria-pressed','true');
    pauseRead.hidden = false; pauseRead.textContent = copy('pause');
    document.dispatchEvent(new CustomEvent('totem-reading',{detail:'playing'}));
    const active = () => running && token === generation;
    let ready;
    if (isItalian) {
      try { paolaContext ||= new (window.AudioContext || window.webkitAudioContext)(); ready = paolaContext.resume(); }
      catch { stop('Riproduzione audio non disponibile in questo browser.'); return; }
      paolaAbort = new AbortController();
    } else if (!synth || !window.SpeechSynthesisUtterance) {
      stop('Spoken reading is not available in this browser.'); return;
    }
    const controller = paolaAbort;
    async function prepare(text) {
      const deadline = setTimeout(()=>controller.abort(),30000);
      try {
        let response;
        for(let attempt=0;attempt<20;attempt++) {
          response = await fetch(PAOLA_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,rate}),signal:controller.signal,cache:'no-store'});
          if(response.status!==503)break;
          await new Promise(resolve=>setTimeout(resolve,250));
        }
        if(!response.ok)throw new Error('Paola '+response.status);
        return await paolaContext.decodeAudioData(await response.arrayBuffer());
      } finally {clearTimeout(deadline);}
    }
    const preload = text => prepare(text).then(buffer=>({buffer}),error=>({error}));
    async function next() {
      if(!active() || paused || preparing || paolaSource || activeUtterance)return;
      if(index>=queue.length){stop(copy('finished'));return;}
      const entry=queue[index];
      if(isItalian) {
        preparing=true;
        try {
          await ready;
          pending ||= preload(entry.text);
          const result=await pending;
          if(!active())return;
          if(result.error)throw result.error;
          if(paused)return;
          pending=null;
          const source=paolaContext.createBufferSource(); paolaSource=source;
          source.buffer=result.buffer;source.connect(paolaContext.destination);
          source.onended=()=>{
            source.disconnect(); if(paolaSource===source)paolaSource=null;
            if(active()) { index++;timer=setTimeout(next,80); }
          };
          showReadingBlock(entry,index,queue.length);lastReadProgress=Date.now();source.start();
          if(index+1<queue.length)pending=preload(queue[index+1].text);
        } catch {if(active())stop('La lettura non è disponibile in questo momento. Chiedi assistenza all’Info Point.');}
        finally {preparing=false;}
      } else {
        const voices=available();
        const voice=voices.find(item=>item.voiceURI===voicesSelect.value)||voices[0];
        if(!voice){stop('No local English voice is installed. Please ask the information point for assistance.');return;}
        const utterance=new SpeechSynthesisUtterance(entry.text);activeUtterance=utterance;
        utterance.lang=voice.lang;utterance.voice=voice;utterance.rate=rate;
        utterance.onstart=()=>{if(active()){showReadingBlock(entry,index,queue.length);lastReadProgress=Date.now();}};
        utterance.onboundary=()=>{if(active())lastReadProgress=Date.now();};
        utterance.onend=()=>{
          if(activeUtterance===utterance)activeUtterance=null;
          if(active()){index++;timer=setTimeout(next,100);}
        };
        utterance.onerror=()=>{if(active())stop('The selected English voice is not available.');};
        lastReadProgress=Date.now();synth.speak(utterance);
      }
    }
    continueReading=next;
    status.textContent=isItalian ? 'Preparazione della lettura…' : 'Preparing spoken reading…';
    if(isItalian || synth.getVoices().length)next();
    else timer=setTimeout(()=>{refreshVoices();next();},700);
  }

  refreshVoices();
  synth?.addEventListener("voiceschanged", refreshVoices);
  voicesSelect.addEventListener("change", () => { stop(); save(`voice-${language()}`, voicesSelect.value); status.textContent = language() === "en" ? "Voice selected. Press Listen." : "Voce selezionata. Premi Ascolta."; });
  rateSelect.addEventListener("change", () => { stop(); save("rate", rateSelect.value); status.textContent = language() === "en" ? "Speed updated. Press Listen." : "Velocità aggiornata. Premi Ascolta."; });

  dock.addEventListener("click", (event) => {
    const button = event.target.closest("[data-kiosk]");
    if (!button) return;
    const action = button.dataset.kiosk;
    if (action === 'listen') { running ? stop(copy('stopped')) : start(); return; }
    if (action === 'pause') { togglePause().catch(()=>stop(copy('stopped'))); return; }
    if (action === 'read-section') { start(true); read.focus({preventScroll:true}); return; }
    if (action === 'settings') { setSettings(settings.hidden); return; }
    if (action === 'close-settings') { setSettings(false); dock.querySelector('[data-kiosk=settings]').focus(); return; }
    if (action === "help") { setSettings(false); help.hidden = !help.hidden; button.setAttribute("aria-expanded", String(!help.hidden)); return; }
    if (action === "contrast") {
      const on = root.classList.toggle("high-contrast");
      button.setAttribute("aria-pressed", String(on));
      save("contrast", on);
      return;
    }
    if (action === "plus" || action === "minus") {
      scale = scales[Math.max(0, Math.min(scales.length - 1, scales.indexOf(scale) + (action === "plus" ? 1 : -1)))];
      applyScale();
      status.textContent = language() === "en" ? `Text ${Math.round(scale * 100)}%` : `Testo ${Math.round(scale * 100)}%`;
      return;
    }
    if (action === 'back') {
      stop();
      const previous = trail[trail.length-1];
      if (previous) { const url = new URL(previous); rememberNavigation(url, trail.slice(0,-1)); location.href = url.href; }
      else if (document.referrer && internal(new URL(document.referrer)) && location.protocol !== 'file:') history.back();
      else location.href = home;
      return;
    }
    const viewer = !settings.hidden ? settings : !help.hidden ? help : page === "home" ? originalMain : document.querySelector("#document-viewer");
    const height = viewer ? viewer.clientHeight : innerHeight - dock.offsetHeight;
    (viewer || window).scrollBy({ top: (action === "down" ? 1 : -1) * height * .8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });

  const externalDialog = document.createElement('dialog');
  externalDialog.className = 'kiosk-external';
  externalDialog.setAttribute('aria-labelledby', 'external-title');
  externalDialog.innerHTML = '<h2 id="external-title"></h2><p class="external-instruction"></p><img alt="QR code"><p class="external-address"></p><button type="button"></button>';
  body.append(externalDialog);
  let externalFocus;
  externalDialog.querySelector('button').addEventListener('click', () => externalDialog.close());
  externalDialog.addEventListener('close', () => externalFocus?.focus({preventScroll:true}));
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a');
    if (!anchor) return;
    stop();
    const url = new URL(anchor.href, location.href);
    if (internal(url) && pageAddress(url.href) !== pageAddress(location.href)) rememberNavigation(url);
    if (!['http:','https:','mailto:','tel:'].includes(url.protocol)) return;
    if (['http:','https:'].includes(url.protocol) && url.origin === location.origin) return;
    event.preventDefault();
    externalFocus = anchor;
    const en = language() === 'en';
    const walkingTour = url.hostname === 'www.visitlmr.it' && url.pathname.replace(/\/$/,'') === '/it/esperienze/montiglio-monferrato-walking-tour';
    externalDialog.querySelector('h2').textContent = en ? 'Continue on your phone' : 'Continua sul tuo telefono';
    externalDialog.querySelector('.external-instruction').textContent = walkingTour
      ? (en ? 'Scan this QR code to open the walking tour on your phone.' : 'Inquadra il codice QR per aprire il percorso sul tuo telefono.')
      : (en ? 'Use the address or contact below on your phone.' : 'Usa questo indirizzo o recapito sul tuo telefono.');
    const qr = externalDialog.querySelector('img');
    qr.hidden = !walkingTour;
    if (walkingTour) qr.src = new URL('assethome/visit-lmr-qr.svg', scriptURL).href;
    externalDialog.querySelector('.external-address').textContent = url.href.replace(/^(tel:|mailto:)/,'');
    externalDialog.querySelector('button').textContent = en ? 'Back to the kiosk' : 'Torna al totem';
    externalDialog.showModal();
  }, true);
  document.addEventListener('auxclick', event => {
    const anchor = event.target.closest('a');
    if (anchor && new URL(anchor.href).origin !== location.origin) event.preventDefault();
  });
  window.addEventListener("pagehide", () => stop());
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      stop(copy('stopped'));
      if (!settings.hidden) { setSettings(false); dock.querySelector('[data-kiosk=settings]').focus(); }
      help.hidden = true;
      dock.querySelector("[data-kiosk=help]").setAttribute("aria-expanded", "false");
    }
  });

  const idleDialog = document.createElement("dialog");
  idleDialog.className = "kiosk-idle";
  idleDialog.setAttribute("aria-labelledby", "idle-title");
  idleDialog.innerHTML = "<h2 id=\"idle-title\">Vuoi continuare la visita?</h2><p>Tra 20 secondi il totem torna alla pagina iniziale e ripristina le impostazioni.</p><button type=\"button\">Continua la visita</button>";
  body.append(idleDialog);
  const IDLE_TIMEOUT_MS = 180000;
  const IDLE_WARNING_MS = 20000;
  let previousFocus;
  const resumeVisit = () => {
    lastActivity = Date.now();
    if (idleDialog.open) {
      idleDialog.close();
      previousFocus?.focus({ preventScroll: true });
    }
  };
  idleDialog.querySelector("button").addEventListener("click", resumeVisit);
  idleDialog.addEventListener("cancel", (event) => { event.preventDefault(); resumeVisit(); });
  document.addEventListener("totem-video-state", (event) => {
    visitVideoOpen = Boolean(event.detail?.open);
    lastActivity = Date.now();
    if (visitVideoOpen && running) stop();
  });
  ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"].forEach((eventName) => document.addEventListener(eventName, () => { if (!idleDialog.open) lastActivity = Date.now(); }, { passive: true, capture: true }));

  function resetVisit() {
    stop();
    try { Object.keys(sessionStorage).filter((key) => key.startsWith("totem-")).forEach((key) => sessionStorage.removeItem(key)); } catch { /* No storage. */ }
    if (page !== "home") { location.replace(home); return; }
    scale = 1;
    applyScale();
    root.classList.remove("high-contrast");
    dock.querySelector("[data-kiosk=contrast]").setAttribute("aria-pressed", "false");
    help.hidden = true;
    setSettings(false);
    if (externalDialog.open) externalDialog.close();
    setLanguage("it", false);
    rateSelect.value = "1";
    window.scrollTo(0, 0);
    body.setAttribute("data-playlist-intro", "");
    body.querySelector(".playlist-touch")?.focus({ preventScroll: true });
    resumeVisit();
  }

  function checkIdle() {
    if (visitVideoOpen) { lastActivity = Date.now(); return; }
    if (running && !paused) {
      if (Date.now() - lastReadProgress < 90000) { lastActivity = Date.now(); return; }
      stop(language() === 'en' ? 'Reading stopped: audio is not responding. Please try again.' : 'Lettura interrotta: audio non disponibile. Riprova.');
    }
    const elapsed = Date.now() - lastActivity;
    if (elapsed >= IDLE_TIMEOUT_MS) { resetVisit(); return; }
    if (page !== "home" && elapsed >= IDLE_TIMEOUT_MS - IDLE_WARNING_MS && !idleDialog.open) {
      previousFocus = document.activeElement;
      const english = language() === "en";
      idleDialog.querySelector("h2").textContent = english ? "Would you like to continue?" : "Vuoi continuare la visita?";
      idleDialog.querySelector("p").textContent = english ? "In 20 seconds the kiosk will return to the home page and reset its settings." : "Tra 20 secondi il totem torna alla pagina iniziale e ripristina le impostazioni.";
      idleDialog.querySelector("button").textContent = english ? "Continue visit" : "Continua la visita";
      idleDialog.showModal();
    }
  }

  setInterval(checkIdle, 1000);
  window.addEventListener("pageshow", checkIdle);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkIdle(); });
  body.dataset.titleIt = document.title;
  const requestedLanguage = new URLSearchParams(location.search).get("lang");
  setLanguage(requestedLanguage === "en" || requestedLanguage === "it" ? requestedLanguage : load("language", "it"), false);
  measure();
  }
  if (document.readyState === "loading" || document.currentScript?.defer) document.addEventListener("DOMContentLoaded", initialise, {once:true});
  else initialise();
})();
