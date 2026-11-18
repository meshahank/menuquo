import React, { useEffect, useState } from 'react'
import './index.css'

// jQuery-like helper
const $ = (s) => document.querySelector(s)

const initial = {
  restaurant: {
    name: 'Saffron Table',
    slug: 'saffron-table',
    currency: '₹',
    hero: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85',
  },
  scanCount: 128,
  today: 24,
  menu: [
    {
      name: 'Small Plates',
      items: [
        {
          name: 'Crispy Corn Chaat',
          description: 'Sweet corn, lime, chilli, coriander',
          price: '220',
          tag: 'crowd favourite',
          image:
            'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=300&q=80',
          available: true,
        },
        {
          name: 'Charred Paneer',
          description: 'Smoky paneer, mint yoghurt',
          price: '310',
          tag: 'vegetarian',
          image:
            'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=300&q=80',
          available: true,
        },
      ],
    },
    {
      name: 'Mains',
      items: [
        {
          name: 'Butter Chicken',
          description: 'Tomato, kasuri methi, cream',
          price: '420',
          tag: 'house favourite',
          image:
            'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=300&q=80',
          available: true,
        },
        {
          name: 'Vegetable Biryani',
          description: 'Aromatic basmati, seasonal vegetables',
          price: '360',
          tag: 'seasonal',
          image:
            'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=300&q=80',
          available: false,
        },
      ],
    },
  ],
}

let state = JSON.parse(localStorage.getItem('menuquo-demo')) || JSON.parse(JSON.stringify(initial))
let view = location.hash.slice(1) || 'landing'

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
  setTimeout(() => e.remove(), 2200)
}

const money = (x) =>
  state.restaurant.currency + Number(x).toLocaleString('en-IN')

const render = () => {
  const app = $('#root')
  if (!app) return

  let content
  if (view === 'landing' || view === 'sales') {
    content = Landing()
  } else if (view === 'login') {
    content = Login()
  } else if (view.startsWith('dashboard')) {
    content = Dashboard()
  } else if (view === 'public') {
    content = PublicMenu()
  } else {
    content = Landing()
  }
  app.innerHTML = content
  bind()
}

