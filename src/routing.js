import {
  defaultAxisProfile,
  profileIsCrossSide,
  resolveGraphProfile,
} from "./axis-profile.js";
import {
  SAME_ROW_TOL,
  bumpPortSideUse,
  claimPreferredPortOwners,
  crossSideTowardTarget,
  exclusiveSideChoices,
  pickInSideByGeometry,
  pickOutSideByGeometry,
  pickSidePreferringFree,
  portSideUseCount,
  selectBestPortCandidate,
} from "./port-planner.js";
import { createKeyMap } from "./key-map.js";
import { GRAPH_COMPOUND_PAD } from "./geometry-config.js";
import {
  countRouteBends,
  orthogonalAStarRoute,
  orthogonalSegmentHitsRectInterior,
  removeDuplicatePoints,
  routeEndStubLength,
  routeHitsRects,
  routeTotalLength,
  segmentsProperlyIntersect,
  simplifyOrthogonalPoints,
} from "./routing-geometry.js";
import {
  edgeLevel,
  nodeAncestorIds,
  nodeDescendantIds,
  nodeIsGraphWrapper,
  nodeIsParent,
  nodeLevel,
} from "./routing-context.js";

export {
  claimPreferredPortOwners,
  isSameCrossRow,
  pickInSideByGeometry,
  pickOutSideByGeometry,
} from "./port-planner.js";

/* ---------- 选口 + 流程线 ---------- */

  var collectGraphEdges = function collectGraphEdges(layoutGraph, out) {
    out = out || [];
    var edges = (layoutGraph && layoutGraph.edges) || [];
    for (var i = 0; i < edges.length; i++) out.push(edges[i]);
    var children = (layoutGraph && layoutGraph.children) || [];
    for (var c = 0; c < children.length; c++) collectGraphEdges(children[c], out);
    return out;
  };

  var getLayoutEdgePoints = function getLayoutEdgePoints(layoutEdge) {
    var sections = (layoutEdge && layoutEdge.sections) || [];
    var points = [];
    for (var s = 0; s < sections.length; s++) {
      var sec = sections[s];
      if (!sec || !sec.startPoint || !sec.endPoint) continue;
      if (points.length === 0) {
        points.push({ x: sec.startPoint.x, y: sec.startPoint.y });
      } else {
        var last = points[points.length - 1];
        if (
          Math.abs(last.x - sec.startPoint.x) > 0.01 ||
          Math.abs(last.y - sec.startPoint.y) > 0.01
        ) {
          points.push({ x: sec.startPoint.x, y: sec.startPoint.y });
        }
      }
      var bends = sec.bendPoints || [];
      for (var bi = 0; bi < bends.length; bi++)
        points.push({ x: bends[bi].x, y: bends[bi].y });
      points.push({ x: sec.endPoint.x, y: sec.endPoint.y });
    }
    return points;
  };

  /**
   * 叶子端口约定（含子图内叶子）：
   * - 每端最低 Level 的边：随 AxisProfile 前向出/入侧正中出入
   * - 交叉边：半区附着（禁止走交叉边中点）
   * - 其余边：两遍排点后评分筛侧 → 流程线计算几何
   */
  /**
   * 交叉边沿主轴半区比例（避开 0.5 中点）。
   * 坐标系正半用 PORT_CROSS_FWD_RATIO；入走主轴反方向半区、出走前进半区。
   * RIGHT/DOWN（forwardSign+）：入低出高；LEFT/UP（forwardSign−）：入高出低。
   */
  var PORT_CROSS_REAR_RATIO = 0.28;
  var PORT_CROSS_FWD_RATIO = 0.72;
  // 旧名兼容（测试/注释）；语义=坐标系负半/正半，非固定「入/出」
  var PORT_CROSS_IN_RATIO = PORT_CROSS_REAR_RATIO;
  var PORT_CROSS_OUT_RATIO = PORT_CROSS_FWD_RATIO;

  /**
   * 交叉边 end→沿主轴比例（随 forwardSign 翻转）。
   * 水平主轴（顶/底边）：用 0.28/0.72 半区。
   * 竖直主轴（左/右边）：节点高度窄，只用轻分位（约 1/3·2/3），正式占槽由全高均分完成。
   */
export var crossEndRatio = function crossEndRatio(end, profile) {
    var sign =
      profile && typeof profile.forwardSign === "number"
        ? profile.forwardSign
        : 1;
    var verticalMain = profile && profile.axis === "y";
    var fwd = verticalMain ? 0.67 : PORT_CROSS_FWD_RATIO;
    var rear = verticalMain ? 0.33 : PORT_CROSS_REAR_RATIO;
    if (end === "out") return sign < 0 ? rear : fwd;
    return sign < 0 ? fwd : rear;
  };

  /** 所有叶子均参与精修（含 compound 内叶子；排除 parent 容器） */
  var isLeafNode = function isLeafNode(nodeK) {
    return !!nodeK && !nodeIsParent(nodeK);
  };

  /** 展开的 Graph 包装框（compound parent）；外部边可挂前向输入/输出端口。 */
  var isGraphWrapper = function isGraphWrapper(nodeK) {
    return nodeIsGraphWrapper(nodeK);
  };

  /** Side-port targets: leaf nodes and expanded graph containers. */
  var canAttachSidePort = function canAttachSidePort(nodeK) {
    return isLeafNode(nodeK) || isGraphWrapper(nodeK);
  };

  // Keep in sync with Cytoscape compound padding (top reserves title space).
export { GRAPH_COMPOUND_PAD };

  var syncNodeSizeFromAbs = function syncNodeSizeFromAbs(nodeK, abs) {
    if (!nodeK || !abs) return;
    if (abs.width > 1) nodeK.width = abs.width;
    if (abs.height > 1) nodeK.height = abs.height;
  };

  /**
   * Graph 包装框：子节点包围盒（Cy 均匀 padding 下，可视框中心 = 内容包围盒中点）。
   * Do not use height/2: asymmetric title padding shifts the visible midpoint.
   */
  var graphWrapperContentBounds = function graphWrapperContentBounds(nodeK) {
    var children = (nodeK && nodeK.children) || [];
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      if (!c) continue;
      var x0 = c.x || 0;
      var y0 = c.y || 0;
      var x1 = x0 + (c.width || 0);
      var y1 = y0 + (c.height || 0);
      if (x0 < minX) minX = x0;
      if (y0 < minY) minY = y0;
      if (x1 > maxX) maxX = x1;
      if (y1 > maxY) maxY = y1;
    }
    if (!children.length || !isFinite(minY)) {
      var fw = nodeK && nodeK.width > 0 ? nodeK.width : 220;
      var fh = nodeK && nodeK.height > 0 ? nodeK.height : 64;
      return {
        minX: 0,
        minY: 0,
        maxX: fw,
        maxY: fh,
        midX: fw / 2,
        midY: fh / 2,
      };
    }
    return {
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY,
      midX: (minX + maxX) / 2,
      midY: (minY + maxY) / 2,
    };
  };

  /**
   * Expanded graph wrapper size, repaired when the portable layout is smaller
   * than the rendered child bounds.
   * 尺寸与 Cy 可视框对齐：内容跨度 + 四边 COMPOUND_PAD_CY（均匀 29）。
   */
  var measureGraphWrapperSize = function measureGraphWrapperSize(nodeK) {
    var pad = GRAPH_COMPOUND_PAD;
    var cyPad = pad.top; // 与 stylesheet compound padding 一致
    var b = graphWrapperContentBounds(nodeK);
    var fromKids = {
      width: b.maxX - b.minX + cyPad * 2,
      height: b.maxY - b.minY + cyPad * 2,
    };
    // Layout coordinates are relative to the wrapper's top-left origin.
    var fromLayoutOrigin = {
      width: b.maxX + pad.right,
      height: b.maxY + pad.bottom,
    };
    var w = Math.max(
      nodeK.width || 0,
      fromKids.width,
      fromLayoutOrigin.width,
      220,
    );
    var h = Math.max(
      nodeK.height || 0,
      fromKids.height,
      fromLayoutOrigin.height,
      64,
    );
    return { width: w, height: h, bounds: b };
  };

  var syncGraphWrapperSize = function syncGraphWrapperSize(nodeK) {
    if (!isGraphWrapper(nodeK)) return;
    var box = measureGraphWrapperSize(nodeK);
    nodeK.width = box.width;
    nodeK.height = box.height;
  };

  /**
   * Expanded Graph 的外部轨道端口必须与其内部 Level 0 腰线对齐。
   * Builtin layout 会直接携带该锚点；自定义 layout 缺失时从 Level 0
   * 子节点递归推导，最后才回退到内容包围盒中点。
   */
  var graphWrapperLevelZeroCross = function graphWrapperLevelZeroCross(
    nodeK,
    profile,
  ) {
    var p = profile || defaultAxisProfile();
    var explicit = nodeK && nodeK._levelZeroAnchor;
    if (explicit && Number.isFinite(explicit[p.cross])) {
      return explicit[p.cross];
    }
    var children = (nodeK && nodeK.children) || [];
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var level = nodeLevel(child);
      if (level !== 0) continue;
      var origin = p.cross === "y" ? child.y || 0 : child.x || 0;
      if (isGraphWrapper(child)) {
        return origin + graphWrapperLevelZeroCross(child, p);
      }
      var size = p.cross === "y" ? child.height || 0 : child.width || 0;
      return origin + size / 2;
    }
    var bounds = graphWrapperContentBounds(nodeK);
    return p.cross === "y" ? bounds.midY : bounds.midX;
  };

  var pinRailPortsToWrapperLevelZero = function pinRailPortsToWrapperLevelZero(
    nodeK,
    profile,
  ) {
    if (!isGraphWrapper(nodeK) || !nodeK.ports || !nodeK.ports.length) return;
    syncGraphWrapperSize(nodeK);
    var w = nodeK.width;
    var h = nodeK.height;
    var p = profile || defaultAxisProfile();
    var railCross = graphWrapperLevelZeroCross(nodeK, p);
    for (var i = 0; i < nodeK.ports.length; i++) {
      var port = nodeK.ports[i];
      if (!port || !port._railAnchor) continue;
      var side = portSideOf(port);
      if (side === p.inSide || side === p.outSide) {
        if (p.axis === "x") {
          port.x = side === "EAST" ? w : 0;
          port.y = railCross;
        } else {
          port.x = railCross;
          port.y = side === "SOUTH" ? h : 0;
        }
      }
    }
  };

  var ensureNodePorts = function ensureNodePorts(nodeK) {
    if (!nodeK.ports) nodeK.ports = [];
    if (nodeK._portSeq == null) nodeK._portSeq = 0;
  };

  /** 节点局部坐标上的端口位置（相对节点左上角）；主轴边取交叉中点，交叉边沿主轴半区 */
