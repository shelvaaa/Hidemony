const CLIENT_ID = '263cabb9b97c43d593140ffdc085c4e1';
const CLIENT_SECRET = 'e1b99c46557242479b1819443bdf1a3a';
const REDIRECT_URI = 'http://127.0.0.1:5500/index.html';
const SCOPES = 'playlist-modify-public playlist-modify-private user-read-private';
let accessToken = '';
let refreshToken = '';
const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
let usedUris = new Set();

// UI Helper Functions
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    const spinner = document.getElementById('spinner');
    if (overlay && spinner) {
        spinner.style.display = 'block';
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    const spinner = document.getElementById('spinner');
    if (overlay && spinner) {
        spinner.style.display = 'none';
        overlay.style.display = 'none';
    }
}

// Initialize Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const encodeButton = document.getElementById('encodeMode');
    const decodeButton = document.getElementById('decodeMode');

    encodeButton.addEventListener('click', () => {
        encodeButton.classList.add('active');
        decodeButton.classList.remove('active');
        document.getElementById('encodeForm').classList.remove('hidden');
        document.getElementById('decodeForm').classList.add('hidden');
    });

    decodeButton.addEventListener('click', () => {
        decodeButton.classList.add('active');
        encodeButton.classList.remove('active');
        document.getElementById('encodeForm').classList.add('hidden');
        document.getElementById('decodeForm').classList.remove('hidden');
    });

    document.getElementById('loginButton').addEventListener('click', () => {
        const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;
        console.log('Redirecting to Spotify auth:', authUrl);
        window.location.href = authUrl;
    });

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        exchangeCodeForToken(code);
    }

    document.getElementById('encodeButton').addEventListener('click', encodeMessage);
    document.getElementById('decodeButton').addEventListener('click', decodeMessage);
    document.getElementById('uploadPlaylist').addEventListener('change', handleFileUpload);
});

// Spotify Authentication Functions
async function exchangeCodeForToken(code) {
    try {
        showLoading();
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET)
            },
            body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error_description || response.statusText}`);
        }

        const data = await response.json();
        accessToken = data.access_token;
        refreshToken = data.refresh_token || '';
        console.log('Access token received:', accessToken);
        window.history.replaceState({}, document.title, window.location.pathname);
        alert('Successfully logged in to Spotify!');
    } catch (error) {
        console.error('Error exchanging code for token:', error);
        alert('Failed to login to Spotify. Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function refreshAccessToken() {
    if (!refreshToken) return false;
    try {
        showLoading();
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET)
            },
            body: `grant_type=refresh_token&refresh_token=${refreshToken}`
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error_description}`);
        }

        const data = await response.json();
        accessToken = data.access_token;
        console.log('Token refreshed:', accessToken);
        return true;
    } catch (error) {
        console.error('Error refreshing token:', error);
        alert('Failed to refresh Spotify token. Please login again.');
        return false;
    } finally {
        hideLoading();
    }
}

// Spotify API Helper Function
async function searchSongForCharacter(char, retries = 10, offset = 0) {
    if (retries <= 0) {
        throw new Error(`No songs found where artist starts with ${char}`);
    }
    try {
        const response = await fetch(`https://api.spotify.com/v1/search?q=artist:${encodeURIComponent(char)}%20&type=track&limit=50&offset=${offset}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to search for song: ${errorData.error.message}`);
        }

        const data = await response.json();
        const availableTracks = data.tracks.items.filter(track =>
            track.artists[0]?.name.toLowerCase().startsWith(char.toLowerCase()) && !usedUris.has(track.uri)
        );

        if (availableTracks.length === 0) {
            return await searchSongForCharacter(char, retries - 1, offset + 50);
        }

        const randomIndex = Math.floor(Math.random() * availableTracks.length);
        const track = availableTracks[randomIndex];
        usedUris.add(track.uri);
        return {
            artist: track.artists[0].name,
            song: track.name,
            uri: track.uri
        };
    } catch (error) {
        console.error(`Error searching for song starting with ${char}:`, error);
        return await searchSongForCharacter(char, retries - 1, offset + 50);
    }
}

