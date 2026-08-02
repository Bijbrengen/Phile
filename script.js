let PHILOSOPHER_CARDS = [];
let PHILE_RUNTIME = null;
let leerpretClient = null;

let CARD_BLURBS = [];

const DEFAULT_SETTINGS = {
  candidateCount: 8,
  boardSize: 16,
  startNeuronCount: 10,
  burnoutLimit: 3,
  rotationMode: true
};

let MAX_HAND_SIZE = 5;
let ENTITY_CARD_LEVELS = [5, 6, 7, 8];
let MAX_PLAYABLE_PATTERN_CELLS = 8;
let ENTITY_CARD_TIERS = {
  5: {
    expectedCount: 12,
    label: "bekendste filosofen en kerntheorieen"
  },
  6: {
    expectedCount: 35,
    label: "bekende overige filosofen en theorieen"
  },
  7: {
    expectedCount: 108,
    label: "gangbare filosofen en stromingen"
  },
  8: {
    expectedCount: 369,
    label: "kennerniveau met onbekendere filosofen en theorieen"
  }
};
const LEARNING_BOX_ID = "phile";
const PERSON_ID = `phile-session-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 12)}`;
const interactionBuffer = [];
const leerobjects = new Map();

const state = {
  level: 1,
  score: 0,
  settings: { ...DEFAULT_SETTINGS },
  board: null,
  round: null,
  selectedCandidateId: null,
  pendingChoiceCandidateId: null,
  roundResolved: false,
  status: "playing",
  playerHand: [],
  doublePlayCredits: 0,
  freeReflectTurns: 0,
  lastPlayedCard: null,
  feedbackMessage: "Het raster laat alleen lokale buurverbindingen toe. Kies per ronde exact een kaart."
};

const roundValue = document.getElementById("roundValue");
const scoreValue = document.getElementById("scoreValue");
const neuronValue = document.getElementById("neuronValue");
const synapseValue = document.getElementById("synapseValue");
const variationValue = document.getElementById("variationValue");
const roundMeta = document.getElementById("roundMeta");
const cardRailMeta = document.getElementById("cardRailMeta");
const feedbackBox = document.getElementById("feedbackBox");
const selectedCardSummary = document.getElementById("selectedCardSummary");
const candidateRail = document.getElementById("candidateRail");
const boardSvg = document.getElementById("boardSvg");
const topbar = document.querySelector(".topbar");
const menuButton = document.getElementById("menuButton");
const menuPanel = document.getElementById("menuPanel");
const variationNote = document.getElementById("variationNote");
const candidateCountSelect = document.getElementById("candidateCountSelect");
const boardSizeSelect = document.getElementById("boardSizeSelect");
const startNeuronCountSelect = document.getElementById("startNeuronCountSelect");
const burnoutLimitSelect = document.getElementById("burnoutLimitSelect");
const rotationToggle = document.getElementById("rotationToggle");

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizePhilosopherCard(card, index) {
  const fallback = card || {};
  const strength = card.strength || {};
  return {
    id: card.id || makeId(`philosopher-${index}`),
    tradition: card.tradition || "Onbekende traditie",
    philosopher: card.philosopher || "Onbekende filosoof",
    title: card.title || "Naamloze kaart",
    summary: card.summary || "",
    theory: card.theory || card.title || "Onbekende theorie",
    strength: {
      type: strength.type || "draw",
      icon: strength.icon || "+",
      description: strength.description || "Trek een extra kaart."
    }
  };
}

function normalizePolyominoCells(cells) {
  const minX = Math.min(...cells.map(cell => cell.x));
  const minY = Math.min(...cells.map(cell => cell.y));
  const unique = new Map();
  cells.forEach(cell => {
    unique.set(`${cell.x - minX},${cell.y - minY}`, {
      x: cell.x - minX,
      y: cell.y - minY
    });
  });
  return [...unique.values()].sort((left, right) => {
    if (left.x !== right.x) return left.x - right.x;
    return left.y - right.y;
  });
}

function transformPolyominoCells(cells, variant) {
  const transformed = cells.map(cell => {
    const { x, y } = cell;
    if (variant === 0) return { x, y };
    if (variant === 1) return { x: -y, y: x };
    if (variant === 2) return { x: -x, y: -y };
    if (variant === 3) return { x: y, y: -x };
    if (variant === 4) return { x: -x, y };
    if (variant === 5) return { x, y: -y };
    if (variant === 6) return { x: y, y: x };
    return { x: -y, y: -x };
  });
  return normalizePolyominoCells(transformed);
}

function polyominoSignature(cells) {
  return normalizePolyominoCells(cells)
    .map(cell => `${cell.x},${cell.y}`)
    .join(";");
}

function canonicalPolyominoSignature(cells) {
  return [...Array(8).keys()]
    .map(variant => polyominoSignature(transformPolyominoCells(cells, variant)))
    .sort()[0];
}

function generatePolyominoesByLevel(maxLevel) {
  const byLevel = new Map([[1, [[{ x: 0, y: 0 }]]]]);
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];

  for (let level = 2; level <= maxLevel; level += 1) {
    const seen = new Set();
    const nextShapes = [];
    byLevel.get(level - 1).forEach(shape => {
      shape.forEach(cell => {
        directions.forEach(direction => {
          const nextCell = { x: cell.x + direction.x, y: cell.y + direction.y };
          if (shape.some(existing => existing.x === nextCell.x && existing.y === nextCell.y)) return;
          const candidate = [...shape, nextCell];
          const signature = canonicalPolyominoSignature(candidate);
          if (seen.has(signature)) return;
          seen.add(signature);
          nextShapes.push(normalizePolyominoCells(candidate));
        });
      });
    });
    byLevel.set(level, nextShapes);
  }

  return byLevel;
}

function buildEntityCardDeck(baseCards) {
  const maxLevel = Math.max(...ENTITY_CARD_LEVELS);
  const polyominoesByLevel = generatePolyominoesByLevel(maxLevel);
  const entityCards = [];

  ENTITY_CARD_LEVELS.forEach(level => {
    const shapes = polyominoesByLevel.get(level) || [];
    const tier = ENTITY_CARD_TIERS[level];
    if (tier && shapes.length !== tier.expectedCount) {
      console.warn(`Niveau ${level} verwacht ${tier.expectedCount} vrije polyominoes, maar generator vond ${shapes.length}.`);
    }
    shapes.forEach((shape, index) => {
      const base = baseCards[(index + level) % baseCards.length];
      const signature = canonicalPolyominoSignature(shape);
      entityCards.push({
        ...base,
        id: `${base.id}-niveau-${level}-${String(index + 1).padStart(3, "0")}`,
        baseId: base.id,
        level,
        levelIndex: index + 1,
        roundBudget: level,
        prominenceTier: tier?.label || "filosoofkaart",
        expectedLevelCount: tier?.expectedCount || shapes.length,
        theory: base.theory,
        entityPattern: {
          signature,
          coordinates: normalizePolyominoCells(shape)
        }
      });
    });
  });

  return entityCards;
}

function applyRuntimeTheme(theme) {
  Object.entries(theme || {}).forEach(([name, value]) => {
    if (/^--[a-z0-9-]+$/.test(name)) document.documentElement.style.setProperty(name, String(value));
  });
}

async function loadPhilosopherCards() {
  PHILE_RUNTIME = await leerpretClient.get(`/leerbox-runtime/${LEARNING_BOX_ID}`);
  const settings = PHILE_RUNTIME.settings || {};
  Object.assign(DEFAULT_SETTINGS, {
    candidateCount: Number(settings.candidate_count || DEFAULT_SETTINGS.candidateCount),
    boardSize: Number(settings.board_size || DEFAULT_SETTINGS.boardSize),
    startNeuronCount: Number(settings.start_neuron_count || DEFAULT_SETTINGS.startNeuronCount),
    burnoutLimit: Number(settings.burnout_limit || DEFAULT_SETTINGS.burnoutLimit),
    rotationMode: settings.rotation_mode !== false
  });
  state.settings = { ...DEFAULT_SETTINGS };
  MAX_HAND_SIZE = Number(settings.max_hand_size || MAX_HAND_SIZE);
  ENTITY_CARD_LEVELS = settings.entity_card_levels || ENTITY_CARD_LEVELS;
  MAX_PLAYABLE_PATTERN_CELLS = Number(settings.max_playable_pattern_cells || MAX_PLAYABLE_PATTERN_CELLS);
  ENTITY_CARD_TIERS = settings.entity_card_tiers || ENTITY_CARD_TIERS;
  CARD_BLURBS = PHILE_RUNTIME.copy?.card_blurbs || [];
  applyRuntimeTheme(PHILE_RUNTIME.theme);
  if (!Array.isArray(PHILE_RUNTIME.cards) || PHILE_RUNTIME.cards.length === 0) {
    throw new Error("De LeerpretEngine leverde geen filosoofkaarten.");
  }
  PHILOSOPHER_CARDS = buildEntityCardDeck(PHILE_RUNTIME.cards.map(normalizePhilosopherCard));
}