export var portLocalOnNode = function portLocalOnNode(side, w, h, end, profile) {
    var width = w > 0 ? w : 220;
    var height = h > 0 ? h : 64;
    var p = profile || defaultAxisProfile();
    var forward = side === p.outSide || side === p.inSide;
    if (forward) {
      if (side === "WEST") return { x: 0, y: height / 2 };
      if (side === "EAST") return { x: width, y: height / 2 };
      if (side === "NORTH") return { x: width / 2, y: 0 };
      if (side === "SOUTH") return { x: width / 2, y: height };
    }
    // 交叉边：出=前进半区，入=反方向半区（LEFT：上出偏左、上进偏右）
    var ratio = crossEndRatio(end, p);
    if (side === "NORTH") return { x: width * ratio, y: 0 };
    if (side === "SOUTH") return { x: width * ratio, y: height };
    if (side === "WEST") return { x: 0, y: height * ratio };
    if (side === "EAST") return { x: width, y: height * ratio };
    return { x: width / 2, y: height / 2 };
  };

  /**
   * @param end 'in'|'out' — 交叉边：出=前进半区、入=反方向半区（随 forwardSign）；主轴边先交叉中点再散布
   * @param railAnchor 当前节点最低 Level 的端口：独侧时锁交叉轴正中
   * @param peerId 对端节点 id（入←source / 出→target），用于主轴边口序防交叉
   * @param profile AxisProfile；缺省 RIGHT
   */
  var addSidePort = function addSidePort(
    nodeK,
    nodeId,
    side,
    tag,
    end,
    railAnchor,
    peerId,
    profile,
  ) {
    // 叶子 + 展开 Graph 包装框可挂外部边端口；其它 parent 仍不挂
    if (!canAttachSidePort(nodeK)) return null;
    ensureNodePorts(nodeK);
    var local = portLocalOnNode(
      side,
      nodeK.width,
      nodeK.height,
      end,
      profile,
    );
    var pid = nodeId + ":" + tag + "-" + nodeK._portSeq++;
    nodeK.ports.push({
      id: pid,
      x: local.x,
      y: local.y,
      width: 0,
      height: 0,
      _end: end || "out",
      _railAnchor: !!railAnchor,
      _peerId: peerId || null,
      side: side,
    });
    return pid;
  };

  /** Spread same-side ports while preserving their directional half. */
  var PORT_SPREAD_GAP = 16;
  var PORT_SPREAD_MARGIN = 10;
  /** 入边对端在侧外时，从端点再内缩，避免落在包装框转角上（看起来像从顶/底进） */
  var PORT_CORNER_INSET = 64;

  var clampOnSideTowardPeer = function clampOnSideTowardPeer(
    unclamped,
    lo,
    hi,
    isIn,
  ) {
    var v = Math.min(hi, Math.max(lo, unclamped));
    if (!isIn) return v;
    var inset = Math.min(PORT_CORNER_INSET, Math.max(0, (hi - lo) * 0.25));
    if (unclamped < lo) return Math.min(hi, lo + inset);
    if (unclamped > hi) return Math.max(lo, hi - inset);
    return v;
  };

  /** 对端中心坐标；缺失时回退极大值，稳定排在末尾 */
  var peerCenter = function peerCenter(port, absLookup, axis) {
    var peer = port._peerId && absLookup ? absLookup[port._peerId] : null;
    if (!peer) return Number.POSITIVE_INFINITY;
    if (axis === "y") return peer.y + peer.height / 2;
    return peer.x + peer.width / 2;
  };

  var sortPortsByPeer = function sortPortsByPeer(ports, absLookup, axis) {
    return ports.slice().sort(function (a, b) {
      var da = peerCenter(a, absLookup, axis);
      var db = peerCenter(b, absLookup, axis);
      if (da !== db) return da - db;
      if (a._railAnchor !== b._railAnchor) return a._railAnchor ? -1 : 1;
      return String(a.id).localeCompare(String(b.id));
    });
  };

  /**
   * 包装框前向侧的非锚定端口：贴对端交叉坐标并避开轨道腰线。
   * 多口间距不够时返回 false，由调用方回退等分槽。
   */
  var placeMainSideTowardPeers = function placeMainSideTowardPeers(
    rest,
    absLookup,
    axis,
    fixedX,
    fixedY,
    w,
    h,
    nodeAbs,
    avoidMid,
  ) {
    var ordered = sortPortsByPeer(rest, absLookup, axis);
    var m = PORT_SPREAD_MARGIN;
    var gap = PORT_SPREAD_GAP;
    var span = axis === "y" ? h : w;
    var lo = m;
    var hi = Math.max(m, span - m);
    var mid = span / 2;
    var used = [];
    var pts = [];
    var t;
    for (t = 0; t < ordered.length; t++) {
      var raw = peerCenter(ordered[t], absLookup, axis);
      var origin = axis === "y" ? nodeAbs.y : nodeAbs.x;
      var unclamped = isFinite(raw) ? raw - origin : mid;
      var v = clampOnSideTowardPeer(
        unclamped,
        lo,
        hi,
        ordered[t]._end === "in",
      );
      if (avoidMid && v > mid - gap && v < mid + gap) {
        v = v >= mid ? Math.min(hi, mid + gap) : Math.max(lo, mid - gap);
      }
      var u;
      for (u = 0; u < used.length; u++) {
        if (Math.abs(used[u] - v) < gap) return false;
      }
      used.push(v);
      pts.push(v);
    }
    for (t = 0; t < ordered.length; t++) {
      if (axis === "y") {
        ordered[t].x = fixedX;
        ordered[t].y = pts[t];
      } else {
        ordered[t].x = pts[t];
        ordered[t].y = fixedY;
      }
    }
    return true;
  };

  /** 对端中心到候选附着点（节点局部坐标）的曼哈顿距 */
  var peerManhattanToAttach = function peerManhattanToAttach(
    port,
    nodeAbs,
    absLookup,
    localX,
    localY,
  ) {
    var peer = port._peerId && absLookup ? absLookup[port._peerId] : null;
    if (!peer || !nodeAbs) return Number.POSITIVE_INFINITY;
    var px = peer.x + peer.width / 2;
    var py = peer.y + peer.height / 2;
    return (
      Math.abs(px - (nodeAbs.x + localX)) + Math.abs(py - (nodeAbs.y + localY))
    );
  };

  /** 对端到本节点中心的曼哈顿距：越小越「近源」 */
  var peerManhattanToNode = function peerManhattanToNode(
    port,
    nodeAbs,
    absLookup,
  ) {
    if (!nodeAbs) return Number.POSITIVE_INFINITY;
    return peerManhattanToAttach(
      port,
      nodeAbs,
      absLookup,
      nodeAbs.width / 2,
      nodeAbs.height / 2,
    );
  };

  /**
   * 近源优先贪心占口：近源选最短槽，远源吃剩余（更长路径），减少上边交叉。
   */
  var assignSlotsNearFirst = function assignSlotsNearFirst(
    group,
    nodeAbs,
    absLookup,
    slots,
    fixedY,
    fixedX,
  ) {
    if (!group.length || !slots.length) return;
    var ordered = group.slice().sort(function (a, b) {
      var da = peerManhattanToNode(a, nodeAbs, absLookup);
      var db = peerManhattanToNode(b, nodeAbs, absLookup);
      if (da !== db) return da - db;
      if (a._railAnchor !== b._railAnchor) return a._railAnchor ? -1 : 1;
      return String(a.id).localeCompare(String(b.id));
    });
    var used = createKeyMap();
    for (var i = 0; i < ordered.length; i++) {
      var port = ordered[i];
      var bestJ = -1;
      var bestLen = Infinity;
      for (var j = 0; j < slots.length; j++) {
        if (used[j]) continue;
        var lx = fixedX != null ? fixedX : slots[j];
        var ly = fixedY != null ? fixedY : slots[j];
        var len = peerManhattanToAttach(port, nodeAbs, absLookup, lx, ly);
        if (len < bestLen) {
          bestLen = len;
          bestJ = j;
        }
      }
      if (bestJ < 0) bestJ = Math.min(i, slots.length - 1);
      used[bestJ] = true;
      if (fixedY != null) {
        port.x = slots[bestJ];
        port.y = fixedY;
      } else {
        port.x = fixedX;
        port.y = slots[bestJ];
      }
    }
  };

  var findPortById = function findPortById(nodeK, portId) {
    if (!nodeK || !nodeK.ports || !portId) return null;
    for (var i = 0; i < nodeK.ports.length; i++) {
      if (nodeK.ports[i].id === portId) return nodeK.ports[i];
    }
    return null;
  };

  var portAbsOnNode = function portAbsOnNode(nodeK, abs, portId) {
    var port = findPortById(nodeK, portId);
    if (!port || !abs) return null;
    return { x: abs.x + (port.x || 0), y: abs.y + (port.y || 0) };
  };

  var portSideOf = function portSideOf(port) {
    return port ? port.side || null : null;
  };

  /** 任何边折点硬顶：只允许 1 折或 2 折，超过 2 折一律非法 */
  var MAX_BENDS_ABSOLUTE = 2;

  /**
   * 折点预算（硬规则，相对 AxisProfile）：
   * - 两端皆为交叉侧 → 最多 2 折
   * - 其余 → 最多 1 折
   * - 全局：永不允许超过 MAX_BENDS_ABSOLUTE（2）
   */
