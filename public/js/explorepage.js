// API key for accessing YouTube Data API
const API_KEY = ''; // removed API key from public

// DOM elements for search bar and video display grid
const searchBar = document.getElementById('search-bar');
const videoGrid = document.getElementById('video-grid');

// Array of random search terms for fetching videos when no query is provided
const randomQueries = [
    'cats', 'music', 'gaming', 'cooking', 'travel', 'science', 'art', 'sports',
    'nature', 'technology', 'movies', 'dance', 'fitness', 'comedy', 'gaming', 'animals', 'shopping',
    'money', 'wealth', 'programming', 'music', 'trending', 'news', 'education', 'history', 'health', 'food', 'lifestyle', 'fashion', 'photography', 'DIY'
];

// Fetches random YouTube videos based on a random query from randomQueries
async function fetchRandomVideos() {
    // Select a random query from the randomQueries array
    const randomQuery = randomQueries[Math.floor(Math.random() * randomQueries.length)];
    try {
        // Make API request to YouTube with the random query, limiting to 6 video results
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=6&q=${encodeURIComponent(randomQuery)}&type=video&key=${API_KEY}`
        );
        // Check if the API response is successful
        if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
        // Parse the JSON response
        const data = await response.json();
        // Log API response for debugging
        console.log('Random videos API response:', data.items);
        // Display the fetched videos
        displayVideos(data.items);
    } catch (error) {
        // Log error and display error message in the video grid
        console.error('Error fetching random videos:', error);
        videoGrid.innerHTML = '<p style="color: #34495e;">Failed to load videos. Please try again.</p>';
    }
}

// Fetches YouTube videos based on a user-provided search query
async function fetchVideos(query) {
    try {
        // Make API request to YouTube with the user query, limiting to 6 video results
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=6&q=${encodeURIComponent(query)}&type=video&key=${API_KEY}`
        );
        // Check if the API response is successful
        if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
        // Parse the JSON response
        const data = await response.json();
        // Log API response for debugging
        console.log('Search videos API response:', data.items);
        // Display the fetched videos
        displayVideos(data.items);
    } catch (error) {
        // Log error and display error message in the video grid
        console.error('Error fetching videos:', error);
        videoGrid.innerHTML = '<p style="color: #34495e;">Failed to load videos. Please try again.</p>';
    }
}

// Displays videos as interactive pin cards in the video grid
function displayVideos(videos) {
    // Clear the video grid before adding new content
    videoGrid.innerHTML = '';

    // Check if videos array is empty or undefined
    if (!videos || videos.length === 0) {
        videoGrid.innerHTML = '<p style="color: #34495e;">No results found.</p>';
        return;
    }

    // Iterate through each video to create a pin card
    videos.forEach(video => {
        // Validate video ID to ensure it exists and is a valid string
        if (!video.id || !video.id.videoId || typeof video.id.videoId !== 'string' || video.id.videoId.trim() === '') {
            console.warn('Skipping invalid video item:', video);
            return;
        }

        // Create a div element for the pin card
        const videoItem = document.createElement('div');
        videoItem.className = 'pin_card';

        // Structure video data for the pin card
        const pinData = {
            id: video.id.videoId,
            title: video.snippet.title,
            description: video.snippet.description || 'No description available',
            destination: `https://www.youtube.com/watch?v=${video.id.videoId}`,
            img_blob: video.snippet.thumbnails.high.url,
            board_id: null,
            user_id: 1,
            username: "YouTube",
            display_name: "YouTube Video",
            user_avatar_url: "./img/youtube-icon.png",
            is_liked: false,
            like_count: 0
        };

        // Validate the destination URL to ensure it’s a proper YouTube link
        if (!pinData.destination || typeof pinData.destination !== 'string' || !pinData.destination.startsWith('https://www.youtube.com/watch?v=')) {
            console.warn('Invalid destination URL for video:', pinData);
            return;
        }

        // Set the HTML content for the pin card, including title, image, and interaction buttons
        videoItem.innerHTML = `
            <div class="pin_title">
                <div class="video-title">${video.snippet.title}</div>
            </div>
            <div class="pin_modal">
                <div class="modal_head">
                    <div class="save_card">Save</div>
                </div>
                <div class="modal_foot">
                    <div class="destination">
                        <div class="icon_container">
                            <img src="./img/arrow-upper-right.png" alt="destination" class="icon">
                        </div>
                        <a href="https://www.youtube.com/watch?v=${video.id.videoId}" target="_blank">
                            Watch on YouTube
                        </a>
                    </div>
                    <div class="icon_container copy_link" title="Copy video link">
                        <img src="./img/share.png" alt="copy link" class="icon">
                    </div>
                    <div class="icon_container">
                        <img src="./img/ellipsis.png" alt="edit" class="icon">
                    </div>
                </div>
            </div>
            <div class="pin_image">
                <img src="${video.snippet.thumbnails.high.url}" alt="${video.snippet.title}">
            </div>
        `;

        // Add event listener to the save button (placeholder functionality)
        const saveButton = videoItem.querySelector('.save_card');
        saveButton.addEventListener('click', () => {
            alert('Save functionality is not implemented yet.');
        });

        // Add event listener to the copy link button
        const copyButton = videoItem.querySelector('.copy_link');
        copyButton.addEventListener('click', () => {
            // Log the URL being copied for debugging
            console.log('Attempting to copy link:', pinData.destination);
            // Check if the destination URL is valid
            if (pinData.destination && typeof pinData.destination === 'string') {
                // Copy the URL to the clipboard
                navigator.clipboard.write(pinData.destination).then(() => {
                    // Update button text to indicate success
                    copyButton.innerHTML = '<span style="color: #34495e;">Link copied!</span>';
                    // Reset button after 2 seconds
                    setTimeout(() => {
                        copyButton.innerHTML = '<img src="./img/share.png" alt="copy link" class="icon">';
                    }, 2000);
                }).catch(err => {
                    // Handle clipboard copy failure
                    console.error('Failed to copy link:', err);
                    alert(`Failed to copy link. Manual URL: ${pinData.destination}`);
                });
            } else {
                // Handle invalid URL
                console.error('Invalid URL for copying:', pinData.destination);
                alert(`Failed to copy link. Manual URL: ${pinData.destination || 'Not available'}`);
            }
        });

        // Append the pin card to the video grid
        videoGrid.appendChild(videoItem);
    });
}

// Add event listener for search on pressing the Enter key
searchBar.addEventListener('keypress', (event) => {
    // Check if the pressed key is Enter and the search bar has a non-empty value
    if (event.key === 'Enter' && searchBar.value.trim() !== '') {
        // Fetch videos based on the search query
        fetchVideos(searchBar.value.trim());
    }
});

// Load content when the page is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Get query parameter from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');
    if (query) {
        // Fetch videos for the query if it exists
        fetchVideos(decodeURIComponent(query));
    } else {
        // Otherwise, fetch random videos
        fetchRandomVideos();
    }
});