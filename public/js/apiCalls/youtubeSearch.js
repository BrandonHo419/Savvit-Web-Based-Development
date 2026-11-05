import { create_pin } from "../boardstuff/modal_and_pin_script.js";

const API_KEY = 'YOUR_YOUTUBE_API_KEY'; // Replace with your actual YouTube API key
const exploreGrid = document.getElementById('explore-grid');
const QUALITY_DURATION_MIN = 180;
const QUALITY_DURATION_MAX = 900;
let nextPageToken = '';
let displayedVideoIds = new Set();

export function resetVideoState() {
    displayedVideoIds.clear();
    nextPageToken = '';
}

export async function fetchVideos(query, append = false) {
    try {
        const url = new URL('https://www.googleapis.com/youtube/v3/search');
        url.searchParams.set('part', 'snippet');
        url.searchParams.set('maxResults', '25');
        url.searchParams.set('q', query);
        url.searchParams.set('type', 'video');
        url.searchParams.set('relevanceLanguage', 'en');
        url.searchParams.set('regionCode', 'US');
        url.searchParams.set('order', 'viewCount');
        url.searchParams.set('key', API_KEY);
        if (append && nextPageToken) {
            url.searchParams.set('pageToken', nextPageToken);
        }

        const searchRes = await fetch(url);
        if (!searchRes.ok) {
            const errorText = await searchRes.text();
            console.warn('YouTube API error (silenced):', errorText);
            return; // Skip UI update if failed (e.g., quota exceeded)
        }

        const searchData = await searchRes.json();
        nextPageToken = searchData.nextPageToken || '';
        let videoItems = searchData.items.filter(item => !displayedVideoIds.has(item.id.videoId));

        if (!videoItems.length && nextPageToken) return fetchVideos(query, true);
        if (!videoItems.length) return;

        const ids = videoItems.map(v => v.id.videoId).join(',');
        const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?` +
            new URLSearchParams({
                part: 'contentDetails,snippet,statistics',
                id: ids,
                key: API_KEY
            })
        );

        if (!detailsRes.ok) {
            console.warn('YouTube detail fetch failed (silenced)');
            return;
        }

        const detailsData = await detailsRes.json();
        const detailsMap = Object.fromEntries(detailsData.items.map(item => [
            item.id,
            {
                duration: parseISODuration(item.contentDetails.duration),
                title: item.snippet.title,
                channel: item.snippet.channelTitle,
                views: parseInt(item.statistics.viewCount || '0'),
                description: item.snippet.description || 'No description available'
            }
        ]));

        displayVideos(videoItems, detailsMap);
    } catch (err) {
        console.warn('YouTube fetchVideos() failed silently:', err);
        // Do not modify UI on error
    }
}

function parseISODuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const h = parseInt(match?.[1] || '0'), m = parseInt(match?.[2] || '0'), s = parseInt(match?.[3] || '0');
    return h * 3600 + m * 60 + s;
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = n => n.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function displayVideos(videos, detailsMap) {
    videos
        .filter(video => {
            const d = detailsMap[video.id.videoId];
            return d && d.duration >= QUALITY_DURATION_MIN && d.duration <= QUALITY_DURATION_MAX;
        })
        .slice(0, 8)
        .forEach(video => {
            const rawId = video.id.videoId;
            const id = `yt_${rawId}`;
            if (displayedVideoIds.has(id)) return;
            displayedVideoIds.add(id);

            const detail = detailsMap[rawId];
            const duration = formatDuration(detail.duration);
            const views = detail.views.toLocaleString();
            const isShort = detail.duration <= 60;

            const thumbs = [
                `https://img.youtube.com/vi/${rawId}/maxresdefault.jpg`,
                `https://img.youtube.com/vi/${rawId}/sddefault.jpg`,
                video.snippet.thumbnails?.high?.url
            ];

            let tried = 0;

            const tryThumb = () => {
                const img = new Image();
                img.src = thumbs[tried];
                img.onload = () => {
                    if (img.naturalWidth < 300 && ++tried < thumbs.length) {
                        tryThumb();
                    } else {
                        appendPin(thumbs[tried]);
                    }
                };
                img.onerror = () => {
                    if (++tried < thumbs.length) {
                        tryThumb();
                    } else {
                        appendPin('/images/fallback.jpg');
                    }
                };
            };

            const appendPin = (thumbnailSrc) => {
                const pinData = {
                    id,
                    title: `${detail.title} (${duration})`,
                    description: detail.description,
                    destination: `https://www.youtube.com/watch?v=${rawId}`,
                    img_blob: thumbnailSrc,
                    board_id: null,
                    user_id: 1,
                    username: "YouTube",
                    display_name: "YouTube Video",
                    user_avatar_url: "./images/youtube-icon.png",
                    is_liked: false,
                    like_count: 0,
                    is_short: isShort,
                    extra_info: `${detail.channel} • ${views} views`
                };
                create_pin(pinData);

                const allCards = document.querySelectorAll('.pin_container .pin_card');
                const newCard = allCards[allCards.length - 1];

                if (newCard) {
                    const clone = newCard.cloneNode(true);
                    const img = clone.querySelector('img');
                    if (img) {
                        img.style.width = '100%';
                        img.style.height = 'auto';
                        img.style.maxHeight = '240px';
                        img.style.objectFit = 'cover';
                        img.style.borderRadius = '8px';
                    }
                    exploreGrid.appendChild(clone);
                }
            };

            tryThumb();
        });
}