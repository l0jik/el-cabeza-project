import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
import sys
SRC='/home/user/el-cabeza-project/assets/tienda/clerk/manager-1.jpg'
im=np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
H,W,_=im.shape
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
theta=float(sys.argv[1]) if len(sys.argv)>1 else 7.0   # degrees, + = clockwise on screen
yaw=float(sys.argv[2]) if len(sys.argv)>2 else 2.5     # px the face moves left
eye=float(sys.argv[3]) if len(sys.argv)>3 else 1.4      # px the irises move
# 1. the head turned about the neck: a soft mask over hair and face
cx,cy=112.0,176.0
r=np.hypot((xx-112)/62,(yy-132)/58)
m=np.clip(1.25-r,0,1); m=m*m*(3-2*m)
m*=np.clip((180-yy)/18,0,1)          # nothing below the chin/collar
m*=np.clip((150-xx)/10,0,1)**0 * np.clip((158-xx)/14,0,1)  # stop short of the bubble / manager
t=np.deg2rad(theta)
dx,dy=xx-cx,yy-cy
# backward map: the source of an output pixel is the pixel rotated back
sx=cx+np.cos(-t)*dx-np.sin(-t)*dy
sy=cy+np.sin(-t)*dx+np.cos(-t)*dy
X=xx+m*(sx-xx); Y=yy+m*(sy-yy)
# 2. a slight turn: the face's middle drawn left (source taken from the right)
f=np.exp(-(((xx-113)/17)**2+((yy-143)/20)**2))
X=X+yaw*f
# 3. the irises left and a little down
for (ex,ey) in [(97,136),(123,130)]:
    g=np.exp(-(((xx-ex)/2.6)**2+((yy-ey)/2.2)**2))
    X=X+eye*g; Y=Y-0.45*eye*g
out=np.stack([map_coordinates(im[...,c],[Y,X],order=3,mode='nearest') for c in range(3)],-1)
o=Image.fromarray(np.clip(out,0,255).astype(np.uint8))
o.save('m1-gaze.png')
a=Image.open(SRC).crop((40,60,200,200)).resize((480,420),Image.LANCZOS)
b=o.crop((40,60,200,200)).resize((480,420),Image.LANCZOS)
c=Image.new('RGB',(960,420)); c.paste(a,(0,0)); c.paste(b,(480,0)); c.save('m1-gaze-pair.png')
