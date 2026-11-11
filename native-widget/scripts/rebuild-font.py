"""Keep actual Microsoft YaHei glyphs for widget UI and the existing 20 prepared notes."""
from pathlib import Path
import base64
import json
import re
from fontTools import subset
from fontTools.ttLib import TTFont

integration = Path(__file__).resolve().parents[1]
project = integration.parents[1]
example = integration / 'example'
texts = ''.join(p.read_text() for p in example.rglob('*') if p.suffix in ['.js', '.json', '.xhsml'])
library = json.loads((project / 'public/library/prepared-copy-20.json').read_text())
texts += ''.join(e['platforms']['xhs']['title'] + e['platforms']['xhs']['body'] for e in library['entries'])
texts += '0123456789'
font = TTFont(project / 'public/fonts/yahei.woff2')
missing = {ord(ch) for ch in texts if not ch.isspace()} - set(font.getBestCmap())
if missing:
    raise RuntimeError('Microsoft YaHei is missing required characters: ' + repr(sorted(missing)))
options = subset.Options()
options.flavor = 'woff2'
options.notdef_glyph = True
options.notdef_outline = True
engine = subset.Subsetter(options=options)
engine.populate(text=texts)
engine.subset(font)
font.flavor = 'woff2'
target = integration / 'resources/yahei-ui.woff2'
target.parent.mkdir(exist_ok=True)
font.save(target)
css_file = example / 'app.css'
css = css_file.read_text()
encoded = base64.b64encode(target.read_bytes()).decode('ascii')
css, replaced = re.subn(r'data:font/woff2;base64,[A-Za-z0-9+/=]+', 'data:font/woff2;base64,' + encoded, css)
if replaced != 1:
    raise RuntimeError('Expected exactly one embedded font reference')
css_file.write_text(css)
print('Microsoft YaHei widget subset rebuilt; audit font and embedded CSS match. No WOFF2 file is uploaded.')
