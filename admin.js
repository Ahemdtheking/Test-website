(() => {
  const store = window.NoobytesSiteData;
  if (!store) {
    console.error("The admin dashboard could not load its local data helper.");
    return;
  }

  let data = store.load();
  let toastTimer;
  const byId = (id) => document.getElementById(id);
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const save = (message) => {
    if (!store.save(data)) {
      showToast("Couldn't save. Check browser storage and try again.", "error");
      return false;
    }
    render();
    if (message) showToast(message);
    return true;
  };
  const showToast = (message, type = "success") => {
    const toast = byId("toast");
    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
  };
  const dateLabel = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown date" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
  };
  const shortDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  };
  const getStatusClass = (status) => ["new", "replied", "in-progress", "closed"].includes(status) ? status : "new";
  const statusName = (status) => ({ new: "New", replied: "Replied", "in-progress": "In progress", closed: "Closed" })[getStatusClass(status)];
  const createStatus = (inquiry) => {
    const select = make("select", `status-select status-${getStatusClass(inquiry.status)}`);
    select.setAttribute("aria-label", `Status for ${inquiry.name}`);
    [["new", "New"], ["replied", "Replied"], ["in-progress", "In progress"], ["closed", "Closed"]].forEach(([value, label]) => {
      const option = make("option", "", label);
      option.value = value;
      option.selected = getStatusClass(inquiry.status) === value;
      select.append(option);
    });
    select.addEventListener("change", () => {
      inquiry.status = select.value;
      save("Inquiry status updated.");
    });
    return select;
  };
  const createActionButton = (label, className, action, ariaLabel) => {
    const button = make("button", className, label);
    button.type = "button";
    button.setAttribute("aria-label", ariaLabel);
    button.addEventListener("click", action);
    return button;
  };

  const setView = (viewName) => {
    const sectionNames = { overview: "Overview", inquiries: "Inquiries", products: "Products", services: "Services", settings: "Site settings" };
    document.querySelectorAll(".view-panel").forEach((panel) => panel.classList.toggle("is-visible", panel.id === `view-${viewName}`));
    document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.view === viewName));
    byId("current-section").textContent = sectionNames[viewName] || sectionNames.overview;
    document.title = `${byId("current-section").textContent} | Noobytes Studio Admin`;
    document.querySelector(".admin-main").classList.remove("menu-open");
    document.body.classList.remove("menu-open");
    byId("sidebar-backdrop").classList.remove("is-visible");
    byId("sidebar-toggle").setAttribute("aria-expanded", "false");
  };

  const renderChart = () => {
    const now = new Date();
    const counts = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(now.getDate() - (6 - index));
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      const count = data.inquiries.filter((item) => {
        const received = new Date(item.date);
        return !Number.isNaN(received.getTime()) && received >= date && received < next;
      }).length;
      return { date, count };
    });
    const max = Math.max(4, ...counts.map((item) => item.count));
    const bars = byId("chart-bars");
    const labels = byId("chart-labels");
    bars.replaceChildren();
    labels.replaceChildren();
    counts.forEach(({ date, count }) => {
      const column = make("div", "chart-column");
      const bar = make("span", `chart-bar${count ? " has-value" : ""}`);
      bar.style.height = `${Math.max(3, count / max * 100)}%`;
      bar.title = `${count} ${count === 1 ? "inquiry" : "inquiries"}`;
      column.append(bar);
      bars.append(column);
      labels.append(make("span", "", new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date)));
    });
  };

  const openInquiry = (inquiry) => {
    const detail = byId("inquiry-detail");
    detail.replaceChildren();
    const fields = [
      ["Name", inquiry.name], ["Email", inquiry.email], ["Phone", inquiry.phone || "Not provided"],
      ["Company", inquiry.company || "Not provided"], ["Service", inquiry.service || "Not specified"],
      ["Budget", inquiry.budget || "Not specified"], ["Timeline", inquiry.timeline || "Not specified"],
      ["Source", inquiry.source || "Not specified"], ["Received", dateLabel(inquiry.date)]
    ];
    const grid = make("div", "inquiry-fields");
    fields.forEach(([label, value]) => {
      const item = make("div", "inquiry-field");
      item.append(make("span", "", label), make("strong", "", String(value)));
      grid.append(item);
    });
    const message = make("div", "inquiry-message");
    message.append(make("span", "", "PROJECT DETAILS"), make("p", "", inquiry.message || "No project details provided."));
    detail.append(grid, message);
    byId("reply-inquiry").href = `mailto:${inquiry.email || ""}?subject=${encodeURIComponent("Re: Your Noobytes Studio inquiry")}`;
    byId("inquiry-dialog-title").textContent = inquiry.name || "Inquiry details";
    byId("inquiry-dialog").showModal();
  };

  const appendInquiryRow = (tbody, inquiry, compact = false) => {
    const row = make("tr");
    const contact = make("td", "contact-cell");
    contact.append(make("strong", "", inquiry.name || "Unnamed"), make("small", "", inquiry.email || "No email"));
    row.append(contact);
    const service = make("td", "", inquiry.service || "—");
    row.append(service);
    if (!compact) row.append(make("td", "", inquiry.budget || "—"));
    row.append(make("td", "", shortDate(inquiry.date)));
    const statusCell = make("td");
    if (compact) {
      const badge = make("span", `status-badge status-${getStatusClass(inquiry.status)}`, statusName(inquiry.status));
      statusCell.append(badge);
    } else {
      statusCell.append(createStatus(inquiry));
    }
    row.append(statusCell);
    const actions = make("td", "row-actions");
    actions.append(createActionButton("View", "action-link", () => openInquiry(inquiry), `View inquiry from ${inquiry.name}`));
    if (!compact) {
      actions.append(createActionButton("×", "delete-row", () => {
        if (!window.confirm(`Delete the inquiry from ${inquiry.name}?`)) return;
        data.inquiries = data.inquiries.filter((item) => item.id !== inquiry.id);
        save("Inquiry deleted.");
      }, `Delete inquiry from ${inquiry.name}`));
    }
    row.append(actions);
    tbody.append(row);
  };

  const renderInquiries = () => {
    const recent = [...data.inquiries].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    const recentBody = byId("recent-inquiries");
    recentBody.replaceChildren();
    recent.forEach((inquiry) => appendInquiryRow(recentBody, inquiry, true));
    byId("recent-empty").hidden = recent.length > 0;
    byId("unread-count").textContent = String(data.inquiries.filter((item) => getStatusClass(item.status) === "new").length);

    const query = byId("inquiry-search").value.trim().toLowerCase();
    const filter = byId("inquiry-filter").value;
    const allBody = byId("all-inquiries");
    allBody.replaceChildren();
    const matches = [...data.inquiries]
      .filter((item) => {
        const searchable = [item.name, item.email, item.company, item.message, item.service].join(" ").toLowerCase();
        return (!query || searchable.includes(query)) && (filter === "all" || getStatusClass(item.status) === filter);
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    matches.forEach((inquiry) => appendInquiryRow(allBody, inquiry));
    byId("inquiries-empty").hidden = matches.length > 0;
    byId("metric-total").textContent = String(data.inquiries.length);
    byId("metric-new").textContent = String(data.inquiries.filter((item) => getStatusClass(item.status) === "new").length);
    renderChart();
  };

  const openProductForm = (product) => {
    const form = byId("product-form");
    form.reset();
    form.elements.namedItem("id").value = product?.id || "";
    form.elements.namedItem("name").value = product?.name || "";
    form.elements.namedItem("category").value = product?.category || "";
    form.elements.namedItem("description").value = product?.description || "";
    form.elements.namedItem("details").value = product?.details || "";
    form.elements.namedItem("visible").checked = product ? product.visible !== false : true;
    byId("product-dialog-title").textContent = product ? "Edit product" : "Add a product";
    byId("product-dialog").showModal();
  };

  const renderProducts = () => {
    const grid = byId("products-grid");
    grid.replaceChildren();
    data.products.forEach((product) => {
      const card = make("article", "admin-product-card");
      const icon = make("div", `admin-product-icon icon-${product.id}`, product.name.slice(0, 1).toUpperCase());
      const content = make("div", "admin-product-copy");
      content.append(make("span", "product-category", product.category), make("h2", "", product.name), make("p", "", product.description));
      const visibility = make("span", `visibility-pill${product.visible === false ? " is-hidden" : ""}`, product.visible === false ? "Hidden" : "Published");
      const actions = make("div", "card-actions");
      actions.append(createActionButton("Edit", "secondary-button", () => openProductForm(product), `Edit ${product.name}`));
      actions.append(createActionButton("Delete", "danger-button", () => {
        if (!window.confirm(`Delete ${product.name}? This also removes it from the public products page.`)) return;
        data.products = data.products.filter((item) => item.id !== product.id);
        save("Product deleted.");
      }, `Delete ${product.name}`));
      card.append(icon, content, visibility, actions);
      grid.append(card);
    });
    byId("metric-products").textContent = String(data.products.filter((item) => item.visible !== false).length);
    const addCard = make("button", "add-product-card", "+ Add a product");
    addCard.type = "button";
    addCard.addEventListener("click", () => openProductForm());
    grid.append(addCard);
  };

  const openServiceForm = (service) => {
    const form = byId("service-form");
    form.reset();
    form.elements.namedItem("id").value = service.id;
    form.elements.namedItem("name").value = service.name;
    form.elements.namedItem("description").value = service.description;
    form.elements.namedItem("visible").checked = service.visible !== false;
    byId("service-dialog-title").textContent = "Edit service";
    byId("service-dialog").showModal();
  };

  const renderServices = () => {
    const list = byId("services-list");
    list.replaceChildren();
    data.services.forEach((service, index) => {
      const card = make("article", "admin-service-card");
      const number = make("span", "service-index", String(index + 1).padStart(2, "0"));
      const content = make("div", "admin-service-copy");
      content.append(make("span", "product-category", `SERVICE ${String(index + 1).padStart(2, "0")}`), make("h2", "", service.name), make("p", "", service.description));
      const visibility = make("span", `visibility-pill${service.visible === false ? " is-hidden" : ""}`, service.visible === false ? "Hidden" : "Published");
      const actions = make("div", "card-actions");
      actions.append(createActionButton("Edit", "secondary-button", () => openServiceForm(service), `Edit ${service.name}`));
      const toggle = createActionButton(service.visible === false ? "Publish" : "Hide", "secondary-button", () => {
        service.visible = service.visible === false;
        save(service.visible ? "Service published." : "Service hidden.");
      }, `${service.visible === false ? "Publish" : "Hide"} ${service.name}`);
      actions.append(toggle);
      card.append(number, content, visibility, actions);
      list.append(card);
    });
    byId("metric-services").textContent = String(data.services.filter((item) => item.visible !== false).length);
  };

  const renderSettings = () => {
    const form = byId("settings-form");
    Object.entries(data.settings).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (field instanceof HTMLInputElement && field.type === "checkbox") field.checked = Boolean(value);
      else if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = value;
    });
  };

  const render = () => {
    renderInquiries();
    renderProducts();
    renderServices();
    renderSettings();
  };

  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  document.querySelectorAll("[data-action-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.actionView)));
  byId("inquiry-search").addEventListener("input", renderInquiries);
  byId("inquiry-filter").addEventListener("change", renderInquiries);
  byId("today-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  byId("add-product").addEventListener("click", () => openProductForm());

  byId("product-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const formData = new FormData(form);
    const existingId = String(formData.get("id"));
    const product = {
      id: existingId || `product-${Date.now()}`,
      name: String(formData.get("name")).trim(),
      category: String(formData.get("category")).trim(),
      description: String(formData.get("description")).trim(),
      details: String(formData.get("details")).trim(),
      visible: form.elements.namedItem("visible").checked
    };
    const existingIndex = data.products.findIndex((item) => item.id === existingId);
    if (existingIndex >= 0) data.products[existingIndex] = product;
    else data.products.push(product);
    if (save(existingId ? "Product updated." : "Product added.")) byId("product-dialog").close();
  });

  byId("service-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const formData = new FormData(form);
    const service = data.services.find((item) => item.id === formData.get("id"));
    if (!service) {
      showToast("That service could not be found.", "error");
      return;
    }
    service.name = String(formData.get("name")).trim();
    service.description = String(formData.get("description")).trim();
    service.visible = form.elements.namedItem("visible").checked;
    if (save("Service updated.")) byId("service-dialog").close();
  });

  byId("settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const formData = new FormData(form);
    data.settings = {
      ...data.settings,
      studioName: String(formData.get("studioName")).trim(),
      email: String(formData.get("email")).trim(),
      heroTitle: String(formData.get("heroTitle")).trim(),
      heroDescription: String(formData.get("heroDescription")).trim(),
      ctaTitle: String(formData.get("ctaTitle")).trim(),
      acceptingProjects: form.elements.namedItem("acceptingProjects").checked
    };
    if (save("Site settings saved.")) byId("settings-feedback").textContent = "Your changes are saved in this browser.";
  });

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  byId("export-csv").addEventListener("click", () => {
    const columns = ["Name", "Email", "Phone", "Company", "Services", "Budget", "Timeline", "Source", "Status", "Date", "Message"];
    const rows = data.inquiries.map((item) => [item.name, item.email, item.phone, item.company, item.service, item.budget, item.timeline, item.source, statusName(item.status), item.date, item.message]);
    const csvValue = (value) => {
      let text = String(value ?? "");
      if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const csv = [columns, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");
    downloadFile("noobytes-inquiries.csv", csv, "text/csv;charset=utf-8");
  });

  byId("export-backup").addEventListener("click", () => downloadFile("noobytes-studio-backup.json", JSON.stringify(data, null, 2), "application/json"));

  byId("import-backup").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2_000_000) {
      showToast("Backup file is too large (maximum 2 MB).", "error");
      return;
    }
    try {
      const imported = JSON.parse(await file.text());
      const textFieldsAreValid = (item, keys) => item && typeof item === "object" && keys.every((key) => typeof item[key] === "string");
      const validSettings = textFieldsAreValid(imported?.settings, ["studioName", "email", "heroTitle", "heroDescription", "ctaTitle"])
        && typeof imported.settings.acceptingProjects === "boolean";
      const validProducts = Array.isArray(imported?.products) && imported.products.every((item) =>
        textFieldsAreValid(item, ["id", "name", "category", "description", "details"]) && typeof item.visible === "boolean");
      const validServices = Array.isArray(imported?.services) && imported.services.every((item) =>
        textFieldsAreValid(item, ["id", "name", "description"]) && typeof item.visible === "boolean");
      const validInquiries = Array.isArray(imported?.inquiries) && imported.inquiries.every((item) =>
        textFieldsAreValid(item, ["id", "name", "email", "phone", "company", "service", "budget", "timeline", "source", "message", "date", "status"]));
      const valid = validSettings && validProducts && validServices && validInquiries;
      if (!valid || !window.confirm("Import this backup and replace the dashboard data in this browser?")) return;
      data = {
        settings: { ...store.defaults().settings, ...imported.settings },
        products: imported.products,
        services: imported.services,
        inquiries: imported.inquiries
      };
      save("Backup imported.");
    } catch (error) {
      console.error("Could not import the dashboard backup.", error);
      showToast("That backup file couldn't be read.", "error");
    }
  });

  byId("reset-settings").addEventListener("click", () => {
    if (!window.confirm("Reset all products, services, settings, and saved inquiries in this browser to their defaults? This cannot be undone.")) return;
    if (!store.reset()) {
      showToast("Couldn't reset browser storage.", "error");
      return;
    }
    data = store.load();
    render();
    byId("settings-feedback").textContent = "Local content has been reset to the original defaults.";
    showToast("Local content reset.");
  });

  const sidebarToggle = byId("sidebar-toggle");
  sidebarToggle.addEventListener("click", () => {
    const open = !document.querySelector(".admin-main").classList.contains("menu-open");
    document.querySelector(".admin-main").classList.toggle("menu-open", open);
    document.body.classList.toggle("menu-open", open);
    byId("sidebar-backdrop").classList.toggle("is-visible", open);
    sidebarToggle.setAttribute("aria-expanded", String(open));
  });
  byId("sidebar-backdrop").addEventListener("click", () => setView(document.querySelector(".nav-item.is-active").dataset.view));

  window.addEventListener("storage", (event) => {
    if (event.key === store.storageKey) {
      data = store.load();
      render();
      showToast("Dashboard updated in another tab.");
    }
  });

  function downloadFile(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = make("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  render();
})();
