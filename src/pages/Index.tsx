import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import Icon from '@/components/ui/icon';

interface PlayerStats {
  health: number;
  oxygen: number;
  hunger: number;
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
}

interface TerrainCell {
  height: number;
  type: 'sand' | 'rock' | 'coral' | 'kelp';
}

interface Settings {
  graphics: 'low' | 'medium' | 'high';
  volume: number;
  controls: 'keyboard' | 'touch';
  renderDistance: number;
  fov: number;
}

type GameState = 'menu' | 'playing' | 'settings';

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainRef = useRef<TerrainCell[][]>([]);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [position, setPosition] = useState<Position>({ x: 60, y: 3, z: 60 });
  const [rotation, setRotation] = useState({ pitch: 0, yaw: 0 });
  const [stats, setStats] = useState<PlayerStats>({
    health: 100,
    oxygen: 100,
    hunger: 100,
    depth: 0
  });
  const [inventory, setInventory] = useState<Item[]>([
    { id: '1', name: 'Flare', icon: '🔦', count: 3 },
    { id: '2', name: 'Scanner', icon: '📡', count: 1 },
    { id: '3', name: 'Knife', icon: '🔪', count: 1 }
  ]);
  const [showInventory, setShowInventory] = useState(false);
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [touchControls, setTouchControls] = useState({ x: 0, y: 0 });
  const mouseRef = useRef({ locked: false });
  const [settings, setSettings] = useState<Settings>({
    graphics: 'medium',
    volume: 50,
    controls: 'keyboard',
    renderDistance: 20,
    fov: Math.PI / 3
  });

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (isMobile) {
      setSettings(prev => ({ ...prev, controls: 'touch', graphics: 'low' }));
    }
  }, [isMobile]);

  useEffect(() => {
    const TERRAIN_SIZE = 120;
    const terrain: TerrainCell[][] = [];
    
    for (let x = 0; x < TERRAIN_SIZE; x++) {
      terrain[x] = [];
      for (let z = 0; z < TERRAIN_SIZE; z++) {
        const centerDist = Math.sqrt(Math.pow(x - TERRAIN_SIZE/2, 2) + Math.pow(z - TERRAIN_SIZE/2, 2));
        
        let baseHeight = -2;
        if (centerDist < 20) {
          baseHeight = 2.5 - (centerDist / 20) * 3;
        } else {
          const noise1 = Math.sin(x * 0.1) * Math.cos(z * 0.1);
          const noise2 = Math.sin(x * 0.05 + z * 0.05) * 2;
          const noise3 = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 4;
          baseHeight = (noise1 + noise2 + noise3) * 0.5 - 1;
        }
        
        let type: TerrainCell['type'] = 'sand';
        const rand = Math.random();
        
        if (centerDist < 20) {
          type = 'sand';
        } else {
          if (baseHeight > 0) type = 'rock';
          else if (baseHeight > -1 && rand > 0.7) type = 'coral';
          else if (rand > 0.85) type = 'kelp';
        }
        
        terrain[x][z] = { height: baseHeight, type };
      }
    }
    
    terrainRef.current = terrain;
  }, []);

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
    const depthFactor = Math.max(0, Math.min(1, Math.abs(position.y) / 15));
    
    let skyColor, waterColor;
    if (isUnderwater) {
      const r = Math.floor(5 + (3 - 5) * depthFactor);
      const g = Math.floor(17 + (8 - 17) * depthFactor);
      const b = Math.floor(41 + (20 - 41) * depthFactor);
      skyColor = `rgb(${r}, ${g}, ${b})`;
      waterColor = `rgb(${r + 5}, ${g + 10}, ${b + 20})`;
    } else {
      skyColor = 'rgb(135, 206, 235)';
      waterColor = 'rgb(14, 165, 233)';
    }

    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, screenWidth, halfHeight);
    
    const floorGradient = ctx.createLinearGradient(0, halfHeight, 0, screenHeight);
    floorGradient.addColorStop(0, waterColor);
    floorGradient.addColorStop(1, isUnderwater ? 'rgb(10, 22, 56)' : 'rgb(5, 100, 200)');
    ctx.fillStyle = floorGradient;
    ctx.fillRect(0, halfHeight, screenWidth, halfHeight);

    const terrain = terrainRef.current;
    if (terrain.length === 0) return;

    const rayStep = settings.graphics === 'low' ? 4 : settings.graphics === 'medium' ? 2 : 1;
    const renderSteps = settings.graphics === 'low' ? 30 : settings.graphics === 'medium' ? 40 : 50;

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

        if (position.y - terrainHeight < 0.8) {
          const wallHeight = screenHeight / (dist * 0.5);
          const drawHeight = Math.min(wallHeight, screenHeight);
          const drawStart = halfHeight - drawHeight / 2 + rotation.pitch * 200;

          const fog = Math.min(1, dist / rayLength);
          let r = 0, g = 0, b = 0;

          switch (cell.type) {
            case 'sand':
              r = 194; g = 178; b = 128;
              break;
            case 'rock':
              r = 100; g = 100; b = 110;
              break;
            case 'coral':
              r = 255; g = 127; b = 80;
              break;
            case 'kelp':
              r = 60; g = 120; b = 60;
              break;
          }

          const shade = 1 - (step / renderSteps) * 0.7;
          const fogR = isUnderwater ? 5 : 135;
          const fogG = isUnderwater ? 17 : 206;
          const fogB = isUnderwater ? 41 : 235;
          
          r = Math.floor((r * shade) * (1 - fog) + fogR * fog);
          g = Math.floor((g * shade) * (1 - fog) + fogG * fog);
          b = Math.floor((b * shade) * (1 - fog) + fogB * fog);

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x, drawStart, rayStep, drawHeight);
          break;
        }
      }
    }

    if (isUnderwater && settings.graphics !== 'low') {
      const particleCount = settings.graphics === 'high' ? 60 : 30;
      ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
      for (let i = 0; i < particleCount; i++) {
        const px = Math.random() * screenWidth;
        const py = Math.random() * screenHeight;
        const size = Math.random() * 2 + 1;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      const vignette = ctx.createRadialGradient(
        screenWidth / 2, screenHeight / 2, 0,
        screenWidth / 2, screenHeight / 2, screenWidth * 0.7
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, `rgba(0, 0, 0, ${0.3 + depthFactor * 0.3})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, screenWidth, screenHeight);
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
      if (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'e') setShowInventory(prev => !prev);
      if (e.key === 'Escape') {
        if (showInventory) setShowInventory(false);
        else setGameState('menu');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: false }));
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (mouseRef.current.locked && settings.controls === 'keyboard') {
        const sensitivity = 0.002;
        setRotation(prev => ({
          yaw: prev.yaw + e.movementX * sensitivity,
          pitch: Math.max(-0.8, Math.min(0.8, prev.pitch + e.movementY * sensitivity))
        }));
      }
    };

    const handleClick = () => {
      if (canvasRef.current && !mouseRef.current.locked && settings.controls === 'keyboard') {
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
  }, [gameState, showInventory, settings.controls]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      const speed = 0.12;
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
        if (keys[' ']) newY = Math.min(5, newY + speed * 1.2);
        if (keys['shift']) newY = Math.max(-20, newY - speed * 1.2);
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
          if (newY < terrainHeight + 1.2) {
            newY = terrainHeight + 1.2;
          }
        }
      }

      if (newX !== position.x || newY !== position.y || newZ !== position.z) {
        setPosition({ x: newX, y: newY, z: newZ });
        setStats(prev => ({
          ...prev,
          depth: -newY,
          oxygen: Math.max(0, prev.oxygen - 0.03),
          hunger: Math.max(0, prev.hunger - 0.015)
        }));
      }
    }, 16);

    return () => clearInterval(interval);
  }, [gameState, keys, position, rotation, touchControls, settings.controls]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const oxygenInterval = setInterval(() => {
      if (position.y < 0) {
        setStats(prev => ({ ...prev, oxygen: Math.max(0, prev.oxygen - 0.4) }));
      } else {
        setStats(prev => ({ ...prev, oxygen: Math.min(100, prev.oxygen + 3) }));
      }
    }, 1000);

    return () => clearInterval(oxygenInterval);
  }, [gameState, position.y]);

  const handleTouchStart = (e: React.TouchEvent, type: 'joystick' | 'look' | 'up' | 'down') => {
    e.preventDefault();
    if (type === 'up') {
      setPosition(prev => ({ ...prev, y: Math.min(5, prev.y + 0.3) }));
    } else if (type === 'down') {
      setPosition(prev => ({ ...prev, y: Math.max(-20, prev.y - 0.3) }));
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
        yaw: prev.yaw + dx * 0.1,
        pitch: Math.max(-0.8, Math.min(0.8, prev.pitch + dy * 0.1))
      }));
    }
  };

  const handleTouchEnd = (type: 'joystick' | 'look') => {
    if (type === 'joystick') {
      setTouchControls({ x: 0, y: 0 });
    }
  };

  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#051129] via-[#0A1628] to-[#0D1F3C] flex items-center justify-center p-4">
        <Card className="bg-card/90 backdrop-blur-md border-primary/40 p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-primary mb-2">SUBNAUTICA</h1>
            <p className="text-muted-foreground">Survival Adventure</p>
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
          <div className="mt-6 text-center text-xs text-muted-foreground">
            <p>WASD - Move • SPACE/SHIFT - Up/Down</p>
            <p>Mouse - Look • I/E - Inventory</p>
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
              <div className="grid grid-cols-3 gap-2">
                {(['low', 'medium', 'high'] as const).map(level => (
                  <Button
                    key={level}
                    variant={settings.graphics === level ? 'default' : 'outline'}
                    onClick={() => setSettings(prev => ({ ...prev, graphics: level, renderDistance: level === 'low' ? 15 : level === 'medium' ? 20 : 25 }))}
                    className="capitalize"
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
                >
                  <Icon name="Keyboard" className="mr-2" size={18} />
                  Keyboard
                </Button>
                <Button
                  variant={settings.controls === 'touch' ? 'default' : 'outline'}
                  onClick={() => setSettings(prev => ({ ...prev, controls: 'touch' }))}
                >
                  <Icon name="Smartphone" className="mr-2" size={18} />
                  Touch
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-3 block">
                Volume: {settings.volume}%
              </label>
              <Slider
                value={[settings.volume]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, volume: value }))}
                max={100}
                step={1}
                className="w-full"
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
                className="w-full"
              />
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
    <div className="relative w-screen h-screen overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
      
      <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none z-10">
        <Card className={`${isUnderwater ? 'bg-card/80 border-primary/40' : 'bg-card/70 border-accent/40'} backdrop-blur-sm px-6 py-3`}>
          <div className="flex items-center gap-3">
            <Icon name={isUnderwater ? 'Waves' : 'Sun'} className={isUnderwater ? 'text-primary' : 'text-accent'} size={24} />
            <div className="text-center">
              <div className="text-2xl font-bold">
                {isUnderwater ? `${Math.abs(position.y).toFixed(1)}m` : `+${position.y.toFixed(1)}m`}
              </div>
              <div className="text-xs text-muted-foreground">
                {isUnderwater ? 'UNDERWATER' : 'ABOVE WATER'}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="absolute top-20 left-6 space-y-3 pointer-events-none z-10">
        <Card className="bg-card/80 backdrop-blur-sm border-primary/30 p-4 space-y-2">
          <div className="flex items-center gap-3">
            <Icon name="Heart" className="text-destructive" size={20} />
            <div className="flex-1">
              <Progress value={stats.health} className="h-2" />
              <span className="text-xs text-muted-foreground">{stats.health.toFixed(0)}%</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Icon name="Wind" className="text-primary" size={20} />
            <div className="flex-1">
              <Progress value={stats.oxygen} className="h-2" />
              <span className="text-xs text-muted-foreground">{stats.oxygen.toFixed(0)}%</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Icon name="Apple" className="text-accent" size={20} />
            <div className="flex-1">
              <Progress value={stats.hunger} className="h-2" />
              <span className="text-xs text-muted-foreground">{stats.hunger.toFixed(0)}%</span>
            </div>
          </div>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-primary/30 p-3">
          <div className="text-xs text-muted-foreground">
            X: {position.x.toFixed(1)} Z: {position.z.toFixed(1)}
          </div>
          <div className="text-xs text-primary mt-1">
            FPS: {settings.graphics.toUpperCase()}
          </div>
        </Card>
      </div>

      {settings.controls === 'keyboard' && (
        <div className="absolute top-6 right-6 pointer-events-none z-10">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/30 p-4">
            <h3 className="text-sm font-bold mb-2 text-primary">CONTROLS</h3>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p>WASD - Move</p>
              <p>SPACE - Up</p>
              <p>SHIFT - Down</p>
              <p>MOUSE - Look</p>
              <p>I/E - Inventory</p>
              <p>ESC - Menu</p>
            </div>
          </Card>
        </div>
      )}

      {settings.controls === 'touch' && (
        <>
          <div 
            className="absolute bottom-6 left-6 w-32 h-32 bg-card/60 backdrop-blur-sm border-2 border-primary/40 rounded-full pointer-events-auto z-10 flex items-center justify-center"
            onTouchStart={(e) => handleTouchStart(e, 'joystick')}
            onTouchMove={(e) => handleTouchMove(e, 'joystick')}
            onTouchEnd={() => handleTouchEnd('joystick')}
          >
            <div className="w-12 h-12 bg-primary/50 rounded-full" style={{
              transform: `translate(${touchControls.x * 30}px, ${-touchControls.y * 30}px)`
            }} />
          </div>

          <div 
            className="absolute bottom-6 right-6 w-32 h-32 bg-card/60 backdrop-blur-sm border-2 border-primary/40 rounded-full pointer-events-auto z-10 flex items-center justify-center"
            onTouchMove={(e) => handleTouchMove(e, 'look')}
          >
            <Icon name="Move" size={32} className="text-primary/50" />
          </div>

          <div className="absolute right-6 bottom-44 flex flex-col gap-3 pointer-events-auto z-10">
            <button 
              className="w-16 h-16 bg-accent/80 backdrop-blur-sm border-2 border-accent rounded-full flex items-center justify-center"
              onTouchStart={(e) => handleTouchStart(e, 'up')}
            >
              <Icon name="ArrowUp" size={32} className="text-white" />
            </button>
            <button 
              className="w-16 h-16 bg-accent/80 backdrop-blur-sm border-2 border-accent rounded-full flex items-center justify-center"
              onTouchStart={(e) => handleTouchStart(e, 'down')}
            >
              <Icon name="ArrowDown" size={32} className="text-white" />
            </button>
          </div>

          <Button 
            className="absolute top-6 right-6 pointer-events-auto z-10"
            variant="secondary"
            size="icon"
            onClick={() => setShowInventory(prev => !prev)}
          >
            <Icon name="Backpack" size={24} />
          </Button>

          <Button 
            className="absolute top-6 left-6 pointer-events-auto z-10"
            variant="secondary"
            size="icon"
            onClick={() => setGameState('menu')}
          >
            <Icon name="Menu" size={24} />
          </Button>
        </>
      )}

      {showInventory && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto z-20">
          <Card className="bg-card/95 border-primary/50 p-6 w-[90%] max-w-[500px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-primary">INVENTORY</h2>
              <button 
                onClick={() => setShowInventory(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon name="X" size={24} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {inventory.map(item => (
                <div 
                  key={item.id}
                  className="bg-secondary/50 border border-primary/30 p-4 rounded-sm hover:bg-secondary/70 transition-colors cursor-pointer relative group"
                >
                  <div className="text-3xl text-center mb-2">{item.icon}</div>
                  <div className="text-xs text-center text-muted-foreground">{item.name}</div>
                  <div className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-sm font-bold">
                    {item.count}
                  </div>
                </div>
              ))}
              {Array.from({ length: 12 - inventory.length }).map((_, i) => (
                <div 
                  key={`empty-${i}`}
                  className="bg-secondary/20 border border-primary/10 p-4 rounded-sm"
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      {settings.controls === 'keyboard' && !mouseRef.current.locked && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <div className="text-center">
            <div className="w-1 h-1 bg-primary rounded-full mx-auto mb-2 shadow-lg shadow-primary/50" />
            <p className="text-xs text-primary/80 font-medium">Click to enable controls</p>
          </div>
        </div>
      )}

      {stats.oxygen < 30 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <div className="text-destructive text-2xl font-bold animate-pulse flex items-center gap-2">
            <Icon name="AlertTriangle" size={32} />
            LOW OXYGEN
          </div>
        </div>
      )}
    </div>
  );
}

export default Index;
