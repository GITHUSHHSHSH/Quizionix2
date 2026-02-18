import {
  initializeZones,
  isZoneUnlocked,
  setCurrentBranch,
  setCurrentZone,
  unlockOneZoneForTesting
} from "./gameState.js";

const zones = [
  {
    id: "science",
    name: "Science",
    description: "Natural systems, experiments, and scientific reasoning.",
    branches: [
      { id: "biology", name: "Biology" },
      { id: "chemistry", name: "Chemistry" },
      { id: "physics", name: "Physics" }
    ]
  },
  {
    id: "technology",
    name: "Technology",
    description: "Computing systems, logic, and digital design.",
    branches: [
      { id: "programming", name: "Programming" },
      { id: "databases", name: "Databases" },
      { id: "networks", name: "Networks" }
    ]
  },
  {
    id: "engineering",
    name: "Engineering",
    description: "Design thinking, systems, and applied problem-solving.",
    branches: [
      { id: "kinematics", name: "Kinematics" },
      { id: "dynamics", name: "Dynamics" },
      { id: "energy-systems", name: "Energy Systems" }
    ]
  },
  {
    id: "mathematics",
    name: "Mathematics",
    description: "Numbers, structures, and analytical reasoning.",
    branches: [
      { id: "algebra", name: "Algebra" },
      { id: "geometry", name: "Geometry" },
      { id: "statistics", name: "Statistics" }
    ]
  }
];

initializeZones(zones);

function getZones() {
  return zones.map((zone) => ({
    ...zone,
    unlocked: isZoneUnlocked(zone.id)
  }));
}

function enterZone(zoneId) {
  const selected = zones.find((zone) => zone.id === zoneId);

  if (!selected || !isZoneUnlocked(zoneId)) {
    return null;
  }

  setCurrentZone(selected.id, selected.name);
  setCurrentBranch(null);
  return { ...selected };
}

function getBranchesForZone(zoneId) {
  const selected = zones.find((zone) => zone.id === zoneId);
  if (!selected) {
    return [];
  }

  return selected.branches.map((branch) => ({ ...branch }));
}

function selectBranch(zoneId, branchId) {
  const selectedZone = zones.find((zone) => zone.id === zoneId);
  if (!selectedZone || !isZoneUnlocked(zoneId)) {
    return null;
  }

  const selectedBranch = selectedZone.branches.find((branch) => branch.id === branchId);
  if (!selectedBranch) {
    return null;
  }

  setCurrentZone(selectedZone.id, selectedZone.name);
  setCurrentBranch(selectedBranch.name);
  return { ...selectedBranch };
}

function unlockOneZoneDebug() {
  return unlockOneZoneForTesting();
}

export {
  getZones,
  enterZone,
  getBranchesForZone,
  selectBranch,
  unlockOneZoneDebug
};
