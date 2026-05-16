import { Octokit } from "https://esm.sh/octokit";

const octokit = new Octokit();

async function getGithubUser(username) {
    try {
        const { data } = await octokit.request('GET /users/{username}', {
            username: username,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        return data;
    } catch (error) {
        console.error(`Error fetching user ${username}:`, error.status);
        return null;
    }
}

async function createGithubCard(username) {
    const data = await getGithubUser(username);
    if (!data) return;

    const githubCard = document.getElementById("githubCard");

    githubCard.innerHTML = `
    <div class="d-flex align-items-center g-0">
        <div style="width: 38px; margin-left: -4px;" class="d-flex justify-content-start">
            <a href="${data.html_url}" target="_blank" class="text-white">
                <i class="bi bi-github fs-4"></i>
            </a>
        </div>
        
        <div class="flex-grow-1">
            <div class="card border-0 p-2" style="background: rgba(255, 255, 255, 0.05); border-radius: 10px; backdrop-filter: blur(5px); border: 1px solid rgba(255, 255, 255, 0.1) !important;">
                <a href="${data.html_url}" target="_blank" style="text-decoration: none; color: inherit;">
                    <div class="d-flex align-items-center gap-3">
                        <img src="${data.avatar_url}" class="rounded-circle" 
                             style="width: 45px; height: 45px; border: 2px solid var(--genshin-gold); object-fit: cover;" 
                             alt="GitHub Avatar">
                        <div class="overflow-hidden text-start">
                            <p class="fw-bold mb-0 text-truncate" style="font-size: 0.85rem; color: var(--genshin-gold);">
                                ${data.name || data.login}
                            </p>
                            <p class="text-white-50 mb-0" style="font-size: 0.75rem;">
                                <i class="bi bi-github"></i> @${data.login}
                            </p>
                        </div>
                    </div>
                </a>
            </div>
        </div>
    </div>
`;
}

// Call the function with your username
createGithubCard("Byokuu");