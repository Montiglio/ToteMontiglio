/*
 * Unica fonte degli eventi per la pagina italiana e la lettura inglese.
 * Per aggiornare il calendario, modificare soltanto l'elenco qui sotto.
 */
window.TOTEM_EVENTS = [
  {
    "status": "published",
    "image": "assets/eventi/nataleAlMuseo.jpeg",
    "month": {
      "it": "Dicembre-Gennaio",
      "en": "December-January"
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
        "it": "Dal 24 Dicembre, ore 24:00. Organizza la Proloco di Montiglio Monferrato.",
        "en": "From 24 December, at 24:00. Organised by Proloco of Montiglio Monferrato."
      },
      
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
    article.append(image, content);
    return article;
  });

  gallery.replaceChildren(...cards);
})();
