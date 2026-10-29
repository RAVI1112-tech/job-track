
"use strict";

const STORAGE_KEY = "jobtrack.applications.v1";
const VALID_STATUSES = ["Applied", "Interview", "Offer", "Rejected"];

const elements = {
  totalCount: document.getElementById("totalCount"),
  progressCount: document.getElementById("progressCount"),
  interviewCount: document.getElementById("interviewCount"),
  offerCount: document.getElementById("offerCount"),
  interviewNavCount: document.getElementById("interviewNavCount"),
  applicationsBody: document.getElementById("applicationsBody"),
  emptyState: document.getElementById("emptyState"),
  resultsLabel: document.getElementById("resultsLabel"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  sortSelect: document.getElementById("sortSelect"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  jobForm: document.getElementById("jobForm"),
  modalTitle: document.getElementById("modalTitle"),
  saveJobBtn: document.getElementById("saveJobBtn"),
  formError: document.getElementById("formError"),
  toast: document.getElementById("toast"),
  sidebar: document.getElementById("sidebar")
};

let applications = loadApplications();
let currentView = "all";
let toastTimer;

function todayISO() {
  const now = new Date();
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 10);
}

function makeId() {
  return window.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadApplications() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return [];

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(item =>
      item &&
      typeof item.id === "string" &&
      typeof item.company === "string" &&
      typeof item.role === "string" &&
      VALID_STATUSES.includes(item.status)
    );
  } catch (error) {
    console.error("Could not load JobTrack data:", error);
    return [];
  }
}

function saveApplications() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(applications)
    );
    return true;
  } catch (error) {
    console.error("Could not save JobTrack data:", error);
    showToast("Could not save data. Check browser storage settings.");
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatDate(dateString) {
  if (!dateString) return "—";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function statusClass(status) {
  return {
    Applied: "status-applied",
    Interview: "status-interview",
    Offer: "status-offer",
    Rejected: "status-rejected"
  }[status] || "status-applied";
}

function getFilteredApplications() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const status = elements.statusFilter.value;

  let result = applications.filter(job => {
    const searchableText =
      `${job.company} ${job.role} ${job.location} ${job.notes}`
        .toLowerCase();

    const matchesQuery =
      !query || searchableText.includes(query);

    const matchesStatus =
      status === "all" || job.status === status;

    const matchesView =
      currentView === "all" ||
      (currentView === "interviews" &&
        job.status === "Interview") ||
      (currentView === "offers" &&
        job.status === "Offer");

    return matchesQuery && matchesStatus && matchesView;
  });

  const sort = elements.sortSelect.value;

  result = [...result].sort((a, b) => {
    if (sort === "oldest") {
      return (a.appliedDate || "")
        .localeCompare(b.appliedDate || "");
    }

    if (sort === "company") {
      return a.company.localeCompare(b.company);
    }

    return (b.appliedDate || "")
      .localeCompare(a.appliedDate || "");
  });

  return result;
}

function renderStats() {
  const total = applications.length;

  const interviews = applications.filter(
    job => job.status === "Interview"
  ).length;

  const offers = applications.filter(
    job => job.status === "Offer"
  ).length;

  const inProgress = applications.filter(
    job => ["Applied", "Interview"].includes(job.status)
  ).length;

  elements.totalCount.textContent = total;
  elements.progressCount.textContent = inProgress;
  elements.interviewCount.textContent = interviews;
  elements.offerCount.textContent = offers;
  elements.interviewNavCount.textContent = interviews;
}

function renderApplications() {
  const jobs = getFilteredApplications();

  elements.applicationsBody.innerHTML = jobs.map(
    (job, index) => {
      const initial = escapeHTML(
        (job.company.trim()[0] || "?").toUpperCase()
      );

      const logoClass = `logo-${index % 5}`;

      const nextStep = job.nextStep
        ? escapeHTML(job.nextStep)
        : '<span class="muted-next">No next step added</span>';

      const link = job.jobLink &&
        /^https?:\/\//i.test(job.jobLink)
        ? `<button class="row-action"
              type="button"
              data-open-link="${escapeHTML(job.id)}"
              title="Open job link"
              aria-label="Open job link">↗</button>`
        : "";

      return `
        <tr>
          <td>
            <div class="company-cell">
              <div class="company-logo ${logoClass}">
                ${initial}
              </div>
              <div class="company-details">
                <strong>${escapeHTML(job.company)}</strong>
                <span>${escapeHTML(job.role)}</span>
              </div>
            </div>
          </td>

          <td>${escapeHTML(job.location || "—")}</td>
          <td>${formatDate(job.appliedDate)}</td>

          <td>
            <span class="status-pill ${statusClass(job.status)}">
              ${escapeHTML(job.status)}
            </span>
          </td>

          <td>${nextStep}</td>

          <td>
            <div class="row-actions">
              ${link}

              <button class="row-action"
                type="button"
                data-edit="${escapeHTML(job.id)}"
                title="Edit application"
                aria-label="Edit ${escapeHTML(job.company)}">✎</button>

              <button class="row-action delete"
                type="button"
                data-delete="${escapeHTML(job.id)}"
                title="Delete application"
                aria-label="Delete ${escapeHTML(job.company)}">×</button>
            </div>
          </td>
        </tr>
      `;
    }
  ).join("");

  const hasJobs = jobs.length > 0;

  elements.emptyState.hidden = hasJobs;

  document.querySelector(".table-scroll").hidden = !hasJobs;

  elements.resultsLabel.textContent =
    `Showing ${jobs.length} of ${applications.length} application` +
    `${applications.length === 1 ? "" : "s"}`;
}

function render() {
  renderStats();
  renderApplications();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2800);
}

