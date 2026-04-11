const totalPages = 11;
const pages = Array.from({ length: totalPages }, (_, index) => {
  const pageNumber = String(index + 1).padStart(4, "0");
  return `comics/Cinderella-2026-${pageNumber}.png`;
});

const spreads = buildSpreads(pages);
const mobileMediaQuery = window.matchMedia("(max-width: 640px)");
const touchDeviceMediaQuery = window.matchMedia("(max-width: 900px)");

const pageShell = document.querySelector(".page-shell");
const reader = document.querySelector(".reader");
const spreadRoot = document.getElementById("spread");
const spreadLabel = document.getElementById("spread-label");
const prevButton = document.getElementById("prev-button");
const nextButton = document.getElementById("next-button");
const tapLeft = document.getElementById("tap-left");
const tapRight = document.getElementById("tap-right");
const fullscreenToggleButton = document.getElementById("fullscreen-toggle");
let previousSinglePageMode = mobileMediaQuery.matches;

let currentIndex = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchTracking = false;
let touchMoved = false;
let lastTapTime = 0;
let singleTapTimeoutId = null;
let wheelDeltaX = 0;
let wheelDeltaY = 0;
let wheelResetTimeoutId = null;
let currentEnterDirection = "default";
let panOffsetX = 0;
let panMinX = 0;
let panOffsetY = 0;
let panMinY = 0;
let panStartOffsetX = 0;
let panStartOffsetY = 0;
let currentPanImage = null;
let touchStartTime = 0;
let wheelGestureLocked = false;
let panPointerActive = false;
let panPointerId = null;
let panPointerStartX = 0;
let panPointerStartY = 0;
let autoplayFrameId = null;
let autoplayResumeTimeoutId = null;
let lastAutoplayTimestamp = 0;
let autoplayDirection = -1;
let autoplayAxis = "x";
const AUTOPLAY_RESUME_DELAY = 1800;
const AUTOPLAY_CYCLE_MS = 18000;
const PAN_OVERSCROLL_PX = 10;
const FAST_SWIPE_DURATION_MS = 180;
const FAST_SWIPE_DISTANCE_PX = 120;

function buildSpreads(pageList) {
  const result = [];

  if (pageList.length === 0) {
    return result;
  }

  result.push({ left: null, right: pageList[0], pages: [1] });

  for (let index = 1; index < pageList.length; index += 2) {
    const leftPage = pageList[index] || null;
    const rightPage = pageList[index + 1] || null;
    const pageNumbers = [];

    if (leftPage) {
      pageNumbers.push(index + 1);
    }

    if (rightPage) {
      pageNumbers.push(index + 2);
    }

    result.push({
      left: leftPage,
      right: rightPage,
      pages: pageNumbers,
    });
  }

  return result;
}

function createPageSlot(side, src, alt) {
  const slot = document.createElement("div");
  slot.className = `page-slot ${side}${src ? "" : " empty"}`;
  slot.dataset.enter = "true";
  slot.dataset.enterDirection = currentEnterDirection;

  if (src) {
    const img = document.createElement("img");
    img.className = "comic-page";
    img.src = src;
    img.alt = alt;
    img.loading = "eager";
    slot.appendChild(img);
  }

  return slot;
}

function isMobileView() {
  return mobileMediaQuery.matches;
}

function isTouchLayout() {
  return touchDeviceMediaQuery.matches;
}

function isMobilePortraitReader() {
  return isTouchLayout() && window.innerHeight > window.innerWidth;
}

function isTouchFullscreenMode() {
  return isFullscreenActive() && isTouchLayout();
}

function isPortraitMobileFullscreen() {
  return isFullscreenActive() && isMobilePortraitReader();
}

function isSinglePageMode() {
  return isMobileView() || isTouchFullscreenMode();
}

function spreadIndexToPageIndex(index) {
  const spread = spreads[Math.max(0, Math.min(index, spreads.length - 1))];
  return Math.max(...spread.pages) - 1;
}

function pageIndexToSpreadIndex(index) {
  return Math.max(0, findSpreadIndexByPage(Math.max(0, Math.min(index, pages.length - 1)) + 1));
}

function syncCurrentIndexForModeChange() {
  const nextSinglePageMode = isSinglePageMode();

  if (nextSinglePageMode === previousSinglePageMode) {
    return;
  }

  currentIndex = nextSinglePageMode
    ? spreadIndexToPageIndex(currentIndex)
    : pageIndexToSpreadIndex(currentIndex);
  previousSinglePageMode = nextSinglePageMode;
}

