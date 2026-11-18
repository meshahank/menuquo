import React, { useEffect } from 'react'
import './index.css'
import { supabase, supabaseReady } from './lib/supabase'

// jQuery-like helper
const $ = (s) => document.querySelector(s)

// Signed-in user (null when logged out)
let user = null
let bootDone = false

// Owner workspace state (loaded from Supabase once signed in)
const EMPTY = {
  restaurant: { id: null, name: 'My Restaurant', slug: '', currency: '₹', hero: '' },
  menu: [],
}
let state = JSON.parse(JSON.stringify(EMPTY))

// Public menu state (fetched per slug)
let publicData = null
let publicSlug = null
let publicLoading = false

const go = (v) => {
  location.hash = v
  view = v
  render()
  scrollTo(0, 0)
}

const toast = (t) => {
  const e = document.createElement('div')
  e.className = 'toast'
  e.textContent = t
  document.body.append(e)
  setTimeout(() => e.remove(), 2600)
}

const money = (x) => state.restaurant.currency + Number(x).toLocaleString('en-IN')

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

let ownerLoadPromise = null
const loadOwnerData = async () => {
  if (ownerLoadPromise) return ownerLoadPromise
  ownerLoadPromise = (async () => {
    if (!user) return false
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('*')
      .eq('owner', user.id)
      .limit(1)
    const r = restaurants?.[0]
    if (!r) return false
    state.restaurant = {
      id: r.id,
      name: r.name,
      slug: r.slug,
      currency: r.currency,
      hero: r.hero_image || '',
    }
    const [{ data: cats }, { data: items }] = await Promise.all([
      supabase.from('categories').select('*').eq('restaurant_id', r.id).order('position'),
      supabase.from('menu_items').select('*').eq('restaurant_id', r.id).order('position'),
    ])
    state.menu = (cats || []).map((c) => ({
      id: c.id,
      name: c.name,
      items: (items || []).filter((i) => i.category_id === c.id),
    }))
    publicData = null
    publicSlug = null
    publicLoading = false
    return true
  })()
  try {
    return await ownerLoadPromise
  } finally {
    ownerLoadPromise = null
  }
}

const slugify = (s) =>
  String(s).trim().toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// Creates the restaurant from the onboarding form answers
const createRestaurant = async (fields) => {
  const { data, error } = await supabase
    .from('restaurants')
    .insert({ owner: user.id, ...fields })
    .select()
    .single()
  if (error) return { error }
  await supabase.from('categories').insert([
    { restaurant_id: data.id, name: 'Starters', position: 0 },
    { restaurant_id: data.id, name: 'Mains', position: 1 },
  ])
  return { data }
}

// Public menu lives on a real path: /menu/<slug> ('' = show the first restaurant)
const pathMenuSlug = () => {
  const m = location.pathname.match(/^\/menu(?:\/([^/]+))?\/?$/i)
  return m ? decodeURIComponent(m[1] || '') : null
}

const ensurePublicData = async (slug) => {
  if (publicLoading || (publicSlug === slug && publicData)) return
  publicSlug = slug
  publicLoading = true
  publicData = null
  render()
  let query = supabase.from('restaurants').select('*').limit(1)
  if (slug) query = query.eq('slug', slug)
  const { data: rs } = await query
  const r = rs?.[0]
  if (r) {
    const [{ data: cats }, { data: items }] = await Promise.all([
      supabase.from('categories').select('*').eq('restaurant_id', r.id).order('position'),
      supabase.from('menu_items').select('*').eq('restaurant_id', r.id).order('position'),
    ])
    publicData = {
      restaurant: r,
      menu: (cats || []).map((c) => ({
        name: c.name,
        items: (items || []).filter((i) => i.category_id === c.id),
      })),
    }
  } else {
    publicData = { notFound: true }
  }
  publicLoading = false
  render()
}

// ---------------------------------------------------------------------------
// Routing / rendering
// ---------------------------------------------------------------------------

let view = location.hash.slice(1) || 'landing'

