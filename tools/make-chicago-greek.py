# Adds the Greek ChicagoFLF never had, drawn on its own grid, and writes
# fonts/ChicagoGreek.ttf. ChicagoFLF (public domain, see
# fonts/README.ChicagoFLF) carries only the capitals that look like Latin
# ones — ΑΒΕΖΗΙΚΜΝΟΠΡΤΥΧΩ and μ, π — so Greek text, a quarter of what Ekybe
# carries, fell back to the system font letter by letter.
#
# The grid: 1000 units to the em, one 1984 pixel = 1000/12. x-height 7 pixels,
# capitals and ascenders 9, descenders 2. Upright strokes are two pixels wide,
# horizontal ones one; outer corners are rounded with a two-pixel radius and
# counters are square. Glyphs below are written in those pixels.
#
#   uv run --with fonttools --with pyclipper --no-project \
#     python tools/make-chicago-greek.py fonts/source/ChicagoFLF.ttf fonts/ChicagoGreek.ttf
import sys
import pyclipper
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib.tables._g_l_y_f import GlyphComponent

PX = 1000 / 12
S = 4  # clipper works in integers: quarter-unit precision


def pt(x, y):
    return (round(x * PX * S), round(y * PX * S))


def rect(x0, y0, x1, y1, round_=''):
    """A rectangle in pixels; `round_` names the corners to round, a=top-left
    then clockwise (b top-right, c bottom-right, d bottom-left)."""
    r = 2
    corners = {
        'a': ((x0, y1), (x0, y1 - r), (x0 + r, y1)),
        'b': ((x1, y1), (x1 - r, y1), (x1, y1 - r)),
        'c': ((x1, y0), (x1, y0 + r), (x1 - r, y0)),
        'd': ((x0, y0), (x0 + r, y0), (x0, y0 + r)),
    }
    out = []
    for k in 'abcd':
        corner, p0, p2 = corners[k]
        if k in round_:
            # the quadratic ChicagoFLF uses, flattened
            for i in range(9):
                t = i / 8
                x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * corner[0] + t * t * p2[0]
                y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * corner[1] + t * t * p2[1]
                out.append(pt(x, y))
        else:
            out.append(pt(*corner))
    return [out]


def poly(*pts):
    return [[pt(x, y) for x, y in pts]]


class Flat(BasePen):
    def __init__(self, gs):
        super().__init__(gs)
        self.paths = []

    def _moveTo(self, p):
        self.paths.append([p])

    def _lineTo(self, p):
        self.paths[-1].append(p)

    def _qCurveToOne(self, p1, p2):
        p0 = self.paths[-1][-1]
        for i in range(1, 9):
            t = i / 8
            self.paths[-1].append(tuple((1 - t) ** 2 * a + 2 * (1 - t) * t * b + t * t * c for a, b, c in zip(p0, p1, p2)))

    def _curveToOne(self, p1, p2, p3):
        p0 = self.paths[-1][-1]
        for i in range(1, 11):
            t = i / 10
            m = 1 - t
            self.paths[-1].append(tuple(m ** 3 * a + 3 * m * m * t * b + 3 * m * t * t * c + t ** 3 * d for a, b, c, d in zip(p0, p1, p2, p3)))

    def _closePath(self):
        pass

    def _endPath(self):
        pass


def borrowed(name, transform=(1, 0, 0, 1, 0, 0)):
    """An existing glyph's outline, optionally transformed (pixels for dx, dy)."""
    a, b, c, d, dx, dy = transform
    pen = Flat(GS)
    GS[name].draw(TransformPen(pen, (a, b, c, d, dx * PX, dy * PX)))
    return [[(round(x * S), round(y * S)) for x, y in p] for p in pen.paths]


def clip(subj, clipp, op):
    c = pyclipper.Pyclipper()
    if subj:
        c.AddPaths(subj, pyclipper.PT_SUBJECT, True)
    if clipp:
        c.AddPaths(clipp, pyclipper.PT_CLIP, True)
    return c.Execute(op, pyclipper.PFT_NONZERO, pyclipper.PFT_NONZERO)


