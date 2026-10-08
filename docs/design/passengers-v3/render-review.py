"""Render the installed GLBs and actual GX cushion mounts offline, never browser QA."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[3];work=root/'output/passenger-v3'
dest=Path(__file__).resolve().parent/'renders';dest.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1800;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Champagne studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.62,.60,.56,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.3;scene.view_settings.view_transform='AgX'
def material(name,c):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.7;return m
cream=material('Cream upholstery',(.57,.49,.37));floor=material('Warm floor',(.59,.55,.47));ink=material('Warm ink',(.045,.031,.02))
def box(name,loc,size,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);ob=bpy.context.object;ob.name=name;ob.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b=ob.modifiers.new('Soft edge','BEVEL');b.width=.04;b.segments=5;ob.modifiers.new('Normals','WEIGHTED_NORMAL');ob.data.materials.append(mat)
def label(text,loc,size):
    d=bpy.data.curves.new('Label','FONT');d.body=text;d.align_x='CENTER';d.size=size
    o=bpy.data.objects.new('Label',d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0);d.materials.append(ink)
def load(file):
    old=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(file));obs=set(scene.objects)-old
    wrapper=bpy.data.objects.new('Placed character',None);scene.collection.objects.link(wrapper)
    for ob in obs:
        if ob.parent is None:ob.parent=wrapper
    return wrapper,obs
def bounds(obs):
    bpy.context.view_layer.update();pts=[o.matrix_world@Vector(p) for o in obs if o.type=='MESH' for p in o.bound_box]
    return [min(p[i] for p in pts) for i in range(3)],[max(p[i] for p in pts) for i in range(3)]
for name,loc,power,size in [('Key',(-3,-4,5),350,4),('Fill',(3,-2,3),190,3),('Rim',(2,3,4),340,3)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
    ob=bpy.data.objects.new(name,d);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,.4))-ob.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',d);scene.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO'
def shot(name,loc,target,scale):
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();d.ortho_scale=scale
    scene.render.filepath=str(dest/name);bpy.ops.render.render(write_still=True)
def clean():
    for ob in list(scene.objects):
        if ob.type not in {'CAMERA','LIGHT'}:bpy.data.objects.remove(ob,do_unlink=True)
for i,char in enumerate(('chopper','nami','zoro')):
    p,obs=load(root/f'public/passengers-local/{char}-seated.glb');p.location.x=(i-1)*1.0
    x=p.location.x
    box('Seat',(x,.04,-.08),(.52,.52,.14),cream);box('Backrest',(x,.23,.26),(.52,.13,.57),cream)
    label(('TONY TONY CHOPPER','NAMI','RORONOA ZORO')[i],(x,-.83,-.69),.053)
box('Floor',(0,0,-.73),(200,200,.04),floor)
label('DETAILED TRAVEL COMPANIONS',(0,.14,1.03),.08)
label('INSTALLED 3D MESHES / OFFLINE RENDER',(0,-.83,-.80),.04)
shot('three-characters.png',(1.3,-4.8,1.5),(0,-.06,.14),4.35)

clean()
for i,char in enumerate(('chopper','nami','zoro')):
    p,obs=load(root/f'public/passengers-local/{char}-driver.glb');p.location.x=(i-1)*1.0
    x=p.location.x
    box('Seat',(x,.04,-.08),(.52,.52,.14),cream);box('Backrest',(x,.23,.26),(.52,.13,.57),cream)
    label(('CHOPPER / DRIVER','NAMI / DRIVER','ZORO / DRIVER')[i],(x,-.83,-.69),.053)
box('Floor',(0,0,-.73),(200,200,.04),floor)
label('THREE DRIVER POSES',(0,.14,1.03),.08)
shot('three-drivers.png',(1.3,-4.8,1.5),(0,-.06,.14),4.35)

clean()
load(work/'gx-cabin.glb')
mounts=json.loads((work/'cabin-mounts.json').read_text());audit=[]
for char,id in [('zoro','seat-1-1'),('nami','seat-1-2'),('chopper','seat-2-1')]:
    m=next(m for m in mounts if m['id']==id);p,obs=load(root/f'public/passengers-local/{char}-{"driver" if m["driver"] else "seated"}.glb')
    fit=next(f for f in m['fits'] if f['id']==char);scale=fit['scale']
    p.scale=(scale,)*3;x,y,z=fit['world'];p.location=(x,-z,y)
    lo,hi=bounds(obs);assert hi[2]<m['roof']-.025 and lo[2]>.219
    audit.append({'character':char,'seat':id,'scale':scale,'worldBlenderMin':lo,'worldBlenderMax':hi,'roof':m['roof']})
box('Floor',(0,0,-.07),(200,200,.04),floor)
for ob in scene.objects:
    if ob.type=='LIGHT':ob.data.energy*=3
shot('gx-seat-fit.png',(-3.9,-5.1,4.4),(0,-.05,.8),5.9)
shot('driver-fit.png',(3.2,-2.2,2.4),(.18,-.60,.92),2.8)
(dest.parent/'seat-fit-audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
print('OFFLINE_REVIEW_COMPLETE')
