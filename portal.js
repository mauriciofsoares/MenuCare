const root = document.body;
const appShell = document.querySelector(".app-shell");
const sidebar = document.getElementById("sidebar");
const collapseSidebar = document.getElementById("collapseSidebar");
const themeToggle = document.getElementById("themeToggle");
const supportDrawer = document.getElementById("supportDrawer");
const supportFloating = document.getElementById("supportFloating");
const closeSupportDrawer = document.getElementById("closeSupportDrawer");
const accountMenuBtn = document.getElementById("accountMenuBtn");
const accountMenuAvatar = document.getElementById("accountMenuAvatar");
const accountMenu = document.getElementById("accountMenu");
const logoutBtn = document.getElementById("logoutBtn");
const THEME_KEY = "menucare-theme";

const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme === "light") {
  root.setAttribute("data-theme", "light");
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  });
}

if (collapseSidebar) {
  collapseSidebar.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 1200px)").matches) {
      sidebar.classList.toggle("open");
      return;
    }

    if (appShell) {
      appShell.classList.toggle("sidebar-collapsed");
    }
  });
}

function openSupport() {
  if (!supportDrawer) {
    return;
  }

  supportDrawer.classList.add("open");
  supportDrawer.setAttribute("aria-hidden", "false");
}

function closeSupport() {
  if (!supportDrawer) {
    return;
  }

  supportDrawer.classList.remove("open");
  supportDrawer.setAttribute("aria-hidden", "true");
}

if (supportFloating) {
  supportFloating.addEventListener("click", openSupport);
}

if (closeSupportDrawer) {
  closeSupportDrawer.addEventListener("click", closeSupport);
}

if (accountMenu) {
  const toggleAccountMenu = () => {
    const isOpen = accountMenu.classList.toggle("open");
    accountMenu.setAttribute("aria-hidden", isOpen ? "false" : "true");
  };

  if (accountMenuBtn) {
    accountMenuBtn.addEventListener("click", toggleAccountMenu);
  }

  if (accountMenuAvatar) {
    accountMenuAvatar.addEventListener("click", toggleAccountMenu);
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    const clickedMenuBtn = accountMenuBtn ? accountMenuBtn.contains(target) : false;
    const clickedAvatarBtn = accountMenuAvatar ? accountMenuAvatar.contains(target) : false;

    if (!accountMenu.contains(target) && !clickedMenuBtn && !clickedAvatarBtn) {
      accountMenu.classList.remove("open");
      accountMenu.setAttribute("aria-hidden", "true");
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    const shouldLogout = window.confirm("Deseja encerrar sua sessao no MenuCare?");
    if (shouldLogout) {
      window.location.href = "index.html";
    }
  });
}
