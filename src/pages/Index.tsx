import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainRef = useRef<TerrainCell[][]>([]);
  const [position, setPosition] = useState<Position>({ x: 50, y: 1.5, z: 50 });
  const [rotation, setRotation] = useState({ pitch: 0, yaw: 0 });
  const [stats, setStats] = useState<PlayerStats>({
    health: 100,
    oxygen: 100,
    hunger: 100,
    depth: 5
  });
  const [inventory, setInventory] = useState<Item[]>([
    { id: '1', name: 'Flare', icon: '🔦', count: 3 },
    { id: '2', name: 'Scanner', icon: '📡', count: 1 },
    { id: '3', name: 'Knife', icon: '🔪', count: 1 }
  ]);
  const [showInventory, setShowInventory] = useState(false);
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const mouseRef = useRef({ locked: false });

  useEffect(() => {
    const TERRAIN_SIZE = 100;
    const terrain: TerrainCell[][] = [];
    
    for (let x = 0; x < TERRAIN_SIZE; x++) {
      terrain[x] = [];
      for (let z = 0; z < TERRAIN_SIZE; z++) {
        const noise1 = Math.sin(x * 0.1) * Math.cos(z * 0.1);
        const noise2 = Math.sin(x * 0.05 + z * 0.05) * 2;
        const noise3 = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 4;
        const height = (noise1 + noise2 + noise3) * 0.5;
        
        let type: TerrainCell['type'] = 'sand';
        const rand = Math.random();
        if (height > 1.5) type = 'rock';
        else if (height > 0.5 && rand > 0.7) type = 'coral';
        else if (rand > 0.85) type = 'kelp';
        
        terrain[x][z] = { height, type };
      }
    }
    
    terrainRef.current = terrain;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const renderRaycast = () => {
      const screenWidth = canvas.width;
      const screenHeight = canvas.height;
      const fov = Math.PI / 3;
      const halfHeight = screenHeight / 2;
      
      const depthFactor = Math.abs(position.y) / 10;
      const baseColor = { r: 5, g: 17, b: 41 };
      const deepColor = { r: 3, g: 8, b: 20 };
      const currentColor = {
        r: Math.floor(baseColor.r + (deepColor.r - baseColor.r) * depthFactor),
        g: Math.floor(baseColor.g + (deepColor.g - baseColor.g) * depthFactor),
        b: Math.floor(baseColor.b + (deepColor.b - baseColor.b) * depthFactor)
      };

      ctx.fillStyle = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`;
      ctx.fillRect(0, 0, screenWidth, halfHeight);
      
      const floorGradient = ctx.createLinearGradient(0, halfHeight, 0, screenHeight);
      floorGradient.addColorStop(0, `rgb(${currentColor.r + 5}, ${currentColor.g + 10}, ${currentColor.b + 20})`);
      floorGradient.addColorStop(1, `rgb(${currentColor.r + 10}, ${currentColor.g + 20}, ${currentColor.b + 40})`);
      ctx.fillStyle = floorGradient;
      ctx.fillRect(0, halfHeight, screenWidth, halfHeight);

      const terrain = terrainRef.current;
      if (terrain.length === 0) return;

      for (let x = 0; x < screenWidth; x += 2) {
        const cameraX = 2 * x / screenWidth - 1;
        const rayDirX = Math.sin(rotation.yaw) + Math.cos(rotation.yaw) * cameraX * Math.tan(fov / 2);
        const rayDirZ = Math.cos(rotation.yaw) - Math.sin(rotation.yaw) * cameraX * Math.tan(fov / 2);

        const rayLength = 20;
        const steps = 40;
        
        for (let step = 1; step < steps; step++) {
          const dist = (step / steps) * rayLength;
          const sampleX = Math.floor(position.x + rayDirX * dist);
          const sampleZ = Math.floor(position.z + rayDirZ * dist);

          if (sampleX < 0 || sampleX >= terrain.length || sampleZ < 0 || sampleZ >= terrain[0].length) continue;

          const cell = terrain[sampleX][sampleZ];
          const terrainHeight = cell.height;

          if (position.y - terrainHeight < 0.5) {
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

            const shade = 1 - (step / steps) * 0.7;
            r = Math.floor((r * shade) * (1 - fog) + currentColor.r * fog);
            g = Math.floor((g * shade) * (1 - fog) + currentColor.g * fog);
            b = Math.floor((b * shade) * (1 - fog) + currentColor.b * fog);

            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x, drawStart, 2, drawHeight);
            break;
          }
        }
      }

      ctx.fillStyle = 'rgba(14, 165, 233, 0.05)';
      for (let i = 0; i < 50; i++) {
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
      vignette.addColorStop(1, `rgba(0, 0, 0, ${0.4 + depthFactor * 0.3})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, screenWidth, screenHeight);
    };

    const animate = () => {
      renderRaycast();
      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position, rotation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: true }));
      if (e.key.toLowerCase() === 'i') setShowInventory(prev => !prev);
      if (e.key.toLowerCase() === 'e') setShowInventory(prev => !prev);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: false }));
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (mouseRef.current.locked) {
        const sensitivity = 0.002;
        setRotation(prev => ({
          yaw: prev.yaw + e.movementX * sensitivity,
          pitch: Math.max(-0.8, Math.min(0.8, prev.pitch + e.movementY * sensitivity))
        }));
      }
    };

    const handleClick = () => {
      if (canvasRef.current && !mouseRef.current.locked) {
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
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const speed = 0.1;
      let newX = position.x;
      let newY = position.y;
      let newZ = position.z;

      const moveX = Math.sin(rotation.yaw);
      const moveZ = Math.cos(rotation.yaw);

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
      if (keys[' ']) newY = Math.min(5, newY + speed * 0.8);
      if (keys['shift']) newY = Math.max(0.5, newY - speed * 0.8);

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
          depth: Math.abs(newY),
          oxygen: Math.max(0, prev.oxygen - 0.05),
          hunger: Math.max(0, prev.hunger - 0.02)
        }));
      }
    }, 16);

    return () => clearInterval(interval);
  }, [keys, position, rotation]);

  useEffect(() => {
    const oxygenInterval = setInterval(() => {
      if (position.y < 2) {
        setStats(prev => ({ ...prev, oxygen: Math.max(0, prev.oxygen - 0.5) }));
      } else {
        setStats(prev => ({ ...prev, oxygen: Math.min(100, prev.oxygen + 2) }));
      }
    }, 1000);

    return () => clearInterval(oxygenInterval);
  }, [position.y]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
      
      <div className="absolute top-6 left-6 space-y-3 pointer-events-none z-10">
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
          <div className="flex items-center gap-2 text-sm">
            <Icon name="Waves" className="text-primary" size={18} />
            <span className="font-semibold">{stats.depth.toFixed(1)}m</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            X: {position.x.toFixed(1)} Z: {position.z.toFixed(1)}
          </div>
        </Card>
      </div>

      <div className="absolute top-6 right-6 pointer-events-none z-10">
        <Card className="bg-card/80 backdrop-blur-sm border-primary/30 p-4">
          <h3 className="text-sm font-bold mb-2 text-primary">CONTROLS</h3>
          <div className="text-xs space-y-1 text-muted-foreground">
            <p>WASD - Move</p>
            <p>SPACE - Up</p>
            <p>SHIFT - Down</p>
            <p>MOUSE - Look</p>
            <p>I/E - Inventory</p>
          </div>
        </Card>
      </div>

      {showInventory && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto z-20">
          <Card className="bg-card/95 border-primary/50 p-6 w-[500px]">
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

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <div className="text-center">
          <div className="w-1 h-1 bg-primary rounded-full mx-auto mb-2 shadow-lg shadow-primary/50" />
          <p className="text-xs text-primary/80 font-medium">Click to enable controls</p>
        </div>
      </div>

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
