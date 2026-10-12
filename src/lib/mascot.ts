/**
 * The site's original mascot ("看板娘"), drawn as inline SVG so it needs no
 * image request. Simple chibi proportions: big head, short twin-tails,
 * sailor-collar summer uniform, holding a book. Colours are CSS variables so
 * it follows the theme accent in light and dark mode.
 */
export const MASCOT_SVG = `<svg class="mascot-svg" viewBox="0 0 160 200" aria-hidden="true" focusable="false">
  <ellipse class="ms-shadow" cx="80" cy="192" rx="42" ry="6"/>
  <g class="ms-body">
    <!-- twin tails (behind head) -->
    <path class="ms-hair" d="M30 70 q-22 26 -10 64 q6 -20 18 -30 z"/>
    <path class="ms-hair" d="M130 70 q22 26 10 64 q-6 -20 -18 -30 z"/>
    <circle class="ms-ribbon" cx="34" cy="66" r="7"/><circle class="ms-ribbon" cx="126" cy="66" r="7"/>
    <!-- legs & skirt -->
    <rect class="ms-skin" x="62" y="160" width="10" height="24" rx="4"/><rect class="ms-skin" x="88" y="160" width="10" height="24" rx="4"/>
    <path class="ms-shoe" d="M58 182 h18 v6 h-20z M86 182 h18 v6 h-20z"/>
    <path class="ms-skirt" d="M52 146 h56 l10 22 h-76z"/>
    <path class="ms-pleat" d="M66 148 l-4 20 M80 148 v20 M94 148 l4 20"/>
    <!-- torso -->
    <path class="ms-shirt" d="M54 116 q26 -10 52 0 l4 32 h-60z"/>
    <path class="ms-collar" d="M58 116 q22 18 44 0 l-6 14 q-16 8 -32 0z"/>
    <path class="ms-scarf" d="M76 128 l4 8 l4 -8 l-4 -3z"/>
    <!-- arms holding a book -->
    <path class="ms-skin" d="M52 122 q-10 16 0 28 l8 -4 q-6 -10 0 -20z"/>
    <path class="ms-skin" d="M108 122 q10 16 0 28 l-8 -4 q6 -10 0 -20z"/>
    <g class="ms-book"><path class="ms-cover" d="M58 136 l22 6 l22 -6 v18 l-22 6 l-22 -6z"/><path class="ms-pages" d="M80 142 v18"/></g>
    <!-- head -->
    <g class="ms-head">
      <circle class="ms-skin" cx="80" cy="74" r="40"/>
      <path class="ms-hair" d="M40 76 q-2 -46 40 -48 q42 2 40 48 q-8 -22 -22 -26 q-6 12 -20 14 q4 -8 2 -14 q-14 14 -40 26z"/>
      <path class="ms-hair-hi" d="M58 40 q10 -6 22 -6"/>
      <!-- eyes (blink) -->
      <g class="ms-eyes">
        <ellipse class="ms-eye" cx="64" cy="82" rx="6.5" ry="8"/><ellipse class="ms-eye" cx="96" cy="82" rx="6.5" ry="8"/>
        <circle class="ms-shine" cx="66" cy="79" r="2.3"/><circle class="ms-shine" cx="98" cy="79" r="2.3"/>
      </g>
      <ellipse class="ms-blush" cx="56" cy="96" rx="6" ry="3"/><ellipse class="ms-blush" cx="104" cy="96" rx="6" ry="3"/>
      <path class="ms-mouth" d="M75 98 q5 5 10 0"/>
      <path class="ms-clip" d="M106 50 l8 -4 l2 6z"/>
    </g>
  </g>
</svg>`;

export const MASCOT_LINES = [
  '今天也一起读一点吧。',
  '累了就看看窗外的云。',
  '这篇写得真好，慢慢读～',
  '记得喝水哦。',
  '有不懂的地方，记下来就好。',
  '我在这里陪你。',
];