def glyph(add, cut=(), keep=None):
    shape = []
    for part in add:
        shape = clip(shape, part, pyclipper.CT_UNION) if shape else clip(part, [], pyclipper.CT_UNION)
    for part in cut:
        shape = clip(shape, part, pyclipper.CT_DIFFERENCE)
    if keep:
        shape = clip(shape, keep, pyclipper.CT_INTERSECTION)
    return shape


src, out = sys.argv[1], sys.argv[2]
font = TTFont(src)
GS = font.getGlyphSet()

# ---- lower case ---------------------------------------------------------
# (shape, advance in pixels)
L = {}
L['alpha'] = (glyph([rect(1, 0, 7, 7, 'ad'), rect(7, 0, 8, 1), rect(7, 6, 8, 7)], [rect(3, 1, 5, 6)]), 9)
L['beta'] = (glyph([rect(1, -2, 3, 9, 'a'), rect(1, 4, 6, 9, 'ab'), rect(1, 0, 7, 5, 'bc')],
                   [rect(3, 5, 4, 8), rect(3, 1, 5, 4)]), 8)
L['gamma'] = (glyph([poly((1, 7), (3, 7), (3, 4), (4, 3), (5, 4), (5, 7), (7, 7), (7, 3), (5, 1), (5, -2), (3, -2), (3, 1), (1, 3))]), 8)
L['delta'] = (glyph([rect(1, 0, 7, 6, 'abcd'), poly((3, 5), (5, 5), (3, 8), (1, 8)), rect(1, 8, 7, 9, 'a')], [rect(3, 1, 5, 5)]), 8)
L['epsilon'] = (glyph([rect(1, 0, 7, 7, 'abcd')], [rect(3, 1, 7, 3), rect(3, 4, 7, 6), rect(5, 3, 7, 4)]), 8)
# ζ: a top bar, the diagonal back down to the left, the bowl's floor and a
# tail below the line. The first one, a stem with a hook, read as a bracket.
L['zeta'] = (glyph([rect(2, 8, 7, 9), poly((5, 8), (7, 8), (3, 4), (1, 4)), rect(1, 0, 3, 4, 'd'),
                    rect(2, 0, 7, 1), rect(5, -2, 7, 1)]), 8)
L['eta'] = (glyph([rect(1, 0, 3, 7), rect(1, 5, 7, 7, 'b'), rect(5, -2, 7, 7, 'b')]), 8)
L['theta'] = (glyph([rect(1, 0, 7, 9, 'abcd')], [rect(3, 1, 5, 4), rect(3, 5, 5, 8)]), 8)
L['iota'] = (glyph([rect(1, 0, 3, 7), rect(1, 0, 4, 1)]), 5)
L['kappa'] = (glyph([borrowed('k')], keep=rect(0, -1, 9, 7)), 8)
L['lambda'] = (glyph([poly((1, 9), (3, 9), (7, 1), (7, 0), (5, 0), (2, 6), (1, 6)),
                      poly((1, 0), (3, 0), (4.5, 3), (3.5, 5))]), 8)