// Encoding Function
async function encodeMessage() {
    const message = document.getElementById('encodeMessage').value.trim();
    if (!message) {
        alert('Please enter a message!');
        return;
    }
    if (message.length > 999) {
        alert('Message is too long! Maximum length is 999 characters.');
        return;
    }
    if (!accessToken) {
        alert('Please login to Spotify first!');
        return;
    }

    const digitToLetter = 'ABCDEFGHIJ'; // 0-9 mapped to A-J
    let playlist = [];
    let trackUris = [];
    usedUris.clear();

    try {
        showLoading();

        // Encode message length (3 digits: 000-999)
        const messageLength = message.length;
        const lengthDigit1 = Math.floor(messageLength / 100);
        const lengthDigit2 = Math.floor((messageLength % 100) / 10);
        const lengthDigit3 = messageLength % 10;

        const lengthChar1 = digitToLetter[lengthDigit1];
        if (!lengthChar1) throw new Error('Failed to map first digit of message length.');
        const lengthSong1 = await searchSongForCharacter(lengthChar1);
        if (!lengthSong1) throw new Error(`Failed to find a song for length character ${lengthChar1}`);
        playlist.push(`${lengthSong1.artist} - ${lengthSong1.song}`);
        trackUris.push(lengthSong1.uri);

        const lengthChar2 = digitToLetter[lengthDigit2];
        if (!lengthChar2) throw new Error('Failed to map second digit of message length.');
        const lengthSong2 = await searchSongForCharacter(lengthChar2);
        if (!lengthSong2) throw new Error(`Failed to find a song for length character ${lengthChar2}`);
        playlist.push(`${lengthSong2.artist} - ${lengthSong2.song}`);
        trackUris.push(lengthSong2.uri);

        const lengthChar3 = digitToLetter[lengthDigit3];
        if (!lengthChar3) throw new Error('Failed to map third digit of message length.');
        const lengthSong3 = await searchSongForCharacter(lengthChar3);
        if (!lengthSong3) throw new Error(`Failed to find a song for length character ${lengthChar3}`);
        playlist.push(`${lengthSong3.artist} - ${lengthSong3.song}`);
        trackUris.push(lengthSong3.uri);

        // Convert message to binary
        let binary = '';
        for (let char of message) {
            const charCode = char.charCodeAt(0);
            binary += charCode.toString(2).padStart(8, '0');
        }
        console.log(`Original binary: ${binary}`);

        // Encode binary using 2 bits per song
        const bitsPerSong = 2;
        const requiredSongs = Math.ceil(binary.length / bitsPerSong);
        const paddingLength = (bitsPerSong - (binary.length % bitsPerSong)) % bitsPerSong;
        binary += '0'.repeat(paddingLength);

        const charMapping = ['a', 'b', 'c', 'd']; // a=00, b=01, c=10, d=11
        for (let i = 0; i < binary.length; i += bitsPerSong) {
            const bits = binary.slice(i, i + bitsPerSong).padEnd(bitsPerSong, '0');
            const index = parseInt(bits, 2);
            const char = charMapping[index];
            console.log(`Encoding bits: ${bits}, Index: ${index}, Char: ${char}`);

            const song = await searchSongForCharacter(char);
            playlist.push(`${song.artist} - ${song.song}`);
            trackUris.push(song.uri);
        }

        // Create Spotify playlist
        if (!await refreshAccessToken()) throw new Error('Failed to refresh Spotify token.');

        const userResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!userResponse.ok) {
            const errorData = await userResponse.json();
            throw new Error(`Failed to get user ID: ${errorData.error.message}`);
        }
        const userData = await userResponse.json();
        const userId = userData.id;

        const createResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: `Hidemony Playlist - ${new Date().toISOString().slice(0, 10)}`,
                public: true,
                description: 'A playlist generated by SteganoTunes'
            })
        });
        if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(`Failed to create playlist: ${errorData.error.message}`);
        }
        const playlistData = await createResponse.json();
        const playlistId = playlistData.id;

        // Add tracks to playlist in batches
        for (let i = 0; i < trackUris.length; i += 100) {
            const batch = trackUris.slice(i, i + 100);
            const addResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ uris: batch })
            });
            if (!addResponse.ok) {
                const errorData = await addResponse.json();
                throw new Error(`Failed to add tracks: ${errorData.error.message}`);
            }
        }

        // Display playlist in UI
        const playlistOutput = document.getElementById('playlistOutput');
        playlistOutput.innerHTML = '';
        playlist.forEach(song => {
            const li = document.createElement('li');
            li.textContent = song;
            playlistOutput.appendChild(li);
        });
        document.getElementById('encodeResult').style.display = 'block';
        alert(`Playlist created in Spotify with ID: ${playlistId}. Check your Spotify library!`);

        // Export playlist as text file
        document.getElementById('exportTxtButton').onclick = () => {
            const blob = new Blob([playlist.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'playlist.txt';
            a.click();
            URL.revokeObjectURL(url);
        };
    } catch (error) {
        console.error('Error creating Spotify playlist:', error);
        alert('Failed to create playlist. Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

// File Upload Handler
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('decodePlaylist').value = e.target.result;
    };
    reader.readAsText(file);
}

// Decoding Function
async function decodeMessage() {
    const playlistLink = document.getElementById('playlistLink').value.trim();
    const playlistInput = document.getElementById('decodePlaylist').value.trim();

    if (!playlistLink && !playlistInput) {
        alert('Please enter a playlist, upload a file, or provide a Spotify link!');
        return;
    }

    try {
        showLoading();
        if (playlistLink) {
            await decodeFromLink();
        } else {
            decodeFromText();
        }
    } catch (error) {
        console.error('Error decoding message:', error);
        alert('Failed to decode message. Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

function decodeFromText() {
    const playlistInput = document.getElementById('decodePlaylist').value.trim();
    if (!playlistInput) {
        throw new Error('No playlist data provided.');
    }
    const playlist = playlistInput.split('\n').map(line => line.trim()).filter(line => line && line.includes(' - '));
    if (playlist.length < 3) {
        throw new Error('Playlist is too short or malformed. Ensure it contains at least three songs in "artist - song" format.');
    }
    decodePlaylist(playlist);
}

async function decodeFromLink() {
    const playlistLink = document.getElementById('playlistLink').value.trim();
    if (!accessToken) {
        throw new Error('Please login to Spotify first!');
    }

    let playlistId;
    try {
        if (playlistLink.includes('open.spotify.com/playlist/')) {
            const url = new URL(playlistLink);
            playlistId = url.pathname.split('/playlist/')[1]?.split('?')[0];
        } else if (playlistLink.includes('spotify:playlist:')) {
            playlistId = playlistLink.split('spotify:playlist:')[1];
        } else {
            throw new Error('Invalid Spotify playlist link format.');
        }

        if (!await refreshAccessToken()) {
            throw new Error('Failed to refresh Spotify token.');
        }

        let allTracks = [];
        let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

        // Fetch all tracks with pagination
        while (nextUrl) {
            const response = await fetch(nextUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to fetch playlist tracks: ${errorData.error.message}`);
            }
            const data = await response.json();
            allTracks = allTracks.concat(data.items);
            nextUrl = data.next;
        }

        const playlist = allTracks.map(item => {
            const track = item.track;
            const artist = track.artists[0]?.name || '';
            const song = track.name || '';
            return `${artist} - ${song}`;
        }).filter(line => line && line.includes(' - '));

        if (playlist.length === 0) {
            throw new Error('No valid tracks found in the playlist.');
        }

        document.getElementById('decodePlaylist').value = playlist.join('\n');
        decodePlaylist(playlist);
    } catch (error) {
        throw error;
    }
}

function decodePlaylist(playlist) {
    if (playlist.length < 3) {
        throw new Error('Playlist is too short to contain a message. Minimum 3 songs required.');
    }

    const digitToLetter = 'ABCDEFGHIJ';
    const bitsPerSong = 2;
    const charMapping = ['a', 'b', 'c', 'd']; // a=00, b=01, c=10, d=11

    // Decode message length from first three songs
    const lengthSong1 = playlist[0].split(' - ')[0];
    const lengthSong2 = playlist[1].split(' - ')[0];
    const lengthSong3 = playlist[2].split(' - ')[0];
    if (!lengthSong1 || !lengthSong2 || !lengthSong3 || lengthSong1.length < 1 || lengthSong2.length < 1 || lengthSong3.length < 1) {
        throw new Error('Invalid playlist format: First three songs must have artist names with at least one character.');
    }

    const lengthChar1 = lengthSong1[0].toUpperCase();
    const lengthChar2 = lengthSong2[0].toUpperCase();
    const lengthChar3 = lengthSong3[0].toUpperCase();
    const lengthDigit1 = digitToLetter.indexOf(lengthChar1);
    const lengthDigit2 = digitToLetter.indexOf(lengthChar2);
    const lengthDigit3 = digitToLetter.indexOf(lengthChar3);

    if (lengthDigit1 < 0 || lengthDigit2 < 0 || lengthDigit3 < 0) {
        throw new Error('Invalid message length: First three songs must start with letters A-J.');
    }

    const messageLength = lengthDigit1 * 100 + lengthDigit2 * 10 + lengthDigit3;
    if (messageLength === 0) {
        throw new Error('Decoded message length is 0. No message to decode.');
    }
    if (messageLength > 999) {
        throw new Error('Decoded message length exceeds maximum of 999 characters.');
    }

    // Check if playlist has enough songs
    const dataSongs = playlist.slice(3);
    const requiredSongs = Math.ceil(messageLength * 8 / bitsPerSong);
    if (dataSongs.length < requiredSongs) {
        throw new Error(`Not enough songs to decode a message of length ${messageLength}. Need ${requiredSongs + 3} songs (including 3 for length), found ${playlist.length}.`);
    }

    // Decode binary from data songs
    let binary = '';
    for (let song of dataSongs) {
        const [artist] = song.split(' - ');
        if (!artist || artist.length < 1) continue;
        const char = artist[0].toLowerCase();
        const bitIndex = charMapping.indexOf(char);
        const bits = bitIndex >= 0 ? bitIndex.toString(2).padStart(bitsPerSong, '0') : '0'.repeat(bitsPerSong);
        binary += bits;
        console.log(`Decoded song: ${song}, Char: ${char}, BitIndex: ${bitIndex}, Bits: ${bits}`);
    }

    const requiredBits = messageLength * 8;
    if (binary.length < requiredBits) {
        console.warn(`Padding binary with zeros. Expected ${requiredBits} bits, got ${binary.length}`);
        binary += '0'.repeat(requiredBits - binary.length);
    }
    binary = binary.slice(0, requiredBits);
    console.log(`Final binary: ${binary}`);

    // Convert binary to message
    let message = '';
    for (let i = 0; i < binary.length; i += 8) {
        const byte = binary.slice(i, i + 8);
        if (byte.length === 8) {
            const charCode = parseInt(byte, 2);
            message += String.fromCharCode(charCode);
        }
    }

    if (!message || message.trim() === '') {
        throw new Error('No valid message decoded. Check the playlist format and ensure it matches the encoded format.');
    }

    document.getElementById('decodedMessage').textContent = message;
    document.getElementById('decodeResult').style.display = 'block';
}