export var maxBendsForSides = function maxBendsForSides(os, is, profile) {
    var cap = MAX_BENDS_ABSOLUTE;
    if (!os || !is) return cap;
    var p = profile || defaultAxisProfile();
    var osMain = os === p.outSide || os === p.inSide;
    var isMain = is === p.outSide || is === p.inSide;
    // 两端同向（主轴↔主轴，如 EAST→WEST；或交叉↔交叉）需要中间一次变向 → 最多 2 折；
    // 一主一交叉 → 1 折。否则 EAST→WEST 且不同行时，正交互连线必然 2 折却被判非法，
    // 被迫回退到绕远兜底。
    return Math.min(osMain === isMain ? 2 : 1, cap);
  };

  /**
   * 将 [lo, hi] 均分成 n 段，每段取中点（N 口通用）。
   * n=1→中点；n=2→两半中点；n=3→三等分中点（含正中）…
   */
  var equalSegmentMidpoints = function equalSegmentMidpoints(n, lo, hi) {
    var out = [];
    if (n <= 0) return out;
    var span = Math.max(0, hi - lo);
    if (span < 1e-6) {
      for (var z = 0; z < n; z++) out.push(lo);
      return out;
    }
    var seg = span / n;
    for (var i = 0; i < n; i++) {
      out.push(lo + (i + 0.5) * seg);
    }
    return out;
  };

  /**
   * 左右缘占口算法（Y 从小到大）：
   * 在可用高度上 N 等分，每段中点一槽。
   * avoidMid：轨道锚点占中时，上/下两带各自再 N 等分中点，不进中点禁带。
   */
  var buildVerticalSlots = function buildVerticalSlots(count, h, avoidMid) {
    if (count <= 0) return [];
    var mid = h / 2;
    var gap = PORT_SPREAD_GAP;
    var margin = PORT_SPREAD_MARGIN;
    var lo = margin;
    var hi = Math.max(margin, h - margin);
    if (!avoidMid) {
      return equalSegmentMidpoints(count, lo, hi);
    }
    var upLo = lo;
    var upHi = mid - gap;
    var dnLo = mid + gap;
    var dnHi = hi;
    var nUp = Math.floor(count / 2);
    var nDn = count - nUp;
    return equalSegmentMidpoints(nUp, upLo, Math.max(upLo, upHi)).concat(
      equalSegmentMidpoints(nDn, dnLo, Math.max(dnLo, dnHi)),
    );
  };

  /** 水平主轴边占口槽（X）：buildVerticalSlots 的镜像 */
  var buildHorizontalSlots = function buildHorizontalSlots(count, w, avoidMid) {
    if (count <= 0) return [];
    var mid = w / 2;
    var gap = PORT_SPREAD_GAP;
    var margin = PORT_SPREAD_MARGIN;
    var lo = margin;
    var hi = Math.max(margin, w - margin);
    if (!avoidMid) {
      return equalSegmentMidpoints(count, lo, hi);
    }
    var leftLo = lo;
    var leftHi = mid - gap;
    var rightLo = mid + gap;
    var rightHi = hi;
    var nLeft = Math.floor(count / 2);
    var nRight = count - nLeft;
    return equalSegmentMidpoints(
      nLeft,
      leftLo,
      Math.max(leftLo, leftHi),
    ).concat(
      equalSegmentMidpoints(nRight, rightLo, Math.max(rightLo, rightHi)),
    );
  };

  /**
   * 同侧端口（只选点，不改走线）：
   * - 主轴边：沿交叉轴 N 等分 + 对端交叉坐标单调占槽；轨道锚点锁中点
   * - 交叉边：沿主轴等分 + 半区；近源优先占槽
   * 单肘弯等几何由流程线计算负责，禁止回写 port 坐标。
   */
  var spreadFixedPortsOnNode = function spreadFixedPortsOnNode(
    nodeK,
    absLookup,
    profile,
  ) {
    if (!nodeK || !nodeK.ports || !nodeK.ports.length) return;
    var w = nodeK.width > 0 ? nodeK.width : 220;
    var h = nodeK.height > 0 ? nodeK.height : 64;
    var prof = profile || defaultAxisProfile();
    var nodeAbs = absLookup[nodeK.id] || {
      x: nodeK.x || 0,
      y: nodeK.y || 0,
      width: w,
      height: h,
    };
    var bySide = {
      NORTH: [],
      EAST: [],
      SOUTH: [],
      WEST: [],
    };
    for (var i = 0; i < nodeK.ports.length; i++) {
      var port = nodeK.ports[i];
      var side = portSideOf(port);
      if (bySide[side]) bySide[side].push(port);
    }
    /** 竖直边（主轴=x）：按对端 Y 排序后与槽位一一对应 */
    var placeVerticalByPeerY = function placeVerticalByPeerY(ports, x) {
      if (!ports.length) return;
      var anchorList = [];
      var rest = [];
      for (var j = 0; j < ports.length; j++) {
        if (ports[j]._railAnchor) anchorList.push(ports[j]);
        else rest.push(ports[j]);
      }
      for (var c = 0; c < anchorList.length; c++) {
        anchorList[c].x = x;
        anchorList[c].y = h / 2;
      }
      if (!rest.length) {
        if (!anchorList.length && ports.length === 1) {
          ports[0].x = x;
          ports[0].y = h / 2;
        }
        return;
      }
      if (
        isGraphWrapper(nodeK) &&
        placeMainSideTowardPeers(
          rest,
          absLookup,
          "y",
          x,
          null,
          w,
          h,
          nodeAbs,
          anchorList.length > 0,
        )
      ) {
        return;
      }
      var ys = buildVerticalSlots(rest.length, h, anchorList.length > 0)
        .slice()
        .sort(function (a, b) {
          return a - b;
        });
      var ordered = sortPortsByPeer(rest, absLookup, "y");
      for (var t = 0; t < ordered.length; t++) {
        ordered[t].x = x;
        ordered[t].y = ys[t] != null ? ys[t] : h / 2;
      }
    };
    /** 水平边（主轴=y）：按对端 X 排序后与槽位一一对应（placeVerticalByPeerY 镜像） */
    var placeHorizontalByPeerX = function placeHorizontalByPeerX(ports, y) {
      if (!ports.length) return;
      var anchorList = [];
      var rest = [];
      for (var j = 0; j < ports.length; j++) {
        if (ports[j]._railAnchor) anchorList.push(ports[j]);
        else rest.push(ports[j]);
      }
      for (var c = 0; c < anchorList.length; c++) {
        anchorList[c].x = w / 2;
        anchorList[c].y = y;
      }
      if (!rest.length) {
        if (!anchorList.length && ports.length === 1) {
          ports[0].x = w / 2;
          ports[0].y = y;
        }
        return;
      }
      if (
        isGraphWrapper(nodeK) &&
        placeMainSideTowardPeers(
          rest,
          absLookup,
          "x",
          null,
          y,
          w,
          h,
          nodeAbs,
          anchorList.length > 0,
        )
      ) {
        return;
      }
      var xs = buildHorizontalSlots(rest.length, w, anchorList.length > 0)
        .slice()
        .sort(function (a, b) {
          return a - b;
        });
      var ordered = sortPortsByPeer(rest, absLookup, "x");
      for (var t = 0; t < ordered.length; t++) {
        ordered[t].x = xs[t] != null ? xs[t] : w / 2;
        ordered[t].y = y;
      }
    };
    var placeHorizontalHalf = function placeHorizontalHalf(group, y, lo, hi) {
      if (!group.length) return;
      var slots = equalSegmentMidpoints(group.length, lo, Math.max(lo, hi));
      assignSlotsNearFirst(group, nodeAbs, absLookup, slots, y, null);
    };
    var placeVerticalHalf = function placeVerticalHalf(group, x, lo, hi) {
      if (!group.length) return;
      var slots = equalSegmentMidpoints(group.length, lo, Math.max(lo, hi));
      assignSlotsNearFirst(group, nodeAbs, absLookup, slots, null, x);
    };
    /**
     * 交叉边占槽：
     * - 水平主轴（顶/底）：中线硬拆半区（入反方向半 / 出前进半）
     * - 竖直主轴（左/右）：高度窄，不中线硬拆；全高均分，仅保证
     *   DOWN 上入下出 / UP 下入上出 的相对顺序 + 间距
     */
    var placeAlongMainOnCrossSide = function placeAlongMainOnCrossSide(
      ports,
      fixed,
      mainAxis,
    ) {
      var groupIn = [];
      var groupOut = [];
      for (var k = 0; k < ports.length; k++) {
        if (ports[k]._end === "in") groupIn.push(ports[k]);
        else groupOut.push(ports[k]);
      }
      var m = PORT_SPREAD_MARGIN;
      var split = PORT_SPREAD_GAP / 2;
      var sign = typeof prof.forwardSign === "number" ? prof.forwardSign : 1;
      if (mainAxis === "x") {
        // RIGHT/LEFT 顶底边：半区硬拆
        var loGroup = sign < 0 ? groupOut : groupIn;
        var hiGroup = sign < 0 ? groupIn : groupOut;
        var midX = w / 2;
        placeHorizontalHalf(loGroup, fixed, m, Math.max(m, midX - split));
        placeHorizontalHalf(
          hiGroup,
          fixed,
          Math.min(w - m, midX + split),
          w - m,
        );
        return;
      }
      // DOWN/UP 左右边：全高均分；sign+ → 入在上、出在下；sign− → 出在上、入在下
      var ordered =
        sign < 0 ? groupOut.concat(groupIn) : groupIn.concat(groupOut);
      if (!ordered.length) return;
      var slots = equalSegmentMidpoints(ordered.length, m, Math.max(m, h - m));
      for (var oi = 0; oi < ordered.length; oi++) {
        ordered[oi].x = fixed;
        ordered[oi].y = slots[oi] != null ? slots[oi] : h / 2;
      }
    };
    var sideNames = ["NORTH", "EAST", "SOUTH", "WEST"];
    for (var s = 0; s < sideNames.length; s++) {
      var sn = sideNames[s];
      var portsOnSide = bySide[sn];
      if (!portsOnSide.length) continue;
      if (sn === prof.outSide || sn === prof.inSide) {
        if (prof.axis === "x") {
          placeVerticalByPeerY(portsOnSide, sn === "EAST" ? w : 0);
        } else {
          placeHorizontalByPeerX(portsOnSide, sn === "SOUTH" ? h : 0);
        }
      } else if (profileIsCrossSide(prof, sn)) {
        if (prof.axis === "x") {
          placeAlongMainOnCrossSide(portsOnSide, sn === "SOUTH" ? h : 0, "x");
        } else {
          placeAlongMainOnCrossSide(portsOnSide, sn === "EAST" ? w : 0, "y");
        }
      }
    }
  };

  /** 单肘弯：第一段必垂直出边 */
  var buildOneBendAbsRoute = function buildOneBendAbsRoute(
    sx,
    sy,
    tx,
    ty,
    outSide,
  ) {
    if (outSide === "NORTH" || outSide === "SOUTH") {
      return [
        {
          x: sx,
          y: sy,
        },
        {
          x: sx,
          y: ty,
        },
        {
          x: tx,
          y: ty,
        },
      ];
    }
    return [
      {
        x: sx,
        y: sy,
      },
      {
        x: tx,
        y: sy,
      },
      {
        x: tx,
        y: ty,
      },
    ];
  };

  /**
   * 按折点预算生成「出边垂直」正交路径（1 或 2 折）。
   * channelHint: outer wrapper channel using the configured node clearance.
   */
  var buildCappedPerpRoute = function buildCappedPerpRoute(
    sx,
    sy,
    tx,
    ty,
    os,
    cap,
    channelHint,
  ) {
    var ch = channelHint || {};
    if (cap <= 1) {
      return removeDuplicatePoints(
        buildOneBendAbsRoute(sx, sy, tx, ty, os),
        0.5,
      );
    }
    // 2 折：先垂直离开 → 沿通道 → 再接到目标
    if (os === "SOUTH") {
      var yCh = ch.y != null ? ch.y : Math.max(sy + PORT_CHANNEL, ty);
      return removeDuplicatePoints(
        [
          {
            x: sx,
            y: sy,
          },
          {
            x: sx,
            y: yCh,
          },
          {
            x: tx,
            y: yCh,
          },
          {
            x: tx,
            y: ty,
          },
        ],
        0.5,
      );
    }
    if (os === "NORTH") {
      var yChN = ch.y != null ? ch.y : Math.min(sy - PORT_CHANNEL, ty);
      return removeDuplicatePoints(
        [
          {
            x: sx,
            y: sy,
          },
          {
            x: sx,
            y: yChN,
          },
          {
            x: tx,
            y: yChN,
          },
          {
            x: tx,
            y: ty,
          },
        ],
        0.5,
      );
    }
    if (os === "EAST") {
      var xCh = ch.x != null ? ch.x : Math.max(sx + PORT_CHANNEL, tx);
      return removeDuplicatePoints(
        [
          {
            x: sx,
            y: sy,
          },
          {
            x: xCh,
            y: sy,
          },
          {
            x: xCh,
            y: ty,
          },
          {
            x: tx,
            y: ty,
          },
        ],
        0.5,
      );
    }
    var xChW = ch.x != null ? ch.x : Math.min(sx - PORT_CHANNEL, tx);
    return removeDuplicatePoints(
      [
        {
          x: sx,
          y: sy,
        },
        {
          x: xChW,
          y: sy,
        },
        {
          x: xChW,
          y: ty,
        },
        {
          x: tx,
          y: ty,
        },
      ],
      0.5,
    );
  };

  /** 叶子所在包装框绝对矩形（仅几何参考；包装框本身不是 Node） */
  var wrapperAbsOfLeaf = function wrapperAbsOfLeaf(leafK, absLookup) {
    var ancestors = nodeAncestorIds(leafK);
    return ancestors.length ? absLookup[ancestors[0]] || null : null;
  };

  /** Read a numeric spacing option from the portable layout configuration. */
  var readLayoutOptionNumber = function readLayoutOptionNumber(opts, key, fallback) {
    if (!opts) return fallback;
    var v = opts.spacing && opts.spacing[key];
    if (v == null) v = opts[key];
    var n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) ? n : fallback;
  };

  /**
   * Read spacing around a leaf, preferring its parent graph configuration.
   */
  var spacingAroundLeaf = function spacingAroundLeaf(
    leafK,
    graph,
    key,
    fallback,
  ) {
    if (!leafK || !graph) {
      return readLayoutOptionNumber(graph && graph.layoutOptions, key, fallback);
    }
    var ancestors = nodeAncestorIds(leafK);
    if (ancestors.length > 1 && graph._elementLookup) {
      var pk = graph._elementLookup[ancestors[1]];
      if (pk && pk.layoutOptions) {
        return readLayoutOptionNumber(pk.layoutOptions, key, fallback);
      }
    }
    return readLayoutOptionNumber(graph.layoutOptions, key, fallback);
  };

  var edgeNodeSpacingAroundLeaf = function edgeNodeSpacingAroundLeaf(
    leafK,
    graph,
  ) {
    return spacingAroundLeaf(leafK, graph, "edgeNode", 33);
  };

  /** South channel: wrapper bottom plus the configured node clearance. */
  var southChannelY = function southChannelY(srcK, srcAbs, absLookup, graph) {
    var gap = edgeNodeSpacingAroundLeaf(srcK, graph);
    var wrap = wrapperAbsOfLeaf(srcK, absLookup);
    if (wrap) return wrap.y + wrap.height + gap;
    return srcAbs.y + srcAbs.height + gap;
  };

  /** North channel: wrapper top minus the configured node clearance. */
  var northChannelY = function northChannelY(srcK, srcAbs, absLookup, graph) {
    var gap = edgeNodeSpacingAroundLeaf(srcK, graph);
    var wrap = wrapperAbsOfLeaf(srcK, absLookup);
    if (wrap) return wrap.y - gap;
    return srcAbs.y - gap;
  };

  /** 统计叶子节点上已有出/入端口的侧占用。 */
  var collectExistingPortSideUse = function collectExistingPortSideUse(
    elementLookup,
  ) {
    var outUse = createKeyMap();
    var inUse = createKeyMap();
    Object.keys(elementLookup || {}).forEach(function (id) {
      var node = elementLookup[id];
      if (!canAttachSidePort(node) || !node.ports) return;
      for (var i = 0; i < node.ports.length; i++) {
        var port = node.ports[i];
        var side = portSideOf(port);
        if (!side) continue;
        if (port._end === "in") bumpPortSideUse(inUse, id, side);
        else bumpPortSideUse(outUse, id, side);
      }
    });
    return { outUse: outUse, inUse: inUse };
  };

