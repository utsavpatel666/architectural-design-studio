const FALLBACK_GALLERY = [
  {
    title: "Sunlit Family Living",
    bhk_type: "2BHK",
    media_type: "image",
    file_path: "assets/media/fallback-living.webp",
    description: "A warm living space with layered neutrals, hidden storage, and a relaxed everyday rhythm.",
    palette: "sunlit-stone",
  },
  {
    title: "Calm Primary Suite",
    bhk_type: "3BHK",
    media_type: "image",
    file_path: "assets/media/fallback-bedroom.webp",
    description: "Muted textures and tailored wardrobes create a restful bedroom with a boutique-hotel finish.",
    palette: "soft-sand",
  },
  {
    title: "Entertaining Kitchen",
    bhk_type: "4BHK+",
    media_type: "image",
    file_path: "assets/media/fallback-kitchen.webp",
    description: "Custom cabinetry, soft oak notes, and a social island layout made for long family evenings.",
    palette: "oak-night",
  },
  {
    title: "Focused Studio Office",
    bhk_type: "Commercial",
    media_type: "image",
    file_path: "assets/media/fallback-office.webp",
    description: "A refined workspace shaped for concentration, client meetings, and clean brand presence.",
    palette: "clay-ivory",
  },
  {
    title: "Compact Dining Nook",
    bhk_type: "1BHK",
    media_type: "image",
    file_path: "assets/media/fallback-dining.webp",
    description: "A compact dining corner that still feels collected, elegant, and easy to host in.",
    palette: "sunlit-stone",
  },
  {
    title: "Statement Foyer",
    bhk_type: "2BHK",
    media_type: "image",
    file_path: "assets/media/fallback-foyer.webp",
    description: "Strong first impressions through symmetry, texture, and warm feature lighting.",
    palette: "oak-night",
  },
];

const plannerState = {
  homeType: "2BHK",
  plan: "Gold",
  price: 900000,
  mood: "Warm minimal",
  timeline: "Ready in 2-3 months",
};

const FALLBACK_PACKAGES = {
  footnote: "Prices include POP, paint, electrical work and materials. GST is extra on all plan prices.",
  homeTypes: [
    { id: "fallback-2bhk", name: "2BHK", inclusions: ["Space planning", "Modular kitchen", "Wardrobes", "Lighting plan"], plans: [{ name: "Silver", price: 600000, note: "A polished essential foundation.", is_popular: false }, { name: "Gold", price: 900000, note: "More storage and refined detailing.", is_popular: true }, { name: "Platinum", price: 1250000, note: "A fully tailored elevated finish.", is_popular: false }] },
    { id: "fallback-3bhk", name: "3BHK", inclusions: ["Space planning", "Modular kitchen", "Wardrobes", "Lighting plan", "Custom furniture"], plans: [{ name: "Silver", price: 850000, note: "A polished essential foundation.", is_popular: false }, { name: "Gold", price: 1200000, note: "More storage and refined detailing.", is_popular: true }, { name: "Platinum", price: 1650000, note: "A fully tailored elevated finish.", is_popular: false }] },
    { id: "fallback-4bhk", name: "4BHK+", inclusions: ["Space planning", "Modular kitchen", "Wardrobes", "Lighting plan", "Custom furniture", "Styling direction"], plans: [{ name: "Silver", price: 1200000, note: "A polished essential foundation.", is_popular: false }, { name: "Gold", price: 1700000, note: "More storage and refined detailing.", is_popular: true }, { name: "Platinum", price: 2400000, note: "A fully tailored elevated finish.", is_popular: false }] },
    { id: "fallback-commercial", name: "Commercial", inclusions: ["Space planning", "Reception design", "Workstations", "Lighting plan", "Brand detailing"], plans: [{ name: "Essential", price: 700000, note: "A focused, efficient workplace base.", is_popular: true }, { name: "Signature", price: 1350000, note: "A stronger branded client experience.", is_popular: false }] },
  ],
};

let plannerPackages = FALLBACK_PACKAGES;

const plannerCopy = {
  "Warm minimal": "We would likely begin with storage-sensitive planning, layered neutral materials, and soft lighting that keeps the home bright without feeling clinical.",
  "Classic contemporary": "This direction suits elegant detailing, balanced contrast, and timeless joinery that still feels current for everyday living.",
  "Earthy luxe": "We would lean into tactile stone, wood tones, warm metals, and moodier layering for a richer residential feel.",
  "Quiet office": "This setup prioritizes focus, acoustic calm, clean circulation, and a composed client-facing experience.",
};

const spatialDetails = {
  circulation: {
    index: "01 / Planning",
    title: "Clear circulation",
    body: "Furniture and pathways are balanced so the room feels generous, even when the plan is compact.",
  },
  lighting: {
    index: "02 / Atmosphere",
    title: "Layered light",
    body: "Ambient, task, and accent lighting work together to shift the room naturally from day to evening.",
  },
  materials: {
    index: "03 / Materiality",
    title: "Quiet contrast",
    body: "Stone, timber, textile, and metal are composed with restraint so warmth comes through without visual noise.",
  },
};

