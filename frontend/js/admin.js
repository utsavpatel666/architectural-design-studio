// admin.js
// Handles the entire admin panel: login, dashboard stats, message replies,
// gallery upload/delete, FAQ management, and site settings.

let TOKEN = localStorage.getItem("admin_token") || "";
let currentReplyId = null;
let teamMembers = [];
let editingTeamId = null;
let pendingUploadFiles = [];
let pendingUploadCoverIndex = 0;
let galleryAdminItems = [];
let galleryAdminFilter = "all";
let packageAdminData = { homeTypes: [], footnote: "" };
let packageRemovePlanReady = false;
let packageRemoveTypeReady = false;
let toastTimer = null;

function showAdminToast(message, type = "success") {
  const toast = document.getElementById("adminToast");
  toast.className = `admin-toast is-${type}`;
  toast.querySelector(".admin-toast-icon").textContent = type === "success" ? "✓" : "×";
  toast.querySelector(".admin-toast-message").textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => { toast.hidden = true; }, 220);
  }, 2800);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

async function readJsonResponse(response, label) {
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || `${label} failed.` };
  }
  return data;
}

function inferMediaType(filePath) {
  if (!filePath) return "image";
  const ext = String(filePath).split("?")[0].split("#")[0].toLowerCase();
  return /(\.mp4|\.mov|\.webm)$/i.test(ext) ? "video" : "image";
}

function normalizeGalleryItem(item) {
  if (!item || typeof item !== "object") return item;

  const media = Array.isArray(item.media) && item.media.length
    ? item.media
        .map((entry) => {
          if (!entry || !entry.file_path) return null;
          return {
            type: (entry.type || inferMediaType(entry.file_path)).toLowerCase(),
            file_path: entry.file_path,
            is_cover: Boolean(entry.is_cover),
          };
        })
        .filter(Boolean)
    : [];

  const legacyFallback = item.file_path
    ? [{ type: (item.media_type || inferMediaType(item.file_path)).toLowerCase(), file_path: item.file_path, is_cover: true }]
    : [];

  const normalizedMedia = media.length ? media : legacyFallback;
  if (!normalizedMedia.length) {
    return {
      ...item,
      media: [],
      display_in: "both",
      cover_index: 0,
      media_type: "image",
      file_path: "",
    };
  }

  const requestedCoverIndex = Number.isInteger(Number(item.cover_index)) ? Number(item.cover_index) : normalizedMedia.findIndex((entry) => entry.is_cover);
  const safeCoverIndex = requestedCoverIndex >= 0 && requestedCoverIndex < normalizedMedia.length ? requestedCoverIndex : 0;

  normalizedMedia.forEach((entry, index) => {
    entry.type = (entry.type || inferMediaType(entry.file_path)).toLowerCase();
    entry.is_cover = index === safeCoverIndex;
  });

  const displayIn = ["portfolio", "gallery3d"].includes(String(item.display_in || "").toLowerCase())
    ? String(item.display_in).toLowerCase()
    : "both";

  return {
    ...item,
    media: normalizedMedia,
    display_in: displayIn,
    cover_index: safeCoverIndex,
    media_type: normalizedMedia[safeCoverIndex].type,
    file_path: normalizedMedia[safeCoverIndex].file_path,
  };
}

function getGalleryCover(item) {
  const media = Array.isArray(item && item.media) ? item.media : [];
  if (!media.length) return null;
  const coverIndex = Number.isInteger(Number(item.cover_index)) ? Number(item.cover_index) : 0;
  return media[coverIndex] || media[0] || null;
}

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");

// ============================================
// Auth
// ============================================
function showDashboard() {
  loginView.style.display = "none";
  dashboardView.style.display = "flex";
  loadOverview();
  loadMessages();
  loadGalleryAdmin();
  loadTeamAdmin();
  loadFaqAdmin();
  loadPackagesAdmin();
  loadSettingsAdmin();
}

if (TOKEN) showDashboard();

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const errorEl = document.getElementById("loginError");

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await readJsonResponse(res, "Admin login");
    if (res.ok) {
      TOKEN = data.token;
      localStorage.setItem("admin_token", TOKEN);
      showDashboard();
    } else {
      errorEl.textContent = data.error || "Login failed.";
    }
  } catch (err) {
    errorEl.textContent = err.message || "Network error. Please try again.";
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("admin_token");
  location.reload();
});

// Helper for authenticated requests
async function authFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  if (response.status === 401) {
    TOKEN = "";
    localStorage.removeItem("admin_token");
    loginView.style.display = "flex";
    dashboardView.style.display = "none";
    document.getElementById("loginError").textContent = "Your admin session expired. Please sign in again.";
  }

  return response;
}

// ============================================
// Tab navigation
// ============================================
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ============================================
// Overview stats
// ============================================
async function loadOverview() {
  const res = await authFetch("/api/admin/stats");
  if (!res.ok) return;
  const stats = await readJsonResponse(res, "Dashboard");

  const cards = [
    { label: "Unique visitors", value: stats.totalVisitors },
    { label: "Page views", value: stats.totalPageViews },
    { label: "Total enquiries", value: stats.totalMessages },
    { label: "New enquiries", value: stats.newMessages },
    { label: "Gallery items", value: stats.totalGalleryItems },
    { label: "Team members", value: stats.totalTeamMembers },
  ];

  document.getElementById("statGrid").innerHTML = cards
    .map((c) => `<div class="stat-card"><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>`)
    .join("");
}