function interactionTarget(event) {
  if (event.leerobjectId) return { id: event.leerobjectId, role: event.objectRole || "other" };
  if (event.actionType === "round_start") return { id: event.round === 1 ? "phile.start" : "phile.round", role: "self-starting" };
  if (event.actionType === "select_card") return { id: `phile.card.${event.cardId}`, role: "other" };
  if (event.actionType === "use_strength") return { id: `phile.mode.strength.${event.strengthType}`, role: "other" };
  if (event.actionType === "failed_guess") return { id: "phile.path.misfit", role: "resistance" };
  if (event.actionType === "win") return { id: "phile.path.goal", role: "success" };
  if (event.actionType === "place_neuron" && event.result === "success") return { id: "phile.path.growth", role: "success" };
  if (event.actionType === "place_neuron") return { id: "phile.path.repetition", role: "resistance" };
  return { id: "phile.interface", role: "other" };
}

function getLeerobject(id, role) {
  const key = `${role}:${id}`;
  if (leerobjects.has(key)) return leerobjects.get(key);
  const types = {
    "self-starting": LeerpretSDK.SelfStartingLeerobject,
    success: LeerpretSDK.SuccesLeerobject,
    resistance: LeerpretSDK.WeerstandLeerobject,
    other: LeerpretSDK.OverigLeerobject
  };
  const Type = types[role] || LeerpretSDK.OverigLeerobject;
  const object = new Type({
    client: leerpretClient,
    personId: PERSON_ID,
    leerboxId: LEARNING_BOX_ID,
    leerobjectId: id
  });
  leerobjects.set(key, object);
  return object;
}

function dispatchInteraction(event = {}) {
  const target = interactionTarget(event);
  const actionType = event.actionType || "interaction";
  const details = { ...event };
  delete details.leerobjectId;
  delete details.objectRole;
  const record = {
    timestamp: new Date().toISOString(),
    person_id: PERSON_ID,
    leerobject_id: target.id,
    leerbox_id: LEARNING_BOX_ID,
    action_type: actionType,
    delivery: "pending"
  };
  interactionBuffer.push(record);
  getLeerobject(target.id, target.role).interact(actionType, details)
    .then(() => { record.delivery = "accepted"; })
    .catch(error => {
      record.delivery = "failed";
      record.error = error.message;
      document.body.dataset.telemetry = "failed";
    });
  return record;
}

function getInteractionBuffer() {
  return [...interactionBuffer];
}

function clearInteractionBuffer() {
  interactionBuffer.length = 0;
}

window.PhileSimulator = {
  dispatchInteraction,
  getInteractionBuffer,
  clearInteractionBuffer,
  getStateSnapshot: () => ({
    level: state.level,
    score: state.score,
    status: state.status,
    entityCardCount: PHILOSOPHER_CARDS.length,
    playerHand: state.playerHand.map(card => ({
      id: card.id,
      philosopher: card.philosopher,
      level: card.cardLevel,
      roundBudget: card.roundBudget,
      prominenceTier: card.prominenceTier,
      strength: card.strength,
      type: card.type
    })),
    board: {
      size: state.board?.size,
      cells: state.board ? [...state.board.cells.entries()] : [],
      edges: state.board ? [...state.board.edges.entries()] : []
    }
  })
};

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const clone = [...list];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }
  return clone;
}

function formatCount(value) {
  return new Intl.NumberFormat("nl-NL").format(value);
}

