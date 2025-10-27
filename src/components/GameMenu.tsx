import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { GameState } from '@/types/game';

interface GameMenuProps {
  onStartGame: () => void;
  onOpenSettings: () => void;
}

export function GameMenu({ onStartGame, onOpenSettings }: GameMenuProps) {
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
            onClick={onStartGame}
          >
            <Icon name="Play" className="mr-2" size={24} />
            Start Game
          </Button>
          <Button 
            className="w-full text-lg py-6" 
            variant="secondary"
            onClick={onOpenSettings}
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
