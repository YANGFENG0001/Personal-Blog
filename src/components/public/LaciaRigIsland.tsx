/**
 * Preact island that mounts the Lacia rig.
 *
 * Two variants share one engine (`lib/lacia/rig.ts`):
 *
 *   mascot  the corner companion. No chrome of its own — it listens to the
 *           site mascot's state machine and reports form changes back, so the
 *           speech bubble stays owned by Mascot.astro.
 *   stage   the full display page: figure + device console + quote panel.
 *
 * The skeleton is rendered as a string on the server, so the figure is painted
 * before hydration; the class then adopts the same nodes instead of rebuilding.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { LaciaRig, LACIA_SKINS, canvasCss, laciaActions, laciaMarkup, type LaciaForm, type LaciaSkinId } from '../../lib/lacia/rig';
import { LACIA_FORMS, LACIA_QUOTES } from '../../lib/lacia/lines';
import '../../styles/lacia-rig.css';

interface Props {
  variant?: 'mascot' | 'stage';
  /** Which outfit she wears; both are the same rig. */
  skin?: LaciaSkinId;
  /**
   * Optional components to mount, overriding the outfit's own set. Undefined
   * means "whatever this outfit ships with" — the dress ships nothing, which is
   * why the console and the device panel disappear on it.
   */
  components?: readonly string[];
  /** Cycle the device through its forms while idle. */
  autoForms?: boolean;
}

type Panel = { kind: 'quote' | 'device'; jp: string; cn: string; src?: string; n: number };

/** Per-character reveal: a hard cut per glyph, no JS timer. */
function Chars({ text, delay = 0, speed = 26 }: { text: string; delay?: number; speed?: number }) {
  return (
    <>
      {Array.from(text).map((ch, i) => (
        <span class="ls-ch" style={{ animationDelay: `${delay + i * speed}ms` }}>
          {ch === ' ' ? '\u00a0' : ch}
        </span>
      ))}
    </>
  );
}