function formatCompactCount(value) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(".", ",")} mln`;
  }
  return formatCount(value);
}

function coordKey(x, y) {
  return `${x},${y}`;
}

function parseCoordKey(value) {
  const [x, y] = value.split(",").map(Number);
  return { x, y };
}

function compareCoordKeys(left, right) {
  const a = parseCoordKey(left);
  const b = parseCoordKey(right);
  if (a.x !== b.x) return a.x - b.x;
  return a.y - b.y;
}

function sortPairKey(left, right) {
  return compareCoordKeys(left, right) <= 0 ? `${left}|${right}` : `${right}|${left}`;
}

function splitPairKey(value) {
  const [left, right] = value.split("|");
  return { left, right };
}

function chebyshevDistance(first, second) {
  return Math.max(Math.abs(first.x - second.x), Math.abs(first.y - second.y));
}

function inBounds(x, y, size) {
  return x >= 0 && y >= 0 && x < size && y < size;
}

function getNeighborDirections() {
  return [
    { dx: -1, dy: -1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 }
  ];
}

function neighbors8(x, y, size) {
  return getNeighborDirections()
    .map(direction => ({ x: x + direction.dx, y: y + direction.dy }))
    .filter(position => inBounds(position.x, position.y, size));
}

function getFocusSpread(boardSize) {
  if (boardSize >= 64) return 3;
  if (boardSize >= 32) return 2;
  return 1;
}

function getLocalPatchSpan(boardSize) {
  return getFocusSpread(boardSize) * 2 + 3;
}

function getBaseVariationCount(seedCount) {
  return 2 ** (8 * seedCount);
}

function totalSynapseLayers(edgeEntries) {
  if (edgeEntries instanceof Map) {
    return [...edgeEntries.values()].reduce((sum, value) => sum + value, 0);
  }
  return edgeEntries.reduce((sum, edge) => sum + edge.weight, 0);
}

function addBoardEdge(edgeMap, leftKey, rightKey, weight = 1) {
  if (!leftKey || !rightKey || leftKey === rightKey) return;
  const key = sortPairKey(leftKey, rightKey);
  edgeMap.set(key, (edgeMap.get(key) || 0) + weight);
}

function buildDegreeMap(board) {
  const degrees = new Map([...board.occupied].map(cellKey => [cellKey, 0]));
  board.edges.forEach((weight, edgeKey) => {
    const { left, right } = splitPairKey(edgeKey);
    degrees.set(left, (degrees.get(left) || 0) + weight);
    degrees.set(right, (degrees.get(right) || 0) + weight);
  });
  return degrees;
}

function createBoard(settings) {
  const size = settings.boardSize;
  const occupied = new Set();
  const edges = new Map();
  const clusterCount = size >= 64 ? 4 : size >= 32 ? 3 : 2;
  const targetNeurons = size >= 64 ? 180 : size >= 32 ? 84 : 34;
  const minSeedDistance = size >= 64 ? 14 : size >= 32 ? 8 : 4;

  const seedKeys = [];
  let seedAttempts = 0;
  while (seedKeys.length < clusterCount && seedAttempts < 500) {
    seedAttempts += 1;
    const candidate = {
      x: 2 + Math.floor(Math.random() * Math.max(1, size - 4)),
      y: 2 + Math.floor(Math.random() * Math.max(1, size - 4))
    };
    const farEnough = seedKeys.every(key => chebyshevDistance(candidate, parseCoordKey(key)) >= minSeedDistance);
    if (!farEnough) continue;
    const key = coordKey(candidate.x, candidate.y);
    seedKeys.push(key);
    occupied.add(key);
  }

  if (seedKeys.length === 0) {
    const centerKey = coordKey(Math.floor(size / 2), Math.floor(size / 2));
    seedKeys.push(centerKey);
    occupied.add(centerKey);
  }

  let attempts = 0;
  while (occupied.size < targetNeurons && attempts < targetNeurons * 40) {
    attempts += 1;
    const baseKey = randomFrom([...occupied]);
    const base = parseCoordKey(baseKey);
    const options = neighbors8(base.x, base.y, size).filter(position => !occupied.has(coordKey(position.x, position.y)));
    if (options.length === 0) continue;
    const chosen = randomFrom(options);
    occupied.add(coordKey(chosen.x, chosen.y));

    if (Math.random() < 0.24 && occupied.size < targetNeurons) {
      const extraOptions = neighbors8(chosen.x, chosen.y, size).filter(position => !occupied.has(coordKey(position.x, position.y)));
      if (extraOptions.length > 0) {
        const extra = randomFrom(extraOptions);
        occupied.add(coordKey(extra.x, extra.y));
      }
    }
  }

  const occupiedCells = [...occupied].map(parseCoordKey);
  occupiedCells.forEach(cell => {
    neighbors8(cell.x, cell.y, size)
      .map(position => coordKey(position.x, position.y))
      .filter(neighborKey => occupied.has(neighborKey) && compareCoordKeys(coordKey(cell.x, cell.y), neighborKey) < 0)
      .forEach(neighborKey => {
        const neighbor = parseCoordKey(neighborKey);
        const diagonal = Math.abs(neighbor.x - cell.x) === 1 && Math.abs(neighbor.y - cell.y) === 1;
        const chance = diagonal ? 0.34 : 0.42;
        if (Math.random() < chance) {
          addBoardEdge(edges, coordKey(cell.x, cell.y), neighborKey, Math.random() < 0.12 ? 2 : 1);
        }
      });
  });

  const degreeMap = buildDegreeMap({ occupied, edges });
  [...occupied].forEach(cellKey => {
    if ((degreeMap.get(cellKey) || 0) > 0) return;
    const cell = parseCoordKey(cellKey);
    const occupiedNeighbors = neighbors8(cell.x, cell.y, size)
      .map(position => coordKey(position.x, position.y))
      .filter(neighborKey => occupied.has(neighborKey));
    if (occupiedNeighbors.length === 0) return;
    addBoardEdge(edges, cellKey, randomFrom(occupiedNeighbors), 1);
  });

  return { size, occupied, edges };
}

function buildPlayableBoard(settings) {
  let board = createBoard(settings);
  let patterns = enumerateFocusPatterns(board, settings);
  let attempts = 0;

  while (patterns.size === 0 && attempts < 5) {
    board = createBoard(settings);
    patterns = enumerateFocusPatterns(board, settings);
    attempts += 1;
  }

  return board;
}

function normalizePattern(pattern) {
  const minX = Math.min(...pattern.cells.map(cell => cell.x));
  const minY = Math.min(...pattern.cells.map(cell => cell.y));
  const cellMap = new Map();

  pattern.cells.forEach(cell => {
    const normalizedX = cell.x - minX;
    const normalizedY = cell.y - minY;
    const key = coordKey(normalizedX, normalizedY);
    const current = cellMap.get(key);
    if (current) {
      current.isFocus = current.isFocus || Boolean(cell.isFocus);
      return;
    }
    cellMap.set(key, {
      key,
      x: normalizedX,
      y: normalizedY,
      isFocus: Boolean(cell.isFocus)
    });
  });

  const originalToNormalized = new Map();
  pattern.cells.forEach(cell => {
    originalToNormalized.set(coordKey(cell.x, cell.y), coordKey(cell.x - minX, cell.y - minY));
  });

  const edgeMap = new Map();
  pattern.edges.forEach(edge => {
    const fromKey = originalToNormalized.get(coordKey(edge.from.x, edge.from.y));
    const toKey = originalToNormalized.get(coordKey(edge.to.x, edge.to.y));
    if (!fromKey || !toKey || fromKey === toKey) return;
    addBoardEdge(edgeMap, fromKey, toKey, edge.weight || 1);
  });

  const cells = [...cellMap.values()].sort((left, right) => {
    if (left.x !== right.x) return left.x - right.x;
    return left.y - right.y;
  });

  const edges = [...edgeMap.entries()]
    .map(([edgeKey, weight]) => {
      const { left, right } = splitPairKey(edgeKey);
      return {
        from: left,
        to: right,
        weight
      };
    })
    .sort((left, right) => {
      const first = compareCoordKeys(left.from, right.from);
      if (first !== 0) return first;
      return compareCoordKeys(left.to, right.to);
    });

  return {
    cells,
    edges,
    width: Math.max(...cells.map(cell => cell.x)) + 1,
    height: Math.max(...cells.map(cell => cell.y)) + 1
  };
}

function rotatePattern(pattern, turns) {
  const normalized = normalizePattern(pattern);
  const quarterTurns = ((turns % 4) + 4) % 4;
  if (quarterTurns === 0) return normalized;

  const rotateCell = cell => {
    if (quarterTurns === 1) {
      return {
        x: normalized.height - 1 - cell.y,
        y: cell.x,
        isFocus: cell.isFocus
      };
    }
    if (quarterTurns === 2) {
      return {
        x: normalized.width - 1 - cell.x,
        y: normalized.height - 1 - cell.y,
        isFocus: cell.isFocus
      };
    }
    return {
      x: cell.y,
      y: normalized.width - 1 - cell.x,
      isFocus: cell.isFocus
    };
  };

  const lookup = new Map(normalized.cells.map(cell => [cell.key, cell]));
  const rotatedCells = normalized.cells.map(rotateCell);
  const rotatedEdges = normalized.edges.map(edge => ({
    from: rotateCell(lookup.get(edge.from)),
    to: rotateCell(lookup.get(edge.to)),
    weight: edge.weight
  }));

  return normalizePattern({
    cells: rotatedCells,
    edges: rotatedEdges
  });
}

function serializePattern(pattern) {
  const normalized = normalizePattern(pattern);
  const cellsPart = normalized.cells
    .map(cell => `${cell.x},${cell.y}${cell.isFocus ? "*" : ""}`)
    .join(";");
  const edgesPart = normalized.edges
    .map(edge => `${edge.from}>${edge.to}:${edge.weight}`)
    .join(";");
  return `${cellsPart}|${edgesPart}`;
}

function canonicalSignature(pattern) {
  const variants = [0, 1, 2, 3].map(turns => serializePattern(rotatePattern(pattern, turns)));
  variants.sort();
  return variants[0];
}

function patternConnected(pattern) {
  const adjacency = new Map(pattern.cells.map(cell => [cell.key, new Set()]));
  pattern.edges.forEach(edge => {
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  });

  const start = pattern.cells[0];
  if (!start) return false;
  const queue = [start.key];
  const seen = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    adjacency.get(current)?.forEach(next => {
      if (!seen.has(next)) queue.push(next);
    });
  }

  return seen.size === pattern.cells.length;
}

function extractFocusPattern(board, focusKeys) {
  const focusSet = new Set(focusKeys);
  const cellMap = new Map();

  focusKeys.forEach(cellKey => {
    const cell = parseCoordKey(cellKey);
    cellMap.set(cellKey, { x: cell.x, y: cell.y, isFocus: true });
  });

  board.edges.forEach((weight, edgeKey) => {
    const { left, right } = splitPairKey(edgeKey);
    if (!focusSet.has(left) && !focusSet.has(right)) return;
    const leftCell = parseCoordKey(left);
    const rightCell = parseCoordKey(right);
    cellMap.set(left, {
      x: leftCell.x,
      y: leftCell.y,
      isFocus: focusSet.has(left)
    });
    cellMap.set(right, {
      x: rightCell.x,
      y: rightCell.y,
      isFocus: focusSet.has(right)
    });
  });

  const edges = [];
  board.edges.forEach((weight, edgeKey) => {
    const { left, right } = splitPairKey(edgeKey);
    if (!cellMap.has(left) || !cellMap.has(right)) return;
    edges.push({
      from: parseCoordKey(left),
      to: parseCoordKey(right),
      weight
    });
  });

  const pattern = normalizePattern({
    cells: [...cellMap.values()],
    edges
  });

  if (pattern.cells.length < 2 || pattern.edges.length === 0) return null;
  if (!patternConnected(pattern)) return null;
  return pattern;
}

function combinations(items, size) {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  if (size === 1) return items.map(item => [item]);

  const result = [];
  for (let index = 0; index <= items.length - size; index += 1) {
    const head = items[index];
    combinations(items.slice(index + 1), size - 1).forEach(tail => {
      result.push([head, ...tail]);
    });
  }
  return result;
}

function enumerateFocusPatterns(board, settings) {
  const spread = getFocusSpread(settings.boardSize);
  const degreeMap = buildDegreeMap(board);
  const occupiedKeys = [...board.occupied].filter(cellKey => (degreeMap.get(cellKey) || 0) > 0);
  const focusSets = new Set();
  const patternsBySignature = new Map();

  occupiedKeys.forEach(startKey => {
    const start = parseCoordKey(startKey);
    const nearby = occupiedKeys.filter(cellKey => {
      if (cellKey === startKey) return false;
      return chebyshevDistance(start, parseCoordKey(cellKey)) <= spread;
    });

    const options = settings.seedCount === 1 ? [[]] : combinations(nearby, settings.seedCount - 1);
    options.forEach(option => {
      const focusKeys = [startKey, ...option].sort(compareCoordKeys);
      if (focusKeys.length !== settings.seedCount) return;
      const focusSetKey = focusKeys.join(";");
      if (focusSets.has(focusSetKey)) return;
      focusSets.add(focusSetKey);

      const pattern = extractFocusPattern(board, focusKeys);
      if (!pattern) return;
      const signature = canonicalSignature(pattern);
      if (!patternsBySignature.has(signature)) {
        patternsBySignature.set(signature, pattern);
      }
    });
  });

  return patternsBySignature;
}

function addRawEdge(edgeMap, from, to, weight = 1) {
  const fromKey = coordKey(from.x, from.y);
  const toKey = coordKey(to.x, to.y);
  if (fromKey === toKey) return;
  addBoardEdge(edgeMap, fromKey, toKey, weight);
}

function rawEdgeMapToList(edgeMap) {
  return [...edgeMap.entries()].map(([edgeKey, weight]) => {
    const { left, right } = splitPairKey(edgeKey);
    return {
      from: parseCoordKey(left),
      to: parseCoordKey(right),
      weight
    };
  });
}

function generateRandomPattern(settings) {
  const spread = getFocusSpread(settings.boardSize);
  const side = getLocalPatchSpan(settings.boardSize);
  const center = Math.floor(side / 2);
  const focusMap = new Map([[coordKey(center, center), { x: center, y: center, isFocus: true }]]);
  const occupiedMap = new Map([[coordKey(center, center), { x: center, y: center, isFocus: true }]]);
  const edgeMap = new Map();

  while (focusMap.size < settings.seedCount) {
    const focusCells = [...focusMap.values()];
    const base = randomFrom(focusCells);
    let current = { x: base.x, y: base.y };
    const stepCount = 1 + Math.floor(Math.random() * Math.max(1, spread + 1));

    for (let step = 0; step < stepCount; step += 1) {
      const options = neighbors8(current.x, current.y, side).filter(position => !focusMap.has(coordKey(position.x, position.y)));
      if (options.length === 0) break;
      current = randomFrom(options);
    }

    const nextKey = coordKey(current.x, current.y);
    if (!focusMap.has(nextKey)) {
      const focusCell = { x: current.x, y: current.y, isFocus: true };
      focusMap.set(nextKey, focusCell);
      occupiedMap.set(nextKey, focusCell);
    }
  }

  const maxCells = Math.min(side * side, settings.seedCount * (spread + 4) + 2);
  const focusCells = [...focusMap.values()];

  focusCells.forEach(focus => {
    const neighborOptions = shuffle(neighbors8(focus.x, focus.y, side));
    let added = 0;

    neighborOptions.forEach(neighbor => {
      if (occupiedMap.size >= maxCells) return;
      const neighborKey = coordKey(neighbor.x, neighbor.y);
      const shouldUse = Math.random() < (focusMap.has(neighborKey) ? 0.58 : 0.42);
      if (!shouldUse && added > 0) return;

      if (!occupiedMap.has(neighborKey)) {
        occupiedMap.set(neighborKey, {
          x: neighbor.x,
          y: neighbor.y,
          isFocus: focusMap.has(neighborKey)
        });
      }

      addRawEdge(edgeMap, focus, neighbor, Math.random() < 0.14 ? 2 : 1);
      added += 1;
    });

    if (added === 0) {
      const fallback = neighborOptions[0];
      if (fallback) {
        const fallbackKey = coordKey(fallback.x, fallback.y);
        if (!occupiedMap.has(fallbackKey)) {
          occupiedMap.set(fallbackKey, {
            x: fallback.x,
            y: fallback.y,
            isFocus: focusMap.has(fallbackKey)
          });
        }
        addRawEdge(edgeMap, focus, fallback, 1);
      }
    }
  });

  for (let growthRound = 0; growthRound < spread; growthRound += 1) {
    shuffle([...occupiedMap.values()]).forEach(base => {
      if (occupiedMap.size >= maxCells || Math.random() > 0.28) return;
      const options = neighbors8(base.x, base.y, side).filter(position => !occupiedMap.has(coordKey(position.x, position.y)));
      if (options.length === 0) return;
      const next = randomFrom(options);
      occupiedMap.set(coordKey(next.x, next.y), {
        x: next.x,
        y: next.y,
        isFocus: false
      });
      addRawEdge(edgeMap, base, next, Math.random() < 0.1 ? 2 : 1);
    });
  }

  const occupiedCells = [...occupiedMap.values()];
  occupiedCells.forEach(cell => {
    neighbors8(cell.x, cell.y, side)
      .map(position => coordKey(position.x, position.y))
      .filter(neighborKey => occupiedMap.has(neighborKey) && compareCoordKeys(coordKey(cell.x, cell.y), neighborKey) < 0)
      .forEach(neighborKey => {
        const key = sortPairKey(coordKey(cell.x, cell.y), neighborKey);
        if (edgeMap.has(key)) return;
        if (Math.random() < 0.16 + spread * 0.04) {
          addRawEdge(edgeMap, cell, parseCoordKey(neighborKey), 1);
        }
      });
  });

  return normalizePattern({
    cells: occupiedCells,
    edges: rawEdgeMapToList(edgeMap)
  });
}

function createExternalPattern(existingSignatures, settings) {
  for (let attempt = 0; attempt < 320; attempt += 1) {
    const candidate = generateRandomPattern(settings);
    if (candidate.cells.length < 2 || candidate.edges.length === 0) continue;
    if (!patternConnected(candidate)) continue;
    const signature = canonicalSignature(candidate);
    if (!existingSignatures.has(signature)) {
      return candidate;
    }
  }

  return normalizePattern({
    cells: [
      { x: 1, y: 1, isFocus: true },
      { x: 2, y: 1, isFocus: false },
      { x: 2, y: 2, isFocus: false },
      { x: 3, y: 2, isFocus: false }
    ],
    edges: [
      { from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, weight: 1 },
      { from: { x: 2, y: 1 }, to: { x: 2, y: 2 }, weight: 2 },
      { from: { x: 2, y: 2 }, to: { x: 3, y: 2 }, weight: 1 }
    ]
  });
}

function createGuidance() {
  return {
    ...randomFrom(PHILOSOPHER_CARDS),
    blurb: randomFrom(CARD_BLURBS)
  };
}

function createEdgeRecord(kind = "core") {
  return {
    id: makeId("synapse"),
    kind,
    heat: 0
  };
}

function createCellRecord(kind = "core") {
  return {
    id: makeId("neuron"),
    kind,
    heat: 0
  };
}

function getAllActiveKeys(board) {
  return [...board.cells.keys()];
}

function getIncidentEdgeKeys(board, cellKey) {
  return [...board.edges.keys()].filter(edgeKey => {
    const { left, right } = splitPairKey(edgeKey);
    return left === cellKey || right === cellKey;
  });
}

function getConnectedDegree(board, cellKey) {
  return getIncidentEdgeKeys(board, cellKey).reduce((count, edgeKey) => {
    const { left, right } = splitPairKey(edgeKey);
    return count + (board.connected.has(left) && board.connected.has(right) ? 1 : 0);
  }, 0);
}

function ensureBoardEdge(board, leftKey, rightKey, kind = "core") {
  const edgeKey = sortPairKey(leftKey, rightKey);
  const current = board.edges.get(edgeKey);
  if (current) {
    if (kind === "grown" && current.kind !== "target-link") {
      current.kind = "grown";
    }
    return edgeKey;
  }

  board.edges.set(edgeKey, createEdgeRecord(kind));
  return edgeKey;
}

function buildPatternFromBoardSubset(board, cellKeys, focusKeys = new Set(), extraEdges = []) {
  const keySet = new Set(cellKeys);
  const cells = [...keySet].map(cellKey => {
    const cell = parseCoordKey(cellKey);
    return {
      x: cell.x,
      y: cell.y,
      isFocus: focusKeys.has(cellKey)
    };
  });

  const edges = [];
  board.edges.forEach((edgeValue, edgeKey) => {
    const { left, right } = splitPairKey(edgeKey);
    if (!keySet.has(left) || !keySet.has(right)) return;
    edges.push({
      from: parseCoordKey(left),
      to: parseCoordKey(right),
      weight: 1
    });
  });

  extraEdges.forEach(edge => {
    edges.push(edge);
  });

  return normalizePattern({ cells, edges });
}

function createStartCluster(settings) {
  const size = settings.boardSize;
  const cells = new Map();
  const edges = new Map();
  const connected = new Set();
  const onRight = Math.random() > 0.5;
  const origin = {
    x: Math.floor(size * (onRight ? 0.72 : 0.28)),
    y: Math.floor(size * (0.3 + Math.random() * 0.4))
  };
  const radiusLimit = Math.max(3, Math.ceil(settings.startNeuronCount / 3));
  const originKey = coordKey(origin.x, origin.y);

  cells.set(originKey, createCellRecord("core"));
  connected.add(originKey);

  let attempts = 0;
  while (connected.size < settings.startNeuronCount && attempts < settings.startNeuronCount * 40) {
    attempts += 1;
    const baseKey = randomFrom([...connected]);
    const base = parseCoordKey(baseKey);
    const options = shuffle(neighbors8(base.x, base.y, size)).filter(position => {
      const nextKey = coordKey(position.x, position.y);
      if (cells.has(nextKey)) return false;
      return chebyshevDistance(position, origin) <= radiusLimit;
    });

    if (options.length === 0) continue;

    const chosen = options[0];
    const chosenKey = coordKey(chosen.x, chosen.y);
    cells.set(chosenKey, createCellRecord("core"));
    connected.add(chosenKey);
    ensureBoardEdge({ edges }, baseKey, chosenKey, "core");

    neighbors8(chosen.x, chosen.y, size)
      .map(position => coordKey(position.x, position.y))
      .filter(neighborKey => connected.has(neighborKey) && neighborKey !== baseKey)
      .forEach(neighborKey => {
        if (Math.random() < 0.28) {
          ensureBoardEdge({ edges }, chosenKey, neighborKey, "core");
        }
      });
  }

  return {
    size,
    cells,
    edges,
    connected
  };
}

function targetOpenZoneRadius(boardSize) {
  if (boardSize >= 64) return 3;
  return 2;
}

function hasOpenTargetZone(board, x, y, radius) {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nextX = x + dx;
      const nextY = y + dy;
      if (!inBounds(nextX, nextY, board.size)) return false;
      if (board.cells.has(coordKey(nextX, nextY))) return false;
    }
  }
  return true;
}

function collectTargetCandidates(board, openRadius) {
  const candidates = [];
  for (let y = 1; y < board.size - 1; y += 1) {
    for (let x = 1; x < board.size - 1; x += 1) {
      const key = coordKey(x, y);
      if (board.cells.has(key)) continue;
      if (!hasOpenTargetZone(board, x, y, openRadius)) continue;

      const distance = Math.min(...[...board.connected].map(cellKey => chebyshevDistance({ x, y }, parseCoordKey(cellKey))));
      candidates.push({ key, distance });
    }
  }
  candidates.sort((left, right) => right.distance - left.distance);
  return candidates;
}

function chooseTargetKey(board) {
  for (let openRadius = targetOpenZoneRadius(board.size); openRadius >= 1; openRadius -= 1) {
    const candidates = collectTargetCandidates(board, openRadius);
    if (candidates.length > 0) {
      return candidates[0].key;
    }
  }

  return null;
}

function findShortestPath(board, startKey, targetKey) {
  const queue = [startKey];
  const parent = new Map([[startKey, null]]);

  while (queue.length > 0) {
    const currentKey = queue.shift();
    if (currentKey === targetKey) break;

    const current = parseCoordKey(currentKey);
    neighbors8(current.x, current.y, board.size).forEach(next => {
      const nextKey = coordKey(next.x, next.y);
      if (parent.has(nextKey)) return;
      if (board.cells.has(nextKey) && nextKey !== targetKey) return;
      parent.set(nextKey, currentKey);
      queue.push(nextKey);
    });
  }

  if (!parent.has(targetKey)) return null;

  const path = [];
  let currentKey = targetKey;
  while (currentKey) {
    path.push(currentKey);
    currentKey = parent.get(currentKey);
  }
  path.reverse();
  return path;
}

function buildChallengeBoard(settings) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const board = createStartCluster(settings);
    const targetKey = chooseTargetKey(board);
    if (!targetKey) continue;

    const pathCandidates = [...board.connected]
      .map(frontierKey => ({
        frontierKey,
        path: findShortestPath(board, frontierKey, targetKey)
      }))
      .filter(item => item.path && item.path.length > 2)
      .sort((left, right) => left.path.length - right.path.length);

    if (pathCandidates.length === 0) continue;

    const best = pathCandidates[0];
    board.targetKey = targetKey;
    board.frontierKey = best.frontierKey;
    board.pathKeys = best.path.slice(1);
    board.progressIndex = 0;
    board.cells.set(targetKey, createCellRecord("target"));
    return board;
  }

  throw new Error("Kon geen speelbaar rasterbord genereren.");
}

function createCandidateFromSpec(spec) {
  const guidance = createGuidance();
  const shouldRotate = state.settings.rotationMode && spec.type !== "success";
  const displayPattern = shouldRotate
    ? rotatePattern(spec.pattern, Math.floor(Math.random() * 4))
    : normalizePattern(spec.pattern);

  return {
    id: makeId(spec.type),
    cardId: guidance.id,
    type: spec.type,
    tradition: guidance.tradition,
    philosopher: guidance.philosopher,
    title: guidance.title,
    summary: guidance.summary,
    cardLevel: guidance.level,
    roundBudget: guidance.roundBudget,
    prominenceTier: guidance.prominenceTier,
    theory: guidance.theory,
    entityPattern: guidance.entityPattern,
    strength: guidance.strength,
    blurb: spec.blurb || guidance.blurb,
    pattern: displayPattern,
    action: spec.action,
    result: ""
  };
}

function pathStepsRemaining(board) {
  return Math.max(0, board.pathKeys.length - board.progressIndex);
}

function buildSuccessSpec(board) {
  const nextKey = board.pathKeys[board.progressIndex];
  const previousKey = board.progressIndex === 0 ? board.frontierKey : board.pathKeys[board.progressIndex - 1];
  const focusKeys = new Set([previousKey, nextKey]);
  const patternKeys = [previousKey, nextKey];

  const supportEdgeKey = getIncidentEdgeKeys(board, previousKey)
    .find(edgeKey => {
      const { left, right } = splitPairKey(edgeKey);
      const otherKey = left === previousKey ? right : left;
      return board.connected.has(otherKey) && otherKey !== nextKey;
    });

  if (supportEdgeKey) {
    const { left, right } = splitPairKey(supportEdgeKey);
    patternKeys.push(left === previousKey ? right : left);
  }

  const previous = parseCoordKey(previousKey);
  const next = parseCoordKey(nextKey);
  const extraEdges = board.cells.has(nextKey) && nextKey !== board.targetKey
    ? []
    : [{ from: previous, to: next, weight: 1 }];

  return {
    type: "success",
    pattern: buildPatternFromBoardSubset(board, patternKeys, focusKeys, extraEdges),
    action: {
      nextKey,
      previousKey
    },
    blurb: "Deze kaart haakt bijna volledig aan en opent precies de volgende stap richting de eenzame neuron."
  };
}

function collectReinforcementSpecs(board) {
  const specs = [];
  const seen = new Set();
  const connectedKeys = [...board.connected].filter(cellKey => cellKey !== board.targetKey);

  connectedKeys.forEach(anchorKey => {
    const incidentEdges = getIncidentEdgeKeys(board, anchorKey).filter(edgeKey => {
      const { left, right } = splitPairKey(edgeKey);
      return board.connected.has(left) && board.connected.has(right);
    });

    if (incidentEdges.length === 0) return;

    const cellKeys = new Set([anchorKey]);
    incidentEdges.slice(0, Math.min(3, incidentEdges.length)).forEach(edgeKey => {
      const { left, right } = splitPairKey(edgeKey);
      cellKeys.add(left);
      cellKeys.add(right);
    });

    const pattern = buildPatternFromBoardSubset(board, [...cellKeys], new Set([anchorKey]));
    const signature = `${canonicalSignature(pattern)}|${[...cellKeys].sort(compareCoordKeys).join(";")}`;
    if (seen.has(signature)) return;
    seen.add(signature);

    specs.push({
      type: "reinforce",
      pattern,
      action: {
        cellKeys: [...cellKeys],
        edgeKeys: incidentEdges.slice(0, Math.min(3, incidentEdges.length))
      },
      blurb: "Deze kaart leest een bestaand patroon uit het actieve raster. Klikken versterkt wat er al is, maar brengt je niet dichter bij het doel."
    });
  });

  return specs;
}

function buildMisfitPattern() {
  const root = { x: 2, y: 2 };
  const cells = [
    { x: root.x, y: root.y, isFocus: true },
    { x: root.x + 1, y: root.y - 1, isFocus: false },
    { x: root.x + 2, y: root.y, isFocus: false },
    { x: root.x + 2, y: root.y + 1, isFocus: false }
  ];
  const edges = [
    { from: { x: root.x, y: root.y }, to: { x: root.x + 1, y: root.y - 1 }, weight: 1 },
    { from: { x: root.x + 1, y: root.y - 1 }, to: { x: root.x + 2, y: root.y }, weight: 1 },
    { from: { x: root.x + 2, y: root.y }, to: { x: root.x + 2, y: root.y + 1 }, weight: 1 }
  ];

  return normalizePattern({ cells, edges });
}

function buildMisfitSpec(avoidSignatures) {
  let pattern = buildMisfitPattern();
  let signature = canonicalSignature(pattern);

  if (avoidSignatures.has(signature)) {
    pattern = rotatePattern(pattern, 1);
    signature = canonicalSignature(pattern);
  }

  return {
    type: "misfit",
    pattern,
    action: {},
    blurb: "Deze kaart sluit niet echt aan op het levende raster. Klikken betekent direct verlies door een los patroon."
  };
}

function buildCandidatePool(poolSize = state.settings.candidateCount) {
  const reinforcementSpecs = shuffle(collectReinforcementSpecs(state.board));
  const successSpec = buildSuccessSpec(state.board);
  const signatureBlock = new Set(reinforcementSpecs.map(spec => canonicalSignature(spec.pattern)));
  signatureBlock.add(canonicalSignature(successSpec.pattern));
  const misfitSpec = buildMisfitSpec(signatureBlock);

  const reinforcementCount = Math.max(0, poolSize - 2);
  const chosenSpecs = [];

  for (let index = 0; index < reinforcementCount; index += 1) {
    const source = reinforcementSpecs[index % reinforcementSpecs.length] || reinforcementSpecs[0] || successSpec;
    chosenSpecs.push(source);
  }

  chosenSpecs.push(successSpec, misfitSpec);

  return {
    candidates: shuffle(chosenSpecs.map(createCandidateFromSpec))
      .filter(candidate => candidate.pattern.cells.length <= MAX_PLAYABLE_PATTERN_CELLS),
    reinforcementCount
  };
}

function drawCardsToHand(count = 1) {
  const targetCount = Math.min(MAX_HAND_SIZE, state.playerHand.length + Math.max(0, count));
  const currentSignatures = new Set(state.playerHand.map(candidate => canonicalSignature(candidate.pattern)));

  while (state.playerHand.length < targetCount) {
    const needed = targetCount - state.playerHand.length;
    const poolSize = Math.max(MAX_HAND_SIZE, state.settings.candidateCount, needed + 2);
    const { candidates } = buildCandidatePool(poolSize);
    const variedCandidates = candidates.filter(candidate => !currentSignatures.has(canonicalSignature(candidate.pattern)));
    const drawSource = variedCandidates.length >= needed ? variedCandidates : candidates;

    drawSource.slice(0, needed).forEach(candidate => {
      currentSignatures.add(canonicalSignature(candidate.pattern));
      state.playerHand.push(candidate);
    });
  }
}

function removeCardFromHand(candidateId) {
  state.playerHand = state.playerHand.filter(candidate => candidate.id !== candidateId);
}

function refreshRoundFromHand() {
  state.playerHand = state.playerHand.map((candidate, index) => ({
    ...candidate,
    displayIndex: index + 1
  }));

  state.round = {
    candidates: state.playerHand
  };

  state.selectedCandidateId = null;
  state.pendingChoiceCandidateId = null;
  state.roundResolved = false;

  roundMeta.textContent =
    `Spelbord. Ronde ${state.level}. Doelpad ${pathStepsRemaining(state.board)} stappen, ` +
    `${state.settings.startNeuronCount} startneuronen, filelimiet ${state.settings.burnoutLimit}.`;
  cardRailMeta.textContent =
    `Hand ${state.playerHand.length}/${MAX_HAND_SIZE}. Deck ${PHILOSOPHER_CARDS.length} Entity Cards over niveau 5 t/m 8.`;
}

function generateRound() {
  drawCardsToHand(MAX_HAND_SIZE - state.playerHand.length);
  refreshRoundFromHand();
  dispatchInteraction({
    actionType: "round_start",
    round: state.level,
    handSize: state.playerHand.length,
    entityCardCount: PHILOSOPHER_CARDS.length,
    boardCellCount: state.board.cells.size,
    boardEdgeCount: state.board.edges.size
  });
}

function applySuccessAction(candidate) {
  const { nextKey, previousKey } = candidate.action;
  if (!state.board.cells.has(nextKey)) {
    state.board.cells.set(nextKey, createCellRecord("grown"));
  } else if (nextKey === state.board.targetKey) {
    state.board.cells.get(nextKey).kind = "target";
  }

  state.board.connected.add(nextKey);
  ensureBoardEdge(state.board, previousKey, nextKey, nextKey === state.board.targetKey ? "target-link" : "grown");
  state.board.progressIndex += 1;

  if (nextKey === state.board.targetKey) {
    state.status = "won";
    state.score += 25;
    return "Je hebt de eenzame neuron bereikt. De nieuwe groene verbinding maakt het bord nu echt verbonden.";
  }

  state.score += 10;
  return `Nieuwe groene neuronen en verbindingen toegevoegd. De groei schoof een stap op richting de eenzame neuron. Nog ${pathStepsRemaining(state.board)} stap${pathStepsRemaining(state.board) === 1 ? "" : "pen"} te gaan.`;
}

function applyReinforcementAction(candidate) {
  let overheated = false;

  candidate.action.cellKeys.forEach(cellKey => {
    const cell = state.board.cells.get(cellKey);
    if (!cell) return;
    cell.heat += 1;
    overheated = overheated || cell.heat >= state.settings.burnoutLimit;
  });

  candidate.action.edgeKeys.forEach(edgeKey => {
    const edge = state.board.edges.get(edgeKey);
    if (!edge) return;
    edge.heat += 1;
    overheated = overheated || edge.heat >= state.settings.burnoutLimit;
  });

  if (overheated) {
    state.status = "lost";
    return "Verloren. Dit patroon kleurde te vaak donkerrood en het brein liep vast in een file van verstarring.";
  }

  state.score = Math.max(0, state.score - 1);
  return "Deze kaart kleurde een bestaand patroon roder. Het raster raakte dichter bij file, maar je schoof niet op richting de eenzame neuron.";
}

function getCandidateById(candidateId) {
  return state.round?.candidates.find(candidate => candidate.id === candidateId) || null;
}

function rememberPlayedCard(candidate, result, mode) {
  state.lastPlayedCard = {
    round: state.level,
    title: candidate.title,
    philosopher: candidate.philosopher,
    tradition: candidate.tradition,
    neuronCount: candidate.pattern.cells.length,
    synapseLayers: totalSynapseLayers(candidate.pattern.edges),
    role: candidate.type,
    result,
    mode,
    strength: candidate.strength
  };
}

function findHottestFileCell() {
  return [...state.board.cells.entries()]
    .filter(([, cell]) => cell.heat > 0)
    .sort((left, right) => right[1].heat - left[1].heat)[0] || null;
}

function actionSwap() {
  drawCardsToHand(1);
  return "Kracht ingezet: je hebt een kaart gewisseld voor een nieuwe mogelijkheid uit de leerbox.";
}

function actionCleanse(cellKey = null) {
  const target = cellKey && state.board.cells.get(cellKey)?.heat > 0
    ? [cellKey, state.board.cells.get(cellKey)]
    : findHottestFileCell();

  if (!target) {
    return "Kracht ingezet: er was nog geen verhitte file-neuron om op te schonen.";
  }

  const [targetKey, cell] = target;
  const previousHeat = cell.heat;
  cell.heat = 0;
  state.score += 2;

  return `Kracht ingezet: file-neuron ${targetKey} is gereset van hitte ${previousHeat} naar 0.`;
}

function actionDoublePlay() {
  state.doublePlayCredits += 1;
  return "Kracht ingezet: je mag deze ronde nog een extra Breinkaart spelen voordat de ronde sluit.";
}

function actionThinkTime() {
  state.freeReflectTurns += 1;
  state.score += 1;
  return "Kracht ingezet: je opent discussie en neemt bedenktijd. Het spel pauzeert fictief, maar je bordpositie verandert niet vanzelf.";
}

function actionDraw() {
  drawCardsToHand(MAX_HAND_SIZE - state.playerHand.length);
  return "Kracht ingezet: je trekt door tot je hand weer maximaal gevuld is.";
}

function playCandidateAsStrength(candidateId) {
  const chosen = getCandidateById(candidateId);
  if (!chosen || state.status !== "playing") return;

  state.selectedCandidateId = chosen.id;
  state.round.candidates.forEach(candidate => {
    candidate.result = "";
  });

  removeCardFromHand(chosen.id);

  const strengthType = chosen.strength?.type || "draw";
  let feedbackMessage = "";

  if (strengthType === "swap") {
    feedbackMessage = actionSwap();
  } else if (strengthType === "cleanse") {
    feedbackMessage = actionCleanse();
  } else if (strengthType === "double_play") {
    feedbackMessage = actionDoublePlay();
  } else if (strengthType === "think_time") {
    feedbackMessage = actionThinkTime();
  } else {
    feedbackMessage = actionDraw();
  }

  rememberPlayedCard(chosen, "strength", "Actiekaart");
  dispatchInteraction({
    actionType: "use_strength",
    round: state.level,
    cardId: chosen.cardId,
    candidateId: chosen.id,
    philosopher: chosen.philosopher,
    cardLevel: chosen.cardLevel,
    roundBudget: chosen.roundBudget,
    prominenceTier: chosen.prominenceTier,
    strengthType,
    handSize: state.playerHand.length
  });

  state.feedbackMessage = `${feedbackMessage}\nDe kaart verdwijnt uit je hand zonder neuron te plaatsen.`;

  if (state.playerHand.length === 0) {
    state.feedbackMessage += "\nJe hand is leeg; de leerbox vult automatisch een nieuwe ronde aan.";
    nextRound();
    return;
  }

  refreshRoundFromHand();
  renderAll();
}

function playCandidateAsNeuron(candidateId) {
  const chosen = getCandidateById(candidateId);
  if (!chosen || state.status !== "playing") return;

  state.selectedCandidateId = chosen.id;
  state.round.candidates.forEach(candidate => {
    candidate.result = "";
  });

  let feedbackMessage = "";
  if (chosen.type === "success") {
    chosen.result = "success";
    feedbackMessage = applySuccessAction(chosen);
  } else if (chosen.type === "reinforce") {
    feedbackMessage = applyReinforcementAction(chosen);
    chosen.result = state.status === "lost" ? "burnout" : "reinforce";
  } else {
    chosen.result = "misfit";
    state.status = "lost";
    feedbackMessage =
      "Verloren. Deze kaart sloot niet aan op het levende raster en liet de weg naar de eenzame neuron volledig los.";
  }

  rememberPlayedCard(chosen, chosen.result, "Breinkaart");
  removeCardFromHand(chosen.id);

  dispatchInteraction({
    actionType: chosen.result === "misfit" ? "failed_guess" : "place_neuron",
    round: state.level,
    cardId: chosen.cardId,
    candidateId: chosen.id,
    philosopher: chosen.philosopher,
    cardLevel: chosen.cardLevel,
    roundBudget: chosen.roundBudget,
    prominenceTier: chosen.prominenceTier,
    candidateType: chosen.type,
    result: chosen.result,
    handSize: state.playerHand.length
  });

  if (state.status === "won") {
    dispatchInteraction({
      actionType: "win",
      round: state.level,
      score: state.score,
      handSize: state.playerHand.length
    });
  }

  state.feedbackMessage = feedbackMessage;

  if (state.status === "playing" && state.doublePlayCredits > 0) {
    state.doublePlayCredits -= 1;
    refreshRoundFromHand();
    renderAll();
    return;
  }

  nextRound();
}

function setPanelOpen(button, panel, isOpen) {
  panel.hidden = !isOpen;
  button.classList.toggle("active", isOpen);
  button.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function syncMenuPanelPosition() {
  const topbarHeight = topbar.getBoundingClientRect().height;
  const menuTop = Math.round(topbarHeight + 40);
  document.documentElement.style.setProperty("--menu-top", `${menuTop}px`);
}

function syncSettingControls() {
  candidateCountSelect.value = String(state.settings.candidateCount);
  boardSizeSelect.value = String(state.settings.boardSize);
  startNeuronCountSelect.value = String(state.settings.startNeuronCount);
  burnoutLimitSelect.value = String(state.settings.burnoutLimit);
  rotationToggle.checked = state.settings.rotationMode;
}

function renderVariationNote() {
  variationNote.textContent =
    `Start met ${state.settings.startNeuronCount} verbonden neuronen. ` +
    `De eenzame neuron ligt nu ${pathStepsRemaining(state.board)} stap${pathStepsRemaining(state.board) === 1 ? "" : "pen"} verderop. ` +
    `Na ${state.settings.burnoutLimit} rode ophopingen op dezelfde neuron of verbinding loopt het vast in een file` +
    `${state.settings.rotationMode ? ", terwijl rotatie de herkenning extra lastig houdt." : "."}`;
}

function renderStats() {
  roundValue.textContent = String(state.level);
  scoreValue.textContent = String(state.score);
  neuronValue.textContent = formatCount(state.board.cells.size);
  synapseValue.textContent = formatCount(state.board.edges.size);
  variationValue.textContent = String(pathStepsRemaining(state.board));
  renderVariationNote();
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  const toPart = value => value.toString(16).padStart(2, "0");
  return `#${toPart(r)}${toPart(g)}${toPart(b)}`;
}

