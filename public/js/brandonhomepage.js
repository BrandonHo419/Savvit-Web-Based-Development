// Import create_pin function for generating video pin cards
import { create_pin } from "./boardstuff/modal_and_pin_script.js";

// YouTube API key for making requests
const API_KEY = 'AIzaSyAYTlMmX2pliGDz7NDmVWHFrIjnPFOckLU';
// DOM element for video display grid
const videoGrid = document.getElementById('video-grid');

// Minimum and maximum video duration for quality filtering (in seconds)
const QUALITY_DURATION_MIN = 180; // 3 minutes
const QUALITY_DURATION_MAX = 900; // 15 minutes

// Add event listener for when the page is fully loaded
window.addEventListener('DOMContentLoaded', () => {
    // Get search bar element
    const searchBar = document.getElementById('search-bar');
    // Track last search query to detect if appending results
    let lastQuery = '';
    // Store next page token for pagination
    let nextPageToken = '';
    // Track displayed video IDs to avoid duplicates
    let displayedVideoIds = new Set();

searchBar?.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && searchBar.value.trim()) {
        const currentQuery = searchBar.value.trim();
        const isSameQuery = currentQuery === lastQuery;
        fetchVideos(currentQuery, isSameQuery);      // YouTube
        fetchPixabayImages(currentQuery);            // Pixabay
        lastQuery = currentQuery;
    }
});

    // Fetch videos from YouTube API based on query
    async function fetchVideos(query, append = false) {
        try {
            // Construct URL for YouTube search API
            const url = new URL('https://www.googleapis.com/youtube/v3/search');
            url.searchParams.set('part', 'snippet'); // Request video snippet data
            url.searchParams.set('maxResults', '25'); // Limit to 25 results
            url.searchParams.set('q', query); // Set search query
            url.searchParams.set('type', 'video'); // Restrict to videos
            url.searchParams.set('relevanceLanguage', 'en'); // Prioritize English content
            url.searchParams.set('regionCode', 'US'); // Target US region
            url.searchParams.set('order', 'viewCount'); // Sort by view count
            url.searchParams.set('key', API_KEY); // Include API key
            // Append page token for pagination if applicable
            if (append && nextPageToken) {
                url.searchParams.set('pageToken', nextPageToken);
            }

            // Make search API request
            const searchResponse = await fetch(url);
            // Check for API errors
            if (!searchResponse.ok) {
                const errorData = await searchResponse.json();
                console.error("YouTube API error:", errorData);
                throw new Error('Search request failed');
            }

            // Parse search response
            const searchData = await searchResponse.json();
            // Update next page token for pagination
            nextPageToken = searchData.nextPageToken || '';

            // Filter out already displayed videos
            let videoItems = searchData.items.filter(item => !displayedVideoIds.has(item.id.videoId));
            // If no new videos and more pages exist, fetch next page
            if (!videoItems.length && nextPageToken) {
                return fetchVideos(query, true);
            }
            // If no videos found, display message or return
            if (!videoItems.length) {
                if (!append) {
                    videoGrid.innerHTML = '<p style="color: #34495e;">No results found.</p>';
                }
                return;
            }

            // Get video IDs for details request
            const videoIds = videoItems.map(v => v.id.videoId).join(',');
            // Fetch video details (duration, statistics, etc.)
            const detailsResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?` +
                new URLSearchParams({
                    part: 'contentDetails,snippet,statistics',
                    id: videoIds,
                    key: API_KEY
                })
            );
            // Check for details API errors
            if (!detailsResponse.ok) throw new Error('Details request failed');

            // Parse details response
            const detailsData = await detailsResponse.json();
            // Map video details by ID for easy lookup
            const detailsMap = Object.fromEntries(
                detailsData.items.map(item => [
                    item.id,
                    {
                        duration: parseISODuration(item.contentDetails.duration), // Convert duration to seconds
                        title: item.snippet.title,
                        channel: item.snippet.channelTitle,
                        views: parseInt(item.statistics.viewCount || '0', 10), // Parse view count
                        description: item.snippet.description || 'No description available'
                    }
                ])
            );

            // Display filtered videos
            displayVideos(videoItems, detailsMap);
        } catch (error) {
            // Log error and display message if not appending
            console.error('Error fetching videos:', error);
            if (!append) {
                videoGrid.innerHTML = '<p style="color: #34495e;">Failed to load videos. Please try again.</p>';
            }
        }
    }

    // Parse ISO 8601 duration (e.g., PT5M30S) to seconds
    function parseISODuration(duration) {
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const hours = parseInt(match?.[1] || '0', 10);
        const minutes = parseInt(match?.[2] || '0', 10);
        const seconds = parseInt(match?.[3] || '0', 10);
        return hours * 3600 + minutes * 60 + seconds;
    }

    // Format seconds into human-readable duration (e.g., 5:30 or 1:05:30)
    function formatDuration(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const pad = n => n.toString().padStart(2, '0'); // Pad numbers with leading zero
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    }

    // Display videos as pin cards in the video grid
    function displayVideos(videos, detailsMap) {
        // Filter videos by duration and limit to 8
        videos
            .filter(video => {
                const detail = detailsMap[video.id.videoId];
                // Include videos within duration range
                return detail && detail.duration >= QUALITY_DURATION_MIN && detail.duration <= QUALITY_DURATION_MAX;
            })
            .slice(0, 8)
            .forEach(video => {
                const rawVideoId = video.id.videoId;
                const videoId = `yt_${rawVideoId}`; // Prefix video ID to avoid conflicts
                // Skip if already displayed
                if (displayedVideoIds.has(videoId)) return;
                displayedVideoIds.add(videoId);

                // Get video details
                const detail = detailsMap[rawVideoId];
                const durationFormatted = formatDuration(detail.duration);
                const viewCount = detail.views.toLocaleString(); // Format views with commas
                const channel = detail.channel;
                const isShort = detail.duration <= 60; // Mark as short if ≤ 60 seconds

                // List of thumbnail URLs to try (high to low quality)
                const thumbs = [
                    `https://img.youtube.com/vi/${rawVideoId}/maxresdefault.jpg`,
                    `https://img.youtube.com/vi/${rawVideoId}/sddefault.jpg`,
                    video.snippet.thumbnails?.high?.url
                ];

                let tried = 0; // Track attempted thumbnails

                // Try loading a valid thumbnail
                const tryThumb = () => {
                    const img = new Image();
                    img.src = thumbs[tried];

                    // On successful load, check image quality
                    img.onload = () => {
                        // If image is too small, try next thumbnail
                        if (img.naturalWidth < 300 && ++tried < thumbs.length) {
                            tryThumb();
                        } else {
                            // Use valid thumbnail to create pin
                            createAndAppendPin(thumbs[tried]);
                        }
                    };

                    // On error, try next thumbnail or use fallback
                    img.onerror = () => {
                        if (++tried < thumbs.length) {
                            tryThumb();
                        } else {
                            console.warn(`No valid image for ${videoId}`);
                            // Use fallback image if all thumbnails fail
                            createAndAppendPin('/images/fallback.jpg');
                        }
                    };
                };

                // Create and append pin card with thumbnail
                const createAndAppendPin = (thumbnailSrc) => {
                    // Structure pin data for create_pin function
                    const pinData = {
                        id: videoId,
                        title: `${detail.title} (${durationFormatted})`, // Include duration in title
                        description: detail.description,
                        destination: `https://www.youtube.com/watch?v=${rawVideoId}`,
                        img_blob: thumbnailSrc,
                        board_id: 1,
                        user_id: 1,
                        username: "YouTube",
                        display_name: "YouTube Video",
                        user_avatar_url: "./img/youtube-icon.png",
                        is_liked: false,
                        like_count: 0,
                        is_short: isShort,
                        extra_info: `${channel} • ${viewCount} views` // Additional video info
                    };

                    // Create pin using imported function
                    create_pin(pinData);

                    // Move newly created pin card to video grid
                    const allCards = document.querySelectorAll('.pin_container .pin_card');
                    const newCard = allCards[allCards.length - 1];
                    if (newCard) {
                        videoGrid.appendChild(newCard);
                    }
                };

                // Start thumbnail loading process
                tryThumb();
            });
    }
});