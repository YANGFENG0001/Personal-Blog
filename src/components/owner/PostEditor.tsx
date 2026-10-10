import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api, errMsg, move, toast } from '../../lib/client';
import { hiddenReason } from '../../server/visibility';
import type { PostFull } from '../../server/services/posts';
import type { Template } from '../../server/services/config';

interface SiteOpt {
  id: string;
  name: string;
  visibility: string;
  categories: { id: string; name: string; visibility: string }[];
}

interface Props {
  post: PostFull | null;
  sites: SiteOpt[];
  templates: Template[];
  progressOptions: string[];
  allTags: string[];
  initialTemplate?: string | null;
  defaultCategoryId?: string | null;
}

type Link = { label: string; url: string; kind: string };
type Draft = {
  title: string;
  slug: string;
  summary: string;
  categoryId: string;
  tags: string[];
  visibility: 'public' | 'private';
  templateId: string | null;
  progress: string;
  progressPublic: boolean;
  bodyMd: string;
  reflectionMd: string;
  reflectionPublic: boolean;
  coverUrl: string;
  featured: boolean;
  links: Link[];
  publishedAt: string;
};

const KINDS: [string, string][] = [
  ['paper', '论文'], ['code', '代码'], ['project', '项目'], ['docs', '文档'], ['blog', '博客'], ['dataset', '数据集'], ['other', '其他'],
];

