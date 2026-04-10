const totalPages = 9;
const pages = Array.from({ length: totalPages }, (_, index) => {
  const pageNumber = String(index + 1).padStart(4, "0");
  return `comics/Cinderella-2026-${pageNumber}.png`;
});

const spreads = buildSpreads(pages);
const mobileMediaQuery = window.matchMedia("(max-width: 640px)");

const pageShell = document.querySelector(".page-shell");
const reader = document.querySelector(".reader");
const spreadRoot = document.getElementById("spread");
const spreadLabel = document.getElementById("spread-label");
const prevButton = document.getElementById("prev-button");
const nextButton = document.getElementById("next-button");
const tapLeft = document.getElementById("tap-left");
const tapRight = document.getElementById("tap-right");

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

function findSpreadIndexByPage(pageNumber) {
  return spreads.findIndex((spread) => spread.pages.includes(pageNumber));
}

function getDesktopIndexFromCurrentIndex(index = currentIndex) {
  if (!isMobileView()) {
    return Math.max(0, Math.min(index, spreads.length - 1));
  }

  return Math.max(0, findSpreadIndexByPage(index + 1));
}

function getMobileIndexFromCurrentIndex(index = currentIndex) {
  if (isMobileView()) {
    return Math.max(0, Math.min(index, pages.length - 1));
  }

  const spread = spreads[Math.max(0, Math.min(index, spreads.length - 1))];
  return Math.max(...spread.pages) - 1;
}

function convertIndexForModeChange(nextIsMobile) {
  if (nextIsMobile) {
    const spread = spreads[Math.max(0, Math.min(currentIndex, spreads.length - 1))];
    return Math.max(...spread.pages) - 1;
  }

  return Math.max(0, findSpreadIndexByPage(currentIndex + 1));
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
  if (isMobileView()) {
    renderMobilePage(getMobileIndexFromCurrentIndex());
    return;
  }

  renderDesktopSpread(getDesktopIndexFromCurrentIndex());
}

function goTo(index) {
  if (isMobileView()) {
    currentIndex = Math.max(0, Math.min(index, pages.length - 1));
  } else {
    currentIndex = Math.max(0, Math.min(index, spreads.length - 1));
  }

  render();
}

function goNext(direction = "forward") {
  if (isMobileView()) {
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
  if (isMobileView()) {
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

function syncFullscreenState() {
  pageShell.classList.toggle("is-fullscreen", isFullscreenActive());
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

function resetWheelTracking() {
  wheelDeltaX = 0;
  wheelDeltaY = 0;
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

  const horizontalDistance = Math.abs(wheelDeltaX);
  const verticalDistance = Math.abs(wheelDeltaY);

  if (isFullscreenActive() && verticalDistance > horizontalDistance && verticalDistance > 36) {
    event.preventDefault();
    if (wheelDeltaY > 0) {
      goNext("up");
    } else {
      goPrevious("down");
    }
    resetWheelTracking();
    return;
  }

  if (horizontalDistance > verticalDistance && horizontalDistance > 36) {
    event.preventDefault();
    if (wheelDeltaX > 0) {
      goNext("forward");
    } else {
      goPrevious("back");
    }
    resetWheelTracking();
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
  toggleFullscreen();
});
reader.addEventListener("wheel", handleWheelNavigation, { passive: false });

spreadRoot.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length !== 1) {
      touchTracking = false;
      return;
    }

    touchTracking = true;
    touchMoved = false;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
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
  },
  { passive: true }
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

    touchTracking = false;

    if (!touchMoved) {
      const currentTapTime = Date.now();

      if (currentTapTime - lastTapTime < 320) {
        if (singleTapTimeoutId) {
          clearTimeout(singleTapTimeoutId);
          singleTapTimeoutId = null;
        }
        lastTapTime = 0;
        toggleFullscreen();
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

    if (horizontalDistance >= 48 && horizontalDistance > verticalDistance) {
      if (deltaX < 0) {
        goNext("forward");
        return;
      }

      goPrevious("back");
      return;
    }

    if (verticalDistance < 56 || verticalDistance <= horizontalDistance) {
      return;
    }

    if (isFullscreenActive()) {
      if (deltaY < 0) {
        goNext("up");
        return;
      }

      goPrevious("down");
      return;
    }

    if (deltaY < 0) {
      goToStart();
      return;
    }

    goToEnd();
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
      if (isFullscreenActive()) {
        goPrevious("down");
      } else {
        goToStart();
      }
      break;
    case "ArrowDown":
      event.preventDefault();
      if (isFullscreenActive()) {
        goNext("up");
      } else {
        goToEnd();
      }
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

mobileMediaQuery.addEventListener("change", (event) => {
  currentIndex = convertIndexForModeChange(event.matches);
  render();
});

document.addEventListener("fullscreenchange", syncFullscreenState);

syncFullscreenState();
render();
