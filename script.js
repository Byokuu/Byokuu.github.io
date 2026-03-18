function openTab(evt, tabName) {
    var i, content, tabs;
    
    // Hide all contents
    content = document.getElementsByClassName("tab-content");
    for (i = 0; i < content.length; i++) {
        content[i].classList.remove("active");
    }
    
    // Deactivate all buttons
    tabs = document.getElementsByClassName("tab-btn");
    for (i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove("active");
    }
    
    // Show current tab
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");

    // "Level Up" Animation Logic
    if (tabName === 'portfolio') {
        const bars = document.querySelectorAll('.exp-fill');
        bars.forEach(bar => {
            // Temporarily reset to 0
            const finalWidth = bar.style.width;
            bar.style.width = '0%';
            // Trigger reflow to restart transition
            setTimeout(() => {
                bar.style.width = finalWidth;
            }, 50);
        });
    }
}
