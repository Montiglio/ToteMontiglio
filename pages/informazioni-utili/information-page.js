(() => {
  "use strict";

  const data = window.TOTEM_INFORMATION;
  const list = document.querySelector("[data-information-list]");
  const intro = document.querySelector("[data-information-intro]");
  if (!data || !list) return;

  const categoryLabels = {
    notice: {it: "Avviso", en: "Notice"},
    contact: {it: "Contatto", en: "Contact"},
    transport: {it: "Trasporti", en: "Transport"},
    office: {it: "Uffici e orari", en: "Offices and opening hours"},
    emergency: {it: "Emergenza", en: "Emergency"},
    service: {it: "Servizio", en: "Service"}
  };

  const items = Array.isArray(data.items) ? data.items : [];
  const contactValue = (item) => typeof item.contact === "string" ? item.contact : item.contact?.value || "";
  const contactDetails = (value, language) => {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return {label: "Email", href: `mailto:${value}`};
    if (/^\+?[0-9][0-9\s().\/-]{5,}$/.test(value)) {
      return {label: language === "en" ? "Telephone" : "Telefono", href: `tel:${value.replace(/[^+\d]/g, "")}`};
    }
    return {label: language === "en" ? "Contact" : "Contatto", href: ""};
  };

  function bilingual(element, values) {
    element.dataset.it = values?.it || '';
    element.dataset.en = values?.en || '';
    element.textContent = element.dataset.it;
  }
  function createCard(item, language) {
    const article = document.createElement("article");
    article.className = `information-card information-card--${item.priority || "normal"}`;

    const category = document.createElement("p");
    category.className = "information-category";
    bilingual(category, categoryLabels[item.category] || categoryLabels.notice);

    const title = document.createElement("h2");
    bilingual(title, item.title);

    const description = document.createElement("p");
    description.className = "information-description";
    bilingual(description, item.description);

    article.append(category, title, description);

    const value = contactValue(item);
    if (value) {
      const contact = document.createElement("p");
      contact.className = "information-contact";
      const details = contactDetails(value, language);
      const label = document.createElement("strong");
      bilingual(label, {it: contactDetails(value, "it").label + ": ", en: contactDetails(value, "en").label + ": "});
      contact.append(label);
      if (details.href) {
        const link = document.createElement("a");
        link.href = details.href;
        link.textContent = value;
        contact.append(link);
      } else {
        contact.append(document.createTextNode(value));
      }
      article.append(contact);
    }

    return article;
  }

  function createEmptyMessage(language) {
    const empty = document.createElement("p");
    empty.className = "information-empty";
    empty.textContent = language === "en"
      ? "There are currently no notices or information to report."
      : "Al momento non ci sono avvisi o informazioni da segnalare.";
    empty.dataset.it = "Al momento non ci sono avvisi o informazioni da segnalare.";
    empty.dataset.en = "There are currently no notices or information to report.";
    return empty;
  }

  if (intro) bilingual(intro, data.intro);
  list.replaceChildren(...(items.length
    ? items.map((item) => createCard(item, "it"))
    : [createEmptyMessage("it")]));
})();
