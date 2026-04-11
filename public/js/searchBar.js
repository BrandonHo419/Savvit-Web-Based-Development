import { fetchVideos, resetVideoState } from './apiCalls/youtubeSearch.js';
import { fetchPixabayImages } from './apiCalls/pixabay.js';

window.addEventListener('DOMContentLoaded', () => {
    const searchBar = document.getElementById('search-bar');
    const videoGrid = document.getElementById('explore-grid');
    let lastQuery = '';

    searchBar?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && searchBar.value.trim()) {
            const query = searchBar.value.trim();
            const isSameQuery = query === lastQuery;

            videoGrid.innerHTML = '';         // Clear grid
            resetVideoState();                // Reset YouTube results
            fetchVideos(query, isSameQuery);  // YouTube
            fetchPixabayImages(query, isSameQuery);  // ✅ FIXED

            lastQuery = query;
        }
    });
});