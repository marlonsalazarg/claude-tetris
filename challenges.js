'use strict';

// Datos del Modo Desafío: sin lógica. Añadir un desafío = añadir una entrada a CHALLENGES.
// El orden del array es la progresión ("Siguiente desafío" avanza por él).
//
// Definición:
//   id, name, description
//   goal       { type: 'lines', target } | { type: 'survive' }  (ver GOAL_TYPES en challengeManager.js)
//   timeLimit  segundos, opcional
//   onTimeUp   'lose' (defecto) | 'win': resultado al agotarse timeLimit
//   modifiers  solo lo que cambia respecto a DEFAULT_MODIFIERS (challengeManager.js)

// Patrones de tablero, alineados al fondo. '.' vacío, '#' basura, '1'-'9' color de pieza.
// Ninguna fila debe estar completa.
const BOARD_PATTERNS = {
  piramide: [
    '...3333...',
    '..555555..',
    '.11111111.',
    '7777.77777',
    '22.222.222',
    '6666666.66',
  ],
};

const CHALLENGES = [
  {
    id: 'sprint_40',
    name: 'Sprint de 40 líneas',
    description: 'Limpia líneas contra el reloj.',
    goal: { type: 'lines', target: 40 },
    timeLimit: 120,
    onTimeUp: 'lose',
    modifiers: {},
  },
  {
    id: 'rising_garbage',
    name: 'Basura ascendente',
    description: 'Cada pocos segundos sube una fila de basura desde abajo.',
    goal: { type: 'survive' },
    timeLimit: 90,
    onTimeUp: 'win',
    modifiers: { garbageInterval: 10, garbageRows: 1, garbageHoles: 1, garbageWarning: 3 },
  },
  {
    id: 'preset_board',
    name: 'Tablero pre-colocado',
    description: 'Empiezas con bloques ya fijados en el fondo.',
    goal: { type: 'lines', target: 10 },
    modifiers: { boardPattern: BOARD_PATTERNS.piramide },
  },
  {
    id: 'invisible_pieces',
    name: 'Piezas invisibles',
    description: 'Las piezas desaparecen de la vista al fijarse, pero siguen ahí.',
    goal: { type: 'lines', target: 10 },
    modifiers: { invisibleLocked: true },
  },
  {
    id: 'reverse_rotation',
    name: 'Rotación inversa',
    description: 'Nivel alto: ↑/X giran a la izquierda y Z a la derecha.',
    goal: { type: 'lines', target: 15 },
    modifiers: { rotationDirection: -1, startLevel: 6 },
  },
];
