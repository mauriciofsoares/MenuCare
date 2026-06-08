const sectionEls = document.querySelectorAll(".section, .hero");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
      }
    });
  },
  { threshold: 0.15 }
);

sectionEls.forEach((el) => {
  el.classList.add("fade-up");
  observer.observe(el);
});
