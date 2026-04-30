/**
 * Decoration System — Placeable map assets for the editor.
 *
 * Each planet has themed decoration assets (trees, crystals, structures, etc.)
 * that can be placed on the map via the editor palette.
 *
 * Architecture:
 *   - AssetDefinition: the template (PNG image, SVG fallback, default size, category)
 *   - PlacedDecoration: an instance on the map (assetId, x%, y%, scale, rotation)
 *   - DecorationManager: CRUD + render
 *
 * Assets are high-quality PNG images generated via xAI Grok (grok-imagine-image-pro).
 * Each asset has an inline SVG fallback for offline/cached use.
 */

// ============================================
// Asset Definitions — High-Quality PNGs per Planet
// ============================================

/**
 * Each asset definition:
 *   id: unique key
 *   name: display name
 *   planet: which planet this asset belongs to
 *   category: grouping for the editor palette
 *   png: path to high-quality PNG image (primary)
 *   svg: inline SVG string as fallback (viewBox 0 0 100 100)
 *   defaultWidth: % of map width
 *   defaultHeight: % of map height
 */
const ASSET_DEFINITIONS = [
    // ========================================
    // VOXYA — Shadow / Void / Gothic
    // ========================================
    {
        id: 'voxya-dead-tree-1',
        name: 'Dead Tree',
        planet: 'voxya', category: 'trees',
        defaultWidth: 3, defaultHeight: 4,
        png: 'assets/decorations/voxya-dead-tree-1.png',
        svg: `<g><rect x="46" y="60" width="8" height="40" rx="2" fill="#2a1a2e"/><path d="M50 60 L20 15 M50 58 L15 20 M50 55 L35 5 M50 60 L65 12 M50 57 L80 18 M50 55 L85 8" stroke="#3a2040" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="50" cy="50" r="2" fill="#7c3aed" opacity="0.3"/></g>`
    },
    {
        id: 'voxya-dead-tree-2',
        name: 'Twisted Oak',
        planet: 'voxya', category: 'trees',
        defaultWidth: 4, defaultHeight: 5,
        png: 'assets/decorations/voxya-dead-tree-2.png',
        svg: `<g><rect x="44" y="55" width="12" height="45" rx="3" fill="#1a1020"/><path d="M50 55 L15 10 Q25 5 20 0 M50 55 L30 8 M50 55 L55 5 M50 55 L75 15 Q85 10 90 2 M50 55 L80 20" stroke="#2a1530" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="50" cy="50" r="1.5" fill="#a78bfa" opacity="0.2"/></g>`
    },
    {
        id: 'voxya-obsidian-spire',
        name: 'Obsidian Spire',
        planet: 'voxya', category: 'crystals',
        defaultWidth: 2, defaultHeight: 6,
        png: 'assets/decorations/voxya-obsidian-spire.png',
        svg: `<g><polygon points="50,5 40,30 45,50 40,80 44,95 50,98 56,95 60,80 55,50 60,30" fill="#1a0a20" stroke="#3a1550" stroke-width="2"/><polygon points="50,10 43,35 47,50 43,75 50,90 57,75 53,50 57,35" fill="#2a1040" opacity="0.5"/><circle cx="50" cy="15" r="2" fill="#7c3aed" opacity="0.6"/></g>`
    },
    {
        id: 'voxya-dark-crystals',
        name: 'Dark Crystal Cluster',
        planet: 'voxya', category: 'crystals',
        defaultWidth: 3, defaultHeight: 4,
        png: 'assets/decorations/voxya-dark-crystals.png',
        svg: `<g><polygon points="35,90 38,60 40,50 42,60 45,90" fill="#1a0a20" stroke="#3a1550" stroke-width="1.5"/><polygon points="50,95 47,55 50,35 53,55 50,95" fill="#15081a" stroke="#3a1550" stroke-width="1.5"/><polygon points="62,92 59,65 65,48 70,65 66,92" fill="#1a0a20" stroke="#3a1550" stroke-width="1.5"/><circle cx="50" cy="40" r="1.5" fill="#7c3aed" opacity="0.8"/><circle cx="40" cy="55" r="1" fill="#a78bfa" opacity="0.4"/><circle cx="65" cy="52" r="1" fill="#a78bfa" opacity="0.3"/></g>`
    },
    {
        id: 'voxya-ruined-pillar',
        name: 'Ruined Pillar',
        planet: 'voxya', category: 'ruins',
        defaultWidth: 2, defaultHeight: 5,
        png: 'assets/decorations/voxya-ruined-pillar.png',
        svg: `<g><rect x="42" y="30" width="16" height="70" rx="1" fill="#1a1025" stroke="#2a1540" stroke-width="1"/><rect x="44" y="35" width="12" height="5" fill="#2a1540" opacity="0.5"/><rect x="44" y="50" width="12" height="5" fill="#2a1540" opacity="0.5"/><rect x="38" y="25" width="24" height="8" rx="2" fill="#1a1525" stroke="#3a1550" stroke-width="1"/><circle cx="50" cy="20" r="3" fill="#7c3aed" opacity="0.15"/></g>`
    },
    {
        id: 'voxya-broken-bridge',
        name: 'Broken Bridge',
        planet: 'voxya', category: 'structures',
        defaultWidth: 6, defaultHeight: 3,
        png: 'assets/decorations/voxya-broken-bridge.png',
        svg: `<g><rect x="5" y="45" width="40" height="6" rx="2" fill="#1a1025" stroke="#2a1540" stroke-width="1"/><rect x="50" y="45" width="30" height="6" rx="2" fill="#1a1025" stroke="#2a1540" stroke-width="1"/><line x1="45" y1="45" x2="50" y2="42" stroke="#2a1540" stroke-width="2"/><rect x="15" y="38" width="3" height="15" fill="#1a1025"/><rect x="75" y="38" width="3" height="15" fill="#1a1025"/><circle cx="50" cy="48" r="1.5" fill="#7c3aed" opacity="0.3"/></g>`
    },
    {
        id: 'voxya-lantern-post',
        name: 'Lantern Post',
        planet: 'voxya', category: 'structures',
        defaultWidth: 1.5, defaultHeight: 4,
        png: 'assets/decorations/voxya-lantern-post.png',
        svg: `<g><rect x="47" y="40" width="6" height="60" fill="#1a1025"/><rect x="44" y="35" width="12" height="12" rx="3" fill="#2a1540" stroke="#7c3aed" stroke-width="1.5"/><circle cx="50" cy="41" r="3" fill="#7c3aed" opacity="0.8"/><rect x="42" y="32" width="16" height="4" rx="2" fill="#1a1025"/></g>`
    },
    {
        id: 'voxya-gravestone',
        name: 'Gravestone',
        planet: 'voxya', category: 'ruins',
        defaultWidth: 2, defaultHeight: 3,
        png: 'assets/decorations/voxya-gravestone.png',
        svg: `<g><path d="M40,95 C40,50 38,40 35,30 L40,20 L60,20 L65,30 C62,40 60,50 60,95 Z" fill="#1a1025" stroke="#2a1540" stroke-width="1.5"/><rect x="42" y="25" width="16" height="3" fill="#2a1540"/><circle cx="50" cy="55" r="1" fill="#7c3aed" opacity="0.3"/></g>`
    },

    // ========================================
    // ORILYTH — Crystal / Energy / Data
    // ========================================
    {
        id: 'orilyth-blue-crystal-1',
        name: 'Azure Crystal',
        planet: 'orilyth', category: 'crystals',
        defaultWidth: 2, defaultHeight: 5,
        png: 'assets/decorations/orilyth-blue-crystal-1.png',
        svg: `<g><polygon points="50,5 35,40 40,65 50,95 60,65 65,40" fill="rgba(30,50,100,0.3)" stroke="#3b82f6" stroke-width="2"/><polygon points="50,12 39,42 43,62 50,88 57,62 61,42" fill="rgba(59,130,246,0.15)"/><line x1="50" y1="12" x2="35" y2="40" stroke="#60a5fa" stroke-width="0.5" opacity="0.5"/><line x1="50" y1="12" x2="65" y2="40" stroke="#60a5fa" stroke-width="0.5" opacity="0.5"/><circle cx="50" cy="18" r="2" fill="#93c5fd" opacity="0.9"/></g>`
    },
    {
        id: 'orilyth-crystal-cluster',
        name: 'Crystal Cluster',
        planet: 'orilyth', category: 'crystals',
        defaultWidth: 4, defaultHeight: 4,
        png: 'assets/decorations/orilyth-crystal-cluster.png',
        svg: `<g><polygon points="30,85 33,50 35,35 37,50 40,85" fill="rgba(30,50,100,0.25)" stroke="#3b82f6" stroke-width="1.5"/><polygon points="50,90 46,45 50,20 54,45 50,90" fill="rgba(30,60,120,0.3)" stroke="#3b82f6" stroke-width="1.5"/><polygon points="65,88 62,55 68,40 73,55 68,88" fill="rgba(30,50,100,0.2)" stroke="#3b82f6" stroke-width="1.5"/><circle cx="50" cy="28" r="2" fill="#93c5fd" opacity="0.8"/><circle cx="35" cy="42" r="1" fill="#60a5fa" opacity="0.5"/><circle cx="68" cy="45" r="1" fill="#60a5fa" opacity="0.4"/></g>`
    },
    {
        id: 'orilyth-data-spire',
        name: 'Data Spire',
        planet: 'orilyth', category: 'structures',
        defaultWidth: 2, defaultHeight: 7,
        png: 'assets/decorations/orilyth-data-spire.png',
        svg: `<g><rect x="44" y="10" width="12" height="90" rx="2" fill="rgba(20,40,80,0.3)" stroke="#3b82f6" stroke-width="1.5"/><rect x="46" y="15" width="8" height="6" fill="#3b82f6" opacity="0.3"/><rect x="46" y="30" width="8" height="6" fill="#3b82f6" opacity="0.2"/><rect x="46" y="45" width="8" height="6" fill="#3b82f6" opacity="0.3"/><rect x="46" y="60" width="8" height="6" fill="#3b82f6" opacity="0.2"/><circle cx="50" cy="8" r="4" fill="#60a5fa" opacity="0.7"/><line x1="50" y1="8" x2="50" y2="2" stroke="#93c5fd" stroke-width="1" opacity="0.5"/></g>`
    },
    {
        id: 'orilyth-floating-platform',
        name: 'Floating Platform',
        planet: 'orilyth', category: 'structures',
        defaultWidth: 4, defaultHeight: 3,
        png: 'assets/decorations/orilyth-floating-platform.png',
        svg: `<g><rect x="20" y="40" width="60" height="8" rx="3" fill="rgba(20,40,100,0.3)" stroke="#3b82f6" stroke-width="1.5"/><rect x="25" y="42" width="50" height="4" fill="#3b82f6" opacity="0.1"/><circle cx="25" cy="44" r="1.5" fill="#93c5fd" opacity="0.6"/><circle cx="75" cy="44" r="1.5" fill="#93c5fd" opacity="0.6"/><ellipse cx="50" cy="55" rx="15" ry="3" fill="#3b82f6" opacity="0.08"/></g>`
    },
    {
        id: 'orilyth-lightning-rod',
        name: 'Lightning Rod',
        planet: 'orilyth', category: 'energy',
        defaultWidth: 1.5, defaultHeight: 6,
        png: 'assets/decorations/orilyth-lightning-rod.png',
        svg: `<g><rect x="46" y="40" width="8" height="60" fill="rgba(30,50,100,0.3)"/><circle cx="50" cy="35" r="8" fill="none" stroke="#3b82f6" stroke-width="2"/><circle cx="50" cy="35" r="4" fill="#3b82f6" opacity="0.3"/><line x1="50" y1="27" x2="50" y2="5" stroke="#60a5fa" stroke-width="1.5" opacity="0.7"/><path d="M50 5 L45 15 L48 15 L44 25" stroke="#93c5fd" stroke-width="1" fill="none"/></g>`
    },
    {
        id: 'orilyth-energy-node',
        name: 'Energy Node',
        planet: 'orilyth', category: 'energy',
        defaultWidth: 2, defaultHeight: 2,
        png: 'assets/decorations/orilyth-energy-node.png',
        svg: `<g><circle cx="50" cy="50" r="12" fill="none" stroke="#3b82f6" stroke-width="2"/><circle cx="50" cy="50" r="7" fill="rgba(59,130,246,0.2)" stroke="#60a5fa" stroke-width="1.5"/><circle cx="50" cy="50" r="3" fill="#93c5fd" opacity="0.9"/><line x1="50" y1="38" x2="50" y2="30" stroke="#3b82f6" stroke-width="1" opacity="0.5"/><line x1="50" y1="62" x2="50" y2="70" stroke="#3b82f6" stroke-width="1" opacity="0.5"/><line x1="38" y1="50" x2="30" y2="50" stroke="#3b82f6" stroke-width="1" opacity="0.5"/><line x1="62" y1="50" x2="70" y2="50" stroke="#3b82f6" stroke-width="1" opacity="0.5"/></g>`
    },

    // ========================================
    // KORVESS — Jungle / Mutation / Flora
    // ========================================
    {
        id: 'korvess-jungle-tree-1',
        name: 'Jungle Canopy Tree',
        planet: 'korvess', category: 'trees',
        defaultWidth: 5, defaultHeight: 6,
        png: 'assets/decorations/korvess-jungle-tree-1.png',
        svg: `<g><rect x="46" y="50" width="8" height="50" rx="2" fill="#1a3020"/><circle cx="50" cy="25" r="22" fill="rgba(16,185,129,0.2)" stroke="#10b981" stroke-width="2"/><circle cx="35" cy="35" r="15" fill="rgba(16,185,129,0.18)" stroke="#10b981" stroke-width="1.5"/><circle cx="62" cy="30" r="18" fill="rgba(16,185,129,0.22)" stroke="#10b981" stroke-width="1.5"/><circle cx="50" cy="18" r="12" fill="rgba(52,211,153,0.15)" stroke="#34d399" stroke-width="1"/></g>`
    },
    {
        id: 'korvess-vine-wall',
        name: 'Vine Wall',
        planet: 'korvess', category: 'flora',
        defaultWidth: 4, defaultHeight: 5,
        png: 'assets/decorations/korvess-vine-wall.png',
        svg: `<g><path d="M20 95 Q30 60 25 30 M30 95 Q38 55 35 20 M40 95 Q42 60 45 25 M50 95 Q50 55 50 15 M60 95 Q58 60 55 25 M70 95 Q65 55 68 20 M80 95 Q75 60 78 30" stroke="#10b981" stroke-width="3" fill="none"/><ellipse cx="35" cy="40" rx="8" ry="5" fill="rgba(16,185,129,0.2)"/><ellipse cx="55" cy="35" rx="7" ry="4" fill="rgba(16,185,129,0.18)"/><ellipse cx="70" cy="42" rx="9" ry="5" fill="rgba(16,185,129,0.22)"/></g>`
    },
    {
        id: 'korvess-giant-mushroom',
        name: 'Giant Mushroom',
        planet: 'korvess', category: 'flora',
        defaultWidth: 3, defaultHeight: 5,
        png: 'assets/decorations/korvess-giant-mushroom.png',
        svg: `<g><rect x="46" y="55" width="8" height="40" rx="2" fill="#1a3020"/><ellipse cx="50" cy="40" rx="22" ry="14" fill="rgba(16,185,129,0.2)" stroke="#10b981" stroke-width="1.5"/><ellipse cx="50" cy="38" rx="16" ry="9" fill="rgba(52,211,153,0.1)" stroke="#34d399" stroke-width="1"/><circle cx="42" cy="38" r="2" fill="#10b981" opacity="0.3"/><circle cx="55" cy="35" r="1.5" fill="#10b981" opacity="0.25"/></g>`
    },
    {
        id: 'korvess-carnivorous-plant',
        name: 'Carnivorous Plant',
        planet: 'korvess', category: 'flora',
        defaultWidth: 3, defaultHeight: 4,
        png: 'assets/decorations/korvess-carnivorous-plant.png',
        svg: `<g><path d="M50 95 Q45 70 50 50 Q55 70 50 95" fill="#1a3020"/><path d="M35 50 Q50 30 65 50" fill="#0d2010" stroke="#10b981" stroke-width="2"/><path d="M30 50 Q50 25 70 50" fill="rgba(16,185,129,0.15)" stroke="#10b981" stroke-width="1.5"/><circle cx="38" cy="42" r="2" fill="#ef4444" opacity="0.4"/><circle cx="50" cy="38" r="2.5" fill="#ef4444" opacity="0.5"/><circle cx="62" cy="42" r="2" fill="#ef4444" opacity="0.4"/></g>`
    },
    {
        id: 'korvess-ancient-root',
        name: 'Ancient Root',
        planet: 'korvess', category: 'structures',
        defaultWidth: 5, defaultHeight: 3,
        png: 'assets/decorations/korvess-ancient-root.png',
        svg: `<g><path d="M5 65 Q25 40 50 55 Q70 65 95 50" stroke="#1a3020" stroke-width="12" fill="none"/><path d="M5 65 Q25 40 50 55 Q70 65 95 50" stroke="#10b981" stroke-width="3" fill="none" opacity="0.3"/><path d="M15 60 Q35 45 55 58" stroke="#34d399" stroke-width="1" fill="none" opacity="0.2"/><circle cx="50" cy="57" r="1.5" fill="#10b981" opacity="0.4"/></g>`
    },
    {
        id: 'korvess-spore-cluster',
        name: 'Spore Cluster',
        planet: 'korvess', category: 'flora',
        defaultWidth: 3, defaultHeight: 3,
        png: 'assets/decorations/korvess-spore-cluster.png',
        svg: `<g><circle cx="50" cy="55" r="15" fill="rgba(16,185,129,0.08)" stroke="#10b981" stroke-width="1" opacity="0.5"/><circle cx="40" cy="50" r="5" fill="rgba(52,211,153,0.3)" stroke="#34d399" stroke-width="1"/><circle cx="55" cy="45" r="4" fill="rgba(16,185,129,0.25)" stroke="#10b981" stroke-width="1"/><circle cx="48" cy="58" r="6" fill="rgba(16,185,129,0.2)" stroke="#10b981" stroke-width="1"/><circle cx="60" cy="52" r="3.5" fill="rgba(52,211,153,0.3)" stroke="#34d399" stroke-width="1"/></g>`
    },

    // ========================================
    // SANGUIS — Volcanic / Spirit / Fire
    // ========================================
    {
        id: 'sanguis-magma-crack',
        name: 'Magma Crack',
        planet: 'sanguis', category: 'lava',
        defaultWidth: 4, defaultHeight: 2,
        png: 'assets/decorations/sanguis-magma-crack.png',
        svg: `<g><path d="M10 50 Q25 42 40 52 Q55 60 70 48 Q82 40 90 50" stroke="#1a0808" stroke-width="4" fill="none"/><path d="M10 50 Q25 42 40 52 Q55 60 70 48 Q82 40 90 50" stroke="#ef4444" stroke-width="2" fill="none" opacity="0.6"/><path d="M15 50 Q30 45 42 53 Q55 58 68 48" stroke="#f97316" stroke-width="1" fill="none" opacity="0.4"/><circle cx="30" cy="48" r="1.5" fill="#fbbf24" opacity="0.7"/><circle cx="60" cy="52" r="1" fill="#f97316" opacity="0.6"/></g>`
    },
    {
        id: 'sanguis-lava-pool',
        name: 'Lava Pool',
        planet: 'sanguis', category: 'lava',
        defaultWidth: 4, defaultHeight: 3,
        png: 'assets/decorations/sanguis-lava-pool.png',
        svg: `<g><ellipse cx="50" cy="55" rx="30" ry="12" fill="rgba(120,20,10,0.25)" stroke="#ef4444" stroke-width="2"/><ellipse cx="50" cy="54" rx="22" ry="8" fill="rgba(239,68,68,0.15)" stroke="#f97316" stroke-width="1.5"/><ellipse cx="48" cy="53" rx="10" ry="4" fill="#f97316" opacity="0.3"/><circle cx="40" cy="54" r="1.5" fill="#fbbf24" opacity="0.6"/><circle cx="55" cy="52" r="1" fill="#fbbf24" opacity="0.5"/></g>`
    },
    {
        id: 'sanguis-flame-brazier',
        name: 'Flame Brazier',
        planet: 'sanguis', category: 'structures',
        defaultWidth: 2, defaultHeight: 4,
        png: 'assets/decorations/sanguis-flame-brazier.png',
        svg: `<g><rect x="44" y="50" width="12" height="50" rx="2" fill="#1a0808"/><rect x="38" y="30" width="24" height="22" rx="4" fill="#1a0808" stroke="#ef4444" stroke-width="1.5"/><path d="M45 28 Q50 10 55 28" fill="#f97316" opacity="0.6"/><path d="M42 28 Q50 5 58 28" fill="rgba(239,68,68,0.2)"/><circle cx="50" cy="15" r="3" fill="#fbbf24" opacity="0.8"/></g>`
    },
    {
        id: 'sanguis-spirit-totem',
        name: 'Spirit Totem',
        planet: 'sanguis', category: 'structures',
        defaultWidth: 2, defaultHeight: 6,
        png: 'assets/decorations/sanguis-spirit-totem.png',
        svg: `<g><rect x="42" y="20" width="16" height="80" rx="2" fill="#1a0808" stroke="#ef4444" stroke-width="1.5"/><rect x="45" y="25" width="10" height="8" fill="#ef4444" opacity="0.3"/><rect x="45" y="40" width="10" height="8" fill="#f97316" opacity="0.3"/><rect x="45" y="55" width="10" height="8" fill="#ef4444" opacity="0.3"/><rect x="45" y="70" width="10" height="8" fill="#f97316" opacity="0.2"/><circle cx="50" cy="15" r="5" fill="#fbbf24" opacity="0.5"/></g>`
    },
    {
        id: 'sanguis-volcanic-rock',
        name: 'Volcanic Rock',
        planet: 'sanguis', category: 'rocks',
        defaultWidth: 3, defaultHeight: 3,
        png: 'assets/decorations/sanguis-volcanic-rock.png',
        svg: `<g><path d="M25 80 L30 50 Q35 40 50 35 Q65 40 70 50 L75 80 Z" fill="#1a0808" stroke="#3a1010" stroke-width="1.5"/><path d="M32 60 Q50 45 68 60" stroke="#ef4444" stroke-width="1" opacity="0.3" fill="none"/><circle cx="50" cy="48" r="1.5" fill="#f97316" opacity="0.15"/></g>`
    },
    {
        id: 'sanguis-ash-tree',
        name: 'Ash Tree',
        planet: 'sanguis', category: 'trees',
        defaultWidth: 3, defaultHeight: 5,
        png: 'assets/decorations/sanguis-ash-tree.png',
        svg: `<g><rect x="46" y="55" width="8" height="45" rx="2" fill="#1a0808"/><path d="M50 55 L25 20 M50 55 L40 10 M50 55 L60 15 M50 55 L75 22" stroke="#2a1010" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="50" cy="50" r="1" fill="#ef4444" opacity="0.15"/></g>`
    },

    // ========================================
    // SILITH-9 — Machine / Tech / Chrome
    // ========================================
    {
        id: 'silith9-relay-station',
        name: 'Relay Station',
        planet: 'silith9', category: 'stations',
        defaultWidth: 4, defaultHeight: 5,
        png: 'assets/decorations/silith9-relay-station.png',
        svg: `<g><rect x="30" y="30" width="40" height="40" rx="3" fill="rgba(40,40,50,0.3)" stroke="#c0c0c0" stroke-width="1.5"/><rect x="35" y="35" width="30" height="30" fill="rgba(192,192,192,0.05)"/><line x1="50" y1="10" x2="50" y2="30" stroke="#c0c0c0" stroke-width="2"/><circle cx="50" cy="8" r="4" fill="none" stroke="#e2e8f0" stroke-width="1.5"/><circle cx="50" cy="8" r="1.5" fill="#e2e8f0" opacity="0.8"/><rect x="42" y="38" width="5" height="5" fill="#c0c0c0" opacity="0.3"/><rect x="52" y="38" width="5" height="5" fill="#c0c0c0" opacity="0.3"/><rect x="42" y="48" width="5" height="5" fill="#c0c0c0" opacity="0.3"/><rect x="52" y="48" width="5" height="5" fill="#c0c0c0" opacity="0.2"/></g>`
    },
    {
        id: 'silith9-satellite-dish',
        name: 'Satellite Dish',
        planet: 'silith9', category: 'stations',
        defaultWidth: 3, defaultHeight: 4,
        png: 'assets/decorations/silith9-satellite-dish.png',
        svg: `<g><rect x="45" y="45" width="10" height="55" fill="rgba(50,50,60,0.3)" stroke="#c0c0c0" stroke-width="1"/><path d="M50 45 Q20 30 15 15 Q55 25 50 45" fill="rgba(192,192,192,0.1)" stroke="#c0c0c0" stroke-width="1.5"/><circle cx="50" cy="45" r="3" fill="#c0c0c0" opacity="0.4"/><line x1="50" y1="42" x2="50" y2="38" stroke="#c0c0c0" stroke-width="1"/><circle cx="50" cy="36" r="2" fill="#e2e8f0" opacity="0.6"/></g>`
    },
    {
        id: 'silith9-power-conduit',
        name: 'Power Conduit',
        planet: 'silith9', category: 'tech',
        defaultWidth: 2, defaultHeight: 5,
        png: 'assets/decorations/silith9-power-conduit.png',
        svg: `<g><rect x="42" y="20" width="16" height="80" rx="3" fill="rgba(40,40,50,0.3)" stroke="#c0c0c0" stroke-width="1.5"/><line x1="50" y1="25" x2="50" y2="35" stroke="#c0c0c0" stroke-width="2"/><line x1="50" y1="45" x2="50" y2="55" stroke="#c0c0c0" stroke-width="2"/><line x1="50" y1="65" x2="50" y2="75" stroke="#c0c0c0" stroke-width="2"/><circle cx="50" cy="40" r="2" fill="#60a5fa" opacity="0.6"/><circle cx="50" cy="60" r="2" fill="#60a5fa" opacity="0.6"/><circle cx="50" cy="18" r="3" fill="#e2e8f0" opacity="0.3"/></g>`
    },
    {
        id: 'silith9-holo-display',
        name: 'Holo-Display',
        planet: 'silith9', category: 'tech',
        defaultWidth: 3, defaultHeight: 3,
        png: 'assets/decorations/silith9-holo-display.png',
        svg: `<g><rect x="35" y="55" width="30" height="8" rx="2" fill="rgba(40,40,50,0.4)" stroke="#c0c0c0" stroke-width="1"/><ellipse cx="50" cy="40" rx="20" ry="18" fill="rgba(96,165,250,0.06)" stroke="#60a5fa" stroke-width="1.5"/><ellipse cx="50" cy="40" rx="14" ry="12" fill="rgba(96,165,250,0.04)" stroke="#93c5fd" stroke-width="1"/><circle cx="50" cy="40" r="2" fill="#60a5fa" opacity="0.7"/></g>`
    },
    {
        id: 'silith9-chrome-platform',
        name: 'Chrome Platform',
        planet: 'silith9', category: 'structures',
        defaultWidth: 5, defaultHeight: 3,
        png: 'assets/decorations/silith9-chrome-platform.png',
        svg: `<g><rect x="10" y="45" width="80" height="8" rx="2" fill="rgba(50,50,60,0.4)" stroke="#c0c0c0" stroke-width="2"/><rect x="15" y="47" width="70" height="4" fill="rgba(192,192,192,0.08)"/><rect x="20" y="53" width="3" height="20" fill="rgba(50,50,60,0.3)"/><rect x="77" y="53" width="3" height="20" fill="rgba(50,50,60,0.3)"/><circle cx="12" cy="49" r="1" fill="#e2e8f0" opacity="0.4"/><circle cx="88" cy="49" r="1" fill="#e2e8f0" opacity="0.4"/></g>`
    },
    {
        id: 'silith9-grid-node',
        name: 'Grid Node',
        planet: 'silith9', category: 'tech',
        defaultWidth: 2, defaultHeight: 2,
        png: 'assets/decorations/silith9-grid-node.png',
        svg: `<g><rect x="40" y="40" width="20" height="20" rx="1" fill="rgba(40,40,50,0.3)" stroke="#60a5fa" stroke-width="1.5"/><line x1="40" y1="50" x2="25" y2="50" stroke="#60a5fa" stroke-width="1" opacity="0.5"/><line x1="60" y1="50" x2="75" y2="50" stroke="#60a5fa" stroke-width="1" opacity="0.5"/><line x1="50" y1="40" x2="50" y2="25" stroke="#60a5fa" stroke-width="1" opacity="0.5"/><line x1="50" y1="60" x2="50" y2="75" stroke="#60a5fa" stroke-width="1" opacity="0.5"/><circle cx="50" cy="50" r="4" fill="#60a5fa" opacity="0.3"/><circle cx="50" cy="50" r="1.5" fill="#93c5fd" opacity="0.8"/></g>`
    },
    {
        id: 'silith9-defense-turret',
        name: 'Defense Turret',
        planet: 'silith9', category: 'structures',
        defaultWidth: 2, defaultHeight: 3,
        png: 'assets/decorations/silith9-defense-turret.png',
        svg: `<g><rect x="44" y="50" width="12" height="50" rx="2" fill="rgba(40,40,50,0.4)" stroke="#c0c0c0" stroke-width="1"/><rect x="36" y="35" width="28" height="18" rx="4" fill="rgba(40,40,50,0.5)" stroke="#c0c0c0" stroke-width="1.5"/><rect x="48" y="18" width="4" height="17" fill="rgba(40,40,50,0.4)"/><rect x="42" y="12" width="16" height="8" rx="1" fill="rgba(50,50,60,0.5)" stroke="#c0c0c0" stroke-width="1"/><circle cx="50" cy="15" r="2" fill="#ef4444" opacity="0.6"/></g>`
    },

    // ========================================
    // UNIVERSAL — Available on all planets
    // ========================================
    {
        id: 'universal-waypoint-banner',
        name: 'Waypoint Banner',
        planet: 'all', category: 'markers',
        defaultWidth: 2, defaultHeight: 3,
        png: 'assets/decorations/universal-waypoint-banner.png',
        svg: `<g><rect x="46" y="20" width="8" height="80" rx="1" fill="rgba(20,20,30,0.4)"/><rect x="38" y="15" width="24" height="14" rx="2" fill="rgba(30,30,50,0.5)" stroke="#a78bfa" stroke-width="1"/><line x1="50" y1="12" x2="50" y2="5" stroke="#a78bfa" stroke-width="1" opacity="0.5"/></g>`
    },
    {
        id: 'universal-campfire',
        name: 'Campfire',
        planet: 'all', category: 'markers',
        defaultWidth: 2, defaultHeight: 2,
        png: 'assets/decorations/universal-campfire.png',
        svg: `<g><path d="M40 70 L35 55 L38 55 L45 65 L42 50 L45 50 L50 60 L55 50 L58 50 L55 65 L62 55 L65 55 L60 70 Z" fill="#1a1020"/><circle cx="50" cy="50" r="6" fill="#f97316" opacity="0.5"/><circle cx="50" cy="48" r="3" fill="#fbbf24" opacity="0.7"/><path d="M48 45 Q50 35 52 45" stroke="#f97316" stroke-width="1" opacity="0.4" fill="none"/></g>`
    },
    {
        id: 'universal-bridge',
        name: 'Wooden Bridge',
        planet: 'all', category: 'structures',
        defaultWidth: 5, defaultHeight: 2,
        png: 'assets/decorations/universal-bridge.png',
        svg: `<g><rect x="5" y="42" width="90" height="8" rx="1" fill="#2a1a10" stroke="#4a3020" stroke-width="1"/><line x1="15" y1="42" x2="15" y2="55" stroke="#2a1a10" stroke-width="4"/><line x1="85" y1="42" x2="85" y2="55" stroke="#2a1a10" stroke-width="4"/><line x1="30" y1="45" x2="30" y2="50" stroke="#4a3020" stroke-width="1" opacity="0.5"/><line x1="50" y1="45" x2="50" y2="50" stroke="#4a3020" stroke-width="1" opacity="0.5"/><line x1="70" y1="45" x2="70" y2="50" stroke="#4a3020" stroke-width="1" opacity="0.5"/></g>`
    },
    {
        id: 'universal-stairs-up',
        name: 'Stone Stairs',
        planet: 'all', category: 'structures',
        defaultWidth: 3, defaultHeight: 4,
        png: 'assets/decorations/universal-stairs-up.png',
        svg: `<g><rect x="25" y="15" width="50" height="5" fill="#3a3040" stroke="#5a4a60" stroke-width="0.5"/><rect x="28" y="25" width="44" height="5" fill="#3a3040" stroke="#5a4a60" stroke-width="0.5"/><rect x="31" y="35" width="38" height="5" fill="#3a3040" stroke="#5a4a60" stroke-width="0.5"/><rect x="34" y="45" width="32" height="5" fill="#3a3040" stroke="#5a4a60" stroke-width="0.5"/><rect x="37" y="55" width="26" height="5" fill="#3a3040" stroke="#5a4a60" stroke-width="0.5"/><line x1="20" y1="15" x2="20" y2="65" stroke="#3a3040" stroke-width="3"/><line x1="80" y1="15" x2="80" y2="65" stroke="#3a3040" stroke-width="3"/></g>`
    }
];

