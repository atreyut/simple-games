// --- Lógica Compartida de Tema e Idioma ---

// ==================================================================================
// MANEJO DE IDIOMA (i18next)
// ==================================================================================

i18next.init({
  fallbackLng: 'en',
});

async function loadLanguage(lang) {
  const response = await fetch(`../locales/${lang}.json`);
  const data = await response.json();
  i18next.addResourceBundle(lang, 'translation', data.translation);
}

function updateContent() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    let options = {};

    // 1. LÓGICA DEL PIE DE PÁGINA RESTAURADA
    //    Para la clave del footer, permitimos que se inserte HTML.
    if (key === 'sudoku.footerHelp') {
      options.interpolation = { escape: false };
    }

    element.innerHTML = i18next.t(key, options);
  });

  const pageTitleKey = document.querySelector('title')?.getAttribute('data-i18n');
  if (pageTitleKey) {
    document.title = i18next.t(pageTitleKey);
  }

  document.documentElement.lang = i18next.language;
  updateThemeButtonText();
}

function populateLangSelector(languages) {
  const langSelector = document.getElementById('lang-selector');
  if (!langSelector) return;

  langSelector.innerHTML = '';
  languages.forEach(langInfo => {
    const option = document.createElement('option');
    option.value = langInfo.code;
    option.textContent = langInfo.name;
    langSelector.appendChild(option);
  });
  langSelector.value = i18next.language;
}

// ==================================================================================
// MANEJO DEL TEMA (MODO OSCURO/CLARO)
// ==================================================================================

function setTheme(isLight) {
  const themeBtn = document.getElementById('toggleTheme');
  if (isLight) {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
  }
  localStorage.setItem('sudoku-theme', isLight ? 'light' : 'dark');
  
  // Actualiza los textos y las imágenes que dependen del tema
  updateThemeButtonText();
  updateGamePreviewImages();
}

function updateThemeButtonText() {
    const isLight = document.documentElement.classList.contains('light');
    const themeBtn = document.getElementById('toggleTheme');
    if (themeBtn && i18next.isInitialized) {
        const emoji = isLight ? '☀️' : '🌙';
        const textKey = isLight ? 'themeLightText' : 'themeDarkText'; 
        themeBtn.innerHTML = `${emoji}<span class="btn-text"> ${i18next.t(textKey)}</span>`;
    }
}

/**
 * Actualiza la fuente de las imágenes de vista previa de los juegos
 * basándose en el tema actual (claro/oscuro).
 */
function updateGamePreviewImages() {
  const isLight = document.documentElement.classList.contains('light');
  const images = document.querySelectorAll('.game-preview-image');

  images.forEach(img => {
    const newSrc = isLight ? img.dataset.srcLight : img.dataset.srcDark;
    // Solo cambia la imagen si la fuente es diferente, para evitar recargas innecesarias
    if (newSrc && img.src !== newSrc) {
      img.src = newSrc;
    }
  });
}

// ==================================================================================
// INICIALIZACIÓN Y EVENTOS
// ==================================================================================

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/locales.json');
    const supportedLangs = await response.json();

    const langPromises = supportedLangs.map(lang => loadLanguage(lang.code));
    await Promise.all(langPromises);

    const savedLang = localStorage.getItem('savedLang');
    await i18next.changeLanguage(savedLang || supportedLangs[0].code); 

    // SOLO AHORA que todo está cargado, poblamos y actualizamos el contenido.
    populateLangSelector(supportedLangs);
    updateContent();
	updateGamePreviewImages();

    // 3. EVENTO PERSONALIZADO
    //    Disparamos un evento para avisarle al script del juego que ya puede empezar.
    document.dispatchEvent(new Event('appReady'));

  } catch (error) {
    console.error("Fallo al inicializar los idiomas:", error);
    document.body.innerHTML = "Error loading application resources."; // Mensaje de error visible
  }

  // Asignación de Eventos
  const themeBtn = document.getElementById('toggleTheme');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isCurrentlyLight = document.documentElement.classList.contains('light');
      setTheme(!isCurrentlyLight);
    });
  }

  const langSelector = document.getElementById('lang-selector');
  if (langSelector) {
    langSelector.addEventListener('change', async (event) => {
      const selectedLang = event.target.value;
      localStorage.setItem('savedLang', selectedLang);
      await i18next.changeLanguage(selectedLang);
      updateContent();
      
      document.dispatchEvent(new Event('languageChanged'));
    });
  }

});