let allGalleryItems = [];
let usingFallbackGallery = false;

function inferMediaType(filePath) {
  if (!filePath) return "image";
  const ext = filePath.split("?")[0].split("#")[0].toLowerCase();
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

function getGalleryMedia(item) {
  return normalizeGalleryItem(item).media || [];
}

function getGalleryCover(item) {
  const media = getGalleryMedia(item);
  if (!media.length) return null;
  const coverIndex = Number.isInteger(Number(item.cover_index)) ? Number(item.cover_index) : 0;
  return media[coverIndex] || media[0] || null;
}

function getDisplayFilteredGalleryItems(scope) {
  const allowed = scope === "portfolio" ? ["portfolio", "both"] : ["gallery3d", "both"];
  return (Array.isArray(allGalleryItems) ? allGalleryItems : []).filter((item) => {
    const itemDisplay = normalizeGalleryItem(item).display_in || "both";
    return allowed.includes(itemDisplay);
  });
}

function withOptimizedMediaVersion(filePath) {
  const url = new URL(filePath, document.baseURI);
  url.searchParams.set("media-version", "optimized-1");
  return url.href;
}

function renderDetailMediaMarkup(mediaList, activeIndex = 0) {
  const slides = mediaList.map((media, index) => {
    const isVideo = media.type === "video";
    const videoAttrs = isVideo ? ' muted loop playsinline preload="none" autoplay ' + (index === activeIndex ? "" : "data-paused=true") : "";
    return `
      <div class="detail-media-slide ${index === activeIndex ? "is-active" : ""}" data-index="${index}">
        ${isVideo
          ? `<video src="${escapeAttribute(withOptimizedMediaVersion(media.file_path))}" ${videoAttrs}></video>`
          : `<img src="${media.file_path}" alt="Project media" loading="lazy" />`}
      </div>
    `;
  }).join("");

  const dots = mediaList.map((_, index) => `
    <button type="button" class="detail-dot ${index === activeIndex ? "is-active" : ""}" data-index="${index}" aria-label="Show slide ${index + 1}"></button>
  `).join("");

  return `
    <div class="detail-gallery" data-detail-gallery="true">
      <div class="detail-gallery-slides">${slides}</div>
      <div class="detail-gallery-controls">
        <button type="button" class="detail-arrow detail-arrow-prev" aria-label="Previous media">‹</button>
        <div class="detail-gallery-meta">
          <span class="detail-counter">${activeIndex + 1} / ${mediaList.length}</span>
          <div class="detail-dots">${dots}</div>
        </div>
        <button type="button" class="detail-arrow detail-arrow-next" aria-label="Next media">›</button>
      </div>
    </div>
  `;
}

function bindDetailGallery(root, initialIndex = 0) {
  if (!root) return;
  const gallery = root.querySelector(".detail-gallery");
  if (!gallery) return;

  const slides = Array.from(gallery.querySelectorAll(".detail-media-slide"));
  const dots = Array.from(gallery.querySelectorAll(".detail-dot"));
  const prevBtn = gallery.querySelector(".detail-arrow-prev");
  const nextBtn = gallery.querySelector(".detail-arrow-next");
  const counter = gallery.querySelector(".detail-counter");

  let currentIndex = 0;

  const pauseNonActiveVideos = () => {
    slides.forEach((slide, index) => {
      const video = slide.querySelector("video");
      if (!video) return;
      if (index === currentIndex) {
        video.muted = true;
        video.playsInline = true;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  };

  const setIndex = (nextIndex) => {
    const maxIndex = Math.max(0, slides.length - 1);
    currentIndex = Math.min(Math.max(nextIndex, 0), maxIndex);

    slides.forEach((slide, index) => {
      slide.classList.toggle("is-active", index === currentIndex);
    });
    dots.forEach((dot, index) => {
      dot.classList.toggle("is-active", index === currentIndex);
    });
    if (counter) counter.textContent = `${currentIndex + 1} / ${slides.length}`;
    pauseNonActiveVideos();
  };

  prevBtn?.addEventListener("click", () => setIndex(currentIndex - 1));
  nextBtn?.addEventListener("click", () => setIndex(currentIndex + 1));
  dots.forEach((dot) => {
    dot.addEventListener("click", () => setIndex(Number(dot.dataset.index)));
  });

  gallery.addEventListener("touchstart", (event) => {
    gallery.dataset.touchStartX = String(event.touches[0].clientX);
  }, { passive: true });

  gallery.addEventListener("touchend", (event) => {
    const startX = Number(gallery.dataset.touchStartX || 0);
    const endX = event.changedTouches[0].clientX;
    const delta = endX - startX;
    if (Math.abs(delta) > 30) {
      setIndex(currentIndex + (delta < 0 ? 1 : -1));
    }
  }, { passive: true });

  setIndex(initialIndex);
}

function openSharedMediaDetail(item, mode = "lightbox") {
  const safeItem = normalizeGalleryItem(item);
  const mediaList = getGalleryMedia(safeItem);
  if (!mediaList.length) return;
  const coverIndex = Math.max(0, Math.min(Number(safeItem.cover_index) || 0, mediaList.length - 1));

  if (mode === "3d") {
    const info = document.getElementById("gallery3dInfo");
    const infoType = document.getElementById("gallery3dInfoType");
    const infoTitle = document.getElementById("gallery3dInfoTitle");
    const infoDescription = document.getElementById("gallery3dInfoDescription");
    if (!info || !infoType || !infoTitle || !infoDescription) return;

    infoType.textContent = `${safeItem.bhk_type || "Residential"} · ${mediaList[0]?.type === "video" ? "Motion" : "Collection"}`;
    infoTitle.textContent = safeItem.title || "Untitled project";
    infoDescription.textContent = safeItem.description || "A closer look at the design direction.";

    let mediaHost = info.querySelector(".gallery3d-info-media");
    if (!mediaHost) {
      mediaHost = document.createElement("div");
      mediaHost.className = "gallery3d-info-media";
      info.insertBefore(mediaHost, infoType);
    }

    mediaHost.innerHTML = renderDetailMediaMarkup(mediaList, coverIndex);
    bindDetailGallery(mediaHost, coverIndex);
    info.hidden = false;
    window.requestAnimationFrame(() => info.classList.add("is-visible"));
    return;
  }

  const lightbox = document.getElementById("lightbox");
  const lightboxMedia = document.getElementById("lightboxMedia");
  const lightboxTitle = document.getElementById("lightboxTitle");
  const lightboxDescription = document.getElementById("lightboxDescription");

  if (!lightbox || !lightboxMedia || !lightboxTitle || !lightboxDescription) return;

  lightboxTitle.textContent = safeItem.title || "Project preview";
  lightboxDescription.textContent = safeItem.description || "A closer look at the space planning, material direction, and overall project mood.";
  lightboxMedia.innerHTML = renderDetailMediaMarkup(mediaList, coverIndex);
  bindDetailGallery(lightboxMedia, coverIndex);

  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("lightbox-open");
}

window.openSharedMediaDetail = openSharedMediaDetail;

document.getElementById("year").textContent = new Date().getFullYear();

setupNavState();
setupMobileNav();
setupSpatialStory();
setupPlanner();
loadPackages();
setupLightbox();
setupAnimations();
loadGallery();
loadTeam();
loadFaq();
loadSettings();

function setupNavState() {
  const nav = document.getElementById("nav");
  if (!nav) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ticking = false;
  let lastScrollY = window.scrollY;
  let isHidden = false;

  const sync = () => {
    const currentY = window.scrollY;
    const delta = currentY - lastScrollY;
    const atTop = currentY < 20;

    if (atTop) {
      nav.classList.remove("is-hidden");
      nav.classList.remove("scrolled");
    } else {
      nav.classList.add("scrolled");
      if (!reducedMotion && Math.abs(delta) > 8) {
        if (delta > 0 && !isHidden) {
          nav.classList.add("is-hidden");
          isHidden = true;
        } else if (delta < 0 && isHidden) {
          nav.classList.remove("is-hidden");
          isHidden = false;
        }
      }
    }

    lastScrollY = currentY;
    ticking = false;
  };

  sync();
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        window.requestAnimationFrame(sync);
        ticking = true;
      }
    },
    { passive: true }
  );
}

function setupMobileNav() {
  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("mobileNav");
  if (!toggle || !menu) return;

  const close = () => {
    toggle.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  };

  toggle.addEventListener("click", () => {
    const opening = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(opening));
    menu.hidden = !opening;
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1100) close();
  });
}


