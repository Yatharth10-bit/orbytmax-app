import { SEED_SATELLITES } from "@/lib/seed-catalog";

export type MissionEntry = {
  slug: string;
  name: string;
  agency: string;
  category: string;
  purpose: string;
  launchDate: string;
  orbitType: string;
  facts: string[];
  model?: {
    fallbackType: string;
    attribution: string;
  };
};

export type SatellitePart = {
  slug: string;
  name: string;
  summary: string;
  why: string;
  signal: string;
};

export type QuizQuestion = {
  id: string;
  topic: string;
  question: string;
  answer: string;
  options: string[];
  explanation: string;
};

function toMissionEntry(slug: string): MissionEntry {
  const sat = SEED_SATELLITES.find((item) => item.slug === slug);
  if (!sat) throw new Error(`Missing seed satellite: ${slug}`);
  return {
    slug: sat.slug,
    name: sat.name,
    agency: sat.agency,
    category: sat.missionType || sat.category,
    purpose: sat.description,
    launchDate: sat.launchDate,
    orbitType: sat.orbitType,
    facts: sat.facts,
    model: sat.model
      ? {
          fallbackType: sat.model.fallbackType,
          attribution: sat.model.attribution,
        }
      : undefined,
  };
}

export const ISRO_MISSIONS = [
  "chandrayaan-3",
  "mangalyaan",
  "insat-3dr",
  "cartosat-2",
  "risat-2b",
  "oceansat-2",
  "resourcesat-2a",
  "navic-irnss-1i",
].map(toMissionEntry);

export const GLOBAL_MISSIONS = [
  "iss",
  "hubble",
  "landsat-9",
  "goes-18",
  "noaa-20",
  "sentinel-2a",
  "starlink-1007",
].map(toMissionEntry);

export const SATELLITE_PARTS: SatellitePart[] = [
  {
    slug: "solar-panels",
    name: "Solar panels",
    summary: "Wide panels convert sunlight into electricity for the spacecraft.",
    why: "Without steady power, radios, sensors, heaters, and computers shut down quickly.",
    signal: "Power maker",
  },
  {
    slug: "antennas",
    name: "Antennas",
    summary: "Antennas send commands, science data, images, and health updates between space and Earth.",
    why: "A mission is only useful if it can talk to ground stations or other satellites.",
    signal: "Space radio",
  },
  {
    slug: "payload",
    name: "Payload",
    summary: "The payload is the mission tool: a camera, radar, telescope, transponder, or experiment.",
    why: "It is the reason the satellite was launched.",
    signal: "Mission tool",
  },
  {
    slug: "propulsion",
    name: "Propulsion",
    summary: "Thrusters nudge the spacecraft into the right orbit and help avoid collisions.",
    why: "Small burns can keep a satellite useful for years.",
    signal: "Tiny pushes",
  },
  {
    slug: "power-system",
    name: "Power system",
    summary: "Power electronics move energy from panels and batteries to each subsystem.",
    why: "It keeps the spacecraft balanced between charging, storing, and spending energy.",
    signal: "Energy traffic",
  },
  {
    slug: "thermal-control",
    name: "Thermal control",
    summary: "Blankets, radiators, coatings, and heaters keep parts from getting too hot or too cold.",
    why: "Spacecraft swing between harsh sunlight and deep shadow every orbit.",
    signal: "Temperature guard",
  },
  {
    slug: "attitude-control",
    name: "Attitude control",
    summary: "Reaction wheels, star trackers, gyros, and sensors point the spacecraft accurately.",
    why: "A camera, antenna, or solar panel only works well when pointed correctly.",
    signal: "Pointing brain",
  },
  {
    slug: "communication-module",
    name: "Communication module",
    summary: "Radios, amplifiers, and modems translate onboard data into signals ground stations can read.",
    why: "It turns a satellite into a useful member of a larger mission network.",
    signal: "Data link",
  },
  {
    slug: "sensors",
    name: "Sensors",
    summary: "Sensors measure Earth, stars, temperature, motion, radiation, or spacecraft health.",
    why: "They give the spacecraft awareness and collect the mission data.",
    signal: "Space senses",
  },
  {
    slug: "onboard-computer",
    name: "Onboard computer",
    summary: "The flight computer runs commands, checks health, stores data, and handles safe mode.",
    why: "It keeps the satellite operating when it is out of contact with Earth.",
    signal: "Flight brain",
  },
  {
    slug: "structure",
    name: "Structure",
    summary: "The frame holds everything together through launch vibration and space operations.",
    why: "Every subsystem needs a strong, lightweight place to mount.",
    signal: "Space frame",
  },
  {
    slug: "batteries",
    name: "Batteries",
    summary: "Batteries store energy so the satellite can run during eclipse or peak demand.",
    why: "They bridge the dark side of each orbit when solar panels cannot see the Sun.",
    signal: "Night power",
  },
];

