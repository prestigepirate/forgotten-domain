/**
 * Base System — Voxya Map Data
 *
 * Manages bases, king bases, and waypoints on the map.
 * Supports both gameplay mode and visual editor mode.
 * Coordinates are percentages (0-100) of map width/height.
 */

export const VOXYA_BASES = [
    {
        id: "voxya-throne",
        name: "Shadow Throne",
        type: "king-base",
        x: 20, y: 32,
        neighbors: ["custom-waypoint-1777298054432"],
        continent: "voxya",
        description: "The seat of power in the Shattered Archipelago. A towering obsidian citadel."
    },
    {
        id: "voxya-hollow",
        name: "Whisper Hollow",
        type: "base",
        x: 59, y: 79,
        neighbors: ["custom-waypoint-1777297378843", "custom-waypoint-1777297514411"],
        continent: "voxya",
        description: "A sunken grove where ancient voices echo through the trees."
    },
    {
        id: "voxya-mist",
        name: "Mistwatch",
        type: "base",
        x: 59, y: 19,
        neighbors: ["custom-waypoint-1777296194510"],
        continent: "voxya",
        description: "A cliffside outpost overlooking the endless sea of mist."
    },
    {
        id: "custom-king-base-1777293131216",
        name: "Stormspire Citadel",
        type: "king-base",
        x: 77, y: 29,
        neighbors: ["custom-waypoint-1777297674596"],
        continent: "voxya",
        description: "A lightning-scarred tower rising from the eastern highlands. Seat of a forgotten king."
    },
    {
        id: "custom-base-1777293142515",
        name: "Ironhollow Keep",
        type: "base",
        x: 65, y: 50,
        neighbors: ["custom-waypoint-1777297518459"],
        continent: "voxya",
        description: "A bastion carved into living rock, its walls humming with old wards."
    },
    {
        id: "custom-base-1777293903926",
        name: "Emberwatch",
        type: "base",
        x: 82, y: 76,
        neighbors: ["custom-waypoint-1777297524644"],
        continent: "voxya",
        description: "A lone watchtower on the southern cliffs, its beacon lit against the dark."
    },
    {
        id: "custom-waypoint-1777293929321",
        name: "Tidewrack Landing",
        type: "waypoint",
        x: 11, y: 70,
        neighbors: ["custom-waypoint-1777295983891"],
        continent: "voxya",
        description: "A weathered pier where wreckage from forgotten wars washes ashore."
    },
    {
        id: "custom-waypoint-1777295603577",
        name: "Marshcross",
        type: "waypoint",
        x: 37, y: 76,
        neighbors: ["custom-waypoint-1777295676609", "custom-waypoint-1777296201393"],
        continent: "voxya",
        description: "A crumbling causeway spanning the reed-choked waters."
    },
    {
        id: "custom-waypoint-1777295676609",
        name: "Fenwatch",
        type: "waypoint",
        x: 24, y: 78,
        neighbors: ["custom-waypoint-1777295603577"],
        continent: "voxya",
        description: "A half-sunk tower watching over the marshes for things that stir below."
    },
    {
        id: "custom-base-1777295817393",
        name: "Gloomforge",
        type: "base",
        x: 53, y: 37,
        neighbors: ["custom-waypoint-1777297760347"],
        continent: "voxya",
        description: "A smoldering foundry where shadow-forged steel is hammered under dying stars."
    },
    {
        id: "custom-base-1777295819441",
        name: "Far Reach Keep",
        type: "base",
        x: 89, y: 54,
        neighbors: ["custom-waypoint-1777297526894"],
        continent: "voxya",
        description: "The easternmost outpost of the archipelago, battered by void-winds."
    },
    {
        id: "custom-base-1777295827091",
        name: "Voidmire Outpost",
        type: "base",
        x: 7, y: 44,
        neighbors: ["custom-waypoint-1777299319526"],
        continent: "voxya",
        description: "A crumbling bastion perched above a lightless bog on the western edge."
    },
    {
        id: "custom-waypoint-1777295848092",
        name: "Bog Lantern",
        type: "waypoint",
        x: 26, y: 78,
        neighbors: ["custom-waypoint-1777296039611"],
        continent: "voxya",
        description: "Pale wisps dance here at dusk, luring the unwary deeper into the fen."
    },
    {
        id: "custom-base-1777295960258",
        name: "Sablewood",
        type: "base",
        x: 16, y: 66,
        neighbors: ["custom-waypoint-1777296039611"],
        continent: "voxya",
        description: "A settlement nestled among black-barked trees that drink the twilight."
    },
    {
        id: "custom-waypoint-1777295983891",
        name: "Saltstone Spire",
        type: "waypoint",
        x: 13, y: 76,
        neighbors: ["custom-waypoint-1777293929321", "custom-waypoint-1777296039611"],
        continent: "voxya",
        description: "A tall sea-stack crowned with old runes, visible for leagues."
    },
    {
        id: "custom-waypoint-1777296039611",
        name: "Crossroads of Whispers",
        type: "waypoint",
        x: 20, y: 73,
        neighbors: ["custom-waypoint-1777296044922", "custom-waypoint-1777295983891", "custom-base-1777295960258", "custom-waypoint-1777295848092"],
        continent: "voxya",
        description: "Four paths meet where the wind carries voices of the long-dead."
    },
    {
        id: "custom-waypoint-1777296044922",
        name: "Raven's Perch",
        type: "waypoint",
        x: 22, y: 63,
        neighbors: ["custom-waypoint-1777296039611", "custom-waypoint-1777297970848"],
        continent: "voxya",
        description: "A jagged outcropping where carrion birds gather in silent congress."
    },
    {
        id: "custom-waypoint-1777296099593",
        name: "Ashfall Notch",
        type: "waypoint",
        x: 34, y: 47,
        neighbors: ["custom-waypoint-1777296103175"],
        continent: "voxya",
        description: "A narrow pass where grey ash drifts endlessly from the burned peaks above."
    },
    {
        id: "custom-waypoint-1777296103175",
        name: "Hollowmere",
        type: "waypoint",
        x: 36, y: 52,
        neighbors: ["custom-waypoint-1777296099593", "custom-waypoint-1777296143911", "custom-waypoint-1777297908697", "custom-waypoint-1777298645018", "custom-waypoint-1777297912181"],
        continent: "voxya",
        description: "A glassy lake in a volcanic crater, its depths said to mirror the void."
    },
    {
        id: "custom-waypoint-1777296143911",
        name: "Wraithwater",
        type: "waypoint",
        x: 43, y: 60,
        neighbors: ["custom-waypoint-1777296103175"],
        continent: "voxya",
        description: "A black pool where reflections show faces other than your own."
    },
    {
        id: "custom-waypoint-1777296194510",
        name: "Windrift",
        type: "waypoint",
        x: 63, y: 24,
        neighbors: ["custom-waypoint-1777297674596", "voxya-mist"],
        continent: "voxya",
        description: "A gap in the cliffs where the east wind sings through broken stone."
    },
    {
        id: "custom-waypoint-1777296201393",
        name: "Tower of Sighs",
        type: "waypoint",
        x: 46, y: 66,
        neighbors: ["custom-waypoint-1777295603577", "custom-waypoint-1777296205327", "custom-waypoint-1777299869063"],
        continent: "voxya",
        description: "A broken tower from which a low moan rises each dusk."
    },
    {
        id: "custom-waypoint-1777296205327",
        name: "Grimwater",
        type: "waypoint",
        x: 53, y: 74,
        neighbors: ["custom-waypoint-1777296201393", "custom-waypoint-1777297392459"],
        continent: "voxya",
        description: "A slow black river that never freezes, even in the deepest cold."
    },
    {
        id: "custom-waypoint-1777297378843",
        name: "Drowned Hearth",
        type: "waypoint",
        x: 53, y: 84,
        neighbors: ["custom-waypoint-1777297392459", "voxya-hollow"],
        continent: "voxya",
        description: "Chimney stacks rise from still water — all that remains of a flooded hamlet."
    },
    {
        id: "custom-waypoint-1777297392459",
        name: "Sunken Bell",
        type: "waypoint",
        x: 50, y: 79,
        neighbors: ["custom-waypoint-1777296205327", "custom-waypoint-1777297378843"],
        continent: "voxya",
        description: "On quiet nights, a drowned bell tolls from somewhere beneath the bog."
    },
    {
        id: "custom-waypoint-1777297514411",
        name: "Rimefang Pass",
        type: "waypoint",
        x: 60, y: 71,
        neighbors: ["custom-waypoint-1777297518459", "voxya-hollow"],
        continent: "voxya",
        description: "Icy winds funnel through this gorge, carrying the breath of distant glaciers."
    },
    {
        id: "custom-waypoint-1777297518459",
        name: "The Gilded Scar",
        type: "waypoint",
        x: 62, y: 61,
        neighbors: ["custom-waypoint-1777297522944", "custom-waypoint-1777297514411", "custom-base-1777293142515", "custom-waypoint-1777297745263"],
        continent: "voxya",
        description: "A canyon wall embedded with fool's gold, glittering in the half-light."
    },
    {
        id: "custom-waypoint-1777297522944",
        name: "Eastgate",
        type: "waypoint",
        x: 68, y: 61,
        neighbors: ["custom-waypoint-1777297524644", "custom-waypoint-1777297518459"],
        continent: "voxya",
        description: "The eastern approach to the heartland, watched by ancient standing stones."
    },
    {
        id: "custom-waypoint-1777297524644",
        name: "Shattered Oak",
        type: "waypoint",
        x: 70, y: 60,
        neighbors: ["custom-waypoint-1777297526894", "custom-waypoint-1777297522944", "custom-base-1777293903926"],
        continent: "voxya",
        description: "A petrified oak split by a long-ago lightning strike; still standing."
    },
    {
        id: "custom-waypoint-1777297526894",
        name: "Redwater Ford",
        type: "waypoint",
        x: 72, y: 50,
        neighbors: ["custom-waypoint-1777297529878", "custom-waypoint-1777297524644", "custom-base-1777295819441"],
        continent: "voxya",
        description: "The stream here runs rust-colored from iron-rich springs upstream."
    },
    {
        id: "custom-waypoint-1777297529878",
        name: "Ironpine",
        type: "waypoint",
        x: 69, y: 45,
        neighbors: ["custom-waypoint-1777297526894", "custom-waypoint-1777297667125"],
        continent: "voxya",
        description: "A stand of metallic-barked pines that ring like bells in high wind."
    },
    {
        id: "custom-waypoint-1777297667125",
        name: "Frostwatch Beacon",
        type: "waypoint",
        x: 73, y: 37,
        neighbors: ["custom-waypoint-1777297674596", "custom-waypoint-1777297529878", "custom-waypoint-1777298773887"],
        continent: "voxya",
        description: "A signal tower rimed with perpetual frost, never succumbing to warmth."
    },
    {
        id: "custom-waypoint-1777297674596",
        name: "High Perch",
        type: "waypoint",
        x: 69, y: 30,
        neighbors: ["custom-waypoint-1777296194510", "custom-waypoint-1777297667125", "custom-king-base-1777293131216"],
        continent: "voxya",
        description: "A rocky outcrop with views across three isles on a clear day."
    },
    {
        id: "custom-waypoint-1777297745263",
        name: "Blightroot",
        type: "waypoint",
        x: 58, y: 56,
        neighbors: ["custom-waypoint-1777297747096", "custom-waypoint-1777297518459"],
        continent: "voxya",
        description: "The trees here weep black sap; the blight is slow but unstoppable."
    },
    {
        id: "custom-waypoint-1777297747096",
        name: "Glassmere",
        type: "waypoint",
        x: 57, y: 53,
        neighbors: ["custom-waypoint-1777297750063", "custom-waypoint-1777297745263"],
        continent: "voxya",
        description: "A field of obsidian shards where lightning once struck sand and glassed the earth."
    },
    {
        id: "custom-waypoint-1777297750063",
        name: "Furnace Gate",
        type: "waypoint",
        x: 59, y: 49,
        neighbors: ["custom-waypoint-1777297752346", "custom-waypoint-1777297747096"],
        continent: "voxya",
        description: "A cavern mouth belching furnace-heat, sacred to smiths and forgemasters."
    },
    {
        id: "custom-waypoint-1777297752346",
        name: "Smokefall",
        type: "waypoint",
        x: 55, y: 44,
        neighbors: ["custom-waypoint-1777297760347", "custom-waypoint-1777297755646", "custom-waypoint-1777297750063"],
        continent: "voxya",
        description: "Vents in the rock hiss steam and sulfur — the earth breathes here."
    },
    {
        id: "custom-waypoint-1777297755646",
        name: "Cinder Reach",
        type: "waypoint",
        x: 58, y: 39,
        neighbors: ["custom-waypoint-1777297752346"],
        continent: "voxya",
        description: "Hot ash blankets the ground; nothing grows for a mile in any direction."
    },
    {
        id: "custom-waypoint-1777297760347",
        name: "Ironvein",
        type: "waypoint",
        x: 51, y: 44,
        neighbors: ["custom-waypoint-1777297764511", "custom-base-1777295817393", "custom-waypoint-1777297752346", "custom-waypoint-1777298547394"],
        continent: "voxya",
        description: "Rich ore runs close to the surface here, staining the rocks rust-red."
    },
    {
        id: "custom-waypoint-1777297764511",
        name: "Hangman's Bluff",
        type: "waypoint",
        x: 48, y: 55,
        neighbors: ["custom-waypoint-1777297760347", "custom-waypoint-1777299869063"],
        continent: "voxya",
        description: "A high cliff where traitors to the old kingdom met their end."
    },
    {
        id: "custom-waypoint-1777297908697",
        name: "Wyrm's Tooth",
        type: "waypoint",
        x: 32, y: 51,
        neighbors: ["custom-waypoint-1777297970848", "custom-waypoint-1777297915214", "custom-waypoint-1777296103175", "custom-waypoint-1777298047116"],
        continent: "voxya",
        description: "A colossal fang jutting from the earth — all that remains of a dead god."
    },
    {
        id: "custom-waypoint-1777297912181",
        name: "Lonely Cairn",
        type: "waypoint",
        x: 33, y: 55,
        neighbors: ["custom-waypoint-1777296103175"],
        continent: "voxya",
        description: "A single cairn on an empty hill. No one remembers who is buried here."
    },
    {
        id: "custom-waypoint-1777297915214",
        name: "Twin Cairns",
        type: "waypoint",
        x: 35, y: 54,
        neighbors: ["custom-waypoint-1777297908697"],
        continent: "voxya",
        description: "Two barrows side by side, bound by an oath older than the isles."
    },
    {
        id: "custom-waypoint-1777297970848",
        name: "Bonepath",
        type: "waypoint",
        x: 30, y: 53,
        neighbors: ["custom-waypoint-1777296044922", "custom-waypoint-1777297908697", "custom-waypoint-1777298047116"],
        continent: "voxya",
        description: "A trail paved with the bones of a leviathan from before the Shattering."
    },
    {
        id: "custom-waypoint-1777298047116",
        name: "Weeping Stone",
        type: "waypoint",
        x: 28, y: 50,
        neighbors: ["custom-waypoint-1777298050679", "custom-waypoint-1777297908697", "custom-waypoint-1777297970848"],
        continent: "voxya",
        description: "A monolith that sweats cold water, even in the driest season."
    },
    {
        id: "custom-waypoint-1777298050679",
        name: "Greyfang Crossing",
        type: "waypoint",
        x: 27, y: 45,
        neighbors: ["custom-waypoint-1777298054432", "custom-waypoint-1777298047116"],
        continent: "voxya",
        description: "An old trade road marked by wolf-carved standing stones."
    },
    {
        id: "custom-waypoint-1777298054432",
        name: "Throne Gate",
        type: "waypoint",
        x: 23, y: 40,
        neighbors: ["custom-waypoint-1777298050679", "custom-waypoint-1777299392009", "voxya-throne", "custom-waypoint-1777299469193"],
        continent: "voxya",
        description: "The last waypoint before the Shadow Throne, guarded by ancient wards."
    },
    {
        id: "custom-waypoint-1777298531484",
        name: "Thunderpath",
        type: "waypoint",
        x: 45, y: 25,
        neighbors: ["custom-player-base-1777447489090"],
        continent: "voxya",
        description: "The ground here is split by a deep ravine that hums before each storm."
    },
    {
        id: "custom-waypoint-1777298547394",
        name: "Dreadmarch",
        type: "waypoint",
        x: 47, y: 38,
        neighbors: ["custom-waypoint-1777297760347"],
        continent: "voxya",
        description: "The road darkens under dead pines; even beasts avoid this stretch."
    },
    {
        id: "custom-waypoint-1777298632735",
        name: "Stormbreak",
        type: "waypoint",
        x: 48, y: 33,
        neighbors: ["custom-waypoint-1777298638653"],
        continent: "voxya",
        description: "A wind-lashed ridge where lightning rods hum with captured energy."
    },
    {
        id: "custom-waypoint-1777298635136",
        name: "Windspire",
        type: "waypoint",
        x: 33, y: 23,
        neighbors: ["custom-waypoint-1777299698095"],
        continent: "voxya",
        description: "A needle of rock rising impossibly from the coastal cliffs."
    },
    {
        id: "custom-waypoint-1777298638653",
        name: "Rootwall",
        type: "waypoint",
        x: 36, y: 41,
        neighbors: ["custom-waypoint-1777298641103", "custom-waypoint-1777298632735"],
        continent: "voxya",
        description: "An ancient bulwark of petrified roots blocking the old forest road."
    },
    {
        id: "custom-waypoint-1777298641103",
        name: "Briarthorn",
        type: "waypoint",
        x: 39, y: 43,
        neighbors: ["custom-waypoint-1777298645018", "custom-waypoint-1777298638653"],
        continent: "voxya",
        description: "A tangled hedge of iron-thorn, trimmed back each generation but never tamed."
    },
    {
        id: "custom-waypoint-1777298645018",
        name: "Gallows Bend",
        type: "waypoint",
        x: 39, y: 48,
        neighbors: ["custom-waypoint-1777296103175", "custom-waypoint-1777298641103"],
        continent: "voxya",
        description: "Three nooses hang from a gnarled tree at the riverbend — always three, never more."
    },
    {
        id: "custom-waypoint-1777298773887",
        name: "Wyvern's Roost",
        type: "waypoint",
        x: 79, y: 39,
        neighbors: ["custom-waypoint-1777298778737", "custom-waypoint-1777297667125"],
        continent: "voxya",
        description: "Scratched cliffsides mark where wyverns once nested in ages past."
    },
    {
        id: "custom-waypoint-1777298778737",
        name: "Ashpeak Trail",
        type: "waypoint",
        x: 82, y: 38,
        neighbors: ["custom-waypoint-1777298783287", "custom-waypoint-1777298773887"],
        continent: "voxya",
        description: "A winding path through cooled lava fields from a long-dead volcano."
    },
    {
        id: "custom-waypoint-1777298783287",
        name: "Eventide",
        type: "waypoint",
        x: 85, y: 38,
        neighbors: ["custom-waypoint-1777298786405", "custom-waypoint-1777298778737"],
        continent: "voxya",
        description: "The last place touched by sunlight before night claims the eastern isles."
    },
    {
        id: "custom-waypoint-1777298786405",
        name: "Last Hearth",
        type: "waypoint",
        x: 86, y: 33,
        neighbors: ["custom-waypoint-1777298783287"],
        continent: "voxya",
        description: "The final waypoint before the map's edge — beyond lies only mist and myth."
    },
    {
        id: "custom-waypoint-1777299311011",
        name: "Thornwood Gate",
        type: "waypoint",
        x: 15, y: 41,
        neighbors: ["custom-waypoint-1777299316342", "custom-waypoint-1777299383259"],
        continent: "voxya",
        description: "A natural arch of tangled briar, marking the edge of the deepwood."
    },
    {
        id: "custom-waypoint-1777299316342",
        name: "Greywake",
        type: "waypoint",
        x: 12, y: 44,
        neighbors: ["custom-waypoint-1777299319526", "custom-waypoint-1777299311011"],
        continent: "voxya",
        description: "An old watchtower whose signal fire has been cold for centuries."
    },
    {
        id: "custom-waypoint-1777299319526",
        name: "Black Shoal",
        type: "waypoint",
        x: 9, y: 49,
        neighbors: ["custom-base-1777295827091", "custom-waypoint-1777299316342"],
        continent: "voxya",
        description: "Treacherous shallows where the bones of wrecked ships pierce the water."
    },
    {
        id: "custom-waypoint-1777299383259",
        name: "Silent Brake",
        type: "waypoint",
        x: 18, y: 39,
        neighbors: ["custom-waypoint-1777299311011", "custom-waypoint-1777299392009"],
        continent: "voxya",
        description: "A still grove where no bird sings and the air hangs heavy with old magic."
    },
    {
        id: "custom-waypoint-1777299392009",
        name: "Warden's Henge",
        type: "waypoint",
        x: 20, y: 41,
        neighbors: ["custom-waypoint-1777299383259", "custom-waypoint-1777298054432"],
        continent: "voxya",
        description: "A ring of standing stones that glows faintly under starlight."
    },
    {
        id: "custom-waypoint-1777299469193",
        name: "Crown's Veil",
        type: "waypoint",
        x: 24, y: 37,
        neighbors: ["custom-waypoint-1777299474012", "custom-waypoint-1777298054432"],
        continent: "voxya",
        description: "A curtain of mist that parts only for those bearing the old blood."
    },
    {
        id: "custom-waypoint-1777299474012",
        name: "Scepter's Rest",
        type: "waypoint",
        x: 23, y: 34,
        neighbors: ["custom-waypoint-1777299469193", "custom-waypoint-1777299476810"],
        continent: "voxya",
        description: "A way-shrine where pilgrims once laid offerings before approaching the Throne."
    },
    {
        id: "custom-waypoint-1777299476810",
        name: "Pilgrim's Ascent",
        type: "waypoint",
        x: 26, y: 31,
        neighbors: ["custom-waypoint-1777299487926", "custom-waypoint-1777299474012"],
        continent: "voxya",
        description: "Worn stone steps climbing toward the high road."
    },
    {
        id: "custom-waypoint-1777299487926",
        name: "Skyrift Shrine",
        type: "waypoint",
        x: 39, y: 23,
        neighbors: ["custom-waypoint-1777299476810", "custom-waypoint-1777299698095"],
        continent: "voxya",
        description: "A temple roofless under the stars, where three paths converge."
    },
    {
        id: "custom-waypoint-1777299698095",
        name: "Cloudrift",
        type: "waypoint",
        x: 33, y: 28,
        neighbors: ["custom-waypoint-1777299487926", "custom-waypoint-1777298635136"],
        continent: "voxya",
        description: "A narrow bridge of stone spanning a bottomless chasm."
    },
    {
        id: "custom-waypoint-1777299869063",
        name: "Wormwood Crossing",
        type: "waypoint",
        x: 50, y: 61,
        neighbors: ["custom-waypoint-1777297764511", "custom-waypoint-1777296201393"],
        continent: "voxya",
        description: "Bitter herbs grow here in abundance, used in funerary rites across the isles."
    },
    {
        id: "custom-player-base-1777447489090",
        name: "Player Base 1",
        type: "player-base",
        x: 39, y: 23,
        neighbors: ["custom-waypoint-1777298531484", "custom-waypoint-1777447515723"],
        continent: "voxya",
        description: "Custom player-base created in editor mode"
    },
    {
        id: "custom-waypoint-1777447515723",
        name: "New Waypoint 2",
        type: "waypoint",
        x: 42, y: 30,
        neighbors: ["custom-player-base-1777447489090"],
        continent: "voxya",
        description: "Custom waypoint created in editor mode"
    }
];

