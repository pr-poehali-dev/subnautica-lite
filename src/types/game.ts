export interface PlayerStats {
  health: number;
  oxygen: number;
  maxOxygen: number;
  hunger: number;
  thirst: number;
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  pitch: number;
  yaw: number;
}

export interface Item {
  id: string;
  name: string;
  icon: string;
  count: number;
  category: 'tool' | 'food' | 'material' | 'water' | 'craftable';
}

export interface Resource {
  x: number;
  y: number;
  z: number;
  type: 'limestone' | 'metal' | 'quartz';
}

export interface Recipe {
  id: string;
  name: string;
  icon: string;
  requires: { id: string; count: number }[];
  category: 'tool' | 'equipment' | 'food';
}

export interface Settings {
  graphics: 'low' | 'medium' | 'high' | 'ultra';
  volume: number;
  fov: number;
}

export interface Message {
  id: string;
  sender: 'AURORA' | 'PDA';
  text: string;
}

export type GameState = 'menu' | 'playing' | 'settings' | 'pda' | 'fabricator';

export const RECIPES: Recipe[] = [
  {
    id: 'scanner',
    name: 'Scanner',
    icon: '📡',
    requires: [{ id: 'metal', count: 1 }, { id: 'quartz', count: 1 }],
    category: 'tool'
  },
  {
    id: 'knife',
    name: 'Survival Knife',
    icon: '🔪',
    requires: [{ id: 'metal', count: 1 }],
    category: 'tool'
  },
  {
    id: 'tank',
    name: 'Standard O₂ Tank',
    icon: '🫁',
    requires: [{ id: 'metal', count: 3 }],
    category: 'equipment'
  },
  {
    id: 'water',
    name: 'Filtered Water',
    icon: '💧',
    requires: [{ id: 'quartz', count: 2 }],
    category: 'food'
  }
];