function mixColor(startHex, endHex, ratio) {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  const clamp = Math.max(0, Math.min(1, ratio));
  return rgbToHex({
    r: Math.round(start.r + (end.r - start.r) * clamp),
    g: Math.round(start.g + (end.g - start.g) * clamp),
    b: Math.round(start.b + (end.b - start.b) * clamp)
  });
}

function edgeColor(edge) {
  const ratio = edge.heat / Math.max(1, state.settings.burnoutLimit - 1);
  if (edge.heat > 0) return mixColor("#efb4ae", "#7d1716", ratio);
  if (edge.kind === "target-link") return "#279152";
  if (edge.kind === "grown") return "#3eaf68";
  return "#61ba79";
}

function cellColor(cell) {
  const ratio = cell.heat / Math.max(1, state.settings.burnoutLimit - 1);
  if (cell.heat > 0) return mixColor("#f4beb7", "#8b2320", ratio);
  if (cell.kind === "target") return state.board.connected.has(state.board.targetKey)
    ? "#82dda0"
    : "#74d28f";
  if (cell.kind === "grown") return "#73cf8e";
  return "#5fbe79";
}

function createSvgElement(type) {
  return document.createElementNS("http://www.w3.org/2000/svg", type);
}

function renderBoard() {
  const size = state.board.size;
  const padding = 44;
  const span = 1000 - padding * 2;
  const step = size > 1 ? span / (size - 1) : span;
  const holeRadius = Math.max(1.3, step * 0.12);
  const cellRadius = Math.max(3, step * (size >= 64 ? 0.21 : 0.26));

  boardSvg.innerHTML = "";

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const hole = createSvgElement("circle");
      hole.setAttribute("class", "board-hole");
      hole.setAttribute("cx", String(padding + x * step));
      hole.setAttribute("cy", String(padding + y * step));
      hole.setAttribute("r", String(holeRadius));
      boardSvg.appendChild(hole);
    }
  }

  state.board.edges.forEach((edge, edgeKey) => {
    const { left, right } = splitPairKey(edgeKey);
    const from = parseCoordKey(left);
    const to = parseCoordKey(right);
    const line = createSvgElement("line");
    const diagonal = Math.abs(from.x - to.x) === 1 && Math.abs(from.y - to.y) === 1;
    line.setAttribute("class", `board-edge ${diagonal ? "diagonal" : "straight"}`);
    line.setAttribute("x1", String(padding + from.x * step));
    line.setAttribute("y1", String(padding + from.y * step));
    line.setAttribute("x2", String(padding + to.x * step));
    line.setAttribute("y2", String(padding + to.y * step));
    line.setAttribute("stroke-width", String(Math.max(1.4, step * 0.18)));
    line.style.stroke = edgeColor(edge);
    line.style.opacity = edge.heat > 0 ? "0.98" : edge.kind === "grown" || edge.kind === "target-link" ? "0.92" : "0.88";
    boardSvg.appendChild(line);
  });

  [...state.board.cells.entries()]
    .sort((left, right) => compareCoordKeys(left[0], right[0]))
    .forEach(([cellKey, cellState]) => {
      const cell = parseCoordKey(cellKey);
      const cx = padding + cell.x * step;
      const cy = padding + cell.y * step;

      if (cellState.kind === "target" && !state.board.connected.has(cellKey)) {
        const halo = createSvgElement("circle");
        halo.setAttribute("class", "mini-focus");
        halo.setAttribute("cx", String(cx));
        halo.setAttribute("cy", String(cy));
        halo.setAttribute("r", String(cellRadius * 1.9));
        halo.setAttribute("stroke-width", String(Math.max(1.4, step * 0.06)));
        halo.style.stroke = "#74d28f";
        halo.style.opacity = "0.9";
        boardSvg.appendChild(halo);
      }

      const shadow = createSvgElement("circle");
      shadow.setAttribute("class", "board-cell-shadow");
      shadow.setAttribute("cx", String(cx));
      shadow.setAttribute("cy", String(cy));
      shadow.setAttribute("r", String(cellRadius * 1.55));
      boardSvg.appendChild(shadow);

      getNeighborDirections().forEach(direction => {
        const notch = createSvgElement("line");
        const innerScale = cellRadius * 1.28;
        const outerScale = cellRadius * 1.68;
        notch.setAttribute("class", "board-notch");
        notch.setAttribute("x1", String(cx + direction.dx * innerScale));
        notch.setAttribute("y1", String(cy + direction.dy * innerScale));
        notch.setAttribute("x2", String(cx + direction.dx * outerScale));
        notch.setAttribute("y2", String(cy + direction.dy * outerScale));
        notch.setAttribute("stroke-width", String(Math.max(0.8, step * 0.04)));
        boardSvg.appendChild(notch);
      });

      const neuron = createSvgElement("circle");
      neuron.setAttribute("class", "board-cell");
      neuron.dataset.neuronId = cellState.id;
      neuron.dataset.cellKey = cellKey;
      neuron.setAttribute("cx", String(cx));
      neuron.setAttribute("cy", String(cy));
      neuron.setAttribute("r", String(cellRadius));
      neuron.style.fill = cellColor(cellState);
      boardSvg.appendChild(neuron);
    });
}

