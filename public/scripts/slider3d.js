// 3D Carousel functionality
class Carousel3D {
    isMobile() {
        return window.innerWidth <= 768;
    }

    constructor() {
        this.w = null;
        this.container = null;
        this.carousel = null;
        this.item = null;
        this.radius = null;
        this.itemLength = null;
        this.rY = null;
        this.ticker = null;
        this.fps = null;
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseZ = 0;
        this.addX = 0;

        this.init();
    }

    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.w = $(window);
        this.container = $('#contentContainer');
        this.carousel = $('#carouselContainer');
        this.item = $('.carouselItem');
        this.itemLength = this.item.length;

        if (this.itemLength === 0) {
            console.warn('No carousel items found');
            return;
        }

        this.rY = 360 / this.itemLength;
        // Adjust radius based on screen size (smaller = cards closer)
        if (window.innerWidth <= 768) {
            this.radius = Math.round((90) / Math.tan(Math.PI / this.itemLength));
        } else {
            this.radius = Math.round((500) / Math.tan(Math.PI / this.itemLength)); // desktop normal
        }



        gsap.set(this.container, { perspective: 2000 });
        gsap.set(this.carousel, { z: -this.radius });
        this.mouseZ = -this.radius;

        // Loop to set item positions
        for (let i = 0; i < this.itemLength; i++) {
            const $item = this.item[i];
            const $block = $item.querySelector('.carouselItemInner');
            const scaleVal = window.innerWidth <= 768 ? 0.55 : 0.75;

            gsap.set($item, {
                rotationY: this.rY * i,
                z: this.radius,
                transformOrigin: `50% 50% -${this.radius}px`,
                scale: scaleVal
            });


            this.animateIn($item, $block);
        }

        // Set mouse events
        window.addEventListener("mousemove", this.onMouseMove.bind(this), false);

        // Touch events for mobile
        this.setupTouchEvents();

        // Start animation loop
        this.ticker = setInterval(this.looper.bind(this), 1000 / 60);

        // Initialize GSAP animations for ninja words
        this.initNinjaAnimations();
    }

    initNinjaAnimations() {
        gsap.from(".ninja-word", {
            scrollTrigger: {
                trigger: ".page3d",
                start: "top 80%",
                toggleActions: "play none none reverse"
            },
            opacity: 0,
            y: 80,
            scale: 0.9,
            stagger: 0.2,
            ease: "power4.out",
            duration: 1.5
        });
    }

    setupTouchEvents() {
        let touchStartX = 0;
        let touchMoveX = 0;

        window.addEventListener("touchstart", (e) => {
            touchStartX = e.touches[0].clientX;
        }, false);

        window.addEventListener("touchmove", (e) => {
            touchMoveX = e.touches[0].clientX;
            const deltaX = touchMoveX - touchStartX;
            this.mouseX = deltaX * 0.01;
        }, false);

        window.addEventListener("touchend", (e) => {
            touchMoveX = 0;
        }, false);
    }

    animateIn($item, $block) {
        gsap.set($item, { autoAlpha: 1 });
        gsap.fromTo($block,
            { autoAlpha: 0, scale: 1 },
            { autoAlpha: 1, scale: 1, duration: 0.6, ease: "power1.out" }
        );
    }

    onMouseMove(event) {
        if (this.isMobile()) return; // ✅ Ignore on phones

        // ✅ Check if mouse is inside .page3d container
        const parent = document.querySelector(".page3d");
        const rect = parent.getBoundingClientRect();

        const inside =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;

        if (!inside) {
            // ✅ Outside: STOP updating, but keep current zoom & rotation
            return;
        }

        // ✅ Inside: allow movement + zoom
        this.mouseX = -(-(window.innerWidth * .5) + event.pageX) * .0025;
        this.mouseY = -(-(window.innerHeight * .5) + event.pageY) * .01;
        // Limit how close it can zoom in
        let zoom = -(this.radius) - (Math.abs(-(window.innerHeight * .5) + event.pageY) - 200);
        this.mouseZ = Math.max(zoom, -this.radius); // ✅ never zoom closer than starting size

    }


    looper() {
        this.addX += this.mouseX;
        this.mouseX *= 0.95;

        gsap.to(this.carousel, 1, {
            rotationY: this.addX,
            ease: "power2.out"
        });

        // ✅ Don’t push Z forward/back on mobile tap
        if (!this.isMobile()) {
            // Smooth Z movement, no sudden snap on first frame
            gsap.to(this.carousel, { z: this.mouseZ, duration: 0.4, ease: "power2.out" });

        }
    }


    getRandomInt($n) {
        return Math.floor((Math.random() * $n) + 1);
    }

    destroy() {
        if (this.ticker) {
            clearInterval(this.ticker);
        }
        window.removeEventListener("mousemove", this.onMouseMove);
    }
}

// Initialize when document is ready
let carousel3D;

document.addEventListener('DOMContentLoaded', function () {
    // Wait a bit to ensure all elements are loaded
    setTimeout(() => {
        carousel3D = new Carousel3D();
    }, 1000);
});