const render = () => {
  const app = $('#root')
  if (!app) return

  let content
  const menuSlug = pathMenuSlug()
  if (menuSlug !== null) {
    // Guest-facing menu page: a real path (/menu/<id>), not a hash route
    if (supabaseReady) ensurePublicData(menuSlug)
    content = PublicMenu()
  } else if (view.startsWith('dashboard') && !user) {
    content = Login()
  } else if (view.startsWith('dashboard')) {
    // A signed-in user with no restaurant yet goes through onboarding
    content = state.restaurant.id ? Dashboard() : Onboarding()
  } else if (view === 'onboarding') {
    content = Onboarding()
  } else if (view === 'login') {
    content = user ? (state.restaurant.id ? Dashboard() : Onboarding()) : Login()
  } else if (view === 'landing' || view === 'sales') {
    content = Landing()
  } else {
    content = Landing()
  }
  app.innerHTML = content
  bind()
}

const bind = () => {
  document.querySelectorAll('[data-go]').forEach((e) => {
    e.onclick = () => go(e.dataset.go)
  })
  document.querySelectorAll('[data-copy]').forEach((e) => {
    e.onclick = async () => {
      try {
        await navigator.clipboard.writeText(e.dataset.copy)
        toast('Copied to clipboard')
      } catch {
        toast('Copy: ' + e.dataset.copy)
      }
    }
  })
  const google = $('#google-signin')
  if (google)
    google.onclick = async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname },
      })
      if (error) toast('Sign-in failed: ' + error.message)
    }
  const signout = $('#signout')
  if (signout)
    signout.onclick = async () => {
      await supabase.auth.signOut()
      user = null
      state = JSON.parse(JSON.stringify(EMPTY))
      go('landing')
    }
  const onboarding = $('#onboarding-form')
  if (onboarding) {
    const nameInput = onboarding.querySelector('[name=name]')
    const slugInput = onboarding.querySelector('[name=slug]')
    let slugTouched = false
    slugInput.addEventListener('input', () => { slugTouched = true })
    nameInput.addEventListener('input', () => {
      if (!slugTouched) slugInput.value = slugify(nameInput.value)
    })
    onboarding.onsubmit = async (e) => {
      e.preventDefault()
      const d = new FormData(onboarding)
      const submitBtn = onboarding.querySelector('button')
      submitBtn.disabled = true
      const { error } = await createRestaurant({
        name: d.get('name'),
        slug: slugify(d.get('slug')),
        currency: d.get('currency'),
        hero_image: d.get('hero') || null,
      })
      submitBtn.disabled = false
      if (error) {
        toast(
          error.code === '23505'
            ? 'That menu ID is already taken — try another.'
            : 'Could not create restaurant: ' + error.message
        )
        return
      }
      toast('Restaurant created')
      await loadOwnerData()
      go('dashboard/overview')
    }
  }
  const settings = $('#settings-form')
  if (settings)
    settings.onsubmit = async (e) => {
      e.preventDefault()
      const d = new FormData(settings)
      const { error } = await supabase
        .from('restaurants')
        .update({
          name: d.get('name'),
          slug: slugify(d.get('slug')),
          currency: d.get('currency'),
          hero_image: d.get('hero') || null,
        })
        .eq('id', state.restaurant.id)
      if (error) {
        toast('Save failed: ' + error.message)
        return
      }
      toast('Restaurant settings saved')
      await loadOwnerData()
      render()
    }
  const add = $('#add-item-form')
  if (add)
    add.onsubmit = async (e) => {
      e.preventDefault()
      const d = new FormData(add)
      const { error } = await supabase
        .from('menu_items')
        .insert({
          restaurant_id: state.restaurant.id,
          category_id: d.get('category'),
          name: d.get('name'),
          price: d.get('price') || 0,
          description: d.get('description'),
          image_url: d.get('image') || null,
          available: true,
        })
      if (error) {
        toast('Could not add item: ' + error.message)
        return
      }
      toast('Menu item added')
      await loadOwnerData()
      render()
    }
  const newItem = $('#new-item')
  if (newItem) newItem.onclick = () => $('#item-form').classList.remove('hide')
  const close = $('#close-item')
  if (close) close.onclick = () => $('#item-form').classList.add('hide')
  document.querySelectorAll('[data-toggle]').forEach((b) => {
    b.onclick = async () => {
      const item = state.menu.flatMap((c) => c.items).find((i) => i.id === b.dataset.toggle)
      if (!item) return
      const { error } = await supabase
        .from('menu_items')
        .update({ available: !item.available })
        .eq('id', item.id)
      if (error) {
        toast('Update failed: ' + error.message)
        return
      }
      await loadOwnerData()
      render()
    }
  })
}