function findSpreadIndexByPage(pageNumber) {
  return spreads.findIndex((spread) => spread.pages.includes(pageNumber));
}

function renderDesktopSpread(index) {
  const spread = spreads[index];

  spreadRoot.replaceChildren(
    createPageSlot("left", spread.left, spread.left ? `Comic page ${spread.pages[0]}` : ""),
    createPageSlot(
      "right",
      spread.right,
      spread.right ? `Comic page ${spread.pages[spread.pages.length - 1]}` : ""
    )
  );

  spreadLabel.textContent =
    spread.pages.length === 1
      ? `Page ${spread.pages[0]}`
      : `Pages ${spread.pages[0]}-${spread.pages[spread.pages.length - 1]}`;

  prevButton.disabled = index === 0;
  nextButton.disabled = index === spreads.length - 1;
}

function renderMobilePage(index) {
  spreadRoot.replaceChildren(
    createPageSlot("right mobile-single", pages[index], `Comic page ${index + 1}`)
  );

  spreadLabel.textContent = `Page ${index + 1}`;
  prevButton.disabled = index === 0;
  nextButton.disabled = index === pages.length - 1;
}

function render() {
  syncCurrentIndexForModeChange();

  if (isSinglePageMode()) {
    renderMobilePage(currentIndex);
  } else {
    renderDesktopSpread(currentIndex);
  }

  window.requestAnimationFrame(() => {
    setupFullscreenPan();
  });
}

function goTo(index) {
  if (isSinglePageMode()) {
    currentIndex = Math.max(0, Math.min(index, pages.length - 1));
  } else {
    currentIndex = Math.max(0, Math.min(index, spreads.length - 1));
  }

  render();
}

function goNext(direction = "forward") {
  if (isSinglePageMode()) {
    if (currentIndex < pages.length - 1) {
      currentEnterDirection = direction;
      goTo(currentIndex + 1);
    }
    return;
  }

  if (currentIndex < spreads.length - 1) {
    currentEnterDirection = direction;
    goTo(currentIndex + 1);
  }
}

function goPrevious(direction = "back") {
  if (currentIndex > 0) {
    currentEnterDirection = direction;
    goTo(currentIndex - 1);
  }
}

function goToStart() {
  currentEnterDirection = "down";
  goTo(0);
}

function goToEnd() {
  if (isSinglePageMode()) {
    currentEnterDirection = "up";
    goTo(pages.length - 1);
    return;
  }

  currentEnterDirection = "up";
  goTo(spreads.length - 1);
}

function isFullscreenActive() {
  return document.fullscreenElement === reader;
}

function syncFullscreenToggleButton() {
  const fullscreenActive = isFullscreenActive();
  const shouldShowButton = isMobilePortraitReader();

  fullscreenToggleButton.hidden = !shouldShowButton;
  fullscreenToggleButton.setAttribute(
    "aria-label",
    fullscreenActive ? "Exit fullscreen" : "Open fullscreen"
  );
  fullscreenToggleButton.setAttribute(
    "title",
    fullscreenActive ? "Exit fullscreen" : "Open fullscreen"
  );
}

function syncFullscreenState() {
  pageShell.classList.toggle("is-fullscreen", isFullscreenActive());
  syncFullscreenToggleButton();
  syncCurrentIndexForModeChange();
  if (isFullscreenActive()) {
    render();
    setupFullscreenPan();
  } else {
    resetPanState();
    stopAutoplay();
    render();
  }
}

async function toggleFullscreen() {
  try {
    if (isFullscreenActive()) {
      await document.exitFullscreen();
    } else {
      await reader.requestFullscreen({ navigationUI: "hide" });
    }
  } catch (_error) {
    pageShell.classList.toggle("is-fullscreen");
  }
}

function handleSingleTap(clientX) {
  const viewportThird = window.innerWidth / 3;

  if (clientX < viewportThird) {
    goPrevious("back");
    return;
  }

  if (clientX > window.innerWidth - viewportThird) {
    goNext("forward");
  }
}

function resetPanState() {
  if (currentPanImage) {
    currentPanImage.style.setProperty("--pan-x", "0px");
    currentPanImage.style.setProperty("--pan-y", "0px");
  }
  panOffsetX = 0;
  panMinX = 0;
  panOffsetY = 0;
  panMinY = 0;
  panStartOffsetX = 0;
  panStartOffsetY = 0;
  panPointerActive = false;
  panPointerId = null;
  autoplayDirection = -1;
  autoplayAxis = "x";
  currentPanImage = null;
}