function setupSpatialStory() {
  const points = document.querySelectorAll(".spatial-point");
  const detail = document.getElementById("spatialDetail");
  if (!points.length || !detail) {
    return;
  }

  points.forEach((point) => {
    point.addEventListener("click", () => {
      const content = spatialDetails[point.dataset.detail];
      if (!content) {
        return;
      }

      points.forEach((item) => {
        const isActive = item === point;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-pressed", String(isActive));
      });
      document.getElementById("spatialDetailIndex").textContent = content.index;
      document.getElementById("spatialDetailTitle").textContent = content.title;
      document.getElementById("spatialDetailBody").textContent = content.body;

      detail.classList.remove("is-changing");
      window.requestAnimationFrame(() => detail.classList.add("is-changing"));
    });
  });
}

function setupPlanner() {
  const groups = document.querySelectorAll(".planner-options");
  groups.forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest(".planner-chip");
      if (!button) {
        return;
      }

      group.querySelectorAll(".planner-chip").forEach((chip) => chip.classList.remove("is-active"));
      button.classList.add("is-active");
      plannerState[group.dataset.group] = button.dataset.value;
      syncPlannerSummary();
    });
  });

  document.getElementById("plannerApply").addEventListener("click", () => {
    syncPlannerSummary(true);
  });

  syncPlannerSummary();
}