function renderPatternInto(svg, pattern, variant = "reinforce") {
  const width = 220;
  const height = 160;
  const padding = 24;
  const columns = pattern.width + 2;
  const rows = pattern.height + 2;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const stepX = columns > 1 ? usableWidth / (columns - 1) : usableWidth;
  const stepY = rows > 1 ? usableHeight / (rows - 1) : usableHeight;
  const step = Math.min(stepX, stepY);
  const offsetX = (width - step * (columns - 1)) / 2;
  const offsetY = (height - step * (rows - 1)) / 2;
  const holeRadius = Math.max(1.2, step * 0.11);
  const cellRadius = Math.max(3, step * 0.23);
  const cellLookup = new Map(pattern.cells.map(cell => [cell.key, cell]));

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const hole = createSvgElement("circle");
      hole.setAttribute("class", "mini-hole");
      hole.setAttribute("cx", String(offsetX + x * step));
      hole.setAttribute("cy", String(offsetY + y * step));
      hole.setAttribute("r", String(holeRadius));
      svg.appendChild(hole);
    }
  }

  pattern.edges.forEach(edge => {
    const from = cellLookup.get(edge.from);
    const to = cellLookup.get(edge.to);
    if (!from || !to) return;
    const line = createSvgElement("line");
    const diagonal = Math.abs(from.x - to.x) === 1 && Math.abs(from.y - to.y) === 1;
    line.setAttribute("class", `mini-edge ${diagonal ? "diagonal" : "straight"}`);
    line.setAttribute("x1", String(offsetX + (from.x + 1) * step));
    line.setAttribute("y1", String(offsetY + (from.y + 1) * step));
    line.setAttribute("x2", String(offsetX + (to.x + 1) * step));
    line.setAttribute("y2", String(offsetY + (to.y + 1) * step));
    line.setAttribute("stroke-width", String(Math.max(1.2, step * 0.15 + (edge.weight - 1) * step * 0.07)));
    line.style.opacity = String(Math.min(0.95, 0.56 + edge.weight * 0.14));
    if (variant === "success") {
      line.style.stroke = "#4fae6e";
    } else if (variant === "misfit") {
      line.style.stroke = "#7f6cc2";
    }
    svg.appendChild(line);
  });

  pattern.cells.forEach(cell => {
    const cx = offsetX + (cell.x + 1) * step;
    const cy = offsetY + (cell.y + 1) * step;

    const shadow = createSvgElement("circle");
    shadow.setAttribute("class", "mini-cell-shadow");
    shadow.setAttribute("cx", String(cx));
    shadow.setAttribute("cy", String(cy));
    shadow.setAttribute("r", String(cellRadius * 1.45));
    svg.appendChild(shadow);

    getNeighborDirections().forEach(direction => {
      const notch = createSvgElement("line");
      notch.setAttribute("class", "mini-notch");
      notch.setAttribute("x1", String(cx + direction.dx * cellRadius * 1.18));
      notch.setAttribute("y1", String(cy + direction.dy * cellRadius * 1.18));
      notch.setAttribute("x2", String(cx + direction.dx * cellRadius * 1.46));
      notch.setAttribute("y2", String(cy + direction.dy * cellRadius * 1.46));
      notch.setAttribute("stroke-width", String(Math.max(0.6, step * 0.03)));
      svg.appendChild(notch);
    });

    const neuron = createSvgElement("circle");
    neuron.setAttribute("class", "mini-cell");
    neuron.setAttribute("cx", String(cx));
    neuron.setAttribute("cy", String(cy));
    neuron.setAttribute("r", String(cellRadius));
    if (variant === "success") {
      neuron.style.fill = cell.isFocus ? "#5fcb80" : "#7bd297";
    } else if (variant === "misfit") {
      neuron.style.fill = cell.isFocus ? "#8d79d4" : "#ab9ae2";
    }
    svg.appendChild(neuron);

    if (cell.isFocus) {
      const focus = createSvgElement("circle");
      focus.setAttribute("class", "mini-focus");
      focus.setAttribute("cx", String(cx));
      focus.setAttribute("cy", String(cy));
      focus.setAttribute("r", String(cellRadius * 1.5));
      focus.setAttribute("stroke-width", String(Math.max(1.1, step * 0.05)));
      svg.appendChild(focus);
    }
  });
}

