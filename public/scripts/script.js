document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("loader");
  const homepageContent = document.getElementById("homepage-content");

  const lastVisit = localStorage.getItem("lastVisit");
  const currentTime = new Date().getTime();

  // If there's a last visit timestamp, check if an hour has passed
  if (lastVisit && currentTime - lastVisit < 3600000) { // 1 hour = 3600000ms
    // If the page was visited within the last hour, skip the loader
    loader.classList.add("hidden");
    homepageContent.style.display = "block";
    initializeAnimations();
    initialize3DCards();
  } else {
    // If it's the first visit or an hour has passed, show the loader
    localStorage.setItem("lastVisit", currentTime); // Update the visit timestamp

    let mm = gsap.matchMedia();

    mm.add("(min-width: 768px)", () => {
      gsap.to(".moon", { scale: 3, opacity: 1, duration: 2, ease: "power2.inOut" });
      gsap.to(".sword-left", { x: 850, rotate: 180, duration: 2, scaleX: -1, ease: "power2.inOut" });
      gsap.to(".sword-right", {
        x: -850, rotate: -180, duration: 2, ease: "power2.inOut", onComplete: () => {
          loader.classList.add("hidden");
          homepageContent.style.display = "block";
          initializeAnimations();
          initialize3DCards();

        }
      });
    });

    mm.add("(max-width: 767px)", () => {
      gsap.to(".moon", { scale: 1.3, opacity: 1, duration: 2, ease: "power2.inOut" });
      gsap.to(".sword-left", { x: 250, rotate: 180, duration: 2, scaleX: -1, ease: "power2.inOut" });
      gsap.to(".sword-right", {
        x: -250, rotate: -180, duration: 2, ease: "power2.inOut", onComplete: () => {
          loader.classList.add("hidden");
          homepageContent.style.display = "block";
          initializeAnimations();
          initialize3DCards();

        }
      });
    });
  }

  // Handle audio unmute after user interaction
  const audio = document.getElementById("background-sound");
  document.addEventListener("click", () => {
    audio.muted = false;
  });
});

// Your custom animation function
function initializeAnimations() {
  // Add any animations you want to run after the loader
  console.log("Animations initialized!");
}
function initialize3DCards() {
  console.log("working")
  document.querySelectorAll('.categorical-card-wrap').forEach(cardWrap => {
    const card = cardWrap.querySelector('.categorical-card');
    const cardBg = card.querySelector('.categorical-card-bg');
    const img = cardWrap.getAttribute('data-image');
    cardBg.style.backgroundImage = `url(${img})`;

    let width = cardWrap.offsetWidth;
    let height = cardWrap.offsetHeight;

    cardWrap.addEventListener('mousemove', e => {
      const x = e.offsetX;
      const y = e.offsetY;
      const rotateY = ((x / width) - 0.5) * 30;
      const rotateX = ((y / height) - 0.5) * -20;
      card.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
      cardBg.style.transform = `translateX(${(x / width) * -40}px) translateY(${(y / height) * -40}px)`;
    });

    cardWrap.addEventListener('mouseleave', () => {
      card.style.transform = `rotateY(0deg) rotateX(0deg)`;
      cardBg.style.transform = `translateX(0px) translateY(0px)`;
    });
  });
}

const AsHamburger = document.querySelector('.As-hamburger');
const AsNavLinks = document.querySelector('.As-nav-links');

