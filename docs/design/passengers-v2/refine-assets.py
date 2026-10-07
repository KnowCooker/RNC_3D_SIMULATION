"""Pose and package local-only character inputs. Blender 4.5 background stage.
Original model rights remain with their creators; never commit generated local GLBs.
"""
import bpy, bmesh, math, json, sys
from pathlib import Path
from mathutils import Vector, Matrix
root=Path(__file__).resolve().parents[3]
work=root/'output/passenger-v2'
out=root/'public/passengers-local'
out.mkdir(parents=True,exist_ok=True)
sys.path[:0]=[str(work/'addons'),str(work/'addons/deps')]
import mmd_tools
mmd_tools.register()

def material(name,col,rough=.5):
    m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=rough
    return m

def principled(source):
    # Keep the original UV painted textures; replace renderer-specific MMD nodes.
    tex=next((n.image for n in source.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'tex/' in n.image.filepath.replace('\\','/')),None) if source.use_nodes else None
    if tex is None and source.use_nodes:tex=next((n.image for n in source.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and not n.image.name.endswith('.bmp')),None)
    if tex is None and source.use_nodes:tex=next((n.image for n in source.node_tree.nodes if n.type=='TEX_IMAGE' and n.image),None)
    m=material(source.name+' / portable',(1,1,1),.62)
    p=m.node_tree.nodes.get('Principled BSDF')
    if tex:
        n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=tex
        m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
        m.node_tree.links.new(n.outputs['Alpha'],p.inputs['Alpha'])
        m.surface_render_method='DITHERED'
        p.inputs['Emission Strength'].default_value=.18
        m.node_tree.links.new(n.outputs['Color'],p.inputs['Emission Color'])
    else:p.inputs['Base Color'].default_value=source.diffuse_color
    m.use_backface_culling=False
    return m

def aim(arm,name,direction):
    b=arm.pose.bones.get(name)
    if b is None:return
    bpy.context.view_layer.update()
    world=arm.matrix_world@b.matrix;origin=world.translation.copy()
    q=world.col[1].xyz.normalized().rotation_difference(Vector(direction).normalized())
    b.matrix=arm.matrix_world.inverted()@Matrix.Translation(origin)@q.to_matrix().to_4x4()@Matrix.Translation(-origin)@world
    bpy.context.view_layer.update()

def aim_to(arm,name,target):
    b=arm.pose.bones.get(name)
    if b:aim(arm,name,Vector(target)-(arm.matrix_world@b.head))