// ============================================
// Messages
// ============================================
function whatsappUrlForPhone(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  let internationalDigits = "";

  if (/^[6-9]\d{9}$/.test(digits)) {
    internationalDigits = `91${digits}`;
  } else if (/^0[6-9]\d{9}$/.test(digits)) {
    internationalDigits = `91${digits.slice(1)}`;
  } else if (/^91[6-9]\d{9}$/.test(digits)) {
    internationalDigits = digits;
  } else if (/^[1-9]\d{7,14}$/.test(digits)) {
    internationalDigits = digits;
  }

  return internationalDigits ? `https://wa.me/${internationalDigits}` : "";
}

async function loadMessages() {
  const res = await authFetch("/api/admin/messages");
  if (!res.ok) return;
  const messages = await readJsonResponse(res, "Messages");
  const list = document.getElementById("messagesList");

  if (messages.length === 0) {
    list.innerHTML = "<p>No enquiries yet.</p>";
    return;
  }

  list.innerHTML = messages
    .map((m) => {
      const whatsappUrl = whatsappUrlForPhone(m.phone);
      return `
    <div class="message-card">
      <div class="message-top">
        <span class="message-name">${escapeHtml(m.name)}</span>
        <span class="status-badge status-${m.status}">${m.status}</span>
      </div>
      <div class="message-meta">${escapeHtml(m.email)} · ${escapeHtml(m.phone)} ${m.bhk_interest ? "· " + escapeHtml(m.bhk_interest) : ""} · ${new Date(m.created_at).toLocaleString()}</div>
      <div class="message-body">${escapeHtml(m.message || "(no message)")}</div>
      ${m.admin_reply ? `<div class="message-body"><strong>Your reply:</strong> ${escapeHtml(m.admin_reply)}</div>` : ""}
      <div class="message-actions">
        <button onclick="openReply(${m.id}, '${escapeAttr(m.name)}')">Reply</button>
        <button onclick="markStatus(${m.id}, 'closed')">Mark closed</button>
        ${whatsappUrl ? `<a class="message-whatsapp" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : "<span class=\"message-whatsapp-unavailable\">No WhatsApp number</span>"}
      </div>
    </div>`;
    })
    .join("");
}

window.openReply = function (id, name) {
  currentReplyId = id;
  document.getElementById("replyContext").textContent = `Replying to ${name}`;
  document.getElementById("replyText").value = "";
  document.getElementById("replyStatus").textContent = "";
  document.getElementById("replyModal").style.display = "flex";
};

document.getElementById("replyCancel").addEventListener("click", () => {
  document.getElementById("replyModal").style.display = "none";
});

document.getElementById("replySend").addEventListener("click", async () => {
  const text = document.getElementById("replyText").value.trim();
  const statusEl = document.getElementById("replyStatus");
  if (!text) {
    statusEl.textContent = "Please write a reply.";
    return;
  }
  const res = await authFetch(`/api/admin/messages/${currentReplyId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reply: text }),
  });
  const data = await readJsonResponse(res, "Message reply");
  if (res.ok) {
    statusEl.innerHTML = `Reply sent by email. <a href="${data.whatsappLink}" target="_blank" rel="noopener">Open WhatsApp reply</a>`;
    loadMessages();
    showAdminToast("Reply sent successfully.");
  } else {
    statusEl.textContent = data.error || "Failed to send reply.";
    showAdminToast(data.error || "Could not send reply.", "error");
  }
});