AsHamburger.addEventListener('click', () => {
  AsNavLinks.classList.toggle('active');
});
// Function to initialize other animations
function initializeAnimations() {
  // GSAP code for T-shirt animation
  let mm = gsap.matchMedia();

  mm.add("(min-width: 1024px)", () => {
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: "#page2",
        start: "0% 95%",
        end: "50% 50%",
        scrub: true,
      },
    });

    tl.to("#move_image", {
      top: "145%",
      left: "28%",
      width: "19rem",
      duration: 1,
    });
  });

  mm.add("(max-width: 1024px) and (min-width: 768px)", () => {
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: "#page2",
        start: "0% 40%",
        end: "10% 40%",
        scrub: true,
      },
    });

    tl.to("#move_image", {
      top: "76%",
      left: "55%",
      height: "18rem",
      duration: 1,
    });
  });

  mm.add("(max-width: 600px)", () => {
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: "#page2",
        start: "0% 5%",
        end: "40% 40%",
        scrub: true,
      },
    });

    tl.to("#move_image", {
      top: "105%",
      left: "18%",
      height: "14rem",
      duration: 1,
    });
  });

  const containers = document.querySelectorAll('.categorical-scroll-container, .categorical-scroll-container2');

  // Helper function — sync scroll position
  function syncScroll(source) {
    containers.forEach(target => {
      if (target !== source) {
        target.scrollLeft = source.scrollLeft;
      }
    });
  }

  containers.forEach(container => {
    // --- Mouse wheel horizontal scroll ---
    container.addEventListener('wheel', e => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return; // ignore horizontal wheels

      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      const atStart = container.scrollLeft <= 0;
      const atEnd = container.scrollLeft >= maxScrollLeft;

      // ✅ If not at start or end, scroll horizontally
      if (!(atStart && e.deltaY < 0) && !(atEnd && e.deltaY > 0)) {
        e.preventDefault();
        container.scrollBy({
          left: e.deltaY * 1.5,
          behavior: 'smooth'
        });
        syncScroll(container);
      }
      // ✅ If at end — allow page scroll naturally
      else {
        // Scroll the page when end of horizontal scroll is reached
        window.scrollBy({
          top: e.deltaY * 1.5,
          behavior: 'smooth'
        });
      }
    }, { passive: false });

    // --- Touch/Swipe (mobile) ---
    let startX = 0;
    let scrollLeft = 0;

    container.addEventListener('touchstart', e => {
      startX = e.touches[0].pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    });

    container.addEventListener('touchmove', e => {
      const x = e.touches[0].pageX - container.offsetLeft;
      const walk = (startX - x) * 1.5;
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      const newScroll = scrollLeft + walk;

      // ✅ Allow vertical page scroll when horizontal end is reached
      if (newScroll <= 0 || newScroll >= maxScrollLeft) {
        window.scrollBy({
          top: (startX - x) * 0.5,
          behavior: 'smooth'
        });
        return;
      }

      container.scrollLeft = newScroll;
      syncScroll(container);
    });
  });



  // Script for notification text
  gsap.to(".notification-text", {
    x: "-100%",
    duration: 15,
    repeat: -1,
    ease: "linear",
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const featuredContainer = document.querySelector('.featured-scroll-container');
  let isScrolling = false;
  let scrollTimer;
  let isDown = false;
  let startX, startY;
  let scrollLeft, scrollTop;
  let verticalDragActive = false; // Detect vertical-based scroll
  const verticalThreshold = 30; // Min vertical distance to trigger horizontal
  const horizontalScrollSpeed = 2;

  function disableHoverEffects() {
    featuredContainer.classList.add('scrolling');
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      featuredContainer.classList.remove('scrolling');
    }, 150);
  }

  // --- Mouse Wheel (Desktop Horizontal Scroll) ---
  featuredContainer.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      disableHoverEffects();
      featuredContainer.scrollLeft += e.deltaY * 5;

      // At end → allow page scroll down
      if (featuredContainer.scrollLeft + featuredContainer.clientWidth >= featuredContainer.scrollWidth - 1) {
        window.scrollBy(0, e.deltaY);
      }
      // At start → allow page scroll up
      if (featuredContainer.scrollLeft <= 0 && e.deltaY < 0) {
        window.scrollBy(0, e.deltaY);
      }
    }
  }, { passive: false });

  // --- Mouse Drag (Desktop) ---
  featuredContainer.addEventListener('mousedown', (e) => {
    isDown = true;
    featuredContainer.classList.add('scrolling');
    startX = e.pageX - featuredContainer.offsetLeft;
    scrollLeft = featuredContainer.scrollLeft;
  });

  featuredContainer.addEventListener('mouseleave', () => {
    isDown = false;
    featuredContainer.classList.remove('scrolling');
  });

  featuredContainer.addEventListener('mouseup', () => {
    isDown = false;
    featuredContainer.classList.remove('scrolling');
  });

  featuredContainer.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - featuredContainer.offsetLeft;
    const walk = (x - startX) * 2;
    featuredContainer.scrollLeft = scrollLeft - walk;
  });

  // --- Touch (Mobile & Touchscreen) ---
  featuredContainer.addEventListener('touchstart', (e) => {
    isDown = true;
    verticalDragActive = false;
    featuredContainer.classList.add('scrolling');
    startX = e.touches[0].pageX - featuredContainer.offsetLeft;
    startY = e.touches[0].pageY;
    scrollLeft = featuredContainer.scrollLeft;
    scrollTop = window.scrollY;
  });

  featuredContainer.addEventListener('touchmove', (e) => {
    if (!isDown) return;

    const x = e.touches[0].pageX - featuredContainer.offsetLeft;
    const y = e.touches[0].pageY;
    const xDiff = Math.abs(x - startX);
    const yDiff = Math.abs(y - startY);

    // Detect vertical-based movement (up/down)
    if (!verticalDragActive && yDiff > verticalThreshold) {
      verticalDragActive = true;
    }

    if (verticalDragActive) {
      e.preventDefault();
      disableHoverEffects();
      const walk = (y - startY) * horizontalScrollSpeed;
      featuredContainer.scrollLeft = scrollLeft - walk;

      // --- Down → Up (scroll right) ---
      if (y < startY) {
        if (featuredContainer.scrollLeft + featuredContainer.clientWidth >= featuredContainer.scrollWidth - 1) {
          window.scrollTo({
            top: scrollTop + yDiff,
            behavior: 'smooth'
          });
        }
      }

      // --- Up → Down (scroll left) ---
      if (y > startY) {
        if (featuredContainer.scrollLeft <= 0) {
          window.scrollTo({
            top: scrollTop - yDiff,
            behavior: 'smooth'
          });
        }
      }
    } else if (xDiff > yDiff) {
      // Normal horizontal swipe
      e.preventDefault();
      disableHoverEffects();
      const walk = (x - startX) * horizontalScrollSpeed;
      featuredContainer.scrollLeft = scrollLeft - walk;
    }
  });

  featuredContainer.addEventListener('touchend', () => {
    isDown = false;
    verticalDragActive = false;
    featuredContainer.classList.remove('scrolling');
  });

  // --- Card Click Behavior ---
  document.querySelectorAll('.featured-card-wrap').forEach(card => {
    card.addEventListener('click', function (e) {
      if (e.target.classList.contains('featured-buy') || featuredContainer.classList.contains('scrolling')) {
        return;
      }
      const url = this.getAttribute('data-url');
      if (url) {
        window.location.href = url;
      }
    });
  });

  // --- Disable Hover Effects During Scroll ---
  featuredContainer.addEventListener('scroll', () => {
    disableHoverEffects();
  });
});



const swiper = new Swiper('.mySwiper', {
  effect: "coverflow",
  grabCursor: true,
  centeredSlides: true,
  slidesPerView: "auto", // Important for different sizes
  loop: true,
  autoplay: {
    delay: 4000,
    disableOnInteraction: false,
  },
  coverflowEffect: {
    rotate: 0,
    stretch: 0,
    depth: 100,
    modifier: 2.5,
    slideShadows: false,
  },
  pagination: {
    el: ".swiper-pagination",
    clickable: true,
  },
});


