import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';

interface PlayerStats {
  health: number;
  oxygen: number;
  hunger: number;
  thirst: number;
  depth: number;
}

interface Position {
  x: number;
  y: number;
  z: number;
}

interface Item {
  id: string;
  name: string;
  icon: string;
  count: number;
  category: 'tool' | 'food' | 'material' | 'water';
}

interface TerrainCell {
  height: number;
  type: 'sand' | 'rock' | 'coral' | 'kelp' | 'grass';
}

interface Fish {
  x: number;
  y: number;
  z: number;
  type: 'peeper' | 'boomerang' | 'reginald';
  vx: number;
  vz: number;
}

interface Flora {
  x: number;
  y: number;
  z: number;
  type: 'kelp' | 'acid' | 'coral';
}

interface Settings {
  graphics: 'low' | 'medium' | 'high' | 'ultra';
  volume: number;
  musicVolume: number;
  controls: 'keyboard' | 'touch';
  renderDistance: number;
  fov: number;
  shadows: boolean;
  particles: boolean;
}

interface Message {
  id: string;
  sender: 'MARGARET' | 'DEGASI' | 'AURORA';
  text: string;
  read: boolean;
}

type GameState = 'menu' | 'playing' | 'settings' | 'pda';

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainRef = useRef<TerrainCell[][]>([]);
  const fishRef = useRef<Fish[]>([]);
  const floraRef = useRef<Flora[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const [gameState, setGameState] = useState<GameState>('menu');
  const [position, setPosition] = useState<Position>({ x: 60, y: 3, z: 60 });
  const [rotation, setRotation] = useState({ pitch: 0, yaw: 0 });
  const [stats, setStats] = useState<PlayerStats>({
    health: 100,
    oxygen: 100,
    hunger: 100,
    thirst: 100,
    depth: 0
  });
  
  const [inventory, setInventory] = useState<Item[]>([
    { id: '1', name: 'Scanner', icon: '📡', count: 1, category: 'tool' },
    { id: '2', name: 'Knife', icon: '🔪', count: 1, category: 'tool' },
    { id: '3', name: 'Nutrient Block', icon: '🍫', count: 2, category: 'food' },
    { id: '4', name: 'Water', icon: '💧', count: 2, category: 'water' },
  ]);
  
  const [quickSlots, setQuickSlots] = useState<(string | null)[]>(['1', '2', null, null, null]);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [showPDA, setShowPDA] = useState(false);
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [touchControls, setTouchControls] = useState({ x: 0, y: 0 });
  const [isInPod, setIsInPod] = useState(false);
  const [podStorage] = useState<Item[]>([
    { id: 'med1', name: 'Med Kit', icon: '💊', count: 3, category: 'tool' },
    { id: 'food1', name: 'Emergency Ration', icon: '🥫', count: 5, category: 'food' },
    { id: 'water1', name: 'Water Bottle', icon: '🍶', count: 4, category: 'water' },
  ]);
  
  const mouseRef = useRef({ locked: false });
  const [settings, setSettings] = useState<Settings>({
    graphics: 'medium',
    volume: 70,
    musicVolume: 40,
    controls: 'keyboard',
    renderDistance: 25,
    fov: Math.PI / 3,
    shadows: true,
    particles: true
  });
  
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'MARGARET', text: 'Alterra HQ: This is emergency frequency. If you\'re receiving this, the Aurora has suffered catastrophic hull failure. All hands to lifepods.', read: false },
    { id: '2', sender: 'MARGARET', text: 'Detecting high levels of radiation. Aurora\'s drive core is exposed. Recommend maintaining safe distance.', read: false }
  ]);
  
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (isMobile) {
      setSettings(prev => ({ ...prev, controls: 'touch', graphics: 'low', shadows: false, particles: false }));
    }
  }, [isMobile]);

  useEffect(() => {
    const TERRAIN_SIZE = 150;
    const terrain: TerrainCell[][] = [];
    
    for (let x = 0; x < TERRAIN_SIZE; x++) {
      terrain[x] = [];
      for (let z = 0; z < TERRAIN_SIZE; z++) {
        const centerDist = Math.sqrt(Math.pow(x - TERRAIN_SIZE/2, 2) + Math.pow(z - TERRAIN_SIZE/2, 2));
        
        let baseHeight = -5;
        if (centerDist < 25) {
          baseHeight = 2 - (centerDist / 25) * 4;
        } else if (centerDist < 50) {
          baseHeight = -2 - (centerDist - 25) / 25 * 3;
        } else {
          const noise1 = Math.sin(x * 0.08) * Math.cos(z * 0.08);
          const noise2 = Math.sin(x * 0.04 + z * 0.04) * 2.5;
          const noise3 = Math.sin(x * 0.015) * Math.cos(z * 0.015) * 5;
          baseHeight = (noise1 + noise2 + noise3) * 0.6 - 5;
        }
        
        let type: TerrainCell['type'] = 'sand';
        const rand = Math.random();
        
        if (centerDist < 25) {
          type = rand > 0.9 ? 'grass' : 'sand';
        } else {
          if (baseHeight > -2) type = 'rock';
          else if (baseHeight > -4 && rand > 0.65) type = 'coral';
          else if (rand > 0.75) type = 'kelp';
          else type = 'sand';
        }
        
        terrain[x][z] = { height: baseHeight, type };
      }
    }
    
    terrainRef.current = terrain;

    const fish: Fish[] = [];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 40 + 10;
      fish.push({
        x: 60 + Math.cos(angle) * dist,
        y: -Math.random() * 15 - 2,
        z: 60 + Math.sin(angle) * dist,
        type: Math.random() > 0.5 ? 'peeper' : Math.random() > 0.5 ? 'boomerang' : 'reginald',
        vx: (Math.random() - 0.5) * 0.05,
        vz: (Math.random() - 0.5) * 0.05
      });
    }
    fishRef.current = fish;

    const flora: Flora[] = [];
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 50 + 15;
      const x = 60 + Math.cos(angle) * dist;
      const z = 60 + Math.sin(angle) * dist;
      const gx = Math.floor(x);
      const gz = Math.floor(z);
      if (gx >= 0 && gx < TERRAIN_SIZE && gz >= 0 && gz < TERRAIN_SIZE) {
        const height = terrain[gx][gz].height;
        flora.push({
          x, z,
          y: height,
          type: Math.random() > 0.6 ? 'kelp' : Math.random() > 0.5 ? 'acid' : 'coral'
        });
      }
    }
    floraRef.current = flora;
  }, []);

  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const interval = setInterval(() => {
      const fish = fishRef.current;
      fish.forEach(f => {
        f.x += f.vx;
        f.z += f.vz;
        
        const distFromCenter = Math.sqrt(Math.pow(f.x - 60, 2) + Math.pow(f.z - 60, 2));
        if (distFromCenter > 60) {
          const angle = Math.atan2(60 - f.z, 60 - f.x);
          f.vx = Math.cos(angle) * 0.05;
          f.vz = Math.sin(angle) * 0.05;
        }
        
        if (Math.random() > 0.98) {
          f.vx = (Math.random() - 0.5) * 0.05;
          f.vz = (Math.random() - 0.5) * 0.05;
        }
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [gameState]);

  useEffect(() => {
    if (Math.abs(position.y) > 250 && !messages.find(m => m.sender === 'DEGASI')) {
      setMessages(prev => [...prev, {
        id: 'degasi1',
        sender: 'DEGASI',
        text: 'Warning: You are approaching 250m depth. DEGASI crew signal detected. Extreme caution advised.',
        read: false
      }]);
      playSound('notification');
    }
  }, [position.y, messages]);

  const playSound = useCallback((type: 'notification' | 'underwater' | 'oxygen') => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'notification') {
      osc.frequency.value = 800;
      gain.gain.value = settings.volume / 200;
    } else if (type === 'underwater') {
      osc.frequency.value = 100;
      gain.gain.value = settings.volume / 400;
    } else if (type === 'oxygen') {
      osc.frequency.value = 600;
      gain.gain.value = settings.volume / 300;
    }
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }, [settings.volume]);

  const renderRaycast = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const fov = settings.fov;
    const halfHeight = screenHeight / 2;
    
    const isUnderwater = position.y < 0;
    const depthFactor = Math.max(0, Math.min(1, Math.abs(position.y) / 20));
    
    let skyColor, waterColor;
    if (isUnderwater) {
      const r = Math.floor(5 + (1 - 5) * depthFactor);
      const g = Math.floor(25 + (10 - 25) * depthFactor);
      const b = Math.floor(50 + (25 - 50) * depthFactor);
      skyColor = `rgb(${r}, ${g}, ${b})`;
      waterColor = `rgb(${r + 5}, ${g + 15}, ${b + 25})`;
    } else {
      skyColor = 'rgb(135, 206, 250)';
      waterColor = 'rgb(20, 140, 200)';
    }

    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, screenWidth, halfHeight);
    
    const floorGradient = ctx.createLinearGradient(0, halfHeight, 0, screenHeight);
    floorGradient.addColorStop(0, waterColor);
    floorGradient.addColorStop(1, isUnderwater ? 'rgb(5, 15, 30)' : 'rgb(10, 100, 180)');
    ctx.fillStyle = floorGradient;
    ctx.fillRect(0, halfHeight, screenWidth, halfHeight);

    const terrain = terrainRef.current;
    if (terrain.length === 0) return;

    const rayStep = settings.graphics === 'low' ? 6 : settings.graphics === 'medium' ? 3 : settings.graphics === 'high' ? 2 : 1;
    const renderSteps = settings.graphics === 'low' ? 25 : settings.graphics === 'medium' ? 35 : settings.graphics === 'high' ? 45 : 60;

    for (let x = 0; x < screenWidth; x += rayStep) {
      const cameraX = 2 * x / screenWidth - 1;
      const rayDirX = Math.sin(rotation.yaw) + Math.cos(rotation.yaw) * cameraX * Math.tan(fov / 2);
      const rayDirZ = Math.cos(rotation.yaw) - Math.sin(rotation.yaw) * cameraX * Math.tan(fov / 2);

      const rayLength = settings.renderDistance;
      
      for (let step = 1; step < renderSteps; step++) {
        const dist = (step / renderSteps) * rayLength;
        const sampleX = Math.floor(position.x + rayDirX * dist);
        const sampleZ = Math.floor(position.z + rayDirZ * dist);

        if (sampleX < 0 || sampleX >= terrain.length || sampleZ < 0 || sampleZ >= terrain[0].length) continue;

        const cell = terrain[sampleX][sampleZ];
        const terrainHeight = cell.height;

        if (position.y - terrainHeight < 1.2) {
          const wallHeight = screenHeight / (dist * 0.6);
          const drawHeight = Math.min(wallHeight, screenHeight);
          const drawStart = halfHeight - drawHeight / 2 + rotation.pitch * 250;

          const fog = Math.min(1, dist / rayLength);
          let r = 0, g = 0, b = 0;

          switch (cell.type) {
            case 'sand':
              r = 210; g = 195; b = 140;
              break;
            case 'rock':
              r = 90; g = 90; b = 95;
              break;
            case 'coral':
              r = 255; g = 100; b = 70;
              break;
            case 'kelp':
              r = 50; g = 130; b = 50;
              break;
            case 'grass':
              r = 100; g = 180; b = 100;
              break;
          }

          const shade = 1 - (step / renderSteps) * 0.65;
          const fogR = isUnderwater ? 5 : 135;
          const fogG = isUnderwater ? 25 : 206;
          const fogB = isUnderwater ? 50 : 250;
          
          r = Math.floor((r * shade) * (1 - fog) + fogR * fog);
          g = Math.floor((g * shade) * (1 - fog) + fogG * fog);
          b = Math.floor((b * shade) * (1 - fog) + fogB * fog);

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x, drawStart, rayStep, drawHeight);
          break;
        }
      }
    }

    if (settings.graphics !== 'low') {
      const fish = fishRef.current;
      fish.forEach(f => {
        const dx = f.x - position.x;
        const dz = f.z - position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < settings.renderDistance) {
          const angle = Math.atan2(dz, dx) - rotation.yaw;
          const screenX = screenWidth / 2 + Math.tan(angle) * screenWidth / (2 * Math.tan(fov / 2));
          const dy = f.y - position.y;
          const screenY = halfHeight - (dy / dist) * 200 + rotation.pitch * 200;
          
          if (screenX > 0 && screenX < screenWidth && screenY > 0 && screenY < screenHeight) {
            const size = Math.max(2, 20 / dist);
            ctx.fillStyle = f.type === 'peeper' ? 'rgb(255, 200, 100)' : f.type === 'boomerang' ? 'rgb(100, 150, 255)' : 'rgb(255, 100, 150)';
            ctx.beginPath();
            ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      const flora = floraRef.current;
      flora.forEach(f => {
        const dx = f.x - position.x;
        const dz = f.z - position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < settings.renderDistance / 1.5) {
          const angle = Math.atan2(dz, dx) - rotation.yaw;
          const screenX = screenWidth / 2 + Math.tan(angle) * screenWidth / (2 * Math.tan(fov / 2));
          const dy = f.y - position.y;
          const screenY = halfHeight - (dy / dist) * 200 + rotation.pitch * 200;
          
          if (screenX > -20 && screenX < screenWidth + 20) {
            const height = Math.max(10, 40 / dist);
            ctx.fillStyle = f.type === 'kelp' ? 'rgba(70, 140, 70, 0.6)' : f.type === 'acid' ? 'rgba(200, 255, 100, 0.5)' : 'rgba(255, 120, 80, 0.6)';
            ctx.fillRect(screenX - 2, screenY, 4, height);
          }
        }
      });
    }

    const auroraX = 80;
    const auroraZ = 40;
    const dx = auroraX - position.x;
    const dz = auroraZ - position.z;
    const distAurora = Math.sqrt(dx * dx + dz * dz);
    
    if (distAurora < 80) {
      const angle = Math.atan2(dz, dx) - rotation.yaw;
      const screenX = screenWidth / 2 + Math.tan(angle) * screenWidth / (2 * Math.tan(fov / 2));
      
      if (Math.abs(angle) < fov / 2 + 0.5) {
        const shipWidth = Math.max(30, 400 / distAurora);
        const shipHeight = Math.max(20, 200 / distAurora);
        const shipY = halfHeight - shipHeight / 2 + rotation.pitch * 200;
        
        ctx.fillStyle = 'rgb(80, 80, 90)';
        ctx.fillRect(screenX - shipWidth / 2, shipY, shipWidth, shipHeight);
        ctx.fillStyle = 'rgb(255, 100, 50)';
        ctx.fillRect(screenX - shipWidth / 3, shipY + shipHeight / 3, shipWidth / 6, shipHeight / 4);
      }
    }

    const podDist = Math.sqrt(Math.pow(position.x - 60, 2) + Math.pow(position.z - 60, 2));
    if (podDist < 30) {
      const dx = 60 - position.x;
      const dz = 60 - position.z;
      const angle = Math.atan2(dz, dx) - rotation.yaw;
      const screenX = screenWidth / 2 + Math.tan(angle) * screenWidth / (2 * Math.tan(fov / 2));
      
      if (Math.abs(angle) < fov / 2 + 0.3) {
        const podWidth = Math.max(15, 100 / podDist);
        const podHeight = Math.max(20, 150 / podDist);
        const dy = 1.5 - position.y;
        const podY = halfHeight - (dy / podDist) * 200 + rotation.pitch * 200;
        
        ctx.fillStyle = 'rgb(200, 50, 60)';
        ctx.fillRect(screenX - podWidth / 2, podY, podWidth, podHeight);
        ctx.fillStyle = 'rgb(100, 150, 200)';
        ctx.fillRect(screenX - podWidth / 3, podY + podHeight / 4, podWidth / 2, podHeight / 3);
      }
    }

    if (isUnderwater && settings.particles) {
      const particleCount = settings.graphics === 'ultra' ? 80 : settings.graphics === 'high' ? 50 : 30;
      ctx.fillStyle = 'rgba(180, 220, 255, 0.15)';
      for (let i = 0; i < particleCount; i++) {
        const px = Math.random() * screenWidth;
        const py = Math.random() * screenHeight;
        const size = Math.random() * 2.5 + 0.5;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (settings.shadows) {
        const vignette = ctx.createRadialGradient(
          screenWidth / 2, screenHeight / 2, 0,
          screenWidth / 2, screenHeight / 2, screenWidth * 0.65
        );
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(1, `rgba(0, 0, 0, ${0.25 + depthFactor * 0.35})`);
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, screenWidth, screenHeight);
      }
    }
  }, [position, rotation, settings]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let animationId: number;
    const animate = () => {
      renderRaycast();
      animationId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [gameState, renderRaycast]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: true }));
      
      if (e.key.toLowerCase() === 'tab') {
        e.preventDefault();
        setShowPDA(prev => !prev);
      }
      if (e.key.toLowerCase() === 'f') {
        const podDist = Math.sqrt(Math.pow(position.x - 60, 2) + Math.pow(position.z - 60, 2));
        if (podDist < 3 && Math.abs(position.y - 1.5) < 2) {
          setIsInPod(prev => !prev);
        }
      }
      if (e.key >= '1' && e.key <= '5') {
        setSelectedSlot(parseInt(e.key) - 1);
      }
      if (e.key === 'Escape') {
        if (showPDA) setShowPDA(false);
        else if (isInPod) setIsInPod(false);
        else setGameState('menu');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: false }));
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (mouseRef.current.locked && settings.controls === 'keyboard') {
        const sensitivity = 0.0025;
        setRotation(prev => ({
          yaw: prev.yaw + e.movementX * sensitivity,
          pitch: Math.max(-1.2, Math.min(1.2, prev.pitch + e.movementY * sensitivity))
        }));
      }
    };

    const handleClick = () => {
      if (canvasRef.current && !mouseRef.current.locked && settings.controls === 'keyboard' && !showPDA && !isInPod) {
        canvasRef.current.requestPointerLock();
      }
    };

    const handlePointerLock = () => {
      mouseRef.current.locked = document.pointerLockElement === canvasRef.current;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    canvasRef.current?.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handlePointerLock);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      canvasRef.current?.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handlePointerLock);
    };
  }, [gameState, showPDA, isInPod, settings.controls, position]);

  useEffect(() => {
    if (gameState !== 'playing' || isInPod) return;

    const interval = setInterval(() => {
      const speed = 0.15;
      let newX = position.x;
      let newY = position.y;
      let newZ = position.z;

      const moveX = Math.sin(rotation.yaw);
      const moveZ = Math.cos(rotation.yaw);

      if (settings.controls === 'keyboard') {
        if (keys['w']) {
          newX += moveX * speed;
          newZ += moveZ * speed;
        }
        if (keys['s']) {
          newX -= moveX * speed;
          newZ -= moveZ * speed;
        }
        if (keys['a']) {
          newX += Math.cos(rotation.yaw) * speed;
          newZ -= Math.sin(rotation.yaw) * speed;
        }
        if (keys['d']) {
          newX -= Math.cos(rotation.yaw) * speed;
          newZ += Math.sin(rotation.yaw) * speed;
        }
        if (keys[' ']) newY = Math.min(8, newY + speed * 1.5);
        if (keys['shift']) newY = Math.max(-300, newY - speed * 1.5);
      } else {
        if (touchControls.y > 0.3) {
          newX += moveX * speed * touchControls.y;
          newZ += moveZ * speed * touchControls.y;
        }
        if (touchControls.y < -0.3) {
          newX -= moveX * speed * Math.abs(touchControls.y);
          newZ -= moveZ * speed * Math.abs(touchControls.y);
        }
        if (touchControls.x < -0.3) {
          newX += Math.cos(rotation.yaw) * speed * Math.abs(touchControls.x);
          newZ -= Math.sin(rotation.yaw) * speed * Math.abs(touchControls.x);
        }
        if (touchControls.x > 0.3) {
          newX -= Math.cos(rotation.yaw) * speed * touchControls.x;
          newZ += Math.sin(rotation.yaw) * speed * touchControls.x;
        }
      }

      const terrain = terrainRef.current;
      if (terrain.length > 0) {
        const gridX = Math.floor(newX);
        const gridZ = Math.floor(newZ);
        if (gridX >= 0 && gridX < terrain.length && gridZ >= 0 && gridZ < terrain[0].length) {
          const terrainHeight = terrain[gridX][gridZ].height;
          if (newY < terrainHeight + 1.5) {
            newY = terrainHeight + 1.5;
          }
        }
      }

      if (newX !== position.x || newY !== position.y || newZ !== position.z) {
        setPosition({ x: newX, y: newY, z: newZ });
        setStats(prev => ({
          ...prev,
          depth: -newY,
          oxygen: Math.max(0, prev.oxygen - 0.025),
          hunger: Math.max(0, prev.hunger - 0.012),
          thirst: Math.max(0, prev.thirst - 0.015)
        }));
      }
    }, 16);

    return () => clearInterval(interval);
  }, [gameState, keys, position, rotation, touchControls, settings.controls, isInPod]);

  useEffect(() => {
    if (gameState !== 'playing' || isInPod) return;

    const oxygenInterval = setInterval(() => {
      if (position.y < 0) {
        setStats(prev => {
          const newOxygen = Math.max(0, prev.oxygen - 0.35);
          if (newOxygen < 30 && prev.oxygen >= 30) {
            playSound('oxygen');
          }
          return { ...prev, oxygen: newOxygen };
        });
      } else {
        setStats(prev => ({ ...prev, oxygen: Math.min(100, prev.oxygen + 4) }));
      }
    }, 1000);

    return () => clearInterval(oxygenInterval);
  }, [gameState, position.y, isInPod, playSound]);

  const handleTouchStart = (e: React.TouchEvent, type: 'joystick' | 'look' | 'up' | 'down') => {
    e.preventDefault();
    if (type === 'up') {
      setPosition(prev => ({ ...prev, y: Math.min(8, prev.y + 0.4) }));
    } else if (type === 'down') {
      setPosition(prev => ({ ...prev, y: Math.max(-300, prev.y - 0.4) }));
    }
  };

  const handleTouchMove = (e: React.TouchEvent, type: 'joystick' | 'look') => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    if (type === 'joystick') {
      const dx = (touch.clientX - centerX) / (rect.width / 2);
      const dy = -(touch.clientY - centerY) / (rect.height / 2);
      setTouchControls({ x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) });
    } else if (type === 'look') {
      const dx = (touch.clientX - centerX) / rect.width;
      const dy = (touch.clientY - centerY) / rect.height;
      setRotation(prev => ({
        yaw: prev.yaw + dx * 0.12,
        pitch: Math.max(-1.2, Math.min(1.2, prev.pitch + dy * 0.12))
      }));
    }
  };

  const handleTouchEnd = (type: 'joystick' | 'look') => {
    if (type === 'joystick') {
      setTouchControls({ x: 0, y: 0 });
    }
  };

  const useItem = (itemId: string) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    
    if (item.category === 'food') {
      setStats(prev => ({ ...prev, hunger: Math.min(100, prev.hunger + 20) }));
      setInventory(prev => prev.map(i => i.id === itemId ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0));
    } else if (item.category === 'water') {
      setStats(prev => ({ ...prev, thirst: Math.min(100, prev.thirst + 25) }));
      setInventory(prev => prev.map(i => i.id === itemId ? { ...i, count: i.count - 1 } : i).filter(i => i.count > 0));
    }
  };

  const transferFromPod = (item: Item) => {
    setInventory(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, count: i.count + 1 } : i);
      }
      return [...prev, { ...item, count: 1 }];
    });
  };

  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#051129] via-[#0A1628] to-[#0D1F3C] flex items-center justify-center p-4">
        <Card className="bg-card/90 backdrop-blur-md border-primary/40 p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-primary mb-2">SUBNAUTICA</h1>
            <p className="text-muted-foreground text-sm">Descent into Planet 4546B</p>
          </div>
          <div className="space-y-3">
            <Button 
              className="w-full text-lg py-6" 
              onClick={() => setGameState('playing')}
            >
              <Icon name="Play" className="mr-2" size={24} />
              Start Game
            </Button>
            <Button 
              className="w-full text-lg py-6" 
              variant="secondary"
              onClick={() => setGameState('settings')}
            >
              <Icon name="Settings" className="mr-2" size={24} />
              Settings
            </Button>
          </div>
          <div className="mt-6 text-center text-xs text-muted-foreground space-y-1">
            <p>WASD - Move • SPACE/SHIFT - Up/Down</p>
            <p>TAB - PDA • F - Enter Pod • 1-5 - Quick Slots</p>
          </div>
        </Card>
      </div>
    );
  }

  if (gameState === 'settings') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#051129] via-[#0A1628] to-[#0D1F3C] flex items-center justify-center p-4 overflow-y-auto">
        <Card className="bg-card/90 backdrop-blur-md border-primary/40 p-8 max-w-md w-full my-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-primary">Settings</h2>
            <Button variant="ghost" size="icon" onClick={() => setGameState('menu')}>
              <Icon name="X" size={24} />
            </Button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-semibold mb-3 block">Graphics Quality</label>
              <div className="grid grid-cols-2 gap-2">
                {(['low', 'medium', 'high', 'ultra'] as const).map(level => (
                  <Button
                    key={level}
                    variant={settings.graphics === level ? 'default' : 'outline'}
                    onClick={() => setSettings(prev => ({ 
                      ...prev, 
                      graphics: level, 
                      renderDistance: level === 'low' ? 20 : level === 'medium' ? 25 : level === 'high' ? 30 : 35
                    }))}
                    className="capitalize"
                    size="sm"
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-3 block">Controls</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={settings.controls === 'keyboard' ? 'default' : 'outline'}
                  onClick={() => setSettings(prev => ({ ...prev, controls: 'keyboard' }))}
                  size="sm"
                >
                  <Icon name="Keyboard" className="mr-2" size={18} />
                  Keyboard
                </Button>
                <Button
                  variant={settings.controls === 'touch' ? 'default' : 'outline'}
                  onClick={() => setSettings(prev => ({ ...prev, controls: 'touch' }))}
                  size="sm"
                >
                  <Icon name="Smartphone" className="mr-2" size={18} />
                  Touch
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-3 block">
                Sound Volume: {settings.volume}%
              </label>
              <Slider
                value={[settings.volume]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, volume: value }))}
                max={100}
                step={1}
              />
            </div>

            <div>
              <label className="text-sm font-semibold mb-3 block">
                Music Volume: {settings.musicVolume}%
              </label>
              <Slider
                value={[settings.musicVolume]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, musicVolume: value }))}
                max={100}
                step={1}
              />
            </div>

            <div>
              <label className="text-sm font-semibold mb-3 block">
                Field of View: {Math.round(settings.fov * 180 / Math.PI)}°
              </label>
              <Slider
                value={[settings.fov * 180 / Math.PI]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, fov: value * Math.PI / 180 }))}
                min={60}
                max={120}
                step={5}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Shadows</label>
              <Button
                variant={settings.shadows ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSettings(prev => ({ ...prev, shadows: !prev.shadows }))}
              >
                {settings.shadows ? 'ON' : 'OFF'}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Particles</label>
              <Button
                variant={settings.particles ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSettings(prev => ({ ...prev, particles: !prev.particles }))}
              >
                {settings.particles ? 'ON' : 'OFF'}
              </Button>
            </div>
          </div>

          <Button className="w-full mt-6" onClick={() => setGameState('menu')}>
            <Icon name="Check" className="mr-2" size={20} />
            Apply Settings
          </Button>
        </Card>
      </div>
    );
  }

  const isUnderwater = position.y < 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0" />
      
      <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none z-10">
        <Card className={`${isUnderwater ? 'bg-card/85 border-primary/40' : 'bg-card/75 border-accent/40'} backdrop-blur-sm px-6 py-3`}>
          <div className="flex items-center gap-3">
            <Icon name={isUnderwater ? 'Waves' : 'Sun'} className={isUnderwater ? 'text-primary' : 'text-accent'} size={24} />
            <div className="text-center">
              <div className="text-2xl font-bold">
                {isUnderwater ? `${Math.abs(position.y).toFixed(1)}m` : `+${position.y.toFixed(1)}m`}
              </div>
              <div className="text-xs text-muted-foreground">
                {isUnderwater ? 'DEPTH' : 'SURFACE'}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="absolute top-20 left-4 space-y-3 pointer-events-none z-10">
        <Card className="bg-card/85 backdrop-blur-sm border-primary/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Icon name="Heart" className="text-destructive" size={18} />
            <div className="flex-1">
              <Progress value={stats.health} className="h-2" />
              <span className="text-xs text-muted-foreground">{stats.health.toFixed(0)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Wind" className="text-primary" size={18} />
            <div className="flex-1">
              <Progress value={stats.oxygen} className="h-2" />
              <span className="text-xs text-muted-foreground">{stats.oxygen.toFixed(0)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Apple" className="text-accent" size={18} />
            <div className="flex-1">
              <Progress value={stats.hunger} className="h-2" />
              <span className="text-xs text-muted-foreground">{stats.hunger.toFixed(0)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Droplet" className="text-blue-400" size={18} />
            <div className="flex-1">
              <Progress value={stats.thirst} className="h-2" />
              <span className="text-xs text-muted-foreground">{stats.thirst.toFixed(0)}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto z-10">
        {quickSlots.map((itemId, idx) => {
          const item = itemId ? inventory.find(i => i.id === itemId) : null;
          return (
            <button
              key={idx}
              onClick={() => { setSelectedSlot(idx); if (item) useItem(item.id); }}
              className={`w-14 h-14 ${selectedSlot === idx ? 'bg-primary/80 border-primary' : 'bg-card/70 border-primary/30'} backdrop-blur-sm border-2 rounded flex items-center justify-center text-2xl transition-all hover:scale-105`}
            >
              {item ? item.icon : <span className="text-xs text-muted-foreground">{idx + 1}</span>}
            </button>
          );
        })}
      </div>

      {settings.controls === 'touch' && (
        <>
          <div 
            className="absolute bottom-24 left-6 w-28 h-28 bg-card/60 backdrop-blur-sm border-2 border-primary/40 rounded-full pointer-events-auto z-10 flex items-center justify-center"
            onTouchStart={(e) => handleTouchStart(e, 'joystick')}
            onTouchMove={(e) => handleTouchMove(e, 'joystick')}
            onTouchEnd={() => handleTouchEnd('joystick')}
          >
            <div className="w-10 h-10 bg-primary/60 rounded-full" style={{
              transform: `translate(${touchControls.x * 25}px, ${-touchControls.y * 25}px)`
            }} />
          </div>

          <div 
            className="absolute bottom-24 right-6 w-28 h-28 bg-card/60 backdrop-blur-sm border-2 border-primary/40 rounded-full pointer-events-auto z-10"
            onTouchMove={(e) => handleTouchMove(e, 'look')}
          >
            <Icon name="Move" size={28} className="text-primary/50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>

          <div className="absolute right-6 bottom-60 flex flex-col gap-2 pointer-events-auto z-10">
            <button 
              className="w-14 h-14 bg-accent/80 backdrop-blur-sm border-2 border-accent rounded-full flex items-center justify-center"
              onTouchStart={(e) => handleTouchStart(e, 'up')}
            >
              <Icon name="ArrowUp" size={28} className="text-white" />
            </button>
            <button 
              className="w-14 h-14 bg-accent/80 backdrop-blur-sm border-2 border-accent rounded-full flex items-center justify-center"
              onTouchStart={(e) => handleTouchStart(e, 'down')}
            >
              <Icon name="ArrowDown" size={28} className="text-white" />
            </button>
          </div>

          <Button 
            className="absolute top-20 right-4 pointer-events-auto z-10"
            variant="secondary"
            size="icon"
            onClick={() => setShowPDA(prev => !prev)}
          >
            <Icon name="Tablet" size={20} />
          </Button>

          <Button 
            className="absolute top-4 right-4 pointer-events-auto z-10"
            variant="secondary"
            size="icon"
            onClick={() => setGameState('menu')}
          >
            <Icon name="Menu" size={20} />
          </Button>
        </>
      )}

      {showPDA && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center pointer-events-auto z-30 p-4">
          <Card className="bg-card/95 border-primary/50 p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                <Icon name="Tablet" size={28} />
                PDA System
              </h2>
              <button 
                onClick={() => setShowPDA(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon name="X" size={24} />
              </button>
            </div>
            
            <Tabs defaultValue="messages" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="messages">Messages</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
                <TabsTrigger value="data">Data</TabsTrigger>
              </TabsList>
              
              <TabsContent value="messages" className="space-y-3 mt-4">
                {messages.map(msg => (
                  <Card key={msg.id} className="p-4 bg-secondary/30">
                    <div className="flex items-start gap-3">
                      <Icon name="Radio" size={20} className="text-primary mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-primary">{msg.sender}</span>
                          {!msg.read && <span className="w-2 h-2 bg-accent rounded-full" />}
                        </div>
                        <p className="text-sm text-muted-foreground">{msg.text}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </TabsContent>
              
              <TabsContent value="inventory" className="mt-4">
                <div className="grid grid-cols-4 gap-3">
                  {inventory.map(item => (
                    <div 
                      key={item.id}
                      className="bg-secondary/40 border border-primary/30 p-3 rounded hover:bg-secondary/60 transition-colors cursor-pointer relative"
                    >
                      <div className="text-3xl text-center mb-1">{item.icon}</div>
                      <div className="text-xs text-center text-muted-foreground">{item.name}</div>
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded font-bold">
                        {item.count}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="data" className="space-y-3 mt-4">
                <Card className="p-4 bg-secondary/30">
                  <h3 className="font-bold text-primary mb-2">Location: Safe Shallows</h3>
                  <p className="text-sm text-muted-foreground">Coordinates: X{position.x.toFixed(1)} Y{position.y.toFixed(1)} Z{position.z.toFixed(1)}</p>
                  <p className="text-sm text-muted-foreground mt-2">Biome analysis: Shallow reef environment. Rich in basic resources and non-aggressive fauna.</p>
                </Card>
                <Card className="p-4 bg-secondary/30">
                  <h3 className="font-bold text-destructive mb-2">Aurora Status: Critical</h3>
                  <p className="text-sm text-muted-foreground">Drive core breach detected. Radiation levels rising. Recommend repair expedition once equipped.</p>
                </Card>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      )}

      {isInPod && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center pointer-events-auto z-30 p-4">
          <Card className="bg-card/95 border-primary/50 p-6 w-full max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-primary">Lifepod 5 - Storage</h2>
              <button 
                onClick={() => setIsInPod(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon name="X" size={24} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Pod Storage</h3>
                <div className="grid grid-cols-3 gap-2">
                  {podStorage.map(item => (
                    <button
                      key={item.id}
                      onClick={() => transferFromPod(item)}
                      className="bg-secondary/40 border border-primary/30 p-3 rounded hover:bg-secondary/60 transition-colors relative"
                    >
                      <div className="text-3xl text-center mb-1">{item.icon}</div>
                      <div className="text-xs text-center text-muted-foreground">{item.name}</div>
                      <div className="absolute top-1 right-1 bg-accent text-white text-xs px-1.5 py-0.5 rounded font-bold">
                        {item.count}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Your Inventory</h3>
                <div className="grid grid-cols-3 gap-2">
                  {inventory.map(item => (
                    <div 
                      key={item.id}
                      className="bg-secondary/40 border border-primary/30 p-3 rounded relative"
                    >
                      <div className="text-3xl text-center mb-1">{item.icon}</div>
                      <div className="text-xs text-center text-muted-foreground">{item.name}</div>
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded font-bold">
                        {item.count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-secondary/20 rounded">
              <p className="text-xs text-muted-foreground">
                <Icon name="Info" size={14} className="inline mr-1" />
                Click items in pod storage to transfer to your inventory. Press F to exit.
              </p>
            </div>
          </Card>
        </div>
      )}

      {stats.oxygen < 30 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
          <div className="text-destructive text-2xl font-bold animate-pulse flex items-center gap-2">
            <Icon name="AlertTriangle" size={32} />
            OXYGEN CRITICAL
          </div>
        </div>
      )}

      {Math.sqrt(Math.pow(position.x - 60, 2) + Math.pow(position.z - 60, 2)) < 3 && Math.abs(position.y - 1.5) < 2 && !isInPod && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <Card className="bg-card/90 backdrop-blur-sm border-primary/40 px-4 py-2">
            <p className="text-sm font-semibold text-primary">Press F to enter Lifepod</p>
          </Card>
        </div>
      )}

      {settings.controls === 'keyboard' && !mouseRef.current.locked && !showPDA && !isInPod && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <div className="text-center">
            <div className="w-2 h-2 bg-primary rounded-full mx-auto mb-2 shadow-lg shadow-primary/50" />
            <p className="text-xs text-primary/90 font-medium">Click to lock camera</p>
          </div>
        </div>
      )}

      {messages.filter(m => !m.read).length > 0 && !showPDA && (
        <div className="absolute top-4 right-4 pointer-events-none z-10">
          <Card className="bg-accent/90 backdrop-blur-sm border-accent px-3 py-2 animate-pulse">
            <div className="flex items-center gap-2">
              <Icon name="Radio" size={18} className="text-white" />
              <span className="text-sm font-semibold text-white">New Message</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Index;
