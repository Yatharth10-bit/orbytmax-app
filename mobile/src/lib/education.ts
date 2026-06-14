export type QuizQuestion = {
  id: string;
  topic: string;
  question: string;
  answer: string;
  options: string[];
  explanation: string;
};

export const satelliteParts = [
  ['Solar panels', 'Turn sunlight into electricity.', 'Keep every onboard system powered.'],
  ['Antennas', 'Send and receive radio signals.', 'Connect the spacecraft to Earth.'],
  ['Payload', 'The camera, radar, telescope, or experiment.', 'Performs the mission’s main job.'],
  ['Propulsion', 'Small thrusters change speed and orbit.', 'Maintains orbit and avoids collisions.'],
  ['Power system', 'Routes energy from panels and batteries.', 'Balances charging and power use.'],
  ['Thermal control', 'Blankets, radiators, and heaters manage temperature.', 'Protects hardware from extreme heat and cold.'],
  ['Attitude control', 'Wheels and sensors point the spacecraft.', 'Keeps cameras, antennas, and panels aligned.'],
  ['Communication module', 'Turns onboard data into radio signals.', 'Moves commands and mission data.'],
  ['Sensors', 'Measure Earth, space, motion, and spacecraft health.', 'Provide awareness and science data.'],
  ['Onboard computer', 'Runs commands and handles safe mode.', 'Keeps the mission operating autonomously.'],
  ['Structure', 'The strong, lightweight spacecraft frame.', 'Survives launch and holds every part.'],
  ['Batteries', 'Store electrical energy.', 'Power the satellite in Earth’s shadow.'],
];

export const quizBank: QuizQuestion[] = [
  q('leo', 'Low Earth Orbit', 'Which range is usually called LEO?', 'Below about 2,000 km', ['Exactly 35,786 km', 'Beyond the Moon', 'Inside the ocean'], 'LEO is the region close to Earth, usually below about 2,000 km.'),
  q('geo', 'Geostationary orbit', 'Why does a GEO satellite appear fixed?', 'Its period matches Earth’s rotation', ['It stops moving', 'A tower holds it', 'It has no gravity'], 'A geostationary satellite completes one orbit per sidereal day.'),
  q('gravity', 'Gravity', 'What keeps a satellite in orbit?', 'Gravity and forward motion', ['Air pressure', 'Solar wind only', 'A permanent engine burn'], 'Orbit is continuous falling combined with enough sideways speed.'),
  q('polar', 'Polar orbit', 'What is special about a polar orbit?', 'It passes near both poles', ['It stays over the equator', 'It never sees sunlight', 'It only carries people'], 'Earth rotates beneath a polar satellite, giving broad coverage.'),
  q('iss', 'ISS', 'How long is one ISS orbit?', 'About 90 minutes', ['About 24 hours', 'About 30 days', 'About one year'], 'The ISS circles Earth roughly every hour and a half.'),
  q('comms', 'Communications', 'Why are many broadcast satellites in GEO?', 'Ground dishes can point at a fixed spot', ['GEO is the lowest orbit', 'They need no antennas', 'They can land for repairs'], 'A fixed-looking satellite is easy for ground antennas to track.'),
  q('nav', 'Navigation', 'What do navigation satellites broadcast precisely?', 'Time and position signals', ['Cloud photos only', 'Launch videos', 'Weather balloons'], 'Receivers compare timed signals from several satellites.'),
  q('earth', 'Earth observation', 'What is a common Earth observation job?', 'Monitoring land, oceans, and weather', ['Mining asteroids', 'Replacing airplanes', 'Making gravity'], 'Earth observation missions measure our changing planet.'),
  q('solar', 'Solar panels', 'What do satellite solar panels produce?', 'Electrical power', ['Rocket fuel', 'Oxygen', 'Radio waves only'], 'Solar cells convert sunlight into electricity.'),
  q('antenna', 'Antennas', 'What is an antenna’s main purpose?', 'Sending and receiving signals', ['Catching sunlight', 'Cooling fuel', 'Changing orbit'], 'Antennas connect spacecraft with ground stations.'),
  q('debris', 'Space debris', 'Why is space debris dangerous?', 'Small pieces move extremely fast', ['It blocks all sunlight', 'It stops gravity', 'It is always magnetic'], 'Orbital speed gives even tiny debris enormous impact energy.'),
  q('control', 'Mission control', 'What does mission control do after launch?', 'Monitors health and sends commands', ['Paints the satellite', 'Creates gravity', 'Controls the weather'], 'Controllers watch telemetry and plan operations.'),
  q('inclination', 'Orbit basics', 'What does inclination describe?', 'The orbit’s tilt to the equator', ['Satellite color', 'Camera zoom', 'Launch countdown'], 'Inclination determines how far north and south an orbit travels.'),
  q('period', 'Orbit basics', 'What is an orbital period?', 'Time to complete one orbit', ['Battery size', 'Launch date', 'Pass brightness'], 'The orbital period is the time for one full lap.'),
  q('sun', 'Earth observation', 'Why use a sun-synchronous orbit?', 'To get similar local lighting', ['To avoid every cloud', 'To stop over one city', 'To never enter shadow'], 'Consistent light makes images easier to compare.'),
  q('visible', 'Orbit basics', 'When are satellites often easiest to see?', 'After sunset or before sunrise', ['At noon only', 'During rain', 'Only at midnight'], 'The ground is dark while the satellite can still reflect sunlight.'),
  q('speed', 'Low Earth Orbit', 'Compared with GEO, LEO satellites cross the sky…', 'Much faster', ['Much slower', 'Not at all', 'Only underground'], 'Closer orbits have much shorter periods.'),
  q('payload', 'Satellite parts', 'What is a payload?', 'Equipment that does the main mission', ['The launch pad', 'A type of orbit', 'A ground station'], 'Payloads include cameras, radars, telescopes, and experiments.'),
  q('attitude', 'Satellite parts', 'What does attitude control do?', 'Points the satellite correctly', ['Selects launch sites', 'Changes gravity', 'Builds solar cells'], 'Correct pointing is essential for panels, cameras, and antennas.'),
  q('battery', 'Satellite parts', 'Why are batteries needed with solar panels?', 'To run in Earth’s shadow', ['To replace antennas', 'To make it heavier', 'To slow time'], 'Batteries keep systems powered during eclipse.'),
];

function q(id: string, topic: string, question: string, answer: string, wrong: string[], explanation: string): QuizQuestion {
  return { id, topic, question, answer, options: [answer, ...wrong], explanation };
}

export function shuffled<T>(values: T[]) {
  return [...values].sort(() => Math.random() - 0.5);
}