function syncPlannerSummary(focusContact = false) {
  const summary = document.getElementById("plannerSummary");
  const heading = summary.querySelector("h3");
  const body = summary.querySelector("p");
  const contactEcho = document.getElementById("plannerEcho");
  const projectType = document.getElementById("bhk_interest");

  const planSummary = plannerState.plan ? ` / ${plannerState.plan} (${formatIndianPrice(plannerState.price)} + GST)` : "";
  heading.textContent = `${plannerState.mood} for a ${plannerState.homeType}${planSummary} planned ${plannerState.timeline.toLowerCase()}.`;
  body.textContent = plannerCopy[plannerState.mood] || plannerCopy["Warm minimal"];
  contactEcho.innerHTML = `Planner selected: <strong>${escapeHtml(plannerState.homeType)} / ${escapeHtml(plannerState.plan)} (${escapeHtml(formatIndianPrice(plannerState.price))} + GST) / ${escapeHtml(plannerState.mood)} / ${escapeHtml(plannerState.timeline)}</strong>`;

  if (projectType) {
    const normalizedType = plannerState.homeType === "Commercial" ? "Commercial" : plannerState.homeType;
    projectType.value = Array.from(projectType.options).some((option) => option.value === normalizedType) ? normalizedType : "";
  }

  if (focusContact) {
    window.setTimeout(() => {
      document.getElementById("name").focus();
    }, 250);
  }
}

