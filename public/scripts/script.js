window.onload = async () => {
    checkLoginStatus();

    if (localStorage.getItem('loggedIn') === 'true') {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = fragment.get('access_token');
        const tokenType = fragment.get('token_type');

        if (!accessToken) {
            document.getElementById('login').style.display = 'block';
            return;
        }

        try {
            // Get user info from Discord
            const user = await fetch('https://discord.com/api/users/@me', {
                headers: { authorization: `${tokenType} ${accessToken}` }
            }).then(res => res.json());

            document.getElementById('welcome').innerText =
                `Welcome ${user.username}, to Ultimate CAD!`;
            document.getElementById('login-page').classList.add('hidden');
            document.getElementById('servers-page').classList.remove('hidden');
            localStorage.setItem('discordID', user.id);

            // FIX: Await getUserByDiscordId properly and guard against missing user
            try {
                const userData = await getUserByDiscordId(user.id);
                if (userData && userData.iduser) {
                    localStorage.setItem('userId', userData.iduser);
                    console.log("Saved userId:", userData.iduser);
                }
            } catch (err) {
                console.error("Error fetching user by Discord ID:", err);
            }

            // FIX: Removed duplicate login/register block that was redundant with getUserByDiscordId
            const existingUser = await login(user.id);
            if (!existingUser || existingUser.length === 0) {
                const newUser = await register(user.id, user.username);
                if (newUser && newUser[0]) {
                    localStorage.setItem('userId', newUser[0].iduser);
                    console.log(`User registered with ID: ${newUser[0].iduser}`);
                }
            }

            // Get guilds from Discord and match against known servers
            const guilds = await fetch('https://discord.com/api/users/@me/guilds', {
                headers: { authorization: `${tokenType} ${accessToken}` }
            }).then(res => res.json());

            const body = document.getElementById('server-list');

            for (const guild of guilds) {
                const server = await checkServer(guild.id);
                if (server && server.length > 0) {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${server[0].idserver}</td>
                        <td>${server[0].name}</td>`;
                    body.appendChild(row);
                }
            }

        } catch (err) {
            console.error("Login flow error:", err);
        }
    }
};

// FIX: Removed duplicate checkServer definition — only one remains
function checkServer(discordId) {
    return fetch(`http://localhost:3000/check-server/${discordId}`)
        .then(res => res.json());
}

function discordLogin() {
    window.location.href = "https://discord.com/oauth2/authorize?client_id=1403334739724861563&response_type=token&redirect_uri=http%3A%2F%2F127.0.0.1%3A5500%2Findex.html&scope=identify+guilds";
}

function checkLoginStatus() {
    if (localStorage.getItem('userId')) {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('servers-page').classList.remove('hidden');
        localStorage.setItem('loggedIn', 'true');
    } else {
        localStorage.setItem('loggedIn', 'false');
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('servers-page').classList.add('hidden');
    }
}

function logOut() {
    localStorage.removeItem('userId');
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('discordID');
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('servers-page').classList.add('hidden');
}

// FIX: `serverId` was undefined inside joinServer — now properly read from the row
const callsTable = document.getElementById('server-list');
callsTable.addEventListener('click', function (event) {
    const row = event.target.closest('tr');
    if (row) joinServer(row);
});

async function joinServer(row) {
    // FIX: Declare all variables with const/let — were previously implicit globals
    const serverId = row.cells[0].innerText;
    const userId = localStorage.getItem('userId');

    if (!userId) {
        alert('You must be logged in to join a server.');
        return;
    }

    try {
        const joined = await checkJoins(serverId, userId);
        if (joined && joined.length > 0) {
            localStorage.setItem('serverId', serverId);
            localStorage.setItem('serverName', row.cells[1].innerText);
            window.location.href = `html/server.html?serverId=${serverId}&userId=${userId}`;
        } else {
            localStorage.setItem('serverId', serverId);
            const popup = document.getElementById('join-popup');
            popup.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error joining server:', error);
        alert('An error occurred while trying to join the server. Please try again later.');
    }
}

function closeJoinPopup() {
    document.getElementById('join-popup').classList.add('hidden');
}

async function serverJoin() {
    const joinCode = document.getElementById('join-code').value.trim();
    if (!joinCode) {
        alert('Please enter a join code.');
        return;
    }

    // FIX: serverId now read from localStorage where joinServer stored it
    const serverId = localStorage.getItem('serverId');
    const userId = localStorage.getItem('userId');

    if (!serverId) {
        alert('No server selected.');
        return;
    }

    try {
        const codeData = await getJoinCode(serverId);
        if (!codeData || codeData.code !== joinCode) {
            alert('Invalid join code. Please try again.');
        } else {
            await joinUser(userId, serverId);
            closeJoinPopup();
            window.location.href = `html/server.html?serverId=${serverId}&userId=${userId}`;
        }
    } catch (err) {
        console.error('Error verifying join code:', err);
        alert('Something went wrong. Please try again.');
    }
}

// --- Database API functions ---

function login(discordId) {
    return fetch(`http://localhost:3000/login/${discordId}`)
        .then(res => res.json());
}

function register(discordId, username) {
    return fetch(`http://localhost:3000/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId, username })
    }).then(res => res.json());
}

function checkJoins(serverId, userId) {
    return fetch(`http://localhost:3000/check-joins/${serverId}/${userId}`)
        .then(res => res.json());
}

function getJoinCode(serverId) {
    return fetch(`http://localhost:3000/join-code/${serverId}`)
        .then(res => res.json());
}

function joinUser(userId, serverId) {
    return fetch(`http://localhost:3000/join-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, serverId })
    }).then(res => res.json());
}

function getUserByDiscordId(discordId) {
    return fetch(`http://localhost:3000/getUserByDiscordId/${discordId}`)
        .then(res => res.json());
}