function renderSelectedCardSummary() {
  if (!state.lastPlayedCard) {
    selectedCardSummary.textContent =
      "Nog geen kaart gespeeld. Kies links een kaart en beslis daarna: Breinkaart of Actiekaart.";
    return;
  }

  const candidate = state.lastPlayedCard;

  const roleLine = candidate.role === "success"
    ? "Rol: groeikaart."
    : candidate.role === "reinforce"
      ? "Rol: versterkingskaart."
      : "Rol: verlieskaart.";

  const resultLine = candidate.result === "success"
    ? "Resultaat: groeipad geactiveerd."
    : candidate.result === "burnout"
      ? "Resultaat: file door verstarring."
      : candidate.result === "reinforce"
        ? "Resultaat: patroon roder gemaakt."
        : candidate.result === "strength"
          ? `Resultaat: kracht gebruikt (${escapeHtml(candidate.strength?.type || "actie")}).`
          : "Resultaat: verloren op misfit.";

  selectedCardSummary.innerHTML =
    `<strong>Ronde ${formatCount(candidate.round)} | ${escapeHtml(candidate.title)}</strong>\n` +
    `${escapeHtml(candidate.philosopher)}\n` +
    `${escapeHtml(candidate.tradition)}\n\n` +
    `Modus: ${escapeHtml(candidate.mode || "Breinkaart")}\n` +
    `${formatCount(candidate.neuronCount)} neuronen | ` +
    `${formatCount(candidate.synapseLayers)} synapslagen\n` +
    `${roleLine}\n` +
    `${resultLine}`;
}

