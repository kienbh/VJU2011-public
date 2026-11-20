import * as T from 'three';

const messages = [
  { id: 'dom-e', building: 'DOM-E', title: 'DOM-E',
    text: 'Nhắc các bạn chịu khó học, chơi điện tử ít thôi!', lines: [] as string[] },
  { id: 'dom-c', building: 'DOM-C', title: 'DOM-C', text: '5 điều Bác Hồ dạy', lines: [
    'Yêu Tổ quốc, yêu đồng bào',
    'Học tập tốt, lao động tốt',
    'Đoàn kết tốt, kỷ luật tốt',
    'Giữ gìn vệ sinh thật tốt',
    'Khiêm tốn, thật thà, dũng cảm.',
  ] },
];

/** Derive entrances from the scene so rotated/moved Dom blocks keep correct interaction. */
export function buildingMessages(scene: T.Scene) {
  scene.updateMatrixWorld(true);
  return messages.flatMap(message => {
    let building: T.Object3D | undefined;
    scene.traverse(node => { if (node.userData.displayName === message.building) building = node; });
    if (!building) return [];
    const node = building as T.Object3D;
    const position = node.localToWorld(new T.Vector3(node.userData.entryX, 0, node.userData.depth / 2 + 1));
    const front = new T.Vector3(0, 0, 1).transformDirection(node.matrixWorld);
    return [{ ...message, node, position, near(at: {x:number;z:number}) {
      const dx = at.x - position.x, dz = at.z - position.z;
      return dx * front.x + dz * front.z > 0 && Math.hypot(dx, dz) < 9;
    }}];
  });
}