function stopAutoplay() {
  if (autoplayFrameId) {
    cancelAnimationFrame(autoplayFrameId);
    autoplayFrameId = null;
  }

  if (autoplayResumeTimeoutId) {
    clearTimeout(autoplayResumeTimeoutId);
    autoplayResumeTimeoutId = null;
  }

  lastAutoplayTimestamp = 0;
}

function autoplayStep(timestamp) {
  const canAutoPanX = panMinX < 0;
  const canAutoPanY = panMinY < 0;

  if (!isFullscreenActive() || !currentPanImage || (!canAutoPanX && !canAutoPanY) || panPointerActive) {
    autoplayFrameId = null;
    return;
  }

  if (!lastAutoplayTimestamp) {
    lastAutoplayTimestamp = timestamp;
  }

  const deltaTime = timestamp - lastAutoplayTimestamp;
  lastAutoplayTimestamp = timestamp;
  const halfCycleMs = AUTOPLAY_CYCLE_MS / 2;
  const axisDistance = autoplayAxis === "y" ? Math.abs(panMinY) : Math.abs(panMinX);
  const pixelsPerMs = axisDistance / halfCycleMs;

  if (pixelsPerMs > 0) {
    if (autoplayAxis === "y") {
      applyPanOffset(panOffsetX, panOffsetY + autoplayDirection * pixelsPerMs * deltaTime);
    } else {
      applyPanOffset(panOffsetX + autoplayDirection * pixelsPerMs * deltaTime, panOffsetY);
    }
  }

  if (autoplayAxis === "y") {
    if (panOffsetY <= panMinY) {
      applyPanOffset(panOffsetX, panMinY);
      autoplayDirection = 1;
    } else if (panOffsetY >= 0) {
      applyPanOffset(panOffsetX, 0);
      autoplayDirection = -1;
    }
  } else if (panOffsetX <= panMinX) {
    applyPanOffset(panMinX, panOffsetY);
    autoplayDirection = 1;
  } else if (panOffsetX >= 0) {
    applyPanOffset(0, panOffsetY);
    autoplayDirection = -1;
  }

  autoplayFrameId = requestAnimationFrame(autoplayStep);
}

function scheduleAutoplay() {
  stopAutoplay();

  if (
    !isFullscreenActive() ||
    isPortraitMobileFullscreen() ||
    !currentPanImage ||
    (panMinX >= 0 && panMinY >= 0) ||
    panPointerActive
  ) {
    return;
  }

  autoplayResumeTimeoutId = window.setTimeout(() => {
    lastAutoplayTimestamp = 0;
    autoplayFrameId = requestAnimationFrame(autoplayStep);
  }, AUTOPLAY_RESUME_DELAY);
}

function registerManualPanIntent() {
  stopAutoplay();
}

function applyPanOffset(nextOffsetX, nextOffsetY = panOffsetY) {
  if (!currentPanImage) {
    return;
  }

  panOffsetX = Math.max(panMinX - PAN_OVERSCROLL_PX, Math.min(PAN_OVERSCROLL_PX, nextOffsetX));
  panOffsetY = Math.max(panMinY - PAN_OVERSCROLL_PX, Math.min(PAN_OVERSCROLL_PX, nextOffsetY));
  currentPanImage.style.setProperty("--pan-x", `${panOffsetX}px`);
  currentPanImage.style.setProperty("--pan-y", `${panOffsetY}px`);
}

function setupFullscreenPan(shouldScheduleAutoplay = true) {
  if (!isFullscreenActive()) {
    resetPanState();
    return;
  }

  const visibleImage =
    !isTouchFullscreenMode() && spreadRoot.querySelectorAll(".comic-page").length > 1
      ? spreadRoot
      : spreadRoot.querySelector(".comic-page");

  if (!visibleImage) {
    resetPanState();
    return;
  }

  currentPanImage = visibleImage;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const imageWidth = visibleImage.offsetWidth;
  const imageHeight = visibleImage.offsetHeight;
  const overflowX = Math.max(0, imageWidth - viewportWidth);
  const overflowY = Math.max(0, imageHeight - viewportHeight);

  panMinX = isPortraitMobileFullscreen() ? 0 : -overflowX;
  panMinY = isPortraitMobileFullscreen() ? 0 : -overflowY;
  autoplayAxis = isTouchFullscreenMode() && window.innerWidth > window.innerHeight && overflowY > 0 ? "y" : "x";
  applyPanOffset(
    overflowX > 0 && !isPortraitMobileFullscreen() ? panOffsetX : 0,
    overflowY > 0 && !isPortraitMobileFullscreen() ? panOffsetY : 0
  );

  if (shouldScheduleAutoplay) {
    scheduleAutoplay();
  }
}