function renderFeedback() {
  feedbackBox.textContent = state.feedbackMessage;
}

function renderCandidates() {
  candidateRail.innerHTML = "";

  state.round.candidates.forEach(candidate => {
    const choiceOpen = state.pendingChoiceCandidateId === candidate.id;
    const selected = state.selectedCandidateId === candidate.id || choiceOpen;
    const strength = candidate.strength || { icon: "+", type: "draw", description: "Trek een extra kaart." };
    const resultClass = candidate.result === "success"
      ? "valid"
      : candidate.result === "misfit" || candidate.result === "burnout"
        ? "invalid"
        : "";
    const resultLabel = candidate.result === "success"
      ? "groei"
      : candidate.result === "burnout"
        ? "verstard"
      : candidate.result === "reinforce"
        ? "rood"
        : candidate.result === "misfit"
          ? "verlies"
          : "open";

    const card = document.createElement("article");
    card.className =
      `candidate-card${selected ? " selected" : ""}${choiceOpen ? " choosing" : ""}${state.roundResolved ? " locked" : ""}`;
    card.innerHTML = `
      <div class="candidate-head">
        <div class="candidate-top">
          <div>
            <div class="candidate-tagline">${escapeHtml(candidate.tradition)} | niveau ${escapeHtml(candidate.cardLevel || "?")} | ${escapeHtml(candidate.roundBudget || "?")} rondes</div>
            <h3 class="candidate-title">${escapeHtml(candidate.title)}</h3>
            <div class="candidate-philosopher">${escapeHtml(candidate.philosopher)}</div>
          </div>
          <div class="candidate-help-wrap">
            <button class="candidate-help" type="button" aria-label="Toelichting bij kaart ${candidate.displayIndex}">?</button>
            <div class="candidate-tooltip" role="tooltip">
              <p>${escapeHtml(candidate.summary)}</p>
              <p>${escapeHtml(candidate.blurb)}</p>
              <p>Te raden theorie: ${escapeHtml(candidate.theory || candidate.title)}</p>
            </div>
          </div>
        </div>
      </div>
      <svg class="candidate-svg" aria-label="Miniatuur van kaart ${candidate.displayIndex}"></svg>
      <div class="candidate-strength" title="${escapeHtml(strength.description)}">
        <span class="strength-icon">${escapeHtml(strength.icon)}</span>
        <span>${escapeHtml(strength.description)}</span>
      </div>
      <div class="candidate-actions" ${choiceOpen ? "" : "hidden"}>
        <button class="mode-button mode-button-primary" type="button" data-mode="neuron">Als Breinkaart</button>
        <button class="mode-button" type="button" data-mode="strength">Als Kracht</button>
      </div>
      <div class="candidate-foot">
        <span class="candidate-badge">kaart ${candidate.displayIndex}</span>
        <span class="candidate-result ${resultClass}">${resultLabel}</span>
      </div>
    `;

    card.addEventListener("click", () => {
      if (state.roundResolved) return;
      state.selectedCandidateId = candidate.id;
      state.pendingChoiceCandidateId = choiceOpen ? null : candidate.id;
      if (!choiceOpen) {
        dispatchInteraction({
          actionType: "select_card",
          round: state.level,
          cardId: candidate.cardId,
          candidateId: candidate.id,
          philosopher: candidate.philosopher,
          cardLevel: candidate.cardLevel,
          roundBudget: candidate.roundBudget,
          prominenceTier: candidate.prominenceTier,
          candidateType: candidate.type,
          strengthType: strength.type,
          handSize: state.playerHand.length
        });
      }
      renderCandidates();
    });

    const helpTrigger = card.querySelector(".candidate-help");
    helpTrigger.addEventListener("click", event => {
      event.stopPropagation();
    });

    card.querySelector("[data-mode='neuron']").addEventListener("click", event => {
      event.stopPropagation();
      playCandidateAsNeuron(candidate.id);
    });

    card.querySelector("[data-mode='strength']").addEventListener("click", event => {
      event.stopPropagation();
      playCandidateAsStrength(candidate.id);
    });

    candidateRail.appendChild(card);
    renderPatternInto(card.querySelector("svg"), candidate.pattern, candidate.type);
  });
}

