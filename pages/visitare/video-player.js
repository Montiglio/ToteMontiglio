(() => {
  "use strict";

  const body = document.body;
  let buttons = [...document.querySelectorAll("[data-video-src]")];
  if (!buttons.length) {
    const videoPath = (body.dataset.localVideo || "").trim();
    if (!videoPath) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "visit-video-open";
    button.dataset.itLabel = "Guarda il video";
    button.dataset.enLabel = "Watch the video";
    button.dataset.videoSrc = videoPath;
    button.textContent = body.dataset.language === "en" ? button.dataset.enLabel : button.dataset.itLabel;
    const heroAction = document.querySelector(".hero-copy .primary-link");
    if (heroAction) heroAction.insertAdjacentElement("afterend", button);
    else (document.querySelector("main") || body).prepend(button);
    buttons = [button];
  }

  const pageDirectory = new URL(".", location.href);
  buttons = buttons.flatMap(button => {
    try {
      const candidate = new URL((button.dataset.videoSrc || "").trim(), location.href);
      if (candidate.origin !== location.origin || !candidate.pathname.startsWith(pageDirectory.pathname)) return [];
      const extension = candidate.pathname.split(".").pop().toLowerCase();
      if (extension !== "mp4" && extension !== "mpeg") return [];
      return [{ button, url: candidate.href, type: extension === "mp4" ? "video/mp4" : "" }];
    } catch {
      return [];
    }
  });
  if (!buttons.length) return;

  let openedFrom;
  const labels = {
    it: {
      loading: "Caricamento del video…",
      playing: "Video in riproduzione.",
      paused: "Video in pausa.",
      resume: "Premi Riprendi per avviare il video.",
      unavailable: "Video non disponibile o codec non supportato. Verifica il file video nella cartella Asset."
    },
    en: {
      loading: "Loading video…",
      playing: "Video playing.",
      paused: "Video paused.",
      resume: "Press Resume to start the video.",
      unavailable: "Video unavailable or codec not supported. Check the video file in the Asset folder."
    }
  };

  const dialog = document.createElement("dialog");
  dialog.className = "visit-video-dialog";
  dialog.setAttribute("aria-labelledby", "visit-video-title");
  dialog.innerHTML = `
    <section class="visit-video-panel">
      <h2 id="visit-video-title" data-it="Video" data-en="Video">Video</h2>
      <div class="visit-video-frame">
        <video playsinline controls preload="none" data-it-label="Video locale" data-en-label="Local video"></video>
      </div>
      <p class="visit-video-status" role="status" aria-live="polite" data-it="Caricamento del video…" data-en="Loading video…">Caricamento del video…</p>
      <div class="visit-video-actions" role="group" aria-label="Comandi video" data-it-label="Comandi video" data-en-label="Video controls">
        <button type="button" data-video-action="pause" data-it="Interrompi" data-en="Pause">Interrompi</button>
        <button type="button" data-video-action="restart" data-it="Torna all’inizio" data-en="Restart">Torna all’inizio</button>
        <button type="button" data-video-action="resume" data-it="Riprendi" data-en="Resume">Riprendi</button>
        <button type="button" data-video-action="close" data-it="Chiudi" data-en="Close">Chiudi</button>
      </div>
    </section>`;

  body.append(dialog);

  const video = dialog.querySelector("video");
  const status = dialog.querySelector(".visit-video-status");
  const language = () => body.dataset.language === "en" ? "en" : "it";
  let currentStatus = "loading";
  const setStatus = key => {
    currentStatus = key;
    status.textContent = labels[language()][key];
  };
  const announceOpen = open => document.dispatchEvent(new CustomEvent("totem-video-state", { detail: { open } }));

  function closeVideo() {
    if (dialog.open) dialog.close();
  }

  function cleanup() {
    video.pause();
    try { video.currentTime = 0; } catch { /* Metadata may not have loaded yet. */ }
    video.replaceChildren();
    video.load();
    announceOpen(false);
    openedFrom?.focus({ preventScroll: true });
    openedFrom = null;
  }

  function playVideo() {
    const playback = video.play();
    if (playback?.catch) playback.catch(() => {
      if (dialog.open) setStatus(video.error ? "unavailable" : "resume");
    });
  }

  function openVideo(videoConfig) {
    openedFrom = document.activeElement;
    setStatus("loading");
    dialog.showModal();
    announceOpen(true);
    const source = document.createElement("source");
    source.src = videoConfig.url;
    if (videoConfig.type) source.type = videoConfig.type;
    video.append(source);
    video.load();
    playVideo();
  }

  buttons.forEach(videoConfig => videoConfig.button.addEventListener("click", () => openVideo(videoConfig)));
  dialog.querySelector("[data-video-action=close]").addEventListener("click", closeVideo);
  dialog.querySelector("[data-video-action=pause]").addEventListener("click", () => {
    video.pause();
    setStatus("paused");
  });
  dialog.querySelector("[data-video-action=restart]").addEventListener("click", () => {
    try { video.currentTime = 0; } catch { /* Metadata may not have loaded yet. */ }
    playVideo();
  });
  dialog.querySelector("[data-video-action=resume]").addEventListener("click", playVideo);
  dialog.addEventListener("cancel", event => { event.preventDefault(); closeVideo(); });
  dialog.addEventListener("close", cleanup);
  video.addEventListener("playing", () => setStatus("playing"));
  video.addEventListener("pause", () => {
    if (dialog.open && !video.ended && !video.error) setStatus("paused");
  });
  video.addEventListener("error", () => {
    if (dialog.open) setStatus("unavailable");
  });
  video.addEventListener("ended", closeVideo);

  document.addEventListener("totem-language", event => {
    const next = event.detail === "en" ? "en" : "it";
    setStatus(currentStatus);
    dialog.querySelector(".visit-video-actions").setAttribute("aria-label", dialog.querySelector(".visit-video-actions").dataset[`${next}Label`]);
    video.setAttribute("aria-label", video.dataset[`${next}Label`]);
    if (!dialog.open) buttons.forEach(({ button: videoButton }) => {
      videoButton.textContent = videoButton.dataset[`${next}Label`] || videoButton.dataset.itLabel;
    });
  });
})();