window.markStatus = async function (id, status) {
  const response = await authFetch(`/api/admin/messages/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) { showAdminToast("Could not update enquiry status.", "error"); return; }
  loadMessages();
  showAdminToast("Enquiry status updated successfully.");
};

// ============================================
// Gallery
// ============================================
async function loadGalleryAdmin() {
  const res = await fetch("/api/gallery");
  const items = await readJsonResponse(res, "Gallery");
  const grid = document.getElementById("adminGalleryGrid");
  galleryAdminItems = Array.isArray(items) ? items : [];
  renderGalleryAdmin();
}

function renderGalleryAdmin() {
  const grid = document.getElementById("adminGalleryGrid");
  const items = galleryAdminItems.filter((item) => {
    if (galleryAdminFilter === "all") return item.display_in === "both";
    return item.display_in === galleryAdminFilter;
  });

  if (items.length === 0) {
    grid.innerHTML = "<p>No gallery items yet.</p>";
    return;
  }

  grid.innerHTML = items
    .map((item) => {
      const normalizedItem = normalizeGalleryItem(item);
      const mediaList = Array.isArray(normalizedItem.media) && normalizedItem.media.length ? normalizedItem.media : [{ type: normalizedItem.media_type || "image", file_path: normalizedItem.file_path || "", is_cover: true }].filter((entry) => entry.file_path);
      const mediaMarkup = mediaList
        .map((media, index) => {
          const isCover = media.is_cover || index === Number(normalizedItem.cover_index || 0);
          const mediaElement = media.type === "video"
            ? `<video src="${media.file_path}" muted playsinline></video>`
            : `<img src="${media.file_path}" alt="${escapeHtml(normalizedItem.title)}" />`;
          return `
              <div class="media-thumb ${isCover ? "is-cover" : ""}">
              ${mediaElement}
                <span class="media-order-badge">${index + 1}</span>
              <span class="media-type-badge">${media.type === "video" ? "Video" : "Image"}</span>
              ${isCover ? '<span class="cover-badge">Cover media</span>' : ""}
                <div class="media-reorder-controls">
                  <button type="button" class="media-move-btn" data-media-index="${index}" data-move="up" ${index === 0 ? "disabled" : ""} title="Move up">↑</button>
                  <button type="button" class="media-move-btn" data-media-index="${index}" data-move="down" ${index === mediaList.length - 1 ? "disabled" : ""} title="Move down">↓</button>
                </div>
              <button type="button" class="remove-media-btn" data-media-index="${index}" title="Remove media">×</button>
              ${isCover ? "" : `<button type="button" class="mark-cover-btn" data-cover-index="${index}" title="Set as cover">Set cover</button>`}
            </div>
          `;
        })
        .join("");

      return `
      <div class="admin-gallery-item" data-gallery-id="${item.id}">
        <div class="admin-gallery-media-grid">${mediaMarkup}</div>
        <label class="append-media-btn">Add media
          <input type="file" class="append-media-input" accept="image/*,video/*" multiple />
        </label>
        <button class="delete-btn" onclick="deleteGalleryItem(${item.id})">Delete</button>
        <div class="admin-gallery-caption">
          <strong>${escapeHtml(normalizedItem.title)}</strong>
          <span>${escapeHtml(normalizedItem.bhk_type)} · ${escapeHtml(normalizedItem.display_in || "both")}</span>
          <span class="meta">${escapeHtml(normalizedItem.description || "No description")}</span>
        </div>
      </div>`;
    })
    .join("");

  grid.querySelectorAll(".append-media-input").forEach((input) => {
    input.addEventListener("change", async () => {
      if (!input.files.length) return;
      const formData = new FormData();
      Array.from(input.files).forEach((file) => formData.append("files", file));
      const itemId = input.closest(".admin-gallery-item").dataset.galleryId;
      const response = await authFetch(`/api/gallery/${itemId}/media`, { method: "POST", body: formData });
      const data = await readJsonResponse(response, "Add media");
      if (!response.ok) {
        document.getElementById("uploadStatus").textContent = data.error || "Could not add media.";
        showAdminToast(data.error || "Could not add gallery media.", "error");
        return;
      }
      await loadGalleryAdmin();
      showAdminToast("Gallery media added successfully.");
    });
  });

  grid.querySelectorAll(".remove-media-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.closest(".admin-gallery-item").dataset.galleryId);
      const index = Number(button.dataset.mediaIndex);
      const response = await authFetch(`/api/gallery/${id}/media/${index}`, { method: "DELETE" });
      if (!response.ok) { showAdminToast("Could not remove gallery media.", "error"); return; }
      loadGalleryAdmin();
      loadOverview();
      showAdminToast("Gallery media removed successfully.");
    });
  });

  grid.querySelectorAll(".mark-cover-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.closest(".admin-gallery-item").dataset.galleryId);
      const index = Number(button.dataset.coverIndex);
      const response = await authFetch(`/api/gallery/${id}/cover`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      if (!response.ok) { showAdminToast("Could not change the cover media.", "error"); return; }
      loadGalleryAdmin();
      loadOverview();
      showAdminToast("Gallery cover changed successfully.");
    });
  });

  grid.querySelectorAll(".media-move-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const itemElement = button.closest(".admin-gallery-item");
      const itemId = Number(itemElement.dataset.galleryId);
      const item = galleryAdminItems.find((entry) => Number(entry.id) === itemId);
      if (!item) return;
      const media = normalizeGalleryItem(item).media.slice();
      const fromIndex = Number(button.dataset.mediaIndex);
      const toIndex = button.dataset.move === "up" ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= media.length) return;
      [media[fromIndex], media[toIndex]] = [media[toIndex], media[fromIndex]];
      const response = await authFetch(`/api/gallery/${itemId}/media/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: media.map((entry) => normalizeGalleryItem(item).media.indexOf(entry)) }),
      });
      if (response.ok) { await loadGalleryAdmin(); showAdminToast("Gallery media order updated successfully."); }
      else showAdminToast("Could not update gallery media order.", "error");
    });
  });
}

document.querySelectorAll(".gallery-filter-btn").forEach((button) => {
  button.addEventListener("click", () => {
    galleryAdminFilter = button.dataset.galleryFilter || "all";
    document.querySelectorAll(".gallery-filter-btn").forEach((option) => {
      const active = option === button;
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-pressed", String(active));
    });
    renderGalleryAdmin();
  });
});

