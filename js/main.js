/* 4BitLabs: site scripts
   1. Mobile navigation   2. Header shadow on scroll   3. Reveal on scroll
   4. Filters (kits, gallery)   5. Gallery lightbox
   6. WhatsApp kit enquiry   7. Contact form   8. Footer year */

const WHATSAPP_NUMBER = "919373682630";

/* ---------- 1. Mobile navigation ---------- */
function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    nav.classList.toggle("is-open", open);
  };

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  // close on Escape and when a link is chosen
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });

  // reset when resizing back to desktop
  window.matchMedia("(min-width: 821px)").addEventListener("change", (e) => {
    if (e.matches) setOpen(false);
  });
}

/* ---------- 2. Header border once the page scrolls ---------- */
function initHeader() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const update = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

/* ---------- 3. Reveal sections as they enter the screen ---------- */
function initReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px" }
  );
  items.forEach((el) => observer.observe(el));
}

/* ---------- 4. Category filters ---------- */
function initFilters() {
  document.querySelectorAll("[data-filter-group]").forEach((group) => {
    const name = group.dataset.filterGroup;
    const list = document.querySelector(`[data-filter-items="${name}"]`);
    if (!list) return;
    const items = list.querySelectorAll("[data-category]");
    const empty = list.parentElement.querySelector(".filter-empty");

    group.addEventListener("click", (e) => {
      const button = e.target.closest("[data-filter]");
      if (!button) return;
      const filter = button.dataset.filter;

      group.querySelectorAll("[data-filter]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === button));
      });

      let shown = 0;
      items.forEach((item) => {
        const match = filter === "all" || item.dataset.category === filter;
        item.hidden = !match;
        if (match) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    });
  });
}

/* ---------- 5. Gallery lightbox ---------- */
function initLightbox() {
  const dialog = document.querySelector(".lightbox");
  if (!dialog || typeof dialog.showModal !== "function") return;
  const media = dialog.querySelector("[data-lightbox-media]");
  const caption = dialog.querySelector("[data-lightbox-caption]");

  document.querySelectorAll(".gallery-item button").forEach((button) => {
    button.addEventListener("click", () => {
      const img = button.querySelector("img");
      media.innerHTML = "";
      if (img) {
        const big = img.cloneNode();
        big.src = img.dataset.full || img.src;
        big.removeAttribute("loading");
        media.append(big);
      }
      caption.textContent = button.dataset.caption || "";
      dialog.showModal();
    });
  });

  dialog.querySelector("[data-lightbox-close]").addEventListener("click", () => dialog.close());
  // click on the dark backdrop closes it
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
}

/* ---------- 6. WhatsApp links with the kit name filled in ---------- */
function initKitEnquiry() {
  document.querySelectorAll("[data-kit]").forEach((link) => {
    const text = `Hi 4BitLabs, I'd like to know the price and availability of the ${link.dataset.kit}.`;
    link.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  });
}

/* ---------- 7. Contact form: validation + sending ---------- */
const validators = {
  name: (v) => (v.trim().length >= 2 ? "" : "Please enter your name."),
  phone: (v) => {
    const digits = v.replace(/[\s\-()+]/g, "");
    return /^(91)?[6-9]\d{9}$/.test(digits) ? "" : "Enter a valid 10-digit mobile number.";
  },
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Enter a valid email address."),
  message: (v) => (v.trim().length >= 10 ? "" : "Tell us a little more (at least 10 characters)."),
};

function showError(input, message) {
  const field = input.closest(".field");
  const error = document.getElementById(`${input.id}-error`);
  field.classList.toggle("has-error", Boolean(message));
  input.setAttribute("aria-invalid", message ? "true" : "false");
  if (error) {
    error.textContent = message;
    input.setAttribute("aria-describedby", error.id);
  }
}

function validateField(input) {
  const check = validators[input.name];
  if (!check) return true;
  const message = check(input.value);
  showError(input, message);
  return !message;
}

function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  const status = form.querySelector(".form-status");
  const submit = form.querySelector('[type="submit"]');

  // prefill from links like contact.html?workshop=IoT%20Projects
  const topic = new URLSearchParams(location.search).get("workshop");
  if (topic) {
    form.message.value = `Hi, I'd like to know more about: ${topic}.\n\n`;
    if (/kit/i.test(topic)) form.topic.value = "Robotics kits";
    else if (/event|hackathon/i.test(topic)) form.topic.value = "Hosting an event";
  }

  // validate a field when the user leaves it, then live once it has an error
  form.querySelectorAll("input, textarea").forEach((input) => {
    input.addEventListener("blur", () => input.value && validateField(input));
    input.addEventListener("input", () => {
      if (input.closest(".field")?.classList.contains("has-error")) validateField(input);
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputs = [...form.querySelectorAll("input[name], textarea[name]")].filter((i) => validators[i.name]);
    const invalid = inputs.filter((i) => !validateField(i));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "Sending…";
    status.className = "form-status";
    status.textContent = "";

    try {
      const res = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      form.reset();
      status.classList.add("is-success");
      status.textContent = "Thanks! Your message has been sent. We'll get back to you within one working day.";
    } catch (err) {
      status.classList.add("is-error");
      status.innerHTML = 'Sorry, the message could not be sent. Please call us or <a href="https://wa.me/' + WHATSAPP_NUMBER + '">message us on WhatsApp</a>.';
    } finally {
      submit.disabled = false;
      submit.textContent = "Send message";
    }
  });
}

/* ---------- 8. Footer year ---------- */
function initYear() {
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

initNav();
initHeader();
initReveal();
initFilters();
initLightbox();
initKitEnquiry();
initContactForm();
initYear();