// ---------------------------------------------------------------------------
// Page components
// ---------------------------------------------------------------------------

const Landing = () => `
  <div class="shell">
    <header class="topbar">
      <a class="brand" href="#landing">
        <span class="brand-mark">m</span>menuquo
      </a>
      <nav class="nav">
        <a href="#landing">Product</a>
        <a href="#sales">For restaurants</a>
        <a href="#login">Log in</a>
        <button class="btn" data-go="login">Start free</button>
      </nav>
    </header>
    <main>
      <section class="hero">
        <span class="eyebrow"><i></i> Built for independent restaurants</span>
        <h1>A menu worth <em>scanning.</em></h1>
        <p>
          Menuquo turns your restaurant menu into a fast, beautiful QR experience—so you can update in seconds, not reprint for weeks.
        </p>
        <div class="hero-actions">
          <button class="btn dark" data-go="login">Create your menu →</button>
          <a class="btn ghost" href="/menu">See a live menu</a>
        </div>
      </section>
      <section class="product-shot">
        <div class="browser">
          <div class="browser-top">
            <i class="dot"></i>
            <i class="dot"></i>
            <i class="dot"></i>
            <span class="address"></span>
          </div>
          <div class="shot-body">
            <aside class="shot-side">
              <b>menuquo</b>
              <span>▦ Overview</span>
              <span>☰ Menu editor</span>
              <span>⌘ QR codes</span>
              <span>⚙ Settings</span>
            </aside>
            <div class="shot-main">
              <h3>Good morning, Saffron Table</h3>
              <p>Here's what your menu is doing today.</p>
              <div class="metrics">
                <div class="metric">
                  <span>Menu scans</span>
                  <strong>128</strong>
                </div>
                <div class="metric">
                  <span>Today</span>
                  <strong>24</strong>
                </div>
                <div class="metric">
                  <span>Live items</span>
                  <strong>4</strong>
                </div>
              </div>
              <div class="chart">
                ${[35, 62, 48, 82, 69, 95, 58, 79, 100, 73, 88, 55]
                  .map(
                    (x) => `<i class="bar" style="height:${x}%"></i>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section class="section">
        <div class="section-head">
          <span class="eyebrow">Less printing. More hospitality.</span>
          <h2>Everything your menu needs. Nothing it doesn't.</h2>
          <p>
            A focused set of tools for restaurant owners who want a polished digital menu without a complicated system.
          </p>
        </div>
        <div class="cards">
          ${[
            {
              icon: '✦',
              title: 'Instant updates',
              desc:
                'Change a price or add a dish in seconds and it instantly appears on every guest\'s phone.',
            },
            {
              icon: '✦',
              title: 'QR codes',
              desc:
                'Generate a QR code for your menu and print it on tables or share digitally.',
            },
            {
              icon: '✦',
              title: 'No contracts',
              desc:
                'Pay once and own your menu forever — no monthly fees or hidden charges.',
            },
          ]
            .map(
              (c) => `
            <article class="card icon-yellow">
              <span class="icon-box">${c.icon}</span>
              <h3>${c.title}</h3>
              <p>${c.desc}</p>
            </article>`
            )
            .join('')}
        </div>
      </section>
    </main>
  </div>
