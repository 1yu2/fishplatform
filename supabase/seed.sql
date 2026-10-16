-- Optional starting data: the items that were in the old Garden. Run after schema.sql.
-- Learning items get their stars / description refreshed the next time you open them in /studio.

insert into public.learning (kind, repo, url, title, description, importance, status, notes, tags, is_public) values
  ('repo', 'mrdoob/three.js', 'https://github.com/mrdoob/three.js', 'three.js', 'JavaScript 3D Library.', 1, 'learning',
   'Study ShaderMaterial, BufferGeometry attributes and how the examples structure post-processing. Goal: write the homepage effects from scratch.',
   '{WebGL,GLSL}', true),
  ('link', null, 'https://thebookofshaders.com/', 'The Book of Shaders', 'A gentle step-by-step guide through fragment shaders.', 2, 'to_learn',
   'Noise and pattern chapters: they underpin the particle displacement and the video keying.', '{GLSL}', true),
  ('repo', 'withastro/astro', 'https://github.com/withastro/astro', 'Astro', 'The web framework for content-driven websites.', 2, 'to_learn',
   'How content collections, the glob loader and i18n routing work internally.', '{Astro}', true);

insert into public.todos (title, notes, priority, status, started_at, done_at, is_public, project) values
  ('搭好网站的 Studio:待办 / 学习清单 / 写作', '', 1, 'doing', now(), null, true, 'fishbloom-site'),
  ('迁到 Astro,支持英、日、中三语', '', 1, 'done', now(), now(), true, 'fishbloom-site'),
  ('对照参考录屏打磨粒子球 → 六边形的变形', 'Timing of the morph, density on the rim, smoothness when scrolling back.', 2, 'doing', now(), null, true, 'fishbloom-site'),
  ('每天一道 LeetCode', 'Start with arrays and hashing.', 2, 'todo', null, null, true, null),
  ('把飞书和 CSDN 的旧文章搬过来', 'Not urgent.', 3, 'todo', null, null, false, null);
