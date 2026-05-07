const body = document.body;

function applyTheme(theme) {
    const isLight = theme === 'light';
    
    if (isLight) {
        body.classList.add('light-mode');
    } else {
        body.classList.remove('light-mode');
    }

    // This updates EVERY toggle button found on the current page
    const themeToggles = document.querySelectorAll('#theme-toggle, #theme-toggle-desktop');
    themeToggles.forEach(btn => {
        const icon = btn.querySelector('i');
        const textSpan = btn.querySelector('.theme-text');
        
        if (isLight) {
            if (icon) icon.className = 'fa-solid fa-sun';
            if (textSpan) textSpan.textContent = "Dark Mode";
        } else {
            if (icon) icon.className = 'fa-solid fa-moon';
            if (textSpan) textSpan.textContent = "Light Mode";
        }
    });
}

// 1. Apply theme immediately on load
const savedTheme = localStorage.getItem('genshin-theme') || 'dark';
applyTheme(savedTheme);

// 2. Handle clicks for any button with these IDs
document.addEventListener('click', (e) => {
    const btn = e.target.closest('#theme-toggle, #theme-toggle-desktop');
    if (btn) {
        const newTheme = body.classList.contains('light-mode') ? 'dark' : 'light';
        localStorage.setItem('genshin-theme', newTheme);
        applyTheme(newTheme);
    }
});