function openTab(evt, tabName) {
    var i, content, tabs;
    
    // Hide all tab content
    content = document.getElementsByClassName("tab-content");
    for (i = 0; i < content.length; i++) {
        content[i].classList.remove("active");
    }
    
    // Deactivate all buttons
    tabs = document.getElementsByClassName("tab-btn");
    for (i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove("active");
    }
    
    // Show the current tab and add an "active" class to the button
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}
