"""Retarget independently sourced textured meshes to seated/driver poses. Local-only assets."""
import bpy, math, sys, json, bmesh
from pathlib import Path
from mathutils import Vector, Matrix
root=Path(__file__).resolve().parents[3];work=root/'output/passenger-v4';out=root/'public/passengers-local'

def aim(arm,name,target):
    b=arm.pose.bones[name];p=arm.matrix_world@b.head
    q=(arm.matrix_world@b.matrix).col[1].xyz.normalized().rotation_difference((Vector(target)-p).normalized())
    b.matrix=arm.matrix_world.inverted()@Matrix.Translation(p)@q.to_matrix().to_4x4()@Matrix.Translation(-p)@arm.matrix_world@b.matrix
    bpy.context.view_layer.update()

def pose(char,driver):
    bpy.ops.wm.open_mainfile(filepath=str(work/(char+'-source.blend')))
    meshes=[o for o in bpy.data.objects if o.type=='MESH']
    hipz=.94 if char=='robin' else .91;hip=Vector((0,0,hipz))
    # Simple editable deformation skeleton, matched to the imported standing anatomy.
    ar=bpy.data.armatures.new('Seated retarget');arm=bpy.data.objects.new('Seated retarget',ar);bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    defs={'pelvis':((0,0,hipz),(0,0,hipz+.14),None),'spine':((0,0,hipz+.14),(0,0,1.40),'pelvis'),'head':((0,0,1.40),(0,0,1.69),'spine')}
    for s,suffix in [(1,'L'),(-1,'R')]:
        shoulder=(s*.205,-.015,1.38)
        elbow=(s*.43,-.015,1.38) if char=='robin' else (s*.35,-.04,1.19)
        wrist=(s*.64,-.025,1.38) if char=='robin' else (s*.52,-.075,.99)
        defs.update({f'thigh.{suffix}':((s*.095,0,hipz),(s*.115,0,.48),'pelvis'),f'shin.{suffix}':((s*.115,0,.48),(s*.14,0,.10),f'thigh.{suffix}'),f'foot.{suffix}':((s*.14,0,.10),(s*.14,-.13,.06),f'shin.{suffix}'),f'arm.{suffix}':(shoulder,elbow,'spine'),f'fore.{suffix}':(elbow,wrist,f'arm.{suffix}'),f'hand.{suffix}':(wrist,(s*(.74 if char=='robin' else .62),-.10,wrist[2]-.04),f'fore.{suffix}')})
    for name,(a,b,parent) in defs.items():
        bone=ar.edit_bones.new(name);bone.head=a;bone.tail=b
        if parent:bone.parent=ar.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    # Distance-to-bone weights preserve UVs. Restrict anatomy regions so skirt/hair cannot pull into hands.
    def dist(p,a,b):
        a,b=Vector(a),Vector(b);v=b-a;t=max(0,min(1,(p-a).dot(v)/v.length_squared));return (p-a-v*t).length
    for ob in meshes:
        if char=='robin' and 'cloth' in ob.name:
            # The OBJ has hem triangles mapped into the hair swatch. Repair UVs, not the source texture.
            uv=ob.data.uv_layers.active.data;img=next(n.image for n in ob.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE');pix=list(img.pixels);w,h=img.size
            for face in ob.data.polygons:
                if max(ob.data.vertices[i].co.z for i in face.vertices)>.72:continue
                for li in face.loop_indices:
                    u,v=uv[li].uv;offset=(int(v%1*(h-1))*w+int(u%1*(w-1)))*4
                    if sum(pix[offset:offset+3])<.35:uv[li].uv=(.35,.28)
        for name in defs:ob.vertex_groups.new(name=name)
        for v in ob.data.vertices:
            p=v.co;suffix='L' if p.x>0 else 'R'
            if char=='robin' and any(n in ob.name for n in ['hair','eye','teeth','acc']):names=['head']
            elif p.z>hipz-.10:names=[f'arm.{suffix}',f'fore.{suffix}',f'hand.{suffix}','spine','head','pelvis']
            elif p.z<hipz-.14:names=[f'thigh.{suffix}',f'shin.{suffix}',f'foot.{suffix}']
            else:names=['pelvis','spine',f'thigh.{suffix}']
            scores=[(n,1/(dist(p,*defs[n][:2])+.025)**5) for n in names];total=sum(w for _,w in scores)
            for name,w in scores:ob.vertex_groups[name].add([v.index],w/total,'REPLACE')
        mod=ob.modifiers.new('Seated pose','ARMATURE');mod.object=arm
    for s,suffix in [(1,'L'),(-1,'R')]:
        aim(arm,f'thigh.{suffix}',(s*.105,-.44,hipz-.035))
        knee=arm.pose.bones[f'shin.{suffix}'].head.copy();aim(arm,f'shin.{suffix}',knee+Vector((0,-.025,-.42)))
        ankle=arm.pose.bones[f'foot.{suffix}'].head.copy();aim(arm,f'foot.{suffix}',ankle+Vector((0,-.14,-.03)))
        aim(arm,f'arm.{suffix}',(s*.195,-.10,hipz+.20))
        aim(arm,f'fore.{suffix}',(s*(.205 if driver else .15),-.27 if driver else -.31,hipz+(.28 if driver else .11)))
        hand=arm.pose.bones[f'hand.{suffix}'].head.copy();aim(arm,f'hand.{suffix}',hand+Vector((0,-.09,-.025)))
    bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(work/(char+('-driver-rig' if driver else '-seated-rig')+'.blend')))
    baked=[]
    for ob in meshes:
        dg=bpy.context.evaluated_depsgraph_get();me=bpy.data.meshes.new_from_object(ob.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
        for v in me.vertices:
            v.co-=hip
        # Compact low-poly hair/skirt is retained as geometry; resolve inverted OBJ normals.
        bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
        for p in me.polygons:p.use_smooth=True
        n=bpy.data.objects.new('SM_'+char+'_'+ob.name,me);bpy.context.collection.objects.link(n);baked.append(n)
    for ob in list(bpy.data.objects):
        if ob not in baked:bpy.data.objects.remove(ob,do_unlink=True)
    for mat in bpy.data.materials:
        if mat.use_nodes:
            p=mat.node_tree.nodes.get('Principled BSDF')
            if p:p.inputs['Roughness'].default_value=.78;p.inputs['Specular IOR Level'].default_value=.18
    for img in bpy.data.images:
        if img.source=='FILE' and img.has_data:img.pack()
    name=char+('-driver' if driver else '-seated');bpy.ops.wm.save_as_mainfile(filepath=str(work/(name+'.blend')))
    bpy.ops.export_scene.gltf(filepath=str(out/(name+'.glb')),export_format='GLB',export_animations=False,export_skins=False,export_yup=True)
    pts=[v.co for o in baked for v in o.data.vertices];return {'id':char,'driver':driver,'min':[min(p[i] for p in pts) for i in range(3)],'max':[max(p[i] for p in pts) for i in range(3)],'triangles':sum(len(p.vertices)-2 for o in baked for p in o.data.polygons),'bytes':(out/(name+'.glb')).stat().st_size}
ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['robin','luffy']
audit=[pose(c,d) for c in ids for d in (False,True)];(work/'posed-audit.json').write_text(json.dumps(audit,indent=2));print('POSED',audit)
