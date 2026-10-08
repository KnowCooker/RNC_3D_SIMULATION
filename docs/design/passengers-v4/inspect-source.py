import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[3];work=root/'output/passenger-v4'
char=sys.argv[sys.argv.index('--')+1];bpy.ops.wm.read_factory_settings(use_empty=True)
obj=next((work/char).rglob('*.obj'));bpy.ops.wm.obj_import(filepath=str(obj),use_split_groups=True,forward_axis='NEGATIVE_Z',up_axis='Y')
meshes=[o for o in bpy.data.objects if o.type=='MESH']
pts=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)])
print('BOUNDS',char,list(lo),list(hi));print('MESHES',[(o.name,len(o.data.vertices)) for o in meshes])
scale=1.70/(hi.z-lo.z);center=Vector(((hi.x+lo.x)/2,(hi.y+lo.y)/2,lo.z))
for o in meshes:
    matrix=o.matrix_world.copy()
    for v in o.data.vertices:v.co=(matrix@v.co-center)*scale
    o.matrix_world.identity()
    if char=='robin':
        mat=bpy.data.materials.new(o.name);mat.use_nodes=True;p=mat.node_tree.nodes['Principled BSDF'];t=mat.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(obj.parent/('eye_d.jpg' if '_eye_' in o.name else 'robin_d.jpg')),check_existing=True);mat.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color']);p.inputs['Roughness'].default_value=.7;o.data.materials.clear();o.data.materials.append(mat)
    for m in o.data.materials:
        if m and m.use_nodes:
            p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.7;p.inputs['Metallic'].default_value=0
            for n in m.node_tree.nodes:
                if n.type=='TEX_IMAGE' and n.image:
                    path=obj.parent/Path(n.image.filepath.replace('\\','/')).name
                    if path.exists():n.image.filepath=str(path);n.image.reload()
    for p in o.data.polygons:p.use_smooth=True
bpy.ops.wm.save_as_mainfile(filepath=str(work/(char+'-source.blend')))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.62,.57,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
for name,loc,power in [('Key',(-3,-4,4),400),('Fill',(3,-3,2),250),('Rim',(1,3,4),350)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=3;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',d);scene.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=2.15
cam.location=(1,-4,1.4);cam.rotation_euler=(Vector((0,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(work/(char+'-source.png'));bpy.ops.render.render(write_still=True)
