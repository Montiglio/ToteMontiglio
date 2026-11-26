(() => {
  "use strict";

  const bootstrapUrl = new URL(document.currentScript.src);
  const pageUrl = new URL("./", bootstrapUrl);
  const siteUrl = new URL("../../", bootstrapUrl);

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url.href;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Impossibile caricare ${url.pathname}`));
      document.head.append(script);
    });
  }

  async function loadCurrentData() {
    const freshDataUrl = new URL("information-data.js", pageUrl);
    freshDataUrl.searchParams.set("published", Date.now().toString());
    try {
      await loadScript(freshDataUrl);
    } catch {
      // Compatibilità con browser kiosk che non accettano query string sui file locali.
      await loadScript(new URL("information-data.js", pageUrl));
    }
  }

  async function start() {
    try {
      await loadCurrentData();
      await loadScript(new URL("information-page.js", pageUrl));
      await loadScript(new URL("readings-en.js", siteUrl));
      await loadScript(new URL("kiosk.js", siteUrl));
    } catch (error) {
      console.error(error);
      const list = document.querySelector("[data-information-list]");
      if (list) {
        const message = document.createElement("p");
        message.className = "information-empty";
        message.textContent = "Non è stato possibile caricare le informazioni. Ricaricare la pagina.";
        list.replaceChildren(message);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {once: true});
  } else {
    start();
  }
})();
