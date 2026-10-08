"""Render the installed GLBs and actual GX cushion mounts offline, never browser QA."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix
root=Path(__file__).resolve().parents[3];work=root/'output/passenger-v4'
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
for i,char in enumerate(('robin','luffy')):
    p,obs=load(root/f'public/passengers-local/{char}-seated.glb');p.location.x=(i-.5)*1.2
    x=p.location.x
    box('Seat',(x,.04,-.08),(.52,.52,.14),cream);box('Backrest',(x,.23,.26),(.52,.13,.57),cream)
    label(('NICO ROBIN','MONKEY D. LUFFY')[i],(x,-.83,-.69),.053)
box('Floor',(0,0,-.73),(200,200,.04),floor)
label('DETAILED TRAVEL COMPANIONS',(0,.14,1.03),.08)
label('INSTALLED 3D MESHES / OFFLINE RENDER',(0,-.83,-.80),.04)
shot('new-characters.png',(1.3,-4.8,1.5),(0,-.06,.14),4.35)

clean()
for i,char in enumerate(('robin','luffy')):
    p,obs=load(root/f'public/passengers-local/{char}-driver.glb');p.location.x=(i-.5)*1.2
    x=p.location.x
    box('Seat',(x,.04,-.08),(.52,.52,.14),cream);box('Backrest',(x,.23,.26),(.52,.13,.57),cream)
    label(('ROBIN / DRIVER','LUFFY / DRIVER')[i],(x,-.83,-.69),.053)
box('Floor',(0,0,-.73),(200,200,.04),floor)
label('DRIVER POSES',(0,.14,1.03),.08)
shot('new-drivers.png',(1.3,-4.8,1.5),(0,-.06,.14),4.35)

audit=json.loads((work/'clearance-audit.json').read_text())
def relax(p,boxes):
    gap=.006;original=p.copy()
    for _ in range(3):
        for b in boxes:
            lo,hi=b['min'],b['max']
            if any(p[i]<=lo[i]-gap or p[i]>=hi[i]+gap for i in range(3)):continue
            t=b.get('torus')
            if t:
                inv=Matrix([t['inverse'][i::4] for i in range(4)]);q=inv@p;r=math.hypot(q.x,q.y)
                if not r:continue
                center=Vector((q.x*t['radius']/r,q.y*t['radius']/r,0));normal=q-center;length=normal.length;limit=t['tube']+gap/t['scale']
                if length>=limit:continue
                normal=normal/length if length>1e-8 else Vector((0,0,1));p=inv.inverted()@(center+normal*(limit+.0001))
            else:
                distances=[v for i in range(3) for v in [p[i]-lo[i]+gap,hi[i]-p[i]+gap]];d=min(distances)
                if d>.035:continue
                face=distances.index(d);p[face//2]+=(1 if face%2 else -1)*(d+.0001)
    return original if (p-original).length>.035 else p
for vehicle,crew in [('gx',[('luffy','seat-1-1'),('robin','seat-1-2'),('niulai','seat-2-1'),('chopper','seat-2-2'),('nami','seat-3-1'),('zoro','seat-3-2')]),('m03',[('robin','seat-1-1'),('zoro','seat-1-2'),('nami','seat-2-1'),('chopper','seat-2-2'),('luffy','seat-2-3')])]:
    clean();load(work/(vehicle+'-cabin.glb'))
    for char,seat in crew:
        fit=next(r for r in audit if r['car']==vehicle and r['seat']==seat and r['id']==char)
        wrapper,obs=load(root/f'public/passengers-local/{char}-{"driver" if fit["driver"] else "seated"}.glb')
        bpy.context.view_layer.update()
        for ob in obs:
            if ob.type!='MESH':continue
            matrix=ob.matrix_world.copy();inv=matrix.inverted()
            for v in ob.data.vertices:
                p=matrix@v.co
                if p.z<-.12:p.z=-.12+(p.z+.12)*fit['legScale']
                if fit.get('contacts'):
                    q=Vector((p.x,p.z,-p.y))*fit['scale']+Vector(fit['position']);q=relax(q,fit['contacts']);q=(q-Vector(fit['position']))/fit['scale'];p=Vector((q.x,-q.z,q.y))
                v.co=inv@p
        wrapper.scale=(fit['scale'],)*3;x,y,z=fit['position'];wrapper.location=(x,-z,y)
    box('Studio floor',(0,0,-.07),(200,200,.04),floor)
    shot(vehicle+'-cabin-fit.png',(-3.9,-5.1,4.4),(0,-.05,.8),5.9 if vehicle=='gx' else 5.25)
    shot(vehicle+'-side-fit.png',(4,-.1,2.1),(0,-.05,.87),5.6 if vehicle=='gx' else 5.1)
    if vehicle=='gx':shot('new-driver-cabin.png',(3.2,-2.2,2.4),(.18,-.35,.92),2.8)
print('OFFLINE_CABIN_REVIEW_COMPLETE')