export var ensureAllLeafEdgePorts = function ensureAllLeafEdgePorts(
    graph,
    elementLookup,
    absLookup,
  ) {
    var profile = resolveGraphProfile(graph);
    var edges = collectGraphEdges(graph, []);
    var sideUse = collectExistingPortSideUse(elementLookup);
    for (var i = 0; i < edges.length; i++) {
      var edge = edges[i];
      var srcK = elementLookup[edge.source];
      var tgtK = elementLookup[edge.target];
      var srcAbs = absLookup[edge.source];
      var tgtAbs = absLookup[edge.target];
      if (!srcK || !tgtK || !srcAbs || !tgtAbs) continue;
      var srcOk = canAttachSidePort(srcK);
      var tgtOk = canAttachSidePort(tgtK);
      if (!srcOk && !tgtOk) continue;
      if (srcOk && !findPortById(srcK, edge.sourcePort)) {
        syncNodeSizeFromAbs(srcK, srcAbs);
        var geoOut = pickOutSideByGeometry(srcAbs, tgtAbs, profile);
        var forwardOutUsed =
          portSideUseCount(sideUse.outUse, edge.source, profile.outSide) > 0;
        var shareOut =
          isGraphWrapper(srcK) && geoOut === profile.outSide;
        var outAllowed = shareOut
          ? [profile.outSide]
          : forwardOutUsed
            ? (profile.crossSides || []).slice()
            : [profile.outSide];
        var os = pickSidePreferringFree(
          geoOut,
          outAllowed,
          sideUse.outUse,
          edge.source,
          profile.outSide,
          crossSideTowardTarget(srcAbs, tgtAbs, profile),
        );
        if (edge.sourcePort) removePortById(srcK, edge.sourcePort);
        edge.sourcePort = addSidePort(
          srcK,
          edge.source,
          os,
          os.toLowerCase(),
          "out",
          false,
          edge.target,
          profile,
        );
        edge._adaptiveOut = true;
        bumpPortSideUse(sideUse.outUse, edge.source, os);
      }
      if (tgtOk && !findPortById(tgtK, edge.targetPort)) {
        syncNodeSizeFromAbs(tgtK, tgtAbs);
        var geoIn = pickInSideByGeometry(srcAbs, tgtAbs, profile);
        var forwardInUsed =
          portSideUseCount(sideUse.inUse, edge.target, profile.inSide) > 0;
        var shareIn =
          isGraphWrapper(tgtK) && geoIn === profile.inSide;
        var inAllowed = shareIn
          ? [profile.inSide]
          : forwardInUsed
            ? (profile.crossSides || []).slice()
            : [profile.inSide];
        var is = pickSidePreferringFree(
          geoIn,
          inAllowed,
          sideUse.inUse,
          edge.target,
          profile.inSide,
          crossSideTowardTarget(tgtAbs, srcAbs, profile),
        );
        if (edge.targetPort) removePortById(tgtK, edge.targetPort);
        edge.targetPort = addSidePort(
          tgtK,
          edge.target,
          is,
          is.toLowerCase(),
          "in",
          false,
          edge.source,
          profile,
        );
        edge._adaptiveIn = true;
        bumpPortSideUse(sideUse.inUse, edge.target, is);
      }
    }
  };

  /**
   * 清空所有自适应端口，供最终几何重挑。
   * 二遍 interactive 排点会翻转节点上下序，首遍挑的交叉侧可能已失效。
   */
  var clearAdaptivePorts = function clearAdaptivePorts(graph, elementLookup) {
    var edges = collectGraphEdges(graph, []);
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      if (!(e._adaptiveOut || e._adaptiveIn)) continue;
      var srcK = elementLookup[e.source];
      var tgtK = elementLookup[e.target];
      if (srcK && e.sourcePort) {
        removePortById(srcK, e.sourcePort);
        e.sourcePort = undefined;
      }
      if (tgtK && e.targetPort) {
        removePortById(tgtK, e.targetPort);
        e.targetPort = undefined;
      }
    }
  };

  /** Configured edge-to-edge clearance. */
  var edgeEdgeSpacingAroundLeaf = function edgeEdgeSpacingAroundLeaf(
    leafK,
    graph,
  ) {
    return spacingAroundLeaf(leafK, graph, "edgeEdge", 22);
  };

  /** 两正交线段最短距离 */
  var orthoSegDistance = function orthoSegDistance(a1, a2, b1, b2) {
    var aH = Math.abs(a1.y - a2.y) < 0.5;
    var bH = Math.abs(b1.y - b2.y) < 0.5;
    var aV = Math.abs(a1.x - a2.x) < 0.5;
    var bV = Math.abs(b1.x - b2.x) < 0.5;
    if (aH && bH) {
      var a0 = Math.min(a1.x, a2.x);
      var a1x = Math.max(a1.x, a2.x);
      var b0 = Math.min(b1.x, b2.x);
      var b1x = Math.max(b1.x, b2.x);
      if (a1x < b0 - 0.5 || b1x < a0 - 0.5) {
        var dx = a1x < b0 ? b0 - a1x : a0 - b1x;
        var dy = a1.y - b1.y;
        return Math.sqrt(dx * dx + dy * dy);
      }
      return Math.abs(a1.y - b1.y);
    }
    if (aV && bV) {
      var ay0 = Math.min(a1.y, a2.y);
      var ay1 = Math.max(a1.y, a2.y);
      var by0 = Math.min(b1.y, b2.y);
      var by1 = Math.max(b1.y, b2.y);
      if (ay1 < by0 - 0.5 || by1 < ay0 - 0.5) {
        var dy2 = ay1 < by0 ? by0 - ay1 : ay0 - by1;
        var dx2 = a1.x - b1.x;
        return Math.sqrt(dx2 * dx2 + dy2 * dy2);
      }
      return Math.abs(a1.x - b1.x);
    }
    // 垂直相交对：投影间距
    if (aH && bV) {
      var withinX =
        Math.min(a1.x, a2.x) - 0.5 <= b1.x &&
        b1.x <= Math.max(a1.x, a2.x) + 0.5;
      var withinY =
        Math.min(b1.y, b2.y) - 0.5 <= a1.y &&
        a1.y <= Math.max(b1.y, b2.y) + 0.5;
      if (withinX && withinY) return 0;
      var dxh = withinX
        ? 0
        : Math.min(Math.abs(b1.x - a1.x), Math.abs(b1.x - a2.x));
      var dyh = withinY
        ? 0
        : Math.min(Math.abs(a1.y - b1.y), Math.abs(a1.y - b2.y));
      return Math.sqrt(dxh * dxh + dyh * dyh);
    }
    if (aV && bH) return orthoSegDistance(b1, b2, a1, a2);
    return Infinity;
  };

  /**
   * 仅平行段间距（水平对水平 / 竖直对竖直）。
   * 正交交叉由交叉惩罚处理，不得当作「贴边」否决，否则几乎所有交叉边都会非法回退到贴通道。
   */
  var routeMinParallelDistance = function routeMinParallelDistance(
    route,
    other,
  ) {
    if (!route || !other || route.length < 2 || other.length < 2)
      return Infinity;
    var min = Infinity;
    for (var i = 0; i < route.length - 1; i++) {
      var a1 = route[i];
      var a2 = route[i + 1];
      var aH = Math.abs(a1.y - a2.y) < 0.5;
      var aV = Math.abs(a1.x - a2.x) < 0.5;
      if (!aH && !aV) continue;
      for (var j = 0; j < other.length - 1; j++) {
        var b1 = other[j];
        var b2 = other[j + 1];
        var bH = Math.abs(b1.y - b2.y) < 0.5;
        var bV = Math.abs(b1.x - b2.x) < 0.5;
        if ((aH && bH) || (aV && bV)) {
          var d = orthoSegDistance(a1, a2, b1, b2);
          if (d < min) min = d;
        }
      }
    }
    return min;
  };

  var routeTooCloseToRoutes = function routeTooCloseToRoutes(
    route,
    others,
    minGap,
  ) {
    if (!others || !others.length || !(minGap > 0)) return false;
    for (var i = 0; i < others.length; i++) {
      if (routeMinParallelDistance(route, others[i]) + 0.5 < minGap)
        return true;
    }
    return false;
  };

  /** 从已占用路线抽出平行通道，生成 ±k·edgeEdge 避让槽（边不得贴边） */
  var pushHintsAwayFromOccupiedRoutes =
    function pushHintsAwayFromOccupiedRoutes(pushHint, others, os, edgeEdge) {
      if (!others || !others.length) return;
      var step = Math.max(8, edgeEdge || 0);
      var n = 8;
      var oi;
      var s;
      for (oi = 0; oi < others.length; oi++) {
        var r = others[oi];
        if (!r || r.length < 2) continue;
        for (s = 0; s < r.length - 1; s++) {
          var p = r[s];
          var q = r[s + 1];
          var horiz = Math.abs(p.y - q.y) < 0.5;
          var vert = Math.abs(p.x - q.x) < 0.5;
          var k;
          if ((os === "NORTH" || os === "SOUTH") && horiz) {
            for (k = 1; k <= n; k++) {
              pushHint({ y: p.y + k * step });
              pushHint({ y: p.y - k * step });
            }
          } else if ((os === "EAST" || os === "WEST") && vert) {
            for (k = 1; k <= n; k++) {
              pushHint({ x: p.x + k * step });
              pushHint({ x: p.x - k * step });
            }
          }
        }
      }
    };

  /** 全部展开包装框绝对矩形（占口不当 Node，但走线须离框边 edgeNode） */
  var wrapperAbsList = function wrapperAbsList(elementLookup, absAll) {
    var out = [];
    Object.keys(absAll || {}).forEach(function (id) {
      if (id === "root") return;
      var k = elementLookup[id];
      if (nodeIsParent(k) && absAll[id]) {
        var rect = absAll[id];
        out.push({
          id: id,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      }
    });
    return out;
  };

  /**
   * 线与包装框外廓间距（随主轴）：
   * - 主轴水平（RIGHT/LEFT）：禁水平走廊穿框内 + 贴顶/底外廊；竖段多为 N/S stub，框内放行
   * - 主轴竖直（DOWN/UP）：禁竖直走廊穿框内 + 贴左/右外廊；横段多为 E/W stub，框内放行
   * （旧实现竖段框内一律放行 → DOWN 主走廊穿 Graph 检不到）
   */
  var routeTooCloseToWrappers = function routeTooCloseToWrappers(
    route,
    wraps,
    gap,
    profile,
  ) {
    if (!route || !wraps || !wraps.length || !(gap > 0)) return false;
    var mainAxis = (profile && profile.axis) || "x";
    for (var s = 0; s < route.length - 1; s++) {
      var p = route[s];
      var q = route[s + 1];
      var horiz = Math.abs(p.y - q.y) < 0.5;
      var vert = Math.abs(p.x - q.x) < 0.5;
      for (var wi = 0; wi < wraps.length; wi++) {
        var W = wraps[wi];
        var left = W.x;
        var right = W.x + W.width;
        var top = W.y;
        var bottom = W.y + W.height;
        if (horiz) {
          var y = p.y;
          var minX = Math.min(p.x, q.x);
          var maxX = Math.max(p.x, q.x);
          if (maxX < left - 0.5 || minX > right + 0.5) continue;
          if (mainAxis === "y") {
            // DOWN/UP：横段多为左右 stub，框内放行；只查贴顶/底外廊
            if (y > top + 0.5 && y < bottom - 0.5) continue;
            if (y >= bottom - 0.5 && y + 0.5 < bottom + gap) return true;
            if (y <= top + 0.5 && y - 0.5 > top - gap) return true;
          } else {
            // RIGHT/LEFT：水平走廊不得穿框内
            if (y > top + 0.5 && y < bottom - 0.5) return true;
            if (y >= bottom - 0.5 && y + 0.5 < bottom + gap) return true;
            if (y <= top + 0.5 && y - 0.5 > top - gap) return true;
          }
        } else if (vert) {
          var x = p.x;
          var minY = Math.min(p.y, q.y);
          var maxY = Math.max(p.y, q.y);
          if (maxY < top - 0.5 || minY > bottom + 0.5) continue;
          if (mainAxis === "y") {
            // DOWN/UP：竖直走廊不得穿框内（与 RIGHT 水平走廊对称）
            if (x > left + 0.5 && x < right - 0.5) return true;
            if (x >= right - 0.5 && x + 0.5 < right + gap) return true;
            if (x <= left + 0.5 && x - 0.5 > left - gap) return true;
          } else {
            // RIGHT/LEFT：框内竖 stub 放行；只查贴左/右外廊
            if (x > left + 0.5 && x < right - 0.5) continue;
            if (x >= right - 0.5 && x + 0.5 < right + gap) return true;
            if (x <= left + 0.5 && x - 0.5 > left - gap) return true;
          }
        }
      }
    }
    return false;
  };

  /**
   * 叶子障碍包围盒（含 NODE_CLEARANCE）。
   * axis: null=全部；'x'/'y'=仅与 [a0,a1]±pad 在该轴重叠的节点。
   */
  var obstaclesBounds = function obstaclesBounds(
    absLookup,
    excludeIds,
    axis,
    a0,
    a1,
    pad,
  ) {
    var lo = axis ? Math.min(a0, a1) - (pad || 0) : null;
    var hi = axis ? Math.max(a0, a1) + (pad || 0) : null;
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    var any = false;
    var ids = Object.keys(absLookup || {});
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      if (excludeIds && excludeIds[id]) continue;
      var n = absLookup[id];
      if (!n) continue;
      if (axis === "x" && (n.x + n.width < lo || n.x > hi)) continue;
      if (axis === "y" && (n.y + n.height < lo || n.y > hi)) continue;
      any = true;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    if (!any) return null;
    return {
      minX: minX - NODE_CLEARANCE,
      minY: minY - NODE_CLEARANCE,
      maxX: maxX + NODE_CLEARANCE,
      maxY: maxY + NODE_CLEARANCE,
    };
  };

  /** 包装框是否与区间在 axis（'x'|'y'）上重叠 */
  var wrapOverlapsSpan = function wrapOverlapsSpan(w, axis, a0, a1, pad) {
    if (!w) return false;
    var lo = Math.min(a0, a1) - (pad || 0);
    var hi = Math.max(a0, a1) + (pad || 0);
    if (axis === "x") return !(w.x + w.width < lo || w.x > hi);
    return !(w.y + w.height < lo || w.y > hi);
  };

  /**
   * 中间通道候选：从出/入点外侧最近合法槽起，再按 edgeEdge 外推。
   * 上出：y 从端口上方往更北推；下出：y 从端口下方往更南推（不是「越低越好」）。
   */
  var collectMiddleChannelHints = function collectMiddleChannelHints(
    os,
    srcK,
    srcAbs,
    absAll,
    leafAbs,
    exclude,
    graph,
    edgeNode,
    edgeEdge,
    wraps,
    sx,
    sy,
    tx,
    ty,
    others,
  ) {
    var hints = [];
    var seen = createKeyMap();
    var step = Math.max(8, edgeEdge || 0);
    var gapN = Math.max(8, edgeNode || 0);
    var spanPad = Math.max(40, gapN * 2);
    var pushHint = function (h) {
      var key = h.y != null ? "y:" + Math.round(h.y) : "x:" + Math.round(h.x);
      if (seen[key]) return;
      seen[key] = true;
      hints.push(h);
    };
    var pushOutwardY = function (baseY, dirSign, n) {
      // dirSign: -1 往北（y 减小），+1 往南（y 增大）；k=0 最近端口
      for (var k = 0; k < n; k++) pushHint({ y: baseY + dirSign * k * step });
    };
    var pushOutwardX = function (baseX, dirSign, n) {
      for (var k = 0; k < n; k++) pushHint({ x: baseX + dirSign * k * step });
    };
    var wrap = wrapperAbsOfLeaf(srcK, absAll);
    var wi;
    // 已占用平行通道：强制给出避让档，避免后画边只能软回退到贴通道
    pushHintsAwayFromOccupiedRoutes(pushHint, others, os, edgeEdge);
    if (os === "SOUTH") {
      // 贴近出/入点：从 max(端口 y) 外侧起，再往南外推
      pushOutwardY(Math.max(sy, ty) + gapN, 1, 6);
      pushHint({ y: southChannelY(srcK, srcAbs, absAll, graph) });
      var boxS = obstaclesBounds(leafAbs, exclude, "x", sx, tx, spanPad);
      if (boxS) pushOutwardY(boxS.maxY + gapN, 1, 5);
      for (wi = 0; wi < (wraps || []).length; wi++) {
        var ws = wraps[wi];
        if (!wrapOverlapsSpan(ws, "x", sx, tx, spanPad)) continue;
        pushOutwardY(ws.y + ws.height + gapN, 1, 4);
      }
      if (wrap) pushOutwardY(wrap.y + wrap.height + gapN, 1, 4);
    } else if (os === "NORTH") {
      // 贴近出/入点：从 min(端口 y) 外侧起，再往北外推（不是整图顶）
      pushOutwardY(Math.min(sy, ty) - gapN, -1, 6);
      pushHint({ y: northChannelY(srcK, srcAbs, absAll, graph) });
      var boxN = obstaclesBounds(leafAbs, exclude, "x", sx, tx, spanPad);
      if (boxN) pushOutwardY(boxN.minY - gapN, -1, 5);
      for (wi = 0; wi < (wraps || []).length; wi++) {
        var wn = wraps[wi];
        if (!wrapOverlapsSpan(wn, "x", sx, tx, spanPad)) continue;
        pushOutwardY(wn.y - gapN, -1, 4);
      }
      if (wrap) pushOutwardY(wrap.y - gapN, -1, 4);
    } else if (os === "EAST") {
      pushOutwardX(Math.max(sx, tx) + gapN, 1, 6);
      var xE = (wrap ? wrap.x + wrap.width : srcAbs.x + srcAbs.width) + gapN;
      pushOutwardX(xE, 1, 5);
      var boxE = obstaclesBounds(leafAbs, exclude, "y", sy, ty, spanPad);
      if (boxE) pushOutwardX(boxE.maxX + gapN, 1, 4);
      for (wi = 0; wi < (wraps || []).length; wi++) {
        var we = wraps[wi];
        if (!wrapOverlapsSpan(we, "y", sy, ty, spanPad)) continue;
        pushOutwardX(we.x + we.width + gapN, 1, 3);
      }
    } else if (os === "WEST") {
      pushOutwardX(Math.min(sx, tx) - gapN, -1, 6);
      var xW = (wrap ? wrap.x : srcAbs.x) - gapN;
      pushOutwardX(xW, -1, 5);
      var boxW = obstaclesBounds(leafAbs, exclude, "y", sy, ty, spanPad);
      if (boxW) pushOutwardX(boxW.minX - gapN, -1, 4);
      for (wi = 0; wi < (wraps || []).length; wi++) {
        var ww = wraps[wi];
        if (!wrapOverlapsSpan(ww, "y", sy, ty, spanPad)) continue;
        pushOutwardX(ww.x - gapN, -1, 3);
      }
    }
    return hints;
  };

  var routePassesFlowSpacing = function routePassesFlowSpacing(
    route,
    os,
    is,
    cap,
    leafAbs,
    exclude,
    others,
    edgeNode,
    edgeEdge,
    wraps,
    profile,
  ) {
    if (!route || route.length < 2) return false;
    if (!routeEndsPerpendicular(route, os, is)) return false;
    if (countRouteBends(route) > cap) return false;
    // 硬不穿节点：净距只要求 NODE_CLEARANCE（与 refine/选口一致），
    // 不再用 edgeNode 作硬门槛，避免把相邻节点间的小走廊判死导致绕远。
    if (routeCrossesNodes(route, leafAbs, exclude, NODE_CLEARANCE)) return false;
    if (routeTooCloseToWrappers(route, wraps, edgeNode, profile)) return false;
    if (routeTooCloseToRoutes(route, others, edgeEdge)) return false;
    return true;
  };

  /**
   * 流程线软评分：越小越好（与 refine 一致）；违规项加大惩罚。
   * FLOW_NODE_CROSS_PENALTY 是「进入 edgeNode 理想净距」的软偏好，不再作硬门槛：
   * 硬不穿节点由 routePassesFlowSpacing 用 NODE_CLEARANCE 把关，避免为追求 44px
   * 净距把简单可走的小走廊都判死，反而绕一大圈。
   */
  var FLOW_NODE_CROSS_PENALTY = 40;
  var FLOW_WRAP_CLOSE_PENALTY = 180;
  /** 贴边绝对不可接受：软回退时也须压过 stub/穿框等项 */
  var FLOW_EDGE_CLOSE_PENALTY = 5000;
  /** 非垂直出入视为不可用（与硬过滤一致；分值仅作双保险） */
  var FLOW_PERP_FAIL_PENALTY = 1e7;
  var FLOW_BEND_OVER_PENALTY = 30;
  /** 合法前提下偏好贴近出/入点：首尾 stub 越短越好（上出上入≠越低越好，下出下入≠越高越好） */
  var FLOW_STUB_WEIGHT = 1;
  /** 整条路径总长偏好：越短越好，让评分能比较「绕远」与「贴边」的代价 */
  var FLOW_LENGTH_WEIGHT = 0.5;

  var scoreFlowRoute = function scoreFlowRoute(
    route,
    os,
    isSide,
    cap,
    leafAbs,
    exclude,
    others,
    committed,
    edgeNode,
    edgeEdge,
    srcAbs,
    tgtAbs,
    wraps,
    profile,
  ) {
    if (!route || route.length < 2) return 1e9;
    var bends = countRouteBends(route);
    var crossings = countRouteCrossings(route, committed);
    var score =
      crossings * CROSSING_WEIGHT +
      bends * BEND_WEIGHT;
    score += verticalAlignPenalty(os, isSide, srcAbs, tgtAbs, profile);
    score += routeEndStubLength(route) * FLOW_STUB_WEIGHT;
    score += routeTotalLength(route) * FLOW_LENGTH_WEIGHT;
    if (!routeEndsPerpendicular(route, os, isSide))
      score += FLOW_PERP_FAIL_PENALTY;
    if (bends > cap)
      score += (bends - cap) * FLOW_BEND_OVER_PENALTY + FLOW_BEND_OVER_PENALTY;
    if (routeCrossesNodes(route, leafAbs, exclude, edgeNode))
      score += FLOW_NODE_CROSS_PENALTY;
    if (routeTooCloseToWrappers(route, wraps, edgeNode, profile))
      score += FLOW_WRAP_CLOSE_PENALTY;
    if (routeTooCloseToRoutes(route, others, edgeEdge))
      score += FLOW_EDGE_CLOSE_PENALTY;
    return score;
  };

  var pickBestScoredRoute = function pickBestScoredRoute(
    routes,
    os,
    isSide,
    cap,
    leafAbs,
    exclude,
    others,
    committed,
    edgeNode,
    edgeEdge,
    srcAbs,
    tgtAbs,
    wraps,
    profile,
  ) {
    var bestLegal = null;
    var bestLegalScore = Infinity;
    var bestSep = null;
    var bestSepScore = Infinity;
    var bestPerp = null;
    var bestPerpScore = Infinity;
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      if (!r || r.length < 2) continue;
      // 硬规则：出入必须垂直于边；非垂直路径永不采纳
      if (!routeEndsPerpendicular(r, os, isSide)) continue;
      var s = scoreFlowRoute(
        r,
        os,
        isSide,
        cap,
        leafAbs,
        exclude,
        others,
        committed,
        edgeNode,
        edgeEdge,
        srcAbs,
        tgtAbs,
        wraps,
        profile,
      );
      if (s < bestPerpScore) {
        bestPerpScore = s;
        bestPerp = r;
      }
      // 贴边以外的次优（即使穿框/折数超限，也优先于共通道）
      if (!routeTooCloseToRoutes(r, others, edgeEdge) && s < bestSepScore) {
        bestSepScore = s;
        bestSep = r;
      }
      if (
        routePassesFlowSpacing(
          r,
          os,
          isSide,
          cap,
          leafAbs,
          exclude,
          others,
          edgeNode,
          edgeEdge,
          wraps,
          profile,
        ) &&
        s < bestLegalScore
      ) {
        bestLegalScore = s;
        bestLegal = r;
      }
    }
    // 合法 > 不贴边 > 任意垂直路径（绝不回退到斜切/贴边进出）
    return bestLegal || bestSep || bestPerp;
  };

  /**
   * 障碍避让正交寻路（A*，网格线取自节点/包装框边界）。
   * 当 1~2 折候选池全部穿节点时兜底：沿障碍边界生成网格线做四向 A*，
   * 找一条最短折线，保证不穿任何叶子节点 / 包装框。思路同 PCB 走线、
   * Orthogonal grid routing with rectangular obstacle avoidance.
   */
  /** 节点所有祖先包装框 id（边在其容器内走，容器自身不当障碍） */
  var ancestorWrapperIds = function ancestorWrapperIds(nodeK) {
    var out = createKeyMap();
    nodeAncestorIds(nodeK).forEach(function (id) { out[id] = true; });
    return out;
  };

  /**
   * 边避障矩形集合：叶子（不含两端及其子孙）+ 包装框（不含两端及其祖先容器）。
   * 连到展开 Graph 时，框内叶子不是外部边障碍。
   */
  var skipNodeAndDescendants = function skipNodeAndDescendants(skip, nodeK) {
    if (!skip || !nodeK) return;
    if (nodeK.id) skip[nodeK.id] = true;
    nodeDescendantIds(nodeK).forEach(function (id) { skip[id] = true; });
  };

  var routeObstacleRects = function routeObstacleRects(
    leafAbs,
    wraps,
    srcK,
    tgtK,
  ) {
    var skip = createKeyMap();
    skipNodeAndDescendants(skip, srcK);
    skipNodeAndDescendants(skip, tgtK);
    var ancA = ancestorWrapperIds(srcK);
    var ancB = ancestorWrapperIds(tgtK);
    Object.keys(ancA).forEach(function (id) {
      skip[id] = true;
    });
    Object.keys(ancB).forEach(function (id) {
      skip[id] = true;
    });
    var out = [];
    Object.keys(leafAbs || {}).forEach(function (id) {
      if (skip[id]) return;
      out.push(leafAbs[id]);
    });
    for (var i = 0; i < (wraps || []).length; i++) {
      var w = wraps[i];
      if (w && w.id && skip[w.id]) continue;
      out.push(w);
    }
    return out;
  };


  /**
   * 节点布局后：流程线计算。
   * Write absolute orthogonal points to edge._flowAbsRoute for Cytoscape.
   */
  var computeFlowRoutes = function computeFlowRoutes(
    graph,
    elementLookup,
    absLookup,
  ) {
    ensureAllLeafEdgePorts(graph, elementLookup, absLookup);
    // Clear any stale route sections before computing the final route.
    clearElkEdgeSections(graph);
    var profile = resolveGraphProfile(graph);
    var leafAbs = leafAbsLookup(elementLookup, absLookup);
    var wraps = wrapperAbsList(elementLookup, absLookup);
    var edges = collectGraphEdges(graph, []);
    edges.sort(function (a, b) {
      return compareDrawOrder(a, b, absLookup);
    });
    var routeById = createKeyMap();
    var i;
    for (i = 0; i < edges.length; i++) {
      var edge = edges[i];
      if (!edge.sourcePort || !edge.targetPort) continue;
      var srcK = elementLookup[edge.source];
      var tgtK = elementLookup[edge.target];
      if (!canAttachSidePort(srcK) || !canAttachSidePort(tgtK)) continue;
      var srcAbs = absLookup[edge.source];
      var tgtAbs = absLookup[edge.target];
      if (!srcAbs || !tgtAbs) continue;
      syncNodeSizeFromAbs(srcK, srcAbs);
      syncNodeSizeFromAbs(tgtK, tgtAbs);
      var sp = findPortById(srcK, edge.sourcePort);
      var tp = findPortById(tgtK, edge.targetPort);
      if (!sp || !tp) continue;
      var os = portSideOf(sp);
      var isSide = portSideOf(tp);
      if (!os || !isSide) continue;
      var cap = maxBendsForSides(os, isSide, profile);
      var edgeNode = edgeNodeSpacingAroundLeaf(srcK, graph);
      var edgeEdge = edgeEdgeSpacingAroundLeaf(srcK, graph);
      var exclude = createKeyMap();
      skipNodeAndDescendants(exclude, srcK);
      skipNodeAndDescendants(exclude, tgtK);
      var others = [];
      var committed = [];
      for (var j = 0; j < edges.length; j++) {
        if (edges[j].id === edge.id) continue;
        var or = routeById[edges[j].id];
        if (or && or.length >= 2) {
          others.push(or);
          committed.push({ route: or });
        }
      }
      var srcPt = portAbsOnNode(srcK, srcAbs, edge.sourcePort);
      var tgtPt = portAbsOnNode(tgtK, tgtAbs, edge.targetPort);
      if (!srcPt || !tgtPt) continue;
      var sx = srcPt.x;
      var sy = srcPt.y;
      var tx = tgtPt.x;
      var ty = tgtPt.y;
      var pool = [];
      // 保底：按出/入侧强制垂直 stub（单肘弯只保证出边垂直，入边可能斜切）
      var forcedPerp = edgeRouteWithSides(
        edge,
        absLookup,
        os,
        isSide,
        profile,
        sx,
        sy,
        tx,
        ty,
      );
      if (forcedPerp && forcedPerp.length >= 2) pool.push(forcedPerp);
      if (cap >= 1) {
        pool.push(
          removeDuplicatePoints(buildOneBendAbsRoute(sx, sy, tx, ty, os), 0.5),
        );
      }
      if (cap >= 2) {
        var hints = collectMiddleChannelHints(
          os,
          srcK,
          srcAbs,
          absLookup,
          leafAbs,
          exclude,
          graph,
          edgeNode,
          edgeEdge,
          wraps,
          sx,
          sy,
          tx,
          ty,
          others,
        );
        for (var h = 0; h < hints.length; h++) {
          pool.push(buildCappedPerpRoute(sx, sy, tx, ty, os, 2, hints[h]));
        }
      }
      var cleaned = [];
      for (var c = 0; c < pool.length; c++) {
        var raw = pool[c] || [];
        if (raw.length < 2) continue;
        var cand = simplifyOrthogonalPoints(raw);
        // 简化若吃掉 stub 破坏垂直性，回退未简化路径
        if (cand && cand.length >= 2 && routeEndsPerpendicular(cand, os, isSide)) {
          cleaned.push(cand);
        } else if (routeEndsPerpendicular(raw, os, isSide)) {
          cleaned.push(raw);
        }
      }
      var picked = pickBestScoredRoute(
        cleaned,
        os,
        isSide,
        cap,
        leafAbs,
        exclude,
        others,
        committed,
        edgeNode,
        edgeEdge,
        srcAbs,
        tgtAbs,
        wraps,
        profile,
      );
      // 穿节点兜底：候选池全部穿节点时，用障碍避让正交寻路兜底。
      // 净距与硬门槛一致用 NODE_CLEARANCE，取一条折点尽量少、总长尽量短的避障路径。
      var obs = routeObstacleRects(leafAbs, wraps, srcK, tgtK);
      if (!picked || routeHitsRects(picked, obs, 0)) {
        var astar = orthogonalAStarRoute({
          source: { x: sx, y: sy },
          target: { x: tx, y: ty },
          outSide: os,
          inSide: isSide,
          obstacles: obs,
          clearance: NODE_CLEARANCE,
        });
        if (astar && astar.length >= 2) {
          var astarSimp = simplifyOrthogonalPoints(astar);
          if (
            astarSimp &&
            astarSimp.length >= 2 &&
            routeEndsPerpendicular(astarSimp, os, isSide)
          ) {
            picked = astarSimp;
          } else {
            picked = astar;
          }
        }
      }
      // 再保底：强制垂直路径（不做非垂直回退）
      if (!picked && forcedPerp && forcedPerp.length >= 2) picked = forcedPerp;
      if (!picked) continue;
      edge._flowAbsRoute = picked;
      routeById[edge.id] = picked;
    }
  };

  /**
   * 清除非 Graph 包装 parent 上的端口。
   * 展开 Graph 包装框需保留外部边的前向输入/输出端口。
   */
  var stripWrapperNodeNorms = function stripWrapperNodeNorms(elementLookup) {
    Object.keys(elementLookup).forEach(function (id) {
      var k = elementLookup[id];
      if (!nodeIsParent(k)) return;
      if (isGraphWrapper(k)) return;
      k.ports = [];
    });
  };

export var spreadAllFixedPorts = function spreadAllFixedPorts(graph, elementLookup) {
    if (!elementLookup) return;
    stripWrapperNodeNorms(elementLookup);
    var profile = resolveGraphProfile(graph);
    Object.keys(elementLookup).forEach(function (id) {
      syncGraphWrapperSize(elementLookup[id]);
    });
    var absLookup = buildAbsNodeLookup(graph, 0, 0, createKeyMap());
    Object.keys(elementLookup).forEach(function (id) {
      var k = elementLookup[id];
      if (!canAttachSidePort(k)) return;
      syncNodeSizeFromAbs(k, absLookup[id]);
      syncGraphWrapperSize(k);
      spreadFixedPortsOnNode(k, absLookup, profile);
      pinRailPortsToWrapperLevelZero(k, profile);
    });
  };

  var assignLevelSidePorts = function assignLevelSidePorts(
    elementLookup,
    layoutEdges,
    profile,
  ) {
    var p = profile || defaultAxisProfile();
    var outS = p.outSide;
    var inS = p.inSide;
    var owners = claimPreferredPortOwners(layoutEdges, createKeyMap(), p);
    for (var i = 0; i < layoutEdges.length; i++) {
      var e = layoutEdges[i];
      var srcK = elementLookup[e.source];
      var tgtK = elementLookup[e.target];
      var srcOk = canAttachSidePort(srcK);
      var tgtOk = canAttachSidePort(tgtK);
      if (!srcOk && !tgtOk) continue;
      if (srcOk) {
        if (owners.outOwner[e.source] === e) {
          e.sourcePort = addSidePort(
            srcK,
            e.source,
            outS,
            outS.toLowerCase(),
            "out",
            true,
            e.target,
            p,
          );
        } else {
          e._adaptiveOut = true;
        }
      }
      if (tgtOk) {
        if (owners.inOwner[e.target] === e) {
          e.targetPort = addSidePort(
            tgtK,
            e.target,
            inS,
            inS.toLowerCase(),
            "in",
            true,
            e.source,
            p,
          );
        } else {
          e._adaptiveIn = true;
        }
      }
    }
  };

  /** 绝对坐标附着点；end=in|out 控制交叉边负半/正半 */
  var portAttach = function portAttach(side, x, y, w, h, end, profile) {
    var local = portLocalOnNode(side, w, h, end, profile);
    return {
      x: x + local.x,
      y: y + local.y,
    };
  };

  /**
   * 沿给定侧朝对端交叉坐标取附着点（夹在边距内）。
   * 包装框的非锚定端口使用前向侧时，禁止用腰上中点估算路径。
   */
  var attachOnSideTowardPeer = function attachOnSideTowardPeer(
    abs,
    side,
    peerAbs,
    end,
  ) {
    if (!abs || !side) {
      return abs
        ? { x: abs.x + abs.width / 2, y: abs.y + abs.height / 2 }
        : { x: 0, y: 0 };
    }
    var m = PORT_SPREAD_MARGIN;
    var left = abs.x;
    var top = abs.y;
    var right = abs.x + abs.width;
    var bottom = abs.y + abs.height;
    var pcx = peerAbs
      ? peerAbs.x + peerAbs.width / 2
      : (left + right) / 2;
    var pcy = peerAbs
      ? peerAbs.y + peerAbs.height / 2
      : (top + bottom) / 2;
    var isIn = end === "in";
    if (side === "EAST" || side === "WEST") {
      var y = clampOnSideTowardPeer(pcy, top + m, bottom - m, isIn);
      return { x: side === "EAST" ? right : left, y: y };
    }
    if (side === "SOUTH" || side === "NORTH") {
      var x = clampOnSideTowardPeer(pcx, left + m, right - m, isIn);
      return { x: x, y: side === "SOUTH" ? bottom : top };
    }
    return { x: (left + right) / 2, y: (top + bottom) / 2 };
  };

  var removePortById = function removePortById(nodeK, portId) {
    if (!nodeK || !nodeK.ports || !portId) return;
    nodeK.ports = nodeK.ports.filter(function (p) {
      return p.id !== portId;
    });
  };

  var clearElkEdgeSections = function clearElkEdgeSections(node) {
    var edges = node.edges || [];
    for (var i = 0; i < edges.length; i++) {
      delete edges[i].sections;
      delete edges[i].junctionPoints;
    }
    var children = node.children || [];
    for (var c = 0; c < children.length; c++) {
      clearElkEdgeSections(children[c]);
    }
  };

  /** 路由按 Level 升序提交，因此统一交叉代价即可自然保护较低 Level。 */
  var CROSSING_WEIGHT = 24;
  /** 同侧已被其它边占用：选点时必须计入，避免多条边挤同一口。 */
  var PORT_SIDE_OCCUPY_WEIGHT = 40;
  /** 折点权重（低于侧占用与交叉） */
  var BEND_WEIGHT = 10;
  /** 上下出入相对首遍实际路径每少 1 折点的软加分 */
  var VERTICAL_BEND_BONUS = 3;
  /** 端口外探，按新侧重生成正交路径时用 */
  var PORT_CHANNEL = 28;
  /** 禁止穿节点：检测时向外扩一点，避免擦边看起来像穿过 */
  var NODE_CLEARANCE = 10;
  /** 同行默认走下方：极弱软偏好，不得压过「少 1 折」 */
  var VERTICAL_ALIGN_PENALTY = 2;

  /**
   * 交叉轴出/入方位软惩罚：
   * 目标在交叉正方向 → 偏好正交叉侧；负方向偏好负交叉侧；
   * 同行默认走正交叉侧（RIGHT=下方 SOUTH；DOWN=右方 EAST）。
   */
  var verticalAlignPenalty = function verticalAlignPenalty(
    os,
    is,
    srcAbs,
    tgtAbs,
    profile,
  ) {
    if (!srcAbs || !tgtAbs) return 0;
    var prof = profile || defaultAxisProfile();
    var posSide = prof.cross === "y" ? "SOUTH" : "EAST";
    var negSide = prof.cross === "y" ? "NORTH" : "WEST";
    var dCross =
      prof.cross === "y"
        ? tgtAbs.y + tgtAbs.height / 2 - (srcAbs.y + srcAbs.height / 2)
        : tgtAbs.x + tgtAbs.width / 2 - (srcAbs.x + srcAbs.width / 2);
    var pen = 0;
    if (dCross > SAME_ROW_TOL) {
      if (os === negSide) pen += VERTICAL_ALIGN_PENALTY;
      if (is === negSide) pen += VERTICAL_ALIGN_PENALTY;
    } else if (dCross < -SAME_ROW_TOL) {
      if (os === posSide) pen += VERTICAL_ALIGN_PENALTY;
      if (is === posSide) pen += VERTICAL_ALIGN_PENALTY;
    } else {
      // 同行默认贴正交叉侧
      if (os === negSide) pen += VERTICAL_ALIGN_PENALTY;
      if (is === negSide) pen += VERTICAL_ALIGN_PENALTY;
    }
    return pen;
  };

  /** 路径是否穿过除端点外的任意 Node（硬禁止）；clearance 默认 NODE_CLEARANCE，硬规则应传 edgeNode */
  var routeCrossesNodes = function routeCrossesNodes(
    route,
    absLookup,
    excludeIds,
    clearance,
  ) {
    if (!route || route.length < 2) return false;
    var pad =
      clearance != null && isFinite(clearance) ? clearance : NODE_CLEARANCE;
    var ids = Object.keys(absLookup);
    for (var s = 0; s < route.length - 1; s++) {
      var p = route[s];
      var q = route[s + 1];
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (excludeIds && excludeIds[id]) continue;
        var n = absLookup[id];
        if (!n) continue;
        var rx = n.x - pad;
        var ry = n.y - pad;
        var rw = n.width + pad * 2;
        var rh = n.height + pad * 2;
        if (
          orthogonalSegmentHitsRectInterior(
            p.x,
            p.y,
            q.x,
            q.y,
            rx,
            ry,
            rw,
            rh,
          )
        )
          return true;
      }
    }
    return false;
  };

  /** 只保留叶子绝对框（包装框不是避障 Node） */
  var leafAbsLookup = function leafAbsLookup(elementLookup, absAll) {
    var out = createKeyMap();
    Object.keys(absAll || {}).forEach(function (id) {
      if (id === "root") return;
      if (isLeafNode(elementLookup[id]) && absAll[id]) out[id] = absAll[id];
    });
    return out;
  };

  var sideLeaveDelta = function sideLeaveDelta(side) {
    if (side === "EAST") return { x: PORT_CHANNEL, y: 0 };
    if (side === "WEST") return { x: -PORT_CHANNEL, y: 0 };
    if (side === "NORTH") return { x: 0, y: -PORT_CHANNEL };
    if (side === "SOUTH") return { x: 0, y: PORT_CHANNEL };
    return { x: 0, y: 0 };
  };

  /** Existing route used as a soft scoring reference. */
  var getActualEdgeRoute = function getActualEdgeRoute(graph, edge) {
    var route = routeFromLayoutSections(graph, edge);
    if (!route || route.length < 2) return null;
    return simplifyOrthogonalPoints(route);
  };

  var pushOrthoPoint = function pushOrthoPoint(pts, p) {
    if (!pts.length) {
      pts.push(p);
      return;
    }
    var last = pts[pts.length - 1];
    if (Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) return;
    if (pts.length >= 2) {
      var prev = pts[pts.length - 2];
      var col = Math.abs(prev.x - last.x) < 0.5 && Math.abs(last.x - p.x) < 0.5;
      var row = Math.abs(prev.y - last.y) < 0.5 && Math.abs(last.y - p.y) < 0.5;
      if (col || row) {
        pts[pts.length - 1] = p;
        return;
      }
    }
    pts.push(p);
  };

  /** 出/入 stub：保证第一段垂直离开、最后一段垂直进入 */
  var buildPortStubs = function buildPortStubs(srcK, tgtK, srcSide, tgtSide) {
    var a = srcSide
      ? portAttach(srcSide, srcK.x, srcK.y, srcK.width, srcK.height, "out")
      : {
          x: srcK.x + srcK.width / 2,
          y: srcK.y + srcK.height / 2,
        };
    var b = tgtSide
      ? portAttach(tgtSide, tgtK.x, tgtK.y, tgtK.width, tgtK.height, "in")
      : {
          x: tgtK.x + tgtK.width / 2,
          y: tgtK.y + tgtK.height / 2,
        };
    var a2 = a;
    var b2 = b;
    if (srcSide) {
      var ld = sideLeaveDelta(srcSide);
      a2 = { x: a.x + ld.x, y: a.y + ld.y };
    }
    if (tgtSide) {
      var ed = sideLeaveDelta(tgtSide);
      b2 = { x: b.x + ed.x, y: b.y + ed.y };
    }
    return { a: a, a2: a2, b: b, b2: b2 };
  };

  /** 校验：出边第一段、入边最后一段必须与端口边垂直 */
  var routeEndsPerpendicular = function routeEndsPerpendicular(
    route,
    srcSide,
    tgtSide,
  ) {
    if (!route || route.length < 2) return false;
    var fx = route[1].x - route[0].x;
    var fy = route[1].y - route[0].y;
    if (srcSide === "EAST" && !(fx > 0.5 && Math.abs(fy) <= 0.5)) return false;
    if (srcSide === "WEST" && !(fx < -0.5 && Math.abs(fy) <= 0.5)) return false;
    if (srcSide === "NORTH" && !(fy < -0.5 && Math.abs(fx) <= 0.5))
      return false;
    if (srcSide === "SOUTH" && !(fy > 0.5 && Math.abs(fx) <= 0.5)) return false;
    var n = route.length;
    var lx = route[n - 1].x - route[n - 2].x;
    var ly = route[n - 1].y - route[n - 2].y;
    // 入：最后一段朝端口法向内侧（与 leave 反向）
    if (tgtSide === "WEST" && !(lx > 0.5 && Math.abs(ly) <= 0.5)) return false;
    if (tgtSide === "EAST" && !(lx < -0.5 && Math.abs(ly) <= 0.5)) return false;
    if (tgtSide === "NORTH" && !(ly > 0.5 && Math.abs(lx) <= 0.5)) return false;
    if (tgtSide === "SOUTH" && !(ly < -0.5 && Math.abs(lx) <= 0.5))
      return false;
    return true;
  };

  /** 组装路径：强制保留垂直出 stub 与垂直入 stub，中间只做正交连接 */
  var assemblePerpRoute = function assemblePerpRoute(stubs, middlePts) {
    var pts = [
      {
        x: stubs.a.x,
        y: stubs.a.y,
      },
      {
        x: stubs.a2.x,
        y: stubs.a2.y,
      },
    ];
    var mid = middlePts || [];
    for (var i = 0; i < mid.length; i++) {
      pushOrthoPoint(pts, mid[i]);
    }
    pushOrthoPoint(pts, {
      x: stubs.b2.x,
      y: stubs.b2.y,
    });
    pushOrthoPoint(pts, {
      x: stubs.b.x,
      y: stubs.b.y,
    });
    // 仅去重，不做会吃掉 stub 的强简化
    return removeDuplicatePoints(pts, 0.5);
  };

  var connectStubsOrtho = function connectStubsOrtho(
    a2,
    b2,
    srcSide,
    tgtSide,
    profile,
  ) {
    var mid = [];
    var p = profile || defaultAxisProfile();
    if (Math.abs(a2.x - b2.x) < 0.5 || Math.abs(a2.y - b2.y) < 0.5) return mid;

    // 同交叉侧：走交叉轴外侧通道（推广原同 NORTH/SOUTH）
    if (
      srcSide &&
      tgtSide &&
      srcSide === tgtSide &&
      profileIsCrossSide(p, srcSide)
    ) {
      if (srcSide === "NORTH" || srcSide === "SOUTH") {
        var chanY =
          srcSide === "NORTH" ? Math.min(a2.y, b2.y) : Math.max(a2.y, b2.y);
        mid.push({ x: a2.x, y: chanY });
        mid.push({ x: b2.x, y: chanY });
        return mid;
      }
      var chanX =
        srcSide === "WEST" ? Math.min(a2.x, b2.x) : Math.max(a2.x, b2.x);
      mid.push({ x: chanX, y: a2.y });
      mid.push({ x: chanX, y: b2.y });
      return mid;
    }

    // 前向输出 → 前向输入：主轴中线走廊（推广 EAST→WEST）。
    if (srcSide === p.outSide && tgtSide === p.inSide) {
      if (p.axis === "x") {
        var mx = (a2.x + b2.x) / 2;
        mid.push({ x: mx, y: a2.y });
        mid.push({ x: mx, y: b2.y });
      } else {
        var my = (a2.y + b2.y) / 2;
        mid.push({ x: a2.x, y: my });
        mid.push({ x: b2.x, y: my });
      }
      return mid;
    }

    // 默认：先沿离开轴走到可转弯点，再接到 b2（保持出 stub 不被斜接）
    if (srcSide === "EAST" || srcSide === "WEST") {
      mid.push({ x: b2.x, y: a2.y });
    } else {
      mid.push({ x: a2.x, y: b2.y });
    }
    return mid;
  };

  /**
   * 按候选出/入侧重生成正交路径：第一段垂直出、最后一段垂直入
   */
  var sideAwareOrthoRoute = function sideAwareOrthoRoute(
    srcK,
    tgtK,
    srcSide,
    tgtSide,
    profile,
  ) {
    var stubs = buildPortStubs(srcK, tgtK, srcSide, tgtSide);
    var mid = connectStubsOrtho(
      stubs.a2,
      stubs.b2,
      srcSide,
      tgtSide,
      profile,
    );
    return assemblePerpRoute(stubs, mid);
  };

  var candidateAttachPoint = function candidateAttachPoint(
    abs,
    side,
    peerAbs,
    end,
    nodeK,
  ) {
    if (!abs) return { x: 0, y: 0 };
    if (isGraphWrapper(nodeK) && side) {
      return attachOnSideTowardPeer(abs, side, peerAbs, end);
    }
    if (!side) {
      return { x: abs.x + abs.width / 2, y: abs.y + abs.height / 2 };
    }
    return portAttach(side, abs.x, abs.y, abs.width, abs.height, end);
  };

  /** 绕行变体：仍强制垂直出/入 stub，再走外通道 */
  var detourOrthoRoutes = function detourOrthoRoutes(
    srcK,
    tgtK,
    srcSide,
    tgtSide,
    absLookup,
    excludeIds,
    profile,
    srcPt,
    tgtPt,
  ) {
    var routes = [];
    var stubs =
      srcPt && tgtPt
        ? buildPortStubsFromAbs(
            srcPt.x,
            srcPt.y,
            tgtPt.x,
            tgtPt.y,
            srcSide,
            tgtSide,
          )
        : buildPortStubs(srcK, tgtK, srcSide, tgtSide);
    var base = assemblePerpRoute(
      stubs,
      connectStubsOrtho(stubs.a2, stubs.b2, srcSide, tgtSide, profile),
    );
    if (base) routes.push(base);

    var box = obstaclesBounds(absLookup, excludeIds);
    if (!box) return routes;
    var gap = NODE_CLEARANCE + 16;
    var channels = [
      { y: box.minY - gap },
      { y: box.maxY + gap },
      { x: box.minX - gap },
      { x: box.maxX + gap },
    ];
    for (var c = 0; c < channels.length; c++) {
      var ch = channels[c];
      var mid = [];
      if (ch.y != null) {
        mid.push({ x: stubs.a2.x, y: ch.y });
        mid.push({ x: stubs.b2.x, y: ch.y });
      } else {
        mid.push({ x: ch.x, y: stubs.a2.y });
        mid.push({ x: ch.x, y: stubs.b2.y });
      }
      routes.push(assemblePerpRoute(stubs, mid));
    }
    return routes;
  };

  /**
   * 候选端口：垂直出/入 + 不穿 Node；同侧多绕行变体时优先少交叉，再少折点
   */
  var bendsForCandidate = function bendsForCandidate(
    edge,
    absLookup,
    os,
    is,
    committed,
    profile,
    elementLookup,
  ) {
    var srcK = absLookup[edge.source];
    var tgtK = absLookup[edge.target];
    if (!srcK || !tgtK) {
      return {
        bends: 99,
        route: null,
        crossings: 99,
      };
    }
    var exclude = createKeyMap();
    exclude[edge.source] = true;
    exclude[edge.target] = true;
    var srcNodeK = elementLookup && elementLookup[edge.source];
    var tgtNodeK = elementLookup && elementLookup[edge.target];
    var srcAttach = !edge._adaptiveOut
      ? portAbsOnNode(srcNodeK, srcK, edge.sourcePort)
      : null;
    var tgtAttach = !edge._adaptiveIn
      ? portAbsOnNode(tgtNodeK, tgtK, edge.targetPort)
      : null;
    var variants = detourOrthoRoutes(
      srcK,
      tgtK,
      os,
      is,
      absLookup,
      exclude,
      profile,
      srcAttach || candidateAttachPoint(srcK, os, tgtK, "out", srcNodeK),
      tgtAttach || candidateAttachPoint(tgtK, is, srcK, "in", tgtNodeK),
    );
    var bendCap = maxBendsForSides(os, is, profile);
    var best = null;
    for (var i = 0; i < variants.length; i++) {
      var route = variants[i];
      if (!route || route.length < 2) continue;
      if (!routeEndsPerpendicular(route, os, is)) continue;
      if (routeCrossesNodes(route, absLookup, exclude)) continue;
      var bends = countRouteBends(route);
      // 超过侧预算或全局 2 折顶：非法
      if (bends > bendCap || bends > MAX_BENDS_ABSOLUTE) continue;
      var crossings = countRouteCrossings(route, committed);
      var rank = crossings * CROSSING_WEIGHT + bends * BEND_WEIGHT;
      if (!best || rank < best.rank) {
        best = { bends: bends, route: route, crossings: crossings, rank: rank };
      }
    }
    return (
      best || {
        bends: 99,
        route: null,
        crossings: 99,
      }
    );
  };

  /** 节点绝对坐标（含子图偏移），供交叉检测与折点估计 */
  var buildAbsNodeLookup = function buildAbsNodeLookup(node, ox, oy, out) {
    if (isGraphWrapper(node)) syncGraphWrapperSize(node);
    var ax = ox + (node.x || 0);
    var ay = oy + (node.y || 0);
    if (node.id != null) {
      out[node.id] = {
        x: ax,
        y: ay,
        width: node.width || 1,
        height: node.height || 1,
      };
    }
    var children = node.children || [];
    for (var i = 0; i < children.length; i++) {
      buildAbsNodeLookup(children[i], ax, ay, out);
    }
    return out;
  };

  /** 边所在容器的绝对原点（sections 坐标系） */
  var findEdgeContainerOrigin = function findEdgeContainerOrigin(
    node,
    edge,
    absX,
    absY,
  ) {
    var edges = node.edges || [];
    for (var i = 0; i < edges.length; i++) {
      if (edges[i] === edge || edges[i].id === edge.id) {
        return {
          x: absX,
          y: absY,
        };
      }
    }
    var children = node.children || [];
    for (var c = 0; c < children.length; c++) {
      var ch = children[c];
      var found = findEdgeContainerOrigin(
        ch,
        edge,
        absX + (ch.x || 0),
        absY + (ch.y || 0),
      );
      if (found) return found;
    }
    return null;
  };

  /** Prefer existing route sections, then fall back to geometric estimates. */
  var routeFromLayoutSections = function routeFromLayoutSections(graph, edge) {
    var pts = getLayoutEdgePoints(edge);
    if (!pts || pts.length < 2) return null;
    var origin = findEdgeContainerOrigin(graph, edge, 0, 0) || {
      x: 0,
      y: 0,
    };
    return pts.map(function (p) {
      return {
        x: p.x + origin.x,
        y: p.y + origin.y,
      };
    });
  };

  /** 节点中心曼哈顿距离：短线优先排序用 */
  var edgeCenterLength = function edgeCenterLength(edge, absLookup) {
    var srcK = absLookup[edge.source];
    var tgtK = absLookup[edge.target];
    if (!srcK || !tgtK) return 0;
    var sx = srcK.x + srcK.width / 2;
    var sy = srcK.y + srcK.height / 2;
    var tx = tgtK.x + tgtK.width / 2;
    var ty = tgtK.y + tgtK.height / 2;
    return Math.abs(tx - sx) + Math.abs(ty - sy);
  };

  /** Level 数字较小的边优先，同 Level 内短线优先。 */
  var compareDrawOrder = function compareDrawOrder(a, b, absLookup) {
    var ca = edgeLevel(a);
    var cb = edgeLevel(b);
    if (ca !== cb) return ca - cb;
    return edgeCenterLength(a, absLookup) - edgeCenterLength(b, absLookup);
  };

  var buildPortStubsFromAbs = function buildPortStubsFromAbs(
    sx,
    sy,
    tx,
    ty,
    srcSide,
    tgtSide,
  ) {
    var a = { x: sx, y: sy };
    var b = { x: tx, y: ty };
    var a2 = a;
    var b2 = b;
    if (srcSide) {
      var ld = sideLeaveDelta(srcSide);
      a2 = { x: a.x + ld.x, y: a.y + ld.y };
    }
    if (tgtSide) {
      var ed = sideLeaveDelta(tgtSide);
      b2 = { x: b.x + ed.x, y: b.y + ed.y };
    }
    return { a: a, a2: a2, b: b, b2: b2 };
  };

  var edgeRouteWithSides = function edgeRouteWithSides(
    edge,
    absLookup,
    srcSide,
    tgtSide,
    profile,
    sx,
    sy,
    tx,
    ty,
  ) {
    var srcK = absLookup[edge.source];
    var tgtK = absLookup[edge.target];
    if (!srcK || !tgtK) return null;
    if (
      sx != null &&
      sy != null &&
      tx != null &&
      ty != null &&
      isFinite(sx) &&
      isFinite(sy) &&
      isFinite(tx) &&
      isFinite(ty)
    ) {
      var stubs = buildPortStubsFromAbs(sx, sy, tx, ty, srcSide, tgtSide);
      var mid = connectStubsOrtho(stubs.a2, stubs.b2, srcSide, tgtSide, profile);
      return assemblePerpRoute(stubs, mid);
    }
    return sideAwareOrthoRoute(srcK, tgtK, srcSide, tgtSide, profile);
  };

  /** 统计与已按 Level 顺序提交路径的交叉数。 */
  var countRouteCrossings = function countRouteCrossings(
    route,
    committed,
  ) {
    if (!route || route.length < 2 || !committed || !committed.length) {
      return 0;
    }
    var crossings = 0;
    for (var c = 0; c < committed.length; c++) {
      var item = committed[c];
      var other = item && item.route;
      if (!other || other.length < 2) continue;
      var hits = 0;
      for (var i = 0; i < route.length - 1; i++) {
        for (var j = 0; j < other.length - 1; j++) {
          if (
            segmentsProperlyIntersect(
              route[i],
              route[i + 1],
              other[j],
              other[j + 1],
            )
          )
            hits++;
        }
      }
      crossings += hits;
    }
    return crossings;
  };

  /** 按 Level 升序为需要避让的端点选择端口，再计算最终路由。 */
