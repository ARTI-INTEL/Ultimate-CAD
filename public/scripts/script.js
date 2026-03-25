window.onload = async () => {
    checkLoginStatus();

    if (localStorage.getItem('loggedIn')) {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const [accessToken, tokenType] = [fragment.get('access_token'), fragment.get('token_type')];

        if (!accessToken) {
            return (document.getElementById('login').style.display = 'block');
        }

        try {
            // Get user info
            const user = await fetch('https://discord.com/api/users/@me', {
                headers: { authorization: `${tokenType} ${accessToken}` }
            }).then(res => res.json());

            document.getElementById('welcome').innerText =
                `Welcome ${user.username}, to Ultimate CAD!`;
            document.getElementById('login-page').classList.add('hidden');
            document.getElementById('servers-page').classList.remove('hidden');
            localStorage.setItem('discordID', user.id);
            // 1. Fetch from backend and save into localStorage
            getUserByDiscordId(user.id)
            .then(user => {
                localStorage.setItem('userId', user.iduser); // stored as a string
                console.log("Saved userId:", user.iduser);
            })
            .catch(err => console.error("Error:", err));
      
            let id = await login(user.id);
            if (!id) {
                const userId = await register(user.id, user.username);
                localStorage.setItem('userid', userId[0].iduser);
                console.log(`User registered with ID: ${userId}`);
            }

            // Get guilds list from Discord API
            const guilds = await fetch('https://discord.com/api/users/@me/guilds', {
                headers: { authorization: `${tokenType} ${accessToken}` }
            }).then(res => res.json());

            const body = document.getElementById('server-list');

            for (const guild of guilds) {
                const server = await checkServer(guild.id); // wait for the API response
                if (server && server.length > 0) {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${server[0].idserver}</td>
                        <td>${server[0].name}</td>`;
                    body.appendChild(row);
                }
            }

        } catch (err) {
            console.error(err);
        }
    }
};

function checkServer(discordId) {
    return fetch(`http://localhost:3000/check-server/${discordId}`)
        .then(res => res.json());
}


function discordLogin() {
    // Replace this with your actual Discord OAuth URL 
    window.location.href = "https://discord.com/oauth2/authorize?client_id=1403334739724861563&response_type=token&redirect_uri=http%3A%2F%2F127.0.0.1%3A5500%2Findex.html&scope=identify+guilds"; // 
}

function checkLoginStatus() {
    // Check if user is logged in
    if (localStorage.getItem('userid')) {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('servers-page').classList.remove('hidden');
        localStorage.setItem('loggedIn', true);
    } else {
        localStorage.setItem('loggedIn', false);
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('servers-page').classList.add('hidden');
    }
}

function logOut() {
    // Clear local storage and redirect to login page
    localStorage.removeItem('userId');
    localStorage.removeItem('loggedIn');
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('servers-page').classList.add('hidden');
}

function refresh() {
    `Welcome, ${user.username} (ID: ${user.id}) to Ultimate CAD!`
}

const callsTable = document.getElementById('server-list'); // Assuming your table has an ID 'myTable'
callsTable.addEventListener('click', function(event) {
    joinServer(event.target.closest('tr'));
});

function joinServer(row) {
    try {
        const userId = localStorage.getItem('userId');
        console.log("Loaded userId from storage:", userId);
        joined = checkJoins(row.cells[0].innerText, localStorage.getItem('userId'))
        if (joined) {
            window.location.href = `html/server.html?serverId=${row.cells[0].innerText}?userId=${userId}`;
            localStorage.setItem('serverName', row.cells[1].innerText);
        } else {
            popup = document.getElementById('join-popup');
            popup.classList.remove('hidden');
        }

    }catch (error) {
        console.error('Error joining server:', error);
        alert('An error occurred while trying to join the server. Please try again later.');
    }

    localStorage.setItem('serverId', row.cells[0].innerText);
}

function closeJoinPopup() {
    document.getElementById('join-popup').classList.add('hidden');
}

function serverJoin() {
    const joinCode = document.getElementById('join-code').value;
    if (!joinCode) {
        alert('Please enter a join code.');
        return;
    }
    code = getJoinCode(serverId);
    if (code !== joinCode) {
        alert('Invalid join code. Please try again.');
        return;
    } else {
        joinUser(localStorage.getItem('userid'), serverId)
}
}

// Database API functions
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

function checkServer(discordId) {
  return fetch(`http://localhost:3000/check-server/${discordId}`)
    .then(res => res.json());
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

