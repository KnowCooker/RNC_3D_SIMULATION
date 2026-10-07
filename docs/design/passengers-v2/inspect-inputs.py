"""Blender background import/measurement stage, before posing or material changes."""
import bpy, sys, struct, json
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[3]
work = root / 'output/passenger-v2'
sys.path.insert(0, str(work / 'addons'))
sys.path.insert(0, str(work / 'addons/deps'))
import mmd_tools
mmd_tools.register()

reports = []
for character in ('ayaka', 'luffy', 'niulai'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if character == 'ayaka':
        bpy.ops.mmd_tools.import_model(filepath=str(next((work/'ayaka-source').glob('*.pmx'))), scale=.08)
    elif character == 'luffy':
        bpy.ops.import_scene.fbx(filepath=str(work/'luffy.fbx'))
    else:
        raw=(work/'niulai.mesh').read_bytes()
        magic,n,t,_=struct.unpack_from('<4I',raw)
        assert magic==0x3155494e and len(raw)==16+n*24+t*12
        import numpy as np
        pts=np.frombuffer(raw,dtype='<f4',offset=16,count=n*3).reshape(-1,3)
        faces=np.frombuffer(raw,dtype='<u4',offset=16+n*24,count=t*3).reshape(-1,3)
        geo=bpy.data.meshes.new('Niulai sculpt');geo.from_pydata([(float(x),float(-z),float(y)) for x,y,z in pts],[],faces.tolist());geo.update()
        ob=bpy.data.objects.new('Niulai',geo);bpy.context.collection.objects.link(ob)
    for ob in bpy.data.objects:
        if ob.type=='MESH':
            for p in ob.data.polygons:p.use_smooth=True
    report={'id':character,'objects':[]}
    for ob in bpy.data.objects:
        if ob.type not in ('MESH','ARMATURE'):continue
        item={'name':ob.name,'type':ob.type,'scale':list(ob.scale),'location':list(ob.location),'rotation':list(ob.rotation_euler)}
        if ob.type=='MESH':
            bounds=[ob.matrix_world@Vector(p) for p in ob.bound_box]
            item.update(vertices=len(ob.data.vertices),polygons=len(ob.data.polygons),min=[min(v[i] for v in bounds) for i in range(3)],max=[max(v[i] for v in bounds) for i in range(3)],materials=[m.name for m in ob.data.materials])
        else:
            item['bones']=[{'name':b.name,'head':list(b.head_local),'tail':list(b.tail_local)} for b in ob.data.bones]
        report['objects'].append(item)
    reports.append(report)
    bpy.ops.wm.save_as_mainfile(filepath=str(work/f'{character}-import.blend'))
(work/'inputs-audit.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
print('INPUT_AUDIT_DONE')