function renderAll() {
  renderStats();
  renderBoard();
  renderCandidates();
  renderSelectedCardSummary();
  renderFeedback();
}

function submitSelection() {
  if (!state.selectedCandidateId) {
    state.feedbackMessage = "Kies eerst een kaart en daarna of je haar als Breinkaart of als Kracht speelt.";
    renderFeedback();
    return;
  }

  playCandidateAsNeuron(state.selectedCandidateId);
}

function nextRound() {
  const previousStatus = state.status;
  state.level += 1;
  state.status = "playing";

  if (previousStatus === "lost" || previousStatus === "won") {
    state.board = buildChallengeBoard(state.settings);
    state.playerHand = [];
    state.doublePlayCredits = 0;
    state.freeReflectTurns = 0;
  }

  generateRound();
  renderAll();
}

function restartGame(message) {
  state.level = 1;
  state.score = 0;
  state.status = "playing";
  state.board = buildChallengeBoard(state.settings);
  state.playerHand = [];
  state.doublePlayCredits = 0;
  state.freeReflectTurns = 0;
  state.selectedCandidateId = null;
  state.pendingChoiceCandidateId = null;
  state.lastPlayedCard = null;
  state.feedbackMessage = message;
  generateRound();
  renderAll();
}

function applySettings() {
  const nextSettings = {
    candidateCount: Number(candidateCountSelect.value),
    boardSize: Number(boardSizeSelect.value),
    startNeuronCount: Number(startNeuronCountSelect.value),
    burnoutLimit: Number(burnoutLimitSelect.value),
    rotationMode: rotationToggle.checked
  };

  const changed = Object.keys(nextSettings).some(key => nextSettings[key] !== state.settings[key]);
  if (!changed) {
    renderVariationNote();
    return;
  }

  state.settings = nextSettings;
  dispatchInteraction({
    actionType: "settings_changed",
    leerobjectId: "phile.settings",
    objectRole: "other",
    settings: nextSettings
  });
  restartGame(
    `Instellingen aangepast: ${nextSettings.candidateCount} kaarten, raster ${nextSettings.boardSize} x ${nextSettings.boardSize}, ` +
    `${nextSettings.startNeuronCount} startneuronen, filelimiet ${nextSettings.burnoutLimit}, ` +
    `${nextSettings.rotationMode ? "rotatie aan" : "rotatie uit"}.`
  );
}

function toggleMenuPanel() {
  syncMenuPanelPosition();
  setPanelOpen(menuButton, menuPanel, menuPanel.hidden);
}

menuButton.addEventListener("click", () => {
  dispatchInteraction({ actionType: "toggle_menu", leerobjectId: "phile.menu", objectRole: "other" });
  toggleMenuPanel();
});
candidateCountSelect.addEventListener("change", applySettings);
boardSizeSelect.addEventListener("change", applySettings);
startNeuronCountSelect.addEventListener("change", applySettings);
burnoutLimitSelect.addEventListener("change", applySettings);
rotationToggle.addEventListener("change", applySettings);
window.addEventListener("resize", syncMenuPanelPosition);

async function initGame() {
  leerpretClient = window.PHILE_BOOTSTRAP?.client;
  if (!leerpretClient || !window.LeerpretSDK?.Leerobject) {
    throw new Error("De LeerpretSDK is niet beschikbaar.");
  }
  syncMenuPanelPosition();
  setPanelOpen(menuButton, menuPanel, false);
  syncSettingControls();

  await loadPhilosopherCards();
  const introMessage = "Verbind stap voor stap naar de eenzame neuron. Kies elke filosoof als Breinkaart of als Actiekaart.";

  restartGame(introMessage);
}

initGame().catch(error => {
  document.body.dataset.runtime = "unavailable";
  feedbackBox.textContent = `Phile kan de LeerpretEngine niet bereiken: ${error.message}`;
});
