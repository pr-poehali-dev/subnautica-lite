import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { PlayerStats, Item, Position, Resource } from '@/types/game';
import { MutableRefObject } from 'react';

interface GameHUDProps {
  position: Position;
  stats: PlayerStats;
  quickSlots: (string | null)[];
  selectedSlot: number;
  inventory: Item[];
  resourcesRef: MutableRefObject<Resource[]>;
  mouseLocked: boolean;
  onSlotSelect: (index: number) => void;
}

export function GameHUD({
  position,
  stats,
  quickSlots,
  selectedSlot,
  inventory,
  resourcesRef,
  mouseLocked
}: GameHUDProps) {
  const resources = resourcesRef.current;
  const nearbyResource = resources.find(r => {
    const dist = Math.sqrt(Math.pow(r.x - position.x, 2) + Math.pow(r.z - position.z, 2));
    return dist < 3 && Math.abs(r.y - position.y) < 2;
  });

  const podDist = Math.sqrt(Math.pow(position.x - 60, 2) + Math.pow(position.z - 60, 2));
  const nearPod = podDist < 3 && Math.abs(position.y) < 2;

  return (
    <>
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
              onClick={() => {}}
              className={`w-14 h-14 ${selectedSlot === idx ? 'bg-cyan-500/90 border-cyan-400' : 'bg-black/70 border-cyan-500/30'} backdrop-blur-sm border-2 rounded flex items-center justify-center text-2xl transition-all hover:scale-105`}
            >
              {item ? item.icon : <span className="text-xs text-muted-foreground">{idx + 1}</span>}
            </button>
          );
        })}
      </div>

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

      {nearbyResource && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <Card className="bg-black/80 backdrop-blur-sm border-cyan-500/40 px-4 py-2">
            <p className="text-sm font-semibold text-cyan-400">Press E to collect</p>
          </Card>
        </div>
      )}

      {nearPod && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <Card className="bg-black/80 backdrop-blur-sm border-cyan-500/40 px-4 py-2">
            <p className="text-sm font-semibold text-cyan-400">Press E to use Fabricator</p>
          </Card>
        </div>
      )}

      {!mouseLocked && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <p className="text-sm text-cyan-400/90 font-medium">Click to start</p>
        </div>
      )}
    </>
  );
}
