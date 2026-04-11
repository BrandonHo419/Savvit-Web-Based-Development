import { create_pin } from "../boardstuff/modal_and_pin_script.js";
import { handlePinClick } from "../boardstuff/view_modal.js";
import { generateAvatarFallback } from "../boardstuff/userProfile.js";

const exploreGrid = document.getElementById('explore-grid');
const PIXABAY_API_KEY = '50709621-daf631409e28e46ed153b0bd2';

let cachedResults = [];
let lastQuery = '';
let currentBatch = 0;
const BATCH_SIZE = 12;
const MAX_PAGES = 5; // Pixabay limit when using per_page=100

// ---- DISPLAY SLICE ----
function displayPixabayResults(images) {
  const start = currentBatch * BATCH_SIZE;
  const end = start + BATCH_SIZE;
  const slice = images.slice(start, end);

  if (slice.length === 0) {
    exploreGrid.innerHTML += `<p style="color:#777;">No more Pixabay images.</p>`;
    return;
  }

  const avatarURL = "./images/pixabay-icon.png";
  const fallbackInitials = generateAvatarFallback("Pixabay");

  slice.forEach(image => {
    const pinData = {
      id: `pb_${image.id}`,
      title: image.tags || "Pixabay Image",
      description: image.tags,
      destination: image.pageURL,
      img_blob: image.webformatURL,
      board_id: null,
      user_id: 1,
      username: "Pixabay",
      display_name: "Pixabay Image",
      user_avatar_url: avatarURL,
      avatar_fallback: fallbackInitials,
      is_liked: false,
      like_count: 0,
      is_short: false,
      extra_info: `Resolution: ${image.imageWidth}x${image.imageHeight}`
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
        img.style.borderRadius = '8px';
      }

      clone.addEventListener('click', () => handlePinClick(pinData));
      exploreGrid.appendChild(clone);
    }
  });

  currentBatch++;
}

// ---- FETCH & CACHE ----
export async function fetchPixabayImages(query, isSameQuery = false) {
  if (isSameQuery && cachedResults.length > 0) {
    displayPixabayResults(cachedResults);
    return;
  }

  cachedResults = [];
  currentBatch = 0;
  lastQuery = query;

  const perPage = 100;
  let page = 1;
  let allHits = [];

  try {
    while (page <= MAX_PAGES) {
      const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=${perPage}&page=${page}`;
      console.log('Pixabay fetch URL:', url);
      const res = await fetch(url);

      if (res.status === 403) {
        console.error("Pixabay API error: Access denied.");
        exploreGrid.innerHTML += `<p style="color:#e74c3c;">Pixabay rate limit reached or invalid API key.</p>`;
        return;
      }

      if (!res.ok) throw new Error('Pixabay fetch failed');

      const data = await res.json();
      if (data.hits.length === 0) break;

      allHits = allHits.concat(data.hits);
      if (data.hits.length < perPage) break;

      page++;
    }

    cachedResults = allHits;

    if (!cachedResults.length) {
      exploreGrid.innerHTML += `<p style="color:#777;">No Pixabay images found.</p>`;
      return;
    }

    displayPixabayResults(cachedResults);

  } catch (err) {
    console.error('Pixabay error:', err);
    exploreGrid.innerHTML += `<p style="color:#e74c3c;">Failed to load Pixabay images.</p>`;
  }
}

// ----  Load More Button ----
const loadMoreBtn = document.getElementById('loadMorePixabay');
if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => {
    if (lastQuery) {
      fetchPixabayImages(lastQuery, true); // Load more from cache
    }
  });
}