def pose_human(char,drive):
    arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    meshes=[o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
    for o in list(bpy.data.objects):
        if o.type=='MESH' and o not in meshes:bpy.data.objects.remove(o,do_unlink=True)
    if char=='ayaka':
        # Transfer MMD's auxiliary deform chains to ordinary limb bones before posing.
        # Their opposite rest axes cannot be copied as raw pose matrices.
        for ob in meshes:
            for suffix in ('L','R'):
                for stem,target in [('足D','足'),('ひざD','ひざ'),('足首D','足首'),('足先EX','足首')]:
                    for prefix in ('','_shadow_'):
                        source=ob.vertex_groups.get(f'{prefix}{stem}.{suffix}')
                        if not source:continue
                        dest=ob.vertex_groups.get(f'{target}.{suffix}') or ob.vertex_groups.new(name=f'{target}.{suffix}')
                        values=[(v.index,g.weight) for v in ob.data.vertices for g in v.groups if g.group==source.index]
                        for index,weight in values:dest.add([index],weight,'ADD')
                        ob.vertex_groups.remove(source)
    arm.animation_data_clear()
    for b in arm.pose.bones:
        for c in list(b.constraints):b.constraints.remove(c)
        b.matrix_basis.identity()
    bpy.context.view_layer.update()
    mats={}
    for ob in meshes:
        ob.hide_set(False);ob.hide_render=False
        for slot in ob.material_slots:
            if slot.material:
                original=slot.material
                if original.name not in mats:mats[original.name]=principled(original)
                slot.material=mats[original.name]
    bounds=[ob.matrix_world@Vector(p) for ob in meshes for p in ob.bound_box]
    height=max(p.z for p in bounds)-min(p.z for p in bounds)
    # Normalize world units via root objects so skin bind coordinates are preserved.
    scale=(1.57 if char=='ayaka' else 1.67)/height
    wrapper=bpy.data.objects.new('Character scale',None);bpy.context.collection.objects.link(wrapper)
    tops=[o for o in bpy.data.objects if o!=wrapper and o.parent is None]
    for o in tops:o.parent=wrapper
    wrapper.scale=(scale,scale,scale);bpy.context.view_layer.update()
    hipname='足.L' if char=='ayaka' else 'mixamorig:Hips'
    hip=(arm.matrix_world@arm.pose.bones[hipname].head).z
    for side,suffix in ((1,'L'),(-1,'R')):
        if char=='ayaka':
            thigh,calf,foot=f'足.{suffix}',f'ひざ.{suffix}',f'足首.{suffix}'
            upper,lower,hand=f'腕.{suffix}',f'ひじ.{suffix}',f'手首.{suffix}'
        else:
            stem='mixamorig:'+('Left' if side==1 else 'Right')
            thigh,calf,foot=stem+'UpLeg',stem+'Leg',stem+'Foot'
            upper,lower,hand=stem+'Arm',stem+'ForeArm',stem+'Hand'
        aim(arm,thigh,(side*.025,-1,-.03));aim(arm,calf,(0,-.14,-1));aim(arm,foot,(0,-1,-.05))
        elbow=(side*.255,-.14,hip+.22)
        wrist=(side*.15,-.23 if drive else -.29,hip+(.34 if drive else .075))
        aim_to(arm,upper,elbow);aim_to(arm,lower,wrist);aim(arm,hand,(0,-1,-.15) if drive else (0,-1,-.4))
    # Skirt panels drape over bent thighs; keep rear panels behind the hip.
    if char=='ayaka':
        for b in arm.pose.bones:
            if b.name.startswith('裙_0_'):
                p=arm.matrix_world@b.head
                if p.y<-.045:aim(arm,b.name,(p.x*.15,-1,-.08))
    bpy.context.view_layer.update()
    for ob in meshes:
        # Evaluate the posed surface, preserve UVs/materials, omit MMD physics helpers.
        deps=bpy.context.evaluated_depsgraph_get();evaluated=ob.evaluated_get(deps)
        mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=deps)
        if char=='ayaka':
            # MMD additive sphere-map shells must not become opaque glTF hair caps.
            bm=bmesh.new();bm.from_mesh(mesh)
            shells=[f for f in bm.faces if 'spa+' in mesh.materials[f.material_index].name]
            bmesh.ops.delete(bm,geom=shells,context='FACES');bm.to_mesh(mesh);bm.free()
        new=bpy.data.objects.new(char+' / seated surface',mesh);bpy.context.collection.objects.link(new)
        new.matrix_world=ob.matrix_world.copy();new.location.z-=hip
    for ob in list(bpy.data.objects):
        if not ob.name.startswith(char+' / seated surface'):bpy.data.objects.remove(ob,do_unlink=True)