`

const Login = () => `
  <main class="auth-wrap">
    <section class="auth">
      <a class="brand" href="/">
        <span class="brand-mark">m</span>menuquo
      </a>
      <h1>Welcome back.</h1>
      <p>Sign in to manage your digital menu.</p>
      <button class="btn dark" id="google-signin" style="width:100%;justify-content:center">
        Continue with Google →
      </button>
      <p class="hint">Your Google account is how you claim your restaurant.</p>
    </section>
  </main>
`

const Onboarding = () => `
  <main class="auth-wrap">
    <section class="auth">
      <a class="brand" href="/">
        <span class="brand-mark">m</span>menuquo
      </a>
      <h1>Set up your restaurant.</h1>
      <p>One quick step — these details create your public menu page.</p>
      <form id="onboarding-form">
        <label class="field">Restaurant name
          <input name="name" required placeholder="Saffron Table" />
        </label>
        <label class="field">Menu ID
          <input name="slug" required placeholder="saffron-table" />
          <small style="color:var(--muted)">Guests see your menu at /menu/&lt;menu-id&gt; — lowercase letters, numbers and dashes.</small>
        </label>
        <label class="field">Currency
          <select name="currency">
            <option>₹</option>
            <option>$</option>
            <option>£</option>
          </select>
        </label>
        <label class="field">Hero image URL (optional)
          <input name="hero" type="url" placeholder="https://..." />
        </label>
        <button class="btn dark" style="width:100%;justify-content:center">Create my menu →</button>
      </form>
    </section>
  </main>
`

const Nav = (activePage) => `
  <aside class="sidebar">
    <a class="brand" href="#dashboard/overview">
      <span class="brand-mark">m</span>menuquo
    </a>
    <nav class="side-nav">
      ${[
        ['overview', '▦ Overview'],
        ['menu', '☰ Menu editor'],
        ['qr', '⌘ QR codes'],
        ['settings', '⚙ Settings'],
      ]
        .map(
          (x) =>
            `<button class="${activePage === x[0] ? 'active' : ''}" data-go="dashboard/${x[0]}">${x[1]}</button>`
        )
        .join('')}
    </nav>
    <div class="sidebar-foot">
      ${user ? `<small style="display:block;margin-bottom:8px;color:var(--muted)">${user.email || ''}</small>` : ''}
      ${user ? `<button class="btn ghost" id="signout">Sign out</button>` : ''}
      <button class="btn ghost" data-go="landing">← Back to site</button>
    </div>
  </aside>
`

const Dashboard = () => {
  const page = view.split('/')[1] || 'overview'
  return `
    <div class="app-layout">
      ${Nav(page)}
      <main class="app-main">
        <header class="app-header">
          ${{
            overview: 'Overview',
            menu: 'Menu editor',
            qr: 'QR code studio',
            settings: 'Restaurant settings',
          }[page]}
        </header>
        <div class="content">
          ${page === 'overview' ? Overview() : page === 'menu' ? Editor() : page === 'qr' ? QRCode() : Settings()}
        </div>
      </main>
    </div>
  `
}

const Overview = () => `
  <section class="greeting">
    <h2>Good morning.</h2>
    <p>Your QR menu is live and ready for guests.</p>
  </section>
  <section class="stat-grid">
    <article class="stat-card">
      <small>Restaurant</small>
      <strong style="font-size:22px">${state.restaurant.name}</strong>
      <span class="up">Public link: /menu/${state.restaurant.slug || ''}</span>
    </article>
    <article class="stat-card">
      <small>Live menu items</small>
      <strong>${state.menu.reduce((n, c) => n + c.items.length, 0)}</strong>
      <span class="up">All published</span>
    </article>
    <article class="stat-card">
      <small>Categories</small>
      <strong>${state.menu.length}</strong>
      <span class="up">On your menu</span>
    </article>
  </section>
  <section class="panel">
    <div class="panel-head">
      <h2>Quick actions</h2>
    </div>
    <div class="quick">
      <button data-go="dashboard/menu">
        <span>☰</span>
        <b>Edit your menu</b>
        <small>Add, update, or hide items.</small>
      </button>
      <button data-go="dashboard/qr">
        <span>⌘</span>
        <b>Download QR code</b>
        <small>Ready for print or sharing.</small>
      </button>
      <button data-go="dashboard/settings">
        <span>⚙</span>
        <b>Restaurant settings</b>
        <small>Update your public profile.</small>
      </button>
    </div>
  </section>