L['mu'] = (glyph([rect(1, -2, 3, 7), rect(1, 0, 7, 7, 'c')], [rect(3, 1, 5, 7)]), 8)  # Chicago's own is the curly micro sign
L['nu'] = (glyph([borrowed('v')]), 8)  # Chicago's v is already the Greek shape
L['xi'] = (glyph([rect(1, 8, 7, 9), rect(1, 1, 3, 9), rect(1, 4, 6, 5), rect(1, 0, 7, 2, 'd'), rect(5, -2, 7, 2, 'c')], [rect(3, 1, 5, 2)]), 8)
L['rho'] = (glyph([rect(1, 0, 7, 7, 'abc'), rect(1, -2, 3, 1)], [rect(3, 1, 5, 6)]), 8)
L['sigma'] = (glyph([rect(1, 0, 7, 7, 'acd'), rect(5, 6, 8, 7)], [rect(3, 1, 5, 6)]), 9)
L['sigma1'] = (glyph([rect(1, 0, 7, 7, 'ad'), rect(5, -2, 7, 1, 'c')], [rect(3, 1, 7, 6)]), 8)  # ς
L['tau'] = (glyph([rect(1, 6, 7, 7), rect(3, 0, 5, 7, 'd'), rect(3, 0, 6, 1)]), 8)
L['upsilon'] = (glyph([rect(1, 0, 7, 7, 'cd')], [rect(3, 1, 5, 7)]), 8)
L['phi'] = (glyph([rect(1, 0, 9, 7, 'abcd'), rect(4, -2, 6, 8)], [rect(3, 1, 4, 6), rect(6, 1, 7, 6)]), 10)
L['chi'] = (glyph([borrowed('x', (1, 0, 0, 9 / 7, 0, -2))]), 8)
L['psi'] = (glyph([rect(1, 0, 9, 7, 'cd'), rect(4, -2, 6, 8)], [rect(3, 1, 4, 7), rect(6, 1, 7, 7)]), 10)
L['omega'] = (glyph([rect(1, 0, 11, 7, 'cd')], [rect(3, 1, 5, 7), rect(7, 1, 9, 7), rect(5, 5, 7, 7)]), 12)

# ---- capitals -------------------------------------------------------------
U = {}
U['Gamma'] = (glyph([rect(1, 0, 3, 9), rect(1, 8, 6, 9)]), 7)
U['Delta'] = (glyph([poly((1, 0), (9, 0), (9, 1.5), (6, 9), (4, 9), (1, 1.5))], [poly((3, 1), (7, 1), (5, 6.5))]), 10)
U['Theta'] = (glyph([rect(1, 0, 7, 9, 'abcd')], [rect(3, 1, 5, 4), rect(3, 5, 5, 8)]), 8)
U['Lambda'] = (glyph([poly((1, 0), (3, 0), (5, 7), (7, 0), (9, 0), (6, 9), (4, 9))]), 10)
U['Xi'] = (glyph([rect(1, 8, 7, 9), rect(2, 4, 6, 5), rect(1, 0, 7, 1)]), 8)
U['Sigma'] = (glyph([rect(1, 8, 7, 9), rect(1, 0, 7, 1), poly((1, 8), (3, 8), (5, 4.5), (3, 1), (1, 1), (3, 4.5))]), 8)
U['Phi'] = (glyph([rect(1, 2, 9, 7, 'abcd'), rect(4, 0, 6, 9)], [rect(3, 3, 4, 6), rect(6, 3, 7, 6)]), 10)
U['Psi'] = (glyph([rect(1, 3, 9, 9, 'cd'), rect(4, 0, 6, 9)], [rect(3, 4, 4, 9), rect(6, 4, 7, 9)]), 10)

CODES = {
    'alpha': 0x3B1, 'beta': 0x3B2, 'gamma': 0x3B3, 'delta': 0x3B4, 'epsilon': 0x3B5, 'zeta': 0x3B6,
    'mu': 0x3BC, 'nu': 0x3BD, 'eta': 0x3B7, 'theta': 0x3B8, 'iota': 0x3B9, 'kappa': 0x3BA, 'lambda': 0x3BB, 'xi': 0x3BE,
    'rho': 0x3C1, 'sigma1': 0x3C2, 'sigma': 0x3C3, 'tau': 0x3C4, 'upsilon': 0x3C5, 'phi': 0x3C6,
    'chi': 0x3C7, 'psi': 0x3C8, 'omega': 0x3C9,
    'Gamma': 0x393, 'Delta': 0x394, 'Theta': 0x398, 'Lambda': 0x39B, 'Xi': 0x39E, 'Sigma': 0x3A3,
    'Phi': 0x3A6, 'Psi': 0x3A8,
}
# accented lower case: base, then marks (glyph, dx, dy in pixels)
ACCENTED = {
    'alphatonos': (0x3AC, 'alpha'), 'epsilontonos': (0x3AD, 'epsilon'), 'etatonos': (0x3AE, 'eta'),
    'iotatonos': (0x3AF, 'iota'), 'omicrontonos': (0x3CC, 'o'), 'upsilontonos': (0x3CD, 'upsilon'),
    'omegatonos': (0x3CE, 'omega'), 'iotadieresis': (0x3CA, 'iota'), 'upsilondieresis': (0x3CB, 'upsilon'),
    'iotadieresistonos': (0x390, 'iota'), 'upsilondieresistonos': (0x3B0, 'upsilon'),
}


