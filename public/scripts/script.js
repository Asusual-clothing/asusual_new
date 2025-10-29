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
  });const containers = document.querySelectorAll('.categorical-scroll-container, .categorical-scroll-container2');

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

  // Script for horizontal scrolling
  // --- Improved GSAP horizontal scroll with smooth touch/swipe ---
  gsap.registerPlugin(ScrollTrigger);

  const scroller = document.querySelector(".scroller");
  const page4 = document.querySelector(".page4");

  // GSAP horizontal scroll (desktop)
  gsap.to(scroller, {
    x: () => -(scroller.scrollWidth - document.documentElement.clientWidth) + "px",
    ease: "none",
    scrollTrigger: {
      trigger: page4,
      start: "top top",
      end: () => "+=" + (scroller.scrollWidth - document.documentElement.clientWidth),
      scrub: 1,
      pin: true,
      invalidateOnRefresh: true,
    },
  });

  // --- Touch / swipe support for mobile ---
  let startX = 0;
  let scrollX = 0;
  let currentX = 0;
  let isTouching = false;
  let velocity = 0;
  let momentumID = null;

  function updateTransform(x) {
    gsap.to(scroller, { x: -x, duration: 0.3, ease: "power3.out" });
  }

  page4.addEventListener("touchstart", e => {
    isTouching = true;
    startX = e.touches[0].pageX;
    scrollX = -gsap.getProperty(scroller, "x");
    velocity = 0;
    cancelAnimationFrame(momentumID);
  });

  page4.addEventListener("touchmove", e => {
    if (!isTouching) return;
    const x = e.touches[0].pageX;
    const walk = (startX - x) * 1.3;
    const newPos = Math.min(
      Math.max(0, scrollX + walk),
      scroller.scrollWidth - window.innerWidth
    );
    updateTransform(newPos);
    velocity = newPos - currentX;
    currentX = newPos;
  });

  page4.addEventListener("touchend", () => {
    isTouching = false;
    function momentum() {
      currentX += velocity;
      velocity *= 0.93; // friction
      const bounded = Math.min(
        Math.max(0, currentX),
        scroller.scrollWidth - window.innerWidth
      );
      updateTransform(bounded);
      if (Math.abs(velocity) > 0.5) {
        momentumID = requestAnimationFrame(momentum);
      }
    }
    momentum();
  });


  // Script for notification text
  gsap.to(".notification-text", {
    x: "-100%",
    duration: 15,
    repeat: -1,
    ease: "linear",
  });
}






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


