import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import Icon from '@/components/ui/icon';
import { Settings } from '@/types/game';

interface SettingsMenuProps {
  settings: Settings;
  onUpdateSettings: (settings: Settings) => void;
  onClose: () => void;
}

export function SettingsMenu({ settings, onUpdateSettings, onClose }: SettingsMenuProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#051129] via-[#0A1628] to-[#0D1F3C] flex items-center justify-center p-4">
      <Card className="bg-card/90 backdrop-blur-md border-primary/40 p-8 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-primary">Settings</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
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
                  onClick={() => onUpdateSettings({ ...settings, graphics: level })}
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
              onValueChange={([value]) => onUpdateSettings({ ...settings, volume: value })}
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
              onValueChange={([value]) => onUpdateSettings({ ...settings, fov: value * Math.PI / 180 })}
              min={60}
              max={120}
              step={5}
            />
          </div>
        </div>

        <Button className="w-full mt-6" onClick={onClose}>
          <Icon name="Check" className="mr-2" size={20} />
          Apply
        </Button>
      </Card>
    </div>
  );
}
