(function () {
  const controls = document.querySelector(".totem-controls");
  const status = document.getElementById("assistive-status");
  const scales = [1, 1.18, 1.35, 1.52];
  let scaleLevel = 0;
  let voiceLoadTimer = null;
  let consecutiveBackClicks = 0;

  const setStatus = (message) => {
    if (status) {
      status.textContent = message;
    }
  };

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scrollOptions = (top) => ({
    top,
    behavior: prefersReducedMotion() ? "auto" : "smooth"
  });

  const applyTextScale = () => {
    document.documentElement.style.setProperty("--content-text-scale", scales[scaleLevel]);
    setStatus("Testo impostato al " + Math.round(scales[scaleLevel] * 100) + " per cento.");
  };

  const scrollToElement = (element) => {
    if (!element) {
      window.scrollTo(scrollOptions(0));
      return;
    }

    const controlsHeight = controls ? controls.offsetHeight : 0;
    const top = window.scrollY + element.getBoundingClientRect().top - 24;
    window.scrollTo(scrollOptions(Math.max(0, top - controlsHeight * 0.15)));
  };

  const visibleText = () => {
    const controlsHeight = controls ? controls.offsetHeight : 0;
    const contentBottom = window.innerHeight - controlsHeight;
    const readableBlocks = document.querySelectorAll("header, main section");

    return Array.from(readableBlocks)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < contentBottom;
      })
      .map((element) => element.innerText)
      .join(". ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const currentSectionIndex = () => {
    const sections = Array.from(document.querySelectorAll("main section[id]"));
    const referenceTop = Math.max(80, Math.min(window.innerHeight * 0.32, 280));
    let currentIndex = 0;

    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= referenceTop) {
        currentIndex = index;
      }
    });

    return { sections, currentIndex };
  };

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }

    const action = target.dataset.action;

    if (action === "back") {
      consecutiveBackClicks += 1;
      if (consecutiveBackClicks >= 2) {
        window.location.href = "../../index.html";
        return;
      }
      const { sections, currentIndex } = currentSectionIndex();
      scrollToElement(sections[Math.max(0, currentIndex - 1)]);
      setStatus("Sezione precedente.");
    } else {
      consecutiveBackClicks = 0;
    }

    if (action === "listen") {
      if (!("speechSynthesis" in window)) {
        setStatus("La lettura vocale non è disponibile in questo browser.");
        return;
      }

      if (window.speechSynthesis.speaking || target.getAttribute("aria-pressed") === "true") {
        clearTimeout(voiceLoadTimer);
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.cancel();
        target.setAttribute("aria-pressed", "false");
        setStatus("Lettura interrotta.");
        return;
      }

      const text = visibleText();
      if (!text) {
        setStatus("Nessun testo visibile da leggere.");
        return;
      }

      const speak = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const italianVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith("it"));

        if (italianVoice) {
          utterance.voice = italianVoice;
        }

        utterance.lang = "it-IT";
        utterance.rate = 0.92;
        utterance.onend = () => {
          target.setAttribute("aria-pressed", "false");
          setStatus("Lettura conclusa.");
        };
        utterance.onerror = () => {
          target.setAttribute("aria-pressed", "false");
          setStatus("Lettura vocale non riuscita.");
        };

        window.speechSynthesis.cancel();
        target.setAttribute("aria-pressed", "true");
        window.speechSynthesis.speak(utterance);
        setStatus("Lettura in corso.");
      };

      clearTimeout(voiceLoadTimer);
      if (!window.speechSynthesis.getVoices().length) {
        target.setAttribute("aria-pressed", "true");
        setStatus("Preparazione lettura vocale.");
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          clearTimeout(voiceLoadTimer);
          speak();
        };
        voiceLoadTimer = setTimeout(speak, 600);
        return;
      }

      speak();
    }

    if (action === "text-plus") {
      scaleLevel = Math.min(scaleLevel + 1, scales.length - 1);
      applyTextScale();
    }

    if (action === "text-minus") {
      scaleLevel = Math.max(scaleLevel - 1, 0);
      applyTextScale();
    }

    if (action === "contrast") {
      const enabled = target.getAttribute("aria-pressed") !== "true";
      target.setAttribute("aria-pressed", String(enabled));
      document.documentElement.classList.toggle("high-contrast", enabled);
      setStatus(enabled ? "Contrasto alto attivato." : "Contrasto standard attivato.");
    }

    if (action === "scroll-down" || action === "scroll-up") {
      const controlsHeight = controls ? controls.offsetHeight : 0;
      const direction = action === "scroll-down" ? 1 : -1;
      const distance = Math.max(240, window.innerHeight - controlsHeight - 72);
      window.scrollBy({
        top: direction * distance,
        behavior: prefersReducedMotion() ? "auto" : "smooth"
      });
      setStatus(action === "scroll-down" ? "Scorrimento in basso." : "Scorrimento in alto.");
    }
  });
})();
