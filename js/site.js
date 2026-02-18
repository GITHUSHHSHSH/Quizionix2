const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });
}

const quixHeroAnimation = document.getElementById("quixHeroAnimation");
const quixCard = document.querySelector(".cat-card");

if (quixHeroAnimation) {
  const idleSources = [
    quixHeroAnimation.dataset.idleA,
    quixHeroAnimation.dataset.idleB
  ].filter(Boolean);
  const waveSource = quixHeroAnimation.dataset.wave;

  const setSource = (src, loop = true) => {
    if (!src) return;
    if (quixHeroAnimation.getAttribute("src") === src) return;
    quixHeroAnimation.setAttribute("src", src);
    quixHeroAnimation.loop = loop;
    quixHeroAnimation.currentTime = 0;
    quixHeroAnimation.play().catch(() => {});
  };

  const setIdle = () => {
    if (!idleSources.length) return;
    const pick = idleSources[Math.floor(Math.random() * idleSources.length)];
    setSource(pick, true);
  };

  const playWave = () => {
    if (!waveSource) return;
    setSource(waveSource, false);
  };

  quixHeroAnimation.addEventListener("ended", () => {
    if (quixHeroAnimation.getAttribute("src") === waveSource) {
      setIdle();
    }
  });

  quixCard?.addEventListener("mouseenter", playWave);
  quixCard?.addEventListener("focus", playWave);
  quixCard?.addEventListener("click", playWave);
  quixCard?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      playWave();
    }
  });
  setIdle();
}