export const ORBIT_QUIZ_BANK: QuizQuestion[] = [
  {
    id: "leo-altitude",
    topic: "Low Earth Orbit",
    question: "Which altitude range is usually called Low Earth Orbit?",
    answer: "Below about 2,000 km",
    options: ["Below about 2,000 km", "Exactly 35,786 km", "Beyond the Moon", "Inside Earth's atmosphere"],
    explanation: "LEO sits close to Earth, commonly below about 2,000 km.",
  },
  {
    id: "geo-rotation",
    topic: "Geostationary orbit",
    question: "Why does a geostationary satellite appear to hover over one longitude?",
    answer: "Its orbit period matches Earth's rotation",
    options: ["Its orbit period matches Earth's rotation", "It stops moving", "It is attached to a tower", "It flies below aircraft"],
    explanation: "GEO satellites orbit once per sidereal day, matching Earth's spin.",
  },
  {
    id: "gravity-orbit",
    topic: "Gravity",
    question: "What keeps a satellite in orbit around Earth?",
    answer: "Gravity and forward motion",
    options: ["Gravity and forward motion", "Solar wind only", "Air pressure", "A permanent rocket burn"],
    explanation: "A satellite is constantly falling around Earth while moving forward fast enough to miss the ground.",
  },
  {
    id: "polar-path",
    topic: "Polar orbit",
    question: "What is special about a polar orbit?",
    answer: "It passes near both poles",
    options: ["It passes near both poles", "It stays above the equator", "It never sees sunlight", "It only works for crewed missions"],
    explanation: "Polar or near-polar orbits let Earth rotate beneath the satellite for broad coverage.",
  },
  {
    id: "iss-orbit",
    topic: "ISS",
    question: "About how long does the ISS take to orbit Earth once?",
    answer: "About 90 minutes",
    options: ["About 90 minutes", "About 24 hours", "About 30 days", "About one year"],
    explanation: "The ISS circles Earth roughly every hour and a half.",
  },
  {
    id: "comms-geo",
    topic: "Communication satellites",
    question: "Why are many broadcast communication satellites placed in GEO?",
    answer: "Ground dishes can point at a fixed spot",
    options: ["Ground dishes can point at a fixed spot", "GEO is the lowest orbit", "They need no antennas", "They can land for repairs"],
    explanation: "A fixed-looking GEO satellite makes it easy for antennas on Earth to stay aligned.",
  },
  {
    id: "nav-timing",
    topic: "Navigation satellites",
    question: "What do navigation satellites broadcast with very high precision?",
    answer: "Time and orbital position signals",
    options: ["Time and orbital position signals", "Cloud photos only", "Launch videos", "Weather balloons"],
    explanation: "Receivers calculate position by comparing timed signals from several satellites.",
  },
  {
    id: "earth-observation",
    topic: "Earth observation",
    question: "What is a common job for Earth observation satellites?",
    answer: "Monitoring land, oceans, weather, and change",
    options: ["Monitoring land, oceans, weather, and change", "Mining asteroids", "Holding astronauts' luggage", "Replacing all airplanes"],
    explanation: "Earth observation satellites collect images and measurements used for science and planning.",
  },
  {
    id: "solar-panels",
    topic: "Solar panels",
    question: "What do satellite solar panels produce?",
    answer: "Electrical power",
    options: ["Electrical power", "Rocket fuel", "Oxygen for Earth", "Radio waves only"],
    explanation: "Solar cells turn sunlight into electricity for onboard systems.",
  },
  {
    id: "antenna-job",
    topic: "Satellite antennas",
    question: "What is the main purpose of a satellite antenna?",
    answer: "Sending and receiving signals",
    options: ["Sending and receiving signals", "Catching sunlight", "Cooling fuel tanks", "Measuring gravity directly"],
    explanation: "Antennas connect spacecraft with ground stations and other spacecraft.",
  },
  {
    id: "debris-risk",
    topic: "Space debris",
    question: "Why is space debris dangerous?",
    answer: "Tiny pieces move very fast and can damage spacecraft",
    options: ["Tiny pieces move very fast and can damage spacecraft", "It blocks all sunlight", "It makes gravity stop", "It is always magnetic"],
    explanation: "Even small debris can hit with huge energy because orbital speeds are so high.",
  },
  {
    id: "mission-control",
    topic: "Mission control",
    question: "What does mission control do after launch?",
    answer: "Monitors health, sends commands, and plans operations",
    options: ["Monitors health, sends commands, and plans operations", "Paints the satellite", "Creates gravity", "Keeps the satellite visible all night"],
    explanation: "Mission controllers watch telemetry and command the spacecraft throughout its life.",
  },
  {
    id: "inclination",
    topic: "Orbit basics",
    question: "What does orbital inclination describe?",
    answer: "The tilt of an orbit relative to the equator",
    options: ["The tilt of an orbit relative to the equator", "The satellite's color", "The launch countdown length", "The camera zoom level"],
    explanation: "Inclination tells you how far north and south the ground track can go.",
  },
  {
    id: "period",
    topic: "Orbit basics",
    question: "What is an orbital period?",
    answer: "The time to complete one orbit",
    options: ["The time to complete one orbit", "The satellite's battery size", "The launch date", "The brightness of a pass"],
    explanation: "Period is one lap around the body being orbited.",
  },
  {
    id: "sun-sync",
    topic: "Earth observation",
    question: "Why do many imaging satellites use sun-synchronous orbits?",
    answer: "They see places at similar local lighting times",
    options: ["They see places at similar local lighting times", "They never enter eclipse", "They stop above one city", "They avoid all clouds"],
    explanation: "Consistent lighting helps compare images taken on different days.",
  },
  {
    id: "visible-passes",
    topic: "Orbit basics",
    question: "When are many satellites easiest to see from the ground?",
    answer: "After sunset or before sunrise",
    options: ["After sunset or before sunrise", "At noon only", "During heavy rain", "Only during eclipses"],
    explanation: "The sky is dark for you, while the satellite can still reflect sunlight.",
  },
  {
    id: "leo-speed",
    topic: "Low Earth Orbit",
    question: "Compared with GEO satellites, LEO satellites usually move across the sky...",
    answer: "Much faster",
    options: ["Much faster", "Much slower", "Not at all", "Only underground"],
    explanation: "Closer orbits have shorter periods, so LEO satellites sweep across the sky quickly.",
  },
  {
    id: "payload",
    topic: "Satellite parts",
    question: "What is a satellite payload?",
    answer: "The mission equipment that does the main job",
    options: ["The mission equipment that does the main job", "The launch pad", "A type of orbit", "A ground station chair"],
    explanation: "Payloads include cameras, radars, telescopes, transponders, or science instruments.",
  },
  {
    id: "attitude",
    topic: "Satellite parts",
    question: "What does attitude control help a satellite do?",
    answer: "Point in the correct direction",
    options: ["Point in the correct direction", "Choose a launch site", "Grow solar cells", "Change Earth's gravity"],
    explanation: "Pointing is essential for cameras, antennas, thrusters, and solar panels.",
  },
  {
    id: "battery-eclipse",
    topic: "Solar panels",
    question: "Why does a satellite need batteries if it has solar panels?",
    answer: "To keep running in Earth's shadow",
    options: ["To keep running in Earth's shadow", "To make it heavier", "To replace antennas", "To slow down time"],
    explanation: "Batteries power the spacecraft during eclipse and during peak loads.",
  },
  {
    id: "ground-track",
    topic: "Orbit basics",
    question: "What is a satellite ground track?",
    answer: "The path it traces over Earth's surface",
    options: ["The path it traces over Earth's surface", "A road to a launch pad", "The shadow of a rocket plume", "A list of astronauts"],
    explanation: "The ground track is the projection of the orbit onto Earth.",
  },
  {
    id: "orbit-decay",
    topic: "Low Earth Orbit",
    question: "Why can very low satellites slowly lose altitude?",
    answer: "Thin atmospheric drag steals energy",
    options: ["Thin atmospheric drag steals energy", "The Moon turns them off", "Solar panels get bored", "Mission control stops gravity"],
    explanation: "Even sparse upper atmosphere creates drag that can lower an orbit over time.",
  },
];

export function getMission(collection: "isro" | "global", slug: string) {
  const source = collection === "isro" ? ISRO_MISSIONS : GLOBAL_MISSIONS;
  return source.find((mission) => mission.slug === slug);
}
