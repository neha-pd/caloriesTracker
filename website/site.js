// Content remains visible without JavaScript. Motion only adds narrative emphasis.
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12 });
  document.querySelectorAll('.story-heading, .app-shot, .build-main, .journey-track, .contribute h2').forEach((element) => {
    element.classList.add('reveal');
    observer.observe(element);
  });
}
