(function () {
  "use strict";

  const sceneElement = document.getElementById("gallery3dScene");
  const canvas = document.getElementById("gallery3dCanvas");
  const status = document.getElementById("gallery3dStatus");
  if (!sceneElement || !canvas || !status) return;

  let initializationStarted = false;

  const startWhenReady = () => {
    if (initializationStarted) return;
    initializationStarted = true;
    let attempts = 0;
    const waitForPortfolio = window.setInterval(() => {
      attempts += 1;
      if (typeof allGalleryItems !== "undefined" && allGalleryItems.length) {
        window.clearInterval(waitForPortfolio);
        initializeGallery3d(allGalleryItems);
      } else if (attempts > 100) {
        window.clearInterval(waitForPortfolio);
        status.textContent = "The interactive gallery is temporarily unavailable.";
      }
    }, 100);
  };

  if ("IntersectionObserver" in window) {
    const galleryObserver = new IntersectionObserver((entries, observer) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      startWhenReady();
    }, { rootMargin: "500px 0px" });
    galleryObserver.observe(sceneElement);
  } else {
    startWhenReady();
  }

  function initializeGallery3d(items) {
    if (typeof THREE === "undefined") {
      status.textContent = "The interactive gallery could not be loaded.";
      return;
    }

    const info = document.getElementById("gallery3dInfo");
    const infoType = document.getElementById("gallery3dInfoType");
    const infoTitle = document.getElementById("gallery3dInfoTitle");
    const infoDescription = document.getElementById("gallery3dInfoDescription");
    const closeButton = document.getElementById("gallery3dInfoClose");
    const hint = document.getElementById("gallery3dHint");
    if (!info || !infoType || !infoTitle || !infoDescription || !closeButton) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const desktopQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const PITCH_LIMIT = 0.2;
    const PITCH_SENSITIVITY_SCALE = PITCH_LIMIT / 0.55;
    let isDesktop = desktopQuery.matches;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    const devicePixelRatio = window.devicePixelRatio || 1;
    const maxPixelRatio = (navigator.hardwareConcurrency || 8) <= 4 ? 1.25 : 1.5;
    renderer.setPixelRatio(Math.min(devicePixelRatio, maxPixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
    camera.position.set(0, 0, 0);
    camera.rotation.order = "YXZ";

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const meshes = [];
    const videoElements = [];
    const visibleItems = items.slice(0, 20);
    const radius = 8.5;
    const geometry = new THREE.PlaneGeometry(2.65, 3.3);

    // Background tile loading (images/videos) and video playback both pause while
    // the user is actively scrolling, and resume once scrolling has settled for a
    // moment. Without this, staggered loads and video decode work keep running in
    // the background during and after the scroll, competing with the browser for
    // main-thread/GPU time right as the user scrolls into the next section.
    let isScrollSettled = true;
    let scrollSettleTimer = null;
    let isSceneVisible = false;
    let animFrameId = null;
    function onGalleryScroll() {
      isScrollSettled = false;
      videoElements.forEach((video) => video.pause());
      if (animFrameId) {
        window.cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      window.clearTimeout(scrollSettleTimer);
      scrollSettleTimer = window.setTimeout(() => {
        isScrollSettled = true;
        if (isSceneVisible) {
          videoElements.forEach((video) => {
            if (video.paused) video.play().catch(() => {});
          });
          if (!animFrameId) animate();
        }
      }, 700);
    }
    window.addEventListener("scroll", onGalleryScroll, { passive: true });

    function scheduleLoad(fn, delay) {
      window.setTimeout(function attempt() {
        if (isScrollSettled) fn();
        else window.setTimeout(attempt, 150);
      }, delay);
    }
    // Fit the full tile band to the camera frustum at the maximum pitch.
  const verticalFovRad = THREE.MathUtils.degToRad(58);
  const tileAngularHalfHeight = Math.atan((3.3 / 2) / radius);
  const maxElevation = PITCH_LIMIT + verticalFovRad / 2 + tileAngularHalfHeight;
  const yLimit = Math.sin(maxElevation);

    visibleItems.forEach((item, index) => {
      const itemMeta = normalizeGalleryItem(item);
      const cover = getGalleryCover(itemMeta) || { type: itemMeta.media_type || "image", file_path: itemMeta.file_path };
      const material = new THREE.MeshBasicMaterial({ color: 0xb9aa98, side: THREE.FrontSide, toneMapped: false });
      const mesh = new THREE.Mesh(geometry, material);
      const t = visibleItems.length === 1
        ? 0
        : 1 - index * (2 / (visibleItems.length - 1));
      const y = t * yLimit;
      const ringRadius = Math.sqrt(1 - y * y);
      const angle = index * Math.PI * (3 - Math.sqrt(5));
      mesh.position.set(Math.cos(angle) * ringRadius * radius, y * radius, Math.sin(angle) * ringRadius * radius);
      mesh.lookAt(0, 0, 0);
      mesh.userData = { item: itemMeta, fitX: 1, fitY: 1, glow: 0, targetGlow: 0 };
      scene.add(mesh);
      meshes.push(mesh);

      const loadMedia = () => {
        if (cover && cover.type === "video" && cover.file_path) {
          const video = document.createElement("video");
          video.src = withOptimizedMediaVersion(cover.file_path);
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = "metadata";
          video.crossOrigin = "anonymous";
          video.addEventListener("loadedmetadata", () => fitMedia(mesh, video.videoWidth, video.videoHeight), { once: true });
          videoElements.push(video);
          const texture = new THREE.VideoTexture(video);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;
          material.map = texture;
          material.needsUpdate = true;
          if (isSceneVisible) {
            video.play().catch(() => {});
          }
        } else if (cover && cover.file_path) {
          loader.load(cover.file_path, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
            fitMedia(mesh, texture.image.naturalWidth || texture.image.width, texture.image.naturalHeight || texture.image.height);
            material.map = texture;
            material.needsUpdate = true;
          });
        }
      };

      if (index < 4) loadMedia();
      else scheduleLoad(loadMedia, (index - 3) * 180);
    });
    status.hidden = true;

    function fitMedia(mesh, width, height) {
      if (!width || !height) return;
      const mediaAspect = width / height;
      const tileAspect = 2.65 / 3.3;
      if (mediaAspect > tileAspect) mesh.userData.fitY = tileAspect / mediaAspect;
      else mesh.userData.fitX = mediaAspect / tileAspect;
      mesh.scale.set(mesh.userData.fitX, mesh.userData.fitY, 1);
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoveredMesh = null;
    let selectedMesh = null;
    let dragging = false;
    let moved = false;
    let pointerId = null;
    let previousX = 0;
    let previousY = 0;
    let dragStartX = 0;
    let dragStartY = 0;
    let yaw = 0;
    let pitch = 0;
    let targetYaw = 0;
    let targetPitch = 0;
    let velocityYaw = 0;
    let velocityPitch = 0;
    let limitAnchorY = null;
    let limitDirection = 0;
    let desktopPointerX = 0;
    let desktopPointerY = 0;
    let pointerInside = false;
    let pointerNeedsRaycast = false;
    let suppressDesktopClick = false;

    function meshAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(meshes, false)[0]?.object || null;
    }

    function setHovered(mesh) {
      if (hoveredMesh === mesh) return;
      if (hoveredMesh) hoveredMesh.userData.targetGlow = 0;
      hoveredMesh = mesh;
      if (hoveredMesh) hoveredMesh.userData.targetGlow = 1;
      sceneElement.classList.toggle("is-hovering-tile", Boolean(hoveredMesh));
    }

    function openInfo(mesh) {
      if (!mesh || selectedMesh) return;
      selectedMesh = mesh;
      setHovered(null);
      const item = normalizeGalleryItem(mesh.userData.item);
      const mediaList = getGalleryMedia(item);
      if (!mediaList.length) return;
      const coverIndex = Math.max(0, Math.min(Number(item.cover_index) || 0, mediaList.length - 1));

      infoType.textContent = `${item.bhk_type || "Residential"} · ${mediaList[0]?.type === "video" ? "Motion" : "Collection"}`;
      infoTitle.textContent = item.title || "Untitled project";
      infoDescription.textContent = item.description || "A closer look at the design direction.";

      let media = info.querySelector(".gallery3d-info-media");
      if (!media) {
        media = document.createElement("div");
        media.className = "gallery3d-info-media";
        info.insertBefore(media, infoType);
      }
      media.innerHTML = renderDetailMediaMarkup(mediaList, coverIndex);
      bindDetailGallery(media, coverIndex);
      info.hidden = false;
      sceneElement.classList.add("has-open-info");
      window.requestAnimationFrame(() => info.classList.add("is-visible"));
    }

    function closeInfo() {
      if (!selectedMesh) return;
      selectedMesh = null;
      info.classList.remove("is-visible");
      sceneElement.classList.remove("has-open-info");
      const video = info.querySelector("video");
      if (video) video.pause();
      window.setTimeout(() => {
        if (!selectedMesh) info.hidden = true;
      }, reducedMotion ? 0 : 250);
    }

    function applyInteractionMode() {
      isDesktop = desktopQuery.matches;
      dragging = false;
      pointerId = null;
      setHovered(null);
      sceneElement.classList.toggle("is-touch", !isDesktop);
      sceneElement.style.touchAction =  "none";
      if (hint) hint.textContent = isDesktop ? "Move to look around" : "Drag to look around";
    }
    desktopQuery.addEventListener?.("change", applyInteractionMode);
    applyInteractionMode();

    document.addEventListener("pointermove", (event) => {
      if (!isDesktop || !dragging || selectedMesh) return;
      const totalDistance = Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY);
      if (!moved && totalDistance < 10) return;
      moved = true;
      const dx = event.clientX - previousX;
      const dy = event.clientY - previousY;
      previousX = event.clientX;
      previousY = event.clientY;
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      velocityYaw = dx * (horizontalFov / sceneElement.clientWidth);
      velocityPitch = dy * (verticalFov / sceneElement.clientHeight) * PITCH_SENSITIVITY_SCALE;
      yaw += velocityYaw;
      pitch = THREE.MathUtils.clamp(pitch + velocityPitch, -PITCH_LIMIT, PITCH_LIMIT);
      targetYaw = yaw;
      targetPitch = pitch;
    });

    sceneElement.addEventListener("pointermove", (event) => {
      if (isDesktop) {
        if (selectedMesh) return;
        desktopPointerX = event.clientX;
        desktopPointerY = event.clientY;
        pointerInside = true;
        pointerNeedsRaycast = true;
        return;
      }
      if (!dragging || event.pointerId !== pointerId || selectedMesh) return;
      const dx = event.clientX - previousX;
      const dy = event.clientY - previousY;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;

      // TOUCH: tilt the gallery until the pitch limit, then hand the extra
      // vertical movement over to normal page scrolling.
      velocityYaw = dx * 0.005;
      const pitchDelta = dy * 0.004 * PITCH_SENSITIVITY_SCALE;
      const proposedPitch = pitch + pitchDelta;
      const clampedPitch = THREE.MathUtils.clamp(proposedPitch, -PITCH_LIMIT, PITCH_LIMIT);
      const pitchOverflow = proposedPitch - clampedPitch;

      if (pitchOverflow !== 0) {
        window.scrollBy({ top: -pitchOverflow / (0.004 * PITCH_SENSITIVITY_SCALE), left: 0, behavior: "instant" });
        moved = true;
      }

      velocityPitch = -(pitchDelta - pitchOverflow);
      yaw += velocityYaw;
      pitch = clampedPitch;
      targetYaw = yaw;
      targetPitch = pitch;
      previousX = event.clientX;
      previousY = event.clientY;
    });

    sceneElement.addEventListener("pointerleave", () => {
      if (isDesktop) {
        pointerInside = false;
        pointerNeedsRaycast = false;
        setHovered(null);
      }
    });

    sceneElement.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".gallery3d-info")) return;
      if (selectedMesh) {
        if (!isDesktop) closeInfo();
        return;
      }
      if (isDesktop && event.button !== 0) return;
      dragging = true;
      moved = false;
      pointerId = event.pointerId;
      previousX = event.clientX;
      previousY = event.clientY;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      velocityYaw = 0;
      velocityPitch = 0;
      limitAnchorY = null;
      limitDirection = 0;
      sceneElement.setPointerCapture(pointerId);
      sceneElement.classList.add("is-dragging");
      if (isDesktop) sceneElement.style.cursor = "grabbing";
    });

    function release(event) {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      sceneElement.classList.remove("is-dragging");
      sceneElement.style.removeProperty("cursor");
      if (sceneElement.hasPointerCapture(pointerId)) sceneElement.releasePointerCapture(pointerId);
      if (isDesktop) {
        suppressDesktopClick = true;
        if (!moved) openInfo(meshAt(event.clientX, event.clientY));
        window.setTimeout(() => { suppressDesktopClick = false; }, 0);
      } else if (!moved) {
        const tapped = meshAt(event.clientX, event.clientY);
        if (tapped) openInfo(tapped);
      }
      limitAnchorY = null;
      limitDirection = 0;
      pointerId = null;
    }
    sceneElement.addEventListener("pointerup", release);
    sceneElement.addEventListener("pointercancel", release);
    canvas.addEventListener("click", (event) => {
      if (!isDesktop) return;
      if (suppressDesktopClick) return;
      if (moved) {
        moved = false;
        return;
      }
      if (selectedMesh) closeInfo();
      else openInfo(meshAt(event.clientX, event.clientY));
    });
    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      closeInfo();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && selectedMesh) closeInfo();
    });

    function resize() {
      const width = sceneElement.clientWidth;
      const height = sceneElement.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = width < 620 ? 68 : 58;
      camera.updateProjectionMatrix();
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(sceneElement);
    resize();

    function animate() {
      if (!isSceneVisible) {
        animFrameId = null;
        return;
      }
      animFrameId = window.requestAnimationFrame(animate);
      if (!selectedMesh && isDesktop && dragging) {
        const ease = reducedMotion ? 1 : 0.055;
        yaw = THREE.MathUtils.lerp(yaw, targetYaw, ease);
        pitch = THREE.MathUtils.lerp(pitch, targetPitch, ease);
      } else if (!selectedMesh && !dragging && !reducedMotion) {
        yaw += velocityYaw;
        pitch = THREE.MathUtils.clamp(pitch + velocityPitch, -PITCH_LIMIT, PITCH_LIMIT);
        targetYaw = yaw;
        targetPitch = pitch;
        velocityYaw *= 0.935;
        velocityPitch *= 0.935;
        if (Math.abs(velocityYaw) < 0.00002) velocityYaw = 0;
        if (Math.abs(velocityPitch) < 0.00002) velocityPitch = 0;
      }
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
      if (!selectedMesh && isDesktop && pointerInside && pointerNeedsRaycast) {
        const hovered = meshAt(desktopPointerX, desktopPointerY);
        setHovered(hovered);
        pointerNeedsRaycast = false;
      }
      meshes.forEach((mesh) => {
        mesh.userData.glow = THREE.MathUtils.lerp(mesh.userData.glow, mesh.userData.targetGlow, reducedMotion ? 1 : 0.12);
        const brightness = 0.72 + mesh.userData.glow * 0.28;
        mesh.material.color.setRGB(brightness, brightness, brightness);
        const hoverScale = 1 + mesh.userData.glow * 0.045;
        mesh.scale.set(mesh.userData.fitX * hoverScale, mesh.userData.fitY * hoverScale, hoverScale);
      });
      renderer.render(scene, camera);
    }

    if ("IntersectionObserver" in window) {
      const visibilityObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            isSceneVisible = entry.isIntersecting;
            if (isSceneVisible) {
              if (isScrollSettled) {
                videoElements.forEach((video) => {
                  video.play().catch(() => {});
                });
              }
              if (isScrollSettled && !animFrameId) {
                animate();
              }
            } else {
              videoElements.forEach((video) => {
                video.pause();
              });
              if (animFrameId) {
                cancelAnimationFrame(animFrameId);
                animFrameId = null;
              }
            }
          });
        },
        { rootMargin: "150px 0px" }
      );
      visibilityObserver.observe(sceneElement);
    } else {
      isSceneVisible = true;
      animate();
    }
  }
})();
