/*
 * Unica fonte degli eventi per la pagina italiana e la lettura inglese.
 * Per aggiornare il calendario, modificare soltanto l'elenco qui sotto.
 */
window.TOTEM_EVENTS = [
  {
    "status": "published",
    "image": "assets/eventiCurrent/nataleAlMuseo.jpeg",
    "href": "natale-museo.html",
    "month": {
      "it": "Dicembre 2026 – Gennaio 2027",
      "en": "December 2026 – January 2027"
    },
    "title": {
      "it": "Natale al Museo",
      "en": "Christmas at the Museum"
    },
    "alt": {
      "it": "Locandina dell'evento Natale al Museo",
      "en": "Poster for the Christmas at the Museum event"
    },
    "details": [
      {
        "it": "Esposizione temporanea a Montiglio. Apertura la notte del 24 dicembre, dopo la Messa di mezzanotte.",
        "en": "Temporary exhibition in Montiglio. Opens on Christmas Eve after Midnight Mass."
      }
    ]
  }
];

(() => {
  "use strict";

  const gallery = document.querySelector("[data-events-gallery]");
  if (!gallery) return;

  const cards = window.TOTEM_EVENTS.filter(event => event.status === "published").map((event, index) => {
    const article = document.createElement("article");
    article.className = "event-card";

    const image = document.createElement("img");
    image.src = event.image;
    image.alt = event.alt.it;
    image.dataset.altIt = event.alt.it;
    image.dataset.altEn = event.alt.en;
    image.decoding = "async";
    if (index > 0) image.loading = "lazy";

    const content = document.createElement("div");
    content.className = "event-card-content";

    const month = document.createElement("p");
    month.className = "event-number";
    month.textContent = event.month.it;
    Object.assign(month.dataset, event.month);

    const title = document.createElement("h2");
    title.textContent = event.title.it;
    Object.assign(title.dataset, event.title);

    content.append(month, title);
    const details = document.createElement('div');
    details.className = 'event-details';
    (event.details || []).forEach(text => {
      const paragraph = document.createElement('p');
      Object.assign(paragraph.dataset, text);
      paragraph.textContent = text.it;
      details.append(paragraph);
    });
    content.append(details);
    if (event.href) {
      const link = document.createElement("a");
      link.className = "button";
      link.href = event.href;
      link.dataset.it = `Scopri ${event.title.it}`;
      link.dataset.en = `Explore ${event.title.en}`;
      link.textContent = link.dataset.it;
      content.append(link);
    }
    article.append(content, image);
    return article;
  });

  gallery.replaceChildren(...cards);
})();
