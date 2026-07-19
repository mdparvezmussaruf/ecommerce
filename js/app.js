const API = '';
let products = [];
let categories = [];
let cart = [];
let activeCategory = 'All';

const $ = id => document.getElementById(id);
const fmt = n => '$' + n.toFixed(2);

// Color palettes for product cards
const palettes = [
    ['#e0e7ff', '#c7d2fe'], ['#fce7f3', '#fbcfe8'],
    ['#d1fae5', '#a7f3d0'], ['#ffedd5', '#fed7aa'],
    ['#e0f2fe', '#bae6fd'], ['#f3e8ff', '#e9d5ff'],
    ['#ecfccb', '#d9f99d'], ['#fee2e2', '#fecaca'],
    ['#dcfce7', '#bbf7d0'], ['#dbeafe', '#bfdbfe']
];
const emojis = ['🎧','⌨️','🖥️','👕','👖','👟','🍶','☕','🧘','🏋️','🔊','📱','🎮','🎒','🕶️'];

async function init() {
    await loadCategories();
    await loadProducts();
    setupEventListeners();
}

async function loadCategories() {
    const res = await fetch(`${API}/api/categories`);
    categories = await res.json();
    renderCategories();
}

async function loadProducts() {
    const url = new URL(`${API}/api/products`, location.origin);
    if (activeCategory !== 'All') url.searchParams.set('category', activeCategory);
    const q = $('searchInput').value.trim();
    if (q) url.searchParams.set('search', q);

    const res = await fetch(url);
    products = await res.json();
    renderProducts();
}

function renderCategories() {
    $('categoryList').innerHTML = ['All', ...categories].map(cat => `
        <button class="category-pill ${cat === activeCategory ? 'active' : ''}" data-cat="${cat}">
            ${cat}
        </button>
    `).join('');

    $('categoryList').querySelectorAll('.category-pill').forEach(btn => {
        btn.onclick = () => {
            activeCategory = btn.dataset.cat;
            renderCategories();
            loadProducts();
        };
    });
}

