/* ---------- Theme toggle ---------- */
const root = document.documentElement;
const toggle = document.getElementById("themeToggle");

toggle?.addEventListener("click", () => {
    const next = root.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-bs-theme", next);
    try {
        localStorage.setItem("theme", next);
    } catch (e) { /* storage unavailable */ }
});

async function getGithubUser(username) {
    try {
        const { Octokit } = await import("https://esm.sh/octokit");
        const octokit = new Octokit();
        const { data } = await octokit.request('GET /users/{username}', {
            username: username,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        return data;
    } catch (error) {
        console.error(`Error fetching user ${username}:`, error.status || error);
        return null;
    }
}

async function createGithubCard(username) {
    const data = await getGithubUser(username);
    if (!data) return;

    const githubCard = document.getElementById("githubCard");

    githubCard.innerHTML = `
    <a href="${data.html_url}" target="_blank" rel="noopener noreferrer" class="gh-card">
        <img src="${data.avatar_url}" alt="GitHub Avatar">
        <div class="overflow-hidden text-start">
            <p class="gh-name text-truncate">${data.name || data.login}</p>
            <p class="gh-user"><i class="bi bi-github"></i> @${data.login}</p>
        </div>
    </a>
    `;
}

createGithubCard("Byokuu");