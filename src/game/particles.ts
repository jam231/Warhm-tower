import type { FloatingBanner, Particle } from './types';

const MAX_PARTICLES = 260;

export class ParticleSystem {
  public particles: Particle[] = [];
  public banners: FloatingBanner[] = [];

  public reset(): void {
    this.particles = [];
    this.banners = [];
  }

  public spawnJumpBurst(x: number, y: number, isSuper: boolean, coreColor = '#59d2ff'): void {
    const count = isSuper ? 18 : 8;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.7;
      const speed = (isSuper ? 120 : 65) + Math.random() * (isSuper ? 170 : 80);
      this.pushParticle({
        x: x + (Math.random() - 0.5) * 16,
        y,
        vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1),
        vy: Math.sin(angle) * speed * 0.65,
        size: isSuper ? 3.5 + Math.random() * 3 : 2.5 + Math.random() * 2,
        life: isSuper ? 0.36 + Math.random() * 0.22 : 0.22 + Math.random() * 0.14,
        maxLife: 0.58,
        color: isSuper ? (i % 3 === 0 ? '#ffe38a' : coreColor) : '#a8b7cc',
        gravity: isSuper ? 160 : 280,
        shape: isSuper ? 'spark' : 'square',
      });
    }

    if (isSuper) {
      this.pushParticle({
        x,
        y,
        vx: 0,
        vy: 15,
        size: 10,
        life: 0.28,
        maxLife: 0.28,
        color: coreColor,
        gravity: 0,
        shape: 'ring',
      });
    }
  }

  public spawnWallSparks(x: number, y: number, normalX: number): void {
    for (let i = 0; i < 16; i++) {
      const spread = (Math.random() - 0.5) * 1.4;
      const speed = 130 + Math.random() * 220;
      this.pushParticle({
        x,
        y: y + (Math.random() - 0.5) * 18,
        vx: normalX * Math.cos(spread) * speed,
        vy: Math.sin(spread) * speed - 60,
        size: 2.5 + Math.random() * 2.5,
        life: 0.22 + Math.random() * 0.22,
        maxLife: 0.44,
        color: i % 2 === 0 ? '#ffd86b' : '#ff8c3a',
        gravity: 560,
        shape: 'spark',
      });
    }
  }

  public spawnLandingDust(x: number, y: number, accentColor: string): void {
    for (let i = 0; i < 8; i++) {
      const dir = i < 4 ? -1 : 1;
      this.pushParticle({
        x: x + dir * (4 + Math.random() * 10),
        y,
        vx: dir * (45 + Math.random() * 85),
        vy: -20 - Math.random() * 50,
        size: 2.5 + Math.random() * 2.5,
        life: 0.22 + Math.random() * 0.14,
        maxLife: 0.36,
        color: i % 3 === 0 ? accentColor : '#9aa6ba',
        gravity: 300,
        shape: 'square',
      });
    }
  }

  public spawnSkidSpark(x: number, y: number, facing: number): void {
    this.pushParticle({
      x,
      y,
      vx: -facing * (60 + Math.random() * 70),
      vy: -35 - Math.random() * 55,
      size: 2.2,
      life: 0.16 + Math.random() * 0.1,
      maxLife: 0.26,
      color: '#ffce63',
      gravity: 440,
      shape: 'spark',
    });
  }

  public spawnSpinTrail(x: number, y: number, primaryColor = '#4cc6ff'): void {
    this.pushParticle({
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * 35,
      vy: 30 + Math.random() * 40,
      size: 3 + Math.random() * 2.5,
      life: 0.2 + Math.random() * 0.12,
      maxLife: 0.32,
      color: Math.random() < 0.35 ? '#ffd666' : primaryColor,
      gravity: 40,
      shape: 'ember',
    });
  }

  public spawnPurgeExplosion(x: number, y: number, isDrone: boolean): void {
    const count = isDrone ? 24 : 18;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.25;
      const spd = 95 + Math.random() * 210;
      this.pushParticle({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 45,
        size: 3 + Math.random() * 3.5,
        life: 0.34 + Math.random() * 0.24,
        maxLife: 0.58,
        color:
          i % 3 === 0 ? '#ffd86b' : isDrone ? '#62f28e' : '#e03c44',
        gravity: 440,
        shape: i % 2 === 0 ? 'spark' : 'square',
      });
    }
    this.pushParticle({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 10,
      life: 0.26,
      maxLife: 0.26,
      color: '#ffd86b',
      gravity: 0,
      shape: 'ring',
    });
  }

  public spawnRelicBurst(x: number, y: number, color: string): void {
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16;
      const spd = 70 + Math.random() * 120;
      this.pushParticle({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 30,
        size: 3 + Math.random() * 2.5,
        life: 0.35 + Math.random() * 0.2,
        maxLife: 0.55,
        color: i % 2 === 0 ? color : '#fff6d1',
        gravity: 120,
        shape: 'ember',
      });
    }
    this.pushParticle({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 8,
      life: 0.3,
      maxLife: 0.3,
      color,
      gravity: 0,
      shape: 'ring',
    });
  }

  public spawnShieldShatter(x: number, y: number): void {
    for (let i = 0; i < 22; i++) {
      const a = (Math.PI * 2 * i) / 22;
      const spd = 120 + Math.random() * 170;
      this.pushParticle({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 3.5,
        life: 0.38,
        maxLife: 0.38,
        color: i % 2 === 0 ? '#ffe580' : '#ffffff',
        gravity: 220,
        shape: 'spark',
      });
    }
    this.pushParticle({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 16,
      life: 0.32,
      maxLife: 0.32,
      color: '#ffe580',
      gravity: 0,
      shape: 'ring',
    });
  }

  public spawnComboCelebration(x: number, y: number, color: string): void {
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI * 2 * i) / 24 + Math.random() * 0.2;
      const spd = 110 + Math.random() * 190;
      this.pushParticle({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 50,
        size: 3 + Math.random() * 3,
        life: 0.45 + Math.random() * 0.3,
        maxLife: 0.75,
        color: i % 2 === 0 ? color : '#fff2bd',
        gravity: 320,
        shape: 'spark',
      });
    }
  }

  public spawnWorldBanner(
    text: string,
    x: number,
    y: number,
    color: string,
    subtext?: string,
    scale = 1,
  ): void {
    this.banners.push({
      text,
      subtext,
      x,
      y,
      vy: -52,
      life: 1.25,
      maxLife: 1.25,
      color,
      scale,
      isScreenSpace: false,
    });
  }

  public spawnScreenBanner(
    text: string,
    color: string,
    subtext?: string,
    duration = 1.85,
  ): void {
    this.banners.push({
      text,
      subtext,
      x: 0.5,
      y: 0.28,
      vy: -0.025,
      life: duration,
      maxLife: duration,
      color,
      scale: 1.15,
      isScreenSpace: true,
    });
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.shape === 'ring') {
        p.size += 110 * dt;
      }
    }

    for (let i = this.banners.length - 1; i >= 0; i--) {
      const b = this.banners[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.banners.splice(i, 1);
        continue;
      }
      b.y += b.vy * dt;
    }
  }

  private pushParticle(p: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) {
      this.particles.shift();
    }
    this.particles.push(p);
  }
}
