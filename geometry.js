(function (scope) {
  'use strict';
  const polygon = points => ({ type: 'polygon', points });
  const ellipse = (x, y, rx, ry) => ({ type: 'ellipse', x, y, rx, ry });
  const water = ellipse(477, 326, 186, 22), outer = ellipse(477, 326, 221, 38);
  const zones = [
    { id: 'in|fountain', shapes: [water], anchor: [560, 326], water: true },
    { id: 'on|fountain', shapes: [{ type: 'ring', outer, inner: water }], anchor: [477, 359], rim: true },
    { id: 'behind|fountain', shapes: [polygon([[286,277],[350,256],[477,246],[548,254],[565,267],[570,284],[562,292],[540,286],[477,282],[365,290],[289,303]])], anchor: [550, 273], behind: true },
    { id: 'in front of|fountain', shapes: [polygon([[300,414],[410,416],[540,416],[652,409],[686,460],[652,487],[296,487],[279,455]])], anchor: [477, 455] },
    { id: 'next to|fountain', shapes: [polygon([[214,320],[250,317],[252,406],[279,434],[231,455],[191,409]]), polygon([[704,319],[748,328],[773,414],[734,450],[702,413]])], anchors: [[231,410],[734,410]] },
    { id: 'over|fountain', shapes: [polygon([[330,80],[595,80],[590,219],[550,238],[400,232],[323,209]])], anchor: [477, 172], air: true, only: ['kite', 'balloon'] },
    { id: 'on|slide', shapes: [polygon([[632,275],[630,257],[639,247],[673,241],[695,224],[721,194],[744,169],[768,153],[787,152],[800,158],[817,155],[848,154],[880,154],[880,187],[817,187],[796,200],[774,221],[750,249],[719,271],[682,283],[650,282]])], anchor: [817,164], slide: true },
    { id: 'under|slide', shapes: [polygon([[776,195],[881,195],[881,279],[767,279],[744,265],[768,238]])], anchor: [837,257], under: true, slide: true },
    { id: 'in front of|slide', shapes: [polygon([[684,284],[772,282],[882,283],[946,282],[971,320],[940,342],[790,340],[718,329],[684,307]])], anchor: [820,315], slide: true },
    { id: 'next to|slide', shapes: [polygon([[570,275],[578,255],[598,231],[618,235],[652,236],[645,244],[628,249],[617,258],[619,281],[644,291],[675,294],[674,300],[658,302],[625,294],[594,284]]), polygon([[958,193],[995,204],[997,283],[978,315],[956,279]])], anchors: [[607,282],[980,263]], slide: true },
    { id: 'over|slide', shapes: [polygon([[736,20],[968,20],[968,78],[904,89],[791,86],[732,69]])], anchor: [845,53], air: true, slide: true, only: ['kite','balloon'] },
    { id: 'next to|big tree', shapes: [polygon([[128,369],[180,354],[222,391],[238,460],[171,481],[112,448]])], anchor: [181,445] }
  ];
  // The same rounded contours drive both hit testing and feedback.
  function rounded(shape) {
    if (shape.type !== 'polygon') return shape;
    const points = shape.points, n = points.length;
    const midpoint = (a,b) => [(a[0]+b[0])/2,(a[1]+b[1])/2];
    const start = midpoint(points[n-1],points[0]), samples = [];
    let from = start, curve = 'M'+start.join(' ');
    for (let i=0;i<n;i++) {
      const control=points[i], to=midpoint(control,points[(i+1)%n]);
      curve+='Q'+control.join(' ')+' '+to.join(' ');
      for(let step=0;step<16;step++) {
        const t=step/16,u=1-t;
        samples.push([u*u*from[0]+2*u*t*control[0]+t*t*to[0],u*u*from[1]+2*u*t*control[1]+t*t*to[1]]);
      }
      from=to;
    }
    return {type:'polygon',points:samples,curve:curve+'Z'};
  }
  const labels = {
    'in|fountain':[[477,326]], 'on|fountain':[[360,355]],
    'behind|fountain':[[477,275]], 'in front of|fountain':[[477,478]],
    'next to|fountain':[[225,445],[741,445]], 'over|fountain':[[477,130]],
    'on|slide':[[743,192]], 'under|slide':[[835,225]],
    'in front of|slide':[[820,331]], 'next to|slide':[[626,317],[964,314]],
    'over|slide':[[845,97]], 'next to|big tree':[[181,475]]
  };
  for (const zone of zones) {
    zone.shapes=zone.shapes.map(rounded);
    zone.preposition=zone.id.split('|')[0];
    zone.labels=labels[zone.id];
  }
  function outline(shape) {
    if (shape.type === 'polygon') return shape.points;
    if (shape.type === 'ring') return outline(shape.outer);
    return Array.from({ length: 96 }, (_, i) => {
      const a = i * Math.PI / 48;
      return [shape.x + shape.rx * Math.cos(a), shape.y + shape.ry * Math.sin(a)];
    });
  }
  function inside(p, shape) {
    if (shape.type === 'ring') return inside(p, shape.outer) && !inside(p, shape.inner);
    if (shape.type === 'ellipse') return ((p.x - shape.x) / shape.rx) ** 2 + ((p.y - shape.y) / shape.ry) ** 2 <= 1;
    let hit = false;
    const points = shape.points;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a[1] > p.y) !== (b[1] > p.y) && p.x < (b[0] - a[0]) * (p.y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  }
  function nearest(p, points) {
    let result = { x: points[0][0], y: points[0][1], distance: Infinity };
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy || 1)));
      const x = a[0]+t*dx, y = a[1]+t*dy, distance = Math.hypot(p.x-x,p.y-y);
      if (distance < result.distance) result = { x, y, distance };
    }
    return result;
  }
  function distance(p, shape) {
    if (inside(p, shape)) return 0;
    if (shape.type === 'ring') return Math.min(nearest(p, outline(shape.outer)).distance, nearest(p, outline(shape.inner)).distance);
    return nearest(p, outline(shape)).distance;
  }
  function allows(zone, object) { return zone.water || (zone.only ? zone.only.includes(object) : object !== 'balloon'); }
  function size(zone, object) {
    const sizes = { ball: 42, apple: 28, bottle: 48, teddy: 57, cat: 60, kite: 75, balloon: 76 };
    return sizes[object] * (zone.slide ? .7 : 1);
  }
  function pose(zone, object, p) {
    const s = size(zone, object);
    let a = zone.anchor;
    if (zone.anchors) a = zone.anchors.reduce((best, v) => Math.hypot(p.x-v[0],p.y-v[1]) < Math.hypot(p.x-best[0],p.y-best[1]) ? v : best);
    let x = a[0], y = a[1];
    if (zone.rim) {
      const angle = Math.atan2((p.y-326)/38,(p.x-477)/221);
      x = 477+204*Math.cos(angle); y = 326+30*Math.sin(angle)-s*.4;
    } else if (zone.water) {
      // Snap every object to one clear position at the water surface.
      x = a[0]; y = a[1];
    } else if (zone.behind) {
      x = p.x < 477 ? 370 : 580;
      y = 326-38*Math.sqrt(1-((x-477)/221)**2)-s*.1;
    } else if (zone.id === 'on|slide') {
      const q = nearest({x:p.x,y:p.y+s*.4}, [[647,269],[692,260],[746,215],[791,169],[818,166],[871,166]]);
      x=q.x; y=q.y-s*.4;
    } else if (!zone.air) y -= s*.4;
    return { x, y, size: s };
  }
  function intersectsBox(p, shape, width, height) {
    const left=p.x-width/2,right=p.x+width/2,top=p.y-height/2,bottom=p.y+height/2;
    const inBox=([x,y])=>x>=left&&x<=right&&y>=top&&y<=bottom;
    if ([[left,top],[right,top],[right,bottom],[left,bottom]].some(([x,y])=>inside({x,y},shape))) return true;
    const points=outline(shape);
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      if(inBox(a))return true;
      // Clip each contour segment against the dragged image rectangle.
      let from=0,to=1;
      for(const [origin,delta,min,max] of [[a[0],b[0]-a[0],left,right],[a[1],b[1]-a[1],top,bottom]]){
        if(delta===0){if(origin<min||origin>max){to=-1;break;}}
        else {const u=(min-origin)/delta,v=(max-origin)/delta;from=Math.max(from,Math.min(u,v));to=Math.min(to,Math.max(u,v));}
      }
      if(from<=to)return true;
    }
    return false;
  }
  function resolve(p, object, tolerance = 12, footprint = null) {
    if (p.x < 0 || p.x > 1000 || p.y < 0 || p.y > 500) return null;
    const found = zones.filter(z => allows(z, object)).map(zone => {
      const nearestShape=zone.shapes.map((shape,shapeIndex)=>({shapeIndex,distance:distance(p,shape)})).sort((a,b)=>a.distance-b.distance)[0];
      return {zone,...nearestShape};
    })
      .filter(v => v.distance <= tolerance).sort((a,b) => a.distance-b.distance);
    // Exact placement in another zone wins. Outside zones, touching any part
    // of the slide with the dragged image is enough to start its snap preview.
    let hit=found[0];
    if (footprint && hit?.distance !== 0) {
      const zone=zones.find(z=>z.id==='on|slide');
      if(allows(zone,object)){
        const shapeIndex=zone.shapes.findIndex(shape=>intersectsBox(p,shape,footprint.width,footprint.height));
        if(shapeIndex>=0)hit={zone,shapeIndex,distance:distance(p,zone.shapes[shapeIndex])};
      }
    }
    if (!hit) return null;
    return { ...hit, pose: pose(hit.zone, object, p) };
  }
  function path(shape) {
    if (shape.type === 'ring') return path(shape.outer) + path(shape.inner);
    if (shape.curve) return shape.curve;
    if (shape.type === 'ellipse') return `M${shape.x-shape.rx} ${shape.y}a${shape.rx} ${shape.ry} 0 1 0 ${shape.rx*2} 0a${shape.rx} ${shape.ry} 0 1 0 ${-shape.rx*2} 0Z`;
    const points = outline(shape);
    return 'M'+points.map(p => p.join(' ')).join('L')+'Z';
  }
  function feedbackRegion(hit) {
    const zone=hit.zone;
    const index=Number.isInteger(hit.shapeIndex)?hit.shapeIndex:zone.shapes.map((shape,i)=>({i,d:distance(hit.pose,shape)})).sort((a,b)=>a.d-b.d)[0].i;
    return {path:path(zone.shapes[index]),label:zone.labels[index]||zone.labels[0],preposition:zone.preposition,shapeIndex:index};
  }
  function captionPosition(preferred, width, height, pose) {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const fit = ([x,y]) => [clamp(x,width/2+6,994-width/2),clamp(y,height/2+4,496-height/2)];
    const clear = ([x,y]) => Math.abs(x-pose.x) >= (width+pose.size)/2+8 || Math.abs(y-pose.y) >= (height+pose.size)/2+8;
    const initial = fit(preferred);
    if (clear(initial)) return initial;
    // Try the closest unobstructed position around the complete sprite.
    const candidates = [
      [initial[0],pose.y+(pose.size+height)/2+10],
      [initial[0],pose.y-(pose.size+height)/2-10],
      [pose.x+(pose.size+width)/2+10,initial[1]],
      [pose.x-(pose.size+width)/2-10,initial[1]]
    ].map(fit).filter(clear);
    candidates.sort((a,b)=>Math.hypot(a[0]-initial[0],a[1]-initial[1])-Math.hypot(b[0]-initial[0],b[1]-initial[1]));
    return candidates[0] || initial;
  }
  const api = { zones, inside, distance, path, pose, resolve, allows, feedbackRegion, captionPosition };
  scope.TrainerGeometry = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