function fromPost(p: PostFull | null, defaultCat: string, tpl?: Template): Draft {
  if (p) {
    return {
      title: p.title, slug: p.slug, summary: p.summary, categoryId: p.categoryId, tags: p.tags, visibility: p.visibility,
      templateId: p.templateId, progress: p.progress ?? '', progressPublic: p.progressPublic, bodyMd: p.bodyMd,
      reflectionMd: p.reflectionMd, reflectionPublic: p.reflectionPublic, coverUrl: p.coverUrl ?? '', featured: p.featured,
      links: p.links.map(({ label, url, kind }) => ({ label, url, kind })), publishedAt: p.publishedAt ? toLocalInput(p.publishedAt) : '',
    };
  }
  return {
    title: '', slug: '', summary: '', categoryId: defaultCat, tags: [], visibility: 'public', templateId: tpl?.id ?? 'free',
    progress: tpl?.defaultProgress ?? '', progressPublic: true, bodyMd: tpl?.bodyMd ?? '', reflectionMd: tpl?.reflectionMd ?? '',
    reflectionPublic: false, coverUrl: '', featured: false, links: [], publishedAt: '',
  };
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

const DRAFT_KEY = (id: string | null) => `fn-editor-draft:${id ?? 'new'}`;

export default function PostEditor({ post: initialPost, sites, templates, progressOptions, allTags, initialTemplate, defaultCategoryId }: Props) {
  const firstCat = defaultCategoryId || sites.flatMap((s) => s.categories)[0]?.id || '';
  const tpl = templates.find((t) => t.id === initialTemplate);
  const [post, setPost] = useState<PostFull | null>(initialPost);
  const [d, setD] = useState<Draft>(() => fromPost(initialPost, firstCat, tpl));
  const [saved, setSaved] = useState<string>(() => JSON.stringify(fromPost(initialPost, firstCat, tpl)));
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'split' | 'write' | 'preview'>('split');
  const [preview, setPreview] = useState<{ html: string; reflection: string }>({ html: post?.bodyHtml ?? '', reflection: post?.reflectionHtml ?? '' });
  const [tagInput, setTagInput] = useState('');
  const [importInfo, setImportInfo] = useState<string[] | null>(null);
  const [restorable, setRestorable] = useState<Draft | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(d) !== saved;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const currentTpl = templates.find((t) => t.id === d.templateId);
  const progressChoices = useMemo(() => {
    const own = currentTpl?.progressOptions?.length ? currentTpl.progressOptions : progressOptions;
    return d.progress && !own.includes(d.progress) ? [...own, d.progress] : own;
  }, [currentTpl, progressOptions, d.progress]);

  const cat = sites.flatMap((s) => s.categories.map((c) => ({ ...c, site: s }))).find((c) => c.id === d.categoryId);
  const visibilityWarning =
    d.visibility === 'public' && cat
      ? cat.site.visibility !== 'public'
        ? `所属分站「${cat.site.name}」未公开，发布后游客仍看不到。`
        : cat.visibility !== 'public'
          ? `所属栏目「${cat.name}」未公开，发布后游客仍看不到。`
          : null
      : null;

  // Local crash-safety: keep an unsaved copy in localStorage.
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY(post?.id ?? null));
    if (raw) {
      try {
        const local = JSON.parse(raw) as { at: number; draft: Draft };
        const serverTime = post ? Date.parse(post.updatedAt) : 0;
        if (local.at > serverTime && JSON.stringify(local.draft) !== saved) setRestorable(local.draft);
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => localStorage.setItem(DRAFT_KEY(post?.id ?? null), JSON.stringify({ at: Date.now(), draft: d })), 800);
    return () => clearTimeout(t);
  }, [d, dirty, post?.id]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    addEventListener('beforeunload', h);
    return () => removeEventListener('beforeunload', h);
  }, [dirty]);

  // Debounced server-side preview (same pipeline as public pages).
  useEffect(() => {
    if (view === 'write') return;
    const t = setTimeout(async () => {
      try {
        const [b, r] = await Promise.all([
          api.post<{ html: string }>('/api/owner/posts/preview', { markdown: d.bodyMd }),
          d.reflectionMd.trim() ? api.post<{ html: string }>('/api/owner/posts/preview', { markdown: d.reflectionMd }) : Promise.resolve({ html: '' }),
        ]);
        setPreview({ html: b.html, reflection: r.html });
      } catch {
        /* keep previous preview */
      }
    }, 450);
    return () => clearTimeout(t);
  }, [d.bodyMd, d.reflectionMd, view]);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save('save');
      }
    };
    addEventListener('keydown', h);
    return () => removeEventListener('keydown', h);
  });

  async function save(action: 'save' | 'publish' | 'unpublish' | 'archive') {
    if (!d.title.trim()) return toast('请填写标题', 'error');
    if (!d.categoryId) return toast('请选择栏目', 'error');
    const badLink = d.links.find((l) => !l.label.trim() || !/^https?:\/\//i.test(l.url.trim()));
    if (badLink) return toast('相关链接需要名称和 http(s):// 地址', 'error');
    setBusy(true);
    try {
      const payload = {
        ...d,
        action,
        slug: d.slug.trim() || undefined,
        progress: d.progress || null,
        coverUrl: d.coverUrl.trim() || null,
        links: d.links.map((l) => ({ ...l, label: l.label.trim(), url: l.url.trim() })),
        publishedAt: d.publishedAt ? new Date(d.publishedAt).toISOString() : undefined,
      };
      const res = post ? await api.put<PostFull>(`/api/owner/posts/${post.id}`, payload) : await api.post<PostFull>('/api/owner/posts', payload);
      localStorage.removeItem(DRAFT_KEY(post?.id ?? null));
      const next = fromPost(res, firstCat);
      setPost(res);
      setD(next);
      setSaved(JSON.stringify(next));
      toast({ save: '已保存', publish: '已发布', unpublish: '已撤回为草稿', archive: '已归档' }[action]);
      if (!post) history.replaceState(null, '', `/owner/editor/${res.id}`);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!post || !confirm(`永久删除「${post.title}」？此操作不可撤销。`)) return;
    try {
      await api.del(`/api/owner/posts/${post.id}`);
      localStorage.removeItem(DRAFT_KEY(post.id));
      setSaved(JSON.stringify(d));
      location.href = '/owner/posts';
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const hasContent = d.bodyMd.trim() || d.reflectionMd.trim();
    if (hasContent && !confirm(`切换到「${t.name}」模板会覆盖当前正文和心得，确定吗？\n（选择“取消”则只更改模板标记，不改动内容）`)) {
      set('templateId', id);
      return;
    }
    setD((x) => ({ ...x, templateId: id, bodyMd: t.bodyMd, reflectionMd: t.reflectionMd, progress: t.defaultProgress ?? x.progress }));
  }

  function addTag(raw: string) {
    const parts = raw.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean);
    if (!parts.length) return;
    setD((x) => ({ ...x, tags: [...new Set([...x.tags, ...parts])].slice(0, 20) }));
    setTagInput('');
  }

  function insert(before: string, after = '', placeholder = '') {
    const ta = bodyRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    set('bodyMd', next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  }

  async function importMd(file: File) {
    if (file.size > 2 * 1024 * 1024) return toast('文件不能超过 2MB', 'error');
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await api.upload<{ title: string; summary: string; tags: string[]; date: string | null; slug: string | null; body: string; warnings: string[] }>(
        '/api/owner/posts/import',
        form,
      );
      if ((d.bodyMd.trim() || d.title.trim()) && !confirm('导入会替换当前标题、摘要、标签和正文，确定吗？')) return;
      setD((x) => ({
        ...x,
        title: r.title,
        summary: r.summary || x.summary,
        tags: r.tags.length ? r.tags : x.tags,
        slug: !post && r.slug ? r.slug : x.slug,
        publishedAt: r.date ? toLocalInput(r.date) : x.publishedAt,
        bodyMd: r.body,
      }));
      setImportInfo(r.warnings);
      toast('已导入到编辑器（尚未保存，也不会自动发布）');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function uploadImage(file: File) {
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await api.upload<{ url: string }>('/api/owner/uploads', form);
      insert(`![${file.name.replace(/\.[^.]+$/, '')}](${r.url})`, '', '');
      toast('图片已上传');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      if (imgRef.current) imgRef.current.value = '';
    }
  }

  const status = post?.status ?? 'draft';
  const statusLabel = { draft: '草稿', published: '已发布', archived: '已归档' }[status];
  const hidden = post
    ? hiddenReason({
        status: post.status, visibility: post.visibility, publishedAt: post.publishedAt,
        categoryVisibility: post.categoryVisibility, siteVisibility: post.siteVisibility,
      })
    : null;
  const publicUrl = post && !hidden ? `/${post.siteSlug}/${post.categorySlug}/${post.slug}` : null;

  return (
    <div class="ed">
      {restorable && (
        <div class="ed-restore" role="alert">
          发现一份比服务器更新的本地未保存草稿。
          <button class="btn btn-sm btn-primary" type="button" onClick={() => { setD(restorable); setRestorable(null); }}>恢复</button>
          <button class="btn btn-sm" type="button" onClick={() => { localStorage.removeItem(DRAFT_KEY(post?.id ?? null)); setRestorable(null); }}>丢弃</button>
        </div>
      )}

      <div class="ed-bar">
        <div class="row">
          <span class={`pill ${status === 'published' ? 'pill-accent' : status === 'archived' ? '' : 'pill-warn'}`}>{statusLabel}</span>
          {post && (hidden ? <span class="faint small">游客不可见：{hidden}</span> : publicUrl && <a class="small" href={publicUrl} target="_blank" rel="noopener">查看公开页面 ↗</a>)}
          {dirty ? <span class="faint small">● 未保存</span> : post && <span class="faint small">已保存</span>}
        </div>
        <div class="row">
          <div class="ed-views" role="group" aria-label="视图">
            {(['write', 'split', 'preview'] as const).map((v) => (
              <button type="button" class={`btn btn-sm ${view === v ? 'btn-primary' : ''}`} aria-pressed={view === v} onClick={() => setView(v)}>
                {{ write: '写作', split: '分栏', preview: '预览' }[v]}
              </button>
            ))}
          </div>
          <button class="btn" type="button" disabled={busy} onClick={() => save('save')} title="Ctrl/⌘ + S">保存</button>
          {status === 'published' ? (
            <>
              <button class="btn btn-primary" type="button" disabled={busy} onClick={() => save('publish')}>更新发布</button>
              <button class="btn" type="button" disabled={busy} onClick={() => save('unpublish')}>撤回</button>
            </>
          ) : (
            <button class="btn btn-primary" type="button" disabled={busy} onClick={() => save('publish')}>发布</button>
          )}
        </div>
      </div>

      <div class="ed-grid">
        <div class="ed-main">
          <input class="ed-title" placeholder="标题" value={d.title} onInput={(e) => set('title', e.currentTarget.value)} aria-label="标题" maxLength={200} />
          <textarea class="ed-summary" rows={2} placeholder="摘要（可选，显示在列表与搜索结果中）" value={d.summary} onInput={(e) => set('summary', e.currentTarget.value)} aria-label="摘要" maxLength={1000} />

          <div class={`ed-panes ed-${view}`}>
            {view !== 'preview' && (
              <div class="ed-pane">
                <div class="ed-toolbar" role="toolbar" aria-label="Markdown 工具">
                  <button type="button" onClick={() => insert('## ', '', '小标题')} title="标题">H</button>
                  <button type="button" onClick={() => insert('**', '**', '粗体')} title="粗体"><b>B</b></button>
                  <button type="button" onClick={() => insert('*', '*', '斜体')} title="斜体"><i>I</i></button>
                  <button type="button" onClick={() => insert('`', '`', 'code')} title="行内代码">{'</>'}</button>
                  <button type="button" onClick={() => insert('\n```python\n', '\n```\n', '# code')} title="代码块">{'{ }'}</button>
                  <button type="button" onClick={() => insert('$', '$', 'x^2')} title="行内公式">∑</button>
                  <button type="button" onClick={() => insert('\n$$\n', '\n$$\n', '\\frac{a}{b}')} title="块级公式">∫</button>
                  <button type="button" onClick={() => insert('[', '](https://)', '链接文字')} title="链接">🔗</button>
                  <button type="button" onClick={() => insert('\n> ', '', '引用')} title="引用">❝</button>
                  <button type="button" onClick={() => insert('\n| 列 1 | 列 2 |\n| --- | --- |\n| ', ' |  |\n', '内容')} title="表格">▦</button>
                  <button type="button" onClick={() => insert('\n- [ ] ', '', '待办')} title="任务列表">☑</button>
                  <button type="button" onClick={() => imgRef.current?.click()} title="上传图片">🖼</button>
                  <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" hidden onChange={(e) => e.currentTarget.files?.[0] && uploadImage(e.currentTarget.files[0])} />
                </div>
                <textarea
                  ref={bodyRef}
                  class="ed-body"
                  value={d.bodyMd}
                  onInput={(e) => set('bodyMd', e.currentTarget.value)}
                  placeholder="用 Markdown 写作。支持 GFM 表格、代码高亮、$LaTeX$ 公式……"
                  aria-label="正文 Markdown"
                  spellcheck={false}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && !e.shiftKey) {
                      e.preventDefault();
                      insert('  ');
                    }
                  }}
                  onPaste={(e) => {
                    const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
                    if (f) {
                      e.preventDefault();
                      void uploadImage(f);
                    }
                  }}
                />
                <div class="ed-count faint">{d.bodyMd.length} 字符</div>
              </div>
            )}
            {view !== 'write' && (
              <div class="ed-pane ed-preview">
                <div class="prose" dangerouslySetInnerHTML={{ __html: preview.html || '<p class="faint">预览会显示在这里。</p>' }} />
              </div>
            )}
          </div>

          <section class="panel ed-reflection">
            <div class="panel-head">
              <div>
                <h2>我的心得</h2>
                <p class="panel-sub">独立于正文的思考、疑问与体会。默认仅自己可见。</p>
              </div>
              <label class="switch">
                <input type="checkbox" checked={d.reflectionPublic} onChange={(e) => set('reflectionPublic', e.currentTarget.checked)} />
                <span class="track" />
                <span>随文章公开</span>
              </label>
            </div>
            <textarea class="input" rows={5} value={d.reflectionMd} onInput={(e) => set('reflectionMd', e.currentTarget.value)} placeholder="阅读感想、技术理解、尚未解决的问题……（支持 Markdown）" aria-label="心得" />
            {view !== 'write' && preview.reflection && <div class="prose ed-ref-preview" dangerouslySetInnerHTML={{ __html: preview.reflection }} />}
          </section>
        </div>

        <aside class="ed-side">
          <section class="panel">
            <h2>发布设置</h2>
            <div class="field">
              <label for="ed-cat">分站 / 栏目</label>
              <select id="ed-cat" value={d.categoryId} onChange={(e) => set('categoryId', e.currentTarget.value)}>
                {sites.map((s) => (
                  <optgroup label={`${s.name}${s.visibility === 'public' ? '' : '（未公开）'}`}>
                    {s.categories.map((c) => (
                      <option value={c.id}>{c.name}{c.visibility === 'public' ? '' : '（未公开）'}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div class="field">
              <span class="label">可见性</span>
              <div class="row">
                <label class="check"><input type="radio" name="vis" checked={d.visibility === 'public'} onChange={() => set('visibility', 'public')} /> 发布后公开</label>
                <label class="check"><input type="radio" name="vis" checked={d.visibility === 'private'} onChange={() => set('visibility', 'private')} /> 仅自己可见</label>
              </div>
              {visibilityWarning && <p class="hint warn">{visibilityWarning}</p>}
              <p class="hint">“发布”不等于公开：只有 已发布 + 公开 + 分站与栏目公开 的文章才对游客可见。</p>
            </div>
            <div class="field">
              <label for="ed-date">发布时间（可选）</label>
              <input id="ed-date" type="datetime-local" value={d.publishedAt} onInput={(e) => set('publishedAt', e.currentTarget.value)} />
              <p class="hint">留空则在首次发布时自动记录。设置为将来时间即为定时发布。</p>
            </div>
            <div class="field">
              <label for="ed-slug">URL 名称</label>
              <input id="ed-slug" value={d.slug} onInput={(e) => set('slug', e.currentTarget.value.toLowerCase())} placeholder="自动生成" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
              <p class="hint">修改后旧链接会自动跳转到新地址。</p>
            </div>
            <label class="switch"><input type="checkbox" checked={d.featured} onChange={(e) => set('featured', e.currentTarget.checked)} /><span class="track" /><span>精选（首页展示）</span></label>
          </section>

          <section class="panel">
            <h2>模板与进度</h2>
            <div class="field">
              <label for="ed-tpl">模板</label>
              <select id="ed-tpl" value={d.templateId ?? ''} onChange={(e) => applyTemplate(e.currentTarget.value)}>
                {templates.map((t) => <option value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div class="field">
              <label for="ed-prog">进度状态</label>
              <select id="ed-prog" value={d.progress} onChange={(e) => set('progress', e.currentTarget.value)}>
                <option value="">（无）</option>
                {progressChoices.map((p) => <option value={p}>{p}</option>)}
              </select>
            </div>
            <label class="switch"><input type="checkbox" checked={d.progressPublic} onChange={(e) => set('progressPublic', e.currentTarget.checked)} /><span class="track" /><span>在公开文章中显示进度</span></label>
          </section>

          <section class="panel">
            <h2>标签</h2>
            <div class="ed-tags">
              {d.tags.map((t) => (
                <span class="pill ed-tag">
                  {t}
                  <button type="button" aria-label={`移除标签 ${t}`} onClick={() => set('tags', d.tags.filter((x) => x !== t))}>×</button>
                </span>
              ))}
            </div>
            <input
              class="input"
              list="ed-tag-list"
              placeholder="输入后回车添加"
              value={tagInput}
              onInput={(e) => setTagInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              onBlur={() => addTag(tagInput)}
              aria-label="添加标签"
            />
            <datalist id="ed-tag-list">{allTags.map((t) => <option value={t} />)}</datalist>
          </section>

          <section class="panel">
            <div class="panel-head">
              <h2>相关链接</h2>
              <button class="btn btn-sm" type="button" onClick={() => set('links', [...d.links, { label: '', url: 'https://', kind: 'other' }])}>添加</button>
            </div>
            <p class="panel-sub">有链接时，公开文章右侧会用“相关资料”替换默认侧栏。</p>
            {d.links.length === 0 && <p class="empty-note">暂无链接。</p>}
            <ol class="ed-links">
              {d.links.map((l, i) => (
                <li>
                  <div class="row">
                    <select class="select ed-kind" value={l.kind} onChange={(e) => set('links', d.links.map((x, j) => (j === i ? { ...x, kind: e.currentTarget.value } : x)))} aria-label="链接类型">
                      {KINDS.map(([v, n]) => <option value={v}>{n}</option>)}
                    </select>
                    <input class="input" placeholder="名称" value={l.label} onInput={(e) => set('links', d.links.map((x, j) => (j === i ? { ...x, label: e.currentTarget.value } : x)))} aria-label="链接名称" />
                  </div>
                  <input class={`input ${l.url && !/^https?:\/\/.+/i.test(l.url) ? 'invalid' : ''}`} placeholder="https://" value={l.url} onInput={(e) => set('links', d.links.map((x, j) => (j === i ? { ...x, url: e.currentTarget.value } : x)))} aria-label="链接地址" />
                  <div class="row ed-link-actions">
                    <button type="button" class="btn btn-sm btn-ghost" disabled={i === 0} onClick={() => set('links', move(d.links, i, i - 1))} aria-label="上移">↑</button>
                    <button type="button" class="btn btn-sm btn-ghost" disabled={i === d.links.length - 1} onClick={() => set('links', move(d.links, i, i + 1))} aria-label="下移">↓</button>
                    <button type="button" class="btn btn-sm btn-ghost btn-danger" onClick={() => set('links', d.links.filter((_, j) => j !== i))}>删除</button>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section class="panel">
            <h2>封面与导入</h2>
            <div class="field">
              <label for="ed-cover">封面图片地址（可选）</label>
              <input id="ed-cover" value={d.coverUrl} onInput={(e) => set('coverUrl', e.currentTarget.value)} placeholder="/uploads/... 或 https://..." />
            </div>
            <button class="btn" type="button" onClick={() => fileRef.current?.click()}>导入 .md 文件</button>
            <input ref={fileRef} type="file" accept=".md,.markdown,text/markdown" hidden onChange={(e) => e.currentTarget.files?.[0] && importMd(e.currentTarget.files[0])} data-testid="md-import" />
            <p class="hint">读取 front matter（title / tags / date / summary / slug），导入后进入编辑器，不会自动发布。</p>
            {importInfo && importInfo.length > 0 && (
              <ul class="hint warn">{importInfo.map((w) => <li>{w}</li>)}</ul>
            )}
          </section>

          {post && (
            <section class="panel danger-zone">
              <h2>更多操作</h2>
              <div class="row">
                {status !== 'archived' && <button class="btn btn-sm" type="button" onClick={() => save('archive')}>归档</button>}
                <button class="btn btn-sm btn-danger" type="button" onClick={remove}>删除文章</button>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