// ============================================
// BaseSystem Class
// ============================================

export class BaseSystem {
    constructor(bases = VOXYA_BASES) {
        this.bases = JSON.parse(JSON.stringify(bases));
        this.baseMap = new Map();
        this._buildIndices();
    }

    _buildIndices() {
        for (const base of this.bases) {
            this.baseMap.set(base.id, base);
        }
    }

    getAll() {
        return this.bases;
    }

    getById(id) {
        return this.baseMap.get(id);
    }

    getCenter(id) {
        const base = this.getById(id);
        return base ? { x: base.x, y: base.y } : null;
    }

    getNeighbors(id) {
        const base = this.getById(id);
        if (!base) return [];
        return base.neighbors
            .map(nid => this.getById(nid))
            .filter(Boolean);
    }

    getByType(type) {
        return this.bases.filter(b => b.type === type);
    }

    findPath(startId, endId) {
        if (startId === endId) return [startId];
        const start = this.getById(startId);
        if (!start) return null;
        const visited = new Set([startId]);
        const queue = [[startId]];
        while (queue.length > 0) {
            const path = queue.shift();
            const current = this.getById(path[path.length - 1]);
            for (const neighborId of current.neighbors) {
                if (neighborId === endId) return [...path, neighborId];
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push([...path, neighborId]);
                }
            }
        }
        return null;
    }

    // ============================================
    // Editor Mode Functions
    // ============================================

    updatePosition(id, x, y) {
        const base = this.getById(id);
        if (!base) return false;
        base.x = Math.round(x);
        base.y = Math.round(y);
        return true;
    }

    addConnection(id1, id2) {
        const b1 = this.getById(id1);
        const b2 = this.getById(id2);
        if (!b1 || !b2) return false;
        if (b1.neighbors.includes(id2)) return false;
        b1.neighbors.push(id2);
        b2.neighbors.push(id1);
        return true;
    }

    removeConnection(id1, id2) {
        const b1 = this.getById(id1);
        const b2 = this.getById(id2);
        if (!b1 || !b2) return false;
        b1.neighbors = b1.neighbors.filter(n => n !== id2);
        b2.neighbors = b2.neighbors.filter(n => n !== id1);
        return true;
    }

    exportToJSON() {
        return this.bases.map(b => ({
            id: b.id,
            name: b.name,
            type: b.type,
            x: b.x,
            y: b.y,
            neighbors: [...b.neighbors],
            continent: b.continent,
            description: b.description
        }));
    }

    importFromJSON(data) {
        if (!Array.isArray(data)) return false;
        data.forEach(b => {
            const existing = this.getById(b.id);
            if (existing) {
                existing.x = b.x;
                existing.y = b.y;
                existing.neighbors = b.neighbors || [];
            }
        });
        return true;
    }

    getAllConnections() {
        const connections = [];
        const seen = new Set();
        this.bases.forEach(b => {
            b.neighbors.forEach(nid => {
                const key = [b.id, nid].sort().join('-');
                if (!seen.has(key)) {
                    seen.add(key);
                    connections.push({ from: b.id, to: nid });
                }
            });
        });
        return connections;
    }

    addBase(base) {
        if (!base.id || this.baseMap.has(base.id)) return false;
        this.bases.push(base);
        this.baseMap.set(base.id, base);
        return true;
    }

    removeBase(id) {
        const base = this.getById(id);
        if (!base) return false;

        base.neighbors.forEach(neighborId => {
            const neighbor = this.getById(neighborId);
            if (neighbor) {
                neighbor.neighbors = neighbor.neighbors.filter(n => n !== id);
            }
        });

        this.bases = this.bases.filter(b => b.id !== id);
        this.baseMap.delete(id);
        return true;
    }
}

