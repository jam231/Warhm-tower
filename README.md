# Spires of Ultramar

A **Warhammer 40,000** Space Marine **Icy Tower**-style vertical arcade climber built in **TypeScript** and **HTML5 Canvas**, engineered as a fast static web app for **Android phones, iPads, and desktop browsers**.

## Features

- **5 Selectable Space Marine Chapters**: Play as **Ultramarines** (default), **Blood Angels**, **Salamanders**, **Imperial Fists**, or **Dark Angels** — each with authentic armor colors, pauldron emblems, eye lenses, thruster flares, and Chapter mottos.
- **Classic Icy Tower Physics**: Horizontal momentum-boosted jumps, high-speed spinning jump-pack leaps, metallic wall rebounds, coyote time, and jump buffering.
- **Chaos Enemies & Imperial Relics**:
  - **Chaos Heretics** (patrolling platforms) & **Chaos Blight Drones** (hovering mid-air): stomp from above or smash through while spinning to **Purge** them for bonus points, upward bounce, and combo extensions!
  - **Purity Seals** (`+60 PTS` + Zeal Combo timer refill), **Iron Halo** (golden protective shield that absorbs a Chaos hit and purges the attacker), and **Jump-Pack Overcharge** (blazing rocket ascent smashing through foes!).
- **Zeal Combo System**: Chain leaps of 2+ floors to earn quadratic score bonuses (`floors²`) and 40K ranks (*WORTHY!*, *FOR MACRAGGE!*, *GLORIOUS!*, *WRATH OF ULTRAMAR!*, *CODEX PERFECT!*, *FOR THE EMPEROR!*).
- **5 Hive Spire Tiers**: Ascend through *Underhive Spire*, *Ecclesiarchy Nave*, *Forge Manufacrum*, *Fortress of Hera*, and *Orbital Apex*, with full-width Bastion milestone decks every 10 floors.
- **Cross-Device Playability**:
  - **Desktop / Laptop**: `A`/`D` or `←`/`→` to move, `Space`/`W`/`↑` to jump, `P`/`Esc` to pause, `R` to quick-restart, `M` to mute.
  - **Android & iPad**: Choose between **Slide Rocker** or **Split Buttons (`◀` `▶`)**, toggle **Auto-Jump**, swap left/right touch sides, and install via PWA manifest — all running on a fixed 60Hz simulation loop for identical physics on 60Hz/90Hz/120Hz displays.
- **Procedural Web Audio**: Built-in synthesized footsteps, jump-pack flares, wall clangs, heretic purge crunches, relic chimes, combo fanfares, and purge alarms.

## Development

```bash
npm install
npm run dev
```

## Test & Build Static Site

```bash
npm test
npm run build
```

The production static bundle is emitted to `dist/` using relative paths (`base: './'`), ready for GitHub Pages, Netlify, Cloudflare Pages, or any static web server.