function resetWheelTracking(unlockGesture = true) {
  wheelDeltaX = 0;
  wheelDeltaY = 0;
  if (unlockGesture) {
    wheelGestureLocked = false;
  }
  if (wheelResetTimeoutId) {
    clearTimeout(wheelResetTimeoutId);
    wheelResetTimeoutId = null;
  }
}

function handleWheelNavigation(event) {
  wheelDeltaX += event.deltaX;
  wheelDeltaY += event.deltaY;

  if (wheelResetTimeoutId) {
    clearTimeout(wheelResetTimeoutId);
  }

  wheelResetTimeoutId = window.setTimeout(() => {
    resetWheelTracking();
  }, 140);

  if (wheelGestureLocked) {
    event.preventDefault();
    return;
  }

  const horizontalDistance = Math.abs(wheelDeltaX);
  const verticalDistance = Math.abs(wheelDeltaY);
  const dominantDistance = Math.max(horizontalDistance, verticalDistance);
  const shouldHandleGesture =
    isFullscreenActive() ||
    (!isTouchLayout() && !isMobileView());

  if (isFullscreenActive() && currentPanImage && (panMinX < 0 || panMinY < 0) && dominantDistance < 48) {
    event.preventDefault();
    registerManualPanIntent();
    applyPanOffset(panOffsetX - event.deltaX, panOffsetY - event.deltaY);
    scheduleAutoplay();
    return;
  }

  if (shouldHandleGesture && verticalDistance > horizontalDistance && verticalDistance > 36) {
    event.preventDefault();
    wheelGestureLocked = true;
    registerManualPanIntent();
    if (wheelDeltaY > 0) {
      goPrevious("down");
    } else {
      goNext("up");
    }
    resetWheelTracking(false);
    return;
  }

  if (shouldHandleGesture && horizontalDistance > verticalDistance && horizontalDistance > 36) {
    event.preventDefault();
    wheelGestureLocked = true;
    registerManualPanIntent();
    if (wheelDeltaX > 0) {
      goNext("forward");
    } else {
      goPrevious("back");
    }
    resetWheelTracking(false);
  }
}

prevButton.addEventListener("click", () => {
  goPrevious("back");
});
nextButton.addEventListener("click", () => {
  goNext("forward");
});
tapLeft.addEventListener("click", () => {
  goPrevious("back");
});
tapRight.addEventListener("click", () => {
  goNext("forward");
});
spreadRoot.addEventListener("dblclick", () => {
  registerManualPanIntent();
  toggleFullscreen();
});
fullscreenToggleButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  registerManualPanIntent();
  toggleFullscreen();
});
reader.addEventListener("wheel", handleWheelNavigation, { passive: false });
reader.addEventListener("mousemove", () => {
  if (isFullscreenActive()) {
    registerManualPanIntent();
    scheduleAutoplay();
  }
});
reader.addEventListener("pointerdown", (event) => {
  if (!isFullscreenActive() || !currentPanImage || event.pointerType === "touch") {
    return;
  }

  panPointerActive = true;
  panPointerId = event.pointerId;
  panPointerStartX = event.clientX;
  panPointerStartY = event.clientY;
  panStartOffsetX = panOffsetX;
  panStartOffsetY = panOffsetY;
  registerManualPanIntent();
});
reader.addEventListener("pointermove", (event) => {
  if (
    !panPointerActive ||
    panPointerId !== event.pointerId ||
    !isFullscreenActive() ||
    !currentPanImage
  ) {
    return;
  }

  const deltaX = event.clientX - panPointerStartX;
  const deltaY = event.clientY - panPointerStartY;
  applyPanOffset(panStartOffsetX + deltaX, panStartOffsetY + deltaY);
});
reader.addEventListener("pointerup", (event) => {
  if (panPointerId !== event.pointerId) {
    return;
  }

  panPointerActive = false;
  panPointerId = null;
  scheduleAutoplay();
});
reader.addEventListener("pointercancel", () => {
  panPointerActive = false;
  panPointerId = null;
  scheduleAutoplay();
});

