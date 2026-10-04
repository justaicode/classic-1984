# Chicago Light: ChicagoFLF with thinner upright strokes, for running text —
# Roberto found bold Chicago too heavy to read in a chat. Copied from Agentrix
# (scripts/make-chicago-light.py there, same recipe, so the two apps match),
# with the source font as an argument so it can thin ChicagoGreek.ttf.
# Thins vertical strokes by eroding each glyph sideways, then pulls the spacing back in.
#   uv run --with fonttools --with pyclipper --no-project python tools/make-chicago-light.py \
#     fonts/ChicagoGreek.ttf 28 0 fonts/ChicagoLight.ttf ChicagoFLF-Light "ChicagoFLF Light"
import sys, pyclipper
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from fontTools.pens.ttGlyphPen import TTGlyphPen

SRC, dx, dy, out, ps, fam = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5], sys.argv[6]

class Flat(BasePen):
    def __init__(s, gs): super().__init__(gs); s.paths=[]; s.cur=None
    def _moveTo(s,p): s.cur=[p]; s.paths.append(s.cur)
    def _lineTo(s,p): s.cur.append(p)
    def _qCurveToOne(s,p1,p2):
        p0=s.cur[-1]
        for i in range(1,9):
            t=i/8; s.cur.append(((1-t)**2*p0[0]+2*(1-t)*t*p1[0]+t*t*p2[0],(1-t)**2*p0[1]+2*(1-t)*t*p1[1]+t*t*p2[1]))
    def _curveToOne(s,p1,p2,p3):
        p0=s.cur[-1]
        for i in range(1,11):
            t=i/10; m=1-t
            s.cur.append((m**3*p0[0]+3*m*m*t*p1[0]+3*m*t*t*p2[0]+t**3*p3[0], m**3*p0[1]+3*m*m*t*p1[1]+3*m*t*t*p2[1]+t**3*p3[1]))
    def _closePath(s): pass
    def _endPath(s): pass

def boolop(a, b, op):
    if op==pyclipper.CT_INTERSECTION and (not a or not b): return []
    if not a and not b: return []
    c=pyclipper.Pyclipper()
    if a: c.AddPaths(a, pyclipper.PT_SUBJECT, True)
    if b: c.AddPaths(b, pyclipper.PT_CLIP, True)
    return c.Execute(op, pyclipper.PFT_NONZERO, pyclipper.PFT_NONZERO)

def shift(paths, x, y): return [[(px+x, py+y) for px,py in p] for p in paths]

f=TTFont(SRC); gs=f.getGlyphSet(); glyf=f['glyf']
new={}
# Accents keep their weight: a dot one pixel wide eroded by two thirds of a
# pixel is a hairline. Composites (ϊ, ά, é…) stay composites, so they pick up
# the thinned base and the unthinned accent.
KEEP={'dieresis','tonos','dieresistonos','acute','grave','circumflex','tilde','ring','cedilla','macron','caron','breve','dotaccent','hungarumlaut','ogonek'}
for name in f.getGlyphOrder():
    if name in KEEP or glyf[name].isComposite(): continue
    pen=Flat(gs); gs[name].draw(pen)
    paths=[[(round(x),round(y)) for x,y in p] for p in pen.paths if len(p)>2]
    if paths:
        u=boolop(paths, [], pyclipper.CT_UNION)
        e=boolop(shift(u,dx,0), shift(u,-dx,0), pyclipper.CT_INTERSECTION) if dx else u
        if dy: e=boolop(shift(e,0,dy), shift(e,0,-dy), pyclipper.CT_INTERSECTION)
        e=pyclipper.CleanPolygons(e, 1.5)
    else: e=[]
    tp=TTGlyphPen(None)
    for p in e:
        if len(p)<3: continue
        # TrueType wants clockwise outer contours; pyclipper gives counter-clockwise outers
        p=[(x-dx,y) for x,y in reversed(p)]
        tp.moveTo(tuple(p[0]))
        for q in p[1:]: tp.lineTo(tuple(q))
        tp.closePath()
    new[name]=tp.glyph()
for name,g in new.items(): glyf[name]=g
hmtx=f['hmtx']
for name in f.getGlyphOrder():
    if name in new: continue
    adv,lsb=hmtx[name]
    if glyf[name].isComposite():
        glyf[name].recalcBounds(glyf); hmtx[name]=(max(0,adv-2*dx), glyf[name].xMin)
for name,g in new.items():
    adv,_=hmtx[name]
    if g.numberOfContours>0:
        g.recalcBounds(glyf); hmtx[name]=(max(0,adv-2*dx), g.xMin)
    else: hmtx[name]=(adv,0)
for t in ('fpgm','prep','cvt '):
    if t in f: del f[t]
for name in new: 
    pass
nm=f['name']
for r in list(nm.names):
    if r.nameID in (1,16): r.string=fam
    if r.nameID in (4,): r.string=fam
    if r.nameID==6: r.string=ps
    if r.nameID==3: r.string=ps
f['maxp'].maxSizeOfInstructions=0
f.save(out); print('saved', out)