def draw(font, name, paths, adv):
    pen = TTGlyphPen(None)
    for p in paths:
        # clipper's outer contours run anticlockwise and its holes clockwise;
        # TrueType wants both the other way round
        p = p[::-1]
        pen.moveTo((round(p[0][0] / S), round(p[0][1] / S)))
        for x, y in p[1:]:
            pen.lineTo((round(x / S), round(y / S)))
        pen.closePath()
    g = pen.glyph()
    font['glyf'][name] = g
    g.recalcBounds(font['glyf'])
    font['hmtx'][name] = (round(adv * PX), g.xMin if g.numberOfContours else 0)


def bounds(font, name):
    g = font['glyf'][name]
    g.recalcBounds(font['glyf'])
    return g.xMin, g.yMin, g.xMax, g.yMax


def composite(font, name, parts, adv):
    g = font['glyf']['.notdef'].__class__()
    g.numberOfContours = -1
    g.components = []
    for base, dx, dy in parts:
        c = GlyphComponent()
        c.glyphName, c.x, c.y, c.flags = base, round(dx), round(dy), 0
        g.components.append(c)
    g.components[0].flags = 0x0200  # USE_MY_METRICS
    font['glyf'][name] = g
    g.recalcBounds(font['glyf'])
    font['hmtx'][name] = (adv, g.xMin)


order = font.getGlyphOrder()
cmaps = [t for t in font['cmap'].tables if t.isUnicode()]

for name, (paths, adv) in {**L, **U}.items():
    if name in order:
        name = name + '.greek'
    order.append(name)
    draw(font, name, paths, adv)
    for t in cmaps:
        t.cmap[CODES[name.replace('.greek', '')]] = name

# The marks, set over a lower-case letter: one pixel clear of the x-height,
# centred on the letter's ink.
tx0, ty0, tx1, ty1 = bounds(font, 'tonos')
dx0, dy0, dx1, dy1 = bounds(font, 'dieresis')
for name, (code, base) in ACCENTED.items():
    bx0, _, bx1, _ = bounds(font, base)
    mid = (bx0 + bx1) / 2
    adv = font['hmtx'][base][0]
    parts = [(base, 0, 0)]
    if 'dieresis' in name:
        parts.append(('dieresis', mid - (dx0 + dx1) / 2, 8 * PX - dy0))
    if 'tonos' in name:
        lift = 9.5 * PX if 'dieresis' in name else 8 * PX
        parts.append(('tonos', mid - (tx0 + tx1) / 2, lift - ty0))
    order.append(name)
    composite(font, name, parts, adv)
    for t in cmaps:
        t.cmap[code] = name

# ano teleia is the middle dot
for t in cmaps:
    t.cmap.setdefault(0x387, 'periodcentered')

font.setGlyphOrder(order)
font['maxp'].numGlyphs = len(order)
for rec in font['name'].names:
    if rec.nameID in (1, 3, 4, 16):
        rec.string = 'ChicagoFLF Greek'
    elif rec.nameID == 6:
        rec.string = 'ChicagoFLF-Greek'
font.save(out)
print('wrote', out, len(order), 'glyphs')
