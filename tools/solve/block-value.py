# How much one block changes the truth: the same two Cabezas with and
# without the block, position by position. Values: 1 WIN (side to move),
# 2 LOSS, 3 DRAW, 0 not a position.
import sys
# python3 block-value.py <valuesDir> <world> <base> <rows> <cols> <blockPlacements> <blockOwner>
S, world, base, R, C, nblock, blockOwner = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6]), sys.argv[7]
v = open(f"{S}/{world}.values.bin","rb").read(); b = open(f"{S}/{base}.values.bin","rb").read()
cells = R*C
same=diff=0; helps=hurts=0; # for the block's owner
byWho = {"dark":{"same":0,"diff":0}, "light":{"same":0,"diff":0}}
for dc in range(cells):
  for lc in range(cells):
    if dc == lc: continue
    for side in (0,1):
      basev = b[(dc*cells+lc)*2+side]
      for t in range(nblock):
        s = ((dc*nblock+t)*cells+lc)*2+side  # the world's piece order: dark cabeza, the block, light cabeza
        wv = v[s]
        if not wv: continue
        mover = "dark" if side==0 else "light"
        if wv == basev: same+=1; byWho[mover]["same"]+=1
        else:
          diff+=1; byWho[mover]["diff"]+=1
          # does the change favour the block's owner?
          ownerWinsNow = (wv==1 and mover==blockOwner) or (wv==2 and mover!=blockOwner)
          ownerWonBefore = (basev==1 and mover==blockOwner) or (basev==2 and mover!=blockOwner)
          if ownerWinsNow and not ownerWonBefore: helps+=1
          elif ownerWonBefore and not ownerWinsNow: hurts+=1
tot=same+diff
print(f"{world} vs {base}: {tot} positions; the block changes the result in {diff} ({100*diff/tot:.1f}%): it wins {helps} the race would have lost, and loses {hurts} the race would have won")
for m,d in byWho.items(): print(f"  {m} to move: changed in {d['diff']} of {d['same']+d['diff']} ({100*d['diff']/(d['same']+d['diff']):.1f}%)")
