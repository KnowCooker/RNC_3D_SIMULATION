"""Inspect and pose three local source meshes; no source GLB redistribution."""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector, Matrix
root=Path(__file__).resolve().parents[3]; work=root/'output/passenger-v3'; out=root/'public/passengers-local'; out.mkdir(exist_ok=True,parents=True)
params={'nami':('BN_Hips',1.63),'zoro':('Body_Pelvis',1.72),'chopper':('body',.68)}

def point(arm,name): return arm.matrix_world@arm.pose.bones[name].head

def rotate_segment(arm,name,child,direction):
 b=arm.pose.bones[name];p=point(arm,name)
 current=point(arm,child)-p if child else (arm.matrix_world@b.matrix).to_3x3()@Vector((0,1,0))
 q=current.normalized().rotation_difference(Vector(direction).normalized())
 b.matrix=arm.matrix_world.inverted()@Matrix.Translation(p)@q.to_matrix().to_4x4()@Matrix.Translation(-p)@arm.matrix_world@b.matrix
 bpy.context.view_layer.update()

def aim_to(arm,name,child,target): rotate_segment(arm,name,child,Vector(target)-point(arm,name))

def pose(char,driver):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 dae=next((work/char).rglob('*.dae'));bpy.ops.wm.collada_import(filepath=str(dae))
 arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
 for o in list(bpy.data.objects):
  if o.type=='MESH' and char=='zoro' and (o.name.startswith('weapon') or o.name in ('face_attack','face_damage','l_hand_close','r_hand_close')):bpy.data.objects.remove(o,do_unlink=True)
 meshes=[o for o in bpy.data.objects if o.type=='MESH']
 # Imported root transform is retained: local axes can differ from Blender Z-up.
 # All three source characters face world -Y after COLLADA import.
 # Chopper's backpack is +Y; retain the source root instead of turning him away.
 bpy.context.view_layer.update()
 pts=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
 scale=params[char][1]/(max(p.z for p in pts)-min(p.z for p in pts))
 hip=point(arm,params[char][0]).copy()
 for side,suffix in [(1,'L'),(-1,'R')]:
  if char=='nami': names=[f'BN_{suffix}_UpLeg',f'BN_{suffix}_Leg',f'BN_{suffix}_Foot',f'BN_{suffix}_ToeBase',f'BN_{suffix}_Arm',f'BN_{suffix}_ForeArm',f'BN_{suffix}_Hand']
  elif char=='zoro': names=[f'{suffix}Leg_Thigh',f'{suffix}Leg_Calf',f'{suffix}Foot_Heel',f'{suffix}Foot_Toe',f'{suffix}Arm_Upper',f'{suffix}Arm_Fore',f'{suffix}Hand_Palm']
  else:names=[f'{suffix.lower()}_hip',f'{suffix.lower()}_knee',f'{suffix.lower()}_foot',None,f'{suffix.lower()}_arm',f'{suffix.lower()}_elbow',f'{suffix.lower()}_hand']
  thigh,calf,foot,toe,upper,lower,hand=names
  if toe is not None and toe not in arm.pose.bones:toe=None
  rotate_segment(arm,thigh,calf,(side*.025,-1,-.08));rotate_segment(arm,calf,foot,(0,-.13,-1))
  if toe:rotate_segment(arm,foot,toe,(0,-1,-.08))
  factor=.40 if char=='chopper' else 1
  elbow=hip+Vector((side*.24,-.14,.18))*factor/scale
  wrist=hip+Vector((side*.145,-.29,.33 if driver else .08))*factor/scale
  aim_to(arm,upper,lower,elbow);aim_to(arm,lower,hand,wrist)
 # Keep source UV diffuse paint and split material meshes, bake pose without facial deformation.
 mats={}
 for o in meshes:
  for slot in o.material_slots:
   source=slot.material
   if source is None:continue
   key=source.name
   if key not in mats:
    texpath=None
    if char=='nami':
     part=next((p for p in ['Wear','Body','Hair','Face','Iris'] if p in key),None)
     if part:texpath=next(dae.parent.glob(f'*_{part}_*_C.png'),None)
    else:texpath=next(dae.parent.glob('cho_000_m00.png' if char=='chopper' else 'pl_zoro_skyp01_di25ff.png'))
    m=bpy.data.materials.new(char+' / '+key);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Roughness'].default_value=.7;p.inputs['Specular IOR Level'].default_value=.23
    if texpath:
     t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(texpath),check_existing=True);m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
     p.inputs['Emission Strength'].default_value=.12;m.node_tree.links.new(t.outputs['Color'],p.inputs['Emission Color'])
     if char=='nami' and 'Face' in key:
      # The separate C_Alpha file is a monochrome cutout mask, not facial colour.
      a=m.node_tree.nodes.new('ShaderNodeTexImage');a.image=bpy.data.images.load(str(next(dae.parent.glob('*_Face_*_C_Alpha.png'))),check_existing=True)
      a.image.colorspace_settings.name='Non-Color';m.node_tree.links.new(a.outputs['Color'],p.inputs['Alpha']);m.surface_render_method='DITHERED'
    m.use_backface_culling=True;mats[key]=m
   slot.material=mats[key]
 evaluated=[]
 for o in meshes:
  dg=bpy.context.evaluated_depsgraph_get();me=bpy.data.meshes.new_from_object(o.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
  world=o.matrix_world.copy()
  for v in me.vertices:v.co=(world@v.co-hip)*scale
  for p in me.polygons:p.use_smooth=True
  n=bpy.data.objects.new('SM_'+char+'_'+o.name,me);bpy.context.collection.objects.link(n);evaluated.append(n)
 for o in list(bpy.data.objects):
  if o not in evaluated:bpy.data.objects.remove(o,do_unlink=True)
 # Raised cushion keeps the small reindeer at a visible eye line without stretching anatomy.
 if char=='chopper':
  bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,-.08));c=bpy.context.object;c.name='SM_Chopper_SeatSupport';c.dimensions=(.28,.24,.12);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  b=c.modifiers.new('Upholstered edge','BEVEL');b.width=.04;b.segments=4
  m=bpy.data.materials.new('Cream seat support');m.diffuse_color=(.55,.46,.34,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=m.diffuse_color;c.data.materials.append(m);evaluated.append(c)
 for img in bpy.data.images:
  if img.source=='FILE' and img.has_data:img.pack()
 name=char+('-driver' if driver else '-seated')
 bpy.ops.wm.save_as_mainfile(filepath=str(work/(name+'.blend')))
 bpy.ops.export_scene.gltf(filepath=str(out/(name+'.glb')),export_format='GLB',export_animations=False,export_skins=False,export_yup=True)
 bpy.context.view_layer.update();pts=[o.matrix_world@Vector(p) for o in evaluated for p in o.bound_box]
 return {'id':char,'driver':driver,'min':[min(p[i] for p in pts) for i in range(3)],'max':[max(p[i] for p in pts) for i in range(3)],'triangles':sum(len(p.vertices)-2 for o in evaluated for p in o.data.polygons),'bytes':(out/(name+'.glb')).stat().st_size}
ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(params)
audit=[pose(c,driver) for c in ids for driver in (False,True)]
(work/'posed-audit.json').write_text(json.dumps(audit,indent=2));print('POSE_AUDIT',json.dumps(audit))