function updateUploadPreview() {
  const preview = document.getElementById("uploadPreview");
  const files = Array.from(document.getElementById("g-file").files || []);
  pendingUploadFiles = files;

  if (!files.length) {
    pendingUploadCoverIndex = 0;
  } else if (pendingUploadCoverIndex >= files.length) {
    pendingUploadCoverIndex = 0;
  }

  if (!files.length) {
    preview.innerHTML = "";
    return;
  }

  preview.innerHTML = files
    .map((file, index) => {
      const isVideo = file.type.startsWith("video/");
      const url = URL.createObjectURL(file);
      return `
        <div class="upload-preview-item ${index === pendingUploadCoverIndex ? "is-cover" : ""}" data-upload-index="${index}">
          ${isVideo ? `<video src="${url}" muted playsinline></video>` : `<img src="${url}" alt="Upload preview ${index + 1}" />`}
          <span class="upload-order-badge">${index + 1}</span>
          <span class="upload-type-badge">${isVideo ? "Video" : "Image"}</span>
          ${index === pendingUploadCoverIndex ? '<span class="upload-cover-badge">Cover</span>' : ""}
          <button type="button" aria-label="Remove file">×</button>
          ${index === pendingUploadCoverIndex ? "" : '<button type="button" class="upload-set-cover" aria-label="Set as cover">Set cover</button>'}
        </div>
      `;
    })
    .join("");

  preview.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.classList.contains("upload-set-cover")) {
        pendingUploadCoverIndex = Number(button.parentElement.dataset.uploadIndex);
        updateUploadPreview();
        return;
      }
      const input = document.getElementById("g-file");
      const removedIndex = Number(button.parentElement.dataset.uploadIndex);
      const dt = new DataTransfer();
      pendingUploadFiles.forEach((file, idx) => {
        if (idx !== removedIndex) dt.items.add(file);
      });
      if (removedIndex < pendingUploadCoverIndex) pendingUploadCoverIndex -= 1;
      if (removedIndex === pendingUploadCoverIndex) pendingUploadCoverIndex = 0;
      input.files = dt.files;
      updateUploadPreview();
    });
  });
}

document.getElementById("g-file").addEventListener("change", (event) => {
  const newlySelectedFiles = Array.from(event.target.files || []);
  const existingFiles = pendingUploadFiles.slice();
  const filesByKey = new Map();

  [...existingFiles, ...newlySelectedFiles].forEach((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    filesByKey.set(key, file);
  });

  const mergedFiles = Array.from(filesByKey.values());
  const dataTransfer = new DataTransfer();
  mergedFiles.forEach((file) => dataTransfer.items.add(file));
  event.target.files = dataTransfer.files;
  updateUploadPreview();
});

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("uploadStatus");
  const files = Array.from(document.getElementById("g-file").files || []);
  if (!files.length) {
    statusEl.textContent = "Please choose at least one image or video.";
    return;
  }

  const formData = new FormData();
  formData.append("title", document.getElementById("g-title").value.trim());
  formData.append("bhk_type", document.getElementById("g-bhk").value);
  formData.append("description", document.getElementById("g-desc").value.trim());
  formData.append("display_in", document.getElementById("g-display").value || "both");
  formData.append("cover_index", String(pendingUploadCoverIndex));
  formData.append("cover_explicit", String(pendingUploadCoverIndex !== 0));
  files.forEach((file) => formData.append("files", file));

  statusEl.textContent = "Uploading...";

  const res = await authFetch("/api/gallery", { method: "POST", body: formData });
  const data = await readJsonResponse(res, "Gallery upload");

  if (res.ok) {
    statusEl.textContent = "Uploaded.";
    document.getElementById("uploadForm").reset();
    document.querySelectorAll("#g-display .display-choice-btn").forEach((option) => {
      const isBoth = option.dataset.displayValue === "both";
      option.classList.toggle("is-active", isBoth);
      option.setAttribute("aria-pressed", String(isBoth));
    });
    pendingUploadCoverIndex = 0;
    updateUploadPreview();
    loadGalleryAdmin();
    loadOverview();
    showAdminToast("Gallery item uploaded successfully.");
  } else {
    statusEl.textContent = data.error || "Upload failed.";
    showAdminToast(data.error || "Gallery upload failed.", "error");
  }
});

window.deleteGalleryItem = async function (id) {
  if (!confirm("Delete this gallery item?")) return;
  const response = await authFetch(`/api/gallery/${id}`, { method: "DELETE" });
  if (!response.ok) { showAdminToast("Could not delete the gallery item.", "error"); return; }
  loadGalleryAdmin();
  loadOverview();
  showAdminToast("Gallery item deleted successfully.");
};

