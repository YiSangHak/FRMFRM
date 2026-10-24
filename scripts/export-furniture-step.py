"""Export mm-valued BREP components and edge samples for the furniture study.
Requires cadquery-ocp. Source STEP files are read-only.
"""
import argparse, json, math
from pathlib import Path
from OCP.STEPControl import STEPControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.BRepBndLib import BRepBndLib
from OCP.Bnd import Bnd_Box
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_SOLID, TopAbs_FACE, TopAbs_EDGE
from OCP.TopoDS import TopoDS
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BRep import BRep_Tool
from OCP.TopLoc import TopLoc_Location
from OCP.BRepAdaptor import BRepAdaptor_Curve
from OCP.GCPnts import GCPnts_AbscissaPoint
from OCP.GeomAbs import GeomAbs_Line


def xyz(point): return [point.X(), point.Y(), point.Z()]
def bounds(shape):
    box=Bnd_Box(); BRepBndLib.AddOptimal_s(shape,box,False,False)
    return xyz(box.CornerMin()),xyz(box.CornerMax())
def explorer(shape,kind):
    iterator=TopExp_Explorer(shape,kind)
    while iterator.More():
        yield iterator.Current(); iterator.Next()

def export(source,destination):
    reader=STEPControl_Reader()
    if reader.ReadFile(str(source))!=IFSelect_RetDone: raise RuntimeError('STEP read failed')
    reader.TransferRoots(); shape=reader.OneShape()
    minimum,maximum=bounds(shape)
    size=[maximum[i]-minimum[i] for i in range(3)]
    BRepMesh_IncrementalMesh(shape,.35,False,.35,True).Perform()
    direction=[v/math.sqrt(3) for v in [-1,1,1]]
    parts=[];profile=0
    for number,raw in enumerate(explorer(shape,TopAbs_SOLID)):
        print('Component',number+1,flush=True)
        solid=TopoDS.Solid(raw);lo,hi=bounds(solid)
        dimensions=[hi[i]-lo[i] for i in range(3)]
        board=sorted(dimensions)[1]>60
        if not board:profile+=1
        name='PLYWOOD SEAT' if board else f'PROFILE {profile:02d}'
        runs=[];seen=set()
        for rawEdge in explorer(solid,TopAbs_EDGE):
            edge=TopoDS.Edge(rawEdge)
            if any(edge.IsSame(previous) for previous in seen):continue
            seen.add(edge)
            try:
                curve=BRepAdaptor_Curve(edge)
                start,end=curve.FirstParameter(),curve.LastParameter()
                length=GCPnts_AbscissaPoint.Length_s(curve)
                if not math.isfinite(length) or length<.02:continue
                steps=1 if curve.GetType()==GeomAbs_Line else min(120,max(2,math.ceil(length/.8)))
                run=[]
                for i in range(steps+1):
                    parameter=start+(end-start)*i/steps
                    point=xyz(curve.Value(parameter))
                    run.append([round(point[j]-minimum[j],4) for j in range(3)])
                if len(run)>1:runs.append(run)
            except (RuntimeError,ValueError):continue
        meshVertices=[];meshTriangles=[]
        for faceIndex,rawFace in enumerate(explorer(solid,TopAbs_FACE)):
            face=TopoDS.Face(rawFace);location=TopLoc_Location()
            faceMesh=BRep_Tool.Triangulation_s(face,location)
            if faceMesh is None:continue
            offset=len(meshVertices);matrix=location.Transformation()
            for i in range(1,faceMesh.NbNodes()+1):
                point=xyz(faceMesh.Node(i).Transformed(matrix))
                meshVertices.append([round(point[j]-minimum[j],4) for j in range(3)])
            for i in range(1,faceMesh.NbTriangles()+1):
                a,b,c=faceMesh.Triangle(i).Get()
                meshTriangles.append([offset+a-1,offset+b-1,offset+c-1,faceIndex])
        parts.append({'id':number,'name':name,'material':'birch plywood' if board else 'aluminum',
                      'min':[round(lo[i]-minimum[i],4) for i in range(3)],
                      'max':[round(hi[i]-minimum[i],4) for i in range(3)],
                      'size':[round(v,4) for v in dimensions],'edges':runs,'mesh':{'vertices':meshVertices,'triangles':meshTriangles}})
    data={'source':source.name,'units':'mm','size':[round(v,4) for v in size],
          'sourceOrigin':minimum,'viewDirection':direction,'parts':parts,
          'notes':'Dimensions use exact BREP bounds. Straight edges retain exact endpoints; curves are sampled at up to 0.8mm spacing. Surfaces tessellated at 0.35mm for projection/picking; the viewer culls hidden edges.'}
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(data,separators=(',',':')))
    print(source.name,'size',data['size'],'parts',len(parts),'edge runs',sum(len(p['edges']) for p in parts),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);parser.add_argument('destination',type=Path)
    args=parser.parse_args();export(args.source,args.destination)