`

const Editor = () => {
  return `
    <div class="panel-head">
      <div>
        <h2>Your menu</h2>
        <p style="color:var(--muted);margin:5px 0 0">
          A visual menu is easier for guests to browse at the table.
        </p>
      </div>
      <button class="btn" id="new-item">+ Add menu item</button>
    </div>
    ${state.menu.length === 0
      ? `<section class="panel"><p style="color:var(--muted)">No categories yet.</p></section>`
      : state.menu.map((c) =>
      `<section class="category">
        <div class="category-head">
          <h3>${c.name}</h3>
          <small>${c.items.length} items</small>
        </div>
        ${c.items.map((x) => {
          const availClass = x.available ? '' : 'sold'
          return `
          <div class="menu-item">
            <img class="menu-thumb"
              src="${x.image_url || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=200&q=70'}"
              alt=""
            />
            <div>
              <b>${x.name}</b>
              <small>${x.description || ''}</small>
            </div>
            <b>${money(x.price)}</b>
            <span class="available ${availClass}">
              ${x.available ? 'Available' : 'Sold out'}
            </span>
            <button class="icon-btn" data-toggle="${x.id}">↻</button>
          </div>`
        }).join('')}
      </section>`
    ).join('')}
    <section class="panel hide" id="item-form">
      <div class="panel-head">
        <h2>Add a menu item</h2>
        <button class="icon-btn" id="close-item">×</button>
      </div>
      <form id="add-item-form">
        <div class="editor-row">
          <select name="category">
            ${state.menu.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
          <input name="name" required placeholder="Item name" />
          <input name="price" required type="number" placeholder="Price" />
          <textarea name="description" placeholder="Short description"></textarea>
          <label class="field">Image URL<input name="image" type="url" placeholder="https://..." /></label>
          <button class="btn">Add item</button>
        </div>
      </form>
    </section>
  `
}

const QRCode = () => {
  const url = `${location.origin}/menu/${state.restaurant.slug || ''}`
  const img = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(url)}`
  return `
    <div class="qr-layout">
      <section class="qr-box">
        <img src="${img}" alt="QR code" />
        <b>${state.restaurant.name}</b>
        <small>Scan to view the menu</small>
      </section>
      <section class="panel">
        <span class="eyebrow">Your menu link</span>
        <h2 style="margin:14px 0">Ready to print.</h2>
        <p style="color:var(--muted)">
          This QR code takes guests directly to your live menu.
        </p>
        <div class="url-box">${url}</div>
        <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:18px">
          <a class="btn dark" href="${img}" download="menuquo-qr.png">Download PNG</a>
          <button class="btn ghost" data-copy="${url}">Copy link</button>
        </div>
      </section>
    </div>
  `
}

const Settings = () => `
  <section class="panel">
    <h2>Restaurant settings</h2>
    <p style="color:var(--muted)">Information shown to your guests.</p>
    <form id="settings-form">
      <label class="field">Restaurant name
        <input name="name" value="${state.restaurant.name}" required />
      </label>
      <label class="field">Menu ID
        <input name="slug" value="${state.restaurant.slug}" required />
        <small style="color:var(--muted)">Your public menu lives at /menu/&lt;menu-id&gt;</small>
      </label>
      <label class="field">Currency
        <select name="currency">
          <option ${state.restaurant.currency === '₹' ? 'selected' : ''}>₹</option>
          <option>$</option>
          <option>£</option>
        </select>
      </label>
      <label class="field">Hero image URL
        <input name="hero" type="url" value="${state.restaurant.hero}" placeholder="https://..." />
      </label>
      <button class="btn">Save changes</button>
    </form>
  </section>
`

