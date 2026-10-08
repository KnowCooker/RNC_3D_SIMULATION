"""Offline Blender preview of exported runtime meshes. Never a browser screenshot."""
import bpy, math, os, sys
from mathutils import Vector

base = os.path.dirname(os.path.abspath(__file__))
screens = os.path.join(base, 'renders')
os.makedirs(screens, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1600, 1050, 100
scene.world = bpy.data.worlds.new('Warm studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.63,.57,.47,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .25
scene.view_settings.view_transform = 'AgX'

def material(name, color, roughness=.65):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=roughness
    return m
def box(name, loc, scale, mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.name=name;o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('Rounded upholstery','BEVEL');mod.width=.045;mod.segments=5
    o.modifiers.new('Weighted soft normals','WEIGHTED_NORMAL');o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o
def light(name, loc, power, size, color):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,.4))-o.location).to_track_quat('-Z','Y').to_euler()
def text(body, loc, size=.08):
    d=bpy.data.curves.new('Label','FONT');d.body=body;d.size=size;d.align_x='CENTER';d.extrude=0
    o=bpy.data.objects.new('Label',d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0);o.data.materials.append(material('Typography',(.07,.055,.038)))

leather=material('Cream seat',(.67,.59,.47),.82)
for i, name in enumerate(['niulai','ayaka','luffy']):
    before=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(base,'models',name+'.glb'))
    objects=set(bpy.context.scene.objects)-before
    x=(i-1)*.79
    for o in objects:
        if o.parent is None:o.location.x+=x
    box('Seat cushion',(x,.01,-.073),(.48,.48,.115),leather)
    box('Seat back',(x,.19,.19),(.48,.10,.47),leather)
    box('Headrest',(x,.20,.51),(.31,.115,.18),leather)
    text(['NIULAI','KAMISATO AYAKA','MONKEY D. LUFFY'][i],(x,-.54,-.27),.055)
ground=material('Champagne stage',(.69,.64,.55),.48)
box('Stage',(0,0,-.315),(200,200,.05),ground)
light('Softbox',(-2,-3,4),180,4,(1,.87,.70));light('Fill',(3,-1,2.5),95,3,(.73,.83,1));light('Rim',(1,3,3),150,2,(1,.91,.79))
camera=bpy.data.cameras.new('Camera');o=bpy.data.objects.new('Camera',camera);scene.collection.objects.link(o);scene.camera=o
o.location=(1.38,-3.8,1.45);target=Vector((0,0,.25));o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler();camera.type='ORTHO';camera.ortho_scale=3.0
text('THREE REAL-TIME CHARACTER MESHES',(0,.16,.98),.07)
text('OFFLINE GEOMETRY PREVIEW / INITIAL DESIGN',(0,-.59,-.38),.035)
scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(screens,'three-passengers.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.getcwd(),'output','passenger-render','passenger-review.blend'))

# Second proof: the actual GX geometry and actual seat attachment transforms.
for obj in list(scene.objects):
    if obj.type not in {'CAMERA','LIGHT'}: bpy.data.objects.remove(obj,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(os.getcwd(),'output','passenger-render','gx-cabin.glb'))
box('Stage',(0,0,-.07),(200,200,.06),ground)
o=scene.camera;o.location=(-4.5,-5.4,3.5);target=Vector((0,0,1.0));o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler();camera.ortho_scale=6.3
for obj in scene.objects:
    if obj.type=='LIGHT':obj.data.energy*=4
scene.render.filepath=os.path.join(screens,'gx-seat-fit.png');bpy.ops.render.render(write_still=True)