function openModal(job = null) {
  elements.jobForm.reset();
  elements.formError.hidden = true;
  elements.formError.textContent = "";

  document.getElementById("jobId").value =
    job ? job.id : "";

  elements.modalTitle.textContent =
    job ? "Edit application" : "Add application";

  elements.saveJobBtn.textContent =
    job ? "Save changes" : "Save application";

  document.getElementById("company").value =
    job?.company || "";

  document.getElementById("role").value =
    job?.role || "";

  document.getElementById("location").value =
    job?.location || "";

  document.getElementById("status").value =
    job?.status || "Applied";

  document.getElementById("appliedDate").value =
    job?.appliedDate || todayISO();

  document.getElementById("nextStep").value =
    job?.nextStep || "";

  document.getElementById("jobLink").value =
    job?.jobLink || "";

  document.getElementById("notes").value =
    job?.notes || "";

  elements.modalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";

  window.setTimeout(() => {
    document.getElementById("company").focus();
  }, 50);
}

function closeModal() {
  elements.modalBackdrop.hidden = true;
  document.body.style.overflow = "";

  document.getElementById("addJobBtn").focus();
}

function showFormError(message) {
  elements.formError.textContent = message;
  elements.formError.hidden = false;
}

function handleSubmit(event) {
  event.preventDefault();

  const id = document.getElementById("jobId").value;
  const company = document.getElementById("company").value.trim();
  const role = document.getElementById("role").value.trim();
  const appliedDate = document.getElementById("appliedDate").value;
  const status = document.getElementById("status").value;
  const jobLink = document.getElementById("jobLink").value.trim();

  if (!company || !role || !appliedDate) {
    showFormError("Please complete all required fields.");
    return;
  }

  if (!VALID_STATUSES.includes(status)) {
    showFormError("Please choose a valid application status.");
    return;
  }

  if (appliedDate > todayISO()) {
    showFormError(
      "Applied date cannot be in the future. Use Next step for a future interview."
    );
    return;
  }

  if (jobLink && !/^https?:\/\/.+/i.test(jobLink)) {
    showFormError(
      "Please enter a valid job link starting with http:// or https://."
    );
    return;
  }

  const job = {
    id: id || makeId(),
    company,
    role,
    location: document.getElementById("location").value.trim(),
    status,
    appliedDate,
    nextStep: document.getElementById("nextStep").value.trim(),
    jobLink,
    notes: document.getElementById("notes").value.trim(),
    updatedAt: new Date().toISOString()
  };

  const previous = applications;

  if (id) {
    applications = applications.map(item =>
      item.id === id ? job : item
    );
  } else {
    applications.unshift(job);
  }

  if (!saveApplications()) {
    applications = previous;
    return;
  }

  closeModal();
  render();

  showToast(
    id
      ? "Application updated successfully."
      : "Application added successfully."
  );
}