// ============================================
// Team members
// ============================================
async function loadTeamAdmin() {
  const list = document.getElementById("adminTeamList");

  try {
    const res = await fetch("/api/team");
    teamMembers = await readJsonResponse(res, "Team");
    if (!res.ok || !Array.isArray(teamMembers)) throw new Error("Could not load team members.");
  } catch (error) {
    list.innerHTML = `<p>${escapeHtml(error.message || "Could not load team members.")}</p>`;
    return;
  }

  if (teamMembers.length === 0) {
    list.innerHTML = "<p>No team members yet. Add the first profile above.</p>";
    return;
  }

  list.innerHTML = teamMembers
    .map(
      (member) => `
        <article class="admin-team-card">
          <div class="admin-team-photo">
            <img src="${escapeAttribute(member.photo_path)}" alt="${escapeAttribute(member.name)}" />
          </div>
          <div class="admin-team-copy">
            <h3>${escapeHtml(member.name)}</h3>
            <p class="admin-team-role">${escapeHtml(member.role)}</p>
            ${member.focus ? `<p class="admin-team-focus">${escapeHtml(member.focus)}</p>` : ""}
            <p class="admin-team-bio">${escapeHtml(member.bio)}</p>
            <span class="admin-team-order">Display order: ${Number(member.sort_order) || 0}</span>
          </div>
          <div class="admin-team-actions">
            <button type="button" data-team-edit="${escapeAttribute(member.id)}">Edit</button>
            <button type="button" class="danger" data-team-delete="${escapeAttribute(member.id)}">Delete</button>
          </div>
        </article>
      `
    )
    .join("");

  list.querySelectorAll("[data-team-edit]").forEach((button) => button.addEventListener("click", () => editTeamMember(button.dataset.teamEdit)));
  list.querySelectorAll("[data-team-delete]").forEach((button) => button.addEventListener("click", () => deleteTeamMember(button.dataset.teamDelete)));
}

document.getElementById("teamForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const wasEditing = Boolean(editingTeamId);
  const status = document.getElementById("teamStatus");
  const submit = document.getElementById("teamSubmit");
  const photo = document.getElementById("t-photo").files[0];

  if (!editingTeamId && !photo) {
    status.textContent = "Please choose a portrait photo.";
    status.className = "team-status error";
    return;
  }

  const formData = new FormData();
  formData.append("name", document.getElementById("t-name").value.trim());
  formData.append("role", document.getElementById("t-role").value.trim());
  formData.append("focus", document.getElementById("t-focus").value.trim());
  formData.append("bio", document.getElementById("t-bio").value.trim());
  formData.append("sort_order", document.getElementById("t-order").value || "0");
  if (photo) formData.append("photo", photo);

  submit.disabled = true;
  status.textContent = editingTeamId ? "Saving changes..." : "Adding member...";
  status.className = "team-status";

  try {
    const res = await authFetch(editingTeamId ? `/api/team/${editingTeamId}` : "/api/team", {
      method: editingTeamId ? "PUT" : "POST",
      body: formData,
    });
    const data = await readJsonResponse(res, "Team member");
    if (!res.ok) throw new Error(data.error || "Could not save this member.");

    resetTeamForm();
    showAdminToast(wasEditing ? "Team member updated successfully." : "Team member added successfully.");
    await loadTeamAdmin();
    loadOverview();
  } catch (error) {
    status.textContent = error.message || "Could not save this member.";
    status.className = "team-status error";
  } finally {
    submit.disabled = false;
  }
});

document.getElementById("teamCancelEdit").addEventListener("click", resetTeamForm);

