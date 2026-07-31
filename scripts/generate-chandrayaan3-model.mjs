import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

globalThis.FileReader = class {
  result = null;
  onloadend = null;
  onerror = null;

  readAsArrayBuffer(blob) {
    blob
      .arrayBuffer()
      .then((buffer) => {
        this.result = buffer;
        this.onloadend?.({ target: this });
      })
      .catch((error) => {
        this.onerror?.(error);
      });
  }
};

const outDir = path.join(process.cwd(), "public", "models");
const outFile = path.join(outDir, "chandrayaan-3.glb");
fs.mkdirSync(outDir, { recursive: true });

function material(color, metalness = 0.25, roughness = 0.55) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

const gold = material("#c89536", 0.35, 0.42);
const darkGold = material("#7a5a26", 0.28, 0.58);
const graphite = material("#2f3744", 0.2, 0.62);
const slate = material("#596271", 0.35, 0.46);
const panel = material("#182336", 0.2, 0.5);
const amber = material("#ffb454", 0.25, 0.36);

function mesh(name, geometry, mat, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, mat);
  item.name = name;
  item.position.set(...position);
  item.rotation.set(...rotation);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

const root = new THREE.Group();
root.name = "Chandrayaan3_Educational_Model";

const bus = new THREE.Group();
bus.name = "Bus_VikramLander";
bus.add(mesh("Bus_MainDeck", new THREE.BoxGeometry(1.75, 0.78, 1.42), gold));
bus.add(mesh("Bus_TopAvionicsBox", new THREE.BoxGeometry(1.08, 0.36, 0.86), darkGold, [0, 0.58, 0]));
bus.add(mesh("Bus_LandingPlatform", new THREE.BoxGeometry(2.18, 0.12, 1.8), graphite, [0, -0.5, 0]));
root.add(bus);

const panels = new THREE.Group();
panels.name = "SolarPanels";
panels.add(mesh("SolarPanels_Left", new THREE.BoxGeometry(1.34, 0.04, 0.84), panel, [-1.58, 0.14, 0]));
panels.add(mesh("SolarPanels_Right", new THREE.BoxGeometry(1.34, 0.04, 0.84), panel, [1.58, 0.14, 0]));
for (const side of [-1, 1]) {
  for (let i = -1; i <= 1; i += 1) {
    panels.add(mesh(`SolarPanels_${side < 0 ? "Left" : "Right"}_Cell_${i + 2}`, new THREE.BoxGeometry(0.02, 0.052, 0.8), amber, [side * (1.58 + i * 0.3), 0.17, 0]));
  }
}
root.add(panels);

const antenna = new THREE.Group();
antenna.name = "Antenna_DishAndMast";
antenna.add(mesh("Antenna_Mast", new THREE.CylinderGeometry(0.025, 0.025, 0.98, 18), slate, [0.52, 1.03, -0.24], [0.18, 0.18, 0.22]));
antenna.add(mesh("Antenna_Dish", new THREE.SphereGeometry(0.24, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), slate, [0.67, 1.5, -0.34], [1.32, 0.18, 0.22]));
antenna.add(mesh("Antenna_HighGainPanel", new THREE.BoxGeometry(0.58, 0.06, 0.28), graphite, [-0.62, 0.95, -0.42], [0, 0.18, -0.24]));
root.add(antenna);

const payload = new THREE.Group();
payload.name = "Payload_InstrumentsAndRover";
payload.add(mesh("Payload_InstrumentBox_L", new THREE.BoxGeometry(0.34, 0.28, 0.34), slate, [-0.42, 0.34, 0.82]));
payload.add(mesh("Payload_InstrumentBox_R", new THREE.BoxGeometry(0.34, 0.28, 0.34), slate, [0.42, 0.34, 0.82]));
payload.add(mesh("Payload_RoverBody_Pragnan", new THREE.BoxGeometry(0.58, 0.2, 0.36), graphite, [0, -0.78, 1.08]));
for (const x of [-0.25, 0, 0.25]) {
  payload.add(mesh(`Payload_RoverWheel_L_${x}`, new THREE.CylinderGeometry(0.075, 0.075, 0.05, 16), darkGold, [x, -0.88, 0.86], [Math.PI / 2, 0, 0]));
  payload.add(mesh(`Payload_RoverWheel_R_${x}`, new THREE.CylinderGeometry(0.075, 0.075, 0.05, 16), darkGold, [x, -0.88, 1.3], [Math.PI / 2, 0, 0]));
}
payload.add(mesh("Payload_Ramp", new THREE.BoxGeometry(0.68, 0.04, 0.86), slate, [0, -0.74, 0.72], [0.55, 0, 0]));
root.add(payload);