export default function LaciaRigIsland({ variant = 'mascot', skin = 'suit', components, autoForms = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<LaciaRig | null>(null);
  const nRef = useRef(0);
  const [form, setForm] = useState<LaciaForm>('coffin');
  const [panel, setPanel] = useState<Panel | null>(null);

  /* The console is built from the mounted components' actions, not from a
     hard-coded form list — an outfit with no device has no device actions, so
     the buttons simply do not exist. */
  const deviceActions = laciaActions(skin, components).filter((a) => a.owner === 'monolith');
  const hasDevice = deviceActions.length > 0;

  /**
   * Show a line and let the rig move her mouth with it.
   *
   * The `delay` / `speed` handed to the rig are the same numbers the typewriter
   * uses below, so the mouth opens on the glyph that is actually appearing. The
   * rig ends the line itself — there is no timer here to drift out of sync.
   */
  const speak = (p: Omit<Panel, 'n'>) => {
    setPanel({ ...p, n: ++nRef.current });
    const quote = p.kind === 'quote';
    rigRef.current?.say([
      { text: p.jp, delay: 0, speed: quote ? 34 : 22 },
      { text: p.cn, delay: quote ? 360 : 220, speed: quote ? 20 : 14 },
    ]);
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
    const scope: EventTarget = host.closest('[data-mascot]') ?? host;

    const rig = new LaciaRig(host, {
      uid: `lacia-${variant}`,
      skin,
      components,
      autoForms,
      reduced,
      onForm: (f, manual) => {
        setForm(f);
        if (manual) {
          const [jp, cn] = LACIA_FORMS[f];
          speak({ kind: 'device', jp, cn });
        }
        if (variant === 'mascot') {
          scope.dispatchEvent(new CustomEvent('lacia:form', { detail: { form: f, manual } }));
        }
      },
    });
    rigRef.current = rig;
    rig.start();

    const onState = (e: Event) => rig.setState((e as CustomEvent).detail);
    const onPoke = () => rig.poke();
    scope.addEventListener('lacia:state', onState);
    scope.addEventListener('lacia:poke', onPoke);

    // The display page opens with her core line.
    const opening =
      variant === 'stage'
        ? setTimeout(() => {
            const q = LACIA_QUOTES[0];
            speak({ kind: 'quote', jp: q.jp, cn: q.cn, src: q.src });
          }, 900)
        : 0;

    return () => {
      if (opening) clearTimeout(opening);
      scope.removeEventListener('lacia:state', onState);
      scope.removeEventListener('lacia:poke', onPoke);
      rig.destroy();
      rigRef.current = null;
    };
  }, [variant, skin, components, autoForms]);

  const markup = laciaMarkup({ uid: `lacia-${variant}`, skin, components });
  /* The canvas size and the transform origin are skin data, so they go on the
     host element as custom properties rather than into the stylesheet. Server-
     rendered with the markup, so the figure is laid out correctly on first
     paint — no measuring, no layout pass after hydration. */
  const css = canvasCss(LACIA_SKINS[skin]) as Record<string, string>;

  /* ── corner mascot ────────────────────────────────────────────────── */
  if (variant === 'mascot') {
    return (
      <div
        class="lr"
        data-variant="mascot"
        data-interactive
        ref={hostRef}
        style={css}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    );
  }

  /* ── display stage ────────────────────────────────────────────────── */
  const pickForm = (f: LaciaForm) => {
    rigRef.current?.setAutoForms(false);
    rigRef.current?.runAction(`monolith:${f}`, true);
  };
  const nextQuote = () => {
    const q = LACIA_QUOTES[nRef.current % LACIA_QUOTES.length];
    rigRef.current?.poke();
    speak({ kind: 'quote', jp: q.jp, cn: q.cn, src: q.src });
  };

  return (
    <div class="ls">
      <aside class="ls-panel" aria-live="polite">
        {panel ? (
          <div class="ls-say" key={panel.n} data-kind={panel.kind}>
            <div class="ls-say-tag">{panel.kind === 'quote' ? 'VOICE' : 'DEVICE'}</div>
            <p class="ls-jp">
              <Chars text={panel.jp} speed={panel.kind === 'quote' ? 34 : 22} />
            </p>
            <p class="ls-cn">
              <Chars text={panel.cn} delay={panel.kind === 'quote' ? 360 : 220} speed={panel.kind === 'quote' ? 20 : 14} />
            </p>
            {panel.src && (
              <p class="ls-src" title={panel.src}>
                {panel.src}
              </p>
            )}
          </div>
        ) : (
          <div class="ls-say is-idle">
            <div class="ls-say-tag">STANDBY</div>
            <p class="ls-cn">
              {hasDevice ? '点击她的身体，听她说话；点击 BLACK MONOLITH，切换形态。' : '点击她的身体，听她说话。这套衣服没有装置。'}
            </p>
          </div>
        )}

        <section class="ls-voices" aria-label="台词录">
          <p class="ls-voices-tag">
            QUOTES
            <span>{String(LACIA_QUOTES.length).padStart(2, '0')}</span>
          </p>
          <ol class="ls-voices-list">
            {LACIA_QUOTES.map((q, i) => (
              <li>
                <span class="ls-voices-n">{String(i + 1).padStart(2, '0')}</span>
                <span class="ls-voices-text">
                  <span class="ls-voices-jp">{q.jp}</span>
                  <span class="ls-voices-cn">{q.cn}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {hasDevice && (
          <nav class="ls-console" aria-label="BLACK MONOLITH 形态">
            <span class="ls-console-label">
              DEVICE
              <br />
              LOCK
            </span>
            {deviceActions.map((a) => {
              const f = a.id.slice(a.id.indexOf(':') + 1) as LaciaForm;
              return (
                <button type="button" class={form === f ? 'is-on' : ''} onClick={() => pickForm(f)} aria-pressed={form === f}>
                  <b>{a.label.name}</b>
                  <i>{a.label.code}</i>
                </button>
              );
            })}
          </nav>
        )}

        <dl class="ls-spec">
          {hasDevice && (
            <>
              <dt>装置</dt>
              <dd>BLACK MONOLITH（黑色秘棺）— 超硬晶体板涂层装甲，内置量子计算机</dd>
              <dt>形态</dt>
              <dd>{deviceActions.map((a) => a.label.name).join(' / ')}</dd>
              <dt>解锁</dt>
              <dd>腰间银色 device lock 四片翼状板，需物主同意</dd>
              <dt>护卫</dt>
              <dd>八爪可分离，其中一支共享感官，作目标护卫</dd>
            </>
          )}
          <dt>组件</dt>
          <dd>
            {hasDevice ? '秘棺 · 锁扣（均可拆下，换装即变）' : '无。这套衣服不带装置，也不带武器'}
          </dd>
          <dt>能力</dt>
          <dd>电子战干扰 · 光学迷彩（超材料）· 分布式演算</dd>
          <dt>表情</dt>
          <dd>
            眉 4 形（平 / 皱 / 扬 / 垂）· 嘴 6 形（闭 / 笑 / 张 / 露齿 / 圆 / 睡）· 口型跟字形 · 视线 + 眨眼 + 脸颊泛红
          </dd>
        </dl>
      </aside>

      <div class="ls-figure">
        <div class="ls-plate">
          <div
            class="lr"
            data-variant="stage"
            data-interactive
            data-clickable
            role="button"
            tabindex={0}
            aria-label={hasDevice ? '蕾西亚 · 24 层刚体骨架立绘。点击换一句台词，点击身后的 BLACK MONOLITH 切换形态。' : '蕾西亚 · 24 层刚体骨架立绘。点击换一句台词。'}
            ref={hostRef}
            style={css}
            onClick={nextQuote}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                nextQuote();
              }
            }}
            dangerouslySetInnerHTML={{ __html: markup }}
          />
        </div>
        <p class="ls-hint">
          <span>24 层刚体骨架 · 关节旋转 + 弹簧驱动</span>
          <span>点击人物 → 台词</span>
          {hasDevice && <span>点击秘棺 → 形态</span>}
        </p>
      </div>
    </div>
  );
}
