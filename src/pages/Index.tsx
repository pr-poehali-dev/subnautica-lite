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
  maxOxygen: number;
  hunger: number;
  thirst: number;
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
  category: 'tool' | 'food' | 'material' | 'water' | 'craftable';
}

interface Resource {
  x: number;
  y: number;
  z: number;
  type: 'limestone' | 'metal' | 'quartz';
}

interface Recipe {
  id: string;
  name: string;
  icon: string;
  requires: { id: string; count: number }[];
  category: 'tool' | 'equipment' | 'food';
}

interface Settings {
  graphics: 'low' | 'medium' | 'high' | 'ultra';
  volume: number;
  fov: number;
}

interface Message {
  id: string;
  sender: 'AURORA' | 'PDA';
  text: string;
}

type GameState = 'menu' | 'playing' | 'settings' | 'pda' | 'fabricator';

const RECIPES: Recipe[] = [
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

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resourcesRef = useRef<Resource[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const auroraImgRef = useRef<HTMLImageElement | null>(null);
  
  const [gameState, setGameState] = useState<GameState>('menu');
  const [position, setPosition] = useState<Position>({ x: 60, y: 0, z: 60 });
  const [rotation, setRotation] = useState({ pitch: 0, yaw: 0 });
  const [handAnimation, setHandAnimation] = useState(0);
  
  const [stats, setStats] = useState<PlayerStats>({
    health: 100,
    oxygen: 45,
    maxOxygen: 45,
    hunger: 100,
    thirst: 100
  });
  
  const [inventory, setInventory] = useState<Item[]>([
    { id: 'flare', name: 'Flare', icon: '🔦', count: 2, category: 'tool' },
  ]);
  
  const [quickSlots, setQuickSlots] = useState<(string | null)[]>(['flare', null, null, null, null]);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [showPDA, setShowPDA] = useState(false);
  const [showFabricator, setShowFabricator] = useState(false);
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  
  const mouseRef = useRef({ locked: false });
  const [settings, setSettings] = useState<Settings>({
    graphics: 'medium',
    volume: 70,
    fov: Math.PI / 3
  });
  
  const [messages] = useState<Message[]>([
    { id: '1', sender: 'AURORA', text: 'Emergency: Aurora has suffered catastrophic hull failure. All hands abandon ship.' },
    { id: '2', sender: 'PDA', text: 'Lifepod 5 systems online. Fabricator available for crafting tools and supplies.' }
  ]);
  
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (isMobile) {
      setSettings(prev => ({ ...prev, graphics: 'low' }));
    }
    
    const img = new Image();
    img.src = 'https://cdn.poehali.dev/projects/e32a88a7-5c48-4892-b7c6-dfbcc2ab1cd0/files/2f4b93a4-6844-409c-95ea-7e75bc0a1cb7.jpg';
    auroraImgRef.current = img;
  }, [isMobile]);

  useEffect(() => {
    const resources: Resource[] = [];
    
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 50 + 10;
      resources.push({
        x: 60 + Math.cos(angle) * dist,
        y: -Math.random() * 20 - 2,
        z: 60 + Math.sin(angle) * dist,
        type: Math.random() > 0.6 ? 'limestone' : Math.random() > 0.5 ? 'metal' : 'quartz'
      });
    }
    
    resourcesRef.current = resources;
  }, []);

  const playSound = useCallback((type: 'notification' | 'oxygen' | 'pickup') => {
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
    } else if (type === 'oxygen') {
      osc.frequency.value = 600;
      gain.gain.value = settings.volume / 300;
    } else if (type === 'pickup') {
      osc.frequency.value = 1200;
      gain.gain.value = settings.volume / 250;
    }
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }, [settings.volume]);

  const getTerrainHeight = useCallback((x: number, z: number): number => {
    const centerDist = Math.sqrt(Math.pow(x - 60, 2) + Math.pow(z - 60, 2));
    
    if (centerDist < 25) {
      return -2 - (centerDist / 25) * 3;
    } else {
      const noise1 = Math.sin(x * 0.08) * Math.cos(z * 0.08);
      const noise2 = Math.sin(x * 0.04 + z * 0.04) * 2.5;
      const noise3 = Math.sin(x * 0.015) * Math.cos(z * 0.015) * 5;
      return (noise1 + noise2 + noise3) * 0.6 - 5;
    }
  }, []);

  const renderScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    const fov = settings.fov;
    const halfHeight = screenHeight / 2;
    
    const isUnderwater = position.y < 0;
    const depthFactor = Math.max(0, Math.min(1, Math.abs(position.y) / 30));
    
    if (isUnderwater) {
      const r = Math.floor(10 + (3 - 10) * depthFactor);
      const g = Math.floor(40 + (15 - 40) * depthFactor);
      const b = Math.floor(80 + (35 - 80) * depthFactor);
      const gradient = ctx.createLinearGradient(0, 0, 0, screenHeight);
      gradient.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
      gradient.addColorStop(1, `rgb(${Math.floor(r * 0.3)}, ${Math.floor(g * 0.3)}, ${Math.floor(b * 0.3)})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, screenWidth, screenHeight);
    } else {
      const skyGradient = ctx.createLinearGradient(0, 0, 0, halfHeight);
      skyGradient.addColorStop(0, 'rgb(50, 100, 180)');
      skyGradient.addColorStop(0.5, 'rgb(100, 150, 220)');
      skyGradient.addColorStop(1, 'rgb(150, 200, 255)');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, screenWidth, halfHeight);
      
      ctx.fillStyle = 'rgba(255, 255, 200, 0.9)';
      ctx.beginPath();
      ctx.arc(screenWidth * 0.75, halfHeight * 0.3, 40, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'rgba(180, 120, 200, 0.6)';
      ctx.beginPath();
      ctx.arc(screenWidth * 0.15, halfHeight * 0.4, 60, 0, Math.PI * 2);
      ctx.fill();
      
      const waterLine = halfHeight - position.y * 80 + rotation.pitch * 250;
      
      const waterGradient = ctx.createLinearGradient(0, waterLine, 0, screenHeight);
      waterGradient.addColorStop(0, 'rgba(20, 100, 180, 0.7)');
      waterGradient.addColorStop(1, 'rgba(10, 60, 120, 0.9)');
      ctx.fillStyle = waterGradient;
      ctx.fillRect(0, waterLine, screenWidth, screenHeight - waterLine);
      
      for (let i = 0; i < 5; i++) {
        const waveY = waterLine + Math.sin((Date.now() / 500 + i * 30)) * 3;
        const waveX = (Date.now() / 50 + i * 50) % screenWidth;
        ctx.fillStyle = 'rgba(100, 180, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(waveX, waveY, 30, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const rayStep = settings.graphics === 'low' ? 8 : settings.graphics === 'medium' ? 4 : settings.graphics === 'high' ? 2 : 1;
    const renderDistance = settings.graphics === 'low' ? 25 : settings.graphics === 'medium' ? 35 : settings.graphics === 'high' ? 45 : 55;
    const renderSteps = Math.floor(renderDistance * 1.5);

    for (let x = 0; x < screenWidth; x += rayStep) {
      const cameraX = 2 * x / screenWidth - 1;
      const rayDirX = Math.sin(rotation.yaw) + Math.cos(rotation.yaw) * cameraX * Math.tan(fov / 2);
      const rayDirZ = Math.cos(rotation.yaw) - Math.sin(rotation.yaw) * cameraX * Math.tan(fov / 2);

      for (let step = 1; step < renderSteps; step++) {
        const dist = (step / renderSteps) * renderDistance;
        const sampleX = position.x + rayDirX * dist;
        const sampleZ = position.z + rayDirZ * dist;

        const terrainHeight = getTerrainHeight(sampleX, sampleZ);

        if (position.y - terrainHeight < 1.5) {
          const wallHeight = screenHeight / (dist * 0.5);
          const drawHeight = Math.min(wallHeight, screenHeight);
          const drawStart = halfHeight - drawHeight / 2 + rotation.pitch * 250;

          const fog = Math.min(1, dist / renderDistance);
          const centerDist = Math.sqrt(Math.pow(sampleX - 60, 2) + Math.pow(sampleZ - 60, 2));
          
          let r = 180, g = 165, b = 120;
          
          if (centerDist > 25) {
            const noise = Math.sin(sampleX * 0.5) * Math.cos(sampleZ * 0.5);
            if (noise > 0.3) {
              r = 255; g = 100; b = 70;
            } else if (noise < -0.3) {
              r = 50; g = 130; b = 50;
            } else {
              r = 90; g = 90; b = 95;
            }
          }

          const shade = 1 - (step / renderSteps) * 0.7;
          const fogR = isUnderwater ? 10 : 100;
          const fogG = isUnderwater ? 40 : 150;
          const fogB = isUnderwater ? 80 : 220;
          
          r = Math.floor((r * shade) * (1 - fog) + fogR * fog);
          g = Math.floor((g * shade) * (1 - fog) + fogG * fog);
          b = Math.floor((b * shade) * (1 - fog) + fogB * fog);

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x, drawStart, rayStep, drawHeight);
          break;
        }
      }
    }

    const resources = resourcesRef.current;
    resources.forEach(res => {
      const dx = res.x - position.x;
      const dz = res.z - position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist < 30) {
        const angle = Math.atan2(dz, dx) - rotation.yaw;
        const screenX = screenWidth / 2 + Math.tan(angle) * screenWidth / (2 * Math.tan(fov / 2));
        const dy = res.y - position.y;
        const screenY = halfHeight - (dy / dist) * 200 + rotation.pitch * 200;
        
        if (screenX > -50 && screenX < screenWidth + 50 && Math.abs(angle) < fov / 2 + 0.5) {
          const size = Math.max(8, 50 / dist);
          
          if (res.type === 'limestone') {
            ctx.fillStyle = 'rgb(140, 140, 145)';
            ctx.fillRect(screenX - size/2, screenY - size/2, size, size);
          } else if (res.type === 'metal') {
            ctx.fillStyle = 'rgb(180, 100, 50)';
            ctx.beginPath();
            ctx.arc(screenX, screenY, size/2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = 'rgba(200, 220, 255, 0.7)';
            ctx.beginPath();
            ctx.arc(screenX, screenY, size/2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    });

    const podDist = Math.sqrt(Math.pow(position.x - 60, 2) + Math.pow(position.z - 60, 2));
    if (podDist < 40) {
      const dx = 60 - position.x;
      const dz = 60 - position.z;
      const angle = Math.atan2(dz, dx) - rotation.yaw;
      const screenX = screenWidth / 2 + Math.tan(angle) * screenWidth / (2 * Math.tan(fov / 2));
      
      if (Math.abs(angle) < fov / 2 + 0.5) {
        const podWidth = Math.max(20, 120 / podDist);
        const podHeight = Math.max(30, 180 / podDist);
        const dy = 0 - position.y;
        const podY = halfHeight - (dy / podDist) * 200 + rotation.pitch * 200;
        
        ctx.fillStyle = 'rgb(200, 50, 60)';
        ctx.fillRect(screenX - podWidth / 2, podY, podWidth, podHeight);
        ctx.fillStyle = 'rgb(100, 150, 200)';
        ctx.fillRect(screenX - podWidth / 3, podY + podHeight / 4, podWidth / 2, podHeight / 3);
        
        if (podDist > 5) {
          ctx.fillStyle = 'rgba(0, 255, 100, 0.8)';
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`Lifepod 5 [${podDist.toFixed(0)}m]`, screenX, podY - 10);
          
          ctx.strokeStyle = 'rgba(0, 255, 100, 0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(screenWidth / 2, screenHeight / 2);
          ctx.lineTo(screenX, podY);
          ctx.stroke();
        }
      }
    }

    const auroraX = 80;
    const auroraZ = 20;
    const dx = auroraX - position.x;
    const dz = auroraZ - position.z;
    const distAurora = Math.sqrt(dx * dx + dz * dz);
    
    if (distAurora < 100 && position.y > -5) {
      const angle = Math.atan2(dz, dx) - rotation.yaw;
      
      if (Math.abs(angle) < fov / 2 + 0.3 && auroraImgRef.current) {
        const screenX = screenWidth / 2 + Math.tan(angle) * screenWidth / (2 * Math.tan(fov / 2));
        const auroraWidth = Math.max(100, 800 / distAurora);
        const auroraHeight = Math.max(50, 400 / distAurora);
        const auroraY = halfHeight - auroraHeight / 2 + rotation.pitch * 200 - (position.y > 0 ? position.y * 30 : 0);
        
        ctx.drawImage(auroraImgRef.current, screenX - auroraWidth / 2, auroraY, auroraWidth, auroraHeight);
      }
    }

    if (isUnderwater) {
      const particleCount = settings.graphics === 'ultra' ? 100 : settings.graphics === 'high' ? 60 : 40;
      ctx.fillStyle = 'rgba(200, 230, 255, 0.2)';
      for (let i = 0; i < particleCount; i++) {
        const px = Math.random() * screenWidth;
        const py = Math.random() * screenHeight;
        const size = Math.random() * 3 + 0.5;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      const vignette = ctx.createRadialGradient(
        screenWidth / 2, screenHeight / 2, 0,
        screenWidth / 2, screenHeight / 2, screenWidth * 0.6
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, `rgba(0, 0, 0, ${0.3 + depthFactor * 0.4})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, screenWidth, screenHeight);
      
      const handY = screenHeight - 100 + Math.sin(handAnimation) * 15;
      const handX = screenWidth / 2 + Math.cos(handAnimation * 1.5) * 40;
      
      ctx.fillStyle = 'rgba(200, 170, 140, 0.9)';
      ctx.beginPath();
      ctx.ellipse(handX, handY, 25, 35, Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'rgba(180, 150, 120, 0.9)';
      for (let i = 0; i < 5; i++) {
        const fingerX = handX + (i - 2) * 8 + Math.cos(handAnimation) * 3;
        const fingerY = handY + 30 + Math.sin(handAnimation) * 5;
        ctx.fillRect(fingerX, fingerY, 5, 20);
      }
    }

    ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(screenWidth / 2, screenHeight / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenWidth / 2 - 15, screenHeight / 2);
    ctx.lineTo(screenWidth / 2 + 15, screenHeight / 2);
    ctx.moveTo(screenWidth / 2, screenHeight / 2 - 15);
    ctx.lineTo(screenWidth / 2, screenHeight / 2 + 15);
    ctx.stroke();
  }, [position, rotation, settings, handAnimation, getTerrainHeight]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let animationId: number;
    const animate = () => {
      renderScene();
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
  }, [gameState, renderScene]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: true }));
      
      if (e.key.toLowerCase() === 'tab') {
        e.preventDefault();
        setShowPDA(prev => !prev);
      }
      if (e.key.toLowerCase() === 'e') {
        const resources = resourcesRef.current;
        const nearby = resources.findIndex(r => {
          const dist = Math.sqrt(Math.pow(r.x - position.x, 2) + Math.pow(r.z - position.z, 2));
          return dist < 3 && Math.abs(r.y - position.y) < 2;
        });
        
        if (nearby !== -1) {
          const resource = resources[nearby];
          let itemToAdd: Item | null = null;
          
          if (resource.type === 'limestone') {
            itemToAdd = { id: 'metal', name: 'Metal Salvage', icon: '🔩', count: 1, category: 'material' };
          } else if (resource.type === 'metal') {
            itemToAdd = { id: 'titanium', name: 'Titanium', icon: '⚙️', count: 1, category: 'material' };
          } else {
            itemToAdd = { id: 'quartz', name: 'Quartz', icon: '💎', count: 1, category: 'material' };
          }
          
          if (itemToAdd) {
            setInventory(prev => {
              const existing = prev.find(i => i.id === itemToAdd!.id);
              if (existing) {
                return prev.map(i => i.id === itemToAdd!.id ? { ...i, count: i.count + 1 } : i);
              }
              return [...prev, itemToAdd!];
            });
            
            resources.splice(nearby, 1);
            playSound('pickup');
          }
        }
        
        const podDist = Math.sqrt(Math.pow(position.x - 60, 2) + Math.pow(position.z - 60, 2));
        if (podDist < 3 && Math.abs(position.y) < 2) {
          setShowFabricator(true);
        }
      }
      if (e.key >= '1' && e.key <= '5') {
        setSelectedSlot(parseInt(e.key) - 1);
      }
      if (e.key === 'Escape') {
        if (showPDA) setShowPDA(false);
        else if (showFabricator) setShowFabricator(false);
        else setGameState('menu');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: false }));
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (mouseRef.current.locked) {
        const sensitivity = 0.002;
        setRotation(prev => ({
          yaw: prev.yaw + e.movementX * sensitivity,
          pitch: Math.max(-1.4, Math.min(1.4, prev.pitch + e.movementY * sensitivity))
        }));
      }
    };

    const handleClick = () => {
      if (canvasRef.current && !mouseRef.current.locked && !showPDA && !showFabricator) {
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
  }, [gameState, showPDA, showFabricator, position, playSound]);

  useEffect(() => {
    if (gameState !== 'playing' || showFabricator) return;

    const interval = setInterval(() => {
      const speed = position.y < 0 ? 0.12 : 0.08;
      let newX = position.x;
      let newY = position.y;
      let newZ = position.z;

      const moveX = Math.sin(rotation.yaw);
      const moveZ = Math.cos(rotation.yaw);

      let isMoving = false;

      if (keys['w']) {
        newX += moveX * speed;
        newZ += moveZ * speed;
        isMoving = true;
      }
      if (keys['s']) {
        newX -= moveX * speed;
        newZ -= moveZ * speed;
        isMoving = true;
      }
      if (keys['a']) {
        newX += Math.cos(rotation.yaw) * speed;
        newZ -= Math.sin(rotation.yaw) * speed;
        isMoving = true;
      }
      if (keys['d']) {
        newX -= Math.cos(rotation.yaw) * speed;
        newZ += Math.sin(rotation.yaw) * speed;
        isMoving = true;
      }
      if (keys[' '] && position.y < 0) {
        newY = Math.min(0, newY + speed * 1.2);
        isMoving = true;
      }
      if (keys['shift']) {
        newY = Math.max(-250, newY - speed * 1.2);
        isMoving = true;
      }

      if (newY > 0) newY = 0;

      const terrainHeight = getTerrainHeight(newX, newZ);
      if (newY < terrainHeight + 1.5) {
        newY = terrainHeight + 1.5;
      }

      if (newX !== position.x || newY !== position.y || newZ !== position.z) {
        setPosition({ x: newX, y: newY, z: newZ });
        setStats(prev => ({
          ...prev,
          hunger: Math.max(0, prev.hunger - 0.008),
          thirst: Math.max(0, prev.thirst - 0.01)
        }));
      }
      
      if (isMoving && position.y < 0) {
        setHandAnimation(prev => prev + 0.15);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [gameState, keys, position, rotation, showFabricator, getTerrainHeight]);

  useEffect(() => {
    if (gameState !== 'playing' || showFabricator) return;

    const oxygenInterval = setInterval(() => {
      if (position.y < 0) {
        setStats(prev => {
          const newOxygen = Math.max(0, prev.oxygen - 1);
          if (newOxygen < 15 && prev.oxygen >= 15) {
            playSound('oxygen');
          }
          if (newOxygen === 0) {
            return { ...prev, oxygen: 0, health: Math.max(0, prev.health - 5) };
          }
          return { ...prev, oxygen: newOxygen };
        });
      } else {
        setStats(prev => ({ ...prev, oxygen: Math.min(prev.maxOxygen, prev.oxygen + 3) }));
      }
    }, 1000);

    return () => clearInterval(oxygenInterval);
  }, [gameState, position.y, showFabricator, playSound]);

  const craftItem = (recipe: Recipe) => {
    const canCraft = recipe.requires.every(req => {
      const item = inventory.find(i => i.id === req.id);
      return item && item.count >= req.count;
    });
    
    if (!canCraft) return;
    
    setInventory(prev => {
      let updated = [...prev];
      recipe.requires.forEach(req => {
        updated = updated.map(i => i.id === req.id ? { ...i, count: i.count - req.count } : i).filter(i => i.count > 0);
      });
      
      const newItem: Item = {
        id: recipe.id,
        name: recipe.name,
        icon: recipe.icon,
        count: 1,
        category: recipe.category as any
      };
      
      const existing = updated.find(i => i.id === recipe.id);
      if (existing) {
        return updated.map(i => i.id === recipe.id ? { ...i, count: i.count + 1 } : i);
      }
      
      return [...updated, newItem];
    });
    
    if (recipe.id === 'tank') {
      setStats(prev => ({ ...prev, maxOxygen: 75, oxygen: 75 }));
    }
    
    if (recipe.id === 'water') {
      setStats(prev => ({ ...prev, thirst: Math.min(100, prev.thirst + 25) }));
    }
    
    playSound('pickup');
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
            <p>WASD - Swim • SPACE/SHIFT - Up/Down (underwater only)</p>
            <p>TAB - PDA • E - Collect/Use • 1-5 - Quick Slots</p>
          </div>
        </Card>
      </div>
    );
  }

  if (gameState === 'settings') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#051129] via-[#0A1628] to-[#0D1F3C] flex items-center justify-center p-4">
        <Card className="bg-card/90 backdrop-blur-md border-primary/40 p-8 max-w-md w-full">
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
                    onClick={() => setSettings(prev => ({ ...prev, graphics: level }))}
                    className="capitalize"
                    size="sm"
                  >
                    {level}
                  </Button>
                ))}
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
          </div>

          <Button className="w-full mt-6" onClick={() => setGameState('menu')}>
            <Icon name="Check" className="mr-2" size={20} />
            Apply
          </Button>
        </Card>
      </div>
    );
  }

  const isUnderwater = position.y < 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0" />
      
      <div className="absolute top-4 left-4 space-y-2 pointer-events-none z-10">
        <div className="flex items-center gap-2">
          <div className="bg-black/70 backdrop-blur-sm px-4 py-2 rounded border border-cyan-500/30">
            <div className="text-cyan-400 font-bold text-lg">{Math.abs(position.y).toFixed(1)}m</div>
          </div>
        </div>
        
        <div className="bg-black/70 backdrop-blur-sm p-3 rounded border border-cyan-500/30 space-y-1.5 min-w-[200px]">
          <div className="flex items-center gap-2">
            <Icon name="Heart" className="text-red-500" size={16} />
            <Progress value={stats.health} className="h-1.5 flex-1" />
            <span className="text-xs text-white font-mono w-8 text-right">{stats.health.toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Wind" className="text-cyan-400" size={16} />
            <Progress value={(stats.oxygen / stats.maxOxygen) * 100} className="h-1.5 flex-1" />
            <span className="text-xs text-white font-mono w-8 text-right">{stats.oxygen}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Apple" className="text-orange-400" size={16} />
            <Progress value={stats.hunger} className="h-1.5 flex-1" />
            <span className="text-xs text-white font-mono w-8 text-right">{stats.hunger.toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Droplet" className="text-blue-400" size={16} />
            <Progress value={stats.thirst} className="h-1.5 flex-1" />
            <span className="text-xs text-white font-mono w-8 text-right">{stats.thirst.toFixed(0)}</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto z-10">
        {quickSlots.map((itemId, idx) => {
          const item = itemId ? inventory.find(i => i.id === itemId) : null;
          return (
            <button
              key={idx}
              onClick={() => setSelectedSlot(idx)}
              className={`w-14 h-14 ${selectedSlot === idx ? 'bg-cyan-500/90 border-cyan-400' : 'bg-black/70 border-cyan-500/30'} backdrop-blur-sm border-2 rounded flex items-center justify-center text-2xl transition-all hover:scale-105`}
            >
              {item ? item.icon : <span className="text-xs text-muted-foreground">{idx + 1}</span>}
            </button>
          );
        })}
      </div>

      {showPDA && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center pointer-events-auto z-30 p-4">
          <Card className="bg-card/95 border-cyan-500/50 p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="messages">Messages</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
              </TabsList>
              
              <TabsContent value="messages" className="space-y-3 mt-4">
                {messages.map(msg => (
                  <Card key={msg.id} className="p-4 bg-secondary/30">
                    <div className="flex items-start gap-3">
                      <Icon name="Radio" size={20} className="text-cyan-400 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-cyan-400">{msg.sender}</span>
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
                      className="bg-secondary/40 border border-cyan-500/30 p-3 rounded hover:bg-secondary/60 transition-colors cursor-pointer relative"
                    >
                      <div className="text-3xl text-center mb-1">{item.icon}</div>
                      <div className="text-xs text-center text-muted-foreground">{item.name}</div>
                      <div className="absolute top-1 right-1 bg-cyan-500 text-white text-xs px-1.5 py-0.5 rounded font-bold">
                        {item.count}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      )}

      {showFabricator && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center pointer-events-auto z-30 p-4">
          <Card className="bg-card/95 border-cyan-500/50 p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-cyan-400">Fabricator</h2>
              <button 
                onClick={() => setShowFabricator(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon name="X" size={24} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {RECIPES.map(recipe => {
                const canCraft = recipe.requires.every(req => {
                  const item = inventory.find(i => i.id === req.id);
                  return item && item.count >= req.count;
                });
                
                return (
                  <button
                    key={recipe.id}
                    onClick={() => craftItem(recipe)}
                    disabled={!canCraft}
                    className={`p-4 rounded border-2 transition-all text-left ${
                      canCraft 
                        ? 'bg-cyan-500/20 border-cyan-500 hover:bg-cyan-500/30' 
                        : 'bg-secondary/20 border-secondary/40 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{recipe.icon}</div>
                      <div className="flex-1">
                        <div className="font-bold text-lg">{recipe.name}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Requires: {recipe.requires.map(req => {
                            const item = inventory.find(i => i.id === req.id);
                            const has = item?.count || 0;
                            return `${req.id} (${has}/${req.count})`;
                          }).join(', ')}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {stats.oxygen < 15 && stats.oxygen > 0 && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-20">
          <div className="text-red-500 text-xl font-bold animate-pulse flex items-center gap-2">
            <Icon name="AlertTriangle" size={28} />
            OXYGEN LOW
          </div>
        </div>
      )}

      {stats.oxygen === 0 && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-20">
          <div className="text-red-600 text-2xl font-bold animate-pulse flex items-center gap-2">
            <Icon name="Skull" size={32} />
            OUT OF OXYGEN
          </div>
        </div>
      )}

      {(() => {
        const resources = resourcesRef.current;
        const nearby = resources.find(r => {
          const dist = Math.sqrt(Math.pow(r.x - position.x, 2) + Math.pow(r.z - position.z, 2));
          return dist < 3 && Math.abs(r.y - position.y) < 2;
        });
        
        if (nearby) {
          return (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 pointer-events-none z-10">
              <Card className="bg-black/80 backdrop-blur-sm border-cyan-500/40 px-4 py-2">
                <p className="text-sm font-semibold text-cyan-400">Press E to collect</p>
              </Card>
            </div>
          );
        }
        
        const podDist = Math.sqrt(Math.pow(position.x - 60, 2) + Math.pow(position.z - 60, 2));
        if (podDist < 3 && Math.abs(position.y) < 2) {
          return (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 pointer-events-none z-10">
              <Card className="bg-black/80 backdrop-blur-sm border-cyan-500/40 px-4 py-2">
                <p className="text-sm font-semibold text-cyan-400">Press E to use Fabricator</p>
              </Card>
            </div>
          );
        }
        
        return null;
      })()}

      {!mouseRef.current.locked && !showPDA && !showFabricator && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <p className="text-sm text-cyan-400/90 font-medium">Click to start</p>
        </div>
      )}
    </div>
  );
}

export default Index;