function editTeamMember(id) {
  const member = teamMembers.find((item) => String(item.id) === String(id));
  if (!member) return;

  editingTeamId = id;
  document.getElementById("t-name").value = member.name || "";
  document.getElementById("t-role").value = member.role || "";
  document.getElementById("t-focus").value = member.focus || "";
  document.getElementById("t-bio").value = member.bio || "";
  document.getElementById("t-order").value = member.sort_order || 0;
  document.getElementById("t-photo").value = "";
  const currentPhoto = document.getElementById("teamCurrentPhoto");
  currentPhoto.src = member.photo_path || "";
  currentPhoto.hidden = !member.photo_path;
  document.getElementById("teamPhotoHelp").textContent = "Current portrait shown above. Choose a file only to replace it.";
  document.getElementById("teamFormTitle").textContent = `Edit ${member.name}`;
  document.getElementById("teamSubmit").textContent = "Save changes";
  document.getElementById("teamCancelEdit").hidden = false;
  document.getElementById("teamPhotoHelp").textContent = "Optional while editing. Choose a file only to replace the current portrait.";
  document.getElementById("teamStatus").textContent = "";
  document.getElementById("teamForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteTeamMember(id) {
  if (!confirm("Delete this team member and their portrait?")) return;
  const res = await authFetch(`/api/team/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await readJsonResponse(res, "Team member");
    document.getElementById("teamStatus").textContent = data.error || "Could not delete this member.";
    document.getElementById("teamStatus").className = "team-status error";
    showAdminToast(data.error || "Could not delete this team member.", "error");
    return;
  }

  if (editingTeamId === id) resetTeamForm();
  loadTeamAdmin();
  loadOverview();
  showAdminToast("Team member deleted successfully.");
}

function resetTeamForm() {
  editingTeamId = null;
  document.getElementById("teamForm").reset();
  const currentPhoto = document.getElementById("teamCurrentPhoto");
  currentPhoto.removeAttribute("src");
  currentPhoto.hidden = true;
  document.getElementById("t-order").value = "0";
  document.getElementById("teamFormTitle").textContent = "Add member";
  document.getElementById("teamSubmit").textContent = "Add member";
  document.getElementById("teamCancelEdit").hidden = true;
  document.getElementById("teamPhotoHelp").textContent = "Required for a new member. Use a clear portrait image.";
  document.getElementById("teamStatus").textContent = "";
  document.getElementById("teamStatus").className = "team-status";
}

// ============================================
// FAQ
// ============================================
async function loadFaqAdmin() {
  const res = await fetch("/api/faq");
  const faqs = await readJsonResponse(res, "FAQ");
  const list = document.getElementById("adminFaqList");

  if (faqs.length === 0) {
    list.innerHTML = "<p>No FAQs yet.</p>";
    return;
  }

  list.innerHTML = faqs
    .map(
      (f) => `
    <div class="admin-faq-item">
      <div>
        <div class="q">${escapeHtml(f.question)}</div>
        <div class="a">${escapeHtml(f.answer)}</div>
      </div>
      <button type="button" data-faq-delete="${escapeAttribute(f.id)}">Delete</button>
    </div>`
    )
    .join("");
  list.querySelectorAll("[data-faq-delete]").forEach((button) => button.addEventListener("click", () => deleteFaq(button.dataset.faqDelete)));
}

document.getElementById("faqForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("f-question").value.trim();
  const answer = document.getElementById("f-answer").value.trim();

  const response = await authFetch("/api/faq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, answer }),
  });

  if (!response.ok) { showAdminToast("Could not add the FAQ.", "error"); return; }

  document.getElementById("faqForm").reset();
  loadFaqAdmin();
  showAdminToast("FAQ added successfully.");
});

async function deleteFaq(id) {
  if (!confirm("Delete this FAQ?")) return;
  const response = await authFetch(`/api/faq/${id}`, { method: "DELETE" });
  if (!response.ok) { showAdminToast("Could not delete the FAQ.", "error"); return; }
  loadFaqAdmin();
  showAdminToast("FAQ deleted successfully.");
}

// ============================================
// Settings
// ============================================
async function loadSettingsAdmin() {
  const res = await fetch("/api/settings", { cache: "no-store" });
  const settings = await readJsonResponse(res, "Settings");
  document.getElementById("s-whatsapp").value = settings.whatsapp_number || "";
  document.getElementById("s-instagram").value = settings.instagram_url || "";
  document.getElementById("s-email").value = settings.contact_email || "";
  document.getElementById("s-location").value = settings.location_url || "";
  document.getElementById("s-tagline").value = settings.site_tagline || "";
  document.getElementById("studioAdminHeadline").value = settings.studio_headline || "Designed with architecture discipline and hospitality softness.";
  let stats = [
    { value: "12+", label: "Curated room concepts" },
    { value: "4", label: "Home and commercial categories" },
    { value: "4", label: "Client questions already answered" },
  ];
  let pills = ["Turnkey interiors", "Custom furniture", "Lighting studies", "Wardrobe planning", "Site coordination"];
  try { const saved = JSON.parse(settings.studio_stats || "null"); if (Array.isArray(saved) && saved.length >= 3 && saved.length <= 5) stats = saved; } catch {}
  try { const saved = JSON.parse(settings.studio_pills || "null"); if (Array.isArray(saved) && saved.length <= 15) pills = saved; } catch {}
  renderStudioAdmin(stats, pills);
}

function renderStudioAdmin(stats, pills) {
  document.getElementById("studioAdminStats").innerHTML = stats.map((stat, index) => `
    <div class="studio-admin-row studio-admin-stat-row">
      <label>Value<input type="text" maxlength="30" data-studio-stat-value="${index}" value="${escapeHtml(stat.value)}"></label>
      <label>Label<input type="text" maxlength="100" data-studio-stat-label="${index}" value="${escapeHtml(stat.label)}"></label>
      <button type="button" data-studio-remove-stat="${index}" aria-label="Remove stat ${index + 1}" ${stats.length <= 3 ? "disabled" : ""}>Remove</button>
    </div>`).join("");
  document.getElementById("studioAdminPills").innerHTML = pills.map((pill, index) => `
    <div class="studio-admin-row">
      <label>Tag<input type="text" maxlength="60" data-studio-pill="${index}" value="${escapeHtml(pill)}"></label>
      <button type="button" data-studio-remove-pill="${index}">Remove</button>
    </div>`).join("");
  document.getElementById("studioAdminStatsCount").textContent = `${stats.length} / 5`;
  document.getElementById("studioAdminPillsCount").textContent = `${pills.length} / 15`;
  document.getElementById("studioAdminAddStat").disabled = stats.length >= 5;
  document.getElementById("studioAdminAddPill").disabled = pills.length >= 15;
  document.getElementById("studioAdminStats").querySelectorAll("[data-studio-remove-stat]").forEach((button) => button.addEventListener("click", () => {
    if (stats.length <= 3) return;
    stats.splice(Number(button.dataset.studioRemoveStat), 1);
    renderStudioAdmin(stats, pills);
  }));
  document.getElementById("studioAdminPills").querySelectorAll("[data-studio-remove-pill]").forEach((button) => button.addEventListener("click", () => {
    pills.splice(Number(button.dataset.studioRemovePill), 1);
    renderStudioAdmin(stats, pills);
  }));
}

document.getElementById("studioAdminAddStat").addEventListener("click", () => {
  const stats = [...document.querySelectorAll("#studioAdminStats .studio-admin-stat-row")].map((row) => ({ value: row.querySelector("[data-studio-stat-value]").value, label: row.querySelector("[data-studio-stat-label]").value }));
  if (stats.length >= 5) return;
  stats.push({ value: "", label: "" });
  const pills = [...document.querySelectorAll("#studioAdminPills [data-studio-pill]")].map((input) => input.value);
  renderStudioAdmin(stats, pills);
});
document.getElementById("studioAdminAddPill").addEventListener("click", () => {
  const stats = [...document.querySelectorAll("#studioAdminStats .studio-admin-stat-row")].map((row) => ({ value: row.querySelector("[data-studio-stat-value]").value, label: row.querySelector("[data-studio-stat-label]").value }));
  const pills = [...document.querySelectorAll("#studioAdminPills [data-studio-pill]")].map((input) => input.value);
  if (pills.length >= 15) return;
  pills.push("");
  renderStudioAdmin(stats, pills);
});
document.getElementById("studioAdminSave").addEventListener("click", async () => {
  const status = document.getElementById("studioAdminStatus");
  const stats = [...document.querySelectorAll("#studioAdminStats .studio-admin-stat-row")].map((row) => ({ value: row.querySelector("[data-studio-stat-value]").value.trim(), label: row.querySelector("[data-studio-stat-label]").value.trim() }));
  const pills = [...document.querySelectorAll("#studioAdminPills [data-studio-pill]")].map((input) => input.value.trim());
  const headline = document.getElementById("studioAdminHeadline").value.trim();
  if (stats.length < 3 || stats.length > 5) { status.textContent = "Studio Snapshot needs between 3 and 5 stat boxes."; return; }
  if (pills.length > 15) { status.textContent = "Studio Snapshot can have at most 15 pill tags."; return; }
  if (!headline || stats.some((stat) => !stat.value || !stat.label) || pills.some((pill) => !pill)) { status.textContent = "Fill in the headline, each stat value and label, and every pill tag before saving."; return; }
  const response = await authFetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studio_headline: headline, studio_stats: JSON.stringify(stats), studio_pills: JSON.stringify(pills) }) });
  status.textContent = response.ok ? "Studio Snapshot saved." : "Failed to save Studio Snapshot.";
  showAdminToast(response.ok ? "Studio Snapshot saved successfully." : "Could not save Studio Snapshot.", response.ok ? "success" : "error");
});

async function loadPackagesAdmin() {
  const response = await authFetch("/api/packages/admin");
  if (!response.ok) return;
  packageAdminData = await readJsonResponse(response, "Packages");
  document.getElementById("pkgAdminFootnote").value = packageAdminData.footnote || "";
  renderPackageAdminTypes();
}

function selectedPackageType() {
  return packageAdminData.homeTypes.find((item) => String(item.id) === document.getElementById("pkgAdminType").value);
}

function selectedPackagePlan() {
  const type = selectedPackageType();
  return type && type.plans.find((item) => String(item.id) === document.getElementById("pkgAdminPlan").value);
}

function renderPackageAdminTypes(selectedId) {
  const typeSelect = document.getElementById("pkgAdminType");
  const currentId = selectedId || typeSelect.value || (packageAdminData.homeTypes[0] && String(packageAdminData.homeTypes[0].id));
  typeSelect.innerHTML = packageAdminData.homeTypes.map((type) => `<option value="${escapeAttribute(type.id)}">${escapeHtml(type.name)}</option>`).join("");
  if (currentId) typeSelect.value = String(currentId);
  renderPackageAdminPlans();
}

function renderPackageAdminPlans(selectedId) {
  const type = selectedPackageType();
  const planSelect = document.getElementById("pkgAdminPlan");
  planSelect.innerHTML = (type ? type.plans : []).map((plan) => `<option value="${escapeAttribute(plan.id)}">${escapeHtml(plan.name)}</option>`).join("");
  const currentId = selectedId || planSelect.value || (type && type.plans[0] && String(type.plans[0].id));
  if (currentId) planSelect.value = String(currentId);
  renderPackageAdminFields();
}

function renderPackageAdminFields() {
  const type = selectedPackageType();
  const plan = selectedPackagePlan();
  document.getElementById("pkgAdminPlanName").value = plan ? plan.name : "";
  document.getElementById("pkgAdminPlanPrice").value = plan ? plan.price : "";
  document.getElementById("pkgAdminPlanNote").value = plan ? plan.note : "";
  document.getElementById("pkgAdminPopular").checked = Boolean(plan && plan.is_popular);
  document.getElementById("pkgAdminInclusions").value = type ? (type.inclusions || []).join("\n") : "";
}

async function savePackageAdmin() {
  const type = selectedPackageType();
  const plan = selectedPackagePlan();
  const status = document.getElementById("pkgAdminStatus");
  if (!type || !plan) return;
  const typeResponse = await authFetch(`/api/packages/types/${type.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: type.name, inclusions: document.getElementById("pkgAdminInclusions").value.split("\n").map((item) => item.trim()).filter(Boolean) }) });
  if (!typeResponse.ok) { const data = await readJsonResponse(typeResponse, "Home type"); status.textContent = data.error || "Could not save home type."; showAdminToast(data.error || "Could not save the home type.", "error"); return; }
  const planResponse = await authFetch(`/api/packages/plans/${plan.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: document.getElementById("pkgAdminPlanName").value.trim(), price: document.getElementById("pkgAdminPlanPrice").value, note: document.getElementById("pkgAdminPlanNote").value.trim(), is_popular: document.getElementById("pkgAdminPopular").checked }) });
  const planData = await readJsonResponse(planResponse, "Plan");
  status.textContent = planResponse.ok ? "Changes saved." : (planData.error || "Could not save plan.");
  if (planResponse.ok) { await loadPackagesAdmin(); showAdminToast("Plan and home type changes saved successfully."); }
  else showAdminToast(planData.error || "Could not save the plan.", "error");
}

document.getElementById("pkgAdminType").addEventListener("change", () => renderPackageAdminPlans());
document.getElementById("pkgAdminPlan").addEventListener("change", () => renderPackageAdminFields());
document.getElementById("pkgAdminSave").addEventListener("click", savePackageAdmin);
document.getElementById("pkgAdminAddPlan").addEventListener("click", async () => {
  const type = selectedPackageType();
  if (!type) return;
  const response = await authFetch(`/api/packages/types/${type.id}/plans`, { method: "POST" });
  if (response.ok) { const plan = await response.json(); await loadPackagesAdmin(); renderPackageAdminPlans(plan.id); showAdminToast("Plan added successfully."); }
  else showAdminToast("Could not add the plan.", "error");
});
document.getElementById("pkgAdminRemovePlan").addEventListener("click", async (event) => {
  const plan = selectedPackagePlan();
  if (!plan) return;
  if (!packageRemovePlanReady) { packageRemovePlanReady = true; event.currentTarget.textContent = "Click again to confirm"; return; }
  const response = await authFetch(`/api/packages/plans/${plan.id}`, { method: "DELETE" });
  packageRemovePlanReady = false;
  event.currentTarget.textContent = "Remove this plan";
  if (response.ok) { await loadPackagesAdmin(); showAdminToast("Plan removed successfully."); }
  else showAdminToast("Could not remove the plan.", "error");
});
document.getElementById("pkgAdminAddType").addEventListener("click", async () => {
  const input = document.getElementById("pkgAdminNewType");
  const response = await authFetch("/api/packages/types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: input.value.trim() }) });
  if (response.ok) { const type = await response.json(); input.value = ""; await loadPackagesAdmin(); renderPackageAdminTypes(type.id); showAdminToast("Home type added successfully."); }
  else showAdminToast("Could not add the home type.", "error");
});
document.getElementById("pkgAdminRemoveType").addEventListener("click", async (event) => {
  const type = selectedPackageType();
  if (!type) return;
  if (!packageRemoveTypeReady) { packageRemoveTypeReady = true; event.currentTarget.textContent = "Click again to confirm"; return; }
  const response = await authFetch(`/api/packages/types/${type.id}`, { method: "DELETE" });
  packageRemoveTypeReady = false;
  event.currentTarget.textContent = "Remove this home type";
  if (response.ok) { await loadPackagesAdmin(); showAdminToast("Home type removed successfully."); }
  else showAdminToast("Could not remove the home type.", "error");
});
document.getElementById("pkgAdminFootnote").addEventListener("change", async (event) => {
  const response = await authFetch("/api/packages/footnote", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ footnote: event.target.value.trim() }) });
  document.getElementById("pkgAdminStatus").textContent = response.ok ? "Footnote saved." : "Could not save footnote.";
  showAdminToast(response.ok ? "Planner footnote saved successfully." : "Could not save the planner footnote.", response.ok ? "success" : "error");
});

document.getElementById("settingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("settingsStatus");
  const payload = {
    whatsapp_number: document.getElementById("s-whatsapp").value.trim(),
    instagram_url: document.getElementById("s-instagram").value.trim(),
    contact_email: document.getElementById("s-email").value.trim(),
    location_url: document.getElementById("s-location").value.trim(),
    site_tagline: document.getElementById("s-tagline").value.trim(),
  };

  const res = await authFetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  statusEl.textContent = res.ok ? "Settings saved." : "Failed to save settings.";
  showAdminToast(res.ok ? "Settings saved successfully." : "Could not save settings.", res.ok ? "success" : "error");
});

// ============================================
// Utility
// ============================================
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
function escapeAttr(str) {
  return String(str ?? "").replace(/'/g, "\\'");
}
function escapeAttribute(str) {
  return escapeHtml(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function readJsonResponse(response, context) {
  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();

  if (!contentType.includes("application/json")) {
    const serverHint = body.trim().startsWith("<")
      ? " Restart the Node server and open the admin through http://localhost:5000/admin.html."
      : "";
    throw new Error(`${context} API returned an invalid response.${serverHint}`);
  }

  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new Error(`${context} API returned malformed JSON.`);
  }
}