function formatIndianPrice(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function renderPackagePlans() {
  const typeButtons = document.getElementById("pkgHomeTypes");
  const planGrid = document.getElementById("pkgPlanGrid");
  const footnote = document.getElementById("pkgFootnote");
  if (!typeButtons || !planGrid) return;
  const activeType = plannerPackages.homeTypes.find((type) => type.name === plannerState.homeType) || plannerPackages.homeTypes[0];
  if (!activeType) return;
  plannerState.homeType = activeType.name;
  const plans = Array.isArray(activeType.plans) ? activeType.plans : [];
  const selectedPlan = plans.find((plan) => plan.name === plannerState.plan) || plans.find((plan) => plan.is_popular) || plans[0];
  if (selectedPlan) {
    plannerState.plan = selectedPlan.name;
    plannerState.price = Number(selectedPlan.price) || 0;
  }
  typeButtons.innerHTML = plannerPackages.homeTypes.map((type) => `<button type="button" class="planner-chip pkg-home-type-btn ${type.name === plannerState.homeType ? "is-active" : ""}" data-pkg-home-type="${escapeAttribute(type.name)}" aria-pressed="${type.name === plannerState.homeType}">${escapeHtml(type.name)}</button>`).join("");
  planGrid.innerHTML = plans.map((plan) => {
    const selected = plan.name === plannerState.plan;
    const popular = Boolean(plan.is_popular);
    return `<article class="pkg-plan-card ${popular ? "pkg-plan-popular" : ""} ${selected ? "pkg-plan-selected" : ""}">${popular ? '<span class="pkg-plan-badge">Most chosen</span>' : ""}<h4>${escapeHtml(plan.name)}</h4><div class="pkg-plan-price">${escapeHtml(formatIndianPrice(plan.price))} <small>+ GST</small></div><p>${escapeHtml(plan.note || "A considered plan for your space.")}</p><ul>${(activeType.inclusions || []).map((item) => `<li><span aria-hidden="true">✓</span>${escapeHtml(item)}</li>`).join("")}</ul><button type="button" class="pkg-plan-select" data-pkg-plan="${escapeAttribute(plan.name)}" aria-pressed="${selected}">${selected ? "Selected" : `Select ${escapeHtml(plan.name)}`}</button></article>`;
  }).join("");
  footnote.textContent = plannerPackages.footnote || FALLBACK_PACKAGES.footnote;
  typeButtons.querySelectorAll("[data-pkg-home-type]").forEach((button) => button.addEventListener("click", () => {
    plannerState.homeType = button.dataset.pkgHomeType;
    plannerState.plan = "";
    renderPackagePlans();
    syncPlannerSummary();
  }));
  planGrid.querySelectorAll("[data-pkg-plan]").forEach((button) => button.addEventListener("click", () => {
    const plan = plans.find((item) => item.name === button.dataset.pkgPlan);
    if (!plan) return;
    plannerState.plan = plan.name;
    plannerState.price = Number(plan.price) || 0;
    renderPackagePlans();
    syncPlannerSummary();
  }));
}

async function loadPackages() {
  try {
    const response = await fetch("/api/packages");
    const data = await readJsonResponse(response, "Packages");
    if (!response.ok || !Array.isArray(data.homeTypes) || !data.homeTypes.length) throw new Error("Packages unavailable");
    plannerPackages = data;
  } catch (error) {
    plannerPackages = FALLBACK_PACKAGES;
  }
  renderPackagePlans();
  syncPlannerSummary();
}

async function loadGallery() {
  try {
    const res = await fetch("/api/gallery");
    const items = await readJsonResponse(res, "Gallery");
    const normalizedItems = Array.isArray(items) ? items.map(normalizeGalleryItem) : [];
    usingFallbackGallery = !Array.isArray(items) || normalizedItems.length === 0;
    allGalleryItems = usingFallbackGallery ? FALLBACK_GALLERY.map(normalizeGalleryItem) : normalizedItems;
    window.gallery3dItems = getDisplayFilteredGalleryItems("gallery3d");
    window.portfolioItems = getDisplayFilteredGalleryItems("portfolio");
    renderGalleryTabs();
    renderGallery("All");
    refreshScrollTriggers();
  } catch (error) {
    console.error("Failed to load gallery:", error);
    usingFallbackGallery = true;
    allGalleryItems = FALLBACK_GALLERY.map(normalizeGalleryItem);
    window.gallery3dItems = getDisplayFilteredGalleryItems("gallery3d");
    window.portfolioItems = getDisplayFilteredGalleryItems("portfolio");
    renderGalleryTabs();
    renderGallery("All");
    refreshScrollTriggers();
  }
}

async function loadTeam() {
  const section = document.getElementById("team");
  const stage = document.getElementById("teamStage");
  if (!section || !stage) return;

  try {
    const res = await fetch("/api/team");
    const members = await readJsonResponse(res, "Team");
    if (!res.ok || !Array.isArray(members)) throw new Error("Team profiles are unavailable.");

    section.classList.toggle("is-empty", members.length === 0);

    if (members.length === 0) {
      stage.innerHTML = `
        <div class="team-loading">
          <span>The studio</span>
          <p>Our team profiles will be introduced here soon.</p>
        </div>
      `;
      refreshScrollTriggers();
      return;
    }

    stage.innerHTML = members
      .map(
        (member, index) => `
          <article class="team-member" data-member-index="${index}" aria-hidden="false">
            <figure class="team-member-photo">
              <img src="${escapeAttribute(member.photo_path)}" alt="Portrait of ${escapeAttribute(member.name)}" loading="lazy" />
            </figure>
            <div class="team-member-copy">
              <span class="team-member-number">${formatTeamIndex(index + 1)} / ${formatTeamIndex(members.length)}</span>
              <span class="team-member-role">${escapeHtml(member.role)}</span>
              <h3>${escapeHtml(member.name)}</h3>
              ${member.focus ? `<p class="team-member-focus">${escapeHtml(member.focus)}</p>` : ""}
              <p class="team-member-bio">${escapeHtml(member.bio)}</p>
            </div>
          </article>
        `
      )
      .join("");

    refreshScrollTriggers();
  } catch (error) {
    console.error("Failed to load team:", error);
    section.classList.add("is-empty");
    stage.innerHTML = `
      <div class="team-loading">
        <span>The studio</span>
        <p>Our team profiles will be introduced here soon.</p>
      </div>
    `;
    refreshScrollTriggers();
  }
}

function formatTeamIndex(value) {
  return String(value).padStart(2, "0");
}

function renderGalleryTabs() {
  const tabsEl = document.getElementById("bhkTabs");
  const portfolioItems = getDisplayFilteredGalleryItems("portfolio");
  const types = ["All", ...new Set(portfolioItems.map((item) => item.bhk_type).filter(Boolean))];

  tabsEl.innerHTML = "";
  types.forEach((type, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `bhk-tab${index === 0 ? " active" : ""}`;
    button.textContent = type;
    button.addEventListener("click", () => {
      tabsEl.querySelectorAll(".bhk-tab").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      renderGallery(type);
    });
    tabsEl.appendChild(button);
  });
}

function renderGallery(filterType) {
  const grid = document.getElementById("galleryGrid");
  const portfolioItems = getDisplayFilteredGalleryItems("portfolio");
  const items = filterType === "All" ? portfolioItems : portfolioItems.filter((item) => item.bhk_type === filterType);

  document.getElementById("galleryCountLabel").textContent = `${items.length} ${items.length === 1 ? "space" : "spaces"}`;
  document.getElementById("gallerySummaryNote").textContent = usingFallbackGallery
    ? "Curated preview concepts are showing until the studio uploads its live portfolio."
    : `Showing ${filterType === "All" ? "every available category" : filterType + " layouts"} from the current portfolio.`;

  if (items.length === 0) {
    grid.innerHTML = '<p class="gallery-empty">No designs are available for this category yet.</p>';
    return;
  }

  grid.innerHTML = items
    .map((item, index) => {
      const cover = getGalleryCover(item);
      const typeLabel = escapeHtml(item.bhk_type || "Residential");
      const description = escapeHtml(item.description || "Tailored planning, materials, and styling shaped around the room.");
      const title = escapeHtml(item.title || "Untitled project");
      const media = renderGalleryMedia(item, index);
      const kindLabel = cover && cover.type === "video" ? "Motion" : "Collection";

      return `
        <button
          type="button"
          class="gallery-card reveal-up"
          data-gallery-index="${index}"
          data-filter="${escapeHtml(filterType)}"
          aria-label="Open preview for ${title}"
        >
          ${media}
          <div class="gallery-copy">
            <div class="gallery-topline">
              <span class="gallery-tag">${typeLabel}</span>
              <span class="gallery-kind">${kindLabel}</span>
            </div>
            <h3>${title}</h3>
            <p>${description}</p>
            <span class="gallery-cta">View details</span>
          </div>
        </button>
      `;
    })
    .join("");

  grid.querySelectorAll(".gallery-card").forEach((card, index) => {
    card.addEventListener("click", () => openSharedMediaDetail(items[index], "lightbox"));
  });

    const gridVideos = grid.querySelectorAll("video");
    if (gridVideos.length && "IntersectionObserver" in window) {
      const gridVideoObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const vid = entry.target;
            if (entry.isIntersecting) {
              vid.play().catch(() => {});
            } else {
              vid.pause();
            }
          });
        },
        { threshold: 0.2 }
      );
      gridVideos.forEach((vid) => gridVideoObserver.observe(vid));
    }
  animateReveal(grid.querySelectorAll(".reveal-up"), 0.08);
}