// ============================================
// Decoration Manager
// ============================================

export class DecorationManager {
    constructor() {
        /** @type {Array<{id:string, assetId:string, x:number, y:number, scale:number, rotation:number}>} */
        this.decorations = [];
    }

    /**
     * Get all asset definitions, optionally filtered by planet.
     */
    static getAssets(planet) {
        if (!planet || planet === 'all') return ASSET_DEFINITIONS;
        return ASSET_DEFINITIONS.filter(a => a.planet === planet || a.planet === 'all');
    }

    /**
     * Get asset categories for a planet.
     */
    static getCategories(planet) {
        const assets = DecorationManager.getAssets(planet);
        const cats = new Set(assets.map(a => a.category));
        return Array.from(cats);
    }

    /**
     * Get a specific asset definition by id.
     */
    static getAsset(assetId) {
        return ASSET_DEFINITIONS.find(a => a.id === assetId) || null;
    }

    /**
     * Place a decoration on the map.
     * @returns {Object} the placed decoration
     */
    placeDecoration(assetId, xPercent, yPercent, scale = 1, rotation = 0) {
        const asset = DecorationManager.getAsset(assetId);
        if (!asset) return null;

        const deco = {
            id: `deco-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            assetId,
            x: xPercent,
            y: yPercent,
            scale: scale || 1,
            rotation: rotation || 0
        };
        this.decorations.push(deco);
        return deco;
    }

    /**
     * Remove a decoration by id.
     */
    removeDecoration(id) {
        const idx = this.decorations.findIndex(d => d.id === id);
        if (idx !== -1) {
            this.decorations.splice(idx, 1);
            return true;
        }
        return false;
    }

    /**
     * Get all decorations.
     */
    getAll() {
        return this.decorations;
    }

    /**
     * Get decorations at a specific position (within tolerance %).
     */
    getAt(x, y, tolerance = 2) {
        return this.decorations.filter(d =>
            Math.abs(d.x - x) < tolerance && Math.abs(d.y - y) < tolerance
        );
    }

    /**
     * Move a decoration to a new position.
     */
    moveDecoration(id, x, y) {
        const deco = this.decorations.find(d => d.id === id);
        if (deco) {
            deco.x = x;
            deco.y = y;
            return true;
        }
        return false;
    }

    /**
     * Update decoration scale/rotation.
     */
    updateDecoration(id, updates) {
        const deco = this.decorations.find(d => d.id === id);
        if (deco) {
            if (updates.scale !== undefined) deco.scale = updates.scale;
            if (updates.rotation !== undefined) deco.rotation = updates.rotation;
            return true;
        }
        return false;
    }

    /**
     * Export all decorations to JSON.
     */
    exportToJSON() {
        return this.decorations.map(d => ({ ...d }));
    }

    /**
     * Import decorations from JSON.
     */
    importFromJSON(data) {
        if (!Array.isArray(data)) return false;
        this.decorations = data.map(d => ({ ...d }));
        return true;
    }

    /**
     * Clear all decorations.
     */
    clear() {
        this.decorations = [];
    }
}

export { ASSET_DEFINITIONS };