const PublicMenu = () => {
  if (publicData === null) {
    return `
      <main class="preview-page">
        <section class="public-menu">
          <p style="text-align:center;margin:60px;color:var(--muted)">Loading menu…</p>
        </section>
      </main>
    `
  }
  if (publicData.notFound) {
    return `
      <main class="preview-page">
        <section class="public-menu">
          <p style="text-align:center;margin:60px;color:var(--muted)">
            Menu not found. Scan the QR code again or ask the restaurant for their link.
          </p>
        </section>
      </main>
    `
  }
  const r = publicData.restaurant
  return `
    <main class="preview-page">
      <section class="public-menu">
        <header class="public-top">
          <a class="public-brand" href="/">
            <span class="brand-mark">m</span> menuquo
          </a>
          <a class="btn ghost" href="/${user ? '#dashboard/overview' : '#login'}">
            ${user ? 'Owner view' : 'Own your menu'}
          </a>
        </header>
        <section class="menu-hero">
          <img
            src="${r.hero_image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85'}"
            alt=""
          />
          <div class="menu-hero-copy">
            <span>Welcome to</span>
            <h1>${r.name}</h1>
          </div>
        </section>
        <p class="menu-note">
          A little something for every appetite. Please ask our team about allergens and dietary requirements.
        </p>
        ${publicData.menu.map(
          (c) => `
          <section class="public-section">
            <h2>${c.name}</h2>
            ${c.items.map(
              (i) => `
            <article class="public-dish">
              <img
                class="dish-image"
                src="${i.image_url || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=200&q=70'}"
                alt="${i.name}"
              />
              <div>
                <b>${i.name}</b>
                <small>${i.description || ''}</small>
                ${i.tag ? `<span class="dish-tag">${i.tag}</span>` : ''}
                ${!i.available ?
                  '<small style="color:var(--red);font-weight:700">Currently unavailable</small>'
                  : ''
                }
              </div>
              <b class="price">${r.currency}${Number(i.price).toLocaleString('en-IN')}</b>
            </article>`
            ).join('')}
          </section>`
        ).join('')}
        <p style="text-align:center;font-size:12px;margin:25px;color:var(--muted)">
          Powered by Menuquo
        </p>
      </section>
    </main>
  `
}

// Main App component - manages routing via hash and the Supabase session
const App = () => {
  useEffect(() => {
    const onRoute = () => {
      if (pathMenuSlug() !== null) {
        // Public menu path — render it regardless of the hash
        render()
        return
      }
      view = location.hash.slice(1) || (user ? 'dashboard/overview' : 'landing')
      render()
    }

    if (!supabaseReady) {
      // No .env.local configured — run in demo mode (everything is local)
      render()
      return
    }

    const boot = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      user = session?.user || null
      let hasRestaurant = false
      if (user) hasRestaurant = await loadOwnerData()
      if (user && !hasRestaurant) {
        view = 'onboarding'
      } else {
        view = location.hash.slice(1) || (user ? 'dashboard/overview' : 'landing')
      }
      render()
      bootDone = true
    }
    boot()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        user = null
        state = JSON.parse(JSON.stringify(EMPTY))
        view = 'landing'
        render()
      } else if (event === 'SIGNED_IN' && session && !user) {
        // Boot may have already loaded this session — don't load twice
        if (!bootDone) return
        user = session.user
        loadOwnerData().then((hasRestaurant) => {
          if (!hasRestaurant) view = 'onboarding'
          render()
        })
      } else if (event === 'USER_UPDATED' && session) {
        user = session.user
      }
    })

    window.addEventListener('hashchange', onRoute)
    window.addEventListener('popstate', onRoute)
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('hashchange', onRoute)
      window.removeEventListener('popstate', onRoute)
    }
  }, [])

  return null // Rendering is handled via innerHTML in render()
}

export default App