function renderGalleryMedia(item, index) {
  const cover = getGalleryCover(item);
  if (!cover) {
    const palette = escapeHtml(item.palette || FALLBACK_GALLERY[index % FALLBACK_GALLERY.length].palette);
    return `
      <div class="gallery-placeholder ${palette}">
        <div class="placeholder-mark">
          <span>Sahaj Space Studio</span>
          <strong>${escapeHtml(item.bhk_type || "Project")}</strong>
        </div>
      </div>
    `;
  }

  if (cover.type === "video") {
    return `
      <div class="gallery-media">
        <video src="${escapeAttribute(withOptimizedMediaVersion(cover.file_path))}" muted loop playsinline preload="none"></video>
      </div>
    `;
  }

  return `
    <div class="gallery-media">
      <img src="${cover.file_path}" alt="${escapeHtml(item.title || "Project image")}" loading="lazy" />
    </div>
  `;
}

function setupLightbox() {
  const lightbox = document.getElementById("lightbox");
  const closeButton = document.getElementById("lightboxClose");

  const close = () => {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    document.getElementById("lightboxMedia").innerHTML = "";
  };

  closeButton.addEventListener("click", close);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox.classList.contains("open")) {
      close();
    }
  });
}

async function loadFaq() {
  try {
    const res = await fetch("/api/faq");
    const faqs = await readJsonResponse(res, "FAQ");
    const list = document.getElementById("faqList");

    if (!Array.isArray(faqs) || faqs.length === 0) {
      list.innerHTML = '<p class="gallery-empty">Questions and answers will be added here soon.</p>';
      return;
    }

    list.innerHTML = faqs
      .map(
        (faq, index) => `
          <article class="faq-item">
            <button type="button" class="faq-question" aria-expanded="${index === 0 ? "true" : "false"}">
              <span>${escapeHtml(faq.question)}</span>
            </button>
            <div class="faq-answer">${escapeHtml(faq.answer)}</div>
          </article>
        `
      )
      .join("");

    list.querySelectorAll(".faq-item").forEach((item, index) => {
      const button = item.querySelector(".faq-question");
      if (index === 0) {
        item.classList.add("open");
      }

      button.addEventListener("click", () => {
        const isOpen = item.classList.toggle("open");
        button.setAttribute("aria-expanded", String(isOpen));
      });
    });
  } catch (error) {
    console.error("Failed to load FAQ:", error);
  }
}

