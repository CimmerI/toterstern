const pages = [
  "comics/Cinderella-2026-0001.png",
  "comics/Cinderella-2026-0002.png",
  "comics/Cinderella-2026-0003.png",
  "comics/Cinderella-2026-0004.png",
];

const spreads = buildSpreads(pages);

const spreadRoot = document.getElementById("spread");
const spreadLabel = document.getElementById("spread-label");
const prevButton = document.getElementById("prev-button");
const nextButton = document.getElementById("next-button");
const tapLeft = document.getElementById("tap-left");
const tapRight = document.getElementById("tap-right");

let currentSpreadIndex = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchTracking = false;
let touchMoved = false;

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

function renderSpread(index) {
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

function goToSpread(index) {
  currentSpreadIndex = Math.max(0, Math.min(index, spreads.length - 1));
  renderSpread(currentSpreadIndex);
}

function goNext() {
  if (currentSpreadIndex < spreads.length - 1) {
    goToSpread(currentSpreadIndex + 1);
  }
}

function goPrevious() {
  if (currentSpreadIndex > 0) {
    goToSpread(currentSpreadIndex - 1);
  }
}

prevButton.addEventListener("click", goPrevious);
nextButton.addEventListener("click", goNext);
tapLeft.addEventListener("click", goPrevious);
tapRight.addEventListener("click", goNext);

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
      const tapTarget = event.changedTouches[0].clientX;
      const viewportThird = window.innerWidth / 3;

      if (tapTarget < viewportThird) {
        goPrevious();
        return;
      }

      if (tapTarget > window.innerWidth - viewportThird) {
        goNext();
      }

      return;
    }

    if (horizontalDistance >= 48 && horizontalDistance > verticalDistance) {
      if (deltaX < 0) {
        goNext();
        return;
      }

      goPrevious();
      return;
    }

    if (verticalDistance < 56 || verticalDistance <= horizontalDistance) {
      return;
    }

    if (deltaY < 0) {
      goToSpread(0);
      return;
    }

    goToSpread(spreads.length - 1);
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
      goPrevious();
      break;
    case "ArrowRight":
      event.preventDefault();
      goNext();
      break;
    case "ArrowUp":
    case "Home":
      event.preventDefault();
      goToSpread(0);
      break;
    case "ArrowDown":
    case "End":
      event.preventDefault();
      goToSpread(spreads.length - 1);
      break;
    default:
      break;
  }
});

renderSpread(currentSpreadIndex);
