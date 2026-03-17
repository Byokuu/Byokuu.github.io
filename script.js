// Wait for the page to load completely
window.addEventListener("load", function() {
    const loader = document.getElementById("loader");
    
    // Slight delay so the animation can be seen
    setTimeout(() => {
        loader.classList.add("loader-hidden");
    }, 2000); 
});

// Your existing Tab Function
function openTab(evt, tabName) {
    var i, content, tabs;
    content = document.getElementsByClassName("tab-content");
    for (i = 0; i < content.length; i++) {
        content[i].classList.remove("active");
    }
    tabs = document.getElementsByClassName("tab-btn");
    for (i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove("active");
    }
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}