// ============================================
// Visual Styles
// ============================================

export function getBaseStyle(type) {
    if (type === 'king-base' || type === 'King Base') {
        return {
            radius: 14,
            color: '#f4d03f',
            glow: 'rgba(244, 208, 63, 0.8)',
            border: '#f4d03f'
        };
    }
    if (type === 'waypoint' || type === 'Waypoint') {
        return {
            radius: 8,
            color: '#a78bfa',
            glow: 'rgba(167, 139, 250, 0.6)',
            border: '#7c3aed'
        };
    }
    if (type === 'player-base' || type === 'Player Base') {
        return {
            radius: 12,
            color: '#10b981',
            glow: 'rgba(16, 185, 129, 0.8)',
            border: '#059669'
        };
    }
    if (type === 'enemy-base' || type === 'Enemy Base') {
        return {
            radius: 12,
            color: '#ef4444',
            glow: 'rgba(239, 68, 68, 0.8)',
            border: '#dc2626'
        };
    }
    // Default: Base
    return {
        radius: 11,
        color: '#a78bfa',
        glow: 'rgba(167, 139, 250, 0.8)',
        border: '#5b21b6'
    };
}

// ============================================
// Factory
// ============================================

export function createVoxyaSystem() {
    return new BaseSystem(VOXYA_BASES);
}

export default createVoxyaSystem;