const bind = () => {
  document.querySelectorAll('[data-go]').forEach ((e) => {
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
  const login = $('#login-form')
  if (login) login.onsubmit = (e) => {
    e.preventDefault()
    go('dashboard/overview')
  }
  const settings = $('#settings-form')
  if (settings) settings.onsubmit = (e) => {
    e.preventDefault()
    const d = new FormData(settings)
    setState({
      ...state,
      restaurant: {
        ...state.restaurant,
        name: d.get('name'),
        slug: d.get('slug').replace(/\s+/g, '-'),
        currency: d.get('currency'),
      },
    })
    toast('Restaurant settings saved')
  }
  const add = $('#add-item-form')
  if (add) add.onsubmit = (e) => {
    e.preventDefault()
    const d = new FormData(add)
    setState((prev) => ({
      ...prev,
      menu: prev.menu.map((c, ci) => {
        if (ci === +d.get('category')) {
          return {
            ...c,
            items: [...c.items, {
              name: d.get('name'),
              price: d.get('price'),
              description: d.get('description'),
              image: d.get('image'),
              available: true,
            }],
          }
        }
        return c
      }),
    }))
    toast('Menu item added')
  }
  const newItem = $('#new-item')
  if (newItem) newItem.onclick = () => $('#item-form').classList.remove('hide')
  const close = $('#close-item')
  if (close) close.onclick = () => $('#item-form').classList.add('hide')
  document.querySelectorAll('[data-toggle]').forEach((b) => {
    b.onclick = () => {
      const [c, i] = b.dataset.toggle.split('-')
      state.menu[c].items[i].available = !state.menu[c].items[i].available
      localStorage.setItem('menuquo-demo', JSON.stringify(state))
      render()
    }
  })
  // Handle hashchange
  window.addEventListener('hashchange', () => {
    view = location.hash.slice(1) || 'landing'
    render()
  })
}

// Page components that return HTML strings

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
          <button class="btn ghost" data-go="public">See a live menu</button>
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
      <a class="brand" href="#landing">
        <span class="brand-mark">m</span>menuquo
      </a>
      <h1>Welcome back.</h1>
      <p>Sign in to manage your digital menu.</p>
      <form id="login-form">
        <label class="field">Email
          <input type="email" required value="owner@saffrontable.com" />
        </label>
        <label class="field">Password
          <input type="password" required value="menuquo" />
        </label>
        <button class="btn dark">Continue to dashboard →</button>
      </form>
      <p class="hint">Demo mode — any email and password works.</p>
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
      <small>Total menu scans</small>
      <strong>${state.scanCount}</strong>
      <span class="up">↑ 18% this week</span>
    </article>
    <article class="stat-card">
      <small>Scans today</small>
      <strong>${state.today}</strong>
      <span class="up">↑ 6 since yesterday</span>
    </article>
    <article class="stat-card">
      <small>Live menu items</small>
      <strong>
        ${state.menu.reduce((n, c) => n + c.items.length, 0)}
      </strong>
      <span class="up">All published</span>
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
    ${state.menu.map((c, ci) =>
      `<section class="category">
        <div class="category-head">
          <h3>${c.name}</h3>
          <small>${c.items.length} items</small>
        </div>
        ${c.items.map((x, ii) => {
          const availClass = x.available ? '' : 'sold'
          return `
          <div class="menu-item">
            <img class="menu-thumb"
              src="${x.image || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=200&q=70'}"
              alt=""
            />
            <div>
              <b>${x.name}</b>
              <small>${x.description}</small>
            </div>
            <b>${money(x.price)}</b>
            <span class="available ${availClass}">
              ${x.available ? 'Available' : 'Sold out'}
            </span>
            <button class="icon-btn" data-toggle="${ci}-${ii}">↻</button>
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
            ${state.menu.map((c, i) => `<option value="${i}">${c.name}</option>`).join('')}
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
  const url = `${location.origin}${location.pathname}#public`
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
      <label class="field">Public slug
        <input name="slug" value="${state.restaurant.slug}" required />
      </label>
      <label class="field">Currency
        <select name="currency">
          <option ${state.restaurant.currency === '₹' ? 'selected' : ''}>₹</option>
          <option>$</option>
          <option>£</option>
        </select>
      </label>
      <button class="btn">Save changes</button>
    </form>
  </section>
`

const PublicMenu = () => {
  // Update scan count for demo
  const updatedState = {
    ...state,
    scanCount: state.scanCount + 1,
    today: state.today + 1,
  }
  localStorage.setItem('menuquo-demo', JSON.stringify(updatedState))

  return `
    <main class="preview-page">
      <section class="public-menu">
        <header class="public-top">
          <a class="public-brand" href="#landing">
            <span class="brand-mark">m</span> menuquo
          </a>
          <button class="btn ghost" data-go="dashboard/overview">Owner view</button>
        </header>
        <section class="menu-hero">
          <img
            src="${state.restaurant.hero || initial.restaurant.hero}"
            alt=""
          />
          <div class="menu-hero-copy">
            <span>Welcome to</span>
            <h1>${state.restaurant.name}</h1>
          </div>
        </section>
        <p class="menu-note">
          A little something for every appetite. Please ask our team about allergens and dietary requirements.
        </p>
        ${state.menu.map(
          (c) => `
          <section class="public-section">
            <h2>${c.name}</h2>
            ${c.items.map(
              (i) => `
            <article class="public-dish">
              <img
                class="dish-image"
                src="${i.image || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=200&q=70'}"
                alt="${i.name}"
              />
              <div>
                <b>${i.name}</b>
                <small>${i.description}</small>
                ${i.tag ? `<span class="dish-tag">${i.tag}</span>` : ''}
                ${!i.available ?
                  '<small style="color:var(--red);font-weight:700">Currently unavailable</small>'
                  : ''
                }
              </div>
              <b class="price">${money(i.price)}</b>
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

// Main App component - React component that manages routing via hash
const App = () => {
  // Initialize state from localStorage on mount
  useEffect(() => {
    localStorage.setItem('menuquo-demo', JSON.stringify(state))
  }, [])

  // Watch for hash changes and update view state
  useEffect(() => {
    const handleHashChange = () => {
      view = location.hash.slice(1) || 'landing'
      render()
    }

    // Initial setup
    view = location.hash.slice(1) || 'landing'
    render()

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange)

    // Cleanup
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return null // Rendering is handled via innerHTML in render()
}

export default App