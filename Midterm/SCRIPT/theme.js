const body = document.getElementById("body");

function applyTheme(theme) {
    const isLight = theme === 'light';
    
    // 1. Set the official Bootstrap theme attribute
    body.setAttribute('data-bs-theme', theme);
    
    // 2. Add/Remove the "light-mode" class for your custom CSS
    if (isLight) {
        body.classList.add('light-mode');
        body.classList.remove('bg-black', 'text-white');
    } else {
        body.classList.remove('light-mode');
        body.classList.add('bg-black', 'text-white');
    }

    // 3. Update the button icons and text
    const themeToggles = document.querySelectorAll('#theme-toggle, #theme-toggle-desktop');
    themeToggles.forEach(btn => {
        const icon = btn.querySelector('i');
        const textSpan = btn.querySelector('.theme-text');
        
        if (isLight) {
            if (icon) icon.className = 'fa-solid fa-sun';
            if (textSpan) textSpan.textContent = "Dark Mode";
            btn.classList.replace('btn-outline-warning', 'btn-outline-dark');
        } else {
            if (icon) icon.className = 'fa-solid fa-moon';
            if (textSpan) textSpan.textContent = "Light Mode";
            btn.classList.replace('btn-outline-dark', 'btn-outline-warning');
        }
    });
}

// Load saved theme or default to dark
const savedTheme = localStorage.getItem('genshin-theme') || 'dark';
applyTheme(savedTheme);

// Handle the click
document.addEventListener('click', (e) => {
    const btn = e.target.closest('#theme-toggle, #theme-toggle-desktop');
    if (btn) {
        const currentTheme = body.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        localStorage.setItem('genshin-theme', newTheme);
        applyTheme(newTheme);
    }
});