export var refineAdaptiveSidePorts = function refineAdaptiveSidePorts(
    graph,
    elementLookup,
  ) {
    var profile = resolveGraphProfile(graph);
    var allEdges = collectGraphEdges(graph, []);
    var absAll = buildAbsNodeLookup(graph, 0, 0, createKeyMap());
    // 叶子避障 + Graph 包装框端点（外部边左入/右出需要绝对框）
    var absLookup = createKeyMap();
    Object.keys(absAll).forEach(function (id) {
      if (id === "root") return;
      var nk = elementLookup[id];
      if (canAttachSidePort(nk) && absAll[id]) absLookup[id] = absAll[id];
    });
    var hasForwardOut = createKeyMap();
    var hasForwardIn = createKeyMap();
    /** 节点×侧已被更低或同级边占用的次数。 */
    var outSideUse = createKeyMap();
    var inSideUse = createKeyMap();
    var committed = [];

    var portOwners = claimPreferredPortOwners(allEdges, absLookup, profile);

    var markEdgePortsUsed = function markEdgePortsUsed(e) {
      var srcK = elementLookup[e.source];
      var tgtK = elementLookup[e.target];
      if (canAttachSidePort(srcK) && e.sourcePort) {
        var os0 = portSideOf(findPortById(srcK, e.sourcePort));
        if (os0) {
          bumpPortSideUse(outSideUse, e.source, os0);
          if (os0 === profile.outSide) hasForwardOut[e.source] = true;
        }
      }
      if (canAttachSidePort(tgtK) && e.targetPort) {
        var is0 = portSideOf(findPortById(tgtK, e.targetPort));
        if (is0) {
          bumpPortSideUse(inSideUse, e.target, is0);
          if (is0 === profile.inSide) hasForwardIn[e.target] = true;
        }
      }
    };
    allEdges.sort(function (a, b) {
      return compareDrawOrder(a, b, absLookup);
    });

    for (var i = 0; i < allEdges.length; i++) {
      var edge = allEdges[i];
      var srcNode = elementLookup[edge.source];
      var tgtNode = elementLookup[edge.target];
      var srcAttachable = canAttachSidePort(srcNode);
      var tgtAttachable = canAttachSidePort(tgtNode);
      var srcOk = srcAttachable && edge._adaptiveOut;
      var tgtOk = tgtAttachable && edge._adaptiveIn;
      if (!srcOk && !tgtOk) {
        markEdgePortsUsed(edge);
        var fixedRoute = getActualEdgeRoute(graph, edge);
        if (fixedRoute) committed.push({ route: fixedRoute });
        continue;
      }
      var fixedOutSide = srcAttachable
        ? portSideOf(findPortById(srcNode, edge.sourcePort))
        : null;
      var fixedInSide = tgtAttachable
        ? portSideOf(findPortById(tgtNode, edge.targetPort))
        : null;
      if (!srcOk && fixedOutSide) {
        bumpPortSideUse(outSideUse, edge.source, fixedOutSide);
        if (fixedOutSide === profile.outSide) hasForwardOut[edge.source] = true;
      }
      if (!tgtOk && fixedInSide) {
        bumpPortSideUse(inSideUse, edge.target, fixedInSide);
        if (fixedInSide === profile.inSide) hasForwardIn[edge.target] = true;
      }

      var srcAbsGeo = absLookup[edge.source];
      var tgtAbsGeo = absLookup[edge.target];
      var posCross = profile.cross === "y" ? "SOUTH" : "EAST";
      var negCross = profile.cross === "y" ? "NORTH" : "WEST";
      var dCrossEdge = 0;
      if (srcAbsGeo && tgtAbsGeo) {
        dCrossEdge =
          profile.cross === "y"
            ? tgtAbsGeo.y +
              tgtAbsGeo.height / 2 -
              (srcAbsGeo.y + srcAbsGeo.height / 2)
            : tgtAbsGeo.x +
              tgtAbsGeo.width / 2 -
              (srcAbsGeo.x + srcAbsGeo.width / 2);
      }
      var facingOut =
        srcAbsGeo && tgtAbsGeo
          ? crossSideTowardTarget(srcAbsGeo, tgtAbsGeo, profile)
          : null;
      var facingIn =
        srcAbsGeo && tgtAbsGeo
          ? crossSideTowardTarget(tgtAbsGeo, srcAbsGeo, profile)
          : null;

      var geoOut =
        srcAbsGeo && tgtAbsGeo
          ? pickOutSideByGeometry(srcAbsGeo, tgtAbsGeo, profile)
          : null;
      var geoIn =
        srcAbsGeo && tgtAbsGeo
          ? pickInSideByGeometry(srcAbsGeo, tgtAbsGeo, profile)
          : null;
      var shareOut =
        srcOk && isGraphWrapper(srcNode) && geoOut === profile.outSide;
      var shareIn =
        tgtOk && isGraphWrapper(tgtNode) && geoIn === profile.inSide;

      var outChoices;
      if (!srcOk) outChoices = [fixedOutSide];
      else
        outChoices = exclusiveSideChoices(
          edge,
          edge.source,
          portOwners.outOwner,
          profile.outSide,
          facingOut,
          profile,
          hasForwardOut[edge.source],
          shareOut,
        );

      var inChoices;
      if (!tgtOk) inChoices = [fixedInSide];
      else
        inChoices = exclusiveSideChoices(
          edge,
          edge.target,
          portOwners.inOwner,
          profile.inSide,
          facingIn,
          profile,
          hasForwardIn[edge.target],
          shareIn,
        );

      // 基线：首遍实际折点（仅软加分参考）；候选路径一律按新侧重生成
      var actualRoute = getActualEdgeRoute(graph, edge);
      var baseBends = actualRoute ? countRouteBends(actualRoute) : 0;

      var excludeIds = createKeyMap();
      excludeIds[edge.source] = true;
      excludeIds[edge.target] = true;

      var candidates = [];
      for (var oi = 0; oi < outChoices.length; oi++) {
        for (var ii = 0; ii < inChoices.length; ii++) {
          var os = outChoices[oi];
          var is = inChoices[ii];
          var evaluated = bendsForCandidate(
            edge,
            absLookup,
            os,
            is,
            committed,
            profile,
            elementLookup,
          );
          // 硬禁止：须垂直出/入，且不穿 Node；折点不得超过侧组合预算
          if (!evaluated.route) continue;
          if (!routeEndsPerpendicular(evaluated.route, os, is)) continue;
          if (routeCrossesNodes(evaluated.route, absLookup, excludeIds))
            continue;
          var bends = evaluated.bends;
          var bendCap = maxBendsForSides(os, is, profile);
          if (bends > bendCap || bends > MAX_BENDS_ABSOLUTE) continue;
          var route = evaluated.route;
          var crossings = Number.isFinite(evaluated.crossings)
            ? evaluated.crossings
            : countRouteCrossings(route, committed);
          var srcAbs = absLookup[edge.source];
          var tgtAbs = absLookup[edge.target];
          // 交叉侧反向判定：出/入侧与目标交叉方向相悖时视为「错误侧」。
          var geoWrong = 0;
          if (dCrossEdge > SAME_ROW_TOL) {
            if (os === negCross) geoWrong++;
            if (is === posCross) geoWrong++;
          } else if (dCrossEdge < -SAME_ROW_TOL) {
            if (os === posCross) geoWrong++;
            if (is === negCross) geoWrong++;
          }
          var score = crossings * CROSSING_WEIGHT + bends * BEND_WEIGHT;
          // 已定边的侧占用与路径交叉一并考虑。
          score +=
            portSideUseCount(outSideUse, edge.source, os) *
            PORT_SIDE_OCCUPY_WEIGHT;
          score +=
            portSideUseCount(inSideUse, edge.target, is) *
            PORT_SIDE_OCCUPY_WEIGHT;
          score += verticalAlignPenalty(os, is, srcAbs, tgtAbs, profile);
          if (
            (profileIsCrossSide(profile, os) ||
              profileIsCrossSide(profile, is)) &&
            baseBends > 0 &&
            bends < baseBends
          ) {
            score -= (baseBends - bends) * VERTICAL_BEND_BONUS;
          }
          candidates.push({
            score: score,
            outSide: os,
            inSide: is,
            route: route,
            crossings: crossings,
            bends: bends,
            geoWrong: geoWrong,
            sideLoad:
              portSideUseCount(outSideUse, edge.source, os) +
              portSideUseCount(inSideUse, edge.target, is),
          });
        }
      }
      // 端口策略模块负责候选优先级；本模块只生成和验证路径几何。
      var best = selectBestPortCandidate(candidates, profile);
      // 没有任何不穿 Node 的候选：跳过，留给后续流程线计算默认口
      if (!best || !best.route) continue;
      if (routeCrossesNodes(best.route, absLookup, excludeIds)) continue;

      if (srcOk && best.outSide) {
        if (edge.sourcePort) removePortById(srcNode, edge.sourcePort);
        edge.sourcePort = addSidePort(
          srcNode,
          edge.source,
          best.outSide,
          best.outSide.toLowerCase(),
          "out",
          false,
          edge.target,
          profile,
        );
        bumpPortSideUse(outSideUse, edge.source, best.outSide);
        if (best.outSide === profile.outSide) hasForwardOut[edge.source] = true;
      }
      if (tgtOk && best.inSide) {
        if (edge.targetPort) removePortById(tgtNode, edge.targetPort);
        edge.targetPort = addSidePort(
          tgtNode,
          edge.target,
          best.inSide,
          best.inSide.toLowerCase(),
          "in",
          false,
          edge.source,
          profile,
        );
        bumpPortSideUse(inSideUse, edge.target, best.inSide);
        if (best.inSide === profile.inSide) hasForwardIn[edge.target] = true;
      }
      // 估算路径记入 committed，供后续更高或同级边评分避让。
      committed.push({ route: best.route });
    }
  };

  /**
   * 坐标已由 WorkflowDAGLayout 写入。此处只按最终几何选口并算流程线。
   */
  var afterLayoutPortsAndRoutes = function afterLayoutPortsAndRoutes(graph) {
    if (!graph || !graph._elementLookup) return;
    var abs2 = buildAbsNodeLookup(graph, 0, 0, createKeyMap());
    clearAdaptivePorts(graph, graph._elementLookup);
    refineAdaptiveSidePorts(graph, graph._elementLookup);
    ensureAllLeafEdgePorts(graph, graph._elementLookup, abs2);
    spreadAllFixedPorts(graph, graph._elementLookup);
    abs2 = buildAbsNodeLookup(graph, 0, 0, createKeyMap());
    computeFlowRoutes(graph, graph._elementLookup, abs2);
  };

export var WorkflowDAGRules = {
    onGraphBuilt: function onGraphBuilt(graph) {
      if (!graph || !graph._elementLookup) return;
      var profile = resolveGraphProfile(graph);
      var edges = collectGraphEdges(graph, []);
      assignLevelSidePorts(graph._elementLookup, edges, profile);
    },
    afterPass2: afterLayoutPortsAndRoutes,
    simplifyOrthogonalPoints: simplifyOrthogonalPoints,
  };