function renderProducts() {
    $('productGrid').innerHTML = products.map((p, i) => {
        const pal = palettes[i % palettes.length];
        const emo = emojis[i % emojis.length];
        return `
            <article class="product-card" style="--c1:${pal[0]};--c2:${pal[1]}">
                <div class="product-img">${emo}</div>
                <div class="product-info">
                    <h3 class="product-name">${escapeHtml(p.name)}</h3>
                    <div class="product-meta">
                        <span class="product-price">${fmt(p.price)}</span>
                        <button class="add-btn" data-id="${p.id}" aria-label="Add to cart">
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M12 6.09961C12.4971 6.09961 12.9004 6.50294 12.9004 7V11.0996H17C17.4971 11.0996 17.9004 11.5029 17.9004 12C17.9004 12.4971 17.4971 12.9004 17 12.9004H12.9004V17C12.9004 17.4971 12.4971 17.9004 12 17.9004C11.5029 17.9004 11.0996 17.4971 11.0996 17V12.9004H7C6.50294 12.9004 6.09961 12.4971 6.09961 12C6.09961 11.5029 6.50294 11.0996 7 11.0996H11.0996V7C11.0996 6.50294 11.5029 6.09961 12 6.09961Z" fill="currentColor"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    $('productGrid').querySelectorAll('.add-btn').forEach(btn => {
        btn.onclick = () => addToCart(+btn.dataset.id);
    });
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const existing = cart.find(c => c.id === productId);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    updateCartUI();
    showToast('Added to cart');
}

function updateCartUI() {
    const count = cart.reduce((s, c) => s + c.qty, 0);
    $('cartBadge').textContent = count;
    $('cartBadge').style.display = count > 0 ? 'flex' : 'none';

    if (cart.length === 0) {
        $('drawerBody').innerHTML = '<div class="empty-cart">Your cart is empty.</div>';
        $('drawerFooter').style.display = 'none';
        return;
    }
    $('drawerFooter').style.display = 'block';

    $('drawerBody').innerHTML = cart.map((c, i) => {
        const pal = palettes[c.id % palettes.length];
        return `
            <div class="cart-item" style="--c1:${pal[0]};--c2:${pal[1]}">
                <div class="cart-item-img"></div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHtml(c.name)}</div>
                    <div class="cart-item-price">${fmt(c.price)}</div>
                    <div class="qty-row">
                        <button class="qty-btn" data-id="${c.id}" data-d="-1">
                            <svg viewBox="0 0 24 24"><path d="M17 11.0996C17.4971 11.0996 17.9004 11.5029 17.9004 12C17.9004 12.4971 17.4971 12.9004 17 12.9004H7C6.50294 12.9004 6.09961 12.4971 6.09961 12C6.09961 11.5029 6.50294 11.0996 7 11.0996H17Z" fill="currentColor"/></svg>
                        </button>
                        <span class="qty-val">${c.qty}</span>
                        <button class="qty-btn" data-id="${c.id}" data-d="1">
                            <svg viewBox="0 0 24 24"><path d="M12 6.09961C12.4971 6.09961 12.9004 6.50294 12.9004 7V11.0996H17C17.4971 11.0996 17.9004 11.5029 17.9004 12C17.9004 12.4971 17.4971 12.9004 17 12.9004H12.9004V17C12.9004 17.4971 12.4971 17.9004 12 17.9004C11.5029 17.9004 11.0996 17.4971 11.0996 17V12.9004H7C6.50294 12.9004 6.09961 12.4971 6.09961 12C6.09961 11.5029 6.50294 11.0996 7 11.0996H11.0996V7C11.0996 6.50294 11.5029 6.09961 12 6.09961Z" fill="currentColor"/></svg>
                        </button>
                    </div>
                </div>
                <div class="item-remove" data-id="${c.id}">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M8.10001 3C8.10001 2.50294 8.50295 2.1 9.00001 2.1H15C15.4971 2.1 15.9 2.50294 15.9 3C15.9 3.49706 15.4971 3.9 15 3.9H9.00001C8.50295 3.9 8.10001 3.49706 8.10001 3Z" fill="currentColor"/>
                        <path d="M10 15.9C9.50295 15.9 9.10001 15.4971 9.10001 15L9.10001 10C9.10001 9.50294 9.50295 9.1 10 9.1C10.4971 9.1 10.9 9.50294 10.9 10L10.9 15C10.9 15.4971 10.4971 15.9 10 15.9Z" fill="currentColor"/>
                        <path d="M13.1 15C13.1 15.4971 13.5029 15.9 14 15.9C14.4971 15.9 14.9 15.4971 14.9 15L14.9 10C14.9 9.50294 14.4971 9.1 14 9.1C13.5029 9.1 13.1 9.50294 13.1 10V15Z" fill="currentColor"/>
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M2.10001 6C2.10001 5.50294 2.50295 5.1 3.00001 5.1H4.99152C4.99785 5.09993 5.00417 5.09993 5.01048 5.1H18.9895C18.9958 5.09993 19.0021 5.09993 19.0085 5.1H21C21.4971 5.1 21.9 5.50294 21.9 6C21.9 6.49706 21.4971 6.9 21 6.9H19.8281L18.8448 18.6993C18.7412 19.9432 17.7013 20.9 16.4531 20.9H7.54686C6.29865 20.9 5.25881 19.9432 5.15515 18.6993L4.17188 6.9H3.00001C2.50295 6.9 2.10001 6.49706 2.10001 6ZM5.97811 6.9L18.0219 6.9L17.0511 18.5498C17.0251 18.8608 16.7652 19.1 16.4531 19.1H7.54686C7.23481 19.1 6.97485 18.8608 6.94893 18.5498L5.97811 6.9Z" fill="currentColor"/>
                    </svg>
                </div>
            </div>
        `;
    }).join('');

    // Bind quantity buttons
    $('drawerBody').querySelectorAll('.qty-btn').forEach(btn => {
        btn.onclick = () => {
            const id = +btn.dataset.id, delta = +btn.dataset.d;
            const item = cart.find(c => c.id === id);
            if (!item) return;
            item.qty += delta;
            if (item.qty <= 0) cart = cart.filter(c => c.id !== id);
            updateCartUI();
        };
    });

    $('drawerBody').querySelectorAll('.item-remove').forEach(btn => {
        btn.onclick = () => {
            cart = cart.filter(c => c.id !== +btn.dataset.id);
            updateCartUI();
        };
    });

    const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
    $('subtotal').textContent = fmt(subtotal);
    $('grandTotal').textContent = fmt(subtotal + 5);
}

function showToast(msg) {
    $('toast').textContent = msg;
    $('toast').classList.add('show');
    setTimeout(() => $('toast').classList.remove('show'), 2000);
}

function openDrawer() {
    $('drawerOverlay').classList.add('open');
    $('cartDrawer').classList.add('open');
}

function closeDrawer() {
    $('drawerOverlay').classList.remove('open');
    $('cartDrawer').classList.remove('open');
}

function openModal() {
    $('checkoutModal').classList.add('open');
}

function closeModal() {
    $('checkoutModal').classList.remove('open');
}

function setupEventListeners() {
    $('cartBtn').onclick = openDrawer;
    $('closeDrawer').onclick = closeDrawer;
    $('drawerOverlay').onclick = closeDrawer;

    $('searchInput').addEventListener('input', debounce(loadProducts, 300));

    $('checkoutBtn').onclick = () => {
        if (cart.length === 0) return;
        openModal();
    };

    $('cancelCheckout').onclick = closeModal;

    $('checkoutForm').onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            items: cart.map(c => ({ id: c.id, qty: c.qty, price: c.price })),
            shipping_address: $('shipAddress').value
        };

        try {
            const res = await fetch(`${API}/api/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            cart = [];
            updateCartUI();
            closeDrawer();
            closeModal();
            showToast(`Order #${data.order_id} placed!`);
            $('checkoutForm').reset();
        } catch (err) {
            showToast('Checkout failed. Try again.');
        }
    };
}

function debounce(fn, ms) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

init();