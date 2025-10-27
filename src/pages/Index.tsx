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

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [position, setPosition] = useState<Position>({ x: 0, y: -5, z: 0 });
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
  const mouseRef = useRef({ x: 0, y: 0, locked: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const drawOcean = () => {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#051129');
      gradient.addColorStop(0.5, '#0A1628');
      gradient.addColorStop(1, '#0D1F3C');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(14, 165, 233, 0.1)';
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 3;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(14, 165, 233, 0.3)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const y = (Math.sin(Date.now() / 1000 + i) * 50) + canvas.height / 2 + i * 100;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < canvas.width; x += 10) {
          const wave = Math.sin((x + Date.now() / 500 + i * 100) / 50) * 20;
          ctx.lineTo(x, y + wave);
        }
        ctx.stroke();
      }

      const podX = canvas.width / 2 + Math.sin(rotation.yaw) * 300 - position.x * 10;
      const podY = canvas.height / 2 + Math.sin(rotation.pitch) * 200 + position.y * 30;
      
      ctx.fillStyle = 'rgba(234, 56, 76, 0.8)';
      ctx.beginPath();
      ctx.ellipse(podX, podY, 60, 80, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'rgba(14, 165, 233, 0.6)';
      ctx.beginPath();
      ctx.ellipse(podX - 15, podY - 20, 15, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(podX + 15, podY - 20, 15, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
      ctx.beginPath();
      ctx.arc(podX, podY + 30, 8, 0, Math.PI * 2);
      ctx.fill();
    };

    const animate = () => {
      drawOcean();
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
          pitch: Math.max(-Math.PI / 3, Math.min(Math.PI / 3, prev.pitch + e.movementY * sensitivity))
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
      const speed = 0.15;
      let newX = position.x;
      let newY = position.y;
      let newZ = position.z;

      if (keys['w']) {
        newX += Math.sin(rotation.yaw) * speed;
        newZ += Math.cos(rotation.yaw) * speed;
      }
      if (keys['s']) {
        newX -= Math.sin(rotation.yaw) * speed;
        newZ -= Math.cos(rotation.yaw) * speed;
      }
      if (keys['a']) {
        newX += Math.cos(rotation.yaw) * speed;
        newZ -= Math.sin(rotation.yaw) * speed;
      }
      if (keys['d']) {
        newX -= Math.cos(rotation.yaw) * speed;
        newZ += Math.sin(rotation.yaw) * speed;
      }
      if (keys[' ']) newY = Math.min(0, newY + speed);
      if (keys['shift']) newY = Math.max(-50, newY - speed);

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
      if (position.y < -2) {
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
      
      <div className="absolute top-6 left-6 space-y-3 pointer-events-none">
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
        </Card>
      </div>

      <div className="absolute top-6 right-6 pointer-events-none">
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
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
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

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="text-center">
          <div className="w-1 h-1 bg-primary rounded-full mx-auto mb-2 shadow-lg shadow-primary/50" />
          <p className="text-xs text-primary/80 font-medium">Click to enable controls</p>
        </div>
      </div>

      {stats.oxygen < 30 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
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
