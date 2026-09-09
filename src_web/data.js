// YathraLanka App Data Configuration

export const initialUserState = {
  xp: 0,
  rank: "None",
  medals: 0,
  sitesVisited: 0,
  quizzesPassed: 0,
  permissions: {
    camera: false,
    notifications: false
  },
  role: "Explorer",
  interests: [],
  signedPetitions: [],
  donatedAmount: 0,
  joinedEvents: [],
  unlockedCoupons: [],
  completedQuizzes: {},
  dwellTimeCompleted: {},
  verifiedPhotos: {},
  completedCheckpoints: []
};

export const rankingScale = [
  { rank: "Grass Toucher", range: [0, 99], threshold: 0 },
  { rank: "Wanderer", range: [100, 249], threshold: 100 },
  { rank: "Tuk Tuk Trailer", range: [250, 499], threshold: 250 },
  { rank: "Magahoyanna", range: [500, 999], threshold: 500 },
  { rank: "Island Explorer", range: [1000, 2000], threshold: 1000 },
  { rank: "Lanka Legend", range: [2000, 5000], threshold: 2000 }
];

export const leaderboardPlayers = [
  { name: "Suranga M", points: 5820, role: "Explorer", rank: "Lanka Legend" },
  { name: "Anjali R.", points: 5330, role: "Volunteer", rank: "Lanka Legend" },
  { name: "Dilhani", points: 3540, role: "Organizer", rank: "Island Explorer" },
  { name: "Mihiranga T.", points: 1160, role: "Quiz Master", rank: "Island Explorer" }
];

export const SMART_MEDALS_CONFIG = [
  {
    id: "pathfinder_kingdom",
    title: "Pathfinder of the Kingdom",
    tier: "Bronze",
    icon: "📜",
    description: "Check in to 3 unique Heritage Trail landmarks within 14 days using live GPS verification.",
    xpReward: 150,
    timeframeDays: 14,
    requiredCount: 3
  },
  {
    id: "royal_chronicler",
    title: "Royal Chronicler",
    tier: "Silver",
    icon: "📸",
    description: "Upload 5 GPS-verified photos across registered historical sites within 30 days.",
    xpReward: 200,
    timeframeDays: 30,
    requiredCount: 5
  },
  {
    id: "guardian_polonnaruwa",
    title: "Guardian of Polonnaruwa",
    tier: "Gold",
    icon: "🏛️",
    description: "Complete all geofence check-ins and score 100% on the ancient irrigation & ruins quiz in 1 session.",
    xpReward: 300,
    timeframeDays: 1,
    requiredCount: 1
  },
  {
    id: "lankan_cartographer",
    title: "Lankan Cartographer",
    tier: "Diamond",
    icon: "🗺️",
    description: "Visit at least 1 verified landmark across 5 different districts within 60 days.",
    xpReward: 500,
    timeframeDays: 60,
    requiredCount: 5
  },
  {
    id: "sage_mahavamsa",
    title: "Sage of the Mahavamsa",
    tier: "Master Relic",
    icon: "👑",
    description: "Successfully pass 10 historical landmark quizzes on the first attempt.",
    xpReward: 400,
    timeframeDays: 365,
    requiredCount: 10
  }
];

