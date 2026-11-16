/** Peel transition adapted from VerifAI (verifAI-clean/src/verifai/web/static/app.js). */
export function runPeelTransition(apply: () => void): void {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduced) {
    apply();
    return;
  }

  const styles = getComputedStyle(root);
  const back = styles.getPropertyValue('--ground-sunk').trim();
  const light = styles.getPropertyValue('--ground-raised').trim();
  const under = styles.getPropertyValue('--rule').trim();
  const edge = styles.getPropertyValue('--c-shade').trim();

  const width = window.innerWidth;
  const height = window.innerHeight;
  const travel = width + height;
  const curl = Math.max(70, Math.min(150, Math.min(width, height) * 0.18));

  const peel = document.createElement('div');
  peel.className = 'peel';
  peel.setAttribute('aria-hidden', 'true');

  const flap = document.createElement('div');
  flap.className = 'peel-flap';
  flap.style.setProperty('--flap-back', back || 'canvastext');
  flap.style.setProperty('--flap-light', light || 'canvastext');
  flap.style.setProperty('--flap-edge', edge ? `color-mix(in oklab, ${edge} 45%, transparent)` : 'transparent');
  flap.style.setProperty('--flap-under', under || 'canvastext');
  peel.appendChild(flap);

  const place = (distance: number) => {
    const side = distance * Math.SQRT2;
    const depth = Math.min(side / 2, curl);
    root.style.setProperty('--peel-d', `${distance}px`);
    flap.style.left = `${width - distance / 2 - side / 2}px`;
    flap.style.top = `${distance / 2}px`;
    flap.style.width = `${side}px`;
    flap.style.height = `${depth}px`;
    flap.style.clipPath = `polygon(0 0, 100% 0, calc(100% - ${depth}px) 100%, ${depth}px 100%)`;
  };

  root.classList.add('peeling');
  root.style.setProperty('--peel-d', '0px');

  const transition = document.startViewTransition(() => {
    apply();
    document.body.appendChild(peel);
    place(0);
  });

  const finish = () => transition.skipTransition();

  const cleanUp = () => {
    root.classList.remove('peeling');
    root.style.removeProperty('--peel-d');
    peel.remove();
  };

  transition.ready
    .then(() => {
      const start = performance.now();
      const duration = 1100;
      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
        place(eased * travel);
        if (t < 1) requestAnimationFrame(frame);
        else finish();
      };
      requestAnimationFrame(frame);
    })
    .catch(finish);

  transition.finished.then(cleanUp, cleanUp);
}