async function loadSettings() {
  try {
    const res = await fetch("/api/settings", { cache: "no-store" });
    const settings = await readJsonResponse(res, "Settings");
    const channelsEl = document.getElementById("contactChannels");
    const heroTagline = document.getElementById("heroTagline");

    renderStudioSnapshot(settings);

    if (settings.site_tagline) {
      heroTagline.textContent = settings.site_tagline;
    }

    const whatsappNumber = (settings.whatsapp_number || "").trim();
    const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}` : "";
    const email = (settings.contact_email || "").trim();
    const instagramUrl = (settings.instagram_url || "").trim();
    const instagramHandle = getInstagramHandle(instagramUrl);
    const locationRaw = (settings.location_url || "").trim();
    const locationUrl = buildLocationUrl(locationRaw);
    const locationLabel = getLocationLabel(locationRaw);

    const navWhatsapp = document.getElementById("navWhatsapp");
    if (navWhatsapp) {
      navWhatsapp.href = whatsappUrl || "#";
    }

    const channelItems = [
      {
        label: "WhatsApp",
        href: whatsappUrl,
        text: whatsappNumber || "Add your WhatsApp number in admin settings",
        external: true,
      },
      {
        label: "Email",
        href: email ? `mailto:${email}` : "",
        text: email || "Add your email in admin settings",
        external: false,
      },
      {
        label: "Instagram",
        href: instagramUrl,
        text: instagramHandle,
        external: true,
      },
      {
        label: "Location",
        href: locationUrl,
        text: locationLabel || "Add your location in admin settings",
        external: true,
      },
    ];

    channelsEl.innerHTML = channelItems.map((item) => {
      const href = item.href || "#";
      const targetAttrs = item.external && item.href ? ` target="_blank" rel="noopener"` : "";
      return `
        <li>
          <a class="contact-channel" href="${escapeHtml(href)}"${targetAttrs}>
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.text)}</span>
          </a>
        </li>
      `;
    }).join("");

    setContactSocial("socialEmail", email ? `mailto:${email}` : "");
    setContactSocial("socialWhatsapp", whatsappUrl);
    setContactSocial("socialInstagram", instagramUrl);
    setContactSocial("socialLocation", locationUrl);
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

function renderStudioSnapshot(settings) {
  const headline = document.getElementById("studioHeadline");
  const statsEl = document.getElementById("studioStats");
  const pillsEl = document.getElementById("studioPills");
  if (!headline || !statsEl || !pillsEl) return;

  if (settings.studio_headline) headline.textContent = settings.studio_headline;
  try {
    const stats = JSON.parse(settings.studio_stats || "null");
    if (Array.isArray(stats) && stats.length >= 3 && stats.length <= 5) {
      statsEl.innerHTML = stats.map((stat, index) => `<article class="stat-card"><strong${index === 0 ? ' id="statProjects"' : ""}${index === 1 ? ' id="statTypes"' : ""}${index === 2 ? ' id="statFaqs"' : ""}>${escapeHtml(stat.value)}</strong><span>${escapeHtml(stat.label)}</span></article>`).join("");
      statsEl.dataset.count = String(stats.length);
    }
  } catch (error) {
    console.error("Failed to load Studio Snapshot stats:", error);
  }
  try {
    const pills = JSON.parse(settings.studio_pills || "null");
    if (Array.isArray(pills) && pills.length <= 15) {
      pillsEl.innerHTML = pills.map((pill) => `<span>${escapeHtml(pill)}</span>`).join("");
    }
  } catch (error) {
    console.error("Failed to load Studio Snapshot tags:", error);
  }
}

function setContactSocial(id, href) {
  const link = document.getElementById(id);
  if (!link) return;

  if (href) {
    link.href = href;
    link.hidden = false;
  } else {
    link.removeAttribute("href");
    link.hidden = true;
  }
}

function buildLocationUrl(value) {
  const location = value.trim();
  if (!location) return "";
  if (/^https?:\/\//i.test(location)) return location;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

function getLocationLabel(value) {
  const location = value.trim();
  if (!location) return "";
  if (!/^https?:\/\//i.test(location)) return location;

  try {
    const parsed = new URL(location);
    if (parsed.hostname.includes("google.") || parsed.hostname.includes("maps.")) {
      return "View studio on Maps";
    }
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "View studio on Maps";
  }
}

function getInstagramHandle(url) {
  if (!url || url === "#") {
    return "@studioaura";
  }

  try {
    const parsed = new URL(url);
    const handle = parsed.pathname.replace(/\//g, "").trim();
    return handle ? `@${handle}` : "@studioaura";
  } catch {
    return "@studioaura";
  }
}

document.getElementById("contactForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const statusEl = document.getElementById("formStatus");
  const submitBtn = form.querySelector(".form-submit");
  const combinedMessage = buildMessageWithPlanner(form.message.value.trim());

  const payload = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    bhk_interest: form.bhk_interest.value,
    budget: form.budget.value,
    message: combinedMessage,
  };

  submitBtn.disabled = true;
  statusEl.textContent = "Sending...";
  statusEl.className = "form-status";

  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await readJsonResponse(res, "Contact form");
    if (res.ok) {
      statusEl.textContent = data.message || "Thanks. We will be in touch soon.";
      statusEl.className = "form-status success";
      form.reset();
      resetPlannerLinkedField();
    } else {
      statusEl.textContent = data.error || "Something went wrong. Please try again.";
      statusEl.className = "form-status error";
    }
  } catch (error) {
    console.error("Failed to submit contact form:", error);
    statusEl.textContent = "Network error. Please try again.";
    statusEl.className = "form-status error";
  } finally {
    submitBtn.disabled = false;
  }
});

function buildMessageWithPlanner(userMessage) {
  const plannerLine = `Planner preferences: ${plannerState.homeType}, ${plannerState.plan} (${formatIndianPrice(plannerState.price)} + GST), ${plannerState.mood}, ${plannerState.timeline}.`;
  const combined = userMessage ? `${plannerLine}\n${userMessage}` : plannerLine;
  return combined.slice(0, 1000);
}

function resetPlannerLinkedField() {
  const projectType = document.getElementById("bhk_interest");
  if (projectType) {
    const normalizedType = plannerState.homeType === "Commercial" ? "Commercial" : plannerState.homeType;
    projectType.value = normalizedType;
  }
}

function setupAnimations() {
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  if (!hasGsap) {
    document.body.classList.add("no-motion-runtime");
    document.querySelectorAll(".reveal-up").forEach((element) => element.classList.add("is-visible"));
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  gsap.from(".hero-copy > *", {
    y: 28,
    opacity: 0,
    duration: 0.8,
    stagger: 0.12,
    ease: "power3.out",
  });

  gsap.fromTo(
    ".image-reveal",
    { clipPath: "inset(0 0 100% 0 round 6px)" },
    {
      clipPath: "inset(0 0 0% 0 round 6px)",
      duration: 1.25,
      ease: "power4.inOut",
      scrollTrigger: { trigger: ".image-reveal", start: "top 82%" },
    }
  );

  gsap.to(".spatial-canvas > img", {
    yPercent: 5,
    ease: "none",
    scrollTrigger: {
      trigger: ".spatial-canvas",
      start: "top bottom",
      end: "bottom top",
      scrub: 0.7,
    },
  });

  

  animateReveal(document.querySelectorAll(".section-heading, .spatial-story-heading > p, .stat-card, .signature-card, .planner-controls, .planner-summary, .contact-info, .contact-form, .contact-socials"), 0.08);
  initProcessScroll();
  window.addEventListener("load", refreshScrollTriggers, { once: true });
  window.addEventListener("resize", () => {
    clearTimeout(window.__processRefreshTimer);
    window.__processRefreshTimer = setTimeout(refreshScrollTriggers, 120);
  });
}

function animateReveal(elements, stagger = 0.08) {
  const items = Array.from(elements || []);
  if (!items.length) {
    return;
  }

  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  if (!hasGsap) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  if (typeof ScrollTrigger.batch === "function") {
    ScrollTrigger.batch(items, {
      start: "top 88%",
      onEnter: (batch) => {
        gsap.fromTo(
          batch,
          { y: 26, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger,
            ease: "power3.out",
            overwrite: "auto",
          }
        );
      },
      once: true,
    });
  } else {
    items.forEach((item) => {
      gsap.fromTo(
        item,
        { y: 26, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: item,
            start: "top 86%",
            once: true,
          },
        }
      );
    });
  }
}

function initProcessScroll() {
  const processSection = document.querySelector(".process");
  const steps = gsap.utils.toArray(".process-step");
  const visuals = gsap.utils.toArray(".process-visual");
  if (!processSection || !steps.length || !visuals.length) {
    return;
  }

  let activeIndex = -1;

  const setActiveStep = (index) => {
    const next = Math.max(0, Math.min(steps.length - 1, Number(index) || 0));
    if (next === activeIndex) return;
    activeIndex = next;
    steps.forEach((step, stepIndex) => step.classList.toggle("is-active", stepIndex === next));
    visuals.forEach((visual, visualIndex) => visual.classList.toggle("is-active", visualIndex === next));
  };

  const progressToIndex = (progress) => {
    const count = steps.length;
    if (progress <= 0) return 0;
    if (progress >= 1) return count - 1;
    return Math.min(count - 1, Math.floor(progress * count));
  };

  const syncFromTrigger = (self) => {
    setActiveStep(progressToIndex(self.progress));
  };

  setActiveStep(0);

  ScrollTrigger.matchMedia({
    "(min-width: 781px)": () => {
      activeIndex = -1;
      setActiveStep(0);

      const trigger = ScrollTrigger.create({
        trigger: processSection,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * steps.length * 0.45)}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: syncFromTrigger,
        onRefresh: syncFromTrigger,
        onEnter: (self) => {
          activeIndex = -1;
          syncFromTrigger(self);
        },
        onEnterBack: (self) => {
          activeIndex = -1;
          syncFromTrigger(self);
        },
        onLeave: () => {
          activeIndex = -1;
          setActiveStep(steps.length - 1);
        },
        onLeaveBack: () => {
          activeIndex = -1;
          setActiveStep(0);
        },
      });

      requestAnimationFrame(() => ScrollTrigger.refresh());

      return () => {
        trigger.kill();
        activeIndex = -1;
        setActiveStep(0);
      };
    },
    "(max-width: 780px)": () => {
      steps.forEach((step) => step.classList.add("is-active"));
      visuals.forEach((visual) => visual.classList.add("is-active"));
      activeIndex = -1;

      return () => {
        activeIndex = -1;
        setActiveStep(0);
      };
    },
  });
}

function refreshScrollTriggers() {
  if (typeof window.ScrollTrigger === "undefined") return;
  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
  });
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function readJsonResponse(response, context) {
  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();

  if (!contentType.includes("application/json")) {
    const serverHint = body.trim().startsWith("<")
      ? " Restart the Node server and open the site through its backend URL."
      : "";
    throw new Error(`${context} service returned an invalid response.${serverHint}`);
  }

  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new Error(`${context} service returned malformed data.`);
  }
}
