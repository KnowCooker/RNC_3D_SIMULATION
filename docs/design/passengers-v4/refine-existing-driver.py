"""Orient existing game-mesh palms from weighted geometry, not COLLADA bone display axes."""
import bpy, json
from mathutils import Vector, Matrix
from pathlib import Path
source=Path(__file__).resolve().parent.parent/'passengers-v3/refine-assets.py'
script=source.read_text().split('ids=sys.argv')[0]
script=script.replace('aim_to(arm,upper,lower,elbow);aim_to(arm,lower,hand,wrist)','aim_to(arm,upper,lower,elbow);aim_to(arm,lower,hand,wrist)\n  orient_hand(arm,hand,meshes,(side*.9,-.35,.05) if driver else (0,-1,-.10))')

def orient_hand(arm,name,meshes,direction):
    bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();pts=[]
    for ob in meshes:
        vg=ob.vertex_groups.get(name)
        if not vg:continue
        indices=[v.index for v in ob.data.vertices if any(g.group==vg.index and g.weight>.8 for g in v.groups)]
        evaluated=ob.evaluated_get(dg)
        pts += [evaluated.matrix_world@evaluated.data.vertices[i].co for i in indices]
    if not pts:return
    b=arm.pose.bones[name];p=arm.matrix_world@b.head;centroid=sum(pts,Vector())/len(pts)
    q=(centroid-p).normalized().rotation_difference(Vector(direction).normalized())
    b.matrix=arm.matrix_world.inverted()@Matrix.Translation(p)@q.to_matrix().to_4x4()@Matrix.Translation(-p)@arm.matrix_world@b.matrix
    bpy.context.view_layer.update()
namespace={'__file__':str(source),'orient_hand':orient_hand};exec(compile(script,str(source),'exec'),namespace)
result=[namespace['pose'](c,d) for c in ['nami','zoro'] for d in [False,True]]
(Path(__file__).resolve().parents[3]/'output/passenger-v4/refined-crew-audit.json').write_text(json.dumps(result,indent=2))
print('REFINED_CREW',result)