spreadRoot.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length !== 1) {
      touchTracking = false;
      return;
    }

    touchTracking = true;
    panPointerActive = true;
    touchMoved = false;
    touchStartTime = Date.now();
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    panStartOffsetX = panOffsetX;
    panStartOffsetY = panOffsetY;
    registerManualPanIntent();
  },
  { passive: true }
);

spreadRoot.addEventListener(
  "touchmove",
  (event) => {
    if (!touchTracking || event.touches.length !== 1) {
      return;
    }

    const deltaX = event.touches[0].clientX - touchStartX;
    const deltaY = event.touches[0].clientY - touchStartY;

    if (Math.abs(deltaX) > 12 || Math.abs(deltaY) > 12) {
      touchMoved = true;
    }

    if (
      isFullscreenActive() &&
      !isPortraitMobileFullscreen() &&
      isTouchLayout() &&
      currentPanImage &&
      (panMinX < 0 || panMinY < 0)
    ) {
      event.preventDefault();
      applyPanOffset(panStartOffsetX + deltaX, panStartOffsetY + deltaY);
    }
  },
  { passive: false }
);

spreadRoot.addEventListener(
  "touchend",
  (event) => {
    if (!touchTracking || event.changedTouches.length !== 1) {
      touchTracking = false;
      return;
    }

    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);
    const touchDuration = Date.now() - touchStartTime;
    const dominantDistance = Math.max(horizontalDistance, verticalDistance);
    const fastSwipe =
      touchDuration < FAST_SWIPE_DURATION_MS &&
      dominantDistance > FAST_SWIPE_DISTANCE_PX;

    touchTracking = false;
    panPointerActive = false;

    if (!touchMoved) {
      const currentTapTime = Date.now();

      if (currentTapTime - lastTapTime < 320) {
        if (singleTapTimeoutId) {
          clearTimeout(singleTapTimeoutId);
          singleTapTimeoutId = null;
        }
        lastTapTime = 0;
        if (!isMobilePortraitReader()) {
          toggleFullscreen();
        }
        return;
      }

      lastTapTime = currentTapTime;
      const tapTarget = event.changedTouches[0].clientX;
      singleTapTimeoutId = window.setTimeout(() => {
        handleSingleTap(tapTarget);
        singleTapTimeoutId = null;
      }, 320);
      return;
    }

    if (
      isFullscreenActive() &&
      !isPortraitMobileFullscreen() &&
      isTouchLayout() &&
      currentPanImage &&
      (panMinX < 0 || panMinY < 0) &&
      !fastSwipe
    ) {
      applyPanOffset(panStartOffsetX + deltaX, panStartOffsetY + deltaY);
      scheduleAutoplay();
      return;
    }

    if (horizontalDistance >= 48 && horizontalDistance > verticalDistance) {
      if (deltaX < 0) {
        goPrevious("back");
        return;
      }

      goNext("forward");
      return;
    }

    if (verticalDistance < 56 || verticalDistance <= horizontalDistance) {
      return;
    }

    if (isFullscreenActive() || (!isTouchLayout() && !isMobileView())) {
      if (deltaY < 0) {
        goNext("up");
        return;
      }

      goPrevious("down");
      return;
    }

    if (deltaY < 0) {
      goNext("up");
      return;
    }

    goPrevious("down");
  },
  { passive: true }
);

window.addEventListener("keydown", (event) => {
  if (event.defaultPrevented) {
    return;
  }

  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      goPrevious("back");
      break;
    case "ArrowRight":
      event.preventDefault();
      goNext("forward");
      break;
    case "ArrowUp":
      event.preventDefault();
      goPrevious("up");
      break;
    case "ArrowDown":
      event.preventDefault();
      goNext("down");
      break;
    case "Home":
      event.preventDefault();
      goToStart();
      break;
    case "End":
      event.preventDefault();
      goToEnd();
      break;
    case "f":
    case "F":
      event.preventDefault();
      toggleFullscreen();
      break;
    default:
      break;
  }
});

mobileMediaQuery.addEventListener("change", () => {
  syncCurrentIndexForModeChange();
  render();
});

window.addEventListener("resize", () => {
  syncFullscreenToggleButton();
  setupFullscreenPan();
  if (!isFullscreenActive()) {
    syncCurrentIndexForModeChange();
    render();
  }
});

document.addEventListener("fullscreenchange", syncFullscreenState);

syncFullscreenToggleButton();
syncFullscreenState();
render();