def pose_cow(drive):
    ob=next(o for o in bpy.data.objects if o.type=='MESH')
    # Reconstruct a continuous surface: the source triangulation contains small
    # overlapping/internal fragments that create dark pinholes after deformation.
    bpy.context.view_layer.objects.active=ob;ob.select_set(True)
    remesh=ob.modifiers.new('Continuous sculpt surface','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.0035;remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    palette=json.loads((work/'cowPalette.json').read_text())
    cols=palette['colours'];regions=palette['shape']
    def rgb(h):
        a=[int(h[i:i+2],16)/255 for i in (1,3,5)]
        return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in a)
    colors={k:Vector(rgb(v)) for k,v in cols.items()}
    def smooth(a,b,x):
        t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
    def inside(p,region):
        c=region['centre'];r=region['radii']
        return 1-smooth(.85,1.10,sum(((p[i]-c[i])/r[i])**2 for i in range(3)))
    # Color source sculpt regions before changing its pose.
    attr=ob.data.color_attributes.new(name='Sculpt paint',type='FLOAT_COLOR',domain='POINT')
    for vertex in ob.data.vertices:
        p=vertex.co;v=(abs(p.x),p.z,-p.y);col=colors['hide'].copy()
        for k,w in [('muzzle',inside(v,regions['muzzle'])),('horn',smooth(.842,.876,v[1])*smooth(.14,.175,v[0])),('hornTip',smooth(.94,.995,v[1])*smooth(.18,.24,v[0])),('sclera',inside(v,regions['sclera'])),('pupil',inside(v,regions['pupil'])),('brow',inside(v,regions['brow'])),('muzzle',max(inside(v,regions['hand']),1-smooth(.048,.064,v[1])))]:col=col.lerp(colors[k],w)
        attr.data[vertex.index].color=(*col,1)
    coat=material('Painted golden sculpt',(1,1,1),.76)
    n=coat.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name=attr.name
    coat.node_tree.links.new(n.outputs['Color'],coat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    ob.data.materials.append(coat)
    # Sculpt is a standing mesh: bend thighs at the hip and shins at the knee.
    hip=.265;knee=.115
    for v in ob.data.vertices:
        x,y,z=v.co;side=1 if x>=0 else -1
        if z<hip+.06:
            w=(1-smooth(.17,.23,abs(x)))*(1-smooth(hip,hip+.06,z))
            thigh=Vector((x,z-hip,hip-y));calf=Vector((x,y-(hip-knee),hip+(z-knee)))
            bent=calf.lerp(thigh,smooth(knee-.025,knee+.025,z))
            v.co=v.co.lerp(bent,w)
        # Arms hang at sides in this sculpt; bend lower arm upward/forward.
        if abs(x)>.17:
            weight=smooth(.17,.235,abs(x))*(1-smooth(.27,.42,z))*smooth(.10,.16,z)
            angle=math.radians(-100 if drive else -35);dy=y;dz=z-.30
            bent=Vector((v.co.x,dy*math.cos(angle)-dz*math.sin(angle),.30+dy*math.sin(angle)+dz*math.cos(angle)))
            v.co=v.co.lerp(bent,weight)
        v.co.z-=hip
        v.co*=1.08
    # Retain facial sculpt detail while reducing draw cost of the source mesh.
    bpy.context.view_layer.objects.active=ob;ob.select_set(True)
    smoothmod=ob.modifiers.new('Surface polish','SMOOTH');smoothmod.factor=.75;smoothmod.iterations=4
    bpy.ops.object.modifier_apply(modifier=smoothmod.name)
    d=ob.modifiers.new('Web sculpt budget','DECIMATE');d.ratio=.38
    bpy.ops.object.modifier_apply(modifier=d.name)

def lighting(scene):
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.world=bpy.data.worlds.new('Portrait studio');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.73,.72,.72,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
    for name,p,power,size in [('Key',(3,-4,5),320,4),('Fill',(-3,-1,3),180,3),('Rim',(0,3,4),340,3)]:
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
        o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=p;o.rotation_euler=(Vector((0,0,.3))-o.location).to_track_quat('-Z','Y').to_euler()

def render(char,drive):
    scene=bpy.context.scene;lighting(scene)
    floor=material('Backdrop',(.68,.64,.57),.85)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.51));bpy.context.object.data.materials.append(floor)
    data=bpy.data.cameras.new('Review');camera=bpy.data.objects.new('Review',data);scene.collection.objects.link(camera)
    camera.location=(1.5,-3.4,1.25);camera.rotation_euler=(Vector((0,-.08,.2))-camera.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=1.75;scene.camera=camera
    scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.filepath=str(work/f'{char}-{"driver" if drive else "seated"}.png');bpy.ops.render.render(write_still=True)

audits=[]
selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for char in (selected or ('ayaka','luffy','niulai')):
    for drive in (False,True):
        bpy.ops.wm.open_mainfile(filepath=str(work/f'{char}-import.blend'))
        if char=='niulai':pose_cow(drive)
        else:pose_human(char,drive)
        bpy.context.view_layer.update()
        objects=[o for o in bpy.data.objects if o.type=='MESH']
        for ob in objects:
            for p in ob.data.polygons:p.use_smooth=True
        filename=f'{char}-{"driver" if drive else "seated"}.glb'
        bpy.ops.export_scene.gltf(filepath=str(out/filename),export_format='GLB',export_animations=False,export_yup=True,export_materials='EXPORT')
        bounds=[o.matrix_world@Vector(p) for o in objects for p in o.bound_box]
        audits.append({'id':char,'driver':drive,'file':filename,'vertices':sum(len(o.data.vertices) for o in objects),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),'min':[min(v[i] for v in bounds) for i in range(3)],'max':[max(v[i] for v in bounds) for i in range(3)]})
        bpy.ops.wm.save_as_mainfile(filepath=str(work/f'{char}-{"driver" if drive else "seated"}.blend'))
        render(char,drive)
audit_file=work/'posed-audit.json'
if selected and audit_file.exists():audits=[a for a in json.loads(audit_file.read_text()) if a['id'] not in selected]+audits
audit_file.write_text(json.dumps(audits,indent=2),encoding='utf-8')
print('POSE_EXPORT_DONE')
