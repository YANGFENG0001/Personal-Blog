/**
 * Always loaded and tiny. Decides which optional visual layers to load:
 * animated background canvas, cursor trail, and "rich" motion extras.
 * Each heavy part is a separate dynamic import, so pages without those
 * settings ship almost no extra JS.
 */

export function motionLevel(): 'off' | 'minimal' | 'normal' | 'rich' {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off';
  return (document.documentElement.dataset.motion as 'off' | 'minimal' | 'normal' | 'rich') ?? 'normal';
}

let started = false;

export function initAmbientLayer(): void {
  if (started) return;
  started = true;
  const body = document.body;
  const level = motionLevel();
  const effect = body.dataset.bgEffect;
  const intensity = (body.dataset.bgIntensity as 'low' | 'medium' | 'high') ?? 'medium';
  if (effect) {
    const scene = document.documentElement.dataset.bg === 'scene';
    // Scene effects are only worth their cost on screens wide enough to show the scene well.
    if (scene && innerWidth >= 480) void import('./scene-effects').then((m) => m.startSceneEffect(effect, { intensity, animate: level !== 'off' }));
    else if (!scene) void import('./bg-effects').then((m) => m.startBackground(effect, { intensity, animate: level !== 'off' }));
  }
  const fine = matchMedia('(pointer: fine)').matches;
  if ('trail' in body.dataset && fine && level !== 'off') void import('./cursor-trail').then((m) => m.startTrail());
  if (level === 'rich') void import('./rich-motion').then((m) => m.startRichMotion());
}
