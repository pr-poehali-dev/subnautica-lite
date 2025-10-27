import { useRef, useEffect, useCallback, MutableRefObject } from 'react';
import { Position, Rotation, Settings, Resource } from '@/types/game';

interface GameCanvasProps {
  position: Position;
  rotation: Rotation;
  settings: Settings;
  resourcesRef: MutableRefObject<Resource[]>;
  auroraImgRef: MutableRefObject<HTMLImageElement | null>;
  handAnimation: number;
  onRender?: () => void;
}

export function GameCanvas({ 
  position, 
  rotation, 
  settings, 
  resourcesRef, 
  auroraImgRef,
  handAnimation 
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
  }, [position, rotation, settings, handAnimation, getTerrainHeight, resourcesRef, auroraImgRef]);

  useEffect(() => {
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
  }, [renderScene]);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
}
