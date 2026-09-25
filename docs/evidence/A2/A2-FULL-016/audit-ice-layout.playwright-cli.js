// playwright-cli run-code --filename docs/evidence/A2/A2-FULL-016/audit-ice-layout.playwright-cli.js
async (page) => {
  await page.goto('http://127.0.0.1:5181/');
  return page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { loadShowroomModel } = await import('/src/team-a/viewer/showroom-model.ts');
    const { MIC_POSITIONS, SPEAKER_POSITIONS, SOURCE_POSITIONS } = await import('/src/shared/lab-contracts.ts');
    const model = await loadShowroomModel('ice');
    model.group.updateMatrixWorld(true);
    const boundsOf = (id) => {
      const pivot = model.group.getObjectByName(`assembly-${id}`);
      const box = new THREE.Box3().setFromObject(pivot);
      return { min: box.min.toArray().map(v => +v.toFixed(3)), max: box.max.toArray().map(v => +v.toFixed(3)), center: box.getCenter(new THREE.Vector3()).toArray().map(v => +v.toFixed(3)) };
    };
    const headrestBand = (id, side = null) => {
      const mesh = model.group.getObjectByName(`assembly-${id}`).children[0];
      const pos = mesh.geometry.attributes.position, point = new THREE.Vector3(), vertices = [];
      for (let i = 0; i < pos.count; i++) {
        point.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        if (point.y < 1.34 || (side === 'left' && point.x < 0.16) || (side === 'right' && point.x > -0.16)) continue;
        vertices.push(point.clone());
      }
      const box = new THREE.Box3().setFromPoints(vertices);
      return { vertices: vertices.length, min: box.min.toArray().map(v => +v.toFixed(3)), max: box.max.toArray().map(v => +v.toFixed(3)), center: box.getCenter(new THREE.Vector3()).toArray().map(v => +v.toFixed(3)) };
    };
    const result = {
      source: model.source,
      wheelBounds: Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map(corner => [corner, boundsOf(`wheel-${corner}`)])),
      seatBounds: Object.fromEntries(['seat-front-left', 'seat-front-right', 'seat-rear-bench'].map(id => [id, boundsOf(id)])),
      headrestBands: {
        frontLeft: headrestBand('seat-front-left'), frontRight: headrestBand('seat-front-right'),
        rearLeft: headrestBand('seat-rear-bench', 'left'), rearRight: headrestBand('seat-rear-bench', 'right'),
      },
      frontDoorBounds: { left: boundsOf('door-left'), right: boundsOf('door-right') },
      existingShared: { microphones: MIC_POSITIONS, speakers: SPEAKER_POSITIONS, wheelSources: SOURCE_POSITIONS },
    };
    model.dispose();
    return result;
  });
}
