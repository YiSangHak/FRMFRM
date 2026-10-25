"""Convert the supplied STEP assemblies to self-contained, metre-scale glTF 2.0.
Requires cadquery-ocp and numpy. Preserves solid components and sharp face boundaries.
"""
import argparse, json, struct
from pathlib import Path
import numpy as np
from OCP.STEPControl import STEPControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.BRepBndLib import BRepBndLib
from OCP.Bnd import Bnd_Box
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_SOLID, TopAbs_FACE, TopAbs_REVERSED
from OCP.TopoDS import TopoDS
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BRep import BRep_Tool
from OCP.TopLoc import TopLoc_Location


def iterate(shape,kind):
    cursor=TopExp_Explorer(shape,kind)
    while cursor.More():yield cursor.Current();cursor.Next()
def xyz(p):return [p.X(),p.Y(),p.Z()]
def bounds(shape):
    box=Bnd_Box();BRepBndLib.AddOptimal_s(shape,box,False,False)
    return np.array(xyz(box.CornerMin())),np.array(xyz(box.CornerMax()))


def convert(source,destination,texture=None):
    reader=STEPControl_Reader()
    if reader.ReadFile(str(source))!=IFSelect_RetDone:raise RuntimeError(f'Cannot read {source}')
    reader.TransferRoots();assembly=reader.OneShape();low,high=bounds(assembly)
    center=(low+high)/2
    BRepMesh_IncrementalMesh(assembly,.35,False,.35,True).Perform()
    gltf={'asset':{'version':'2.0','generator':'FRMFRM STEP exporter'},'scene':0,'scenes':[{'nodes':[]}],
          'nodes':[],'meshes':[],'materials':[
              {'name':'Aluminum','pbrMetallicRoughness':{'baseColorFactor':[.68,.70,.72,1],'metallicFactor':1,'roughnessFactor':.32}},
              {'name':'Birch plywood surface','pbrMetallicRoughness':{'baseColorFactor':[.78,.66,.48,1],'metallicFactor':0,'roughnessFactor':.68}},
              {'name':'Birch plywood edge','pbrMetallicRoughness':{'baseColorFactor':[.60,.46,.30,1],'metallicFactor':0,'roughnessFactor':.76}}
          ],'buffers':[],'bufferViews':[],'accessors':[],
          'extras':{'source':source.name,'units':'metres','sourceUnits':'millimetres','dimensionsMm':np.round(high-low,4).tolist(),
                    'linearDeflectionMm':.35,'angularDeflectionRadians':.35,'upAxis':'Y','origin':'floor-centred',
                    'materialsNote':'PBR aluminum, supplied birch grain on seat surfaces, and a plain plywood edge material.'}}
    binary=bytearray();totalTriangles=0;profile=0
    if texture:
        image=texture.read_bytes();binary.extend(image)
        gltf['bufferViews'].append({'buffer':0,'byteOffset':0,'byteLength':len(image)})
        gltf['images']=[{'bufferView':0,'mimeType':'image/jpeg','name':'Supplied birch plywood'}]
        gltf['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}]
        gltf['textures']=[{'sampler':0,'source':0}]
        gltf['materials'][1]['pbrMetallicRoughness']['baseColorFactor']=[1,1,1,1]
        gltf['materials'][1]['pbrMetallicRoughness']['baseColorTexture']={'index':0}

    def accessor(array,kind,component,target,includeBounds=False):
        while len(binary)%4:binary.append(0)
        offset=len(binary);binary.extend(array.tobytes())
        view=len(gltf['bufferViews']);gltf['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':array.nbytes,'target':target})
        item={'bufferView':view,'componentType':component,'count':len(array),'type':kind}
        if includeBounds:item.update(min=array.min(axis=0).astype(float).tolist(),max=array.max(axis=0).astype(float).tolist())
        result=len(gltf['accessors']);gltf['accessors'].append(item);return result
    for raw in iterate(assembly,TopAbs_SOLID):
        solid=TopoDS.Solid(raw);partLow,partHigh=bounds(solid);size=partHigh-partLow
        board=sorted(size)[1]>60
        if not board:profile+=1
        name='PLYWOOD SEAT' if board else f'PROFILE {profile:02d}'
        groups={}
        for rawFace in iterate(solid,TopAbs_FACE):
            face=TopoDS.Face(rawFace);location=TopLoc_Location();mesh=BRep_Tool.Triangulation_s(face,location)
            if mesh is None:continue
            points=np.array([xyz(mesh.Node(i).Transformed(location.Transformation())) for i in range(1,mesh.NbNodes()+1)],dtype=np.float64)
            triangles=np.array([mesh.Triangle(i).Get() for i in range(1,mesh.NbTriangles()+1)],dtype=np.int64)-1
            if face.Orientation()==TopAbs_REVERSED:triangles=triangles[:,[0,2,1]]
            cross=np.cross(points[triangles[:,1]]-points[triangles[:,0]],points[triangles[:,2]]-points[triangles[:,0]])
            valid=np.linalg.norm(cross,axis=1)>1e-10;triangles=triangles[valid];cross=cross[valid]
            if not len(triangles):continue
            normal=np.zeros_like(points)
            for column in range(3):np.add.at(normal,triangles[:,column],cross)
            magnitude=np.linalg.norm(normal,axis=1);normal[magnitude>0]/=magnitude[magnitude>0,None]
            mean=cross.sum(axis=0);mean/=max(np.linalg.norm(mean),1e-30)
            material=0 if not board else (1 if abs(mean[2])>.8 else 2)
            # STEP Z-up millimetres -> glTF Y-up metres, without reflection.
            positions=np.column_stack((points[:,0]-center[0],points[:,2]-low[2],-(points[:,1]-center[1])))/1000
            normals=np.column_stack((normal[:,0],normal[:,2],-normal[:,1]))
            group=groups.setdefault(material,{'positions':[],'normals':[],'uvs':[],'triangles':[],'count':0})
            if material==1 and texture:
                uv=(points[:,:2]-partLow[:2])/size[:2]
                group['uvs'].append(uv)
            group['positions'].append(positions);group['normals'].append(normals);group['triangles'].append(triangles+group['count']);group['count']+=len(points)
        primitives=[]
        for material,group in groups.items():
            positions=np.concatenate(group['positions']);normals=np.concatenate(group['normals']);triangles=np.concatenate(group['triangles'])
            # Weld only matching position+normal pairs, preserving hard material/face edges.
            uvs=np.concatenate(group['uvs']) if group['uvs'] else None
            packed=np.round(np.column_stack((positions,normals,uvs)) if uvs is not None else np.column_stack((positions,normals)),8)
            _,first,inverse=np.unique(packed,axis=0,return_index=True,return_inverse=True)
            positions=positions[first].astype('<f4');normals=normals[first].astype('<f4');triangles=inverse[triangles]
            assert np.isfinite(positions).all() and np.isfinite(normals).all()
            indexType=5123 if len(positions)<65536 else 5125
            indices=triangles.astype('<u2' if indexType==5123 else '<u4').ravel()
            primitives.append({'attributes':{'POSITION':accessor(positions,'VEC3',5126,34962,True),'NORMAL':accessor(normals,'VEC3',5126,34962)},
                               'indices':accessor(indices,'SCALAR',indexType,34963),'material':material,'mode':4})
            if uvs is not None:
                primitives[-1]['attributes']['TEXCOORD_0']=accessor(uvs[first].astype('<f4'),'VEC2',5126,34962)
            totalTriangles+=len(triangles)
        if not primitives:continue
        meshIndex=len(gltf['meshes']);gltf['meshes'].append({'name':name,'primitives':primitives})
        nodeIndex=len(gltf['nodes']);gltf['nodes'].append({'name':name,'mesh':meshIndex,'extras':{'dimensionsMm':np.round(size,4).tolist(),'material':'birch plywood' if board else 'aluminum'}});gltf['scenes'][0]['nodes'].append(nodeIndex)
    while len(binary)%4:binary.append(0)
    gltf['buffers']=[{'byteLength':len(binary)}]
    encoded=json.dumps(gltf,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    length=12+8+len(encoded)+8+len(binary)
    destination.parent.mkdir(parents=True,exist_ok=True)
    with destination.open('wb') as out:
        out.write(struct.pack('<4sII',b'glTF',2,length));out.write(struct.pack('<I4s',len(encoded),b'JSON'));out.write(encoded);out.write(struct.pack('<I4s',len(binary),b'BIN\x00'));out.write(binary)
    print(destination.name, 'components',len(gltf['nodes']),'triangles',totalTriangles,'size',round(length/1024),'KB','dimensionsMm',gltf['extras']['dimensionsMm'],flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);parser.add_argument('destination',type=Path);parser.add_argument('--texture',type=Path);args=parser.parse_args();convert(args.source,args.destination,args.texture)