export const sitesData = [
  // --- HERITAGE TRAIL ---
  {
    id: "independence_memorial_hall",
    name: "Independence Memorial Hall",
    district: "Colombo District",
    category: "Heritage Trail",
    xp: 220,
    xpRange: "25 - 80 XP",
    distance: "5km",
    openStatus: "Open now",
    description: "Built to commemorate the independence of Sri Lanka from British rule in 1948, featuring traditional Kandyan architectural stonework and 60 carved stone lions.",
    image: "/Element%20Pictures/Independence%20Memorial%20Hall.jpg",
    latitude: 6.846738,
    longitude: 79.993303,
    referenceImage: "/assets/images/independence_hall.webp",
    checkpoints: [
      {
        id: "independence_hall_columns",
        name: "Carved Kandyan Columns",
        description: "Intricate wooden and stone pillar carvings inspired by the Magul Maduwa in Kandy.",
        referenceImage: "/assets/images/independence_hall.webp",
        hint: "Frame the carved wooden pillar capitals in your camera viewfinder.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
        question: "In what year was Sri Lanka's Independence Memorial Hall constructed to mark independence?",
        options: ["1948", "1953", "1972", "1934"],
        correctIndex: 0
      }
    ]
  },
  {
    id: "colombo_museum",
    name: "National Museum, Colombo",
    district: "Colombo District",
    category: "Heritage Trail",
    xp: 220,
    xpRange: "25 - 80 XP",
    distance: "5km",
    openStatus: "Open now",
    description: "Established in 1877, the National Museum of Colombo is the largest museum in Sri Lanka, housing ancient regalia including the throne and crown of the Kandyan monarchs.",
    image: "/Element%20Pictures/National%20Museum%20-%20Colombo.jpg",
    latitude: 6.9044,
    longitude: 79.8606,
    referenceImage: "/Element%20Pictures/National%20Museum%20-%20Colombo.jpg",
    checkpoints: [
      {
        id: "colombo_museum_throne",
        name: "Royal Throne & Crown Gallery",
        description: "The ceremonial throne of King Sri Vikrama Rajasinha returned to Sri Lanka in 1934.",
        referenceImage: "/Element%20Pictures/National%20Museum%20-%20Colombo.jpg",
        hint: "Align the royal regalia display in the center of the viewfinder.",
        xpReward: 50
      },
      {
        id: "colombo_museum_bodhisattva",
        name: "Bronze Bodhisattva Tara Hall",
        description: "The world-famous 8th-century cast bronze statue of Goddess Tara.",
        referenceImage: "/Element%20Pictures/National%20Museum%20-%20Colombo.jpg",
        hint: "Frame the bronze statue showcase under ambient hall lighting.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
            "question": "In which year was the National Museum of Colombo established?",
            "options": [
                  "1877",
                  "1815",
                  "1948",
                  "1905"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which British Governor of Ceylon founded the National Museum?",
            "options": [
                  "Sir William Henry Gregory",
                  "Sir Thomas Maitland",
                  "Sir Robert Brownrigg",
                  "Sir Arthur Gordon"
            ],
            "correctIndex": 0
      },
      {
            "question": "What architectural style is exhibited by the main white building of the museum?",
            "options": [
                  "Italianate Victorian architecture",
                  "Gothic Revival",
                  "Kandyan Classical",
                  "Dutch Baroque"
            ],
            "correctIndex": 0
      },
      {
            "question": "The royal throne of which final king of Kandy is preserved here?",
            "options": [
                  "King Sri Vikrama Rajasinha",
                  "King Rajadhi Rajasinha",
                  "King Kirti Sri Rajasinha",
                  "King Vimaladharmasuriya I"
            ],
            "correctIndex": 0
      },
      {
            "question": "In what year were the Kandyan Crown and Throne returned to Sri Lanka?",
            "options": [
                  "1934",
                  "1948",
                  "1972",
                  "1920"
            ],
            "correctIndex": 0
      },
      {
            "question": "The famous 8th-century cast bronze statue of which deity is housed here?",
            "options": [
                  "Tara",
                  "Pattini",
                  "Saraswati",
                  "Lakshmi"
            ],
            "correctIndex": 0
      },
      {
            "question": "Where was the 8th-century gilded bronze Tara statue originally found?",
            "options": [
                  "Near Trincomalee",
                  "Anuradhapura",
                  "Polonnaruwa",
                  "Sigiriya"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which royal weapon used by King Rajasinha I in battle is on display?",
            "options": [
                  "A royal ceremonial sword",
                  "A double-edged golden dagger",
                  "An engraved iron lance",
                  "A jeweled broadsword"
            ],
            "correctIndex": 0
      },
      {
            "question": "The museum holds a replica of which trilingual slab inscription from 1409?",
            "options": [
                  "The Galle Trilingual Inscription (Zheng He)",
                  "The Badulla Pillar Inscription",
                  "The Panakaduwa Copper Plate",
                  "The Vallipuram Gold Plate"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which architect designed the National Museum building under the PWD?",
            "options": [
                  "J. G. Smither",
                  "Herbert Baker",
                  "Geoffrey Bawa",
                  "James Cordiner"
            ],
            "correctIndex": 0
      },
      {
            "question": "What ancient material are the earliest Buddhist palm-leaf manuscripts made from?",
            "options": [
                  "Ola leaves (Talipot palm)",
                  "Papyrus reed",
                  "Cotton pulp paper",
                  "Birch bark"
            ],
            "correctIndex": 0
      },
      {
            "question": "The museum features an ancient statue of Avalokiteshvara Bodhisattva from which era?",
            "options": [
                  "Anuradhapura Period (8th-9th century)",
                  "Kotte Period",
                  "Dambadeniya Period",
                  "Gampola Period"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which ancient animal fossil collection is maintained in its natural history wing?",
            "options": [
                  "Pleistocene fauna of Ratnapura",
                  "Cretaceous dinosaurs",
                  "Marine fossils of Jaffna",
                  "Tertiary mammals of Wilpattu"
            ],
            "correctIndex": 0
      },
      {
            "question": "What precious material is the royal footstool (P\u0101da P\u012b\u1e6dha) adorned with?",
            "options": [
                  "Gold plating and red velvet",
                  "Solid ivory carving",
                  "Polished lapis lazuli",
                  "Pure silver filigree"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which sacred relic casket (Karanduwa) style is featured in the museum collection?",
            "options": [
                  "Crystal and gold miniature stupas",
                  "Terracotta bell urns",
                  "Carved limestone boxes",
                  "Cast iron reliquaries"
            ],
            "correctIndex": 0
      },
      {
            "question": "The museum houses ancient coins known as Kahavanu from which kingdom?",
            "options": [
                  "Anuradhapura Kingdom",
                  "Yapahuwa Kingdom",
                  "Sitawaka Kingdom",
                  "Raigama Kingdom"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which ancient stone urinal slab (Kakkapada) design in the museum reflects ascetic detachment?",
            "options": [
                  "Ornately carved flush stone platforms",
                  "Plain sandstone blocks",
                  "Hollow tree trunks",
                  "Clay basins"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which botanical library was integrated with the museum upon opening?",
            "options": [
                  "Colombo Museum Library",
                  "Peradeniya Library",
                  "Royal Asiatic Society Library",
                  "Kandy Archives"
            ],
            "correctIndex": 0
      },
      {
            "question": "The museum displays traditional masks (Vesmuhunu) primarily from which southern craft town?",
            "options": [
                  "Ambalangoda",
                  "Galle",
                  "Matara",
                  "Tangalle"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the primary exterior color of the National Museum facade?",
            "options": [
                  "Immaculate White",
                  "Terracotta Ochre",
                  "Granite Grey",
                  "Sandstone Yellow"
            ],
            "correctIndex": 0
      }
]
  },
  {
    id: "bmich",
    name: "B.M.I.C.H. (Bandaranayake Memorial International Conference Hall)",
    district: "Colombo District",
    category: "Heritage Trail",
    xp: 220,
    xpRange: "25 - 80 XP",
    distance: "4km",
    openStatus: "Open now",
    description: "Gifted by the People's Republic of China in memory of Prime Minister S.W.R.D. Bandaranaike, BMICH is Asia's first purpose-built conference center, featuring grand octagonal architecture and lotus-inspired design.",
    image: "/Element%20Pictures/BMICH%20photo.jpg",
    latitude: 6.9034,
    longitude: 79.8737,
    referenceImage: "/Element%20Pictures/BMICH%20photo.jpg",
    checkpoints: [
      {
        id: "bmich_main_hall",
        name: "Octagonal Main Conference Hall",
        description: "The grand octagonal structure incorporating modern design with ancient Lankan motif accents.",
        referenceImage: "/Element%20Pictures/BMICH%20photo.jpg",
        hint: "Frame the octagonal hall facade and entrance stairs in your viewfinder.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
        question: "In what year was the Bandaranaike Memorial International Conference Hall (BMICH) presented to Sri Lanka?",
        options: ["1973", "1965", "1980", "1958"],
        correctIndex: 0
      },
      {
        question: "Which nation gifted the BMICH as a gesture of bilateral friendship?",
        options: ["People's Republic of China", "Japan", "India", "United Kingdom"],
        correctIndex: 0
      },
      {
        question: "What distinct geometric shape defines the main convention hall architecture of BMICH?",
        options: ["Octagonal", "Hexagonal", "Circular", "Square"],
        correctIndex: 0
      }
    ]
  },
  {
    id: "sigiriya",
    name: "Sigiriya",
    district: "Matale District",
    category: "Heritage Trail",
    xp: 220,
    xpRange: "25 - 80 XP",
    distance: "160km",
    openStatus: "Open now",
    description: "An ancient rock fortress constructed by King Kashyapa, celebrated for its advanced water gardens, 5th-century frescoes of celestial maidens, and the colossal lion paw gate.",
    image: "/Element%20Pictures/Sigiriya-LionRock.jpg",
    latitude: 7.9570,
    longitude: 80.7603,
    referenceImage: "/Element%20Pictures/Sigiriya-LionRock.jpg",
    checkpoints: [
      {
        id: "sigiriya_lion_paws",
        name: "Colossal Lion Paws Gate",
        description: "The massive lion paws framing the staircase to the summit palace.",
        referenceImage: "/Element%20Pictures/Sigiriya-LionRock.jpg",
        hint: "Center the two massive lion paw sculptures in your camera viewfinder.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
            "question": "Which king built the 5th-century fortress on Sigiriya rock?",
            "options": [
                  "King Kashyapa",
                  "King Moggallana",
                  "King Dhatusena",
                  "King Dutugemunu"
            ],
            "correctIndex": 0
      },
      {
            "question": "What was the original purpose of the highly polished 'Mirror Wall'?",
            "options": [
                  "To preserve graffiti poems written by ancient visitors",
                  "For the king to admire his armor",
                  "To blind attackers with sunlight",
                  "To signal nearby hills"
            ],
            "correctIndex": 0
      },
      {
            "question": "What colossal anatomical feature once formed the grand staircase entrance?",
            "options": [
                  "A giant lion's paws and open mouth",
                  "An elephant trunk",
                  "A five-headed cobra hood",
                  "A mythological dragon gate"
            ],
            "correctIndex": 0
      },
      {
            "question": "Sigiriya frescoes depict which celebrated figures?",
            "options": [
                  "Celestial nymphs or maidens (Apsaras)",
                  "Victorious generals in battle",
                  "The Buddha's life story",
                  "Court jesters and acrobats"
            ],
            "correctIndex": 0
      },
      {
            "question": "What advanced engineering system is still visible in Sigiriya's water gardens?",
            "options": [
                  "Underground hydraulic gravity-fed fountains",
                  "Steam pump turbines",
                  "Aqueducts imported from Rome",
                  "Windmill water wheels"
            ],
            "correctIndex": 0
      },
      {
            "question": "How tall is the massive Sigiriya granite rock plateau?",
            "options": [
                  "Approximately 180 meters (600 ft)",
                  "90 meters",
                  "350 meters",
                  "500 meters"
            ],
            "correctIndex": 0
      },
      {
            "question": "Who was King Kashyapa's father whom he usurped?",
            "options": [
                  "King Dhatusena",
                  "King Aggabodhi",
                  "King Mahasen",
                  "King Valagamba"
            ],
            "correctIndex": 0
      },
      {
            "question": "What did Sigiriya become after King Kashyapa's death?",
            "options": [
                  "A Buddhist forest monastery",
                  "A foreign trade garrison",
                  "The capital of Ceylon for 500 years",
                  "An abandoned royal prison"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which brother returned from India to reclaim the throne from Kashyapa?",
            "options": [
                  "Moggallana",
                  "Jetthatissa",
                  "Sena I",
                  "Udaya I"
            ],
            "correctIndex": 0
      },
      {
            "question": "What protective enclosure circles the outer royal gardens?",
            "options": [
                  "Concentric earthen ramparts and deep water moats",
                  "A palisade of spiked timber",
                  "A granite wall 10 meters thick",
                  "A dense thorn hedge only"
            ],
            "correctIndex": 0
      },
      {
            "question": "Sigiriya was inscribed as a UNESCO World Heritage Site in which decade?",
            "options": [
                  "1980s (1982)",
                  "1970s",
                  "1990s",
                  "2000s"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the name of the neighboring rock peak looking directly at Sigiriya?",
            "options": [
                  "Pidurangala",
                  "Ritigala",
                  "Mihintale",
                  "Dambulla Rock"
            ],
            "correctIndex": 0
      },
      {
            "question": "What script is used in the earliest ancient graffiti verses on the Mirror Wall?",
            "options": [
                  "Early Sinhala script",
                  "Roman Latin",
                  "Pallava Grantha",
                  "Devanagari"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which rock garden feature demonstrates cooling architecture?",
            "options": [
                  "Boulder gardens with carved stone cisterns",
                  "Underground ice chambers",
                  "Deep volcanic wells",
                  "Timber air chimneys"
            ],
            "correctIndex": 0
      },
      {
            "question": "Where is the royal throne carved directly on top of the summit?",
            "options": [
                  "On the highest eastern summit terrace",
                  "Inside the lower lion paw cave",
                  "Beneath the Cobra Hood rock",
                  "Beside the outer water moat"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the name of the rock overhang shaped like a cobra's head?",
            "options": [
                  "Cobra Hood Cave",
                  "Lion Gate Cavity",
                  "Asana Cave",
                  "Drip Cave"
            ],
            "correctIndex": 0
      },
      {
            "question": "What organic binder was mixed with plaster for the Sigiriya fresco paintings?",
            "options": [
                  "Plant sap, honey, and egg white tempera",
                  "Crushed sea shells and lime only",
                  "Animal fat and charcoal",
                  "Petroleum oil resins"
            ],
            "correctIndex": 0
      },
      {
            "question": "How many frescoes are preserved today in the sheltered spiral gallery?",
            "options": [
                  "Around 21 distinct maidens",
                  "Exactly 100 figures",
                  "Only 2 damaged faces",
                  "Over 500 complete murals"
            ],
            "correctIndex": 0
      },
      {
            "question": "What color predominantly outlines the clouds in the fresco paintings?",
            "options": [
                  "Earthy red and golden ochre",
                  "Bright indigo blue",
                  "Deep emerald green",
                  "Metallic silver"
            ],
            "correctIndex": 0
      },
      {
            "question": "Why did Kashyapa choose to build his citadel atop Sigiriya rock?",
            "options": [
                  "Fear of military retaliation from his exiled brother",
                  "Religious visions of mountain gods",
                  "To escape monsoon floods",
                  "To be closer to maritime trade ports"
            ],
            "correctIndex": 0
      }
]
  },
  {
    id: "temple_of_the_tooth",
    name: "Temple of the Tooth",
    district: "Kandy District",
    category: "Heritage Trail",
    xp: 220,
    xpRange: "25 - 80 XP",
    distance: "115km",
    openStatus: "Open now",
    description: "The royal palace complex of Kandy housing the sacred tooth relic of Gautama Buddha, symbolizing sovereignty, Kandyan architecture, and royal heritage.",
    image: "/Element%20Pictures/Temple%20of%20the%20tooth.jpg",
    latitude: 7.2936,
    longitude: 80.6413,
    referenceImage: "/Element%20Pictures/Temple%20of%20the%20tooth.jpg",
    checkpoints: [
      {
        id: "kandy_pattirippuwa",
        name: "Pattirippuwa (Octagonal Pavilion)",
        description: "The iconic octagonal structure built by King Sri Vikrama Rajasinha.",
        referenceImage: "/Element%20Pictures/Temple%20of%20the%20tooth.jpg",
        hint: "Align the octagonal tower and front moat in your camera viewfinder.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
            "question": "Which sacred relic is enshrined at the Sri Dalada Maligawa in Kandy?",
            "options": [
                  "The left canine tooth of Gautama Buddha",
                  "The sacred collarbone relic",
                  "The hair relic (Kesha Dathu)",
                  "The sacred alms bowl"
            ],
            "correctIndex": 0
      },
      {
            "question": "Who brought the Sacred Tooth Relic to Sri Lanka hidden in her hair?",
            "options": [
                  "Princess Hemamala and Prince Dantha",
                  "Princess Sanghamitta",
                  "Queen Viharamahadevi",
                  "Queen Anula"
            ],
            "correctIndex": 0
      },
      {
            "question": "In ancient Sri Lankan history, possession of the Tooth Relic represented:",
            "options": [
                  "The divine right and legitimate authority to rule",
                  "Immunity from disease",
                  "Wealth from foreign commerce",
                  "Command over all naval fleets"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the name of the famous octagonal tower at the front of the temple?",
            "options": [
                  "Pattirippuwa",
                  "Vahalkada",
                  "Sandakada Pahana",
                  "Gedige"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which last independent monarch of Kandy built the Pattirippuwa octagonal pavilion?",
            "options": [
                  "King Sri Vikrama Rajasinha",
                  "King Kirti Sri Rajasinha",
                  "King Rajasinghe II",
                  "King Vimaladharmasuriya II"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the name of the lake directly fronting the Temple of the Tooth?",
            "options": [
                  "Kiri Muhuda (Kandy Lake)",
                  "Tissa Wewa",
                  "Parakrama Samudra",
                  "Beira Lake"
            ],
            "correctIndex": 0
      },
      {
            "question": "What decorative motif characterizes the surrounding lake and moat wall?",
            "options": [
                  "Diyarella Bemma (Wave Swell Wall)",
                  "Elephant parade reliefs",
                  "Lotus flower friezes",
                  "Bronze lion heads"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which annual procession in Kandy features the sacred Tooth Relic casket?",
            "options": [
                  "Esala Perahera",
                  "Duruthu Perahera",
                  "Navam Perahera",
                  "Vesak Kalapaya"
            ],
            "correctIndex": 0
      },
      {
            "question": "What prominent animal carries the main golden casket during the Esala Perahera?",
            "options": [
                  "The majestic tusker elephant (Maligawa Tusker)",
                  "A caparisoned white stallion",
                  "A ceremonial royal bull",
                  "Carried by 50 barefoot chieftains"
            ],
            "correctIndex": 0
      },
      {
            "question": "Inside the inner chamber, how many nested golden caskets protect the relic?",
            "options": [
                  "Seven nested golden stupa caskets",
                  "Three silver boxes",
                  "Twelve iron chests",
                  "A single crystal vase"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which king established Kandy as the permanent capital housing the Tooth Relic?",
            "options": [
                  "King Vimaladharmasuriya I",
                  "King Parakramabahu VI",
                  "King Dutugemunu",
                  "King Bhuvanekabahu VI"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the golden roof crowning the inner sanctum called?",
            "options": [
                  "Ran Viyana (Golden Canopy)",
                  "Pattirippuwa",
                  "Magul Maduwa",
                  "Ambalama"
            ],
            "correctIndex": 0
      },
      {
            "question": "In what year was the golden roof installed over the relic chamber?",
            "options": [
                  "1987",
                  "1815",
                  "1948",
                  "1956"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which historic open hall stands directly behind the Temple of the Tooth?",
            "options": [
                  "Magul Maduwa (Royal Audience Hall)",
                  "Lovamahapaya",
                  "Alahana Pirivena",
                  "Brazen Palace"
            ],
            "correctIndex": 0
      },
      {
            "question": "The Magul Maduwa is renowned for which master craftsman woodwork?",
            "options": [
                  "Carved wooden pillars made of Halmilla timber",
                  "Imported cedar arches",
                  "Ebony inlaid ivory gates",
                  "Sandalwood window grilles"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which treaty ending the Kandyan kingdom was signed at the Magul Maduwa in 1815?",
            "options": [
                  "The Kandyan Convention",
                  "The Treaty of Amiens",
                  "The Colombo Pact",
                  "The Galle Agreement"
            ],
            "correctIndex": 0
      },
      {
            "question": "What ritual daily offering ceremony is conducted at the temple three times a day?",
            "options": [
                  "The Thevava service",
                  "The Pahan Pooja",
                  "The Bodhi Vandana",
                  "The Pirith Deshana"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which two Buddhist monastic chapters oversee the custody of the Tooth Relic?",
            "options": [
                  "Malwathu and Asgiri Chapters of Siyam Nikaya",
                  "Amarapura and Ramanna Chapters",
                  "Abhayagiri and Mahavihara",
                  "Dambulla and Mihintale chapters"
            ],
            "correctIndex": 0
      },
      {
            "question": "What museum within the complex displays international gifts offered to the relic?",
            "options": [
                  "The Sri Dalada Museum",
                  "Kandy Military Archive",
                  "The National Folk Hall",
                  "The Royal Coin Vault"
            ],
            "correctIndex": 0
      },
      {
            "question": "What color robes do devotees and temple attendants traditionally wear inside?",
            "options": [
                  "Pure white attire",
                  "Saffron yellow robes",
                  "Crimson silk wraps",
                  "Navy blue ceremonial dress"
            ],
            "correctIndex": 0
      }
]
  },
  {
    id: "ruwanweliseya",
    name: "Ruwanweliseya",
    district: "Anuradhapura District",
    category: "Heritage Trail",
    xp: 220,
    xpRange: "25 - 80 XP",
    distance: "215km",
    openStatus: "Open now",
    description: "A monumental bubble-shaped stupa built by King Dutugemunu in ancient Anuradhapura, celebrated as an engineering marvel of Buddhist architecture.",
    image: "/Element%20Pictures/Ruwanweliseya.jpg",
    latitude: 8.3503,
    longitude: 80.3962,
    referenceImage: "/Element%20Pictures/Ruwanweliseya.jpg",
    checkpoints: [
      {
        id: "ruwanweliseya_elephant_wall",
        name: "The Elephant Wall (Hasti Prakara)",
        description: "The surrounding wall featuring hundreds of carved elephant foreparts.",
        referenceImage: "/Element%20Pictures/Ruwanweliseya.jpg",
        hint: "Capture the detailed elephant reliefs lining the stupa base terrace.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
            "question": "Which celebrated king built the Ruwanweliseya Stupa in Anuradhapura?",
            "options": [
                  "King Dutugemunu",
                  "King Devanampiyatissa",
                  "King Mahasen",
                  "King Valagamba"
            ],
            "correctIndex": 0
      },
      {
            "question": "What geometrical shape defines the dome of the Ruwanweliseya?",
            "options": [
                  "Bubbulakara (Bubble shape)",
                  "Dhanyakara (Paddy heap shape)",
                  "Ghantakara (Bell shape)",
                  "Padmakara (Lotus shape)"
            ],
            "correctIndex": 0
      },
      {
            "question": "What protective animal feature lines the outer terrace wall of Ruwanweliseya?",
            "options": [
                  "The Elephant Wall (Hasti Prakara)",
                  "A lion guard ring",
                  "Carved cobras in stone",
                  "Horses and riders"
            ],
            "correctIndex": 0
      },
      {
            "question": "How tall is the pinnacle of the restored Ruwanweliseya Stupa?",
            "options": [
                  "Approximately 103 meters (338 ft)",
                  "55 meters",
                  "140 meters",
                  "75 meters"
            ],
            "correctIndex": 0
      },
      {
            "question": "What precious stone rests atop the crest-gem of Ruwanweliseya's pinnacle?",
            "options": [
                  "A massive Burmese rock crystal",
                  "A blue sapphire",
                  "A star ruby",
                  "A cut diamond"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which material was used in the deep foundation to safeguard against earth tremors?",
            "options": [
                  "Sheets of lead, crushed stone, and herbal resin",
                  "Hollow wooden logs",
                  "Compressed volcanic ash",
                  "Bespoke iron beams"
            ],
            "correctIndex": 0
      },
      {
            "question": "Who oversaw the completion of the stupa after King Dutugemunu fell ill?",
            "options": [
                  "His brother, King Saddhatissa",
                  "His son, Prince Saliya",
                  "King Lanjatissa",
                  "Queen Viharamahadevi"
            ],
            "correctIndex": 0
      },
      {
            "question": "What are the ornamental carved frontispieces at the four cardinal entrances called?",
            "options": [
                  "Vahalkadas",
                  "Toranas",
                  "Gediges",
                  "Makara arches"
            ],
            "correctIndex": 0
      },
      {
            "question": "What sacred relics are believed to be enshrined in greatest quantity inside?",
            "options": [
                  "One-eighth of the bodily relics of Gautama Buddha",
                  "The hair relic exclusively",
                  "The forehead bone (Lalata Dhatu)",
                  "The sacred footprint casting"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the ancient chronicle that details the construction of Ruwanweliseya?",
            "options": [
                  "Mahavamsa",
                  "Culavamsa",
                  "Rajavaliya",
                  "Dipavamsa"
            ],
            "correctIndex": 0
      },
      {
            "question": "What was the original Pali name of Ruwanweliseya in early chronicles?",
            "options": [
                  "Mahathupa (The Great Stupa)",
                  "Thuparamaya",
                  "Jetavanaramaya",
                  "Silachetiya"
            ],
            "correctIndex": 0
      },
      {
            "question": "What sacred tree lies in close walking proximity to Ruwanweliseya?",
            "options": [
                  "Jaya Sri Maha Bodhi",
                  "Anandabodhi",
                  "Kalutara Bodhi",
                  "Matara Bodhi"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the paved stone platform surrounding the stupa dome called?",
            "options": [
                  "Salapatala Maluwa",
                  "Sandakada Pahana",
                  "Vahalkada",
                  "Muragala"
            ],
            "correctIndex": 0
      },
      {
            "question": "What statue stands in homage on the outer courtyard facing Ruwanweliseya?",
            "options": [
                  "Statue of King Dutugemunu",
                  "Statue of King Parakramabahu",
                  "Statue of King Kasyapa",
                  "Statue of Emperor Ashoka"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which monarch is said to have laid the foundation stone using a golden compass rod?",
            "options": [
                  "King Dutugemunu",
                  "King Devanampiyatissa",
                  "King Vasabha",
                  "King Gajabahu"
            ],
            "correctIndex": 0
      },
      {
            "question": "What color is the stupa whitewashed with during pilgrimage festivals?",
            "options": [
                  "Dazzling pure white lime wash",
                  "Golden ochre paint",
                  "Light terracotta wash",
                  "Unglazed natural brick"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which ancient king restored Ruwanweliseya after foreign incursions in the 12th century?",
            "options": [
                  "King Parakramabahu I",
                  "King Vijayabahu I",
                  "King Nissanka Malla",
                  "King Kirti Sri Rajasinha"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the structural square box resting above the stupa dome called?",
            "options": [
                  "Hathares Kotuwa (Square Chamber)",
                  "Devatha Kotuwa",
                  "Koth Kerella",
                  "Yupa pillar"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the spire section featuring concentric stone rings above the square chamber?",
            "options": [
                  "Koth Kerella (Conical Spire)",
                  "Pesawalu rings",
                  "Vahalkada",
                  "Chathra"
            ],
            "correctIndex": 0
      },
      {
            "question": "How many baseline terraces (Pesawalu) circle the base beneath the dome?",
            "options": [
                  "Three concentric terraces",
                  "One flat terrace",
                  "Five steep steps",
                  "Seven ascending tiers"
            ],
            "correctIndex": 0
      }
]
  },
  {
    id: "mihintale",
    name: "Mihintale",
    district: "Anuradhapura District",
    category: "Heritage Trail",
    xp: 220,
    xpRange: "25 - 80 XP",
    distance: "220km",
    openStatus: "Open now",
    description: "The sacred mountain peak revered as the cradle of Buddhism in Sri Lanka, marked by ancient monastic ruins, hospital ruins, and rock inscriptions.",
    image: "/Element%20Pictures/Mihintale.JPG",
    latitude: 8.3508,
    longitude: 80.5186,
    referenceImage: "/Element%20Pictures/Mihintale.JPG",
    checkpoints: [
      {
        id: "mihintale_ambasthala",
        name: "Ambasthala Dagaba",
        description: "The stupa built on the spot where Arahat Mahinda met King Devanampiyatissa.",
        referenceImage: "/Element%20Pictures/Mihintale.JPG",
        hint: "Align the stupa and surrounding stone pillars in your frame.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
            "question": "Why is Mihintale revered as the cradle of Buddhism in Sri Lanka?",
            "options": [
                  "It is where Arahat Mahinda met King Devanampiyatissa in 247 BC",
                  "The Buddha stayed here for 7 years",
                  "The first stupa in Asia was built here",
                  "It was the ancient royal treasury"
            ],
            "correctIndex": 0
      },
      {
            "question": "Who was the royal envoy who introduced Buddhism atop Mihintale?",
            "options": [
                  "Arahat Mahinda",
                  "Arahat Sariputta",
                  "Theri Sanghamitta",
                  "Emperor Ashoka"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which Sri Lankan king converted to Buddhism after meeting Arahat Mahinda?",
            "options": [
                  "King Devanampiyatissa",
                  "King Dutugemunu",
                  "King Pandukabhaya",
                  "King Valagamba"
            ],
            "correctIndex": 0
      },
      {
            "question": "How many granite steps form the grand ceremonial staircase to the mountain top?",
            "options": [
                  "1,840 stone steps",
                  "500 steps",
                  "999 steps",
                  "2,500 steps"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the name of the stupa standing on the exact spot of the historic meeting?",
            "options": [
                  "Ambasthala Dagaba",
                  "Kantaka Cetiya",
                  "Maha Seya",
                  "Indikatu Seya"
            ],
            "correctIndex": 0
      },
      {
            "question": "What does 'Ambasthala' translate to in reference to the monk's riddle?",
            "options": [
                  "Mango tree place",
                  "Hill of gems",
                  "Peak of wisdom",
                  "White stupa hill"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which stupa at Mihintale is celebrated for its early carved stone frontispieces?",
            "options": [
                  "Kantaka Cetiya",
                  "Ambasthala Dagaba",
                  "Maha Seya",
                  "Giri Seya"
            ],
            "correctIndex": 0
      },
      {
            "question": "What unique medical monument is preserved at the foot of Mihintale hill?",
            "options": [
                  "An ancient monastic hospital with a medicinal stone trough",
                  "A royal pharmacy lab",
                  "A hot water sulfur well",
                  "A botanical poison lab"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the name of the wind-swept meditation rock peak overlooking the plains?",
            "options": [
                  "Aradhana Gala",
                  "Pidurangala",
                  "Sigiriya rock",
                  "Alagalla"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the dark pool situated between boulders on the western slope?",
            "options": [
                  "Kaludiya Pokuna",
                  "Sinha Pokuna",
                  "Banda Pokuna",
                  "Tissa Wewa"
            ],
            "correctIndex": 0
      },
      {
            "question": "What animal-headed fountain carved in granite emerges from the rocks at Mihintale?",
            "options": [
                  "Sinha Pokuna (Lion Pond)",
                  "Gaja Pokuna (Elephant Pond)",
                  "Makara Spout",
                  "Horse Fountain"
            ],
            "correctIndex": 0
      },
      {
            "question": "What famous riddle did Arahat Mahinda ask the king before preaching?",
            "options": [
                  "The Mango Tree Riddle testing intellectual comprehension",
                  "The Riddle of the Sphinx",
                  "The Two River Riddle",
                  "The Four Noble Truths Riddle"
            ],
            "correctIndex": 0
      },
      {
            "question": "What festival celebrated in June honors the introduction of Buddhism at Mihintale?",
            "options": [
                  "Poson Poya",
                  "Vesak Poya",
                  "Esala Poya",
                  "Duruthu Poya"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which Indian emperor sent his son Mahinda on this Buddhist mission?",
            "options": [
                  "Emperor Ashoka the Great",
                  "Emperor Chandragupta",
                  "King Kanishka",
                  "Emperor Harsha"
            ],
            "correctIndex": 0
      },
      {
            "question": "What inscription tablets detailing ancient monastery rules stand at the dining hall?",
            "options": [
                  "The Mihintale Slab Inscriptions of King Mahinda IV",
                  "The Badulla Inscription",
                  "The Galle Trilingual Slab",
                  "The Sigiri Graffiti"
            ],
            "correctIndex": 0
      },
      {
            "question": "What feature in the monastic refectory held daily alms rice for hundreds of monks?",
            "options": [
                  "The giant stone 'Rice Boat' (Bat Oruwa)",
                  "Clay storage jars",
                  "Bronze boiling cauldrons",
                  "Granite pantry shelves"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the highest and largest stupa standing on the summit ridge?",
            "options": [
                  "Maha Seya",
                  "Kantaka Cetiya",
                  "Ambasthala Dagaba",
                  "Indikatu Seya"
            ],
            "correctIndex": 0
      },
      {
            "question": "What small stupa at Mihintale yielded ancient inscribed copper plaques?",
            "options": [
                  "Indikatu Seya",
                  "Maha Seya",
                  "Kantaka Cetiya",
                  "Ambasthala"
            ],
            "correctIndex": 0
      },
      {
            "question": "What natural cave provided shelter for Arahat Mahinda during monsoon months?",
            "options": [
                  "Mahinda Guhawa (Mahinda's Bed)",
                  "Cobra Hood Cave",
                  "Dowa Cave",
                  "Fa Hien Cave"
            ],
            "correctIndex": 0
      },
      {
            "question": "What animal was the king hunting when he was stopped by Arahat Mahinda?",
            "options": [
                  "A spotted deer (stag)",
                  "A wild boar",
                  "A leopard",
                  "An elephant"
            ],
            "correctIndex": 0
      }
]
  },
  {
    id: "galle_fort",
    name: "Galle Dutch Fort",
    district: "Galle District",
    category: "Heritage Trail",
    xp: 220,
    xpRange: "25 - 80 XP",
    distance: "125km",
    openStatus: "Open now",
    description: "A coastal fortress built by the Portuguese and fortified by the Dutch, blending European military architecture and South Asian traditions.",
    image: "/Element%20Pictures/Galle%20Fort.jpg",
    latitude: 6.0267,
    longitude: 80.2167,
    referenceImage: "/Element%20Pictures/Galle%20Fort.jpg",
    checkpoints: [
      {
        id: "galle_lighthouse",
        name: "Galle Lighthouse at Point Utrecht",
        description: "The iconic white lighthouse standing atop the southern bastion wall.",
        referenceImage: "/Element%20Pictures/Galle%20Fort.jpg",
        hint: "Frame the full lighthouse tower and rampart wall.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
            "question": "Which European power first established a fort in Galle in 1505?",
            "options": [
                  "The Portuguese",
                  "The Dutch",
                  "The British",
                  "The French"
            ],
            "correctIndex": 0
      },
      {
            "question": "In which year did the Dutch East India Company capture Galle Fort?",
            "options": [
                  "1640",
                  "1505",
                  "1796",
                  "1815"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the name of the iconic white beacon located on Point Utrecht Bastion?",
            "options": [
                  "Galle Lighthouse",
                  "Clock Tower",
                  "Flag Rock",
                  "Triton Bastion"
            ],
            "correctIndex": 0
      },
      {
            "question": "In what year was the present operational Galle Lighthouse erected?",
            "options": [
                  "1939 (rebuilt after 1934 fire)",
                  "1848",
                  "1640",
                  "1905"
            ],
            "correctIndex": 0
      },
      {
            "question": "What monogram of the Dutch East India Company is carved on the Old Gate?",
            "options": [
                  "VOC (Vereenigde Oostindische Compagnie)",
                  "EIC",
                  "DEIC",
                  "CVD"
            ],
            "correctIndex": 0
      },
      {
            "question": "How many substantial stone bastions reinforce the ramparts of Galle Fort?",
            "options": [
                  "14 major bastions",
                  "4 bastions",
                  "8 bastions",
                  "25 bastions"
            ],
            "correctIndex": 0
      },
      {
            "question": "What famous bastion faces the harbor and features the landmark clock tower?",
            "options": [
                  "Moon Bastion",
                  "Star Bastion",
                  "Sun Bastion",
                  "Fishmark Bastion"
            ],
            "correctIndex": 0
      },
      {
            "question": "Who funded the construction of the iconic Galle Fort Clock Tower in 1883?",
            "options": [
                  "Grateful patients of Dr. P. D. Anthonisz",
                  "The Dutch Governor",
                  "Queen Victoria",
                  "The Town Council of Galle"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the oldest Protestant church in Sri Lanka located inside the Fort?",
            "options": [
                  "Groote Kerk (Dutch Reformed Church)",
                  "All Saints' Anglican Church",
                  "St. Mary's Cathedral",
                  "Methodist Chapel"
            ],
            "correctIndex": 0
      },
      {
            "question": "What material makes up the floor of the Groote Kerk inside Galle Fort?",
            "options": [
                  "Gravestones from old Dutch cemeteries",
                  "Italian marble tiles",
                  "Hardwood timber planks",
                  "Red terracotta bricks"
            ],
            "correctIndex": 0
      },
      {
            "question": "Galle Fort was inscribed as a UNESCO World Heritage Site in:",
            "options": [
                  "1988",
                  "1972",
                  "2001",
                  "1965"
            ],
            "correctIndex": 0
      },
      {
            "question": "What natural material forms the robust foundation core of the seaward ramparts?",
            "options": [
                  "Coral stone and granite blocks",
                  "Reinforced concrete",
                  "Sun-baked brick",
                  "Timber piles"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which bastion is famous today for sunset gatherings and cliff jumpers?",
            "options": [
                  "Flag Rock Bastion",
                  "Neptune Bastion",
                  "Aurora Bastion",
                  "Clippenberg Bastion"
            ],
            "correctIndex": 0
      },
      {
            "question": "What historic Dutch commercial building now houses the National Maritime Museum?",
            "options": [
                  "The Dutch Commissariat Warehouse",
                  "The Governor's Residence",
                  "The Dutch Hospital",
                  "The Arsenal Hall"
            ],
            "correctIndex": 0
      },
      {
            "question": "In what year did British forces take possession of Galle without a shot fired?",
            "options": [
                  "1796",
                  "1815",
                  "1802",
                  "1850"
            ],
            "correctIndex": 0
      },
      {
            "question": "What unique underground infrastructure was built by the Dutch to clean the fort?",
            "options": [
                  "Tidal sewer system flushed twice daily by seawater",
                  "Aqueduct pipes from Wakwella",
                  "Deep gravity water pumps",
                  "Freshwater cistern network"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which gate was cut through the ramparts by the British in 1873 to ease traffic?",
            "options": [
                  "The Main Gate",
                  "The Old Sea Gate",
                  "The Lighthouse Arch",
                  "The Water Gate"
            ],
            "correctIndex": 0
      },
      {
            "question": "What traditional lace-making craft is preserved inside the lanes of Galle Fort?",
            "options": [
                  "Beeralu lace weaving",
                  "Batik wax dyeing",
                  "Dumbara mat weaving",
                  "Silk embroidery"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which major literary festival is hosted annually within the fort ramparts?",
            "options": [
                  "Fairway Galle Literary Festival",
                  "Colombo Book Fair",
                  "Kandy Arts Fest",
                  "Ceylon Writers Forum"
            ],
            "correctIndex": 0
      },
      {
            "question": "What ancient bay opposite Galle Fort was historically known to Arab and Persian sailors?",
            "options": [
                  "Port of Tarshish / Galle Harbor",
                  "Trincomalee Deep Harbor",
                  "Colombo Roadstead",
                  "Hambantota Bay"
            ],
            "correctIndex": 0
      }
]
  },
  {
    id: "dambulla_cave",
    name: "Dambulla Cave Temple",
    district: "Matale District",
    category: "Heritage Trail",
    xp: 220,
    xpRange: "25 - 80 XP",
    distance: "148km",
    openStatus: "Open now",
    description: "The largest and best-preserved cave temple complex in Sri Lanka, boasting five sanctuaries filled with statues and ceiling murals spanning over 2,000 years.",
    image: "/Element%20Pictures/Dambulla%20Cave%20Temple.jpg",
    latitude: 7.8567,
    longitude: 80.6483,
    referenceImage: "/Element%20Pictures/Dambulla%20Cave%20Temple.jpg",
    checkpoints: [
      {
        id: "dambulla_cave_two",
        name: "Maharaja Viharaya (Cave of Great Kings)",
        description: "The largest cave containing 56 statues and ceiling murals of historical events.",
        referenceImage: "/Element%20Pictures/Dambulla%20Cave%20Temple.jpg",
        hint: "Frame the painted rock ceiling and row of Buddha statues.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
            "question": "How many main caves comprise the golden rock temple complex of Dambulla?",
            "options": [
                  "5 major cave shrines",
                  "3 caves",
                  "7 caves",
                  "12 caves"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which ancient king took refuge in Dambulla caves before reclaiming his throne?",
            "options": [
                  "King Valagamba (Vattagamani Abhaya)",
                  "King Dutugemunu",
                  "King Kashyapa",
                  "King Parakramabahu"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the largest and most impressive cave known as Cave No. 2 called?",
            "options": [
                  "Maharaja Viharaya (Temple of the Great Kings)",
                  "Devaraja Viharaya",
                  "Maha Alut Viharaya",
                  "Paschima Viharaya"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which 12th-century king gilded 73 Buddha statues in gold and recorded it on stone?",
            "options": [
                  "King Nissanka Malla",
                  "King Parakramabahu I",
                  "King Vijayabahu I",
                  "King Kalinga Magha"
            ],
            "correctIndex": 0
      },
      {
            "question": "What mysterious natural water phenomenon occurs in the ceiling of the second cave?",
            "options": [
                  "A sacred spring drips droplets upwards out of a rock fissure into a gold pot",
                  "A waterfall cascades over the entrance",
                  "A bubbling thermal spring",
                  "Underground river currents"
            ],
            "correctIndex": 0
      },
      {
            "question": "How many statues of Lord Buddha are preserved throughout the Dambulla caves?",
            "options": [
                  "Over 150 Buddha statues",
                  "50 statues",
                  "75 statues",
                  "300 statues"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the length of the colossal reclining Buddha statue in Cave No. 1 (Devaraja)?",
            "options": [
                  "14 meters (46 ft) carved out of solid rock",
                  "7 meters",
                  "25 meters",
                  "35 meters"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which Hindu deities are sculpted and painted beside Buddhist icons in Cave No. 1?",
            "options": [
                  "Vishnu and Saman",
                  "Shiva and Ganesha",
                  "Brahma and Indra",
                  "Surya and Chandra"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the total painted mural ceiling area across the five cave temples?",
            "options": [
                  "Over 2,100 square meters",
                  "500 sq meters",
                  "1,000 sq meters",
                  "4,500 sq meters"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which Kandyan king extensively restored and added the fifth cave (Devana Alut Viharaya)?",
            "options": [
                  "King Kirti Sri Rajasinha",
                  "King Sri Vikrama Rajasinha",
                  "King Vimaladharmasuriya I",
                  "King Rajasinghe II"
            ],
            "correctIndex": 0
      },
      {
            "question": "What stands at the base of the mountain leading to the stone steps?",
            "options": [
                  "The modern Golden Temple with a massive gilded Buddha statue",
                  "A defensive fortress wall",
                  "A lake with lotus fountains",
                  "An ancient marble dagoba"
            ],
            "correctIndex": 0
      },
      {
            "question": "How high is the granite rock plateau above the surrounding plains?",
            "options": [
                  "160 meters (525 ft)",
                  "50 meters",
                  "300 meters",
                  "500 meters"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which prehistoric archaeological cemetery is located near Dambulla?",
            "options": [
                  "Ibbankatuwa Megalithic Tombs",
                  "Pomparippu",
                  "Batadombalena",
                  "Bellanbandi Palassa"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the name of Cave No. 3 constructed by Kirti Sri Rajasinha?",
            "options": [
                  "Maha Alut Viharaya (Great New Temple)",
                  "Devaraja Viharaya",
                  "Paschima Viharaya",
                  "Maharaja Viharaya"
            ],
            "correctIndex": 0
      },
      {
            "question": "What royal figure's statue stands inside Cave No. 2 beside the Buddha?",
            "options": [
                  "King Valagamba",
                  "King Dutugemunu",
                  "King Devanampiyatissa",
                  "King Kashyapa"
            ],
            "correctIndex": 0
      },
      {
            "question": "Dambulla was inscribed as a UNESCO World Heritage Site in:",
            "options": [
                  "1991",
                  "1982",
                  "2001",
                  "1978"
            ],
            "correctIndex": 0
      },
      {
            "question": "What scene is dramatically painted on the ceiling depicting King Dutugemunu?",
            "options": [
                  "The battle between King Dutugemunu and King Elara",
                  "The coronation at Kandy",
                  "The landing of Vijaya",
                  "The building of Sigiriya"
            ],
            "correctIndex": 0
      },
      {
            "question": "What architectural feature was built outside the caves during colonial times?",
            "options": [
                  "White-arched colonnaded verandahs",
                  "Red brick parapets",
                  "Timber drawbridges",
                  "Iron gate cages"
            ],
            "correctIndex": 0
      },
      {
            "question": "What tree grows on the rock terrace outside the cave entrances?",
            "options": [
                  "A sacred Bodhi Tree",
                  "A royal Na tree",
                  "An ancient Banyan",
                  "A Frangipani grove"
            ],
            "correctIndex": 0
      },
      {
            "question": "What ancient script appears in drip-ledge inscriptions recording donations to monks?",
            "options": [
                  "Early Brahmi script (3rd-2nd century BC)",
                  "Medieval Sinhala",
                  "Grantha script",
                  "Nagari script"
            ],
            "correctIndex": 0
      }
]
  },

  // --- HIDDEN GEMS ---
  {
    id: "ritigala",
    name: "Ritigala Monastery",
    district: "Anuradhapura District",
    category: "Hidden Gems",
    xp: 220,
    xpRange: "75 - 100 XP",
    distance: "195km",
    openStatus: "Open now",
    description: "An ancient mountain range housing ruins of an austere forest monastery, renowned for its Padhanaghara double-platforms, stone-paved walkways, and rare herbal gardens.",
    image: "/Element%20Pictures/Ritigala%20Monastery.jpg",
    latitude: 8.1139,
    longitude: 80.6558,
    referenceImage: "/Element%20Pictures/Ritigala%20Monastery.jpg",
    checkpoints: [
      {
        id: "ritigala_banda_pokuna",
        name: "Banda Pokuna Reservoir",
        description: "The massive ancient stone-faced bath and reservoir at the base of the trail.",
        referenceImage: "/Element%20Pictures/Ritigala%20Monastery.jpg",
        hint: "Frame the ancient stone bund steps and reservoir entrance.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
            "question": "What type of Buddhist monastic retreat was Ritigala in ancient Ceylon?",
            "options": [
                  "A strict forest meditation hermitage (Padhanaghara)",
                  "A grand royal college",
                  "A seaside trading monastery",
                  "A temple of sacred tooth relics"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which fraternity of ascetic monks inhabited the misty slopes of Ritigala?",
            "options": [
                  "Pamsukulika (rag-robe wearing) fraternity",
                  "Theravada royal preceptors",
                  "Mahayana bronze casters",
                  "Foreign Tibetan hermits"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the unique architectural hallmark of the monastic buildings at Ritigala?",
            "options": [
                  "Double-platform structures without ornamental carvings",
                  "Multi-tiered gold pagodas",
                  "Cave paintings of dancers",
                  "High circular brick stupas"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the only carved stone item permitted in strict Padhanaghara monasteries?",
            "options": [
                  "Ornate stone urinal slabs (Kakkapada)",
                  "Moonstone door thresholds",
                  "Carved guardstones",
                  "Dragon archways"
            ],
            "correctIndex": 0
      },
      {
            "question": "Why were urinal slabs intentionally the only carved elements in these monasteries?",
            "options": [
                  "To symbolize utter contempt for worldly desires and royal luxury",
                  "To filter cleaning water",
                  "As architectural trademarks",
                  "To honor donor chieftains"
            ],
            "correctIndex": 0
      },
      {
            "question": "What massive stone-lined reservoir stands near the entry to Ritigala?",
            "options": [
                  "Banda Pokuna",
                  "Sinha Pokuna",
                  "Kaludiya Pokuna",
                  "Kuttam Pokuna"
            ],
            "correctIndex": 0
      },
      {
            "question": "How is Ritigala mountain botanically unique compared to the surrounding dry plains?",
            "options": [
                  "It harbors an isolated wet-zone microclimate with rare medicinal flora",
                  "It is bare volcanic ash",
                  "It grows exclusively pine trees",
                  "It is surrounded by mangrove swamps"
            ],
            "correctIndex": 0
      },
      {
            "question": "According to legend in the Ramayana, what was dropped at Ritigala by Hanuman?",
            "options": [
                  "A chunk of the Himalayan Sanjeevani medicinal herb mountain",
                  "Ravana's golden bow",
                  "The nectar of immortality",
                  "Sita's diamond jewel"
            ],
            "correctIndex": 0
      },
      {
            "question": "What paved infrastructure traverses the steep jungle slopes connecting cells?",
            "options": [
                  "Polished polygonal stone paths and stepped bridges",
                  "Wooden suspension bridges",
                  "Underground brick canals",
                  "Clay-paved pathways"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the highest peak elevation in the Ritigala mountain ridge?",
            "options": [
                  "766 meters (2,513 ft)",
                  "320 meters",
                  "1,200 meters",
                  "500 meters"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which ancient king took refuge at Ritigala during his war against King Elara?",
            "options": [
                  "Prince Dutugemunu",
                  "King Valagamba",
                  "King Vasabha",
                  "King Mahasen"
            ],
            "correctIndex": 0
      },
      {
            "question": "In which ancient chronicle is Ritigala referred to as 'Aritha Pabbatha'?",
            "options": [
                  "Mahavamsa",
                  "Dipavamsa",
                  "Culavamsa",
                  "Thupavamsa"
            ],
            "correctIndex": 0
      },
      {
            "question": "What medicinal installation was discovered amongst the ruins of Ritigala?",
            "options": [
                  "Stone ayurvedic medicine grinding troughs and herbal baths",
                  "A metal surgical theatre",
                  "A glass distillation furnace",
                  "A salt therapy room"
            ],
            "correctIndex": 0
      },
      {
            "question": "Why are there no Buddha statues constructed in the historic ruins of Ritigala?",
            "options": [
                  "The Pamsukulika monks focused on formless Vipassana meditation",
                  "Statues were stolen by invaders",
                  "Statues were banned by royal decree",
                  "They worshiped fire altars"
            ],
            "correctIndex": 0
      },
      {
            "question": "What legal status protects the Ritigala mountain range today?",
            "options": [
                  "Strict Nature Reserve (Department of Wildlife Conservation)",
                  "Commercial Forest Reserve",
                  "Public Recreation Park",
                  "Agricultural Settlement"
            ],
            "correctIndex": 0
      },
      {
            "question": "What natural water system supplied cooling to the meditation platforms?",
            "options": [
                  "Natural stream channels diverted across stone slabs",
                  "Deep groundwater boreholes",
                  "Wooden water pipelines",
                  "Storage in metal tanks"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which queen is historically recorded as having granted endowments to Ritigala?",
            "options": [
                  "Queen Sena (consort of King Dappula II)",
                  "Queen Anula",
                  "Queen Kalyanavati",
                  "Queen Lilavati"
            ],
            "correctIndex": 0
      },
      {
            "question": "What birds are frequently sighted in the upper cloud forest of Ritigala?",
            "options": [
                  "Endemic Ceylon Spurfowl and Grey Hornbills",
                  "Coastal seagulls",
                  "Migratory flamingos",
                  "Sandpipers"
            ],
            "correctIndex": 0
      },
      {
            "question": "What ancient military commander lived as a recluse in Ritigala according to folklore?",
            "options": [
                  "Giant Phussadeva (one of Dutugemunu's ten giants)",
                  "General Velusumana",
                  "General Theraputtubhaya",
                  "Nandhimithra"
            ],
            "correctIndex": 0
      },
      {
            "question": "How does the soundscape at Ritigala benefit the monks' practice?",
            "options": [
                  "Absolute silence broken only by wind and trickling mountain streams",
                  "Echoes of temple bells",
                  "Chanting echoing through caves",
                  "Sounds of royal drums"
            ],
            "correctIndex": 0
      }
]
  },
  {
    id: "dowa_temple",
    name: "Dowa Rock Temple",
    district: "Badulla District",
    category: "Hidden Gems",
    xp: 220,
    xpRange: "75 - 100 XP",
    distance: "180km",
    openStatus: "Open now",
    description: "A historic cave temple tucked into the Uva hills, famous for its 38-foot unfinished standing Buddha statue carved directly into a sheer rock cliff.",
    image: "/Element%20Pictures/Dowa%20Rock%20Temple.jpg",
    latitude: 6.8202,
    longitude: 81.0255,
    referenceImage: "/Element%20Pictures/Dowa%20Rock%20Temple.jpg",
    checkpoints: [
      {
        id: "dowa_standing_buddha",
        name: "38-Foot Cliff Carved Buddha",
        description: "The colossal rock-cut standing Buddha carved into the mountain face.",
        referenceImage: "/Element%20Pictures/Dowa%20Rock%20Temple.jpg",
        hint: "Align the full height of the rock-cut statue in your frame.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
            "question": "What is the most famous exterior archaeological feature at Dowa Rock Temple?",
            "options": [
                  "A 38-foot unfinished rock-cut standing Buddha statue",
                  "A golden reclining Buddha",
                  "A double stone ring stupa",
                  "A crystal fountain"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which Sri Lankan monarch is traditionally linked to the founding of Dowa Temple?",
            "options": [
                  "King Valagamba (1st century BC)",
                  "King Dutugemunu",
                  "King Kirti Sri Rajasinha",
                  "King Nissanka Malla"
            ],
            "correctIndex": 0
      },
      {
            "question": "In which province is Dowa Rock Temple located?",
            "options": [
                  "Uva Province (near Bandarawela)",
                  "Central Province",
                  "Sabaragamuwa Province",
                  "Southern Province"
            ],
            "correctIndex": 0
      },
      {
            "question": "What artistic period do the vibrant inner cave murals belong to?",
            "options": [
                  "Kandyan Kingdom era (17th-18th century)",
                  "Early Anuradhapura period",
                  "Modern 20th century",
                  "Dambadeniya era"
            ],
            "correctIndex": 0
      },
      {
            "question": "What dramatic mythical creature is painted on the ceiling of the shrine cave?",
            "options": [
                  "A giant cobra wrestling a Russell's viper",
                  "A golden garuda bird",
                  "A flying peacock dragon",
                  "A sea monster"
            ],
            "correctIndex": 0
      },
      {
            "question": "Why is the colossal standing Buddha statue considered unfinished?",
            "options": [
                  "The lower body and feet remain partially carved from the cliff face",
                  "The head is missing",
                  "The right arm was broken",
                  "It lacks pigment paint"
            ],
            "correctIndex": 0
      },
      {
            "question": "What secret escape infrastructure is legendary within the cave shrine?",
            "options": [
                  "A secret subterranean tunnel said to lead to Ravana Ella",
                  "An iron elevator shaft",
                  "A stone-walled boat canal",
                  "A cliffside ropeway"
            ],
            "correctIndex": 0
      },
      {
            "question": "What natural stream flows gently near the base of the rock temple?",
            "options": [
                  "Badulu Oya tributary",
                  "Mahaweli River",
                  "Kelani River",
                  "Menik Ganga"
            ],
            "correctIndex": 0
      },
      {
            "question": "What gesture (Mudra) is displayed by the standing rock-carved Buddha at Dowa?",
            "options": [
                  "Abhaya Mudra (Gesture of fearlessness)",
                  "Dharmachakra Mudra",
                  "Bhumisparsha Mudra",
                  "Dhyana Mudra"
            ],
            "correctIndex": 0
      },
      {
            "question": "What clay material forms the reclining Buddha inside the inner cave?",
            "options": [
                  "Stucco and sculpted clay over stone core",
                  "Carved white marble",
                  "Solid cast copper",
                  "Sun-baked river silt"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which guardian deities guard the painted doorway to the inner sanctum?",
            "options": [
                  "Door guardians (Dvarapalas) with royal swords",
                  "Naga kings with multi-heads",
                  "Chola warriors",
                  "British sentinels"
            ],
            "correctIndex": 0
      },
      {
            "question": "Why did King Valagamba seek refuge in the hill caves of Dowa?",
            "options": [
                  "To hide and gather an army against South Indian invaders",
                  "To escape a palace fire",
                  "To study botanical herbs",
                  "To avoid royal court duties"
            ],
            "correctIndex": 0
      },
      {
            "question": "What distinctive feature surrounds the head of Buddha figures in the ceiling murals?",
            "options": [
                  "Radiant halos of divine light (Rasmala)",
                  "Crowns of pure gold",
                  "Garlands of jasmine flowers",
                  "Helmets of iron"
            ],
            "correctIndex": 0
      },
      {
            "question": "What town is Dowa Temple situated between?",
            "options": [
                  "Bandarawela and Badulla",
                  "Kandy and Matale",
                  "Galle and Matara",
                  "Ella and Wellawaya"
            ],
            "correctIndex": 0
      },
      {
            "question": "What structure on the upper rock terrace holds sacred Bo tree rituals?",
            "options": [
                  "The Bodhigara terrace",
                  "The Bell Tower",
                  "The Vahalkada",
                  "The Sandakada Pahana"
            ],
            "correctIndex": 0
      },
      {
            "question": "What animal sculpture rests alongside the ancient stupa at the temple?",
            "options": [
                  "Elephant figures",
                  "Lions",
                  "Peacocks",
                  "Cobras"
            ],
            "correctIndex": 0
      },
      {
            "question": "What color predominantly backgrounded the Kandyan period wall murals at Dowa?",
            "options": [
                  "Deep crimson red and warm yellow",
                  "Cobalt blue",
                  "Emerald green",
                  "Charcoal black"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which ancient king is recorded as having provided state patronage to renew Dowa in the 18th century?",
            "options": [
                  "King Kirti Sri Rajasinha",
                  "King Sri Vikrama Rajasinha",
                  "King Rajasinghe I",
                  "King Senarat"
            ],
            "correctIndex": 0
      },
      {
            "question": "What natural rock shelter preserves the paintings from monsoon degradation?",
            "options": [
                  "A wide natural rock drip overhang",
                  "A glass protective facade",
                  "An iron zinc canopy",
                  "Concrete buttresses"
            ],
            "correctIndex": 0
      },
      {
            "question": "What does the Sinhala word 'Dowa' historically refer to?",
            "options": [
                  "A deep valley or ring of hills",
                  "A golden statue",
                  "A royal river",
                  "A rock fortress"
            ],
            "correctIndex": 0
      }
]
  },
  {
    id: "yudaganawa",
    name: "Yudaganawa",
    district: "Monaragala District",
    category: "Hidden Gems",
    xp: 220,
    xpRange: "75 - 100 XP",
    distance: "230km",
    openStatus: "Open now",
    description: "A colossal 12th-century stupa built in the Kota Vehera style on the historical battleground where Prince Dutugemunu and Prince Tissa clashed for the throne.",
    image: "/Element%20Pictures/Yudaganawa.jpg",
    latitude: 6.7292,
    longitude: 81.2831,
    referenceImage: "/Element%20Pictures/Yudaganawa.jpg",
    checkpoints: [
      {
        id: "yudaganawa_dome",
        name: "Yudaganawa Kota Vehera",
        description: "The massive flat-topped ancient stupa mound.",
        referenceImage: "/Element%20Pictures/Yudaganawa.jpg",
        hint: "Capture the vast circular brick terrace and perimeter mound.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
            "question": "What monumental architectural style is displayed by the Yudaganawa Stupa?",
            "options": [
                  "Kota Vehera (Truncated colossal stupa mound)",
                  "Bell shape (Ghantakara)",
                  "Bubble shape (Bubbulakara)",
                  "Lotus shape"
            ],
            "correctIndex": 0
      },
      {
            "question": "What historic event occurred at Yudaganawa in the 2nd century BC?",
            "options": [
                  "The battle between Prince Dutugemunu and Prince Tissa over the crown",
                  "The signing of the peace treaty with Rome",
                  "The arrival of Arahat Mahinda",
                  "The foundation of the Ruhuna kingdom"
            ],
            "correctIndex": 0
      },
      {
            "question": "What does the name 'Yudaganawa' translate to in Sinhala?",
            "options": [
                  "Arena of Battle / Battleground",
                  "Peaceful Lake",
                  "Temple of the Lotus",
                  "Royal Citadel"
            ],
            "correctIndex": 0
      },
      {
            "question": "Near which town in Monaragala district is Yudaganawa situated?",
            "options": [
                  "Buttala",
                  "Monaragala town",
                  "Wellawaya",
                  "Bibile"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the approximate circumference of the massive Yudaganawa Stupa base?",
            "options": [
                  "Over 310 meters (1,000 ft)",
                  "100 meters",
                  "50 meters",
                  "500 meters"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which 12th-century king is believed to have rebuilt the stupa in memory of his mother Queen Ratnavali?",
            "options": [
                  "King Parakramabahu the Great",
                  "King Dutugemunu",
                  "King Vijayabahu I",
                  "King Nissanka Malla"
            ],
            "correctIndex": 0
      },
      {
            "question": "What large irrigation reservoir sits adjacent to the stupa grounds?",
            "options": [
                  "Yudaganawa Wewa",
                  "Senanayake Samudra",
                  "Kala Wewa",
                  "Tissa Wewa"
            ],
            "correctIndex": 0
      },
      {
            "question": "What ancient image house (Patimaghara) ruins stand near the stupa?",
            "options": [
                  "A classic brick shrine with thick walls and Buddha plinths",
                  "A subterranean stone cavern",
                  "A wooden pavilion",
                  "A marble cloister"
            ],
            "correctIndex": 0
      },
      {
            "question": "Why did Prince Tissa flee into the nearby monastery after losing the battle?",
            "options": [
                  "To seek Buddhist monk sanctuary from his brother Dutugemunu",
                  "To escape wild elephants",
                  "To hide the royal gold",
                  "To sail down the river"
            ],
            "correctIndex": 0
      },
      {
            "question": "How did the monks secretly carry Prince Tissa out of the monastery to safety?",
            "options": [
                  "Carried him on a monk's stretcher wrapped as a deceased monk",
                  "Disguised him in merchant robes",
                  "Hid him in an alms bowl boat",
                  "Escorted him behind armed guards"
            ],
            "correctIndex": 0
      },
      {
            "question": "What did Prince Dutugemunu famously declare when he recognized Tissa on the stretcher?",
            "options": [
                  "He recognized his brother's feet and respected the monks' sacred boundary",
                  "He ordered an immediate arrest",
                  "He shot an arrow into the litter",
                  "He renounced his claim to the throne"
            ],
            "correctIndex": 0
      },
      {
            "question": "What ancient brick composition makes up the core of Yudaganawa stupa?",
            "options": [
                  "Large ancient burnt clay bricks with lime mortar",
                  "Sun-dried mud blocks",
                  "Hollow terracotta tiles",
                  "Granite blocks only"
            ],
            "correctIndex": 0
      },
      {
            "question": "What ancient kingdom territory did Yudaganawa belong to?",
            "options": [
                  "The Southern Principality of Ruhuna",
                  "Maya Rata",
                  "Rajarata",
                  "Jaffna Kingdom"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the flat upper plateau atop the truncated stupa dome today?",
            "options": [
                  "An expansive brick and grassy circular platform",
                  "A modern bell spire",
                  "A golden pavilion",
                  "A concrete viewing deck"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which floral tribute is traditionally offered by pilgrims visiting Yudaganawa?",
            "options": [
                  "Lotus and Water Lily blossoms from Yudaganawa Wewa",
                  "Temple Frangipani only",
                  "Imported orchids",
                  "Jasmine wreaths"
            ],
            "correctIndex": 0
      },
      {
            "question": "What archaeological museum is located within the temple premises?",
            "options": [
                  "Yudaganawa Site Museum displaying excavated stone artifacts",
                  "Uva Mineral Archive",
                  "Military History Room",
                  "Maritime Artifacts Hall"
            ],
            "correctIndex": 0
      },
      {
            "question": "What decorative motif lines the entrance steps to the image house?",
            "options": [
                  "Carved stone Makara balustrades and guardstones",
                  "Lion paws only",
                  "Plain wooden railings",
                  "Iron spikes"
            ],
            "correctIndex": 0
      },
      {
            "question": "Who intervened between Prince Dutugemunu and Prince Tissa to reconcile them?",
            "options": [
                  "Venerable Goddhadatta Thera",
                  "Arahat Mahinda",
                  "Queen Viharamahadevi",
                  "King Kavantissa"
            ],
            "correctIndex": 0
      },
      {
            "question": "What weapon was used by Prince Dutugemunu in the battle at Yudaganawa?",
            "options": [
                  "Mounted on his mare fighting against Tissa on the royal tusker Kandula",
                  "Archery duel on foot",
                  "Chariot javelin throw",
                  "A duel with broadswords"
            ],
            "correctIndex": 0
      },
      {
            "question": "What does the surrounding dry-zone landscape consist of around Yudaganawa?",
            "options": [
                  "Lush paddy tracts irrigated by ancient canal networks",
                  "Dense highland rainforest",
                  "Coastal sand bars",
                  "Salt pan flats"
            ],
            "correctIndex": 0
      }
]
  },
  {
    id: "pilikuttuwa",
    name: "Pilikuttuwa Temple",
    district: "Gampaha District",
    category: "Hidden Gems",
    xp: 220,
    xpRange: "75 - 100 XP",
    distance: "35km",
    openStatus: "Open now",
    description: "An ancient forest cave monastery complex featuring 99 drip-ledged rock caves, historic Kandyan-period murals, and an ancient wooden bridge.",
    image: "/Element%20Pictures/Pilikuttuwa%20Temple.jpg",
    latitude: 6.8465,
    longitude: 79.9933,
    referenceImage: "/Element%20Pictures/Pilikuttuwa%20Temple.jpg",
    checkpoints: [
      {
        id: "pilikuttuwa_bridge",
        name: "Historic Wooden Canopy Bridge",
        description: "The Dutch/Kandyan-era wooden bridge spanning the natural stream.",
        referenceImage: "/Element%20Pictures/Pilikuttuwa%20Temple.jpg",
        hint: "Align the wooden arch railing and stream walkway in your frame.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
            "question": "How many drip-ledged rock shelter caves are cataloged in the Pilikuttuwa forest complex?",
            "options": [
                  "99 drip-ledged caves",
                  "12 caves",
                  "35 caves",
                  "150 caves"
            ],
            "correctIndex": 0
      },
      {
            "question": "In which administrative district is Pilikuttuwa Raja Maha Vihara situated?",
            "options": [
                  "Gampaha District (Kelaniya valley)",
                  "Colombo District",
                  "Kandy District",
                  "Kurunegala District"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which historic bridge structure is preserved within the grounds of Pilikuttuwa?",
            "options": [
                  "An ancient Dutch-era wooden canopy bridge over a stream",
                  "A Roman stone arch bridge",
                  "A suspension rope bridge",
                  "An iron girder bridge"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which king used Pilikuttuwa caves as a covert refuge during South Indian invasions?",
            "options": [
                  "King Valagamba",
                  "King Dutugemunu",
                  "King Vijayabahu I",
                  "King Kasyapa"
            ],
            "correctIndex": 0
      },
      {
            "question": "What architectural purpose does the carved drip-ledge (Kataraya) serve on the caves?",
            "options": [
                  "Diverts monsoon rainwater off the rock face to keep the cave interior dry",
                  "Acts as an ornamental crown",
                  "Funnels drinking water inside",
                  "Marks the ownership of the donor"
            ],
            "correctIndex": 0
      },
      {
            "question": "What artistic school is reflected in the cave shrine murals at Pilikuttuwa?",
            "options": [
                  "Kandyan mural style and early transitional colonial art",
                  "Anuradhapura court style",
                  "Impressionist oil style",
                  "Chola metal engraving"
            ],
            "correctIndex": 0
      },
      {
            "question": "What rare ancient tree is protected on the summit boulder of Pilikuttuwa?",
            "options": [
                  "An ancient Pus-wela (giant Entada vine)",
                  "A mountain fir tree",
                  "A baobab tree",
                  "A weeping willow"
            ],
            "correctIndex": 0
      },
      {
            "question": "What type of pre-Christian inscriptions are carved below the cave drip-ledges?",
            "options": [
                  "Early Brahmi inscriptions donating caves to the Sangha",
                  "Dutch commercial tax tallies",
                  "Portuguese Catholic verses",
                  "Medieval Sinhala poems"
            ],
            "correctIndex": 0
      },
      {
            "question": "What royal gift was given by King Kirti Sri Rajasinha to restore the temple in the 18th century?",
            "options": [
                  "A royal land grant decree (Tudapatha)",
                  "A golden crown",
                  "A company of war elephants",
                  "A bronze bell from Holland"
            ],
            "correctIndex": 0
      },
      {
            "question": "What animal painting on the cave ceiling demonstrates indigenous astronomical motifs?",
            "options": [
                  "Zodiac symbols and astrological animal figures",
                  "War elephants only",
                  "Sea turtles",
                  "Hunting falcons"
            ],
            "correctIndex": 0
      },
      {
            "question": "What natural water source runs through the monastery valley?",
            "options": [
                  "A gentle freshwater forest stream (Oya)",
                  "A subterranean hot geyser",
                  "A stagnant saltwater creek",
                  "An artificial canal from Colombo"
            ],
            "correctIndex": 0
      },
      {
            "question": "What colonial empire built military watch outposts nearby along the low country trade route?",
            "options": [
                  "The Dutch East India Company",
                  "The French Navy",
                  "The Spanish Armada",
                  "The Danish Trading Guild"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which ancient kingdom had close administrative ties to Pilikuttuwa in the 15th century?",
            "options": [
                  "The Kingdom of Kotte",
                  "The Kingdom of Jaffna",
                  "The Kingdom of Gampola",
                  "The Kingdom of Sitawaka"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the shape of the ancient stone stepped path ascending through the forest?",
            "options": [
                  "Stone-cut steps weaving between granite boulders and ferns",
                  "A straight modern concrete ramp",
                  "A wooden escalator",
                  "A tunnel cut through mud"
            ],
            "correctIndex": 0
      },
      {
            "question": "What mythical creature guards the doorway of the main cave image shrine?",
            "options": [
                  "Makara Thorana (Dragon Arch)",
                  "Gorgon head",
                  "Winged bull",
                  "Sphinx"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the posture of the main Buddha statue inside the principal rock cave?",
            "options": [
                  "Reclining Buddha (Parinirvana posture)",
                  "Seated in Bhumisparsha",
                  "Standing with hands crossed",
                  "Walking posture"
            ],
            "correctIndex": 0
      },
      {
            "question": "What type of roof tiles are fitted to the ancient wooden bridge cover?",
            "options": [
                  "Peti Ulu (flat clay tiles)",
                  "Spanish terracotta tiles",
                  "Corrugated asbestos",
                  "Tin shingles"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which nearby temple belongs to the same network of low-country cave hermitages?",
            "options": [
                  "Varana Raja Maha Vihara",
                  "Dambulla",
                  "Mihintale",
                  "Aluvihare"
            ],
            "correctIndex": 0
      },
      {
            "question": "What folklore surrounds the hollow interiors of certain caves at Pilikuttuwa?",
            "options": [
                  "Hidden caches of King Valagamba's royal treasure",
                  "Underground passages to India",
                  "Dragon nests",
                  "Diamond mines"
            ],
            "correctIndex": 0
      },
      {
            "question": "Why is Pilikuttuwa praised by modern eco-travelers?",
            "options": [
                  "For serene forest birdwatching and tranquil meditation atmosphere",
                  "For high-altitude rock climbing",
                  "For motorboat races",
                  "For safari jeep tours"
            ],
            "correctIndex": 0
      }
]
  },
  {
    id: "maligawila",
    name: "Maligawila Statue",
    district: "Monaragala District",
    category: "Hidden Gems",
    xp: 220,
    xpRange: "75 - 100 XP",
    distance: "240km",
    openStatus: "Open now",
    description: "A free-standing 7th-century Buddha statue measuring over 37 feet tall, sculpted from a single crystalline limestone boulder deep in the southeastern forest.",
    image: "/Element%20Pictures/maligawila%20buddha%20statue.jpg",
    latitude: 6.7352,
    longitude: 81.3392,
    referenceImage: "/Element%20Pictures/maligawila%20buddha%20statue.jpg",
    checkpoints: [
      {
        id: "maligawila_limestone_statue",
        name: "Free-standing Limestone Buddha",
        description: "The towering 37-foot free-standing limestone Buddha statue.",
        referenceImage: "/Element%20Pictures/maligawila%20buddha%20statue.jpg",
        hint: "Frame the majestic standing Buddha statue in its forested sanctuary.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
            "question": "What is the height of the colossal standing Buddha statue at Maligawila?",
            "options": [
                  "Approximately 11.5 meters (37.8 ft)",
                  "5 meters",
                  "25 meters",
                  "45 meters"
            ],
            "correctIndex": 0
      },
      {
            "question": "What crystalline material was used to carve the entire free-standing Maligawila statue?",
            "options": [
                  "A single block of crystalline limestone",
                  "Black basalt rock",
                  "Carved granite boulders",
                  "Cast bronze alloy"
            ],
            "correctIndex": 0
      },
      {
            "question": "In which century was the colossal Maligawila statue sculpted?",
            "options": [
                  "7th century AD",
                  "2nd century BC",
                  "12th century AD",
                  "18th century AD"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which royal prince of Ruhuna is credited in the Culavamsa with commissioning the statue?",
            "options": [
                  "Prince Agbo (Agrabodhi)",
                  "Prince Dutugemunu",
                  "Prince Kashyapa",
                  "Prince Mahinda"
            ],
            "correctIndex": 0
      },
      {
            "question": "In what tragic state was the statue found before its complex modern restoration in 1991?",
            "options": [
                  "Fallen and shattered into several massive pieces in dense forest",
                  "Submerged beneath a reservoir",
                  "Buried under sand dunes",
                  "Standing intact under a golden canopy"
            ],
            "correctIndex": 0
      },
      {
            "question": "What companion colossal statue stands at the nearby archaeological site of Dambegoda?",
            "options": [
                  "Avalokiteshvara Bodhisattva (Maithree Bodhisattva)",
                  "King Dutugemunu",
                  "God Vishnu",
                  "Arahat Mahinda"
            ],
            "correctIndex": 0
      },
      {
            "question": "What ancient monumental structure originally enclosed the standing Maligawila statue?",
            "options": [
                  "A colossal brick Image House (Patimaghara)",
                  "An open-air stone quarry",
                  "A wooden pavilion on stilts",
                  "A circular stone vatadage"
            ],
            "correctIndex": 0
      },
      {
            "question": "What was the thickness of the brick walls of the ancient Image House enclosing the statue?",
            "options": [
                  "Over 2 meters thick to support a vaulted roof",
                  "0.5 meters",
                  "5 meters",
                  "Thin clay partitions"
            ],
            "correctIndex": 0
      },
      {
            "question": "In which district of southeastern Sri Lanka is Maligawila located?",
            "options": [
                  "Monaragala District (near Okkampitiya)",
                  "Badulla District",
                  "Hambantota District",
                  "Ampara District"
            ],
            "correctIndex": 0
      },
      {
            "question": "What Mudra (hand gesture) is depicted by the right hand of the Maligawila Buddha?",
            "options": [
                  "Asisa Mudra (Gesture of blessing) / Abhaya Mudra",
                  "Dhyana Mudra (Meditation)",
                  "Dharmachakra Mudra",
                  "Varada Mudra"
            ],
            "correctIndex": 0
      },
      {
            "question": "What distinctive feature is carved into the crown of the companion Dambegoda Bodhisattva?",
            "options": [
                  "A miniature seated figure of Amitabha Buddha",
                  "A jeweled serpent",
                  "A royal crest gem",
                  "A blazing sun symbol"
            ],
            "correctIndex": 0
      },
      {
            "question": "Who led the daring engineering restoration that re-erected the broken statue in 1991?",
            "options": [
                  "The Department of Archaeology with local and UNESCO engineers",
                  "British naval engineers",
                  "Japanese sculptors",
                  "Private gem miners"
            ],
            "correctIndex": 0
      },
      {
            "question": "What was the ancient name of the monastic hospital and sanctuary complex at Maligawila?",
            "options": [
                  "Ariyakara Vihara",
                  "Mahavihara",
                  "Abhayagiri",
                  "Dakshina Vihara"
            ],
            "correctIndex": 0
      },
      {
            "question": "Why is the limestone statue white and cream in hue compared to granite works?",
            "options": [
                  "The crystalline limestone naturally contains calcite veins",
                  "It was painted with white lime paint recently",
                  "It was bleached by jungle fires",
                  "It was imported from Italy"
            ],
            "correctIndex": 0
      },
      {
            "question": "What natural river system provides irrigation to the lush forest around Maligawila?",
            "options": [
                  "Kumbukkan Oya river basin",
                  "Mahaweli River",
                  "Nilwala River",
                  "Kelani Ganga"
            ],
            "correctIndex": 0
      },
      {
            "question": "What stone plinth supports the tremendous multi-ton weight of the statue?",
            "options": [
                  "A deeply anchored lotus petal pedestal (Padmasana)",
                  "A plain wooden beam",
                  "A clay foundation",
                  "An iron balance frame"
            ],
            "correctIndex": 0
      },
      {
            "question": "What feature of the robe (Civara) demonstrates master classical sculpting technique?",
            "options": [
                  "Thin, cascading parallel robe folds gracefully clinging to the body",
                  "Heavy woolen folds",
                  "Carved dragon embroidery",
                  "Geometric diamond patterns"
            ],
            "correctIndex": 0
      },
      {
            "question": "What type of jungle flora surrounds the archaeological sanctuary of Maligawila today?",
            "options": [
                  "Dry-zone semi-evergreen monsoon forest",
                  "Highland tea plantations",
                  "Pine tree groves",
                  "Mangrove wetlands"
            ],
            "correctIndex": 0
      },
      {
            "question": "What happened to the eyes of the statue during treasure hunting attacks in the 19th century?",
            "options": [
                  "Vandals damaged the face hunting for legendary gemstone eyes",
                  "They melted in a fire",
                  "They were relocated to a museum",
                  "They were sealed with gold plates"
            ],
            "correctIndex": 0
      },
      {
            "question": "Why is Maligawila celebrated in Asian art history circles?",
            "options": [
                  "It is the largest free-standing limestone Buddha statue in the world",
                  "It is the oldest bronze casting in Asia",
                  "It is the tallest brick stupa",
                  "It contains the earliest written book"
            ],
            "correctIndex": 0
      }
]
  },
  {
    id: "buduruwagala",
    name: "Buduruwagala",
    district: "Wellawaya District",
    category: "Hidden Gems",
    xp: 220,
    xpRange: "75 - 100 XP",
    distance: "210km",
    openStatus: "Open now",
    description: "An ancient Buddhist temple dating to the 9th or 10th century, featuring seven colossal figures carved in high relief on a cliff face, including the tallest rock-cut Buddha in Sri Lanka.",
    image: "/Element%20Pictures/Buduruwagala%20Temple.jpg",
    latitude: 6.6908,
    longitude: 81.0772,
    referenceImage: "/Element%20Pictures/Buduruwagala%20Temple.jpg",
    checkpoints: [
      {
        id: "buduruwagala_reliefs",
        name: "Colossal Rock-Cut Reliefs",
        description: "The 51-foot central Buddha flanked by three Bodhisattva figures on each side.",
        referenceImage: "/Element%20Pictures/Buduruwagala%20Temple.jpg",
        hint: "Align the entire cliff relief showing the seven rock figures.",
        xpReward: 50
      }
    ],
    quizzes: [
      {
            "question": "What does the ancient name 'Buduruwagala' literally translate to?",
            "options": [
                  "The Rock of Buddha Sculptures",
                  "The Temple of the Forest Peak",
                  "The Hill of Nine Gems",
                  "The Mountain of Divine Light"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is the height of the colossal central standing Buddha relief at Buduruwagala?",
            "options": [
                  "51 feet (15.5 meters) - tallest rock-cut Buddha in Sri Lanka",
                  "38 feet",
                  "25 feet",
                  "80 feet"
            ],
            "correctIndex": 0
      },
      {
            "question": "How many total statues are carved in high relief on the cliff face at Buduruwagala?",
            "options": [
                  "Seven colossal relief figures",
                  "Three figures",
                  "Ten figures",
                  "Twelve figures"
            ],
            "correctIndex": 0
      },
      {
            "question": "How are the seven figures arranged on the sheer rock wall?",
            "options": [
                  "A central Buddha flanked by two trios of Bodhisattvas and attendants",
                  "Seven statues standing in a straight line",
                  "A circle around a stupa",
                  "Three sitting and four reclining"
            ],
            "correctIndex": 0
      },
      {
            "question": "In which century were the Buduruwagala rock reliefs carved?",
            "options": [
                  "9th - 10th century AD (Late Anuradhapura period)",
                  "2nd century BC",
                  "14th century AD",
                  "5th century AD"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which school of Buddhist thought is vividly reflected in the Bodhisattva figures?",
            "options": [
                  "Mahayana Buddhist traditions",
                  "Theravada exclusively",
                  "Vajrayana tantric only",
                  "Zen monasticism"
            ],
            "correctIndex": 0
      },
      {
            "question": "What original material can still be seen clinging to the carved robes of the central statue?",
            "options": [
                  "Traces of original stucco plaster and orange-colored paint",
                  "Pure gold sheets",
                  "Bronze plating",
                  "Silver leaf"
            ],
            "correctIndex": 0
      },
      {
            "question": "To the left of the Buddha, who is the central Bodhisattva holding an oyster-white lotus?",
            "options": [
                  "Avalokiteshvara Bodhisattva",
                  "Maitreya Bodhisattva",
                  "Manjushri",
                  "Vajrapani"
            ],
            "correctIndex": 0
      },
      {
            "question": "Which female deity sculpture is featured in the left trio beside Avalokiteshvara?",
            "options": [
                  "Goddess Tara (carved in a graceful curved posture)",
                  "Goddess Saraswati",
                  "Queen Viharamahadevi",
                  "Princess Hemamala"
            ],
            "correctIndex": 0
      },
      {
            "question": "To the right of the central Buddha, which Bodhisattva holds a double-vajra symbol?",
            "options": [
                  "Vajrapani Bodhisattva",
                  "Maitreya",
                  "Samantabhadra",
                  "Ksitigarbha"
            ],
            "correctIndex": 0
      },
      {
            "question": "What shape is the natural rock cliff into which the sculptures are carved?",
            "options": [
                  "A sheer granite rock face resembling a kneeling elephant",
                  "A vertical sea stack",
                  "A deep underground cave",
                  "A flat river boulder"
            ],
            "correctIndex": 0
      },
      {
            "question": "What mysterious substance is said to seep continuously from a small hollow near the central Buddha?",
            "options": [
                  "A medicinal mustard-oil scent liquid",
                  "Pure crystal water",
                  "Sulfur foam",
                  "Red sap"
            ],
            "correctIndex": 0
      },
      {
            "question": "Near which major town in the Uva province is Buduruwagala situated?",
            "options": [
                  "Wellawaya",
                  "Ella",
                  "Badulla",
                  "Haputale"
            ],
            "correctIndex": 0
      },
      {
            "question": "What hand gesture (Mudra) is displayed by the 51-foot central Buddha?",
            "options": [
                  "Abhaya Mudra (Gesture of protection and fearlessness)",
                  "Dhyana Mudra",
                  "Varada Mudra",
                  "Bhumisparsha Mudra"
            ],
            "correctIndex": 0
      },
      {
            "question": "What irrigation tank lies directly along the entry trail to Buduruwagala?",
            "options": [
                  "Buduruwagala Wewa",
                  "Kala Wewa",
                  "Tissa Wewa",
                  "Parakrama Samudra"
            ],
            "correctIndex": 0
      },
      {
            "question": "What birdlife makes Buduruwagala tank a celebrated ecological refuge?",
            "options": [
                  "Painted storks, herons, and water eagles",
                  "Penguins",
                  "Flamingos exclusively",
                  "Seagulls"
            ],
            "correctIndex": 0
      },
      {
            "question": "Why is Buduruwagala unique compared to the statues at Aukana and Sasseruwa?",
            "options": [
                  "It features a complete Mahayana sculptural pantheon on a single rock face",
                  "It is made of bronze",
                  "It is located underwater",
                  "It was carved by European explorers"
            ],
            "correctIndex": 0
      },
      {
            "question": "What is carved into the crown of the Maitreya Bodhisattva on the right trio?",
            "options": [
                  "A miniature stupa emblem",
                  "A diamond star",
                  "A crescent moon",
                  "A cobra head"
            ],
            "correctIndex": 0
      },
      {
            "question": "What protective status does the Department of Archaeology hold over Buduruwagala?",
            "options": [
                  "Protected Archaeological Reserve",
                  "Commercial Quarry",
                  "Forest Logging Zone",
                  "Private Estate"
            ],
            "correctIndex": 0
      },
      {
            "question": "What sensation do travelers commonly describe when entering the forest clearing of Buduruwagala?",
            "options": [
                  "A profound aura of peaceful, ancient spiritual seclusion amidst nature",
                  "A bustling city bazaar feel",
                  "A dry industrial atmosphere",
                  "A maritime coastal breeze"
            ],
            "correctIndex": 0
      }
]
  }
];

export const sideQuestsData = [
  {
    id: "social_media",
    name: "Social Media Presence",
    description: "Share about your visit",
    xp: 5,
    duration: "10 mins",
    icon: "icons/social media presence icon.png"
  },
  {
    id: "local_food",
    name: "Local Food",
    description: "Try a traditional dish",
    xp: 5,
    duration: "20 mins",
    icon: "icons/local food icon.png"
  },
  {
    id: "wandering_around",
    name: "Wandering Around",
    description: "Visit a nearby site",
    xp: 5,
    duration: "20 mins",
    icon: "icons/Wandering Around icon.png"
  },
  {
    id: "wildlife_spotting",
    name: "Wildlife Spotting",
    description: "Spot and record an animal",
    xp: 5,
    duration: "20 mins",
    icon: "icons/Wildlife Spotting icon.png"
  },
  {
    id: "eco_warrior",
    name: "Eco-Warrior",
    description: "Conserve the environment",
    xp: 10,
    duration: "15 mins",
    icon: "icons/Eco Warrior icon.png"
  }
];

export const rewardsData = [
  {
    id: "cooking_experience",
    title: "FREE Traditional Cooking Experience",
    partner: "@Kandy Cafe",
    badge: "Sigiriya Scholar's Trial",
    isLocked: false,
    cost: 0,
    image: "Element Pictures/Traditional Cooking Experience.jpg"
  },
  {
    id: "trail_guide",
    title: "20% off Ancient Trail Guide",
    partner: "Expert guide for Mihintale walks.",
    isLocked: true,
    cost: 100,
    image: "Element Pictures/Trail Guide.webp"
  },
  {
    id: "artisan_crafts",
    title: "10% off Artisan Crafts",
    partner: "Authentic local handicraft store.",
    isLocked: true,
    cost: 100,
    image: "Element Pictures/Artisan Crafts.jpg.webp"
  }
];

if (typeof window !== 'undefined') {
  window.sitesData = sitesData;
  window.initialUserState = initialUserState;
  window.rankingScale = rankingScale;
  window.leaderboardPlayers = leaderboardPlayers;
  window.rewardsData = rewardsData;
}