function editApplication(id) {
  const job = applications.find(item => item.id === id);

  if (job) {
    openModal(job);
  }
}

function deleteApplication(id) {
  const job = applications.find(item => item.id === id);

  if (!job) return;

  const confirmed = window.confirm(
    `Delete the application for ${job.company}? This cannot be undone.`
  );

  if (!confirmed) return;

  const previous = applications;

  applications = applications.filter(item => item.id !== id);

  if (!saveApplications()) {
    applications = previous;
    return;
  }

  render();
  showToast("Application deleted.");
}

function exportCSV() {
  if (applications.length === 0) {
    showToast("Add an application before exporting.");
    return;
  }

  const columns = [
    ["Company", "company"],
    ["Role", "role"],
    ["Location", "location"],
    ["Status", "status"],
    ["Applied Date", "appliedDate"],
    ["Next Step", "nextStep"],
    ["Job Link", "jobLink"],
    ["Notes", "notes"]
  ];

  const csvCell = value =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const csv = [
    columns.map(([label]) => csvCell(label)).join(","),
    ...applications.map(job =>
      columns.map(([, key]) => csvCell(job[key])).join(",")
    )
  ].join("\r\n");

  const blob = new Blob(
    ["\uFEFF", csv],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `jobtrack-applications-${todayISO()}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);

  showToast("CSV export downloaded.");
}

function setView(view) {
  currentView = view;

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === view
    );
  });

  const titles = {
    all: "Overview",
    interviews: "Interviews",
    offers: "Offers"
  };

  const heading = {
    all: "Good things take <span>tracking.</span>",
    interviews: "Every conversation is <span>progress.</span>",
    offers: "Your next chapter <span>starts here.</span>"
  };

  document.getElementById("breadcrumbTitle").textContent =
    titles[view];

  document.getElementById("listTitle").textContent =
    view === "all" ? "Your applications" : titles[view];

  document.getElementById("pageTitle").innerHTML =
    heading[view];

  renderApplications();
}

function bindEvents() {
  document.getElementById("addJobBtn")
    .addEventListener("click", () => openModal());

  document.getElementById("emptyAddBtn")
    .addEventListener("click", () => openModal());

  document.getElementById("closeModalBtn")
    .addEventListener("click", closeModal);

  document.getElementById("cancelBtn")
    .addEventListener("click", closeModal);

  elements.jobForm.addEventListener("submit", handleSubmit);

  elements.searchInput.addEventListener(
    "input",
    renderApplications
  );

  elements.statusFilter.addEventListener(
    "change",
    renderApplications
  );

  elements.sortSelect.addEventListener(
    "change",
    renderApplications
  );

  document.getElementById("exportBtn")
    .addEventListener("click", exportCSV);

  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
      elements.sidebar.classList.remove("open");
    });
  });

  elements.applicationsBody.addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");
    const linkButton = event.target.closest("[data-open-link]");

    if (editButton) {
      editApplication(editButton.dataset.edit);
    }

    if (deleteButton) {
      deleteApplication(deleteButton.dataset.delete);
    }

    if (linkButton) {
      const job = applications.find(
        item => item.id === linkButton.dataset.openLink
      );

      if (job?.jobLink && /^https?:\/\//i.test(job.jobLink)) {
        window.open(
          job.jobLink,
          "_blank",
          "noopener,noreferrer"
        );
      }
    }
  });

  elements.modalBackdrop.addEventListener("click", event => {
    if (event.target === elements.modalBackdrop) {
      closeModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      !elements.modalBackdrop.hidden
    ) {
      closeModal();
    }
  });

  document.getElementById("mobileMenu")
    .addEventListener("click", () => {
      elements.sidebar.classList.toggle("open");
    });
}

function initialize() {
  document.getElementById("todayLabel").textContent =
    new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(new Date());

  bindEvents();
  render();
}

initialize();