const thrusters = new THREE.Group();
thrusters.name = "Thrusters_LandingLegs";
const legPositions = [
  [-0.92, -0.72, -0.72],
  [0.92, -0.72, -0.72],
  [-0.92, -0.72, 0.72],
  [0.92, -0.72, 0.72],
];
legPositions.forEach(([x, y, z], index) => {
  thrusters.add(mesh(`Thrusters_Leg_${index + 1}`, new THREE.CylinderGeometry(0.03, 0.03, 0.9, 12), slate, [x, y, z], [0.52 * Math.sign(z), 0, 0.45 * Math.sign(x)]));
  thrusters.add(mesh(`Thrusters_Footpad_${index + 1}`, new THREE.CylinderGeometry(0.18, 0.18, 0.035, 24), graphite, [x * 1.18, y - 0.42, z * 1.12]));
  thrusters.add(mesh(`Thrusters_Nozzle_${index + 1}`, new THREE.ConeGeometry(0.12, 0.28, 18), darkGold, [x * 0.54, -0.68, z * 0.54], [Math.PI, 0, 0]));
});
root.add(thrusters);

const propulsion = new THREE.Group();
propulsion.name = "PropulsionModule_Context";
propulsion.add(mesh("PropulsionModule_Bus", new THREE.BoxGeometry(1.16, 0.62, 0.92), slate, [0, 1.5, 0]));
propulsion.add(mesh("PropulsionModule_SolarPanel", new THREE.BoxGeometry(1.6, 0.04, 0.72), panel, [-1.38, 1.5, 0]));
propulsion.add(mesh("PropulsionModule_AdapterCone", new THREE.ConeGeometry(0.42, 0.46, 32), darkGold, [0, 1.02, 0], [Math.PI, 0, 0]));
root.add(propulsion);

root.rotation.set(-0.15, -0.65, 0.08);
root.scale.setScalar(1.2);

const scene = new THREE.Scene();
scene.add(root);

const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(scene, { binary: true });
fs.writeFileSync(outFile, Buffer.from(glb));
console.log(`Wrote ${outFile}`);

function addGenericSolarPanels(root, kind = "default") {
  const panels = new THREE.Group();
  panels.name = "SolarPanels";
  const panelLength = kind === "flat" ? 2.2 : kind === "geo" ? 1.5 : 1.35;
  const panelWidth = kind === "flat" ? 0.72 : 0.84;
  panels.add(mesh("SolarPanels_Left", new THREE.BoxGeometry(panelLength, 0.04, panelWidth), panel, [-1.45, 0, 0]));
  panels.add(mesh("SolarPanels_Right", new THREE.BoxGeometry(panelLength, 0.04, panelWidth), panel, [1.45, 0, 0]));
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i += 1) {
      panels.add(mesh(`SolarPanels_${side < 0 ? "Left" : "Right"}_Cell_${i + 2}`, new THREE.BoxGeometry(0.02, 0.052, panelWidth * 0.9), amber, [side * (1.45 + i * 0.32), 0.035, 0]));
    }
  }
  root.add(panels);
}

function addGenericAntenna(root, style = "dish") {
  const antennaGroup = new THREE.Group();
  antennaGroup.name = "Antenna";
  antennaGroup.add(mesh("Antenna_Mast", new THREE.CylinderGeometry(0.025, 0.025, 0.75, 16), slate, [0.34, 0.78, -0.2], [0.18, 0, 0.24]));
  if (style === "array") {
    antennaGroup.add(mesh("Antenna_PhasedArray", new THREE.BoxGeometry(0.72, 0.06, 0.44), slate, [0.54, 1.08, -0.28], [0.2, 0.15, 0.24]));
  } else {
    antennaGroup.add(mesh("Antenna_Dish", new THREE.SphereGeometry(0.18, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), slate, [0.46, 1.14, -0.28], [1.35, 0.16, 0.24]));
  }
  root.add(antennaGroup);
}

function addThrusters(root, compact = false) {
  const thrusterGroup = new THREE.Group();
  thrusterGroup.name = "Thrusters";
  const z = compact ? 0.4 : 0.52;
  for (const x of [-0.38, 0.38]) {
    thrusterGroup.add(mesh(`Thrusters_Nozzle_${x}`, new THREE.ConeGeometry(0.12, 0.28, 18), darkGold, [x, -0.12, -z], [Math.PI / 2, 0, 0]));
  }
  root.add(thrusterGroup);
}

