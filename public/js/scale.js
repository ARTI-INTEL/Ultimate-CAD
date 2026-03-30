// Scale the 1920x1080 design to fit the current viewport
function scaleToFit() {
  const wrapper = document.querySelector('.page-wrapper');
  if (!wrapper) return;
  const scaleX = window.innerWidth / 1920;
  const scaleY = window.innerHeight / 1080;
  const scale = Math.min(scaleX, scaleY);
  wrapper.style.transform = `scale(${scale})`;
  wrapper.style.left = `${(window.innerWidth - 1920 * scale) / 2}px`;
  wrapper.style.top = `${(window.innerHeight - 1080 * scale) / 2}px`;
  wrapper.style.position = 'absolute';
}

window.addEventListener('resize', scaleToFit);
window.addEventListener('DOMContentLoaded', scaleToFit);
