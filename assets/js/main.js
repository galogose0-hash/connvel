(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var body = document.body;
  var header = document.querySelector(".site-header");
  var menuToggle = document.querySelector(".menu-toggle");
  var mobileMenu = document.getElementById("mobile-menu");
  var menuLabel = menuToggle ? menuToggle.querySelector(".menu-label") : null;
  var mainContent = document.querySelector("main");
  var footer = document.querySelector(".site-footer");
  var desktopQuery = window.matchMedia("(min-width: 1081px)");

  function setMenu(open, restoreFocus) {
    if (!menuToggle || !mobileMenu) return;

    body.classList.toggle("menu-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    mobileMenu.setAttribute("aria-hidden", String(!open));
    mobileMenu.inert = !open;

    if (mainContent) mainContent.inert = open;
    if (footer) footer.inert = open;
    if (menuLabel) menuLabel.textContent = open ? "Tutup" : "Menu";

    if (open) {
      window.requestAnimationFrame(function () {
        var firstLink = mobileMenu.querySelector("a");
        if (firstLink) firstLink.focus({ preventScroll: true });
      });
    } else if (restoreFocus) {
      menuToggle.focus({ preventScroll: true });
    }
  }

  if (menuToggle) {
    menuToggle.addEventListener("click", function () {
      setMenu(!body.classList.contains("menu-open"), true);
    });

    mobileMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setMenu(false, true);
      });
    });

    var headerBrand = document.querySelector(".header-inner .brand");
    if (headerBrand) {
      headerBrand.addEventListener("click", function () {
        if (body.classList.contains("menu-open")) setMenu(false, true);
      });
    }

    document.addEventListener("keydown", function (event) {
      if (!body.classList.contains("menu-open")) return;

      if (event.key === "Escape") {
        setMenu(false, true);
        return;
      }

      if (event.key !== "Tab") return;

      var menuLinks = Array.prototype.slice.call(mobileMenu.querySelectorAll("a, button"));
      var firstLink = menuLinks[0];
      var lastLink = menuLinks[menuLinks.length - 1];
      if (!firstLink || !lastLink) return;

      var active = document.activeElement;
      var inMenu = mobileMenu.contains(active);

      if (event.shiftKey && (active === menuToggle || (!inMenu && active !== menuToggle))) {
        event.preventDefault();
        lastLink.focus();
      } else if (!event.shiftKey && (active === lastLink || (!inMenu && active !== menuToggle))) {
        event.preventDefault();
        menuToggle.focus();
      }
    });

    var handleDesktopChange = function (event) {
      if (event.matches) setMenu(false, false);
    };

    if (desktopQuery.addEventListener) {
      desktopQuery.addEventListener("change", handleDesktopChange);
    } else if (desktopQuery.addListener) {
      desktopQuery.addListener(handleDesktopChange);
    }
  }

  function updateHeader() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 10);
  }

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  var revealItems = document.querySelectorAll("[data-reveal]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach(function (item) {
      item.classList.add("is-revealed");
    });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" }
    );

    revealItems.forEach(function (item) {
      revealObserver.observe(item);
    });
  }

  var track = document.querySelector("[data-carousel]");
  if (track) {
    var prevButton = document.querySelector("[data-carousel-prev]");
    var nextButton = document.querySelector("[data-carousel-next]");
    var progressFill = document.querySelector("[data-carousel-progress]");
    var animationFrame = null;
    var isPointerDown = false;
    var dragStartX = 0;
    var dragStartScroll = 0;
    var hasDragged = false;
    var suppressClick = false;

    var updateCarousel = function () {
      var maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      var ratio = maxScroll > 0 ? Math.min(1, Math.max(0, track.scrollLeft / maxScroll)) : 1;

      if (prevButton) prevButton.disabled = track.scrollLeft <= 2;
      if (nextButton) nextButton.disabled = track.scrollLeft >= maxScroll - 2;
      if (progressFill) progressFill.style.width = (8 + ratio * 92) + "%";
    };

    var scheduleCarouselUpdate = function () {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(function () {
        animationFrame = null;
        updateCarousel();
      });
    };

    var getStep = function () {
      var card = track.querySelector(".book-card");
      var styles = window.getComputedStyle(track);
      var gap = parseFloat(styles.columnGap || styles.gap) || 0;
      return (card ? card.getBoundingClientRect().width : 240) + gap;
    };

    var scrollCarousel = function (direction) {
      track.scrollBy({
        left: direction * getStep(),
        behavior: reduceMotion ? "auto" : "smooth"
      });
    };

    if (prevButton) prevButton.addEventListener("click", function () { scrollCarousel(-1); });
    if (nextButton) nextButton.addEventListener("click", function () { scrollCarousel(1); });

    track.addEventListener("scroll", scheduleCarouselUpdate, { passive: true });
    window.addEventListener("resize", scheduleCarouselUpdate);
    window.addEventListener("load", scheduleCarouselUpdate);

    if ("ResizeObserver" in window) {
      new ResizeObserver(scheduleCarouselUpdate).observe(track);
    }

    track.addEventListener("dragstart", function (event) {
      event.preventDefault();
    });

    track.addEventListener("pointerdown", function (event) {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      isPointerDown = true;
      hasDragged = false;
      dragStartX = event.clientX;
      dragStartScroll = track.scrollLeft;
    });

    track.addEventListener("pointermove", function (event) {
      if (!isPointerDown) return;
      var distance = event.clientX - dragStartX;

      if (Math.abs(distance) > 6 && !hasDragged) {
        hasDragged = true;
        track.classList.add("is-dragging");
      }

      if (hasDragged) {
        track.scrollLeft = dragStartScroll - distance;
      }
    });

    var endDrag = function () {
      if (!isPointerDown) return;
      isPointerDown = false;
      track.classList.remove("is-dragging");

      if (hasDragged) {
        suppressClick = true;
        window.setTimeout(function () {
          suppressClick = false;
        }, 120);
      }
    };

    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("mouseleave", endDrag);

    track.addEventListener(
      "click",
      function (event) {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
      },
      true
    );

    updateCarousel();
  }

  document.querySelectorAll(".book-save").forEach(function (button) {
    button.addEventListener("click", function () {
      var card = button.closest(".book-card");
      var titleNode = card ? card.querySelector(".book-title") : null;
      var title = titleNode ? titleNode.textContent.trim() : "cerita ini";
      var wasSaved = button.getAttribute("aria-pressed") === "true";

      button.setAttribute("aria-pressed", String(!wasSaved));
      button.classList.toggle("is-saved", !wasSaved);
      button.setAttribute(
        "aria-label",
        (wasSaved ? "Simpan " : "Hapus ") + title + (wasSaved ? " ke" : " dari") + " perpustakaanmu"
      );
    });
  });

  var newsletterForm = document.querySelector(".newsletter-form");
  if (newsletterForm) {
    var emailInput = newsletterForm.querySelector("input[type='email']");
    var statusMessage = document.getElementById("newsletter-status");
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    var clearError = function () {
      newsletterForm.classList.remove("is-invalid");
      if (emailInput) emailInput.removeAttribute("aria-invalid");
      if (statusMessage) {
        statusMessage.textContent = "";
        statusMessage.className = "form-status";
      }
    };

    newsletterForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = emailInput ? emailInput.value.trim() : "";

      if (!emailPattern.test(value)) {
        newsletterForm.classList.add("is-invalid");
        if (emailInput) {
          emailInput.setAttribute("aria-invalid", "true");
          emailInput.focus();
        }
        if (statusMessage) {
          statusMessage.textContent = "Mohon masukkan alamat email yang valid.";
          statusMessage.className = "form-status is-error";
        }
        return;
      }

      newsletterForm.classList.remove("is-invalid");
      if (emailInput) {
        emailInput.removeAttribute("aria-invalid");
        emailInput.value = "";
      }
      if (statusMessage) {
        statusMessage.textContent = "Kamu sudah terdaftar. Surat berikutnya sedang dalam perjalanan.";
        statusMessage.className = "form-status is-success";
      }
    });

    if (emailInput) {
      emailInput.addEventListener("input", function () {
        if (newsletterForm.classList.contains("is-invalid")) clearError();
      });
    }
  }
})();