function makeGenericSatellite({ slug, style, title }) {
  const modelRoot = new THREE.Group();
  modelRoot.name = `${title.replace(/[^a-z0-9]+/gi, "_")}_Educational_Model`;

  const busGroup = new THREE.Group();
  busGroup.name = "Bus";
  if (style === "hubble") {
    busGroup.add(mesh("Bus_TelescopeTube", new THREE.CylinderGeometry(0.42, 0.42, 1.35, 36), slate, [0, 0, 0], [Math.PI / 2, 0, 0]));
    busGroup.add(mesh("Bus_AftModule", new THREE.BoxGeometry(0.78, 0.6, 0.52), graphite, [0, 0, -0.76]));
  } else if (style === "starlink") {
    busGroup.add(mesh("Bus_FlatBody", new THREE.BoxGeometry(1.45, 0.16, 0.82), graphite));
  } else if (style === "geo") {
    busGroup.add(mesh("Bus_GeoCore", new THREE.BoxGeometry(0.84, 0.92, 0.78), gold));
    busGroup.add(mesh("Bus_AvionicsDeck", new THREE.BoxGeometry(0.66, 0.22, 0.62), darkGold, [0, 0.58, 0]));
  } else if (style === "radar") {
    busGroup.add(mesh("Bus_RadarCore", new THREE.BoxGeometry(0.8, 0.58, 0.72), gold));
    busGroup.add(mesh("Bus_SarBackplane", new THREE.BoxGeometry(1.45, 0.08, 0.52), graphite, [0, -0.08, 0.72], [0.2, 0, 0]));
  } else if (style === "planetary") {
    busGroup.add(mesh("Bus_OrbiterCore", new THREE.BoxGeometry(0.78, 0.72, 0.78), gold));
    busGroup.add(mesh("Bus_PropellantTank", new THREE.SphereGeometry(0.24, 24, 16), slate, [0, -0.56, 0]));
  } else {
    busGroup.add(mesh("Bus_MainBody", new THREE.BoxGeometry(0.84, 0.58, 0.72), gold));
  }
  modelRoot.add(busGroup);

  addGenericSolarPanels(modelRoot, style === "starlink" ? "flat" : style === "geo" ? "geo" : "default");
  addGenericAntenna(modelRoot, style === "starlink" ? "array" : "dish");

  const payloadGroup = new THREE.Group();
  payloadGroup.name = "Payload";
  if (style === "hubble") {
    payloadGroup.add(mesh("Payload_Aperture", new THREE.CylinderGeometry(0.34, 0.34, 0.08, 36), graphite, [0, 0, 0.72], [Math.PI / 2, 0, 0]));
  } else if (style === "radar") {
    payloadGroup.add(mesh("Payload_SarPanel", new THREE.BoxGeometry(1.5, 0.06, 0.58), slate, [0, -0.12, 0.9], [0.18, 0, 0]));
  } else if (style === "geo") {
    payloadGroup.add(mesh("Payload_WeatherImager", new THREE.CylinderGeometry(0.22, 0.22, 0.2, 28), slate, [0, 0.08, 0.55], [Math.PI / 2, 0, 0]));
    payloadGroup.add(mesh("Payload_Radiator", new THREE.BoxGeometry(0.55, 0.08, 0.38), graphite, [0.52, -0.05, 0.3]));
  } else if (style === "navigation") {
    payloadGroup.add(mesh("Payload_NavClockBox", new THREE.BoxGeometry(0.45, 0.3, 0.34), slate, [0, 0.25, 0.52]));
    payloadGroup.add(mesh("Payload_BroadcastArray", new THREE.BoxGeometry(0.68, 0.06, 0.42), graphite, [0, -0.1, 0.56]));
  } else if (style === "starlink") {
    payloadGroup.add(mesh("Payload_PhasedArrayDeck", new THREE.BoxGeometry(0.95, 0.05, 0.58), slate, [0, 0.12, 0]));
  } else {
    payloadGroup.add(mesh("Payload_InstrumentBox", new THREE.BoxGeometry(0.42, 0.32, 0.36), slate, [0, 0.18, 0.55]));
  }
  modelRoot.add(payloadGroup);

  addThrusters(modelRoot, style === "starlink");
  modelRoot.rotation.set(-0.18, -0.62, 0.08);
  modelRoot.scale.setScalar(style === "hubble" ? 1 : 1.2);

  const modelScene = new THREE.Scene();
  modelScene.add(modelRoot);
  return { slug, scene: modelScene };
}

const modelDefinitions = [
  { slug: "hubble", style: "hubble", title: "Hubble Space Telescope" },
  { slug: "starlink-1007", style: "starlink", title: "Starlink 1007" },
  { slug: "mangalyaan", style: "planetary", title: "Mangalyaan MOM" },
  { slug: "insat-3dr", style: "geo", title: "INSAT 3DR" },
  { slug: "cartosat-2", style: "earth", title: "Cartosat 2" },
  { slug: "risat-2b", style: "radar", title: "RISAT 2B" },
  { slug: "oceansat-2", style: "earth", title: "Oceansat 2" },
  { slug: "resourcesat-2a", style: "earth", title: "Resourcesat 2A" },
  { slug: "navic-irnss-1i", style: "navigation", title: "NavIC IRNSS 1I" },
  { slug: "landsat-9", style: "earth", title: "Landsat 9" },
  { slug: "noaa-20", style: "earth", title: "NOAA 20 JPSS 1" },
  { slug: "sentinel-2a", style: "earth", title: "Sentinel 2A" },
];

for (const definition of modelDefinitions) {
  const generated = makeGenericSatellite(definition);
  const nextFile = path.join(outDir, `${definition.slug}.glb`);
  const nextGlb = await exporter.parseAsync(generated.scene, { binary: true });
  fs.writeFileSync(nextFile, Buffer.from(nextGlb));
  console.log(`Wrote ${nextFile}`);
}
